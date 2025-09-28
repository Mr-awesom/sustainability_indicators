# Sustainability indicators dashboard

Flask + Chart.js single-page dashboard exploring gas turbine sustainability insights.

## Features

- Interactive NOx compliance tracking with configurable regulatory limit and monthly statistics.
- Load-normalised proxy indices (NOx/TEY and CO/TEY) including load quartile segmentation.
- Synthetic CO₂ ledger summarising tonnes emitted, carbon intensity trend and ETS market exposure.
- Regulatory readiness scorecard with persistent checklist for EU ETS, CSRD, EED and EPA obligations.

## Data sources

All visuals are backed by static CSV extracts so the dashboard can run offline:

- `static/data/gt_full.csv` – base hourly telemetry for the turbine.
- `static/data/gt_with_synthetic_co2_monthly.csv` – synthetic monthly carbon ledger with EUA pricing.
- `static/data/gt_with_synthetic_co2_hourly.csv` – synthetic hourly carbon data for deeper analyses.

The client-side script fetches the CSV files directly, so ensure they remain accessible from the `static/data` directory.

## Running locally

```bash
pip install -r requirements.txt  # if dependencies are provided
flask --app app.py run
```

Then open <http://127.0.0.1:5000>.
