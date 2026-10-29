import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
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

def set_table_borders(table, color="CBD5E1", sz="4"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideH w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideV w:val="none"/>'
        f'  <w:left w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def prevent_row_split(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

def set_repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

def build_invoice(docx_path=None):
    doc = docx.Document()
    
    for s in doc.sections:
        s.top_margin = Inches(0.4)
        s.bottom_margin = Inches(0.4)
        s.left_margin = Inches(0.6)
        s.right_margin = Inches(0.6)

    HEX_PRIMARY = "18345E"
    HEX_SECONDARY = "283C5A"
    HEX_ACCENT = "1E508C"
    HEX_ORANGE = "FF6B00"
    HEX_BG_LIGHT = "F8FAFC"
    HEX_CARD = "F4F6F9"
    HEX_BORDER = "CBD5E1"
    HEX_TEXT = "22262A"
    HEX_TEXT_MUTED = "64748B"

    COLOR_PRIMARY = RGBColor(0x18, 0x34, 0x5E)
    COLOR_SECONDARY = RGBColor(0x28, 0x3C, 0x5A)
    COLOR_ORANGE = RGBColor(0xFF, 0x6B, 0x00)
    COLOR_TEXT = RGBColor(0x22, 0x26, 0x2A)
    COLOR_TEXT_MUTED = RGBColor(0x64, 0x74, 0x8B)

    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Segoe UI'
    normal_style.font.size = Pt(9.5)
    normal_style.font.color.rgb = COLOR_TEXT

    # =========================================================================
    # HEADER TABLE (Company Info & Invoice Title)
    # =========================================================================
    head_table = doc.add_table(rows=1, cols=2)
    head_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    head_table.autofit = False
    head_table.columns[0].width = Inches(4.2)
    head_table.columns[1].width = Inches(2.7)

    # Left Cell: Company Info
    c_left = head_table.cell(0, 0)
    set_cell_margins(c_left, top=30, bottom=30, left=30, right=30)
    set_cell_valign(c_left, "top")
    p_comp = c_left.paragraphs[0]
    p_comp.paragraph_format.line_spacing = 1.15
    p_comp.paragraph_format.space_after = Pt(0)
    r_name = p_comp.add_run("PT PRIME INFINITY SYSTEMS\n")
    r_name.font.bold = True
    r_name.font.size = Pt(12)
    r_name.font.color.rgb = COLOR_PRIMARY
    
    r_det = p_comp.add_run(
        "Prime ProjectX • Software Engineering & Industrial Automation\n"
        "Surabaya, Jawa Timur • Website: primeprojectx.net • Email: galih@primeprojectx.net"
    )
    r_det.font.size = Pt(8)
    r_det.font.color.rgb = COLOR_TEXT_MUTED

    # Right Cell: Invoice Meta
    c_right = head_table.cell(0, 1)
    set_cell_margins(c_right, top=30, bottom=30, left=30, right=30)
    set_cell_valign(c_right, "top")
    p_meta = c_right.paragraphs[0]
    p_meta.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_meta.paragraph_format.line_spacing = 1.15
    p_meta.paragraph_format.space_after = Pt(0)
    
    r_inv_title = p_meta.add_run("INVOICE\n")
    r_inv_title.font.bold = True
    r_inv_title.font.size = Pt(18)
    r_inv_title.font.color.rgb = COLOR_PRIMARY
    
    r_num = p_meta.add_run("No: INV-008/PIS-DMJ/IX/2026\n")
    r_num.font.bold = True
    r_num.font.size = Pt(9)
    r_num.font.color.rgb = COLOR_SECONDARY

    r_date = p_meta.add_run("Tanggal: 21 September 2026 • Jatuh Tempo: 7 Hari (BAP-50)\n")
    r_date.font.size = Pt(8)
    r_date.font.color.rgb = COLOR_TEXT_MUTED

    r_st = p_meta.add_run("STATUS: MENUNGGU PEMBAYARAN")
    r_st.font.bold = True
    r_st.font.size = Pt(7.5)
    r_st.font.color.rgb = COLOR_ORANGE

    # Divider line
    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_before = Pt(2)
    p_div.paragraph_format.space_after = Pt(3)
    pBdr = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="8" w:space="1" w:color="{HEX_PRIMARY}"/></w:pBdr>')
    p_div._p.get_or_add_pPr().append(pBdr)

    # =========================================================================
    # CLIENT / BILLED TO BOX
    # =========================================================================
    bill_table = doc.add_table(rows=1, cols=1)
    bill_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    bill_table.autofit = False
    bill_table.columns[0].width = Inches(7.2)
    
    b_cell = bill_table.cell(0, 0)
    set_cell_background(b_cell, HEX_CARD)
    set_cell_margins(b_cell, top=45, bottom=45, left=80, right=80)
    set_cell_valign(b_cell, "top")
    
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'  <w:left w:val="single" w:sz="18" w:color="{HEX_PRIMARY}"/>'
        f'  <w:top w:val="none"/>'
        f'  <w:bottom w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    b_cell._tc.get_or_add_tcPr().append(tcBorders)

    p_b = b_cell.paragraphs[0]
    p_b.paragraph_format.line_spacing = 1.15
    p_b.paragraph_format.space_after = Pt(0)
    
    r_bt = p_b.add_run("DITUJUKAN KEPADA: ")
    r_bt.font.size = Pt(8)
    r_bt.font.bold = True
    r_bt.font.color.rgb = COLOR_TEXT_MUTED
    
    r_cn = p_b.add_run("PT DWI MARTHA JAYA (PT DMJ)\n")
    r_cn.font.size = Pt(10)
    r_cn.font.bold = True
    r_cn.font.color.rgb = COLOR_PRIMARY
    
    r_cd = p_b.add_run(
        "Integrated Design & Construction Solutions • U.p. Direksi & Manajemen PT DMJ\n"
        "Dasar Kontrak: Surat Perjanjian Kerja Sama (PKS) No. 008/PKS-IT/PIS-DMJ/IX/2026"
    )
    r_cd.font.size = Pt(7.8)
    r_cd.font.color.rgb = COLOR_TEXT

    p_space = doc.add_paragraph()
    p_space.paragraph_format.space_before = Pt(0)
    p_space.paragraph_format.space_after = Pt(2)

    # =========================================================================
    # INVOICE ITEMS TABLE
    # =========================================================================
    item_table = doc.add_table(rows=2, cols=4)
    item_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    item_table.autofit = False
    set_table_borders(item_table, color=HEX_BORDER, sz="4")
    set_repeat_header(item_table.rows[0])
    prevent_row_split(item_table.rows[0])
    prevent_row_split(item_table.rows[1])

    item_table.columns[0].width = Inches(0.5)
    item_table.columns[1].width = Inches(4.3)
    item_table.columns[2].width = Inches(1.0)
    item_table.columns[3].width = Inches(1.4)

    i_headers = ["No", "Rincian Item & Lingkup Pekerjaan (Milestone 50%)", "Tahap", "Nominal (IDR)"]
    for i, h in enumerate(i_headers):
        c = item_table.rows[0].cells[i]
        set_cell_background(c, HEX_PRIMARY)
        set_cell_margins(c, top=60, bottom=60, left=80, right=80)
        set_cell_valign(c, "center")
        p = c.paragraphs[0]
        if i in [0, 2]:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif i == 3:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r = p.add_run(h)
        r.font.bold = True
        r.font.size = Pt(8)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    # Item Row 1
    row_1 = item_table.rows[1]
    for c in row_1.cells:
        set_cell_background(c, "FFFFFF")
        set_cell_margins(c, top=50, bottom=50, left=80, right=80)
        set_cell_valign(c, "top")

    p_no = row_1.cells[0].paragraphs[0]
    p_no.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_no = p_no.add_run("01")
    r_no.font.bold = True
    r_no.font.size = Pt(8.5)

    p_desc = row_1.cells[1].paragraphs[0]
    p_desc.paragraph_format.line_spacing = 1.15
    p_desc.paragraph_format.space_after = Pt(0)
    r_t1 = p_desc.add_run("Pembayaran Termin I (Milestone Progress 50%)\n")
    r_t1.font.bold = True
    r_t1.font.size = Pt(8.5)
    r_t1.font.color.rgb = COLOR_PRIMARY
    
    r_t1_d = p_desc.add_run(
        "Pengadaan & Implementasi Prime HRIS Enterprise (Paket Komplit Full Suite)\n"
        "• Modul Presensi Biometrik Selfie Geotag Watermark GPS Satelit Native (Anti-Fake GPS)\n"
        "• Live Demonstration pada cloud staging (dmj.primeprojectx.net) & penandatanganan BAP-50"
    )
    r_t1_d.font.size = Pt(7.5)
    r_t1_d.font.color.rgb = COLOR_TEXT

    p_th = row_1.cells[2].paragraphs[0]
    p_th.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_th = p_th.add_run("Termin I\n(50%)")
    r_th.font.size = Pt(8.5)
    r_th.font.bold = True

    p_pr = row_1.cells[3].paragraphs[0]
    p_pr.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_pr = p_pr.add_run("Rp 2.750.000,-")
    r_pr.font.bold = True
    r_pr.font.size = Pt(9.5)
    r_pr.font.color.rgb = COLOR_PRIMARY

    # =========================================================================
    # SUMMARY / TOTAL TABLE
    # =========================================================================
    p_sp2 = doc.add_paragraph()
    p_sp2.paragraph_format.space_before = Pt(0)
    p_sp2.paragraph_format.space_after = Pt(1)

    sum_table = doc.add_table(rows=3, cols=2)
    sum_table.alignment = WD_TABLE_ALIGNMENT.RIGHT
    sum_table.autofit = False
    sum_table.columns[0].width = Inches(4.7)
    sum_table.columns[1].width = Inches(2.5)

    sum_data = [
        ("Subtotal Tagihan Termin I (50%):", "Rp 2.750.000,-", False, "FFFFFF"),
        ("Pajak / Potongan Lain (Netto Disepakati):", "Rp 0,-", False, "FFFFFF"),
        ("TOTAL HARUS DIBAYAR (TERMIN I):", "Rp 2.750.000,-", True, HEX_CARD)
    ]

    for idx, (label, val, is_tot, bg) in enumerate(sum_data):
        row = sum_table.rows[idx]
        prevent_row_split(row)
        for c in row.cells:
            set_cell_background(c, bg)
            set_cell_margins(c, top=25, bottom=25, left=50, right=50)
            set_cell_valign(c, "center")
            
        p_l = row.cells[0].paragraphs[0]
        p_l.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r_l = p_l.add_run(label)
        r_l.font.size = Pt(8.5 if not is_tot else 9)
        if is_tot:
            r_l.font.bold = True
            r_l.font.color.rgb = COLOR_PRIMARY
            
        p_v = row.cells[1].paragraphs[0]
        p_v.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r_v = p_v.add_run(val)
        r_v.font.size = Pt(9 if not is_tot else 10.5)
        r_v.font.bold = True
        r_v.font.color.rgb = COLOR_PRIMARY if not is_tot else COLOR_ORANGE

    p_terbilang = doc.add_paragraph()
    p_terbilang.paragraph_format.space_before = Pt(1)
    p_terbilang.paragraph_format.space_after = Pt(3)
    p_terbilang.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_tb = p_terbilang.add_run("Terbilang: Dua Juta Tujuh Ratus Lima Puluh Ribu Rupiah")
    r_tb.font.italic = True
    r_tb.font.size = Pt(8)
    r_tb.font.color.rgb = COLOR_TEXT_MUTED

    # =========================================================================
    # INSTRUCTION & CLAUSE SUMMARY CARDS
    # =========================================================================
    info_table = doc.add_table(rows=1, cols=2)
    info_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    info_table.autofit = False
    info_table.columns[0].width = Inches(3.55)
    info_table.columns[1].width = Inches(3.65)

    # Bank Transfer Info (Left)
    cell_bank = info_table.cell(0, 0)
    set_cell_background(cell_bank, HEX_CARD)
    set_cell_margins(cell_bank, top=50, bottom=50, left=80, right=80)
    set_cell_valign(cell_bank, "top")
    
    p_bk = cell_bank.paragraphs[0]
    p_bk.paragraph_format.line_spacing = 1.15
    p_bk.paragraph_format.space_after = Pt(0)
    r_bk_t = p_bk.add_run("INSTRUKSI PEMBAYARAN TRANSFER BANK:\n")
    r_bk_t.font.bold = True
    r_bk_t.font.size = Pt(8)
    r_bk_t.font.color.rgb = COLOR_PRIMARY
    
    r_bk_d = p_bk.add_run(
        "• Bank Tujuan: BCA (Bank Central Asia)\n"
        "• Atas Nama: Galih Primananda / PT Prime Infinity Systems\n"
        "• Berita Transfer: INV-008 DMJ - Termin 1\n"
        "• Konfirmasi Pembayaran: galih@primeprojectx.net\n"
        "• Jatuh Tempo: Maksimal 7 (tujuh) hari kerja sejak BAP-50."
    )
    r_bk_d.font.size = Pt(7.5)
    r_bk_d.font.color.rgb = COLOR_TEXT

    # Related Clauses Summary (Right)
    cell_cl = info_table.cell(0, 1)
    set_cell_background(cell_cl, HEX_CARD)
    set_cell_margins(cell_cl, top=50, bottom=50, left=80, right=80)
    set_cell_valign(cell_cl, "top")
    
    p_cl = cell_cl.paragraphs[0]
    p_cl.paragraph_format.line_spacing = 1.15
    p_cl.paragraph_format.space_after = Pt(0)
    r_cl_t = p_cl.add_run("CATATAN KLAUSUL KONTRAK TERKAIT (PKS 008):\n")
    r_cl_t.font.bold = True
    r_cl_t.font.size = Pt(8)
    r_cl_t.font.color.rgb = COLOR_PRIMARY
    
    r_cl_d = p_cl.add_run(
        "1. Termin II (Pelunasan 50% / Rp 2.750.000,-): Pasca UAT 7 hari, 1x on-site training PT DMJ, .exe, & BAST.\n"
        "2. Cloud Running Apps: Rp 35.000,-/bln (50-100 user, 1GB + 10GB backup) aktif bln ke-2.\n"
        "3. Add-On Modular: Mulai Rp 100.000,- s/d Rp 1.500.000,-/modul.\n"
        "4. Garansi 12 Bulan: Khusus bug fixing tanpa ganti rugi finansial."
    )
    r_cl_d.font.size = Pt(7.5)
    r_cl_d.font.color.rgb = COLOR_TEXT

    # =========================================================================
    # SIGNATURE & QR CODE VERIFICATION BLOCK
    # =========================================================================
    p_sp3 = doc.add_paragraph()
    p_sp3.paragraph_format.space_before = Pt(1)
    p_sp3.paragraph_format.space_after = Pt(2)

    sig_table = doc.add_table(rows=1, cols=2)
    sig_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_table.autofit = False
    sig_table.columns[0].width = Inches(3.55)
    sig_table.columns[1].width = Inches(3.65)
    prevent_row_split(sig_table.rows[0])

    # Left: QR Code Verification
    qr_cell = sig_table.cell(0, 0)
    set_cell_background(qr_cell, HEX_CARD)
    set_cell_margins(qr_cell, top=40, bottom=40, left=70, right=70)
    set_cell_valign(qr_cell, "center")

    qr_img_path = r"C:\Users\PRIMA\prime-hris\invoice_qr.png"
    p_q = qr_cell.paragraphs[0]
    p_q.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_q.paragraph_format.space_after = Pt(1)
    
    if os.path.exists(qr_img_path):
        r_q_img = p_q.add_run()
        r_q_img.add_picture(qr_img_path, width=Inches(0.72))
    
    p_qc = qr_cell.add_paragraph()
    p_qc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_qc.paragraph_format.space_before = Pt(1)
    p_qc.paragraph_format.space_after = Pt(0)
    r_q1 = p_qc.add_run("VERIFIKASI INVOICE DIGITAL\n")
    r_q1.font.bold = True
    r_q1.font.size = Pt(7)
    r_q1.font.color.rgb = COLOR_PRIMARY
    r_q2 = p_qc.add_run("Scan untuk validasi status tagihan:\nprimeprojectx.net/invoice?tab=invoices")
    r_q2.font.size = Pt(6)
    r_q2.font.color.rgb = COLOR_TEXT_MUTED

    # Right: Signature
    sign_cell = sig_table.cell(0, 1)
    set_cell_background(sign_cell, HEX_CARD)
    set_cell_margins(sign_cell, top=40, bottom=40, left=70, right=70)
    set_cell_valign(sign_cell, "top")

    p_s = sign_cell.paragraphs[0]
    p_s.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_s.paragraph_format.line_spacing = 1.15
    p_s.paragraph_format.space_after = Pt(1)
    p_s.add_run("Surabaya, 21 September 2026\nHormat Kami,\n").font.size = Pt(8)
    r_sc = p_s.add_run("PT PRIME INFINITY SYSTEMS")
    r_sc.font.bold = True
    r_sc.font.size = Pt(8)
    r_sc.font.color.rgb = COLOR_PRIMARY

    # Embedded Official Signature
    ttd_clean_path = r"C:\Users\PRIMA\prime-hris\ttd_clean.png"
    ttd_src_path = r"C:\Users\PRIMA\Documents\ttd.png"
    active_ttd = ttd_clean_path if os.path.exists(ttd_clean_path) else ttd_src_path
    
    p_sig = sign_cell.add_paragraph()
    p_sig.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sig.paragraph_format.space_before = Pt(1)
    p_sig.paragraph_format.space_after = Pt(1)
    if active_ttd and os.path.exists(active_ttd):
        r_sig = p_sig.add_run()
        r_sig.add_picture(active_ttd, width=Inches(1.15))
    else:
        p_sig.add_run("\n").font.size = Pt(8)

    p_sn = sign_cell.add_paragraph()
    p_sn.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sn.paragraph_format.space_before = Pt(1)
    p_sn.paragraph_format.space_after = Pt(0)
    r_sn = p_sn.add_run("GALIH PRIMANANDA, S.E.\n")
    r_sn.font.bold = True
    r_sn.font.size = Pt(8.5)
    r_sn.font.color.rgb = COLOR_PRIMARY
    
    r_st = p_sn.add_run("Director & Lead Platform Architect")
    r_st.font.size = Pt(7.5)
    r_st.font.bold = True

    if not docx_path:
        docx_path = r"C:\Users\PRIMA\prime-hris\INVOICE_PRIME_HRIS_PT_DMJ.docx"
    doc.save(docx_path)
    print(f"Successfully generated Invoice DOCX at: {docx_path}")

if __name__ == "__main__":
    build_invoice()
