import docx
import os
import subprocess

doc_path = r'C:\Users\PRIMA\Desktop\Report\Laporan_Analisis_Biometrik_Wajah_HRIS_POCO.docx'
doc = docx.Document(doc_path)

# Table 4: Daftar Karyawan Terdaftar Biometrik
table4 = doc.tables[4]
print(f"Table 4 currently has {len(table4.rows)} rows.")

# Check if EMP-161 is already in Table 4
has_emp161 = any('EMP-161' in row.cells[0].text for row in table4.rows)
if not has_emp161:
    new_row = table4.add_row()
    values = [
        'EMP-161',
        '3316092701970001',
        'WILDAN RAMDANI AHMAD',
        '4 Pose (Front, Right, Left, Smile)',
        'ACTIVE (Staff)'
    ]
    for c_idx, val in enumerate(values):
        cell = new_row.cells[c_idx]
        cell.text = val
        # Format paragraph & font
        p = cell.paragraphs[0]
        p.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.LEFT
        for run in p.runs:
            run.font.name = 'Segoe UI'
            run.font.size = docx.shared.Pt(9)
            if c_idx == 0:
                run.bold = True
                run.font.color.rgb = docx.shared.RGBColor(24, 52, 94) # Navy
            elif c_idx == 4:
                run.bold = True
                run.font.color.rgb = docx.shared.RGBColor(16, 149, 106) # Green
    print("Added EMP-161 to Table 4!")
else:
    print("EMP-161 already present in Table 4.")

# Also add recent audit telemetry to Table 5
table5 = doc.tables[5]
has_wildan_audit = any('WILDAN' in row.cells[2].text for row in table5.rows)
if not has_wildan_audit:
    audit_row = table5.add_row()
    audit_vals = [
        '2026-10-21 07:44:04',
        'BIOMETRIC_ENROLLED',
        'WILDAN RAMDANI AHMAD',
        'Pendaftaran biometrik wajah 4 pose master (98.5% Quality) berhasil disinkronkan ke SQLite.'
    ]
    for c_idx, val in enumerate(audit_vals):
        cell = audit_row.cells[c_idx]
        cell.text = val
        p = cell.paragraphs[0]
        for run in p.runs:
            run.font.name = 'Segoe UI'
            run.font.size = docx.shared.Pt(8.5)
            if c_idx == 1:
                run.bold = True
                run.font.color.rgb = docx.shared.RGBColor(30, 80, 140)
    print("Added Wildan audit record to Table 5!")

doc.save(doc_path)
print("Saved updated DOCX successfully!")
