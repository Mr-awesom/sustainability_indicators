// ---------- Config you can tweak ----------
const CI_SCALE_G_PER_KWH = 350;   // multiply your carbonperproduction index by this to get gCO2/kWh
const ETS_PRICE_EUR_PER_T = 85;   // €/tCO2, adjust to current price
const CO2_TARGET_TPD = 12.0;      // example target for the bar chart

// ---------- Tabs behavior ----------
document.addEventListener("DOMContentLoaded", () => {
  const btns = document.querySelectorAll(".tab-btn");
  const panels = {
    emissions: document.getElementById("tab-emissions"),
    performance: document.getElementById("tab-performance")
  };
  btns.forEach(b => {
    b.id = `tabbtn-${b.dataset.tab}`;
    b.addEventListener("click", () => {
      btns.forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      Object.values(panels).forEach(p => p.classList.remove("show"));
      panels[b.dataset.tab].classList.add("show");
      panels[b.dataset.tab].scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // kick off data load
  initDashboard();
});

// ---------- Helpers ----------
async function fetchSeries(path) {
  const r = await fetch(path);
  const txt = await r.text();
  return txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(Number);
}
function rollingNoise(base, n, jitter) {
  // quick placeholder generator for NOx and CO, until backend provides real series
  const out = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.5) * jitter;
    out.push(Math.max(0, v));
  }
  return out;
}
function labelsFromLength(n) {
  // simple 1..n labels, or replace with timestamps later
  return Array.from({ length: n }, (_, i) => `${i + 1}`);
}

// ---------- Charts ----------
let chartEmissions, chartCO2Bar, chartEfficiency, chartCI;

async function initDashboard() {
  // Load your files from /static/data
  const co2_tpd = await fetchSeries("/static/data/carbonperdaywith600mw.txt");      // tonnes per day
  const eff_pct = await fetchSeries("/static/data/efficiencies.txt");               // percent
  const ci_index = await fetchSeries("/static/data/carbonperproduction.txt");       // index around 1.0

  // Derive other series
  const n = Math.max(co2_tpd.length, eff_pct.length, ci_index.length);
  const labels = labelsFromLength(n);

  const nox_ppm = rollingNoise(150, n, 6);   // placeholder
  const co_ppm  = rollingNoise(30,  n, 3);   // placeholder

  // Scale carbon intensity to gCO2/kWh
  const ci_g_per_kwh = ci_index.map(x => +(x * CI_SCALE_G_PER_KWH).toFixed(0));

  // ETS exposure, simple product of CO2 and price
  const ets_eur = co2_tpd.map(v => +(v * ETS_PRICE_EUR_PER_T).toFixed(0));

  // Fill KPI cards with latest values
  const last = (arr) => arr[arr.length - 1];
  setText("kpi-nox", last(nox_ppm).toFixed(0));
  setText("kpi-co",  last(co_ppm).toFixed(0));
  setText("kpi-co2", last(co2_tpd).toFixed(2));
  setText("kpi-eff", last(eff_pct).toFixed(2));
  setText("kpi-ci",  last(ci_g_per_kwh).toFixed(0));
  setText("kpi-ets", last(ets_eur).toFixed(0));

  // Simple status chips
  setChips("emissions-alerts", [
    last(nox_ppm) > 180 ? "Warning, NOx high" : null,
    last(co_ppm)  > 50  ? "Warning, CO high"  : null,
    last(co2_tpd) > CO2_TARGET_TPD ? "CO₂ above target" : null
  ]);
  setChips("perf-alerts", [
    last(eff_pct) < 42 ? "Efficiency below desired" : null,
    last(ci_g_per_kwh) > 380 ? "Carbon intensity above target" : null
  ]);

  // Build charts
  const ctxEmis   = document.getElementById("chartEmissions");
  const ctxCO2Bar = document.getElementById("chartCO2Bar");
  const ctxEff    = document.getElementById("chartEfficiency");
  const ctxCI     = document.getElementById("chartCI");

  chartEmissions = new Chart(ctxEmis, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "NOx ppm", data: nox_ppm, tension: 0.25, pointRadius: 0 },
        { label: "CO ppm", data: co_ppm, tension: 0.25, pointRadius: 0 },
        { label: "CO₂ tpd", data: co2_tpd, tension: 0.25, pointRadius: 0, yAxisID: "y2" }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y:  { position: "left"  },
        y2: { position: "right", grid: { drawOnChartArea: false } }
      },
      plugins: { legend: { display: true } }
    }
  });

  chartCO2Bar = new Chart(ctxCO2Bar, {
    type: "bar",
    data: {
      labels: ["Target", "Latest"],
      datasets: [{ label: "CO₂ tpd", data: [CO2_TARGET_TPD, last(co2_tpd)] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  chartEfficiency = new Chart(ctxEff, {
    type: "line",
    data: { labels, datasets: [{ label: "Efficiency percent", data: eff_pct, tension: 0.25, pointRadius: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 35, max: 55 } } }
  });

  chartCI = new Chart(ctxCI, {
    type: "line",
    data: { labels, datasets: [{ label: "gCO₂ per kWh", data: ci_g_per_kwh, tension: 0.25, pointRadius: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function setChips(containerId, msgs) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";
  msgs.filter(Boolean).forEach(m => {
    const s = document.createElement("span");
    s.className = "chip warn";
    s.textContent = m;
    el.appendChild(s);
  });
}
