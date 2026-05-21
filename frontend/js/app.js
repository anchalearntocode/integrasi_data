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

// Dashboard chart logic has been moved to dashboard-engine.js


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
