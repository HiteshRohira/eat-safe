from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Restraunt, Inspection, Violation

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "password"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class RestrauntSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restraunt
        fields = ["camis", "name", "boro", "building", "street", "zipcode", "phone", "cuisine"]


class InspectionSerializer(serializers.ModelSerializer):
    violations = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    violations_create = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = Inspection
        fields = ["id", "inspection_date", "inspection_type", "action", "score", "grade", "grade_date", "restraunt", "violations", "violations_create"]

    def create(self, validated_data):
        violations_data = validated_data.pop("violations_create", [])
        inspection = Inspection.objects.create(**validated_data)
        for v in violations_data:
            Violation.objects.create(inspection=inspection, **v)
        return inspection

class ViolationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Violation
        fields = ["id", "code", "description", "critical_flag", "inspection"]
