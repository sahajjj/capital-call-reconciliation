from django.db import transaction
from reconciliation.models import BankTransaction, LineItem, Match


class ActionError(Exception):
    pass


def approve_match(match_id, org):
    with transaction.atomic():
        try:
            match = (
                Match.objects
                .select_related("transaction", "line_item")
                .get(pk=match_id, transaction__organization=org)
            )
        except Match.DoesNotExist:
            return None

        if match.status != "proposed":
            raise ActionError("Match is no longer proposed.")

        txn = match.transaction
        if txn.status in ("reconciled", "ignored"):
            raise ActionError("Transaction is already reconciled or ignored.")

        li = LineItem.objects.select_for_update().get(pk=match.line_item_id)
        txn = BankTransaction.objects.select_for_update().get(pk=match.transaction_id)

        remaining = li.amount_called - li.amount_funded
        if txn.amount > remaining:
            raise ActionError(f"Amount {txn.amount} exceeds remaining {remaining}.")

        li.amount_funded += txn.amount
        li.status = "funded" if li.amount_funded >= li.amount_called else "partially_funded"
        li.save()

        match.status = "approved"
        match.save()

        Match.objects.filter(
            transaction=txn, status="proposed"
        ).exclude(pk=match.pk).update(status="rejected")

        txn.status = "reconciled"
        txn.save()

    return match


def reject_match(match_id, org):
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
    if not txn.matches.filter(status="proposed").exists():
        txn.status = "needs_review"
        txn.review_reason = "All proposed matches were rejected."
        txn.save()

    return match


def ignore_transaction(txn_id, org):
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

    txn.matches.filter(status="proposed").update(status="rejected")
    return txn
