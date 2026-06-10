"""
PDF generator — produces CVs matching the screenshot design:
  • Clean black/white A4
  • Large bold centered name + contact row
  • Section headers: [icon] Title + full-width black rule
  • 2-column skills grid
  • Experience: bold title + right-aligned date, bold company, bullets
  • Projects: bold title, description, italic Tech Stack
  • Education / Certifications: same structural style
"""

import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
    Table, TableStyle, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# ─── Font registration (Times New Roman from Windows fonts) ────────────────────
_FONT_PATHS = {
    'regular':     [r'C:\Windows\Fonts\times.ttf',   r'C:\Windows\Fonts\arial.ttf'],
    'bold':        [r'C:\Windows\Fonts\timesbd.ttf',  r'C:\Windows\Fonts\arialbd.ttf'],
    'italic':      [r'C:\Windows\Fonts\timesi.ttf',   r'C:\Windows\Fonts\ariali.ttf'],
    'bold_italic': [r'C:\Windows\Fonts\timesbi.ttf',  r'C:\Windows\Fonts\arialbi.ttf'],
}

_F_REG   = 'CV_Regular'
_F_BOLD  = 'CV_Bold'
_F_ITAL  = 'CV_Italic'
_F_BITL  = 'CV_BoldItalic'

def _try_register_fonts():
    registered = {}
    pairs = [
        (_F_REG,  'regular'),
        (_F_BOLD, 'bold'),
        (_F_ITAL, 'italic'),
        (_F_BITL, 'bold_italic'),
    ]
    for name, key in pairs:
        for path in _FONT_PATHS[key]:
            if os.path.exists(path):
                try:
                    pdfmetrics.registerFont(TTFont(name, path))
                    registered[key] = name
                    break
                except Exception:
                    continue
        if key not in registered:
            registered[key] = 'Helvetica' if 'bold' not in key else 'Helvetica-Bold'
    return registered

_FONTS = _try_register_fonts()
_FR    = _FONTS['regular']
_FB    = _FONTS['bold']
_FI    = _FONTS['italic']
_FBI   = _FONTS['bold_italic']

# ─── Constants ─────────────────────────────────────────────────────────────────
_BLK = colors.HexColor('#1a1a1a')
_GRY = colors.HexColor('#444444')
_WHT = colors.white

_L_M = 46.0
_R_M = 46.0
_BFS = 10.0      # body font size
_NFS = 27.0      # name font size
_SFS = 14.0      # section heading font size

_BULLET_CHARS = '•‣⁃◦▪‐‒·●○'
_STRIP_RE     = re.compile(r'^[•‣⁃◦▪‐‒\-\*\s]+')

_DATE_RE = re.compile(
    r'\b(\d{1,2}[/\-]\d{4}|\d{4})'
    r'(?:\s*[-–—to]+\s*'
    r'(?:present|current|now|\d{1,2}[/\-]\d{4}|\d{4}))?',
    re.IGNORECASE,
)

# ─── Section icon mapping (Unicode — renders if font supports it) ──────────────
_ICONS = {
    'summary':        '\U0001F4CB',   # 📋
    'objective':      '\U0001F4CB',
    'skills':         '\U0001F9E0',   # 🧠
    'experience':     '\U0001F4BC',   # 💼
    'projects':       '\U0001F4C2',   # 📂
    'education':      '\U0001F393',   # 🎓
    'certifications': '\U0001F4DC',   # 📜
    'languages':      '\U0001F310',   # 🌐
    'awards':         '\U0001F3C6',   # 🏆
}

_LABELS = {
    'summary':        'Professional Profile',
    'objective':      'Professional Profile',
    'skills':         'Core Technical Skills',
    'experience':     'Professional Experience',
    'education':      'Education',
    'projects':       'Key Projects',
    'certifications': 'Certifications',
    'languages':      'Languages',
    'awards':         'Awards & Achievements',
}

SECTION_ORDER = [
    'header', 'contact', 'summary', 'objective',
    'skills', 'experience', 'education', 'projects',
    'certifications', 'languages', 'awards',
]


# ─── Utility helpers ───────────────────────────────────────────────────────────

def _esc(t: str) -> str:
    return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def _is_bullet(line: str) -> bool:
    return line[:1] in _BULLET_CHARS or line[:1] in '-*'


def _strip_bullet(line: str) -> str:
    return _STRIP_RE.sub('', line)


# ─── Experience block parsing (same logic as cv_tailor.py) ────────────────────

def _is_date_only(l: str) -> bool:
    m = _DATE_RE.search(l)
    return bool(m) and m.start() == 0 and not l[m.end():].strip(' \t|–—-')


def _ends_sentence(l: str) -> bool:
    return l.rstrip().endswith(('.', '!', '?'))


def _split_lines_into_jobs(lines: list) -> list:
    """Non-bullet line after bullets = new job header OR wrapped bullet
    continuation. See cv_tailor._split_lines_into_jobs for decision rules."""
    result, cur, in_blt = [], [], False
    for i, l in enumerate(lines):
        if _is_bullet(l):
            in_blt = True
            cur.append(l)
            continue
        if not in_blt:
            cur.append(l)
            continue

        new_job = False
        if _is_date_only(l):
            new_job = True
        elif _DATE_RE.search(l) and not _ends_sentence(l) and l[:1].isupper():
            new_job = True
        elif _ends_sentence(l):
            new_job = False
        elif i + 1 < len(lines) and not _is_bullet(lines[i + 1]) and _is_date_only(lines[i + 1]):
            new_job = True
        else:
            for k in range(1, 4):
                li = i + k
                if li >= len(lines) or _is_bullet(lines[li]):
                    break
                if _DATE_RE.search(lines[li]):
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
    """Repair stray-blank-line fragments: leading-bullet blocks belong to the
    previous job; headerless no-bullet blocks merge with a following bullet block."""
    result = []
    i = 0
    while i < len(blocks):
        block = blocks[i].strip()
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        starts_blt = bool(lines) and _is_bullet(lines[0])
        has_blt = any(_is_bullet(l) for l in lines)

        if starts_blt and result:
            result[-1] += '\n' + block
            i += 1
            continue

        if not has_blt and i + 1 < len(blocks):
            next_lines = [l.strip() for l in blocks[i + 1].strip().split('\n') if l.strip()]
            if next_lines and _is_bullet(next_lines[0]):
                result.append(block + '\n' + blocks[i + 1].strip())
                i += 2
                continue

        result.append(block)
        i += 1
    return result if result else blocks


def _split_exp_blocks(content: str) -> list:
    # Blank lines in PDF extractions are unreliable — ALWAYS sub-split each
    # blank-line block with the line heuristic, then repair fragments.
    blocks = [b.strip() for b in re.split(r'\n[ \t]*\n', content.strip()) if b.strip()]
    jobs = []
    for b in blocks:
        lines = [l.strip() for l in b.split('\n') if l.strip()]
        jobs.extend(_split_lines_into_jobs(lines))
    return _merge_fragment_blocks(jobs)


def _parse_job_block(block: str) -> dict:
    lines = [l.strip() for l in block.strip().split('\n') if l.strip()]
    hdr_lines, item_lines = [], []
    found_blt = False

    for l in lines:
        if _is_bullet(l):
            found_blt = True
            item_lines.append({'type': 'bullet', 'text': _strip_bullet(l)})
        elif not found_blt:
            hdr_lines.append(l)
        else:
            item_lines.append({'type': 'sub', 'text': l})

    title, company, date_str = '', '', ''
    extra_hdr = []

    if hdr_lines:
        m0 = _DATE_RE.search(hdr_lines[0])
        if m0 and m0.start() == 0 and hdr_lines[0][m0.end():].strip().strip('|–—- ') == '':
            date_str = hdr_lines[0].strip()
            hdr_lines = hdr_lines[1:]

        first = hdr_lines[0] if hdr_lines else ''
        if first and '|' in first:
            parts = [p.strip() for p in first.split('|')]
            title = parts[0]
            di = next((i for i, p in enumerate(parts) if _DATE_RE.search(p)), -1)
            if di >= 0:
                if not date_str:
                    date_str = parts[di]
                rem = [p for i, p in enumerate(parts) if i not in (0, di)]
                company = rem[0] if rem else ''
            else:
                company = parts[1] if len(parts) > 1 else ''
        elif first:
            m = _DATE_RE.search(first)
            if m:
                if not date_str:
                    date_str = m.group(0).strip()
                title = first[:m.start()].rstrip('|–—-, ').strip()
            else:
                title = first

        for hl in hdr_lines[1:]:
            m = _DATE_RE.search(hl)
            if m and not date_str:
                date_str = m.group(0).strip()
                rem = hl[:m.start()].strip(' ,|–—-')
                if rem and not company:
                    company = rem
            elif _is_date_only(hl):
                continue  # extra date line — never treat a date as the company
            elif not company:
                company = hl.strip()
            else:
                extra_hdr.append(hl)

    for h in reversed(extra_hdr):
        item_lines.insert(0, {'type': 'sub', 'text': h})

    return {'title': title, 'company': company, 'date': date_str, 'items': item_lines}


# ─── Skills parser ─────────────────────────────────────────────────────────────

def _parse_skills(content: str) -> list:
    cats, cur_lbl, cur_vals = [], '', []
    for raw in content.split('\n'):
        t = raw.strip()
        if not t:
            continue
        if t.endswith(':') and len(t.split()) <= 7:
            if cur_vals:
                cats.append((cur_lbl, ', '.join(cur_vals)))
            cur_lbl, cur_vals = t, []
        elif _is_bullet(t):
            cur_vals.append(_strip_bullet(t))
        else:
            cur_vals.append(t)
    if cur_vals:
        cats.append((cur_lbl, ', '.join(cur_vals)))
    return cats


# ─── Project block parser ──────────────────────────────────────────────────────

_PLATFORM_LABEL = re.compile(r'^(github|gitlab|bitbucket|portfolio|linkedin|website|link)$', re.I)
_TS_LINE = re.compile(r'^tech\s*stack:', re.I)


def _normalize_proj_lines(content: str) -> list:
    lines = [l.strip() for l in re.sub(r'[​‌‍﻿]', '', content).split('\n')]
    lines = [l for l in lines if l and not _PLATFORM_LABEL.match(l)]

    # Re-join wrapped Tech Stack lines (stack list ending with a continuation char)
    joined = []
    for l in lines:
        prev = joined[-1] if joined else ''
        if _TS_LINE.match(prev) and re.search(r'[,&/+\-]$', prev) and not _TS_LINE.match(l):
            joined[-1] = prev + ' ' + l
        else:
            joined.append(l)
    return joined


def _parse_proj_blocks(content: str) -> list:
    # Split at 'Tech Stack:' boundaries — each stack line ends one project.
    # Blank lines are unreliable in PDF extractions, so don't depend on them.
    blocks, cur = [], []
    for l in _normalize_proj_lines(content):
        cur.append(l)
        if _TS_LINE.match(l):
            blocks.append(cur)
            cur = []
    if cur:
        blocks.append(cur)

    projects = []
    for lines in blocks:
        title = lines[0] if lines else ''
        ts_idx = next((i for i, l in enumerate(lines) if _TS_LINE.match(l)), -1)
        desc_lines = lines[1:ts_idx] if ts_idx >= 0 else lines[1:]
        tech_stack = re.sub(r'^tech\s*stack:\s*', '', lines[ts_idx], flags=re.I) if ts_idx >= 0 else ''
        if title or desc_lines or tech_stack:
            projects.append({'title': title, 'desc': ' '.join(desc_lines), 'ts': tech_stack})
    return projects


# ─── PUBLIC ENTRY POINT ────────────────────────────────────────────────────────

def generate_pdf(sections: dict, layout: dict, output_path: str,
                 original_path: str = None) -> str:
    return _build_cv_pdf(sections, output_path)


# ─── PDF BUILDER ───────────────────────────────────────────────────────────────

def _build_cv_pdf(sections: dict, output_path: str) -> str:
    PAGE_W, _ = A4
    CW = PAGE_W - _L_M - _R_M

    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=_L_M, rightMargin=_R_M,
        topMargin=28, bottomMargin=32,
    )

    # ── Paragraph styles ──────────────────────────────────────────────────────
    name_s = ParagraphStyle(
        'cv_name', fontName=_FB, fontSize=_NFS, textColor=_BLK,
        alignment=TA_CENTER, leading=_NFS * 1.2, spaceAfter=5,
    )
    ctct_s = ParagraphStyle(
        'cv_ctct', fontName=_FR, fontSize=_BFS * 0.9, textColor=_GRY,
        alignment=TA_CENTER, leading=_BFS * 1.5,
    )
    sec_s = ParagraphStyle(
        'cv_sec', fontName=_FB, fontSize=_SFS, textColor=_BLK,
        alignment=TA_LEFT, leading=_SFS * 1.2,
    )
    jtit_s = ParagraphStyle(
        'cv_jtit', fontName=_FB, fontSize=_BFS + 0.5, textColor=_BLK,
        leading=(_BFS + 0.5) * 1.35,
    )
    date_s = ParagraphStyle(
        'cv_date', fontName=_FR, fontSize=_BFS, textColor=_BLK,
        alignment=TA_RIGHT, leading=_BFS * 1.35,
    )
    co_s = ParagraphStyle(
        'cv_co', fontName=_FB, fontSize=_BFS, textColor=_BLK,
        leading=_BFS * 1.25, spaceAfter=2,
    )
    sub_s = ParagraphStyle(
        'cv_sub', fontName=_FB, fontSize=_BFS, textColor=_BLK,
        leading=_BFS * 1.3, leftIndent=4,
    )
    blt_s = ParagraphStyle(
        'cv_blt', fontName=_FR, fontSize=_BFS, textColor=_BLK,
        leading=_BFS * 1.4, leftIndent=14, firstLineIndent=-10, spaceAfter=1,
    )
    body_s = ParagraphStyle(
        'cv_body', fontName=_FR, fontSize=_BFS, textColor=_BLK,
        leading=_BFS * 1.5, spaceAfter=3, alignment=TA_JUSTIFY,
    )
    cat_s = ParagraphStyle(
        'cv_cat', fontName=_FB, fontSize=_BFS, textColor=_BLK,
        leading=_BFS * 1.45, spaceBefore=5,
    )
    catv_s = ParagraphStyle(
        'cv_catv', fontName=_FR, fontSize=_BFS * 0.95, textColor=_BLK,
        leading=_BFS * 1.4, leftIndent=4, spaceAfter=1,
    )
    proj_title_s = ParagraphStyle(
        'cv_pt', fontName=_FB, fontSize=_BFS + 0.5, textColor=_BLK,
        leading=(_BFS + 0.5) * 1.3, spaceAfter=2,
    )
    proj_desc_s = ParagraphStyle(
        'cv_pd', fontName=_FR, fontSize=_BFS, textColor=_BLK,
        leading=_BFS * 1.45, spaceAfter=1, alignment=TA_JUSTIFY,
    )
    ts_lbl_s = ParagraphStyle(
        'cv_tslbl', fontName=_FBI, fontSize=_BFS * 0.95, textColor=_BLK,
        leading=_BFS * 1.3,
    )
    ts_val_s = ParagraphStyle(
        'cv_tsval', fontName=_FI, fontSize=_BFS * 0.95, textColor=_BLK,
        leading=_BFS * 1.3,
    )

    story = []

    # ── Helper: section heading (icon + title + rule) ──────────────────────────
    def _sec_header(key: str):
        label = _LABELS.get(key, key.replace('_', ' ').title())
        para = Paragraph(f'<b>{_esc(label)}</b>', sec_s)
        rule = HRFlowable(width='100%', thickness=0.75, color=_BLK, spaceAfter=5, spaceBefore=2)
        return [Spacer(1, 9), para, rule]

    def _add_sec(key: str):
        story.extend(_sec_header(key))

    # ── Helper: title + date two-column row ────────────────────────────────────
    def _title_date_row(title: str, date: str, title_style=None, date_style=None):
        ts = title_style or jtit_s
        ds = date_style  or date_s
        t = Table(
            [[Paragraph(f'<b>{_esc(title)}</b>', ts),
              Paragraph(_esc(date), ds)]],
            colWidths=[CW * 0.68, CW * 0.32],
        )
        t.setStyle(TableStyle([
            ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING',   (0, 0), (-1, -1), 0),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
            ('TOPPADDING',    (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ]))
        return t

    # ── Header block (name + contact + thick rule) ─────────────────────────────
    _contact_hint = re.compile(r'@|linkedin|github|portfolio|website|\+?\d[\d\s\-().]{6,}\d', re.I)
    hdr_all = [l.strip() for l in (sections.get('header') or '').split('\n') if l.strip()]
    name_raw = next((l for l in hdr_all if not _contact_hint.search(l)), hdr_all[0] if hdr_all else '')

    ctct_items, _seen = [], set()
    ctct_src = [l.strip() for l in (sections.get('contact') or '').split('\n') if l.strip()]
    ctct_src += [l for l in hdr_all if l != name_raw and _contact_hint.search(l)]
    for it in ctct_src:
        if it.lower() not in _seen:
            _seen.add(it.lower())
            ctct_items.append(it)

    if name_raw:
        story.append(Paragraph(f'<b>{_esc(name_raw)}</b>', name_s))

    if ctct_items:
        story.append(Paragraph(_esc('   •   '.join(ctct_items)), ctct_s))

    story.append(Spacer(1, 7))
    story.append(HRFlowable(width='100%', thickness=1.3, color=_BLK, spaceAfter=8))

    # ── Ordered sections ───────────────────────────────────────────────────────
    SKIP = {'header', 'contact'}
    ordered = [k for k in SECTION_ORDER if k in sections and k not in SKIP]
    rest    = [k for k in sections    if k not in ordered  and k not in SKIP]

    for key in ordered + rest:
        content = (sections.get(key) or '').strip()
        if not content:
            continue

        # ── Professional Experience ────────────────────────────────────────────
        if key == 'experience':
            blocks    = _split_exp_blocks(content)
            sec_flows = _sec_header(key)

            for idx, block in enumerate(blocks):
                job   = _parse_job_block(block)
                items = job.get('items', [])

                anchor = []
                if idx == 0:
                    anchor.extend(sec_flows)

                anchor.append(_title_date_row(job['title'], job['date']))
                if job['company']:
                    anchor.append(Paragraph(_esc(job['company']), co_s))

                if items:
                    first_item = items[0]
                    if first_item['type'] == 'bullet':
                        anchor.append(Paragraph(
                            f'&#8226;&nbsp;{_esc(first_item["text"])}', blt_s))
                    else:
                        anchor.append(Paragraph(
                            f'<b>{_esc(first_item["text"])}</b>', sub_s))

                story.append(KeepTogether(anchor))

                for item in items[1:]:
                    if item['type'] == 'bullet':
                        story.append(Paragraph(
                            f'&#8226;&nbsp;{_esc(item["text"])}', blt_s))
                    else:
                        story.append(Paragraph(
                            f'<b>{_esc(item["text"])}</b>', sub_s))

                story.append(Spacer(1, 5))

        # ── Key Projects ───────────────────────────────────────────────────────
        elif key == 'projects':
            _add_sec(key)
            for proj in _parse_proj_blocks(content):
                anchor = [Paragraph(f'<b>{_esc(proj["title"])}</b>', proj_title_s)]
                if proj['desc']:
                    anchor.append(Paragraph(_esc(proj['desc']), proj_desc_s))
                if proj['ts']:
                    ts_tbl = Table(
                        [[Paragraph('<b><i>Tech Stack: </i></b>', ts_lbl_s),
                          Paragraph(f'<i>{_esc(proj["ts"])}</i>', ts_val_s)]],
                        colWidths=[60, CW - 60],
                    )
                    ts_tbl.setStyle(TableStyle([
                        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
                        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
                        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
                        ('TOPPADDING',    (0, 0), (-1, -1), 0),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                    ]))
                    anchor.append(ts_tbl)
                story.append(KeepTogether(anchor))
                story.append(Spacer(1, 6))

        # ── Core Technical Skills ──────────────────────────────────────────────
        elif key == 'skills':
            _add_sec(key)
            cats = _parse_skills(content)

            if len(cats) >= 2:
                left  = cats[0::2]
                right = cats[1::2]
                while len(right) < len(left):
                    right.append(('', ''))
                COL_W = (CW - 8) / 2

                def _chunk(val, n=7):
                    items = [v.strip() for v in val.split(',') if v.strip()]
                    return [', '.join(items[i:i + n]) for i in range(0, len(items), n)] or ['']

                rows = []
                for (ll, lv), (rl, rv) in zip(left, right):
                    rows.append([
                        Paragraph(f'<b>{_esc(ll)}</b>', cat_s) if ll else Spacer(1, 1),
                        Paragraph(f'<b>{_esc(rl)}</b>', cat_s) if rl else Spacer(1, 1),
                    ])
                    lc = _chunk(lv) if lv else ['']
                    rc = _chunk(rv) if rv else ['']
                    n  = max(len(lc), len(rc))
                    lc += [''] * (n - len(lc))
                    rc += [''] * (n - len(rc))
                    for lch, rch in zip(lc, rc):
                        rows.append([
                            Paragraph(_esc(lch), catv_s) if lch else Spacer(1, 1),
                            Paragraph(_esc(rch), catv_s) if rch else Spacer(1, 1),
                        ])
                    rows.append([Spacer(1, 4), Spacer(1, 1)])

                tbl = Table(rows, colWidths=[COL_W, COL_W], splitByRow=1)
                tbl.setStyle(TableStyle([
                    ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING',   (0, 0), (-1, -1), 0),
                    ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
                    ('RIGHTPADDING',  (0, 0), (0, -1),  8),
                    ('TOPPADDING',    (0, 0), (-1, -1), 0),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                ]))
                story.append(tbl)
            else:
                for lbl, val in cats:
                    if lbl:
                        story.append(Paragraph(f'<b>{_esc(lbl)}</b>', cat_s))
                    if val:
                        story.append(Paragraph(_esc(val), catv_s))
                    story.append(Spacer(1, 3))

        # ── Education / Certifications / Awards ────────────────────────────────
        elif key in ('education', 'certifications', 'awards'):
            _add_sec(key)
            for block in re.split(r'\n[ \t]*\n', content.strip()):
                if not block.strip():
                    continue
                lines = [l.strip() for l in block.split('\n') if l.strip()]
                if not lines:
                    continue
                # Date-only first line is the block's date — title is next line
                dt = ''
                if _is_date_only(lines[0]) and len(lines) > 1:
                    dt = lines[0]
                    lines = lines[1:]
                first = lines[0]
                m     = _DATE_RE.search(first)
                ttl   = (first[:m.start()].rstrip('|–—- ').strip() if m else first).rstrip(',')
                if m and not dt:
                    dt = m.group(0).strip()

                anchor = [_title_date_row(ttl, dt)]
                for l in lines[1:]:
                    if _is_bullet(l):
                        anchor.append(Paragraph(
                            f'&#8226;&nbsp;{_esc(_strip_bullet(l))}', blt_s))
                    else:
                        anchor.append(Paragraph(f'<b>{_esc(l)}</b>', co_s))

                story.append(KeepTogether(anchor[:2]))
                for flow in anchor[2:]:
                    story.append(flow)
                story.append(Spacer(1, 6))

        # ── Summary / Profile / Other ──────────────────────────────────────────
        else:
            _add_sec(key)
            buf = []
            for line in content.split('\n'):
                t = line.strip()
                if not t:
                    if buf:
                        story.append(Paragraph(_esc(' '.join(buf)), body_s))
                        buf = []
                elif _is_bullet(t):
                    if buf:
                        story.append(Paragraph(_esc(' '.join(buf)), body_s))
                        buf = []
                    story.append(Paragraph(
                        f'&#8226;&nbsp;{_esc(_strip_bullet(t))}', blt_s))
                else:
                    buf.append(t)
            if buf:
                story.append(Paragraph(_esc(' '.join(buf)), body_s))

    doc.build(story)
    return output_path


# ─── Legacy stubs (kept for compatibility) ────────────────────────────────────

def _generate_fresh(sections: dict, layout: dict, output_path: str) -> str:
    return _build_cv_pdf(sections, output_path)
