import re
from ai.services.qwen import call_qwen

DATE_PATTERN = re.compile(
    r'\b\d{4}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[\.\-]?\s*\d{4}\b',
    re.IGNORECASE,
)


# ─── Job block parser ──────────────────────────────────────────────────────────

_DATE_RE_T = re.compile(
    r'\b(\d{1,2}[/\-]\d{4}|\d{4})'
    r'(?:\s*[\-–—to]+\s*(?:present|current|now|\d{1,2}[/\-]\d{4}|\d{4}))?',
    re.IGNORECASE,
)
_BULLET_CHARS_T = '•‣⁃◦▪‐‒'


def _merge_fragment_blocks(blocks: list) -> list:
    """
    Merge a no-bullet block with the NEXT block ONLY when the next block's first
    non-empty line is itself a bullet.  That pattern means the no-bullet block is a
    split-off job header whose bullets landed in a separate blank-line block.

    When the next block starts with a non-bullet line the no-bullet block is its own
    brief job (or the job header for a job whose bullets immediately follow in the
    same block) and must NOT be swallowed into the following job.
    """
    result: list[str] = []
    i = 0
    while i < len(blocks):
        block = blocks[i].strip()
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        has_bullet = any(l[:1] in _BULLET_CHARS_T or l[:1] in '-*' for l in lines)
        if not has_bullet and i + 1 < len(blocks):
            next_block = blocks[i + 1].strip()
            next_lines = [l.strip() for l in next_block.split('\n') if l.strip()]
            next_first = next_lines[0] if next_lines else ''
            if next_first and (next_first[:1] in _BULLET_CHARS_T or next_first[:1] in '-*'):
                # Header fragment immediately followed by its bullet block — merge
                result.append(block + '\n' + next_block)
                i += 2
                continue
        result.append(block)
        i += 1
    return result if result else blocks


def _split_experience_blocks(experience_text: str) -> list:
    """Split experience text into per-job blocks with fallback heuristic."""
    blocks = [b.strip() for b in re.split(r'\n[ \t]*\n', experience_text.strip()) if b.strip()]
    if len(blocks) > 1:
        return _merge_fragment_blocks(blocks)

    lines = [l.strip() for l in experience_text.split('\n') if l.strip()]
    result, cur, in_blt = [], [], False

    def _next_have_date(idx):
        # Look ahead up to 5 non-bullet lines for a date.
        # Stop at the next bullet — years inside bullets are not job boundaries.
        for k in range(1, 6):
            li = idx + k
            if li >= len(lines):
                break
            if lines[li][:1] in _BULLET_CHARS_T or lines[li][:1] in '-*':
                break
            if _DATE_RE_T.search(lines[li]):
                return True
        return False

    for i, l in enumerate(lines):
        is_blt = l[:1] in _BULLET_CHARS_T or l[:1] in '-*'
        if is_blt:
            in_blt = True
            cur.append(l)
        elif not in_blt:
            cur.append(l)
        else:
            is_new = '|' in l or _DATE_RE_T.search(l) or _next_have_date(i)
            if is_new:
                if cur:
                    result.append('\n'.join(cur))
                cur = [l]
                in_blt = False
            else:
                cur.append(l)
    if cur:
        result.append('\n'.join(cur))
    return _merge_fragment_blocks(result) if result else blocks


def _parse_experience_jobs(experience_text: str) -> list[dict]:
    """
    Split experience section into individual job blocks.
    Returns list of dicts: {header_lines, bullet_lines, original_block}
    First entry = most recent job (as they appear in CV).
    """
    raw_blocks = _split_experience_blocks(experience_text)
    jobs = []

    for block in raw_blocks:
        lines = [l for l in block.strip().split('\n') if l.strip()]
        if not lines:
            continue

        header = []
        bullets = []
        in_bullets = False

        for line in lines:
            stripped = line.strip()
            is_bullet = stripped[:1] in ('•', '-', '*', '○', '◦', '▪', '‐')
            if is_bullet:
                in_bullets = True
            if in_bullets or is_bullet:
                bullets.append(line)
            else:
                header.append(line)

        jobs.append({
            'header_lines': header,
            'bullet_lines': bullets,
            'original_block': block,
        })

    return jobs


def _rebuild_experience(jobs: list[dict], updated_bullets_0: list[str]) -> str:
    """
    Reconstruct full experience text.
    Only bullets for job[0] (current/most recent job) are replaced; all others verbatim.
    """
    rebuilt = []
    for i, job in enumerate(jobs):
        block_lines = job['header_lines'][:]
        if i == 0 and updated_bullets_0:
            block_lines.extend(updated_bullets_0)
        else:
            block_lines.extend(job['bullet_lines'])
        rebuilt.append('\n'.join(block_lines))
    return '\n\n'.join(rebuilt)


# ─── AI bullet rewriter ────────────────────────────────────────────────────────

async def _rewrite_bullets(
    job0_header: str, job0_bullets: list[str],
    jd_analysis: dict,
) -> list[str]:
    """Rewrite bullets for the current (most recent) job only."""
    stacks      = ', '.join(jd_analysis.get('detected_stacks', [])[:12])
    ai_analysis = jd_analysis.get('ai_analysis', '')
    n0 = len(job0_bullets) or 3
    job0_text = '\n'.join(job0_bullets) if job0_bullets else '(no bullets)'

    prompt = f"""You are an expert CV writer. Rewrite ONLY the bullet points below to match the job requirements.

CRITICAL FORMATTING INSTRUCTIONS (MANDATORY — higher priority than everything else):
- Preserve the original resume formatting exactly as provided.
- Do NOT change the layout, structure, section order, spacing, indentation, or alignment.
- Keep all bullet points as bullet points — NEVER convert to paragraphs or plain text.
- Do NOT merge, split, or reorder existing bullet points.
- Maintain the same formatting for each bullet: same starting symbol (•), same approximate length.
- Only update the content of the bullet while preserving its original formatting.
- Return bullets using the exact same structure as the input bullets.
- Each rewritten bullet must start with • and be a SINGLE line (no line breaks inside a bullet).
- Keep each bullet roughly the same length as the original (±20%).

CONTENT RULES:
1. Do NOT change job titles, company names, or dates — only bullet content
2. Keep EXACTLY {n0} bullets
3. Start each bullet with a strong action verb
4. Naturally include relevant tech stacks where they fit
5. Be concise and achievement-oriented (numbers/impact preferred)
6. Output ONLY the section below — no extra text, no explanations

REQUIRED TECH STACKS: {stacks}
JOB REQUIREMENTS:
{ai_analysis[:600]}

--- CURRENT JOB ---
{job0_header}
Original bullets ({n0}):
{job0_text}

Return in EXACTLY this format (nothing else):

CURRENT_JOB_BULLETS: exactly {n0} bullets
• ...
"""

    response = await call_qwen(prompt, max_tokens=900, model='qwen-plus')
    b0 = _extract_section_bullets(response, 'CURRENT_JOB_BULLETS', n0)
    return b0 or job0_bullets


def _extract_section_bullets(text: str, label: str, expected: int) -> list[str]:
    pattern = rf'{re.escape(label)}[^\n]*\n((?:[ \t]*[•\-\*○◦▪][^\n]*\n?)+)'
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return []
    raw = m.group(1)
    bullets = [l.strip() for l in raw.split('\n') if l.strip() and l.strip()[0] in '•-*○◦▪']
    bullets = ['• ' + b.lstrip('•-*○◦▪ ') for b in bullets]
    return bullets[:expected] if bullets else []


# ─── Public API ────────────────────────────────────────────────────────────────

async def tailor_cv(cv_sections: dict, jd_analysis: dict, _original_format: str) -> tuple[dict, list]:
    """
    Update ONLY the bullet points of the current (most recent) job in the experience section.
    Every other section (header, contact, summary, skills, education, …) is returned unchanged.

    Returns (updated_sections, experience_replacements).
    experience_replacements is a list of {old, new} dicts for targeted PDF replacement.
    """
    print(f"\n[tailor_cv] sections: {list(cv_sections.keys())}")
    experience = cv_sections.get('experience', '').strip()
    print(f"[tailor_cv] experience: {len(experience)} chars")
    if not experience:
        print("[tailor_cv] *** experience EMPTY — no change ***")
        return cv_sections, []

    jobs = _parse_experience_jobs(experience)
    print(f"[tailor_cv] jobs found: {len(jobs)}")
    for i, j in enumerate(jobs[:3]):
        print(f"  job[{i}] header={j['header_lines'][:1]} bullets={len(j['bullet_lines'])}")
    if not jobs:
        print("[tailor_cv] *** no jobs parsed — no change ***")
        return cv_sections, []

    job0 = jobs[0]
    job0_header = '\n'.join(job0['header_lines'])

    print(f"[tailor_cv] calling Qwen for job0='{job0_header[:40]}' ({len(job0['bullet_lines'])} bullets)")
    updated_0 = await _rewrite_bullets(
        job0_header, job0['bullet_lines'],
        jd_analysis,
    )
    print(f"[tailor_cv] Qwen done. updated_0={len(updated_0)}")

    # Build old→new mapping for targeted PDF line replacement
    replacements = []
    for old, new in zip(job0['bullet_lines'], updated_0):
        if old.strip() != new.strip():
            replacements.append({'old': old.strip(), 'new': new.strip()})
            print(f"[tailor_cv] replacement: {old.strip()[:40]!r} → {new.strip()[:40]!r}")

    print(f"[tailor_cv] total replacements: {len(replacements)}")

    updated_experience = _rebuild_experience(jobs, updated_0)

    result = dict(cv_sections)
    result['experience'] = updated_experience
    return result, replacements
