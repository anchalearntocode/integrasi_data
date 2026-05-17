<?php
// backend/alumni.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Read all alumni data
    $query = "SELECT * FROM alumni_data ORDER BY id DESC";
    $stmt = $pdo->prepare($query);
    $stmt->execute();
    
    $data = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $data[] = $row;
    }
    
    echo json_encode(["status" => "success", "data" => $data]);
} elseif ($method === 'POST') {
    // Create new alumni data
    $data = json_decode(file_get_contents("php://input"));
    
    if (
        !empty($data->tahun_lulus) && !empty($data->tmj) && 
        !empty($data->waktu_tunggu) && !empty($data->kategori_perusahaan) && 
        !empty($data->jenis_lembaga) && !empty($data->pendapatan) && 
        !empty($data->lama_cari_kerja) && !empty($data->lokasi_kerja)
    ) {
        
        try {
            // Generate id_responden (e.g. ALM-001)
            $query_max = "SELECT id_responden FROM alumni_data ORDER BY id DESC LIMIT 1";
            $stmt_max = $pdo->query($query_max);
            $last_id_str = $stmt_max->fetchColumn();
            
            $next_num = 1;
            if ($last_id_str) {
                // Extract number from ALM-XXX
                $parts = explode('-', $last_id_str);
                if (count($parts) == 2) {
                    $next_num = (int)$parts[1] + 1;
                }
            }
            $id_responden = "ALM-" . str_pad($next_num, 3, "0", STR_PAD_LEFT);
            
            $query = "INSERT INTO alumni_data 
                (id_responden, tahun_lulus, tmj, waktu_tunggu, kategori_perusahaan, jenis_lembaga, pendapatan, lama_cari_kerja, lokasi_kerja) 
                VALUES 
                (:id_responden, :tahun_lulus, :tmj, :waktu_tunggu, :kategori_perusahaan, :jenis_lembaga, :pendapatan, :lama_cari_kerja, :lokasi_kerja)";
                
            $stmt = $pdo->prepare($query);
            $stmt->bindParam(':id_responden', $id_responden);
            $stmt->bindParam(':tahun_lulus', $data->tahun_lulus);
            $stmt->bindParam(':tmj', $data->tmj);
            $stmt->bindParam(':waktu_tunggu', $data->waktu_tunggu);
            $stmt->bindParam(':kategori_perusahaan', $data->kategori_perusahaan);
            $stmt->bindParam(':jenis_lembaga', $data->jenis_lembaga);
            $stmt->bindParam(':pendapatan', $data->pendapatan);
            $stmt->bindParam(':lama_cari_kerja', $data->lama_cari_kerja);
            $stmt->bindParam(':lokasi_kerja', $data->lokasi_kerja);
            
            if ($stmt->execute()) {
                echo json_encode(["status" => "success", "message" => "Data alumni berhasil ditambahkan.", "id_responden" => $id_responden]);
            } else {
                echo json_encode(["status" => "error", "message" => "Gagal menambahkan data."]);
            }
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "Error: " . $e->getMessage()]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Semua field harus diisi."]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Metode request tidak diizinkan."]);
}
?>
