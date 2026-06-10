import os
import subprocess
import shutil


def get_primary_font(layout: dict) -> str:
    fonts = layout.get("fonts", [])
    if fonts:
        first = fonts[0]
        if isinstance(first, dict):
            return first.get("name", "Calibri") or "Calibri"
        return str(first)
    return "Calibri"


def get_primary_font_size(layout: dict) -> float:
    fonts = layout.get("fonts", [])
    if fonts:
        first = fonts[0]
        if isinstance(first, dict):
            size = first.get("size", 11)
            return float(size) if size else 11.0
    return 11.0


def convert_docx_to_pdf(docx_path: str, output_dir: str) -> str | None:
    """Convert DOCX to PDF using LibreOffice (if available) or return None."""
    libreoffice = _find_libreoffice()
    if not libreoffice:
        return None
    try:
        subprocess.run(
            [libreoffice, "--headless", "--convert-to", "pdf", "--outdir", output_dir, docx_path],
            check=True, capture_output=True, timeout=60
        )
        pdf_name = os.path.splitext(os.path.basename(docx_path))[0] + ".pdf"
        result = os.path.join(output_dir, pdf_name)
        return result if os.path.exists(result) else None
    except Exception:
        return None


def _find_libreoffice() -> str | None:
    candidates = [
        "libreoffice",
        "soffice",
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "/usr/bin/libreoffice",
        "/usr/bin/soffice",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ]
    for c in candidates:
        if shutil.which(c) or os.path.exists(c):
            return c
    return None
