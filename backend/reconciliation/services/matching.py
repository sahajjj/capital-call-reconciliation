import re
from django.db.models import F
from reconciliation.models import LineItem, Match


def normalise_ref(text):
    """Uppercase, keep only letters and digits."""
    return re.sub(r"[^A-Z0-9]", "", text.upper())


def normalise_name(text):
    """
    Uppercase, replace non-alphanumeric with space, collapse spaces,
    then drop one trailing token if it's LLC/LP/LTD/INC.
    TRUST is intentionally kept.
    """
    cleaned = re.sub(r"[^A-Z0-9]", " ", text.upper())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    tokens = cleaned.split()
    if tokens and tokens[-1] in ("LLC", "LP", "LTD", "INC"):
        tokens = tokens[:-1]
    return " ".join(tokens)


def name_found_in(name, text):
    """Check if name appears as whole words in text."""
    # \b handles word boundaries — ensures "RAHUL SHAH TRUST" doesn't
    # match "RAHUL SHAHTRUSTEE"
    pattern = r"\b" + re.escape(name) + r"\b"
    return bool(re.search(pattern, text))


def run_matching(txn):
    """
    Try to match a credit transaction to open line items.
    Steps: reference match first, then fall back to name+amount.
    """
    org = txn.organization
    norm_desc = normalise_ref(txn.description)
    norm_bank_ref = normalise_ref(txn.bank_reference)

    # eligible: same org, has remaining balance, call date <= txn date
    eligible = list(
        LineItem.objects.filter(
            organization=org,
            capital_call__call_date__lte=txn.date,
        )
        .select_related("investor_entity", "capital_call")
        .exclude(amount_funded__gte=F("amount_called"))
    )
    # filter in Python — remaining > 0 (belt + suspenders since the exclude
    # above handles the fully-funded case, but partial funding needs Python check)
    eligible = [li for li in eligible if li.amount_remaining > 0]

    if not eligible:
        txn.status = "needs_review"
        txn.review_reason = "No eligible line items found."
        txn.save()
        return

    # --- Step 2: Reference check ---
    ref_matches = []
    for li in eligible:
        norm_li_ref = normalise_ref(li.expected_wire_reference)
        if norm_li_ref in norm_desc or norm_li_ref in norm_bank_ref:
            ref_matches.append(li)

    if ref_matches:
        if len(ref_matches) == 1:
            li = ref_matches[0]
            if txn.amount <= li.amount_remaining:
                # good match
                if txn.amount == li.amount_remaining:
                    reason = f"Reference {li.expected_wire_reference} found; amount equals remaining {li.amount_remaining:,.2f} (full payment)."
                else:
                    reason = f"Reference {li.expected_wire_reference} found; amount {txn.amount:,.2f} is partial payment (remaining {li.amount_remaining:,.2f})."
                Match.objects.create(
                    transaction=txn, line_item=li,
                    status="proposed", reason=reason,
                )
                txn.status = "suggested"
                txn.save()
            else:
                # overpayment
                txn.status = "needs_review"
                txn.review_reason = (
                    f"Reference {li.expected_wire_reference} found but amount "
                    f"{txn.amount:,.2f} exceeds remaining {li.amount_remaining:,.2f} (overpayment)."
                )
                txn.save()
        else:
            # multiple reference matches
            for li in ref_matches:
                reason = f"Reference {li.expected_wire_reference} found (multiple matches)."
                Match.objects.create(
                    transaction=txn, line_item=li,
                    status="proposed", reason=reason,
                )
            txn.status = "needs_review"
            txn.review_reason = (
                f"Multiple references matched: {', '.join(li.expected_wire_reference for li in ref_matches)}."
            )
            txn.save()
        return  # skip step 3 when any ref matched

    # --- Step 3: Name + amount check ---
    norm_desc_for_name = normalise_name(txn.description)
    name_matches = []
    for li in eligible:
        if li.amount_remaining != txn.amount:
            continue
        norm_investor = normalise_name(li.investor_entity.name)
        if name_found_in(norm_investor, norm_desc_for_name):
            name_matches.append(li)

    if len(name_matches) == 1:
        li = name_matches[0]
        reason = (
            f"Investor name '{li.investor_entity.name}' found in description; "
            f"amount matches remaining {li.amount_remaining:,.2f}."
        )
        Match.objects.create(
            transaction=txn, line_item=li,
            status="proposed", reason=reason,
        )
        txn.status = "suggested"
        txn.save()
    elif len(name_matches) > 1:
        for li in name_matches:
            reason = (
                f"Investor name '{li.investor_entity.name}' found in description; "
                f"amount matches remaining {li.amount_remaining:,.2f} (multiple candidates)."
            )
            Match.objects.create(
                transaction=txn, line_item=li,
                status="proposed", reason=reason,
            )
        txn.status = "needs_review"
        txn.review_reason = (
            f"Multiple name+amount matches: "
            f"{', '.join(li.investor_entity.name for li in name_matches)}."
        )
        txn.save()
    else:
        txn.status = "needs_review"
        txn.review_reason = "No reference or name+amount match found."
        txn.save()

