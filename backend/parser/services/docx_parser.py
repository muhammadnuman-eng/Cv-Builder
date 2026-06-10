from docx import Document
from fastapi import HTTPException


def parse_docx(filepath: str) -> dict:
    try:
        doc = Document(filepath)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Cannot open DOCX: {e}")

    result = {
        "raw_text": "",
        "paragraphs": [],
        "layout": {"fonts": [], "styles": [], "colors": []},
    }
    fonts_seen: set[str] = set()
    styles_seen: set[str] = set()

    for para in doc.paragraphs:
        if not para.text.strip():
            continue

        para_data = {"text": para.text, "style": para.style.name, "runs": []}

        for run in para.runs:
            run_data = {
                "text":      run.text,
                "bold":      run.bold,
                "italic":    run.italic,
                "font_name": run.font.name,
                "font_size": run.font.size.pt if run.font.size else None,
            }
            para_data["runs"].append(run_data)

            if run.font.name and run.font.name not in fonts_seen:
                fonts_seen.add(run.font.name)
                result["layout"]["fonts"].append({
                    "name": run.font.name,
                    "size": run.font.size.pt if run.font.size else 11,
                })

        result["paragraphs"].append(para_data)
        result["raw_text"] += para.text + "\n"

        if para.style.name not in styles_seen:
            styles_seen.add(para.style.name)
            result["layout"]["styles"].append(para.style.name)

    if not result["raw_text"].strip():
        raise HTTPException(status_code=422, detail="DOCX appears to be empty")

    return result
