# FundFlow — Capital Call Reconciliation Assessment

FundFlow is a multi-tenant capital call reconciliation service that ingests bank statement CSVs, matches incoming wire credits against open investor capital call line items, and provides an approval workflow.

---

## 1. Quickstart from Fresh Clone

### Prerequisites
- Python 3.10+ (tested with 3.14)
- Node.js 18+ and npm
- PostgreSQL (or uses SQLite out-of-the-box for zero-dependency local testing)

### Step 1: Backend Setup
```bash
cd backend
python -m venv venv

# Windows PowerShell:
venv\Scripts\Activate.ps1  # or use venv\Scripts\python directly
pip install -r requirements.txt

# Run migrations and seed demo data:
python manage.py migrate
python manage.py seed_demo

# Run the Django server (port 8000):
python manage.py runserver
```

### Step 2: Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
# Starts Vite dev server at http://localhost:5173 with proxy to Django /api
```

Open `http://localhost:5173` in your browser. You can immediately upload the CSV files in `demo_data/` to test both Northwind Ventures and Bluebird Capital.

---

## 2. Test Suite Command

Run all 33 tests with one single command from `backend/`:

```bash
python manage.py test
```

### Test Coverage Highlights:
1. **Missing CSV columns:** Rejects file, returns 400 with line 1 detail, stores nothing.
2. **Amount parsing:** Handles comma thousands separators (`"27,500.00"`), verifies Decimal precision, flags invalid dates, zero amounts, and sign/type mismatches.
3. **Duplicate detection:** Skips duplicate references inside the same file and across prior imports for that organization. Confirms distinct organizations can safely share identical bank references.
4. **Reference matching:** Handles case-insensitivity and punctuation normalisation (e.g. `cc1001` matches `CC-1001`), identifies partial payments vs full payments.
5. **Name + amount matching:** Normalises corporate suffixes (`LLC`, `LP`, etc.), retains `TRUST`, performs whole-word boundary matching. Handles multiple candidate collision cleanly into `needs_review`.
6. **Overpayment safeguard:** Wires exceeding remaining balance are marked `needs_review` with no match created.
7. **Concurrency & idempotency:** `approve_match` uses `select_for_update()`; duplicate or competing approval calls return HTTP 409 Conflict with zero double-funding.
8. **Tenant isolation:** Strict scoping by `X-Organization` header. Cross-tenant access returns 404 (never 403 or leaking other tenants' data).

---

## 3. Configuration & Environment Variables

See `.env.example` at repository root:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/fundflow
SECRET_KEY=change-me-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

*Note: If `DATABASE_URL` is omitted, the application automatically uses SQLite (`db.sqlite3`) for seamless local inspection without needing an active PostgreSQL daemon running.*

---

## 4. Data Model Summary

All tenant data models include an explicit foreign key to `Organization`:

- **Organization**: `slug` (unique), `name`.
- **InvestorEntity**: `organization`, `name`.
- **CapitalCall**: `organization`, `call_date`, `due_date`, `number`.
- **LineItem**: `organization`, `capital_call`, `investor_entity`, `expected_wire_reference`, `amount_called` (Decimal 14,2), `amount_funded` (Decimal 14,2, default 0), `status` (`open`, `partially_funded`, `funded`). Property: `amount_remaining = amount_called - amount_funded`.
- **BankTransaction**: `organization`, `date`, `description`, `amount` (Decimal 14,2), `type` (`credit`/`debit`), `bank_reference`, `status` (`suggested`, `needs_review`, `reconciled`, `ignored`), `review_reason`, `created_at`. Unique constraint on `(organization, bank_reference)`.
- **Match**: `transaction`, `line_item`, `status` (`proposed`, `approved`, `rejected`), `reason`.

---

## 5. REST API Endpoints

All `/api/` endpoints require the header `X-Organization: <slug>`:
- Missing header &rarr; HTTP 400 Bad Request
- Unknown slug &rarr; HTTP 404 Not Found
- Records belonging to another tenant &rarr; HTTP 404 Not Found

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/transactions/` | Lists transactions (newest first) with nested matches, reason, and status. |
| `POST` | `/api/transactions/import/` | Multipart CSV upload. Returns `{imported, duplicates, errors}`. |
| `POST` | `/api/transactions/<id>/ignore/` | Marks credit transaction as ignored; rejects its matches (returns 409 if reconciled). |
| `GET` | `/api/line-items/` | Lists line items with called, funded, remaining, and status. |
| `POST` | `/api/matches/<id>/approve/` | Atomically locks rows, updates funding, marks reconciled (returns 409 on conflict). |
| `POST` | `/api/matches/<id>/reject/` | Rejects proposed match; switches transaction to `needs_review` if no proposals remain. |

---

## 6. Assumptions, Trade-offs & Next Steps

1. **Substring Reference Matching:**
   Per requirements, reference matching checks whether the normalised line item reference appears as a substring inside the transaction's description or bank reference. In production, this can occasionally produce false positives if an investor reference happens to be a short numeric code (e.g. `101`) that matches random bank transaction numbers. In a production setting, combining length thresholds or regex token boundaries (`\b`) is recommended.
2. **Debits:**
   Debits (e.g. bank transfer fees or maintenance charges) are stored with status `ignored` as specified, so they do not trigger false matching or alter line item targets.
3. **Database Concurrency:**
   Row-level locks (`select_for_update()`) inside `transaction.atomic()` are used in `approve_match` on both the target `LineItem` and `BankTransaction`. This prevents race conditions when concurrent approvals or duplicate clicks arrive simultaneously.
4. **Future Enhancements:**
   - Multi-line item split: allowing a single wire payment to split across multiple line items (e.g., when an LP pays two calls in one wire).
   - Audit log trail: recording user ID, timestamp, and previous state for all approve/reject actions.
   - Background processing: for CSV files with >100,000 rows, routing ingestion to a Celery worker with WebSockets/Server-Sent Events for real-time progress.

---

## 7. AI Disclosure

An AI pair-programming assistant was used to assist with boilerplate drafting, test case generation, and layout styling during development.
