#!/usr/bin/env python3
"""
Streaming extractor for NYC DOHMH Restaurant Inspection Results.

This script:
- Reads the large, raw CSV file from inspection-data without loading it fully into memory
- Filters rows to only those with inspection_date between 2023-01-01 and today (inclusive)
- Projects only the fields needed by the Django models
- Splits the results into three CSVs with proper foreign key linkage:
  - restaurants.csv
  - inspections.csv
  - violations.csv

It also writes a metadata.json with a quick summary after completion.

Usage:
  python extract_filtered_csv.py \
    --input DOHMH_New_York_City_Restaurant_Inspection_Results_20250902.csv \
    --output-dir ./out

If --input is omitted, the script will try to autodiscover the latest
"DOHMH_New_York_City_Restaurant_Inspection_Results_*.csv" in the same folder as this script.
"""
# pyright: reportArgumentType=false
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Dict, Tuple, Optional

# CSV column names in the raw dataset (exact as provided by NYC Open Data)
CSV_CAMIS = "CAMIS"
CSV_DBA = "DBA"
CSV_BORO = "BORO"
CSV_BUILDING = "BUILDING"
CSV_STREET = "STREET"
CSV_ZIPCODE = "ZIPCODE"
CSV_PHONE = "PHONE"
CSV_CUISINE = "CUISINE DESCRIPTION"
CSV_INSPECTION_DATE = "INSPECTION DATE"
CSV_ACTION = "ACTION"
CSV_VIOLATION_CODE = "VIOLATION CODE"
CSV_VIOLATION_DESCRIPTION = "VIOLATION DESCRIPTION"
CSV_CRITICAL_FLAG = "CRITICAL FLAG"
CSV_SCORE = "SCORE"
CSV_GRADE = "GRADE"
CSV_GRADE_DATE = "GRADE DATE"
CSV_RECORD_DATE = "RECORD DATE"  # not required by the models
CSV_INSPECTION_TYPE = "INSPECTION TYPE"

import unicodedata

# Django model field-compatible outputs
RESTAURANTS_HEADERS = [
    "camis",
    "name",
    "boro",
    "building",
    "street",
    "zipcode",
    "phone",
    "cuisine",
]

INSPECTIONS_HEADERS = [
    "id",
    "restraunt_camis",  # matches ForeignKey to Restraunt (note spelling) via its PK "camis"
    "inspection_date",
    "inspection_type",
    "action",
    "score",
    "grade",
    "grade_date",
]

VIOLATIONS_HEADERS = [
    "id",
    "inspection_id",
    "code",
    "description",
    "critical_flag",
]


BOROUGH_CHOICES = {
    "MANHATTAN": "Manhattan",
    "BRONX": "Bronx",
    "BROOKLYN": "Brooklyn",
    "QUEENS": "Queens",
    "STATEN ISLAND": "Staten Island",
    "STATEN_ISLAND": "Staten Island",
    "STATEN-ISLAND": "Staten Island",
    "STATENISLAND": "Staten Island",
    "ST. GEORGE": "Staten Island",  # Extra tolerance if present in some variants
}

PHONE_RE = re.compile(r"\D+")


def sanitize_text(value: str, *, ascii_only: bool) -> str:
    """
    Sanitize free-text fields:
    - Replace non-breaking spaces and control characters
    - Normalize smart quotes/dashes
    - Collapse whitespace
    - If ascii_only is True, strip non-ASCII characters
    """
    if value is None:
        return ""
    s = str(value)

    # Normalize whitespace/newlines
    s = s.replace("\u00A0", " ")
    s = s.replace("\r", " ").replace("\n", " ")

    # Replace control chars with spaces
    s = re.sub(r"[\x00-\x1f\x7f]", " ", s)

    # Common punctuation normalization
    s = s.translate({
        0x2018: ord("'"),
        0x2019: ord("'"),
        0x201C: ord('"'),
        0x201D: ord('"'),
        0x2014: ord('-'),
        0x2013: ord('-'),
    })

    if ascii_only:
        s = unicodedata.normalize("NFKD", s)
        s = s.encode("ascii", "ignore").decode("ascii")

    # Collapse multiple spaces
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_boro(value: str) -> Optional[str]:
    """
    Normalize BORO to match the TextChoices in models:
      Manhattan, Bronx, Brooklyn, Queens, Staten Island

    Returns normalized value or None if it can't be mapped cleanly.
    """
    if not value:
        return None
    v = value.strip()
    if v in {"Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"}:
        return v
    # Broader normalization attempts
    up = v.upper().replace("/", " ").strip()
    up = re.sub(r"\s+", " ", up)
    if up in BOROUGH_CHOICES:
        return BOROUGH_CHOICES[up]
    return None


def parse_date_mdy(value: str) -> Optional[dt.date]:
    """
    Parse dates like 'MM/DD/YYYY'. Returns None if invalid/blank.
    """
    if not value:
        return None
    v = value.strip()
    if not v:
        return None
    # Some datasets might include timestamps; we only care about the date part
    # e.g., "01/15/2023 12:00:00 AM"
    v = v.split(" ")[0]
    try:
        m, d, y = v.split("/")
        return dt.date(int(y), int(m), int(d))
    except Exception:
        return None


def safe_int(value: str) -> Optional[int]:
    """
    Convert to int if possible, else None.
    """
    if value is None:
        return None
    v = str(value).strip()
    if v == "":
        return None
    try:
        return int(v)
    except Exception:
        return None


def clean_phone(value: str) -> str:
    """
    Keep only digits to keep it simple. Returns empty string if no digits.
    """
    if not value:
        return ""
    digits = PHONE_RE.sub("", value)
    return digits[:20]  # model max_length=20


def normalize_grade(value: str) -> str:
    """
    Grades are typically letters like A, B, C, P, Z, Not Yet Graded, etc.
    We'll keep at most 2 characters to match model constraints.
    """
    if not value:
        return ""
    return value.strip()[:2]


def discover_latest_input(data_dir: Path) -> Optional[Path]:
    """
    Find the most recent DOHMH CSV in the given directory by filename sort.
    """
    candidates = sorted(data_dir.glob("DOHMH_New_York_City_Restaurant_Inspection_Results_*.csv"))
    if not candidates:
        return None
    return candidates[-1]


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract filtered NYC DOHMH inspection data (2023+).")
    parser.add_argument(
        "--input",
        type=str,
        help="Path to input CSV. If omitted, auto-discovers the latest DOHMH_*.csv in the same dir as this script.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="out",
        help="Directory to write restaurants.csv, inspections.csv, violations.csv (default: out).",
    )
    parser.add_argument(
        "--start-date",
        type=str,
        default="2023-01-01",
        help="Inclusive start date in YYYY-MM-DD (default: 2023-01-01).",
    )
    parser.add_argument(
        "--end-date",
        type=str,
        default=dt.date.today().isoformat(),
        help=f"Inclusive end date in YYYY-MM-DD (default: today's date).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional limit on the number of input rows to scan (for quick dry tests).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print progress every ~100k input rows.",
    )
    parser.add_argument(
        "--ascii",
        action="store_true",
        help="Sanitize text to ASCII-only to avoid import encoding issues."
    )
    parser.add_argument(
        "--max-restaurants",
        type=int,
        default=None,
        help="Maximum number of unique restaurants to output (cap)."
    )
    parser.add_argument(
        "--max-inspections",
        type=int,
        default=None,
        help="Maximum number of inspections to output (cap)."
    )
    parser.add_argument(
        "--max-violations",
        type=int,
        default=None,
        help="Maximum number of violations to output (cap)."
    )
    args = parser.parse_args()

    ascii_only = args.ascii
    script_dir = Path(__file__).resolve().parent
    data_dir = script_dir

    if args.input:
        input_path = Path(args.input)
        if not input_path.is_absolute():
            input_path = (data_dir / args.input).resolve()
    else:
        found = discover_latest_input(data_dir)
        if not found:
            print("No input CSV found matching 'DOHMH_New_York_City_Restaurant_Inspection_Results_*.csv' in this directory.", file=sys.stderr)
            sys.exit(1)
        input_path = found

    if not input_path.exists():
        print(f"Input CSV not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        start_date = dt.date.fromisoformat(args.start_date)
        end_date = dt.date.fromisoformat(args.end_date)
    except ValueError as e:
        print(f"Invalid --start-date or --end-date: {e}", file=sys.stderr)
        sys.exit(1)

    if start_date > end_date:
        print("start-date must be <= end-date", file=sys.stderr)
        sys.exit(1)

    out_dir = (data_dir / args.output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    restaurants_csv = out_dir / "restaurants.csv"
    inspections_csv = out_dir / "inspections.csv"
    violations_csv = out_dir / "violations.csv"
    meta_json = out_dir / "metadata.json"

    # Dedup trackers (kept only for 2023+ rows during streaming)
    seen_restaurants: set[str] = set()
    inspection_index: Dict[Tuple[str, str, str, str, str, str, str], int] = {}
    # composite key for inspections:
    # (camis, inspection_date_iso, inspection_type, action, score_str, grade_str, grade_date_iso)

    next_inspection_id = 1
    next_violation_id = 1

    stats = {
        "input_rows_scanned": 0,
        "input_rows_limited": False,
        "rows_date_filtered_out": 0,
        "rows_boro_filtered_out": 0,
        "restaurants_written": 0,
        "inspections_written": 0,
        "violations_written": 0,
        "input_path": str(input_path),
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "output_dir": str(out_dir),
    }

    # Open writers
    with open(restaurants_csv, "w", encoding="utf-8", newline="") as rest_f, \
         open(inspections_csv, "w", encoding="utf-8", newline="") as insp_f, \
         open(violations_csv, "w", encoding="utf-8", newline="") as viol_f, \
         open(input_path, "r", encoding="utf-8-sig", newline="") as in_f:

        rest_writer = csv.DictWriter(rest_f, fieldnames=RESTAURANTS_HEADERS)
        rest_writer.writeheader()

        insp_writer = csv.DictWriter(insp_f, fieldnames=INSPECTIONS_HEADERS)
        insp_writer.writeheader()

        viol_writer = csv.DictWriter(viol_f, fieldnames=VIOLATIONS_HEADERS)
        viol_writer.writeheader()

        reader = csv.DictReader(in_f)

        for i, row in enumerate(reader, start=1):
            stats["input_rows_scanned"] += 1
            if args.limit and stats["input_rows_scanned"] > args.limit:
                stats["input_rows_limited"] = True
                break

            # Parse/Filter by inspection_date (inclusive range)
            inspection_date = parse_date_mdy(row.get(CSV_INSPECTION_DATE, ""))
            if inspection_date is None or inspection_date < start_date or inspection_date > end_date:
                stats["rows_date_filtered_out"] += 1
                continue

            camis = (row.get(CSV_CAMIS) or "").strip()
            dba = (row.get(CSV_DBA) or "").strip()
            boro = normalize_boro(row.get(CSV_BORO) or "")
            building = (row.get(CSV_BUILDING) or "").strip()
            street = (row.get(CSV_STREET) or "").strip()
            zipcode = (row.get(CSV_ZIPCODE) or "").strip()
            phone = clean_phone(row.get(CSV_PHONE) or "")
            cuisine = (row.get(CSV_CUISINE) or "").strip()

            if not camis or not dba or not boro:
                # Require minimum viable restaurant entry; if BORO can't be normalized, skip
                stats["rows_boro_filtered_out"] += 1
                continue

            # Write restaurant once per CAMIS
            if camis not in seen_restaurants:
                # Enforce restaurant cap: skip rows for unseen restaurants beyond the cap
                if args.max_restaurants is not None and len(seen_restaurants) >= args.max_restaurants:
                    continue
                rest_writer.writerow(
                    {
                        "camis": camis[:10],  # model max_length 10
                        "name": sanitize_text(dba[:255], ascii_only=ascii_only),
                        "boro": boro,
                        "building": sanitize_text(building[:20] if building else "", ascii_only=ascii_only),
                        "street": sanitize_text(street[:255] if street else "", ascii_only=ascii_only),
                        "zipcode": zipcode[:10] if zipcode else "",
                        "phone": phone,
                        "cuisine": sanitize_text(cuisine[:100] if cuisine else "", ascii_only=ascii_only),
                    }
                )
                seen_restaurants.add(camis)
                stats["restaurants_written"] += 1

            # Prepare inspection de-duplication key
            inspection_type = (row.get(CSV_INSPECTION_TYPE) or "").strip()
            action = (row.get(CSV_ACTION) or "").strip()
            score_val = row.get(CSV_SCORE)
            score_int = safe_int(score_val)  # might be None
            score_str = "" if score_int is None else str(score_int)

            grade = normalize_grade(row.get(CSV_GRADE) or "")
            grade_date_parsed = parse_date_mdy(row.get(CSV_GRADE_DATE) or "")
            grade_date_iso = grade_date_parsed.isoformat() if grade_date_parsed else ""

            inspection_key = (
                camis,
                inspection_date.isoformat(),
                inspection_type,
                action,
                score_str,
                grade,
                grade_date_iso,
            )

            if inspection_key not in inspection_index:
                # Enforce inspection cap: avoid creating a new inspection beyond the cap
                if args.max_inspections is not None and stats["inspections_written"] >= args.max_inspections:
                    continue
                inspection_id = next_inspection_id
                inspection_index[inspection_key] = inspection_id
                next_inspection_id += 1

                insp_writer.writerow(
                    {
                        "id": inspection_id,
                        "restraunt_camis": camis[:10],
                        "inspection_date": inspection_date.isoformat(),
                        "inspection_type": sanitize_text(inspection_type[:50] if inspection_type else "", ascii_only=ascii_only),
                        "action": sanitize_text(action[:255] if action else "", ascii_only=ascii_only),
                        "score": score_str,  # Keep as string to let MySQL infer/convert on import
                        "grade": sanitize_text(grade, ascii_only=ascii_only),
                        "grade_date": grade_date_iso,
                    }
                )
                stats["inspections_written"] += 1
            else:
                inspection_id = inspection_index[inspection_key]

            # Violation row (optional). If there's no violation code AND description, skip.
            violation_code = (row.get(CSV_VIOLATION_CODE) or "").strip()
            violation_description = (row.get(CSV_VIOLATION_DESCRIPTION) or "").strip()
            critical_flag = (row.get(CSV_CRITICAL_FLAG) or "").strip()
            if violation_code or violation_description or critical_flag:
                # Normalize critical flag to model choices
                cf_up = (critical_flag or "").strip().title()
                if cf_up not in {"Critical", "Not Critical", "Not Applicable"}:
                    # default to Not Applicable as per the model's default
                    cf_up = "Not Applicable"

                # Enforce violation cap
                if args.max_violations is not None and stats["violations_written"] >= args.max_violations:
                    pass
                else:
                    viol_writer.writerow(
                        {
                            "id": next_violation_id,
                            "inspection_id": inspection_id,
                            "code": sanitize_text(violation_code[:20] if violation_code else "", ascii_only=ascii_only),
                            "description": sanitize_text(violation_description if violation_description else "", ascii_only=ascii_only),
                            "critical_flag": cf_up,
                        }
                    )
                    next_violation_id += 1
                    stats["violations_written"] += 1

            if args.verbose and (i % 100_000 == 0):
                print(
                    f"Scanned {i:,} rows | kept restaurants={stats['restaurants_written']:,}, "
                    f"inspections={stats['inspections_written']:,}, violations={stats['violations_written']:,}",
                    file=sys.stderr,
                    flush=True,
                )

    # Write metadata/summary
    with open(meta_json, "w", encoding="utf-8") as mf:
        json.dump(stats, mf, indent=2)

    print("Extraction complete.")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
