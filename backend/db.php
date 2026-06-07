<?php

header("Content-Type: application/json; charset=UTF-8");

// ======================
// KONFIGURASI DATABASE
// ======================

$host = "sql103.ezyro.com";

$dbname = "ezyro_42117687_tracerstudy";

$user = "ezyro_42117687";

$pass = "55b40845526a5e4";

$dsn = "mysql:host=$host;dbname=$dbname;charset=utf8mb4";

try {

    $pdo = new PDO($dsn, $user, $pass);

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);

    // membuat tabel users jika belum ada
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            api_key VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");

    // ==========================
    // TEST KONEKSI DATABASE
    // ==========================

    if (isset($_GET["dbtest"])) {

        echo json_encode([
            "status" => "success",
            "message" => "Database berhasil terkoneksi.",
            "host" => $host,
            "database" => $dbname,
            "user" => $user,
            "php_version" => PHP_VERSION
        ], JSON_PRETTY_PRINT);

        exit;
    }

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "status" => "error",
        "message" => "Database gagal terkoneksi.",
        "error" => $e->getMessage(),
        "host" => $host,
        "database" => $dbname,
        "user" => $user
    ], JSON_PRETTY_PRINT);

    exit;
}

?>