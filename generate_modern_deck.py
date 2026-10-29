import sys
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# Initialize Presentation (16:9 Widescreen)
prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# Color Palette (Matching "Quotation MS Garment.pdf" + Integrated Design & Construction Theme)
BG_LIGHT = RGBColor(248, 250, 252)     # #F8FAFC (Ultra Clean Light Gray/White Canvas)
CARD_BG = RGBColor(255, 255, 255)      # #FFFFFF (Pure White Card)
CARD_BORDER = RGBColor(226, 232, 240)  # #E2E8F0 (Crisp Light Slate Border)
CARD_BORDER_BLUE = RGBColor(191, 219, 254) # #BFDBFE

BLUE_PRIMARY = RGBColor(13, 82, 216)   # #0D52D8 (Royal Tech Blue)
BLUE_DARK = RGBColor(15, 23, 42)       # #0F172A (Deep Charcoal Navy Text)
BLUE_NAVY = RGBColor(10, 25, 47)       # #0A192F (Footer Deep Navy)
BLUE_PALE = RGBColor(239, 246, 255)    # #EFF6FF (Badge Light Blue Fill)
BLUE_ACCENT = RGBColor(37, 99, 235)    # #2563EB (Vibrant Electric Blue)

ORANGE_ACCENT = RGBColor(255, 107, 0)  # #FF6B00 (Industrial Safety Orange)
ORANGE_PALE = RGBColor(255, 247, 237)  # #FFF7ED (Badge Pale Orange)
ORANGE_BORDER = RGBColor(254, 215, 170)# #FED7AA

MINT_GREEN = RGBColor(16, 185, 129)    # #10B981 (Success Emerald)
MINT_PALE = RGBColor(236, 253, 245)    # #ECFDF5

PURPLE_ACCENT = RGBColor(124, 58, 237) # #7C3AED
PURPLE_PALE = RGBColor(245, 243, 255)  # #F5F3FF
PURPLE_BORDER = RGBColor(221, 214, 254)# #DDD6FE

CYAN_ACCENT = RGBColor(6, 182, 212)    # #06B6D4
CYAN_PALE = RGBColor(236, 254, 255)    # #ECFEFF

TEXT_DARK = RGBColor(15, 23, 42)       # #0F172A
TEXT_MUTED = RGBColor(71, 85, 105)     # #475569
TEXT_LIGHT = RGBColor(148, 163, 184)   # #94A3B8
SLATE_LIGHT = RGBColor(203, 213, 225)  # #CBD5E1
WHITE = RGBColor(255, 255, 255)

FONT_TITLE = "Segoe UI"
FONT_BODY = "Segoe UI"
FONT_CODE = "Consolas"

blank_slide_layout = prs.slide_layouts[6]

def apply_clean_background(slide):
    # Main Canvas Fill
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
    bg.fill.solid()
    bg.fill.fore_color.rgb = BG_LIGHT
    bg.line.color.rgb = BG_LIGHT
    
    # Top Subtle Brand Accent Line (Blue & Orange)
    top_line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(0.06))
    top_line.fill.solid()
    top_line.fill.fore_color.rgb = BLUE_PRIMARY
    top_line.line.color.rgb = BLUE_PRIMARY

def add_header_brand(slide):
    # Logo Icon Box (Geometric Rounded Hexagon / Rect)
    icon_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.35), Inches(0.55), Inches(0.55))
    icon_box.fill.solid()
    icon_box.fill.fore_color.rgb = BLUE_PRIMARY
    icon_box.line.color.rgb = BLUE_PRIMARY
    tf_i = icon_box.text_frame
    p_i = tf_i.paragraphs[0]
    p_i.alignment = PP_ALIGN.CENTER
    r_i = p_i.add_run()
    r_i.text = "DMJ"
    r_i.font.name = FONT_CODE
    r_i.font.size = Pt(10)
    r_i.font.bold = True
    r_i.font.color.rgb = WHITE
    
    # Title & Pill Tagline
    tb = slide.shapes.add_textbox(Inches(1.45), Inches(0.32), Inches(6.5), Inches(0.6))
    tf = tb.text_frame
    tf.margin_left = tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.text = "PRIME HRIS ENTERPRISE"
    p.font.name = FONT_TITLE
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = BLUE_DARK
    
    p2 = tf.add_paragraph()
    p2.text = "INTEGRATED DESIGN & CONSTRUCTION SOLUTIONS"
    p2.font.name = FONT_CODE
    p2.font.size = Pt(8)
    p2.font.bold = True
    p2.font.color.rgb = BLUE_PRIMARY

def add_footer_banner(slide, current_slide, total_slides=7):
    # Bottom Dark Navy Banner
    banner = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, Inches(6.6), Inches(13.333), Inches(0.9))
    banner.fill.solid()
    banner.fill.fore_color.rgb = BLUE_NAVY
    banner.line.color.rgb = BLUE_NAVY
    
    # Left Developer Pill
    pill_dev = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.6), Inches(6.75), Inches(2.7), Inches(0.6))
    pill_dev.fill.solid()
    pill_dev.fill.fore_color.rgb = WHITE
    pill_dev.line.color.rgb = WHITE
    tf_d = pill_dev.text_frame
    p_d1 = tf_d.paragraphs[0]
    p_d1.text = "DIKEMBANGKAN OLEH"
    p_d1.font.name = FONT_CODE
    p_d1.font.size = Pt(7.5)
    p_d1.font.bold = True
    p_d1.font.color.rgb = BLUE_PRIMARY
    
    p_d2 = tf_d.add_paragraph()
    p_d2.text = "Prime ProjectX (PT Prime Infinity Systems)"
    p_d2.font.name = FONT_BODY
    p_d2.font.size = Pt(8.5)
    p_d2.font.bold = True
    p_d2.font.color.rgb = BLUE_DARK
    
    # Center Trust Items
    trust_items = [
        ("Profesional", "Tim berpengalaman sistem industri"),
        ("Terpercaya", "Solusi kustom PT Dwi Martha Jaya"),
        ("Dukungan Penuh", "SLA 99.9% & Pendampingan Go-Live")
    ]
    for i, (t_title, t_sub) in enumerate(trust_items):
        x = 3.5 + i * 2.25
        tb_t = slide.shapes.add_textbox(Inches(x), Inches(6.72), Inches(2.2), Inches(0.65))
        tf_t = tb_t.text_frame
        tf_t.margin_left = tf_t.margin_top = 0
        pt1 = tf_t.paragraphs[0]
        pt1.text = "✔ " + t_title
        pt1.font.name = FONT_BODY
        pt1.font.size = Pt(9.5)
        pt1.font.bold = True
        pt1.font.color.rgb = WHITE
        
        pt2 = tf_t.add_paragraph()
        pt2.text = t_sub
        pt2.font.name = FONT_BODY
        pt2.font.size = Pt(7.5)
        pt2.font.color.rgb = SLATE_LIGHT
        
    # Right Contact Box (WhatsApp & Web)
    pill_ct = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.4), Inches(6.7), Inches(2.3), Inches(0.7))
    pill_ct.fill.solid()
    pill_ct.fill.fore_color.rgb = RGBColor(15, 23, 42)
    pill_ct.line.color.rgb = MINT_GREEN
    pill_ct.line.width = Pt(1)
    tf_c = pill_ct.text_frame
    tf_c.margin_top = Inches(0.06)
    pc1 = tf_c.paragraphs[0]
    pc1.alignment = PP_ALIGN.CENTER
    pc1.text = "HUBUNGI KAMI (WHATSAPP)"
    pc1.font.name = FONT_CODE
    pc1.font.size = Pt(7)
    pc1.font.bold = True
    pc1.font.color.rgb = MINT_GREEN
    
    pc2 = tf_c.add_paragraph()
    pc2.alignment = PP_ALIGN.CENTER
    pc2.text = "+62 895 2425 7778"
    pc2.font.name = FONT_BODY
    pc2.font.size = Pt(11)
    pc2.font.bold = True
    pc2.font.color.rgb = WHITE

def add_slide_heading(slide, title_text, subtitle_text=""):
    tb = slide.shapes.add_textbox(Inches(1.0), Inches(1.05), Inches(11.333), Inches(0.95))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = title_text
    p.font.name = FONT_TITLE
    p.font.size = Pt(24)
    p.font.bold = True
    p.font.color.rgb = BLUE_DARK
    
    # Decorative Dots
    p_dots = tf.add_paragraph()
    p_dots.alignment = PP_ALIGN.CENTER
    p_dots.text = "• ──────── • ──────── •"
    p_dots.font.name = FONT_CODE
    p_dots.font.size = Pt(9)
    p_dots.font.bold = True
    p_dots.font.color.rgb = BLUE_PRIMARY
    
    if subtitle_text:
        p_sub = tf.add_paragraph()
        p_sub.alignment = PP_ALIGN.CENTER
        p_sub.space_before = Pt(2)
        p_sub.text = subtitle_text
        p_sub.font.name = FONT_BODY
        p_sub.font.size = Pt(11)
        p_sub.font.color.rgb = TEXT_MUTED

def create_card(slide, x, y, w, h, border_color=CARD_BORDER, bg_color=CARD_BG):
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    card.fill.solid()
    card.fill.fore_color.rgb = bg_color
    card.line.color.rgb = border_color
    card.line.width = Pt(1.2)
    return card

# ==============================================================================
# SLIDE 1: COVER / HERO SLIDE
# ==============================================================================
s1 = prs.slides.add_slide(blank_slide_layout)
apply_clean_background(s1)
add_header_brand(s1)
add_footer_banner(s1, 1, 7)

# Left Hero Section
tb_hero = s1.shapes.add_textbox(Inches(0.8), Inches(1.15), Inches(6.6), Inches(2.2))
tf_h = tb_hero.text_frame
tf_h.word_wrap = True

p_pill = tf_h.paragraphs[0]
p_pill.text = "PROPOSAL & SAMPLE PROJECT PT DWI MARTHA JAYA"
p_pill.font.name = FONT_CODE
p_pill.font.size = Pt(9)
p_pill.font.bold = True
p_pill.font.color.rgb = ORANGE_ACCENT

p_title = tf_h.add_paragraph()
p_title.space_before = Pt(4)
p_title.text = "SISTEM ERP & HRIS TERINTEGRASI UNTUK INDUSTRI DESIGN & KONSTRUKSI"
p_title.font.name = FONT_TITLE
p_title.font.size = Pt(26)
p_title.font.bold = True
p_title.font.color.rgb = BLUE_DARK

p_sub = tf_h.add_paragraph()
p_sub.space_before = Pt(8)
p_sub.text = "Kelola seluruh proses operasional engineering, presensi kamera geotag, tim workshop fabrikasi, alokasi biaya upah per kontrak SPK, dan payroll Depnaker secara real-time."
p_sub.font.name = FONT_BODY
p_sub.font.size = Pt(11)
p_sub.font.color.rgb = TEXT_MUTED

# 5 Core Module Cards (Horizontal Row)
modules_s1 = [
    ("PRESENSI GEOTAG", "Selfie webcam + watermark NIK, GPS & waktu WIB."),
    ("GEOFENCE MULTI-SITE", "Validasi radius presisi kantor & site anti titip absen."),
    ("PROJECT COSTING", "Alokasi biaya upah langsung per kontrak SPK."),
    ("PAYROLL DEPNAKER", "Formula lembur 1/173 & slip resmi ber-QR Code."),
    ("APPROVAL HUB", "Disposisi satu pintu cuti, lembur, & dinas luar.")
]

for i, (m_title, m_desc) in enumerate(modules_s1):
    x = 0.8 + i * 1.28
    c = create_card(s1, x, 3.55, 1.22, 1.85, border_color=CARD_BORDER_BLUE)
    
    # Number / Icon Box on top of card
    num_box = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x + 0.1), Inches(3.65), Inches(0.4), Inches(0.35))
    num_box.fill.solid()
    num_box.fill.fore_color.rgb = BLUE_PRIMARY
    num_box.line.color.rgb = BLUE_PRIMARY
    tf_nb = num_box.text_frame
    p_nb = tf_nb.paragraphs[0]
    p_nb.alignment = PP_ALIGN.CENTER
    r_nb = p_nb.add_run()
    r_nb.text = f"0{i+1}"
    r_nb.font.name = FONT_CODE
    r_nb.font.size = Pt(8.5)
    r_nb.font.bold = True
    r_nb.font.color.rgb = WHITE
    
    tb_c = s1.shapes.add_textbox(Inches(x + 0.08), Inches(4.05), Inches(1.06), Inches(1.3))
    tf_c = tb_c.text_frame
    tf_c.word_wrap = True
    tf_c.margin_left = tf_c.margin_right = 0
    p1 = tf_c.paragraphs[0]
    p1.text = m_title
    p1.font.name = FONT_TITLE
    p1.font.size = Pt(8)
    p1.font.bold = True
    p1.font.color.rgb = BLUE_DARK
    
    p2 = tf_c.add_paragraph()
    p2.space_before = Pt(3)
    p2.text = m_desc
    p2.font.name = FONT_BODY
    p2.font.size = Pt(7)
    p2.font.color.rgb = TEXT_MUTED

# 4 Key Value Pillars (Bottom of Left Column)
val_card = create_card(s1, 0.8, 5.55, 6.34, 0.85, border_color=CARD_BORDER, bg_color=CARD_BG)
values_s1 = [
    ("Data Akurat", "Keputusan cepat berbasis data lapangan"),
    ("Efisiensi 90%", "Pangkas rekap bulanan jadi instan"),
    ("Kontrol Biaya", "Cegah pembengkakan upah lembur"),
    ("Bisnis Bertumbuh", "Sistem siap skala multi-proyek")
]
for i, (vt, vd) in enumerate(values_s1):
    x = 0.95 + i * 1.55
    tb_v = s1.shapes.add_textbox(Inches(x), Inches(5.62), Inches(1.5), Inches(0.7))
    tf_v = tb_v.text_frame
    tf_v.word_wrap = True
    p1 = tf_v.paragraphs[0]
    p1.text = "✔ " + vt
    p1.font.name = FONT_BODY
    p1.font.size = Pt(8.5)
    p1.font.bold = True
    p1.font.color.rgb = BLUE_PRIMARY
    
    p2 = tf_v.add_paragraph()
    p2.text = vd
    p2.font.name = FONT_BODY
    p2.font.size = Pt(7)
    p2.font.color.rgb = TEXT_MUTED

# Right Side: Modern High-Tech Mockup Frame
mock_card = create_card(s1, 7.35, 1.25, 5.2, 5.15, border_color=BLUE_PRIMARY, bg_color=WHITE)

# Mockup Top Browser/Laptop Header Bar
mock_bar = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(7.35), Inches(1.25), Inches(5.2), Inches(0.42))
mock_bar.fill.solid()
mock_bar.fill.fore_color.rgb = BLUE_DARK
mock_bar.line.color.rgb = BLUE_DARK
tf_mb = mock_bar.text_frame
p_mb = tf_mb.paragraphs[0]
p_mb.text = "  ● ● ●  https://dmj.primeprojectx.net — Prime HRIS Live Portal"
p_mb.font.name = FONT_CODE
p_mb.font.size = Pt(8)
p_mb.font.color.rgb = SLATE_LIGHT

# Inner Content of Mockup (Dashboard KPI Simulation)
tb_mock = s1.shapes.add_textbox(Inches(7.55), Inches(1.75), Inches(4.8), Inches(4.5))
tf_mc = tb_mock.text_frame
tf_mc.word_wrap = True

p_m1 = tf_mc.paragraphs[0]
p_m1.text = "DASHBOARD MONITORING OPERASIONAL DMJ"
p_m1.font.name = FONT_TITLE
p_m1.font.size = Pt(11)
p_m1.font.bold = True
p_m1.font.color.rgb = BLUE_DARK

p_m2 = tf_mc.add_paragraph()
p_m2.text = "Proyek Berjalan: Smelter Manyar JIIPE | Sorowako SAG Mill | Workshop Fabrikasi"
p_m2.font.name = FONT_BODY
p_m2.font.size = Pt(8)
p_m2.font.color.rgb = TEXT_MUTED

# 3 Metric Mini Cards inside Mockup
inner_metrics = [
    ("TOTAL KARYAWAN", "48 Personil", "38 Lapangan • 10 Kantor", BLUE_PRIMARY),
    ("DISIPLIN TEPAT WAKTU", "94.2%", "Batas Cutoff 08:30 WIB", MINT_GREEN),
    ("REALISASI LEMBUR", "Rp 17.370.000", "Formula Baku 1/173 RI", ORANGE_ACCENT)
]
for j, (im_t, im_val, im_sub, im_c) in enumerate(inner_metrics):
    y_m = 2.45 + j * 1.15
    mc_i = create_card(s1, 7.55, y_m, 4.8, 0.98, border_color=CARD_BORDER, bg_color=BG_LIGHT)
    tb_mi = s1.shapes.add_textbox(Inches(7.7), Inches(y_m + 0.1), Inches(4.5), Inches(0.8))
    tf_mi = tb_mi.text_frame
    p1 = tf_mi.paragraphs[0]
    p1.text = im_t
    p1.font.name = FONT_CODE
    p1.font.size = Pt(8)
    p1.font.bold = True
    p1.font.color.rgb = im_c
    
    p2 = tf_mi.add_paragraph()
    p2.text = im_val
    p2.font.name = FONT_TITLE
    p2.font.size = Pt(14)
    p2.font.bold = True
    p2.font.color.rgb = BLUE_DARK
    
    p3 = tf_mi.add_paragraph()
    p3.text = im_sub
    p3.font.name = FONT_BODY
    p3.font.size = Pt(7.5)
    p3.font.color.rgb = TEXT_MUTED

# ==============================================================================
# SLIDE 2: OVERVIEW SISTEM & ALUR KERJA LENGKAP
# ==============================================================================
s2 = prs.slides.add_slide(blank_slide_layout)
apply_clean_background(s2)
add_header_brand(s2)
add_footer_banner(s2, 2, 7)
add_slide_heading(s2, "OVERVIEW SISTEM & RUANG LINGKUP",
                  "Satu platform terintegrasi untuk mengelola seluruh siklus operasional kontraktor design & konstruksi secara efisien dan transparan")

# Top Card: "APA ITU PRIME HRIS ENTERPRISE?"
c_top = create_card(s2, 0.8, 2.05, 11.733, 1.4, border_color=CARD_BORDER_BLUE, bg_color=CARD_BG)
tb_top = s2.shapes.add_textbox(Inches(1.05), Inches(2.15), Inches(11.2), Inches(1.2))
tf_t = tb_top.text_frame
tf_t.word_wrap = True

p = tf_t.paragraphs[0]
p.text = "APA ITU PRIME HRIS ENTERPRISE KONTRAKTOR INDUSTRI?"
p.font.name = FONT_CODE
p.font.size = Pt(11)
p.font.bold = True
p.font.color.rgb = BLUE_PRIMARY

p_desc = tf_t.add_paragraph()
p_desc.space_before = Pt(4)
p_desc.text = "Prime HRIS Enterprise adalah sistem Enterprise Resource Planning & Human Resource Information System terpadu yang dirancang khusus untuk PT Dwi Martha Jaya. Sistem mengintegrasikan seluruh rantai proses bisnis kontraktor: mulai dari penugasan engineering design, presensi kamera selfie ber-watermark permanen, penguncian multi-site GPS geofence, akuntansi biaya upah tenaga kerja langsung per proyek konstruksi (Project Cost Accounting), hingga kalkulasi otomatis lembur Depnaker dan pencetakan slip gaji digital ber-QR Code."
p_desc.font.name = FONT_BODY
p_desc.font.size = Pt(9.5)
p_desc.font.color.rgb = TEXT_MUTED

# 4 Key Features Box
four_box = [
    ("TERINTEGRASI PENUH", "Seluruh departemen engineering, workshop fabrikasi, dan site lapangan terhubung dalam satu database."),
    ("EFISIENSI WAKTU & BIAYA", "Otomatisasi 100% proses rekap absensi harian dan perhitungan upah lembur tanpa excel manual."),
    ("AKURAT & REAL-TIME", "Stempel watermark digital NIK, Nama, GPS, dan waktu detik memastikan validitas bukti presensi."),
    ("TRANSPARAN & TERKONTROL", "Setiap rupiah biaya upah dialokasikan langsung ke akun proyek untuk evaluasi laba/rugi kontrak.")
]

for i, (b_title, b_desc) in enumerate(four_box):
    x = 0.8 + i * 2.98
    create_card(s2, x, 3.6, 2.8, 1.15, border_color=CARD_BORDER)
    tb_b = s2.shapes.add_textbox(Inches(x + 0.15), Inches(3.7), Inches(2.5), Inches(0.95))
    tf_b = tb_b.text_frame
    tf_b.word_wrap = True
    p1 = tf_b.paragraphs[0]
    p1.text = "✔ " + b_title
    p1.font.name = FONT_CODE
    p1.font.size = Pt(9)
    p1.font.bold = True
    p1.font.color.rgb = BLUE_PRIMARY
    
    p2 = tf_b.add_paragraph()
    p2.space_before = Pt(2)
    p2.text = b_desc
    p2.font.name = FONT_BODY
    p2.font.size = Pt(8)
    p2.font.color.rgb = TEXT_MUTED

# Middle Flow: "SOLUSI ALUR KERJA TERINTEGRASI UNTUK BISNIS ANDA"
flow_card = create_card(s2, 0.8, 4.95, 11.733, 1.45, border_color=ORANGE_BORDER, bg_color=CARD_BG)
tb_fl = s2.shapes.add_textbox(Inches(1.0), Inches(5.02), Inches(11.3), Inches(1.3))
tf_fl = tb_fl.text_frame
tf_fl.word_wrap = True

p_fl = tf_fl.paragraphs[0]
p_fl.text = "SOLUSI ALUR KERJA OPERASIONAL KONTRAKTOR DESIGN & KONSTRUKSI (7 TAHAPAN)"
p_fl.font.name = FONT_CODE
p_fl.font.size = Pt(10)
p_fl.font.bold = True
p_fl.font.color.rgb = ORANGE_ACCENT

steps_s2 = [
    "1. ENGINEERING & DESIGN",
    "2. FABRIKASI WORKSHOP",
    "3. SITE ERECTION / PIPING",
    "4. PRESENSI KAMERA GEOTAG",
    "5. ALOKASI BIAYA PROYEK",
    "6. PAYROLL DEPNAKER 1/173",
    "7. SLIP RESMI & QR CODE"
]

for i, st in enumerate(steps_s2):
    x_s = 1.0 + i * 1.62
    s_box = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x_s), Inches(5.35), Inches(1.5), Inches(0.85))
    s_box.fill.solid()
    s_box.fill.fore_color.rgb = BLUE_PALE if i < 6 else ORANGE_PALE
    s_box.line.color.rgb = BLUE_PRIMARY if i < 6 else ORANGE_ACCENT
    s_box.line.width = Pt(1)
    tf_sb = s_box.text_frame
    tf_sb.margin_left = tf_sb.margin_right = Inches(0.05)
    p_s1 = tf_sb.paragraphs[0]
    p_s1.alignment = PP_ALIGN.CENTER
    p_s1.text = st
    p_s1.font.name = FONT_CODE
    p_s1.font.size = Pt(7.5)
    p_s1.font.bold = True
    p_s1.font.color.rgb = BLUE_DARK if i < 6 else ORANGE_ACCENT

# ==============================================================================
# SLIDE 3: TUJUAN PENGEMBANGAN APLIKASI (10 NUMBERED CARDS)
# ==============================================================================
s3 = prs.slides.add_slide(blank_slide_layout)
apply_clean_background(s3)
add_header_brand(s3)
add_footer_banner(s3, 3, 7)
add_slide_heading(s3, "TUJUAN PENGEMBANGAN APLIKASI",
                  "Membantu PT Dwi Martha Jaya dalam mengelola seluruh proses bisnis design, fabrikasi, dan konstruksi secara efisien dan akuntabel")

goals_s3 = [
    ("MENGINTEGRASIKAN SELURUH PROSES", "Menghubungkan tim engineering design, fabrikasi workshop, dan site konstruksi."),
    ("MEMPERMUDAH MONITORING PRESENSI", "Pemantauan kehadiran teknisi lapangan dan staf workshop secara real-time."),
    ("MENGONTROL BIAYA UPAH & LEMBUR", "Pencegahan pembengkakan biaya tenaga kerja langsung per nomor kontrak SPK."),
    ("MEMASTIKAN AKURASI WATERMARK FOTO", "Stempel digital NIK, Nama, GPS, dan waktu WIB permanen anti titip absen."),
    ("MENGELOLA DATABASE & AKSES AKUN", "Sentralisasi data SDM resmi, rekening payroll, dan hak akses bertingkat RBAC."),
    ("MENGURANGI KESALAHAN HITUNG LEMBUR", "Otomatisasi formula baku Menakertrans RI (1/173 upah sejam) bebas salah."),
    ("MEMPERMUDAH PENERBITAN SLIP GAJI", "Cetak slip resmi berlogo PT DMJ lengkap dengan QR Code verifikasi dokumen."),
    ("MENYEDIAKAN FORECASTING BIAYA (EAC)", "Peramalan total estimasi biaya hingga penyelesaian kontrak proyek."),
    ("SENTRALISASI DISPOSISI APPROVAL", "Satu pintu persetujuan cuti tahunan, izin sakit, lembur, dan dinas luar mendadak."),
    ("FLEKSIBILITAS DINAS LUAR MENDADAK", "Bypass terkendali saat teknisi dipanggil darurat ke site klien tanpa alpa salah.")
]

for i, (g_title, g_desc) in enumerate(goals_s3):
    row = i // 5
    col = i % 5
    x = 0.8 + col * 2.38
    y = 2.15 + row * 2.15
    
    card = create_card(s3, x, y, 2.25, 2.0, border_color=CARD_BORDER)
    
    # Blue Number Pill Badge
    num_badge = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x + 0.12), Inches(y + 0.12), Inches(0.48), Inches(0.32))
    num_badge.fill.solid()
    num_badge.fill.fore_color.rgb = BLUE_PRIMARY
    num_badge.line.color.rgb = BLUE_PRIMARY
    tf_nb = num_badge.text_frame
    p_nb = tf_nb.paragraphs[0]
    p_nb.alignment = PP_ALIGN.CENTER
    r_nb = p_nb.add_run()
    r_nb.text = f"{i+1:02d}"
    r_nb.font.name = FONT_CODE
    r_nb.font.size = Pt(9)
    r_nb.font.bold = True
    r_nb.font.color.rgb = WHITE
    
    tb_g = s3.shapes.add_textbox(Inches(x + 0.12), Inches(y + 0.52), Inches(2.0), Inches(1.35))
    tf_g = tb_g.text_frame
    tf_g.word_wrap = True
    tf_g.margin_left = tf_g.margin_right = 0
    p1 = tf_g.paragraphs[0]
    p1.text = g_title
    p1.font.name = FONT_TITLE
    p1.font.size = Pt(8.5)
    p1.font.bold = True
    p1.font.color.rgb = BLUE_DARK
    
    p2 = tf_g.add_paragraph()
    p2.space_before = Pt(3)
    p2.text = g_desc
    p2.font.name = FONT_BODY
    p2.font.size = Pt(7.5)
    p2.font.color.rgb = TEXT_MUTED

# ==============================================================================
# SLIDE 4: MANFAAT APLIKASI (8 BUSINESS IMPACT CARDS)
# ==============================================================================
s4 = prs.slides.add_slide(blank_slide_layout)
apply_clean_background(s4)
add_header_brand(s4)
add_footer_banner(s4, 4, 7)
add_slide_heading(s4, "MANFAAT APLIKASI & IMPACT BISNIS",
                  "Dirancang untuk memberikan kontrol penuh, efisiensi tinggi, dan pertumbuhan bisnis yang berkelanjutan bagi PT Dwi Martha Jaya")

impacts_s4 = [
    ("MONITORING PROYEK REAL-TIME", "Seluruh progres jam kerja teknisi di Smelter Manyar JIIPE maupun Workshop terpantau live."),
    ("TRACEABILITY & AUDIT TRAIL LENGKAP", "Setiap riwayat absensi tersimpan dengan bukti foto selfie dan koordinat satelit permanen."),
    ("KEPATUHAN REGULASI KEMENAKER", "Perhitungan upah lembur sesuai Kepmenakertrans RI, terhindar dari sanksi audit ketenagakerjaan."),
    ("PENCEGAHAN TITIP ABSEN & FAKE GPS", "Verifikasi berjenjang kamera + Multi-Site Geofence memastikan kehadiran fisik 100% sah."),
    ("EFISIENSI WAKTU REKAP (HEMAT 90%)", "Rekapitulasi gaji bulanan dari biasanya memakan 3 hari kerja kini selesai dalam beberapa detik."),
    ("DIGITALISASI DOKUMEN & SLIP BER-QR", "Slip gaji resmi diterbitkan secara otomatis dengan QR Code verifikasi dokumen perbankan."),
    ("EVALUASI LABA/RUGI PER KONTRAK SPK", "Transparansi alokasi biaya upah langsung per proyek memudahkan evaluasi profitabilitas riil."),
    ("FLEKSIBILITAS PENUGASAN SITE DARURAT", "Teknisi siap diterjunkan kapanpun dengan alur Dinas Luar Mendadak tanpa kendala absensi.")
]

for i, (im_title, im_desc) in enumerate(impacts_s4):
    row = i // 4
    col = i % 4
    x = 0.8 + col * 2.98
    y = 2.15 + row * 2.15
    
    card = create_card(s4, x, y, 2.8, 2.0, border_color=CARD_BORDER)
    
    # Pill Badge
    badge_i = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x + 0.15), Inches(y + 0.15), Inches(0.5), Inches(0.32))
    badge_i.fill.solid()
    badge_i.fill.fore_color.rgb = BLUE_PRIMARY
    badge_i.line.color.rgb = BLUE_PRIMARY
    tf_bi = badge_i.text_frame
    p_bi = tf_bi.paragraphs[0]
    p_bi.alignment = PP_ALIGN.CENTER
    r_bi = p_bi.add_run()
    r_bi.text = f"{i+1:02d}"
    r_bi.font.name = FONT_CODE
    r_bi.font.size = Pt(9)
    r_bi.font.bold = True
    r_bi.font.color.rgb = WHITE
    
    tb_i = s4.shapes.add_textbox(Inches(x + 0.15), Inches(y + 0.55), Inches(2.5), Inches(1.35))
    tf_i = tb_i.text_frame
    tf_i.word_wrap = True
    tf_i.margin_left = tf_i.margin_right = 0
    p1 = tf_i.paragraphs[0]
    p1.text = im_title
    p1.font.name = FONT_TITLE
    p1.font.size = Pt(9)
    p1.font.bold = True
    p1.font.color.rgb = BLUE_DARK
    
    p2 = tf_i.add_paragraph()
    p2.space_before = Pt(3)
    p2.text = im_desc
    p2.font.name = FONT_BODY
    p2.font.size = Pt(8)
    p2.font.color.rgb = TEXT_MUTED

# ==============================================================================
# SLIDE 5: MODUL APLIKASI (20 OPERATIONAL MODULES + APPROVAL HUB)
# ==============================================================================
s5 = prs.slides.add_slide(blank_slide_layout)
apply_clean_background(s5)
add_header_brand(s5)
add_footer_banner(s5, 5, 7)
add_slide_heading(s5, "MODUL APLIKASI TERLENGKAP",
                  "Arsitektur modular menyeluruh yang mencakup 20 modul operasional proyek industri & modul persetujuan terpadu")

# Top Banner: 20 Modul Operasional Proyek
ban_top = s5.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(2.05), Inches(11.733), Inches(0.35))
ban_top.fill.solid()
ban_top.fill.fore_color.rgb = BLUE_PRIMARY
ban_top.line.color.rgb = BLUE_PRIMARY
tf_bt = ban_top.text_frame
p_bt = tf_bt.paragraphs[0]
p_bt.text = "   MODUL OPERASIONAL PROYEK & WORKSHOP (20 FITUR UTAMA)"
p_bt.font.name = FONT_CODE
p_bt.font.size = Pt(9)
p_bt.font.bold = True
p_bt.font.color.rgb = WHITE

modules_20 = [
    "01. Master SDM & Rekening", "02. SPK & Kontrak Proyek", "03. Presensi Kamera Selfie", "04. Watermark NIK & GPS", "05. Multi-Site Geofence",
    "06. Geofencing Satelit 100m", "07. Form Alasan Terlambat", "08. Bypass Dinas Luar Site", "09. Log Riwayat & Bukti Foto", "10. Task Delegation Teknisi",
    "11. Timesheet Jam Kerja", "12. Formula Lembur 1/173", "13. Project Cost Accounting", "14. Forecast Anggaran (EAC)", "15. Warning Cost Overrun",
    "16. Cetak Slip Gaji QR Code", "17. Ekspor CSV Bank Payroll", "18. Dashboard Eksekutif SDM", "19. Dashboard Finansial Kas", "20. Multi-Role RBAC 3-Tier"
]

for idx, mod in enumerate(modules_20):
    row = idx // 5
    col = idx % 5
    x = 0.8 + col * 2.38
    y = 2.45 + row * 0.65
    
    m_card = create_card(s5, x, y, 2.25, 0.58, border_color=CARD_BORDER, bg_color=CARD_BG)
    tb_m = s5.shapes.add_textbox(Inches(x + 0.08), Inches(y + 0.08), Inches(2.1), Inches(0.42))
    tf_m = tb_m.text_frame
    tf_m.word_wrap = True
    p = tf_m.paragraphs[0]
    p.text = mod
    p.font.name = FONT_CODE
    p.font.size = Pt(8)
    p.font.bold = True
    p.font.color.rgb = BLUE_DARK

# Bottom Banner: Modul Approval & HRD
ban_bot = s5.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(5.15), Inches(11.733), Inches(0.32))
ban_bot.fill.solid()
ban_bot.fill.fore_color.rgb = ORANGE_ACCENT
ban_bot.line.color.rgb = ORANGE_ACCENT
tf_bb = ban_bot.text_frame
p_bb = tf_bb.paragraphs[0]
p_bb.text = "   MODUL APPROVAL & MANAJEMEN TERPADU (6 FITUR PERSATUAN)"
p_bb.font.name = FONT_CODE
p_bb.font.size = Pt(8.5)
p_bb.font.bold = True
p_bb.font.color.rgb = WHITE

approvals_6 = [
    ("Cuti Tahunan", "Pengurangan otomatis saldo"),
    ("Izin Sakit", "Verifikasi surat dokter"),
    ("Dispensasi Terlambat", "Pembebasan penalti gaji"),
    ("Disposisi Dinas Luar", "Validasi SPK & foto geotag"),
    ("Lembur Proyek", "Persetujuan lembur Depnaker"),
    ("Laporan Rekapitulasi", "Audit trail lengkap HRD")
]

for idx, (a_title, a_desc) in enumerate(approvals_6):
    x = 0.8 + idx * 1.98
    create_card(s5, x, 5.52, 1.88, 0.85, border_color=ORANGE_BORDER, bg_color=ORANGE_PALE)
    tb_a = s5.shapes.add_textbox(Inches(x + 0.08), Inches(5.58), Inches(1.72), Inches(0.75))
    tf_a = tb_a.text_frame
    tf_a.word_wrap = True
    p1 = tf_a.paragraphs[0]
    p1.text = "✔ " + a_title
    p1.font.name = FONT_TITLE
    p1.font.size = Pt(8.5)
    p1.font.bold = True
    p1.font.color.rgb = ORANGE_ACCENT
    
    p2 = tf_a.add_paragraph()
    p2.text = a_desc
    p2.font.name = FONT_BODY
    p2.font.size = Pt(7)
    p2.font.color.rgb = TEXT_MUTED

# ==============================================================================
# SLIDE 6: ESTIMASI BIAYA PENGEMBANGAN & PILIHAN PAKET
# ==============================================================================
s6 = prs.slides.add_slide(blank_slide_layout)
apply_clean_background(s6)
add_header_brand(s6)
add_footer_banner(s6, 6, 7)
add_slide_heading(s6, "ESTIMASI BIAYA PENGEMBANGAN & STRUKTUR HARGA",
                  "Pilihan paket investasi transparan: Paket Dasar ekonomis, Add-On modular fleksibel, dan Paket Komplit All-in paling hemat")

# ------------------------------------------------------------------------------
# Card 1: Paket Dasar HRIS (Left: x=0.8, w=3.75, y=1.95, h=3.35)
# ------------------------------------------------------------------------------
card_p1 = create_card(s6, 0.8, 1.95, 3.75, 3.35, border_color=CARD_BORDER_BLUE, bg_color=CARD_BG)

# Pill Header Card 1
hb1 = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.95), Inches(2.05), Inches(1.8), Inches(0.26))
hb1.fill.solid()
hb1.fill.fore_color.rgb = BLUE_PRIMARY
hb1.line.color.rgb = BLUE_PRIMARY
tf_h1 = hb1.text_frame
p = tf_h1.paragraphs[0]
p.alignment = PP_ALIGN.CENTER
p.text = "PAKET DASAR HRIS"
p.font.name = FONT_CODE
p.font.size = Pt(8)
p.font.bold = True
p.font.color.rgb = WHITE

# Title & Price Card 1
tb_p1 = s6.shapes.add_textbox(Inches(0.95), Inches(2.35), Inches(3.45), Inches(0.65))
tf_p1 = tb_p1.text_frame
tf_p1.word_wrap = True
tf_p1.margin_left = tf_p1.margin_top = 0
p = tf_p1.paragraphs[0]
p.text = "Paket Dasar HRIS"
p.font.name = FONT_TITLE
p.font.size = Pt(13)
p.font.bold = True
p.font.color.rgb = BLUE_DARK

p_pr1 = tf_p1.add_paragraph()
p_pr1.text = "Rp 2.500.000 "
p_pr1.font.name = FONT_TITLE
p_pr1.font.size = Pt(16)
p_pr1.font.bold = True
p_pr1.font.color.rgb = BLUE_PRIMARY
r_sub = p_pr1.add_run()
r_sub.text = "(1x Bayar)"
r_sub.font.name = FONT_CODE
r_sub.font.size = Pt(8.5)
r_sub.font.bold = False
r_sub.font.color.rgb = TEXT_MUTED

# Orange Cloud Box Card 1
cb1 = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.95), Inches(3.05), Inches(3.45), Inches(0.52))
cb1.fill.solid()
cb1.fill.fore_color.rgb = ORANGE_PALE
cb1.line.color.rgb = ORANGE_BORDER
cb1.line.width = Pt(1)
tf_cb1 = cb1.text_frame
tf_cb1.word_wrap = True
tf_cb1.margin_left = tf_cb1.margin_top = Inches(0.06)
p_c1 = tf_cb1.paragraphs[0]
p_c1.text = "Biaya Cloud Running Apps: Rp 35.000 / Bulan"
p_c1.font.name = FONT_CODE
p_c1.font.size = Pt(7.5)
p_c1.font.bold = True
p_c1.font.color.rgb = ORANGE_ACCENT
p_c2 = tf_cb1.add_paragraph()
p_c2.text = "Deployment online gratis & auto-backup database berkala."
p_c2.font.name = FONT_BODY
p_c2.font.size = Pt(6.8)
p_c2.font.color.rgb = TEXT_MUTED

# Storage & Features Textbox Card 1
tb_f1 = s6.shapes.add_textbox(Inches(0.95), Inches(3.62), Inches(3.45), Inches(1.3))
tf_f1 = tb_f1.text_frame
tf_f1.word_wrap = True
tf_f1.margin_left = tf_f1.margin_top = 0

p_st = tf_f1.paragraphs[0]
p_st.text = "Alokasi Penyimpanan:"
p_st.font.name = FONT_CODE
p_st.font.size = Pt(7.5)
p_st.font.bold = True
p_st.font.color.rgb = BLUE_DARK

p_st_d = tf_f1.add_paragraph()
p_st_d.text = "✔ 1 GB Storage Aktif  •  ✔ 10 GB Backup Cadangan Otomatis"
p_st_d.font.name = FONT_BODY
p_st_d.font.size = Pt(6.8)
p_st_d.font.color.rgb = TEXT_MUTED

p_ft = tf_f1.add_paragraph()
p_ft.space_before = Pt(3)
p_ft.text = "Fitur Sudah Termasuk:"
p_ft.font.name = FONT_CODE
p_ft.font.size = Pt(7.5)
p_ft.font.bold = True
p_ft.font.color.rgb = BLUE_DARK

feats_c1 = [
    "Dashboard HRIS Desktop / Web Lengkap",
    "Manajemen Karyawan & Aturan Shift Kerja",
    "Hitung Gaji Otomatis & Cetak Slip Ber-QR Code",
    "Approval Cuti, Izin & Sakit Online Mandiri",
    "Subdomain Gratis (dmj.primeprojectx.net)"
]
for fc in feats_c1:
    p_item = tf_f1.add_paragraph()
    p_item.text = "✔ " + fc
    p_item.font.name = FONT_BODY
    p_item.font.size = Pt(6.8)
    p_item.font.color.rgb = TEXT_MUTED

# Bottom button Card 1
btn1 = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.95), Inches(5.00), Inches(3.45), Inches(0.24))
btn1.fill.solid()
btn1.fill.fore_color.rgb = BLUE_PALE
btn1.line.color.rgb = BLUE_PRIMARY
btn1.line.width = Pt(1)
tf_btn1 = btn1.text_frame
p_b1 = tf_btn1.paragraphs[0]
p_b1.alignment = PP_ALIGN.CENTER
p_b1.text = "✔ Terpilih: Paket Dasar (Rp 2.5 Juta)"
p_b1.font.name = FONT_CODE
p_b1.font.size = Pt(7.5)
p_b1.font.bold = True
p_b1.font.color.rgb = BLUE_PRIMARY


# ------------------------------------------------------------------------------
# Card 2: Pilihan Add-On Modular (Middle: x=4.79, w=3.75, y=1.95, h=3.35)
# ------------------------------------------------------------------------------
card_p2 = create_card(s6, 4.79, 1.95, 3.75, 3.35, border_color=PURPLE_BORDER, bg_color=CARD_BG)

# Pill Header Card 2
hb2 = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.94), Inches(2.05), Inches(2.2), Inches(0.26))
hb2.fill.solid()
hb2.fill.fore_color.rgb = PURPLE_ACCENT
hb2.line.color.rgb = PURPLE_ACCENT
tf_h2 = hb2.text_frame
p = tf_h2.paragraphs[0]
p.alignment = PP_ALIGN.CENTER
p.text = "+ FITUR TAMBAHAN (OPTIONAL)"
p.font.name = FONT_CODE
p.font.size = Pt(7.5)
p.font.bold = True
p.font.color.rgb = WHITE

# Title Card 2
tb_p2 = s6.shapes.add_textbox(Inches(4.94), Inches(2.35), Inches(3.45), Inches(0.45))
tf_p2 = tb_p2.text_frame
tf_p2.word_wrap = True
tf_p2.margin_left = tf_p2.margin_top = 0
p = tf_p2.paragraphs[0]
p.text = "Pilihan Add-On"
p.font.name = FONT_TITLE
p.font.size = Pt(13)
p.font.bold = True
p.font.color.rgb = BLUE_DARK

p_sub2 = tf_p2.add_paragraph()
p_sub2.text = "Bisa ditambah sesuai kebutuhan spesifik kantor DMJ:"
p_sub2.font.name = FONT_BODY
p_sub2.font.size = Pt(7)
p_sub2.font.color.rgb = TEXT_MUTED

# 5 Add-On Rows (y: 2.82, 3.25, 3.68, 4.11, 4.54, h=0.40)
addons = [
    ("Multi-Site GPS Geofence", "Rp 1.000.000", "Penguncian radius presensi presisi kantor, workshop & site DMJ.", BLUE_PALE, CARD_BORDER_BLUE, BLUE_PRIMARY),
    ("Mobile Version (Smartphone)", "Rp 1.000.000", "Akses web HP: presensi, selfie biometrik, GPS native & slip mandiri.", MINT_PALE, RGBColor(167, 243, 208), MINT_GREEN),
    ("Source Code (Offline)", "Rp 200.000", "Lisensi source code untuk dijalankan di PC kantor tanpa biaya cloud.", RGBColor(254, 243, 199), RGBColor(253, 230, 138), ORANGE_ACCENT),
    ("Domain DMJhris.com", "± Rp 250.000/thn", "Gunakan domain brand sendiri. Menyesuaikan tarif registrasi resmi.", BLUE_PALE, CARD_BORDER_BLUE, BLUE_PRIMARY),
    ("Pelatihan Full Team [BARU]", "Rp 1.000.000", "Pelatihan penggunaan sistem untuk seluruh tim (semua divisi).", PURPLE_PALE, PURPLE_BORDER, PURPLE_ACCENT)
]

for idx, (a_name, a_price, a_desc, a_bg, a_border, a_color) in enumerate(addons):
    y_ad = 2.82 + idx * 0.43
    ad_box = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.94), Inches(y_ad), Inches(3.45), Inches(0.39))
    ad_box.fill.solid()
    ad_box.fill.fore_color.rgb = a_bg
    ad_box.line.color.rgb = a_border
    ad_box.line.width = Pt(1)
    tf_ad = ad_box.text_frame
    tf_ad.word_wrap = True
    tf_ad.margin_left = tf_ad.margin_right = Inches(0.08)
    tf_ad.margin_top = Inches(0.03)
    
    p_top = tf_ad.paragraphs[0]
    p_top.text = a_name
    p_top.font.name = FONT_CODE
    p_top.font.size = Pt(7.2)
    p_top.font.bold = True
    p_top.font.color.rgb = BLUE_DARK
    
    r_pr = p_top.add_run()
    r_pr.text = f"  ({a_price})"
    r_pr.font.bold = True
    r_pr.font.color.rgb = a_color
    
    p_bot = tf_ad.add_paragraph()
    p_bot.text = a_desc
    p_bot.font.name = FONT_BODY
    p_bot.font.size = Pt(6.2)
    p_bot.font.color.rgb = TEXT_MUTED

# Bottom notice Card 2
tb_n2 = s6.shapes.add_textbox(Inches(4.94), Inches(4.98), Inches(3.45), Inches(0.24))
tf_n2 = tb_n2.text_frame
p_n2 = tf_n2.paragraphs[0]
p_n2.alignment = PP_ALIGN.CENTER
p_n2.text = "*Modular: Bebas dipilih satuan atau All-in Paket Komplit"
p_n2.font.name = FONT_CODE
p_n2.font.size = Pt(6.5)
p_n2.font.color.rgb = TEXT_LIGHT


# ------------------------------------------------------------------------------
# Card 3: Prime HRIS Enterprise (Right: x=8.78, w=3.75, y=1.95, h=3.35, Highlighted)
# ------------------------------------------------------------------------------
card_p3 = create_card(s6, 8.78, 1.95, 3.75, 3.35, border_color=ORANGE_ACCENT, bg_color=CARD_BG)

# Pill Header Card 3 (Left: Full Suite, Right: Paling Hemat)
hb3_l = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.93), Inches(2.05), Inches(1.9), Inches(0.26))
hb3_l.fill.solid()
hb3_l.fill.fore_color.rgb = ORANGE_ACCENT
hb3_l.line.color.rgb = ORANGE_ACCENT
tf_h3l = hb3_l.text_frame
p = tf_h3l.paragraphs[0]
p.alignment = PP_ALIGN.CENTER
p.text = "PAKET KOMPLIT (FULL SUITE)"
p.font.name = FONT_CODE
p.font.size = Pt(7)
p.font.bold = True
p.font.color.rgb = WHITE

hb3_r = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.95), Inches(2.05), Inches(1.43), Inches(0.26))
hb3_r.fill.solid()
hb3_r.fill.fore_color.rgb = RGBColor(220, 38, 38)
hb3_r.line.color.rgb = RGBColor(220, 38, 38)
tf_h3r = hb3_r.text_frame
p = tf_h3r.paragraphs[0]
p.alignment = PP_ALIGN.CENTER
p.text = "👑 PALING HEMAT"
p.font.name = FONT_CODE
p.font.size = Pt(7)
p.font.bold = True
p.font.color.rgb = WHITE

# Title & Price Card 3
tb_p3 = s6.shapes.add_textbox(Inches(8.93), Inches(2.35), Inches(3.45), Inches(0.65))
tf_p3 = tb_p3.text_frame
tf_p3.word_wrap = True
tf_p3.margin_left = tf_p3.margin_top = 0
p = tf_p3.paragraphs[0]
p.text = "Prime HRIS Enterprise"
p.font.name = FONT_TITLE
p.font.size = Pt(13)
p.font.bold = True
p.font.color.rgb = BLUE_DARK

p_pr3 = tf_p3.add_paragraph()
p_pr3.text = "Rp 5.500.000 "
p_pr3.font.name = FONT_TITLE
p_pr3.font.size = Pt(16)
p_pr3.font.bold = True
p_pr3.font.color.rgb = ORANGE_ACCENT
r_sub3 = p_pr3.add_run()
r_sub3.text = "(All-in One-Time)"
r_sub3.font.name = FONT_CODE
r_sub3.font.size = Pt(8.5)
r_sub3.font.bold = False
r_sub3.font.color.rgb = TEXT_MUTED

# Orange Module Inclusions Box Card 3
mb3 = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.93), Inches(3.05), Inches(3.45), Inches(0.52))
mb3.fill.solid()
mb3.fill.fore_color.rgb = ORANGE_PALE
mb3.line.color.rgb = ORANGE_BORDER
mb3.line.width = Pt(1)
tf_mb3 = mb3.text_frame
tf_mb3.word_wrap = True
tf_mb3.margin_left = tf_mb3.margin_top = Inches(0.06)
p_m1 = tf_mb3.paragraphs[0]
p_m1.text = "Mencakup Seluruh Modul:"
p_m1.font.name = FONT_CODE
p_m1.font.size = Pt(7.5)
p_m1.font.bold = True
p_m1.font.color.rgb = BLUE_DARK
p_m2 = tf_mb3.add_paragraph()
p_m2.text = "Paket Dasar (2,5jt) + Multi-Site Geofence (1jt) + Mobile (1jt) + Source Code (200rb) + Domain (250rb/thn) + Pelatihan Full Team (1jt)"
p_m2.font.name = FONT_BODY
p_m2.font.size = Pt(6.3)
p_m2.font.color.rgb = TEXT_MUTED

# Features Card 3
tb_f3 = s6.shapes.add_textbox(Inches(8.93), Inches(3.62), Inches(3.45), Inches(1.3))
tf_f3 = tb_f3.text_frame
tf_f3.word_wrap = True
tf_f3.margin_left = tf_f3.margin_top = 0

p_k3 = tf_f3.paragraphs[0]
p_k3.text = "Keunggulan Lengkap:"
p_k3.font.name = FONT_CODE
p_k3.font.size = Pt(7.5)
p_k3.font.bold = True
p_k3.font.color.rgb = ORANGE_ACCENT

feats_c3 = [
    "1 GB Storage + 10 GB Backup Cadangan",
    "Akses Komplit: Desktop Web Admin + Mobile Smartphone",
    "Pengamanan Ganda: Selfie Wajah + Multi-Site Geofence",
    "Penggajian Depnaker Lengkap & Slip Gaji QR",
    "Garansi Bebas Masalah & Update 12 Bulan",
    "Setup Custom Domain Gratis (DMJhris.com)"
]
for fc in feats_c3:
    p_item = tf_f3.add_paragraph()
    p_item.text = "✔ " + fc
    p_item.font.name = FONT_BODY
    p_item.font.size = Pt(6.8)
    p_item.font.color.rgb = TEXT_MUTED

# Bottom button Card 3
btn3 = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.93), Inches(5.00), Inches(3.45), Inches(0.24))
btn3.fill.solid()
btn3.fill.fore_color.rgb = ORANGE_ACCENT
btn3.line.color.rgb = ORANGE_ACCENT
btn3.line.width = Pt(1)
tf_btn3 = btn3.text_frame
p_b3 = tf_btn3.paragraphs[0]
p_b3.alignment = PP_ALIGN.CENTER
p_b3.text = "👑 Pilih Paket Full Komplit (Semua Kebutuhan)"
p_b3.font.name = FONT_CODE
p_b3.font.size = Pt(7.5)
p_b3.font.bold = True
p_b3.font.color.rgb = WHITE


# ==============================================================================
# BOTTOM SECTION: RINCIAN BIAYA INVESTASI & OPERASIONAL PT DWI MARTHA JAYA
# ==============================================================================
card_bot = create_card(s6, 0.8, 5.35, 11.73, 1.25, border_color=BLUE_NAVY, bg_color=BLUE_NAVY)

# Title Row
tb_bt = s6.shapes.add_textbox(Inches(0.95), Inches(5.40), Inches(11.4), Inches(0.22))
tf_bt = tb_bt.text_frame
tf_bt.margin_left = tf_bt.margin_top = 0
p_bt = tf_bt.paragraphs[0]
p_bt.text = "🚀  RINCIAN BIAYA INVESTASI & OPERASIONAL — PT DWI MARTHA JAYA"
p_bt.font.name = FONT_CODE
p_bt.font.size = Pt(8)
p_bt.font.bold = True
p_bt.font.color.rgb = ORANGE_ACCENT

# Formula Row (5 boxes with operators)
formula_items = [
    ("1. PAKET DASAR HRIS", "Rp 2.500.000 (1x)", RGBColor(6, 78, 59), RGBColor(16, 185, 129), 2.1),
    ("+", None, None, None, 0.2),
    ("2. ADD-ON TERPILIH", "(Opsional)", RGBColor(30, 58, 138), RGBColor(59, 130, 246), 1.9),
    ("+", None, None, None, 0.2),
    ("3. PELATIHAN FULL TEAM", "Rp 1.000.000 (1x)", RGBColor(88, 28, 135), RGBColor(168, 85, 247), 2.1),
    ("+", None, None, None, 0.2),
    ("4. CLOUD & INFRASTRUKTUR", "Rp 35.000 / Bln", RGBColor(22, 78, 99), RGBColor(6, 182, 212), 2.1),
    ("=", None, None, None, 0.2),
    ("👑 PAKET FULL KOMPLIT", "Rp 5.500.000 (1x)", RGBColor(124, 45, 18), ORANGE_ACCENT, 2.3)
]

cur_x = 0.95
y_form = 5.63
for label, sublabel, bg_c, brd_c, w_box in formula_items:
    if sublabel is None:
        # Operator (+ or =)
        tb_op = s6.shapes.add_textbox(Inches(cur_x), Inches(y_form), Inches(w_box), Inches(0.36))
        tf_op = tb_op.text_frame
        p_op = tf_op.paragraphs[0]
        p_op.alignment = PP_ALIGN.CENTER
        p_op.text = label
        p_op.font.name = FONT_CODE
        p_op.font.size = Pt(11)
        p_op.font.bold = True
        p_op.font.color.rgb = WHITE
    else:
        # Pill Box
        bx = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(cur_x), Inches(y_form), Inches(w_box), Inches(0.36))
        bx.fill.solid()
        bx.fill.fore_color.rgb = bg_c
        bx.line.color.rgb = brd_c
        bx.line.width = Pt(1)
        tf_bx = bx.text_frame
        tf_bx.margin_left = tf_bx.margin_right = Inches(0.04)
        tf_bx.margin_top = Inches(0.02)
        p1 = tf_bx.paragraphs[0]
        p1.alignment = PP_ALIGN.CENTER
        p1.text = label
        p1.font.name = FONT_CODE
        p1.font.size = Pt(6.5)
        p1.font.bold = True
        p1.font.color.rgb = WHITE
        p2 = tf_bx.add_paragraph()
        p2.alignment = PP_ALIGN.CENTER
        p2.text = sublabel
        p2.font.name = FONT_CODE
        p2.font.size = Pt(7)
        p2.font.bold = True
        p2.font.color.rgb = brd_c
    cur_x += w_box + 0.01

# Sub-row 4 Summary Cards (y=6.05)
stat_cards = [
    ("1. PENGADAAN (1x BAYAR):", "Rp 5.500.000", "Lisensi penggunaan sistem HRIS (Full Suite)", ORANGE_ACCENT),
    ("2. SERVER CLOUD (BULANAN):", "Rp 35.000 / Bln", "Layanan server cloud resmi (Rp 35rb/bln)", MINT_GREEN),
    ("3. ALAMAT DOMAIN (TAHUNAN):", "Gratis (Rp 0)", "Subdomain dmj.primeprojectx.net", BLUE_PALE),
    ("4. STATUS SETUP & DEPLOY:", "Online Deploy: Gratis", "1 GB Storage + 10 GB Backup Cadangan", CYAN_ACCENT)
]

for i, (st_lbl, st_val, st_desc, st_col) in enumerate(stat_cards):
    x_sc = 0.95 + i * 2.87
    tb_sc = s6.shapes.add_textbox(Inches(x_sc), Inches(6.05), Inches(2.78), Inches(0.50))
    tf_sc = tb_sc.text_frame
    tf_sc.word_wrap = True
    tf_sc.margin_left = tf_sc.margin_top = 0
    p1 = tf_sc.paragraphs[0]
    p1.text = st_lbl
    p1.font.name = FONT_CODE
    p1.font.size = Pt(6.5)
    p1.font.bold = True
    p1.font.color.rgb = SLATE_LIGHT
    
    r_v = p1.add_run()
    r_v.text = f" {st_val}"
    r_v.font.bold = True
    r_v.font.color.rgb = st_col
    
    p2 = tf_sc.add_paragraph()
    p2.text = st_desc
    p2.font.name = FONT_BODY
    p2.font.size = Pt(6)
    p2.font.color.rgb = TEXT_LIGHT

# ==============================================================================
# SLIDE 7: TIMELINE 5 MINGGU & GARANSI SLA 12 BULAN
# ==============================================================================
s7 = prs.slides.add_slide(blank_slide_layout)
apply_clean_background(s7)
add_header_brand(s7)
add_footer_banner(s7, 7, 7)
add_slide_heading(s7, "JADWAL PELAKSANAAN & JAMINAN SLA",
                  "Roadmap implementasi bertahap 5 minggu tanpa mengganggu aktivitas operasional berjalan, didukung SLA 99.9% dan garansi 12 bulan")

# 4 Sprint Cards
sprints_s7 = [
    ("MINGGU 1", "Sprint 1: Inception & Setup", "• Kick-off meeting & analisis proses kerja\n• Setup Multi-Site Geofence kantor & workshop\n• Setup database karyawan, NIK & rekening\n• Konfigurasi VPS running apps & SSL"),
    ("MINGGU 2-3", "Sprint 2: Core Development", "• Implementasi kamera viewfinder & watermark\n• Kalibrasi Precision Multi-Site Geofence\n• Integrasi alur bypass Dinas Luar Mendadak\n• Pembangunan mesin payroll lembur Depnaker"),
    ("MINGGU 4", "Sprint 3: Testing & UAT", "• User Acceptance Testing (UAT) staf & HR\n• Kalibrasi geofence Manyar JIIPE & Surabaya\n• Pengujian simulasi anti Fake GPS / VPN\n• Verifikasi akurasi potongan BPJS & PPh21"),
    ("MINGGU 5", "Sprint 4: Handover & Go-Live", "• Pelatihan HR Admin & jajaran pimpinan\n• Handover dokumentasi & credential akses\n• Migrasi data absensi aktif PT DMJ\n• Go-Live resmi & aktivasi garansi 12 bulan")
]

for i, (m_tag, m_title, m_desc) in enumerate(sprints_s7):
    x = 0.8 + i * 2.98
    create_card(s7, x, 2.05, 2.8, 2.4, border_color=CARD_BORDER_BLUE if i < 3 else ORANGE_BORDER)
    
    # Header box of sprint
    hb = s7.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(2.05), Inches(2.8), Inches(0.35))
    hb.fill.solid()
    hb.fill.fore_color.rgb = BLUE_PRIMARY if i < 3 else ORANGE_ACCENT
    hb.line.color.rgb = BLUE_PRIMARY if i < 3 else ORANGE_ACCENT
    tf_hb = hb.text_frame
    p_h = tf_hb.paragraphs[0]
    p_h.alignment = PP_ALIGN.CENTER
    p_h.text = m_tag
    p_h.font.name = FONT_CODE
    p_h.font.size = Pt(9)
    p_h.font.bold = True
    p_h.font.color.rgb = WHITE
    
    tb_s = s7.shapes.add_textbox(Inches(x + 0.12), Inches(2.45), Inches(2.55), Inches(1.95))
    tf_s = tb_s.text_frame
    tf_s.word_wrap = True
    p1 = tf_s.paragraphs[0]
    p1.text = m_title
    p1.font.name = FONT_TITLE
    p1.font.size = Pt(9.5)
    p1.font.bold = True
    p1.font.color.rgb = BLUE_DARK
    
    p2 = tf_s.add_paragraph()
    p2.space_before = Pt(4)
    p2.text = m_desc
    p2.font.name = FONT_BODY
    p2.font.size = Pt(8)
    p2.font.color.rgb = TEXT_MUTED

# Bottom 3 SLA Cards
sla_3 = [
    ("99.9% UPTIME CLOUD SLA", "Infrastruktur server Linux cloud berproteksi reverse proxy ganda, menjamin presensi lancar 24/7 tanpa downtime."),
    ("RESPON CEPAT GANGGUAN", "Penanganan insiden kritis < 2 Jam dan kendala moderat < 6 Jam melalui jalur direct hotline WhatsApp tim pengembang."),
    ("12 BULAN GARANSI BEBAS BUG", "Pemeliharaan menyeluruh mencakup perbaikan bug dan penyesuaian regulasi ketenagakerjaan selama masa kerjasama.")
]

for i, (sl_title, sl_desc) in enumerate(sla_3):
    x = 0.8 + i * 3.98
    create_card(s7, x, 4.65, 3.8, 1.75, border_color=CARD_BORDER, bg_color=CARD_BG)
    tb_sl = s7.shapes.add_textbox(Inches(x + 0.18), Inches(4.75), Inches(3.45), Inches(1.55))
    tf_sl = tb_sl.text_frame
    tf_sl.word_wrap = True
    
    p1 = tf_sl.paragraphs[0]
    p1.text = "🛡️ " + sl_title
    p1.font.name = FONT_CODE
    p1.font.size = Pt(9.5)
    p1.font.bold = True
    p1.font.color.rgb = BLUE_PRIMARY if i < 2 else ORANGE_ACCENT
    
    p2 = tf_sl.add_paragraph()
    p2.space_before = Pt(4)
    p2.text = sl_desc
    p2.font.name = FONT_BODY
    p2.font.size = Pt(8.5)
    p2.font.color.rgb = TEXT_MUTED

# Save presentation
output_pptx = os.path.join(r"C:\Users\PRIMA\timesweet-hris", "PROPOSAL_PRIME_HRIS_PT_DWI_MARTHA_JAYA.pptx")
prs.save(output_pptx)
print("SUCCESS: Modern Deck Saved to", output_pptx)
