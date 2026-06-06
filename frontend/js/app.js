// API Base URL
const API_URL = '/integrasi_data/backend';

// --- SweetAlert2 Dark Theme Helper ---
function swalDark(options) {
    return Swal.fire({
        background: '#0f1420',
        color: '#f1f5f9',
        confirmButtonColor: '#00e5ff',
        ...options
    });
}

// --- Authentication Logic ---
function checkAuth() {
    const userId = localStorage.getItem('user_id');
    const currentPage = window.location.pathname.split('/').pop();

    // Redirect to login if not authenticated and not on login page
    if (!userId && currentPage !== 'index.html' && currentPage !== '') {
        window.location.href = 'index.html';
        return;
    }

    // Auto-generate API Key for frontend usage if missing
    if (userId && !localStorage.getItem('api_key')) {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const token = 'dwa_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('api_key', token);
        
        const now = new Date().toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        localStorage.setItem('api_key_date', now);
    }
}

function logout() {
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
}

// Handle Login/Register Form Submit
async function handleAuth(e) {
    e.preventDefault();

    const mode = document.getElementById('authMode').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const btn = e.target.querySelector('.btn-submit');
    const originalBtnContent = btn.innerHTML;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/auth.php?action=${mode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.status === 'success') {
            if (mode === 'login') {
                localStorage.setItem('user_id', data.user.id);
                localStorage.setItem('username', data.user.username);
                window.location.href = 'dashboard.html';
            } else {
                swalDark({
                    icon: 'success',
                    title: 'Registrasi Berhasil!',
                    text: 'Silakan login dengan akun baru Anda.',
                    timer: 2500,
                    timerProgressBar: true
                }).then(() => {
                    switchTab('login');
                    document.getElementById('username').value = username;
                    document.getElementById('password').value = '';
                });
            }
        } else {
            swalDark({
                icon: 'error',
                title: mode === 'login' ? 'Login Gagal' : 'Registrasi Gagal',
                text: data.message || 'Terjadi kesalahan'
            });
        }
    } catch (error) {
        console.error(error);
        swalDark({
            icon: 'error',
            title: 'Koneksi Gagal',
            text: 'Gagal terhubung ke server. Periksa koneksi Anda.'
        });
    } finally {
        btn.innerHTML = originalBtnContent;
        btn.disabled = false;
    }
}
