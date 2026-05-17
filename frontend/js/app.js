// API Base URL
const API_URL = '/data_warehouse/backend';

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
                tableBody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-secondary);">Belum ada data alumni. Silakan input data.</td></tr>`;
                return;
            }
            
            tableBody.innerHTML = '';
            
            // Limit to 5 latest records for preview
            const previewData = data.slice(0, 5);
            
            previewData.forEach(row => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-color)';
                
                tr.innerHTML = `
                    <td style="padding: 12px;">${row.kode_responden_asli}</td>
                    <td style="padding: 12px;">${row.tahun_lulus}</td>
                    <td style="padding: 12px;">
                        <span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                            ${row.lama_tunggu_bulan} Bulan
                        </span>
                    </td>
                    <td style="padding: 12px;">${row.kategori_instansi}</td>
                    <td style="padding: 12px; color: var(--success-color);">${row.range_pendapatan}</td>
                `;
                tableBody.appendChild(tr);
            });
            
            // Note: Chart logic would go here, processing the `data` array 
            // and using a library like Chart.js to render into the placeholder elements.
            
        } else {
            tableBody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--danger-color);">Gagal memuat data.</td></tr>`;
        }
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--danger-color);">Error koneksi ke server.</td></tr>`;
    }
}

async function loadDashboardCharts() {
    try {
        const response = await fetch(`${API_URL}/dashboard_api.php`);
        const result = await response.json();
        
        if (result.status === 'success') {
            const data = result.data;
            
            // 1. Global Stat
            const globalStat = document.getElementById('global-waktu-tunggu');
            if (globalStat && data.waktu_tunggu_global) {
                globalStat.textContent = data.waktu_tunggu_global.rata_rata_waktu_tunggu || 0;
            }

            // Chart Colors
            const colors = [
                'rgba(59, 130, 246, 0.7)',
                'rgba(16, 185, 129, 0.7)',
                'rgba(245, 158, 11, 0.7)',
                'rgba(239, 68, 68, 0.7)',
                'rgba(139, 92, 246, 0.7)'
            ];

            // 2. Waktu Tunggu per Prodi (Bar Chart)
            const ctxWaktuTunggu = document.getElementById('chart-waktu-tunggu-prodi');
            if (ctxWaktuTunggu && data.waktu_tunggu_per_prodi) {
                new Chart(ctxWaktuTunggu, {
                    type: 'bar',
                    data: {
                        labels: data.waktu_tunggu_per_prodi.map(d => d.program_studi),
                        datasets: [{
                            label: 'Rata-rata Waktu Tunggu (Bulan)',
                            data: data.waktu_tunggu_per_prodi.map(d => d.rata_rata_waktu_tunggu),
                            backgroundColor: colors[0],
                            borderWidth: 1
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }

            // 3. Jumlah Alumni per Prodi (Doughnut Chart)
            const ctxAlumniProdi = document.getElementById('chart-alumni-prodi');
            if (ctxAlumniProdi && data.alumni_per_prodi) {
                new Chart(ctxAlumniProdi, {
                    type: 'doughnut',
                    data: {
                        labels: data.alumni_per_prodi.map(d => d.nama_prodi),
                        datasets: [{
                            data: data.alumni_per_prodi.map(d => d.total_alumni),
                            backgroundColor: colors,
                            borderWidth: 1
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }

            // 4. Status Kerja per Prodi (Stacked Bar)
            const ctxStatusKerja = document.getElementById('chart-status-kerja');
            if (ctxStatusKerja && data.status_kerja_per_prodi) {
                // Process data for stacked bar
                const prodis = [...new Set(data.status_kerja_per_prodi.map(d => d.nama_prodi))];
                const statuses = [...new Set(data.status_kerja_per_prodi.map(d => d.status_kerja))];
                
                const datasets = statuses.map((status, i) => {
                    return {
                        label: status,
                        backgroundColor: colors[i % colors.length],
                        data: prodis.map(prodi => {
                            const match = data.status_kerja_per_prodi.find(d => d.nama_prodi === prodi && d.status_kerja === status);
                            return match ? match.total : 0;
                        })
                    };
                });

                new Chart(ctxStatusKerja, {
                    type: 'bar',
                    data: { labels: prodis, datasets: datasets },
                    options: { 
                        responsive: true, 
                        maintainAspectRatio: false,
                        scales: { x: { stacked: true }, y: { stacked: true } }
                    }
                });
            }

            // 5. Serapan per Tahun Lulus (Line or Grouped Bar)
            const ctxSerapanTahun = document.getElementById('chart-serapan-tahun');
            if (ctxSerapanTahun && data.serapan_per_tahun) {
                const years = [...new Set(data.serapan_per_tahun.map(d => d.tahun_lulus))];
                const statuses = [...new Set(data.serapan_per_tahun.map(d => d.status_kerja))];
                
                const datasets = statuses.map((status, i) => {
                    return {
                        label: status,
                        borderColor: colors[i % colors.length],
                        backgroundColor: colors[i % colors.length].replace('0.7', '0.1'),
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        data: years.map(year => {
                            // Sum totals for this year and status across all prodis
                            const matches = data.serapan_per_tahun.filter(d => d.tahun_lulus == year && d.status_kerja === status);
                            return matches.reduce((sum, match) => sum + parseInt(match.total), 0);
                        })
                    };
                });

                new Chart(ctxSerapanTahun, {
                    type: 'line',
                    data: { labels: years, datasets: datasets },
                    options: { responsive: true, maintainAspectRatio: false }
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
                tableBody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-secondary);">Belum ada data.</td></tr>`;
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
            tableBody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--danger-color);">Gagal memuat data.</td></tr>`;
        }
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--danger-color);">Error koneksi ke server.</td></tr>`;
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
        tableBody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-secondary);">Tidak ada data yang cocok dengan filter.</td></tr>`;
        return;
    }
    
    filtered.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        
        tr.innerHTML = `
            <td style="padding: 12px;">${row.kode_responden_asli}</td>
            <td style="padding: 12px;">${row.nama_prodi}</td>
            <td style="padding: 12px;">${row.tahun_lulus}</td>
            <td style="padding: 12px;">
                <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    ${row.status_kerja}
                </span>
            </td>
            <td style="padding: 12px;">${row.kategori_instansi}</td>
            <td style="padding: 12px; color: var(--success-color);">${row.range_pendapatan}</td>
            <td style="padding: 12px;">${row.lama_tunggu_bulan} Bulan</td>
        `;
        tableBody.appendChild(tr);
    });
}
