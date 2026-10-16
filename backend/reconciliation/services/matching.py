import re
from django.db.models import F
from reconciliation.models import LineItem, Match


def normalise_ref(text):
    return re.sub(r"[^A-Z0-9]", "", text.upper())


def normalise_name(text):
    cleaned = re.sub(r"[^A-Z0-9]", " ", text.upper())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    tokens = cleaned.split()
    if tokens and tokens[-1] in ("LLC", "LP", "LTD", "INC"):
        tokens = tokens[:-1]
    return " ".join(tokens)


def name_found_in(name, text):
    pattern = r"\b" + re.escape(name) + r"\b"
    return bool(re.search(pattern, text))


def run_matching(txn):
    org = txn.organization
    norm_desc = normalise_ref(txn.description)
    norm_bank_ref = normalise_ref(txn.bank_reference)

    eligible = [
        li for li in (
            LineItem.objects.filter(
                organization=org,
                capital_call__call_date__lte=txn.date,
            )
            .select_related("investor_entity", "capital_call")
            .exclude(amount_funded__gte=F("amount_called"))
        )
        if li.amount_remaining > 0
    ]

    if not eligible:
        txn.status = "needs_review"
        txn.review_reason = "No eligible line items found."
        txn.save(update_fields=["status", "review_reason"])
        return

    ref_matches = [
        li for li in eligible
        if normalise_ref(li.expected_wire_reference)
        and (
            normalise_ref(li.expected_wire_reference) in norm_desc
            or normalise_ref(li.expected_wire_reference) in norm_bank_ref
        )
    ]

    if ref_matches:
        if len(ref_matches) == 1:
            li = ref_matches[0]
            if txn.amount <= li.amount_remaining:
                if txn.amount == li.amount_remaining:
                    reason = f"Reference {li.expected_wire_reference} found; amount equals remaining {li.amount_remaining:,.2f} (full payment)."
                else:
                    reason = f"Reference {li.expected_wire_reference} found; amount {txn.amount:,.2f} is partial payment (remaining {li.amount_remaining:,.2f})."
                Match.objects.create(transaction=txn, line_item=li, status="proposed", reason=reason)
                txn.status = "suggested"
            else:
                txn.status = "needs_review"
                txn.review_reason = (
                    f"Reference {li.expected_wire_reference} found but amount "
                    f"{txn.amount:,.2f} exceeds remaining {li.amount_remaining:,.2f} (overpayment)."
                )
            txn.save(update_fields=["status", "review_reason"])
        else:
            for li in ref_matches:
                Match.objects.create(
                    transaction=txn,
                    line_item=li,
                    status="proposed",
                    reason=f"Reference {li.expected_wire_reference} found (multiple matches).",
                )
            txn.status = "needs_review"
            txn.review_reason = f"Multiple references matched: {', '.join(li.expected_wire_reference for li in ref_matches)}."
            txn.save(update_fields=["status", "review_reason"])
        return

    norm_desc_for_name = normalise_name(txn.description)
    name_matches = [
        li for li in eligible
        if li.amount_remaining == txn.amount
        and normalise_name(li.investor_entity.name)
        and name_found_in(normalise_name(li.investor_entity.name), norm_desc_for_name)
    ]

    if len(name_matches) == 1:
        li = name_matches[0]
        Match.objects.create(
            transaction=txn,
            line_item=li,
            status="proposed",
            reason=f"Investor name '{li.investor_entity.name}' found in description; amount matches remaining {li.amount_remaining:,.2f}.",
        )
        txn.status = "suggested"
    elif len(name_matches) > 1:
        for li in name_matches:
            Match.objects.create(
                transaction=txn,
                line_item=li,
                status="proposed",
                reason=f"Investor name '{li.investor_entity.name}' found in description; amount matches remaining {li.amount_remaining:,.2f} (multiple candidates).",
            )
        txn.status = "needs_review"
        txn.review_reason = f"Multiple name+amount matches: {', '.join(li.investor_entity.name for li in name_matches)}."
    else:
        txn.status = "needs_review"
        txn.review_reason = "No reference or name+amount match found."

    txn.save(update_fields=["status", "review_reason"])
