import re
from ai.services.qwen import call_qwen

# Sections that are pure identity data — never sent to the AI, never rewritten.
_PROTECTED = {'header', 'contact'}

# Sections rendered first in the template — keep this order in the prompt so the
# model sees the CV the way a reader would.
_SECTION_ORDER = [
    'summary', 'objective', 'skills', 'experience',
    'education', 'projects', 'certifications', 'languages', 'awards',
]

_SECTION_MARK = re.compile(r'^===SECTION:\s*([a-z_]+)\s*===\s*$', re.IGNORECASE | re.MULTILINE)

_BULLET_CHARS = '•‣⁃◦▪‐‒·●○'


def _has_bullets(text: str) -> bool:
    return any(l.strip()[:1] in _BULLET_CHARS or l.strip()[:1] in '-*'
               for l in text.split('\n') if l.strip())


def _ordered_keys(sections: dict) -> list:
    known = [k for k in _SECTION_ORDER if k in sections]
    rest = [k for k in sections if k not in known and k not in _PROTECTED]
    return known + rest


def _build_prompt(sections: dict, jd_analysis: dict) -> str:
    stacks = ', '.join(jd_analysis.get('detected_stacks', [])[:15])
    ai_analysis = jd_analysis.get('ai_analysis', '')

    blocks = []
    for key in _ordered_keys(sections):
        if key in _PROTECTED:
            continue
        content = (sections.get(key) or '').strip()
        if not content:
            continue
        blocks.append(f"===SECTION: {key}===\n{content}")
    cv_text = '\n\n'.join(blocks)

    return f"""You are an expert CV writer. Below is a complete CV split into sections, \
and the requirements of a job the candidate is applying for. Rewrite the ENTIRE CV text — \
every section, top to bottom — so it is strongly tailored to this job. Do not leave any \
sentence as-is unless it is a pure fact (a name, a date, a title).

WHAT TO REWRITE (everything):
- summary/objective: fully rewrite to position the candidate for THIS job.
- skills: keep every "Category:" label line, but reorder and update the skill lists so the \
job's required stacks appear prominently. You may add required stacks that plausibly fit the \
candidate's background and drop irrelevant ones.
- experience: rewrite ALL bullet points of ALL jobs (not just the first) to emphasize \
achievements relevant to the job requirements, weaving in the required tech stacks where \
they plausibly fit. Strong action verbs, numbers/impact where possible.
- projects: rewrite each project description to highlight relevance to the job. Keep every \
"Tech Stack:" line in place (you may adjust its list to be accurate to the description).
- education / certifications / awards / languages: keep degree names, institutions, dates and \
certificate names EXACTLY as given; you may only rewrite descriptive bullet lines under them.

HARD FACTUAL RULES (never violate):
1. NEVER change or invent: job titles, company names, employment dates, institution names, \
degree names, certification names, project names.
2. NEVER invent employers, degrees, or certifications that are not in the CV.

HARD FORMATTING RULES (the output is parsed by a program — violating these breaks it):
1. Return EVERY section below, each starting with its exact marker line: ===SECTION: key===
2. Inside each section keep the SAME line structure as the input: a header line stays one \
header line, a bullet stays a bullet.
3. Every bullet line must start with "• " and be ONE single line (no line breaks inside a bullet).
4. Keep the SAME number of bullets per job/entry as the input.
5. Keep each line roughly the same length as the original (±25%).
6. Do NOT add, remove, merge, split or reorder lines, jobs, projects or sections.
7. Output ONLY the sections with their markers — no explanations, no extra text, no markdown fences.

REQUIRED TECH STACKS: {stacks}

JOB REQUIREMENTS:
{ai_analysis[:800]}

--- CV SECTIONS (rewrite all of this) ---

{cv_text}
"""


def _parse_response(response: str, original_sections: dict) -> dict:
    """Split the AI response back into sections by marker lines."""
    text = response.strip()
    # Strip accidental markdown fences
    text = re.sub(r'^```[a-z]*\s*|\s*```$', '', text, flags=re.IGNORECASE)

    parsed = {}
    matches = list(_SECTION_MARK.finditer(text))
    for i, m in enumerate(matches):
        key = m.group(1).lower()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        if key in original_sections and content:
            parsed[key] = content
    return parsed


def _accept(key: str, new: str, old: str) -> bool:
    """Guard against truncated / degenerate rewrites — fall back to original."""
    if not new.strip():
        return False
    # A rewrite that lost most of the text is almost certainly truncated output
    if len(new) < len(old) * 0.4:
        return False
    # If the original had bullets the rewrite must still have bullets
    if _has_bullets(old) and not _has_bullets(new):
        return False
    return True


# ─── Public API ────────────────────────────────────────────────────────────────

async def tailor_cv(cv_sections: dict, jd_analysis: dict, _original_format: str) -> tuple[dict, list]:
    """
    Send the FULL CV text to the AI and replace every section with the AI's
    rewritten version. Only identity sections (header, contact) pass through
    unchanged. Sections the AI drops or mangles fall back to the original.

    Returns (updated_sections, experience_replacements) — replacements list is
    kept for API compatibility but is no longer used downstream.
    """
    print(f"\n[tailor_cv] sections: {list(cv_sections.keys())}")

    rewritable = [k for k in _ordered_keys(cv_sections)
                  if (cv_sections.get(k) or '').strip()]
    if not rewritable:
        print("[tailor_cv] *** nothing to rewrite — no change ***")
        return cv_sections, []

    prompt = _build_prompt(cv_sections, jd_analysis)
    cv_chars = sum(len(cv_sections.get(k) or '') for k in rewritable)
    # Output is roughly the same size as the input CV — budget generously
    max_tokens = min(8000, max(2500, int(cv_chars / 2.5)))
    print(f"[tailor_cv] calling Qwen: full CV rewrite "
          f"({len(rewritable)} sections, {cv_chars} chars, max_tokens={max_tokens})")

    response = await call_qwen(prompt, max_tokens=max_tokens, model='qwen-plus')
    parsed = _parse_response(response, cv_sections)
    print(f"[tailor_cv] Qwen done. sections returned: {list(parsed.keys())}")

    result = dict(cv_sections)
    for key in rewritable:
        new = parsed.get(key, '')
        old = (cv_sections.get(key) or '').strip()
        if _accept(key, new, old):
            result[key] = new
            print(f"[tailor_cv] '{key}' rewritten ({len(old)} -> {len(new)} chars)")
        else:
            print(f"[tailor_cv] '{key}' rejected/missing — keeping original")

    return result, []
