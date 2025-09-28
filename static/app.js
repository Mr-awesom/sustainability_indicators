// ---------- Config you can tweak ----------
const DEFAULT_NOX_LIMIT = 70; // mg/Nm³
const HOURS_PER_MONTH = 24 * 30; // treat every 720 hours as a "month"

// ---------- Tabs behaviour ----------
document.addEventListener("DOMContentLoaded", () => {
  const btns = document.querySelectorAll(".tab-btn");
  const panels = {
    nox: document.getElementById("tab-nox"),
    proxy: document.getElementById("tab-proxy"),
    co2: document.getElementById("tab-co2"),
    regulationscore: document.getElementById("tab-regulationscore")
  };

  btns.forEach((btn) => {
    btn.id = `tabbtn-${btn.dataset.tab}`;
    btn.addEventListener("click", () => {
      btns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      Object.values(panels).forEach((panel) => panel && panel.classList.remove("show"));
      const panel = panels[btn.dataset.tab];
      if (!panel) return;
      panel.classList.add("show");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  initDashboard();
});

// ---------- State ----------
let rawData = [];
let co2Monthly = [];
let chartNoxMonthly, chartProxyMonthly, chartCo2Monthly, chartCo2Intensity;

// ---------- Data loading & preparation ----------
async function initDashboard() {
  const [gtRows, co2Rows] = await Promise.all([
    loadCsv("/static/data/gt_full.csv"),
    loadCsv("/static/data/gt_with_synthetic_co2_monthly.csv")
  ]);

  rawData = gtRows;
  co2Monthly = co2Rows.map((row) => ({
    month: row.month,
    netMwh: row.net_mwh,
    co2Tonnes: row.co2_t,
    avgIntensity: row.avg_intensity_kg_per_mwh,
    etsCost: row.ets_cost_eur
  }));
  const limitInput = document.getElementById("nox-limit");
  limitInput.value = DEFAULT_NOX_LIMIT;
  limitInput.addEventListener("change", () => {
    const current = Number(limitInput.value);
    if (!Number.isFinite(current) || current <= 0) {
      limitInput.value = DEFAULT_NOX_LIMIT;
    }
    renderAll(Number(limitInput.value));
  });

  renderAll(DEFAULT_NOX_LIMIT);
}

async function loadCsv(path) {
  const resp = await fetch(path);
  const text = await resp.text();
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").map(stripQuotes);
  return lines.slice(1).map((line) => {
    const values = line.split(",").map(stripQuotes);
    const row = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      const numeric = Number(values[idx]);
      row[h] = Number.isNaN(numeric) ? values[idx] : numeric;
    });
    return row;
  });
}

function stripQuotes(value) {
  return value.replace(/^"|"$/g, "");
}

function renderAll(limit) {
  const summaries = computeSummaries(rawData, limit);
  updateNoxKpis(summaries.overall);
  updateProxyKpis(summaries.proxyOverall);
  renderMonthlyNoxChart(summaries.monthly, limit);
  renderProxyChart(summaries.monthly);
  fillMonthlyTable(summaries.monthly);
  fillLoadBinTable(summaries.loadBins);
  if (co2Monthly.length) renderCo2(co2Monthly);
}

function computeSummaries(rows, limit) {
  const monthly = [];
  const loadValues = [];
  const noxValues = [];
  const ratioNox = [];
  const ratioCo = [];

  rows.forEach((row, idx) => {
    const monthIdx = Math.floor(idx / HOURS_PER_MONTH);
    if (!monthly[monthIdx]) {
      monthly[monthIdx] = {
        label: `M${monthIdx + 1}`,
        count: 0,
        noxSum: 0,
        teySum: 0,
        exceed: 0,
        ratiosNox: [],
        ratiosCo: [],
        noxVals: []
      };
    }

    const month = monthly[monthIdx];
    month.count += 1;
    month.noxSum += row.NOX;
    month.teySum += row.TEY;
    month.noxVals.push(row.NOX);
    if (row.NOX > limit) month.exceed += 1;

    const proxyNox = safeDivide(row.NOX, row.TEY);
    const proxyCo = safeDivide(row.CO, row.TEY);
    if (Number.isFinite(proxyNox)) {
      month.ratiosNox.push(proxyNox);
      ratioNox.push(proxyNox);
    }
    if (Number.isFinite(proxyCo)) {
      month.ratiosCo.push(proxyCo);
      ratioCo.push(proxyCo);
    }

    loadValues.push(row.TEY);
    noxValues.push(row.NOX);
  });

  monthly.forEach((month) => {
    month.avgNox = month.noxSum / month.count;
    month.p95 = percentile(month.noxVals, 0.95);
    month.within = 1 - month.exceed / month.count;
    month.avgProxyNox = average(month.ratiosNox);
    month.avgProxyCo = average(month.ratiosCo);
    month.avgLoad = month.teySum / month.count;
  });

  const overall = {
    avgNox: average(noxValues),
    p95: percentile(noxValues, 0.95),
    within: 1 - countIf(noxValues, (v) => v > limit) / noxValues.length,
    exceed: countIf(noxValues, (v) => v > limit) / noxValues.length,
    limit,
    sampleHours: rows.length
  };

  const proxyOverall = {
    avgNoxProxy: average(ratioNox),
    avgCoProxy: average(ratioCo),
    avgLoad: average(loadValues)
  };

  const loadBins = buildLoadBins(rows);

  return { monthly, overall, proxyOverall, loadBins };
}

function buildLoadBins(rows) {
  const loads = rows.map((r) => r.TEY).sort((a, b) => a - b);
  const q1 = percentile(loads, 0.25);
  const q2 = percentile(loads, 0.5);
  const q3 = percentile(loads, 0.75);

  const bins = [
    { label: `≤ ${q1.toFixed(1)} MWh`, min: -Infinity, max: q1 },
    { label: `${q1.toFixed(1)} – ${q2.toFixed(1)} MWh`, min: q1, max: q2 },
    { label: `${q2.toFixed(1)} – ${q3.toFixed(1)} MWh`, min: q2, max: q3 },
    { label: `> ${q3.toFixed(1)} MWh`, min: q3, max: Infinity }
  ];

  bins.forEach((bin) => {
    bin.count = 0;
    bin.avgLoad = 0;
    bin.avgProxyNox = 0;
    bin.avgProxyCo = 0;
  });

  rows.forEach((row) => {
    const proxyNox = safeDivide(row.NOX, row.TEY);
    const proxyCo = safeDivide(row.CO, row.TEY);
    const bin = bins.find((b) => row.TEY > b.min && row.TEY <= b.max);
    if (!bin) return;
    bin.count += 1;
    bin.avgLoad += row.TEY;
    if (Number.isFinite(proxyNox)) bin.avgProxyNox += proxyNox;
    if (Number.isFinite(proxyCo)) bin.avgProxyCo += proxyCo;
  });

  bins.forEach((bin) => {
    if (bin.count === 0) {
      bin.avgLoad = bin.avgProxyNox = bin.avgProxyCo = 0;
      return;
    }
    bin.avgLoad /= bin.count;
    bin.avgProxyNox /= bin.count;
    bin.avgProxyCo /= bin.count;
  });

  return bins;
}

// ---------- Rendering helpers ----------
function updateNoxKpis(overall) {
  setText("kpi-nox-avg", formatNumber(overall.avgNox, 1));
  setText("kpi-nox-p95", formatNumber(overall.p95, 1));
  setText("kpi-nox-within", `${formatNumber(overall.within * 100, 1)}%`);
  setText("kpi-nox-hours", overall.sampleHours.toLocaleString());
  const chips = [];
  chips.push(`${formatNumber((1 - overall.within) * 100, 1)}% exceedances`);
  chips.push(`Limit: ${formatNumber(overall.limit, 0)} mg/Nm³`);
  chips.push(`${overall.sampleHours.toLocaleString()} hours analysed`);
  const tone = overall.within >= 0.95 ? "good" : overall.within >= 0.85 ? "warn" : "bad";
  setChips("nox-kpi-chips", chips, tone);
}

function updateProxyKpis(proxy) {
  setText("kpi-nox-proxy", formatNumber(proxy.avgNoxProxy, 3));
  setText("kpi-co-proxy", formatNumber(proxy.avgCoProxy, 3));
  setText("kpi-avg-load", formatNumber(proxy.avgLoad, 1));
}

function renderMonthlyNoxChart(monthly, limit) {
  const labels = monthly.map((m) => m.label);
  const avgNox = monthly.map((m) => m.avgNox);
  const p95 = monthly.map((m) => m.p95);
  const withinPct = monthly.map((m) => +(m.within * 100).toFixed(1));
  const limitLine = monthly.map(() => limit);

  const ctx = document.getElementById("chartNoxMonthly");
  const data = {
    labels,
    datasets: [
      {
        type: "line",
        label: "Avg NOx (mg/Nm³)",
        data: avgNox,
        borderColor: "#1d4ed8",
        tension: 0.25,
        pointRadius: 0
      },
      {
        type: "line",
        label: "P95 NOx",
        data: p95,
        borderColor: "#9333ea",
        tension: 0.25,
        pointRadius: 0
      },
      {
        type: "bar",
        label: "% within limit",
        data: withinPct,
        yAxisID: "y2",
        backgroundColor: "rgba(16, 185, 129, 0.35)",
        borderRadius: 6
      },
      {
        type: "line",
        label: "Limit",
        data: limitLine,
        borderColor: "#ef4444",
        borderDash: [6, 6],
        pointRadius: 0
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        title: { display: true, text: "mg/Nm³" }
      },
      y2: {
        position: "right",
        beginAtZero: true,
        max: 100,
        grid: { drawOnChartArea: false },
        title: { display: true, text: "% within" }
      }
    }
  };

  if (chartNoxMonthly) {
    chartNoxMonthly.data = data;
    chartNoxMonthly.options = options;
    chartNoxMonthly.update();
  } else {
    chartNoxMonthly = new Chart(ctx, { type: "bar", data, options });
  }
}

function renderProxyChart(monthly) {
  const labels = monthly.map((m) => m.label);
  const noxProxy = monthly.map((m) => m.avgProxyNox);
  const coProxy = monthly.map((m) => m.avgProxyCo);

  const ctx = document.getElementById("chartProxyMonthly");
  const data = {
    labels,
    datasets: [
      {
        label: "NOx / TEY",
        data: noxProxy,
        borderColor: "#2563eb",
        tension: 0.25,
        pointRadius: 0
      },
      {
        label: "CO / TEY",
        data: coProxy,
        borderColor: "#f97316",
        tension: 0.25,
        pointRadius: 0
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        title: { display: true, text: "mg·Nm⁻³ per MWh" }
      }
    }
  };

  if (chartProxyMonthly) {
    chartProxyMonthly.data = data;
    chartProxyMonthly.options = options;
    chartProxyMonthly.update();
  } else {
    chartProxyMonthly = new Chart(ctx, { type: "line", data, options });
  }
}

function fillMonthlyTable(monthly) {
  const tbody = document.getElementById("table-monthly-body");
  tbody.innerHTML = "";
  monthly.forEach((m) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.label}</td>
      <td>${formatNumber(m.avgNox, 1)}</td>
      <td>${formatNumber(m.p95, 1)}</td>
      <td>${formatNumber(m.within * 100, 1)}%</td>
      <td>${formatNumber(m.avgProxyNox, 3)}</td>
      <td>${formatNumber(m.avgProxyCo, 3)}</td>
      <td>${formatNumber(m.avgLoad, 1)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function fillLoadBinTable(bins) {
  const tbody = document.getElementById("table-load-body");
  tbody.innerHTML = "";
  bins.forEach((bin) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${bin.label}</td>
      <td>${bin.count}</td>
      <td>${formatNumber(bin.avgLoad, 1)}</td>
      <td>${formatNumber(bin.avgProxyNox, 3)}</td>
      <td>${formatNumber(bin.avgProxyCo, 3)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCo2(monthly) {
  if (!monthly.length) return;

  const totals = monthly.reduce(
    (acc, month) => {
      acc.netMwh += month.netMwh;
      acc.co2Tonnes += month.co2Tonnes;
      acc.etsCost += month.etsCost;
      acc.weightedIntensity += month.avgIntensity * month.netMwh;
      return acc;
    },
    { netMwh: 0, co2Tonnes: 0, etsCost: 0, weightedIntensity: 0 }
  );

  const avgIntensity = totals.netMwh ? totals.weightedIntensity / totals.netMwh : 0;

  setText("kpi-co2-mwh", formatNumber(totals.netMwh, 0));
  setText("kpi-co2-tonnes", formatNumber(totals.co2Tonnes, 0));
  setText("kpi-co2-intensity", formatNumber(avgIntensity, 1));
  setText("kpi-co2-ets", formatCurrency(totals.etsCost));

  const peakEmission = monthly.reduce((max, m) => (m.co2Tonnes > max.co2Tonnes ? m : max), monthly[0]);
  const lowestIntensity = monthly.reduce((min, m) => (m.avgIntensity < min.avgIntensity ? m : min), monthly[0]);
  const chips = [
    `Peak month ${peakEmission.month}: ${formatNumber(peakEmission.co2Tonnes, 0)} t`,
    `Lowest intensity ${lowestIntensity.month}: ${formatNumber(lowestIntensity.avgIntensity, 1)} kg/MWh`
  ];
  setChips("co2-kpi-chips", chips, "warn");

  renderCo2EmissionsChart(monthly);
  renderCo2IntensityChart(monthly);
  fillCo2Table(monthly);
}

function renderCo2EmissionsChart(monthly) {
  const ctx = document.getElementById("chartCo2Monthly");
  if (!ctx) return;

  const labels = monthly.map((m) => m.month);
  const co2 = monthly.map((m) => m.co2Tonnes);
  const cost = monthly.map((m) => m.etsCost);

  const data = {
    labels,
    datasets: [
      {
        type: "bar",
        label: "CO₂ (t)",
        data: co2,
        backgroundColor: "rgba(59, 130, 246, 0.35)",
        borderColor: "#3b82f6",
        borderWidth: 1,
        borderRadius: 6
      },
      {
        type: "line",
        label: "ETS cost (€)",
        data: cost,
        yAxisID: "y2",
        borderColor: "#ef4444",
        tension: 0.25,
        pointRadius: 0
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Tonnes" }
      },
      y2: {
        position: "right",
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Euro" }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label(context) {
            if (context.dataset.type === "line") {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
            }
            return `${context.dataset.label}: ${formatNumber(context.parsed.y, 0)} t`;
          }
        }
      }
    }
  };

  if (chartCo2Monthly) {
    chartCo2Monthly.data = data;
    chartCo2Monthly.options = options;
    chartCo2Monthly.update();
  } else {
    chartCo2Monthly = new Chart(ctx, { type: "bar", data, options });
  }
}

function renderCo2IntensityChart(monthly) {
  const ctx = document.getElementById("chartCo2Intensity");
  if (!ctx) return;

  const labels = monthly.map((m) => m.month);
  const intensity = monthly.map((m) => m.avgIntensity);

  const data = {
    labels,
    datasets: [
      {
        label: "Carbon intensity (kg/MWh)",
        data: intensity,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.25)",
        tension: 0.25,
        pointRadius: 0,
        fill: true
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: false,
        title: { display: true, text: "kg CO₂ per MWh" }
      }
    }
  };

  if (chartCo2Intensity) {
    chartCo2Intensity.data = data;
    chartCo2Intensity.options = options;
    chartCo2Intensity.update();
  } else {
    chartCo2Intensity = new Chart(ctx, { type: "line", data, options });
  }
}

function fillCo2Table(monthly) {
  const tbody = document.getElementById("table-co2-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  monthly.forEach((m) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.month}</td>
      <td>${formatNumber(m.netMwh, 0)}</td>
      <td>${formatNumber(m.co2Tonnes, 0)}</td>
      <td>${formatNumber(m.avgIntensity, 1)}</td>
      <td>${formatCurrency(m.etsCost)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------- Generic helpers ----------
function safeDivide(num, den) {
  return den ? num / den : NaN;
}

function average(arr) {
  const finite = arr.filter((v) => Number.isFinite(v));
  if (!finite.length) return 0;
  const sum = finite.reduce((acc, v) => acc + v, 0);
  return sum / finite.length;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const weight = idx - lower;
  return sorted[lower] + weight * (sorted[upper] - sorted[lower]);
}

function countIf(arr, predicate) {
  return arr.reduce((acc, value) => acc + (predicate(value) ? 1 : 0), 0);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setChips(containerId, msgs, tone = "warn") {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";
  msgs.filter(Boolean).forEach((msg) => {
    const span = document.createElement("span");
    span.className = `chip ${tone}`;
    span.textContent = msg;
    el.appendChild(span);
  });
}

function formatNumber(value, digits) {
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      })
    : "–";
}

function formatCurrency(value) {
  return Number.isFinite(value)
    ? `€${value.toLocaleString(undefined, {
        maximumFractionDigits: 0
      })}`
    : "–";
}
