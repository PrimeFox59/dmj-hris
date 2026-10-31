"""
PRIME HRIS ENTERPRISE - HTML MANUAL GENERATOR
Mengemas dokumen BUKU_PANDUAN_PENGGUNAAN_PRIME_HRIS.md ke dalam format HTML interaktif enterprise.
Mencakup:
1. Header & Footer resmi Prime Projectx (https://primeprojectx.net) dan PT Prime Infinity Systems beserta logo 3D PX.
2. Render interaktif diagram Mermaid.js dan rumus matematis KaTeX.
3. Sidebar navigasi Table of Contents (TOC) sticky dengan smooth scrolling dan search filter.
4. Desain responsive modern berstandar enterprise (Deep Navy #18345E, Prime Orange #FF6B00, Segoe UI).
5. Styling print-friendly (@media print) untuk ekspor cetak PDF berstempel digital.
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
        
        # Format lines inside callout
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
    # Restore Mermaid blocks into proper <div class="mermaid"> containers
    for idx, raw_code in enumerate(mermaid_blocks):
        escaped_code = html.escape(raw_code)
        placeholder = f"<!--MERMAID_PLACEHOLDER_{idx}-->"
        mermaid_html = (
            f'<div class="mermaid-card">'
            f'  <div class="mermaid-card-header">'
            f'    <span class="mermaid-badge">DIAGRAM ALUR VISUAL</span>'
            f'    <span class="mermaid-legend">Interactive Flowchart</span>'
            f'  </div>'
            f'  <div class="mermaid-wrapper">'
            f'    <pre class="mermaid">{escaped_code}</pre>'
            f'  </div>'
            f'</div>'
        )
        html_text = html_text.replace(f"<p>{placeholder}</p>", mermaid_html)
        html_text = html_text.replace(placeholder, mermaid_html)

    # Wrap tables in responsive containers
    html_text = re.sub(r'(<table>[\s\S]*?</table>)', r'<div class="table-container">\1</div>', html_text)

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
    # Find all h2 and h3
    toc_items = []
    headers = re.findall(r'<h([23]) id="([^"]+)">([^<]+)</h[23]>', body_html)
    for level, hid, htitle in headers:
        toc_items.append({
            "level": int(level),
            "id": hid,
            "title": htitle.replace("&amp;", "&")
        })

    sidebar_toc_html = []
    sidebar_toc_html.append('<ul class="toc-list">')
    for item in toc_items:
        cls = "toc-h2" if item["level"] == 2 else "toc-h3"
        sidebar_toc_html.append(f'<li class="{cls}"><a href="#{item["id"]}">{item["title"]}</a></li>')
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
  <script>
    document.addEventListener("DOMContentLoaded", function() {{
      mermaid.initialize({{
        startOnLoad: true,
        theme: 'neutral',
        securityLevel: 'loose',
        fontFamily: 'Plus Jakarta Sans, Segoe UI, sans-serif'
      }});
      if (typeof renderMathInElement === "function") {{
        renderMathInElement(document.body, {{
          delimiters: [
            {{left: "$$", right: "$$", display: true}},
            {{left: "$", right: "$", display: false}}
          ]
        }});
      }}
    }});
  </script>

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
       1. TOP HEADER (STICKY BRANDING BAR)
       ========================================================================= */
    .top-header {{
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      height: 74px;
      background: rgba(255, 255, 255, 0.94);
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
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .brand-name .badge-orange {{
      background: linear-gradient(135deg, #FF6B00, #FF8533);
      color: #FFFFFF;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}

    .brand-sub {{
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--secondary);
      letter-spacing: 0.01em;
    }}

    .header-actions {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .search-input {{
      padding: 7px 14px;
      border: 1px solid var(--border-dark);
      border-radius: 10px;
      font-size: 0.85rem;
      font-family: inherit;
      width: 220px;
      outline: none;
      transition: all 0.2s ease;
      background: var(--bg);
    }}

    .search-input:focus {{
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(24, 52, 94, 0.1);
      width: 260px;
      background: #FFFFFF;
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

    .btn-primary {{
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #FFFFFF;
    }}

    .btn-primary:hover {{
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(24, 52, 94, 0.25);
    }}

    .btn-outline {{
      background: #FFFFFF;
      border: 1.5px solid var(--border-dark);
      color: var(--text);
    }}

    .btn-outline:hover {{
      border-color: var(--primary);
      color: var(--primary);
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
      padding: 2.5rem 3.5rem 6rem;
      max-width: calc(100% - var(--sidebar-width));
      background: var(--bg);
    }}

    /* Document Hero Header */
    .doc-hero {{
      background: linear-gradient(135deg, #18345E 0%, #283C5A 60%, #152238 100%);
      color: #FFFFFF;
      border-radius: 20px;
      padding: 2.8rem;
      margin-bottom: 2.5rem;
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
      font-size: 1.05rem;
      font-weight: 500;
      color: #CBD5E1;
      max-width: 860px;
      line-height: 1.6;
      margin-bottom: 1.8rem;
    }}

    .hero-info-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

    /* Typography & Section Styles */
    h2 {{
      font-size: 1.65rem;
      font-weight: 800;
      color: var(--primary);
      margin-top: 3rem;
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

    /* Mermaid Diagrams Card */
    .mermaid-card {{
      background: #FFFFFF;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.5rem;
      margin: 2rem 0;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    }}

    .mermaid-card-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.2rem;
      padding-bottom: 0.8rem;
      border-bottom: 1px solid #F1F5F9;
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

    .mermaid-legend {{
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
    }}

    .mermaid-wrapper {{
      overflow-x: auto;
      display: flex;
      justify-content: center;
      padding: 0.5rem 0;
    }}

    .mermaid svg {{
      max-width: 100%;
      height: auto;
    }}

    /* Code Blocks */
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
      margin: 1.2rem 0;
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
       3. OFFICIAL FOOTER (PRIME PROJECTX & PT PRIME INFINITY SYSTEMS)
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
      font-size: 1.15rem;
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
       4. PRINT STYLING (@media print)
       ========================================================================= */
    @media print {{
      .top-header, .sidebar-toc, .btn-top, .search-input, .btn-action {{
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

  <!-- =======================================================================
       TOP HEADER (BRANDING & NAVIGATION)
       ======================================================================= -->
  <header class="top-header">
    <a href="https://primeprojectx.net" target="_blank" class="brand-group">
      <img src="{logo_b64}" alt="Prime Projectx Logo" class="brand-logo">
      <div class="brand-text">
        <div class="brand-name">
          <span>Prime Projectx</span>
          <span class="badge-orange">Enterprise</span>
        </div>
        <div class="brand-sub">PT Prime Infinity Systems</div>
      </div>
    </a>

    <div class="header-actions">
      <input type="text" id="searchInput" class="search-input" placeholder="Cari topik / menu...">
      <button class="btn-action btn-outline" onclick="window.print()">
        <span>🖨️</span> Cetak / PDF
      </button>
      <a href="https://github.com/PrimeFox59/prime-hris.git" target="_blank" class="btn-action btn-primary">
        <span>⚡</span> Repositori GitHub
      </a>
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
        <span>12 BAB</span>
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
          arsitektur 5-Tier RBAC, visualisasi flowchart interaktif, tata kelola keterkaitan data (data lineage), 
          protokol presensi GPS satelit mandiri, formula penggajian Depnaker PP 35/2021, dan integrasi WhatsApp Baileys.
        </div>
        <div class="hero-info-grid">
          <div class="hero-info-item">
            <span>Nomor Dokumen</span>
            <span>DOC-PRIME-HRIS-MANUAL-2026-V3-SSOT</span>
          </div>
          <div class="hero-info-item">
            <span>Edisi / Versi</span>
            <span>v2.4-LTS (Visual HTML & SSOT Release)</span>
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

      <!-- Markdown Body Output -->
      <article id="manualContent">
        {body_html}
      </article>

    </main>
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
          <li><a href="https://github.com/PrimeFox59/prime-hris.git" target="_blank">📂 GitHub SSOT prime-hris</a></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4>Kontak Teknis & Support</h4>
        <ul class="footer-links">
          <li><strong>WhatsApp:</strong> <a href="https://wa.me/6289524257778" target="_blank">+62 895 2425 7778</a></li>
          <li><strong>Email:</strong> galih@primeprojectx.net</li>
          <li><strong>Lead Architect:</strong> Galih Primananda</li>
          <li><strong>Status Server:</strong> High-Availability VPS (103.31.205.218)</li>
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

  <!-- Instant Search Script -->
  <script>
    const searchInput = document.getElementById('searchInput');
    const content = document.getElementById('manualContent');
    const sections = content.querySelectorAll('h2, h3, p, tr');

    searchInput.addEventListener('input', function(e) {{
      const query = e.target.value.toLowerCase().trim();
      if (!query) {{
        sections.forEach(s => s.style.backgroundColor = '');
        return;
      }}
      // Scroll to first match
      let found = false;
      sections.forEach(s => {{
        if (s.textContent.toLowerCase().includes(query)) {{
          if (!found) {{
            s.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
            found = true;
          }}
        }}
      }});
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
