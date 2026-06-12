import httpx
from fastapi import HTTPException
from config import settings

DASHSCOPE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"

async def call_qwen(prompt: str, max_tokens: int = 2000, model: str = None) -> str:
    if not settings.DASHSCOPE_API_KEY:
        raise HTTPException(status_code=503, detail="DashScope API key not configured")

    headers = {
        "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model or settings.QWEN_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.4
    }

    # Full-CV rewrites can produce thousands of tokens — allow several minutes
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=15.0)) as client:
            response = await client.post(DASHSCOPE_URL, json=payload, headers=headers)
    except httpx.TimeoutException:
        print(f"[qwen] TIMEOUT after 300s (model={payload['model']}, max_tokens={max_tokens})")
        raise HTTPException(status_code=504, detail="AI request timed out — please try again")
    except httpx.HTTPError as e:
        print(f"[qwen] connection error: {e!r}")
        raise HTTPException(status_code=502, detail=f"Could not reach AI service: {e}")

    if not response.is_success:
        print(f"[qwen] API error {response.status_code}: {response.text[:500]}")
        raise HTTPException(status_code=500, detail=f"Qwen error {response.status_code}: {response.text}")
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()
