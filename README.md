# Sustainability indicators dashboard

Flask + Chart.js single-page dashboard exploring gas turbine sustainability insights.

## Features

- Interactive NOx compliance tracking with configurable regulatory limit and monthly statistics.
- Load-normalised proxy indices (NOx/TEY and CO/TEY) including load quartile segmentation.
- Synthetic CO₂ ledger summarising tonnes emitted, carbon intensity trend and ETS market exposure.

## Running locally

```bash
pip install -r requirements.txt  # if dependencies are provided
flask --app app.py run
```

Then open <http://127.0.0.1:5000>.
