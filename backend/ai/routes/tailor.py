from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ai.services.jd_analyzer import analyze_jd
from ai.services.cv_tailor import tailor_cv
from auth.services.jwt import verify_token

router = APIRouter()

class TailorRequest(BaseModel):
    cv_sections: dict
    cv_layout: dict
    job_description: str
    original_format: str

class AnalyzeJDRequest(BaseModel):
    job_description: str

@router.post("/tailor")
async def tailor(data: TailorRequest, user_id: int = Depends(verify_token)):
    if not data.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty")

    jd_analysis = await analyze_jd(data.job_description)
    tailored_sections, experience_replacements = await tailor_cv(
        data.cv_sections, jd_analysis, data.original_format
    )

    # Attach bullet replacements to layout so the PDF generator can do targeted replacement
    updated_layout = dict(data.cv_layout)
    updated_layout['experience_replacements'] = experience_replacements

    return {
        "tailored_sections": tailored_sections,
        "detected_stacks": jd_analysis["detected_stacks"],
        "original_format": data.original_format,
        "cv_layout": updated_layout
    }

@router.post("/analyze-jd")
async def analyze_job_description(data: AnalyzeJDRequest, user_id: int = Depends(verify_token)):
    if not data.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty")
    return await analyze_jd(data.job_description)
