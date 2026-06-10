import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from parser.services.pdf_parser import parse_pdf
from parser.services.docx_parser import parse_docx
from parser.services.layout_extractor import extract_cv_sections
from storage.services.file_manager import get_file_path
from auth.services.jwt import verify_token

router = APIRouter()

class ParseRequest(BaseModel):
    filename: str

@router.post("/parse")
async def parse_cv(data: ParseRequest, user_id: int = Depends(verify_token)):
    # Sanitize filename to prevent directory traversal
    safe_filename = os.path.basename(data.filename)
    filepath = get_file_path(safe_filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    ext = safe_filename.rsplit(".", 1)[-1].lower()

    if ext == "pdf":
        parsed = parse_pdf(filepath)
    elif ext == "docx":
        parsed = parse_docx(filepath)
    else:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX supported")

    sections = extract_cv_sections(parsed["raw_text"])

    return {
        "filename": safe_filename,
        "format": ext,
        "sections": sections,
        "layout": parsed.get("layout", {}),
        "raw_text": parsed["raw_text"]
    }
