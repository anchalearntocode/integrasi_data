<?php
// backend/db.php

$db_file = __DIR__ . '/database.sqlite';
$dsn = "sqlite:$db_file";

try {
    $pdo = new PDO($dsn);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Create users table
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )");

    // Create alumni_data table
    // id_responden will be unique and auto-incremented logically (ALM-001, etc)
    $pdo->exec("CREATE TABLE IF NOT EXISTS alumni_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_responden TEXT UNIQUE NOT NULL,
        tahun_lulus INTEGER NOT NULL,
        tmj TEXT NOT NULL,
        waktu_tunggu TEXT NOT NULL,
        kategori_perusahaan TEXT NOT NULL,
        jenis_lembaga TEXT NOT NULL,
        pendapatan TEXT NOT NULL,
        lama_cari_kerja INTEGER NOT NULL,
        lokasi_kerja TEXT NOT NULL
    )");

} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Database connection failed: " . $e->getMessage()]);
    exit();
}
?>
