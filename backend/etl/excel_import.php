<?php
// backend/etl/excel_import.php

use PhpOffice\PhpSpreadsheet\IOFactory;

function etl_clean_value($value) {
    if ($value === null) return null;

    $value = trim((string) $value);
    $lower = strtolower($value);

    if ($value === "" || in_array($lower, ["nan", "none", "null", "-", "--", "—"])) {
        return null;
    }

    return preg_replace('/\s+/', ' ', $value);
}

function etl_contains($text, $keyword) {
    return strpos(strtolower($text), strtolower($keyword)) !== false;
}

function etl_normalize_header($header) {
    $header = strtolower(trim((string) $header));
    $header = str_replace(["\n", "\r", "_", "-", "/", ".", "(", ")"], " ", $header);
    return preg_replace('/\s+/', ' ', $header);
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

    $v = strtolower($value);

    if (
        strpos($v, "belum") !== false ||
        strpos($v, "tidak bekerja") !== false ||
        strpos($v, "mencari") !== false
    ) {
        return "Belum Bekerja";
    }

    if (strpos($v, "wira") !== false) {
        return "Wiraswasta";
    }

    if (
        strpos($v, "melanjutkan") !== false ||
        strpos($v, "pendidikan") !== false ||
        strpos($v, "studi") !== false
    ) {
        return "Melanjutkan Pendidikan";
    }

    if (
        strpos($v, "bekerja") !== false ||
        strpos($v, "full") !== false ||
        strpos($v, "part") !== false
    ) {
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
        $v = strtolower($statusRaw);

        if (strpos($v, "full") !== false && strpos($v, "part") !== false) {
            return "Full Time / Part Time";
        }

        if (strpos($v, "full") !== false) {
            return "Full Time";
        }

        if (strpos($v, "part") !== false) {
            return "Part Time";
        }
    }

    return "Tidak Diketahui";
}

function etl_normalize_pendapatan($value) {
    $value = etl_clean_value($value);

    if ($value === null) return "Belum Berpenghasilan";

    $v = strtolower($value);

    if ($v === "0" || strpos($v, "belum") !== false || strpos($v, "tidak") !== false) {
        return "Belum Berpenghasilan";
    }

    return $value;
}

function etl_extract_waiting_months($value) {
    $value = etl_clean_value($value);

    if ($value === null) return 0;

    $v = strtolower($value);

    if (strpos($v, "sebelum lulus") !== false) {
        return 0;
    }

    preg_match_all('/\d+/', $v, $matches);
    $numbers = array_map("intval", $matches[0]);

    if (strpos($v, "kurang dari") !== false && count($numbers) >= 1) {
        return max($numbers[0] - 1, 0);
    }

    if (strpos($v, "<") !== false && count($numbers) >= 1) {
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

function etl_map_excel_columns($headers) {
    $rules = [
        "id_responden" => [
            "id",
            "id responden",
            "kode",
            "kode responden",
            "kode responden asli",
            "responden",
            "nim"
        ],
        "tahun_lulus" => [
            "tahun lulus",
            "tahun",
            "angkatan lulus"
        ],
        "prodi" => [
            "prodi",
            "program studi",
            "nama prodi"
        ],
        "status_kerja" => [
            "status",
            "status kerja",
            "status saat ini",
            "bagaimana status anda saat ini",
            "status alumni"
        ],
        "jenis_lembaga" => [
            "jenis lembaga",
            "lembaga",
            "jenis perusahaan",
            "jenis instansi"
        ],
        "kategori_instansi" => [
            "kategori",
            "kategori perusahaan",
            "kategori instansi",
            "kategori perusahaan instansi",
            "instansi",
            "perusahaan"
        ],
        "lokasi" => [
            "lokasi",
            "kota",
            "kota bekerja",
            "lokasi bekerja",
            "kota lokasi kerja"
        ],
        "waktu_tunggu" => [
            "waktu tunggu",
            "lama tunggu",
            "waktu tunggu setelah lulus",
            "berapa lama waktu tunggu"
        ],
        "range_pendapatan" => [
            "pendapatan",
            "range pendapatan",
            "pendapatan range",
            "pendapatan per bulan",
            "pendapatan per bulan range",
            "gaji"
        ],
    ];

    $mapped = [];
    $usedColumns = [];
    $ignoredColumns = [];

    foreach ($headers as $index => $header) {
        $headerClean = etl_normalize_header($header);
        $found = false;

        foreach ($rules as $target => $aliases) {
            foreach ($aliases as $alias) {
                if ($headerClean === etl_normalize_header($alias)) {
                    $mapped[$target] = $index;
                    $usedColumns[] = $header;
                    $found = true;
                    break 2;
                }
            }
        }

        if (!$found && $headerClean !== "") {
            $ignoredColumns[] = $header;
        }
    }

    return [
        "mapped" => $mapped,
        "used_columns" => $usedColumns,
        "ignored_columns" => $ignoredColumns
    ];
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

function import_excel_etl($pdo, $fileTmp, $fileName) {
    $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

    if (!in_array($ext, ["xlsx", "xls", "csv"])) {
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

    $required = [
        "id_responden",
        "tahun_lulus",
        "prodi",
        "status_kerja",
        "kategori_instansi",
        "lokasi",
        "waktu_tunggu",
        "range_pendapatan"
    ];

    $missing = [];

    foreach ($required as $field) {
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
            try {
                $kodeResponden = etl_clean_value($row[$mapped["id_responden"]] ?? null);
                $tahunLulus = etl_clean_value($row[$mapped["tahun_lulus"]] ?? null);
                $prodiRaw = etl_clean_value($row[$mapped["prodi"]] ?? null);
                $statusRaw = etl_clean_value($row[$mapped["status_kerja"]] ?? null);
                $jenisLembaga = isset($mapped["jenis_lembaga"])
                    ? etl_clean_value($row[$mapped["jenis_lembaga"]] ?? null)
                    : null;
                $kategoriInstansi = etl_clean_value($row[$mapped["kategori_instansi"]] ?? null);
                $lokasi = etl_clean_value($row[$mapped["lokasi"]] ?? null);
                $waktuTungguRaw = etl_clean_value($row[$mapped["waktu_tunggu"]] ?? null);
                $pendapatanRaw = etl_clean_value($row[$mapped["range_pendapatan"]] ?? null);

                if (!$kodeResponden || !$tahunLulus) {
                    $skipped++;
                    continue;
                }

                $tahunLulus = (int) preg_replace('/[^0-9]/', '', $tahunLulus);

                if ($tahunLulus <= 0) {
                    $skipped++;
                    continue;
                }

                $namaProdi = etl_normalize_prodi($prodiRaw, "TKJ");

                $namaLengkapProdi = $namaProdi === "TMJ"
                    ? "Teknik Multimedia dan Jaringan"
                    : "Teknik Komputer dan Jaringan";

                $jenjang = "D4";
                $jurusan = "Teknik Informatika dan Komputer";

                $statusKerja = etl_normalize_status($statusRaw);
                $jenisPekerjaan = etl_normalize_jenis_pekerjaan($statusRaw, $statusKerja);

                $jenisLembaga = $jenisLembaga ?: "Tidak Diketahui";
                $kategoriInstansi = $kategoriInstansi ?: "Tidak Diketahui";
                $namaKota = $lokasi ?: "Tidak Diketahui";
                $rangePendapatan = etl_normalize_pendapatan($pendapatanRaw);
                $lamaTungguBulan = etl_extract_waiting_months($waktuTungguRaw);

                $kodeAlumni = $namaProdi . "-" . $tahunLulus . "-" . $kodeResponden;

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

                $stmt = $pdo->prepare("
                    SELECT id_alumni
                    FROM dim_alumni
                    WHERE kode_alumni = ?
                ");
                $stmt->execute([$kodeAlumni]);
                $existingAlumni = $stmt->fetchColumn();

                if ($existingAlumni) {
                    $skipped++;
                    continue;
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
                    $kodeResponden
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

                $inserted++;
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
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $e;
    }
}
?>