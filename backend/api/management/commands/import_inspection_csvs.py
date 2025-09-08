# pyright: reportAttributeAccessIssue=false, reportGeneralTypeIssues=false, reportCallIssue=false
import csv
from datetime import date
from pathlib import Path
from typing import Optional

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import Restraunt, Inspection, Violation


def _blank_to_none(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s != "" else None


def _parse_int(value: Optional[str]) -> Optional[int]:
    s = _blank_to_none(value)
    if s is None:
        return None
    return int(s)


def _parse_date(value: Optional[str]) -> Optional[date]:
    s = _blank_to_none(value)
    if s is None:
        return None
    # Expecting YYYY-MM-DD
    return date.fromisoformat(s)


class Command(BaseCommand):
    help = "Import inspection CSVs (restaurants, inspections, violations) into the database using the ORM."

    def add_arguments(self, parser):
        default_base = Path(settings.BASE_DIR).parent / "inspection-data" / "out"
        parser.add_argument(
            "--base-dir",
            type=Path,
            default=default_base,
            help=f"Base directory containing CSVs (defaults to {default_base})",
        )

    def handle(self, *args, **options):
        base_dir: Path = Path(options["base_dir"]).resolve()
        restaurants_csv = (base_dir / "restaurants.csv").resolve()
        inspections_csv = (base_dir / "inspections.csv").resolve()
        violations_csv = (base_dir / "violations.csv").resolve()

        for p in (restaurants_csv, inspections_csv, violations_csv):
            if not p.exists():
                raise CommandError(f"CSV path does not exist: {p}")

        self.stdout.write("Importing CSV data...")
        self.stdout.write(f"  Restaurants: {restaurants_csv}")
        self.stdout.write(f"  Inspections: {inspections_csv}")
        self.stdout.write(f"  Violations:  {violations_csv}")

        restaurants_count = self._import_restaurants(restaurants_csv)
        inspections_count = self._import_inspections(inspections_csv)
        violations_count = self._import_violations(violations_csv)

        self.stdout.write("Import complete.")
        self.stdout.write(
            f"  Upserted Restaurants: {restaurants_count}\n"
            f"  Upserted Inspections: {inspections_count}\n"
            f"  Upserted Violations:  {violations_count}"
        )

    def _import_restaurants(self, csv_path: Path) -> int:
        self.stdout.write("Importing restaurants...")
        count = 0
        with transaction.atomic():
            with csv_path.open("r", newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                expected = ["camis", "name", "boro", "building", "street", "zipcode", "phone", "cuisine"]
                self._validate_headers(reader.fieldnames, expected, "restaurants.csv")

                for line_no, row in enumerate(reader, start=2):
                    camis = _blank_to_none(row.get("camis"))
                    if not camis:
                        raise CommandError(f"restaurants.csv line {line_no}: Missing 'camis'")

                    defaults = {
                        "name": _blank_to_none(row.get("name")) or "",
                        "boro": _blank_to_none(row.get("boro")) or "",
                        "building": _blank_to_none(row.get("building")) or "",
                        "street": _blank_to_none(row.get("street")) or "",
                        "zipcode": _blank_to_none(row.get("zipcode")),
                        "phone": _blank_to_none(row.get("phone")),
                        "cuisine": _blank_to_none(row.get("cuisine")),
                    }

                    Restraunt.objects.update_or_create(
                        camis=camis,
                        defaults=defaults,
                    )
                    count += 1

        self.stdout.write(f"  Restaurants processed: {count}")
        return count

    def _import_inspections(self, csv_path: Path) -> int:
        self.stdout.write("Importing inspections...")
        count = 0
        with transaction.atomic():
            with csv_path.open("r", newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                expected = [
                    "id",
                    "restraunt_camis",
                    "inspection_date",
                    "inspection_type",
                    "action",
                    "score",
                    "grade",
                    "grade_date",
                ]
                self._validate_headers(reader.fieldnames, expected, "inspections.csv")

                for line_no, row in enumerate(reader, start=2):
                    pk = _parse_int(row.get("id"))
                    if pk is None:
                        raise CommandError(f"inspections.csv line {line_no}: Missing 'id'")

                    camis = _blank_to_none(row.get("restraunt_camis"))
                    if not camis:
                        raise CommandError(f"inspections.csv line {line_no}: Missing 'restraunt_camis'")

                    try:
                        restraunt = Restraunt.objects.get(pk=camis)
                    except Restraunt.DoesNotExist:
                        raise CommandError(
                            f"inspections.csv line {line_no}: Restraunt with CAMIS '{camis}' not found. "
                            "Import restaurants first."
                        )

                    defaults = {
                        "restraunt": restraunt,
                        "inspection_date": _parse_date(row.get("inspection_date")),
                        "inspection_type": _blank_to_none(row.get("inspection_type")) or "",
                        "action": _blank_to_none(row.get("action")) or "",
                        "score": _parse_int(row.get("score")),
                        "grade": _blank_to_none(row.get("grade")),
                        "grade_date": _parse_date(row.get("grade_date")),
                    }

                    Inspection.objects.update_or_create(
                        id=pk,
                        defaults=defaults,
                    )
                    count += 1

        self.stdout.write(f"  Inspections processed: {count}")
        return count

    def _import_violations(self, csv_path: Path) -> int:
        self.stdout.write("Importing violations...")
        count = 0
        with transaction.atomic():
            with csv_path.open("r", newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                expected = ["id", "inspection_id", "code", "description", "critical_flag"]
                self._validate_headers(reader.fieldnames, expected, "violations.csv")

                for line_no, row in enumerate(reader, start=2):
                    pk = _parse_int(row.get("id"))
                    if pk is None:
                        raise CommandError(f"violations.csv line {line_no}: Missing 'id'")

                    inspection_id = _parse_int(row.get("inspection_id"))
                    if inspection_id is None:
                        raise CommandError(f"violations.csv line {line_no}: Missing 'inspection_id'")

                    try:
                        inspection = Inspection.objects.get(pk=inspection_id)
                    except Inspection.DoesNotExist:
                        raise CommandError(
                            f"violations.csv line {line_no}: Inspection with id '{inspection_id}' not found. "
                            "Import inspections first."
                        )

                    defaults = {
                        "inspection": inspection,
                        "code": _blank_to_none(row.get("code")),
                        "description": _blank_to_none(row.get("description")),
                        "critical_flag": _blank_to_none(row.get("critical_flag")) or "Not Applicable",
                    }

                    Violation.objects.update_or_create(
                        id=pk,
                        defaults=defaults,
                    )
                    count += 1

        self.stdout.write(f"  Violations processed: {count}")
        return count

    def _validate_headers(self, actual_fields, expected_fields, filename: str):
        if not actual_fields:
            raise CommandError(f"{filename}: No header row found.")
        missing = [f for f in expected_fields if f not in actual_fields]
        if missing:
            raise CommandError(f"{filename}: Missing required columns: {', '.join(missing)}")
