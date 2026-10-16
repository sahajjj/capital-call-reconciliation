import io
from decimal import Decimal

from django.test import TestCase

from reconciliation.models import (
    Organization, InvestorEntity, CapitalCall,
    LineItem, BankTransaction,
)
from reconciliation.services.importer import import_csv
from reconciliation.services.matching import normalise_ref, normalise_name
from reconciliation.services.actions import approve_match, reject_match, ignore_transaction, ActionError


def make_csv(rows, header="date,description,amount,type,reference"):
    content = header + "\n" + "\n".join(rows)
    return io.BytesIO(content.encode("utf-8"))


class BaseTestCase(TestCase):
    def setUp(self):
        self.nw = Organization.objects.create(slug="northwind", name="Northwind Ventures")
        self.bb = Organization.objects.create(slug="bluebird", name="Bluebird Capital")

        self.haller = InvestorEntity.objects.create(organization=self.nw, name="Haller Capital LLC")
        self.rahul = InvestorEntity.objects.create(organization=self.nw, name="Rahul Shah Trust")
        self.patel = InvestorEntity.objects.create(organization=self.nw, name="Patel Family Trust")
        self.meridian = InvestorEntity.objects.create(organization=self.nw, name="Meridian Partners LP")
        self.oakridge = InvestorEntity.objects.create(organization=self.nw, name="Oakridge Holdings LLC")

        self.cedar = InvestorEntity.objects.create(organization=self.bb, name="Cedar Grove Fund LP")

        self.cc1 = CapitalCall.objects.create(
            organization=self.nw, number=1,
            call_date="2026-03-25", due_date="2026-04-10",
        )
        self.cc2 = CapitalCall.objects.create(
            organization=self.nw, number=2,
            call_date="2026-04-01", due_date="2026-04-20",
        )
        self.bb_cc1 = CapitalCall.objects.create(
            organization=self.bb, number=1,
            call_date="2026-04-01", due_date="2026-04-15",
        )

        self.li_1001 = LineItem.objects.create(
            organization=self.nw, capital_call=self.cc1,
            investor_entity=self.haller, expected_wire_reference="CC-1001",
            amount_called=Decimal("27500.00"),
        )
        self.li_1002 = LineItem.objects.create(
            organization=self.nw, capital_call=self.cc1,
            investor_entity=self.rahul, expected_wire_reference="CC-1002",
            amount_called=Decimal("25000.00"),
        )
        self.li_1003 = LineItem.objects.create(
            organization=self.nw, capital_call=self.cc1,
            investor_entity=self.patel, expected_wire_reference="CC-1003",
            amount_called=Decimal("12500.00"),
        )
        self.li_1004 = LineItem.objects.create(
            organization=self.nw, capital_call=self.cc1,
            investor_entity=self.meridian, expected_wire_reference="CC-1004",
            amount_called=Decimal("15000.00"),
        )
        self.li_1005 = LineItem.objects.create(
            organization=self.nw, capital_call=self.cc1,
            investor_entity=self.oakridge, expected_wire_reference="CC-1005",
            amount_called=Decimal("15000.00"),
        )
        self.li_1006 = LineItem.objects.create(
            organization=self.nw, capital_call=self.cc2,
            investor_entity=self.oakridge, expected_wire_reference="CC-1006",
            amount_called=Decimal("15000.00"),
        )
        self.li_2001 = LineItem.objects.create(
            organization=self.bb, capital_call=self.bb_cc1,
            investor_entity=self.cedar, expected_wire_reference="CC-2001",
            amount_called=Decimal("40000.00"),
        )


class TestMissingColumn(BaseTestCase):
    def test_missing_column_returns_error_saves_nothing(self):
        csv = make_csv(
            ["2026-04-01,Some wire,1000.00,credit"],
            header="date,description,amount,type",
        )
        result = import_csv(self.nw, csv)
        self.assertEqual(result["imported"], 0)
        self.assertGreater(len(result["errors"]), 0)
        self.assertIn("reference", result["errors"][0]["message"].lower())
        self.assertEqual(BankTransaction.objects.count(), 0)


class TestAmountParsing(BaseTestCase):
    def test_thousands_separator_parsed(self):
        csv = make_csv([
            '2026-04-01,WIRE REF CC-1001,"27,500.00",credit,REF-001',
        ])
        result = import_csv(self.nw, csv)
        self.assertEqual(result["imported"], 1)
        txn = BankTransaction.objects.get(bank_reference="REF-001")
        self.assertEqual(txn.amount, Decimal("27500.00"))

    def test_sign_type_mismatch_rejected(self):
        csv = make_csv([
            "2026-04-01,Bad wire,-500.00,credit,REF-002",
        ])
        result = import_csv(self.nw, csv)
        self.assertEqual(result["imported"], 0)
        self.assertEqual(len(result["errors"]), 1)
        self.assertIn("positive", result["errors"][0]["message"].lower())

    def test_debit_positive_rejected(self):
        csv = make_csv([
            "2026-04-01,Fee,500.00,debit,REF-003",
        ])
        result = import_csv(self.nw, csv)
        self.assertEqual(result["imported"], 0)
        self.assertEqual(len(result["errors"]), 1)

    def test_invalid_date_rejected(self):
        csv = make_csv([
            "2026-13-01,Bad date,1000.00,credit,REF-004",
        ])
        result = import_csv(self.nw, csv)
        self.assertEqual(result["imported"], 0)
        self.assertEqual(len(result["errors"]), 1)
        self.assertIn("date", result["errors"][0]["message"].lower())

    def test_zero_amount_rejected(self):
        csv = make_csv([
            "2026-04-01,Zero wire,0.00,credit,REF-005",
        ])
        result = import_csv(self.nw, csv)
        self.assertEqual(result["imported"], 0)
        self.assertEqual(len(result["errors"]), 1)


class TestDuplicates(BaseTestCase):
    def test_reupload_duplicates_skipped(self):
        csv1 = make_csv([
            "2026-04-01,WIRE REF CC-1001,27500.00,credit,REF-100",
        ])
        result1 = import_csv(self.nw, csv1)
        self.assertEqual(result1["imported"], 1)

        csv2 = make_csv([
            "2026-04-01,WIRE REF CC-1001,27500.00,credit,REF-100",
        ])
        result2 = import_csv(self.nw, csv2)
        self.assertEqual(result2["imported"], 0)
        self.assertEqual(result2["duplicates"], 1)
        self.assertEqual(BankTransaction.objects.filter(bank_reference="REF-100").count(), 1)

    def test_duplicate_within_file(self):
        csv = make_csv([
            "2026-04-01,WIRE A,1000.00,credit,REF-200",
            "2026-04-01,WIRE B,2000.00,credit,REF-200",
        ])
        result = import_csv(self.nw, csv)
        self.assertEqual(result["imported"], 1)
        self.assertEqual(result["duplicates"], 1)

    def test_different_orgs_can_share_reference(self):
        csv_nw = make_csv([
            "2026-04-01,WIRE NW,1000.00,credit,SHARED-REF",
        ])
        csv_bb = make_csv([
            "2026-04-01,WIRE BB,1000.00,credit,SHARED-REF",
        ])
        import_csv(self.nw, csv_nw)
        result = import_csv(self.bb, csv_bb)
        self.assertEqual(result["imported"], 1)
        self.assertEqual(result["duplicates"], 0)


class TestReferenceMatch(BaseTestCase):
    def test_reference_match_cc1001_lowercase(self):
        csv = make_csv([
            "2026-04-01,WIRE INCOMING REF cc1001,27500.00,credit,WIRE-001",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="WIRE-001")
        self.assertEqual(txn.status, "suggested")
        matches = txn.matches.all()
        self.assertEqual(matches.count(), 1)
        self.assertEqual(matches[0].line_item, self.li_1001)
        self.assertEqual(matches[0].status, "proposed")

    def test_partial_payment(self):
        csv = make_csv([
            "2026-04-01,WIRE INCOMING REF CC-1001,10000.00,credit,WIRE-002",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="WIRE-002")
        self.assertEqual(txn.status, "suggested")
        match = txn.matches.first()
        self.assertIn("partial", match.reason.lower())

    def test_reference_in_bank_reference_field(self):
        csv = make_csv([
            "2026-04-01,GENERIC WIRE TRANSFER,12500.00,credit,CC-1003",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="CC-1003")
        self.assertEqual(txn.status, "suggested")
        self.assertEqual(txn.matches.first().line_item, self.li_1003)


class TestNameAmountMatch(BaseTestCase):
    def test_name_amount_match(self):
        csv = make_csv([
            "2026-04-01,WIRE INCOMING PATEL FAMILY TRUST,12500.00,credit,WIRE-010",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="WIRE-010")
        self.assertEqual(txn.status, "suggested")
        match = txn.matches.first()
        self.assertEqual(match.line_item, self.li_1003)

    def test_multiple_name_candidates_needs_review(self):
        csv = make_csv([
            "2026-04-05,WIRE FROM OAKRIDGE HOLDINGS,15000.00,credit,WIRE-011",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="WIRE-011")
        self.assertEqual(txn.status, "needs_review")
        self.assertEqual(txn.matches.filter(status="proposed").count(), 2)


class TestOverpayment(BaseTestCase):
    def test_overpayment_needs_review_no_match(self):
        csv = make_csv([
            "2026-04-01,WIRE REF CC-1003,99999.00,credit,WIRE-020",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="WIRE-020")
        self.assertEqual(txn.status, "needs_review")
        self.assertIn("overpayment", txn.review_reason.lower())
        self.assertEqual(txn.matches.count(), 0)


class TestApprove(BaseTestCase):
    def test_approve_updates_funded_amount(self):
        csv = make_csv([
            "2026-04-01,WIRE REF CC-1003,12500.00,credit,WIRE-030",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="WIRE-030")
        match = txn.matches.first()

        result = approve_match(match.pk, self.nw)
        self.assertEqual(result.status, "approved")

        self.li_1003.refresh_from_db()
        self.assertEqual(self.li_1003.amount_funded, Decimal("12500.00"))
        self.assertEqual(self.li_1003.status, "funded")

        txn.refresh_from_db()
        self.assertEqual(txn.status, "reconciled")

    def test_double_approve_returns_409(self):
        csv = make_csv([
            "2026-04-01,WIRE REF CC-1002,25000.00,credit,WIRE-031",
            "2026-04-01,WIRE REF CC-1002,25000.00,credit,WIRE-032",
        ])
        import_csv(self.nw, csv)
        match1 = BankTransaction.objects.get(bank_reference="WIRE-031").matches.first()
        match2 = BankTransaction.objects.get(bank_reference="WIRE-032").matches.first()
        self.assertIsNotNone(match1)
        self.assertIsNotNone(match2)

        approve_match(match1.pk, self.nw)

        with self.assertRaises(ActionError):
            approve_match(match1.pk, self.nw)

        with self.assertRaises(ActionError):
            approve_match(match2.pk, self.nw)

        resp = self.client.post(
            f"/api/matches/{match2.pk}/approve/",
            HTTP_X_ORGANIZATION="northwind",
        )
        self.assertEqual(resp.status_code, 409)

    def test_partial_then_full(self):
        csv1 = make_csv([
            "2026-04-01,WIRE REF CC-1001,10000.00,credit,WIRE-040",
        ])
        import_csv(self.nw, csv1)
        m1 = BankTransaction.objects.get(bank_reference="WIRE-040").matches.first()
        approve_match(m1.pk, self.nw)

        self.li_1001.refresh_from_db()
        self.assertEqual(self.li_1001.status, "partially_funded")
        self.assertEqual(self.li_1001.amount_funded, Decimal("10000.00"))

        csv2 = make_csv([
            "2026-04-01,WIRE REF CC-1001,17500.00,credit,WIRE-041",
        ])
        import_csv(self.nw, csv2)
        m2 = BankTransaction.objects.get(bank_reference="WIRE-041").matches.first()
        approve_match(m2.pk, self.nw)

        self.li_1001.refresh_from_db()
        self.assertEqual(self.li_1001.status, "funded")
        self.assertEqual(self.li_1001.amount_funded, Decimal("27500.00"))


class TestOrgIsolation(BaseTestCase):
    def test_listing_only_shows_own_org(self):
        csv = make_csv([
            "2026-04-01,WIRE,1000.00,credit,ORG-ISO-1",
        ])
        import_csv(self.nw, csv)

        nw_txns = BankTransaction.objects.filter(organization=self.nw)
        bb_txns = BankTransaction.objects.filter(organization=self.bb)
        self.assertEqual(nw_txns.count(), 1)
        self.assertEqual(bb_txns.count(), 0)

    def test_approve_other_org_match_returns_none(self):
        csv = make_csv([
            "2026-04-01,WIRE REF CC-1003,12500.00,credit,ORG-ISO-2",
        ])
        import_csv(self.nw, csv)
        match = BankTransaction.objects.get(bank_reference="ORG-ISO-2").matches.first()

        result = approve_match(match.pk, self.bb)
        self.assertIsNone(result)

    def test_api_transaction_list_scoped_by_org(self):
        csv = make_csv([
            "2026-04-01,WIRE,1000.00,credit,API-ISO-1",
        ])
        import_csv(self.nw, csv)

        resp = self.client.get(
            "/api/transactions/",
            HTTP_X_ORGANIZATION="northwind",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 1)

        resp = self.client.get(
            "/api/transactions/",
            HTTP_X_ORGANIZATION="bluebird",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 0)

    def test_missing_org_header_returns_400(self):
        resp = self.client.get("/api/transactions/")
        self.assertEqual(resp.status_code, 400)

    def test_unknown_org_returns_404(self):
        resp = self.client.get(
            "/api/transactions/",
            HTTP_X_ORGANIZATION="nonexistent",
        )
        self.assertEqual(resp.status_code, 404)


class TestNormalisation(TestCase):
    def test_normalise_ref(self):
        self.assertEqual(normalise_ref("cc-1003"), "CC1003")
        self.assertEqual(normalise_ref("CC 1003"), "CC1003")
        self.assertEqual(normalise_ref("ref-abc-123!"), "REFABC123")

    def test_normalise_name_drops_llc(self):
        self.assertEqual(normalise_name("Haller Capital LLC"), "HALLER CAPITAL")

    def test_normalise_name_drops_lp(self):
        self.assertEqual(normalise_name("Meridian Partners LP"), "MERIDIAN PARTNERS")

    def test_normalise_name_keeps_trust(self):
        self.assertEqual(normalise_name("Rahul Shah Trust"), "RAHUL SHAH TRUST")

    def test_normalise_name_handles_extra_punctuation(self):
        self.assertEqual(normalise_name("Foo-Bar, Inc."), "FOO BAR")


class TestRejectIgnore(BaseTestCase):
    def test_reject_sets_needs_review_when_no_proposed_left(self):
        csv = make_csv([
            "2026-04-01,WIRE REF CC-1003,12500.00,credit,WIRE-050",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="WIRE-050")
        match = txn.matches.first()

        reject_match(match.pk, self.nw)
        txn.refresh_from_db()
        self.assertEqual(txn.status, "needs_review")

    def test_ignore_rejects_matches(self):
        csv = make_csv([
            "2026-04-01,WIRE REF CC-1003,12500.00,credit,WIRE-051",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="WIRE-051")
        self.assertEqual(txn.matches.filter(status="proposed").count(), 1)

        ignore_transaction(txn.pk, self.nw)
        txn.refresh_from_db()
        self.assertEqual(txn.status, "ignored")
        self.assertEqual(txn.matches.filter(status="proposed").count(), 0)

    def test_ignore_reconciled_returns_409(self):
        csv = make_csv([
            "2026-04-01,WIRE REF CC-1003,12500.00,credit,WIRE-052",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="WIRE-052")
        match = txn.matches.first()
        approve_match(match.pk, self.nw)

        with self.assertRaises(ActionError):
            ignore_transaction(txn.pk, self.nw)

    def test_no_match_unknown_wire(self):
        csv = make_csv([
            "2026-04-01,UNKNOWN INCOMING WIRE,9999.99,credit,WIRE-060",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="WIRE-060")
        self.assertEqual(txn.status, "needs_review")
        self.assertEqual(txn.matches.count(), 0)

    def test_debit_stored_as_ignored(self):
        csv = make_csv([
            "2026-04-01,BANK FEE,-50.00,debit,DEBIT-001",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="DEBIT-001")
        self.assertEqual(txn.type, "debit")
        self.assertEqual(txn.status, "ignored")


class TestMatchingEdgeCases(BaseTestCase):
    def test_blank_reference_does_not_match(self):
        LineItem.objects.create(
            organization=self.nw,
            capital_call=self.cc1,
            investor_entity=self.haller,
            expected_wire_reference="",
            amount_called=Decimal("5000.00"),
        )
        csv = make_csv([
            "2026-04-01,SOME WIRE WITH NO REF,5000.00,credit,EDGE-REF-1",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="EDGE-REF-1")
        self.assertEqual(
            txn.matches.filter(line_item__expected_wire_reference="").count(), 0
        )

    def test_suffix_only_entity_name_does_not_false_match(self):
        llc_entity = InvestorEntity.objects.create(organization=self.nw, name="LLC")
        LineItem.objects.create(
            organization=self.nw,
            capital_call=self.cc1,
            investor_entity=llc_entity,
            expected_wire_reference="CC-SPECIAL",
            amount_called=Decimal("3000.00"),
        )
        csv = make_csv([
            "2026-04-01,WIRE TRANSFER FROM SOMEONE ELSE,3000.00,credit,EDGE-NAME-1",
        ])
        import_csv(self.nw, csv)
        txn = BankTransaction.objects.get(bank_reference="EDGE-NAME-1")
        self.assertEqual(
            txn.matches.filter(line_item__investor_entity=llc_entity).count(), 0
        )

