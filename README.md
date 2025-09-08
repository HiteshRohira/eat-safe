# NYC Restaurant Inspection Explorer

A full-stack project that gives NYC residents a cleaner, faster way to explore official restaurant inspection data and choose where to eat with confidence.

## Motive

The official dataset is comprehensive but not always easy to browse for everyday decisions. This app presents a focused, fast interface to:
- Look up a restaurant
- Review inspection history and grades
- Understand violations at a glance

## Data Source

- NYC Open Data: DOHMH New York City Restaurant Inspection Results
  https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j/data_preview

## How the data becomes 3 CSVs and then 3 tables

We use a streaming ETL script to filter and normalize the raw CSV and split it into three CSV files that align with our backend data model:

- `restaurants.csv` (one row per restaurant)
- `inspections.csv` (one row per inspection event, linked to a restaurant)
- `violations.csv` (one row per violation, linked to an inspection)

Scripts involved:
- Extract/split/filter: `inspection-data/extract_filtered_csv.py`
- Import into DB (via Django ORM): `backend/api/management/commands/import_inspection_csvs.py`

Typical flow:
1) From the `inspection-data` directory, run the extractor with your input file and write to `out` so it matches the backend import default:
   - Example:
     - `python extract_filtered_csv.py --input DOHMH_New_York_City_Restaurant_Inspection_Results_YYYYMMDD.csv --output-dir ./out`
   - Notes:
     - Defaults filter to 2023-01-01 through today (change with `--start-date`/`--end-date`)
     - Supports extra flags (e.g., `--ascii`) to sanitize text if needed

2) From the `backend` directory, run the Django management command to import the three CSVs into the database tables:
   - Example:
     - `python manage.py import_inspection_csvs`
     - By default, it reads from `../inspection-data/out`
     - You can also specify a different folder:
       - `python manage.py import_inspection_csvs --base-dir ../inspection-data/out`

After import, the three CSVs populate three relational tables (restaurants → inspections → violations) with proper foreign-key links.

## Tech stack and how to run

Frontend
- Vite + React + Tailwind CSS
- Start:
  - `npm run dev`

Backend
- Django + Django REST Framework
- MySQL (via PyMySQL) for persistence
- JWT auth (SimpleJWT)
- Start:
  - `python manage.py runserver`
