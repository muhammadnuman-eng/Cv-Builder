import httpx
from fastapi import HTTPException
from config import settings


async def call_huggingface(prompt: str, max_tokens: int = 2048) -> str:
    if not settings.HUGGINGFACE_API_KEY:
        raise HTTPException(status_code=503, detail="HuggingFace API key not configured")

    url = f"https://api-inference.huggingface.co/models/{settings.HUGGINGFACE_MODEL}"
    headers = {"Authorization": f"Bearer {settings.HUGGINGFACE_API_KEY}"}
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": max_tokens,
            "temperature": 0.4,
            "do_sample": True,
            "return_full_text": False,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        if response.status_code == 503:
            raise HTTPException(status_code=503, detail="AI model is loading, please retry in 30 seconds")
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list) and data:
            return data[0].get("generated_text", "").strip()
        return ""
