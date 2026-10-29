# LEMBAR PENGUJIAN PENERIMAAN PENGGUNA (USER ACCEPTANCE TESTING - UAT)
## PRIME HRIS ENTERPRISE SYSTEM (v2.4.0)

---

### I. INFORMASI UMUM PENGUJIAN

| Parameter | Keterangan |
|:---|:---|
| **Nama Sistem** | PRIME HRIS Enterprise System |
| **Versi Aplikasi** | v2.4.0 (Edge-Cloud Hybrid Architecture) |
| **Production URL** | [https://hris.primeprojectx.net](https://hris.primeprojectx.net) |
| **Infrastruktur Server** | Edge Node POCO X3 NFC (Termux / SQLite / PM2) + Central VPS Hub |
| **Tanggal Pengujian** | 10 Oktober 2026 |
| **Lokasi Pelaksanaan** | Workshop Manyar JIIPE / Kantor PRIME Enterprise |
| **Lead Architect / TPM** | Galih Primananda |
| **Penguji / Tim UAT** | Perwakilan Manajemen, HR Department & Site Operational Lead |

---

### II. TUJUAN & RUANG LINGKUP PENGUJIAN

Pengujian ini bertujuan untuk memverifikasi fungsionalitas, akurasi, dan keandalan sistem **PRIME HRIS Enterprise** secara langsung bersama pengguna (*end-user*), dengan fokus utama pada:
1. **Arsitektur Geofence-First:** Validasi lokasi aktual GPS perangkat sebelum inisiasi pengenalan wajah biometrik maupun pembukaan kamera presensi.
2. **Terminal Kiosk 1:N Biometrik:** Kecepatan, akurasi ZNCC Pearson Cross-Correlation, anti-spoofing kehadiran manusia, dan pencatatan otomatis Masuk/Pulang.
3. **Presensi Mandiri Smartphone (Web Mobile):** Gerbang geofence, presensi WFO, pengajuan dinas luar/WFH, dan deteksi otomatis keterlambatan.
4. **Monitoring Timeline Real-Time:** Normalisasi format waktu delimiter (`HH:mm:ss`), pengurutan kronologis karyawan hadir di posisi teratas, dan modal audit watermark.
5. **Keamanan & Integritas Audit Trail:** Pencatatan log insiden penolakan geofence ke SQLite dan kestabilan transmisi edge network.

---

### III. MATRIKS SKENARIO PENGUJIAN UAT

#### BAGIAN A: TERMINAL KIOSK 1:N MANDIRI (`https://hris.primeprojectx.net/?tab=kiosk`)

| ID | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status |
|:---:|:---|:---|:---|:---|:---:|
| **A.1** | **Geofence-First Barrier (Blokir Lock-On di Luar Lokasi)** | 1. Buka Kiosk pada perangkat di luar radius geofence resmi (>350m).<br>2. Posisikan wajah di depan kamera. | Sistem mendeteksi kecocokan wajah namun **langsung memblokir proses lock-on wajah** (progress bar tetap 0%), membunyikan nada penolakan, memunculkan modal *Presensi Ditolak: Di Luar Geofence*, dan merekam log penolakan ke SQLite. | | `[ ] PASS`<br>`[ ] FAIL` |
| **A.2** | **Kesiapan Sinyal Hardware GPS** | 1. Buka portal Kiosk saat sinyal GPS browser sedang *acquiring fix*. | Sistem menampilkan indikator *"⏳ Menunggu Sinyal GPS Terkunci..."* dan menahan verifikasi biometrik hingga koordinat satelit terkunci. | | `[ ] PASS`<br>`[ ] FAIL` |
| **A.3** | **Presensi Wajah Berhasil (Lokasi Valid)** | 1. Berada di dalam radius resmi kantor/site proyek.<br>2. Hadapkan wajah ke kamera Kiosk. | Sistem menampilkan status *"📍 Lokasi Sesuai"*, progress bar wajah mengunci dalam ~800ms, mengambil snapshot dengan chime sukses, dan mencatat data kehadiran. | | `[ ] PASS`<br>`[ ] FAIL` |
| **A.4** | **Deteksi Otomatis Shift Masuk vs Pulang** | 1. Lakukan presensi saat belum ada catatan hari ini.<br>2. Lakukan presensi ulang pada sore/jam pulang hari yang sama. | Presensi pertama otomatis tersimpan sebagai **MASUK (Check-In)**. Presensi kedua otomatis tercatat sebagai **PULANG (Check-Out)** tanpa menimpa jam masuk awal. | | `[ ] PASS`<br>`[ ] FAIL` |
| **A.5** | **Executive Digital Watermark** | 1. Periksa foto hasil snapshot presensi Kiosk. | Foto dilengkapi banner audit permanen: Nama, NIK, Waktu WIB presisi, Titik Koordinat Lat/Lng, Jarak GPS, Nama Geofence, dan Status Jaringan. | | `[ ] PASS`<br>`[ ] FAIL` |
| **A.6** | **Auto-Reset Standby 4 Detik** | 1. Selesaikan presensi di Kiosk.<br>2. Tunggu tanpa menyentuh layar. | Sistem menghitung mundur 4 detik lalu otomatis reset ke layar viewfinder standby untuk karyawan berikutnya. | | `[ ] PASS`<br>`[ ] FAIL` |
| **A.7** | **Pencarian Karyawan Manual (Fallback)** | 1. Klik tombol "Cari Karyawan".<br>2. Ketik nama/NIK karyawan.<br>3. Pilih karyawan dan ambil foto. | Jika dalam radius geofence: foto terambil dan tersimpan. Jika di luar radius: sistem membunyikan peringatan dan memblokir presensi. | | `[ ] PASS`<br>`[ ] FAIL` |

---

#### BAGIAN B: PRESENSI MANDIRI SMARTPHONE (`https://hris.primeprojectx.net/?tab=camera`)

| ID | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status |
|:---:|:---|:---|:---|:---|:---:|
| **B.1** | **Proteksi Gerbang Kamera WFO (Luar Geofence)** | 1. Atur mode ke **WFO** saat perangkat berada di rumah/luar radius.<br>2. Klik tombol "Buka Kamera". | Kamera pop-up **dicegah terbuka**, berbunyi nada penolakan, dan muncul alert peringatan jarak aktual vs batas toleransi resmi. | | `[ ] PASS`<br>`[ ] FAIL` |
| **B.2** | **Akses Kamera WFO di Lokasi Resmi** | 1. Berada di dalam area kantor atau site proyek.<br>2. Klik tombol "Buka Kamera". | Kamera pop-up terbuka normal, reticle pemandu wajah aktif, jarak GPS terverifikasi valid, dan foto dapat diambil. | | `[ ] PASS`<br>`[ ] FAIL` |
| **B.3** | **Mode Dinas Luar Mendadak / WFH** | 1. Pilih mode **DINAS_LUAR**.<br>2. Isi rincian tujuan, klien, dan keperluan dinas.<br>3. Klik Submit Presensi. | Presensi berhasil dikirim dengan status `DINAS_LUAR_PENDING` (menunggu persetujuan atasan/HR), tanpa diblokir batas geofence kantor. | | `[ ] PASS`<br>`[ ] FAIL` |
| **B.4** | **Deteksi Otomatis Jadwal & Keterlambatan** | 1. Lakukan presensi melewati batas toleransi jadwal proyek (misal >08:30 WIB). | Sistem otomatis menetapkan status `LATE`, menghitung jumlah menit keterlambatan, dan mewajibkan pengisian alasan keterlambatan. | | `[ ] PASS`<br>`[ ] FAIL` |

---

#### BAGIAN C: MONITORING TIMELINE KEHADIRAN REAL-TIME (`https://hris.primeprojectx.net/?tab=timeline`)

| ID | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status |
|:---:|:---|:---|:---|:---|:---:|
| **C.1** | **Pengurutan Kronologis Teratas (Sort at Top)** | 1. Buka tab Timeline Kehadiran setelah ada karyawan yang presensi. | Karyawan yang telah presensi **otomatis berada di urutan teratas**, tersusun berurutan secara kronologis sesuai waktu kedatangan terawal. | | `[ ] PASS`<br>`[ ] FAIL` |
| **C.2** | **Normalisasi Delimiter Waktu & Status Badge** | 1. Periksa swimlane baris karyawan yang hadir. | Jam kedatangan tampil presisi (`HH:mm:ss`), badge status hijau TEPAT WAKTU/LATE sesuai, dan teks fallback *"Belum melakukan presensi"* tidak muncul. | | `[ ] PASS`<br>`[ ] FAIL` |
| **C.3** | **Modal Audit Rincian Kehadiran** | 1. Klik baris nama karyawan yang sudah presensi di timeline. | Terbuka modal detail audit berisi foto selfie ber-watermark resmi, alamat GPS, gateway IP, dan waktu presensi. | | `[ ] PASS`<br>`[ ] FAIL` |

---

#### BAGIAN D: PENGATURAN GEOFENCE & MULTI-PROYEK

| ID | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status |
|:---:|:---|:---|:---|:---|:---:|
| **D.1** | **Fleksibilitas Geofence Proyek Terkait** | 1. Karyawan ditugaskan pada Proyek JIIPE / Ciremai.<br>2. Melakukan presensi pada koordinat proyek tersebut. | Sistem otomatis memvalidasi terhadap titik koordinat proyek terkait tanpa ditolak sebagai luar kantor pusat. | | `[ ] PASS`<br>`[ ] FAIL` |
| **D.2** | **Konfigurasi Radius & Titik Koordinat** | 1. Buka modal pengaturan Geofence.<br>2. Sesuaikan radius atau gunakan koordinat GPS perangkat.<br>3. Simpan perubahan. | Pengaturan berhasil disimpan, jarak evaluasi presensi langsung terbarui secara instan. | | `[ ] PASS`<br>`[ ] FAIL` |

---

#### BAGIAN E: KEAMANAN, AUDIT TRAIL & PERFORMA EDGE

| ID | Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status |
|:---:|:---|:---|:---|:---|:---:|
| **E.1** | **Pencatatan Audit Trail ke Database SQLite** | 1. Picu penolakan geofence pada Kiosk.<br>2. Buka modul log aktivitas sistem. | Tercatat event `KIOSK_ATTENDANCE_DENIED_GEOFENCE` dengan NIK, nama karyawan, jarak meter aktual, toleransi, dan IP address. | | `[ ] PASS`<br>`[ ] FAIL` |
| **E.2** | **Keandalan Akses Edge Gateway POCO X3** | 1. Akses aplikasi secara simultan dari beberapa perangkat. | Aplikasi merespons cepat, stream video stabil, latensi API rendah, dan sinkronisasi SQLite konsisten. | | `[ ] PASS`<br>`[ ] FAIL` |

---

### IV. REKAPITULASI HASIL PENGUJIAN

| Kategori Pengujian | Total Skenario | Lulus (PASS) | Gagal (FAIL) | Bersyarat (CONDITIONAL) |
|:---|:---:|:---:|:---:|:---:|
| **Bagian A: Kiosk 1:N Biometrik** | 7 | | | |
| **Bagian B: Presensi Mandiri Mobile** | 4 | | | |
| **Bagian C: Timeline Kehadiran** | 3 | | | |
| **Bagian D: Multi-Lokasi Geofence** | 2 | | | |
| **Bagian E: Audit Trail & Keamanan** | 2 | | | |
| **TOTAL KESELURUHAN** | **18** | | | |

**Tingkat Kelulusan (Pass Rate):** `....... %`

---

### V. KESIMPULAN & LEMBAR PENGESAHAN (SIGN-OFF)

Berdasarkan hasil pengujian penerimaan pengguna (*User Acceptance Testing*) yang telah dilakukan pada hari ini:

- [ ] **DITERIMA PENUH (ACCEPTED)** — Sistem memenuhi seluruh kriteria fungsional dan operasional, siap digunakan secara penuh.
- [ ] **DITERIMA DENGAN CATATAN (ACCEPTED WITH NOTES)** — Sistem disetujui untuk digunakan dengan catatan perbaikan minor terlampir.
- [ ] **DITOLAK / PERLU PERBAIKAN MAYOR (REJECTED)** — Sistem memerlukan perbaikan signifikan sebelum dapat diuji ulang.

#### Catatan Tambahan Penguji:
```text
____________________________________________________________________________________________________
____________________________________________________________________________________________________
____________________________________________________________________________________________________
```

---

#### Tanda Tangan Persetujuan:

| Perwakilan Penguji 1 (HR / Manajemen) | Perwakilan Penguji 2 (Operasional / Site) | Tim Pengembang Sistem |
|:---:|:---:|:---:|
| <br><br><br><br> | <br><br><br><br> | <br><br><br><br> |
| **( __________________________ )** | **( __________________________ )** | **( Galih Primananda )** |
| Jabatan: ......................... | Jabatan: ......................... | Jabatan: Lead Architect & TPM |
| Tanggal: 10 Oktober 2026 | Tanggal: 10 Oktober 2026 | Tanggal: 10 Oktober 2026 |
