import re

SECTION_PATTERNS = {
    "summary": r"^(professional\s+profile|summary|objective|about\s*me|profile|overview|professional\s+summary|career\s+summary|personal\s+statement)",
    "experience": r"^(professional\s+experience|experience|work\s+experience|employment|career\s+history|work\s+history)",
    "education": r"^(education|academic|degree|university|college|qualification)",
    "skills": r"^(core\s+technical\s+skills|skills|technical\s+skills|technologies|tech\s+stack|tools|core\s+competencies|key\s+skills)",
    "projects": r"^(featured\s+projects|projects|key\s+projects|portfolio|personal\s+projects|notable\s+projects)",
    "certifications": r"^(certifications?|certificates?|courses?|training|licenses?)",
    "languages": r"^(languages?|spoken\s+languages?)",
    "awards": r"^(awards?|achievements?|honors?|recognition|accomplishments?)",
}

# Contact info patterns — these are detected inline (any line matching)
CONTACT_INLINE = re.compile(
    r"(?:^|\s)([\w.+-]+@[\w-]+\.[a-zA-Z]{2,})"           # email
    r"|(\+?\d[\d\s\-().]{6,}\d)"                           # phone
    r"|(linkedin\.com/in/[\w-]+)"                          # linkedin
    r"|(github\.com/[\w-]+)"                               # github
    r"|(portfolio|website)\s*[:\-]",                       # portfolio/website label
    re.IGNORECASE,
)


def extract_cv_sections(raw_text: str) -> dict:
    sections: dict[str, list] = {"header": []}
    current = "header"
    header_done = False
    prev_blank = True   # start True to suppress leading blanks

    for raw_line in raw_text.split("\n"):
        stripped = raw_line.strip()

        if not stripped:
            # Preserve ONE blank line per run so job blocks stay separated
            if not prev_blank:
                sections.setdefault(current, []).append("")
            prev_blank = True
            continue

        prev_blank = False
        detected = _detect_section(stripped)
        if detected:
            current = detected
            header_done = True
            if current not in sections:
                sections[current] = []
            continue

        if not header_done and CONTACT_INLINE.search(stripped):
            sections.setdefault("contact", []).append(stripped)
        else:
            sections.setdefault(current, []).append(stripped)

    result = {}
    for k, v in sections.items():
        text = "\n".join(v).strip()
        if text:
            result[k] = text
    return result


def _detect_section(line: str) -> str | None:
    # Only treat short lines as possible headings (headings are rarely > 60 chars)
    if len(line) > 80:
        return None

    normalized = line.lower().strip(":-_|• ")
    for section, pattern in SECTION_PATTERNS.items():
        if re.search(pattern, normalized, re.IGNORECASE):
            return section
    return None
