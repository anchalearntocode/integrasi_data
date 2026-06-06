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

let currentPage = 1;
let currentLimit = 100;
let currentPagination = null;
let currentRows = [];

// ===== HELPER =====
function getApiKey() {
  return localStorage.getItem("api_key");
}

function getAuthHeaders() {
  return {
    "X-API-KEY": getApiKey(),
  };
}

function getJsonHeaders() {
  return {
    "Content-Type": "application/json",
    "X-API-KEY": getApiKey(),
  };
}

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

function showAlert(elementId, type, message) {
  const alertEl = document.getElementById(elementId);
  if (!alertEl) return;

  alertEl.style.display = "block";
  alertEl.className = `alert alert-${type}`;
  alertEl.innerHTML = message;

  setTimeout(() => {
    alertEl.style.display = "none";
  }, 5000);
}

function setButtonLoading(button, loadingText, loading) {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = loadingText;
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.originalText || button.innerHTML;
    button.disabled = false;
  }
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  const finalValue = value ?? "";

  if (el.tagName === "SELECT") {
    const exists = Array.from(el.options).some(
      (option) => option.value === String(finalValue),
    );

    if (!exists && finalValue !== "") {
      const option = document.createElement("option");
      option.value = finalValue;
      option.textContent = finalValue;
      el.appendChild(option);
    }
  }

  el.value = finalValue;
}

function updateApiKeyView() {
  const apiKey = getApiKey();

  const apiKeyInput = document.getElementById("api-key");
  const apiKeyText = document.getElementById("api-key-text");
  const apiKeyValue = document.getElementById("api-key-value");

  if (apiKeyInput) apiKeyInput.value = apiKey || "";
  if (apiKeyText) apiKeyText.textContent = apiKey || "-";
  if (apiKeyValue) apiKeyValue.textContent = apiKey || "-";
}

// ===== AUTH =====
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

async function logout() {
  const apiKey = localStorage.getItem("api_key");

  try {
    if (apiKey) {
      await fetch(`${API_URL}?resource=auth&action=logout`, {
        method: "POST",
        headers: { "X-API-KEY": apiKey },
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

function copyApiKey() {
  const apiKey = getApiKey();

  if (!apiKey) {
    showToast("❌ API Key tidak ditemukan.");
    return;
  }

  navigator.clipboard
    .writeText(apiKey)
    .then(() => showToast("✅ API Key berhasil disalin."))
    .catch(() => showToast("❌ Gagal menyalin API Key."));
}

async function regenerateApiKey() {
  const apiKey = getApiKey();
  const button =
    document.getElementById("btn-regenerate-key") ||
    document.getElementById("regenerate-api-key") ||
    document.querySelector("[data-action='regenerate-api-key']");

  if (!apiKey) {
    showToast("❌ API Key tidak ditemukan. Login ulang.");
    return;
  }

  const confirmation = confirm(
    "Yakin ingin mengganti API Key? API Key lama akan langsung tidak berlaku.",
  );

  if (!confirmation) return;

  try {
    setButtonLoading(
      button,
      "<span>⏳</span><span>Mengganti Key...</span>",
      true,
    );

    const response = await fetch(
      `${API_URL}?resource=auth&action=regenerate_key`,
      {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
        },
      },
    );

    const result = await response.json();

    console.log("RESPONSE REGENERATE API KEY:", result);

    if (handleUnauthorized(result)) return;

    if (result.status === "success") {
      const newApiKey = result.data?.api_key;

      if (!newApiKey) {
        showToast("❌ Key baru tidak ditemukan dari response server.");
        return;
      }

      localStorage.setItem("api_key", newApiKey);
      updateApiKeyView();

      showToast("✅ API Key berhasil diganti. Key lama sudah hangus.");

      const alertBox =
        document.getElementById("api-key-alert") ||
        document.getElementById("profile-alert") ||
        document.getElementById("settings-alert");

      if (alertBox) {
        alertBox.style.display = "block";
        alertBox.className = "alert alert-success";
        alertBox.innerHTML =
          "API Key berhasil diganti. API Key lama sudah tidak berlaku.";
      }
    } else {
      showToast(result.message || "❌ Gagal mengganti API Key.");
    }
  } catch (error) {
    console.error("Regenerate API Key error:", error);
    showToast("❌ Gagal terhubung ke server saat mengganti API Key.");
  } finally {
    setButtonLoading(button, "", false);
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
          headers: { "Content-Type": "application/json" },
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          },
        );

        const result = await response.json();

        if (result.status === "success") {
          alertEl.style.display = "block";
          alertEl.className = "alert alert-success";
          alertEl.textContent = "Registrasi berhasil! Silakan login.";

          setTimeout(() => {
            if (typeof toggleAuth === "function") {
              toggleAuth("login");
            }

            const loginUsername = document.getElementById("login-username");
            if (loginUsername) loginUsername.value = username;

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

// ===== BADGE =====
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

// ===== DASHBOARD PREVIEW =====
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
    if (result.status !== "success") return;

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
          plugins: { legend: { display: false } },
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
        data: { labels: prodis, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true },
            y: { stacked: true },
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
        data: { labels: years, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
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
    if (result.status !== "success") return;

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
      pctEl.textContent = `${parseFloat(data.persentase_serapan ?? 0).toFixed(1)}%`;
    }
  } catch (error) {
    console.error("Fetch serapan summary error:", error);
  }
}

function animateCount(el, target) {
  let current = 0;
  const step = Math.max(1, Math.floor(target / 40));

  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;

    if (current >= target) clearInterval(interval);
  }, 30);
}

// ===== FILTER DATA =====
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

// ===== FULL TABLE =====
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

  if (prodiVal !== "all") params.set("prodi", prodiVal);
  if (statusVal !== "all") params.set("status", statusVal);

  tableBody.innerHTML = `<tr><td colspan="8" class="empty-row">⏳ Memuat data...</td></tr>`;

  try {
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    const result = await response.json();

    if (handleUnauthorized(result)) return;

    if (result.status !== "success") {
      tableBody.innerHTML = `<tr><td colspan="8" class="empty-row">${result.message || "Gagal memuat data."}</td></tr>`;
      return;
    }

    currentRows = result.data || [];
    currentPagination = result.pagination || null;

    renderFullTable();
    renderPagination();
  } catch (error) {
    console.error("Fetch full alumni error:", error);
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-row">Error koneksi ke server.</td></tr>`;
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
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-row">🔍 Tidak ada data yang cocok.</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";

  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.style.animationDelay = `${idx * 20}ms`;

    tr.innerHTML = `
      <td><code style="color:var(--cyan-dim);font-size:.78rem">${row.id_fact ?? "-"}</code></td>
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
      <button type="button" class="pagination-btn" ${!hasPrevious ? "disabled" : ""} onclick="goToAlumniPage(${page - 1})">Previous</button>
      <span style="color:var(--text-secondary);font-size:14px;">
        Page <b style="color:var(--primary-color);">${page}</b> of <b style="color:var(--primary-color);">${totalPages}</b>
      </span>
      <button type="button" class="pagination-btn" ${!hasNext ? "disabled" : ""} onclick="goToAlumniPage(${page + 1})">Next</button>
    </div>
  `;
}

function goToAlumniPage(page) {
  if (!currentPagination) return;

  const totalPages = parseInt(currentPagination.total_pages);

  if (page < 1 || page > totalPages) return;

  loadFullAlumniData(page);
}

// ===== IMPORT EXCEL ETL =====
function setImportLoading(button, loading) {
  if (!button) return;

  if (loading) {
    button.disabled = true;
    button.innerHTML = "⏳ Mengimpor...";
  } else {
    button.disabled = false;
    button.innerHTML = "Import Excel ETL";
  }
}

async function importExcelETL() {
  const formImport = document.getElementById("form-import-excel");
  const fileInput = document.getElementById("excel-file");
  const alertBox = document.getElementById("import-alert");
  const button = formImport?.querySelector('button[type="submit"]');

  if (!fileInput || fileInput.files.length === 0) {
    if (alertBox) {
      alertBox.style.display = "block";
      alertBox.className = "alert alert-error";
      alertBox.innerHTML = "Pilih file Excel terlebih dahulu.";
    }

    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  setImportLoading(button, true);

  if (alertBox) {
    alertBox.style.display = "block";
    alertBox.className = "alert alert-info";
    alertBox.innerHTML = "⏳ Proses ETL sedang berjalan...";
  }

  try {
    const response = await fetch(
      `${API_URL}?resource=alumni&action=import_excel`,
      {
        method: "POST",
        headers: {
          "X-API-KEY": getApiKey(),
        },
        body: formData,
      },
    );

    const result = await response.json();

    if (handleUnauthorized(result)) return;

    if (result.status === "success") {
      const data = result.data || {};

      if (alertBox) {
        alertBox.className = "alert alert-success";
        alertBox.innerHTML = `
          <b>✅ Import Excel ETL Berhasil</b><br>
          File: ${data.file_name ?? "-"}<br>
          Total Row: ${data.total_rows ?? 0}<br>
          Inserted: ${data.inserted ?? 0}<br>
          Skipped: ${data.skipped ?? 0}<br>
          Failed: ${data.failed ?? 0}
        `;
      }

      fileInput.value = "";
      showToast("✅ ETL Excel berhasil diproses.");
      loadFullAlumniData(1);
      loadDashboardCharts();
      loadSerapanSummary();
    } else {
      if (alertBox) {
        const data = result.data || {};
        const missingColumns = data.missing_columns
          ? `<br>Kolom hilang: ${data.missing_columns.join(", ")}`
          : "";

        alertBox.className = "alert alert-error";
        alertBox.innerHTML = `
          <b>❌ Import Gagal</b><br>
          ${result.message || "Terjadi kesalahan saat import."}
          ${missingColumns}
        `;
      }

      showToast("❌ Import Excel gagal.");
    }
  } catch (error) {
    console.error("Import Excel ETL error:", error);

    if (alertBox) {
      alertBox.style.display = "block";
      alertBox.className = "alert alert-error";
      alertBox.innerHTML = "Gagal menghubungi server saat import Excel.";
    }
  } finally {
    setImportLoading(button, false);
  }
}

// ===== EDIT DATA ALUMNI =====
function fillAlumniEditForm(data) {
  setValue("id_fact", data.id_fact);
  setValue("kode_responden_asli", data.kode_responden_asli);
  setValue("tahun_lulus", data.tahun_lulus);
  setValue("nama_prodi", data.nama_prodi);
  setValue("jenjang", data.jenjang);
  setValue("jurusan", data.jurusan || "Teknik Informatika dan Komputer");
  setValue("status_kerja", data.status_kerja);
  setValue("jenis_pekerjaan", data.jenis_pekerjaan);
  setValue("kategori_instansi", data.kategori_instansi);
  setValue("jenis_lembaga", data.jenis_lembaga);
  setValue("range_pendapatan", data.range_pendapatan);
  setValue("lama_tunggu_bulan", data.lama_tunggu_bulan);
  setValue("nama_kota", data.nama_kota);
}

function getAlumniEditFormData() {
  return {
    id_fact: document.getElementById("id_fact")?.value,
    kode_responden_asli: document.getElementById("kode_responden_asli")?.value,
    tahun_lulus: document.getElementById("tahun_lulus")?.value,
    nama_prodi: document.getElementById("nama_prodi")?.value,
    jenjang: document.getElementById("jenjang")?.value,
    jurusan:
      document.getElementById("jurusan")?.value ||
      "Teknik Informatika dan Komputer",
    status_kerja: document.getElementById("status_kerja")?.value,
    jenis_pekerjaan:
      document.getElementById("jenis_pekerjaan")?.value || "Tidak Diketahui",
    kategori_instansi: document.getElementById("kategori_instansi")?.value,
    jenis_lembaga:
      document.getElementById("jenis_lembaga")?.value || "Tidak Diketahui",
    range_pendapatan: document.getElementById("range_pendapatan")?.value,
    lama_tunggu_bulan: document.getElementById("lama_tunggu_bulan")?.value,
    nama_kota: document.getElementById("nama_kota")?.value,
  };
}

async function loadAlumniForEdit() {
  const idFact = document.getElementById("id_fact")?.value;
  const btn = document.getElementById("btn-load-data");

  if (!getApiKey()) {
    showAlert("form-alert", "error", "API Key tidak ditemukan. Login ulang.");
    return;
  }

  if (!idFact) {
    showAlert("form-alert", "error", "Masukkan ID Fact terlebih dahulu.");
    return;
  }

  try {
    setButtonLoading(btn, "<span>⏳</span><span>Mencari...</span>", true);

    const response = await fetch(
      `${API_URL}?resource=alumni&id_fact=${encodeURIComponent(idFact)}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      },
    );

    const result = await response.json();

    if (handleUnauthorized(result)) return;

    if (result.status !== "success") {
      showAlert(
        "form-alert",
        "error",
        result.message || "Data tidak ditemukan.",
      );
      return;
    }

    fillAlumniEditForm(result.data);
    showAlert("form-alert", "success", "Data berhasil dimuat ke form edit.");
  } catch (error) {
    console.error("Load alumni edit error:", error);
    showAlert("form-alert", "error", "Gagal terhubung ke server.");
  } finally {
    setButtonLoading(btn, "", false);
  }
}

async function updateAlumniData(e) {
  e.preventDefault();

  const btn = document.querySelector('#form-alumni button[type="submit"]');
  const data = getAlumniEditFormData();

  if (!getApiKey()) {
    showAlert("form-alert", "error", "API Key tidak ditemukan. Login ulang.");
    return;
  }

  if (!data.id_fact) {
    showAlert("form-alert", "error", "ID Fact wajib diisi untuk update data.");
    return;
  }

  try {
    setButtonLoading(btn, "<span>⏳</span><span>Mengupdate...</span>", true);

    const response = await fetch(`${API_URL}?resource=alumni`, {
      method: "PUT",
      headers: getJsonHeaders(),
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (handleUnauthorized(result)) return;

    if (result.status === "success") {
      showAlert("form-alert", "success", result.message);
      showToast("✅ Data alumni berhasil diperbarui.");
    } else {
      showAlert("form-alert", "error", result.message || "Update gagal.");
    }
  } catch (error) {
    console.error("Update alumni error:", error);
    showAlert("form-alert", "error", "Gagal terhubung ke server.");
  } finally {
    setButtonLoading(btn, "", false);
  }
}

function resetAlumniEditForm() {
  const form = document.getElementById("form-alumni");
  if (form) form.reset();

  setValue("id_fact", "");
  showAlert("form-alert", "info", "Form berhasil dikosongkan.");
}

function initEditAlumniPage() {
  const btnLoad = document.getElementById("btn-load-data");
  const formAlumni = document.getElementById("form-alumni");
  const btnReset = document.getElementById("btn-reset-form");

  if (btnLoad) {
    btnLoad.addEventListener("click", loadAlumniForEdit);
  }

  if (formAlumni) {
    formAlumni.addEventListener("submit", updateAlumniData);
  }

  if (btnReset) {
    btnReset.addEventListener("click", resetAlumniEditForm);
  }

  const urlId = new URLSearchParams(window.location.search).get("id");

  if (urlId && document.getElementById("id_fact")) {
    setValue("id_fact", urlId);
    loadAlumniForEdit();
  }
}

function initApiKeyActions() {
  updateApiKeyView();

  const btnCopy =
    document.getElementById("btn-copy-key") ||
    document.getElementById("copy-api-key") ||
    document.querySelector("[data-action='copy-api-key']");

  const btnRegenerate =
    document.getElementById("btn-regenerate-key") ||
    document.getElementById("regenerate-api-key") ||
    document.querySelector("[data-action='regenerate-api-key']");

  if (btnCopy) {
    btnCopy.addEventListener("click", copyApiKey);
  }

  if (btnRegenerate) {
    btnRegenerate.addEventListener("click", regenerateApiKey);
  }
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  checkAuth();

  if (document.getElementById("alumni-table-body")) {
    loadAlumniData();
  }

  if (
    document.getElementById("global-waktu-tunggu") ||
    document.getElementById("chart-waktu-tunggu-prodi")
  ) {
    loadDashboardCharts();
  }

  if (document.getElementById("total-alumni")) {
    loadSerapanSummary();
  }

  if (document.getElementById("full-alumni-table-body")) {
    loadDataFilters();
    loadFullAlumniData(1);
  }

  const formImport = document.getElementById("form-import-excel");

  if (formImport) {
    formImport.addEventListener("submit", function (e) {
      e.preventDefault();
      importExcelETL();
    });
  }

  initEditAlumniPage();
  initApiKeyActions();
});
