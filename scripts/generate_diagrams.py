"""
PRIME HRIS ENTERPRISE - DIAGRAM & FLOWCHART GENERATOR
Menghasilkan diagram alur visual beresolusi tinggi (300 DPI) untuk disisipkan ke berkas Word DOCX
"""

import os
from PIL import Image, ImageDraw, ImageFont

DIAGRAM_DIR = r"C:\Users\prime\prime-hris\docs\diagrams"
os.makedirs(DIAGRAM_DIR, exist_ok=True)

FONT_REG = r"C:\Windows\Fonts\segoeui.ttf"
FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"

def get_fonts(title_sz=20, body_sz=14, small_sz=12):
    f_title = ImageFont.truetype(FONT_BOLD, title_sz) if os.path.exists(FONT_BOLD) else ImageFont.load_default()
    f_body = ImageFont.truetype(FONT_REG, body_sz) if os.path.exists(FONT_REG) else ImageFont.load_default()
    f_bold = ImageFont.truetype(FONT_BOLD, body_sz) if os.path.exists(FONT_BOLD) else ImageFont.load_default()
    f_small = ImageFont.truetype(FONT_REG, small_sz) if os.path.exists(FONT_REG) else ImageFont.load_default()
    return f_title, f_body, f_bold, f_small

def draw_arrow_down(draw, x, y_start, y_end, color=(100, 116, 139), width=3):
    draw.line([(x, y_start), (x, y_end)], fill=color, width=width)
    # Arrow head
    draw.polygon([(x - 8, y_end - 10), (x + 8, y_end - 10), (x, y_end)], fill=color)

def draw_rounded_box(draw, xy, fill, outline, width=2, radius=12):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def generate_diagram_1_lineage():
    """Diagram 1: Silsilah Keterkaitan Data End-to-End"""
    W, H = 1200, 850
    img = Image.new("RGB", (W, H), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    f_title, f_body, f_bold, f_small = get_fonts(22, 14, 12)

    # Header banner
    draw_rounded_box(draw, (30, 20, W - 30, 80), fill=(24, 52, 94), outline=(24, 52, 94))
    draw.text((50, 36), "DIAGRAM 1: PETA TOPOLOGI SILSILAH KETERKAITAN DATA (DATA LINEAGE)", font=f_title, fill=(255, 255, 255))

    stages = [
        ("1. DATA MASTER HULU", (239, 246, 255), (59, 130, 246), [
            ("employees", "Master Karyawan: NIK, Gaji Pokok, Kuota Cuti, Biometrik 128D"),
            ("projects", "Master Proyek: Pagu Budget, Jam Kerja Site, Geofence GPS"),
            ("annual_work_calendar", "Kalender Kerja: Jendela Cut-Off 21-20, Libur Nasional"),
            ("salary_rules", "Master Aturan: BPJS, PPh 21 TER, Lembur Depnaker")
        ]),
        ("2. TRANSAKSI OPERASIONAL HARIAN", (254, 243, 199), (217, 119, 6), [
            ("attendances", "Absensi Harian: Foto Selfie, GPS, Jam Masuk/Keluar, Late Minutes"),
            ("approvals", "Tiket Workflow: Cuti, Sakit, Dispensasi Telat, Dinas Luar"),
            ("casual_workers", "Pekerja Lepas: Foto Presensi Mandor/Tukang oleh PM Site")
        ]),
        ("3. ENGINE PENGOLAHAN & VALIDASI OTOMATIS", (243, 232, 255), (147, 51, 234), [
            ("Validasi Geofence & AI", "Hitung jarak Haversine <= 100m & Match Vektor Wajah >= 90%"),
            ("Sinkronisasi Kuota SDM", "Tiket approved otomatis kurangi usedLeave & update absensi"),
            ("Kalkulator Penggajian", "src/utils/payrollCalculator.ts (Lembur, BPJS, PPh 21 TER)")
        ]),
        ("4. OUTPUT HILIR & DISTRIBUSI", (236, 253, 245), (16, 185, 129), [
            ("Slip Gaji Digital", "Take Home Pay Bersih & Cetak Dokumen PDF Resmi"),
            ("Alokasi Biaya Proyek", "Burn Rate Kontrol Pagu Budget (Actual Labor Cost)"),
            ("WhatsApp Bot Dispatch", "Kirim Rincian Slip Gaji Langsung ke Nomor Ponsel Staf"),
            ("audit_logs", "Rekaman Jejak Kriptografis Permanen Tanpa Mutasi Manual")
        ])
    ]

    box_w = 260
    spacing = 30
    x_offset = 40
    y_top = 110
    box_h = 680

    for idx, (st_name, bg_col, bdr_col, items) in enumerate(stages):
        bx1 = x_offset + idx * (box_w + spacing)
        bx2 = bx1 + box_w
        draw_rounded_box(draw, (bx1, y_top, bx2, y_top + box_h), fill=bg_col, outline=bdr_col, width=2)
        
        # Stage title
        draw_rounded_box(draw, (bx1 + 10, y_top + 10, bx2 - 10, y_top + 50), fill=bdr_col, outline=bdr_col)
        draw.text((bx1 + 16, y_top + 20), st_name, font=f_bold, fill=(255, 255, 255))

        # Items
        cur_y = y_top + 70
        for title, desc in items:
            draw_rounded_box(draw, (bx1 + 10, cur_y, bx2 - 10, cur_y + 115), fill=(255, 255, 255), outline=(203, 213, 225), width=1)
            draw.text((bx1 + 18, cur_y + 10), f"• {title}", font=f_bold, fill=(24, 52, 94))
            
            # Simple text wrap for description
            words = desc.split(" ")
            line1, line2, line3 = "", "", ""
            for w in words:
                if len(line1) + len(w) < 28:
                    line1 += w + " "
                elif len(line2) + len(w) < 28:
                    line2 += w + " "
                else:
                    line3 += w + " "
            draw.text((bx1 + 18, cur_y + 36), line1.strip(), font=f_small, fill=(51, 65, 85))
            if line2: draw.text((bx1 + 18, cur_y + 56), line2.strip(), font=f_small, fill=(51, 65, 85))
            if line3: draw.text((bx1 + 18, cur_y + 76), line3.strip(), font=f_small, fill=(51, 65, 85))
            
            cur_y += 135

        # Horizontal connecting arrow to next stage
        if idx < len(stages) - 1:
            ax = bx2
            ay = y_top + box_h // 2
            draw.line([(ax, ay), (ax + spacing, ay)], fill=(100, 116, 139), width=3)
            draw.polygon([(ax + spacing, ay), (ax + spacing - 8, ay - 6), (ax + spacing - 8, ay + 6)], fill=(100, 116, 139))

    out_path = os.path.join(DIAGRAM_DIR, "diagram_1_data_lineage.png")
    img.save(out_path)
    print(f"[OK] Generated Diagram 1: {out_path}")
    return out_path

def generate_diagram_2_rbac():
    """Diagram 2: Arsitektur Otorisasi RBAC 5-Tier"""
    W, H = 1200, 750
    img = Image.new("RGB", (W, H), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    f_title, f_body, f_bold, f_small = get_fonts(22, 14, 12)

    # Header
    draw_rounded_box(draw, (30, 20, W - 30, 80), fill=(24, 52, 94), outline=(24, 52, 94))
    draw.text((50, 36), "DIAGRAM 2: ARSITEKTUR HIRARKI & HAK AKSES SISTEM RBAC 5-TIER", font=f_title, fill=(255, 255, 255))

    roles = [
        ("TIER 5: SUPERUSER / DIREKSI", "Otoritas Penuh Tanpa Batas (Bypass, Master Geofence, Salary Rules, WA Pairing, Root Audit)", (24, 52, 94), (255, 255, 255)),
        ("TIER 4: FINANCE & PAYROLL", "Otoritas Finansial (Payroll Engine, Timesheet Audit, Transfer Bank, Invoice, Labor Cost)", (40, 60, 90), (255, 255, 255)),
        ("TIER 3: HR / ADMIN SDM", "Otoritas Personalia (Master Karyawan, Biometrik AI 128D, Approval Final Cuti, Kalender 1 Thn)", (30, 80, 140), (255, 255, 255)),
        ("TIER 2: PROJECT MANAGER (SITE LEAD)", "Otoritas Operasional Lapangan (Presensi Tukang Lepas, First-Line Review Tiket Proyek, Burn Rate)", (255, 107, 0), (255, 255, 255)),
        ("TIER 1: STAFF (KARYAWAN & TEKNISI)", "Otoritas Mandiri Pribadi (Portal Kinerja, Presensi Selfie Satelit GPS, Pengajuan Izin, Slip Gaji)", (71, 85, 105), (255, 255, 255))
    ]

    y_start = 120
    box_w = 1100
    box_h = 85
    spacing = 35

    for idx, (title, desc, bg, fg) in enumerate(roles):
        y1 = y_start + idx * (box_h + spacing)
        y2 = y1 + box_h
        draw_rounded_box(draw, (50, y1, 50 + box_w, y2), fill=bg, outline=(203, 213, 225), width=2)
        
        draw.text((80, y1 + 18), title, font=f_bold, fill=fg)
        draw.text((80, y1 + 46), desc, font=f_body, fill=(241, 245, 249))

        if idx < len(roles) - 1:
            draw_arrow_down(draw, 50 + box_w // 2, y2, y2 + spacing, color=(148, 163, 184), width=3)

    out_path = os.path.join(DIAGRAM_DIR, "diagram_2_rbac_5tier.png")
    img.save(out_path)
    print(f"[OK] Generated Diagram 2: {out_path}")
    return out_path

def generate_diagram_3_attendance():
    """Diagram 3: Alur Presensi Kamera Selfie GPS Satelit Mandiri"""
    W, H = 1200, 850
    img = Image.new("RGB", (W, H), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    f_title, f_body, f_bold, f_small = get_fonts(22, 14, 12)

    # Header
    draw_rounded_box(draw, (30, 20, W - 30, 80), fill=(24, 52, 94), outline=(24, 52, 94))
    draw.text((50, 36), "DIAGRAM 3: ALUR PRESENSI KAMERA SELFIE SATELIT GPS & BIOMETRIK AI", font=f_title, fill=(255, 255, 255))

    steps = [
        ("LANGKAH 1: AKSES MENU PRESENSI", "Karyawan membuka menu 'Presensi Kamera Saya'. Browser meminta izin Kamera dan Lokasi Satelit GPS.", (239, 246, 255), (59, 130, 246)),
        ("LANGKAH 2: VALIDASI GEOFENCE SATELIT GPS", "Sistem menghitung jarak Haversine ke lokasi kantor/proyek. Jarak <= 100m = Radar HIJAU. Di luar radius = KUNING/MERAH (Wajib Mode Dinas Luar).", (254, 243, 199), (217, 119, 6)),
        ("LANGKAH 3: VERIFIKASI BIOMETRIK WAJAH AI", "Karyawan menghadapkan wajah ke lingkaran oval panduan. Algoritma FaceNet AI mencocokkan vektor 128D dengan skor >= 90%.", (243, 232, 255), (147, 51, 234)),
        ("LANGKAH 4: KLIK 'CHECK IN SEKARANG'", "Sistem merekam jam masuk riil, snapshot foto selfie, koordinat satelit, dan status (ON_TIME jika <= 08:15, LATE jika > 08:15).", (236, 253, 245), (16, 185, 129)),
        ("LANGKAH 5: NOTIFIKASI BOT WHATSAPP & SORE CHECK OUT", "Bot WhatsApp mengirim pesan bukti konfirmasi jam masuk ke nomor karyawan. Sore hari, karyawan menekan 'CHECK OUT SEKARANG'.", (241, 245, 249), (71, 85, 105))
    ]

    y_start = 110
    box_w = 1100
    box_h = 100
    spacing = 40

    for idx, (title, desc, bg, bdr) in enumerate(steps):
        y1 = y_start + idx * (box_h + spacing)
        y2 = y1 + box_h
        draw_rounded_box(draw, (50, y1, 50 + box_w, y2), fill=bg, outline=bdr, width=2)
        
        draw.text((80, y1 + 18), title, font=f_bold, fill=(24, 52, 94))
        draw.text((80, y1 + 50), desc, font=f_body, fill=(34, 38, 42))

        if idx < len(steps) - 1:
            draw_arrow_down(draw, 50 + box_w // 2, y2, y2 + spacing, color=(100, 116, 139), width=3)

    out_path = os.path.join(DIAGRAM_DIR, "diagram_3_attendance_selfie_gps.png")
    img.save(out_path)
    print(f"[OK] Generated Diagram 3: {out_path}")
    return out_path

def generate_diagram_4_approval():
    """Diagram 4: Alur Pengajuan Tiket & Persetujuan Berjenjang"""
    W, H = 1200, 750
    img = Image.new("RGB", (W, H), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    f_title, f_body, f_bold, f_small = get_fonts(22, 14, 12)

    # Header
    draw_rounded_box(draw, (30, 20, W - 30, 80), fill=(24, 52, 94), outline=(24, 52, 94))
    draw.text((50, 36), "DIAGRAM 4: ALUR WORKFLOW PENGAJUAN TIKET & PERSETUJUAN BERJENJANG", font=f_title, fill=(255, 255, 255))

    steps = [
        ("TAHAP 1: INPUT FORMULIR PERMOHONAN", "Karyawan membuka menu 'Pengajuan & Izin Saya' -> Memilih kategori (Cuti Tahunan, Roster, Sakit, Dispensasi Telat) -> Sistem hitung hari kerja bersih.", (239, 246, 255), (59, 130, 246)),
        ("TAHAP 2: REVIEW ANGGOTA PROYEK OLEH PROJECT MANAGER (PM)", "Jika pemohon ditugaskan di proyek site, tiket masuk antrean PM. PM memvalidasi jadwal milestone proyek dan memberi rekomendasi 'Setuju' / 'Tolak'.", (254, 243, 199), (217, 119, 6)),
        ("TAHAP 3: KEPUTUSAN FINAL OLEH HR MANAGER", "HR Manager membuka menu 'Pusat Approval SDM' -> Memeriksa riwayat sisa kuota cuti -> Klik tombol hijau 'SETUJUI (APPROVE)' atau tombol merah 'TOLAK'.", (243, 232, 255), (147, 51, 234)),
        ("TAHAP 4: SINKRONISASI OTOMATIS & NOTIFIKASI WHATSAPP", "Tiket Approved seketika memotong leaveQuota di tabel employees, mengubah status absensi di attendances menjadi LEAVE, dan bot WA kirim konfirmasi sukses.", (236, 253, 245), (16, 185, 129))
    ]

    y_start = 120
    box_w = 1100
    box_h = 105
    spacing = 45

    for idx, (title, desc, bg, bdr) in enumerate(steps):
        y1 = y_start + idx * (box_h + spacing)
        y2 = y1 + box_h
        draw_rounded_box(draw, (50, y1, 50 + box_w, y2), fill=bg, outline=bdr, width=2)
        
        draw.text((80, y1 + 20), title, font=f_bold, fill=(24, 52, 94))
        draw.text((80, y1 + 54), desc, font=f_body, fill=(34, 38, 42))

        if idx < len(steps) - 1:
            draw_arrow_down(draw, 50 + box_w // 2, y2, y2 + spacing, color=(100, 116, 139), width=3)

    out_path = os.path.join(DIAGRAM_DIR, "diagram_4_approval_workflow.png")
    img.save(out_path)
    print(f"[OK] Generated Diagram 4: {out_path}")
    return out_path

def generate_diagram_5_payroll():
    """Diagram 5: Siklus Tutup Buku Penggajian Bulanan"""
    W, H = 1200, 750
    img = Image.new("RGB", (W, H), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    f_title, f_body, f_bold, f_small = get_fonts(22, 14, 12)

    # Header
    draw_rounded_box(draw, (30, 20, W - 30, 80), fill=(24, 52, 94), outline=(24, 52, 94))
    draw.text((50, 36), "DIAGRAM 5: ALUR SIKLUS TUTUP BUKU PENGGAJIAN BULANAN (PAYROLL CYCLE)", font=f_title, fill=(255, 255, 255))

    steps = [
        ("FASE 1: PENUTUPAN PERIODE CUT-OFF (TGL 21 BULAN BERJALAN)", "Sistem kalender kerja (annual_work_calendar) mengunci batas presensi cut-off: 21 bulan lalu s/d 20 bulan berjalan. Seluruh tiket lembur harus sudah di-approve.", (239, 246, 255), (59, 130, 246)),
        ("FASE 2: EKSEKUSI MESIN KALKULASI PAYROLL OTOMATIS", "Finance klik 'Jalankan Kalkulasi Payroll'. Sistem menghitung Gaji Pokok + Tunjangan Hadir Riil + Lembur Depnaker - Potongan Telat - BPJS - PPh 21 TER.", (254, 243, 199), (217, 119, 6)),
        ("FASE 3: AUDIT LEMBAR KERJA & DETAIL TIMESHEET MODAL", "Finance memeriksa selisih jam kerja, melihat foto selfie presensi, melakukan koreksi jam jika ada perselisihan, dan mengunci (finalize) perhitungan gaji.", (243, 232, 255), (147, 51, 234)),
        ("FASE 4: EKSPOR TRANSFER BANK & DISTRIBUSI SLIP WHATSAPP (TGL 25)", "Finance klik 'Export CSV Batch Transfer Bank' untuk upload ke perbankan korporat, lalu klik 'Kirim Semua Slip Gaji via WhatsApp' untuk kirim slip otomatis.", (236, 253, 245), (16, 185, 129))
    ]

    y_start = 120
    box_w = 1100
    box_h = 105
    spacing = 45

    for idx, (title, desc, bg, bdr) in enumerate(steps):
        y1 = y_start + idx * (box_h + spacing)
        y2 = y1 + box_h
        draw_rounded_box(draw, (50, y1, 50 + box_w, y2), fill=bg, outline=bdr, width=2)
        
        draw.text((80, y1 + 20), title, font=f_bold, fill=(24, 52, 94))
        draw.text((80, y1 + 54), desc, font=f_body, fill=(34, 38, 42))

        if idx < len(steps) - 1:
            draw_arrow_down(draw, 50 + box_w // 2, y2, y2 + spacing, color=(100, 116, 139), width=3)

    out_path = os.path.join(DIAGRAM_DIR, "diagram_5_payroll_cycle.png")
    img.save(out_path)
    print(f"[OK] Generated Diagram 5: {out_path}")
    return out_path

if __name__ == "__main__":
    generate_diagram_1_lineage()
    generate_diagram_2_rbac()
    generate_diagram_3_attendance()
    generate_diagram_4_approval()
    generate_diagram_5_payroll()
    print("[SUCCESS] All 5 high-res flowchart diagrams generated successfully!")
