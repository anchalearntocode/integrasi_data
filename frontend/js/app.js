const API_URL = "/data_warehouse/backend/alumni.php";

// ================= AUTH =================
function checkAuth() {
  const userId = localStorage.getItem("user_id");
  const currentPage = window.location.pathname.split("/").pop();

  if (!userId && currentPage !== "index.html" && currentPage !== "") {
    window.location.href = "index.html";
  }
}

function logout() {
  localStorage.removeItem("user_id");
  localStorage.removeItem("username");
  localStorage.removeItem("api_key");
  window.location.href = "index.html";
}

// ================= LOGIN =================
if (document.getElementById("form-login")) {
  document
    .getElementById("form-login")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("login-username").value;
      const password = document.getElementById("login-password").value;
      const alertEl = document.getElementById("login-alert");
      const btn = e.target.querySelector("button");

      btn.textContent = "Loading...";
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
          window.location.href = "dashboard.html";
        } else {
          alertEl.style.display = "block";
          alertEl.textContent = result.message;
        }
      } catch (error) {
        alertEl.style.display = "block";
        alertEl.textContent = "Gagal terhubung ke server.";
      } finally {
        btn.textContent = "Sign In";
        btn.disabled = false;
      }
    });
}

// ================= REGISTER =================
if (document.getElementById("form-register")) {
  document
    .getElementById("form-register")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("reg-username").value;
      const password = document.getElementById("reg-password").value;
      const alertEl = document.getElementById("register-alert");
      const btn = e.target.querySelector("button");

      btn.textContent = "Loading...";
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
            toggleAuth("login");
            document.getElementById("login-username").value = username;
            alertEl.style.display = "none";
            alertEl.className = "alert alert-error";
          }, 1500);
        } else {
          alertEl.style.display = "block";
          alertEl.className = "alert alert-error";
          alertEl.textContent = result.message;
        }
      } catch (error) {
        alertEl.style.display = "block";
        alertEl.textContent = "Gagal terhubung ke server.";
      } finally {
        btn.textContent = "Sign Up";
        btn.disabled = false;
      }
    });
}

// ================= DASHBOARD TABLE PREVIEW =================
async function loadAlumniData() {
  const tableBody = document.getElementById("alumni-table-body");
  if (!tableBody) return;

  try {
    const response = await fetch(`${API_URL}?resource=alumni`);
    const result = await response.json();

    if (result.status !== "success") {
      tableBody.innerHTML = `<tr><td colspan="5" style="padding:20px;text-align:center;">Gagal memuat data.</td></tr>`;
      return;
    }

    const data = result.data || [];

    if (data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="padding:20px;text-align:center;">Belum ada data alumni.</td></tr>`;
      return;
    }

    tableBody.innerHTML = "";

    data.slice(0, 5).forEach((row) => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--border-color)";

      tr.innerHTML = `
        <td style="padding:12px;">${row.kode_responden_asli ?? "-"}</td>
        <td style="padding:12px;">${row.tahun_lulus ?? "-"}</td>
        <td style="padding:12px;">${row.lama_tunggu_bulan ?? 0} Bulan</td>
        <td style="padding:12px;">${row.kategori_instansi ?? "-"}</td>
        <td style="padding:12px; color: var(--success-color);">${row.range_pendapatan ?? "-"}</td>
      `;

      tableBody.appendChild(tr);
    });
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="5" style="padding:20px;text-align:center;">Error koneksi ke server.</td></tr>`;
  }
}

// ================= DASHBOARD CHARTS =================
async function loadDashboardCharts() {
  try {
    const response = await fetch(`${API_URL}?resource=dashboard`);
    const result = await response.json();

    if (result.status !== "success") {
      console.error(result.message);
      return;
    }

    const data = result.data;

    const globalStat = document.getElementById("global-waktu-tunggu");
    if (globalStat && data.waktu_tunggu_global) {
      globalStat.textContent =
        data.waktu_tunggu_global.rata_rata_waktu_tunggu || "0 Bulan";
    }

    const colors = [
      "rgba(59, 130, 246, 0.7)",
      "rgba(16, 185, 129, 0.7)",
      "rgba(245, 158, 11, 0.7)",
      "rgba(239, 68, 68, 0.7)",
      "rgba(139, 92, 246, 0.7)",
    ];

    const ctxWaktuTunggu = document.getElementById("chart-waktu-tunggu-prodi");
    if (ctxWaktuTunggu && data.waktu_tunggu_per_prodi) {
      new Chart(ctxWaktuTunggu, {
        type: "bar",
        data: {
          labels: data.waktu_tunggu_per_prodi.map((d) => d.program_studi),
          datasets: [
            {
              label: "Rata-rata Waktu Tunggu (Bulan)",
              data: data.waktu_tunggu_per_prodi.map(
                (d) => d.rata_rata_waktu_tunggu,
              ),
              backgroundColor: colors[0],
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    const ctxAlumniProdi = document.getElementById("chart-alumni-prodi");
    if (ctxAlumniProdi && data.alumni_per_prodi) {
      new Chart(ctxAlumniProdi, {
        type: "doughnut",
        data: {
          labels: data.alumni_per_prodi.map((d) => d.nama_prodi),
          datasets: [
            {
              data: data.alumni_per_prodi.map((d) => d.total_alumni),
              backgroundColor: colors,
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    const ctxStatusKerja = document.getElementById("chart-status-kerja");
    if (ctxStatusKerja && data.status_kerja_per_prodi) {
      const prodis = [
        ...new Set(data.status_kerja_per_prodi.map((d) => d.nama_prodi)),
      ];
      const statuses = [
        ...new Set(data.status_kerja_per_prodi.map((d) => d.status_kerja)),
      ];

      const datasets = statuses.map((status, i) => ({
        label: status,
        backgroundColor: colors[i % colors.length],
        data: prodis.map((prodi) => {
          const match = data.status_kerja_per_prodi.find(
            (d) => d.nama_prodi === prodi && d.status_kerja === status,
          );
          return match ? parseInt(match.total) : 0;
        }),
      }));

      new Chart(ctxStatusKerja, {
        type: "bar",
        data: { labels: prodis, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: true }, y: { stacked: true } },
        },
      });
    }

    const ctxSerapanTahun = document.getElementById("chart-serapan-tahun");
    if (ctxSerapanTahun && data.serapan_per_tahun) {
      const years = [
        ...new Set(data.serapan_per_tahun.map((d) => d.tahun_lulus)),
      ];
      const statuses = [
        ...new Set(data.serapan_per_tahun.map((d) => d.status_kerja)),
      ];

      const datasets = statuses.map((status, i) => ({
        label: status,
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length].replace("0.7", "0.1"),
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        data: years.map((year) => {
          const matches = data.serapan_per_tahun.filter(
            (d) => d.tahun_lulus == year && d.status_kerja === status,
          );
          return matches.reduce((sum, item) => sum + parseInt(item.total), 0);
        }),
      }));

      new Chart(ctxSerapanTahun, {
        type: "line",
        data: { labels: years, datasets },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }
  } catch (error) {
    console.error("Fetch dashboard error:", error);
  }
}

// ================= FULL DATA TABLE =================
let allAlumniData = [];

async function loadFullAlumniData() {
  const tableBody = document.getElementById("full-alumni-table-body");
  if (!tableBody) return;

  try {
    const response = await fetch(`${API_URL}?resource=alumni`);
    const result = await response.json();

    if (result.status !== "success") {
      tableBody.innerHTML = `<tr><td colspan="7" style="padding:20px;text-align:center;">Gagal memuat data.</td></tr>`;
      return;
    }

    allAlumniData = result.data || [];

    if (allAlumniData.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="padding:20px;text-align:center;">Belum ada data.</td></tr>`;
      return;
    }

    const prodiFilter = document.getElementById("filter-prodi");
    const statusFilter = document.getElementById("filter-status");

    if (prodiFilter && statusFilter) {
      prodiFilter.innerHTML = `<option value="all">Semua Prodi</option>`;
      statusFilter.innerHTML = `<option value="all">Semua Status</option>`;

      [...new Set(allAlumniData.map((d) => d.nama_prodi))].forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        prodiFilter.appendChild(opt);
      });

      [...new Set(allAlumniData.map((d) => d.status_kerja))].forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        statusFilter.appendChild(opt);
      });

      prodiFilter.addEventListener("change", renderFullTable);
      statusFilter.addEventListener("change", renderFullTable);
    }

    renderFullTable();
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="7" style="padding:20px;text-align:center;">Error koneksi ke server.</td></tr>`;
  }
}

function renderFullTable() {
  const tableBody = document.getElementById("full-alumni-table-body");
  if (!tableBody) return;

  const prodiVal = document.getElementById("filter-prodi")?.value || "all";
  const statusVal = document.getElementById("filter-status")?.value || "all";

  const filtered = allAlumniData.filter((row) => {
    return (
      (prodiVal === "all" || row.nama_prodi === prodiVal) &&
      (statusVal === "all" || row.status_kerja === statusVal)
    );
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="padding:20px;text-align:center;">Tidak ada data yang cocok.</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";

  filtered.forEach((row) => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid var(--border-color)";

    tr.innerHTML = `
      <td style="padding:12px;">${row.kode_responden_asli ?? "-"}</td>
      <td style="padding:12px;">${row.nama_prodi ?? "-"}</td>
      <td style="padding:12px;">${row.tahun_lulus ?? "-"}</td>
      <td style="padding:12px;">${row.status_kerja ?? "-"}</td>
      <td style="padding:12px;">${row.kategori_instansi ?? "-"}</td>
      <td style="padding:12px; color: var(--success-color);">${row.range_pendapatan ?? "-"}</td>
      <td style="padding:12px;">${row.lama_tunggu_bulan ?? 0} Bulan</td>
    `;

    tableBody.appendChild(tr);
  });
}
