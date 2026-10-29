import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_COLOR_INDEX
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_cell_valign(cell, val="center"):
    tcPr = cell._tc.get_or_add_tcPr()
    vAlign = parse_xml(f'<w:vAlign {nsdecls("w")} w:val="{val}"/>')
    tcPr.append(vAlign)

def set_table_borders(table, color="D0D7DE", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="none"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def prevent_row_split(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

def set_repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

def build_pks_document(clean_mode=True, docx_path=None):
    doc = docx.Document()

    # Page Margins (0.8" top/bottom, 0.85" left/right -> 6.8" printable width)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)

    # Executive Color Palette
    COLOR_PRIMARY   = RGBColor(0x18, 0x34, 0x5E)  # Deep Navy (#18345E)
    COLOR_SECONDARY = RGBColor(0x28, 0x3C, 0x5A)  # Slate Navy (#283C5A)
    COLOR_ACCENT    = RGBColor(0x1E, 0x50, 0x8C)  # Accent Blue (#1E508C)
    COLOR_TEXT      = RGBColor(0x22, 0x26, 0x2A)  # Charcoal Text (#22262A)
    COLOR_MUTED     = RGBColor(0x55, 0x5F, 0x6D)  # Muted Gray (#555F6D)
    HEX_PRIMARY     = "18345E"
    HEX_BORDER      = "D0D7DE"
    HEX_BG_LIGHT    = "F8FAFC"
    HEX_CARD        = "F4F6F9"

    def mark_rev(run):
        if not clean_mode:
            run.font.highlight_color = WD_COLOR_INDEX.YELLOW

    # Base Normal Style
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Segoe UI'
    normal_style.font.size = Pt(9.5)
    normal_style.font.color.rgb = COLOR_TEXT
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(3)

    # --- HEADER / KOP RESMI ---
    p_badge = doc.add_paragraph()
    p_badge.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_badge.paragraph_format.space_before = Pt(0)
    p_badge.paragraph_format.space_after = Pt(2)
    badge_text = "LEMBAR DOKUMEN RESMI PERJANJIAN KERJA SAMA (PKS)" if clean_mode else "LEMBAR DOKUMEN RESMI PERJANJIAN KERJA SAMA (PKS) — HASIL REVISI"
    r_badge = p_badge.add_run(badge_text)
    r_badge.font.name = 'Segoe UI Semibold'
    r_badge.font.size = Pt(8.5)
    r_badge.font.color.rgb = COLOR_ACCENT
    r_badge.font.bold = True

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(2)
    p_title.paragraph_format.space_after = Pt(2)
    r_title = p_title.add_run("SURAT PERJANJIAN KERJA SAMA\nPENGEMBANGAN & IMPLEMENTASI SISTEM PRIME HRIS ENTERPRISE")
    r_title.font.name = 'Segoe UI'
    r_title.font.size = Pt(13)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(2)
    p_sub.paragraph_format.space_after = Pt(4)
    r_sub = p_sub.add_run("ANTARA PT PRIME INFINITY SYSTEMS DENGAN PT DWI MARTHA JAYA")
    r_sub.font.name = 'Segoe UI Semibold'
    r_sub.font.size = Pt(9.5)
    r_sub.font.color.rgb = COLOR_SECONDARY

    # Metadata Bar
    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_meta.paragraph_format.space_before = Pt(0)
    p_meta.paragraph_format.space_after = Pt(8)
    r_meta = p_meta.add_run("Nomor Dokumen: 008/PKS-IT/PIS-DMJ/IX/2026   |   Tanggal: 21 September 2026")
    r_meta.font.name = 'Segoe UI'
    r_meta.font.size = Pt(8.5)
    r_meta.font.color.rgb = COLOR_MUTED

    if not clean_mode:
        p_rev_banner = doc.add_paragraph()
        p_rev_banner.paragraph_format.space_after = Pt(8)
        r_rev_tag = p_rev_banner.add_run("[KETERANGAN TANDA REVISI]: ")
        r_rev_tag.font.bold = True
        r_rev_tag.font.size = Pt(8.5)
        r_rev_tag.font.color.rgb = COLOR_PRIMARY
        r_rev_desc = p_rev_banner.add_run("Seluruh klausul dan butir tabel yang telah diselaraskan diberi tanda ")
        r_rev_desc.font.size = Pt(8.5)
        r_hl_ex = p_rev_banner.add_run("[REVISI - KUNING]")
        r_hl_ex.font.bold = True
        r_hl_ex.font.size = Pt(8.5)
        mark_rev(r_hl_ex)

    # Hairline Divider
    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_after = Pt(8)
    p_div_border = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="12" w:space="1" w:color="{HEX_PRIMARY}"/></w:pBdr>')
    p_div._p.get_or_add_pPr().append(p_div_border)

    # Preamble Intro
    p_intro = doc.add_paragraph()
    p_intro.paragraph_format.space_after = Pt(6)
    p_intro.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_intro.add_run(
        "Pada hari ini, Senin, tanggal Dua Puluh Satu bulan September tahun Dua Ribu Dua Puluh Enam (21-09-2026), "
        "bertempat di Surabaya, telah dibuat dan ditandatangani Perjanjian Kerja Sama Pengembangan dan Implementasi "
        "Sistem Informasi Sumber Daya Manusia Terpadu (Prime HRIS Enterprise - Paket Komplit Full Suite), oleh dan antara:"
    )

    # Card Table: Identitas Para Pihak
    party_table = doc.add_table(rows=1, cols=2)
    party_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    party_table.autofit = False
    set_table_borders(party_table, color=HEX_BORDER, sz="6")
    prevent_row_split(party_table.rows[0])
    party_table.columns[0].width = Inches(3.4)
    party_table.columns[1].width = Inches(3.4)

    # Pihak Pertama Card
    c1 = party_table.cell(0, 0)
    set_cell_background(c1, HEX_CARD)
    set_cell_margins(c1, top=120, bottom=120, left=140, right=140)
    set_cell_valign(c1, "top")
    p_c1 = c1.paragraphs[0]
    p_c1.paragraph_format.space_after = Pt(2)
    r1 = p_c1.add_run("I. PIHAK PERTAMA (VENDOR TEKNOLOGI)\n")
    r1.font.bold = True
    r1.font.color.rgb = COLOR_PRIMARY
    r1.font.size = Pt(9)

    p_c1_b = c1.add_paragraph()
    p_c1_b.paragraph_format.space_after = Pt(0)
    p_c1_b.paragraph_format.line_spacing = 1.15
    p_c1_b.add_run("PT PRIME INFINITY SYSTEMS\nDiwakili oleh: Galih Primananda, S.E.\nJabatan: ").font.size = Pt(8.5)
    r_c1_jab = p_c1_b.add_run("Director & Lead Platform Architect")
    r_c1_jab.font.size = Pt(8.5)
    r_c1_jab.font.bold = True
    mark_rev(r_c1_jab)
    p_c1_b.add_run("\nEkosistem: primeprojectx.net | Sidoarjo & Surabaya\nKontak: galih@primeprojectx.net\n(Selanjutnya disebut sebagai 'PIHAK PERTAMA')").font.size = Pt(8.5)

    # Pihak Kedua Card
    c2 = party_table.cell(0, 1)
    set_cell_background(c2, HEX_CARD)
    set_cell_margins(c2, top=120, bottom=120, left=140, right=140)
    set_cell_valign(c2, "top")
    p_c2 = c2.paragraphs[0]
    p_c2.paragraph_format.space_after = Pt(2)
    r2 = p_c2.add_run("II. PIHAK KEDUA (KLIEN / PEMILIK KERJA)\n")
    r2.font.bold = True
    r2.font.color.rgb = COLOR_PRIMARY
    r2.font.size = Pt(9)

    p_c2_b = c2.add_paragraph()
    p_c2_b.paragraph_format.space_after = Pt(0)
    p_c2_b.paragraph_format.line_spacing = 1.15
    p_c2_b.add_run("PT DWI MARTHA JAYA (PT DMJ)\nDiwakili oleh: Direksi & Manajemen PT DMJ\nJabatan: ").font.size = Pt(8.5)
    r_c2_jab = p_c2_b.add_run("Direktur / GM / HR Manager")
    r_c2_jab.font.size = Pt(8.5)
    r_c2_jab.font.bold = True
    mark_rev(r_c2_jab)
    p_c2_b.add_run("\nBidang Usaha: Integrated Design & Construction Solutions\nAlamat: Jawa Timur, Indonesia\n(Selanjutnya disebut sebagai 'PIHAK KEDUA')").font.size = Pt(8.5)

    # Recitals
    p_rec = doc.add_paragraph()
    p_rec.paragraph_format.space_before = Pt(8)
    p_rec.paragraph_format.space_after = Pt(3)
    r_rec = p_rec.add_run("PARA PIHAK terlebih dahulu menerangkan hal-hal sebagai berikut:")
    r_rec.font.italic = True
    r_rec.font.size = Pt(9)

    def add_recital(num_str, text_str):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.28)
        p.paragraph_format.first_line_indent = Inches(-0.28)
        p.paragraph_format.space_before = Pt(1.5)
        p.paragraph_format.space_after = Pt(1.5)
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        r_n = p.add_run(num_str)
        r_n.font.bold = True
        r_n.font.color.rgb = COLOR_PRIMARY
        r_t = p.add_run(text_str)
        r_t.font.size = Pt(9)

    add_recital("1. ", "Bahwa PIHAK PERTAMA adalah badan usaha penyedia jasa teknologi informasi, perancangan arsitektur perangkat lunak, dan platform otomatisasi digital industri berkinerja tinggi.")
    add_recital("2. ", "Bahwa PIHAK KEDUA bermaksud menggunakan jasa PIHAK PERTAMA untuk merancang, mengonfigurasi, dan mengimplementasikan sistem presensi biometrik digital, akuntansi penggajian proyek (Project Cost Accounting), dan manajemen operasional tenaga kerja terintegrasi.")
    add_recital("3. ", "Bahwa PIHAK KEDUA telah menyetujui penawaran Paket Komplit Full Suite (Prime HRIS Enterprise) senilai Rp 5.500.000,- (Lima Juta Lima Ratus Ribu Rupiah) dari PIHAK PERTAMA.")

    p_agree = doc.add_paragraph()
    p_agree.paragraph_format.space_before = Pt(4)
    p_agree.paragraph_format.space_after = Pt(8)
    p_agree.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r_agr = p_agree.add_run("Maka, berdasarkan pertimbangan di atas, PARA PIHAK bersepakat untuk mengikatkan diri dalam Perjanjian Kerja Sama ini dengan syarat dan ketentuan yang diatur dalam pasal-pasal berikut:")
    r_agr.font.italic = True
    r_agr.font.size = Pt(9)

    # --- STRUCTURED FORMATTING HELPERS ---
    def add_article_heading(title, subtitle=None):
        """Executive styled article header with left navy accent bar and light tint."""
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(14)
        h.paragraph_format.space_after = Pt(4)
        h.paragraph_format.keep_with_next = True
        
        pBdr = parse_xml(
            f'<w:pBdr {nsdecls("w")}>'
            f'<w:left w:val="single" w:sz="24" w:space="8" w:color="{HEX_PRIMARY}"/>'
            f'<w:bottom w:val="single" w:sz="4" w:space="2" w:color="{HEX_BORDER}"/>'
            f'</w:pBdr>'
        )
        h._p.get_or_add_pPr().append(pBdr)
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{HEX_CARD}"/>')
        h._p.get_or_add_pPr().append(shd)
        
        run = h.add_run(f" {title}")
        run.font.name = 'Segoe UI Semibold'
        run.font.bold = True
        run.font.size = Pt(10)
        run.font.color.rgb = COLOR_PRIMARY
        
        if subtitle:
            h_sub = doc.add_paragraph()
            h_sub.paragraph_format.left_indent = Inches(0.2)
            h_sub.paragraph_format.space_before = Pt(0)
            h_sub.paragraph_format.space_after = Pt(4)
            h_sub.paragraph_format.keep_with_next = True
            run_s = h_sub.add_run(subtitle)
            run_s.font.name = 'Segoe UI'
            run_s.font.italic = True
            run_s.font.size = Pt(8.5)
            run_s.font.color.rgb = COLOR_MUTED

    def add_clause(prefix, bold_title, body_text, space_before=Pt(3), space_after=Pt(3)):
        """Level 1 clause (1., 2., 3.) with clean hanging indent."""
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.3)
        p.paragraph_format.first_line_indent = Inches(-0.3)
        p.paragraph_format.space_before = space_before
        p.paragraph_format.space_after = space_after
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        
        r_num = p.add_run(prefix)
        r_num.font.bold = True
        r_num.font.color.rgb = COLOR_PRIMARY
        
        if bold_title:
            r_t = p.add_run(bold_title)
            r_t.font.bold = True
            r_t.font.color.rgb = COLOR_SECONDARY
            
        r_b = p.add_run(body_text)
        return p, r_b

    def add_subclause(prefix, bold_title, body_text, space_before=Pt(2), space_after=Pt(2)):
        """Level 2 sub-clause (a., b., c.) with clean hanging indent."""
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.6)
        p.paragraph_format.first_line_indent = Inches(-0.3)
        p.paragraph_format.space_before = space_before
        p.paragraph_format.space_after = space_after
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        
        r_num = p.add_run(prefix)
        r_num.font.bold = True
        r_num.font.color.rgb = COLOR_PRIMARY
        
        if bold_title:
            r_t = p.add_run(bold_title)
            r_t.font.bold = True
            r_t.font.color.rgb = COLOR_SECONDARY
            
        r_b = p.add_run(body_text)
        return p, r_b

    def add_subsubclause(prefix, bold_title, body_text, space_before=Pt(1.5), space_after=Pt(1.5)):
        """Level 3 sub-clause (bullets, (1), (2)) with clean hanging indent."""
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.9)
        p.paragraph_format.first_line_indent = Inches(-0.3)
        p.paragraph_format.space_before = space_before
        p.paragraph_format.space_after = space_after
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        
        r_num = p.add_run(prefix)
        r_num.font.bold = True
        r_num.font.color.rgb = COLOR_ACCENT
        
        if bold_title:
            r_t = p.add_run(bold_title)
            r_t.font.bold = True
            r_t.font.color.rgb = COLOR_SECONDARY
            
        r_b = p.add_run(body_text)
        return p, r_b

    # =========================================================================
    # PASAL 1: RUANG LINGKUP PEKERJAAN
    # =========================================================================
    add_article_heading("PASAL 1: RUANG LINGKUP PEKERJAAN (SCOPE OF WORK - PAKET ENTERPRISE FULL SUITE)")
    
    add_clause(
        "1. ", "Kewajiban Perancangan & Implementasi: ",
        "PIHAK PERTAMA berkewajiban merancang, membangun, mengonfigurasi, dan mengimplementasikan sistem "
        "Prime HRIS Enterprise (Paket Komplit Full Suite Investasi Rp 5.500.000,-) untuk operasional PT Dwi Martha Jaya "
        "yang mencakup 11 (sebelas) modul dan kapabilitas fungsionalitas berikut:"
    )

    modules = [
        ("Dashboard & Web Admin Enterprise", "Pusat kontrol real-time pemantauan kehadiran, master shift, divisi, dan analitik operasional.", False),
        ("Presensi Biometrik Selfie & Geotag Watermark", "Kamera live anti-fake GPS dengan validasi koordinat satelit GPS dan stempel watermark permanen.", False),
        ("Sequential Corporate WiFi Gate", "Penguncian kehadiran WFO yang mewajibkan perangkat staf terhubung ke Access Point WiFi resmi kantor/workshop.", False),
        ("Fleksibilitas 'Dinas Luar Mendadak'", "Rute presensi khusus teknisi site tanpa mampir kantor dengan form justifikasi dan rute approval otomatis.", False),
        ("Multi-Tier Approval Hub", "Portal persetujuan berjenjang bagi Supervisor, PM, HR, dan Direksi (Cuti, Izin Sakit, Telat, Lembur, Reimbursement).", False),
        ("Mesin Penggajian Depnaker (Payroll Engine)", "Kalkulasi upah lembur resmi Depnaker (1/173), multiplier 1.5x/2.0x/3.0x, BPJS TK & Kes, serta slip gaji QR Code.", False),
        ("Project Cost Accounting & Labor Forecast", "Distribusi biaya upah riil teknisi langsung ke akun proyek industri, dilengkapi indikator Estimate at Completion (EAC).", False),
        ("Mobile Version Smartphone", "Antarmuka web responsif penuh untuk presensi dan slip gaji mandiri pada semua smartphone karyawan.", False),
        ("Paket Aplikasi Mandiri Mode Offline Portable (.exe)", "Penyerahan paket aplikasi sistem siap pakai yang telah dikompilasi dalam bentuk file executable (.exe) portable beserta basis data lokalnya yang dapat dijalankan langsung di komputer/server lokal kantor tanpa ketergantungan cloud.", True),
        ("Pelatihan Penuh Seluruh Tim (Full Team Training) 1x", "Fasilitas 1 (satu) kali sesi pelatihan dan pendampingan intensif operasional sistem bagi seluruh divisi (Manajemen, HR, Finance, dan Teknisi) yang diselenggarakan secara offline / tatap muka on-site di kantor/workshop PT DMJ.", True),
        ("Garansi Perbaikan Bug 12 Bulan", "Jaminan perbaikan bug (bug fixing) sistem selama 1 (satu) tahun penuh.", True)
    ]

    mod_table = doc.add_table(rows=len(modules)+1, cols=3)
    mod_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    mod_table.autofit = False
    set_table_borders(mod_table, color=HEX_BORDER, sz="4")
    set_repeat_header(mod_table.rows[0])
    prevent_row_split(mod_table.rows[0])

    col_widths = [Inches(0.50), Inches(3.50), Inches(2.80)]
    col_dxa = [720, 5040, 4032]

    tblGrid = parse_xml(
        f'<w:tblGrid {nsdecls("w")}>'
        f'<w:gridCol w:w="{col_dxa[0]}"/>'
        f'<w:gridCol w:w="{col_dxa[1]}"/>'
        f'<w:gridCol w:w="{col_dxa[2]}"/>'
        f'</w:tblGrid>'
    )
    mod_table._tbl.insert(mod_table._tbl.index(mod_table._tbl.tblPr) + 1, tblGrid)

    for i, w in enumerate(col_widths):
        mod_table.columns[i].width = w

    # Header row
    hdr_cells = mod_table.rows[0].cells
    hdr_titles = ["No", "Modul / Komponen Fitur", "Deskripsi & Kapabilitas Operasional"]
    for i, title in enumerate(hdr_titles):
        hdr_cells[i].width = col_widths[i]
        set_cell_background(hdr_cells[i], HEX_PRIMARY)
        set_cell_margins(hdr_cells[i], top=90, bottom=90, left=90, right=90)
        set_cell_valign(hdr_cells[i], "center")
        p = hdr_cells[i].paragraphs[0]
        if i == 0:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(title)
        r.font.bold = True
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    for idx, (m_name, m_desc, is_rev) in enumerate(modules):
        row = mod_table.rows[idx+1]
        prevent_row_split(row)
        bg_col = "FFFFFF" if idx % 2 == 0 else HEX_BG_LIGHT
        for i, c in enumerate(row.cells):
            c.width = col_widths[i]
            set_cell_background(c, bg_col)
            set_cell_margins(c, top=65, bottom=65, left=90, right=90)
            set_cell_valign(c, "center")
        
        p_no = row.cells[0].paragraphs[0]
        p_no.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_no.add_run(str(idx+1)).font.size = Pt(8.5)
        
        r_name = row.cells[1].paragraphs[0].add_run(m_name)
        r_name.font.bold = True
        r_name.font.size = Pt(8.5)
        r_name.font.color.rgb = COLOR_SECONDARY
        if is_rev:
            mark_rev(r_name)

        r_desc = row.cells[2].paragraphs[0].add_run(m_desc)
        r_desc.font.size = Pt(8.5)
        row.cells[2].paragraphs[0].paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        if is_rev:
            mark_rev(r_desc)

    add_clause(
        "2. ", "Infrastruktur & Alamat Akses Cloud: ",
        "Sistem di-hosting dan di-deploy pada server cloud berkinerja tinggi dengan alamat akses publik "
        "https://dmj.primeprojectx.net (atau custom domain DMJhris.com bila difasilitasi oleh PIHAK KEDUA)."
    )

    # =========================================================================
    # PASAL 2: NILAI KONTRAK & SKEMA PEMBAYARAN
    # =========================================================================
    add_article_heading("PASAL 2: NILAI KONTRAK, TERMIN PEMBAYARAN & BIAYA SERVER")
    
    add_clause(
        "1. ", "Total Nilai Kontrak: ",
        "Total Nilai Investasi Kontrak Pekerjaan ini adalah sebesar Rp 5.500.000,- (Lima Juta Lima Ratus Ribu Rupiah) "
        "netto, mencakup seluruh lisensi fitur, aplikasi offline .exe, setup cloud, dan 1x sesi pelatihan offline on-site di kantor/workshop PT DMJ sebagaimana tercantum pada Pasal 1."
    )
    add_clause(
        "2. ", "Tahapan & Termin Pembayaran: ",
        "Sesuai kesepakatan PARA PIHAK bahwa PIHAK KEDUA sanggup melakukan pembayaran setelah progress pengerjaan mencapai 50%, "
        "maka tahapan pembayaran disepakati dengan rincian termin sebagai berikut:"
    )

    term_table = doc.add_table(rows=3, cols=4)
    term_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    term_table.autofit = False
    set_table_borders(term_table, color=HEX_BORDER, sz="4")
    set_repeat_header(term_table.rows[0])
    prevent_row_split(term_table.rows[0])

    term_table.columns[0].width = Inches(1.2)
    term_table.columns[1].width = Inches(1.1)
    term_table.columns[2].width = Inches(1.3)
    term_table.columns[3].width = Inches(3.2)

    t_headers = ["Tahap Termin", "Persentase", "Nominal (Rp)", "Kriteria Pencapaian & Verifikasi Output (Milestone)"]
    for i, t in enumerate(t_headers):
        set_cell_background(term_table.rows[0].cells[i], HEX_PRIMARY)
        set_cell_margins(term_table.rows[0].cells[i], top=90, bottom=90, left=100, right=100)
        set_cell_valign(term_table.rows[0].cells[i], "center")
        p = term_table.rows[0].cells[i].paragraphs[0]
        if i in [0, 1, 2]:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(t)
        r.font.bold = True
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    term_data = [
        ("Termin I\n(Progress 50%)", "50% Kontrak", "Rp 2.750.000,-", 
         "Dibayarkan SETELAH progress pekerjaan mencapai 50%, dibuktikan dengan: modul presensi biometrik selfie geotag, live demo pada lingkungan staging/cloud, dan penandatanganan Berita Acara Progress 50% (BAP-50).", True),
        ("Termin II\n(Pelunasan 100%)", "50% Kontrak", "Rp 2.750.000,-", 
         "Dibayarkan SETELAH seluruh sistem rampung 100%, lolos User Acceptance Test (UAT), pelaksanaan 1x sesi pelatihan full team secara offline on-site di kantor/workshop PT DMJ, penyerahan aplikasi mode offline portable (.exe), dan penandatanganan Berita Acara Serah Terima (BAST).", True)
    ]

    for idx, (t_name, t_pct, t_nom, t_desc, is_rev) in enumerate(term_data):
        row = term_table.rows[idx+1]
        prevent_row_split(row)
        bg_col = "FFFFFF" if idx == 0 else HEX_BG_LIGHT
        for c in row.cells:
            set_cell_background(c, bg_col)
            set_cell_margins(c, top=70, bottom=70, left=90, right=90)
            set_cell_valign(c, "center")
            
        p_t0 = row.cells[0].paragraphs[0]
        p_t0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_t0 = p_t0.add_run(t_name)
        r_t0.font.bold = True
        r_t0.font.size = Pt(8.5)
        
        p_t1 = row.cells[1].paragraphs[0]
        p_t1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_t1.add_run(t_pct).font.size = Pt(8.5)
        
        p_t2 = row.cells[2].paragraphs[0]
        p_t2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_nom = p_t2.add_run(t_nom)
        r_nom.font.bold = True
        r_nom.font.size = Pt(8.5)
        r_nom.font.color.rgb = COLOR_PRIMARY
        
        p_t3 = row.cells[3].paragraphs[0]
        p_t3.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        r_desc = p_t3.add_run(t_desc)
        r_desc.font.size = Pt(8.5)
        if is_rev:
            mark_rev(r_desc)

    add_clause(
        "3. ", "Biaya Cloud Running Apps (Tipe Shared Environment), Kapasitas User & Kuota Storage: ",
        "Ketentuan operasional hosting server bulanan, batas kapasitas beban kerja, dan kuota ruang penyimpanan diatur sebagai berikut:"
    )
    add_subclause(
        "a. ", "Biaya Berlangganan Dasar & Tipe Server (Shared Environment): ",
        "Untuk menjamin keandalan server cloud 24/7, enkripsi SSL Cloudflare, dan auto-backup harian, PIHAK KEDUA dikenakan biaya "
        "langganan dasar server sebesar Rp 35.000,- (Tiga Puluh Lima Ribu Rupiah) per bulan yang mulai ditagihkan pada bulan kedua setelah "
        "sistem resmi Go-Live. Arsitektur lingkungan server running apps yang digunakan pada paket dasar ini adalah bertipe SHARED "
        "(Shared Cloud Server Environment), di mana alokasi resource komputasi dioptimasi bersama secara efisien dan ekonomis."
    )
    _, r_p2_3b = add_subclause(
        "b. ", "Batas Kapasitas User & Skalabilitas Performa: ",
        "Biaya dasar Rp 35.000,-/bulan dengan arsitektur shared server tersebut dioptimasi secara ideal untuk kapasitas 50 hingga 100 user/karyawan aktif. "
        "Apabila di kemudian hari jumlah karyawan bertambah melampaui 100 user aktif, atau apabila dirasa performa server kurang mencukupi seiring tingginya "
        "aktivitas presensi bersamaan, PIHAK KEDUA dapat mengajukan penambahan kapasitas server (upgrade RAM, CPU, atau bandwidth komputasi) "
        "maupun beralih ke Dedicated Server Environment dengan biaya penyesuaian sewa tersendiri."
    )
    mark_rev(r_p2_3b)

    add_subclause(
        "c. ", "Alokasi Kuota Penyimpanan (Storage): ",
        "Paket dasar ini telah menyertakan alokasi ruang penyimpanan sebesar 1 GB Storage Aktif (untuk running apps dan operasional database harian) "
        "serta 10 GB Dedicated Backup khusus untuk cadangan data otomatis berkala."
    )
    add_subclause(
        "d. ", "Penambahan Kuota Penyimpanan di Luar Kontrak: ",
        "Apabila kapasitas penyimpanan aktif atau backup tersebut dirasa kurang atau hampir penuh seiring berjalannya waktu dan akumulasi data foto presensi, "
        "penambahan kuota penyimpanan (storage expansion) dapat ditambahkan sebagai layanan add-on berbayar di luar nilai kontrak pokok proyek ini."
    )
    _, r_p2_3e = add_subclause(
        "e. ", "Ketentuan Penyesuaian Tarif & Alternatif Solusi Pengakhiran Layanan (Exit Policy): ",
        "Mekanisme perubahan biaya dan perlindungan kelangsungan operasional klien diatur secara berkeadilan:"
    )
    mark_rev(r_p2_3e)

    _, r_e1 = add_subsubclause(
        "• ", "Perubahan Tarif Sewaktu-waktu: ",
        "Besaran biaya berlangganan cloud running apps bulanan maupun tarif layanan add-on (storage expansion, upgrade kapasitas user/server, "
        "migrasi dari tipe shared ke dedicated, modul kustom) dapat sewaktu-waktu mengalami penyesuaian oleh PIHAK PERTAMA mengikuti kenaikan biaya "
        "operasional datacenter/cloud provider internasional, beban komputasi, atau fluktuasi kurs valuta asing, dengan pemberitahuan tertulis "
        "kepada PIHAK KEDUA selambat-lambatnya 30 (tiga puluh) hari kalender sebelum penyesuaian tarif berlaku efektif."
    )
    mark_rev(r_e1)

    _, r_e2 = add_subsubclause(
        "• ", "Pemberian Alternatif Solusi Apabila Klien Tidak Melanjutkan: ",
        "Apabila PIHAK KEDUA keberatan atau memutuskan untuk tidak melanjutkan langganan server cloud / add-on atas dasar penyesuaian tarif tersebut, "
        "PIHAK PERTAMA menyediakan alternatif solusi yang adil dan aman tanpa pengenaan denda/penalti:"
    )
    mark_rev(r_e2)

    _, r_opt1 = add_subsubclause(
        "  (1) ", "Beralih ke Mode Offline Mandiri (.exe): ",
        "PIHAK KEDUA dapat menjalankan dan mengoperasikan sistem sepenuhnya secara lokal di komputer kantor menggunakan paket aplikasi offline portable (.exe) "
        "dan basis data lokal yang telah diserahkan, sepenuhnya bebas dari biaya langganan bulanan selamanya."
    )
    mark_rev(r_opt1)

    _, r_opt2 = add_subsubclause(
        "  (2) ", "Migrasi ke Server / Cloud Mandiri (Self-Hosted): ",
        "PIHAK KEDUA berhak memindahkan instalasi sistem ke server fisik lokal maupun akun cloud/hosting milik PIHAK KEDUA sendiri, "
        "dengan penyerahan file backup database secara utuh dari PIHAK PERTAMA."
    )
    mark_rev(r_opt2)

    _, r_opt3 = add_subsubclause(
        "  (3) ", "Terminasi Layanan & Serah Terima Data Lengkap (Safe Data Handover): ",
        "Seluruh data historis karyawan, rekap presensi, dan data slip gaji akan diekspor dan diserahterimakan seutuhnya kepada PIHAK KEDUA sebelum instance cloud dinonaktifkan."
    )
    mark_rev(r_opt3)

    add_clause(
        "4. ", "Tata Cara & Rekening Pembayaran Resmi: ",
        "Pembayaran dilakukan melalui transfer bank resmi ke rekening PIHAK PERTAMA:"
    )
    add_subclause("- ", "Bank Tujuan: ", "Bank Central Asia (BCA) / Bank Mandiri")
    add_subclause("- ", "Atas Nama: ", "Galih Primananda / PT Prime Infinity Systems")
    add_subclause("- ", "Konfirmasi Pembayaran: ", "Bukti transfer sah dikonfirmasikan tertulis melalui WhatsApp resmi atau email resmi.")

    _, r_p2_5 = add_clause(
        "5. ", "Batas Waktu Jatuh Tempo Pembayaran (Payment Due Date): ",
        "Setiap kewajiban pembayaran termin (baik Termin I progress 50% maupun Termin II pelunasan 100%) wajib diselesaikan dan ditransfer oleh PIHAK KEDUA "
        "selambat-lambatnya dalam waktu 7 (tujuh) hari kerja terhitung sejak Berita Acara terkait (BAP-50 atau BAST) ditandatangani dan invoice resmi diserahkan."
    )
    mark_rev(r_p2_5)

    # =========================================================================
    # PASAL 3: KETENTUAN PENAMBAHAN FITUR (CHANGE REQUEST)
    # =========================================================================
    add_article_heading("PASAL 3: KETENTUAN PENAMBAHAN FITUR (CHANGE REQUEST & SCOPE MANAGEMENT)")
    
    p3_intro = doc.add_paragraph()
    p3_intro.paragraph_format.space_before = Pt(2)
    p3_intro.paragraph_format.space_after = Pt(4)
    p3_intro.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p3_intro.add_run(
        "Untuk menjamin kepastian jadwal rilis, keadilan beban kerja teknis, dan transparansi pembiayaan, "
        "perubahan spesifikasi atau penambahan fitur diatur dengan ketentuan sebagai berikut:"
    )

    add_clause(
        "1. ", "Batasan Ruang Lingkup Tetap (Baseline Scope): ",
        "Ruang lingkup pekerjaan yang mengikat PIHAK PERTAMA secara mutlak adalah seluruh modul dan fungsi yang tercantum pada Pasal 1. "
        "Segala bentuk permintaan modul baru, integrasi perangkat keras eksternal (misal: mesin fingerprint fisik LAN, door-lock gate magnetik), "
        "penambahan sesi pelatihan di luar kuota 1x sesi, atau integrasi API pihak ketiga di luar kontrak (misal: auto-disbursement bank API, "
        "konektor SAP ERP) dikategorikan sebagai Fitur Tambahan (Change Request / CR)."
    )

    add_clause(
        "2. ", "Prosedur Pengajuan Change Request (CR): ",
        "Mekanisme penambahan fitur wajib mengikuti tahapan administratif:"
    )
    add_subclause("a. ", "Permohonan Tertulis: ", "PIHAK KEDUA wajib mengajukan permintaan fitur tambahan secara tertulis melalui Formulir Change Request resmi.")
    add_subclause("b. ", "Penilaian Teknis & Biaya: ", "Dalam tempo maksimal 3 (tiga) hari kerja, PIHAK PERTAMA akan menerbitkan Dokumen Penilaian Teknis & Biaya yang memuat kelayakan arsitektur, estimasi hari kerja teknis (Man-Days), penawaran biaya, dan estimasi pergeseran jadwal.")

    add_clause(
        "3. ", "Skema Klasifikasi & Tarif Penambahan Fitur: ",
        "Penambahan fitur diklasifikasikan ke dalam 3 (tiga) kategori pembiayaan:"
    )

    cr_table = doc.add_table(rows=4, cols=3)
    cr_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cr_table.autofit = False
    set_table_borders(cr_table, color=HEX_BORDER, sz="4")
    set_repeat_header(cr_table.rows[0])
    prevent_row_split(cr_table.rows[0])

    cr_table.columns[0].width = Inches(1.5)
    cr_table.columns[1].width = Inches(3.3)
    cr_table.columns[2].width = Inches(2.0)

    cr_headers = ["Kategori Perubahan", "Kriteria & Contoh Fungsionalitas", "Ketentuan Biaya & Dampak"]
    for i, h_text in enumerate(cr_headers):
        set_cell_background(cr_table.rows[0].cells[i], HEX_PRIMARY)
        set_cell_margins(cr_table.rows[0].cells[i], top=90, bottom=90, left=100, right=100)
        set_cell_valign(cr_table.rows[0].cells[i], "center")
        p = cr_table.rows[0].cells[i].paragraphs[0]
        if i in [0, 2]:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h_text)
        r.font.bold = True
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    cr_data = [
        ("Penyesuaian Minor\n(Dalam Lingkup)", 
         "Penyesuaian label kolom, urutan tata letak tabel, penambahan 1-2 field teks sederhana pada form yang tidak mengubah struktur skema database utama.",
         "GRATIS (Maksimal 2x penyesuaian selama masa pengujian UAT)."),
        ("Modul Tambahan & Skalabilitas\n(Add-On Modular)", 
         "Pembuatan modul pelaporan baru, integrasi formula tunjangan khusus di luar Depnaker, sesi pelatihan tim tambahan di luar kuota 1x, penambahan kapasitas storage (di luar 1GB aktif / 10GB backup), atau penambahan resource server / upgrade dedicated (>100 user aktif).",
         "Rp 100.000 s/d Rp 1.500.000 per modul / penyesuaian biaya sewa add-on, dituangkan dalam Addendum PKS."),
        ("Pengembangan Kustom\n(Custom Man-Day)", 
         "Integrasi perangkat keras luar, integrasi API sistem pihak ketiga, atau restrukturisasi alur otorisasi multi-entitas.",
         "Tarif Profesional:\nRp 350.000,- / Man-Day (Hari Kerja Teknis), jadwal delivery disesuaikan.")
    ]

    for idx, (cat, desc, cost) in enumerate(cr_data):
        row = cr_table.rows[idx+1]
        prevent_row_split(row)
        bg_col = "FFFFFF" if idx == 0 else HEX_BG_LIGHT
        for c in row.cells:
            set_cell_background(c, bg_col)
            set_cell_margins(c, top=70, bottom=70, left=90, right=90)
            set_cell_valign(c, "center")
            
        p_c0 = row.cells[0].paragraphs[0]
        p_c0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_c0 = p_c0.add_run(cat)
        r_c0.font.bold = True
        r_c0.font.size = Pt(8.5)
        
        p_c1 = row.cells[1].paragraphs[0]
        p_c1.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p_c1.add_run(desc).font.size = Pt(8.5)
        
        p_c2 = row.cells[2].paragraphs[0]
        p_c2.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_c = p_c2.add_run(cost)
        r_c.font.size = Pt(8.5)
        r_c.font.bold = True
        r_c.font.color.rgb = COLOR_PRIMARY

    add_clause(
        "4. ", "Dampak Penambahan Fitur Terhadap Jadwal (Timeline Impact): ",
        "Setiap penambahan fitur berbayar yang disetujui secara otomatis memberikan hak penyesuaian (perpanjangan) "
        "waktu penyelesaian dan tanggal Go-Live secara proporsional sesuai jumlah hari kerja yang disepakati pada Addendum CR."
    )
    add_clause(
        "5. ", "Klausul Independensi Pembayaran Kontrak Pokok: ",
        "Pelaksanaan Change Request tidak boleh dijadikan alasan oleh PIHAK KEDUA untuk menahan, menunda, atau memotong "
        "pembayaran Termin I maupun Termin II kontrak pokok yang telah selesai dikerjakan sesuai Pasal 1 dan Pasal 2."
    )
    add_clause(
        "6. ", "Garansi Perbaikan Bug vs Fitur Baru: ",
        "Garansi 12 Bulan berlaku mutlak dan gratis HANYA untuk perbaikan galat/bug/error dari kode program yang terdapat pada Pasal 1. "
        "Permintaan fungsionalitas baru di luar sistem yang telah diserahterimakan pada BAST diperlakukan sebagai Change Request."
    )
    _, r_excl = add_clause(
        "7. ", "Hak Eksklusif Pengembangan & Larangan Modifikasi Pihak Ketiga (Exclusive Development Rights): ",
        "Seluruh pekerjaan penambahan fitur, penyesuaian fungsionalitas (enhancement), modifikasi logika bisnis, maupun perubahan struktur "
        "kode dan basis data pada sistem Prime HRIS Enterprise HANYA BOLEH DAN HANYA DAPAT DILAKUKAN OLEH PIHAK PERTAMA (PT PRIME INFINITY SYSTEMS). "
        "PIHAK KEDUA dilarang keras menugaskan pihak ketiga, konsultan luar, atau pihak internal tanpa izin tertulis dari PIHAK PERTAMA untuk "
        "merekayasa, membongkar, maupun memodifikasi kode sistem. Segala bentuk modifikasi tidak sah oleh pihak selain PIHAK PERTAMA secara otomatis "
        "membatalkan masa Garansi 12 Bulan dan SLA Dukungan Sistem, serta membebaskan PIHAK PERTAMA dari segala tanggung jawab atas disfungsi atau kerusakan data yang terjadi."
    )
    mark_rev(r_excl)

    _, r_cr8 = add_clause(
        "8. ", "Penyesuaian Tarif Fitur Add-On & Opsi Penolakan Tambahan Fitur: ",
        "Besaran tarif estimasi modul add-on, integrasi kustom, maupun biaya hari kerja teknis (Man-Day) bersifat fleksibel dan dapat sewaktu-waktu "
        "disesuaikan oleh PIHAK PERTAMA berdasarkan tingkat kompleksitas arsitektur dan kebutuhan infrastruktur terkini. PIHAK KEDUA berhak sepenuhnya "
        "untuk menerima atau menolak penawaran penambahan fitur/add-on tersebut tanpa membatalkan, merugikan, ataupun memengaruhi fungsi sistem pokok yang telah diserahterimakan pada Pasal 1."
    )
    mark_rev(r_cr8)

    # =========================================================================
    # PASAL 4: JADWAL PELAKSANAAN & TAHAPAN MILESTONE
    # =========================================================================
    add_article_heading("PASAL 4: JADWAL PELAKSANAAN & TAHAPAN MILESTONE")
    
    _, r_p4_1 = add_clause(
        "1. ", "Prasyarat Dimulainya Pekerjaan (Project Commencement): ",
        "Pelaksanaan pekerjaan pengembangan dan implementasi sistem Prime HRIS Enterprise ini baru resmi dimulai (Project Kickoff) "
        "dan perhitungan jangka waktu pelaksanaan mulai berlaku efektif setelah Surat Perjanjian Kerja Sama (PKS) ini ditandatangani secara sah "
        "dan lengkap oleh KEDUA BELAH PIHAK (PARA PIHAK). PIHAK PERTAMA tidak berkewajiban untuk memulai pekerjaan teknis, instalasi server, "
        "maupun konfigurasi sistem sebelum proses penandatanganan dokumen perjanjian ini diselesaikan oleh PIHAK KEDUA."
    )
    mark_rev(r_p4_1)

    p4_intro = doc.add_paragraph()
    p4_intro.paragraph_format.space_before = Pt(3)
    p4_intro.paragraph_format.space_after = Pt(3)
    p4_intro.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r_intro_num = p4_intro.add_run("2. ")
    r_intro_num.bold = True
    r_intro_num.font.size = Pt(9.5)
    r_intro_num.font.color.rgb = COLOR_PRIMARY
    r_intro_title = p4_intro.add_run("Jangka Waktu & Tahapan Kerja: ")
    r_intro_title.bold = True
    r_intro_title.font.size = Pt(9.5)
    r_intro_title.font.color.rgb = COLOR_TEXT
    r_intro_body = p4_intro.add_run("Pekerjaan dilaksanakan dalam rentang waktu 4 (empat) hingga 5 (lima) minggu kerja efektif terhitung sejak penandatanganan perjanjian oleh KEDUA BELAH PIHAK dengan tahapan terstruktur sebagai berikut:")
    r_intro_body.font.size = Pt(9.5)
    r_intro_body.font.color.rgb = COLOR_TEXT
    mark_rev(r_intro_body)

    add_subclause("• ", "Minggu 1: ", "Setup database SQLite WAL, pemetaan divisi PT DMJ, integrasi data awal NIK karyawan, dan registrasi SSID WiFi kantor.")
    
    _, r_m2 = add_subclause("• ", "Minggu 2: ", "Deployment modul presensi biometrik selfie geotag satelit dan live demo staging/cloud -> Capaian Milestone 50% & Pembayaran Termin I (Rp 2.750.000,-).")
    mark_rev(r_m2)
    
    add_subclause("• ", "Minggu 3: ", "Implementasi portal approval berjenjang, engine payroll Depnaker 1/173, potongan BPJS, dan cetak slip gaji QR Code.")
    
    _, r_m4 = add_subclause(
        "• ", "Minggu 4: ",
        "Alokasi upah berbasis proyek (Project Cost Accounting), simulasi anggaran EAC, dan User Acceptance Test (UAT).\n"
        "  Ketentuan UAT & Penerimaan Dianggap Sah (Deemed Acceptance): PIHAK KEDUA diberikan waktu maksimal 7 (tujuh) hari kerja "
        "sejak penyerahan modul untuk melakukan pengujian UAT. Apabila dalam tempo 7 (tujuh) hari kerja tersebut PIHAK KEDUA tidak memberikan "
        "catatan perbaikan tertulis, maka sistem secara otomatis dianggap telah lolos uji (Deemed Accepted) dan pekerjaan berlanjut ke tahap BAST."
    )
    mark_rev(r_m4)
    
    _, r_m5 = add_subclause(
        "• ", "Minggu 5: ",
        "Pelaksanaan 1x sesi pelatihan full team semua divisi secara offline / tatap muka on-site di kantor/workshop PT DMJ, penyerahan paket aplikasi portable offline (.exe), "
        "penandatanganan BAST -> Capaian Milestone 100% & Pembayaran Termin II Pelunasan (Rp 2.750.000,- / Go-Live Resmi)."
    )
    mark_rev(r_m5)

    # =========================================================================
    # PASAL 5: HAK KEKAYAAN INTELEKTUAL & LISENSI
    # =========================================================================
    add_article_heading("PASAL 5: HAK KEKAYAAN INTELEKTUAL & LISENSI APLIKASI OFFLINE (.EXE)")
    
    add_clause(
        "1. ", "Lisensi Penggunaan Penuh (Perpetual License): ",
        "PIHAK KEDUA diberikan hak pakai tidak terbatas waktu untuk mengoperasikan sistem Prime HRIS Enterprise di seluruh unit kerja, kantor, dan workshop PT Dwi Martha Jaya."
    )
    _, r_p5_2 = add_clause(
        "2. ", "Penyerahan Paket Aplikasi Mandiri Mode Offline Portable (.exe): ",
        "PIHAK KEDUA mendapatkan paket aplikasi sistem siap pakai yang telah dikompilasi dalam bentuk portable executable (.exe) "
        "beserta basis data lokalnya untuk keperluan backup mandiri, audit internal, atau pengoperasian offline di komputer kantor tanpa koneksi internet."
    )
    mark_rev(r_p5_2)

    add_clause(
        "3. ", "Larangan Distribusi Komersial: ",
        "PIHAK KEDUA dilarang keras menjual kembali, mendistribusikan, mempublikasikan secara publik, atau melisensikan ulang paket aplikasi "
        "ini kepada pihak ketiga manapun di luar PT Dwi Martha Jaya tanpa persetujuan tertulis PIHAK PERTAMA."
    )
    _, r_p5_4 = add_clause(
        "4. ", "Hak Eksklusif Modifikasi & Kustomisasi: ",
        "Hak cipta atas rancang bangun arsitektur sistem serta hak eksklusif untuk melakukan penambahan fitur, kustomisasi alur, update kode, "
        "atau peningkatan versi di masa depan tetap melekat secara mutlak pada PIHAK PERTAMA (PT Prime Infinity Systems). PIHAK KEDUA tidak diperkenankan "
        "melakukan rekayasa balik (reverse engineering), dekompilasi, atau mengalihkan pekerjaan pengembangan sistem kepada pihak ketiga manapun."
    )
    mark_rev(r_p5_4)

    # =========================================================================
    # PASAL 6: KERAHASIAAN DATA & INFORMASI (NDA)
    # =========================================================================
    add_article_heading("PASAL 6: KERAHASIAAN DATA & INFORMASI (NON-DISCLOSURE AGREEMENT)")
    
    add_clause(
        "1. ", "Kerahasiaan Data Pribadi & Upah Proyek: ",
        "PARA PIHAK sepakat untuk menjaga kerahasiaan seluruh data yang dipertukarkan, mencakup namun tidak terbatas pada data pribadi karyawan, "
        "rincian nominal gaji, laporan keuangan upah proyek, dan rahasia operasional PT Dwi Martha Jaya."
    )
    add_clause(
        "2. ", "Enkripsi & Keamanan Server: ",
        "PIHAK PERTAMA menjamin data yang tersimpan di dalam basis data SQLite server cloud dienkripsi dan diamankan dengan proteksi berlapis "
        "serta tidak akan dibagikan kepada pihak manapun di luar kepentingan operasional sistem PT DMJ."
    )

    # =========================================================================
    # PASAL 7: GARANSI, SLA & BATASAN TANGGUNG JAWAB
    # =========================================================================
    add_article_heading("PASAL 7: GARANSI PERBAIKAN BUG SISTEM (12 BULAN), SLA & BATASAN TANGGUNG JAWAB")
    
    _, r_p7_1 = add_clause(
        "1. ", "Ruang Lingkup Garansi Bug (Bug Fixing Only): ",
        "PIHAK PERTAMA memberikan jaminan garansi selama 12 (dua belas) bulan terhitung sejak tanggal Go-Live resmi / penandatanganan BAST, "
        "yang secara khusus dan tegas HANYA MENCAKUP PERBAIKAN BUG / GALAT SISTEM (bug fixing) atas kode program fungsionalitas yang diserahterimakan pada Pasal 1. "
        "Garansi ini TIDAK MENCAKUP pemeliharaan performa di luar spesifikasi dasar, modifikasi alur logika bisnis baru, penambahan fitur, "
        "ataupun konsultasi teknis umum di luar perbaikan galat/bug."
    )
    mark_rev(r_p7_1)

    add_clause(
        "2. ", "Service Level Agreement (SLA) Penanganan Bug: ",
        "Standar waktu respon dan pemulihan insiden sistem ditetapkan sebagai berikut:"
    )
    add_subclause("• ", "Masalah Kritis (Sistem offline / seluruh karyawan gagal presensi akibat bug): ", "Waktu respon maksimal 2 jam, penyelesaian 1x24 jam.")
    add_subclause("• ", "Masalah Non-Kritis (Galat minor laporan / tampilan antarmuka akibat bug): ", "Waktu respon maksimal 6 jam, penanganan 2x24 jam kerja.")

    _, r_p7_3 = add_clause(
        "3. ", "Penafian Ganti Rugi Finansial & Batasan Tanggung Jawab (Zero Financial Liability / Support Perbaikan Saja): ",
        "Ketentuan pembebasan tuntutan kerugian finansial diatur secara tegas:"
    )
    mark_rev(r_p7_3)

    _, r_p7_3a = add_subclause(
        "a. ", "Pembebasan Tuntutan Finansial: ",
        "PIHAK PERTAMA dibebaskan dari segala tuntutan kerugian finansial langsung maupun tidak langsung, hilangnya keuntungan bisnis, "
        "denda perselisihan ketenagakerjaan, ataupun selisih perhitungan upah internal yang diakibatkan oleh kelalaian operasional pengguna, "
        "kesalahan input data jam kerja/lembur oleh staf PIHAK KEDUA, kegagalan jaringan internet di lokasi, maupun malfungsi perangkat smartphone karyawan."
    )
    mark_rev(r_p7_3a)

    _, r_p7_3b = add_subclause(
        "b. ", "Tiadanya Biaya Ganti Rugi (Zero Liability): ",
        "PARA PIHAK sepakat dan menegaskan bahwa TIDAK ADA BIAYA GANTI RUGI MAKSIMAL MAUPUN KOMPENSASI FINANSIAL DALAM BENTUK DAN NOMINAL APAPUN "
        "dari PIHAK PERTAMA kepada PIHAK KEDUA atas setiap kendala atau disfungsi sistem. Tanggung jawab dan kewajiban tunggal PIHAK PERTAMA "
        "secara mutlak HANYA DAN TERBATAS PADA PEMBERIAN DUKUNGAN TEKNIS UNTUK PERBAIKAN (SUPPORT UNTUK PERBAIKAN / BUG FIXING) terhadap kode program sistem sesuai standar SLA pada ayat 2 pasal ini."
    )
    mark_rev(r_p7_3b)

    # =========================================================================
    # PASAL 8: PEMBATALAN KONTRAK & FORCE MAJEURE
    # =========================================================================
    add_article_heading("PASAL 8: PEMBATALAN KONTRAK & FORCE MAJEURE")
    
    add_clause(
        "1. ", "Keadaan Memaksa (Force Majeure): ",
        "Keadaan di luar kendali wajar PARA PIHAK (bencana alam, perang, kebakaran hebat, kebijakan nasional telekomunikasi) "
        "yang menghalangi pelaksanaan kewajiban membebaskan PARA PIHAK dari tuntutan ganti rugi, dan wajib diselesaikan secara musyawarah."
    )
    add_clause(
        "2. ", "Pembatalan Sepihak: ",
        "Apabila PIHAK KEDUA membatalkan proyek secara sepihak setelah pencapaian progress 50%, maka pembayaran Termin I yang telah disetorkan "
        "tidak dapat ditarik kembali sebagai pengganti atas jam kerja pengembangan dan aset perangkat lunak yang telah diserahkan."
    )

    # =========================================================================
    # PASAL 9: PENYELESAIAN PERSELISIHAN & PENUTUP
    # =========================================================================
    add_article_heading("PASAL 9: PENYELESAIAN PERSELISIHAN & PENUTUP")
    
    add_clause(
        "1. ", "Yurisdiksi Hukum: ",
        "Perjanjian ini ditafsirkan dan tunduk pada hukum Negara Kesatuan Republik Indonesia."
    )
    add_clause(
        "2. ", "Musyawarah & Domisili Hukum: ",
        "Perselisihan diselesaikan terlebih dahulu melalui musyawarah mufakat. Apabila dalam 30 hari tidak dicapai kata mufakat, "
        "maka diselesaikan melalui Pengadilan Negeri Surabaya."
    )
    _, r_p9_3 = add_clause(
        "3. ", "Kekuatan Hukum Mengikat Tanpa Meterai Fisik: ",
        "Surat Perjanjian ini dibuat dalam rangkap 2 (dua) asli bertanda tangan sah tanpa memerlukan meterai tempel fisik, "
        "serta memiliki kekuatan hukum yang sama dan mengikat secara sah bagi PARA PIHAK."
    )
    mark_rev(r_p9_3)

    _, r_p9_4 = add_clause(
        "4. ", "Saat Berlakunya Perjanjian (Effective Date): ",
        "Perjanjian Kerja Sama ini mulai berlaku efektif dan mengikat PARA PIHAK terhitung sejak tanggal ditandatanganinya "
        "dokumen ini oleh KEDUA BELAH PIHAK secara lengkap dan sah."
    )
    mark_rev(r_p9_4)

    # =========================================================================
    # LEMBAR PENGESAHAN & TANDA TANGAN
    # =========================================================================
    p_sig_title = doc.add_paragraph()
    p_sig_title.paragraph_format.space_before = Pt(14)
    p_sig_title.paragraph_format.space_after = Pt(6)
    p_sig_title.paragraph_format.keep_with_next = True

    # Prepare Clean Trimmed Signature from User's SSOT
    ttd_clean_path = r"C:\Users\PRIMA\prime-hris\ttd_clean.png"
    ttd_src_path = r"C:\Users\PRIMA\Documents\ttd.png"
    if os.path.exists(ttd_src_path) and not os.path.exists(ttd_clean_path):
        try:
            from PIL import Image
            im = Image.open(ttd_src_path)
            bbox = im.getbbox()
            if bbox:
                pad = 15
                crop_box = (max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(im.width, bbox[2]+pad), min(im.height, bbox[3]+pad))
                cropped = im.crop(crop_box)
                cropped.save(ttd_clean_path)
        except Exception:
            ttd_clean_path = ttd_src_path
    elif not os.path.exists(ttd_clean_path) and not os.path.exists(ttd_src_path):
        ttd_clean_path = None

    # Symmetrical 3-Row Signature Card Table (Header, Signature, Signer Info)
    sig_table = doc.add_table(rows=3, cols=2)
    sig_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_table.autofit = False

    tblPr = sig_table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>'
        f'<w:left w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>'
        f'<w:right w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>'
        f'<w:insideH w:val="none"/>'
        f'<w:insideV w:val="single" w:sz="6" w:space="0" w:color="{HEX_BORDER}"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

    for row in sig_table.rows:
        prevent_row_split(row)
        row.cells[0].width = Inches(3.4)
        row.cells[1].width = Inches(3.4)
        for c in row.cells:
            set_cell_background(c, HEX_CARD)

    # --- ROW 0: COMPANY HEADERS ---
    # Pihak Pertama Header
    c00 = sig_table.cell(0, 0)
    set_cell_margins(c00, top=140, bottom=40, left=140, right=140)
    p00 = c00.paragraphs[0]
    p00.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p00.paragraph_format.space_after = Pt(0)
    r_p1 = p00.add_run("PIHAK PERTAMA\n")
    r_p1.font.size = Pt(8.5)
    r_p1.font.bold = True
    r_p1.font.color.rgb = COLOR_SECONDARY
    r_c1 = p00.add_run("PT PRIME INFINITY SYSTEMS")
    r_c1.font.bold = True
    r_c1.font.size = Pt(9.5)
    r_c1.font.color.rgb = COLOR_PRIMARY

    # Pihak Kedua Header
    c01 = sig_table.cell(0, 1)
    set_cell_margins(c01, top=140, bottom=40, left=140, right=140)
    p01 = c01.paragraphs[0]
    p01.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p01.paragraph_format.space_after = Pt(0)
    r_p2 = p01.add_run("PIHAK KEDUA\n")
    r_p2.font.size = Pt(8.5)
    r_p2.font.bold = True
    r_p2.font.color.rgb = COLOR_SECONDARY
    r_c2 = p01.add_run("PT DWI MARTHA JAYA")
    r_c2.font.bold = True
    r_c2.font.size = Pt(9.5)
    r_c2.font.color.rgb = COLOR_PRIMARY

    # --- ROW 1: SIGNATURE DISPLAY AREA ---
    # Pihak Pertama Signature (Galih Primananda Signature Image)
    c10 = sig_table.cell(1, 0)
    set_cell_margins(c10, top=20, bottom=20, left=140, right=140)
    set_cell_valign(c10, "center")
    p10 = c10.paragraphs[0]
    p10.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p10.paragraph_format.space_before = Pt(4)
    p10.paragraph_format.space_after = Pt(4)
    active_ttd = ttd_clean_path if (ttd_clean_path and os.path.exists(ttd_clean_path)) else ttd_src_path
    if active_ttd and os.path.exists(active_ttd):
        r_img = p10.add_run()
        r_img.add_picture(active_ttd, width=Inches(1.55))
    else:
        p10.add_run("\n\n\n").font.size = Pt(11)

    # Pihak Kedua Signature (Clean Space for Client Wet Signature / E-Sign)
    c11 = sig_table.cell(1, 1)
    set_cell_margins(c11, top=20, bottom=20, left=140, right=140)
    set_cell_valign(c11, "center")
    p11 = c11.paragraphs[0]
    p11.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p11.paragraph_format.space_before = Pt(4)
    p11.paragraph_format.space_after = Pt(4)
    r_space = p11.add_run("\n\n\n")
    r_space.font.size = Pt(11)

    # --- ROW 2: SIGNATORY IDENTITIES & TITLES ---
    # Pihak Pertama Signatory Info
    c20 = sig_table.cell(2, 0)
    set_cell_margins(c20, top=40, bottom=140, left=140, right=140)
    p20 = c20.paragraphs[0]
    p20.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p20.paragraph_format.space_before = Pt(0)
    p20.paragraph_format.space_after = Pt(0)
    r_nm1 = p20.add_run("GALIH PRIMANANDA, S.E.\n")
    r_nm1.font.bold = True
    r_nm1.font.size = Pt(9.5)
    r_nm1.font.color.rgb = COLOR_PRIMARY
    r_t1 = p20.add_run("Director & Lead Platform Architect\n")
    r_t1.font.bold = True
    r_t1.font.size = Pt(8.5)
    r_t1.font.color.rgb = COLOR_SECONDARY
    mark_rev(r_t1)
    r_d1 = p20.add_run("Tanggal: 21 September 2026")
    r_d1.font.size = Pt(8.5)
    r_d1.font.color.rgb = COLOR_MUTED

    # Pihak Kedua Signatory Info
    c21 = sig_table.cell(2, 1)
    set_cell_margins(c21, top=40, bottom=140, left=140, right=140)
    p21 = c21.paragraphs[0]
    p21.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p21.paragraph_format.space_before = Pt(0)
    p21.paragraph_format.space_after = Pt(0)
    r_nm2 = p21.add_run("( ............................................................ )\n")
    r_nm2.font.bold = True
    r_nm2.font.size = Pt(9.5)
    r_nm2.font.color.rgb = COLOR_PRIMARY
    r_t2 = p21.add_run("Direktur / GM / HR Manager\n")
    r_t2.font.bold = True
    r_t2.font.size = Pt(8.5)
    r_t2.font.color.rgb = COLOR_SECONDARY
    mark_rev(r_t2)
    r_d2 = p21.add_run("Tanggal: 21 September 2026")
    r_d2.font.size = Pt(8.5)
    r_d2.font.color.rgb = COLOR_MUTED

    # Save Document
    if not docx_path:
        docx_path = r"C:\Users\PRIMA\prime-hris\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ.docx"
    doc.save(docx_path)
    print(f"Successfully generated DOCX (clean_mode={clean_mode}) at: {docx_path}")

if __name__ == "__main__":
    # 1. Clean Official Version (Default)
    build_pks_document(clean_mode=True, docx_path=r"C:\Users\PRIMA\prime-hris\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ.docx")
    build_pks_document(clean_mode=True, docx_path=r"C:\Users\PRIMA\prime-hris\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ_BERSIH.docx")
    # 2. Reference Revision-marked Version
    build_pks_document(clean_mode=False, docx_path=r"C:\Users\PRIMA\prime-hris\PERJANJIAN_KERJASAMA_HRIS_PT_DMJ_REVISI.docx")
