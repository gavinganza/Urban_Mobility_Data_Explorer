// Connects to Flask backend at /api/*

const API = '';

// Utility
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDollar(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + fmt(n, 2);
}

function fmtTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// API helpers
async function apiFetch(path, fallback = null) {
  try {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('API fetch failed:', path, err.message);
    return fallback;
  }
}

// Chart.js defaults
Chart.defaults.color = '#8892A4';
Chart.defaults.borderColor = '#1e2d4a';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11;

const COLORS = {
  cyan:   '#00D4FF',
  amber:  '#F59E0B',
  green:  '#10B981',
  purple: '#8B5CF6',
  red:    '#EF4444',
};

// State
const state = {
  currentSection: 'overview',
  filters: {
    borough: '',
    timeOfDay: '',
    paymentType: '',
    minFare: '',
    maxFare: '',
    sortBy: 'pickup_datetime',
    sortDir: 'DESC',
  },
  trips: {
    data: [],
    page: 1,
    pageSize: 15,
    total: 0,
  },
  charts: {},
  stats: null,
};

// NAVIGATION
function initNav() {
  $$('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.dataset.section;
      navigateTo(sec);
      // close sidebar on mobile
      document.querySelector('.sidebar').classList.remove('open');
    });
  });

  // hamburger
  const ham = $('hamburger');
  if (ham) {
    ham.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('open');
    });
  }
}

function navigateTo(section) {
  state.currentSection = section;

  // Update nav
  $$('.nav-item[data-section]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  // Update sections
  $$('.section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `section-${section}`);
  });

  // Update topbar title
  const titles = {
    overview: 'Overview',
    trips: 'Trip Explorer',
    map: 'Zone Map',
    insights: 'Insights',
    quality: 'Data Quality',
  };
  const topTitle = $('topbar-title');
  if (topTitle) topTitle.textContent = titles[section] || section;

  // Lazy-load section
  if (section === 'map') loadMapSection();
  if (section === 'trips') loadTripsTable();
  if (section === 'insights') loadInsights();
  if (section === 'quality') loadQualitySection();
}

// OVERVIEW
async function loadOverview() {
  // 1. Stats summary
  const stats = await apiFetch('/api/stats/summary', null);
  state.stats = stats;
  renderKPIs(stats);

  // 2. Time-of-day distribution
  const tod = await apiFetch('/api/stats/time_of_day', null);
  renderTimeOfDayChart(tod);

  // 3. Borough breakdown
  const boroughs = await apiFetch('/api/stats/borough', null);
  renderBoroughBars(boroughs);

  // 4. Hourly heatmap
  const hourly = await apiFetch('/api/stats/hourly', null);
  renderHourlyChart(hourly);

  // 5. Payment types
  const payments = await apiFetch('/api/stats/payments', null);
  renderPaymentChart(payments);
}

function renderKPIs(stats) {
  if (!stats) {
    // Fallback placeholder
    stats = {
      total_trips: '—', avg_fare: '—', avg_distance: '—',
      avg_duration: '—', avg_speed: '—', avg_tip_pct: '—',
    };
  }

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('kpi-total-trips',   fmt(stats.total_trips));
  set('kpi-total-footer',  fmt(stats.total_trips));
  set('kpi-avg-fare',      fmtDollar(stats.avg_fare));
  set('kpi-avg-distance',  stats.avg_distance != null ? fmt(stats.avg_distance, 1) + ' mi' : '—');
  set('kpi-avg-duration',  stats.avg_duration != null ? fmt(stats.avg_duration, 1) + ' min' : '—');
  set('kpi-avg-speed',     stats.avg_speed    != null ? fmt(stats.avg_speed,    1) + ' mph' : '—');
  set('kpi-avg-tip',       stats.avg_tip_pct  != null ? fmt(stats.avg_tip_pct,  1) + '%'   : '—');
}

function renderTimeOfDayChart(data) {
  const canvas = $('chart-tod');
  if (!canvas) return;

  // Destroy existing
  if (state.charts.tod) state.charts.tod.destroy();

  const labels = data ? data.map(d => d.time_of_day) : ['Morning Rush', 'Midday', 'Evening Rush', 'Late Night'];
  const values = data ? data.map(d => d.trip_count)  : [0, 0, 0, 0];

  const palette = [COLORS.amber, COLORS.green, COLORS.cyan, COLORS.purple];

  state.charts.tod = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: palette.map(c => c + '33'),
        borderColor: palette,
        borderWidth: 2,
        hoverBorderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 14, boxWidth: 10, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt(ctx.parsed)} trips (${((ctx.parsed / values.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`,
          },
        },
      },
    },
  });
}

function renderBoroughBars(data) {
  const container = $('borough-bars');
  if (!container) return;

  const fallback = [
    { borough: 'Manhattan',     trip_count: 0, total_revenue: 0 },
    { borough: 'Queens',        trip_count: 0, total_revenue: 0 },
    { borough: 'Brooklyn',      trip_count: 0, total_revenue: 0 },
    { borough: 'Bronx',         trip_count: 0, total_revenue: 0 },
    { borough: 'Staten Island', trip_count: 0, total_revenue: 0 },
  ];

  const rows = data || fallback;
  const max  = Math.max(...rows.map(r => r.trip_count || 0), 1);

  const boroughColors = {
    'Manhattan':    '#00D4FF',
    'Brooklyn':     '#F59E0B',
    'Queens':       '#10B981',
    'Bronx':        '#8B5CF6',
    'Staten Island':'#EF4444',
  };

  container.innerHTML = rows.map(r => {
    const pct   = ((r.trip_count || 0) / max * 100).toFixed(1);
    const color = boroughColors[r.borough] || '#6B7280';
    return `
      <div class="bar-item">
        <div class="bar-meta">
          <span class="bar-name">${r.borough}</span>
          <span class="bar-val">${fmt(r.trip_count)} trips · ${fmtDollar(r.total_revenue)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" data-width="${pct}" style="background:${color}"></div>
        </div>
      </div>`;
  }).join('');

  // Animate bars after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $$('.bar-fill').forEach(el => {
        el.style.width = (el.dataset.width || 0) + '%';
      });
    });
  });
}

function renderHourlyChart(data) {
  const canvas = $('chart-hourly');
  if (!canvas) return;
  if (state.charts.hourly) state.charts.hourly.destroy();

  const hours  = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`);
  const lookup = {};
  if (data) data.forEach(d => { lookup[d.hour] = d.trip_count; });
  const values = hours.map((_, i) => lookup[i] || 0);

  // Gradient fill
  const ctx  = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0,   'rgba(0,212,255,0.35)');
  grad.addColorStop(1,   'rgba(0,212,255,0.02)');

  state.charts.hourly = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [{
        label: 'Trips',
        data: values,
        backgroundColor: grad,
        borderColor: COLORS.cyan,
        borderWidth: 1,
        borderRadius: 3,
        hoverBackgroundColor: COLORS.cyan,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
        y: { grid: { color: '#1e2d4a' }, ticks: { callback: v => fmt(v) } },
      },
    },
  });
}

function renderPaymentChart(data) {
  const canvas = $('chart-payment');
  if (!canvas) return;
  if (state.charts.payment) state.charts.payment.destroy();

  const PAYMENT_LABELS = {
    1: 'Credit Card',
    2: 'Cash',
    3: 'No Charge',
    4: 'Dispute',
    5: 'Unknown',
    6: 'Voided',
  };

  const rows   = data || [];
  const labels = rows.map(r => PAYMENT_LABELS[r.payment_type] || `Type ${r.payment_type}`);
  const values = rows.map(r => r.trip_count);

  state.charts.payment = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [COLORS.cyan, COLORS.amber, COLORS.green, COLORS.red, COLORS.purple, '#6B7280'],
        borderColor: '#0D1424',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8892A4', padding: 16 } },
      },
    },
  });
}

// TRIPS EXPLORER
async function loadTripsTable() {
  const params = buildQueryParams();
  const data   = await apiFetch(`/api/trips?${params}`, { trips: [], total: 0 });

  state.trips.data  = data?.trips  || [];
  state.trips.total = data?.total  || 0;

  renderTripsTable();
  renderPagination();
}

function buildQueryParams() {
  const f = state.filters;
  const p = new URLSearchParams();
  if (f.borough)      p.set('borough', f.borough);
  if (f.timeOfDay)    p.set('time_of_day', f.timeOfDay);
  if (f.paymentType)  p.set('payment_type', f.paymentType);
  if (f.minFare)      p.set('min_fare', f.minFare);
  if (f.maxFare)      p.set('max_fare', f.maxFare);
  p.set('sort_by',  f.sortBy);
  p.set('sort_dir', f.sortDir);
  p.set('page',     state.trips.page);
  p.set('per_page', state.trips.pageSize);
  return p.toString();
}

function renderTripsTable() {
  const tbody = $('trips-tbody');
  if (!tbody) return;

  const TOD_CHIP = {
    'Morning Rush': 'chip-morning',
    'Midday':       'chip-midday',
    'Evening Rush': 'chip-evening',
    'Late Night':   'chip-night',
  };

  const PAYMENT = { 1: 'Credit', 2: 'Cash', 3: 'No Charge', 4: 'Dispute', 5: '—', 6: 'Voided' };

  if (!state.trips.data.length) {
    tbody.innerHTML = `<tr><td colspan="10">
      <div class="empty-state">
        <div class="empty-icon"></div>
        <p>No trips found for current filters.</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = state.trips.data.map(t => `
    <tr>
      <td>${fmtTime(t.pickup_datetime)}</td>
      <td>${t.pu_zone || t.pu_location_id || '—'}</td>
      <td>${t.do_zone || t.do_location_id || '—'}</td>
      <td>${fmt(t.trip_distance, 1)} mi</td>
      <td>${fmt(t.duration_min, 0)} min</td>
      <td>${fmtDollar(t.fare_amount)}</td>
      <td>${fmtDollar(t.tip_amount)}</td>
      <td>${fmtDollar(t.total_amount)}</td>
      <td>${PAYMENT[t.payment_type] || '—'}</td>
      <td><span class="td-chip ${TOD_CHIP[t.time_of_day] || 'chip-night'}">${t.time_of_day || '—'}</span></td>
    </tr>
  `).join('');
}

function renderPagination() {
  const info  = $('page-info');
  const prev  = $('page-prev');
  const next  = $('page-next');
  const label = $('page-label');

  const total = state.trips.total;
  const page  = state.trips.page;
  const size  = state.trips.pageSize;
  const pages = Math.ceil(total / size) || 1;

  if (info)  info.textContent  = `${fmt((page-1)*size + 1)}–${fmt(Math.min(page*size, total))} of ${fmt(total)} trips`;
  if (label) label.textContent = `Page ${page} of ${pages}`;
  if (prev)  prev.disabled     = page <= 1;
  if (next)  next.disabled     = page >= pages;
}

function initTripFilters() {
  const applyBtn = $('apply-filters');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      state.filters.borough      = $('filter-borough')?.value      || '';
      state.filters.timeOfDay    = $('filter-tod')?.value          || '';
      state.filters.paymentType  = $('filter-payment')?.value      || '';
      state.filters.minFare      = $('filter-min-fare')?.value     || '';
      state.filters.maxFare      = $('filter-max-fare')?.value     || '';
      state.trips.page = 1;
      loadTripsTable();

    });
  }

  const resetBtn = $('reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      ['filter-borough','filter-tod','filter-payment','filter-min-fare','filter-max-fare']
        .forEach(id => { const el = $(id); if (el) el.value = ''; });
      state.filters = { ...state.filters, borough: '', timeOfDay: '', paymentType: '', minFare: '', maxFare: '' };
      state.trips.page = 1;
      loadTripsTable();
    });
  }

  const prevBtn = $('page-prev');
  const nextBtn = $('page-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { state.trips.page--; loadTripsTable(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { state.trips.page++; loadTripsTable(); });

  // Column sort
  $$('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.filters.sortBy === col) {
        state.filters.sortDir = state.filters.sortDir === 'ASC' ? 'DESC' : 'ASC';
      } else {
        state.filters.sortBy  = col;
        state.filters.sortDir = 'DESC';
      }
      $$('th[data-sort]').forEach(h => h.classList.remove('sort-asc','sort-desc'));
      th.classList.add(state.filters.sortDir === 'ASC' ? 'sort-asc' : 'sort-desc');
      state.trips.page = 1;
      loadTripsTable();
    });
  });
}

// MAP
async function loadMapSection() {
  // Init map if needed
  if (!MapModule.getMap()) {
    MapModule.initMap('map');
  }

  // Get zone stats to colour the choropleth
  const zoneData = await apiFetch('/api/zones/top?metric=trip_count&n=265', []);
  const zoneStats = {};
  if (zoneData) {
    zoneData.forEach(z => {
      zoneStats[z.location_id] = { trips: z.trip_count, revenue: z.total_revenue };
    });
  }

  MapModule.renderZones(zoneStats);

  // Plot top hotspot markers
  const hotspots = await apiFetch('/api/zones/top?metric=trip_count&n=20', []);
  if (hotspots && hotspots.length) {
    // Some backend responses may include lat/lng; if not, skip markers
    const withCoords = hotspots.filter(h => h.lat && h.lng);
    if (withCoords.length) MapModule.plotHotspots(withCoords);
  }
}

// INSIGHTS
async function loadInsights() {
  // Insight 1: Speed by time of day
  const speedData = await apiFetch('/api/insights/speed', null);
  renderSpeedInsightChart(speedData);

  // Insight 2: Tip behaviour
  const tipData = await apiFetch('/api/insights/tipping', null);
  renderTipInsightChart(tipData);

  // Insight 3: Top zones
  const topZones = await apiFetch('/api/zones/top?metric=trip_count&n=10', []);
  renderTopZonesChart(topZones);
}

function renderSpeedInsightChart(data) {
  const canvas = $('chart-speed');
  if (!canvas) return;
  if (state.charts.speed) state.charts.speed.destroy();

  const labels = data ? data.map(d => d.time_of_day)   : ['Morning Rush','Midday','Evening Rush','Late Night'];
  const values = data ? data.map(d => d.avg_speed_mph)  : [0, 0, 0, 0];

  state.charts.speed = new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Speed (mph)',
        data: values,
        backgroundColor: 'rgba(0,212,255,0.12)',
        borderColor: COLORS.cyan,
        borderWidth: 2,
        pointBackgroundColor: COLORS.cyan,
        pointRadius: 5,
      }],
    },
    options: {
      responsive: true,
      scales: {
        r: {
          grid:       { color: '#1e2d4a' },
          angleLines: { color: '#1e2d4a' },
          ticks: { backdropColor: 'transparent', color: '#8892A4', font: { size: 10 } },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function renderTipInsightChart(data) {
  const canvas = $('chart-tips');
  if (!canvas) return;
  if (state.charts.tips) state.charts.tips.destroy();

  const rows   = data || [];
  const labels = rows.map(d => d.borough || d.time_of_day || '—');
  const values = rows.map(d => d.avg_tip_pct || d.avg_tip_percentage || 0);

  const ctx  = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, 'rgba(245,158,11,0.5)');
  grad.addColorStop(1, 'rgba(245,158,11,0.05)');

  state.charts.tips = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Tip %',
        data: values,
        backgroundColor: grad,
        borderColor: COLORS.amber,
        borderWidth: 2,
        borderRadius: 5,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#1e2d4a' }, ticks: { callback: v => v + '%' } },
      },
    },
  });
}

function renderTopZonesChart(data) {
  const canvas = $('chart-top-zones');
  if (!canvas) return;
  if (state.charts.zones) state.charts.zones.destroy();

  const rows   = data ? data.slice(0, 10) : [];
  const labels = rows.map(r => r.zone || r.location_id);
  const trips  = rows.map(r => r.trip_count);
  const rev    = rows.map(r => r.total_revenue);

  state.charts.zones = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Trip Count',
          data: trips,
          backgroundColor: COLORS.cyan + '44',
          borderColor: COLORS.cyan,
          borderWidth: 1.5,
          borderRadius: 3,
          yAxisID: 'y',
        },
        {
          label: 'Total Revenue ($)',
          data: rev,
          type: 'line',
          borderColor: COLORS.amber,
          borderWidth: 2,
          pointBackgroundColor: COLORS.amber,
          pointRadius: 4,
          fill: false,
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x:  { grid: { display: false }, ticks: { maxRotation: 35, minRotation: 15, font: { size: 10 } } },
        y:  { grid: { color: '#1e2d4a' }, ticks: { callback: v => fmt(v) }, title: { display: true, text: 'Trips', color: COLORS.cyan } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => '$' + fmt(v) }, title: { display: true, text: 'Revenue', color: COLORS.amber } },
      },
      plugins: {
        legend: { labels: { boxWidth: 10, font: { size: 11 } } },
      },
    },
  });
}

// DATA QUALITY
async function loadQualitySection() {
  const data = await apiFetch('/api/stats/data_quality', null);
  renderQualityCards(data);
  renderQualityChart(data);
  renderExcludedTable();
}

function renderQualityCards(data) {
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  if (!data) {
    set('dq-total',    '—');
    set('dq-clean',    '—');
    set('dq-excluded', '—');
    set('dq-pct',      '—');
    return;
  }
  set('dq-total',    fmt(data.total_raw));
  set('dq-clean',    fmt(data.clean_count));
  set('dq-excluded', fmt(data.excluded_count));
  set('dq-pct',      data.clean_pct != null ? fmt(data.clean_pct, 1) + '%' : '—');
}

function renderQualityChart(data) {
  const canvas = $('chart-dq');
  if (!canvas) return;
  if (state.charts.dq) state.charts.dq.destroy();

  const clean    = data?.clean_count    || 0;
  const excluded = data?.excluded_count || 0;

  state.charts.dq = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Clean Records', 'Excluded Records'],
      datasets: [{
        data: [clean, excluded],
        backgroundColor: [COLORS.green + '44', COLORS.red + '44'],
        borderColor:     [COLORS.green,        COLORS.red],
        borderWidth: 2,
      }],
    },
    options: {
      cutout: '72%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed)} records` } },
      },
    },
  });
}

async function renderExcludedTable() {
  const tbody = $('excluded-tbody');
  if (!tbody) return;

  const data = await apiFetch('/api/stats/excluded?limit=20', []);
  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>No exclusion data available.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${fmtTime(r.tpep_pickup_datetime || r.pickup_datetime)}</td>
      <td>${fmt(r.trip_distance, 1)} mi</td>
      <td>${fmtDollar(r.fare_amount)}</td>
      <td>${fmt(r.passenger_count)}</td>
      <td>${fmtDollar(r.total_amount)}</td>
      <td><span class="anomaly-tag">${r.exclusion_reason || 'flagged'}</span></td>
    </tr>
  `).join('');
}

// INIT
document.addEventListener('DOMContentLoaded', async () => {
  const loader = $('loading-overlay');
  if (loader) loader.remove();

  initNav();
  initTripFilters();

  // Load default section
  navigateTo('overview');
  await loadOverview();

  // Show live pulse

});