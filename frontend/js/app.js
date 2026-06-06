const API_URL = "/data_warehouse/backend/alumni.php";

// ===== CHART DEFAULTS =====
if (typeof Chart !== "undefined") {
  Chart.defaults.color = "#94a9c4";
  Chart.defaults.borderColor = "rgba(99, 179, 237, 0.10)";
  Chart.defaults.font.family =
    "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif";
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.borderRadius = 4;
}

// ===== PALETTE =====
const CHART_COLORS = [
  "rgba(56, 189, 248, 0.75)",
  "rgba(52, 211, 153, 0.75)",
  "rgba(251, 191, 36, 0.75)",
  "rgba(248, 113, 113, 0.75)",
  "rgba(139, 92, 246, 0.75)",
  "rgba(249, 115, 22, 0.75)",
];

const CHART_COLORS_SOLID = [
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#8b5cf6",
  "#f97316",
];

// ===== PAGINATION STATE =====
let currentPage = 1;
let currentLimit = 100;
let currentPagination = null;
let currentRows = [];

// ===== HELPER API KEY =====
function getApiKey() {
  return localStorage.getItem("api_key");
}

function getAuthHeaders() {
  return {
    "X-API-KEY": getApiKey(),
  };
}

// ===== TOAST =====
function showToast(message) {
  let toast = document.getElementById("toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// ===== COPY API KEY =====
function copyApiKey() {
  const apiKey = getApiKey();

  if (!apiKey) {
    alert("API Key tidak ditemukan.");
    return;
  }

  navigator.clipboard
    .writeText(apiKey)
    .then(() => showToast("✅ API Key berhasil disalin."))
    .catch(() => showToast("❌ Gagal menyalin API Key."));
}

// ===== UNAUTHORIZED HANDLER =====
function handleUnauthorized(result) {
  if (
    result &&
    result.status === "error" &&
    (result.message?.toLowerCase().includes("api key") ||
      result.message?.toLowerCase().includes("login"))
  ) {
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    localStorage.removeItem("api_key");
    window.location.href = "index.html";
    return true;
  }

  return false;
}

// ===== AUTH CHECK =====
function checkAuth() {
  const userId = localStorage.getItem("user_id");
  const apiKey = localStorage.getItem("api_key");
  const currentPageName = window.location.pathname.split("/").pop();

  if (
    (!userId || !apiKey) &&
    currentPageName !== "index.html" &&
    currentPageName !== ""
  ) {
    window.location.href = "index.html";
  }
}

// ===== LOGOUT =====
async function logout() {
  const apiKey = localStorage.getItem("api_key");

  try {
    if (apiKey) {
      await fetch(`${API_URL}?resource=auth&action=logout`, {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
        },
      });
    }
  } catch (error) {
    console.error("Logout API error:", error);
  } finally {
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    localStorage.removeItem("api_key");
    window.location.href = "index.html";
  }
}

// ===== LOGIN =====
if (document.getElementById("form-login")) {
  document
    .getElementById("form-login")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("login-username").value;
      const password = document.getElementById("login-password").value;
      const alertEl = document.getElementById("login-alert");
      const btn = e.target.querySelector("button");

      btn.innerHTML = "<span>⏳</span> <span>Loading...</span>";
      btn.disabled = true;

      try {
        const response = await fetch(`${API_URL}?resource=auth&action=login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        const result = await response.json();

        if (result.status === "success") {
          localStorage.setItem("user_id", result.data.id);
          localStorage.setItem("username", result.data.username);
          localStorage.setItem("api_key", result.data.api_key);

          showToast("✅ Login berhasil! Mengalihkan...");

          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 600);
        } else {
          alertEl.style.display = "block";
          alertEl.className = "alert alert-error";
          alertEl.textContent = result.message;
        }
      } catch (error) {
        alertEl.style.display = "block";
        alertEl.className = "alert alert-error";
        alertEl.textContent = "Gagal terhubung ke server.";
      } finally {
        btn.innerHTML = "<span>Masuk</span> <span>→</span>";
        btn.disabled = false;
      }
    });
}

// ===== REGISTER =====
if (document.getElementById("form-register")) {
  document
    .getElementById("form-register")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("reg-username").value;
      const password = document.getElementById("reg-password").value;
      const alertEl = document.getElementById("register-alert");
      const btn = e.target.querySelector("button");

      btn.innerHTML = "<span>⏳</span> <span>Loading...</span>";
      btn.disabled = true;

      try {
        const response = await fetch(
          `${API_URL}?resource=auth&action=register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, password }),
          },
        );

        const result = await response.json();

        if (result.status === "success") {
          alertEl.style.display = "block";
          alertEl.className = "alert alert-success";
          alertEl.textContent = "Registrasi berhasil! Silakan login.";

          setTimeout(() => {
            toggleAuth("login");
            document.getElementById("login-username").value = username;
            alertEl.style.display = "none";
          }, 1500);
        } else {
          alertEl.style.display = "block";
          alertEl.className = "alert alert-error";
          alertEl.textContent = result.message;
        }
      } catch (error) {
        alertEl.style.display = "block";
        alertEl.className = "alert alert-error";
        alertEl.textContent = "Gagal terhubung ke server.";
      } finally {
        btn.innerHTML = "<span>Daftar</span> <span>→</span>";
        btn.disabled = false;
      }
    });
}

// ===== BADGE HELPER =====
function statusBadge(status) {
  const map = {
    Bekerja: "badge-green",
    Wiraswasta: "badge-amber",
    "Melanjutkan Pendidikan": "badge-blue",
    "Belum Bekerja": "badge-red",
  };

  const cls = map[status] || "badge-blue";

  return `<span class="badge ${cls}">${status ?? "-"}</span>`;
}

// ===== DASHBOARD ALUMNI PREVIEW =====
async function loadAlumniData() {
  const tableBody = document.getElementById("alumni-table-body");
  if (!tableBody) return;

  try {
    const response = await fetch(`${API_URL}?resource=alumni&page=1&limit=8`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    const result = await response.json();

    if (handleUnauthorized(result)) return;

    if (result.status !== "success") {
      tableBody.innerHTML = `<tr><td colspan="5" class="empty-row">${result.message || "Gagal memuat data."}</td></tr>`;
      return;
    }

    const data = result.data || [];

    if (data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="empty-row">Belum ada data alumni.</td></tr>`;
      return;
    }

    tableBody.innerHTML = "";

    data.forEach((row) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td><code style="color:var(--cyan-dim);font-size:.8rem">${row.kode_responden_asli ?? "-"}</code></td>
        <td>${row.tahun_lulus ?? "-"}</td>
        <td><span style="color:var(--amber)">${row.lama_tunggu_bulan ?? 0} bln</span></td>
        <td>${row.kategori_instansi ?? "-"}</td>
        <td><span class="badge badge-green">${row.range_pendapatan ?? "-"}</span></td>
      `;

      tableBody.appendChild(tr);
    });
  } catch (error) {
    console.error("Fetch alumni preview error:", error);
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-row">Error koneksi ke server.</td></tr>`;
  }
}

// ===== DASHBOARD CHARTS =====
async function loadDashboardCharts() {
  try {
    const response = await fetch(`${API_URL}?resource=dashboard`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    const result = await response.json();

    if (handleUnauthorized(result)) return;

    if (result.status !== "success") {
      console.error(result.message);
      return;
    }

    const data = result.data || {};

    const globalStat = document.getElementById("global-waktu-tunggu");

    if (globalStat && data.waktu_tunggu_global) {
      globalStat.textContent =
        data.waktu_tunggu_global.rata_rata_waktu_tunggu || "—";
    }

    const ctxWaktu = document.getElementById("chart-waktu-tunggu-prodi");

    if (ctxWaktu && data.waktu_tunggu_per_prodi) {
      new Chart(ctxWaktu, {
        type: "bar",
        data: {
          labels: data.waktu_tunggu_per_prodi.map((d) => d.program_studi),
          datasets: [
            {
              label: "Rata-rata Waktu Tunggu (Bulan)",
              data: data.waktu_tunggu_per_prodi.map(
                (d) => d.rata_rata_waktu_tunggu,
              ),
              backgroundColor: CHART_COLORS[0],
              borderColor: CHART_COLORS_SOLID[0],
              borderWidth: 1.5,
              borderRadius: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            x: {
              grid: {
                color: "rgba(99,179,237,0.07)",
              },
              ticks: {
                color: "#94a9c4",
              },
            },
            y: {
              grid: {
                color: "rgba(99,179,237,0.07)",
              },
              ticks: {
                color: "#94a9c4",
              },
            },
          },
        },
      });
    }

    const ctxAlumni = document.getElementById("chart-alumni-prodi");

    if (ctxAlumni && data.alumni_per_prodi) {
      new Chart(ctxAlumni, {
        type: "doughnut",
        data: {
          labels: data.alumni_per_prodi.map((d) => d.nama_prodi),
          datasets: [
            {
              data: data.alumni_per_prodi.map((d) => d.total_alumni),
              backgroundColor: CHART_COLORS,
              borderColor: "rgba(8,13,23,0.6)",
              borderWidth: 3,
              hoverOffset: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#94a9c4",
                padding: 16,
              },
            },
          },
          cutout: "62%",
        },
      });
    }

    const ctxStatus = document.getElementById("chart-status-kerja");

    if (ctxStatus && data.status_kerja_per_prodi) {
      const prodis = [
        ...new Set(data.status_kerja_per_prodi.map((d) => d.nama_prodi)),
      ];

      const statuses = [
        ...new Set(data.status_kerja_per_prodi.map((d) => d.status_kerja)),
      ];

      const datasets = statuses.map((status, i) => ({
        label: status,
        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
        borderRadius: 6,
        data: prodis.map((prodi) => {
          const match = data.status_kerja_per_prodi.find(
            (d) => d.nama_prodi === prodi && d.status_kerja === status,
          );

          return match ? parseInt(match.total) : 0;
        }),
      }));

      new Chart(ctxStatus, {
        type: "bar",
        data: {
          labels: prodis,
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
              grid: {
                display: false,
              },
              ticks: {
                color: "#94a9c4",
              },
            },
            y: {
              stacked: true,
              grid: {
                color: "rgba(99,179,237,0.07)",
              },
              ticks: {
                color: "#94a9c4",
              },
            },
          },
          plugins: {
            legend: {
              position: "top",
              labels: {
                color: "#94a9c4",
                padding: 16,
              },
            },
          },
        },
      });
    }

    const ctxSerapan = document.getElementById("chart-serapan-tahun");

    if (ctxSerapan && data.serapan_per_tahun) {
      const years = [
        ...new Set(data.serapan_per_tahun.map((d) => d.tahun_lulus)),
      ];

      const statuses = [
        ...new Set(data.serapan_per_tahun.map((d) => d.status_kerja)),
      ];

      const datasets = statuses.map((status, i) => ({
        label: status,
        borderColor: CHART_COLORS_SOLID[i % CHART_COLORS_SOLID.length],
        backgroundColor: CHART_COLORS[i % CHART_COLORS.length].replace(
          "0.75",
          "0.08",
        ),
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: CHART_COLORS_SOLID[i % CHART_COLORS_SOLID.length],
        data: years.map((year) => {
          const matches = data.serapan_per_tahun.filter(
            (d) => d.tahun_lulus == year && d.status_kerja === status,
          );

          return matches.reduce((sum, item) => sum + parseInt(item.total), 0);
        }),
      }));

      new Chart(ctxSerapan, {
        type: "line",
        data: {
          labels: years,
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          scales: {
            x: {
              grid: {
                color: "rgba(99,179,237,0.07)",
              },
              ticks: {
                color: "#94a9c4",
              },
            },
            y: {
              grid: {
                color: "rgba(99,179,237,0.07)",
              },
              ticks: {
                color: "#94a9c4",
              },
            },
          },
          plugins: {
            legend: {
              position: "top",
              labels: {
                color: "#94a9c4",
                padding: 16,
              },
            },
          },
        },
      });
    }
  } catch (error) {
    console.error("Fetch dashboard charts error:", error);
  }
}

// ===== SERAPAN SUMMARY =====
async function loadSerapanSummary() {
  const ids = [
    "total-alumni",
    "jumlah-bekerja",
    "jumlah-belum-bekerja",
    "persentase-serapan",
  ];

  if (!ids.some((id) => document.getElementById(id))) return;

  try {
    const response = await fetch(`${API_URL}?resource=serapan&action=summary`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    const result = await response.json();

    if (handleUnauthorized(result)) return;

    if (result.status !== "success") {
      console.error(result.message);
      return;
    }

    const data = result.data || {};

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) animateCount(el, parseInt(val) || 0);
    };

    set("total-alumni", data.total_alumni ?? 0);
    set("jumlah-bekerja", data.jumlah_bekerja ?? 0);
    set("jumlah-belum-bekerja", data.jumlah_belum_bekerja ?? 0);

    const pctEl = document.getElementById("persentase-serapan");

    if (pctEl) {
      let current = 0;
      const target = parseFloat(data.persentase_serapan ?? 0);
      const step = target / 40;

      const interval = setInterval(() => {
        current = Math.min(current + step, target);
        pctEl.textContent = current.toFixed(1) + "%";

        if (current >= target) clearInterval(interval);
      }, 30);
    }
  } catch (error) {
    console.error("Fetch serapan summary error:", error);
  }
}

// ===== ANIMATED COUNT =====
function animateCount(el, target) {
  let current = 0;
  const step = Math.max(1, Math.floor(target / 40));

  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;

    if (current >= target) clearInterval(interval);
  }, 30);
}

// ===== LOAD FILTER DIMENSI =====
async function loadDataFilters() {
  const prodiFilter = document.getElementById("filter-prodi");
  const statusFilter = document.getElementById("filter-status");

  if (!prodiFilter && !statusFilter) return;

  try {
    if (prodiFilter) {
      const responseProdi = await fetch(
        `${API_URL}?resource=dimensi&name=prodi`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );

      const resultProdi = await responseProdi.json();

      if (handleUnauthorized(resultProdi)) return;

      if (resultProdi.status === "success") {
        prodiFilter.innerHTML = `<option value="all">Semua Program Studi</option>`;

        (resultProdi.data || []).forEach((row) => {
          const opt = document.createElement("option");
          opt.value = row.nama_prodi;
          opt.textContent = row.nama_prodi;
          prodiFilter.appendChild(opt);
        });
      }

      prodiFilter.onchange = () => {
        currentPage = 1;
        loadFullAlumniData(1);
      };
    }

    if (statusFilter) {
      const responseStatus = await fetch(
        `${API_URL}?resource=dimensi&name=status`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );

      const resultStatus = await responseStatus.json();

      if (handleUnauthorized(resultStatus)) return;

      if (resultStatus.status === "success") {
        statusFilter.innerHTML = `<option value="all">Semua Status Pekerjaan</option>`;

        (resultStatus.data || []).forEach((row) => {
          const opt = document.createElement("option");
          opt.value = row.status_kerja;
          opt.textContent = row.status_kerja;
          statusFilter.appendChild(opt);
        });
      }

      statusFilter.onchange = () => {
        currentPage = 1;
        loadFullAlumniData(1);
      };
    }
  } catch (error) {
    console.error("Load filter dimensi error:", error);
  }
}

// ===== FULL DATA TABLE WITH API PAGINATION =====
async function loadFullAlumniData(page = 1) {
  const tableBody = document.getElementById("full-alumni-table-body");
  if (!tableBody) return;

  currentPage = page;

  const prodiVal = document.getElementById("filter-prodi")?.value || "all";
  const statusVal = document.getElementById("filter-status")?.value || "all";

  const params = new URLSearchParams();
  params.set("resource", "alumni");
  params.set("page", currentPage);
  params.set("limit", currentLimit);

  if (prodiVal !== "all") {
    params.set("prodi", prodiVal);
  }

  if (statusVal !== "all") {
    params.set("status", statusVal);
  }

  tableBody.innerHTML = `<tr><td colspan="7" class="empty-row">⏳ Memuat data...</td></tr>`;

  try {
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    const result = await response.json();

    if (handleUnauthorized(result)) return;

    if (result.status !== "success") {
      tableBody.innerHTML = `<tr><td colspan="7" class="empty-row">${result.message || "Gagal memuat data."}</td></tr>`;
      return;
    }

    currentRows = result.data || [];
    currentPagination = result.pagination || null;

    renderFullTable();
    renderPagination();
  } catch (error) {
    console.error("Fetch full alumni error:", error);
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-row">Error koneksi ke server.</td></tr>`;
  }
}

function renderFullTable() {
  const tableBody = document.getElementById("full-alumni-table-body");
  if (!tableBody) return;

  const rows = currentRows || [];
  const pagination = currentPagination;

  const countEl = document.getElementById("row-count-display");

  if (countEl && pagination) {
    countEl.innerHTML = `
      Menampilkan <span>${rows.length}</span> data pada halaman 
      <span>${pagination.page}</span> dari <span>${pagination.total_pages}</span> halaman 
      | Total <span>${pagination.total_data}</span> data
    `;
  }

  if (rows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-row">🔍 Tidak ada data yang cocok.</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";

  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");

    tr.style.animationDelay = `${idx * 20}ms`;

    tr.innerHTML = `
      <td><code style="color:var(--cyan-dim);font-size:.78rem">${row.kode_responden_asli ?? "-"}</code></td>
      <td>${row.nama_prodi ?? "-"}</td>
      <td>${row.tahun_lulus ?? "-"}</td>
      <td>${statusBadge(row.status_kerja)}</td>
      <td style="color:var(--text-2)">${row.kategori_instansi ?? "-"}</td>
      <td><span style="color:var(--green);font-weight:600">${row.range_pendapatan ?? "-"}</span></td>
      <td><span style="color:var(--amber)">${row.lama_tunggu_bulan ?? 0} bln</span></td>
    `;

    tableBody.appendChild(tr);
  });
}

function renderPagination() {
  const wrapper = document.getElementById("pagination-wrapper");
  if (!wrapper || !currentPagination) return;

  const page = parseInt(currentPagination.page);
  const totalPages = parseInt(currentPagination.total_pages);
  const hasPrevious = currentPagination.has_previous;
  const hasNext = currentPagination.has_next;

  wrapper.innerHTML = `
    <div class="pagination-box" style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:18px;flex-wrap:wrap;">
      <button 
        type="button"
        class="pagination-btn"
        ${!hasPrevious ? "disabled" : ""}
        onclick="goToAlumniPage(${page - 1})"
        style="padding:9px 14px;border-radius:8px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);cursor:pointer;"
      >
        Previous
      </button>

      <span style="color:var(--text-secondary);font-size:14px;">
        Page <b style="color:var(--primary-color);">${page}</b> of <b style="color:var(--primary-color);">${totalPages}</b>
      </span>

      <button 
        type="button"
        class="pagination-btn"
        ${!hasNext ? "disabled" : ""}
        onclick="goToAlumniPage(${page + 1})"
        style="padding:9px 14px;border-radius:8px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);cursor:pointer;"
      >
        Next
      </button>
    </div>
  `;
}

function goToAlumniPage(page) {
  if (!currentPagination) return;

  const totalPages = parseInt(currentPagination.total_pages);

  if (page < 1 || page > totalPages) return;

  loadFullAlumniData(page);
}

// ===== INIT DATA PAGE =====
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("full-alumni-table-body")) {
    loadDataFilters();
    loadFullAlumniData(1);
  }
});
