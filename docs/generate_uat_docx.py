import os
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_shading(cell, color_hex):
    """Apply background color shading to a table cell."""
    shading_xml = f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>'
    cell._tc.get_or_add_tcPr().append(parse_xml(shading_xml))

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set padding for a cell in dxa (1 pt = 20 dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_table_borders(table, color="CBD5E1", sz="4", val="single"):
    """Apply subtle borders to table."""
    tblPr = table._tbl.tblPr
    borders_xml = f'''
    <w:tblBorders {nsdecls("w")}>
        <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        <w:left w:val="none"/>
        <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        <w:right w:val="none"/>
        <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        <w:insideV w:val="none"/>
    </w:tblBorders>
    '''
    tblPr.append(parse_xml(borders_xml))

def create_uat_document():
    doc = Document()

    # 1. Page Setup (A4 Portrait, 0.65 in margins)
    for section in doc.sections:
        section.page_width = Inches(8.27)  # A4 width
        section.page_height = Inches(11.69) # A4 height
        section.top_margin = Inches(0.65)
        section.bottom_margin = Inches(0.65)
        section.left_margin = Inches(0.65)
        section.right_margin = Inches(0.65)

    # Palette
    COLOR_PRIMARY = RGBColor(24, 52, 94)    # #18345E Deep Navy
    COLOR_SECONDARY = RGBColor(40, 60, 90)  # #283C5A Slate Navy
    COLOR_ACCENT = RGBColor(255, 107, 0)    # #FF6B00 Prime Orange
    COLOR_TEXT = RGBColor(34, 38, 42)       # #22262A Charcoal
    COLOR_MUTED = RGBColor(100, 116, 139)   # #64748B Slate Muted

    # Normal Style Configuration
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Segoe UI'
    normal_style.font.size = Pt(9.5)
    normal_style.font.color.rgb = COLOR_TEXT

    # -------------------------------------------------------------
    # HEADER & BRANDING BANNER
    # -------------------------------------------------------------
    p_header = doc.add_paragraph()
    p_header.paragraph_format.space_before = Pt(0)
    p_header.paragraph_format.space_after = Pt(2)
    run_badge = p_header.add_run("PRIME HRIS ENTERPRISE • QUALITY ASSURANCE & ACCEPTANCE GATEWAY")
    run_badge.font.size = Pt(8.5)
    run_badge.font.bold = True
    run_badge.font.color.rgb = COLOR_ACCENT

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(2)
    p_title.paragraph_format.space_after = Pt(2)
    run_title = p_title.add_run("LEMBAR PENGUJIAN PENERIMAAN PENGGUNA (UAT)")
    run_title.font.size = Pt(17)
    run_title.font.bold = True
    run_title.font.color.rgb = COLOR_PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(12)
    run_sub = p_sub.add_run("Sistem Informasi Sumber Daya Manusia & Terminal Biometrik v2.4.0 (Edge-Cloud Hybrid)")
    run_sub.font.size = Pt(10)
    run_sub.font.color.rgb = COLOR_MUTED

    # -------------------------------------------------------------
    # SECTION I: INFORMASI UMUM
    # -------------------------------------------------------------
    p_sec1 = doc.add_paragraph()
    p_sec1.paragraph_format.space_before = Pt(6)
    p_sec1.paragraph_format.space_after = Pt(4)
    run_sec1 = p_sec1.add_run("I. INFORMASI UMUM PENGUJIAN")
    run_sec1.font.size = Pt(11)
    run_sec1.font.bold = True
    run_sec1.font.color.rgb = COLOR_SECONDARY

    t_info = doc.add_table(rows=4, cols=4)
    t_info.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_info, "CBD5E1", "4")

    info_data = [
        [("Nama Sistem:", True), ("PRIME HRIS Enterprise v2.4.0", False), ("Tanggal UAT:", True), ("10 Oktober 2026", False)],
        [("Production Gateway:", True), ("https://hris.primeprojectx.net", False), ("Lokasi Pengujian:", True), ("Workshop JIIPE / Office Hub", False)],
        [("Infrastruktur:", True), ("POCO X3 Edge Node + VPS Hub", False), ("Lead Architect / TPM:", True), ("Galih Primananda", False)],
        [("Metode Pengujian:", True), ("Live Functional Black-Box & E2E", False), ("Penguji (User/HR):", True), ("Perwakilan HR & Operasional", False)],
    ]

    for r_idx, row in enumerate(info_data):
        for c_idx, (text, is_bold) in enumerate(row):
            cell = t_info.cell(r_idx, c_idx)
            set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
            if is_bold:
                set_cell_shading(cell, "F1F5F9")
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(text)
            r.font.size = Pt(8.5)
            r.font.bold = is_bold
            if is_bold:
                r.font.color.rgb = COLOR_PRIMARY

    # -------------------------------------------------------------
    # SECTION II: TUJUAN DAN RUANG LINGKUP
    # -------------------------------------------------------------
    p_sec2 = doc.add_paragraph()
    p_sec2.paragraph_format.space_before = Pt(10)
    p_sec2.paragraph_format.space_after = Pt(4)
    run_sec2 = p_sec2.add_run("II. TUJUAN & RUANG LINGKUP VALIDASI")
    run_sec2.font.size = Pt(11)
    run_sec2.font.bold = True
    run_sec2.font.color.rgb = COLOR_SECONDARY

    p_desc = doc.add_paragraph()
    p_desc.paragraph_format.space_before = Pt(0)
    p_desc.paragraph_format.space_after = Pt(8)
    p_desc.add_run(
        "Pengujian User Acceptance Testing (UAT) ini difokuskan pada validasi fungsionalitas mutakhir sistem PRIME HRIS "
        "yang mencakup: (1) Arsitektur Geofence-First pada Kiosk 1:N dan Presensi Mandiri Smartphone, (2) Pengenalan Wajah Otomatis "
        "ZNCC Pearson Cross-Correlation, (3) Normalisasi Delimiter Waktu & Pengurutan Kronologis Timeline Kehadiran, (4) Deteksi "
        "Otomatis Shift Masuk/Pulang dan Status Keterlambatan, serta (5) Integritas Audit Trail SQLite pada server edge."
    )

    # -------------------------------------------------------------
    # SECTION III: MATRIKS PENGUJIAN (BAGIAN A S/D E)
    # -------------------------------------------------------------
    p_sec3 = doc.add_paragraph()
    p_sec3.paragraph_format.space_before = Pt(10)
    p_sec3.paragraph_format.space_after = Pt(4)
    run_sec3 = p_sec3.add_run("III. MATRIKS SKENARIO PENGUJIAN UAT (18 SKENARIO)")
    run_sec3.font.size = Pt(11)
    run_sec3.font.bold = True
    run_sec3.font.color.rgb = COLOR_SECONDARY

    modules = [
        {
            "category": "BAGIAN A: TERMINAL KIOSK 1:N MANDIRI (https://hris.primeprojectx.net/?tab=kiosk)",
            "items": [
                ("A.1", "Geofence-First Barrier (Blokir Lock-On Luar Lokasi)",
                 "Buka Kiosk pada perangkat di luar radius geofence (>350m) lalu hadapkan wajah ke kamera.",
                 "Sistem mendeteksi wajah tapi LANGSUNG MEMBLOKIR lock-on wajah (progress 0%), membunyikan tone peringatan, menampilkan modal penolakan, dan merekam log SQLite."),
                ("A.2", "Kesiapan Sinyal Hardware GPS",
                 "Buka Kiosk saat sinyal GPS browser masih proses acquiring.",
                 "Sistem menampilkan status '⏳ Menunggu Sinyal GPS Terkunci...' dan menahan verifikasi wajah hingga koordinat satelit terkunci."),
                ("A.3", "Presensi Wajah Berhasil (Lokasi Valid)",
                 "Berada di dalam area geofence kantor/site, hadapkan wajah ke kamera Kiosk.",
                 "Sistem menampilkan '📍 Lokasi Sesuai', progress wajah mengunci dalam ~800ms, mengambil snapshot dengan chime sukses, dan data tersimpan."),
                ("A.4", "Deteksi Otomatis Shift Masuk vs Pulang",
                 "Presensi pagi hari (pertama kali), lalu presensi lagi pada sore/jam pulang.",
                 "Presensi pertama otomatis tercatat MASUK (Check-In). Presensi kedua otomatis tercatat PULANG (Check-Out) tanpa menimpa jam masuk awal."),
                ("A.5", "Executive Digital Watermark Permanen",
                 "Periksa foto hasil snapshot presensi Kiosk.",
                 "Terpatri banner audit permanen: Nama, NIK, Waktu WIB presisi, Koordinat Lat/Lng, Jarak GPS, Nama Geofence, dan Status Jaringan."),
                ("A.6", "Auto-Reset Standby 4 Detik",
                 "Selesaikan presensi di Kiosk lalu tunggu tanpa menyentuh layar.",
                 "Hitung mundur 4 detik berjalan lalu layar otomatis kembali bersih ke mode viewfinder standby untuk karyawan berikutnya."),
                ("A.7", "Pencarian Karyawan Manual (Fallback)",
                 "Klik 'Cari Karyawan', cari nama/NIK karyawan belum daftar wajah, ambil foto.",
                 "Jika dalam geofence: foto terambil dan tersimpan. Jika di luar geofence: muncul peringatan penolakan geofence.")
            ]
        },
        {
            "category": "BAGIAN B: PRESENSI MANDIRI SMARTPHONE (https://hris.primeprojectx.net/?tab=camera)",
            "items": [
                ("B.1", "Proteksi Gerbang Kamera WFO (Luar Geofence)",
                 "Pilih mode WFO saat posisi di luar radius geofence resmi, klik tombol 'Buka Kamera'.",
                 "Kamera DICEGAH TERBUKA, berbunyi nada penolakan, dan muncul peringatan bahwa lokasi aktual berada di luar radius resmi."),
                ("B.2", "Akses Kamera WFO di Lokasi Resmi",
                 "Berada di dalam area kantor / site proyek yang ditugaskan, klik 'Buka Kamera'.",
                 "Kamera pop-up terbuka normal, bingkai reticle pemandu wajah aktif, jarak GPS valid, dan foto dapat diambil."),
                ("B.3", "Pengajuan Mode Dinas Luar Mendadak",
                 "Pilih mode DINAS_LUAR, isi form tujuan, klien, dan keperluan, klik submit.",
                 "Presensi berhasil terkirim dengan status DINAS_LUAR_PENDING (menunggu persetujuan HR), tanpa terblokir batas geofence kantor."),
                ("B.4", "Deteksi Otomatis Jadwal & Keterlambatan",
                 "Lakukan presensi melewati batas toleransi jadwal proyek (misal >08:30 WIB).",
                 "Sistem otomatis menetapkan status LATE, menghitung menit keterlambatan, dan mewajibkan pengisian alasan keterlambatan.")
            ]
        },
        {
            "category": "BAGIAN C: MONITORING TIMELINE KEHADIRAN (https://hris.primeprojectx.net/?tab=timeline)",
            "items": [
                ("C.1", "Pengurutan Kronologis Teratas (Sort at Top)",
                 "Buka tab Timeline setelah ada karyawan yang melakukan presensi hari ini.",
                 "Karyawan yang sudah presensi OTOMATIS TAMPIL DI BARIS PALING ATAS berurutan sesuai jam kedatangan terawal."),
                ("C.2", "Normalisasi Delimiter Waktu & Status Badge",
                 "Periksa swimlane baris karyawan yang sudah presensi.",
                 "Waktu tampil presisi (HH:mm:ss), pin waktu aktif hijau, dan teks fallback 'Belum melakukan presensi' tidak muncul."),
                ("C.3", "Modal Audit Rincian Kehadiran",
                 "Klik baris nama karyawan yang sudah presensi pada timeline.",
                 "Terbuka modal detail audit lengkap dengan foto selfie ber-watermark, jam presensi, titik peta, dan IP gateway.")
            ]
        },
        {
            "category": "BAGIAN D: PENGATURAN GEOFENCE & MULTI-PROYEK",
            "items": [
                ("D.1", "Fleksibilitas Geofence Proyek Terkait",
                 "Karyawan ditugaskan ke Proyek JIIPE / Ciremai, presensi di koordinat proyek.",
                 "Sistem memvalidasi terhadap titik proyek tersebut tanpa dianggap berada di luar kantor pusat."),
                ("D.2", "Konfigurasi Radius & Koordinat",
                 "Buka modal pengaturan Geofence, ubah radius atau salin GPS HP, simpan.",
                 "Perubahan tersimpan ke server dan evaluasi jarak presensi langsung terbarui secara instan.")
            ]
        },
        {
            "category": "BAGIAN E: INTEGRITAS AUDIT TRAIL & PERFORMA EDGE",
            "items": [
                ("E.1", "Audit Trail Penolakan ke Basis Data SQLite",
                 "Picu penolakan geofence pada Kiosk, lalu periksa log audit admin.",
                 "Event KIOSK_ATTENDANCE_DENIED_GEOFENCE terekam lengkap dengan NIK, nama, jarak aktual, toleransi, dan IP address."),
                ("E.2", "Keandalan Edge Server POCO X3 NFC",
                 "Akses portal dari beberapa smartphone/PC secara simultan.",
                 "Portal merespons cepat (<1 detik), stream kamera lancar, dan sinkronisasi basis data SQLite berjalan mulus.")
            ]
        }
    ]

    for mod in modules:
        p_mod = doc.add_paragraph()
        p_mod.paragraph_format.space_before = Pt(8)
        p_mod.paragraph_format.space_after = Pt(2)
        r_mod = p_mod.add_run(mod["category"])
        r_mod.font.size = Pt(9.5)
        r_mod.font.bold = True
        r_mod.font.color.rgb = COLOR_PRIMARY

        t_mod = doc.add_table(rows=len(mod["items"]) + 1, cols=5)
        t_mod.alignment = WD_TABLE_ALIGNMENT.CENTER
        set_table_borders(t_mod, "CBD5E1", "4")

        # Header Table
        headers = ["No", "Skenario Pengujian", "Langkah Pengujian", "Hasil yang Diharapkan", "Status UAT"]
        col_widths = [Inches(0.5), Inches(1.8), Inches(2.2), Inches(2.5), Inches(0.97)]

        for c_idx, h_text in enumerate(headers):
            cell = t_mod.cell(0, c_idx)
            cell.width = col_widths[c_idx]
            set_cell_shading(cell, "18345E")
            set_cell_margins(cell, top=80, bottom=80, left=90, right=90)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            if c_idx in [0, 4]:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(h_text)
            r.font.size = Pt(8.5)
            r.font.bold = True
            r.font.color.rgb = RGBColor(255, 255, 255)

        # Rows
        for r_idx, (t_no, t_title, t_steps, t_expect) in enumerate(mod["items"], start=1):
            bg_color = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
            row_cells = t_mod.rows[r_idx].cells
            
            # Widths
            for c_idx, w in enumerate(col_widths):
                row_cells[c_idx].width = w

            # Col 0: No
            set_cell_shading(row_cells[0], bg_color)
            set_cell_margins(row_cells[0], top=60, bottom=60, left=70, right=70)
            p0 = row_cells[0].paragraphs[0]
            p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p0.paragraph_format.space_before = Pt(0)
            p0.paragraph_format.space_after = Pt(0)
            r0 = p0.add_run(t_no)
            r0.font.size = Pt(8.5)
            r0.font.bold = True
            r0.font.color.rgb = COLOR_PRIMARY

            # Col 1: Skenario
            set_cell_shading(row_cells[1], bg_color)
            set_cell_margins(row_cells[1], top=60, bottom=60, left=70, right=70)
            p1 = row_cells[1].paragraphs[0]
            p1.paragraph_format.space_before = Pt(0)
            p1.paragraph_format.space_after = Pt(0)
            r1 = p1.add_run(t_title)
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_TEXT

            # Col 2: Langkah
            set_cell_shading(row_cells[2], bg_color)
            set_cell_margins(row_cells[2], top=60, bottom=60, left=70, right=70)
            p2 = row_cells[2].paragraphs[0]
            p2.paragraph_format.space_before = Pt(0)
            p2.paragraph_format.space_after = Pt(0)
            r2 = p2.add_run(t_steps)
            r2.font.size = Pt(8)
            r2.font.color.rgb = COLOR_TEXT

            # Col 3: Harapan
            set_cell_shading(row_cells[3], bg_color)
            set_cell_margins(row_cells[3], top=60, bottom=60, left=70, right=70)
            p3 = row_cells[3].paragraphs[0]
            p3.paragraph_format.space_before = Pt(0)
            p3.paragraph_format.space_after = Pt(0)
            r3 = p3.add_run(t_expect)
            r3.font.size = Pt(8)
            r3.font.color.rgb = COLOR_TEXT

            # Col 4: Checkbox PASS / FAIL
            set_cell_shading(row_cells[4], bg_color)
            set_cell_margins(row_cells[4], top=60, bottom=60, left=60, right=60)
            p4 = row_cells[4].paragraphs[0]
            p4.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p4.paragraph_format.space_before = Pt(0)
            p4.paragraph_format.space_after = Pt(0)
            r4a = p4.add_run("[  ] PASS\n")
            r4a.font.size = Pt(7.5)
            r4a.font.bold = True
            r4a.font.color.rgb = RGBColor(16, 149, 107) # Green
            r4b = p4.add_run("[  ] FAIL")
            r4b.font.size = Pt(7.5)
            r4b.font.bold = True
            r4b.font.color.rgb = RGBColor(225, 29, 72)  # Red

    # -------------------------------------------------------------
    # SECTION IV: REKAPITULASI HASIL
    # -------------------------------------------------------------
    doc.add_page_break()

    p_sec4 = doc.add_paragraph()
    p_sec4.paragraph_format.space_before = Pt(4)
    p_sec4.paragraph_format.space_after = Pt(4)
    run_sec4 = p_sec4.add_run("IV. REKAPITULASI HASIL PENGUJIAN UAT")
    run_sec4.font.size = Pt(11)
    run_sec4.font.bold = True
    run_sec4.font.color.rgb = COLOR_SECONDARY

    t_rekap = doc.add_table(rows=7, cols=5)
    t_rekap.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_rekap, "CBD5E1", "4")

    rekap_headers = ["Kategori Modul Sistem", "Total Item", "Lulus (PASS)", "Gagal (FAIL)", "Catatan / Pending"]
    rekap_col_widths = [Inches(3.2), Inches(1.1), Inches(1.2), Inches(1.2), Inches(1.27)]

    for c_idx, h_text in enumerate(rekap_headers):
        cell = t_rekap.cell(0, c_idx)
        cell.width = rekap_col_widths[c_idx]
        set_cell_shading(cell, "283C5A")
        set_cell_margins(cell, top=70, bottom=70, left=80, right=80)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        if c_idx >= 1:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h_text)
        r.font.size = Pt(8.5)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    rekap_data = [
        ("Bagian A: Terminal Kiosk 1:N Mandiri", "7", "", "", ""),
        ("Bagian B: Presensi Mandiri Smartphone (Web Mobile)", "4", "", "", ""),
        ("Bagian C: Monitoring Timeline Kehadiran Real-Time", "3", "", "", ""),
        ("Bagian D: Pengaturan Geofence & Multi-Proyek", "2", "", "", ""),
        ("Bagian E: Integritas Audit Trail & Keandalan Edge", "2", "", "", ""),
        ("TOTAL KESELURUHAN SKENARIO", "18", "", "", ""),
    ]

    for r_idx, row in enumerate(rekap_data, start=1):
        is_total = (r_idx == 6)
        bg = "F1F5F9" if is_total else ("F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
        for c_idx, val in enumerate(row):
            cell = t_rekap.cell(r_idx, c_idx)
            cell.width = rekap_col_widths[c_idx]
            set_cell_shading(cell, bg)
            set_cell_margins(cell, top=65, bottom=65, left=80, right=80)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            if c_idx >= 1:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(val)
            r.font.size = Pt(8.5)
            r.font.bold = is_total or (c_idx == 1)
            if is_total:
                r.font.color.rgb = COLOR_PRIMARY

    p_rate = doc.add_paragraph()
    p_rate.paragraph_format.space_before = Pt(8)
    p_rate.paragraph_format.space_after = Pt(8)
    r_rate = p_rate.add_run("Tingkat Kelulusan (Pass Rate):  [  __________ %  ]    •    Target Standar Kelulusan UAT: ≥ 95.0%")
    r_rate.font.size = Pt(9)
    r_rate.font.bold = True
    r_rate.font.color.rgb = COLOR_PRIMARY

    # -------------------------------------------------------------
    # SECTION V: LEMBAR PENGESAHAN (SIGN-OFF)
    # -------------------------------------------------------------
    p_sec5 = doc.add_paragraph()
    p_sec5.paragraph_format.space_before = Pt(10)
    p_sec5.paragraph_format.space_after = Pt(4)
    run_sec5 = p_sec5.add_run("V. KEPUTUSAN PENERIMAAN & LEMBAR PENGESAHAN (SIGN-OFF)")
    run_sec5.font.size = Pt(11)
    run_sec5.font.bold = True
    run_sec5.font.color.rgb = COLOR_SECONDARY

    p_decision = doc.add_paragraph()
    p_decision.paragraph_format.space_before = Pt(2)
    p_decision.paragraph_format.space_after = Pt(6)
    p_decision.add_run(
        "Berdasarkan pengujian langsung skenario di atas, pihak Manajemen dan Perwakilan Pengguna menyatakan:\n"
        "[   ]  DITERIMA PENUH (ACCEPTED) — Sistem memenuhi kriteria dan siap beroperasi penuh.\n"
        "[   ]  DITERIMA DENGAN CATATAN (ACCEPTED WITH NOTES) — Sistem dapat digunakan dengan catatan minor terlampir.\n"
        "[   ]  DITOLAK (REJECTED) — Sistem memerlukan perbaikan mayor sebelum diuji ulang."
    )
    p_decision.runs[0].font.size = Pt(8.5)

    p_notes_title = doc.add_paragraph()
    p_notes_title.paragraph_format.space_before = Pt(4)
    p_notes_title.paragraph_format.space_after = Pt(2)
    r_nt = p_notes_title.add_run("Catatan Tambahan Penguji / Rekomendasi Operasional:")
    r_nt.font.size = Pt(8.5)
    r_nt.font.bold = True

    # Box for notes
    t_notes = doc.add_table(rows=1, cols=1)
    t_notes.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_notes, "CBD5E1", "6")
    cell_n = t_notes.cell(0, 0)
    cell_n.width = Inches(7.97)
    set_cell_shading(cell_n, "F8FAFC")
    set_cell_margins(cell_n, top=100, bottom=300, left=100, right=100)
    p_n = cell_n.paragraphs[0]
    p_n.paragraph_format.space_before = Pt(0)
    p_n.paragraph_format.space_after = Pt(0)
    r_blank = p_n.add_run("...\n\n")
    r_blank.font.size = Pt(8.5)
    r_blank.font.color.rgb = COLOR_MUTED

    # Signature Table
    p_sig_title = doc.add_paragraph()
    p_sig_title.paragraph_format.space_before = Pt(12)
    p_sig_title.paragraph_format.space_after = Pt(4)
    r_st = p_sig_title.add_run("Tanda Tangan Pengesahan UAT (10 Oktober 2026):")
    r_st.font.size = Pt(8.5)
    r_st.font.bold = True

    t_sig = doc.add_table(rows=2, cols=3)
    t_sig.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t_sig, "CBD5E1", "4")
    sig_col_widths = [Inches(2.65), Inches(2.66), Inches(2.66)]

    sig_headers = [
        "Pihak Penguji 1\n(HR & Management Lead)",
        "Pihak Penguji 2\n(Site Operational Lead)",
        "Pihak Pengembang Sistem\n(Architect & Tech Lead)"
    ]

    for c_idx, s_text in enumerate(sig_headers):
        cell = t_sig.cell(0, c_idx)
        cell.width = sig_col_widths[c_idx]
        set_cell_shading(cell, "F1F5F9")
        set_cell_margins(cell, top=80, bottom=80, left=80, right=80)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(s_text)
        r.font.size = Pt(8)
        r.font.bold = True
        r.font.color.rgb = COLOR_PRIMARY

    sig_bodies = [
        "\n\n\n___________________________\nNama:\nJabatan:\nTanggal: 10 Oktober 2026",
        "\n\n\n___________________________\nNama:\nJabatan:\nTanggal: 10 Oktober 2026",
        "\n\n\n___________________________\nGalih Primananda\nLead Architect & TPM\nTanggal: 10 Oktober 2026"
    ]

    for c_idx, b_text in enumerate(sig_bodies):
        cell = t_sig.cell(1, c_idx)
        cell.width = sig_col_widths[c_idx]
        set_cell_shading(cell, "FFFFFF")
        set_cell_margins(cell, top=80, bottom=100, left=80, right=80)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(b_text)
        r.font.size = Pt(8)
        r.font.color.rgb = COLOR_TEXT

    # Save DOCX
    docx_path = os.path.abspath("C:/Users/PRIMA/prime-hris/docs/UAT_Checksheet_PRIME_HRIS.docx")
    doc.save(docx_path)
    print(f"[OK] Generated DOCX at: {docx_path}")
    return docx_path

def convert_docx_to_pdf(docx_path):
    pdf_path = docx_path.replace(".docx", ".pdf")
    try:
        import win32com.client
        import pythoncom
        pythoncom.CoInitialize()
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = False
        doc = word.Documents.Open(docx_path)
        # 17 = wdFormatPDF
        doc.SaveAs(pdf_path, FileFormat=17)
        doc.Close()
        word.Quit()
        pythoncom.CoUninitialize()
        print(f"[OK] Generated PDF at: {pdf_path}")
        return pdf_path
    except Exception as e:
        print(f"[WARN] Failed to convert DOCX to PDF via Word COM: {e}")
        return None

if __name__ == "__main__":
    d_path = create_uat_document()
    p_path = convert_docx_to_pdf(d_path)
