<?php
// backend/dashboard_api.php
// Returns individual records + dimension lists + summary for Power BI-style dashboard
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once 'db.php';

// Kunci data analitik dengan token validasi
validateBearerToken();

try {
    // 1. All individual alumni records (with full dimension joins)
    $q = "
        SELECT 
            f.id_fact, a.kode_alumni, a.kode_responden_asli, t.tahun_lulus, 
            p.nama_prodi, p.jenjang, s.status_kerja, s.jenis_pekerjaan,
            i.kategori_instansi, i.jenis_lembaga, k.nama_kota,
            pd.range_pendapatan, f.lama_tunggu_bulan
        FROM fact_serapan_kerja f
        JOIN dim_alumni a ON f.id_alumni = a.id_alumni
        JOIN dim_tahun t ON a.id_tahun = t.id_tahun
        JOIN dim_prodi p ON f.id_prodi = p.id_prodi
        JOIN dim_status s ON f.id_status = s.id_status
        JOIN dim_instansi i ON f.id_instansi = i.id_instansi
        JOIN dim_kota k ON i.id_kota = k.id_kota
        JOIN dim_pendapatan pd ON f.id_pendapatan = pd.id_pendapatan
        ORDER BY f.id_fact DESC
    ";
    $stmt = $pdo->query($q);
    $alumni = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Distinct dimension values for slicer panels
    $dims = [];

    $stmt = $pdo->query("SELECT DISTINCT tahun_lulus FROM dim_tahun ORDER BY tahun_lulus");
    $dims['tahun'] = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'tahun_lulus');

    $stmt = $pdo->query("SELECT DISTINCT nama_prodi FROM dim_prodi ORDER BY nama_prodi");
    $dims['prodi'] = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'nama_prodi');

    $stmt = $pdo->query("SELECT DISTINCT status_kerja FROM dim_status ORDER BY status_kerja");
    $dims['status'] = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'status_kerja');

    $stmt = $pdo->query("SELECT DISTINCT range_pendapatan FROM dim_pendapatan ORDER BY range_pendapatan");
    $dims['pendapatan'] = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'range_pendapatan');

    // 3. Summary statistics
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM fact_serapan_kerja");
    $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

    $stmt = $pdo->query("SELECT ROUND(AVG(lama_tunggu_bulan), 1) as avg_tunggu FROM fact_serapan_kerja");
    $avgTunggu = $stmt->fetch(PDO::FETCH_ASSOC)['avg_tunggu'];

    echo json_encode([
        "status" => "success",
        "data" => [
            "alumni" => $alumni,
            "dimensions" => $dims,
            "summary" => [
                "total_alumni" => (int)$total,
                "rata_rata_tunggu" => (float)($avgTunggu ?? 0)
            ]
        ]
    ]);
} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>
