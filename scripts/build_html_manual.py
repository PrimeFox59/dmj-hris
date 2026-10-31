"""
PRIME HRIS ENTERPRISE - INTERACTIVE HTML MANUAL GENERATOR (V3 SSOT)
Mengemas dokumen BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.md ke dalam format HTML interaktif enterprise.
Mencakup:
1. Header & Footer resmi Prime Projectx (https://primeprojectx.net) dan PT Prime Infinity Systems beserta logo 3D PX.
2. Diagram Mermaid dengan font besar, tajam, dan kontrol interaktif (Pan, Wheel Zoom, Zoom In/Out, Reset, Fullscreen Modal).
3. Eliminasi total badge 'Enterprise' di kiri atas, repositori GitHub di kanan atas/footer, dan status server IP.
4. Fitur ultra-interaktif: Reading progress bar, Role quick-switcher pills, Filter interaktif Tabel RBAC, Live search counter, Collapsible FAQ, dan Copy code.
Output:
- C:/Users/prime/Desktop/BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.html
- C:/Users/prime/prime-hris/docs/BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.html
- C:/Users/prime/.gemini/antigravity-cli/brain/4fbf6728-925d-466f-87af-e179e5f86f48/BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.html
"""

import os
import re
import html
import base64
import io
from PIL import Image
import markdown

def get_logo_base64():
    logo_path = r"C:\Users\prime\Downloads\px_logo_1790087710977.png"
    if not os.path.exists(logo_path):
        logo_path = r"C:\Users\prime\.gemini\antigravity-cli\brain\dc8e1bbe-46e5-4022-adab-f8e9b297cdd0\prime-px-logo.png"
    
    if os.path.exists(logo_path):
        try:
            img = Image.open(logo_path)
            img.thumbnail((360, 360), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
            return f"data:image/png;base64,{b64_str}"
        except Exception as e:
            print(f"[WARN] Error encoding logo: {e}")
    return ""

def preprocess_markdown(md_text):
    # 1. Preprocess Callouts: > [!NOTE], > [!IMPORTANT], > [!WARNING], > [!TIP]
    def callout_sub(match):
        ctype = match.group(1).upper()
        content = match.group(2).strip()
        
        type_map = {
            "NOTE": ("Catatan Sistem", "callout-note", "ℹ️"),
            "IMPORTANT": ("Penting & Wajib", "callout-important", "⚠️"),
            "WARNING": ("Peringatan Sistem", "callout-warning", "🚨"),
            "TIP": ("Tips Optimal", "callout-tip", "💡")
        }
        title, css_class, icon = type_map.get(ctype, ("Catatan", "callout-note", "ℹ️"))
        
        clean_lines = [line.lstrip("> ").strip() for line in content.split("\n")]
        body_text = "<br/>".join([l for l in clean_lines if l])
        
        return f'\n\n<div class="callout {css_class}"><div class="callout-header"><span class="callout-icon">{icon}</span> <strong>{title}</strong></div><div class="callout-body">{body_text}</div></div>\n\n'

    md_text = re.sub(r'>\s*\[!(NOTE|IMPORTANT|WARNING|TIP)\]([\s\S]*?)(?=\n\n[^\>]|\Z)', callout_sub, md_text)

    # 2. Extract and protect Mermaid blocks
    mermaid_blocks = []
    def mermaid_stash(match):
        idx = len(mermaid_blocks)
        raw_code = match.group(1).strip()
        mermaid_blocks.append(raw_code)
        return f"\n\n<!--MERMAID_PLACEHOLDER_{idx}-->\n\n"

    md_text = re.sub(r'```mermaid([\s\S]*?)```', mermaid_stash, md_text)

    return md_text, mermaid_blocks

def postprocess_html(html_text, mermaid_blocks):
    diagram_titles = [
        "Diagram 1.1: Hierarki Otorisasi & Alur Koordinasi 5-Tier RBAC",
        "Diagram 1.2: Arsitektur Proteksi API & Gateway Otorisasi Backend Server",
        "Diagram 2.1: Topologi Silsilah Keterkaitan Data End-to-End (Data Lineage)",
        "Diagram 3.1: Alur Kerja & Logika Keputusan Presensi Masuk vs Pulang (Hasil REA 8 Fase)",
        "Diagram 7.1: Siklus Tutup Buku Penggajian Bulanan Step-by-Step & Distribusi WhatsApp Baileys"
    ]

    # Restore Mermaid blocks into interactive pan-zoom cards
    for idx, raw_code in enumerate(mermaid_blocks):
        escaped_code = html.escape(raw_code)
        placeholder = f"<!--MERMAID_PLACEHOLDER_{idx}-->"
        d_title = diagram_titles[idx] if idx < len(diagram_titles) else f"Diagram Alur Visual {idx + 1}"
        
        mermaid_html = f"""
<div class="mermaid-card" id="diagram-card-{idx}">
  <div class="mermaid-card-header">
    <div class="mermaid-header-info">
      <span class="mermaid-badge">DIAGRAM ALUR VISUAL {idx + 1}</span>
      <span class="mermaid-title">{d_title}</span>
    </div>
    <div class="mermaid-toolbar">
      <button type="button" class="tool-btn" onclick="diagramPanZoom.zoomIn({idx})" title="Perbesar Diagram (Zoom In)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        <span>Zoom In</span>
      </button>
      <span class="zoom-badge" id="zoom-badge-{idx}">100%</span>
      <button type="button" class="tool-btn" onclick="diagramPanZoom.zoomOut({idx})" title="Perkecil Diagram (Zoom Out)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        <span>Zoom Out</span>
      </button>
      <button type="button" class="tool-btn" onclick="diagramPanZoom.reset({idx})" title="Reset Ukuran & Posisi Normal">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
        <span>Reset</span>
      </button>
      <button type="button" class="tool-btn btn-fs" onclick="diagramPanZoom.openFullscreen({idx})" title="Buka di Layar Penuh (Fullscreen Modal)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
        <span>Layar Penuh</span>
      </button>
    </div>
  </div>
  <div class="mermaid-viewport" id="viewport-{idx}">
    <div class="viewport-hint">
      <span>🖱️ Klik & seret mouse untuk menggeser alur • Scroll mouse untuk zoom in/out • Tombol Layar Penuh untuk visual maksimal</span>
    </div>
    <div class="mermaid-canvas" id="canvas-{idx}">
      <pre class="mermaid" id="mermaid-{idx}">{escaped_code}</pre>
    </div>
  </div>
</div>
"""
        html_text = html_text.replace(f"<p>{placeholder}</p>", mermaid_html)
        html_text = html_text.replace(placeholder, mermaid_html)

    # Wrap tables in responsive containers
    html_text = re.sub(r'(<table>[\s\S]*?</table>)', r'<div class="table-container">\1</div>', html_text)

    # Enhance Table 1.1 with interactive RBAC filter controls
    rbac_filter_markup = """
<div class="rbac-filter-panel" id="rbacFilterPanel">
  <div class="rbac-filter-header">
    <div class="rbac-filter-title">
      <span>🔍 Filter Interaktif Tabel Matriks Otorisasi RBAC (25 Modul):</span>
    </div>
    <input type="text" id="rbacTableSearch" class="rbac-table-search" placeholder="Ketik nama modul (misal: slip, lembur, cuti, geofence)...">
  </div>
  <div class="rbac-filter-pills">
    <button class="rbac-pill active" onclick="filterRBACTable('all')">🌟 Semua Modul (25)</button>
    <button class="rbac-pill" onclick="filterRBACTable('staff')">👤 Akses Staff</button>
    <button class="rbac-pill" onclick="filterRBACTable('pm')">📋 Akses PM Site</button>
    <button class="rbac-pill" onclick="filterRBACTable('hr')">👥 Akses HR SDM</button>
    <button class="rbac-pill" onclick="filterRBACTable('finance')">💰 Akses Finance</button>
    <button class="rbac-pill" onclick="filterRBACTable('superuser')">⚡ Akses Superuser</button>
  </div>
</div>
"""
    # Insert right before the first table (which is Tabel 1.1)
    first_table_match = re.search(r'(<h3 id="14-tabel-11-[^"]*">.*?</h3>\s*<div class="callout[\s\S]*?</div>\s*)(<div class="table-container">)', html_text)
    if first_table_match:
        html_text = html_text[:first_table_match.end(1)] + rbac_filter_markup + html_text[first_table_match.end(1):]
    else:
        # Fallback search
        html_text = re.sub(r'(<h3[^>]*>.*?1\.4 Tabel 1\.1.*?</h3>\s*<div class="callout[\s\S]*?</div>\s*)(<div class="table-container">)', r'\1' + rbac_filter_markup + r'\2', html_text)

    return html_text

def build_html_manual():
    md_path = r"C:\Users\prime\prime-hris\docs\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.md"
    if not os.path.exists(md_path):
        md_path = r"C:\Users\prime\Desktop\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.md"

    with open(md_path, "r", encoding="utf-8") as f:
        md_content = f.read()

    logo_b64 = get_logo_base64()

    # Pre-process MD
    cleaned_md, mermaid_blocks = preprocess_markdown(md_content)

    # Render Markdown to HTML
    md_extensions = ['fenced_code', 'tables', 'toc', 'attr_list', 'def_list']
    body_html = markdown.markdown(cleaned_md, extensions=md_extensions)

    # Post-process HTML
    body_html = postprocess_html(body_html, mermaid_blocks)

    # Extract Table of Contents items for sidebar
    toc_items = []
    headers = re.findall(r'<h([23]) id="([^"]+)">([^<]+)</h[23]>', body_html)
    for level, hid, htitle in headers:
        toc_items.append({
            "level": int(level),
            "id": hid,
            "title": htitle.replace("&amp;", "&")
        })

    sidebar_toc_html = []
    sidebar_toc_html.append('<ul class="toc-list" id="sidebarTocList">')
    for item in toc_items:
        cls = "toc-h2" if item["level"] == 2 else "toc-h3"
        sidebar_toc_html.append(f'<li class="{cls}"><a href="#{item["id"]}" class="toc-link" data-id="{item["id"]}">{item["title"]}</a></li>')
    sidebar_toc_html.append('</ul>')
    sidebar_toc_str = "\n".join(sidebar_toc_html)

    html_template = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Buku Panduan Penggunaan Sistem PRIME HRIS Enterprise - PT Prime Infinity Systems & Prime Projectx">
  <meta name="author" content="Galih Primananda - Systems Architecture & Platform Analytics">
  <title>Buku Panduan Penggunaan Sistem PRIME HRIS Enterprise | Prime Projectx & PT Prime Infinity Systems</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  
  <!-- KaTeX for crisp LaTeX Math Rendering -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>

  <!-- Mermaid.js for interactive diagrams -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

  <style>
    :root {{
      --primary: #18345E;       /* Deep Navy */
      --secondary: #283C5A;     /* Slate Navy */
      --accent: #FF6B00;        /* Prime Orange */
      --accent-hover: #E05E00;
      --bg: #F8FAFC;            /* Slate 50 */
      --surface: #FFFFFF;
      --border: #E2E8F0;
      --border-dark: #CBD5E1;
      --text: #1E293B;          /* Slate 800 */
      --text-muted: #64748B;    /* Slate 500 */
      --code-bg: #0F172A;
      --sidebar-width: 320px;
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    html {{
      scroll-behavior: smooth;
      font-size: 15px;
    }}

    body {{
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }}

    /* =========================================================================
       0. TOP READING PROGRESS BAR
       ========================================================================= */
    #readingProgressContainer {{
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: transparent;
      z-index: 9999;
    }}
    #readingProgressBar {{
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #FF6B00, #FF9E40);
      box-shadow: 0 0 8px rgba(255, 107, 0, 0.6);
      transition: width 0.1s ease-out;
    }}

    /* =========================================================================
       1. TOP HEADER (STICKY BRANDING BAR)
       ========================================================================= */
    .top-header {{
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      height: 74px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(14px);
      border-bottom: 1.5px solid var(--border);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2rem;
      box-shadow: 0 2px 10px rgba(24, 52, 94, 0.04);
    }}

    .brand-group {{
      display: flex;
      align-items: center;
      gap: 14px;
      text-decoration: none;
    }}

    .brand-logo {{
      height: 48px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(24, 52, 94, 0.15));
    }}

    .brand-text {{
      display: flex;
      flex-direction: column;
    }}

    .brand-name {{
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: -0.02em;
      line-height: 1.2;
    }}

    .brand-sub {{
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--secondary);
      letter-spacing: 0.01em;
    }}

    .header-actions {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .search-wrapper {{
      position: relative;
      display: flex;
      align-items: center;
    }}

    .search-input {{
      padding: 8px 36px 8px 14px;
      border: 1.5px solid var(--border-dark);
      border-radius: 10px;
      font-size: 0.85rem;
      font-family: inherit;
      width: 240px;
      outline: none;
      transition: all 0.2s ease;
      background: var(--bg);
    }}

    .search-input:focus {{
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(24, 52, 94, 0.12);
      width: 290px;
      background: #FFFFFF;
    }}

    .search-match-badge {{
      position: absolute;
      right: 10px;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--accent);
      pointer-events: none;
    }}

    .btn-action {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      text-decoration: none;
      transition: all 0.2s ease;
    }}

    .btn-outline {{
      background: #FFFFFF;
      border: 1.5px solid var(--border-dark);
      color: var(--text);
    }}

    .btn-outline:hover {{
      border-color: var(--primary);
      color: var(--primary);
      background: #F8FAFC;
    }}

    .btn-primary-action {{
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #FFFFFF;
      border: 1.5px solid transparent;
    }}

    .btn-primary-action:hover {{
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(24, 52, 94, 0.25);
    }}

    /* =========================================================================
       2. TWO-COLUMN LAYOUT (SIDEBAR + MAIN CONTENT)
       ========================================================================= */
    .app-container {{
      display: flex;
      max-width: 1540px;
      margin: 0 auto;
      min-height: calc(100vh - 74px);
    }}

    /* Sticky Sidebar Navigation */
    .sidebar-toc {{
      width: var(--sidebar-width);
      min-width: var(--sidebar-width);
      background: #FFFFFF;
      border-right: 1px solid var(--border);
      position: sticky;
      top: 74px;
      height: calc(100vh - 74px);
      overflow-y: auto;
      padding: 1.5rem 1rem 3rem 1.5rem;
    }}

    .sidebar-header {{
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.85rem;
      padding-left: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}

    .toc-list {{
      list-style: none;
    }}

    .toc-list li {{
      margin-bottom: 2px;
    }}

    .toc-list a {{
      display: block;
      padding: 6px 10px;
      border-radius: 8px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
      line-height: 1.4;
      transition: all 0.15s ease;
    }}

    .toc-list a:hover {{
      background: #F1F5F9;
      color: var(--primary);
    }}

    .toc-h2 a {{
      font-weight: 700;
      color: var(--text);
      margin-top: 8px;
      font-size: 0.88rem;
    }}

    .toc-h3 a {{
      padding-left: 20px;
      font-size: 0.82rem;
      color: #64748B;
    }}

    .toc-list a.active {{
      background: #EFF6FF;
      color: var(--primary);
      font-weight: 700;
      border-left: 3px solid var(--primary);
    }}

    /* Main Content Area */
    .main-content {{
      flex: 1;
      padding: 2.2rem 3.5rem 6rem;
      max-width: calc(100% - var(--sidebar-width));
      background: var(--bg);
    }}

    /* Document Hero Header */
    .doc-hero {{
      background: linear-gradient(135deg, #18345E 0%, #283C5A 60%, #152238 100%);
      color: #FFFFFF;
      border-radius: 20px;
      padding: 2.8rem;
      margin-bottom: 1.8rem;
      box-shadow: 0 10px 30px rgba(24, 52, 94, 0.15);
      position: relative;
      overflow: hidden;
    }}

    .doc-hero::after {{
      content: "";
      position: absolute;
      top: -60px;
      right: -60px;
      width: 240px;
      height: 240px;
      background: radial-gradient(circle, rgba(255, 107, 0, 0.25) 0%, rgba(255, 107, 0, 0) 70%);
      border-radius: 50%;
      pointer-events: none;
    }}

    .hero-meta-badge {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 107, 0, 0.2);
      border: 1px solid rgba(255, 107, 0, 0.5);
      color: #FFA559;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1rem;
    }}

    .doc-hero h1 {{
      font-size: 2.2rem;
      font-weight: 800;
      line-height: 1.25;
      margin-bottom: 0.8rem;
      letter-spacing: -0.02em;
    }}

    .doc-hero-sub {{
      font-size: 1.02rem;
      font-weight: 500;
      color: #CBD5E1;
      max-width: 900px;
      line-height: 1.6;
      margin-bottom: 1.8rem;
    }}

    .hero-info-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
      padding-top: 1.2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.15);
    }}

    .hero-info-item {{
      display: flex;
      flex-direction: column;
    }}

    .hero-info-item span:first-child {{
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #94A3B8;
      font-weight: 600;
    }}

    .hero-info-item span:last-child {{
      font-size: 0.9rem;
      font-weight: 700;
      color: #FFFFFF;
      margin-top: 2px;
    }}

    /* =========================================================================
       3. INTERACTIVE ROLE SELECTOR BAR
       ========================================================================= */
    .role-navigator-bar {{
      background: #FFFFFF;
      border: 1.5px solid var(--border);
      border-radius: 16px;
      padding: 1.1rem 1.4rem;
      margin-bottom: 2.2rem;
      box-shadow: 0 4px 14px rgba(24, 52, 94, 0.04);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }}

    .role-nav-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}

    .role-nav-title {{
      font-size: 0.88rem;
      font-weight: 800;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .role-nav-hint {{
      font-size: 0.78rem;
      color: var(--text-muted);
      font-weight: 600;
    }}

    .role-pills-container {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }}

    .role-pill {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 10px;
      font-size: 0.82rem;
      font-weight: 700;
      border: 1.5px solid var(--border);
      background: #F8FAFC;
      color: var(--text);
      cursor: pointer;
      transition: all 0.2s ease;
    }}

    .role-pill:hover {{
      background: #EFF6FF;
      border-color: var(--primary);
      color: var(--primary);
      transform: translateY(-1px);
    }}

    .role-pill.active {{
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #FFFFFF;
      border-color: transparent;
      box-shadow: 0 3px 8px rgba(24, 52, 94, 0.2);
    }}

    /* =========================================================================
       4. TYPOGRAPHY & ARTICLE CONTENT
       ========================================================================= */
    h2 {{
      font-size: 1.65rem;
      font-weight: 800;
      color: var(--primary);
      margin-top: 3.2rem;
      margin-bottom: 1.2rem;
      padding-bottom: 0.6rem;
      border-bottom: 2px solid #E2E8F0;
      letter-spacing: -0.02em;
    }}

    h3 {{
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--secondary);
      margin-top: 2rem;
      margin-bottom: 0.8rem;
      letter-spacing: -0.01em;
    }}

    h4 {{
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text);
      margin-top: 1.4rem;
      margin-bottom: 0.5rem;
    }}

    p {{
      margin-bottom: 1rem;
      color: #334155;
      font-size: 0.96rem;
      line-height: 1.7;
    }}

    ul, ol {{
      margin-left: 1.4rem;
      margin-bottom: 1.2rem;
      color: #334155;
    }}

    li {{
      margin-bottom: 0.4rem;
      line-height: 1.6;
    }}

    hr {{
      border: none;
      height: 1.5px;
      background: #E2E8F0;
      margin: 2.8rem 0;
    }}

    strong {{
      color: #0F172A;
      font-weight: 700;
    }}

    /* Callout Boxes */
    .callout {{
      padding: 1.1rem 1.4rem;
      border-radius: 12px;
      margin: 1.4rem 0;
      border-left: 5px solid;
      background: #FFFFFF;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    }}

    .callout-header {{
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
      margin-bottom: 0.4rem;
    }}

    .callout-body {{
      font-size: 0.92rem;
      color: #334155;
      line-height: 1.6;
    }}

    .callout-note {{
      border-color: var(--primary);
      background: #F0F6FF;
    }}

    .callout-note .callout-header {{
      color: var(--primary);
    }}

    .callout-important {{
      border-color: #D97706;
      background: #FFFBEB;
    }}

    .callout-important .callout-header {{
      color: #B45309;
    }}

    .callout-warning {{
      border-color: #DC2626;
      background: #FEF2F2;
    }}

    .callout-warning .callout-header {{
      color: #B91C1C;
    }}

    .callout-tip {{
      border-color: #10B981;
      background: #ECFDF5;
    }}

    .callout-tip .callout-header {{
      color: #047857;
    }}

    /* Tables */
    .table-container {{
      overflow-x: auto;
      margin: 1.4rem 0 2rem;
      background: #FFFFFF;
      border-radius: 12px;
      border: 1px solid var(--border);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    }}

    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
      text-align: left;
    }}

    thead tr {{
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #FFFFFF;
    }}

    th {{
      padding: 12px 14px;
      font-weight: 700;
      border-bottom: 1px solid var(--border-dark);
      letter-spacing: 0.02em;
    }}

    td {{
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      color: #334155;
      vertical-align: top;
      line-height: 1.5;
    }}

    tbody tr:nth-child(even) {{
      background-color: #F8FAFC;
    }}

    tbody tr:hover {{
      background-color: #F1F5F9;
    }}

    /* RBAC Interactive Table Filter Panel */
    .rbac-filter-panel {{
      background: #FFFFFF;
      border: 1.5px solid var(--border);
      border-radius: 12px;
      padding: 1.1rem;
      margin: 1.5rem 0 0.8rem;
      box-shadow: 0 2px 10px rgba(24, 52, 94, 0.04);
    }}

    .rbac-filter-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 0.8rem;
    }}

    .rbac-filter-title {{
      font-size: 0.85rem;
      font-weight: 800;
      color: var(--primary);
    }}

    .rbac-table-search {{
      padding: 6px 12px;
      border: 1.5px solid var(--border-dark);
      border-radius: 8px;
      font-size: 0.82rem;
      width: 280px;
      outline: none;
      background: #F8FAFC;
      transition: all 0.2s;
    }}

    .rbac-table-search:focus {{
      border-color: var(--primary);
      background: #FFFFFF;
      box-shadow: 0 0 0 3px rgba(24, 52, 94, 0.08);
    }}

    .rbac-filter-pills {{
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }}

    .rbac-pill {{
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 700;
      border: 1.2px solid var(--border);
      background: #F8FAFC;
      cursor: pointer;
      transition: all 0.15s;
    }}

    .rbac-pill:hover {{
      border-color: var(--primary);
      color: var(--primary);
    }}

    .rbac-pill.active {{
      background: var(--primary);
      color: #FFFFFF;
      border-color: var(--primary);
    }}

    /* =========================================================================
       5. MERMAID DIAGRAMS (HIGH-DEFINITION INTERACTIVE VIEWPORT)
       ========================================================================= */
    .mermaid-card {{
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.25rem 1.4rem;
      margin: 2.2rem 0;
      box-shadow: 0 4px 18px rgba(24, 52, 94, 0.05);
    }}

    .mermaid-card-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.9rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #F1F5F9;
      flex-wrap: wrap;
      gap: 10px;
    }}

    .mermaid-header-info {{
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }}

    .mermaid-badge {{
      background: #EFF6FF;
      color: var(--primary);
      font-size: 0.72rem;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 0.06em;
      border: 1px solid #BFDBFE;
    }}

    .mermaid-title {{
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--secondary);
    }}

    .mermaid-toolbar {{
      display: flex;
      align-items: center;
      gap: 6px;
      background: #F8FAFC;
      padding: 4px 8px;
      border-radius: 10px;
      border: 1px solid var(--border);
    }}

    .tool-btn {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #FFFFFF;
      border: 1px solid var(--border-dark);
      color: var(--text);
      font-size: 0.76rem;
      font-weight: 700;
      padding: 5px 9px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }}

    .tool-btn:hover {{
      background: #EFF6FF;
      border-color: var(--primary);
      color: var(--primary);
    }}

    .tool-btn.btn-fs {{
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #FFFFFF;
      border-color: transparent;
    }}

    .tool-btn.btn-fs:hover {{
      background: linear-gradient(135deg, var(--accent), var(--accent-hover));
      box-shadow: 0 2px 8px rgba(255, 107, 0, 0.3);
    }}

    .zoom-badge {{
      font-size: 0.75rem;
      font-weight: 800;
      font-family: 'JetBrains Mono', Consolas, monospace;
      color: var(--primary);
      padding: 3px 8px;
      background: #FFFFFF;
      border-radius: 6px;
      border: 1px solid var(--border);
      min-width: 48px;
      text-align: center;
    }}

    .mermaid-viewport {{
      position: relative;
      width: 100%;
      height: 580px;
      background: radial-gradient(#CBD5E1 1px, transparent 1px) 0 0 / 22px 22px, #FAFCFE;
      border-radius: 12px;
      border: 1.5px solid var(--border);
      overflow: hidden;
      cursor: grab;
      user-select: none;
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.03);
    }}

    .mermaid-viewport.grabbing {{
      cursor: grabbing;
    }}

    .viewport-hint {{
      position: absolute;
      bottom: 12px;
      left: 14px;
      z-index: 10;
      font-size: 0.72rem;
      font-weight: 600;
      color: #64748B;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(4px);
      padding: 4px 12px;
      border-radius: 20px;
      border: 1px solid #E2E8F0;
      pointer-events: none;
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
    }}

    .mermaid-canvas {{
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
      will-change: transform;
    }}

    /* Ensure Mermaid SVG renders at natural large, crisp, legible dimensions */
    .mermaid-canvas svg,
    .fs-canvas svg {{
      max-width: none !important;
      max-height: none !important;
      height: auto !important;
      display: block !important;
      filter: drop-shadow(0 4px 14px rgba(24, 52, 94, 0.08));
    }}

    /* =========================================================================
       6. FULLSCREEN MODAL OVERLAY
       ========================================================================= */
    .fullscreen-modal {{
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(10px);
      z-index: 99999;
      display: none;
      flex-direction: column;
    }}

    .fs-header {{
      height: 64px;
      background: #FFFFFF;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
    }}

    .fs-header-left {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .fs-badge {{
      background: #EFF6FF;
      color: var(--primary);
      font-size: 0.72rem;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #BFDBFE;
    }}

    .fs-title {{
      font-size: 1rem;
      font-weight: 800;
      color: var(--primary);
    }}

    .fs-viewport {{
      flex: 1;
      position: relative;
      overflow: hidden;
      cursor: grab;
      background: radial-gradient(#334155 1px, transparent 1px) 0 0 / 24px 24px, #0F172A;
    }}

    .fs-viewport.grabbing {{
      cursor: grabbing;
    }}

    .fs-canvas {{
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform-origin: center center;
      will-change: transform;
    }}

    .fs-hint {{
      position: absolute;
      bottom: 16px;
      left: 20px;
      z-index: 10;
      font-size: 0.75rem;
      font-weight: 600;
      color: #CBD5E1;
      background: rgba(30, 41, 59, 0.85);
      backdrop-filter: blur(4px);
      padding: 5px 14px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      pointer-events: none;
    }}

    .btn-close-modal {{
      background: #DC2626;
      color: #FFFFFF;
      border: none;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s;
    }}

    .btn-close-modal:hover {{
      background: #B91C1C;
    }}

    /* =========================================================================
       7. CODE BLOCKS & COPY BUTTON
       ========================================================================= */
    .code-wrapper {{
      position: relative;
      margin: 1.2rem 0;
    }}

    pre code {{
      display: block;
      background: var(--code-bg);
      color: #F8FAFC;
      padding: 1.2rem 1.4rem;
      border-radius: 12px;
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 0.85rem;
      overflow-x: auto;
      line-height: 1.6;
    }}

    p code, li code {{
      background: #EEF2F6;
      color: #0F172A;
      padding: 2px 6px;
      border-radius: 5px;
      font-family: 'JetBrains Mono', Consolas, monospace;
      font-size: 0.85em;
      font-weight: 600;
    }}

    .copy-btn {{
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255, 255, 255, 0.15);
      color: #FFFFFF;
      border: 1px solid rgba(255, 255, 255, 0.25);
      font-size: 0.72rem;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }}

    .copy-btn:hover {{
      background: rgba(255, 255, 255, 0.3);
    }}

    /* Floating Back to Top Button */
    .btn-top {{
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 46px;
      height: 46px;
      background: var(--primary);
      color: #FFFFFF;
      border: none;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 6px 16px rgba(24, 52, 94, 0.3);
      transition: all 0.2s ease;
      z-index: 99;
      opacity: 0.85;
    }}

    .btn-top:hover {{
      opacity: 1;
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(24, 52, 94, 0.4);
    }}

    /* =========================================================================
       8. OFFICIAL FOOTER (PRIME PROJECTX & PT PRIME INFINITY SYSTEMS)
       ========================================================================= */
    .app-footer {{
      background: #FFFFFF;
      border-top: 1.5px solid var(--border);
      padding: 3rem 2rem 2.5rem;
      color: var(--text-muted);
      font-size: 0.85rem;
    }}

    .footer-inner {{
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 2.5rem;
    }}

    .footer-brand {{
      display: flex;
      flex-direction: column;
      gap: 12px;
    }}

    .footer-logo-row {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .footer-logo {{
      height: 44px;
      width: auto;
    }}

    .footer-brand-title {{
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--primary);
      line-height: 1.2;
    }}

    .footer-brand-desc {{
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.6;
      max-width: 480px;
    }}

    .footer-col h4 {{
      font-size: 0.85rem;
      font-weight: 800;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.9rem;
    }}

    .footer-links {{
      list-style: none;
      margin-left: 0;
    }}

    .footer-links li {{
      margin-bottom: 0.5rem;
    }}

    .footer-links a {{
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s;
    }}

    .footer-links a:hover {{
      color: var(--accent);
    }}

    .footer-bottom-bar {{
      max-width: 1400px;
      margin: 2.5rem auto 0;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.78rem;
    }}

    .footer-legal {{
      color: #94A3B8;
    }}

    /* =========================================================================
       9. PRINT STYLING (@media print)
       ========================================================================= */
    @media print {{
      #readingProgressContainer, .top-header, .sidebar-toc, .btn-top, .search-wrapper, .btn-action, .role-navigator-bar, .mermaid-toolbar, .viewport-hint, .rbac-filter-panel {{
        display: none !important;
      }}
      .main-content {{
        max-width: 100% !important;
        padding: 0 !important;
        background: #FFFFFF !important;
      }}
      .doc-hero {{
        box-shadow: none !important;
        border: 1px solid #CBD5E1 !important;
        page-break-after: avoid;
      }}
      .table-container {{
        box-shadow: none !important;
        page-break-inside: avoid;
      }}
      .mermaid-card {{
        page-break-inside: avoid;
        box-shadow: none !important;
        border: 1px solid #CBD5E1 !important;
      }}
      .mermaid-viewport {{
        height: auto !important;
        background: #FFFFFF !important;
        overflow: visible !important;
      }}
      .mermaid-canvas {{
        transform: none !important;
      }}
      h2, h3 {{
        page-break-after: avoid;
      }}
    }}

    /* Mobile Responsive */
    @media (max-width: 1024px) {{
      .sidebar-toc {{
        display: none;
      }}
      .main-content {{
        max-width: 100%;
        padding: 1.5rem;
      }}
      .footer-inner {{
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }}
    }}
  </style>
</head>
<body>

  <!-- Top Reading Progress Indicator -->
  <div id="readingProgressContainer">
    <div id="readingProgressBar"></div>
  </div>

  <!-- =======================================================================
       TOP HEADER (BRANDING & NAVIGATION)
       ======================================================================= -->
  <header class="top-header">
    <a href="https://primeprojectx.net" target="_blank" class="brand-group" title="Prime Projectx Enterprise Portal">
      <img src="{logo_b64}" alt="Prime Projectx Logo" class="brand-logo">
      <div class="brand-text">
        <div class="brand-name">Prime Projectx</div>
        <div class="brand-sub">PT Prime Infinity Systems</div>
      </div>
    </a>

    <div class="header-actions">
      <div class="search-wrapper">
        <input type="text" id="searchInput" class="search-input" placeholder="Cari topik / modul...">
        <span class="search-match-badge" id="searchMatchBadge"></span>
      </div>
      <button class="btn-action btn-outline" onclick="window.print()">
        <span>🖨️</span> Cetak / PDF
      </button>
      <button class="btn-action btn-primary-action" onclick="scrollToRoleNavigator()">
        <span>⚡</span> Pilih Peran
      </button>
    </div>
  </header>

  <!-- =======================================================================
       MAIN CONTAINER (SIDEBAR TOC + CONTENT)
       ======================================================================= -->
  <div class="app-container">
    
    <!-- Sidebar Navigation -->
    <aside class="sidebar-toc">
      <div class="sidebar-header">
        <span>Daftar Isi Navigasi</span>
        <span>12 BAB SSOT</span>
      </div>
      {sidebar_toc_str}
    </aside>

    <!-- Main Content -->
    <main class="main-content">

      <!-- Document Hero Banner -->
      <section class="doc-hero">
        <div class="hero-meta-badge">
          <span>Official Enterprise Release</span> • <span>SSOT Standard</span>
        </div>
        <h1>BUKU PANDUAN PENGGUNAAN SISTEM<br/>PRIME HRIS ENTERPRISE</h1>
        <div class="doc-hero-sub">
          Panduan operasional komprehensif dengan pemisahan independen per peran (Role-Based Manual), 
          arsitektur 5-Tier RBAC, visualisasi flowchart interaktif definisi tinggi, tata kelola keterkaitan data (data lineage), 
          protokol presensi GPS satelit mandiri, formula penggajian Depnaker PP 35/2021, dan integrasi WhatsApp Baileys.
        </div>
        <div class="hero-info-grid">
          <div class="hero-info-item">
            <span>Nomor Dokumen</span>
            <span>DOC-PRIME-HRIS-MANUAL-2026-V3-SSOT</span>
          </div>
          <div class="hero-info-item">
            <span>Edisi / Versi</span>
            <span>v2.4-LTS (Visual HTML & Interactive SSOT Release)</span>
          </div>
          <div class="hero-info-item">
            <span>Lead Systems Architect</span>
            <span>Galih Primananda (Prime Projectx)</span>
          </div>
          <div class="hero-info-item">
            <span>Entitas Pengembang</span>
            <span>PT Prime Infinity Systems</span>
          </div>
        </div>
      </section>

      <!-- Interactive Role Navigator Bar -->
      <section class="role-navigator-bar" id="roleNavigatorSection">
        <div class="role-nav-header">
          <div class="role-nav-title">
            <span>⚡ Jalur Cepat Panduan Berdasarkan Peran (Role-Based Quick Access):</span>
          </div>
          <div class="role-nav-hint">
            <span>Pilih peran Anda untuk langsung membaca bab panduan tugas lapangan & modul sistem</span>
          </div>
        </div>
        <div class="role-pills-container">
          <button class="role-pill active" onclick="activateRoleFilter('all', this)">🌟 Semua Bab (Dokumen Lengkap)</button>
          <button class="role-pill" onclick="activateRoleFilter('staff', this)">👤 Staff / Teknisi Lapangan (Bab IV)</button>
          <button class="role-pill" onclick="activateRoleFilter('pm', this)">📋 Project Manager (Bab V)</button>
          <button class="role-pill" onclick="activateRoleFilter('hr', this)">👥 HR / Admin SDM (Bab VI)</button>
          <button class="role-pill" onclick="activateRoleFilter('finance', this)">💰 Finance & Payroll (Bab VII)</button>
          <button class="role-pill" onclick="activateRoleFilter('superuser', this)">⚡ Superuser / Direksi (Bab VIII)</button>
        </div>
      </section>

      <!-- Markdown Body Output -->
      <article id="manualContent">
        {body_html}
      </article>

    </main>
  </div>

  <!-- Fullscreen Diagram Modal -->
  <div id="fullscreenModal" class="fullscreen-modal">
    <div class="fs-header">
      <div class="fs-header-left">
        <span class="fs-badge">LAYAR PENUH</span>
        <span id="fsModalTitle" class="fs-title">Diagram Alur Visual</span>
      </div>
      <div class="mermaid-toolbar">
        <button type="button" class="tool-btn" onclick="fsPanZoom.zoom(0.15)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          <span>Zoom In</span>
        </button>
        <span class="zoom-badge" id="fsZoomBadge">100%</span>
        <button type="button" class="tool-btn" onclick="fsPanZoom.zoom(-0.15)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          <span>Zoom Out</span>
        </button>
        <button type="button" class="tool-btn" onclick="fsPanZoom.reset()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
          <span>Reset</span>
        </button>
        <button type="button" class="btn-close-modal" onclick="closeFullscreenModal()">
          ✕ Tutup (ESC)
        </button>
      </div>
    </div>
    <div class="fs-viewport" id="fsViewport">
      <div class="fs-hint">💡 Klik & geser mouse untuk menggeser alur • Scroll mouse untuk zoom • Tekan tombol ESC untuk kembali</div>
      <div class="fs-canvas" id="fsCanvas"></div>
    </div>
  </div>

  <!-- Back to top button -->
  <button class="btn-top" onclick="window.scrollTo({{top: 0, behavior: 'smooth'}})" title="Kembali ke atas">
    ↑
  </button>

  <!-- =======================================================================
       OFFICIAL FOOTER (PRIME PROJECTX & PT PRIME INFINITY SYSTEMS)
       ======================================================================= -->
  <footer class="app-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="footer-logo-row">
          <img src="{logo_b64}" alt="Prime Projectx Official Logo" class="footer-logo">
          <div>
            <div class="footer-brand-title">Prime Projectx</div>
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--secondary);">PT Prime Infinity Systems</div>
          </div>
        </div>
        <div class="footer-brand-desc">
          Platform arsitektur sistem cerdas, otomasi operasional manufaktur, data analytics terpadu, 
          dan eliminasi total gesekan birokrasi manual (Zero Manual System) di seluruh ekosistem perusahaan.
        </div>
      </div>

      <div class="footer-col">
        <h4>Ekosistem & Platform</h4>
        <ul class="footer-links">
          <li><a href="https://primeprojectx.net" target="_blank">🌐 primeprojectx.net (Portal Utama)</a></li>
          <li><a href="https://porto.primeprojectx.net" target="_blank">💼 Portofolio Resmi Architect</a></li>
          <li><a href="https://binus.primeprojectx.net" target="_blank">🎓 BINUS Simulation Portal</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Kontak Teknis & Konsultasi</h4>
        <ul class="footer-links">
          <li><strong>WhatsApp:</strong> <a href="https://wa.me/6289524257778" target="_blank">+62 895 2425 7778</a></li>
          <li><strong>Email:</strong> galih@primeprojectx.net</li>
          <li><strong>Lead Systems Architect:</strong> Galih Primananda</li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom-bar">
      <div class="footer-legal">
        © 2026 <strong>PT Prime Infinity Systems</strong> & <strong>Prime Projectx</strong>. Seluruh Hak Cipta Dilindungi Undang-Undang.
      </div>
      <div style="font-weight: 600; color: #64748B;">
        System-Automated Digital Enterprise Report • Zero Manual Signature Policy Enforced
      </div>
    </div>
  </footer>

  <!-- =======================================================================
       CLIENT-SIDE SCRIPTS (INTERACTIVITY, MERMAID PAN-ZOOM, RBAC FILTER)
       ======================================================================= -->
  <script>
    // 1. Reading Progress Bar
    window.addEventListener('scroll', () => {{
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      document.getElementById('readingProgressBar').style.width = scrolled + '%';
    }});

    // 2. Mermaid Initialization & Diagram Pan-Zoom Engine
    mermaid.initialize({{
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      fontFamily: 'Plus Jakarta Sans, Segoe UI, sans-serif',
      themeVariables: {{
        fontSize: '15px',
        fontFamily: 'Plus Jakarta Sans, Segoe UI, sans-serif',
        primaryColor: '#EFF6FF',
        primaryTextColor: '#18345E',
        primaryBorderColor: '#2563EB',
        lineColor: '#475569',
        secondaryColor: '#FFF7ED',
        tertiaryColor: '#F8FAFC',
        edgeLabelBackground: '#FFFFFF',
        nodeBorder: '#2563EB',
        mainBkg: '#FFFFFF',
        nodeTextColor: '#0F172A'
      }},
      flowchart: {{
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis',
        nodeSpacing: 45,
        rankSpacing: 55
      }}
    }});

    const diagramPanZoom = {{
      states: {{}},
      init() {{
        document.querySelectorAll('.mermaid-viewport').forEach((viewport, idx) => {{
          const canvas = viewport.querySelector('.mermaid-canvas');
          const badge = document.getElementById('zoom-badge-' + idx);
          this.states[idx] = {{
            scale: 1.0,
            initialScale: 1.0,
            x: 0,
            y: 0,
            isDragging: false,
            startX: 0,
            startY: 0,
            canvas: canvas,
            badge: badge,
            viewport: viewport
          }};

          // Mouse Wheel Zoom
          viewport.addEventListener('wheel', (e) => {{
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.12 : -0.12;
            this.zoom(idx, delta);
          }}, {{ passive: false }});

          // Drag to Pan
          viewport.addEventListener('mousedown', (e) => {{
            if (e.button !== 0) return;
            const state = this.states[idx];
            state.isDragging = true;
            state.startX = e.clientX - state.x;
            state.startY = e.clientY - state.y;
            viewport.classList.add('grabbing');
          }});

          window.addEventListener('mousemove', (e) => {{
            const state = this.states[idx];
            if (!state || !state.isDragging) return;
            state.x = e.clientX - state.startX;
            state.y = e.clientY - state.startY;
            this.applyTransform(idx);
          }});

          window.addEventListener('mouseup', () => {{
            const state = this.states[idx];
            if (state && state.isDragging) {{
              state.isDragging = false;
              viewport.classList.remove('grabbing');
            }}
          }});

          // Double click to reset
          viewport.addEventListener('dblclick', () => {{
            this.reset(idx);
          }});
        }});
      }},
      applyTransform(idx) {{
        const state = this.states[idx];
        if (!state || !state.canvas) return;
        state.canvas.style.transform = `translate(${{state.x}}px, ${{state.y}}px) scale(${{state.scale}})`;
        if (state.badge) {{
          state.badge.textContent = `${{Math.round(state.scale * 100)}}%`;
        }}
      }},
      zoom(idx, delta) {{
        const state = this.states[idx];
        if (!state) return;
        const newScale = Math.max(0.3, Math.min(3.5, state.scale + delta));
        state.scale = Math.round(newScale * 100) / 100;
        this.applyTransform(idx);
      }},
      zoomIn(idx) {{ this.zoom(idx, 0.15); }},
      zoomOut(idx) {{ this.zoom(idx, -0.15); }},
      reset(idx) {{
        const state = this.states[idx];
        if (!state) return;
        state.scale = state.initialScale || 1.0;
        state.x = 0;
        state.y = 0;
        this.applyTransform(idx);
      }},
      fitDiagrams() {{
        document.querySelectorAll('.mermaid-viewport').forEach((viewport, idx) => {{
          const svg = viewport.querySelector('svg');
          if (!svg) return;
          const state = this.states[idx];
          const vpRect = viewport.getBoundingClientRect();
          const svgBBox = svg.getBBox ? svg.getBBox() : {{ width: svg.clientWidth, height: svg.clientHeight }};
          const svgWidth = svgBBox.width || svg.clientWidth || 900;
          const svgHeight = svgBBox.height || svg.clientHeight || 500;
          
          let scale = 1.0;
          if (svgWidth > vpRect.width - 60) {{
            scale = Math.max(0.65, (vpRect.width - 60) / svgWidth);
          }} else if (svgHeight > vpRect.height - 60) {{
            scale = Math.max(0.65, (vpRect.height - 60) / svgHeight);
          }}
          scale = Math.round(scale * 100) / 100;
          if (state) {{
            state.scale = scale;
            state.initialScale = scale;
            state.x = 0;
            state.y = 0;
            this.applyTransform(idx);
          }}
        }});
      }},
      openFullscreen(idx) {{
        const viewport = document.getElementById('viewport-' + idx);
        const svg = viewport.querySelector('svg');
        const card = document.getElementById('diagram-card-' + idx);
        const title = card.querySelector('.mermaid-title')?.textContent || 'Diagram Alur Visual';
        
        if (!svg) return;
        const modal = document.getElementById('fullscreenModal');
        const fsTitle = document.getElementById('fsModalTitle');
        const fsCanvas = document.getElementById('fsCanvas');
        
        fsTitle.textContent = title;
        fsCanvas.innerHTML = svg.outerHTML;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        fsPanZoom.init();
      }}
    }};

    // Fullscreen Pan-Zoom
    const fsPanZoom = {{
      scale: 1.0,
      x: 0,
      y: 0,
      isDragging: false,
      startX: 0,
      startY: 0,
      init() {{
        this.scale = 1.0;
        this.x = 0;
        this.y = 0;
        const viewport = document.getElementById('fsViewport');
        const canvas = document.getElementById('fsCanvas');
        const badge = document.getElementById('fsZoomBadge');
        
        const svg = canvas.querySelector('svg');
        if (svg) {{
          const vpRect = viewport.getBoundingClientRect();
          const svgBBox = svg.getBBox ? svg.getBBox() : {{ width: svg.clientWidth, height: svg.clientHeight }};
          const svgWidth = svgBBox.width || svg.clientWidth || 1000;
          const svgHeight = svgBBox.height || svg.clientHeight || 600;
          let scale = Math.min((vpRect.width - 80) / svgWidth, (vpRect.height - 80) / svgHeight);
          this.scale = Math.max(0.65, Math.min(1.6, Math.round(scale * 100) / 100));
        }}
        this.applyTransform();

        viewport.onwheel = (e) => {{
          e.preventDefault();
          this.zoom(e.deltaY < 0 ? 0.12 : -0.12);
        }};

        viewport.onmousedown = (e) => {{
          if (e.button !== 0) return;
          this.isDragging = true;
          this.startX = e.clientX - this.x;
          this.startY = e.clientY - this.y;
          viewport.classList.add('grabbing');
        }};

        window.onmousemove = (e) => {{
          if (!this.isDragging) return;
          this.x = e.clientX - this.startX;
          this.y = e.clientY - this.startY;
          this.applyTransform();
        }};

        window.onmouseup = () => {{
          if (this.isDragging) {{
            this.isDragging = false;
            viewport.classList.remove('grabbing');
          }}
        }};
      }},
      applyTransform() {{
        const canvas = document.getElementById('fsCanvas');
        const badge = document.getElementById('fsZoomBadge');
        if (canvas) canvas.style.transform = `translate(${{this.x}}px, ${{this.y}}px) scale(${{this.scale}})`;
        if (badge) badge.textContent = `${{Math.round(this.scale * 100)}}%`;
      }},
      zoom(delta) {{
        this.scale = Math.max(0.3, Math.min(4.0, Math.round((this.scale + delta) * 100) / 100));
        this.applyTransform();
      }},
      reset() {{
        this.scale = 1.0;
        this.x = 0;
        this.y = 0;
        this.applyTransform();
      }}
    }};

    function closeFullscreenModal() {{
      const modal = document.getElementById('fullscreenModal');
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }}

    window.addEventListener('keydown', (e) => {{
      if (e.key === 'Escape') closeFullscreenModal();
    }});

    // 3. Document Ready Initialization
    document.addEventListener("DOMContentLoaded", async function() {{
      // Initialize Pan-Zoom structures
      diagramPanZoom.init();

      // Render Mermaid Diagrams
      try {{
        await mermaid.run({{
          querySelector: '.mermaid'
        }});
        // Fit diagrams after rendering
        setTimeout(() => {{
          diagramPanZoom.fitDiagrams();
        }}, 300);
      }} catch (err) {{
        console.error("Mermaid render error:", err);
      }}

      // Render KaTeX Math
      if (typeof renderMathInElement === "function") {{
        renderMathInElement(document.body, {{
          delimiters: [
            {{left: "$$", right: "$$", display: true}},
            {{left: "$", right: "$", display: false}}
          ]
        }});
      }}

      // Setup Copy-to-Clipboard for code blocks
      document.querySelectorAll('pre').forEach(pre => {{
        const wrapper = document.createElement('div');
        wrapper.className = 'code-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Salin';
        copyBtn.onclick = () => {{
          navigator.clipboard.writeText(pre.innerText).then(() => {{
            copyBtn.textContent = 'Tersalin! ✓';
            setTimeout(() => copyBtn.textContent = 'Salin', 2000);
          }});
        }};
        wrapper.appendChild(copyBtn);
      }});
    }});

    // 4. Role Navigator Handler
    function scrollToRoleNavigator() {{
      const sec = document.getElementById('roleNavigatorSection');
      if (sec) sec.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
    }}

    function activateRoleFilter(role, btnElement) {{
      document.querySelectorAll('.role-pill').forEach(p => p.classList.remove('active'));
      if (btnElement) btnElement.classList.add('active');

      const chapterMap = {{
        'staff': 'bab-iv-panduan-operasional-mandiri--role-staff--teknisi',
        'pm': 'bab-v-panduan-operasional-mandiri--role-project-manager',
        'hr': 'bab-vi-panduan-operasional-mandiri--role-hr--admin-sdm',
        'finance': 'bab-vii-panduan-operasional-mandiri--role-finance--payroll-officer',
        'superuser': 'bab-viii-panduan-operasional-mandiri--role-superuser--platform-architect'
      }};

      if (role === 'all') {{
        window.scrollTo({{ top: 0, behavior: 'smooth' }});
        return;
      }}

      const targetId = chapterMap[role];
      if (targetId) {{
        const el = document.getElementById(targetId);
        if (el) {{
          el.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
          el.style.backgroundColor = '#FEF3C7';
          setTimeout(() => el.style.backgroundColor = '', 2000);
        }}
      }}
    }}

    // 5. Interactive RBAC Table Filter
    function filterRBACTable(role) {{
      document.querySelectorAll('.rbac-pill').forEach(p => p.classList.remove('active'));
      event.target.classList.add('active');

      const panel = document.getElementById('rbacFilterPanel');
      if (!panel) return;
      const table = panel.nextElementSibling?.querySelector('table');
      if (!table) return;

      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {{
        if (role === 'all') {{
          row.style.display = '';
          return;
        }}
        // Check column corresponding to role
        // Col 0: No, Col 1: Fitur, Col 2: Staff, Col 3: PM, Col 4: HR, Col 5: Finance, Col 6: Superuser
        const colMap = {{
          'staff': 2,
          'pm': 3,
          'hr': 4,
          'finance': 5,
          'superuser': 6
        }};
        const colIdx = colMap[role];
        const cell = row.children[colIdx];
        if (cell && !cell.textContent.includes('No Access')) {{
          row.style.display = '';
        }} else {{
          row.style.display = 'none';
        }}
      }});
    }}

    const rbacSearch = document.getElementById('rbacTableSearch');
    if (rbacSearch) {{
      rbacSearch.addEventListener('input', function(e) {{
        const q = e.target.value.toLowerCase().trim();
        const panel = document.getElementById('rbacFilterPanel');
        const table = panel.nextElementSibling?.querySelector('table');
        if (!table) return;
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {{
          if (!q || row.textContent.toLowerCase().includes(q)) {{
            row.style.display = '';
          }} else {{
            row.style.display = 'none';
          }}
        }});
      }});
    }}

    // 6. Global Search with Live Counter & Match Highlighting
    const searchInput = document.getElementById('searchInput');
    const matchBadge = document.getElementById('searchMatchBadge');
    const content = document.getElementById('manualContent');
    const searchableNodes = content.querySelectorAll('h2, h3, h4, p, li, td');

    searchInput.addEventListener('input', function(e) {{
      const query = e.target.value.toLowerCase().trim();
      searchableNodes.forEach(node => node.style.backgroundColor = '');

      if (!query) {{
        matchBadge.textContent = '';
        return;
      }}

      let matchCount = 0;
      let firstMatch = null;

      searchableNodes.forEach(node => {{
        if (node.textContent.toLowerCase().includes(query)) {{
          matchCount++;
          node.style.backgroundColor = 'rgba(255, 237, 74, 0.4)';
          if (!firstMatch) firstMatch = node;
        }}
      }});

      if (matchCount > 0) {{
        matchBadge.textContent = matchCount + ' ditemukan';
        if (firstMatch) {{
          firstMatch.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
        }}
      }} else {{
        matchBadge.textContent = '0 hasil';
      }}
    }});
  </script>

</body>
</html>"""

    # Target output paths
    out_desktop = r"C:\Users\prime\Desktop\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.html"
    out_docs = r"C:\Users\prime\prime-hris\docs\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.html"
    out_art = r"C:\Users\prime\.gemini\antigravity-cli\brain\4fbf6728-925d-466f-87af-e179e5f86f48\BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.html"

    with open(out_desktop, "w", encoding="utf-8") as f:
        f.write(html_template)
    print(f"[OK] Saved to Desktop: {out_desktop}")

    with open(out_docs, "w", encoding="utf-8") as f:
        f.write(html_template)
    print(f"[OK] Saved to docs: {out_docs}")

    if os.path.exists(os.path.dirname(out_art)):
        with open(out_art, "w", encoding="utf-8") as f:
            f.write(html_template)
        print(f"[OK] Saved to Artifact: {out_art}")

if __name__ == "__main__":
    build_html_manual()
