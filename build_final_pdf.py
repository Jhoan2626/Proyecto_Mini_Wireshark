import os
import re
import base64
import subprocess
import tempfile
import markdown

DOCS_DIR = os.path.abspath("docs")
MD_PATH = os.path.join(DOCS_DIR, "INFORME_PROYECTO_FINAL_REDES1.md")
PDF_PATH = os.path.join(DOCS_DIR, "INFORME_PROYECTO_FINAL_REDES1.pdf")
HTML_PATH = os.path.join(DOCS_DIR, "INFORME_PROYECTO_FINAL_REDES1.html")
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def get_base64_image(filename):
    path = os.path.join(DOCS_DIR, filename)
    with open(path, "rb") as f:
        data = f.read()
    b64 = base64.b64encode(data).decode("utf-8")
    return f"data:image/png;base64,{b64}"

def get_svg_content(filename):
    path = os.path.join(DOCS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        svg = f.read()
    # Strip any fixed max-width and force responsive display
    svg = re.sub(r'style="[^"]*max-width:[^"]*"', 'style="width: 100%; max-width: 100%; height: auto;"', svg)
    if 'style=' not in svg[:160]:
        svg = svg.replace('<svg ', '<svg style="width: 100%; max-width: 100%; height: auto;" ', 1)
    return svg

def format_inline_md(text):
    # Convert inline code
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    # Convert bold **...**
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    # Convert italic *...*
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', text)
    return text

def preprocess_markdown(text):
    # 1. Transform GitHub alerts (> [!NOTE], > [!IMPORTANT], > [!TIP], > [!WARNING])
    alert_map = {
        'NOTE': ('Nota:', '#334155', '#f8fafc'),
        'IMPORTANT': ('Importante:', '#0f172a', '#f1f5f9'),
        'TIP': ('Recomendación:', '#1e293b', '#f8fafc'),
        'WARNING': ('Advertencia:', '#475569', '#f8fafc')
    }
    
    lines = text.split('\n')
    processed_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        alert_match = re.match(r'^>\s*\[!(NOTE|IMPORTANT|TIP|WARNING)\]\s*$', line.strip(), re.IGNORECASE)
        if alert_match:
            kind = alert_match.group(1).upper()
            label, border_col, bg_col = alert_map[kind]
            
            # Collect blockquote body
            body_lines = []
            i += 1
            while i < len(lines) and lines[i].strip().startswith('>'):
                cleaned = re.sub(r'^>\s?', '', lines[i])
                body_lines.append(cleaned)
                i += 1
            
            raw_body = ' '.join(body_lines).strip()
            formatted_body = format_inline_md(raw_body)
            
            # Format as clean HTML callout
            callout_html = (
                f'<div class="callout callout-{kind.lower()}" style="border-left: 3.5px solid {border_col}; background-color: {bg_col};">'
                f'<p><strong class="callout-label">{label}</strong> {formatted_body}</p>'
                f'</div>\n'
            )
            processed_lines.append(callout_html)
            continue
        else:
            processed_lines.append(line)
            i += 1
            
    text = '\n'.join(processed_lines)
    
    # 2. Extract and replace mermaid diagrams
    diagram_files = ['diagram_1.svg', 'diagram_2.svg', 'diagram_3.svg', 'diagram_4.svg']
    diagram_captions = [
        "Diagrama 1: Arquitectura del Sistema (Backend Scapy → API Flask Concurrente → Frontend React)",
        "Diagrama 2: Flujo de Desencapsulación OSI de un Paquete Capturado en el Motor",
        "Diagrama 3: Secuencia de Interacción Cliente–Servidor (Sondeo incremental y ciclo de captura)",
        "Diagrama 4: Cronograma de Ejecución y Metodología por Fases del Proyecto"
    ]
    
    diagram_idx = 0
    mermaid_pattern = re.compile(r'```mermaid\s*\n(.*?)\n```', re.DOTALL)
    
    def replace_mermaid(match):
        nonlocal diagram_idx
        if diagram_idx < len(diagram_files):
            svg_content = get_svg_content(diagram_files[diagram_idx])
            caption = diagram_captions[diagram_idx]
            diagram_idx += 1
            return (
                f'\n\n<div class="diagram-figure">\n'
                f'  <div class="diagram-wrapper">{svg_content}</div>\n'
                f'  <div class="diagram-caption"><em>{caption}</em></div>\n'
                f'</div>\n\n'
            )
        return match.group(0)

    text = mermaid_pattern.sub(replace_mermaid, text)
    
    # 3. Replace figure markers with real base64 images
    # Figura 1: Escenario A
    b64_a = get_base64_image("Escenario A.png")
    fig1_html = (
        f'<div class="image-figure">\n'
        f'  <img src="{b64_a}" alt="Captura del Inspector OSI — Escenario A" />\n'
        f'  <div class="figure-caption"><em>Figura 1: Captura del Inspector OSI — Escenario A (Tráfico HTTP con documento en texto plano e inspección multicapa)</em></div>\n'
        f'</div>'
    )
    text = re.sub(r'!\[Captura del Inspector OSI — Escenario A\]\([^\)]+\)\s*\n\*Figura 1:[^\*]+\*', fig1_html, text)
    text = re.sub(r'\*Figura 1: `\[Insertar captura del Inspector OSI — Escenario A\]`\*', fig1_html, text)
    
    # Figura 2: Escenario B
    b64_b = get_base64_image("Escenario B.png")
    fig2_html = (
        f'<div class="image-figure">\n'
        f'  <img src="{b64_b}" alt="Captura del Inspector OSI — Escenario B" />\n'
        f'  <div class="figure-caption"><em>Figura 2: Captura del Inspector OSI — Escenario B (Resolución de nombres DNS sobre UDP y descubrimiento ARP en red local)</em></div>\n'
        f'</div>'
    )
    text = re.sub(r'!\[Captura del Inspector OSI — Escenario B\]\([^\)]+\)\s*\n\*Figura 2:[^\*]+\*', fig2_html, text)
    text = re.sub(r'\*Figura 2: `\[Insertar capturas del Inspector OSI — DNS y ARP\]`\*', fig2_html, text)
    
    # Figura 3: Escenario C
    b64_c = get_base64_image("Escenario C.png")
    fig3_html = (
        f'<div class="image-figure">\n'
        f'  <img src="{b64_c}" alt="Captura del Inspector OSI — Escenario C" />\n'
        f'  <div class="figure-caption"><em>Figura 3: Captura del Inspector OSI — Escenario C (Diagnóstico de conectividad con Ping / ICMP en Capa 3 sin puertos de Capa 4)</em></div>\n'
        f'</div>'
    )
    text = re.sub(r'!\[Captura del Inspector OSI — Escenario C\]\([^\)]+\)\s*\n\*Figura 3:[^\*]+\*', fig3_html, text)
    text = re.sub(r'\*Figura 3: `\[Insertar captura del Inspector OSI — Escenario C\]`\*', fig3_html, text)

    return text

def tag_tables(html):
    # Differentiate tables based on their headers
    def replace_table(match):
        tbl = match.group(0)
        if 'Prompt / Instrucción técnica' in tbl:
            return tbl.replace('<table>', '<div class="table-container table-bitacora"><table>')
        elif 'Subtotal (COP)' in tbl or 'Rubro' in tbl:
            return tbl.replace('<table>', '<div class="table-container table-presupuesto"><table>')
        elif 'Requisito (Spec)' in tbl and 'Indicador' in tbl:
            return tbl.replace('<table>', '<div class="table-container table-indicadores"><table>')
        elif 'Hito / Evidencia' in tbl and 'Fase / Actividad' in tbl:
            return tbl.replace('<table>', '<div class="table-container table-cronograma"><table>')
        elif 'Wireshark (GUI)' in tbl:
            return tbl.replace('<table>', '<div class="table-container table-alternativas"><table>')
        elif 'Docente' in tbl or 'Asignatura' in tbl:
            return tbl.replace('<table>', '<div class="table-container table-metadata"><table>')
        else:
            return tbl.replace('<table>', '<div class="table-container"><table>')
            
    html = re.sub(r'<table>.*?</table>', replace_table, html, flags=re.DOTALL)
    # Wrap closing tags
    html = html.replace('</table>', '</table></div>')
    # Clean any double wrappers
    html = re.sub(r'<div class="table-container[^"]*"><div class="table-container[^"]*">', '<div class="table-container">', html)
    html = re.sub(r'</div></div>', '</div>', html)
    return html

def build_html():
    with open(MD_PATH, "r", encoding="utf-8") as f:
        raw_md = f.read()
        
    preprocessed_md = preprocess_markdown(raw_md)
    
    # Convert markdown to HTML using extensions
    md_converter = markdown.Markdown(extensions=[
        'tables',
        'fenced_code',
        'sane_lists'
    ])
    
    html_body = md_converter.convert(preprocessed_md)
    
    # Post-process HTML for styling
    # 1. Page breaks for major sections
    html_body = re.sub(r'<h2>Tabla de Contenido</h2>', '<div class="toc-wrapper"><h2>Tabla de Contenido</h2>', html_body)
    html_body = re.sub(r'(<div class="toc-wrapper">.*?)(<hr\s*/?>)', r'\1</div>\2<div class="page-break"></div>', html_body, flags=re.DOTALL)
    
    sections = [
        ("SECCIÓN 1:", "SECCIÓN 1: ANÁLISIS DE LA NECESIDAD"),
        ("SECCIÓN 2:", "SECCIÓN 2: MARCO TÉCNICO Y METODOLOGÍA"),
        ("SECCIÓN 3:", "SECCIÓN 3: DISEÑO DE LA SOLUCIÓN"),
        ("SECCIÓN 4:", "SECCIÓN 4: RECURSOS TÉCNICOS, HUMANOS, FINANCIEROS Y CRONOGRAMA"),
        ("SECCIÓN 5:", "SECCIÓN 5: PRUEBA DE CONCEPTO — PoC"),
        ("SECCIÓN 6:", "SECCIÓN 6: CONCLUSIONES TÉCNICAS DEL PROYECTO"),
        ("ANEXO OBLIGATORIO:", "ANEXO OBLIGATORIO: BITÁCORA DE USO Y VERIFICACIÓN DE INTELIGENCIA ARTIFICIAL"),
        ("Referencias Bibliográficas", "Referencias Bibliográficas")
    ]
    
    for s_id, s_title in sections:
        pattern = rf'<h2>\s*{re.escape(s_id)}[^<]*</h2>'
        replacement = f'<div class="page-break"></div><h2 class="section-title">{s_title}</h2>'
        html_body = re.sub(pattern, replacement, html_body)
        
    # Tag tables with specialized classes
    html_body = tag_tables(html_body)
    
    # 3. Clean academic CSS
    css = '''
    @page {
        size: letter;
        margin-top: 2.2cm;
        margin-bottom: 2.2cm;
        margin-left: 2.54cm;
        margin-right: 2.54cm;
    }
    
    *, *:before, *:after {
        box-sizing: border-box;
    }
    
    html, body {
        background-color: #ffffff;
        color: #000000;
        font-family: Arial, Calibri, 'Helvetica Neue', Inter, sans-serif;
        font-size: 11pt;
        line-height: 1.15;
        margin: 0;
        padding: 0;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
    }
    
    p {
        margin-top: 0;
        margin-bottom: 7pt;
        text-align: justify;
        text-justify: inter-word;
    }
    
    li {
        margin-bottom: 3.5pt;
        text-align: justify;
    }
    
    ul, ol {
        margin-top: 0;
        margin-bottom: 7pt;
        padding-left: 22px;
    }
    
    /* Titulos Academicos */
    h1 {
        font-size: 19pt;
        font-weight: bold;
        color: #000000;
        margin-top: 0;
        margin-bottom: 8pt;
        line-height: 1.15;
        text-align: center;
        page-break-after: avoid;
    }
    
    h2 {
        font-size: 13.5pt;
        font-weight: bold;
        color: #111827;
        margin-top: 14pt;
        margin-bottom: 6pt;
        line-height: 1.15;
        page-break-after: avoid;
    }
    
    h2.section-title {
        font-size: 13.5pt;
        font-weight: bold;
        border-bottom: 1.5pt solid #000000;
        padding-bottom: 3.5pt;
        margin-top: 0;
        margin-bottom: 11pt;
        color: #000000;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }
    
    h3 {
        font-size: 12pt;
        font-weight: bold;
        color: #1f2937;
        margin-top: 12pt;
        margin-bottom: 5pt;
        line-height: 1.15;
        page-break-after: avoid;
    }
    
    h4 {
        font-size: 11pt;
        font-weight: bold;
        color: #374151;
        margin-top: 9pt;
        margin-bottom: 4pt;
        line-height: 1.15;
        page-break-after: avoid;
    }
    
    /* Separadores y saltos de pagina */
    hr {
        border: none;
        border-top: 1px solid #d1d5db;
        margin: 12pt 0;
    }
    
    .page-break {
        page-break-before: always;
        height: 0;
        margin: 0;
    }
    
    /* Tabla de Contenido */
    .toc-wrapper {
        background-color: #fafafa;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 12pt 18pt;
        margin: 12pt 0;
    }
    .toc-wrapper h2 {
        margin-top: 0;
        font-size: 13pt;
        border-bottom: 1px solid #d1d5db;
        padding-bottom: 4pt;
    }
    .toc-wrapper ol {
        margin: 0;
        padding-left: 20px;
    }
    .toc-wrapper li {
        font-size: 10.5pt;
        margin-bottom: 4.5pt;
    }
    .toc-wrapper a {
        color: #111827;
        text-decoration: none;
        font-weight: 500;
    }
    
    /* Tablas Academicas Estandar */
    .table-container {
        width: 100%;
        margin: 8pt 0 11pt 0;
        overflow: hidden;
        page-break-inside: auto;
    }
    
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 9.5pt;
        line-height: 1.2;
        border: 1px solid #cbd5e1;
    }
    
    thead {
        display: table-header-group;
    }
    
    tr {
        page-break-inside: avoid;
    }
    
    th {
        background-color: #f2f2f2;
        color: #000000;
        font-weight: bold;
        text-align: left;
        padding: 5.5px 7px;
        border: 1px solid #cbd5e1;
        font-size: 9.5pt;
    }
    
    td {
        padding: 5px 7px;
        border: 1px solid #e2e8f0;
        vertical-align: top;
        font-size: 9pt;
        text-align: left;
    }
    
    tbody tr:nth-child(even) {
        background-color: #fafafa;
    }
    
    /* Tablas Especiales */
    /* Metadatos */
    .table-metadata table {
        width: 95%;
        margin: 0 auto;
        border: 1px solid #cbd5e1;
    }
    .table-metadata th {
        background-color: #f1f5f9;
        font-size: 9.5pt;
        padding: 6px 10px;
    }
    .table-metadata td {
        font-size: 9.5pt;
        padding: 6px 10px;
    }
    .table-metadata td:first-child {
        width: 25%;
        font-weight: bold;
        background-color: #f8fafc;
    }
    
    /* Presupuesto */
    .table-presupuesto table {
        font-size: 8.5pt;
    }
    .table-presupuesto th, .table-presupuesto td {
        padding: 4.5px 5.5px;
        font-size: 8.5pt;
    }
    .table-presupuesto th:nth-child(1), .table-presupuesto td:nth-child(1) { width: 4%; text-align: center; }
    .table-presupuesto th:nth-child(2), .table-presupuesto td:nth-child(2) { width: 28%; font-weight: 500; }
    .table-presupuesto th:nth-child(3), .table-presupuesto td:nth-child(3) { width: 28%; }
    .table-presupuesto th:nth-child(4), .table-presupuesto td:nth-child(4) { width: 14%; text-align: center; }
    .table-presupuesto th:nth-child(5), .table-presupuesto td:nth-child(5) { width: 13%; text-align: right; }
    .table-presupuesto th:nth-child(6), .table-presupuesto td:nth-child(6) { width: 13%; text-align: right; }
    
    /* Bitacora de IA */
    .table-bitacora table {
        font-size: 8.2pt;
    }
    .table-bitacora th, .table-bitacora td {
        padding: 4.5px 6px;
        font-size: 8.2pt;
        line-height: 1.2;
    }
    .table-bitacora th:nth-child(1), .table-bitacora td:nth-child(1) { width: 18%; font-weight: bold; }
    .table-bitacora th:nth-child(2), .table-bitacora td:nth-child(2) { width: 30%; }
    .table-bitacora th:nth-child(3), .table-bitacora td:nth-child(3) { width: 24%; }
    .table-bitacora th:nth-child(4), .table-bitacora td:nth-child(4) { width: 28%; }
    
    /* Indicadores Cuantitativos */
    .table-indicadores table {
        font-size: 8.5pt;
    }
    .table-indicadores th, .table-indicadores td {
        padding: 4.5px 6px;
        font-size: 8.5pt;
    }
    .table-indicadores th:nth-child(1), .table-indicadores td:nth-child(1) { width: 4%; text-align: center; }
    .table-indicadores th:nth-child(2), .table-indicadores td:nth-child(2) { width: 33%; }
    .table-indicadores th:nth-child(3), .table-indicadores td:nth-child(3) { width: 15%; }
    .table-indicadores th:nth-child(4), .table-indicadores td:nth-child(4) { width: 42%; }
    .table-indicadores th:nth-child(5), .table-indicadores td:nth-child(5) { width: 6%; text-align: center; }
    
    /* Cronograma */
    .table-cronograma table {
        font-size: 8.5pt;
    }
    .table-cronograma th, .table-cronograma td {
        padding: 4.5px 5.5px;
        font-size: 8.5pt;
    }
    .table-cronograma th:nth-child(1), .table-cronograma td:nth-child(1) { width: 4%; text-align: center; }
    .table-cronograma th:nth-child(2), .table-cronograma td:nth-child(2) { width: 33%; }
    .table-cronograma th:nth-child(3), .table-cronograma td:nth-child(3) { width: 13%; text-align: center; }
    .table-cronograma th:nth-child(4), .table-cronograma td:nth-child(4) { width: 12%; text-align: center; }
    .table-cronograma th:nth-child(5), .table-cronograma td:nth-child(5) { width: 12%; text-align: center; }
    .table-cronograma th:nth-child(6), .table-cronograma td:nth-child(6) { width: 26%; }

    /* Codigo y JSON */
    pre {
        background-color: #fafafa;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        padding: 8px 10px;
        margin: 8pt 0;
        overflow-x: auto;
        font-family: Consolas, 'Courier New', monospace;
        font-size: 8.5pt;
        line-height: 1.3;
        white-space: pre-wrap;
        word-break: break-all;
        page-break-inside: avoid;
    }
    
    code {
        font-family: Consolas, 'Courier New', monospace;
        font-size: 9pt;
        background-color: #f1f5f9;
        padding: 1px 4px;
        border: 1px solid #e2e8f0;
        border-radius: 3px;
        color: #0f172a;
    }
    
    pre code {
        background: transparent;
        border: none;
        padding: 0;
        font-size: 8.5pt;
        color: #111827;
    }
    
    /* Bloques de Alerta Formales (Transformacion de GitHub alerts) */
    .callout {
        margin: 9pt 0;
        padding: 7pt 11pt;
        border-radius: 0 4px 4px 0;
        page-break-inside: avoid;
    }
    
    .callout p {
        margin: 0;
        font-size: 9.8pt;
        line-height: 1.25;
        color: #111827;
        text-align: justify;
    }
    
    .callout-label {
        font-weight: bold;
        color: #000000;
    }
    
    /* Figuras e Imagenes Reales */
    .image-figure {
        text-align: center;
        margin: 11pt 0 9pt 0;
        page-break-inside: avoid;
    }
    
    .image-figure img {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 0 auto;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
    }
    
    .figure-caption, .diagram-caption {
        font-size: 9pt;
        font-style: italic;
        color: #334155;
        margin-top: 5pt;
        margin-bottom: 9pt;
        text-align: center;
    }
    
    /* Diagramas Mermaid Renderizados */
    .diagram-figure {
        text-align: center;
        margin: 11pt 0 9pt 0;
        page-break-inside: avoid;
    }
    
    .diagram-wrapper {
        display: block;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        padding: 8px;
        margin: 0 auto;
        overflow: hidden;
    }
    
    .diagram-wrapper svg {
        display: block;
        margin: 0 auto;
        max-width: 100% !important;
        height: auto !important;
    }
    
    /* Blockquotes regulares */
    blockquote {
        margin: 8pt 0;
        padding: 6pt 11pt;
        border-left: 3px solid #94a3b8;
        background-color: #f8fafc;
        color: #334155;
        page-break-inside: avoid;
    }
    
    blockquote p {
        margin: 0;
    }
    '''
    
    full_html = f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Informe de Proyecto Final — Redes 1 | Mini-Wireshark</title>
<style>
{css}
</style>
</head>
<body>
{html_body}
</body>
</html>'''

    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(full_html)
        
    print(f"Generated HTML: {HTML_PATH} ({os.path.getsize(HTML_PATH)} bytes)")
    return HTML_PATH

def convert_html_to_pdf(html_path):
    file_url = "file:///" + html_path.replace("\\", "/")
    tmpdir = tempfile.mkdtemp()
    
    header_tmpl = '<div style="font-size: 8pt; font-family: Arial, sans-serif; color: #64748b; width: 100%; border-bottom: 0.5pt solid #cbd5e1; padding-bottom: 3px; margin: 0 1in; display: flex; justify-content: space-between;"><span>Mini-Wireshark: Analizador Pedagógico OSI — Redes 1</span><span>Proyecto Final</span></div>'
    footer_tmpl = '<div style="font-size: 8.5pt; font-family: Arial, sans-serif; color: #64748b; width: 100%; margin: 0 1in; display: flex; justify-content: space-between;"><span>Universidad · SDD</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>'
    
    cmd = [
        CHROME_PATH,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-software-rasterizer",
        f"--user-data-dir={tmpdir}/profile",
        "--display-header-footer",
        f"--header-template={header_tmpl}",
        f"--footer-template={footer_tmpl}",
        f"--print-to-pdf={PDF_PATH}",
        file_url
    ]
    
    print("Executing Chrome headless PDF generation...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("Chrome error:", res.stderr)
        raise RuntimeError(f"Chrome exited with code {res.returncode}")
        
    if os.path.exists(PDF_PATH):
        print(f"SUCCESS: Created PDF at {PDF_PATH} ({os.path.getsize(PDF_PATH)} bytes)")
    else:
        raise RuntimeError("PDF was not created!")

if __name__ == "__main__":
    html_file = build_html()
    convert_html_to_pdf(html_file)
