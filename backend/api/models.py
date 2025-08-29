from django.db import models

class Boroughs(models.TextChoices):
    MANHATTAN = "Manhattan", "Manhattan"
    BRONX = "Bronx", "Bronx"
    BROOKLYN = "Brooklyn", "Brooklyn"
    QUEENS = "Queens", "Queens"
    STATEN_ISLAND = "Staten Island", "Staten Island"

class Restraunt(models.Model):
    camis = models.CharField(
        max_length=10,
        primary_key=True,
    )
    name = models.CharField(max_length=255)
    boro = models.CharField(max_length=20, choices=Boroughs.choices)
    building = models.CharField(max_length=20)
    street = models.CharField(max_length=255)
    zipcode = models.CharField(max_length=10, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    cuisine = models.CharField(max_length=100, null=True, blank=True)

    objects = models.Manager()

    def __str__(self):
        return f"{self.name} ({self.camis})"

class Inspection(models.Model):
    restraunt = models.ForeignKey(
        Restraunt,
        on_delete=models.CASCADE,
        related_name='inspections'
    )
    inspection_date = models.DateField()
    inspection_type = models.CharField(max_length=50)
    action = models.CharField(max_length=255)
    score = models.IntegerField(null=True, blank=True)
    grade = models.CharField(max_length=2, null=True, blank=True)
    grade_date = models.DateField(null=True, blank=True)

    objects = models.Manager()

    class Meta:
        ordering = ['-inspection_date']
        get_latest_by = 'inspection_date'

    def __str__(self):
        return f"{self.restraunt} @ {self.inspection_date}"

class CriticalFlag(models.TextChoices):
    CRITICAL = "Critical", "Critical"
    NOT_CRITICAL = "Not Critical", "Not Critical"
    NOT_APPLICABLE = "Not Applicable", "Not Applicable"

class Violation(models.Model):
    inspection = models.ForeignKey(
        Inspection,
        on_delete=models.CASCADE,
        related_name='violations'
    )
    code = models.CharField(max_length=20, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    critical_flag = models.CharField(max_length=20, choices=CriticalFlag.choices, default=CriticalFlag.NOT_APPLICABLE)

    objects = models.Manager()

    def __str__(self):
        return f"{self.code} ({'Critical' if self.critical_flag == CriticalFlag.CRITICAL else 'Non-critical'})"
