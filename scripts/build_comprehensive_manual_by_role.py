"""
PRIME HRIS ENTERPRISE - COMPREHENSIVE ROLE-SEPARATED MANUAL BUILDER
Menghasilkan buku panduan sangat detail dengan pemisahan per peran (Role-Based Isolation)
Output: C:/Users/prime/prime-hris/docs/BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.docx
"""

import os
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

from generate_full_manual_docx import (
    set_cell_shading, set_cell_margins, set_table_borders, set_callout_borders,
    add_callout, add_header_footer, format_table_headers_and_data,
    add_heading_1, add_heading_2, add_heading_3, add_body_p, add_bullet_p
)

def create_full_role_manual():
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

    # ---------------------------------------------------------------------------
    # HALAMAN SAMPUL (COVER PAGE)
    # ---------------------------------------------------------------------------
    p_banner = doc.add_paragraph()
    p_banner.paragraph_format.space_before = Pt(24)
    p_banner.paragraph_format.space_after = Pt(4)
    r_banner = p_banner.add_run("PRIME PROJECTX ENTERPRISE ECOSYSTEM • INDUSTRIAL AUTOMATION & ANALYTICS")
    r_banner.font.name = "Segoe UI"
    r_banner.font.size = Pt(8.5)
    r_banner.font.bold = True
    r_banner.font.color.rgb = COLOR_ACCENT

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(6)
    p_title.paragraph_format.space_after = Pt(4)
    r_title = p_title.add_run("BUKU PANDUAN PENGGUNAAN SISTEM\nPRIME HRIS ENTERPRISE")
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(22)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(2)
    p_sub.paragraph_format.space_after = Pt(14)
    r_sub = p_sub.add_run(
        "PANDUAN OPERASIONAL TERPISAH PER PERAN (ROLE-BASED MANUAL), ARSITEKTUR RBAC 5-TIER, "
        "SOP ALUR PRESENSI LENGKAP & TATA KELOLA KETERKAITAN DATA (DATA LINEAGE) LINTAS MODUL"
    )
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(10.5)
    r_sub.font.bold = True
    r_sub.font.color.rgb = COLOR_SECONDARY

    # Logo PX
    logo_path = r"C:\Users\prime\Downloads\px_logo_1790087710977.png"
    if os.path.exists(logo_path):
        p_logo = doc.add_paragraph()
        p_logo.paragraph_format.space_before = Pt(10)
        p_logo.paragraph_format.space_after = Pt(16)
        p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_logo.add_run().add_picture(logo_path, width=Inches(2.2))

    p_desc = doc.add_paragraph()
    p_desc.paragraph_format.space_before = Pt(8)
    p_desc.paragraph_format.space_after = Pt(16)
    p_desc.paragraph_format.line_spacing = 1.15
    r_desc = p_desc.add_run(
        "Buku manual operasional komprehensif yang dirancang secara khusus dengan pemisahan independen untuk setiap peran pengguna "
        "(Staff Umum/Teknisi, Project Manager, HR/Admin SDM, Finance/Payroll, dan Superuser/Direksi). "
        "Dilengkapi dengan visualisasi arsitektur RBAC, analisis mendalam setiap menu dan tombol aksi, diagram silsilah keterkaitan data (data lineage), "
        "5 skenario alur presensi harian, tata cara persetujuan berjenjang, formula penggajian Depnaker, serta panduan audit trail kriptografis."
    )
    r_desc.font.name = "Segoe UI"
    r_desc.font.size = Pt(9.5)
    r_desc.font.color.rgb = COLOR_TEXT

    # Cover Metadata Table
    t_meta = doc.add_table(rows=6, cols=2)
    t_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_meta, "CBD5E1", "4")
    
    meta_rows = [
        ("Nomor Dokumen", "DOC-PRIME-HRIS-MANUAL-2026-V2"),
        ("Edisi / Versi Rilis", "Versi 2.4-LTS (Dedicated Role-Based Manual Release)"),
        ("Tanggal Efektif", "30 Oktober 2026"),
        ("Klasifikasi Dokumen", "Enterprise Restricted Standard / Dokumen Operasional Korporat"),
        ("Lead Systems Architect", "Galih Primananda (PT Prime Infinity Systems / Prime Projectx)"),
        ("Repositori & SSOT", "https://github.com/PrimeFox59/prime-hris.git")
    ]
    
    for r_idx, (lbl, val) in enumerate(meta_rows):
        row = t_meta.rows[r_idx]
        c0, c1 = row.cells[0], row.cells[1]
        c0.text = lbl
        c1.text = val
        set_cell_shading(c0, "F1F5F9")
        set_cell_shading(c1, "FFFFFF")
        set_cell_margins(c0, 60, 60, 120, 120)
        set_cell_margins(c1, 60, 60, 120, 120)
        c0.width = Inches(2.3)
        c1.width = Inches(4.5)
        
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
    # PENGESAHAN DIGITAL & PENGENDALIAN VERSI
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "LEMBAR PENGESAHAN DIGITAL & PENGENDALIAN MUTU SISTEM")
    
    add_heading_2(doc, "A. Pengesahan Arsitektur Digital (Enterprise Digital Standard)")
    add_body_p(doc, 
        "Sesuai Kebijakan Rekayasa Sistem Prime Projectx, dokumen ini merupakan System-Automated Digital Enterprise Report. "
        "Kebenaran logika arsitektur, relasi entitas basis data SQLite WAL, integrasi socket WhatsApp Baileys, serta formula kalkulator payroll "
        "diverifikasi langsung terhadap basis kode produksi aktif pada repositori https://github.com/PrimeFox59/prime-hris.git. "
        "Dokumen berstatus Sah dan Mengikat secara digital tanpa memerlukan kolom tanda tangan kertas konvensional."
    )
    
    add_callout(doc, "Prinsip Pemisahan Buku Panduan Per Peran (Role Separation)", 
        "Untuk mencegah kebingungan pengguna di lapangan, buku panduan ini membagi panduan operasional ke dalam bab-bab khusus independen "
        "untuk setiap peran (Staff, Project Manager, HR, Finance, Superuser). Pengguna hanya perlu membaca bab yang sesuai dengan perannya masing-masing "
        "untuk memahami seluruh tugas, fungsi tombol, input data, dan keterkaitan data yang dihasilkannya.",
        bg_color="EFF6FF", border_color="18345E", title_color="18345E")

    add_heading_2(doc, "B. Tabel Matriks Riwayat Pemeliharaan Dokumen")
    t_rev = doc.add_table(rows=4, cols=5)
    t_rev.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_rev, "CBD5E1", "4")
    rev_headers = ["Rev", "Tanggal", "Penyusun", "Ruang Lingkup Perubahan", "Status Validasi"]
    rev_data = [
        ["1.0", "15 Agu 2026", "Galih P.", "Inisialisasi spesifikasi sistem & integrasi kamera webcam", "Superseded"],
        ["2.0", "28 Sep 2026", "Galih P.", "Integrasi biometrik ResNet 128D, WhatsApp Baileys & Cuti Roster", "Superseded"],
        ["2.4", "30 Okt 2026", "Galih P.", "Pemisahan lengkap panduan per role, audit trail permanen & buku 50 halaman", "Disahkan (SSOT)"]
    ]
    format_table_headers_and_data(t_rev, [0.6, 1.1, 1.0, 3.2, 0.9], rev_headers, rev_data)

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # DAFTAR ISI LENGKAP & TERSTRUKTUR
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "DAFTAR ISI LENGKAP BUKU PANDUAN")
    add_body_p(doc, "Navigasi terpadu seluruh bab, sub-bab, dan pembahasan operasional sistem PRIME HRIS Enterprise:")

    t_toc = doc.add_table(rows=14, cols=3)
    t_toc.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_toc, "CBD5E1", "4")
    
    toc_headers = ["Bab / Bagian", "Struktur Pembahasan & Rincian Materi Peran", "Cakupan Halaman"]
    toc_data = [
        ["LEMBAR PENGESAHAN", "Pengendalian Versi Dokumen & Standar Pengesahan Digital Tanpa Kertas", "Hal. 2"],
        ["BAB I", "ARSITEKTUR DASAR SISTEM & PENJELASAN MENDALAM RBAC 5-TIER\n• 1.1 Filosofi Zero Manual System\n• 1.2 Pilar Arsitektur Edge-Cloud Hybrid\n• 1.3 Penjelasan Mendalam Konsep & Matriks RBAC 5-Tier\n• 1.4 Hirarki & Hak Akses Pengguna", "Hal. 4 - 7"],
        ["BAB II", "STRUKTUR DATA, SILSILAH ENTITAS & PETA KETERKAITAN DATA (DATA LINEAGE)\n• 2.1 Peta Topologi Keterkaitan Data End-to-End\n• 2.2 Kamus Entitas Master & Transaksional Lengkap\n• 2.3 Matriks Hubungan Antar-Tabel (Dari Mana ke Mana & Fungsinya)\n• 2.4 Matriks Ketergantungan Data & Efek Domino (Cascading Impact)", "Hal. 8 - 14"],
        ["BAB III", "ALUR KERJA PRESENSI LENGKAP & MULTI-METODE (5 SKENARIO)\n• 3.1 Alur 1: Presensi Kamera Selfie GPS Satelit Mandiri\n• 3.2 Alur 2: Presensi Tukang Lapangan / Pekerja Harian Lepas\n• 3.3 Alur 3: Terminal Kiosk Publik di Lobby / Site Gate\n• 3.4 Alur 4: Presensi Penugasan Dinas Luar (Out-of-Geofence)\n• 3.5 Alur 5: Rekonsiliasi & Koreksi Jam Kehadiran oleh HR", "Hal. 15 - 20"],
        ["BAB IV", "PANDUAN KHUSUS ROLE 1 — STAFF (KARYAWAN & TEKNISI UMUM)\n• 4.1 Profil Peran & Batasan Wewenang Staff\n• 4.2 Detail 5 Menu Navigasi Staff (Tujuan, Fungsi Tombol, Input & Keterkaitan)\n• 4.3 Alur Operasional Harian Staf\n• 4.4 Keterkaitan Data Staf ke Peran Lain (PM, HR, Finance)", "Hal. 21 - 26"],
        ["BAB V", "PANDUAN KHUSUS ROLE 2 — PROJECT MANAGER & SITE COORDINATOR\n• 5.1 Profil Peran & Wewenang Khusus PM di Lapangan\n• 5.2 Detail Menu Manajemen Proyek, Presensi Tukang & Otorisasi Tim\n• 5.3 Alur Kerja Harian PM di Lokasi Proyek\n• 5.4 Keterkaitan Data Proyek ke HR dan Finance (Labor Cost Allocation)", "Hal. 27 - 32"],
        ["BAB VI", "PANDUAN KHUSUS ROLE 3 — HR / ADMIN SDM\n• 6.1 Profil Peran & Wewenang Personalia\n• 6.2 Detail 9 Menu Navigasi HR (Master Karyawan, Biometrik, Approval, Kalender)\n• 6.3 Siklus Bulanan & Tata Kelola Kuota Cuti / Roster\n• 6.4 Keterkaitan Data HR terhadap Payroll Finance & Legal Ketenagakerjaan", "Hal. 33 - 39"],
        ["BAB VII", "PANDUAN KHUSUS ROLE 4 — FINANCE & PAYROLL SPECIALIST\n• 7.1 Profil Peran & Otoritas Keuangan Perusahaan\n• 7.2 Detail 9 Menu Navigasi Finance (Payroll, Bank Transfer, Invoice, Labor Cost)\n• 7.3 Siklus Tutup Buku Penggajian Bulanan Step-by-Step\n• 7.4 Keterkaitan Data Finansial ke Anggaran Proyek & Distribusi Slip WhatsApp", "Hal. 40 - 45"],
        ["BAB VIII", "PANDUAN KHUSUS ROLE 5 — SUPERUSER & MANAJEMEN DIREKSI\n• 8.1 Profil Peran & Wewenang Eksekutif Root\n• 8.2 Detail Menu Dashboard Terpadu, Setting Geofence & Aturan Gaji\n• 8.3 Prosedur Emergency Recovery, Backup Database & Audit Trail Kriptografis", "Hal. 46 - 49"],
        ["BAB IX", "FORMULA PERHITUNGAN MATEMATIS & ATURAN BISNIS FINANSIAL\n• 9.1 Formula Lembur Depnaker RI (PP 35/2021)\n• 9.2 Formula Denda Keterlambatan Bertingkat\n• 9.3 Formula BPJS Ketenagakerjaan & Kesehatan\n• 9.4 Formula PPh 21 TER (PP 58/2023)\n• 9.5 Formula Pembebanan Biaya Tenaga Kerja ke Proyek", "Hal. 50 - 53"],
        ["BAB X", "PANDUAN INTEGRASI ENGINE OTOMATIS & BACKEND SERVICES\n• 10.1 WhatsApp Bot Baileys Socket & Whitelist Opt-In\n• 10.2 SMTP Nodemailer Gateway\n• 10.3 Engine AI Wajah ResNet 128D & Anti-Spoofing", "Hal. 54 - 55"],
        ["BAB XI", "TROUBLESHOOTING MANDIRI BERDASARKAN PERAN & FAQ\n• 11.1 Matriks Solusi Masalah untuk Staf Lapangan\n• 11.2 Matriks Solusi Masalah untuk PM & HR Admin\n• 11.3 Matriks Solusi Masalah untuk Finance & IT Superuser\n• 11.4 FAQ Komprehensif", "Hal. 56 - 58"],
        ["BAB XII", "DAFTAR ISTILAH & GLOSARIUM ENTERPRISE", "Hal. 59 - 60"]
    ]
    format_table_headers_and_data(t_toc, [1.4, 4.6, 0.8], toc_headers, toc_data)

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB I: ARSITEKTUR DASAR & PENJELASAN MENDALAM RBAC 5-TIER
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB I: ARSITEKTUR DASAR SISTEM & PENJELASAN MENDALAM RBAC 5-TIER")
    
    add_heading_2(doc, "1.1 Filosofi Zero Manual System")
    add_body_p(doc, 
        "PRIME HRIS Enterprise dibangun dengan visi tunggal: Zero Manual System. Seluruh gesekan operasional yang lazim "
        "memperlambat produktivitas perusahaan manufaktur, kontraktor, dan multi-cabang dieliminasi melalui otomatisasi cerdas. "
        "Tidak ada lagi kertas presensi fisik yang tercecer, rekapitulasi lembur manual di spreadsheet berhari-hari, "
        "penghitungan denda keterlambatan yang memicu perselisihan, maupun pencetakan slip gaji kertas yang menghabiskan biaya operasional."
    )

    add_heading_2(doc, "1.2 Pilar Arsitektur Edge-Cloud Hybrid")
    add_body_p(doc, "Sistem beroperasi di atas fondasi teknologi berkinerja tinggi:")
    add_bullet_p(doc, " Menggunakan React 18, TypeScript, Tailwind CSS, Lucide Icons, dan Apache ECharts. Menerapkan caching cerdas lokal sehingga pengguna tetap dapat bernavigasi cepat meskipun koneksi internet di lokasi proyek mengalami penurunan kualitas sinyal.", "1. Frontend Responsif Multi-Platform:")
    add_bullet_p(doc, " Server HTTP mandiri berbasis Node.js yang dilengkapi kompresi GZIP otomatis, transmisi Server-Sent Events (SSE) untuk pembaruan data real-time, dan pemrosesan asinkronus tanpa blocking.", "2. Runtime Backend Node.js Berkecepatan Tinggi:")
    add_bullet_p(doc, " Menggunakan engine native SQLite 3 (node:sqlite) yang dikonfigurasi dengan Write-Ahead Logging (WAL) dan PRAGMA synchronous = NORMAL. Menghasilkan kecepatan baca/tulis mikrodetik, bebas ketergantungan koneksi jaringan database eksternal, dan kebal dari kerusakan data saat mati lampu.", "3. Basis Data SQLite 3 Native Berbasis WAL:")
    add_bullet_p(doc, " Library Baileys multi-device socket yang terhubung langsung ke WhatsApp Web tanpa pihak ketiga berbayar untuk mendistribusikan slip gaji dan tiket persetujuan seketika.", "4. WhatsApp Gateway Mandiri:")

    add_heading_2(doc, "1.3 Penjelasan Mendalam Konsep & Matriks RBAC 5-Tier (Role-Based Access Control)")
    add_body_p(doc, 
        "Untuk menjamin integritas data korporat dan menerapkan prinsip pemisahan wewenang (Segregation of Duties), "
        "PRIME HRIS menerapkan sistem otorisasi Role-Based Access Control (RBAC) 5-Tier. Setiap peran memiliki batasan halaman, "
        "fungsi tombol, dan izin modifikasi yang diisolasi secara ketat pada level antarmuka pengguna maupun level API server:"
    )

    t_rbac_detail = doc.add_table(rows=6, cols=5)
    t_rbac_detail.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_rbac_detail, "CBD5E1", "4")
    rbac_headers = ["Tingkatan Peran", "Definisi & Pengguna", "Menu yang Terlihat", "Otoritas Tulis / Modifikasi", "Tingkat Kerahasiaan Finansial"]
    rbac_data = [
        ["1. Staff (Umum / Teknisi)", "Karyawan kantor, operator workshop, dan teknisi lapangan yang memerlukan portal absensi dan slip gaji.", "5 Menu:\n• Portal Kinerja Saya\n• Presensi Kamera Saya\n• Pengajuan & Izin Saya\n• Slip Gaji Saya\n• Profil Data Saya", "Hanya dapat menginput presensi diri sendiri dan mengirim formulir permohonan izin/cuti pribadi.", "Pribadi: Hanya dapat melihat slip gaji dan nomor rekening bank miliknya sendiri."],
        ["2. Staff (Project Manager)", "Site Manager, Site Coordinator, atau Mandor Lapangan yang memimpin penugasan tim di lokasi proyek.", "6 Menu:\n• 5 Menu Staf di atas\n• PLUS: Presensi Tukang Lapangan\n• Dashboard Proyek Terkait\n• Otorisasi Tim Proyek", "Dapat mendaftarkan tukang harian lepas, mencatat foto absensi tukang, dan mereview tiket staf proyek.", "Proyek: Dapat memantau serapan anggaran upah proyek yang dikelolanya (tidak melihat gaji staf lain)."],
        ["3. HR / Admin SDM", "HR Manager, Supervisor Personalia, dan Admin Personalia yang mengelola data personalia perusahaan.", "9 Menu:\n• Dashboard HRIS\n• Presensi & Jam Kerja\n• Pusat Approval SDM\n• Presensi Tukang\n• Manajemen Proyek\n• Data Karyawan\n• Kalender Kerja\n• Setting System\n• Audit Trail", "Penuh pada data personalia: input staf baru, enrol biometrik, jadwal cut-off, approval tiket, koreksi timesheet.", "Personalia: Melihat profil kompensasi seluruh staf untuk keperluan administrasi cuti dan roster."],
        ["4. Finance & Payroll", "Finance Manager, Payroll Specialist, dan Bagian Keuangan yang mengelola penggajian dan arus kas.", "9 Menu:\n• Dashboard Keuangan\n• Payroll & Penggajian\n• Data Gaji Karyawan\n• Biaya Tenaga Kerja\n• Approval Lembur\n• Rekap Presensi\n• Kalender Kerja\n• Invoice Resmi\n• Audit Trail", "Penuh pada data finansial: menjalankan kalkulasi payroll, penyesuaian gaji, ekspor CSV bank, dispatch slip WA.", "Tinggi (Komersial): Otoritas penuh atas seluruh data payroll perusahaan, rekening bank, dan penagihan invoice."],
        ["5. Superuser / Direksi", "Direktur Utama, Technical Lead, dan Platform Architect sistem.", "10 Menu Terpadu:\nSeluruh menu sistem tanpa batasan, termasuk konfigurasi master sistem dan database.", "Bypass Otoritas Penuh: mengubah formula salary_rules, geofence pusat, pairing QR WA, reset password root.", "Tertinggi: Akses mutlak ke seluruh data finansial, log audit root, dan pemulihan bencana database."]
    ]
    format_table_headers_and_data(t_rbac_detail, [1.1, 1.4, 1.3, 1.6, 1.4], rbac_headers, rbac_data)

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB II: STRUKTUR DATA, SILSILAH ENTITAS & PETA KETERKAITAN DATA
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB II: STRUKTUR DATA, SILSILAH ENTITAS & PETA KETERKAITAN DATA (DATA LINEAGE)")
    
    add_heading_2(doc, "2.1 Peta Topologi Keterkaitan Data End-to-End")
    add_body_p(doc, 
        "Data di dalam PRIME HRIS mengalir secara teratur dan saling bergantung (inter-connected). "
        "Tidak ada data yang berdiri sendiri tanpa fungsi. Hubungan antar-tabel dibangun untuk mendukung otomatisasi total:"
    )
    add_body_p(doc,
        "1. Tabel employees menjadi muara data personalia, menampung NIK, kompensasi, kuota cuti, dan representasi 128 vektor biometrik.\n"
        "2. Tabel projects mendefinisikan lokasi fisik site proyek, jam kerja khusus, dan pagu anggaran upah tenaga kerja.\n"
        "3. Hubungan N:1 terjadi saat karyawan ditugaskan ke suatu proyek (employees.assignedProjectId -> projects.id). Penugasan ini otomatis mengaktifkan aturan jam kerja dan radius GPS proyek tersebut pada aplikasi presensi karyawan.\n"
        "4. Setiap ketukan presensi disimpan ke tabel attendances, mengaitkan employeeId dengan koordinat riil dan foto selfie.\n"
        "5. Bila presensi terlambat atau di luar radius, data memicu pembuatan tiket pada tabel approvals. Jika disetujui atasan, tiket ini mengupdate status absensi di attendances dan saldo cuti di employees.\n"
        "6. Menjelang akhir periode, tabel annual_work_calendar menentukan jendela cut-off tanggal 21 s/d 20. Mesin payroll menarik seluruh data hadir aktual dari attendances, menghitung lembur Depnaker, memotong iuran BPJS/pajak, lalu memperbarui serapan anggaran di projects dan memicu wa_notifications."
    )

    add_heading_2(doc, "2.2 Matriks Hubungan Antar-Tabel (Dari Mana ke Mana dan Fungsinya)")
    add_body_p(doc, "Tabel berikut merangkum secara presisi silsilah keterkaitan data (data lineage) di seluruh sistem:")

    t_lineage = doc.add_table(rows=8, cols=4)
    t_lineage.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_lineage, "CBD5E1", "4")
    lin_headers = ["Tabel Asal & Kunci", "Tabel Tujuan (Relasi)", "Arah Aliran & Keterkaitan", "Fungsi Bisnis & Dampak Operasional"]
    lin_data = [
        ["employees.id", "attendances.employeeId", "employees -> attendances (1 : N)", "Mengikat setiap transaksi presensi harian (jam masuk/pulang, foto, koordinat) ke identitas karyawan pemilik data."],
        ["employees.assignedProjectId", "projects.id", "employees -> projects (N : 1)", "Menentukan di proyek mana staf bertugas. Menentukan aturan jam kerja khusus site dan radius toleransi GPS proyek."],
        ["attendances.id", "approvals.attendanceRecordId", "attendances -> approvals (1 : 1)", "Jika presensi berstatus terlambat (LATE) atau di luar geofence, sistem mengaitkan tiket dispensasi ke rekaman absensi terkait."],
        ["approvals.employeeId", "employees.id", "approvals -> employees (N : 1)", "Tiket permohonan cuti tahunan yang disetujui HR secara seketika memotong saldo employees.leaveQuota dan menambah usedLeave."],
        ["projects.id", "casual_workers.projectId", "projects -> casual_workers (1 : N)", "Mengelompokkan daftar tukang harian lepas yang bekerja pada kontrak proyek tertentu di bawah pengawasan PM."],
        ["attendances + approvals", "payrollCalculator Engine", "attendances -> Payroll -> projects", "Menjadi bahan baku penghitungan hari hadir riil, jam lembur Depnaker, dan pembebanan biaya upah ke anggaran proyek."],
        ["payrollCalculator", "wa_notifications.recipient_phone", "Payroll -> wa_notifications -> WhatsApp", "Memicu bot WhatsApp mengirimkan rincian slip gaji resmi secara digital ke nomor ponsel masing-masing staf."]
    ]
    format_table_headers_and_data(t_lineage, [1.4, 1.4, 1.6, 2.4], lin_headers, lin_data)

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB III: ALUR KERJA PRESENSI LENGKAP & MULTI-METODE (5 SKENARIO)
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB III: ALUR KERJA PRESENSI LENGKAP & MULTI-METODE (5 SKENARIO)")
    add_body_p(doc, 
        "Sistem presensi PRIME HRIS dirancang multi-kondisi untuk mengakomodasi fleksibilitas operasional: "
        "mulai dari presensi mandiri staf kantor/site, presensi pekerja lepas tanpa akun, terminal kiosk publik gerbang pabrik, "
        "presensi dinas luar mendadak, hingga rekonsiliasi koreksi jam kehadiran oleh HR."
    )

    add_heading_2(doc, "3.1 Skenario 1: Presensi Kamera Selfie GPS Satelit Mandiri")
    add_body_p(doc, "Digunakan setiap hari oleh staf kantor pusat, workshop, dan teknisi site yang memegang smartphone/komputer pribadi:")
    add_bullet_p(doc, " Karyawan membuka menu 'Presensi Kamera Saya'. Browser meminta izin sensor kamera depan dan lokasi GPS.", "Langkah 1 (Sensor):")
    add_bullet_p(doc, " Sistem membaca koordinat satelit (Latitude & Longitude) dan menghitung jarak ke lokasi kerja menggunakan rumus bola bumi Haversine. Jika jarak <= 100 meter, indikator berubah HIJAU (Dalam Radius).", "Langkah 2 (Geofence):")
    add_bullet_p(doc, " Karyawan memposisikan wajah di dalam oval panduan layar. Algoritma FaceNet AI mendeteksi landmark wajah dan menampilkan indikator 'Wajah Terdeteksi'.", "Langkah 3 (Biometrik):")
    add_bullet_p(doc, " Karyawan menekan tombol 'CHECK IN SEKARANG'. Sistem mengambil snapshot foto, memverifikasi kecocokan vektor biometrik dengan master data (skor >= 90%), dan mencatat jam masuk.", "Langkah 4 (Check-In):")
    add_bullet_p(doc, " Jika check-in dilakukan melewati batas toleransi shift (misal lewat dari 08:15), status otomatis menjadi LATE, sistem menghitung menit terlambat, dan meminta karyawan menuliskan alasan.", "Langkah 5 (Deteksi Telat):")
    add_bullet_p(doc, " Pada sore hari saat jam kerja selesai, karyawan menekan 'CHECK OUT SEKARANG' untuk mengunci total jam kerja hari tersebut.", "Langkah 6 (Check-Out):")

    add_heading_2(doc, "3.2 Skenario 2: Presensi Tukang Lapangan / Pekerja Harian Lepas")
    add_body_p(doc, "Khusus dioperasikan oleh Project Manager di lapangan untuk mengawasi tenaga kerja lepas yang tidak memiliki akun sistem:")
    add_bullet_p(doc, " PM membuka menu 'Presensi Tukang Lapangan' pada ponselnya di lokasi site proyek.", "Langkah 1 (Akses):")
    add_bullet_p(doc, " PM memilih proyek aktif, lalu mengklik 'Ambil Absen Harian Tukang'.", "Langkah 2 (Pilih Proyek):")
    add_bullet_p(doc, " Kamera smartphone PM terbuka. PM mengarahkan kamera ke wajah pekerja tukang yang hadir di lokasi proyek pagi itu.", "Langkah 3 (Foto Site):")
    add_bullet_p(doc, " Sistem mengambil foto, menyematkan watermark tanggal, jam, koordinat GPS proyek, dan nama PM yang memverifikasi.", "Langkah 4 (Watermark):")
    add_bullet_p(doc, " Presensi tersimpan di tabel casual_worker_attendances sebagai bukti fisik untuk klaim kas proyek dan progress billing.", "Langkah 5 (Arsip):")

    add_heading_2(doc, "3.3 Skenario 3: Terminal Kiosk Publik di Lobby / Site Gate")
    add_body_p(doc, "Dioperasikan pada tablet layar sentuh permanen di lobby kantor atau pos satpam gerbang workshop:")
    add_bullet_p(doc, " Tablet dioperasikan dengan URL khusus: https://hris.primeprojectx.net/?tab=kiosk (Mode Sandboxed Publik Bebas Login).", "Langkah 1 (Setup Kiosk):")
    add_bullet_p(doc, " Layar kiosk bersih dan aman, sama sekali tidak menampilkan data rahasia seperti besaran gaji atau nomor rekening.", "Langkah 2 (Proteksi Data):")
    add_bullet_p(doc, " Karyawan mendekati tablet: Kamera kiosk mendeteksi wajah dan mencocokkan dengan galeri biometrik dalam tempo < 0.8 detik (Opsi Wajah), atau karyawan mengetikkan 4 digit NIK pada keypad (Opsi PIN).", "Langkah 3 (Pindai Kilat):")
    add_bullet_p(doc, " Layar menampilkan konfirmasi hijau: 'Selamat Bekerja, [Nama Karyawan]' dan membunyikan nada sukses.", "Langkah 4 (Konfirmasi):")

    add_heading_2(doc, "3.4 Skenario 4: Presensi Penugasan Dinas Luar (Out-of-Geofence)")
    add_body_p(doc, "Digunakan saat karyawan harus langsung berangkat ke lokasi vendor/klien di luar perimeter kantor:")
    add_bullet_p(doc, " Karyawan membuka menu presensi kamera di lokasi klien, memilih tombol mode 'DINAS LUAR'.", "Langkah 1 (Mode Dinas):")
    add_bullet_p(doc, " Sistem mengambil snapshot foto dan koordinat GPS riil di lokasi klien tersebut.", "Langkah 2 (Snapshot GPS):")
    add_bullet_p(doc, " Karyawan menuliskan keterangan tugas dinas luar (nama klien, agenda meeting, nomor surat tugas).", "Langkah 3 (Keterangan):")
    add_bullet_p(doc, " Sistem mencatat presensi sebagai DINAS_LUAR dan secara otomatis membuat tiket dispensasi di antrean HR/PM untuk disetujui.", "Langkah 4 (Tiket Otomatis):")

    add_heading_2(doc, "3.5 Skenario 5: Rekonsiliasi & Koreksi Jam Kehadiran oleh HR")
    add_body_p(doc, "Digunakan jika terjadi pemadaman listrik di site atau kegagalan perangkat keras:")
    add_bullet_p(doc, " Karyawan mengajukan tiket 'Koreksi Absensi' dengan melampirkan jam masuk/pulang yang seharusnya.", "Langkah 1 (Pengajuan):")
    add_bullet_p(doc, " HR Manager membuka menu 'Payroll & Penggajian' -> Klik nama staf -> Buka 'Employee Timesheet Detail Modal'.", "Langkah 2 (Audit Timesheet):")
    add_bullet_p(doc, " HR memilih tanggal yang bersangkutan, mengklik tombol 'Koreksi Jam HR', memasukkan jam riil, dan memberikan catatan verifikasi resmi.", "Langkah 3 (Koreksi Jam):")
    add_bullet_p(doc, " Sistem memperbarui status absensi menjadi ON_TIME, membatalkan denda keterlambatan, dan mencatat mutasi tersebut ke tabel audit_logs permanen.", "Langkah 4 (Penyelarasan):")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB IV: PANDUAN KHUSUS ROLE 1 — STAFF (KARYAWAN & TEKNISI UMUM)
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB IV: PANDUAN KHUSUS ROLE 1 — STAFF (KARYAWAN & TEKNISI UMUM)")
    
    add_heading_2(doc, "4.1 Profil Peran & Batasan Wewenang Staff")
    add_body_p(doc, 
        "Role Staff diperuntukkan bagi seluruh karyawan operasional, teknisi workshop, staf administrasi, dan pekerja lapangan. "
        "Peran ini berfokus pada kemandirian pencatatan kehadiran pribadi dan transparansi hak kompensasi kerja. "
        "Staff sama sekali tidak memiliki akses ke data personalia staf lain, pengaturan sistem, maupun kalkulasi penggajian perusahaan."
    )

    add_heading_2(doc, "4.2 Pembahasan Mendalam 5 Menu Navigasi Staff")
    
    add_heading_3(doc, "Menu 1: PORTAL KINERJA SAYA (Dashboard Pribadi)")
    add_body_p(doc, "• Lokasi Navigasi: Menu paling atas pada bilah navigasi kiri (Ikon: LayoutDashboard).")
    add_body_p(doc, "• Tujuan Bisnis: Memberikan gambaran seketika kepada karyawan mengenai performa kedisiplinan dan hak cuti bulan berjalan.")
    add_body_p(doc, "• Komponen UI & Fungsi Tombol:")
    add_bullet_p(doc, " Menampilkan jumlah hari masuk kerja tepat waktu bulan ini.", "Kartu Hadir Tepat Waktu:")
    add_bullet_p(doc, " Menampilkan akumulasi menit keterlambatan yang belum mendapatkan dispensasi dari atasan.", "Kartu Menit Keterlambatan:")
    add_bullet_p(doc, " Menampilkan sisa hari cuti tahunan yang masih dapat diajukan.", "Kartu Sisa Kuota Cuti:")
    add_bullet_p(doc, " Menampilkan nama proyek aktif tempat staf ditugaskan beserta nama Project Manager penanggung jawabnya.", "Kartu Penugasan Proyek:")
    add_bullet_p(doc, " Tombol cepat untuk langsung menuju halaman kamera presensi atau membuka formulir cuti.", "Tombol Pintas Aksi:")
    add_body_p(doc, "• Keterkaitan Data: Menarik data secara real-time dari tabel attendances (filter employeeId), tabel approvals (status tiket pribadi), dan tabel employees (leaveQuota - usedLeave).")

    add_heading_3(doc, "Menu 2: PRESENSI KAMERA SAYA (Kamera Selfie & Geotag)")
    add_body_p(doc, "• Lokasi Navigasi: Menu kedua pada bilah navigasi kiri (Ikon: Camera).")
    add_body_p(doc, "• Tujuan Bisnis: Melakukan pencatatan kehadiran masuk dan pulang secara mandiri dengan validasi satelit GPS dan biometrik wajah.")
    add_body_p(doc, "• Komponen UI & Fungsi Tombol:")
    add_bullet_p(doc, " Menampilkan live feed kamera depan perangkat dengan lingkaran oval panduan wajah.", "Viewport Video Kamera:")
    add_bullet_p(doc, " Lingkaran radar satelit. Berwarna HIJAU jika jarak ke kantor/proyek <= 100m. Berwarna KUNING/MERAH jika di luar radius toleransi.", "Indikator Status Radius Geofence:")
    add_bullet_p(doc, " Tombol besar berwarna hijau/navy yang diklik pada pagi hari untuk merekam jam masuk kerja.", "Tombol 'CHECK IN SEKARANG':")
    add_bullet_p(doc, " Tombol yang aktif pada sore/malam hari saat jam kerja berakhir untuk merekam jam kepulangan.", "Tombol 'CHECK OUT SEKARANG':")
    add_bullet_p(doc, " Opsi yang dapat dicentang jika karyawan ditugaskan di luar lokasi kantor/proyek secara resmi.", "Pilihan Mode 'Dinas Luar':")
    add_body_p(doc, "• Keterkaitan Data: Menulis baris baru ke tabel attendances, memicu notifikasi bot WhatsApp ke nomor ponsel karyawan, dan memicu kalkulasi lembur jika check-out melebihi jam kerja normal.")

    add_heading_3(doc, "Menu 3: PENGAJUAN & IZIN SAYA (Approval Hub Staf)")
    add_body_p(doc, "• Lokasi Navigasi: Menu ketiga pada bilah navigasi kiri (Ikon: CheckSquare).")
    add_body_p(doc, "• Tujuan Bisnis: Mengajukan permohonan hak cuti tahunan, cuti roster, izin sakit, dan dispensasi keterlambatan secara transparan.")
    add_body_p(doc, "• Komponen UI & Fungsi Tombol:")
    add_bullet_p(doc, " Membuka jendela dialog pembuatan tiket permohonan baru.", "Tombol '+ Buat Pengajuan Baru':")
    add_bullet_p(doc, " Memilih jenis izin (Cuti Tahunan, Cuti Roster Non-Lokal, Sakit, Izin Pribadi, Dispensasi Keterlambatan, Koreksi Absensi).", "Dropdown Kategori Izin:")
    add_bullet_p(doc, " Menentukan tanggal awal dan akhir. Sistem secara otomatis menampilkan jumlah hari kerja bersih (mengabaikan hari libur nasional dan akhir pekan).", "Pemilih Rentang Tanggal:")
    add_bullet_p(doc, " Mengunggah foto surat dokter atau surat penugasan resmi.", "Formulir Unggah Lampiran:")
    add_bullet_p(doc, " Menampilkan daftar seluruh tiket yang pernah diajukan beserta statusnya: PENDING (Kuning), APPROVED (Hijau), atau REVISION_REQUESTED (Oranye).", "Tabel Riwayat Pengajuan:")
    add_body_p(doc, "• Keterkaitan Data: Menyimpan data ke tabel approvals. Begitu disetujui HR, tiket ini otomatis mengurangi leaveQuota pada tabel employees dan mengubah status tanggal terkait di attendances menjadi LEAVE.")

    add_heading_3(doc, "Menu 4: SLIP GAJI SAYA (Transparansi Kompensasi & Slip WA)")
    add_body_p(doc, "• Lokasi Navigasi: Menu keempat pada bilah navigasi kiri (Ikon: Banknote).")
    add_body_p(doc, "• Tujuan Bisnis: Memeriksa rincian transparansi penghasilan bulanan dan mengunduh slip gaji resmi perusahaan.")
    add_body_p(doc, "• Komponen UI & Fungsi Tombol:")
    add_bullet_p(doc, " Memilih bulan dan tahun penggajian yang ingin diperiksa.", "Dropdown Periode Gaji:")
    add_bullet_p(doc, " Gaji Pokok, Tunjangan Tetap Jabatan, Tunjangan Kehadiran Harian (Makan/Transport), dan Upah Lembur Depnaker Aktual.", "Rincian Pendapatan (Earnings):")
    add_bullet_p(doc, " Potongan keterlambatan tidak terjustifikasi, iuran BPJS Ketenagakerjaan (JHT 2%, JP 1%), iuran BPJS Kesehatan (1%), dan estimasi Pajak PPh 21 TER.", "Rincian Potongan (Deductions):")
    add_bullet_p(doc, " Nominal bersih upah yang ditransfer perusahaan ke rekening bank karyawan.", "Penghasilan Bersih (Take Home Pay):")
    add_bullet_p(doc, " Mengunduh berkas slip gaji resmi berlogo PRIME HRIS dan stempel verifikasi sistem.", "Tombol 'CETAK SLIP RESMI (PDF)':")
    add_bullet_p(doc, " Memerintahkan bot sistem untuk mengirimkan salinan digital rincian slip gaji ke nomor WhatsApp pribadi.", "Tombol 'KIRIM KE WHATSAPP SAYA':")
    add_body_p(doc, "• Keterkaitan Data: Membaca hasil kalkulasi payroll bulanan dari tabel attendances dan salary_rules.")

    add_heading_3(doc, "Menu 5: PROFIL DATA SAYA (Master Profil Pribadi)")
    add_body_p(doc, "• Lokasi Navigasi: Menu kelima pada bilah navigasi kiri (Ikon: UserCheck).")
    add_body_p(doc, "• Tujuan Bisnis: Memastikan identitas resmi, nomor rekening bank payroll, dan data biometrik karyawan terdaftar dengan benar.")
    add_body_p(doc, "• Komponen UI & Fungsi Tombol:")
    add_bullet_p(doc, " NIK, Nama Lengkap, Departemen, Jabatan, dan Tanggal Bergabung.", "Informasi Personalia:")
    add_bullet_p(doc, " Nama Bank, Nomor Rekening, dan Nama Pemilik Rekening (wajib sesuai identitas diri untuk transfer payroll).", "Data Rekening Bank Payroll:")
    add_bullet_p(doc, " Menampilkan status apakah foto biometrik wajah 128 vektor telah terdaftar atau belum.", "Status Biometrik Wajah:")
    add_body_p(doc, "• Keterkaitan Data: Membaca baris data karyawan di tabel employees.")

    add_heading_2(doc, "4.3 Alur Operasional Harian Karyawan (Daily Workflow)")
    add_body_p(doc, "1. Pagi Hari (07:30 - 08:00): Berdiri di area kantor/site, buka menu 'Presensi Kamera Saya', pastikan indikator hijau, tekan 'CHECK IN SEKARANG'.")
    add_body_p(doc, "2. Siang Hari: Jika berhalangan hadir esok hari atau izin sakit, buka menu 'Pengajuan & Izin Saya', buat pengajuan cuti/izin.")
    add_body_p(doc, "3. Sore Hari (16:30 - 17:00): Sebelum meninggalkan area kerja, buka menu 'Presensi Kamera Saya', tekan 'CHECK OUT SEKARANG'.")
    add_body_p(doc, "4. Tanggal 25 Setiap Bulan: Buka menu 'Slip Gaji Saya', periksa rincian gaji bulan tersebut, dan unduh slip PDF atau minta kirim via WhatsApp.")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB V: PANDUAN KHUSUS ROLE 2 — PROJECT MANAGER & SITE COORDINATOR
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB V: PANDUAN KHUSUS ROLE 2 — PROJECT MANAGER & SITE COORDINATOR")
    
    add_heading_2(doc, "5.1 Profil Peran & Wewenang Khusus PM di Lapangan")
    add_body_p(doc, 
        "Project Manager (PM) atau Site Lead adalah perpanjangan tangan manajemen di lokasi proyek. "
        "Selain memiliki hak akses penuh terhadap seluruh fitur Staff mandiri, PM memegang kendali atas pengawasan tenaga kerja proyek: "
        "mencatat kehadiran pekerja harian lepas (tukang/mandor), memantau serapan anggaran upah proyek, dan mereview tiket perizinan staf proyeknya."
    )

    add_heading_2(doc, "5.2 Pembahasan Mendalam Fitur Khusus Project Manager")
    
    add_heading_3(doc, "Menu Khusus: PRESENSI TUKANG LAPANGAN (Pekerja Harian Lepas)")
    add_body_p(doc, "• Lokasi Navigasi: Menu baris ketiga pada navigasi PM (Ikon: HardHat).")
    add_body_p(doc, "• Tujuan Bisnis: Mengontrol dan mengaudit kehadiran tenaga kerja harian lepas di lokasi proyek tanpa perlu membuatkan akun login.")
    add_body_p(doc, "• Komponen UI & Fungsi Tombol:")
    add_bullet_p(doc, " Memilih kontrak proyek aktif yang sedang dipimpin PM.", "Dropdown Pilih Proyek Aktif:")
    add_bullet_p(doc, " Mendaftarkan nama pekerja baru beserta bidang keahliannya (contoh: Tukang Batu, Tukang Las, Mandor).", "Tab 'Daftar Pekerja' & Tombol '+ Tambah Pekerja':")
    add_bullet_p(doc, " Mengaktifkan kamera smartphone PM untuk mengambil foto selfie pekerja tukang di lokasi proyek.", "Tombol 'Ambil Absen Harian Tukang':")
    add_bullet_p(doc, " Menyimpan foto ke server dengan cap otomatis: Nama Pekerja, Nama PM, Tanggal, Jam, dan Koordinat GPS Proyek.", "Tombol 'Simpan Presensi Tukang':")
    add_bullet_p(doc, " Menampilkan arsip foto dan log kehadiran harian seluruh tukang untuk bukti klaim pencairan kas kecil proyek.", "Tab 'Log Presensi Harian':")
    add_body_p(doc, "• Keterkaitan Data: Menyimpan data ke tabel casual_workers dan casual_worker_attendances. Menjadi dokumen pendukung resmi saat pengajuan reimbursement operasional proyek ke Finance.")

    add_heading_3(doc, "Fitur Khusus: Otorisasi Tiket Anggota Proyek (First-Line Approval)")
    add_body_p(doc, "• Lokasi Navigasi: Menu 'Pengajuan & Izin Saya' (Tab Tiket Anggota Proyek).")
    add_body_p(doc, "• Tujuan Bisnis: Memeriksa dan memberikan rekomendasi persetujuan awal terhadap permohonan lembur, dinas luar, atau cuti teknisi site.")
    add_body_p(doc, "• Fungsi Aksi: PM memeriksa apakah ketidakhadiran teknisi akan mengganggu jadwal milestone proyek. PM dapat mengklik 'Rekomendasikan Setuju' atau 'Tolak dengan Catatan' sebelum tiket masuk ke persetujuan final HR Manager.")
    add_body_p(doc, "• Keterkaitan Data: Memperbarui kolom reviewedBy dan reviewNote pada tabel approvals.")

    add_heading_3(doc, "Fitur Khusus: Pemantauan Anggaran Tenaga Kerja Proyek (Burn Rate Control)")
    add_body_p(doc, "• Tujuan Bisnis: Mencegah proyek mengalami pembengkakan biaya tenaga kerja (overbudget labor cost).")
    add_body_p(doc, "• Komponen Analitik:")
    add_bullet_p(doc, " Pagu total biaya upah yang dialokasikan dalam kontrak proyek.", "Allocated Budget:")
    add_bullet_p(doc, " Total upah riil yang telah dibayarkan kepada teknisi dan tukang hingga bulan berjalan.", "Actual Labor Cost:")
    add_bullet_p(doc, " Persentase serapan anggaran terhadap progress fisik pekerjaan di lapangan.", "Burn Rate Ratio:")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB VI: PANDUAN KHUSUS ROLE 3 — HR / ADMIN SDM
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB VI: PANDUAN KHUSUS ROLE 3 — HR / ADMIN SDM")
    
    add_heading_2(doc, "6.1 Profil Peran & Wewenang Personalia")
    add_body_p(doc, 
        "HR Manager dan Admin Personalia memegang kendali penuh atas tata kelola sumber daya manusia perusahaan. "
        "Wewenang HR mencakup pengelolaan master karyawan, pendaftaran biometrik wajah, pengaturan kalender kerja tahunan, "
        "penetapan periode cut-off penggajian, persetujuan final tiket perizinan, dan rekonsiliasi timesheet absensi."
    )

    add_heading_2(doc, "6.2 Pembahasan Mendalam 9 Menu Navigasi HR")
    
    add_heading_3(doc, "Menu 1: DASHBOARD HRIS & SDM (Monitoring Makro)")
    add_body_p(doc, "• Tujuan: Menyajikan telemetri operasional SDM perusahaan secara menyeluruh dan waktu nyata.")
    add_body_p(doc, "• Komponen UI: Kartu total karyawan aktif (Headcount rasio kantor vs site), persentase kehadiran harian, grafik tren keterlambatan per departemen, dan lonceng notifikasi tiket pending yang membutuhkan persetujuan.")

    add_heading_3(doc, "Menu 2: PRESENSI & JAM KERJA (Audit Kehadiran Harian)")
    add_body_p(doc, "• Tujuan: Mengaudit kehadiran harian staf seluruh departemen secara real-time.")
    add_body_p(doc, "• Komponen UI: Tabel daftar presensi hari ini lengkap dengan foto snapshot selfie, stempel jam masuk, status (ON_TIME / LATE), skor kecocokan biometrik AI, dan titik koordinat GPS. Dilengkapi filter pencarian berdasarkan departemen atau proyek.")

    add_heading_3(doc, "Menu 3: PUSAT APPROVAL SDM (Otorisasi Final)")
    add_body_p(doc, "• Tujuan: Menjadi gerbang keputusan final atas seluruh pengajuan izin, cuti tahunan, sakit, dan dispensasi keterlambatan.")
    add_body_p(doc, "• Fungsi Tombol:")
    add_bullet_p(doc, " Menyetujui permohonan. Sistem secara otomatis memotong leaveQuota pada tabel employees jika cuti, mengubah status absensi di attendances, dan mengirimkan pesan WhatsApp sukses ke karyawan.", "Tombol Hijau 'SETUJUI (APPROVE)':")
    add_bullet_p(doc, " Menolak permohonan dengan mencantumkan alasan resmi yang akan dikirimkan ke karyawan.", "Tombol Merah 'TOLAK (REJECT)':")
    add_bullet_p(doc, " Meminta karyawan melengkapi ulang dokumen pendukung (misal: surat dokter asli).", "Tombol Oranye 'MINTA REVISI':")

    add_heading_3(doc, "Menu 4: PRESENSI TUKANG LAPANGAN (Audit Lintas-Proyek)")
    add_body_p(doc, "• Tujuan: Memeriksa dan memantau rekapitulasi kehadiran pekerja harian lepas di seluruh lokasi proyek yang dikirimkan oleh para Project Manager.")

    add_heading_3(doc, "Menu 5: MANAJEMEN PROYEK & SITE (Alokasi & Roster)")
    add_body_p(doc, "• Tujuan: Mengatur penugasan karyawan ke proyek tertentu, menyetel jam kerja khusus site (Work Schedule Override), dan menetapkan aturan siklus giliran kerja (*Roster Policy*, contoh: 10 minggu bertugas di site / 2 minggu cuti roster off-site).")

    add_heading_3(doc, "Menu 6: DATA KARYAWAN (Master Personalia & Biometrik)")
    add_body_p(doc, "• Tujuan: Pendaftaran karyawan baru, penataan data identitas, dan pendaftaran fitur biometrik wajah.")
    add_body_p(doc, "• Fungsi Tombol:")
    add_bullet_p(doc, " Membuka form pendaftaran staf (NIK, Nama, Email, No WA, Jabatan, Gaji Pokok, Tunjangan, Bank).", "Tombol '+ Tambah Karyawan':")
    add_bullet_p(doc, " Membuka modal pendaftaran biometrik wajah AI. Menghadap webcam, tekan 'Capture & Enroll' untuk mengekstrak 128 vektor wajah.", "Ikon Kamera 'Biometric Enrollment':")
    add_bullet_p(doc, " Mengembalikan kata sandi akun karyawan yang lupa password ke sandi default aman.", "Tombol 'Reset Password':")

    add_heading_3(doc, "Menu 7: KALENDER KERJA & CUT-OFF (Pengaturan Periode)")
    add_body_p(doc, "• Tujuan: Menetapkan kalender kerja 1 tahun penuh, hari libur mingguan perusahaan (Sabtu-Minggu / Minggu), hari libur nasional resmi, dan rentang tanggal Cut-Off presensi penggajian (misal: tgl 21 s/d tgl 20).")
    add_body_p(doc, "• Keterkaitan: Parameter ini menjadi acuan waktu absolut bagi mesin kalkulator payroll Finance.")

    add_heading_3(doc, "Menu 8: SETTING SYSTEM (Integrasi WhatsApp & Email)")
    add_body_p(doc, "• Tujuan: Memeriksa status koneksi socket WhatsApp Baileys dan memeriksa daftar nomor kontak yang telah berstatus Whitelist Opt-In.")

    add_heading_3(doc, "Menu 9: AUDIT TRAIL & LOG (Pemeriksaan Jejak SDM)")
    add_body_p(doc, "• Tujuan: Menelusuri seluruh riwayat perubahan data personalia (siapa menambah karyawan, siapa mengubah nomor rekening, dan stempel waktu IP address).")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB VII: PANDUAN KHUSUS ROLE 4 — FINANCE & PAYROLL SPECIALIST
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB VII: PANDUAN KHUSUS ROLE 4 — FINANCE & PAYROLL SPECIALIST")
    
    add_heading_2(doc, "7.1 Profil Peran & Otoritas Keuangan Perusahaan")
    add_body_p(doc, 
        "Role Finance memegang otoritas penuh atas pemrosesan hak keuangan karyawan dan pengendalian biaya operasional proyek. "
        "Finance bertanggung jawab menjalankan mesin kalkulasi payroll bulanan, mengaudit lembur Depnaker, mengekspor berkas transfer bank, "
        "mengontrol alokasi biaya tenaga kerja ke pagu anggaran proyek, serta menerbitkan invoice resmi klien."
    )

    add_heading_2(doc, "7.2 Pembahasan Mendalam 9 Menu Navigasi Finance")
    
    add_heading_3(doc, "Menu 1: DASHBOARD KEUANGAN & FINANCE (Arus Kas Upah)")
    add_body_p(doc, "• Tujuan: Memantau proyeksi liabilitas pengeluaran payroll bulanan perusahaan, serapan anggaran upah seluruh proyek, dan rekapitulasi klaim lembur operasional.")

    add_heading_3(doc, "Menu 2: PAYROLL & PENGGAJIAN (Mesin Penggajian Terpadu)")
    add_body_p(doc, "• Lokasi Navigasi: Menu kedua pada bilah navigasi Finance (Ikon: Banknote).")
    add_body_p(doc, "• Tujuan Bisnis: Menjalankan eksekusi kalkulasi penggajian bulanan berdasarkan periode cut-off yang ditentukan kalender kerja.")
    add_body_p(doc, "• Komponen UI & Fungsi Tombol:")
    add_bullet_p(doc, " Menarik seluruh data kehadiran, jam lembur, potongan telat, BPJS, dan PPh 21 TER ke dalam lembar kerja terpadu.", "Tombol 'Jalankan Kalkulasi Payroll':")
    add_bullet_p(doc, " Klik nama staf untuk mengaudit rincian absensi harian, foto selfie, koordinat GPS, dan melakukan penyesuaian/koreksi jam jika ada selisih.", "Modal Detail Timesheet (Employee Timesheet Detail Modal):")
    add_bullet_p(doc, " Mengunduh berkas format batch transfer resmi yang siap diunggah ke portal perbankan (BCA / Mandiri).", "Tombol 'Export CSV Batch Transfer Bank':")
    add_bullet_p(doc, " Mengirimkan rincian slip gaji resmi berformat rapi langsung ke nomor WhatsApp seluruh staf secara bergantian dengan jeda aman.", "Tombol Hijau 'Kirim Semua Slip Gaji via WhatsApp':")
    add_bullet_p(doc, " Mengunduh berkas fisik slip gaji per individu berstandar korporat resmi.", "Tombol Cetak Slip PDF:")

    add_heading_3(doc, "Menu 3: DATA GAJI KARYAWAN (Master Rekening & Kompensasi)")
    add_body_p(doc, "• Tujuan: Memeriksa dan memverifikasi ketepatan nomor rekening bank karyawan serta skema kompensasi gaji pokok dan tunjangan.")

    add_heading_3(doc, "Menu 4: BIAYA TENAGA KERJA PROYEK (Labor Cost Allocation)")
    add_body_p(doc, "• Tujuan: Memantau pembebanan biaya gaji teknisi ke masing-masing proyek. Sistem otomatis membagi proporsi gaji berdasarkan hari kerja aktual teknisi di lokasi proyek bersangkutan.")

    add_heading_3(doc, "Menu 5: APPROVAL CUTI & LEMBUR (Validasi Finansial)")
    add_body_p(doc, "• Tujuan: Memeriksa tiket kompensasi lembur yang diajukan departemen sebelum kalkulasi penggajian difinalisasi.")

    add_heading_3(doc, "Menu 6: REKAP PRESENSI & LEMBUR (Audit Dasar Upah)")
    add_body_p(doc, "• Tujuan: Memeriksa rekapitulasi kehadiran bersih sebagai data pembanding sebelum mengunci perhitungan payroll.")

    add_heading_3(doc, "Menu 7: KALENDER KERJA & CUT-OFF (Validasi Periode)")
    add_body_p(doc, "• Tujuan: Memastikan bahwa tanggal cut-off presensi (21 s/d 20) telah dikonfigurasi dengan benar oleh HRD.")

    add_heading_3(doc, "Menu 8: INVOICE & TAGIHAN RESMI (Billing Termin)")
    add_body_p(doc, "• Tujuan: Mengelola berkas penagihan resmi invoice proyek Prime HRIS, memantau termin pembayaran (Termin I 50%, Termin II 50%), verifikasi QR rekening bank perusahaan, dan status pelunasan.")

    add_heading_3(doc, "Menu 9: AUDIT TRAIL & LOG (Audit Keuangan)")
    add_body_p(doc, "• Tujuan: Menelusuri seluruh transaksi mutasi finansial, penyesuaian nominal upah, dan stempel waktu penguncian payroll.")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB VIII: PANDUAN KHUSUS ROLE 5 — SUPERUSER & DIREKSI
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB VIII: PANDUAN KHUSUS ROLE 5 — SUPERUSER & MANAJEMEN DIREKSI")
    
    add_heading_2(doc, "8.1 Profil Peran & Wewenang Eksekutif Root")
    add_body_p(doc, 
        "Role Superuser diperuntukkan bagi Direksi, Technical Director, dan Lead Platform Architect. "
        "Peran ini memegang wewenang tertinggi tanpa batas (unrestricted access) ke seluruh modul operasional, "
        "parameter formula finansial, geofence pusat, kredensial integrasi, dan infrastruktur basis data SQLite."
    )

    add_heading_2(doc, "8.2 Pembahasan Fitur Kunci & Konfigurasi Master Superuser")
    
    add_heading_3(doc, "1. Executive Unified Dashboard (Dashboard Terpadu)")
    add_body_p(doc, "Menyatukan telemetri SDM, serapan anggaran proyek, liabilitas kas payroll, dan status kesehatan server dalam satu panel pemantauan eksekutif.")

    add_heading_3(doc, "2. Konfigurasi Master Geofence Kantor Pusat (Setting System)")
    add_body_p(doc, "• Memasukkan titik Latitude dan Longitude koordinat fisik kantor pusat perusahaan.")
    add_body_p(doc, "• Menentukan radius toleransi satelit GPS (default: 100 meter).")
    add_body_p(doc, "• Mendaftarkan daftar Alamat IP Publik kantor untuk mengaktifkan validasi ganda koneksi jaringan Wi-Fi kantor.")

    add_heading_3(doc, "3. Konfigurasi Aturan Gaji & Finansial (salary_rules)")
    add_body_p(doc, "• Mengatur tarif BPJS, plafon upah maksimal BPJS JP & Kesehatan, dan persentase pengali lembur.")
    add_body_p(doc, "• Mengatur parameter ambang batas toleransi keterlambatan (Grace Period).")

    add_heading_3(doc, "4. Integrasi WhatsApp Bot Gateway & Handshake QR")
    add_body_p(doc, "• Memindai kode QR WhatsApp Web pada layar sistem menggunakan ponsel nomor bot perusahaan saat status disconnected.")
    add_body_p(doc, "• Mengatur interval pengiriman pesan massal untuk menjaga reputasi nomor dari pemblokiran.")

    add_heading_3(doc, "5. Prosedur Pencadangan & Pemulihan Bencana (Disaster Recovery)")
    add_body_p(doc, "• Skrip pencadangan otomatis harian membuat arsip data/hris.sqlite ke media penyimpanan off-site.")
    add_body_p(doc, "• Dalam kondisi kegagalan perangkat keras darurat, sistem dapat dipulihkan dalam waktu kurang dari 5 menit (RTO < 5 min).")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB IX: FORMULA PERHITUNGAN MATEMATIS & ATURAN BISNIS
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB IX: FORMULA PERHITUNGAN MATEMATIS & ATURAN BISNIS FINANSIAL")
    
    add_heading_2(doc, "9.1 Formula Lembur Depnaker RI (PP 35/2021)")
    add_body_p(doc, "Upah lembur per jam dihitung dengan rumus: Tarif Per Jam = (1 / 173) x Gaji Pokok Bulanan.")
    add_body_p(doc, "• Hari Kerja: Jam ke-1 = 1.5 x Tarif. Jam ke-2 dst = 2.0 x Tarif.")
    add_body_p(doc, "• Hari Libur: Jam ke-1 s/d ke-7 = 2.0 x Tarif. Jam ke-8 = 3.0 x Tarif. Jam ke-9 dst = 4.0 x Tarif.")

    add_heading_2(doc, "9.2 Formula Denda Keterlambatan Bertingkat")
    add_bullet_p(doc, " Terlambat 1 - 15 menit: Potongan Rp 0 (Toleransi Resmi).", "Tier 0 (Grace Period):")
    add_bullet_p(doc, " Terlambat 16 - 30 menit: Potongan 0.5% dari gaji pokok harian.", "Tier 1:")
    add_bullet_p(doc, " Terlambat 31 - 60 menit: Potongan 1.0% dari gaji pokok harian.", "Tier 2:")
    add_bullet_p(doc, " Terlambat > 60 menit: Pemotongan 1 hari upah harian penuh.", "Tier 3:")

    add_heading_2(doc, "9.3 Formula BPJS Ketenagakerjaan & Kesehatan")
    add_bullet_p(doc, " Karyawan 2%, Perusahaan 3.7% (Dasar: Gaji Pokok + Tunjangan Tetap).", "BPJS JHT:")
    add_bullet_p(doc, " Karyawan 1%, Perusahaan 2% (Dasar: Gaji Pokok, Plafon Maks Rp 10.042.300).", "BPJS JP:")
    add_bullet_p(doc, " Karyawan 0%, Perusahaan 0.89% (Sesuai tingkat risiko operasional).", "BPJS JKK:")
    add_bullet_p(doc, " Karyawan 0%, Perusahaan 0.30%.", "BPJS JKM:")
    add_bullet_p(doc, " Karyawan 1%, Perusahaan 4% (Plafon Upah Maksimal Rp 12.000.000).", "BPJS Kesehatan:")

    add_heading_2(doc, "9.4 Formula PPh 21 TER (PP 58/2023)")
    add_body_p(doc, "Penghitungan PPh 21 bulanan: PPh 21 = Penghasilan Bruto x Tarif Efektif Rata-Rata (Kategori TER A, B, atau C).")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB X: INTEGRASI BACKEND & ENGINE OTOMATIS
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB X: PANDUAN INTEGRASI ENGINE OTOMATIS & BACKEND SERVICES")
    add_body_p(doc, "1. WhatsApp Bot Baileys: Komunikasi langsung socket WebSocket WhatsApp Web dengan tabel wa_opt_ins untuk proteksi nomor anti-banned.")
    add_body_p(doc, "2. SMTP Nodemailer: Pengiriman email notifikasi pemulihan password dan ringkasan eksekutif ke Direksi.")
    add_body_p(doc, "3. AI Biometric Engine (FaceNet ResNet-34): Ekstraksi 128 vektor wajah dan pencocokan jarak Euclidean <= 0.45 dengan proteksi anti-spoofing.")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB XI: TROUBLESHOOTING MANDIRI BERDASARKAN PERAN & FAQ
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB XI: TROUBLESHOOTING MANDIRI BERDASARKAN PERAN & FAQ")
    
    add_heading_2(doc, "11.1 Matriks Penanganan Masalah untuk Staf Lapangan")
    t_trb_staff = doc.add_table(rows=4, cols=3)
    t_trb_staff.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_trb_staff, "CBD5E1", "4")
    format_table_headers_and_data(t_trb_staff, [2.0, 2.2, 2.8], 
        ["Kendala Staf", "Penyebab Umum", "Solusi Mandiri Cepat"],
        [
            ["Kamera tidak terbuka", "Izin browser Chrome/Safari diblokir", "Klik gembok di address bar -> Ubah Camera jadi Allow -> Muat ulang halaman."],
            ["Indikator GPS Merah", "Satelit ponsel belum mengunci posisi", "Buka aplikasi Google Maps agar GPS presisi aktif, keluar dari atap beton tebal."],
            ["Wajah tidak cocok", "Pencahayaan gelap / backlight", "Lepas kacamata dan masker, hadapkan wajah ke arah lampu di dalam oval panduan."]
        ]
    )

    add_heading_2(doc, "11.2 Matriks Penanganan Masalah untuk PM & HR Admin")
    t_trb_pm = doc.add_table(rows=4, cols=3)
    t_trb_pm.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_trb_pm, "CBD5E1", "4")
    format_table_headers_and_data(t_trb_pm, [2.0, 2.2, 2.8],
        ["Kendala PM / HR", "Penyebab Umum", "Solusi Mandiri Cepat"],
        [
            ["Foto tukang gagal simpan", "Sinyal internet di remote site drop", "Sistem menyimpan offline di cache browser; biarkan halaman terbuka hingga sinyal pulih."],
            ["Karyawan lupa password", "Salah memasukkan sandi berulang kali", "Buka Data Karyawan -> Klik 'Reset Password' pada baris nama staf bersangkutan."],
            ["Saldo cuti tidak berkurang", "Tiket belum di-approve final oleh HR", "Buka Pusat Approval SDM -> Pastikan status tiket telah berubah menjadi APPROVED."]
        ]
    )

    add_heading_2(doc, "11.3 FAQ Komprehensif")
    add_body_p(doc, "Q: Apakah slip gaji sah tanpa tanda tangan basah?\nA: Sah. Slip gaji PRIME HRIS dilengkapi kode digital QR verifikasi sistem dan stempel audit trail yang diakui secara legal untuk perbankan dan SPT Pajak.")
    add_body_p(doc, "Q: Apakah data absensi aman jika HP mati saat check-in?\nA: Aman. Begitu tombol ditekan dan suara konfirmasi terdengar, transaksi telah tercatat di server.")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB XII: DAFTAR ISTILAH & GLOSARIUM ENTERPRISE
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB XII: DAFTAR ISTILAH & GLOSARIUM ENTERPRISE")
    t_glo = doc.add_table(rows=11, cols=3)
    t_glo.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_glo, "CBD5E1", "4")
    glo_headers = ["Istilah / Singkatan", "Kategori", "Definisi Operasional Sistem"]
    glo_data = [
        ["RBAC (Role-Based Access Control)", "Sistem Otorisasi", "Metode pembatasan akses sistem berdasarkan peran formal pengguna (5-Tier: Staff, PM, HR, Finance, Superuser)."],
        ["Data Lineage", "Tata Kelola Data", "Peta silsilah aliran data dari entitas hulu (master) ke proses pengolahan hingga entitas hilir (output)."],
        ["Geofencing Satelit", "Telemetri GPS", "Perimeter virtual berbasis koordinat lintang/bujur dan radius meter untuk membatasi area presensi sah."],
        ["Haversine Formula", "Matematika", "Formula perhitungan jarak terpendek antara dua titik pada permukaan bola bumi berdasarkan koordinat GPS."],
        ["Biometric Vector 128D", "AI Computer Vision", "Ekstraksi matematis 128 angka float yang merepresentasikan ciri unik wajah manusia tanpa menyimpan foto asli."],
        ["Cut-Off Penggajian", "Manajemen SDM & Finance", "Tanggal penutupan siklus perhitungan absensi dan lembur bulanan (standar: tanggal 21 s/d 20)."],
        ["Lembur Depnaker PP 35/2021", "Hukum Ketenagakerjaan", "Standar resmi rumus upah lembur nasional dengan pembagi 1/173 dari gaji pokok bulanan."],
        ["PPh 21 TER PP 58/2023", "Regulasi Pajak", "Tarif Efektif Rata-Rata pemotongan pajak penghasilan bulanan berdasarkan tabel penghasilan bruto."],
        ["Baileys Multi-Device", "Messaging Gateway", "Library protokol komunikasi langsung ke socket WhatsApp Web tanpa perantara pihak ketiga."],
        ["Audit Trail Kriptografis", "Tata Kelola & Keamanan", "Buku besar catatan jejak aktivitas sistem yang bersifat append-only dan tidak dapat direkayasa."]
    ]
    format_table_headers_and_data(t_glo, [1.8, 1.4, 3.8], glo_headers, glo_data)

    add_callout(doc, "Dukungan & Layanan Teknis", 
        "PRIME HRIS Enterprise v2.4-LTS dikembangkan dan dipelihara di bawah pengawasan Systems Architecture & Analytics Platform Lead "
        "Prime Projectx. Untuk konsultasi teknis lebih lanjut atau kebutuhan penambahan integrasi modul, silakan hubungi https://primeprojectx.net.",
        bg_color="F8FAFC", border_color="18345E", title_color="18345E")

    # Add header and footer
    add_header_footer(doc)

    # Save to all required destinations
    out_docs = r"C:\Users\prime\prime-hris\docs\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.docx"
    doc.save(out_docs)
    print(f"[OK] Saved to docs: {out_docs}")

    # Desktop save with fallback if currently opened by MS Word
    out_desktop = r"C:\Users\prime\Desktop\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.docx"
    try:
        doc.save(out_desktop)
        print(f"[OK] Saved to Desktop: {out_desktop}")
    except PermissionError:
        out_desktop_alt = r"C:\Users\prime\Desktop\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS_LENGKAP_PER_ROLE.docx"
        doc.save(out_desktop_alt)
        print(f"[WARNING] File was locked in MS Word. Saved as: {out_desktop_alt}")

    out_user_docs = r"C:\Users\prime\Documents\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.docx"
    try:
        doc.save(out_user_docs)
        print(f"[OK] Saved to Documents: {out_user_docs}")
    except PermissionError:
        out_user_docs_alt = r"C:\Users\prime\Documents\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS_LENGKAP_PER_ROLE.docx"
        doc.save(out_user_docs_alt)
        print(f"[WARNING] Saved to Documents alternate: {out_user_docs_alt}")

    artifact_dir = r"C:\Users\prime\.gemini\antigravity-cli\brain\4fbf6728-925d-466f-87af-e179e5f86f48"
    if os.path.exists(artifact_dir):
        out_art = os.path.join(artifact_dir, "BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.docx")
        doc.save(out_art)
        print(f"[OK] Saved to Artifact: {out_art}")

if __name__ == "__main__":
    create_full_role_manual()
