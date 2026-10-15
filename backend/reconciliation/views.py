from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BankTransaction, LineItem
from .serializers import TransactionSerializer, LineItemSerializer
from .services.importer import import_csv
from .services.actions import approve_match, reject_match, ignore_transaction, ActionError


class TransactionListView(generics.ListAPIView):
    serializer_class = TransactionSerializer

    def get_queryset(self):
        return (
            BankTransaction.objects
            .filter(organization=self.request.org)
            .prefetch_related("matches__line_item__investor_entity")
        )


class LineItemListView(generics.ListAPIView):
    serializer_class = LineItemSerializer

    def get_queryset(self):
        return (
            LineItem.objects
            .filter(organization=self.request.org)
            .select_related("investor_entity", "capital_call")
        )


class TransactionImportView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        csv_file = request.FILES.get("file")
        if not csv_file:
            return Response(
                {"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST
            )

        result = import_csv(request.org, csv_file)

        # if there are column errors, the whole import failed
        if result["imported"] == 0 and result["errors"]:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)


class MatchApproveView(APIView):
    def post(self, request, pk):
        try:
            match = approve_match(pk, request.org)
        except ActionError as e:
            return Response(
                {"detail": str(e)}, status=status.HTTP_409_CONFLICT
            )
        if match is None:
            return Response(
                {"detail": "Match not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response({"status": "approved"})


class MatchRejectView(APIView):
    def post(self, request, pk):
        try:
            match = reject_match(pk, request.org)
        except ActionError as e:
            return Response(
                {"detail": str(e)}, status=status.HTTP_409_CONFLICT
            )
        if match is None:
            return Response(
                {"detail": "Match not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response({"status": "rejected"})


class TransactionIgnoreView(APIView):
    def post(self, request, pk):
        try:
            txn = ignore_transaction(pk, request.org)
        except ActionError as e:
            return Response(
                {"detail": str(e)}, status=status.HTTP_409_CONFLICT
            )
        if txn is None:
            return Response(
                {"detail": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response({"status": "ignored"})
