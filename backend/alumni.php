<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-API-KEY, X-Requested-With");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require_once __DIR__ . "/db.php";
require_once __DIR__ . "/vendor/autoload.php";
require_once __DIR__ . "/etl/excel_import.php";

function json_response($status, $data = null, $message = "", $total = null, $code = 200, $pagination = null) {
    http_response_code($code);

    $response = [
        "status" => $status,
        "data" => $data,
        "message" => $message
    ];

    if ($total !== null) {
        $response["total"] = $total;
    }

    if ($pagination !== null) {
        $response["pagination"] = $pagination;
    }

    echo json_encode($response);
    exit;
}

function get_json_body() {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw);

    if (!$data && !empty($raw)) {
        json_response("error", null, "Format JSON tidak valid.", null, 400);
    }

    return $data;
}

function get_api_key() {
    $headers = getallheaders();

    foreach ($headers as $key => $value) {
        if (strtolower($key) === "x-api-key") {
            return trim($value);
        }
    }

    return null;
}

function validate_api_key($pdo) {
    $apiKey = get_api_key();

    if (!$apiKey) {
        json_response("error", null, "API Key tidak ditemukan. Silakan login terlebih dahulu.", null, 401);
    }

    $stmt = $pdo->prepare("
        SELECT id, username
        FROM users
        WHERE api_key = ?
    ");
    $stmt->execute([$apiKey]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        json_response("error", null, "API Key tidak valid atau sesi login sudah berakhir.", null, 401);
    }

    return $user;
}

function generate_api_key() {
    return bin2hex(random_bytes(32));
}

function get_or_create($pdo, $selectSql, $selectParams, $insertSql, $insertParams) {
    $stmt = $pdo->prepare($selectSql);
    $stmt->execute($selectParams);
    $id = $stmt->fetchColumn();

    if (!$id) {
        $stmt = $pdo->prepare($insertSql);
        $stmt->execute($insertParams);
        $id = $pdo->lastInsertId();
    }

    return $id;
}

function normalize_prodi_name($value) {
    return strtoupper(trim((string) $value));
}

function get_full_prodi_name($namaProdi) {
    if ($namaProdi === "TKJ") {
        return "Teknik Komputer dan Jaringan";
    }

    if ($namaProdi === "TMJ") {
        return "Teknik Multimedia dan Jaringan";
    }

    return $namaProdi;
}

function normalize_optional_value($value, $default = "Tidak Diketahui") {
    if (!isset($value)) return $default;

    $value = trim((string) $value);

    if ($value === "") return $default;

    return $value;
}

function save_alumni_dimension_and_fact($pdo, $data, $mode = "insert") {
    $tahunLulus = (int) $data->tahun_lulus;
    $namaProdi = normalize_prodi_name($data->nama_prodi);
    $namaLengkapProdi = get_full_prodi_name($namaProdi);
    $jenjang = trim((string) $data->jenjang);
    $jurusan = normalize_optional_value($data->jurusan ?? null, "Teknik Informatika dan Komputer");

    $statusKerja = trim((string) $data->status_kerja);
    $jenisPekerjaan = normalize_optional_value($data->jenis_pekerjaan ?? null);
    $kategoriInstansi = trim((string) $data->kategori_instansi);
    $jenisLembaga = normalize_optional_value($data->jenis_lembaga ?? null);
    $rangePendapatan = trim((string) $data->range_pendapatan);
    $namaKota = trim((string) $data->nama_kota);
    $lamaTungguBulan = (int) $data->lama_tunggu_bulan;
    $kodeRespondenAsli = trim((string) $data->kode_responden_asli);

    $idTahun = get_or_create(
        $pdo,
        "SELECT id_tahun FROM dim_tahun WHERE tahun_lulus = ?",
        [$tahunLulus],
        "INSERT INTO dim_tahun (tahun_lulus) VALUES (?)",
        [$tahunLulus]
    );

    $idProdi = get_or_create(
        $pdo,
        "SELECT id_prodi FROM dim_prodi WHERE nama_prodi = ? AND jenjang = ?",
        [$namaProdi, $jenjang],
        "INSERT INTO dim_prodi (nama_prodi, nama_lengkap_prodi, jenjang, jurusan) VALUES (?, ?, ?, ?)",
        [$namaProdi, $namaLengkapProdi, $jenjang, $jurusan]
    );

    $idStatus = get_or_create(
        $pdo,
        "SELECT id_status FROM dim_status WHERE status_kerja = ? AND jenis_pekerjaan = ?",
        [$statusKerja, $jenisPekerjaan],
        "INSERT INTO dim_status (status_kerja, jenis_pekerjaan) VALUES (?, ?)",
        [$statusKerja, $jenisPekerjaan]
    );

    $idKota = get_or_create(
        $pdo,
        "SELECT id_kota FROM dim_kota WHERE nama_kota = ?",
        [$namaKota],
        "INSERT INTO dim_kota (nama_kota) VALUES (?)",
        [$namaKota]
    );

    $idInstansi = get_or_create(
        $pdo,
        "SELECT id_instansi FROM dim_instansi WHERE id_kota = ? AND jenis_lembaga = ? AND kategori_instansi = ?",
        [$idKota, $jenisLembaga, $kategoriInstansi],
        "INSERT INTO dim_instansi (id_kota, jenis_lembaga, kategori_instansi) VALUES (?, ?, ?)",
        [$idKota, $jenisLembaga, $kategoriInstansi]
    );

    $idPendapatan = get_or_create(
        $pdo,
        "SELECT id_pendapatan FROM dim_pendapatan WHERE range_pendapatan = ?",
        [$rangePendapatan],
        "INSERT INTO dim_pendapatan (range_pendapatan) VALUES (?)",
        [$rangePendapatan]
    );

    $kodeAlumni = $namaProdi . "-" . $tahunLulus . "-" . $kodeRespondenAsli;

    if ($mode === "insert") {
        $stmt = $pdo->prepare("
            SELECT id_alumni
            FROM dim_alumni
            WHERE kode_alumni = ?
        ");
        $stmt->execute([$kodeAlumni]);
        $existingAlumni = $stmt->fetchColumn();

        if ($existingAlumni) {
            json_response("error", null, "Data alumni sudah ada dan tidak dimasukkan ulang.", null, 409);
        }

        $stmt = $pdo->prepare("
            INSERT INTO dim_alumni (
                id_tahun,
                kode_alumni,
                kode_responden_asli
            )
            VALUES (?, ?, ?)
        ");
        $stmt->execute([
            $idTahun,
            $kodeAlumni,
            $kodeRespondenAsli
        ]);

        $idAlumni = $pdo->lastInsertId();

        $stmt = $pdo->prepare("
            INSERT INTO fact_serapan_kerja (
                id_alumni,
                id_prodi,
                id_status,
                id_instansi,
                id_pendapatan,
                jumlah_alumni,
                lama_tunggu_bulan
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $idAlumni,
            $idProdi,
            $idStatus,
            $idInstansi,
            $idPendapatan,
            1,
            $lamaTungguBulan
        ]);

        return;
    }

    if ($mode === "update") {
        $idFact = (int) $data->id_fact;

        $stmt = $pdo->prepare("
            SELECT id_alumni
            FROM fact_serapan_kerja
            WHERE id_fact = ?
        ");
        $stmt->execute([$idFact]);
        $idAlumni = $stmt->fetchColumn();

        if (!$idAlumni) {
            json_response("error", null, "Data alumni tidak ditemukan.", null, 404);
        }

        $stmt = $pdo->prepare("
            UPDATE dim_alumni
            SET
                id_tahun = ?,
                kode_alumni = ?,
                kode_responden_asli = ?
            WHERE id_alumni = ?
        ");
        $stmt->execute([
            $idTahun,
            $kodeAlumni,
            $kodeRespondenAsli,
            $idAlumni
        ]);

        $stmt = $pdo->prepare("
            UPDATE fact_serapan_kerja
            SET
                id_prodi = ?,
                id_status = ?,
                id_instansi = ?,
                id_pendapatan = ?,
                lama_tunggu_bulan = ?
            WHERE id_fact = ?
        ");
        $stmt->execute([
            $idProdi,
            $idStatus,
            $idInstansi,
            $idPendapatan,
            $lamaTungguBulan,
            $idFact
        ]);

        return;
    }
}

function validate_alumni_payload($data, $isUpdate = false) {
    if ($isUpdate && empty($data->id_fact)) {
        json_response("error", null, "ID Fact wajib diisi untuk update data.", null, 400);
    }

    if (
        empty($data->kode_responden_asli) ||
        empty($data->tahun_lulus) ||
        empty($data->nama_prodi) ||
        empty($data->jenjang) ||
        empty($data->status_kerja) ||
        empty($data->kategori_instansi) ||
        empty($data->range_pendapatan) ||
        !isset($data->lama_tunggu_bulan) ||
        empty($data->nama_kota)
    ) {
        $message = $isUpdate
            ? "Data update alumni belum lengkap."
            : "Data input alumni belum lengkap.";

        json_response("error", null, $message, null, 400);
    }
}

$method = $_SERVER["REQUEST_METHOD"];
$resource = $_GET["resource"] ?? "";
$action = $_GET["action"] ?? "";

// ================= AUTH =================

if ($resource === "auth") {
    if ($method !== "POST") {
        json_response("error", null, "Method auth hanya mendukung POST.", null, 405);
    }

    $data = get_json_body();

    if ($action === "register") {
        if (empty($data->username) || empty($data->password)) {
            json_response("error", null, "Username dan password wajib diisi.", null, 400);
        }

        $username = htmlspecialchars(strip_tags($data->username));
        $hash = password_hash($data->password, PASSWORD_BCRYPT);

        try {
            $stmt = $pdo->prepare("
                INSERT INTO users (username, password)
                VALUES (?, ?)
            ");
            $stmt->execute([$username, $hash]);

            json_response("success", null, "Registrasi berhasil.");
        } catch (PDOException $e) {
            if (isset($e->errorInfo[1]) && $e->errorInfo[1] == 1062) {
                json_response("error", null, "Username sudah digunakan.", null, 409);
            }

            json_response("error", null, "Registrasi gagal: " . $e->getMessage(), null, 500);
        }
    }

    if ($action === "login") {
        if (empty($data->username) || empty($data->password)) {
            json_response("error", null, "Username dan password wajib diisi.", null, 400);
        }

        $username = htmlspecialchars(strip_tags($data->username));

        $stmt = $pdo->prepare("
            SELECT id, username, password
            FROM users
            WHERE username = ?
        ");
        $stmt->execute([$username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            json_response("error", null, "Username tidak ditemukan.", null, 404);
        }

        if (!password_verify($data->password, $user["password"])) {
            json_response("error", null, "Password salah.", null, 401);
        }

        $apiKey = generate_api_key();

        $stmt = $pdo->prepare("
            UPDATE users
            SET api_key = ?
            WHERE id = ?
        ");
        $stmt->execute([$apiKey, $user["id"]]);

        json_response("success", [
            "id" => $user["id"],
            "username" => $user["username"],
            "api_key" => $apiKey
        ], "Login berhasil.");
    }

    if ($action === "validate") {
        $user = validate_api_key($pdo);
        json_response("success", $user, "API Key valid.");
    }

    if ($action === "regenerate_key") {
        $user = validate_api_key($pdo);

        try {
            $newApiKey = generate_api_key();

            $stmt = $pdo->prepare("
                UPDATE users
                SET api_key = ?
                WHERE id = ?
            ");
            $stmt->execute([$newApiKey, $user["id"]]);

            json_response("success", [
                "id" => $user["id"],
                "username" => $user["username"],
                "api_key" => $newApiKey
            ], "API Key berhasil diganti. API Key lama sudah tidak berlaku.");
        } catch (Exception $e) {
            json_response("error", null, "Gagal mengganti API Key: " . $e->getMessage(), null, 500);
        }
    }

    if ($action === "logout") {
        $user = validate_api_key($pdo);

        $stmt = $pdo->prepare("
            UPDATE users
            SET api_key = NULL
            WHERE id = ?
        ");
        $stmt->execute([$user["id"]]);

        json_response("success", null, "Logout berhasil.");
    }

    json_response("error", null, "Action auth tidak valid.", null, 400);
}

// Semua resource data wajib API Key
if (in_array($resource, ["alumni", "dashboard", "charts", "serapan", "dimensi"])) {
    validate_api_key($pdo);
}

// ================= ALUMNI =================

if ($resource === "alumni") {

    // IMPORT EXCEL ETL
    if ($method === "POST" && $action === "import_excel") {
        if (!isset($_FILES["file"])) {
            json_response("error", null, "File Excel belum dikirim.", null, 400);
        }

        try {
            $result = import_excel_etl(
                $pdo,
                $_FILES["file"]["tmp_name"],
                $_FILES["file"]["name"]
            );

            if (!$result["success"]) {
                json_response("error", $result, $result["message"], null, 400);
            }

            json_response("success", $result, $result["message"]);
        } catch (Exception $e) {
            json_response("error", null, "Gagal menjalankan ETL Excel: " . $e->getMessage(), null, 500);
        }
    }

    // INPUT MANUAL SATU DATA
    if ($method === "POST") {
        $data = get_json_body();
        validate_alumni_payload($data, false);

        try {
            $pdo->beginTransaction();
            save_alumni_dimension_and_fact($pdo, $data, "insert");
            $pdo->commit();

            json_response("success", null, "Data alumni berhasil ditambahkan.");
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            json_response("error", null, "Gagal menambahkan data alumni: " . $e->getMessage(), null, 500);
        }
    }

    // GET DETAIL ALUMNI BY ID_FACT
    if ($method === "GET" && !empty($_GET["id_fact"])) {
        $idFact = (int) $_GET["id_fact"];

        $stmt = $pdo->prepare("
            SELECT
                f.id_fact,
                a.kode_alumni,
                a.kode_responden_asli,
                t.tahun_lulus,
                p.nama_prodi,
                p.jenjang,
                p.jurusan,
                s.status_kerja,
                s.jenis_pekerjaan,
                i.kategori_instansi,
                i.jenis_lembaga,
                k.nama_kota,
                pd.range_pendapatan,
                f.jumlah_alumni,
                f.lama_tunggu_bulan
            FROM fact_serapan_kerja f
            JOIN dim_alumni a ON f.id_alumni = a.id_alumni
            JOIN dim_tahun t ON a.id_tahun = t.id_tahun
            JOIN dim_prodi p ON f.id_prodi = p.id_prodi
            JOIN dim_status s ON f.id_status = s.id_status
            JOIN dim_instansi i ON f.id_instansi = i.id_instansi
            JOIN dim_kota k ON i.id_kota = k.id_kota
            JOIN dim_pendapatan pd ON f.id_pendapatan = pd.id_pendapatan
            WHERE f.id_fact = ?
            LIMIT 1
        ");
        $stmt->execute([$idFact]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            json_response("error", null, "Data alumni tidak ditemukan.", null, 404);
        }

        json_response("success", $row, "Detail data alumni berhasil diambil.");
    }

    // UPDATE DATA ALUMNI
    if ($method === "PUT") {
        $data = get_json_body();
        validate_alumni_payload($data, true);

        try {
            $pdo->beginTransaction();
            save_alumni_dimension_and_fact($pdo, $data, "update");
            $pdo->commit();

            json_response("success", null, "Data alumni berhasil diperbarui.");
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            json_response("error", null, "Gagal memperbarui data alumni: " . $e->getMessage(), null, 500);
        }
    }

    // GET ALUMNI + PAGINATION
    if ($method === "GET") {
        $page = isset($_GET["page"]) ? (int) $_GET["page"] : 1;
        $limit = isset($_GET["limit"]) ? (int) $_GET["limit"] : 10;

        if ($page < 1) $page = 1;
        if ($limit < 1) $limit = 10;
        if ($limit > 100) $limit = 100;

        $offset = ($page - 1) * $limit;

        $baseFrom = "
            FROM fact_serapan_kerja f
            JOIN dim_alumni a ON f.id_alumni = a.id_alumni
            JOIN dim_tahun t ON a.id_tahun = t.id_tahun
            JOIN dim_prodi p ON f.id_prodi = p.id_prodi
            JOIN dim_status s ON f.id_status = s.id_status
            JOIN dim_instansi i ON f.id_instansi = i.id_instansi
            JOIN dim_kota k ON i.id_kota = k.id_kota
            JOIN dim_pendapatan pd ON f.id_pendapatan = pd.id_pendapatan
            WHERE 1=1
        ";

        $whereParams = [];

        if (!empty($_GET["tahun"])) {
            $baseFrom .= " AND t.tahun_lulus = ?";
            $whereParams[] = $_GET["tahun"];
        }

        if (!empty($_GET["prodi"])) {
            $baseFrom .= " AND p.nama_prodi = ?";
            $whereParams[] = $_GET["prodi"];
        }

        if (!empty($_GET["status"])) {
            $baseFrom .= " AND s.status_kerja = ?";
            $whereParams[] = $_GET["status"];
        }

        $countQuery = "SELECT COUNT(*) AS total_data " . $baseFrom;
        $countStmt = $pdo->prepare($countQuery);
        $countStmt->execute($whereParams);
        $totalData = (int) $countStmt->fetchColumn();

        $totalPages = $totalData > 0 ? ceil($totalData / $limit) : 1;

        if ($page > $totalPages) {
            $page = $totalPages;
            $offset = ($page - 1) * $limit;
        }

        $dataQuery = "
            SELECT
                f.id_fact,
                a.kode_alumni,
                a.kode_responden_asli,
                t.tahun_lulus,
                p.nama_prodi,
                p.jenjang,
                p.jurusan,
                s.status_kerja,
                s.jenis_pekerjaan,
                i.kategori_instansi,
                i.jenis_lembaga,
                k.nama_kota,
                pd.range_pendapatan,
                f.jumlah_alumni,
                f.lama_tunggu_bulan
            " . $baseFrom . "
            ORDER BY f.id_fact DESC
            LIMIT ? OFFSET ?
        ";

        $dataParams = $whereParams;
        $dataParams[] = $limit;
        $dataParams[] = $offset;

        $stmt = $pdo->prepare($dataQuery);

        foreach ($dataParams as $index => $value) {
            $paramType = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $stmt->bindValue($index + 1, $value, $paramType);
        }

        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $pagination = [
            "page" => $page,
            "limit" => $limit,
            "total_data" => $totalData,
            "total_pages" => $totalPages,
            "has_previous" => $page > 1,
            "has_next" => $page < $totalPages
        ];

        json_response("success", $rows, "Data alumni berhasil diambil.", count($rows), 200, $pagination);
    }

    json_response("error", null, "Method alumni tidak didukung.", null, 405);
}

// ================= DASHBOARD / CHARTS =================

if ($resource === "dashboard" || $resource === "charts") {
    if ($method !== "GET") {
        json_response("error", null, "Method dashboard hanya mendukung GET.", null, 405);
    }

    $data = [];

    $data["waktu_tunggu_global"] = $pdo->query("
        SELECT CONCAT(ROUND(AVG(lama_tunggu_bulan)), ' Bulan') AS rata_rata_waktu_tunggu
        FROM fact_serapan_kerja
    ")->fetch(PDO::FETCH_ASSOC);

    $data["waktu_tunggu_per_prodi"] = $pdo->query("
        SELECT
            dp.nama_prodi AS program_studi,
            ROUND(AVG(f.lama_tunggu_bulan)) AS rata_rata_waktu_tunggu
        FROM fact_serapan_kerja f
        JOIN dim_prodi dp ON f.id_prodi = dp.id_prodi
        GROUP BY dp.nama_prodi
        ORDER BY rata_rata_waktu_tunggu ASC
    ")->fetchAll(PDO::FETCH_ASSOC);

    $data["alumni_per_prodi"] = $pdo->query("
        SELECT
            dp.nama_prodi,
            COUNT(*) AS total_alumni
        FROM fact_serapan_kerja f
        JOIN dim_prodi dp ON f.id_prodi = dp.id_prodi
        GROUP BY dp.nama_prodi
        ORDER BY dp.nama_prodi
    ")->fetchAll(PDO::FETCH_ASSOC);

    $data["status_kerja_per_prodi"] = $pdo->query("
        SELECT
            dp.nama_prodi,
            ds.status_kerja,
            COUNT(*) AS total
        FROM fact_serapan_kerja f
        JOIN dim_prodi dp ON f.id_prodi = dp.id_prodi
        JOIN dim_status ds ON f.id_status = ds.id_status
        GROUP BY dp.nama_prodi, ds.status_kerja
        ORDER BY dp.nama_prodi, ds.status_kerja
    ")->fetchAll(PDO::FETCH_ASSOC);

    $data["serapan_per_tahun"] = $pdo->query("
        SELECT
            dt.tahun_lulus,
            dp.nama_prodi,
            ds.status_kerja,
            COUNT(*) AS total
        FROM fact_serapan_kerja f
        JOIN dim_alumni da ON f.id_alumni = da.id_alumni
        JOIN dim_tahun dt ON da.id_tahun = dt.id_tahun
        JOIN dim_prodi dp ON f.id_prodi = dp.id_prodi
        JOIN dim_status ds ON f.id_status = ds.id_status
        GROUP BY dt.tahun_lulus, dp.nama_prodi, ds.status_kerja
        ORDER BY dt.tahun_lulus, dp.nama_prodi, ds.status_kerja
    ")->fetchAll(PDO::FETCH_ASSOC);

    json_response("success", $data, "Data dashboard berhasil diambil.");
}

// ================= SERAPAN =================

if ($resource === "serapan") {
    if ($method !== "GET") {
        json_response("error", null, "Method serapan hanya mendukung GET.", null, 405);
    }

    if ($action === "summary") {
        $stmt = $pdo->query("
            SELECT
                COUNT(*) AS total_alumni,
                SUM(CASE WHEN ds.status_kerja = 'Bekerja' THEN 1 ELSE 0 END) AS jumlah_bekerja,
                SUM(CASE WHEN ds.status_kerja = 'Belum Bekerja' THEN 1 ELSE 0 END) AS jumlah_belum_bekerja,
                ROUND(
                    (SUM(CASE WHEN ds.status_kerja = 'Bekerja' THEN 1 ELSE 0 END) / COUNT(*)) * 100,
                    2
                ) AS persentase_serapan,
                CONCAT(ROUND(AVG(f.lama_tunggu_bulan)), ' Bulan') AS rata_rata_waktu_tunggu
            FROM fact_serapan_kerja f
            JOIN dim_status ds ON f.id_status = ds.id_status
        ");

        json_response("success", $stmt->fetch(PDO::FETCH_ASSOC), "Summary serapan kerja berhasil diambil.");
    }

    if ($action === "prodi") {
        $stmt = $pdo->query("
            SELECT
                dp.nama_prodi,
                ds.status_kerja,
                COUNT(*) AS total
            FROM fact_serapan_kerja f
            JOIN dim_prodi dp ON f.id_prodi = dp.id_prodi
            JOIN dim_status ds ON f.id_status = ds.id_status
            GROUP BY dp.nama_prodi, ds.status_kerja
            ORDER BY dp.nama_prodi, ds.status_kerja
        ");

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        json_response("success", $rows, "Serapan kerja per prodi berhasil diambil.", count($rows));
    }

    if ($action === "tahun") {
        $stmt = $pdo->query("
            SELECT
                dt.tahun_lulus,
                dp.nama_prodi,
                ds.status_kerja,
                COUNT(*) AS total
            FROM fact_serapan_kerja f
            JOIN dim_alumni da ON f.id_alumni = da.id_alumni
            JOIN dim_tahun dt ON da.id_tahun = dt.id_tahun
            JOIN dim_prodi dp ON f.id_prodi = dp.id_prodi
            JOIN dim_status ds ON f.id_status = ds.id_status
            GROUP BY dt.tahun_lulus, dp.nama_prodi, ds.status_kerja
            ORDER BY dt.tahun_lulus, dp.nama_prodi, ds.status_kerja
        ");

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        json_response("success", $rows, "Serapan kerja per tahun berhasil diambil.", count($rows));
    }

    json_response("error", null, "Action serapan tidak valid.", null, 400);
}

// ================= DIMENSI =================

if ($resource === "dimensi") {
    if ($method !== "GET") {
        json_response("error", null, "Method dimensi hanya mendukung GET.", null, 405);
    }

    $name = $_GET["name"] ?? "";

    $allowed = [
        "prodi" => "dim_prodi",
        "tahun" => "dim_tahun",
        "status" => "dim_status",
        "kota" => "dim_kota",
        "instansi" => "dim_instansi",
        "pendapatan" => "dim_pendapatan"
    ];

    if (!array_key_exists($name, $allowed)) {
        json_response("error", null, "Nama dimensi tidak valid.", null, 400);
    }

    $table = $allowed[$name];

    $stmt = $pdo->query("SELECT * FROM $table");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_response("success", $rows, "Data dimensi berhasil diambil.", count($rows));
}

json_response("error", null, "Resource API tidak ditemukan.", null, 404);
?>