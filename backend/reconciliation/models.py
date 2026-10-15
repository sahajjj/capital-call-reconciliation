from django.db import models


class Organization(models.Model):
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=200)

    def __str__(self):
        return self.name


class InvestorEntity(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="investors"
    )
    name = models.CharField(max_length=200)

    class Meta:
        verbose_name_plural = "investor entities"

    def __str__(self):
        return self.name


class CapitalCall(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="capital_calls"
    )
    call_date = models.DateField()
    due_date = models.DateField()
    number = models.PositiveIntegerField()

    class Meta:
        ordering = ["number"]

    def __str__(self):
        return f"Call #{self.number}"


class LineItem(models.Model):
    STATUS_CHOICES = [
        ("open", "Open"),
        ("partially_funded", "Partially Funded"),
        ("funded", "Funded"),
    ]

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="line_items"
    )
    capital_call = models.ForeignKey(
        CapitalCall, on_delete=models.CASCADE, related_name="line_items"
    )
    investor_entity = models.ForeignKey(
        InvestorEntity, on_delete=models.CASCADE, related_name="line_items"
    )
    expected_wire_reference = models.CharField(max_length=50)
    amount_called = models.DecimalField(max_digits=14, decimal_places=2)
    amount_funded = models.DecimalField(
        max_digits=14, decimal_places=2, default=0
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")

    @property
    def amount_remaining(self):
        return self.amount_called - self.amount_funded

    def __str__(self):
        return f"{self.investor_entity.name} — {self.expected_wire_reference}"


class BankTransaction(models.Model):
    STATUS_CHOICES = [
        ("suggested", "Suggested"),
        ("needs_review", "Needs Review"),
        ("reconciled", "Reconciled"),
        ("ignored", "Ignored"),
    ]

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="transactions"
    )
    date = models.DateField()
    description = models.TextField()
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    type = models.CharField(
        max_length=6, choices=[("credit", "Credit"), ("debit", "Debit")]
    )
    bank_reference = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="suggested"
    )
    review_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "bank_reference"],
                name="unique_org_bank_reference",
            )
        ]
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.date} {self.bank_reference} {self.amount}"


class Match(models.Model):
    STATUS_CHOICES = [
        ("proposed", "Proposed"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    transaction = models.ForeignKey(
        BankTransaction, on_delete=models.CASCADE, related_name="matches"
    )
    line_item = models.ForeignKey(
        LineItem, on_delete=models.CASCADE, related_name="matches"
    )
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default="proposed"
    )
    reason = models.TextField(blank=True, default="")

    def __str__(self):
        return f"Match {self.transaction.bank_reference} -> {self.line_item.expected_wire_reference}"
