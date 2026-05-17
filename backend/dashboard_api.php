<?php
// backend/dashboard_api.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once 'db.php';

try {
    $results = [];

    // 1. Perbandingan Rata-rata Waktu Tunggu per Prodi
    $q1 = "
        SELECT 
            dp.nama_prodi AS program_studi,
            ROUND(AVG(f.lama_tunggu_bulan)) AS rata_rata_waktu_tunggu
        FROM fact_serapan_kerja f
        JOIN dim_prodi dp ON f.id_prodi = dp.id_prodi
        GROUP BY dp.nama_prodi
        ORDER BY AVG(f.lama_tunggu_bulan) ASC;
    ";
    $stmt1 = $pdo->query($q1);
    $results['waktu_tunggu_per_prodi'] = $stmt1->fetchAll(PDO::FETCH_ASSOC);

    // 2. Rata-rata Waktu tunggu kerja (bulan)
    $q2 = "
        SELECT 
            ROUND(AVG(lama_tunggu_bulan)) AS rata_rata_waktu_tunggu
        FROM fact_serapan_kerja;
    ";
    $stmt2 = $pdo->query($q2);
    $results['waktu_tunggu_global'] = $stmt2->fetch(PDO::FETCH_ASSOC);

    // 3. Jumlah alumni per prodi
    $q3 = "
        SELECT 
            dp.nama_prodi, 
            COUNT(*) AS total_alumni
        FROM fact_serapan_kerja f
        JOIN dim_prodi dp ON f.id_prodi = dp.id_prodi
        GROUP BY dp.nama_prodi;
    ";
    $stmt3 = $pdo->query($q3);
    $results['alumni_per_prodi'] = $stmt3->fetchAll(PDO::FETCH_ASSOC);

    // 4. Perbandingan alumni perprodi
    $q4 = "
        SELECT 
            dp.nama_prodi, 
            ds.status_kerja, 
            COUNT(*) AS total
        FROM fact_serapan_kerja f
        JOIN dim_prodi dp ON f.id_prodi = dp.id_prodi
        JOIN dim_status ds ON f.id_status = ds.id_status
        GROUP BY dp.nama_prodi, ds.status_kerja
        ORDER BY dp.nama_prodi;
    ";
    $stmt4 = $pdo->query($q4);
    $results['status_kerja_per_prodi'] = $stmt4->fetchAll(PDO::FETCH_ASSOC);

    // 5. Serapan Kerja Berdasarkan Tahun Lulus
    $q5 = "
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
        ORDER BY dt.tahun_lulus, dp.nama_prodi;
    ";
    $stmt5 = $pdo->query($q5);
    $results['serapan_per_tahun'] = $stmt5->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["status" => "success", "data" => $results]);
} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>
