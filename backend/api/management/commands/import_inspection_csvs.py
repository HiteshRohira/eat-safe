# pyright: reportAttributeAccessIssue=false, reportGeneralTypeIssues=false, reportCallIssue=false
import csv
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Optional

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import Restraunt, Inspection, Violation


@dataclass
class ImportPaths:
    restaurants: Path
    inspections: Path
    violations: Path


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
        default_base = Path(settings.BASE_DIR).parent / "inspection-data" / "out_small"

        parser.add_argument(
            "--base-dir",
            type=Path,
            default=default_base,
            help=f"Base directory containing CSVs (defaults to {default_base})",
        )
        parser.add_argument(
            "--restaurants",
            type=Path,
            default=None,
            help="Path to restaurants.csv (overrides --base-dir)",
        )
        parser.add_argument(
            "--inspections",
            type=Path,
            default=None,
            help="Path to inspections.csv (overrides --base-dir)",
        )
        parser.add_argument(
            "--violations",
            type=Path,
            default=None,
            help="Path to violations.csv (overrides --base-dir)",
        )
        parser.add_argument(
            "--truncate",
            action="store_true",
            help="Delete existing data (Violations -> Inspections -> Restraunts) before importing.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse CSVs and validate, but do not write to the database.",
        )
        parser.add_argument(
            "--strict",
            action="store_true",
            help="In strict mode, fail the import on the first error. Otherwise, log and continue.",
        )

    def handle(self, *args, **options):
        paths = self._resolve_paths(
            base_dir=options["base_dir"],
            restaurants=options["restaurants"],
            inspections=options["inspections"],
            violations=options["violations"],
        )
        dry_run: bool = options["dry_run"]
        truncate: bool = options["truncate"]
        strict: bool = options["strict"]

        self.stdout.write(self.style.NOTICE("Importing CSV data..."))
        self.stdout.write(f"  Restaurants: {paths.restaurants}")
        self.stdout.write(f"  Inspections: {paths.inspections}")
        self.stdout.write(f"  Violations:  {paths.violations}")
        self.stdout.write(f"  Dry run:     {dry_run}")
        self.stdout.write(f"  Truncate:    {truncate}")
        self.stdout.write(f"  Strict:      {strict}")

        if truncate and not dry_run:
            self._truncate_all()

        # Import in dependency order: restaurants -> inspections -> violations
        # Wrap each step in its own transaction so partial progress is visible per phase.
        restaurants_count = inspections_count = violations_count = 0

        # Restaurants
        restaurants_count = self._import_restaurants(paths.restaurants, dry_run=dry_run, strict=strict)

        # Inspections
        inspections_count = self._import_inspections(paths.inspections, dry_run=dry_run, strict=strict)

        # Violations
        violations_count = self._import_violations(paths.violations, dry_run=dry_run, strict=strict)

        self.stdout.write(self.style.SUCCESS("Import complete."))
        self.stdout.write(
            f"  Upserted Restaurants: {restaurants_count}\n"
            f"  Upserted Inspections: {inspections_count}\n"
            f"  Upserted Violations:  {violations_count}"
        )

    def _resolve_paths(
        self,
        *,
        base_dir: Path,
        restaurants: Optional[Path],
        inspections: Optional[Path],
        violations: Optional[Path],
    ) -> ImportPaths:
        # Determine paths, with per-file overrides if provided
        base_dir = base_dir.resolve()
        rest = (restaurants or (base_dir / "restaurants.csv")).resolve()
        insp = (inspections or (base_dir / "inspections.csv")).resolve()
        viol = (violations or (base_dir / "violations.csv")).resolve()

        for p in (rest, insp, viol):
            if not p.exists():
                raise CommandError(f"CSV path does not exist: {p}")

        return ImportPaths(restaurants=rest, inspections=insp, violations=viol)

    def _truncate_all(self):
        # Delete in reverse dependency order
        self.stdout.write(self.style.WARNING("Truncating existing data (Violations -> Inspections -> Restraunts)..."))
        with transaction.atomic():
            deleted_v = Violation.objects.all().delete()
            deleted_i = Inspection.objects.all().delete()
            deleted_r = Restraunt.objects.all().delete()
        self.stdout.write(f"  Deleted Violations: {deleted_v[0]}")
        self.stdout.write(f"  Deleted Inspections: {deleted_i[0]}")
        self.stdout.write(f"  Deleted Restraunts: {deleted_r[0]}")

    def _import_restaurants(self, csv_path: Path, *, dry_run: bool, strict: bool) -> int:
        self.stdout.write(self.style.NOTICE("Importing restaurants..."))
        count = 0
        with csv_path.open("r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            expected = ["camis", "name", "boro", "building", "street", "zipcode", "phone", "cuisine"]
            self._validate_headers(reader.fieldnames, expected, "restaurants.csv")

            @transaction.atomic
            def do_import():
                nonlocal count
                for line_no, row in enumerate(reader, start=2):
                    try:
                        camis = _blank_to_none(row.get("camis"))
                        if not camis:
                            raise ValueError("Missing 'camis'")

                        defaults = {
                            "name": _blank_to_none(row.get("name")) or "",
                            "boro": _blank_to_none(row.get("boro")) or "",
                            "building": _blank_to_none(row.get("building")) or "",
                            "street": _blank_to_none(row.get("street")) or "",
                            "zipcode": _blank_to_none(row.get("zipcode")),
                            "phone": _blank_to_none(row.get("phone")),
                            "cuisine": _blank_to_none(row.get("cuisine")),
                        }

                        if not dry_run:
                            # Upsert by primary key (camis)
                            obj, _created = Restraunt.objects.update_or_create(
                                camis=camis,
                                defaults=defaults,
                            )
                        count += 1
                    except Exception as e:
                        msg = f"Line {line_no}: Failed to import restaurant (camis={row.get('camis')}): {e}"
                        if strict:
                            raise CommandError(msg) from e
                        self.stderr.write(self.style.WARNING(msg))

            if dry_run:
                # Simulate parsing without DB writes
                for line_no, row in enumerate(reader, start=2):
                    camis = _blank_to_none(row.get("camis"))
                    if not camis:
                        msg = f"Line {line_no}: Missing 'camis'"
                        if strict:
                            raise CommandError(msg)
                        self.stderr.write(self.style.WARNING(msg))
                        continue
                    count += 1
            else:
                do_import()

        self.stdout.write(self.style.SUCCESS(f"  Restaurants processed: {count}"))
        return count

    def _import_inspections(self, csv_path: Path, *, dry_run: bool, strict: bool) -> int:
        self.stdout.write(self.style.NOTICE("Importing inspections..."))
        count = 0
        with csv_path.open("r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            expected = ["id", "restraunt_camis", "inspection_date", "inspection_type", "action", "score", "grade", "grade_date"]
            self._validate_headers(reader.fieldnames, expected, "inspections.csv")

            @transaction.atomic
            def do_import():
                nonlocal count
                for line_no, row in enumerate(reader, start=2):
                    try:
                        pk = _parse_int(row.get("id"))
                        if pk is None:
                            raise ValueError("Missing 'id'")

                        camis = _blank_to_none(row.get("restraunt_camis"))
                        if not camis:
                            raise ValueError("Missing 'restraunt_camis'")

                        # Ensure the referenced Restraunt exists
                        try:
                            restraunt = Restraunt.objects.get(pk=camis)
                        except Restraunt.DoesNotExist:
                            raise ValueError(f"Restraunt with CAMIS '{camis}' not found. Import restaurants first.")

                        defaults = {
                            "restraunt": restraunt,
                            "inspection_date": _parse_date(row.get("inspection_date")),
                            "inspection_type": _blank_to_none(row.get("inspection_type")) or "",
                            "action": _blank_to_none(row.get("action")) or "",
                            "score": _parse_int(row.get("score")),
                            "grade": _blank_to_none(row.get("grade")),
                            "grade_date": _parse_date(row.get("grade_date")),
                        }

                        if not dry_run:
                            obj, _created = Inspection.objects.update_or_create(
                                id=pk,
                                defaults=defaults,
                            )
                        count += 1
                    except Exception as e:
                        msg = f"Line {line_no}: Failed to import inspection (id={row.get('id')}): {e}"
                        if strict:
                            raise CommandError(msg) from e
                        self.stderr.write(self.style.WARNING(msg))

            if dry_run:
                for line_no, row in enumerate(reader, start=2):
                    pk = _parse_int(row.get("id"))
                    camis = _blank_to_none(row.get("restraunt_camis"))
                    if pk is None or not camis:
                        msg = f"Line {line_no}: Missing required fields (id/restraunt_camis)"
                        if strict:
                            raise CommandError(msg)
                        self.stderr.write(self.style.WARNING(msg))
                        continue
                    count += 1
            else:
                do_import()

        self.stdout.write(self.style.SUCCESS(f"  Inspections processed: {count}"))
        return count

    def _import_violations(self, csv_path: Path, *, dry_run: bool, strict: bool) -> int:
        self.stdout.write(self.style.NOTICE("Importing violations..."))
        count = 0
        with csv_path.open("r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            expected = ["id", "inspection_id", "code", "description", "critical_flag"]
            self._validate_headers(reader.fieldnames, expected, "violations.csv")

            @transaction.atomic
            def do_import():
                nonlocal count
                for line_no, row in enumerate(reader, start=2):
                    try:
                        pk = _parse_int(row.get("id"))
                        if pk is None:
                            raise ValueError("Missing 'id'")

                        inspection_id = _parse_int(row.get("inspection_id"))
                        if inspection_id is None:
                            raise ValueError("Missing 'inspection_id'")

                        try:
                            inspection = Inspection.objects.get(pk=inspection_id)
                        except Inspection.DoesNotExist:
                            raise ValueError(f"Inspection with id '{inspection_id}' not found. Import inspections first.")

                        defaults = {
                            "inspection": inspection,
                            "code": _blank_to_none(row.get("code")),
                            "description": _blank_to_none(row.get("description")),
                            "critical_flag": _blank_to_none(row.get("critical_flag")) or "Not Applicable",
                        }

                        if not dry_run:
                            obj, _created = Violation.objects.update_or_create(
                                id=pk,
                                defaults=defaults,
                            )
                        count += 1
                    except Exception as e:
                        msg = f"Line {line_no}: Failed to import violation (id={row.get('id')}): {e}"
                        if strict:
                            raise CommandError(msg) from e
                        self.stderr.write(self.style.WARNING(msg))

            if dry_run:
                for line_no, row in enumerate(reader, start=2):
                    if _parse_int(row.get("id")) is None or _parse_int(row.get("inspection_id")) is None:
                        msg = f"Line {line_no}: Missing required fields (id/inspection_id)"
                        if strict:
                            raise CommandError(msg)
                        self.stderr.write(self.style.WARNING(msg))
                        continue
                    count += 1
            else:
                do_import()

        self.stdout.write(self.style.SUCCESS(f"  Violations processed: {count}"))
        return count

    def _validate_headers(self, actual_fields, expected_fields, filename: str):
        if not actual_fields:
            raise CommandError(f"{filename}: No header row found.")
        missing = [f for f in expected_fields if f not in actual_fields]
        if missing:
            raise CommandError(f"{filename}: Missing required columns: {', '.join(missing)}")
