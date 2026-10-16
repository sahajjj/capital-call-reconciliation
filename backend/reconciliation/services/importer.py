import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction

from reconciliation.models import BankTransaction
from reconciliation.services.matching import run_matching


REQUIRED_COLUMNS = {"date", "description", "amount", "type", "reference"}


def import_csv(org, file_obj):
    raw = file_obj.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="replace")

    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        return {
            "imported": 0,
            "duplicates": 0,
            "errors": [{"line": 1, "message": "Empty file or missing header row."}],
            "rejected": True,
        }

    cleaned_fields = {f.strip().lower() for f in reader.fieldnames if f}
    missing = REQUIRED_COLUMNS - cleaned_fields
    if missing:
        return {
            "imported": 0,
            "duplicates": 0,
            "errors": [{"line": 1, "message": f"Missing columns: {', '.join(sorted(missing))}"}],
            "rejected": True,
        }

    existing_refs = set(
        BankTransaction.objects.filter(organization=org)
        .values_list("bank_reference", flat=True)
    )
    seen_refs = set()

    rows_to_create = []
    errors = []
    duplicates = 0

    for line_num, raw_row in enumerate(reader, start=2):
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items()}

        ref = row.get("reference", "")
        if not ref:
            errors.append({"line": line_num, "message": "Reference is required."})
            continue

        if ref in existing_refs or ref in seen_refs:
            duplicates += 1
            continue
        seen_refs.add(ref)

        date_str = row.get("date", "")
        try:
            parsed_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            errors.append({"line": line_num, "message": f"Invalid date: '{date_str}'."})
            continue

        description = row.get("description", "")
        if not description:
            errors.append({"line": line_num, "message": "Description is required."})
            continue

        amount_str = row.get("amount", "").replace(",", "").replace("$", "").strip()
        try:
            amount = Decimal(amount_str)
        except (InvalidOperation, ValueError):
            errors.append({"line": line_num, "message": f"Invalid amount: '{row.get('amount', '')}'."})
            continue

        if amount == 0:
            errors.append({"line": line_num, "message": "Amount must not be zero."})
            continue

        txn_type = row.get("type", "").lower()
        if txn_type not in ("credit", "debit"):
            errors.append({"line": line_num, "message": f"Invalid type: '{row.get('type', '')}'."})
            continue

        if txn_type == "credit" and amount < 0:
            errors.append({"line": line_num, "message": "Credit amount must be positive."})
            continue
        if txn_type == "debit" and amount > 0:
            errors.append({"line": line_num, "message": "Debit amount must be negative."})
            continue

        status = "ignored" if txn_type == "debit" else "suggested"

        rows_to_create.append(
            BankTransaction(
                organization=org,
                date=parsed_date,
                description=description,
                amount=amount,
                type=txn_type,
                bank_reference=ref,
                status=status,
            )
        )

    with transaction.atomic():
        BankTransaction.objects.bulk_create(rows_to_create)
        for txn in rows_to_create:
            if txn.type == "credit":
                run_matching(txn)

    return {
        "imported": len(rows_to_create),
        "duplicates": duplicates,
        "errors": errors,
    }
