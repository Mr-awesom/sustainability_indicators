# Sustainability Indicators Dashboard

A Flask web dashboard that combines gas turbine emissions analytics, carbon exposure estimates, and regulatory readiness tracking. The UI is built with vanilla HTML/CSS and Chart.js to keep dependencies light while still offering interactive data visualisations.

## Key capabilities

- **NOx concentration performance** – Analyse hourly nitrogen oxides data against configurable compliance limits with P95 exceedance insights, monthly summaries, and limit-sensitive callouts.
- **Load-normalised proxy indices** – Track NOx/TEY and CO/TEY ratios when stack flow data is unavailable, including quartile analysis by turbine loading.
- **CO₂ footprint & ETS exposure** – Combine synthetic EUA pricing, tonnes emitted, and carbon intensity trends to estimate carbon market obligations.
- **Regulatory readiness score** – Capture qualitative compliance signals across EU ETS, CSRD, EED, US EPA GHG reporting, data quality, and outstanding actions.

## Project structure

```
.
├── app.py                # Flask routes, data loading, and tab selection logic
├── static/
│   ├── app.js            # Fetches CSVs, renders charts, updates KPIs
│   ├── style.css         # Shared styles for layout, cards, charts, typography
│   └── regulatory.css    # Additional styling for the readiness score section
├── templates/
│   ├── index.html        # Marketing-style landing page
│   └── tabs.html         # Dashboard view with the four analytical tabs
└── static/data/          # CSV inputs for NOx, proxy, and synthetic CO₂ datasets
```

## Data inputs

The dashboard reads pre-generated CSV files bundled in `static/data/`:

- `gt_nox.csv` – Hourly NOx concentration measurements with TEY load context.
- `gt_proxy.csv` – Aggregated load quartile metrics for NOx/TEY and CO/TEY ratios.
- `gt_with_synthetic_co2_*.csv` – Synthetic carbon ledger with ETS price traces.

Update or replace these files to refresh the analysis; the frontend reloads data automatically on page visit.

## Getting started

1. **Create a virtual environment (optional but recommended):**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Run the development server:**
   ```bash
   flask --app app.py run --debug
   ```
4. Open <http://127.0.0.1:5000> to view the dashboard.

The Flask app only serves static data, so no database setup is required. Use the `--debug` flag during development for hot reloading and detailed error output.

## Development tips

- **Static assets:** Update `static/app.js` for data wrangling and chart behaviour. Update `static/style.css` or `static/regulatory.css` for styling tweaks.
- **Templates:** Modify `templates/tabs.html` to adjust layout or copy for each analytics tab. The `active_tab` context variable controls which tab appears on load.
- **Testing data changes:** Because the frontend loads CSV files directly, you can iterate quickly by editing the CSVs and refreshing the browser.

## Deployment considerations

- Configure `FLASK_ENV=production` and run behind a production-grade WSGI server (Gunicorn, uWSGI) for live environments.
- Serve the app behind TLS and apply authentication if sensitive operational data is exposed.
- Replace the synthetic datasets with live telemetry or data warehouse extracts, ensuring CSV schemas match expectations in `static/app.js`.

## License

This project is provided for demonstration purposes. Adapt licensing as required for your organisation.
