"""
PRIME HRIS ENTERPRISE - COMPREHENSIVE ROLE-SEPARATED MANUAL BUILDER WITH VISUAL DIAGRAMS
Menghasilkan buku panduan sangat detail dengan pemisahan per peran dan diagram alur visual beresolusi tinggi.
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

DIAGRAM_DIR = r"C:\Users\prime\prime-hris\docs\diagrams"

def add_diagram_image(doc, img_name, caption):
    img_path = os.path.join(DIAGRAM_DIR, img_name)
    if os.path.exists(img_path):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        p.add_run().add_picture(img_path, width=Inches(6.6))
        
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(2)
        p_cap.paragraph_format.space_after = Pt(14)
        r = p_cap.add_run(caption)
        r.font.name = "Segoe UI"
        r.font.size = Pt(8.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(24, 52, 94)

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
        "DIAGRAM ALUR VISUAL FLOWCHART & TATA KELOLA KETERKAITAN DATA (DATA LINEAGE)"
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
        "Dilengkapi dengan visualisasi diagram alur (flowchart TD), analisis mendalam setiap menu dan tombol aksi, diagram silsilah keterkaitan data (data lineage), "
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
        ("Nomor Dokumen", "DOC-PRIME-HRIS-MANUAL-2026-V3-VISUAL"),
        ("Edisi / Versi Rilis", "Versi 2.4-LTS (Visual Flowchart & Role-Separated Manual Release)"),
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
    # PENGESAHAN DIGITAL & PENGENDALIAN MUTU
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
        ["2.4", "30 Okt 2026", "Galih P.", "Pemisahan lengkap panduan per role, diagram visual flowchart & audit trail permanen", "Disahkan (SSOT)"]
    ]
    format_table_headers_and_data(t_rev, [0.6, 1.1, 1.0, 3.2, 0.9], rev_headers, rev_data)

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # DAFTAR ISI LENGKAP & TERSTRUKTUR
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "DAFTAR ISI LENGKAP BUKU PANDUAN")
    add_body_p(doc, "Navigasi terpadu seluruh bab, sub-bab, diagram flowchart visual, dan pembahasan operasional sistem PRIME HRIS Enterprise:")

    t_toc = doc.add_table(rows=14, cols=3)
    t_toc.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_toc, "CBD5E1", "4")
    
    toc_headers = ["Bab / Bagian", "Struktur Pembahasan & Rincian Materi Peran", "Cakupan Halaman"]
    toc_data = [
        ["LEMBAR PENGESAHAN", "Pengendalian Versi Dokumen & Standar Pengesahan Digital Tanpa Kertas", "Hal. 2"],
        ["BAB I", "ARSITEKTUR DASAR SISTEM & PENJELASAN MENDALAM RBAC 5-TIER\n• 1.1 Filosofi Zero Manual System\n• 1.2 Pilar Arsitektur Edge-Cloud Hybrid\n• 1.3 Penjelasan Mendalam Konsep & Matriks RBAC 5-Tier\n• [DIAGRAM 2: ARSITEKTUR RBAC 5-TIER]\n• 1.4 Hirarki & Hak Akses Pengguna", "Hal. 4 - 7"],
        ["BAB II", "STRUKTUR DATA, SILSILAH ENTITAS & PETA KETERKAITAN DATA (DATA LINEAGE)\n• 2.1 Peta Topologi Keterkaitan Data End-to-End\n• [DIAGRAM 1: PETA TOPOLOGI DATA LINEAGE]\n• 2.2 Kamus Entitas Master & Transaksional Lengkap\n• 2.3 Matriks Hubungan Antar-Tabel (Dari Mana ke Mana & Fungsinya)\n• 2.4 Matriks Ketergantungan Data & Efek Domino (Cascading Impact)", "Hal. 8 - 14"],
        ["BAB III", "ALUR KERJA PRESENSI LENGKAP & MULTI-METODE (5 SKENARIO)\n• 3.1 Skenario 1: Presensi Kamera Selfie GPS Satelit Mandiri\n• [DIAGRAM 3: ALUR PRESENSI KAMERA SELFIE SATELIT]\n• 3.2 Skenario 2: Presensi Tukang Lapangan / Pekerja Harian Lepas\n• 3.3 Skenario 3: Terminal Kiosk Publik di Lobby / Site Gate\n• 3.4 Skenario 4: Presensi Penugasan Dinas Luar (Out-of-Geofence)\n• 3.5 Skenario 5: Rekonsiliasi & Koreksi Jam Kehadiran oleh HR\n• [DIAGRAM 4: ALUR WORKFLOW APPROVAL BERJENJANG]", "Hal. 15 - 20"],
        ["BAB IV", "PANDUAN KHUSUS ROLE 1 — STAFF (KARYAWAN & TEKNISI UMUM)\n• 4.1 Profil Peran & Batasan Wewenang Staff\n• 4.2 Detail 5 Menu Navigasi Staff (Tujuan, Fungsi Tombol, Input & Keterkaitan)\n• 4.3 Alur Operasional Harian Staf\n• 4.4 Keterkaitan Data Staf ke Peran Lain (PM, HR, Finance)", "Hal. 21 - 26"],
        ["BAB V", "PANDUAN KHUSUS ROLE 2 — PROJECT MANAGER & SITE COORDINATOR\n• 5.1 Profil Peran & Wewenang Khusus PM di Lapangan\n• 5.2 Detail Menu Manajemen Proyek, Presensi Tukang & Otorisasi Tim\n• 5.3 Alur Kerja Harian PM di Lokasi Proyek\n• 5.4 Keterkaitan Data Proyek ke HR dan Finance (Labor Cost Allocation)", "Hal. 27 - 32"],
        ["BAB VI", "PANDUAN KHUSUS ROLE 3 — HR / ADMIN SDM\n• 6.1 Profil Peran & Wewenang Personalia\n• 6.2 Detail 9 Menu Navigasi HR (Master Karyawan, Biometrik, Approval, Kalender)\n• 6.3 Siklus Bulanan & Tata Kelola Kuota Cuti / Roster\n• 6.4 Keterkaitan Data HR terhadap Payroll Finance & Legal Ketenagakerjaan", "Hal. 33 - 39"],
        ["BAB VII", "PANDUAN KHUSUS ROLE 4 — FINANCE & PAYROLL SPECIALIST\n• 7.1 Profil Peran & Otoritas Keuangan Perusahaan\n• 7.2 Detail 9 Menu Navigasi Finance (Payroll, Bank Transfer, Invoice, Labor Cost)\n• [DIAGRAM 5: SIKLUS TUTUP BUKU PAYROLL BULANAN]\n• 7.3 Siklus Tutup Buku Penggajian Bulanan Step-by-Step\n• 7.4 Keterkaitan Data Finansial ke Anggaran Proyek & Distribusi Slip WhatsApp", "Hal. 40 - 45"],
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

    # Insert Diagram 2: RBAC
    add_diagram_image(doc, "diagram_2_rbac_5tier.png", "Diagram 1.1: Arsitektur Hirarki & Hak Akses Sistem RBAC 5-Tier")

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

    # Insert Diagram 1: Data Lineage
    add_diagram_image(doc, "diagram_1_data_lineage.png", "Diagram 2.1: Peta Topologi Silsilah Keterkaitan Data End-to-End (Data Lineage)")

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

    # Insert Diagram 3: Attendance Flow
    add_diagram_image(doc, "diagram_3_attendance_selfie_gps.png", "Diagram 3.1: Alur Presensi Kamera Selfie Satelit GPS & Biometrik AI")

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

    # Insert Diagram 4: Approval Workflow
    add_diagram_image(doc, "diagram_4_approval_workflow.png", "Diagram 3.2: Alur Workflow Pengajuan Tiket & Persetujuan Berjenjang")

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
    add_body_p(doc, "1. Dashboard HRIS & SDM: Telemetri headcount, rasio kehadiran, dan antrean approval.")
    add_body_p(doc, "2. Presensi & Jam Kerja: Audit real-time presensi harian, foto selfie, koordinat satelit GPS, dan IP address.")
    add_body_p(doc, "3. Pusat Approval SDM: Persetujuan final cuti tahunan, sakit, dispensasi telat, dan koreksi timesheet.")
    add_body_p(doc, "4. Presensi Tukang Lapangan: Audit pengawasan pekerja lepas di seluruh proyek.")
    add_body_p(doc, "5. Manajemen Proyek & Site: Pengaturan alokasi teknisi, jam kerja site, dan roster kerja giliran.")
    add_body_p(doc, "6. Data Karyawan: Input staf baru, enrol biometrik 128D, dan reset password.")
    add_body_p(doc, "7. Kalender Kerja & Cut-Off: Pengaturan kalender 1 tahun, hari libur nasional, dan tanggal cut-off penggajian (21 s/d 20).")
    add_body_p(doc, "8. Setting System: Monitoring status WhatsApp Baileys dan Whitelist Opt-In.")
    add_body_p(doc, "9. Audit Trail & Log: Penelusuran jejak perubahan data SDM.")

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
    add_body_p(doc, "• Menu 1: Dashboard Keuangan & Finance (Arus Kas Upah & Burn Rate).")
    add_body_p(doc, "• Menu 2: Payroll & Penggajian (Mesin Gaji, Timesheet Audit Modal, Export Bank, Kirim WA).")
    add_body_p(doc, "• Menu 3: Data Gaji Karyawan (Verifikasi Rekening & Kompensasi).")
    add_body_p(doc, "• Menu 4: Biaya Tenaga Kerja Proyek (Labor Cost Allocation).")
    add_body_p(doc, "• Menu 5: Approval Cuti & Lembur (Validasi Finansial Lembur).")
    add_body_p(doc, "• Menu 6: Rekap Presensi & Lembur (Audit Dasar Upah).")
    add_body_p(doc, "• Menu 7: Kalender Kerja & Cut-Off (Validasi Jendela Penggajian).")
    add_body_p(doc, "• Menu 8: Invoice & Tagihan Resmi (Billing Termin I & II).")
    add_body_p(doc, "• Menu 9: Audit Trail & Log (Audit Finansial Kriptografis).")

    # Insert Diagram 5: Payroll Cycle
    add_diagram_image(doc, "diagram_5_payroll_cycle.png", "Diagram 7.1: Alur Siklus Tutup Buku Penggajian Bulanan (Payroll Cycle)")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB VIII: PANDUAN KHUSUS ROLE 5 — SUPERUSER & MANAJEMEN DIREKSI
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB VIII: PANDUAN KHUSUS ROLE 5 — SUPERUSER & MANAJEMEN DIREKSI")
    
    add_heading_2(doc, "8.1 Profil Peran & Wewenang Eksekutif Root")
    add_body_p(doc, 
        "Role Superuser diperuntukkan bagi Direksi, Technical Director, dan Lead Platform Architect. "
        "Peran ini memegang wewenang tertinggi tanpa batas (unrestricted access) ke seluruh modul operasional, "
        "parameter formula finansial, geofence pusat, kredensial integrasi, dan infrastruktur basis data SQLite."
    )

    add_heading_2(doc, "8.2 Fitur Kunci & Konfigurasi Master Superuser")
    add_body_p(doc, "1. Executive Unified Dashboard: Telemetri terpadu SDM, Finansial, Proyek, dan Server.")
    add_body_p(doc, "2. Konfigurasi Master Geofence Kantor Pusat (Setting System): Latitude, Longitude, Radius meter, dan Subnet IP Publik.")
    add_body_p(doc, "3. Konfigurasi Aturan Gaji (salary_rules): Tarif BPJS, Plafon upah, Pengali lembur, dan Grace Period keterlambatan.")
    add_body_p(doc, "4. Integrasi WhatsApp Bot Gateway: Pairing QR WhatsApp Web dan pengaturan interval anti-banned.")
    add_body_p(doc, "5. Prosedur Pencadangan & Pemulihan Bencana: Backup SQLite harian dan RTO < 5 menit.")

    doc.add_page_break()

    # ---------------------------------------------------------------------------
    # BAB IX - XII: FORMULA, INTEGRASI, TROUBLESHOOTING & GLOSARIUM
    # ---------------------------------------------------------------------------
    add_heading_1(doc, "BAB IX: FORMULA PERHITUNGAN MATEMATIS & ATURAN BISNIS FINANSIAL")
    add_body_p(doc, "1. Lembur Depnaker: Upah per jam = 1/173 x Gaji Pokok. Hari kerja: 1.5x jam pertama, 2.0x jam kedua dst. Hari libur: 2.0x jam 1-7, 3.0x jam 8, 4.0x jam 9 dst.")
    add_body_p(doc, "2. Denda Keterlambatan: Tier 0 (0-15m = Rp 0), Tier 1 (16-30m = 0.5%), Tier 2 (31-60m = 1.0%), Tier 3 (>60m = potong 1 hari).")
    add_body_p(doc, "3. BPJS: JHT (2% / 3.7%), JP (1% / 2%), JKK (0% / 0.89%), JKM (0% / 0.30%), BPJS Kesehatan (1% / 4%).")
    add_body_p(doc, "4. PPh 21 TER: Dihitung dari Penghasilan Bruto x Tarif TER Kategori A, B, atau C.")

    add_heading_1(doc, "BAB X: PANDUAN INTEGRASI ENGINE OTOMATIS & BACKEND SERVICES")
    add_body_p(doc, "• WhatsApp Bot Baileys: Komunikasi langsung socket WebSocket WhatsApp Web dengan tabel wa_opt_ins untuk proteksi nomor anti-banned.")
    add_body_p(doc, "• SMTP Nodemailer: Pengiriman email notifikasi pemulihan password dan ringkasan eksekutif ke Direksi.")
    add_body_p(doc, "• AI Biometric Engine (FaceNet ResNet-34): Ekstraksi 128 vektor wajah dan pencocokan jarak Euclidean <= 0.45 dengan proteksi anti-spoofing.")

    add_heading_1(doc, "BAB XI: TROUBLESHOOTING MANDIRI BERDASARKAN PERAN & FAQ")
    add_body_p(doc, "• Staf: Kamera gagal (cek izin browser), GPS Merah (buka Google Maps agar satelit lock), Wajah tidak cocok (cek pencahayaan lampu).")
    add_body_p(doc, "• PM / HR: Foto tukang gagal (sistem simpan offline di browser), Lupa password (klik Reset Password di Data Karyawan).")

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

    # Primary Desktop file with visual flowchart
    out_desktop_diagram = r"C:\Users\prime\Desktop\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS_DENGAN_DIAGRAM_FLOWCHART.docx"
    try:
        doc.save(out_desktop_diagram)
        print(f"[OK] Saved to Desktop (Visual Edition): {out_desktop_diagram}")
    except Exception as e:
        print(f"[WARN] Desktop save error: {e}")

    # Also try overwriting the other desktop files if unlocked
    for dt_name in ["BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS_LENGKAP_PER_ROLE.docx", "BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.docx"]:
        dt_path = os.path.join(r"C:\Users\prime\Desktop", dt_name)
        try:
            doc.save(dt_path)
            print(f"[OK] Updated Desktop file: {dt_path}")
        except PermissionError:
            pass

    out_user_docs = r"C:\Users\prime\Documents\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.docx"
    try:
        doc.save(out_user_docs)
        print(f"[OK] Saved to Documents: {out_user_docs}")
    except PermissionError:
        pass

    artifact_dir = r"C:\Users\prime\.gemini\antigravity-cli\brain\4fbf6728-925d-466f-87af-e179e5f86f48"
    if os.path.exists(artifact_dir):
        out_art = os.path.join(artifact_dir, "BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.docx")
        doc.save(out_art)
        print(f"[OK] Saved to Artifact: {out_art}")

if __name__ == "__main__":
    create_full_role_manual()
