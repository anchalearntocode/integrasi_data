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
                    <td style="padding: 12px;">${row.id_responden}</td>
                    <td style="padding: 12px;">${row.tahun_lulus}</td>
                    <td style="padding: 12px;">
                        <span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                            ${row.waktu_tunggu}
                        </span>
                    </td>
                    <td style="padding: 12px;">${row.kategori_perusahaan}</td>
                    <td style="padding: 12px; color: var(--success-color);">${row.pendapatan}</td>
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
