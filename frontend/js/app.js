// API Base URL
const API_URL = '/integrasi_data/backend';

// --- Authentication Logic ---
function checkAuth() {
    const userId = localStorage.getItem('user_id');
    const currentPage = window.location.pathname.split('/').pop();

    // Redirect to login if not authenticated and not on login page
    if (!userId && currentPage !== 'index.html' && currentPage !== '') {
        window.location.href = 'index.html';
    }
}

function logout() {
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
}

// Handle Login Form Submit
if (document.getElementById('form-login')) {
    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const alertEl = document.getElementById('login-alert');
        const btn = e.target.querySelector('button');

        btn.textContent = 'Loading...';
        btn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/auth.php?action=login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.status === 'success') {
                localStorage.setItem('user_id', data.user.id);
                localStorage.setItem('username', data.user.username);
                window.location.href = 'dashboard.html';
            } else {
                alertEl.style.display = 'block';
                alertEl.textContent = data.message;
            }
        } catch (error) {
            alertEl.style.display = 'block';
            alertEl.textContent = 'Gagal terhubung ke server.';
        } finally {
            btn.textContent = 'Sign In';
            btn.disabled = false;
        }
    });
}

// Handle Register Form Submit
if (document.getElementById('form-register')) {
    document.getElementById('form-register').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;
        const alertEl = document.getElementById('register-alert');
        const btn = e.target.querySelector('button');

        btn.textContent = 'Loading...';
        btn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/auth.php?action=register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.status === 'success') {
                alertEl.style.display = 'block';
                alertEl.className = 'alert alert-success';
                alertEl.textContent = 'Registrasi berhasil! Silakan login.';

                // Switch to login form after 2 seconds
                setTimeout(() => {
                    toggleAuth('login');
                    document.getElementById('login-username').value = username;
                    alertEl.style.display = 'none';
                    alertEl.className = 'alert alert-error';
                }, 2000);
            } else {
                alertEl.style.display = 'block';
                alertEl.className = 'alert alert-error';
                alertEl.textContent = data.message;
            }
        } catch (error) {
            alertEl.style.display = 'block';
            alertEl.textContent = 'Gagal terhubung ke server.';
        } finally {
            btn.textContent = 'Sign Up';
            btn.disabled = false;
        }
    });
}

// --- Dashboard Logic ---
async function loadAlumniData() {
    const tableBody = document.getElementById('alumni-table-body');
    if (!tableBody) return;

    try {
        const response = await fetch(`${API_URL}/alumni.php`);
        const result = await response.json();

        if (result.status === 'success') {
            const data = result.data;

            if (data.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: var(--text-tertiary);">Belum ada data alumni. Silakan input data.</td></tr>`;
                return;
            }

            tableBody.innerHTML = '';

            // Limit to 5 latest records for preview
            const previewData = data.slice(0, 5);

            previewData.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.kode_responden_asli}</td>
                    <td>${row.tahun_lulus}</td>
                    <td><span class="badge badge-info">${row.lama_tunggu_bulan} Bulan</span></td>
                    <td>${row.kategori_instansi}</td>
                    <td style="color: var(--success);">${row.range_pendapatan}</td>
                `;
                tableBody.appendChild(tr);
            });

        } else {
            tableBody.innerHTML = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: var(--danger);">Gagal memuat data.</td></tr>`;
        }
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: var(--danger);">Error koneksi ke server.</td></tr>`;
    }
}

async function loadDashboardCharts() {
    try {
        const response = await fetch(`${API_URL}/dashboard_api.php`);
        const result = await response.json();

        if (result.status === 'success') {
            const data = result.data;

            // ── Global Chart.js Defaults (Dark Theme) ──
            Chart.defaults.color = '#94a3b8';
            Chart.defaults.font.family = "'Inter', sans-serif";
            Chart.defaults.font.size = 12;
            Chart.defaults.plugins.legend.labels.usePointStyle = true;
            Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
            Chart.defaults.plugins.legend.labels.padding = 16;
            Chart.defaults.animation.duration = 800;
            Chart.defaults.animation.easing = 'easeOutQuart';

            // ── Custom Tooltip Style ──
            const tooltipConfig = {
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

            // ── Curated Color Palette ──
            const palette = {
                solid: [
                    '#818cf8', // Indigo
                    '#34d399', // Emerald
                    '#fbbf24', // Amber
                    '#f87171', // Rose
                    '#a78bfa', // Violet
                    '#22d3ee', // Cyan
                    '#fb923c', // Orange
                    '#e879f9', // Fuchsia
                ],
                translucent: [
                    'rgba(129, 140, 248, 0.75)',
                    'rgba(52, 211, 153, 0.75)',
                    'rgba(251, 191, 36, 0.75)',
                    'rgba(248, 113, 113, 0.75)',
                    'rgba(167, 139, 250, 0.75)',
                    'rgba(34, 211, 238, 0.75)',
                    'rgba(251, 146, 60, 0.75)',
                    'rgba(232, 121, 249, 0.75)',
                ],
                glow: [
                    'rgba(129, 140, 248, 0.15)',
                    'rgba(52, 211, 153, 0.15)',
                    'rgba(251, 191, 36, 0.15)',
                    'rgba(248, 113, 113, 0.15)',
                    'rgba(167, 139, 250, 0.15)',
                    'rgba(34, 211, 238, 0.15)',
                    'rgba(251, 146, 60, 0.15)',
                    'rgba(232, 121, 249, 0.15)',
                ]
            };

            // ── Shared Axis & Grid Config ──
            const gridStyle = {
                color: 'rgba(255, 255, 255, 0.05)',
                drawBorder: false,
            };
            const tickStyle = {
                color: '#64748b',
                font: { size: 11 },
                padding: 8,
            };

            // ── 1. Animated Global Stat ──
            const globalStat = document.getElementById('global-waktu-tunggu');
            if (globalStat && data.waktu_tunggu_global) {
                const target = parseFloat(data.waktu_tunggu_global.rata_rata_waktu_tunggu) || 0;
                let current = 0;
                const step = target / 40;
                const counter = setInterval(() => {
                    current += step;
                    if (current >= target) {
                        current = target;
                        clearInterval(counter);
                    }
                    globalStat.textContent = current % 1 === 0 ? Math.round(current) : current.toFixed(1);
                }, 25);
            }

            // ── 2. Waktu Tunggu per Prodi (Gradient Bar Chart) ──
            const ctxWaktuTunggu = document.getElementById('chart-waktu-tunggu-prodi');
            if (ctxWaktuTunggu && data.waktu_tunggu_per_prodi) {
                const ctx2d = ctxWaktuTunggu.getContext('2d');
                const grad = ctx2d.createLinearGradient(0, 0, 0, 300);
                grad.addColorStop(0, 'rgba(99, 102, 241, 0.9)');
                grad.addColorStop(1, 'rgba(99, 102, 241, 0.2)');

                new Chart(ctxWaktuTunggu, {
                    type: 'bar',
                    data: {
                        labels: data.waktu_tunggu_per_prodi.map(d => d.program_studi),
                        datasets: [{
                            label: 'Rata-rata Waktu Tunggu (Bulan)',
                            data: data.waktu_tunggu_per_prodi.map(d => d.rata_rata_waktu_tunggu),
                            backgroundColor: grad,
                            borderColor: 'rgba(129, 140, 248, 0.6)',
                            borderWidth: 1,
                            borderRadius: 8,
                            borderSkipped: false,
                            maxBarThickness: 56,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                ...tooltipConfig,
                                callbacks: {
                                    label: ctx => `  ${ctx.parsed.y} Bulan`
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: tickStyle,
                            },
                            y: {
                                grid: gridStyle,
                                ticks: { ...tickStyle, callback: v => v + ' bln' },
                                beginAtZero: true,
                            }
                        }
                    }
                });
            }

            // ── 3. Alumni per Prodi (Doughnut with center label) ──
            const ctxAlumniProdi = document.getElementById('chart-alumni-prodi');
            if (ctxAlumniProdi && data.alumni_per_prodi) {
                const totalAlumni = data.alumni_per_prodi.reduce((s, d) => s + parseInt(d.total_alumni), 0);

                // Center text plugin
                const centerTextPlugin = {
                    id: 'centerText',
                    afterDraw(chart) {
                        const { ctx, chartArea: { width, height, top } } = chart;
                        ctx.save();
                        ctx.fillStyle = '#f1f5f9';
                        ctx.font = "700 28px 'Inter', sans-serif";
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(totalAlumni, width / 2 + chart.chartArea.left - (chart.chartArea.left / 2), top + height / 2 - 10);
                        ctx.fillStyle = '#64748b';
                        ctx.font = "500 12px 'Inter', sans-serif";
                        ctx.fillText('Total Alumni', width / 2 + chart.chartArea.left - (chart.chartArea.left / 2), top + height / 2 + 16);
                        ctx.restore();
                    }
                };

                new Chart(ctxAlumniProdi, {
                    type: 'doughnut',
                    data: {
                        labels: data.alumni_per_prodi.map(d => d.nama_prodi),
                        datasets: [{
                            data: data.alumni_per_prodi.map(d => d.total_alumni),
                            backgroundColor: palette.translucent,
                            borderColor: palette.solid,
                            borderWidth: 2,
                            hoverBorderWidth: 3,
                            hoverOffset: 8,
                            spacing: 3,
                        }]
                    },
                    plugins: [centerTextPlugin],
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '68%',
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { padding: 20 }
                            },
                            tooltip: {
                                ...tooltipConfig,
                                callbacks: {
                                    label: ctx => {
                                        const pct = ((ctx.parsed / totalAlumni) * 100).toFixed(1);
                                        return `  ${ctx.label}: ${ctx.parsed} alumni (${pct}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // ── 4. Status Kerja per Prodi (Grouped Bar — easier to compare) ──
            const ctxStatusKerja = document.getElementById('chart-status-kerja');
            if (ctxStatusKerja && data.status_kerja_per_prodi) {
                const prodis = [...new Set(data.status_kerja_per_prodi.map(d => d.nama_prodi))];
                const statuses = [...new Set(data.status_kerja_per_prodi.map(d => d.status_kerja))];

                const datasets = statuses.map((status, i) => ({
                    label: status,
                    backgroundColor: palette.translucent[i % palette.translucent.length],
                    borderColor: palette.solid[i % palette.solid.length],
                    borderWidth: 1.5,
                    borderRadius: 6,
                    borderSkipped: false,
                    data: prodis.map(prodi => {
                        const match = data.status_kerja_per_prodi.find(d => d.nama_prodi === prodi && d.status_kerja === status);
                        return match ? match.total : 0;
                    })
                }));

                new Chart(ctxStatusKerja, {
                    type: 'bar',
                    data: { labels: prodis, datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: { padding: 16 }
                            },
                            tooltip: {
                                ...tooltipConfig,
                                callbacks: {
                                    label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y} alumni`
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: tickStyle,
                            },
                            y: {
                                grid: gridStyle,
                                ticks: { ...tickStyle, callback: v => v + ' org' },
                                beginAtZero: true,
                            }
                        }
                    }
                });
            }

            // ── 5. Tren Serapan Kerja (Smooth Line, no heavy fill) ──
            const ctxSerapanTahun = document.getElementById('chart-serapan-tahun');
            if (ctxSerapanTahun && data.serapan_per_tahun) {
                const years = [...new Set(data.serapan_per_tahun.map(d => d.tahun_lulus))].sort();
                const statuses = [...new Set(data.serapan_per_tahun.map(d => d.status_kerja))];

                const datasets = statuses.map((status, i) => ({
                    label: status,
                    borderColor: palette.solid[i % palette.solid.length],
                    backgroundColor: palette.glow[i % palette.glow.length],
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: false,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: palette.solid[i % palette.solid.length],
                    pointBorderColor: '#0f172a',
                    pointBorderWidth: 2,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                    data: years.map(year => {
                        const matches = data.serapan_per_tahun.filter(d => d.tahun_lulus == year && d.status_kerja === status);
                        return matches.reduce((sum, match) => sum + parseInt(match.total), 0);
                    })
                }));

                new Chart(ctxSerapanTahun, {
                    type: 'line',
                    data: { labels: years, datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: { padding: 16 }
                            },
                            tooltip: {
                                ...tooltipConfig,
                                mode: 'index',
                                intersect: false,
                                callbacks: {
                                    title: items => `Tahun Lulus ${items[0].label}`,
                                    label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y} alumni`
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false },
                                ticks: tickStyle,
                            },
                            y: {
                                grid: gridStyle,
                                ticks: { ...tickStyle, callback: v => v + ' org' },
                                beginAtZero: true,
                            }
                        }
                    }
                });
            }

        } else {
            console.error('Error load dashboard:', result.message);
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

// --- Full Data Table Logic ---
let allAlumniData = [];

async function loadFullAlumniData() {
    const tableBody = document.getElementById('full-alumni-table-body');
    if (!tableBody) return;

    try {
        const response = await fetch(`${API_URL}/alumni.php`);
        const result = await response.json();

        if (result.status === 'success') {
            allAlumniData = result.data;

            if (allAlumniData.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="7" style="padding: 40px; text-align: center; color: var(--text-tertiary);">Belum ada data.</td></tr>`;
                return;
            }

            // Populate Filters
            const prodiFilter = document.getElementById('filter-prodi');
            const statusFilter = document.getElementById('filter-status');

            const prodis = [...new Set(allAlumniData.map(d => d.nama_prodi))];
            const statuses = [...new Set(allAlumniData.map(d => d.status_kerja))];

            prodis.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                prodiFilter.appendChild(opt);
            });

            statuses.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                statusFilter.appendChild(opt);
            });

            // Render Table
            renderFullTable();

            // Event Listeners
            prodiFilter.addEventListener('change', renderFullTable);
            statusFilter.addEventListener('change', renderFullTable);

        } else {
            tableBody.innerHTML = `<tr><td colspan="7" style="padding: 40px; text-align: center; color: var(--danger);">Gagal memuat data.</td></tr>`;
        }
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="7" style="padding: 40px; text-align: center; color: var(--danger);">Error koneksi ke server.</td></tr>`;
    }
}

function renderFullTable() {
    const tableBody = document.getElementById('full-alumni-table-body');
    const prodiVal = document.getElementById('filter-prodi').value;
    const statusVal = document.getElementById('filter-status').value;

    tableBody.innerHTML = '';

    const filtered = allAlumniData.filter(row => {
        const matchProdi = prodiVal === 'all' || row.nama_prodi === prodiVal;
        const matchStatus = statusVal === 'all' || row.status_kerja === statusVal;
        return matchProdi && matchStatus;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="padding: 40px; text-align: center; color: var(--text-tertiary);">Tidak ada data yang cocok dengan filter.</td></tr>`;
        return;
    }

    filtered.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.kode_responden_asli}</td>
            <td>${row.nama_prodi}</td>
            <td>${row.tahun_lulus}</td>
            <td><span class="badge badge-success">${row.status_kerja}</span></td>
            <td>${row.kategori_instansi}</td>
            <td style="color: var(--success);">${row.range_pendapatan}</td>
            <td><span class="badge badge-info">${row.lama_tunggu_bulan} Bulan</span></td>
        `;
        tableBody.appendChild(tr);
    });
}
