<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-API-KEY, X-Requested-With");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require_once "db.php";

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

        $apiKey = bin2hex(random_bytes(32));

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
if (in_array($resource, ["alumni", "dashboard", "serapan", "dimensi"])) {
    validate_api_key($pdo);
}

// ================= ALUMNI + PAGINATION =================

if ($resource === "alumni") {
    if ($method === "GET") {
        $page = isset($_GET["page"]) ? (int) $_GET["page"] : 1;
        $limit = isset($_GET["limit"]) ? (int) $_GET["limit"] : 10;

        if ($page < 1) {
            $page = 1;
        }

        if ($limit < 1) {
            $limit = 10;
        }

        if ($limit > 100) {
            $limit = 100;
        }

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

        $dataQuery = "
            SELECT
                f.id_fact,
                a.kode_alumni,
                a.kode_responden_asli,
                t.tahun_lulus,
                p.nama_prodi,
                p.jenjang,
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

// ================= DASHBOARD =================

if ($resource === "dashboard") {
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