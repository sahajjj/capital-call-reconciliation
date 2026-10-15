from decimal import Decimal
from django.core.management.base import BaseCommand
from reconciliation.models import (
    Organization, InvestorEntity, CapitalCall, LineItem,
)


class Command(BaseCommand):
    help = "Seed demo data for Northwind Ventures and Bluebird Capital."

    def handle(self, *args, **options):
        nw, _ = Organization.objects.update_or_create(
            slug="northwind", defaults={"name": "Northwind Ventures"}
        )
        bb, _ = Organization.objects.update_or_create(
            slug="bluebird", defaults={"name": "Bluebird Capital"}
        )

        investor_names = [
            "Haller Capital LLC",
            "Rahul Shah Trust",
            "Patel Family Trust",
            "Meridian Partners LP",
            "Oakridge Holdings LLC",
        ]
        investors = {
            name: InvestorEntity.objects.get_or_create(organization=nw, name=name)[0]
            for name in investor_names
        }

        cedar, _ = InvestorEntity.objects.get_or_create(
            organization=bb, name="Cedar Grove Fund LP"
        )

        cc1, _ = CapitalCall.objects.update_or_create(
            organization=nw, number=1,
            defaults={"call_date": "2026-03-25", "due_date": "2026-04-10"},
        )
        call1_items = [
            ("Haller Capital LLC", "CC-1001", "27500.00"),
            ("Rahul Shah Trust", "CC-1002", "25000.00"),
            ("Patel Family Trust", "CC-1003", "12500.00"),
            ("Meridian Partners LP", "CC-1004", "15000.00"),
            ("Oakridge Holdings LLC", "CC-1005", "15000.00"),
        ]
        for inv_name, ref, amt in call1_items:
            LineItem.objects.update_or_create(
                organization=nw,
                capital_call=cc1,
                expected_wire_reference=ref,
                defaults={
                    "investor_entity": investors[inv_name],
                    "amount_called": Decimal(amt),
                    "amount_funded": Decimal("0.00"),
                    "status": "open",
                },
            )

        cc2, _ = CapitalCall.objects.update_or_create(
            organization=nw, number=2,
            defaults={"call_date": "2026-04-01", "due_date": "2026-04-20"},
        )
        LineItem.objects.update_or_create(
            organization=nw,
            capital_call=cc2,
            expected_wire_reference="CC-1006",
            defaults={
                "investor_entity": investors["Oakridge Holdings LLC"],
                "amount_called": Decimal("15000.00"),
                "amount_funded": Decimal("0.00"),
                "status": "open",
            },
        )

        cc3, _ = CapitalCall.objects.update_or_create(
            organization=bb, number=1,
            defaults={"call_date": "2026-04-01", "due_date": "2026-04-15"},
        )
        LineItem.objects.update_or_create(
            organization=bb,
            capital_call=cc3,
            expected_wire_reference="CC-2001",
            defaults={
                "investor_entity": cedar,
                "amount_called": Decimal("40000.00"),
                "amount_funded": Decimal("0.00"),
                "status": "open",
            },
        )

        self.stdout.write(self.style.SUCCESS("Seeded demo data successfully."))
