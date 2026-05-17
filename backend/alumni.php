<?php
// backend/alumni.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Read all data from fact table with joins to dimensions
    $query = "
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
    $stmt = $pdo->prepare($query);
    $stmt->execute();
    
    $data = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $data[] = $row;
    }
    
    echo json_encode(["status" => "success", "data" => $data]);
} elseif ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    
    if (!empty($data->kode_responden_asli) && !empty($data->tahun_lulus) && !empty($data->nama_prodi)) {
        
        try {
            $pdo->beginTransaction();

            // 1. dim_tahun
            $stmt = $pdo->prepare("SELECT id_tahun FROM dim_tahun WHERE tahun_lulus = ?");
            $stmt->execute([$data->tahun_lulus]);
            $id_tahun = $stmt->fetchColumn();
            if (!$id_tahun) {
                $stmt = $pdo->prepare("INSERT INTO dim_tahun (tahun_lulus) VALUES (?)");
                $stmt->execute([$data->tahun_lulus]);
                $id_tahun = $pdo->lastInsertId();
            }

            // 2. dim_prodi
            $stmt = $pdo->prepare("SELECT id_prodi FROM dim_prodi WHERE nama_prodi = ? AND jenjang = ?");
            $stmt->execute([$data->nama_prodi, $data->jenjang]);
            $id_prodi = $stmt->fetchColumn();
            if (!$id_prodi) {
                $stmt = $pdo->prepare("INSERT INTO dim_prodi (nama_prodi, nama_lengkap_prodi, jenjang, jurusan) VALUES (?, ?, ?, ?)");
                $stmt->execute([$data->nama_prodi, $data->nama_prodi, $data->jenjang, $data->jurusan]);
                $id_prodi = $pdo->lastInsertId();
            }

            // 3. dim_status
            $stmt = $pdo->prepare("SELECT id_status FROM dim_status WHERE status_kerja = ? AND jenis_pekerjaan = ?");
            $stmt->execute([$data->status_kerja, $data->jenis_pekerjaan]);
            $id_status = $stmt->fetchColumn();
            if (!$id_status) {
                $stmt = $pdo->prepare("INSERT INTO dim_status (status_kerja, jenis_pekerjaan) VALUES (?, ?)");
                $stmt->execute([$data->status_kerja, $data->jenis_pekerjaan]);
                $id_status = $pdo->lastInsertId();
            }

            // 4. dim_kota
            $stmt = $pdo->prepare("SELECT id_kota FROM dim_kota WHERE nama_kota = ?");
            $stmt->execute([$data->nama_kota]);
            $id_kota = $stmt->fetchColumn();
            if (!$id_kota) {
                $stmt = $pdo->prepare("INSERT INTO dim_kota (nama_kota) VALUES (?)");
                $stmt->execute([$data->nama_kota]);
                $id_kota = $pdo->lastInsertId();
            }

            // 5. dim_instansi
            $stmt = $pdo->prepare("SELECT id_instansi FROM dim_instansi WHERE jenis_lembaga = ? AND kategori_instansi = ? AND id_kota = ?");
            $stmt->execute([$data->jenis_lembaga, $data->kategori_instansi, $id_kota]);
            $id_instansi = $stmt->fetchColumn();
            if (!$id_instansi) {
                $stmt = $pdo->prepare("INSERT INTO dim_instansi (id_kota, jenis_lembaga, kategori_instansi) VALUES (?, ?, ?)");
                $stmt->execute([$id_kota, $data->jenis_lembaga, $data->kategori_instansi]);
                $id_instansi = $pdo->lastInsertId();
            }

            // 6. dim_pendapatan
            $stmt = $pdo->prepare("SELECT id_pendapatan FROM dim_pendapatan WHERE range_pendapatan = ?");
            $stmt->execute([$data->range_pendapatan]);
            $id_pendapatan = $stmt->fetchColumn();
            if (!$id_pendapatan) {
                $stmt = $pdo->prepare("INSERT INTO dim_pendapatan (range_pendapatan) VALUES (?)");
                $stmt->execute([$data->range_pendapatan]);
                $id_pendapatan = $pdo->lastInsertId();
            }

            // 7. dim_alumni
            // Generate kode_alumni (e.g., ALM-001)
            $stmt_max = $pdo->query("SELECT kode_alumni FROM dim_alumni ORDER BY id_alumni DESC LIMIT 1");
            $last_id_str = $stmt_max->fetchColumn();
            $next_num = 1;
            if ($last_id_str && strpos($last_id_str, '-') !== false) {
                $parts = explode('-', $last_id_str);
                $next_num = (int)end($parts) + 1;
            }
            $kode_alumni = "ALM-" . str_pad($next_num, 3, "0", STR_PAD_LEFT);

            $stmt = $pdo->prepare("INSERT INTO dim_alumni (id_tahun, kode_alumni, kode_responden_asli) VALUES (?, ?, ?)");
            $stmt->execute([$id_tahun, $kode_alumni, $data->kode_responden_asli]);
            $id_alumni = $pdo->lastInsertId();

            // 8. fact_serapan_kerja
            $stmt = $pdo->prepare("INSERT INTO fact_serapan_kerja (id_alumni, id_prodi, id_status, id_instansi, id_pendapatan, jumlah_alumni, lama_tunggu_bulan) VALUES (?, ?, ?, ?, ?, 1, ?)");
            $stmt->execute([$id_alumni, $id_prodi, $id_status, $id_instansi, $id_pendapatan, $data->lama_tunggu_bulan]);

            $pdo->commit();
            echo json_encode(["status" => "success", "message" => "Data alumni berhasil ditambahkan dengan kode $kode_alumni."]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            echo json_encode(["status" => "error", "message" => "Error: " . $e->getMessage()]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Beberapa field penting harus diisi."]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Metode request tidak diizinkan."]);
}
?>
