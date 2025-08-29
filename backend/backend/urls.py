from django.contrib import admin
from django.urls import path, include
from api.views import RestrauntViewSet, InspectionViewSet, ViolationViewSet, CreateUserView
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r"restraunts", RestrauntViewSet, basename="restraunt")
router.register(r"inspections", InspectionViewSet, basename="inspection")
router.register(r"violations", ViolationViewSet, basename="violation")
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
     path("api/user/register/", CreateUserView.as_view(), name="register"),
    path("api/", include(router.urls)),
    path("api/token/", TokenObtainPairView.as_view(), name="get_token"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("api-auth/", include("rest_framework.urls")),
]
