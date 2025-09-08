from rest_framework import mixins, permissions, generics
from rest_framework.viewsets import GenericViewSet
from rest_framework.pagination import PageNumberPagination
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.db.models import Sum, IntegerField, Case, When
from django.utils.dateparse import parse_date

from .models import Restraunt, Inspection, Violation
from .serializers import (
    RestrauntSerializer,
    InspectionSerializer,
    ViolationSerializer,
    UserSerializer
)

class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class QSearchFilter(SearchFilter):
    search_param = "q"


class RestrauntViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, GenericViewSet):
    """
    Endpoints (when registered via a Router):
      - GET    /api/restraunts/           -> list restaurants (paginated)
      - POST   /api/restraunts/           -> create a restaurant

    Query params:
      - q=<text>                          -> server-side search across name, cuisine, boro, zip, CAMIS, phone, street, building
      - page=<n>                          -> page number (default 1)
      - page_size=<n>                     -> items per page (default 10)
      - ordering=<field>                  -> e.g., name, -name
    """
    queryset = Restraunt.objects.all().order_by("name")
    serializer_class = RestrauntSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [QSearchFilter, OrderingFilter]
    search_fields = ["name", "cuisine", "boro", "zipcode", "camis", "phone", "street", "building"]
    ordering_fields = ["name", "boro", "cuisine", "zipcode", "camis"]


class InspectionViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, GenericViewSet):
    """
    Endpoints:
      - GET    /api/inspections/                       -> list inspections
      - POST   /api/inspections/                       -> create an inspection
    Query params:
      - q=<text>                                       -> server-side search across inspection fields and related restaurant fields
      - ordering=<field>                               -> e.g., inspection_date, -inspection_date, score, restraunt__name
      - page=<n>                                       -> page number (default 1)
      - page_size=<n>                                  -> items per page (default 10)
      - restraunt=<camis> or camis=<camis>             -> filter inspections for a specific restaurant

    Create payload example:
      {
        "restraunt": "12345678",               # restaurant CAMIS (FK)
        "inspection_date": "2024-01-31",
        "inspection_type": "Cycle Inspection / Initial Inspection",
        "action": "Violations were cited in the following area(s).",
        "score": 18,
        "grade": "B",
        "grade_date": "2024-02-07",
        "violations_create": [
          {
            "code": "10F",
            "description": "Non-food contact surface...",
            "critical_flag": "Not Critical"
          }
        ]
      }
    """
    serializer_class = InspectionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [QSearchFilter, OrderingFilter]
    search_fields = [
        "inspection_type",
        "action",
        "grade",
    ]
    ordering_fields = ["inspection_date", "score", "grade", "restraunt__name", "restraunt__camis"]

    def get_queryset(self):
        qs = Inspection.objects.select_related("restraunt")
        restraunt_param = self.request.query_params.get("restraunt")
        camis_param = self.request.query_params.get("camis")
        camis = restraunt_param or camis_param
        if camis:
            qs = qs.filter(restraunt=camis)
        return qs


class ViolationViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, GenericViewSet):
    """
    Endpoints:
      - GET    /api/violations/                 -> list violations
      - POST   /api/violations/                 -> create a violation

    Query params:
      - inspection=<id>                         -> filter violations for a specific inspection

    Create payload example:
      {
        "inspection": 42,
        "code": "10F",
        "description": "Non-food contact surface...",
        "critical_flag": "Not Critical"
      }
    """
    serializer_class = ViolationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Violation.objects.select_related("inspection", "inspection__restraunt")
        inspection_id = self.request.query_params.get("inspection")
        if inspection_id:
            qs = qs.filter(inspection_id=inspection_id)
        return qs


class ViolationsTimelineAPIView(APIView):
    """
    GET /api/charts/violations-timeline/?restraunt=<CAMIS>&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50
    Returns per-inspection violation counts (by criticality) for a single restaurant.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        camis = request.query_params.get("camis")
        if not camis:
            return Response({"detail": "Query parameter 'restaurant' (CAMIS) is required."}, status=400)

        qs = Inspection.objects.filter(restraunt=camis)

        # Ordering and limit
        ordering = request.query_params.get("ordering") or "-inspection_date"
        if ordering not in ("inspection_date", "-inspection_date"):
            ordering = "-inspection_date"
        try:
            limit = int(request.query_params.get("limit", 50))
        except Exception:
            limit = 50
        limit = max(1, min(limit, 365))

        qs = qs.order_by(ordering)

        # Annotating values from violations table and adding them up
        annotated = qs.annotate(
            violations_critical=Sum(
                Case(
                    When(violations__critical_flag="Critical", then=1),
                    default=0,
                    output_field=IntegerField(),
                )
            ),
            violations_not_critical=Sum(
                Case(
                    When(violations__critical_flag="Not Critical", then=1),
                    default=0,
                    output_field=IntegerField(),
                )
            ),
        )[:limit]

        data = list(
            annotated.values(
                "id",
                "inspection_date",
                "score",
                "grade",
                "violations_critical",
                "violations_not_critical",
            )
        )
        # Normalize None sums to 0 and compute total (excluding Not Applicable)
        for row in data:
            row["violations_critical"] = row.get("violations_critical") or 0
            row["violations_not_critical"] = row.get("violations_not_critical") or 0
            row["violations_total"] = row["violations_critical"] + row["violations_not_critical"]
            row["inspection_id"] = row.pop("id", None)
        return Response(data)


class ScoreTimelineAPIView(APIView):
    """
    GET /api/charts/score-timeline/?restraunt=<CAMIS>&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50
    Returns per-inspection score and grade for a single restaurant.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        camis = request.query_params.get("restraunt") or request.query_params.get("camis")
        if not camis:
            return Response({"detail": "Query parameter 'restraunt' (CAMIS) is required."}, status=400)

        qs = Inspection.objects.filter(restraunt=camis, score__isnull=False)

        # Optional date range
        from_str = request.query_params.get("from")
        to_str = request.query_params.get("to")
        if from_str:
            d = parse_date(from_str)
            if d:
                qs = qs.filter(inspection_date__gte=d)
        if to_str:
            d = parse_date(to_str)
            if d:
                qs = qs.filter(inspection_date__lte=d)

        # Ordering and limit
        ordering = request.query_params.get("ordering") or "-inspection_date"
        if ordering not in ("inspection_date", "-inspection_date"):
            ordering = "-inspection_date"
        try:
            limit = int(request.query_params.get("limit", 50))
        except Exception:
            limit = 50
        limit = max(1, min(limit, 365))

        qs = qs.order_by(ordering)[:limit]

        data = list(qs.values("id", "inspection_date", "score", "grade"))
        for row in data:
            row["inspection_id"] = row.pop("id", None)
        return Response(data)
