import os
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from generator.services.docx_generator import generate_docx
from generator.services.pdf_generator import generate_pdf
from generator.services.format_preserver import convert_docx_to_pdf
from auth.services.jwt import verify_token
from config import settings

router = APIRouter()

class GenerateRequest(BaseModel):
    tailored_sections: dict
    cv_layout: dict
    output_format: str       # "pdf" | "docx" | "both"
    original_format: str     # "pdf" | "docx"
    original_filename: str = ""  # original uploaded file name

@router.post("/generate")
async def generate(data: GenerateRequest, user_id: int = Depends(verify_token)):
    if data.output_format not in ("pdf", "docx", "both"):
        raise HTTPException(status_code=400, detail="output_format must be pdf, docx, or both")

    file_id = str(uuid.uuid4())
    os.makedirs(settings.GENERATED_DIR, exist_ok=True)
    files = {}

    # Sanitize original_filename to prevent directory traversal
    safe_orig = os.path.basename(data.original_filename) if data.original_filename else ""
    original_path = os.path.join(settings.UPLOAD_DIR, safe_orig) if safe_orig else None

    if data.output_format in ("docx", "both"):
        out = os.path.join(settings.GENERATED_DIR, f"{file_id}.docx")
        generate_docx(data.tailored_sections, data.cv_layout, out, original_path, data.original_format)
        files["docx"] = f"{file_id}.docx"

    if data.output_format in ("pdf", "both"):
        out = os.path.join(settings.GENERATED_DIR, f"{file_id}.pdf")
        # If original was DOCX, first generate DOCX then convert; else generate PDF directly
        if data.original_format == "docx" and original_path and os.path.exists(original_path):
            tmp_docx = os.path.join(settings.GENERATED_DIR, f"{file_id}_tmp.docx")
            generate_docx(data.tailored_sections, data.cv_layout, tmp_docx, original_path, data.original_format)
            converted = convert_docx_to_pdf(tmp_docx, settings.GENERATED_DIR)
            if converted and os.path.exists(converted):
                os.rename(converted, out)
            else:
                generate_pdf(data.tailored_sections, data.cv_layout, out, original_path)
            if os.path.exists(tmp_docx):
                os.remove(tmp_docx)
        else:
            generate_pdf(data.tailored_sections, data.cv_layout, out, original_path)
        files["pdf"] = f"{file_id}.pdf"

    return {"files": files, "message": "CV generated successfully"}

MEDIA_TYPES = {
    "pdf":  "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

@router.get("/download/{filename}")
async def download_generated(filename: str, user_id: int = Depends(verify_token)):
    filepath = os.path.join(settings.GENERATED_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    ext = filename.rsplit(".", 1)[-1].lower()
    media_type = MEDIA_TYPES.get(ext, "application/octet-stream")
    return FileResponse(
        filepath,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
