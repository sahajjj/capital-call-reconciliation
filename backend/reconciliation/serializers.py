from rest_framework import serializers
from .models import BankTransaction, LineItem, Match


class MatchSerializer(serializers.ModelSerializer):
    investor = serializers.CharField(
        source="line_item.investor_entity.name", read_only=True
    )
    reference = serializers.CharField(
        source="line_item.expected_wire_reference", read_only=True
    )
    line_item_id = serializers.IntegerField(source="line_item.id", read_only=True)

    class Meta:
        model = Match
        fields = ["id", "line_item_id", "investor", "reference", "reason", "status"]


class TransactionSerializer(serializers.ModelSerializer):
    matches = MatchSerializer(many=True, read_only=True)

    class Meta:
        model = BankTransaction
        fields = [
            "id", "date", "description", "amount", "type",
            "bank_reference", "status", "review_reason", "matches",
        ]


class LineItemSerializer(serializers.ModelSerializer):
    investor = serializers.CharField(
        source="investor_entity.name", read_only=True
    )
    capital_call_number = serializers.IntegerField(
        source="capital_call.number", read_only=True
    )
    amount_remaining = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = LineItem
        fields = [
            "id", "investor", "capital_call_number",
            "expected_wire_reference", "amount_called",
            "amount_funded", "amount_remaining", "status",
        ]
