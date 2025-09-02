from rest_framework import mixins, permissions, generics
from rest_framework.viewsets import GenericViewSet
from rest_framework.pagination import PageNumberPagination
from rest_framework.filters import SearchFilter, OrderingFilter
from django.contrib.auth.models import User

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
    serializer_class = RestrauntSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [QSearchFilter, OrderingFilter]
    search_fields = ["name", "cuisine", "boro", "zipcode", "camis", "phone", "street", "building"]
    ordering_fields = ["name", "boro", "cuisine", "zipcode", "camis"]

    def get_queryset(self):
        qs = Restraunt.objects.all().order_by("name")

        return qs


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
            # FK points to Restraunt primary key (camis), so direct filter works
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
