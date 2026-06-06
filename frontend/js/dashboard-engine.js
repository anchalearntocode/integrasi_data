/**
 * Dashboard Engine — Power BI-Style Interactive Visualizations
 * 
 * Implements reactive state management, cross-filtering between charts,
 * slicer panels (global filters), and KPI cards with animated counters.
 * 
 * Architecture:
 *   DashboardState (reactive store)
 *     ├── filters: { tahun, prodi }        ← Slicer Panel
 *     ├── crossFilter: { source, dim, val } ← Click on Chart
 *     └── rawData: [...]                    ← API response
 * 
 *   on('filterChange') → re-render ALL charts
 *   on('crossFilter')  → highlight/filter OTHER charts
 */

// ═══════════════════════════════════════════════════════════
//  1. REACTIVE STATE MANAGER
// ═══════════════════════════════════════════════════════════

class DashboardState {
    constructor() {
        this.filters = { tahun: 'all', prodi: 'all' };
        this.crossFilter = { source: null, dimension: null, value: null };
        this.rawData = [];
        this.dimensions = {};
        this.listeners = [];
    }

    subscribe(fn) {
        this.listeners.push(fn);
    }

    setData(data, dimensions) {
        this.rawData = data;
        this.dimensions = dimensions;
        this._notify('data');
    }

    setFilter(key, value) {
        this.filters[key] = value;
        this.clearCrossFilter();
        this._notify('filter');
    }

    setCrossFilter(source, dimension, value) {
        if (this.crossFilter.source === source && this.crossFilter.value === value) {
            this.clearCrossFilter();
            this._notify('crossFilter');
        } else {
            this.crossFilter = { source, dimension, value };
            this._notify('crossFilter');
        }
    }

    clearCrossFilter() {
        this.crossFilter = { source: null, dimension: null, value: null };
    }

    resetAll() {
        this.filters = { tahun: 'all', prodi: 'all' };
        this.clearCrossFilter();
        this._notify('reset');
    }

    getFilteredData() {
        return this.rawData.filter(row => {
            const t = this.filters.tahun === 'all' || String(row.tahun_lulus) === String(this.filters.tahun);
            const p = this.filters.prodi === 'all' || row.nama_prodi === this.filters.prodi;
            return t && p;
        });
    }

    getCrossFilteredData(chartId) {
        let data = this.getFilteredData();
        const cf = this.crossFilter;
        if (cf.source && cf.source !== chartId && cf.dimension && cf.value) {
            data = data.filter(row => String(row[cf.dimension]) === String(cf.value));
        }
        return data;
    }

    isActiveFilter() {
        return this.filters.tahun !== 'all' || this.filters.prodi !== 'all' || this.crossFilter.source !== null;
    }

    _notify(type) {
        this.listeners.forEach(fn => fn(type));
    }
}

// Global state instance
const dashState = new DashboardState();

// Loading overlay helper
function hideLoadingOverlays() {
    ['loading-donut', 'loading-clustered', 'loading-line', 'loading-hbar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            setTimeout(() => el.remove(), 300);
        }
    });
}


// ═══════════════════════════════════════════════════════════
//  2. CHART.JS CONFIGURATION
// ═══════════════════════════════════════════════════════════

Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
Chart.defaults.font.size = 12;

const PALETTE = {
    colors: ['#1d4ed8', '#0d9488', '#d97706', '#15803d', '#7c3aed', '#0369a1', '#be123c'],
    fills: ['rgba(29, 78, 216, 0.15)', 'rgba(13, 148, 136, 0.15)', 'rgba(217, 119, 6, 0.15)', 'rgba(21, 128, 61, 0.15)', 'rgba(124, 58, 237, 0.15)', 'rgba(3, 105, 161, 0.15)', 'rgba(190, 18, 60, 0.15)'],
    fillsHover: ['rgba(29, 78, 216, 0.28)', 'rgba(13, 148, 136, 0.28)', 'rgba(217, 119, 6, 0.28)', 'rgba(21, 128, 61, 0.28)', 'rgba(124, 58, 237, 0.28)', 'rgba(3, 105, 161, 0.28)', 'rgba(190, 18, 60, 0.28)'],
    primary: '#1d4ed8',
    secondary: '#0d9488',
    tertiary: '#d97706',
    success: '#15803d',
    danger: '#be123c',
    accent: '#7c3aed',
};

function applyChartDefaults(Chart) {
    const zinc = { bg: '#09090b', surface: '#18181b', border: '#27272a', borderMid: '#3f3f46', textPrim: '#e4e4e7', textSec: '#a1a1aa', textMuted: '#71717a' };
    
    Chart.defaults.color = zinc.textSec;
    Chart.defaults.borderColor = zinc.border;
    Chart.defaults.backgroundColor = PALETTE.fills[0];
    Chart.defaults.animation.duration = 600;
    Chart.defaults.animation.easing = 'easeOutQuart';

    const scaleDefaults = {
        grid: { color: zinc.border, borderColor: zinc.borderMid, tickColor: zinc.border, drawBorder: true },
        ticks: { color: zinc.textMuted, font: { family: "'Inter', system-ui, sans-serif", size: 11 }, padding: 8 },
        border: { color: zinc.borderMid }
    };
    
    Chart.defaults.scales.linear = Chart.defaults.scales.linear || {};
    Chart.defaults.scales.category = Chart.defaults.scales.category || {};
    Object.assign(Chart.defaults.scales.linear, scaleDefaults);
    Object.assign(Chart.defaults.scales.category, scaleDefaults);

    Chart.defaults.plugins.legend.labels.color = zinc.textSec;
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.legend.labels.useBorderRadius = true;
    Chart.defaults.plugins.legend.labels.borderRadius = 2;
    Chart.defaults.plugins.legend.labels.font = { family: "'Inter', system-ui, sans-serif", size: 12 };

    Chart.defaults.plugins.tooltip.backgroundColor = zinc.surface;
    Chart.defaults.plugins.tooltip.borderColor = zinc.borderMid;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = zinc.textPrim;
    Chart.defaults.plugins.tooltip.bodyColor = zinc.textSec;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 4;
    Chart.defaults.plugins.tooltip.displayColors = true;
    Chart.defaults.plugins.tooltip.boxWidth = 10;
    Chart.defaults.plugins.tooltip.boxHeight = 10;
    Chart.defaults.plugins.tooltip.titleFont = { family: "'Inter', system-ui, sans-serif", size: 12, weight: '600' };
    Chart.defaults.plugins.tooltip.bodyFont = { family: "'Inter', system-ui, sans-serif", size: 12 };
}

function buildDatasets(series, { type = 'bar', tension = 0.35, pointRadius = 3 } = {}) {
    return series.map((s, i) => {
        const color = PALETTE.colors[i % PALETTE.colors.length];
        const fill = PALETTE.fills[i % PALETTE.fills.length];
        if (type === 'line') {
            return {
                label: s.label, data: s.data, borderColor: color, backgroundColor: fill,
                borderWidth: 2, pointRadius, pointHoverRadius: pointRadius + 2,
                pointBackgroundColor: color, tension, fill: s.fill ?? false,
            };
        }
        return {
            label: s.label, data: s.data, backgroundColor: fill,
            hoverBackgroundColor: PALETTE.fillsHover[i % PALETTE.fillsHover.length],
            borderColor: color, borderWidth: 1, borderRadius: 3, borderSkipped: false,
        };
    });
}

function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Terapkan default palette ke Chart.js
applyChartDefaults(Chart);


// ═══════════════════════════════════════════════════════════
//  3. CHART INSTANCE MANAGEMENT
// ═══════════════════════════════════════════════════════════

const charts = {};

function destroyChart(id) {
    if (charts[id]) {
        charts[id].destroy();
        delete charts[id];
    }
}


// ═══════════════════════════════════════════════════════════
//  4. KPI CARDS — Animated counters
// ═══════════════════════════════════════════════════════════

function animateValue(el, target, suffix = '', decimals = 0) {
    if (!el) return;
    let current = 0;
    const steps = 30;
    const step = target / steps;
    let frame = 0;

    const interval = setInterval(() => {
        frame++;
        current += step;
        if (frame >= steps) {
            current = target;
            clearInterval(interval);
        }
        el.textContent = (decimals > 0 ? current.toFixed(decimals) : Math.round(current)) + suffix;
    }, 20);
}

function updateKPIs(data) {
    const total = data.length;
    const avgTunggu = total > 0
        ? data.reduce((s, r) => s + parseFloat(r.lama_tunggu_bulan || 0), 0) / total
        : 0;
    const bekerjaCount = data.filter(r =>
        r.status_kerja && r.status_kerja.toLowerCase().includes('bekerja')
    ).length;
    const pctBekerja = total > 0 ? (bekerjaCount / total) * 100 : 0;
    const prodiCount = new Set(data.map(r => r.nama_prodi)).size;

    animateValue(document.getElementById('kpi-total-alumni'), total);
    animateValue(document.getElementById('kpi-avg-tunggu'), avgTunggu, ' bln', 1);
    animateValue(document.getElementById('kpi-pct-bekerja'), pctBekerja, '%', 1);
    animateValue(document.getElementById('kpi-jumlah-prodi'), prodiCount);
}


// ═══════════════════════════════════════════════════════════
//  5. SLICER PANEL — Toggle filter buttons
// ═══════════════════════════════════════════════════════════

function renderSlicers() {
    const tahunC = document.getElementById('slicer-tahun');
    const prodiC = document.getElementById('slicer-prodi');
    if (!tahunC || !prodiC) return;

    const dims = dashState.dimensions;

    // Tahun buttons
    let tahunHTML = `<button class="slicer-btn active" data-value="all">Semua</button>`;
    (dims.tahun || []).forEach(t => {
        tahunHTML += `<button class="slicer-btn" data-value="${t}">${t}</button>`;
    });
    tahunC.innerHTML = tahunHTML;

    // Prodi buttons
    let prodiHTML = `<button class="slicer-btn active" data-value="all">Semua</button>`;
    (dims.prodi || []).forEach(p => {
        prodiHTML += `<button class="slicer-btn" data-value="${p}">${p}</button>`;
    });
    prodiC.innerHTML = prodiHTML;

    // Event delegation
    tahunC.onclick = e => {
        const btn = e.target.closest('.slicer-btn');
        if (btn) dashState.setFilter('tahun', btn.dataset.value);
    };
    prodiC.onclick = e => {
        const btn = e.target.closest('.slicer-btn');
        if (btn) dashState.setFilter('prodi', btn.dataset.value);
    };
}

function updateSlicerActive() {
    document.querySelectorAll('#slicer-tahun .slicer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === String(dashState.filters.tahun));
    });
    document.querySelectorAll('#slicer-prodi .slicer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === dashState.filters.prodi);
    });

    // Update filter indicator badge
    const indicator = document.getElementById('filter-indicator');
    if (indicator) {
        if (dashState.isActiveFilter()) {
            const parts = [];
            if (dashState.filters.tahun !== 'all') parts.push(`Tahun: ${dashState.filters.tahun}`);
            if (dashState.filters.prodi !== 'all') parts.push(`Prodi: ${dashState.filters.prodi}`);
            if (dashState.crossFilter.source) parts.push(`${dashState.crossFilter.dimension}: ${dashState.crossFilter.value}`);
            indicator.textContent = parts.join(' · ');
            indicator.style.display = 'inline-flex';
        } else {
            indicator.style.display = 'none';
        }
    }
}


// ═══════════════════════════════════════════════════════════
//  6. CHART BUILDERS
// ═══════════════════════════════════════════════════════════

// ── 6a. Donut Chart — Status Kerja Distribution ──

function buildDonutChart() {
    const canvas = document.getElementById('chart-donut-status');
    if (!canvas) return;
    destroyChart('donut');

    const data = dashState.getCrossFilteredData('donut');
    if (data.length === 0) return;

    const statusCounts = {};
    data.forEach(r => {
        statusCounts[r.status_kerja] = (statusCounts[r.status_kerja] || 0) + 1;
    });

    const labels = Object.keys(statusCounts);
    const values = Object.values(statusCounts);
    const total = values.reduce((a, b) => a + b, 0);

    const cf = dashState.crossFilter;
    const isSource = cf.source === 'donut';
    const bgColors = labels.map((label, i) => {
        if (isSource && label !== cf.value) return hexToRgba(PALETTE.colors[i % PALETTE.colors.length], 0.15);
        return hexToRgba(PALETTE.colors[i % PALETTE.colors.length], 0.85);
    });
    const borderColors = labels.map((label, i) => {
        if (isSource && label !== cf.value) return hexToRgba(PALETTE.colors[i % PALETTE.colors.length], 0.15);
        return PALETTE.colors[i % PALETTE.colors.length];
    });

    const centerTextPlugin = {
        id: 'donutCenter',
        afterDraw(chart) {
            const { ctx, chartArea: { width, height, top, left } } = chart;
            ctx.save();
            const cx = left + width / 2;
            const cy = top + height / 2;
            ctx.fillStyle = '#e4e4e7';
            ctx.font = "700 28px 'Inter', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(total, cx, cy - 8);
            ctx.fillStyle = '#71717a';
            ctx.font = "500 11px 'Inter', sans-serif";
            ctx.fillText('Total Alumni', cx, cy + 16);
            ctx.restore();
        }
    };

    charts['donut'] = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 1,
                hoverBorderWidth: 2,
                hoverOffset: 4,
            }]
        },
        plugins: [centerTextPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            onClick: (evt, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    dashState.setCrossFilter('donut', 'status_kerja', labels[idx]);
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                            return `  ${ctx.label}: ${ctx.parsed} alumni (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}


// ── 6b. Clustered Bar — Alumni per Prodi × Tahun Lulus ──

function buildClusteredBar() {
    const canvas = document.getElementById('chart-clustered-bar');
    if (!canvas) return;
    destroyChart('clustered');

    const data = dashState.getCrossFilteredData('clustered');
    if (data.length === 0) return;

    const prodis = [...new Set(data.map(r => r.nama_prodi))].sort();
    const tahunList = [...new Set(data.map(r => String(r.tahun_lulus)))].sort();

    const seriesData = tahunList.map((tahun) => ({
        label: tahun,
        data: prodis.map(prodi =>
            data.filter(r => r.nama_prodi === prodi && String(r.tahun_lulus) === tahun).length
        )
    }));
    
    const datasets = buildDatasets(seriesData, { type: 'bar' });

    charts['clustered'] = new Chart(canvas, {
        type: 'bar',
        data: { labels: prodis, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    dashState.setCrossFilter('clustered', 'nama_prodi', prodis[idx]);
                }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        title: items => items[0].label,
                        label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y} alumni`
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => v + ' org' }
                }
            }
        }
    });
}


// ── 6c. Line Chart — Tren Serapan Kerja per Tahun ──

function buildLineChart() {
    const canvas = document.getElementById('chart-line-trend');
    if (!canvas) return;
    destroyChart('line');

    const data = dashState.getCrossFilteredData('line');
    if (data.length === 0) return;

    const years = [...new Set(data.map(r => String(r.tahun_lulus)))].sort();
    const statuses = [...new Set(data.map(r => r.status_kerja))];

    const seriesData = statuses.map((status) => ({
        label: status,
        data: years.map(year =>
            data.filter(r => String(r.tahun_lulus) === year && r.status_kerja === status).length
        )
    }));
    
    const datasets = buildDatasets(seriesData, { type: 'line', tension: 0.4 });

    charts['line'] = new Chart(canvas, {
        type: 'line',
        data: { labels: years, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: items => `Tahun Lulus ${items[0].label}`,
                        label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y} alumni`
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: { callback: v => v + ' org' }
                }
            }
        }
    });
}


// ── 6d. Horizontal Bar — Rata-rata Waktu Tunggu per Prodi ──

function buildHorizontalBar() {
    const canvas = document.getElementById('chart-hbar-tunggu');
    if (!canvas) return;
    destroyChart('hbar');

    const data = dashState.getCrossFilteredData('hbar');
    if (data.length === 0) return;

    // Calculate average per prodi
    const prodiMap = {};
    data.forEach(r => {
        if (!prodiMap[r.nama_prodi]) prodiMap[r.nama_prodi] = { sum: 0, count: 0 };
        prodiMap[r.nama_prodi].sum += parseFloat(r.lama_tunggu_bulan || 0);
        prodiMap[r.nama_prodi].count++;
    });

    const prodis = Object.keys(prodiMap).sort();
    const avgs = prodis.map(p =>
        prodiMap[p].count > 0 ? parseFloat((prodiMap[p].sum / prodiMap[p].count).toFixed(1)) : 0
    );

    const datasets = buildDatasets([{
        label: 'Rata-rata (Bulan)',
        data: avgs
    }], { type: 'bar' });
    
    datasets[0].maxBarThickness = 30;

    charts['hbar'] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: prodis,
            datasets
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    dashState.setCrossFilter('hbar', 'nama_prodi', prodis[idx]);
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: items => items[0].label,
                        label: ctx => `  Rata-rata: ${ctx.parsed.x} bulan`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { callback: v => v + ' bln' }
                },
                y: { grid: { display: false } }
            }
        }
    });
}


// ═══════════════════════════════════════════════════════════
//  7. CHART SUBTITLE — Shows active cross-filter source
// ═══════════════════════════════════════════════════════════

function updateChartSubtitle(elementId, chartId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const cf = dashState.crossFilter;
    if (cf.source && cf.source !== chartId) {
        el.textContent = `Difilter oleh: ${cf.value}`;
        el.style.display = 'inline-block';
    } else {
        el.style.display = 'none';
    }
}





// ═══════════════════════════════════════════════════════════
//  9. RENDER ALL — Master re-render on every state change
// ═══════════════════════════════════════════════════════════

function renderAll(type) {
    const filtered = dashState.getFilteredData();

    // Update KPI cards (always use slicer-filtered data, not cross-filtered)
    updateKPIs(filtered);

    // Update slicer button active states
    updateSlicerActive();

    // Manage cross-source visual indicator on chart cards
    const sourceMap = {
        'donut': 'card-donut',
        'clustered': 'card-clustered',
        'line': 'card-line',
        'hbar': 'card-hbar'
    };
    document.querySelectorAll('.chart-card').forEach(card => card.classList.remove('cross-source'));
    if (dashState.crossFilter.source) {
        const el = document.getElementById(sourceMap[dashState.crossFilter.source]);
        if (el) el.classList.add('cross-source');
    }

    // Rebuild all charts
    buildDonutChart();
    buildClusteredBar();
    buildLineChart();
    buildHorizontalBar();
}


// ═══════════════════════════════════════════════════════════
//  10. INIT DASHBOARD — Entry point
// ═══════════════════════════════════════════════════════════

async function initDashboard() {
    try {
        // Ambil token dari local storage
        const token = localStorage.getItem('api_key');
        
        const response = await fetch(`${API_URL}/dashboard_api.php`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const result = await response.json();

        if (result.status !== 'success') {
            console.error('Dashboard API error:', result.message);
            hideLoadingOverlays();
            const tbody = document.getElementById('dashboard-table-body');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--danger);">Gagal memuat data: ${result.message}</td></tr>`;
            }
            if (typeof swalDark === 'function') {
                swalDark({
                    icon: 'error',
                    title: 'Gagal Memuat Dashboard',
                    text: result.message || 'Terjadi kesalahan saat memuat data dashboard.'
                });
            }
            return;
        }

        // Load data into state
        dashState.setData(result.data.alumni, result.data.dimensions);

        // Build slicer panels (once)
        renderSlicers();

        // Subscribe to state changes
        dashState.subscribe(renderAll);

        // Initial render
        renderAll('init');

        // Hide loading overlays after data is rendered
        hideLoadingOverlays();

        // Reset button handler
        const resetBtn = document.getElementById('btn-reset-filters');
        if (resetBtn) {
            resetBtn.onclick = () => dashState.resetAll();
        }

    } catch (err) {
        console.error('Failed to initialize dashboard:', err);
        hideLoadingOverlays();
        const tbody = document.getElementById('dashboard-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--danger);">Error koneksi ke server.</td></tr>`;
        }
        if (typeof swalDark === 'function') {
            swalDark({
                icon: 'error',
                title: 'Koneksi Gagal',
                text: 'Gagal terhubung ke server. Periksa koneksi Anda.'
            });
        }
    }
}
