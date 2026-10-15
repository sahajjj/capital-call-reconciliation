import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction

from reconciliation.models import BankTransaction
from reconciliation.services.matching import run_matching


REQUIRED_COLUMNS = {"date", "description", "amount", "type", "reference"}


def import_csv(org, file_obj):
    """
    Parse a CSV upload, validate rows, save valid ones, and run matching
    on each new credit. Returns a summary dict.
    """
    text = file_obj.read().decode("utf-8-sig")  # handle BOM if present
    reader = csv.DictReader(io.StringIO(text))

    # check that all required columns are present
    if reader.fieldnames is None:
        return {"imported": 0, "duplicates": 0, "errors": [{"line": 1, "message": "Empty file or missing header row."}]}

    # normalise column names (strip whitespace, lowercase)
    cleaned_fields = {f.strip().lower() for f in reader.fieldnames}
    missing = REQUIRED_COLUMNS - cleaned_fields
    if missing:
        return {
            "imported": 0,
            "duplicates": 0,
            "errors": [{"line": 1, "message": f"Missing columns: {', '.join(sorted(missing))}"}],
        }

    # preload existing references for this org into a set — avoids per-row lookups
    existing_refs = set(
        BankTransaction.objects.filter(organization=org)
        .values_list("bank_reference", flat=True)
    )
    seen_refs = set()  # track refs within this file

    rows_to_create = []
    errors = []
    duplicates = 0

    for line_num, raw_row in enumerate(reader, start=2):
        # normalise keys and strip values
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items()}

        ref = row.get("reference", "")
        if not ref:
            errors.append({"line": line_num, "message": "Reference is required."})
            continue

        # duplicate check (db + within file)
        if ref in existing_refs or ref in seen_refs:
            duplicates += 1
            continue
        seen_refs.add(ref)

        # validate date
        date_str = row.get("date", "")
        try:
            parsed_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            errors.append({"line": line_num, "message": f"Invalid date: '{date_str}'."})
            continue

        # validate description
        description = row.get("description", "")
        if not description:
            errors.append({"line": line_num, "message": "Description is required."})
            continue

        # validate amount: strip commas, parse to Decimal
        amount_str = row.get("amount", "").replace(",", "")
        try:
            amount = Decimal(amount_str)
        except (InvalidOperation, ValueError):
            errors.append({"line": line_num, "message": f"Invalid amount: '{row.get('amount', '')}'."})
            continue

        if amount == 0:
            errors.append({"line": line_num, "message": "Amount must not be zero."})
            continue

        # validate type and sign
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

        # debits are stored as ignored; credits go through matching later
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

    # bulk insert inside a transaction for efficiency
    with transaction.atomic():
        BankTransaction.objects.bulk_create(rows_to_create)

    # run matching on each newly created credit
    credits = [t for t in rows_to_create if t.type == "credit"]
    for txn in credits:
        # after bulk_create, Django populates the pk on Postgres
        run_matching(txn)

    return {
        "imported": len(rows_to_create),
        "duplicates": duplicates,
        "errors": errors,
    }
