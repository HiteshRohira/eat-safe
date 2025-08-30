from rest_framework import mixins, permissions, generics
from rest_framework.viewsets import GenericViewSet
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


class RestrauntViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, GenericViewSet):
    """
    Endpoints (when registered via a Router):
      - GET    /api/restraunts/           -> list all restaurants
      - POST   /api/restraunts/           -> create a restaurant
    """
    queryset = Restraunt.objects.all().order_by("name")
    serializer_class = RestrauntSerializer
    permission_classes = [permissions.IsAuthenticated]


class InspectionViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, GenericViewSet):
    """
    Endpoints:
      - GET    /api/inspections/                       -> list inspections
      - POST   /api/inspections/                       -> create an inspection
    Query params:
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
