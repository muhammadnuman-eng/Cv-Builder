import fitz  # PyMuPDF
from fastapi import HTTPException


def parse_pdf(filepath: str) -> dict:
    try:
        doc = fitz.open(filepath)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Cannot open PDF: {e}")

    result = {
        "raw_text": "",
        "pages": [],
        "layout": {"fonts": [], "page_size": {}},
    }
    fonts_seen: set[str] = set()

    all_parts: list[str] = []

    try:
        for page_num, page in enumerate(doc):
            page_dict = page.get_text("dict")

            # Extract blocks sorted top-to-bottom.
            # Use y-gap between consecutive blocks to decide separator:
            #   small gap (≤12pt)  → \n   (same job entry, consecutive lines)
            #   large gap (>12pt)  → \n\n (new paragraph / job entry)
            raw_blocks = page.get_text("blocks", sort=True)
            segments: list[str] = []
            prev_y1: float | None = None

            for b in raw_blocks:
                if b[6] != 0:          # skip image blocks
                    continue
                text = b[4].strip()
                if not text:
                    continue
                y0, y1 = b[1], b[3]
                if segments and prev_y1 is not None:
                    gap = y0 - prev_y1
                    segments.append("\n\n" if gap > 12 else "\n")
                segments.append(text)
                prev_y1 = y1

            page_text = "".join(segments)
            all_parts.append(page_text)
            result["pages"].append({"page_num": page_num + 1, "text": page_text})

            if page_num == 0:
                rect = page.rect
                result["layout"]["page_size"] = {
                    "width": rect.width,
                    "height": rect.height,
                }

            for block in page_dict.get("blocks", []):
                if block.get("type") == 0:
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            font = span.get("font", "")
                            if font and font not in fonts_seen:
                                fonts_seen.add(font)
                                result["layout"]["fonts"].append({
                                    "name": font,
                                    "size": span.get("size", 11),
                                    "color": span.get("color", 0),
                                })
    finally:
        doc.close()

    result["raw_text"] = "\n\n".join(all_parts)

    if not result["raw_text"].strip():
        raise HTTPException(status_code=422, detail="PDF appears to be empty or image-only (no extractable text)")

    return result
