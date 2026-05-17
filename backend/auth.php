<?php
// backend/auth.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once 'db.php';

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"));

    if ($action === 'register') {
        if (!empty($data->username) && !empty($data->password)) {
            $username = htmlspecialchars(strip_tags($data->username));
            $password = password_hash($data->password, PASSWORD_BCRYPT);

            try {
                $query = "INSERT INTO users (username, password) VALUES (:username, :password)";
                $stmt = $pdo->prepare($query);
                $stmt->bindParam(':username', $username);
                $stmt->bindParam(':password', $password);
                
                if ($stmt->execute()) {
                    echo json_encode(["status" => "success", "message" => "Registrasi berhasil."]);
                } else {
                    echo json_encode(["status" => "error", "message" => "Registrasi gagal."]);
                }
            } catch (PDOException $e) {
                if ($e->errorInfo[1] == 1062) { // MySQL constraint violation (UNIQUE)
                    echo json_encode(["status" => "error", "message" => "Username sudah digunakan."]);
                } else {
                    echo json_encode(["status" => "error", "message" => "Error: " . $e->getMessage()]);
                }
            }
        } else {
            echo json_encode(["status" => "error", "message" => "Data tidak lengkap."]);
        }
    } elseif ($action === 'login') {
        if (!empty($data->username) && !empty($data->password)) {
            $username = htmlspecialchars(strip_tags($data->username));
            
            $query = "SELECT id, username, password FROM users WHERE username = :username";
            $stmt = $pdo->prepare($query);
            $stmt->bindParam(':username', $username);
            $stmt->execute();
            
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($row) {
                $hashed_password = $row['password'];
                
                if (password_verify($data->password, $hashed_password)) {
                    // Simple token/session for frontend
                    echo json_encode([
                        "status" => "success", 
                        "message" => "Login berhasil.",
                        "user" => [
                            "id" => $row['id'],
                            "username" => $row['username']
                        ]
                    ]);
                } else {
                    echo json_encode(["status" => "error", "message" => "Password salah."]);
                }
            } else {
                echo json_encode(["status" => "error", "message" => "Username tidak ditemukan."]);
            }
        } else {
            echo json_encode(["status" => "error", "message" => "Data tidak lengkap."]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Aksi tidak valid."]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Metode request tidak diizinkan."]);
}
?>
