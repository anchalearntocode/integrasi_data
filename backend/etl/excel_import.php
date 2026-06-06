<?php
// backend/etl/excel_import.php

use PhpOffice\PhpSpreadsheet\IOFactory;

function etl_clean_value($value) {
    if ($value === null) return null;

    $value = trim((string) $value);
    $value = preg_replace('/\s+/', ' ', $value);
    $lower = strtolower($value);

    if ($value === "" || in_array($lower, ["nan", "none", "null", "-", "--", "—"])) {
        return null;
    }

    return $value;
}

function etl_contains($text, $keyword) {
    return strpos(strtolower((string) $text), strtolower((string) $keyword)) !== false;
}

function etl_normalize_header($header) {
    $header = strtolower(trim((string) $header));

    $header = str_replace(
        ["\n", "\r", "_", "-", "/", ".", "(", ")", "?", ":", ";", ",", ":", "[", "]"],
        " ",
        $header
    );

    $header = str_replace(["rp", "idr"], " ", $header);
    $header = preg_replace('/[0-9]+/', ' ', $header);
    $header = preg_replace('/\s+/', ' ', $header);

    return trim($header);
}

function etl_header_rules() {
    return [
        "id_responden" => [
            "id",
            "id responden",
            "kode",
            "kode responden",
            "kode responden asli",
            "responden",
            "nim",
            "id alumni",
            "kode alumni"
        ],

        "tahun_lulus" => [
            "tahun lulus",
            "tahun",
            "angkatan lulus",
            "tahun kelulusan"
        ],

        "prodi" => [
            "prodi",
            "program studi",
            "nama prodi",
            "jurusan prodi"
        ],

        "status_kerja" => [
            "status",
            "status kerja",
            "status saat ini",
            "status alumni",
            "bagaimana status anda saat ini"
        ],

        "jenis_lembaga" => [
            "jenis lembaga",
            "lembaga",
            "jenis perusahaan",
            "jenis instansi",
            "jenis lembaga kerja",
            "jenis lembaga tempat anda bekerja"
        ],

        "kategori_instansi" => [
            "kategori",
            "kategori perusahaan",
            "kategori instansi",
            "kategori perusahaan instansi",
            "kategori perusahaan/instansi",
            "kategori tempat kerja",
            "instansi",
            "perusahaan"
        ],

        "lokasi" => [
            "lokasi",
            "kota",
            "kota bekerja",
            "lokasi bekerja",
            "lokasi kerja",
            "kota lokasi kerja",
            "di mana kota kabupaten anda bekerja",
            "di mana kota/kabupaten anda bekerja"
        ],

        "waktu_tunggu" => [
            "waktu tunggu",
            "lama tunggu",
            "lama tunggu bulan",
            "waktu tunggu setelah lulus",
            "berapa lama waktu tunggu",
            "berapa bulan waktu tunggu anda dari lulus sampai mulai bekerja",
            "lama cari kerja",
            "lama cari kerja bulan"
        ],

        "range_pendapatan" => [
            "pendapatan",
            "range pendapatan",
            "pendapatan range",
            "pendapatan per bulan",
            "pendapatan per bulan range",
            "pendapatan per bulan range",
            "berapa pendapatan anda per bulan",
            "berapa pendapatan anda per bulan contoh",
            "berapa pendapatan anda per bulan dalam berwiraswasta contoh",
            "gaji",
            "range gaji"
        ],
    ];
}

function etl_detect_header_fallback($cleanHeader) {
    if (etl_contains($cleanHeader, "pendapatan") && etl_contains($cleanHeader, "bulan")) {
        return "range_pendapatan";
    }

    if (etl_contains($cleanHeader, "gaji")) {
        return "range_pendapatan";
    }

    if (
        etl_contains($cleanHeader, "waktu tunggu") ||
        etl_contains($cleanHeader, "lama tunggu") ||
        etl_contains($cleanHeader, "bulan waktu tunggu")
    ) {
        return "waktu_tunggu";
    }

    if (
        etl_contains($cleanHeader, "kota") ||
        etl_contains($cleanHeader, "lokasi kerja") ||
        etl_contains($cleanHeader, "kabupaten")
    ) {
        return "lokasi";
    }

    if (
        etl_contains($cleanHeader, "kategori") &&
        (etl_contains($cleanHeader, "perusahaan") || etl_contains($cleanHeader, "instansi"))
    ) {
        return "kategori_instansi";
    }

    if (
        etl_contains($cleanHeader, "status") &&
        (etl_contains($cleanHeader, "saat ini") || etl_contains($cleanHeader, "kerja"))
    ) {
        return "status_kerja";
    }

    return null;
}

function etl_map_excel_columns($headers) {
    $rules = etl_header_rules();

    $mapped = [];
    $usedColumns = [];
    $ignoredColumns = [];

    foreach ($headers as $index => $header) {
        $originalHeader = trim((string) $header);
        $cleanHeader = etl_normalize_header($originalHeader);

        if ($cleanHeader === "") continue;

        $found = false;

        foreach ($rules as $target => $aliases) {
            foreach ($aliases as $alias) {
                if ($cleanHeader === etl_normalize_header($alias)) {
                    if (!isset($mapped[$target])) {
                        $mapped[$target] = $index;
                        $usedColumns[] = $originalHeader;
                    }

                    $found = true;
                    break 2;
                }
            }
        }

        if (!$found) {
            $fallbackTarget = etl_detect_header_fallback($cleanHeader);

            if ($fallbackTarget !== null && !isset($mapped[$fallbackTarget])) {
                $mapped[$fallbackTarget] = $index;
                $usedColumns[] = $originalHeader;
                $found = true;
            }
        }

        if (!$found) {
            $ignoredColumns[] = $originalHeader;
        }
    }

    return [
        "mapped" => $mapped,
        "used_columns" => $usedColumns,
        "ignored_columns" => $ignoredColumns
    ];
}

function etl_required_columns() {
    return [
        "id_responden",
        "tahun_lulus",
        "prodi",
        "status_kerja",
        "kategori_instansi",
        "lokasi",
        "waktu_tunggu",
        "range_pendapatan"
    ];
}

function etl_is_empty_row($row) {
    foreach ($row as $cell) {
        if (etl_clean_value($cell) !== null) {
            return false;
        }
    }

    return true;
}

function etl_normalize_prodi($value, $default = "TKJ") {
    $value = etl_clean_value($value);

    if ($value === null) return $default;

    if (etl_contains($value, "tmj") || etl_contains($value, "multimedia")) {
        return "TMJ";
    }

    if (etl_contains($value, "tkj") || etl_contains($value, "komputer") || etl_contains($value, "jaringan")) {
        return "TKJ";
    }

    return $default;
}

function etl_normalize_status($value) {
    $value = etl_clean_value($value);

    if ($value === null) return "Belum Bekerja";

    if (etl_contains($value, "belum") || etl_contains($value, "tidak bekerja") || etl_contains($value, "mencari")) {
        return "Belum Bekerja";
    }

    if (etl_contains($value, "wira")) {
        return "Wiraswasta";
    }

    if (etl_contains($value, "melanjutkan") || etl_contains($value, "pendidikan") || etl_contains($value, "studi")) {
        return "Melanjutkan Pendidikan";
    }

    if (etl_contains($value, "bekerja") || etl_contains($value, "full") || etl_contains($value, "part")) {
        return "Bekerja";
    }

    return ucwords($value);
}

function etl_normalize_jenis_pekerjaan($statusRaw, $statusNormalized) {
    $statusRaw = etl_clean_value($statusRaw);

    if ($statusNormalized === "Belum Bekerja") return "Belum Bekerja";
    if ($statusNormalized === "Wiraswasta") return "Wiraswasta";
    if ($statusNormalized === "Melanjutkan Pendidikan") return "Melanjutkan Pendidikan";

    if ($statusRaw !== null) {
        if (etl_contains($statusRaw, "full") && etl_contains($statusRaw, "part")) {
            return "Full Time / Part Time";
        }

        if (etl_contains($statusRaw, "full")) {
            return "Full Time";
        }

        if (etl_contains($statusRaw, "part")) {
            return "Part Time";
        }
    }

    return "Tidak Diketahui";
}

function etl_normalize_pendapatan($value) {
    $value = etl_clean_value($value);

    if ($value === null) return "Belum Berpenghasilan";

    if ($value === "0" || etl_contains($value, "belum") || etl_contains($value, "tidak")) {
        return "Belum Berpenghasilan";
    }

    return $value;
}

function etl_extract_waiting_months($value) {
    $value = etl_clean_value($value);

    if ($value === null) return 0;

    if (etl_contains($value, "sebelum lulus")) {
        return 0;
    }

    preg_match_all('/\d+/', strtolower($value), $matches);
    $numbers = array_map("intval", $matches[0]);

    if (etl_contains($value, "kurang dari") && count($numbers) >= 1) {
        return max($numbers[0] - 1, 0);
    }

    if (etl_contains($value, "<") && count($numbers) >= 1) {
        return $numbers[0];
    }

    if (count($numbers) >= 2) {
        return round(($numbers[0] + $numbers[1]) / 2);
    }

    if (count($numbers) === 1) {
        return $numbers[0];
    }

    return 0;
}

function etl_get_or_create($pdo, $selectSql, $selectParams, $insertSql, $insertParams) {
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

function etl_build_row_data($row, $mapped) {
    return [
        "kode_responden" => etl_clean_value($row[$mapped["id_responden"]] ?? null),
        "tahun_lulus" => etl_clean_value($row[$mapped["tahun_lulus"]] ?? null),
        "prodi_raw" => etl_clean_value($row[$mapped["prodi"]] ?? null),
        "status_raw" => etl_clean_value($row[$mapped["status_kerja"]] ?? null),

        "jenis_lembaga" => isset($mapped["jenis_lembaga"])
            ? etl_clean_value($row[$mapped["jenis_lembaga"]] ?? null)
            : null,

        "kategori_instansi" => etl_clean_value($row[$mapped["kategori_instansi"]] ?? null),
        "lokasi" => etl_clean_value($row[$mapped["lokasi"]] ?? null),
        "waktu_tunggu_raw" => etl_clean_value($row[$mapped["waktu_tunggu"]] ?? null),
        "pendapatan_raw" => etl_clean_value($row[$mapped["range_pendapatan"]] ?? null),
    ];
}

function etl_load_row_to_dw($pdo, $data) {
    if (!$data["kode_responden"] || !$data["tahun_lulus"]) {
        return "skipped";
    }

    $tahunLulus = (int) preg_replace('/[^0-9]/', '', $data["tahun_lulus"]);

    if ($tahunLulus <= 0) {
        return "skipped";
    }

    $namaProdi = etl_normalize_prodi($data["prodi_raw"], "TKJ");

    $namaLengkapProdi = $namaProdi === "TMJ"
        ? "Teknik Multimedia dan Jaringan"
        : "Teknik Komputer dan Jaringan";

    $jenjang = "D4";
    $jurusan = "Teknik Informatika dan Komputer";

    $statusKerja = etl_normalize_status($data["status_raw"]);
    $jenisPekerjaan = etl_normalize_jenis_pekerjaan($data["status_raw"], $statusKerja);

    $jenisLembaga = $data["jenis_lembaga"] ?: "Tidak Diketahui";
    $kategoriInstansi = $data["kategori_instansi"] ?: "Tidak Diketahui";
    $namaKota = $data["lokasi"] ?: "Tidak Diketahui";
    $rangePendapatan = etl_normalize_pendapatan($data["pendapatan_raw"]);
    $lamaTungguBulan = etl_extract_waiting_months($data["waktu_tunggu_raw"]);

    $kodeAlumni = $namaProdi . "-" . $tahunLulus . "-" . $data["kode_responden"];

    $idTahun = etl_get_or_create(
        $pdo,
        "SELECT id_tahun FROM dim_tahun WHERE tahun_lulus = ?",
        [$tahunLulus],
        "INSERT INTO dim_tahun (tahun_lulus) VALUES (?)",
        [$tahunLulus]
    );

    $idProdi = etl_get_or_create(
        $pdo,
        "SELECT id_prodi FROM dim_prodi WHERE nama_prodi = ? AND jenjang = ?",
        [$namaProdi, $jenjang],
        "INSERT INTO dim_prodi (nama_prodi, nama_lengkap_prodi, jenjang, jurusan) VALUES (?, ?, ?, ?)",
        [$namaProdi, $namaLengkapProdi, $jenjang, $jurusan]
    );

    $idStatus = etl_get_or_create(
        $pdo,
        "SELECT id_status FROM dim_status WHERE status_kerja = ? AND jenis_pekerjaan = ?",
        [$statusKerja, $jenisPekerjaan],
        "INSERT INTO dim_status (status_kerja, jenis_pekerjaan) VALUES (?, ?)",
        [$statusKerja, $jenisPekerjaan]
    );

    $idKota = etl_get_or_create(
        $pdo,
        "SELECT id_kota FROM dim_kota WHERE nama_kota = ?",
        [$namaKota],
        "INSERT INTO dim_kota (nama_kota) VALUES (?)",
        [$namaKota]
    );

    $idInstansi = etl_get_or_create(
        $pdo,
        "SELECT id_instansi FROM dim_instansi WHERE id_kota = ? AND jenis_lembaga = ? AND kategori_instansi = ?",
        [$idKota, $jenisLembaga, $kategoriInstansi],
        "INSERT INTO dim_instansi (id_kota, jenis_lembaga, kategori_instansi) VALUES (?, ?, ?)",
        [$idKota, $jenisLembaga, $kategoriInstansi]
    );

    $idPendapatan = etl_get_or_create(
        $pdo,
        "SELECT id_pendapatan FROM dim_pendapatan WHERE range_pendapatan = ?",
        [$rangePendapatan],
        "INSERT INTO dim_pendapatan (range_pendapatan) VALUES (?)",
        [$rangePendapatan]
    );

    $stmt = $pdo->prepare("SELECT id_alumni FROM dim_alumni WHERE kode_alumni = ?");
    $stmt->execute([$kodeAlumni]);
    $existingAlumni = $stmt->fetchColumn();

    if ($existingAlumni) {
        return "skipped";
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
        $data["kode_responden"]
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

    return "inserted";
}

function import_excel_etl($pdo, $fileTmp, $fileName) {
    $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

    if (!in_array($extension, ["xlsx", "xls", "csv"])) {
        throw new Exception("Format file harus .xlsx, .xls, atau .csv.");
    }

    $spreadsheet = IOFactory::load($fileTmp);
    $sheet = $spreadsheet->getActiveSheet();
    $rows = $sheet->toArray(null, true, true, false);

    if (count($rows) < 2) {
        throw new Exception("File tidak memiliki data.");
    }

    $headers = array_shift($rows);
    $columnInfo = etl_map_excel_columns($headers);
    $mapped = $columnInfo["mapped"];

    $missing = [];

    foreach (etl_required_columns() as $field) {
        if (!isset($mapped[$field])) {
            $missing[] = $field;
        }
    }

    if (!empty($missing)) {
        return [
            "success" => false,
            "message" => "Kolom wajib tidak ditemukan.",
            "missing_columns" => $missing,
            "used_columns" => $columnInfo["used_columns"],
            "ignored_columns" => $columnInfo["ignored_columns"]
        ];
    }

    $inserted = 0;
    $skipped = 0;
    $failed = 0;
    $errors = [];

    $pdo->beginTransaction();

    try {
        foreach ($rows as $index => $row) {
            if (etl_is_empty_row($row)) {
                continue;
            }

            try {
                $data = etl_build_row_data($row, $mapped);
                $status = etl_load_row_to_dw($pdo, $data);

                if ($status === "inserted") {
                    $inserted++;
                } else {
                    $skipped++;
                }
            } catch (Exception $rowError) {
                $failed++;

                $errors[] = [
                    "row" => $index + 2,
                    "message" => $rowError->getMessage()
                ];
            }
        }

        $pdo->commit();

        return [
            "success" => true,
            "message" => "Import Excel ETL berhasil diproses.",
            "file_name" => $fileName,
            "total_rows" => count($rows),
            "inserted" => $inserted,
            "skipped" => $skipped,
            "failed" => $failed,
            "used_columns" => $columnInfo["used_columns"],
            "ignored_columns" => $columnInfo["ignored_columns"],
            "errors" => array_slice($errors, 0, 10)
        ];
    } catch (Exception $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $error;
    }
}
?>