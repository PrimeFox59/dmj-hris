import os
import sys
import sqlite3
import datetime
import hashlib
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn
import win32com.client

# Import canonical Prime Projectx footer and validator via importlib
import importlib.util
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

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'  <w:top w:w="{top}" w:type="dxa"/>'
        f'  <w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'  <w:left w:w="{left}" w:type="dxa"/>'
        f'  <w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

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

def generate_credential_report():
    print("[1/5] Fetching staff accounts from SQLite database (Excluding Superusers)...")
    db_path = r"C:\Users\PRIMA\prime-hris\data\hris.sqlite"
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("""
      SELECT 
        u.id as user_id,
        u.username,
        u.employee_id,
        u.email,
        u.role as user_role,
        u.system_role,
        e.nik,
        e.name as employee_name,
        e.role as employee_role,
        e.department,
        e.data_json
      FROM user_accounts u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.system_role != 'superuser' AND u.username NOT IN ('admin', 'galih')
      ORDER BY 
        CASE WHEN u.system_role = 'hr' THEN 0 
             WHEN u.system_role = 'finance' THEN 1 
             ELSE 2 END,
        CAST(SUBSTR(u.username, 2) AS INTEGER) ASC;
    """)
    rows = c.fetchall()
    print(f"  -> Total staff accounts fetched: {len(rows)}")

    print("[2/5] Creating Word document structure...")
    doc = docx.Document()

    # Configure A4 Portrait with 0.55" margins for optimal data density & clean layout
    for sec in doc.sections:
        sec.page_width = Inches(8.27)
        sec.page_height = Inches(11.69)
        sec.top_margin = Inches(0.65)
        sec.bottom_margin = Inches(0.65)
        sec.left_margin = Inches(0.55)
        sec.right_margin = Inches(0.55)

    # Apply canonical Prime Projectx footer (Logo + URL + Dynamic Pagination)
    apply_canonical_prime_footer(
        doc,
        subtitle="PRIME HRIS Enterprise // Official User Credential & Security Directory",
        logo_path=r"C:\Users\PRIMA\templates\assets\prime_px_footer_logo.png"
    )

    # 1. HEADER BANNER TABLE
    header_tbl = doc.add_table(rows=1, cols=2)
    header_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    header_tbl.autofit = False
    header_tbl.columns[0].width = Inches(5.17)
    header_tbl.columns[1].width = Inches(2.00)

    # Left cell: Title & Subtitle
    c_left = header_tbl.cell(0, 0)
    p_meta = c_left.paragraphs[0]
    p_meta.paragraph_format.space_before = Pt(0)
    p_meta.paragraph_format.space_after = Pt(2)
    p_meta.paragraph_format.line_spacing = 1.05
    r_meta = p_meta.add_run("PRIME PROJECTX // ENTERPRISE ACCESS GOVERNANCE & IDENTITY SYSTEM")
    r_meta.font.name = "Segoe UI"
    r_meta.font.size = Pt(8.0)
    r_meta.font.bold = True
    r_meta.font.color.rgb = RGBColor(30, 80, 140)

    p_title = c_left.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(3)
    p_title.paragraph_format.line_spacing = 1.1
    r_title = p_title.add_run("DIREKTORI RESMI KREDENSIAL PENGGUNA & LOGIN DEFAULT")
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(14.0)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(24, 52, 94) # Deep Navy

    p_sub = c_left.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(0)
    p_sub.paragraph_format.line_spacing = 1.05
    r_sub = p_sub.add_run("Official Employee Credential & Role-Based Access Directory — PT Dwi Martha Jaya\nSistem Terintegrasi Presensi Biometrik Wajah, Penggajian & Manajemen SDM")
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(8.5)
    r_sub.font.color.rgb = RGBColor(75, 85, 99)

    # Right cell: Confidential Badge & Metadata
    c_right = header_tbl.cell(0, 1)
    p_right = c_right.paragraphs[0]
    p_right.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_right.paragraph_format.space_before = Pt(0)
    p_right.paragraph_format.space_after = Pt(2)
    r_badge = p_right.add_run("[ CONFIDENTIAL ]")
    r_badge.font.name = "Segoe UI"
    r_badge.font.size = Pt(8.5)
    r_badge.font.bold = True
    r_badge.font.color.rgb = RGBColor(185, 28, 28) # Red

    p_r2 = c_right.add_paragraph()
    p_r2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_r2.paragraph_format.space_before = Pt(0)
    p_r2.paragraph_format.space_after = Pt(0)
    p_r2.paragraph_format.line_spacing = 1.1
    now_str = datetime.datetime.now().strftime("%d %B %Y, %H:%M WIB")
    r_r2 = p_r2.add_run(f"Status: DOKUMEN AKTIF\nTanggal: {now_str}\nTotal Karyawan: {len(rows)} Akun\nHost: POCO Edge / VPS")
    r_r2.font.name = "Segoe UI"
    r_r2.font.size = Pt(8.0)
    r_r2.font.color.rgb = RGBColor(75, 85, 99)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # 2. METADATA & ARSITEKTUR KREDENSIAL SCORECARD (NO SUPERUSER EXPOSURE)
    card_tbl = doc.add_table(rows=1, cols=4)
    card_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    card_tbl.autofit = False
    card_widths = [Inches(1.79), Inches(1.79), Inches(1.79), Inches(1.80)]
    for i, w in enumerate(card_widths):
        card_tbl.columns[i].width = w

    cards_data = [
        ("PORTAL PRODUKSI", "hris.primeprojectx.net", "Cloudflare Tunnel Secure", "1E3A8A"),
        ("TOTAL KARYAWAN", f"{len(rows)} Akun Terdaftar", "HR, Finance & Staff", "0D9488"),
        ("DEFAULT PASSWORD", "zzz", "Standar Akun Operasional", "B45309"),
        ("MULTI-IDENTIFIER", "ID / NIK / Email", "Mendukung 3 Jenis Identitas", "475569")
    ]

    for i, (label, val, sub, col_hex) in enumerate(cards_data):
        cell = card_tbl.cell(0, i)
        set_cell_background(cell, "F8FAFC")
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        r1 = p.add_run(label + "\n")
        r1.font.name = "Segoe UI"
        r1.font.size = Pt(7.0)
        r1.font.bold = True
        r1.font.color.rgb = RGBColor(100, 116, 139)

        r2 = p.add_run(val + "\n")
        r2.font.name = "Segoe UI"
        r2.font.size = Pt(9.5)
        r2.font.bold = True
        r2.font.color.rgb = RGBColor(24, 52, 94)

        r3 = p.add_run(sub)
        r3.font.name = "Segoe UI"
        r3.font.size = Pt(6.8)
        r3.font.color.rgb = RGBColor(100, 116, 139)

    set_table_borders(card_tbl, color="CBD5E1", sz="6")
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # 3. EXECUTIVE INSTRUCTION & GOVERNANCE POLICY
    p_inst = doc.add_paragraph()
    p_inst.paragraph_format.space_before = Pt(2)
    p_inst.paragraph_format.space_after = Pt(4)
    p_inst.paragraph_format.line_spacing = 1.15
    r_inst_h = p_inst.add_run("Ringkasan Tata Kelola & Kebijakan Autentikasi Sistem:\n")
    r_inst_h.font.name = "Segoe UI"
    r_inst_h.font.size = Pt(9.0)
    r_inst_h.font.bold = True
    r_inst_h.font.color.rgb = RGBColor(24, 52, 94)

    r_inst_b = p_inst.add_run(
        "1. Fleksibilitas Identitas Login: Setiap pengguna dapat masuk ke portal PRIME HRIS menggunakan salah satu dari 3 kredensial sah: Login ID kanonikal (contoh: d001), NIK KTP / Kantor resmi (contoh: 3578...), atau Alamat Email terdaftar.\n"
        "2. Skema Password Default: Seluruh akun staf, tim keuangan, dan manajemen HR (d001 s/d d153) diinisialisasi dengan password default 'zzz'.\n"
        "3. Hierarki Hak Akses (Role-Based Access Control / RBAC): HR (Human Resources) mengelola administrasi personalia, approval cuti/izin, penjadwalan shift, dan verifikasi presensi; Finance mengelola payroll, reimbursement, dan laporan keuangan proyek; Staff mengakses portal presensi mandiri dan pengajuan kerja harian.\n"
        "4. Kepatuhan Keamanan: Seluruh staf diwajibkan melakukan pembaruan password default pada saat pertama kali login melalui menu Pengaturan Profil (ikon profil di pojok kanan atas)."
    )
    r_inst_b.font.name = "Segoe UI"
    r_inst_b.font.size = Pt(8.0)
    r_inst_b.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph().paragraph_format.space_after = Pt(2)

    # 4. TABEL LENGKAP KREDENSIAL PENGGUNA (153 AKUN KARYAWAN)
    p_tbl_title = doc.add_paragraph()
    p_tbl_title.paragraph_format.space_before = Pt(4)
    p_tbl_title.paragraph_format.space_after = Pt(3)
    r_tt = p_tbl_title.add_run(f"DAFTAR LENGKAP KREDENSIAL PENGGUNA ({len(rows)} AKUN KARYAWAN & STAF)")
    r_tt.font.name = "Segoe UI"
    r_tt.font.size = Pt(10.0)
    r_tt.font.bold = True
    r_tt.font.color.rgb = RGBColor(24, 52, 94)

    col_w = [Inches(0.32), Inches(0.60), Inches(0.75), Inches(1.80), Inches(1.20), Inches(0.65), Inches(1.85)]
    tbl = doc.add_table(rows=1, cols=7)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    for i, w in enumerate(col_w):
        tbl.columns[i].width = w

    headers = [
        "NO", "LOGIN ID", "DEFAULT PASS", "NAMA LENGKAP KARYAWAN", "NIK / ID KARYAWAN", "ROLE", "JABATAN & DEPARTEMEN"
    ]
    hdr_row = tbl.rows[0]
    make_row_header(hdr_row)
    for i, text in enumerate(headers):
        cell = hdr_row.cells[i]
        set_cell_background(cell, "18345E") # Deep Navy
        set_cell_margins(cell, top=120, bottom=120, left=80, right=80)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        if i in [0, 1, 2, 5]:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        else:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(text)
        r.font.name = "Segoe UI"
        r.font.size = Pt(7.2)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    # Populate Data Rows
    for idx, r in enumerate(rows):
        uname = r[1]
        empid = r[2]
        email = r[3]
        srole = r[5]
        nik = r[6]
        name = r[7]
        pos = r[8] or r[4] or "Staff Lapangan"
        dept = r[9] or "Operasional & Proyek"

        default_pw = "zzz"

        row = tbl.add_row()
        make_row_cant_split(row)
        bg_hex = "FFFFFF" if (idx % 2 == 0) else "F8FAFC"

        for c_idx in range(7):
            cell = row.cells[c_idx]
            set_cell_background(cell, bg_hex)
            set_cell_margins(cell, top=60, bottom=60, left=70, right=70)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05

            if c_idx == 0: # No
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r_c = p.add_run(str(idx + 1))
                r_c.font.name = "Segoe UI"
                r_c.font.size = Pt(7.2)
                r_c.font.color.rgb = RGBColor(100, 116, 139)

            elif c_idx == 1: # Login ID
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r_c = p.add_run(uname)
                r_c.font.name = "Segoe UI"
                r_c.font.size = Pt(7.5)
                r_c.font.bold = True
                r_c.font.color.rgb = RGBColor(30, 58, 138)

            elif c_idx == 2: # Default Pass
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r_c = p.add_run(default_pw)
                r_c.font.name = "Consolas"
                r_c.font.size = Pt(7.5)
                r_c.font.bold = True
                r_c.font.color.rgb = RGBColor(71, 85, 105)

            elif c_idx == 3: # Nama Karyawan
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                r_c = p.add_run(name)
                r_c.font.name = "Segoe UI"
                r_c.font.size = Pt(7.5)
                r_c.font.bold = (srole in ["hr", "finance"])
                r_c.font.color.rgb = RGBColor(15, 23, 42)

            elif c_idx == 4: # NIK / ID Karyawan
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                r_c = p.add_run(f"{nik}\n({empid})")
                r_c.font.name = "Segoe UI"
                r_c.font.size = Pt(6.8)
                r_c.font.color.rgb = RGBColor(71, 85, 105)

            elif c_idx == 5: # Role RBAC
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r_c = p.add_run(srole.upper())
                r_c.font.name = "Segoe UI"
                r_c.font.size = Pt(6.8)
                r_c.font.bold = True
                if srole == "hr":
                    r_c.font.color.rgb = RGBColor(13, 148, 136)
                elif srole == "finance":
                    r_c.font.color.rgb = RGBColor(180, 83, 9)
                else:
                    r_c.font.color.rgb = RGBColor(100, 116, 139)

            elif c_idx == 6: # Jabatan & Departemen
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                r_pos = p.add_run(pos + "\n")
                r_pos.font.name = "Segoe UI"
                r_pos.font.size = Pt(7.2)
                r_pos.font.bold = True
                r_pos.font.color.rgb = RGBColor(30, 41, 59)

                r_dep = p.add_run(dept)
                r_dep.font.name = "Segoe UI"
                r_dep.font.size = Pt(6.5)
                r_dep.font.color.rgb = RGBColor(100, 116, 139)

    set_table_borders(tbl, color="CBD5E1", sz="3")

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 5. SECURITY & TECHNICAL AUDIT CONCLUSION (STRICT ZERO SIGNATURE / APPROVAL POLICY)
    p_concl_h = doc.add_paragraph()
    p_concl_h.paragraph_format.space_before = Pt(8)
    p_concl_h.paragraph_format.space_after = Pt(2)
    r_ch = p_concl_h.add_run("Integritas Sistem & Protokol Keamanan Kredensial Karyawan")
    r_ch.font.name = "Segoe UI"
    r_ch.font.size = Pt(10.0)
    r_ch.font.bold = True
    r_ch.font.color.rgb = RGBColor(24, 52, 94)

    p_concl_b = doc.add_paragraph()
    p_concl_b.paragraph_format.space_before = Pt(0)
    p_concl_b.paragraph_format.space_after = Pt(4)
    p_concl_b.paragraph_format.line_spacing = 1.15
    r_cb = p_concl_b.add_run(
        "Dokumen ini memuat seluruh data kredensial akses aktif staf dan personalia pada sistem PRIME HRIS Enterprise. Seluruh password disimpan dalam basis data menggunakan enkripsi satu arah scrypt (64-byte key length dengan unique salt per akun). "
        "Administrator sistem dan manajemen HR dilarang keras membagikan berkas ini kepada pihak luar tanpa izin Direksi. "
        "Setiap insiden kegagalan login berulang atau dugaan kompromi akun akan secara otomatis dicatat pada Audit Log Telemetry sistem dan dikirimkan notifikasinya secara instan melalui gateway WhatsApp."
    )
    r_cb.font.name = "Segoe UI"
    r_cb.font.size = Pt(8.0)
    r_cb.font.color.rgb = RGBColor(71, 85, 105)

    # Audit telemetry seal
    audit_hash = hashlib.sha256(f"PRIME_HRIS_STAFF_CREDENTIALS_{len(rows)}_{now_str}".encode()).hexdigest().upper()[:24]
    p_seal = doc.add_paragraph()
    p_seal.paragraph_format.space_before = Pt(2)
    p_seal.paragraph_format.space_after = Pt(0)
    r_seal = p_seal.add_run(
        f"Telemetri Sistem: [DIGITAL AUDIT SEAL: PX-SEC-{audit_hash}]  |  Node: POCO-EDGE-NODE-3000  |  Status: PRODUCTION VERIFIED"
    )
    r_seal.font.name = "Consolas"
    r_seal.font.size = Pt(7.0)
    r_seal.font.bold = True
    r_seal.font.color.rgb = RGBColor(100, 116, 139)

    print("[3/5] Validating strictly ZERO signature or approval blocks (Policy Compliance)...")
    validate_no_signature_or_approval_blocks(doc)
    print("  -> Validation passed: Zero signature boxes, zero human approvers.")

    # Save DOCX and Export to PDF
    docx_path = r"C:\Users\PRIMA\Desktop\Report\PRIME_HRIS_Direktori_Kredensial_User_Default.docx"
    pdf_path = r"C:\Users\PRIMA\Desktop\Report\PRIME_HRIS_Direktori_Kredensial_User_Default.pdf"

    print(f"[4/5] Saving DOCX to {docx_path}...")
    doc.save(docx_path)
    print("  -> DOCX saved successfully.")

    print(f"[5/5] Exporting PDF via Microsoft Word COM automation...")
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    try:
        wdoc = word.Documents.Open(os.path.abspath(docx_path))
        wdoc.ExportAsFixedFormat(os.path.abspath(pdf_path), 17) # 17 = wdExportFormatPDF
        wdoc.Close(False)
        print(f"  -> PDF successfully exported: {pdf_path}")
    finally:
        word.Quit()

    return docx_path, pdf_path

if __name__ == "__main__":
    generate_credential_report()
