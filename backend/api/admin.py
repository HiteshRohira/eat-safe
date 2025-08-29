from django.contrib import admin
from .models import Restraunt, Inspection, Violation


@admin.register(Restraunt)
class RestrauntAdmin(admin.ModelAdmin):
    list_display = ("camis", "name", "boro", "cuisine", "zipcode")
    search_fields = ("camis", "name", "street", "zipcode", "phone", "cuisine")
    list_filter = ("boro", "cuisine")
    ordering = ("name",)


@admin.register(Inspection)
class InspectionAdmin(admin.ModelAdmin):
    list_display = ("id", "restraunt", "inspection_date", "inspection_type", "score", "grade")
    search_fields = ("restraunt__name", "restraunt__camis", "inspection_type", "action", "grade")
    list_filter = ("inspection_type", "grade", "inspection_date")
    date_hierarchy = "inspection_date"
    ordering = ("-inspection_date",)


@admin.register(Violation)
class ViolationAdmin(admin.ModelAdmin):
    list_display = ("id", "inspection", "code", "critical_flag")
    search_fields = ("code", "description", "inspection__restraunt__name", "inspection__restraunt__camis")
    list_filter = ("critical_flag",)
    ordering = ("-id",)
