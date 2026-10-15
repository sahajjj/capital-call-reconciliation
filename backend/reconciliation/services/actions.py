from django.db import transaction
from reconciliation.models import BankTransaction, Match


class ActionError(Exception):
    """Raised when an action can't proceed (maps to 409 in the view)."""
    pass


def approve_match(match_id, org):
    """
    Approve a match atomically:
    - Lock the line item and transaction rows
    - Verify the match is still actionable
    - Update funded amount, line item status, transaction status
    - Reject sibling matches on this transaction
    """
    with transaction.atomic():
        try:
            match = (
                Match.objects
                .select_related("transaction", "line_item")
                .get(pk=match_id, transaction__organization=org)
            )
        except Match.DoesNotExist:
            return None  # 404

        if match.status != "proposed":
            raise ActionError("Match is no longer proposed.")

        txn = match.transaction
        if txn.status in ("reconciled", "ignored"):
            raise ActionError("Transaction is already reconciled or ignored.")

        # lock both rows for the duration of this transaction
        li = match.line_item.__class__.objects.select_for_update().get(
            pk=match.line_item.pk
        )
        txn = match.transaction.__class__.objects.select_for_update().get(
            pk=match.transaction.pk
        )

        # re-check after locking (another request could have approved first)
        remaining = li.amount_called - li.amount_funded
        if txn.amount > remaining:
            raise ActionError(
                f"Amount {txn.amount} exceeds remaining {remaining}. "
                f"Possibly already funded by another approval."
            )

        # update line item
        li.amount_funded += txn.amount
        if li.amount_funded >= li.amount_called:
            li.status = "funded"
        else:
            li.status = "partially_funded"
        li.save()

        # approve this match, reject siblings on same transaction
        match.status = "approved"
        match.save()

        Match.objects.filter(
            transaction=txn, status="proposed"
        ).exclude(pk=match.pk).update(status="rejected")

        txn.status = "reconciled"
        txn.save()

    return match


def reject_match(match_id, org):
    """Reject a match. If no proposed matches remain, flag txn for review."""
    try:
        match = (
            Match.objects
            .select_related("transaction")
            .get(pk=match_id, transaction__organization=org)
        )
    except Match.DoesNotExist:
        return None

    if match.status != "proposed":
        raise ActionError("Match is no longer proposed.")

    match.status = "rejected"
    match.save()

    txn = match.transaction
    remaining_proposed = txn.matches.filter(status="proposed").count()
    if remaining_proposed == 0:
        txn.status = "needs_review"
        txn.review_reason = "All proposed matches were rejected."
        txn.save()

    return match


def ignore_transaction(txn_id, org):
    """Ignore a transaction — only if it's suggested or needs_review."""
    try:
        txn = BankTransaction.objects.get(pk=txn_id, organization=org)
    except BankTransaction.DoesNotExist:
        return None

    if txn.status == "reconciled":
        raise ActionError("Cannot ignore a reconciled transaction.")
    if txn.status == "ignored":
        raise ActionError("Transaction is already ignored.")

    txn.status = "ignored"
    txn.save()

    # reject all proposed matches
    txn.matches.filter(status="proposed").update(status="rejected")

    return txn
