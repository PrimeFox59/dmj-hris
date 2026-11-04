import os
import sys
import datetime
import hashlib
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
import win32com.client
import importlib.util

# Load canonical Prime footer & validator
tmpl_path = r"C:\Users\PRIMA\templates\prime_report_template.py"
spec = importlib.util.spec_from_file_location("prime_report_template", tmpl_path)
tmpl_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tmpl_mod)
apply_canonical_prime_footer = tmpl_mod.apply_canonical_prime_footer
validate_no_signature_or_approval_blocks = tmpl_mod.validate_no_signature_or_approval_blocks

def set_cell_background(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    for ch in list(tcPr):
        if ch.tag.endswith('shd'):
            tcPr.remove(ch)
    tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>'))

def set_cell_margins(cell, top=80, bottom=80, left=120, right=120):
    tcPr = cell._tc.get_or_add_tcPr()
    for ch in list(tcPr):
        if ch.tag.endswith('tcMar'):
            tcPr.remove(ch)
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'  <w:top w:w="{top}" w:type="dxa"/>'
        f'  <w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'  <w:left w:w="{left}" w:type="dxa"/>'
        f'  <w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_box_borders(table, color="CBD5E1", sz="4"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:right w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideH w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideV w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def set_table_borders(table, color="CBD5E1", sz="4"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:left w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'  <w:insideH w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideV w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def make_row_header(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
    trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

def make_row_cant_split(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

def build_perfect_2page_bap():
    doc = docx.Document()

    # Section Page Margins - calibrated for exact 2-page executive density
    for s in doc.sections:
        s.top_margin = Inches(0.35)
        s.bottom_margin = Inches(0.40)
        s.left_margin = Inches(0.50)
        s.right_margin = Inches(0.50)

    # Apply Canonical Prime Projectx Footer
    apply_canonical_prime_footer(
        doc,
        subtitle="Enterprise Systems & Digital Infrastructure Governance"
    )

    # Colors
    HEX_PRIMARY = "18345E"
    HEX_SECONDARY = "283C5A"
    HEX_ACCENT = "1E508C"
    HEX_GREEN_BG = "ECFDF5"
    HEX_CARD = "F8FAFC"
    HEX_BORDER = "CBD5E1"

    COLOR_PRIMARY = RGBColor(0x18, 0x34, 0x5E)
    COLOR_SECONDARY = RGBColor(0x28, 0x3C, 0x5A)
    COLOR_ACCENT = RGBColor(0x1E, 0x50, 0x8C)
    COLOR_GREEN_TEXT = RGBColor(0x04, 0x78, 0x57)
    COLOR_TEXT = RGBColor(0x1E, 0x29, 0x3B)
    COLOR_TEXT_MUTED = RGBColor(0x64, 0x74, 0x8B)

    # 1. Header table
    head_tbl = doc.add_table(rows=1, cols=2)
    head_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    head_tbl.autofit = False
    head_tbl.columns[0].width = Inches(4.7)
    head_tbl.columns[1].width = Inches(2.8)
    make_row_cant_split(head_tbl.rows[0])

    c_vl = head_tbl.cell(0, 0)
    set_cell_margins(c_vl, top=15, bottom=15, left=15, right=15)
    p_vl = c_vl.paragraphs[0]
    r_v1 = p_vl.add_run("PT PRIME INFINITY SYSTEMS\n")
    r_v1.font.bold = True
    r_v1.font.size = Pt(10.0)
    r_v1.font.color.rgb = COLOR_PRIMARY

    r_v2 = p_vl.add_run(
        "Software Engineering, Enterprise Systems & AI Infrastructure\n"
        "Surabaya & Sidoarjo, Jawa Timur, Indonesia  |  Portal: primeprojectx.net  |  Email: galih@primeprojectx.net\n"
    )
    r_v2.font.size = Pt(7.0)
    r_v2.font.color.rgb = COLOR_TEXT_MUTED

    c_vr = head_tbl.cell(0, 1)
    set_cell_margins(c_vr, top=15, bottom=15, left=15, right=15)
    p_vr = c_vr.paragraphs[0]
    p_vr.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    dmj_logo_path = r"C:\Users\PRIMA\prime-hris\dist\dmj-logo-transparent.png"
    if os.path.exists(dmj_logo_path):
        r_lg = p_vr.add_run()
        r_lg.add_picture(dmj_logo_path, width=Inches(1.2))
        p_vr.add_run("\n")

    r_cl1 = p_vr.add_run("PT DWI MARTHA JAYA (PT DMJ)\n")
    r_cl1.font.bold = True
    r_cl1.font.size = Pt(8.5)
    r_cl1.font.color.rgb = COLOR_SECONDARY

    r_cl2 = p_vr.add_run("Integrated Design & Construction Solutions  |  Jawa Timur, Indonesia\n")
    r_cl2.font.size = Pt(7.0)
    r_cl2.font.color.rgb = COLOR_TEXT_MUTED

    # Divider line
    p_sep = doc.add_paragraph()
    p_sep.paragraph_format.space_before = Pt(1)
    p_sep.paragraph_format.space_after = Pt(2)
    pBdr = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="8" w:space="1" w:color="18345E"/></w:pBdr>')
    p_sep._p.get_or_add_pPr().append(pBdr)

    # Document Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_th1 = p_title.add_run("BERITA ACARA PEMERIKSAAN PROGRESS PEKERJAAN & KLAIM PEMBAYARAN TERMIN I\n")
    r_th1.font.bold = True
    r_th1.font.size = Pt(10.0)
    r_th1.font.color.rgb = COLOR_PRIMARY

    r_th2 = p_title.add_run("PENGEMBANGAN SISTEM PRIME HRIS ENTERPRISE - MILESTONE PROGRESS >50% (BAP-50)")
    r_th2.font.bold = True
    r_th2.font.size = Pt(8.5)
    r_th2.font.color.rgb = COLOR_ACCENT

    # Metadata table
    meta_tbl = doc.add_table(rows=1, cols=4)
    meta_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_tbl.autofit = False
    set_box_borders(meta_tbl, color="CBD5E1", sz="4")
    make_row_cant_split(meta_tbl.rows[0])
    widths_meta = [Inches(1.85), Inches(1.85), Inches(1.85), Inches(1.85)]
    for i, w in enumerate(widths_meta):
        meta_tbl.columns[i].width = w

    meta_items = [
        ("NOMOR BAP", "008/BAP-50/PIS-DMJ/XI/2026", COLOR_PRIMARY),
        ("TANGGAL EVALUASI", "Rabu, 04 November 2026", COLOR_TEXT),
        ("DASAR KONTRAK (PKS)", "008/PKS-IT/PIS-DMJ/IX/2026", COLOR_TEXT),
        ("STATUS PROGRESS", "TERVERIFIKASI >50% (60,0%)", COLOR_GREEN_TEXT)
    ]

    for idx, (label, val, col) in enumerate(meta_items):
        cell = meta_tbl.cell(0, idx)
        set_cell_background(cell, HEX_CARD if idx < 3 else HEX_GREEN_BG)
        set_cell_margins(cell, top=25, bottom=25, left=40, right=40)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_l = p.add_run(label + "\n")
        r_l.font.size = Pt(6.2)
        r_l.font.bold = True
        r_l.font.color.rgb = COLOR_TEXT_MUTED
        r_v = p.add_run(val)
        r_v.font.size = Pt(7.2)
        r_v.font.bold = True
        r_v.font.color.rgb = col

    # Preamble
    p_pr = doc.add_paragraph()
    r_pr = p_pr.add_run(
        "Pada hari ini, Rabu tanggal Empat bulan November tahun Dua Ribu Dua Puluh Enam (04-11-2026), bertempat di Surabaya, "
        "telah dilaksanakan pemeriksaan kemajuan fisik, fungsionalitas rekayasa modul, dan evaluasi hasil implementasi sistem "
        "informasi sumber daya manusia terpadu (Prime HRIS Enterprise - Paket Komplit Full Suite) untuk keperluan Klaim Pembayaran Termin I (Milestone Progress >50%), "
        "oleh dan antara:"
    )
    r_pr.font.size = Pt(7.4)

    # Pihak Table
    pihak_tbl = doc.add_table(rows=1, cols=2)
    pihak_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    pihak_tbl.autofit = False
    pihak_tbl.columns[0].width = Inches(3.75)
    pihak_tbl.columns[1].width = Inches(3.75)
    set_box_borders(pihak_tbl, color="CBD5E1", sz="4")
    make_row_cant_split(pihak_tbl.rows[0])

    c_p1 = pihak_tbl.cell(0, 0)
    set_cell_background(c_p1, HEX_CARD)
    set_cell_margins(c_p1, top=25, bottom=25, left=40, right=40)
    p1 = c_p1.paragraphs[0]
    r_p1_h = p1.add_run("PIHAK PERTAMA (PENGEMBANG / PELAKSANA):\n")
    r_p1_h.font.bold = True
    r_p1_h.font.size = Pt(7.2)
    r_p1_h.font.color.rgb = COLOR_PRIMARY
    r_p1_b = p1.add_run(
        "- Badan Usaha: PT PRIME INFINITY SYSTEMS (PRIME PROJECTX)\n"
        "- Penanggung Jawab: GALIH PRIMANANDA, S.E. (Director & Lead Platform Architect)\n"
        "- Alamat: Surabaya & Sidoarjo, Jawa Timur  |  Kontak: galih@primeprojectx.net\n"
        "- Peran: Pihak perancang arsitektur dan pengembang sistem."
    )
    r_p1_b.font.size = Pt(6.8)

    c_p2 = pihak_tbl.cell(0, 1)
    set_cell_background(c_p2, HEX_CARD)
    set_cell_margins(c_p2, top=25, bottom=25, left=40, right=40)
    p2 = c_p2.paragraphs[0]
    r_p2_h = p2.add_run("PIHAK KEDUA (KLIEN / PEMILIK PEKERJAAN):\n")
    r_p2_h.font.bold = True
    r_p2_h.font.size = Pt(7.2)
    r_p2_h.font.color.rgb = COLOR_SECONDARY
    r_p2_b = p2.add_run(
        "- Badan Usaha: PT DWI MARTHA JAYA (PT DMJ)\n"
        "- Bidang Usaha: Integrated Design & Construction Solutions\n"
        "- Penanggung Jawab: Direksi / Manajemen & Tim HR PT DMJ\n"
        "- Domain Staging: https://dmj.primeprojectx.net  |  Peran: Pemilik pekerjaan."
    )
    r_p2_b.font.size = Pt(6.8)

    # Section 1
    p_sec1 = doc.add_paragraph()
    r_s1 = p_sec1.add_run("1. DASAR KESEPAKATAN & KETENTUAN KLAIM TERMIN I\n")
    r_s1.font.bold = True
    r_s1.font.size = Pt(8.0)
    r_s1.font.color.rgb = COLOR_PRIMARY

    r_s1_t = p_sec1.add_run(
        "Pemeriksaan kemajuan pekerjaan ini dilaksanakan mengacu pada ketentuan Surat Perjanjian Kerja Sama (PKS) "
        "No. 008/PKS-IT/PIS-DMJ/IX/2026 tertanggal 21 September 2026, khususnya Pasal 2 Ayat 2 tentang Skema & Termin Pembayaran Proyek "
        "serta Pasal 2 Ayat 5 tentang Batas Waktu Pembayaran. PARA PIHAK menyatakan bahwa pembayaran Termin I (sebesar 50% = Rp 2.750.000,-) "
        "dapat diklaim dan dicairkan apabila kemajuan pengerjaan telah mencapai minimal 50%, dengan syarat terselesaikannya modul presensi biometrik "
        "selfie geotag satelit native, live demonstration fungsionalitas sistem pada server cloud staging, dan verifikasi Berita Acara Progress 50% (BAP-50)."
    )
    r_s1_t.font.size = Pt(7.4)

    # Section 2
    p_sec2 = doc.add_paragraph()
    r_s2 = p_sec2.add_run("2. HASIL VERIFIKASI FUNGSIONAL & MATRIKS PENCAPAIAN PROGRESS (>50%)\n")
    r_s2.font.bold = True
    r_s2.font.size = Pt(8.0)
    r_s2.font.color.rgb = COLOR_PRIMARY

    r_s2_d = p_sec2.add_run(
        "Berdasarkan audit teknis arsitektur kode dan live staging test pada server https://dmj.primeprojectx.net, rincian bobot "
        "pekerjaan dan status realisasi setiap modul adalah sebagai berikut:"
    )
    r_s2_d.font.size = Pt(7.4)

    # Modul Matrix Table
    mod_tbl = doc.add_table(rows=1, cols=6)
    mod_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    mod_tbl.autofit = False
    set_table_borders(mod_tbl, color="CBD5E1", sz="4")
    make_row_header(mod_tbl.rows[0])

    col_widths = [Inches(0.35), Inches(2.2), Inches(2.15), Inches(0.65), Inches(0.65), Inches(0.9)]
    for i, w in enumerate(col_widths):
        mod_tbl.columns[i].width = w
        cell = mod_tbl.cell(0, i)
        set_cell_background(cell, HEX_PRIMARY)
        set_cell_margins(cell, top=20, bottom=20, left=25, right=25)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i in [0, 3, 4, 5] else WD_ALIGN_PARAGRAPH.LEFT
        headers = ["NO", "MODUL / RUANG LINGKUP (PASAL 1 PKS)", "DESKRIPSI FUNGSIONAL & OUTPUT", "BOBOT", "REALISASI", "STATUS UJI"]
        r = p.add_run(headers[i])
        r.font.bold = True
        r.font.size = Pt(6.2)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    matrix_data = [
        ("01", "Dashboard & Web Admin Enterprise", "Live monitoring kehadiran real-time, visual headcount card, analitik multi-role.", "10.0%", "10.0%", "100% VERIFIED", True),
        ("02", "Presensi Biometrik Selfie & Geotag", "Kamera live kontur wajah, validasi GPS satelit native anti-fake, stempel watermark.", "15.0%", "15.0%", "100% VERIFIED", True),
        ("03", "Sequential Corporate WiFi Gate", "Validasi jaringan BSSID/SSID Access Point resmi kantor/workshop PT DMJ.", "5.0%", "5.0%", "100% VERIFIED", True),
        ("04", "Fleksibilitas Dinas Luar Mendadak", "Rute presensi khusus tim teknisi lapangan di site tanpa WiFi kantor, auto-approval.", "5.0%", "5.0%", "100% VERIFIED", True),
        ("05", "Deteksi Telat & Catatan Aktivitas", "Cut-off jam kerja otomatis, kalkulasi menit telat, form dispensasi & logbook staf.", "5.0%", "5.0%", "100% VERIFIED", True),
        ("06", "Multi-Tier Approval Hub", "Pengajuan digital berjenjang: cuti tahunan, izin sakit (surat dokter), dispensasi & lembur.", "8.0%", "8.0%", "100% VERIFIED", True),
        ("07", "Database SQLite WAL & Cloud Staging", "Mesin node:sqlite WAL concurrency tinggi, REST API, deployment live di dmj.primeprojectx.net.", "12.0%", "12.0%", "100% VERIFIED", True),
        ("08", "Mesin Penggajian Depnaker (Payroll)", "Formula lembur Depnaker (Gaji/173), kalkulasi tunjangan, integrasi slip gaji QR code.", "15.0%", "5.0%", "33% ON-PROGRESS", False),
        ("09", "Project Cost Accounting & Labor Forecast", "Distribusi pembebanan jam kerja teknisi ke pos akun proyek konstruksi DMJ & EAC.", "10.0%", "0.0%", "TAHAP TERMIN II", False),
        ("10", "Paket Aplikasi Mandiri Portable (.exe)", "Installer portable executable (.exe) mandiri dan sistem pencadangan database lokal.", "5.0%", "0.0%", "TAHAP TERMIN II", False),
        ("11", "Full Team Training On-Site & BAST Final", "1x sesi pelatihan intensif tatap muka seluruh divisi di workshop DMJ dan serah terima BAST.", "10.0%", "0.0%", "TAHAP TERMIN II", False),
    ]

    for item in matrix_data:
        no, mod_name, desc, bobot, realisasi, status, is_done = item
        row = mod_tbl.add_row()
        make_row_cant_split(row)

        c_no = row.cells[0]
        c_mod = row.cells[1]
        c_desc = row.cells[2]
        c_bbt = row.cells[3]
        c_rea = row.cells[4]
        c_sta = row.cells[5]

        bg_col = HEX_CARD if is_done else "FFFFFF"
        for c in [c_no, c_mod, c_desc, c_bbt, c_rea, c_sta]:
            set_cell_background(c, bg_col)
            set_cell_margins(c, top=16, bottom=16, left=20, right=20)

        # No
        p = c_no.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(no)
        r.font.size = Pt(6.5)
        r.font.bold = True
        r.font.color.rgb = COLOR_PRIMARY if is_done else COLOR_TEXT_MUTED

        # Modul Name
        p = c_mod.paragraphs[0]
        r = p.add_run(mod_name)
        r.font.size = Pt(6.5)
        r.font.bold = is_done
        r.font.color.rgb = COLOR_PRIMARY if is_done else COLOR_TEXT

        # Desc
        p = c_desc.paragraphs[0]
        r = p.add_run(desc)
        r.font.size = Pt(6.2)
        r.font.color.rgb = COLOR_TEXT

        # Bobot
        p = c_bbt.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(bobot)
        r.font.size = Pt(6.5)
        r.font.color.rgb = COLOR_TEXT_MUTED

        # Realisasi
        p = c_rea.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(realisasi)
        r.font.size = Pt(6.5)
        r.font.bold = is_done
        r.font.color.rgb = COLOR_GREEN_TEXT if is_done else (COLOR_ACCENT if realisasi != "0.0%" else COLOR_TEXT_MUTED)

        # Status
        p = c_sta.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(status)
        r.font.size = Pt(6.0)
        r.font.bold = True
        if is_done:
            r.font.color.rgb = COLOR_GREEN_TEXT
        elif "ON-PROGRESS" in status:
            r.font.color.rgb = COLOR_ACCENT
        else:
            r.font.color.rgb = COLOR_TEXT_MUTED

    # Total Summary Row
    tot_row = mod_tbl.add_row()
    make_row_cant_split(tot_row)
    c0 = tot_row.cells[0]
    c1 = tot_row.cells[1]
    c2 = tot_row.cells[2]
    c3 = tot_row.cells[3]
    c4 = tot_row.cells[4]
    c5 = tot_row.cells[5]

    for c in [c0, c1, c2, c3, c4, c5]:
        set_cell_background(c, HEX_GREEN_BG)
        set_cell_margins(c, top=20, bottom=20, left=25, right=25)

    c_tot_lbl = c0.merge(c1).merge(c2)
    p = c_tot_lbl.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run("TOTAL PROGRESS KUMULATIF REALISASI FISIK & FUNGSIONAL:")
    r.font.bold = True
    r.font.size = Pt(6.8)
    r.font.color.rgb = COLOR_GREEN_TEXT

    p3 = c3.paragraphs[0]
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r3 = p3.add_run("100.0%")
    r3.font.bold = True
    r3.font.size = Pt(7.0)
    r3.font.color.rgb = COLOR_TEXT

    p4 = c4.paragraphs[0]
    p4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r4 = p4.add_run("60.0%")
    r4.font.bold = True
    r4.font.size = Pt(7.5)
    r4.font.color.rgb = COLOR_GREEN_TEXT

    p5 = c5.paragraphs[0]
    p5.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r5 = p5.add_run("LOLOS EVALUASI (>50%)")
    r5.font.bold = True
    r5.font.size = Pt(6.2)
    r5.font.color.rgb = COLOR_GREEN_TEXT

    # Section 3: Penetapan Klaim
    p_sec3 = doc.add_paragraph()
    r_s3 = p_sec3.add_run("3. PENETAPAN KLAIM PEMBAYARAN TERMIN I (50%)\n")
    r_s3.font.bold = True
    r_s3.font.size = Pt(8.0)
    r_s3.font.color.rgb = COLOR_PRIMARY

    r_s3_t = p_sec3.add_run(
        "Mengingat realisasi progress fisik dan fungsionalitas sistem telah mencapai 60,0% (telah melampaui ketentuan syarat batas 50% "
        "sesuai Pasal 2 Ayat 2 Surat Perjanjian Kerja Sama No. 008/PKS-IT/PIS-DMJ/IX/2026), maka PARA PIHAK menyatakan dan menyetujui "
        "bahwa PIHAK PERTAMA secara sah berhak mengajukan pencairan pembayaran Termin I sebesar 50% dari total nilai kontrak pokok."
    )
    r_s3_t.font.size = Pt(7.4)

    # Claim Billing Summary Table
    bill_tbl = doc.add_table(rows=4, cols=3)
    bill_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    bill_tbl.autofit = False
    bill_tbl.columns[0].width = Inches(4.0)
    bill_tbl.columns[1].width = Inches(1.5)
    bill_tbl.columns[2].width = Inches(2.0)
    set_box_borders(bill_tbl, color="CBD5E1", sz="4")

    bill_rows_data = [
        ("Total Nilai Kontrak Pokok (Prime HRIS Enterprise Full Suite)", "100%", "Rp 5.500.000,-", False, False),
        ("Capaian Milestone Terverifikasi (BAP-50)", "60.0%", "Lolos Syarat >50%", False, True),
        ("Porsi Pembayaran Termin I Yang Diklaim (Pasal 2 Ayat 2 PKS)", "50%", "Rp 2.750.000,-", True, False),
        ("Sisa Kewajiban Pelunasan Termin II (Pasca UAT 100% & BAST)", "50%", "Rp 2.750.000,-", False, False)
    ]

    for idx, (desc_txt, pct_txt, val_txt, is_highlight, is_status) in enumerate(bill_rows_data):
        row = bill_tbl.rows[idx]
        make_row_cant_split(row)
        c0, c1, c2 = row.cells[0], row.cells[1], row.cells[2]
        
        bg = HEX_GREEN_BG if is_highlight else (HEX_CARD if idx % 2 == 0 else "FFFFFF")
        for c in [c0, c1, c2]:
            set_cell_background(c, bg)
            set_cell_margins(c, top=20, bottom=20, left=35, right=35)

        p0 = c0.paragraphs[0]
        r0 = p0.add_run(desc_txt)
        r0.font.size = Pt(7.0)
        r0.font.bold = is_highlight
        r0.font.color.rgb = COLOR_GREEN_TEXT if is_highlight else COLOR_TEXT

        p1 = c1.paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r1 = p1.add_run(pct_txt)
        r1.font.size = Pt(7.0)
        r1.font.bold = is_highlight or is_status
        r1.font.color.rgb = COLOR_GREEN_TEXT if (is_highlight or is_status) else COLOR_TEXT

        p2 = c2.paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r2 = p2.add_run(val_txt)
        r2.font.size = Pt(7.4 if is_highlight else 7.0)
        r2.font.bold = is_highlight
        r2.font.color.rgb = COLOR_GREEN_TEXT if is_highlight else COLOR_PRIMARY

    # Terbilang
    p_terb = doc.add_paragraph()
    r_tb1 = p_terb.add_run("Jumlah Tagihan Termin I Terbilang: ")
    r_tb1.font.bold = True
    r_tb1.font.size = Pt(7.2)
    r_tb1.font.color.rgb = COLOR_PRIMARY

    r_tb2 = p_terb.add_run("[ Dua Juta Tujuh Ratus Lima Puluh Ribu Rupiah ] (Netto Tanpa Potongan)")
    r_tb2.font.bold = True
    r_tb2.font.italic = True
    r_tb2.font.size = Pt(7.2)
    r_tb2.font.color.rgb = COLOR_GREEN_TEXT

    # Bank Transfer & Due Date Information Card
    pay_info_tbl = doc.add_table(rows=1, cols=2)
    pay_info_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    pay_info_tbl.autofit = False
    pay_info_tbl.columns[0].width = Inches(3.75)
    pay_info_tbl.columns[1].width = Inches(3.75)
    set_box_borders(pay_info_tbl, color="CBD5E1", sz="4")
    make_row_cant_split(pay_info_tbl.rows[0])

    c_bk = pay_info_tbl.cell(0, 0)
    set_cell_background(c_bk, HEX_CARD)
    set_cell_margins(c_bk, top=25, bottom=25, left=35, right=35)
    p_b = c_bk.paragraphs[0]
    r_bt = p_b.add_run("INSTRUKSI TRANSFER REKENING RESMI:\n")
    r_bt.font.bold = True
    r_bt.font.size = Pt(7.0)
    r_bt.font.color.rgb = COLOR_PRIMARY
    r_bd = p_b.add_run(
        "- Bank: BCA (Bank Central Asia)  |  Atas Nama: Galih Primananda / PT Prime Infinity Systems\n"
        "- Berita Transfer: BAP-50 Termin 1 DMJ - HRIS  |  Konfirmasi Bukti: galih@primeprojectx.net"
    )
    r_bd.font.size = Pt(6.5)
    r_bd.font.color.rgb = COLOR_TEXT

    c_dd = pay_info_tbl.cell(0, 1)
    set_cell_background(c_dd, HEX_CARD)
    set_cell_margins(c_dd, top=25, bottom=25, left=35, right=35)
    p_d = c_dd.paragraphs[0]
    r_dt = p_d.add_run("KETENTUAN JATUH TEMPO & REFERENSI:\n")
    r_dt.font.bold = True
    r_dt.font.size = Pt(7.0)
    r_dt.font.color.rgb = COLOR_PRIMARY
    r_dd = p_d.add_run(
        "- Batas Jatuh Tempo: 7 (tujuh) Hari Kerja sejak BAP-50 diserahkan (Pasal 2 Ayat 5 PKS).\n"
        "- Invoice Pendukung: INV-008/PIS-DMJ/IX/2026  |  Termin II (50%): Pasca UAT 100% & BAST."
    )
    r_dd.font.size = Pt(6.5)
    r_dd.font.color.rgb = COLOR_TEXT

    # Section 4: Roadmap Sisa 40%
    p_sec4 = doc.add_paragraph()
    r_s4 = p_sec4.add_run("4. RENCANA KERJA PENYELESAIAN SISA PEKERJAAN (MENUJU TERMIN II / 100%)\n")
    r_s4.font.bold = True
    r_s4.font.size = Pt(8.0)
    r_s4.font.color.rgb = COLOR_PRIMARY

    r_s4_t = p_sec4.add_run(
        "Setelah diterbitkannya Berita Acara Progress 50% (BAP-50) ini dan direalisasikannya pembayaran Termin I, "
        "PIHAK PERTAMA akan segera melanjutkan penyelesaian sisa 40% pekerjaan yang mencakup agenda strategis berikut:\n"
        "1. Penuntasan Modul Penggajian Depnaker (Payroll Engine) dan integrasi template Slip Gaji QR Code digital.\n"
        "2. Pembangunan modul Project Cost Accounting & Labor Forecast untuk alokasi jam kerja teknisi langsung ke pos biaya akun proyek DMJ.\n"
        "3. Pembuatan paket instalasi mandiri offline portable (.exe) beserta basis data lokal standalone.\n"
        "4. Pelaksanaan User Acceptance Test (UAT) komprehensif bersama tim manajemen, HR, dan operasional PT DMJ (maksimal 7 hari kerja).\n"
        "5. Pelaksanaan 1 (satu) kali sesi pelatihan full team secara offline (tatap muka on-site di kantor/workshop PT DMJ).\n"
        "6. Penandatanganan Berita Acara Serah Terima (BAST Final) dan pelunasan Termin II (50% = Rp 2.750.000,-)."
    )
    r_s4_t.font.size = Pt(7.0)

    # Section 5: Autentikasi Sistem
    p_sec5 = doc.add_paragraph()
    r_s5 = p_sec5.add_run("5. VERIFIKASI KEABSAHAN DOKUMEN DIGITAL & TELEMETRI AUDIT SISTEM\n")
    r_s5.font.bold = True
    r_s5.font.size = Pt(8.0)
    r_s5.font.color.rgb = COLOR_PRIMARY

    r_s5_t = p_sec5.add_run(
        "Dokumen Berita Acara ini diterbitkan secara resmi melalui Prime Automation Engine dan memiliki kekuatan hukum serta kepatuhan "
        "administratif yang sah dan mengikat PARA PIHAK berdasarkan rekam jejak telemetri sistem digital. Seluruh data fungsionalitas "
        "telah diverifikasi langsung pada runtime server cloud dan database engine secara real-time tanpa memerlukan tanda tangan basah konvensional."
    )
    r_s5_t.font.size = Pt(7.0)

    # Digital Verification Card
    auth_tbl = doc.add_table(rows=1, cols=2)
    auth_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    auth_tbl.autofit = False
    auth_tbl.columns[0].width = Inches(2.0)
    auth_tbl.columns[1].width = Inches(5.5)
    set_box_borders(auth_tbl, color="CBD5E1", sz="4")
    make_row_cant_split(auth_tbl.rows[0])

    c_qr = auth_tbl.cell(0, 0)
    set_cell_background(c_qr, HEX_CARD)
    set_cell_margins(c_qr, top=18, bottom=18, left=18, right=18)

    qr_img = r"C:\Users\PRIMA\prime-hris\invoice_qr.png"
    p_q = c_qr.paragraphs[0]
    p_q.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if os.path.exists(qr_img):
        r_q_img = p_q.add_run()
        r_q_img.add_picture(qr_img, width=Inches(0.72))

    p_qc = c_qr.add_paragraph()
    p_qc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_q1 = p_qc.add_run("VERIFIKASI AWAN DIGITAL\n")
    r_q1.font.bold = True
    r_q1.font.size = Pt(6.0)
    r_q1.font.color.rgb = COLOR_PRIMARY
    r_q2 = p_qc.add_run("dmj.primeprojectx.net")
    r_q2.font.size = Pt(5.8)
    r_q2.font.color.rgb = COLOR_TEXT_MUTED

    c_tl = auth_tbl.cell(0, 1)
    set_cell_background(c_tl, HEX_CARD)
    set_cell_margins(c_tl, top=18, bottom=18, left=30, right=30)

    p_tl = c_tl.paragraphs[0]
    now_iso = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC+7")
    sha_src = f"BAP_50_PRIME_HRIS_PT_DMJ_PROGRESS_60_PERCENT_{now_iso}"
    audit_hash = hashlib.sha256(sha_src.encode()).hexdigest().upper()[:28]

    r_tl_h = p_tl.add_run("SERTIFIKASI INTEGRITAS DIGITAL SISTEM (SYSTEM-AUTOMATED VERIFICATION)\n")
    r_tl_h.font.bold = True
    r_tl_h.font.size = Pt(6.8)
    r_tl_h.font.color.rgb = COLOR_PRIMARY

    r_tl_b = p_tl.add_run(
        f"- Status Verifikasi: DITERBITKAN & TERVALIDASI SISTEM (VALIDATED)\n"
        f"- Timestamp Evaluasi: {now_iso}\n"
        f"- Node Infrastruktur: PRIME-CLOUD-STAGING (dmj.primeprojectx.net)\n"
        f"- Database Engine: node:sqlite High-Concurrency WAL Engine v24\n"
        f"- SHA-256 Audit Seal: PX-BAP50-{audit_hash}\n"
        f"- Penerbit Otoritatif: PT PRIME INFINITY SYSTEMS (PRIME PROJECTX)"
    )
    r_tl_b.font.size = Pt(6.4)
    r_tl_b.font.color.rgb = COLOR_TEXT

    # Strictly Validate Zero Signatures / Approval Boxes Policy
    print("[1/4] Validating strictly ZERO signature or approval blocks (Policy Compliance)...")
    validate_no_signature_or_approval_blocks(doc)
    print("  -> Validation passed: Zero signature boxes, zero human approver columns.")

    # Paths
    docx_path = r"C:\Users\PRIMA\Desktop\Report\BAP_PROGRESS_50_PERSEN_PRIME_HRIS_PT_DMJ.docx"
    pdf_path = r"C:\Users\PRIMA\Desktop\Report\BAP_PROGRESS_50_PERSEN_PRIME_HRIS_PT_DMJ.pdf"
    alt_docx = r"C:\Users\PRIMA\prime-hris\BAP_PROGRESS_50_PERSEN_PRIME_HRIS_PT_DMJ.docx"
    alt_pdf = r"C:\Users\PRIMA\prime-hris\BAP_PROGRESS_50_PERSEN_PRIME_HRIS_PT_DMJ.pdf"

    print(f"[2/4] Saving DOCX to {docx_path}...")
    doc.save(docx_path)
    doc.save(alt_docx)
    print("  -> DOCX successfully saved.")

    print(f"[3/4] Exporting PDF via Microsoft Word COM automation...")
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    try:
        wdoc = word.Documents.Open(os.path.abspath(docx_path))
        wdoc.ExportAsFixedFormat(os.path.abspath(pdf_path), 17) # 17 = wdExportFormatPDF
        wdoc.Close(False)
        print(f"  -> PDF successfully exported to Desktop Report: {pdf_path}")
        
        # Also copy to prime-hris repo
        import shutil
        shutil.copy2(pdf_path, alt_pdf)
        print(f"  -> PDF mirrored to prime-hris: {alt_pdf}")
    finally:
        word.Quit()

    print("[4/4] BAP Generation Completed Successfully!")
    return docx_path, pdf_path

if __name__ == "__main__":
    build_perfect_2page_bap()

