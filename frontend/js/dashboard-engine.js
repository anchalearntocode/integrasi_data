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


// ═══════════════════════════════════════════════════════════
//  2. CHART.JS CONFIGURATION
// ═══════════════════════════════════════════════════════════

Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
Chart.defaults.animation.duration = 600;
Chart.defaults.animation.easing = 'easeOutQuart';

const PALETTE = {
    solid: ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#fb923c', '#e879f9'],
    translucent: [
        'rgba(129,140,248,0.7)', 'rgba(52,211,153,0.7)', 'rgba(251,191,36,0.7)',
        'rgba(248,113,113,0.7)', 'rgba(167,139,250,0.7)', 'rgba(34,211,238,0.7)',
        'rgba(251,146,60,0.7)', 'rgba(232,121,249,0.7)',
    ],
    glow: [
        'rgba(129,140,248,0.15)', 'rgba(52,211,153,0.15)', 'rgba(251,191,36,0.15)',
        'rgba(248,113,113,0.15)', 'rgba(167,139,250,0.15)', 'rgba(34,211,238,0.15)',
        'rgba(251,146,60,0.15)', 'rgba(232,121,249,0.15)',
    ],
    dimmed: [
        'rgba(129,140,248,0.18)', 'rgba(52,211,153,0.18)', 'rgba(251,191,36,0.18)',
        'rgba(248,113,113,0.18)', 'rgba(167,139,250,0.18)', 'rgba(34,211,238,0.18)',
        'rgba(251,146,60,0.18)', 'rgba(232,121,249,0.18)',
    ],
};

const TOOLTIP = {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    titleColor: '#f1f5f9',
    bodyColor: '#cbd5e1',
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderWidth: 1,
    cornerRadius: 10,
    padding: 14,
    titleFont: { size: 13, weight: '600' },
    bodyFont: { size: 12 },
    displayColors: true,
    boxPadding: 6,
    usePointStyle: true,
};

const GRID = { color: 'rgba(255,255,255,0.05)', drawBorder: false };
const TICK = { color: '#64748b', font: { size: 11 }, padding: 8 };


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

    // Dim non-selected slices when this chart is the cross-filter source
    const cf = dashState.crossFilter;
    const isSource = cf.source === 'donut';
    const bgColors = labels.map((label, i) => {
        if (isSource && label !== cf.value) return PALETTE.dimmed[i % PALETTE.dimmed.length];
        return PALETTE.translucent[i % PALETTE.translucent.length];
    });
    const borderColors = labels.map((label, i) => {
        if (isSource && label !== cf.value) return PALETTE.dimmed[i % PALETTE.dimmed.length];
        return PALETTE.solid[i % PALETTE.solid.length];
    });

    // Center text plugin
    const centerTextPlugin = {
        id: 'donutCenter',
        afterDraw(chart) {
            const { ctx, chartArea: { width, height, top, left } } = chart;
            ctx.save();
            const cx = left + width / 2;
            const cy = top + height / 2;
            ctx.fillStyle = '#f1f5f9';
            ctx.font = "700 28px 'Inter', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(total, cx, cy - 8);
            ctx.fillStyle = '#64748b';
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
                borderWidth: 2,
                hoverBorderWidth: 3,
                hoverOffset: 10,
                spacing: 3,
            }]
        },
        plugins: [centerTextPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            onClick: (evt, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    dashState.setCrossFilter('donut', 'status_kerja', labels[idx]);
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 16, font: { size: 11 } }
                },
                tooltip: {
                    ...TOOLTIP,
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

    updateChartSubtitle('donut-subtitle', 'donut');
}


// ── 6b. Clustered Bar — Alumni per Prodi × Pendapatan ──

function buildClusteredBar() {
    const canvas = document.getElementById('chart-clustered-bar');
    if (!canvas) return;
    destroyChart('clustered');

    const data = dashState.getCrossFilteredData('clustered');
    if (data.length === 0) return;

    const prodis = [...new Set(data.map(r => r.nama_prodi))].sort();
    const pendapatanList = [...new Set(data.map(r => r.range_pendapatan))];

    const cf = dashState.crossFilter;
    const isSource = cf.source === 'clustered';

    const datasets = pendapatanList.map((pend, i) => ({
        label: pend,
        backgroundColor: PALETTE.translucent[i % PALETTE.translucent.length],
        borderColor: PALETTE.solid[i % PALETTE.solid.length],
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
        data: prodis.map(prodi =>
            data.filter(r => r.nama_prodi === prodi && r.range_pendapatan === pend).length
        )
    }));

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
                legend: {
                    position: 'top',
                    labels: { padding: 12, font: { size: 11 } }
                },
                tooltip: {
                    ...TOOLTIP,
                    callbacks: {
                        title: items => items[0].label,
                        label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y} alumni`
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: TICK },
                y: {
                    grid: GRID,
                    ticks: { ...TICK, callback: v => v + ' org' },
                    beginAtZero: true,
                }
            }
        }
    });

    updateChartSubtitle('clustered-subtitle', 'clustered');
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

    const datasets = statuses.map((status, i) => ({
        label: status,
        borderColor: PALETTE.solid[i % PALETTE.solid.length],
        backgroundColor: PALETTE.glow[i % PALETTE.glow.length],
        borderWidth: 2.5,
        tension: 0.4,
        fill: false,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: PALETTE.solid[i % PALETTE.solid.length],
        pointBorderColor: '#0f172a',
        pointBorderWidth: 2,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        data: years.map(year =>
            data.filter(r => String(r.tahun_lulus) === year && r.status_kerja === status).length
        )
    }));

    charts['line'] = new Chart(canvas, {
        type: 'line',
        data: { labels: years, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { padding: 12, font: { size: 11 } }
                },
                tooltip: {
                    ...TOOLTIP,
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: items => `Tahun Lulus ${items[0].label}`,
                        label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y} alumni`
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: TICK },
                y: {
                    grid: GRID,
                    ticks: { ...TICK, callback: v => v + ' org' },
                    beginAtZero: true,
                }
            }
        }
    });

    updateChartSubtitle('line-subtitle', 'line');
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

    // Gradient fill
    const ctx2d = canvas.getContext('2d');
    const grad = ctx2d.createLinearGradient(0, 0, 400, 0);
    grad.addColorStop(0, 'rgba(99, 102, 241, 0.85)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.65)');

    charts['hbar'] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: prodis,
            datasets: [{
                label: 'Rata-rata (Bulan)',
                data: avgs,
                backgroundColor: grad,
                borderColor: 'rgba(129, 140, 248, 0.5)',
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 40,
            }]
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
                    ...TOOLTIP,
                    callbacks: {
                        title: items => items[0].label,
                        label: ctx => `  Rata-rata: ${ctx.parsed.x} bulan`
                    }
                }
            },
            scales: {
                x: {
                    grid: GRID,
                    ticks: { ...TICK, callback: v => v + ' bln' },
                    beginAtZero: true,
                },
                y: { grid: { display: false }, ticks: TICK }
            }
        }
    });

    updateChartSubtitle('hbar-subtitle', 'hbar');
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
//  8. TABLE PREVIEW — Shows filtered data
// ═══════════════════════════════════════════════════════════

function updateTablePreview() {
    const tbody = document.getElementById('dashboard-table-body');
    if (!tbody) return;

    const data = dashState.getFilteredData().slice(0, 8);

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 40px; text-align: center; color: var(--text-tertiary);">Tidak ada data untuk filter ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td>${r.kode_responden_asli || '-'}</td>
            <td>${r.nama_prodi || '-'}</td>
            <td>${r.tahun_lulus || '-'}</td>
            <td><span class="badge badge-success">${r.status_kerja || '-'}</span></td>
            <td style="color: var(--success);">${r.range_pendapatan || '-'}</td>
            <td><span class="badge badge-info">${r.lama_tunggu_bulan || 0} Bulan</span></td>
        </tr>
    `).join('');
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

    // Update table preview
    updateTablePreview();
}


// ═══════════════════════════════════════════════════════════
//  10. INIT DASHBOARD — Entry point
// ═══════════════════════════════════════════════════════════

async function initDashboard() {
    try {
        const response = await fetch(`${API_URL}/dashboard_v2_api.php`);
        const result = await response.json();

        if (result.status !== 'success') {
            console.error('Dashboard API error:', result.message);
            const tbody = document.getElementById('dashboard-table-body');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--danger);">Gagal memuat data: ${result.message}</td></tr>`;
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

        // Reset button handler
        const resetBtn = document.getElementById('btn-reset-filters');
        if (resetBtn) {
            resetBtn.onclick = () => dashState.resetAll();
        }

    } catch (err) {
        console.error('Failed to initialize dashboard:', err);
        const tbody = document.getElementById('dashboard-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--danger);">Error koneksi ke server.</td></tr>`;
        }
    }
}
