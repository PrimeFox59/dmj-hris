# PROPOSAL PENAWARAN PENGEMBANGAN & IMPLEMENTASI SISTEM
# PRIME HRIS ENTERPRISE

**Solusi Presensi Biometrik Kamera Geotag, Zero-Trust Multi-Site Geofence, Multi-Tier Approval, dan Akuntansi Penggajian Berbasis Proyek Industri**

---

* **Nomor Dokumen:** `PIS/PROP/PRIME-HRIS/2026/09-08`
* **Tanggal:** 8 September 2026
* **Vendor Pengembang:** **PT Prime Infinity Systems (Prime ProjectX)**
* **Author & Lead Architect:** **Galih Primananda, S.E.** (Lead Machining & Platform Architect)
* **Klien Sasaran:** **Direksi & Manajemen PT Dwi Martha Jaya**
* **Ekosistem & Showcase:** [primeprojectx.net](https://primeprojectx.net) • [binus.primeprojectx.net](https://binus.primeprojectx.net)
* **Kontak Direct:** `galih@primeprojectx.net` • `+62 895 2425 7778`

---

## 1. Executive Summary (Ringkasan Eksekutif)

Dalam operasional industri pertambangan, pabrikasi alat berat, fabrikasi permesinan, dan commissioning proyek industri (seperti pada operasional smelter Manyar JIIPE Gresik, site pertambangan Sorowako, dan kawasan industri nasional), integritas kehadiran teknisi lapangan dan alokasi pembiayaan tenaga kerja per kontrak merupakan pilar utama profitabilitas dan audit kepatuhan.

Sistem konvensional seringkali menghadapi kendala:
1. **Titip Absen & Manipulasi Lokasi (Fake GPS):** Presensi tanpa verifikasi wajah visual dan tanpa penguncian jaringan fisik.
2. **Kekakuan Presensi saat Tugas Darurat:** Personel yang dipanggil mendadak ke site klien (Dinas Luar Mendadak) terganjal aturan geofence kantor sehingga dicatat alpa atau telat.
3. **Ketidaksesuaian Alokasi Biaya Gaji Proyek:** Gaji bulanan teknisi dibebankan secara gelondongan ke biaya overhead kantor, menyulitkan evaluasi profitabilitas per kontrak proyek (Project Cost Accounting).
4. **Resiko Pembengkakan Biaya Upah (Labor Cost Overrun):** Tidak adanya sistem forecasting dini yang memproyeksikan total estimasi biaya hingga penyelesaian proyek (Estimate at Completion - EAC).

**Prime HRIS Enterprise** dirancang dan dibangun untuk menjawab seluruh kebutuhan tersebut secara terpadu dalam satu platform web modern dengan arsitektur glassmorphic industrial berkinerja tinggi yang dikembangkan sepenuhnya oleh **PT Prime Infinity Systems (Prime ProjectX)**.

---

## 2. Ruang Lingkup Sistem & Fitur Utama (Scope of Modules)

### 2.1. Presensi Kamera Selfie & Watermark Otomatis
* **Live Camera Viewfinder:** Tangkapan kamera langsung (*real-time webcam*) dengan panduan kontur wajah (*face guideline overlay*).
* **Cryptographic-Style Watermark Stamp:** Setiap snapshot dibubuhi stempel permanen berisi NIK, Nama Karyawan, Tanggal & Waktu akurat (WIB), Koordinat GPS (Latitude & Longitude), Alamat Geocoded, Status Geofence GPS, dan Security Token terautentikasi `PRIME HRIS • VERIFIED WATERMARK`.
* **Geofencing Verification:** Pengecekan radius fisik terhadap koordinat resmi kantor/workshop (e.g. Kawasan Industri JIIPE Manyar / Surabaya HQ).

### 2.2. Zero-Trust Multi-Site Geofence Validator
* **Validasi Berjenjang (Precision Geofencing):** Tombol submit presensi WFO otomatis memverifikasi radius fisik terhadap koordinat resmi kantor, workshop, dan site proyek klien.
* **Audit Trail & Anti-Spoofing:** Verifikasi live satelit GPS chip dan audit IP koneksi untuk mendeteksi anomali tanpa hambatan hardware kaku.

### 2.3. Fleksibilitas Penugasan "Dinas Luar Mendadak"
* **Bypass Terkendali:** Bila teknisi ditugaskan mendadak ke luar kota/site klien tanpa sempat ke kantor, teknisi dapat memilih mode **"Dinas Luar Mendadak"**.
* **Mandatory Field Security:** Pilihan ini merelaksasi batas geofence kantor pusat, namun mewajibkan pengisian Klien Tujuan, Kode Proyek, Alamat Site, dan Alasan Urgensi, serta otomatis mengarahkan presensi ke antrean persetujuan atasan (*manager approval queue*).

### 2.4. Deteksi Keterlambatan & Catatan Aktivitas Harian
* **Mandatory Daily Notes:** Setiap karyawan wajib mencantumkan catatan rencana kerja dan aktivitas harian.
* **Auto-Late Cutoff Detection:** Apabila presensi dilakukan melewati batas jam masuk (misal > 08:30 WIB), sistem langsung mendeteksi menit keterlambatan dan mewajibkan pengisian **Alasan Keterlambatan** untuk pengajuan dispensasi penalti ke HR.

### 2.5. Multi-Tier Approval Hub (Pusat Persetujuan Terpadu)
* Panel approval berjenjang bagi Supervisor, Project Manager, HR, dan Direksi untuk:
  * **Persetujuan Cuti Tahunan & Khusus:** Pengurangan kuota saldo cuti karyawan secara otomatis saat disetujui.
  * **Persetujuan Izin Sakit & Keperluan Mendesak:** Verifikasi lampiran surat dokter.
  * **Persetujuan Dispensasi Keterlambatan:** Pembebasan sanksi potongan penalti gaji.
  * **Persetujuan Dinas Luar Mendadak:** Validasi foto geotag dan alasan penugasan darurat.

### 2.6. Mesin Penggajian (Payroll Engine) & Slip Gaji Resmi
* **Perhitungan Sesuai Regulasi Depnaker:**
  * Formula Upah Lembur per Jam: `Gaji Pokok / 173`
  * Multiplier lembur jam ke-1: `1.5x`, jam ke-2 dst: `2.0x`, hari libur: `2.5x - 3.0x`.
  * Tunjangan Tetap, Tunjangan Harian Makan & Transport, Tunjangan Remote Site.
  * Potongan Penalti Keterlambatan (bila tidak diapprove atasan).
  * Potongan BPJS Ketenagakerjaan (3%) & BPJS Kesehatan (1%).
  * Estimasi Pajak Penghasilan PPh 21 progresif.
* **Official Printable Slip Gaji:** Cetak slip gaji berformat resmi Prime ProjectX dengan QR Code verifikasi.

### 2.7. Penggajian Berbasis Proyek (Project-Based Payroll Allocation)
* **Distribusi Biaya Tenaga Kerja:** Alokasi persentase gaji dan jam kerja staf langsung dibebankan ke akun proyek (misal: 75% dialokasikan ke *Freeport Manyar Smelter*, 25% ke *Vale Sorowako SAG Mill*).
* Evaluasi biaya riil upah langsung (*direct labor cost*) per proyek.

### 2.8. Proyeksi Anggaran Gaji Proyek (Labor Forecast & EAC Engine)
* **Estimate at Completion (EAC):** Peramalan total biaya upah hingga proyek rampung berdasarkan realisasi biaya saat ini + sisa jam kerja yang dibutuhkan × burn rate per jam.
* **Budget Health Alert:** Peringatan dini otomatis jika proyek berpotensi mengalami pembengkakan biaya (*Cost Overrun*).

---

## 3. Pilihan Paket Investasi, Layanan Running Apps & Add-On Modular

| Komponen & Spesifikasi | Paket Dasar HRIS | Paket Pilihan Add-On Modular | Prime HRIS Enterprise (Paket Komplit Full Suite ★) |
| :--- | :--- | :--- | :--- |
| **Harga Setup & Lisensi Awal** | **Rp 2.500.000 (1x Bayar)** | **Modular Sesuai Pilihan** | **Rp 5.500.000 (All-in One-Time / Paling Hemat)** |
| **Biaya Cloud Running Apps** | **Rp 35.000 / Bulan** | Menyesuaikan server | **Rp 35.000 / Bulan** (Deploy Online Gratis) |
| **Alokasi Penyimpanan** | 1 GB Storage Aktif + 10 GB Backup | Menyesuaikan | 1 GB Storage Aktif + 10 GB Dedicated Backup |
| **Dashboard & Web Admin** | Termasuk Lengkap | Termasuk | Termasuk Lengkap |
| **Manajemen Karyawan & Shift** | Termasuk | Termasuk | Termasuk Multi-Site & Multi-Divisi |
| **Hitung Gaji & Slip QR Code** | Termasuk Otomatis | Termasuk | Termasuk Mesin Depnaker 1/173 & QR Code |
| **Approval Cuti, Izin & Sakit** | Termasuk Online Mandiri | Termasuk | Termasuk Multi-Tier Direksi & PM |
| **Subdomain Sistem** | Subdomain Gratis (`dmj.primeprojectx.net`) | Opsional Domain Brand | Setup Custom Domain Gratis (`DMJhris.com`) |
| **Multi-Site GPS Geofence** | *Opsi Add-on (+Rp 1.000.000)* | Tersedia Satuan | **Termasuk (Multi-Site Geofence Kantor & Workshop)** |
| **Mobile Version (Smartphone)** | *Opsi Add-on (+Rp 1.000.000)* | Tersedia Satuan | **Termasuk (Presensi Biometrik & GPS HP)** |
| **Source Code (Offline)** | *Opsi Add-on (+Rp 200.000)* | Tersedia Satuan | **Termasuk (Lisensi Source Code Komplit)** |
| **Pelatihan Full Team** | *Opsi Add-on (+Rp 1.000.000)* | Tersedia Satuan | **Termasuk (Training Seluruh Tim Semua Divisi)** |
| **Garansi & Dukungan** | SLA Cloud & Support Dasar | Standar | **Garansi Bebas Masalah & Update 12 Bulan (Prioritas)** |

### Rincian Pilihan Add-On Modular (Bisa Ditambah Sesuai Kebutuhan DMJ):
1. **Multi-Site GPS Geofence (+ Rp 1.000.000):** Penguncian radius presensi fleksibel untuk multi-lokasi kantor, workshop & site proyek DMJ.
2. **Mobile Version Smartphone (+ Rp 1.000.000):** Akses web responsif HP staf: presensi selfie biometrik, GPS native satelit, & cek slip gaji mandiri.
3. **Source Code Offline (+ Rp 200.000):** Lisensi source code untuk dijalankan mandiri di PC kantor tanpa biaya cloud.
4. **Domain Brand DMJhris.com (± Rp 250.000/thn):** Gunakan nama domain brand perusahaan sendiri (menyesuaikan registrar resmi).
5. **Pelatihan Full Team [BARU] (+ Rp 1.000.000):** Sesi training & pendampingan intensif penggunaan sistem untuk seluruh tim (semua divisi).

### Formula Rincian Investasi & Operasional PT Dwi Martha Jaya:
```
[ 1. Paket Dasar HRIS: Rp 2.500.000 (1x) ] + [ 2. Add-On Terpilih (Opsional) ] + [ 3. Pelatihan Full Team: Rp 1.000.000 (1x) ] + [ 4. Cloud: Rp 35.000/Bln ] = [ 👑 PAKET FULL KOMPLIT: Rp 5.500.000 (1x) ]
```

* **1. Pengadaan (1x Bayar):** Rp 5.500.000 (Lisensi penggunaan sistem HRIS Full Suite All-in).
* **2. Server Cloud (Bulanan):** Rp 35.000 / Bulan (Layanan server cloud resmi & auto-backup database).
* **3. Alamat Domain (Tahunan):** Gratis Rp 0 (Subdomain `dmj.primeprojectx.net`) atau ± Rp 250.000/thn untuk custom domain `DMJhris.com`.
* **4. Status Setup & Deploy:** Online Deploy Gratis Rp 0 (Alokasi 1 GB Storage + 10 GB Backup Cadangan).

---

## 4. Jadwal Pelaksanaan Proyek (Timeline Roadmap)

Implementasi dilaksanakan dalam **5 Minggu (4 Sprint Agile)**:

```
[Sprint 1: Minggu 1] -> Inception, Setup Geofence Multi-Site, Setup Database & NIK Pegawai
[Sprint 2: Minggu 2-3] -> Development Engine Kamera Geotag, Approval Flow & Mesin Gaji
[Sprint 3: Minggu 4] -> User Acceptance Test (UAT), Penetrasi Keamanan & Kalibrasi Geofence
[Sprint 4: Minggu 5] -> Training User & HR Admin, Handover Source Code & Go-Live Resmi
```

---

## 5. Service Level Agreement (SLA) & Komitmen Kualitas

* **Jaminan Uptime:** 99.9% availability dengan arsitektur stateless failover.
* **Waktu Respon Gangguan:** Kategori Critical (< 2 jam), Kategori Moderate (< 6 jam).
* **Backup & Keamanan:** Enkripsi data at rest & in transit, automated daily incremental backup.

---

## 6. Pengesahan & Tanda Tangan

**Diajukan Oleh:**  
**PT PRIME INFINITY SYSTEMS (Prime ProjectX)**  

*(Tanda Tangan & Cap Digital)*  

**Galih Primananda, S.E.**  
Managing Director & Lead Platform Architect  
Platform Ecosystem: [primeprojectx.net](https://primeprojectx.net)  

---

**Disetujui & Diterima Oleh:**  
**PT DWI MARTHA JAYA**  

*(Tanda Tangan & Cap Perusahaan)*  

**( .................................................................... )**  
Authorized Director / General Manager  
PT Dwi Martha Jaya  
