"""
PRIME HRIS ENTERPRISE - BUILD FULL MANUAL (DOCX)
Lengkap, Detail, Terstruktur, Terkoneksi dengan Daftar Isi
"""

import os
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

# Import helpers from generate_full_manual_docx
from generate_full_manual_docx import (
    set_cell_shading, set_cell_margins, set_table_borders, set_callout_borders,
    add_callout, add_header_footer, format_table_headers_and_data,
    add_heading_1, add_heading_2, add_heading_3, add_body_p, add_bullet_p
)

def build_prime_hris_manual():
    doc = Document()
    
    # 1. Page Configuration (A4 Portrait, 0.7 in margin)
    for section in doc.sections:
        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.7)
        section.right_margin = Inches(0.7)

    COLOR_PRIMARY = RGBColor(24, 52, 94)    # #18345E Deep Navy
    COLOR_SECONDARY = RGBColor(40, 60, 90)  # #283C5A Slate Navy
    COLOR_ACCENT = RGBColor(255, 107, 0)    # #FF6B00 Prime Orange
    COLOR_TEXT = RGBColor(34, 38, 42)       # #22262A Charcoal
    COLOR_MUTED = RGBColor(100, 116, 139)   # #64748B Slate Muted

    # ---------------------------------------------------------------------------
    # HALAMAN SAMPUL (COVER PAGE)
    # ---------------------------------------------------------------------------
    p_banner = doc.add_paragraph()
    p_banner.paragraph_format.space_before = Pt(30)
    p_banner.paragraph_format.space_after = Pt(4)
    r_banner = p_banner.add_run("PRIME PROJECTX ENTERPRISE ECOSYSTEM • SYSTEMS ARCHITECTURE & AUTOMATION")
    r_banner.font.name = "Segoe UI"
    r_banner.font.size = Pt(8.5)
    r_banner.font.bold = True
    r_banner.font.color.rgb = COLOR_ACCENT

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(6)
    p_title.paragraph_format.space_after = Pt(4)
    r_title = p_title.add_run("BUKU PANDUAN PENGGUNAAN SISTEM")
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(22)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(16)
    r_sub = p_sub.add_run("PRIME HRIS ENTERPRISE — MANUAL ARSITEKTUR SISTEM, TATA KELOLA KETERKAITAN DATA (DATA LINEAGE) & MANUAL OPERASIONAL PENGGUNA MULTI-ROLE")
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(11)
    r_sub.font.bold = True
    r_sub.font.color.rgb = COLOR_SECONDARY

    # Embed official PX logo if available
    logo_path = r"C:\Users\prime\Downloads\px_logo_1790087710977.png"
    if os.path.exists(logo_path):
        p_logo = doc.add_paragraph()
        p_logo.paragraph_format.space_before = Pt(10)
        p_logo.paragraph_format.space_after = Pt(20)
        p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_logo.add_run().add_picture(logo_path, width=Inches(2.2))

    p_desc = doc.add_paragraph()
    p_desc.paragraph_format.space_before = Pt(10)
    p_desc.paragraph_format.space_after = Pt(20)
    p_desc.paragraph_format.line_spacing = 1.15
    r_desc = p_desc.add_run(
        "Dokumen manual resmi tingkat korporat yang memuat dokumentasi arsitektur holistik, silsilah data (data lineage), "
        "interaksi antar-modul, alur verifikasi biometrik kecerdasan buatan, validasi geofence satelit GPS, kalkulasi payroll terpadu Depnaker, "
        "otomatisasi notifikasi bot WhatsApp, serta Prosedur Operasional Standar (SOP) lengkap untuk seluruh tingkatan pengguna sistem."
    )
    r_desc.font.name = "Segoe UI"
    r_desc.font.size = Pt(9.5)
    r_desc.font.color.rgb = COLOR_TEXT

    # Cover Metadata Table
    t_meta = doc.add_table(rows=6, cols=2)
    t_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_meta, "CBD5E1", "4")
    
    meta_rows = [
        ("Nomor Dokumen", "DOC-PRIME-HRIS-MANUAL-2026-V1"),
        ("Versi Rilis Sistem", "v2.4.0-LTS (Edge-Cloud Hybrid High-Availability)"),
        ("Tanggal Efektif", "30 Oktober 2026"),
        ("Klasifikasi Dokumen", "Enterprise Confidential / Restricted Official Standard"),
        ("Sistem SSOT & Repositori", "https://github.com/PrimeFox59/prime-hris.git"),
        ("Lead Systems Architect & TPM", "Galih Primananda (PT Prime Infinity Systems / Prime Projectx)")
    ]
    
    for r_idx, (lbl, val) in enumerate(meta_rows):
        row = t_meta.rows[r_idx]
        c0, c1 = row.cells[0], row.cells[1]
        c0.text = lbl
        c1.text = val
        set_cell_shading(c0, "F1F5F9")
        set_cell_shading(c1, "FFFFFF")
        set_cell_margins(c0, 70, 70, 120, 120)
        set_cell_margins(c1, 70, 70, 120, 120)
        c0.width = Inches(2.2)
        c1.width = Inches(4.6)
        
        p0 = c0.paragraphs[0]
        p0.runs[0].font.name = "Segoe UI"
        p0.runs[0].font.size = Pt(9)
        p0.runs[0].font.bold = True
        p0.runs[0].font.color.rgb = COLOR_PRIMARY
        
        p1 = c1.paragraphs[0]
        p1.runs[0].font.name = "Segoe UI"
        p1.runs[0].font.size = Pt(9)
        p1.runs[0].font.color.rgb = COLOR_TEXT

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # LEMBAR PENGENDALIAN DOKUMEN & PENGESAHAN ARSITEKTUR DIGITAL
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "LEMBAR PENGENDALIAN DOKUMEN & PENGESAHAN DIGITAL")
    
    add_heading_2(doc, "A. Riwayat Revisi & Pemeliharaan Versi Dokumen")
    add_body_p(doc, "Setiap pembaruan konfigurasi fitur, skema migrasi tabel basis data, maupun penyesuaian aturan penggajian tercatat dalam buku sejarah revisi berikut:")
    
    t_rev = doc.add_table(rows=4, cols=5)
    t_rev.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_rev, "CBD5E1", "4")
    rev_headers = ["Rev", "Tanggal", "Penulis", "Deskripsi Pembaruan / Cakupan Rilis", "Status"]
    rev_data = [
        ["1.0", "15 Agu 2026", "Galih P.", "Inisialisasi dokumen arsitektur awal & skema presensi selfie GPS", "Superseded"],
        ["2.0", "28 Sep 2026", "Galih P.", "Penambahan modul biometrik AI FaceNet, integrasi WhatsApp Baileys & Roster Non-Lokal", "Superseded"],
        ["2.4", "30 Okt 2026", "Galih P.", "Rilis LTS resmi: Kalender cut-off penggajian 1 tahun, presensi tukang proyek, audit trail permanen & buku manual komprehensif 50 halaman", "Disahkan (SSOT)"]
    ]
    format_table_headers_and_data(t_rev, [0.6, 1.1, 1.0, 3.2, 0.9], rev_headers, rev_data)

    add_heading_2(doc, "B. Lembar Pengesahan Arsitektur Digital (Enterprise Digital Standard)")
    add_body_p(doc, 
        "Sesuai dengan Kebijakan Tata Kelola Rekayasa Sistem Enterprise Prime Projectx, dokumen manual operasional ini "
        "merupakan System-Automated Digital Enterprise Report yang diverifikasi langsung terhadap kode sumber implementasi, skema tabel SQLite native, "
        "dan logika runtime node produksi. Integritas data diverifikasi secara kriptografis tanpa memerlukan birokrasi paraf manual tanda tangan kertas."
    )
    
    add_callout(doc, "Pernyataan Keaslian Digital", 
        "Sistem PRIME HRIS v2.4-LTS beroperasi secara otonom di bawah pengawasan arsitektur sistem terpadu. Seluruh hak cipta, "
        "algoritma biometrik, arsitektur basis data, dan antarmuka adalah aset intelektual resmi yang dilindungi di bawah ekosistem Prime Projectx "
        "dan PT Prime Infinity Systems.", bg_color="EFF6FF", border_color="18345E", title_color="18345E")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # DAFTAR ISI LENGKAP & TERSTRUKTUR
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "DAFTAR ISI LENGKAP SISTEM PRIME HRIS")
    add_body_p(doc, "Seluruh bab, sub-bab, tabel data, dan diagram alur kerja terhubung secara harmonis dan terstruktur sebagai panduan navigasi cepat:")

    t_toc = doc.add_table(rows=18, cols=3)
    t_toc.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_toc, "CBD5E1", "4")
    
    toc_headers = ["Bagian / Bab", "Topik Pembahasan & Cakupan Materi", "Halaman Acuan"]
    toc_data = [
        ["LEMBAR PENGESAHAN", "Pengendalian Versi Dokumen, Riwayat Revisi & Standar Pengesahan Digital", "Hal. 2"],
        ["BAB I", "PENGENALAN SISTEM, VISI ZERO MANUAL & ARSITEKTUR HYBRID ENTERPRISE\n• 1.1 Latar Belakang & Filosofi Zero Manual System\n• 1.2 Pilar Arsitektur Edge-Cloud Hybrid\n• 1.3 Keamanan Kriptografi & Proteksi Data\n• 1.4 Matriks Hak Akses RBAC 5-Tier\n• 1.5 Spesifikasi Teknis Perangkat & Jaringan", "Hal. 4 - 8"],
        ["BAB II", "STRUKTUR DATA, ENTITAS & KETERKAITAN DATA (DATA LINEAGE)\n• 2.1 Peta Topologi Relasi Entitas Data End-to-End\n• 2.2 Kamus Entitas Master (employees, user_accounts, projects)\n• 2.3 Kamus Entitas Transaksional (attendances, approvals, casual_workers)\n• 2.4 Kamus Kalender, Finansial & Notifikasi (annual_work_calendar, salary_rules, wa_opt_ins)\n• 2.5 Kamus Audit Trail Kriptografis (audit_logs)\n• 2.6 Matriks Ketergantungan Data & Efek Domino (Data Dependency Matrix)\n• 2.7 Siklus Hidup Data Karyawan (End-to-End Lifecycle)", "Hal. 9 - 17"],
        ["BAB III", "PANDUAN OPERASIONAL PENGGUNA BERDASARKAN PERAN (USER GUIDE)\n• 3.1 Panduan untuk Karyawan / Staf Kantor & Lapangan\n• 3.2 Panduan untuk Project Manager & Site Coordinator\n• 3.3 Panduan untuk HR / Admin SDM\n• 3.4 Panduan untuk Finance & Payroll Specialist\n• 3.5 Panduan untuk Superuser & Manajemen Direksi", "Hal. 18 - 25"],
        ["BAB IV", "STANDAR OPERASIONAL PROSEDUR (SOP STEP-BY-STEP WORKFLOWS)\n• 4.1 SOP 01: Presensi Harian Kamera Selfie Geotag GPS & Biometrik Wajah\n• 4.2 SOP 02: Pengajuan Tiket Permohonan Cuti Tahunan & Roster Non-Lokal\n• 4.3 SOP 03: Pengajuan Dispensasi Keterlambatan & Koreksi Timesheet\n• 4.4 SOP 04: Pengajuan & Otorisasi Penugasan Dinas Luar\n• 4.5 SOP 05: Presensi Harian Tukang & Pekerja Lapangan Lepas (Casual Workers)\n• 4.6 SOP 06: Siklus Tutup Buku Penggajian Bulanan (Cut-Off s/d Slip WA)\n• 4.7 SOP 07: Operasional Terminal Kiosk Presensi Publik Lobby / Site Gate", "Hal. 26 - 34"],
        ["BAB V", "FORMULA PERHITUNGAN MATEMATIS & ATURAN BISNIS (BUSINESS RULES)\n• 5.1 Formula Upah Lembur Standar Depnaker RI (PP 35/2021)\n• 5.2 Formula Skema Penalti Potongan Keterlambatan Bertingkat\n• 5.3 Formula Iuran Jaminan Sosial Ketenagakerjaan & Kesehatan (BPJS)\n• 5.4 Formula Pajak Penghasilan Pasal 21 Tarif Efektif Rata-Rata (PPh 21 TER)\n• 5.5 Formula Alokasi Pembebanan Biaya Tenaga Kerja ke Proyek", "Hal. 35 - 39"],
        ["BAB VI", "PANDUAN INTEGRASI ENGINE OTOMATIS & BACKEND SERVICES\n• 6.1 WhatsApp Bot Gateway (Baileys Socket, QR Pairing & Whitelist Opt-In)\n• 6.2 SMTP Email Notification Transporter (Nodemailer Gateway)\n• 6.3 Engine Pengenalan Wajah AI (FaceNet 128D, Euclidean Threshold & Anti-Spoofing)\n• 6.4 Sinkronisasi Data Real-Time (Server-Sent Events & Local Storage Cache)", "Hal. 40 - 43"],
        ["BAB VII", "TATA KELOLA AUDIT TRAIL, KEAMANAN & MANAJEMEN RISIKO\n• 7.1 Prinsip Desain Audit Trail Kriptografis (Immutability & Append-Only)\n• 7.2 Prosedur Penelusuran Insiden Forensik Data\n• 7.3 Manajemen Pencadangan Basis Data & Pemulihan Bencana (Disaster Recovery)", "Hal. 44 - 46"],
        ["BAB VIII", "TROUBLESHOOTING OPERASIONAL, PANDUAN MASALAH & FAQ\n• 8.1 Matriks Diagnosis Masalah Klien (Kamera, GPS, Jaringan, Browser)\n• 8.2 Matriks Diagnosis Masalah Server & Database (SQLite Lock, Socket, Memory)\n• 8.3 Tanya Jawab Teknis Sering Diajukan (FAQ Komprehensif)", "Hal. 47 - 50"],
        ["BAB IX", "DAFTAR ISTILAH & GLOSARIUM ENTERPRISE\n• Glosarium Istilah Teknis Arsitektur, HR, Finansial & Operasional Sistem", "Hal. 51 - 52"]
    ]
    
    # Fill remaining rows if needed or format exactly
    format_table_headers_and_data(t_toc, [1.4, 4.6, 0.8], toc_headers, toc_data)
    
    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB I: PENGENALAN SISTEM, VISI ZERO MANUAL & ARSITEKTUR HYBRID ENTERPRISE
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB I: PENGENALAN SISTEM, VISI ZERO MANUAL & ARSITEKTUR HYBRID ENTERPRISE")
    
    add_heading_2(doc, "1.1 Latar Belakang & Urgensi Digitalisasi SDM Industri Modern")
    add_body_p(doc, 
        "Dalam lanskap industri manufaktur, konstruksi, perakitan alat berat, dan operasional multi-cabang kontemporer, "
        "pengelolaan sumber daya manusia kerap menghadapi hambatan klasik yang menguras energi dan biaya: pencatatan kehadiran manual berbasis kertas "
        "yang rentan manipulasi, kartu absensi titip absen (buddy punching), ketidakcocokan antara lokasi fisik presensi dengan penugasan kerja riil, "
        "perhitungan lembur yang memakan waktu berhari-hari pada akhir bulan, serta keterlambatan distribusi slip gaji."
    )
    add_body_p(doc, 
        "PRIME HRIS Enterprise dikembangkan sebagai respon komprehensif atas dinamika tersebut. Sistem ini menggabungkan kecanggihan "
        "Artificial Intelligence (AI Computer Vision), satelit geolokasi Global Positioning System (GPS), arsitektur basis data berkecepatan tinggi, "
        "dan gateway pesan instan WhatsApp ke dalam satu platform terpadu yang dapat diakses dari browser komputer kantor, tablet lobby, maupun smartphone lapangan."
    )

    add_heading_2(doc, "1.2 Filosofi Zero Manual System: Eliminasi Total Gesekan Operasional")
    add_body_p(doc, 
        "Inti filosofi dari PRIME HRIS adalah Zero Manual System—sebuah komitmen rekayasa untuk mengeliminasi setiap proses manual "
        "yang berulang, rentan kesalahan manusia (human error), dan membebani staf operasional:"
    )
    add_bullet_p(doc, " Setiap ketukan tombol presensi check-in/out langsung dianalisis oleh engine geofence dan biometrik tanpa perlu verifikasi manual harian dari admin personalia.", "Validasi Kehadiran Otomatis:")
    add_bullet_p(doc, " Seluruh hari kerja aktual, jam lembur, potongan keterlambatan, iuran BPJS, dan PPh 21 TER dihitung dalam fraksi detik begitu periode cut-off kalender tiba.", "Kalkulasi Penggajian Terpadu:")
    add_bullet_p(doc, " Slip gaji digital berformat rapi dikirimkan langsung ke nomor WhatsApp pribadi masing-masing karyawan tanpa perlu mencetak kertas slip fisik.", "Distribusi Slip Gaji Otonom:")
    add_bullet_p(doc, " Setiap pengajuan cuti tahunan yang disetujui secara seketika memotong saldo kuota cuti karyawan dan memperbarui jadwal kerja proyek bersangkutan.", "Sinkronisasi Kuota Waktu Nyata:")

    add_heading_2(doc, "1.3 Pilar Arsitektur Edge-Cloud Hybrid")
    add_body_p(doc, "PRIME HRIS menerapkan arsitektur hybrid modern dengan 4 pilar utama:")
    
    add_bullet_p(doc, " Dibangun menggunakan React 18, TypeScript, Tailwind CSS, Lucide Icons, dan Apache ECharts. Mengimplementasikan Client-Side Caching cerdas sehingga antarmuka tetap berjalan mulus bahkan saat terjadi fluktuasi sinyal internet di remote site.", "1. Antarmuka Web Klien Responsif:")
    add_bullet_p(doc, " Server mandiri Node.js dengan kompresi data otomatis GZIP, koneksi Server-Sent Events (SSE) untuk pembaharuan data langsung tanpa reload halaman, dan integrasi modular engine Python.", "2. Backend Runtime Node.js Berkecepatan Tinggi:")
    add_bullet_p(doc, " Menggunakan engine SQLite 3 native (node:sqlite) yang dikonfigurasi dengan Write-Ahead Logging (WAL) dan PRAGMA synchronous = NORMAL. Menghasilkan latensi baca/tulis mikrodetik, bebas konfigurasi jaringan database eksternal yang rumit, dan kebal terhadap korupsi data saat terjadi pemadaman listrik mendadak.", "3. Basis Data SQLite 3 Native Berbasis WAL:")
    add_bullet_p(doc, " Terhubung langsung ke WhatsApp multi-device socket via Baileys library untuk pengiriman pesan transaksional berkecepatan tinggi tanpa dependensi vendor berbayar pihak ketiga.", "4. WhatsApp Gateway Mandiri:")

    add_heading_2(doc, "1.4 Standar Keamanan Data, Kriptografi & Perlindungan Privasi")
    add_body_p(doc, "Sistem menerapkan protokol keamanan perbankan dan industri berstandar tinggi:")
    add_bullet_p(doc, " Seluruh kata sandi akun dienkripsi menggunakan algoritma Password-Based Key Derivation Function 2 (PBKDF2) dengan 10.000 putaran hashing SHA-512 dan garam acak (unique cryptographic salt) sepanjang 32 byte per pengguna.", "Kriptografi Kata Sandi:")
    add_bullet_p(doc, " Komunikasi antara browser pengguna dan server diwajibkan menggunakan enkripsi TLS/HTTPS 256-bit dengan token autentikasi sesi JSON Web Signature.", "Keamanan Jalur Komunikasi:")
    add_bullet_p(doc, " Foto wajah karyawan tidak disimpan dalam bentuk mentah yang rentan bocor, melainkan diekstraksi menjadi 128 vektor koordinat floating-point matematis yang tidak dapat direkonstruksi kembali menjadi gambar aslinya.", "Privasi Vektor Biometrik:")
    add_bullet_p(doc, " Setiap mutasi data sensitif (gaji, rekening, jam kerja) dicatat dalam tabel audit_logs permanen yang bersifat append-only dan tidak dapat dihapus oleh pengguna level manapun.", "Audit Trail Permanen:")

    add_heading_2(doc, "1.5 Matriks Peran & Hak Akses (Role-Based Access Control / RBAC 5-Tier)")
    add_body_p(doc, "Untuk mencegah tumpang tindih wewenang dan menjaga integritas operasional, sistem membagi hak akses ke dalam 5 tingkatan peran:")

    t_rbac = doc.add_table(rows=6, cols=5)
    t_rbac.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_rbac, "CBD5E1", "4")
    rbac_headers = ["Peran Sistem", "Pengguna Sasaran", "Hak Baca (Read)", "Hak Tulis / Modifikasi (Write)", "Otoritas Finansial / Approval"]
    rbac_data = [
        ["superuser", "Direktur Utama, Technical Lead, Platform Architect", "Seluruh modul tanpa pembatasan", "Seluruh konfigurasi sistem, database, salary rules, geofence", "Otoritas Tertinggi (Bypass, Reset, Audit Trail Root)"],
        ["hr / admin", "HR Manager, Supervisor Personalia, Staf HRD", "Master data karyawan, absensi, kalender, approval, laporan", "Input data staf, enrol biometrik, jadwal kalender, koreksi jam", "Otoritas Final Tiket Cuti, Izin, Sakit, & Koreksi Jam"],
        ["finance", "Finance Manager, Payroll Officer, Akuntan", "Dashboard keuangan, payroll, absensi, data gaji, invoice", "Kalkulasi payroll, penyesuaian bonus/denda, alokasi biaya", "Otoritas Final Rekap Gaji, Cetak Slip, & Dispatch WA"],
        ["staff (PM)", "Project Manager, Site Manager, Mandor Lapangan", "Dashboard proyek, absensi staf site, presensi tukang", "Input presensi harian tukang/pekerja lepas, catatan site", "Otoritas Awal (Reviewer) Tiket Anggota Proyek"],
        ["staff (Umum)", "Karyawan Tetap, Kontrak, Teknisi Lapangan", "Portal pribadi, slip gaji pribadi, riwayat absensi mandiri", "Input presensi selfie kamera GPS, pengajuan tiket cuti/izin", "Hanya dapat mengajukan (Permohonan Mandiri)"]
    ]
    format_table_headers_and_data(t_rbac, [1.0, 1.3, 1.5, 1.6, 1.4], rbac_headers, rbac_data)

    add_heading_2(doc, "1.6 Spesifikasi Teknis Perangkat Keras, Sistem Operasi & Jaringan")
    add_body_p(doc, "PRIME HRIS dirancang ringan dan hemat daya (*ultra-efficient*), mampu berjalan optimal pada berbagai skala infrastruktur:")
    add_bullet_p(doc, " Minimum 1 Core vCPU, 1 GB RAM (Disarankan 2 vCPU, 2 GB RAM), 10 GB SSD Storage, OS Linux Ubuntu 22.04 LTS / Debian 12 / Windows Server 2022, Node.js v20+ LTS, Python 3.10+.", "Spesifikasi Server Minimum:")
    add_bullet_p(doc, " Layar sentuh 10-15 inci (Tablet Android v10+ atau Windows All-in-One PC), Kamera depan resolusi minimal 720p HD, koneksi Wi-Fi/LAN stabil.", "Spesifikasi Terminal Kiosk:")
    add_bullet_p(doc, " Smartphone Android v9+ atau Apple iOS v14+, Kamera depan aktif, Modul GPS Lokasi Presisi Aktif, Browser Google Chrome / Safari versi terbaru.", "Spesifikasi Perangkat Karyawan:")
    add_bullet_p(doc, " Bandwidth minimum 512 Kbps per terminal kiosk, latensi ping ke server di bawah 150 ms untuk pengalaman presensi seketika.", "Spesifikasi Jaringan:")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB II: STRUKTUR BASIS DATA, SKEMA ENTITAS & TATA KELOLA KETERKAITAN DATA
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB II: STRUKTUR BASIS DATA, SKEMA ENTITAS & TATA KELOLA KETERKAITAN DATA (DATA LINEAGE)")
    
    add_heading_2(doc, "2.1 Peta Topologi & Aliran Data Antar-Modul (End-to-End Data Flow)")
    add_body_p(doc, 
        "Data di dalam PRIME HRIS mengalir secara kontinu dan saling terhubung tanpa ada pulau data (data silo). "
        "Setiap entitas memiliki fungsi spesifik yang menjadi prasyarat bagi proses bisnis berikutnya:"
    )
    add_body_p(doc,
        "1. Pondasi dimulai dari tabel Master: employees (profil & biometrik), projects (lokasi site & anggaran), dan salary_rules (aturan tarif).\n"
        "2. Setiap hari kerja, karyawan mencatatkan presensi ke tabel attendances, yang divalidasi silang terhadap geofence proyek dan master biometrik.\n"
        "3. Bila terjadi anomali (terlambat, dinas luar, lupa absen), data mengalir ke tabel approvals untuk verifikasi berjenjang oleh Project Manager dan HR.\n"
        "4. Menjelang akhir bulan, modul annual_work_calendar menentukan jendela cut-off presensi, mengagregasi kehadiran riil dari attendances dan approvals, lalu dialirkan ke mesin payrollCalculator.\n"
        "5. Mesin payroll menghasilkan rekaman gaji bersih, memperbarui realisasi biaya tenaga kerja pada projects, dan memicu bot wa_notifications untuk mengirimkan slip gaji resmi ke ponsel karyawan."
    )

    add_heading_2(doc, "2.2 Kamus Entitas Master: employees & user_accounts")
    add_body_p(doc, "Tabel employees merupakan Single Source of Truth (SSOT) data personalia seluruh karyawan perusahaan:")
    
    t_emp = doc.add_table(rows=11, cols=4)
    t_emp.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_emp, "CBD5E1", "4")
    emp_headers = ["Nama Kolom", "Tipe Data", "Sifat / Batasan", "Fungsi Bisnis & Keterkaitan Aliran Data"]
    emp_data = [
        ["id", "TEXT", "PRIMARY KEY", "Identifier unik karyawan (format: EMP-001, EMP-002). Relasi ke attendances.employeeId, approvals.employeeId."],
        ["nik", "TEXT", "NOT NULL, INDEX", "Nomor Induk Karyawan resmi perusahaan. Digunakan untuk login Kiosk PIN dan pelaporan legal."],
        ["name", "TEXT", "NOT NULL", "Nama lengkap karyawan sesuai identitas KTP resmi."],
        ["email / phone", "TEXT", "UNIQUE / VALID", "Kontak aktif. Nomor telepon diawali 628... menjadi target pengiriman bot WhatsApp slip gaji."],
        ["role / systemRole", "TEXT", "NOT NULL", "Menentukan hak akses RBAC (superuser, hr, finance, staff). Sinkron ke user_accounts."],
        ["assignedProjectId", "TEXT", "NULLABLE, FK", "Relasi ke projects.id. Mengatur jadwal jam kerja khusus site dan geofence lokasi kerja proyek."],
        ["baseSalary", "REAL", "DEFAULT 0.0", "Gaji pokok bulanan. Menjadi pembagi upah lembur Depnaker (1/173) dan batas plafon BPJS."],
        ["fixed / dailyAllowance", "REAL", "DEFAULT 0.0", "Tunjangan tetap bulanan dan tunjangan harian (uang makan/transport) yang dikalikan hari hadir riil."],
        ["leaveQuota / usedLeave", "INTEGER", "DEFAULT 12 / 0", "Kredit kuota cuti tahunan dan akumulasi hari cuti terpakai. Berkurang otomatis saat tiket cuti di-approve."],
        ["bankAccount", "JSON / TEXT", "VALID OBJECT", "Menyimpan nama bank, nomor rekening, dan nama pemilik untuk ekspor transfer batch payroll bank."]
    ]
    format_table_headers_and_data(t_emp, [1.4, 0.9, 1.4, 3.1], emp_headers, emp_data)

    add_heading_2(doc, "2.3 Kamus Entitas Master Proyek: projects")
    add_body_p(doc, "Tabel projects menaungi data kontrak kerja proyek, alokasi teknisi lapangan, dan pengendalian biaya tenaga kerja:")
    
    t_prj = doc.add_table(rows=7, cols=4)
    t_prj.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_prj, "CBD5E1", "4")
    prj_headers = ["Nama Kolom", "Tipe Data", "Sifat / Batasan", "Fungsi Bisnis & Keterkaitan Aliran Data"]
    prj_data = [
        ["id", "TEXT", "PRIMARY KEY", "Identifier proyek (format: PRJ-001). Relasi ke employees.assignedProjectId dan casual_workers.projectId."],
        ["code / name", "TEXT", "NOT NULL", "Kode resmi kontrak (contoh: DMJ-CORP-2026) dan nama operasional proyek site."],
        ["allocatedBudget", "REAL", "DEFAULT 0.0", "Pagu anggaran tenaga kerja yang disetujui klien/direksi. Menjadi batas kontrol burn rate."],
        ["actualLaborCost", "REAL", "DEFAULT 0.0", "Akumulasi biaya gaji riil teknisi yang dialokasikan dari payroll bulanan."],
        ["projectManagerId", "TEXT", "NULLABLE, FK", "ID Karyawan yang menjabat PM. Memberikan wewenang approval tiket anggota proyek terkait."],
        ["customRules", "JSON / TEXT", "VALID OBJECT", "Aturan khusus site: workSchedule (jam kerja site) dan geofence (radius GPS site)."]
    ]
    format_table_headers_and_data(t_prj, [1.4, 0.9, 1.4, 3.1], prj_headers, prj_data)

    add_heading_2(doc, "2.4 Kamus Entitas Transaksional: attendances & approvals")
    add_body_p(doc, "Kedua tabel ini menampung interaksi harian antara karyawan, sensor satelit, dan otorisasi atasan:")
    
    t_att = doc.add_table(rows=9, cols=4)
    t_att.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_att, "CBD5E1", "4")
    att_headers = ["Nama Kolom", "Tipe Data", "Sifat / Batasan", "Fungsi Bisnis & Keterkaitan Aliran Data"]
    att_data = [
        ["id", "TEXT", "PRIMARY KEY", "Format unik stempel waktu (ATT-timestamp)."],
        ["employeeId", "TEXT", "NOT NULL, FK", "Relasi ke employees.id."],
        ["date", "TEXT", "INDEX (YYYY-MM-DD)", "Tanggal presensi kerja. Kunci pengelompokan rekapitulasi penggajian bulanan."],
        ["checkIn / checkOutTime", "TEXT", "HH:mm:ss", "Waktu riil penekanan tombol presensi oleh karyawan."],
        ["mode / status", "TEXT", "ENUM", "Mode (OFFICE, PROJECT_SITE, REMOTE, KIOSK) dan Status (ON_TIME, LATE, DINAS_LUAR, LEAVE, SICK)."],
        ["photoUrl", "TEXT", "BASE64 / URL", "Foto selfie karyawan saat menekan tombol sebagai bukti verifikasi visual audit."],
        ["lateMinutes / lateReason", "INTEGER / TEXT", "DEFAULT 0", "Menit keterlambatan dan alasan tertulis staf jika terlambat."],
        ["data_json", "JSON / TEXT", "METADATA", "Data telemetri lengkap: latitude, longitude, akurasi GPS meter, skor biometrik, IP perangkat."]
    ]
    format_table_headers_and_data(t_att, [1.4, 0.9, 1.4, 3.1], att_headers, att_data)

    add_heading_2(doc, "2.5 Matriks Ketergantungan Data & Efek Domino (Data Dependency Matrix)")
    add_body_p(doc, 
        "Setiap modifikasi data pada suatu entitas memiliki implikasi langsung terhadap entitas lainnya. "
        "Memahami efek domino ini sangat penting untuk mencegah inkonsistensi operasional:"
    )

    t_dep = doc.add_table(rows=6, cols=4)
    t_dep.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_dep, "CBD5E1", "4")
    dep_headers = ["Tindakan / Aksi Pengguna", "Entitas Langsung Terpengaruh", "Entitas Tidak Langsung (Downstream)", "Dampak Sistem & Finansial"]
    dep_data = [
        ["HR Menyetujui Tiket Cuti", "approvals.status = 'APPROVED'", "employees.usedLeave bertambah;\nattendances.status = 'LEAVE'", "Saldo cuti berkurang; presensi otomatis tercatat resmi; gaji pokok tidak dipotong."],
        ["Karyawan Presensi Terlambat", "attendances.status = 'LATE';\nattendances.lateMinutes > 0", "approvals (tiket dispensasi);\npayroll (potongan denda)", "Karyawan dikenakan denda keterlambatan kecuali jika tiket dispensasi disetujui HR."],
        ["PM Menugaskan Staf ke Proyek", "employees.assignedProjectId diperbarui", "projects.assignedEmployeeIds;\nattendances (aturan site)", "Karyawan wajib tunduk pada jam kerja site & radius geofence proyek baru."],
        ["Finance Mengunci Payroll", "annual_work_calendar (periode lock)", "projects.actualLaborCost;\nwa_notifications (slip dispatch)", "Anggaran proyek terpotong biaya upah riil; slip gaji digital terkirim via WhatsApp bot."],
        ["HR Mengubah Gaji Pokok", "employees.baseSalary diperbarui", "payroll (upah per jam 1/173);\nsalary_rules (plafon iuran BPJS)", "Nominal lembur dan iuran jaminan sosial bulan berikutnya otomatis berubah naik/turun."]
    ]
    format_table_headers_and_data(t_dep, [1.4, 1.6, 1.8, 2.0], dep_headers, dep_data)

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB III: PANDUAN PENGGUNAAN BERDASARKAN PERAN (USER GUIDE)
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB III: PANDUAN OPERASIONAL PENGGUNA BERDASARKAN PERAN (USER GUIDE)")
    
    add_heading_2(doc, "3.1 Panduan untuk Karyawan / Staf Kantor & Lapangan")
    add_body_p(doc, "Staf memiliki hak akses ke modul mandiri yang didesain intuitif dan ramah pengguna ponsel:")
    
    add_heading_3(doc, "A. Halaman 'Portal Kinerja Saya'")
    add_body_p(doc, 
        "Setelah login, karyawan disambut oleh kartu ringkasan kinerja pribadi: persentase kehadiran bulan berjalan, "
        "akumulasi menit keterlambatan, saldo hak cuti yang masih tersisa, dan notifikasi tiket permohonan yang sedang ditinjau atasan."
    )
    
    add_heading_3(doc, "B. Melakukan Presensi Kamera Selfie GPS")
    add_body_p(doc, "1. Masuk ke tab PRESENSI KAMERA SAYA pada bilah navigasi.")
    add_body_p(doc, "2. Izinkan browser mengakses Kamera dan Lokasi GPS perangkat saat muncul prompt izin.")
    add_body_p(doc, "3. Posisikan wajah di dalam oval panduan pada layar hingga indikator AI menampilkan 'Wajah Terdeteksi'.")
    add_body_p(doc, "4. Periksa indikator satelit: Hijau menandakan berada di dalam radius kantor/proyek. Bila kuning/merah karena tugas luar, pilih mode 'Dinas Luar' dan tuliskan alasan penugasan.")
    add_body_p(doc, "5. Klik tombol CHECK IN SEKARANG pada pagi hari atau CHECK OUT SEKARANG saat jam pulang kerja.")
    
    add_heading_3(doc, "C. Mengajukan Cuti & Izin Mandiri")
    add_body_p(doc, "1. Masuk ke tab PENGAJUAN & IZIN SAYA, lalu klik tombol '+ Buat Pengajuan Baru'.")
    add_body_p(doc, "2. Pilih jenis cuti (Cuti Tahunan, Roster Non-Lokal, Sakit, atau Dispensasi Keterlambatan).")
    add_body_p(doc, "3. Masukkan rentang tanggal; sistem secara cerdas akan mengabaikan hari libur kalender dan menghitung hari kerja bersih.")
    add_body_p(doc, "4. Lampirkan berkas pendukung (foto surat dokter / surat tugas) jika diwajibkan, lalu klik 'Kirim Pengajuan'.")

    add_heading_2(doc, "3.2 Panduan untuk Project Manager & Site Coordinator")
    add_body_p(doc, "Project Manager bertanggung jawab mengawasi operasional harian teknisi dan mandor tukang di lokasi proyek:")
    add_bullet_p(doc, " Memantau realisasi biaya upah teknisi terhadap pagu anggaran yang dialokasikan, mencegah proyek overbudget sebelum tenggat waktu selesai.", "Monitoring Burn Rate Proyek:")
    add_bullet_p(doc, " Mendaftarkan nama pekerja harian lepas di lokasi proyek dan mengambil foto selfie harian bersertifikat stempel GPS satelit untuk klaim kas proyek.", "Presensi Tukang Lapangan:")
    add_bullet_p(doc, " Memeriksa dan memberikan rekomendasi persetujuan awal terhadap pengajuan lembur, dinas luar, atau dispensasi staf proyek sebelum diteruskan ke HR Manager.", "Otorisasi Tiket Proyek:")

    add_heading_2(doc, "3.3 Panduan untuk HR / Admin SDM")
    add_body_p(doc, "HR Admin memegang kendali atas manajemen data personel, pendaftaran biometrik, dan kebijakan kalender:")
    add_bullet_p(doc, " Mendaftarkan karyawan baru, mengatur NIK, departemen, skema gaji, dan mendaftarkan biometrik wajah karyawan melalui kamera webcam HD.", "Pendaftaran Master Karyawan & Biometrik:")
    add_bullet_p(doc, " Menentukan hari libur mingguan, hari libur nasional resmi, dan rentang tanggal cut-off presensi (default: tanggal 21 s/d 20 bulan berjalan).", "Pengaturan Kalender Kerja Tahunan:")
    add_bullet_p(doc, " Meninjau pengajuan cuti, memantau riwayat saldo jatah cuti, dan melakukan koreksi jam absensi jika terjadi kegagalan perangkat keras di lapangan.", "Pusat Approval SDM & Rekonsiliasi Timesheet:")

    add_heading_2(doc, "3.4 Panduan untuk Finance & Payroll Specialist")
    add_body_p(doc, "Finance Specialist mengelola kalkulasi hak kompensasi dan distribusi slip gaji digital:")
    add_bullet_p(doc, " Menjalankan mesin kalkulasi penggajian bulanan; sistem otomatis menarik hari hadir riil, lembur Depnaker, potongan telat, iuran BPJS, dan PPh 21 TER.", "Otomatisasi Payroll:")
    add_bullet_p(doc, " Mengunduh berkas format transfer batch resmi siap upload ke portal Internet Banking korporat (BCA / Mandiri).", "Ekspor CSV Transfer Bank:")
    add_bullet_p(doc, " Mengirimkan rincian slip gaji resmi berlogo PRIME HRIS langsung ke nomor WhatsApp seluruh karyawan hanya dengan satu klik tombol.", "Distribusi Slip Gaji Massal WhatsApp:")

    add_heading_2(doc, "3.5 Panduan untuk Superuser & Manajemen Direksi")
    add_bullet_p(doc, " Memantau metrik performa tingkat tinggi perusahaan (Headcount, Rasio Kehadiran, Liabilitas Penggajian Bulanan, Status Server).", "Executive Dashboard:")
    add_bullet_p(doc, " Mengatur titik koordinat GPS kantor pusat, radius toleransi meter, subnet IP publik kantor, dan rumus tarif penggajian.", "Konfigurasi Geofence & Master Rules:")
    add_bullet_p(doc, " Melakukan pairing QR code WhatsApp gateway, pengaturan kredensial email SMTP, dan memeriksa log audit kriptografis aktivitas sistem.", "Integrasi Gateway & Audit Trail:")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB IV: STANDAR OPERASIONAL PROSEDUR (SOP STEP-BY-STEP WORKFLOWS)
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB IV: STANDAR OPERASIONAL PROSEDUR (SOP STEP-BY-STEP WORKFLOWS)")
    
    add_heading_2(doc, "4.1 SOP 01: Presensi Harian Mandiri (Selfie, Satelit GPS & Biometrik Wajah)")
    add_body_p(doc, "Tujuan: Memastikan pencatatan kehadiran karyawan akurat, otentik, dan tervalidasi lokasi fisiknya.")
    add_bullet_p(doc, " Karyawan wajib berada di dalam perimeter fisik kantor atau site proyek resmi yang telah ditentukan sistem.", "Langkah 1 (Kesiapan Lokasi):")
    add_bullet_p(doc, " Buka browser, akses portal PRIME HRIS, login dengan akun pribadi, lalu pilih menu 'Presensi Kamera Saya'.", "Langkah 2 (Akses Sistem):")
    add_bullet_p(doc, " Izinkan sistem mengakses sensor kamera depan dan lokasi GPS satelit perangkat. Pastikan indikator akurasi GPS di layar berada di bawah 30 meter.", "Langkah 3 (Kalibrasi Sensor):")
    add_bullet_p(doc, " Hadapkan wajah ke arah kamera, pastikan pencahayaan cukup terang, tanpa mengenakan masker atau kacamata hitam pekat.", "Langkah 4 (Posisi Biometrik):")
    add_bullet_p(doc, " Tekan tombol 'CHECK IN SEKARANG' (pagi) atau 'CHECK OUT SEKARANG' (sore).", "Langkah 5 (Eksekusi Transaksi):")
    add_bullet_p(doc, " Sistem memverifikasi koordinat satelit (rumus Haversine <= 100m) dan mencocokkan vektor wajah (skor AI >= 90%). Suara konfirmasi berbunyi dan notifikasi WhatsApp masuk ke ponsel.", "Langkah 6 (Verifikasi Otomatis):")

    add_heading_2(doc, "4.2 SOP 02: Pengajuan Tiket Permohonan Cuti Tahunan & Roster Non-Lokal")
    add_body_p(doc, "Tujuan: Memberikan transparansi dan kepastian hak istirahat karyawan tanpa mengganggu jadwal operasional proyek.")
    add_bullet_p(doc, " Karyawan membuka menu 'Pengajuan & Izin Saya' lalu menekan tombol '+ Buat Pengajuan Baru'.", "Langkah 1 (Akses Formulir):")
    add_bullet_p(doc, " Pilih kategori 'Cuti Tahunan' (untuk staf reguler) atau 'Cuti Roster Non-Lokal' (untuk teknisi site).", "Langkah 2 (Pilih Kategori):")
    add_bullet_p(doc, " Tentukan tanggal mulai dan selesai cuti. Sistem secara otomatis menghitung jumlah hari kerja efektif (mengabaikan hari libur mingguan dan libur nasional).", "Langkah 3 (Input Tanggal Efektif):")
    add_bullet_p(doc, " Periksa saldo sisa kuota cuti yang ditampilkan otomatis di bawah tanggal. Kuota harus mencukupi.", "Langkah 4 (Validasi Kuota):")
    add_bullet_p(doc, " Klik 'Kirim Pengajuan'. Tiket otomatis dialirkan ke antrean Project Manager (jika ditugaskan di site) dan HR Manager untuk persetujuan final.", "Langkah 5 (Pengiriman & Disposisi):")

    add_heading_2(doc, "4.3 SOP 03: Pengajuan Dispensasi Keterlambatan (Late Justification) & Koreksi Timesheet")
    add_body_p(doc, "Tujuan: Menghapus penalti denda keterlambatan jika karyawan terlambat hadir karena alasan force majeure yang sah.")
    add_bullet_p(doc, " Karyawan yang check-in melampaui batas toleransi shift kerja (misal di atas pukul 08:15) akan otomatis menerima status LATE.", "Langkah 1 (Deteksi Keterlambatan):")
    add_bullet_p(doc, " Buka menu 'Pengajuan & Izin Saya' $\rightarrow$ Pilih tipe 'Dispensasi Keterlambatan (Late Justification)'.", "Langkah 2 (Pilih Dispensasi):")
    add_bullet_p(doc, " Pilih tanggal absensi yang bersangkutan, tuliskan uraian alasan logis (contoh: kecelakaan di tol, penugasan darurat), dan lampirkan bukti foto jika ada.", "Langkah 3 (Uraian Justifikasi):")
    add_bullet_p(doc, " HR Manager meninjau tiket di menu 'Pusat Approval SDM'. Jika disetujui, denda keterlambatan pada periode gaji tersebut langsung dibatalkan (waived).", "Langkah 4 (Otorisasi HR):")

    add_heading_2(doc, "4.4 SOP 04: Pengajuan & Otorisasi Penugasan Dinas Luar (Out-of-Geofence)")
    add_body_p(doc, "Tujuan: Memfasilitasi karyawan yang harus bertugas di luar radius kantor/site tanpa dianggap mangkir/alpha.")
    add_bullet_p(doc, " Karyawan yang berada di lokasi klien/vendor memilih mode presensi 'Dinas Luar' pada menu kamera.", "Langkah 1 (Pilih Mode Dinas):")
    add_bullet_p(doc, " Sistem mengambil foto selfie dan koordinat GPS riil di lokasi dinas luar tersebut.", "Langkah 2 (Snapshot Lokasi Riil):")
    add_bullet_p(doc, " Karyawan memasukkan nomor surat tugas atau nama klien yang dikunjungi pada kotak keterangan.", "Langkah 3 (Uraian Penugasan):")
    add_bullet_p(doc, " Atasan langsung atau HR memvalidasi kesesuaian agenda kerja dan menyetujui tiket dinas luar agar status absensi menjadi resmi hadir penuh.", "Langkah 4 (Validasi Penugasan):")

    add_heading_2(doc, "4.5 SOP 05: Presensi Harian Tukang & Pekerja Lapangan Lepas (Casual Workers)")
    add_body_p(doc, "Tujuan: Mengontrol tenaga kerja harian lepas di site proyek agar tidak terjadi manipulasi jumlah tukang fiktif.")
    add_bullet_p(doc, " Project Manager atau Site Lead membuka menu 'Presensi Tukang Lapangan' pada ponselnya di lokasi site.", "Langkah 1 (Akses Menu PM):")
    add_bullet_p(doc, " Jika ada tukang baru, daftarkan nama lengkap dan spesialisasi keahlian (contoh: Tukang Besi, Tukang Cor).", "Langkah 2 (Pendaftaran Pekerja):")
    add_bullet_p(doc, " Setiap pagi pukul 07:30 - 08:00, PM mengklik tombol 'Ambil Absen Harian Tukang'.", "Langkah 3 (Pengambilan Foto):")
    add_bullet_p(doc, " Arahkan kamera ke wajah pekerja tukang bersangkutan di depan area proyek.", "Langkah 4 (Perekaman Visual):")
    add_bullet_p(doc, " Sistem otomatis mencap stempel tanggal, jam, koordinat GPS proyek, dan nama PM pemverifikasi. Data langsung tersimpan sebagai dasar pencairan kas upah harian.", "Langkah 5 (Penyimpanan Audit):")

    add_heading_2(doc, "4.6 SOP 06: Siklus Tutup Buku Penggajian Bulanan (Dari Cut-Off hingga Distribusi WA)")
    add_body_p(doc, "Tujuan: Memastikan perhitungan upah dan distribusi slip gaji digital selesai tepat waktu dengan akurasi 100%.")
    add_bullet_p(doc, " Pada tanggal 21 setiap bulan, Finance memeriksa rentang cut-off penggajian pada menu 'Kalender Kerja & Cut-Off' (21 bulan lalu s/d 20 bulan berjalan).", "Langkah 1 (Verifikasi Cut-Off):")
    add_bullet_p(doc, " Buka menu 'Payroll & Penggajian', lalu klik tombol 'Jalankan Kalkulasi Payroll'. Sistem memproses seluruh rekapitulasi kehadiran, lembur, dan potongan.", "Langkah 2 (Eksekusi Mesin Gaji):")
    add_bullet_p(doc, " Finance melakukan audit lembar kerja terpadu (melihat detail jam lembur Depnaker dan rincian denda keterlambatan per individu).", "Langkah 3 (Pemeriksaan & Audit):")
    add_bullet_p(doc, " Jika diperlukan, masukkan penyesuaian khusus (bonus kinerja operasional atau potongan kasbon kantor).", "Langkah 4 (Penyesuaian Khusus):")
    add_bullet_p(doc, " Klik 'Export CSV Transfer Bank' untuk mengunduh daftar transfer siap upload ke perbankan korporat.", "Langkah 5 (Ekspor File Perbankan):")
    add_bullet_p(doc, " Klik tombol hijau 'Kirim Semua Slip Gaji via WhatsApp'. Bot WhatsApp akan mengirimkan slip gaji resmi berformat rapi langsung ke nomor pribadi masing-masing staf.", "Langkah 6 (Distribusi Slip Digital):")

    add_heading_2(doc, "4.7 SOP 07: Operasional Terminal Kiosk Presensi Publik Lobby / Site Gate")
    add_body_p(doc, "Tujuan: Menyediakan terminal presensi cepat, higienis, dan tanpa perlu login untuk gerbang masuk pabrik/kantor.")
    add_bullet_p(doc, " Petugas IT / Pos Keamanan membuka browser pada tablet kiosk dengan URL parameter: ?tab=kiosk atau ?kiosk=true.", "Langkah 1 (Aktivasi Mode Kiosk):")
    add_bullet_p(doc, " Layar kiosk otomatis masuk ke tampilan sandboxed yang bersih tanpa mengekspos informasi rahasia gaji atau rekening staf.", "Langkah 2 (Proteksi Data Publik):")
    add_bullet_p(doc, " Karyawan mendekati tablet: sistem mendeteksi wajah dan mencocokkan dengan galeri biometrik dalam 0.8 detik (Opsi Wajah), atau karyawan mengetikkan 4 digit NIK pada keypad sentuh (Opsi PIN).", "Langkah 3 (Pindai Presensi):")
    add_bullet_p(doc, " Sistem menampilkan pesan konfirmasi: 'Selamat Datang, [Nama Karyawan] - Presensi Masuk Berhasil' dan mencatat log kehadiran ke server pusat.", "Langkah 4 (Konfirmasi Seketika):")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB V: FORMULA PERHITUNGAN MATEMATIS & ATURAN BISNIS
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB V: FORMULA PERHITUNGAN MATEMATIS & ATURAN BISNIS (BUSINESS RULES)")
    
    add_heading_2(doc, "5.1 Formula Upah Lembur Standar Depnaker RI (PP 35/2021)")
    add_body_p(doc, 
        "Perhitungan upah kerja lembur di dalam PRIME HRIS mengadopsi secara ketat regulasi ketenagakerjaan pemerintah "
        "Republik Indonesia (PP Nomor 35 Tahun 2021) untuk menjamin kepatuhan audit hukum ketenagakerjaan:"
    )
    add_body_p(doc, "1. Tarif Dasar Upah Per Jam:\n   Tarif Per Jam = (1 / 173) x Gaji Pokok Bulanan")
    add_body_p(doc, "2. Perhitungan Hari Kerja Reguler (Senin - Jumat/Sabtu):\n   • Jam Pertama Lembur: 1.5 x Tarif Per Jam\n   • Jam Kedua dan Seterusnya: 2.0 x Tarif Per Jam")
    add_body_p(doc, "3. Perhitungan Hari Libur Resmi / Akhir Pekan:\n   • Jam ke-1 s/d Jam ke-7: 2.0 x Tarif Per Jam\n   • Jam ke-8: 3.0 x Tarif Per Jam\n   • Jam ke-9 dan seterusnya: 4.0 x Tarif Per Jam")

    add_heading_2(doc, "5.2 Formula Skema Penalti Potongan Keterlambatan Bertingkat")
    add_body_p(doc, 
        "Sistem menerapkan skema denda keterlambatan bertingkat (Tiered Penalty) untuk menegakkan kedisiplinan kerja industri:"
    )
    add_bullet_p(doc, " Keterlambatan 1 s/d 15 menit dari jam shift kerja tidak dikenakan denda pemotongan gaji.", "Tier 0 (Grace Period 0 - 15 Menit):")
    add_bullet_p(doc, " Keterlambatan 16 s/d 30 menit dikenakan potongan 0.5% dari gaji pokok harian.", "Tier 1 (Keterlambatan 16 - 30 Menit):")
    add_bullet_p(doc, " Keterlambatan 31 s/d 60 menit dikenakan potongan 1.0% dari gaji pokok harian.", "Tier 2 (Keterlambatan 31 - 60 Menit):")
    add_bullet_p(doc, " Keterlambatan di atas 60 menit tanpa keterangan dikenakan pemotongan 1 hari upah harian penuh.", "Tier 3 (Keterlambatan > 60 Menit):")
    add_body_p(doc, "*Catatan Khusus: Seluruh potongan keterlambatan otomatis dibatalkan sistem jika karyawan memiliki tiket 'Dispensasi Keterlambatan' yang disetujui oleh HR Manager.")

    add_heading_2(doc, "5.3 Formula Iuran Jaminan Sosial Ketenagakerjaan & Kesehatan (BPJS)")
    add_body_p(doc, "Kalkulasi pemotongan iuran jaminan sosial BPJS mengikuti ketentuan perundang-undangan nasional:")
    
    t_bpjs = doc.add_table(rows=6, cols=4)
    t_bpjs.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_bpjs, "CBD5E1", "4")
    bpjs_headers = ["Program Jaminan Sosial", "Porsi Ditanggung Karyawan", "Porsi Ditanggung Perusahaan", "Dasar Pengenaan & Plafon Upah"]
    bpjs_data = [
        ["BPJS JHT (Hari Tua)", "2.0% (Potong Gaji)", "3.7% (Beban Perusahaan)", "Gaji Pokok + Tunjangan Tetap (Tanpa Batas Plafon)"],
        ["BPJS JP (Pensiun)", "1.0% (Potong Gaji)", "2.0% (Beban Perusahaan)", "Gaji Pokok (Batas Plafon Maksimal Rp 10.042.300)"],
        ["BPJS JKK (Kecelakaan Kerja)", "0.0% (Gratis Karyawan)", "0.89% (Beban Perusahaan)", "Sesuai tingkat risiko operasional manufaktur/proyek"],
        ["BPJS JKM (Kematian)", "0.0% (Gratis Karyawan)", "0.30% (Beban Perusahaan)", "Gaji Pokok + Tunjangan Tetap"],
        ["BPJS Kesehatan", "1.0% (Potong Gaji)", "4.0% (Beban Perusahaan)", "Batas Plafon Upah Maksimal Rp 12.000.000"]
    ]
    format_table_headers_and_data(t_bpjs, [1.8, 1.6, 1.6, 1.8], bpjs_headers, bpjs_data)

    add_heading_2(doc, "5.4 Formula Pajak Penghasilan Pasal 21 Tarif Efektif Rata-Rata (PPh 21 TER)")
    add_body_p(doc, 
        "Sesuai Peraturan Pemerintah Nomor 58 Tahun 2023, penghitungan PPh 21 bulanan menggunakan skema Tarif Efektif Rata-Rata (TER):"
    )
    add_bullet_p(doc, " Diberlakukan untuk karyawan status PTKP TK/0, TK/1, dan K/0 dengan tarif progresif mulai dari 0% hingga 34% berdasarkan tabel bracket penghasilan bruto bulanan.", "Kategori TER A:")
    add_bullet_p(doc, " Diberlakukan untuk karyawan status PTKP TK/2, TK/3, K/1, dan K/2.", "Kategori TER B:")
    add_bullet_p(doc, " Diberlakukan untuk karyawan status PTKP K/3.", "Kategori TER C:")
    add_body_p(doc, "Rumus Perhitungan PPh 21 Bulanan:\n   PPh 21 Terutang = Penghasilan Bruto Bulan Berjalan x Persentase Tarif Efektif TER Terkait")

    add_heading_2(doc, "5.5 Formula Alokasi Pembebanan Biaya Tenaga Kerja ke Proyek (Labor Cost Allocation)")
    add_body_p(doc, 
        "Untuk memantau kesehatan finansial setiap kontrak proyek, biaya upah teknisi dialokasikan secara proporsional:\n"
        "   Biaya Tenaga Kerja Proyek = (Jam Hadir di Site Proyek / Total Jam Kerja) x (Gaji Pokok + Tunjangan) + Upah Lembur Proyek Riil\n"
        "Nilai ini langsung diakumulasikan ke tabel projects.actualLaborCost untuk dibandingkan terhadap projects.allocatedBudget."
    )

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB VI: PANDUAN INTEGRASI ENGINE OTOMATIS & BACKEND SERVICES
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB VI: PANDUAN INTEGRASI ENGINE OTOMATIS & BACKEND SERVICES")
    
    add_heading_2(doc, "6.1 WhatsApp Bot Gateway (Baileys Socket & Whitelist Opt-In)")
    add_body_p(doc, 
        "PRIME HRIS mengoperasikan modul server/whatsappService.js berbasis Baileys library multi-device. "
        "Modul ini terhubung langsung ke WebSocket WhatsApp tanpa melalui perantara API komersial berbayar."
    )
    add_body_p(doc, 
        "Protokol Anti-Banned Whitelist Opt-In:\n"
        "Untuk mencegah nomor bot kantor diblokir oleh sistem anti-spam Meta WhatsApp, sistem menerapkan tabel wa_opt_ins. "
        "Setiap karyawan yang baru bergabung diwajibkan mengirimkan satu pesan pembuka (contoh: 'Halo HRIS') ke nomor WhatsApp bot. "
        "Begitu tercatat di wa_opt_ins, nomor tersebut masuk ke whitelist sehingga aman menerima slip gaji dan notifikasi sistem secara berkala."
    )

    add_heading_2(doc, "6.2 SMTP Email Notification Transporter")
    add_body_p(doc, 
        "Dikelola oleh modul server/emailService.js menggunakan engine Nodemailer. Digunakan untuk keperluan:\n"
        "1. Pengiriman notifikasi pembaharuan kata sandi (Password Reset) dengan token verifikasi kriptografis.\n"
        "2. Pengiriman ringkasan laporan eksekutif mingguan ke jajaran Direksi.\n"
        "3. Pengiriman surat peringatan kedisiplinan resmi secara otomatis bagi karyawan yang mangkir."
    )

    add_heading_2(doc, "6.3 Engine Pengenalan Wajah AI (FaceNet 128D & Anti-Spoofing)")
    add_body_p(doc, 
        "Ditenagai oleh library Face-API / Python sidecar (face_engine_vps.py) berbasis arsitektur deep neural network ResNet-34:\n"
        "• Ekstraksi Landmark: Mendeteksi 68 koordinat fitur geometris wajah (mata, hidung, rahang, bibir).\n"
        "• Vektor 128-Dimensi: Mengubah fitur wajah menjadi array 128 angka float unik.\n"
        "• Euclidean Distance Thresholding: Membandingkan vektor snapshot presensi terhadap master biometrik. "
        "Jika jarak Euclidean <= 0.45, sistem memvalidasi kecocokan dengan keyakinan di atas 95%.\n"
        "• Proteksi Anti-Spoofing: Menganalisis variasi tekstur kulit dan mikro-kedipan untuk menolak foto cetak kertas atau video rekaman smartphone."
    )

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB VII: TATA KELOLA AUDIT TRAIL, KEAMANAN & MANAJEMEN RISIKO
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB VII: TATA KELOLA AUDIT TRAIL, KEAMANAN & MANAJEMEN RISIKO")
    
    add_heading_2(doc, "7.1 Prinsip Desain Audit Trail Kriptografis")
    add_body_p(doc, 
        "Sesuai standar audit industri manufaktur dan perbankan (IATF 16949 / ISO 27001), modul Audit Trail dirancang dengan prinsip:"
    )
    add_bullet_p(doc, " Tabel audit_logs hanya menerima operasi penambahan data (INSERT). Tidak ada perintah UPDATE atau DELETE yang diizinkan pada level aplikasi.", "Immutability (Kekekalan Data):")
    add_bullet_p(doc, " Setiap entri merekam NIK, Nama Karyawan, Peran Sistem, Modul yang Dimodifikasi, dan Alamat IP Address perangkat asal.", "Non-Repudiation (Tak Dapat Disangkal):")
    add_bullet_p(doc, " Stempel waktu dicatat dengan presisi milidetik menggunakan waktu server terkalibrasi NTP internasional.", "High Precision Timestamp:")

    add_heading_2(doc, "7.2 Prosedur Penelusuran Insiden (Forensic Audit Walkthrough)")
    add_body_p(doc, "Jika tim investigasi internal mencurigai adanya manipulasi jam lembur atau pengubahan nomor rekening:")
    add_body_p(doc, "1. Masuk ke tab AUDIT TRAIL & LOG dengan akun Superuser.")
    add_body_p(doc, "2. Gunakan filter pencarian: masukkan modul 'PAYROLL' atau 'EMPLOYEES' dan NIK karyawan yang dicurigai.")
    add_body_p(doc, "3. Analisis kolom 'details' dan 'metadata' yang memperlihatkan nilai variabel sebelum diubah (Old Value) dan sesudah diubah (New Value).")
    add_body_p(doc, "4. Catat alamat IP dan identitas akun pelaku perubahan sebagai barang bukti audit resmi.")

    add_heading_2(doc, "7.3 Manajemen Pencadangan Basis Data & Pemulihan Bencana")
    add_body_p(doc, 
        "Karena basis data SQLite menggunakan berkas tunggal (data/hris.sqlite) dengan mode WAL, prosedur pencadangan sangat cepat dan aman:\n"
        "• Pencadangan Otomatis Harian: Skrip cronjob server mengeksekusi perintah SQLite Online Backup setiap pukul 02:00 dini hari tanpa perlu menghentikan layanan (zero downtime).\n"
        "• Retensi Cadangan: Berkas cadangan dikompresi menjadi tar.gz terenkripsi dan disimpan di off-site cloud storage dengan retensi 30 hari kalender.\n"
        "• Prosedur Pemulihan (RTO < 5 Menit): Dalam kondisi darurat kegagalan server, cukup salin berkas hris.sqlite cadangan terakhir ke folder data/ dan jalankan kembali service Node.js."
    )

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB VIII: TROUBLESHOOTING OPERASIONAL, PANDUAN MASALAH & FAQ
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB VIII: TROUBLESHOOTING OPERASIONAL, PANDUAN MASALAH & FAQ")
    
    add_heading_2(doc, "8.1 Matriks Diagnosis Masalah Klien & Perangkat Lapangan")

    t_trb = doc.add_table(rows=6, cols=4)
    t_trb.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_trb, "CBD5E1", "4")
    trb_headers = ["Gejala Masalah", "Kemungkinan Akar Penyebab", "Tindakan Korektif Mandiri Pengguna", "Eskalasi Lanjutan"]
    trb_data = [
        ["Layar kamera hitam / tidak muncul video", "Izin kamera diblokir browser atau kamera sedang dipakai aplikasi lain (Zoom/WA)", "Klik ikon gembok pada address bar browser, setel Camera = Allow, muat ulang (refresh) halaman.", "Hubungi IT jika webcam perangkat rusak fisik."],
        ["Indikator GPS Merah (Di luar radius)", "Satelit ponsel belum terkunci akurat atau berada di dalam gedung beton tebal", "Buka Google Maps di ponsel agar GPS terkunci, pastikan mode Akurasi Tinggi aktif, keluar ke area terbuka.", "Jika memang dinas luar, gunakan opsi mode 'Dinas Luar'."],
        ["Wajah tidak cocok (Score < 85%)", "Pencahayaan backlight gelap, memakai masker/kacamata tebal, atau sudut miring", "Lepas masker/kacamata, posisikan wajah tegak lurus menghadap sumber cahaya di dalam lingkaran panduan oval.", "Minta HRD melakukan Re-Enroll Biometrik Wajah baru."],
        ["Slip gaji WhatsApp tidak masuk", "Nomor ponsel salah format atau belum melakukan Opt-In pertama ke nomor bot", "Kirimkan pesan WhatsApp apapun (misal: 'Halo HRIS') ke nomor bot kantor agar nomor terdaftar di whitelist opt-in.", "Periksa nomor telepon di data karyawan (wajib 628...)."],
        ["Lupa password login akun", "Salah memasukkan kata sandi lebih dari batas toleransi", "Gunakan fitur 'Lupa Password' pada layar login untuk menerima tautan reset kata sandi via email resmi.", "Minta HRD menekan tombol 'Reset Password' di menu Data Karyawan."]
    ]
    format_table_headers_and_data(t_trb, [1.4, 1.6, 2.4, 1.4], trb_headers, trb_data)

    add_heading_2(doc, "8.2 Tanya Jawab Teknis Sering Diajukan (FAQ Komprehensif)")
    add_body_p(doc, 
        "Q1: Apakah data absensi tetap aman jika mendadak koneksi internet mati saat menekan tombol check-in?\n"
        "A1: Ya. Sistem dilengkapi dengan arsitektur Local Storage Invalidation & Offline Retry. Begitu koneksi internet pulih kembali, data presensi yang tertunda akan langsung dikirimkan ke server SQLite secara otomatis."
    )
    add_body_p(doc, 
        "Q2: Bagaimana jika seorang staf harus berpindah ke dua lokasi proyek berbeda dalam satu hari?\n"
        "A2: Sistem mendukung multi-check-in harian. Karyawan cukup melakukan check-out dari proyek pertama dan melakukan check-in kembali di lokasi proyek kedua. Sistem akan membagi pembebanan jam kerja proyek secara proporsional."
    )
    add_body_p(doc, 
        "Q3: Apakah kuota cuti tahunan akan hangus jika tidak digunakan?\n"
        "A3: Kebijakan hangusnya kuota diatur melalui konfigurasi kalender kerja tahunan oleh HR Manager. Untuk staf non-lokal di site, tersedia fitur Fleksibilitas Akumulasi Cuti Roster yang dapat dialihkan ke siklus periode berikutnya."
    )
    add_body_p(doc, 
        "Q4: Apakah slip gaji yang dicetak melalui sistem diakui sah secara hukum?\n"
        "A4: Sangat sah. Slip gaji yang digenerasi memuat identitas perusahaan, rincian upah terperinci, Nomor Induk Karyawan resmi, kode verifikasi digital QR, serta stempel audit trail yang sah untuk keperluan pengajuan perbankan (KPR/Kredit) maupun pelaporan SPT Tahunan."
    )

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB IX: DAFTAR ISTILAH & GLOSARIUM ENTERPRISE
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB IX: DAFTAR ISTILAH & GLOSARIUM ENTERPRISE")
    
    t_glo = doc.add_table(rows=11, cols=3)
    t_glo.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_glo, "CBD5E1", "4")
    glo_headers = ["Istilah / Terminologi", "Kategori Bidang", "Definisi Operasional & Konteks Sistem"]
    glo_data = [
        ["Zero Manual System", "Engineering Philosophy", "Prinsip eliminasi total tugas manual berulang melalui otomatisasi perangkat lunak dan validasi otonom."],
        ["Geofencing", "Satelit GPS Telemetry", "Pembatasan wilayah geografis virtual berbentuk lingkaran radius meter di sekitar koordinat fisik kantor/proyek."],
        ["Haversine Formula", "Mathematics", "Formula trigonometri bola untuk menghitung jarak terpendek antara dua titik koordinat lintang/bujur di permukaan bumi."],
        ["Biometric Vector (128D)", "Computer Vision / AI", "Representasi matematis fitur wajah berupa 128 angka float yang diekstrak oleh jaringan saraf tiruan (neural network)."],
        ["WAL Mode (Write-Ahead Log)", "Database Architecture", "Teknik pencatatan transaksi basis data SQLite di mana mutasi dicatat di file log terpisah sebelum digabung ke file master."],
        ["Cut-Off Penggajian", "Human Resources / Finance", "Batas penutupan siklus pencatatan absensi harian dan lembur untuk perhitungan gaji bulanan (default tgl 21 s/d 20)."],
        ["Depnaker Overtime PP 35/2021", "Labor Law Compliance", "Standar rumus upah lembur resmi pemerintah dengan pembagi upah 1/173 dan pengali 1.5x jam pertama serta 2.0x jam berikutnya."],
        ["PPh 21 TER (PP 58/2023)", "Tax Regulations", "Pajak Penghasilan Pasal 21 dengan skema Tarif Efektif Rata-Rata berdasarkan kategori PTKP bulanan bruto."],
        ["Baileys Multi-Device", "Messaging Technology", "Library Node.js untuk berkomunikasi langsung dengan WebSocket WhatsApp Web tanpa dependensi antarmuka pihak ketiga."],
        ["Audit Trail Kriptografis", "Cybersecurity & Governance", "Rekaman jejak digital permanen bersifat append-only yang membuktikan keaslian setiap transaksi tanpa risiko manipulasi."]
    ]
    format_table_headers_and_data(t_glo, [1.8, 1.4, 3.6], glo_headers, glo_data)

    # Final document footer note
    add_callout(doc, "Penutup & Dukungan Teknis", 
        "Buku Panduan Penggunaan Sistem PRIME HRIS Enterprise ini diperbarui secara berkala mengikuti perkembangan rilis sistem. "
        "Untuk konsultasi arsitektur lebih lanjut, kustomisasi modul khusus, atau pelaporan kendala infrastruktur, silakan hubungi tim Systems Architecture "
        "Prime Projectx melalui portal resmi https://primeprojectx.net atau saluran hotline dukungan teknis korporat.",
        bg_color="F8FAFC", border_color="18345E", title_color="18345E")

    # Add headers and footers to all sections
    add_header_footer(doc)

    # Save to target file
    output_dir = r"C:\Users\prime\prime-hris\docs"
    os.makedirs(output_dir, exist_ok=True)
    out_docx_path = os.path.join(output_dir, "BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.docx")
    doc.save(out_docx_path)
    print(f"[SUCCESS] Document generated: {out_docx_path}")

    # Also make a copy in artifact directory and Documents directory
    artifact_dir = r"C:\Users\prime\.gemini\antigravity-cli\brain\4fbf6728-925d-466f-87af-e179e5f86f48"
    if os.path.exists(artifact_dir):
        doc.save(os.path.join(artifact_dir, "BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.docx"))
        print(f"[SUCCESS] Copy saved to artifact directory: {artifact_dir}")

    docs_user = r"C:\Users\prime\Documents"
    if os.path.exists(docs_user):
        doc.save(os.path.join(docs_user, "BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.docx"))
        print(f"[SUCCESS] Copy saved to Documents: {docs_user}")

if __name__ == "__main__":
    build_prime_hris_manual()
