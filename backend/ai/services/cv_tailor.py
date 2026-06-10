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
_BULLET_CHARS_T = '•‣⁃◦▪‐‒·●○'


def _is_bullet_line(l: str) -> bool:
    l = l.strip()
    return bool(l) and (l[0] in _BULLET_CHARS_T or l[0] in '-*')


def _is_date_only(l: str) -> bool:
    """Line is just a date / date range, e.g. '08/2024 – 09/2025'."""
    m = _DATE_RE_T.search(l)
    return bool(m) and m.start() == 0 and not l[m.end():].strip(' \t|–—-')


def _ends_sentence(l: str) -> bool:
    return l.rstrip().endswith(('.', '!', '?'))


def _split_lines_into_jobs(lines: list) -> list:
    """
    Split a flat run of lines into per-job blocks.

    A non-bullet line AFTER bullets started is either a new job header or a
    wrapped continuation of the previous bullet.  Decision order:
      1. date-only line                      -> new job   ('08/2024 – 09/2025')
      2. uppercase line containing a date    -> new job   ('Title, Co 01/2024 – 07/2025')
      3. ends with sentence punctuation      -> continuation ('cycles and faster delivery.')
      4. next line is date-only              -> new job   ('Title, Co' + date below)
      5. date within 3 non-bullet lines      -> new job   (multi-line headers)
      6. default                             -> continuation
    """
    result, cur, in_blt = [], [], False
    for i, l in enumerate(lines):
        if _is_bullet_line(l):
            in_blt = True
            cur.append(l)
            continue
        if not in_blt:
            cur.append(l)
            continue

        new_job = False
        if _is_date_only(l):
            new_job = True
        elif _DATE_RE_T.search(l) and not _ends_sentence(l) and l[:1].isupper():
            new_job = True
        elif _ends_sentence(l):
            new_job = False
        elif i + 1 < len(lines) and not _is_bullet_line(lines[i + 1]) and _is_date_only(lines[i + 1]):
            new_job = True
        else:
            for k in range(1, 4):
                li = i + k
                if li >= len(lines) or _is_bullet_line(lines[li]):
                    break
                if _DATE_RE_T.search(lines[li]):
                    new_job = True
                    break

        if new_job:
            if cur:
                result.append('\n'.join(cur))
            cur = [l]
            in_blt = False
        else:
            cur.append(l)
    if cur:
        result.append('\n'.join(cur))
    return result


def _merge_fragment_blocks(blocks: list) -> list:
    """
    Repair blocks broken by stray blank lines:
      - A block that STARTS with a bullet has no header — its bullets belong to
        the previous job (a blank line split a job's bullet list in half).
      - A block with NO bullets followed by a block that starts with a bullet
        is a split-off header — merge the two.
    """
    result: list[str] = []
    i = 0
    while i < len(blocks):
        block = blocks[i].strip()
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        starts_blt = bool(lines) and _is_bullet_line(lines[0])
        has_blt = any(_is_bullet_line(l) for l in lines)

        if starts_blt and result:
            result[-1] += '\n' + block
            i += 1
            continue

        if not has_blt and i + 1 < len(blocks):
            next_block = blocks[i + 1].strip()
            next_lines = [l.strip() for l in next_block.split('\n') if l.strip()]
            if next_lines and _is_bullet_line(next_lines[0]):
                result.append(block + '\n' + next_block)
                i += 2
                continue

        result.append(block)
        i += 1
    return result if result else blocks


def _split_experience_blocks(experience_text: str) -> list:
    """
    Split experience text into per-job blocks.

    Blank lines in PDF extractions are unreliable: a stray blank line can land
    mid-job while five jobs share a single block.  So ALWAYS sub-split every
    blank-line block with the line heuristic, then repair the fragments.
    """
    blocks = [b.strip() for b in re.split(r'\n[ \t]*\n', experience_text.strip()) if b.strip()]
    jobs: list[str] = []
    for b in blocks:
        lines = [l.strip() for l in b.split('\n') if l.strip()]
        jobs.extend(_split_lines_into_jobs(lines))
    return _merge_fragment_blocks(jobs)


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
            if _is_bullet_line(line):
                in_bullets = True
            if in_bullets:
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

    # Merge wrapped continuation lines into their bullet so the AI sees whole
    # bullets, never raw line fragments (or another job's header by accident).
    job0_bullets = []
    for line in job0['bullet_lines']:
        if _is_bullet_line(line) or not job0_bullets:
            job0_bullets.append(line.strip())
        else:
            job0_bullets[-1] += ' ' + line.strip()

    print(f"[tailor_cv] calling Qwen for job0='{job0_header[:40]}' ({len(job0_bullets)} bullets)")
    updated_0 = await _rewrite_bullets(
        job0_header, job0_bullets,
        jd_analysis,
    )
    print(f"[tailor_cv] Qwen done. updated_0={len(updated_0)}")

    # Build old→new mapping for targeted PDF line replacement
    replacements = []
    for old, new in zip(job0_bullets, updated_0):
        if old.strip() != new.strip():
            replacements.append({'old': old.strip(), 'new': new.strip()})
            print(f"[tailor_cv] replacement: {old.strip()[:40]!r} → {new.strip()[:40]!r}")

    print(f"[tailor_cv] total replacements: {len(replacements)}")

    updated_experience = _rebuild_experience(jobs, updated_0)

    result = dict(cv_sections)
    result['experience'] = updated_experience
    return result, replacements
