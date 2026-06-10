const DATE_RE_STR = String.raw`\b(\d{1,2}[/\-]\d{4}|\d{4})(?:\s*[-–—to]+\s*(?:present|current|now|\d{1,2}[/\-]\d{4}|\d{4}))?`
const BULLET_RE = /^[•‣⁃◦▪‐‒\-\*·●○◦▪]\s*/
const JOB_TITLE_KW = /\b(developer|engineer|lead|manager|architect|consultant|analyst|designer|specialist|director|intern|programmer|devops|administrator|officer|coordinator|head)\b/i
const INLINE_JOB_RE = new RegExp(
  String.raw`(.+?[.!?])\s+((?:[A-Z][A-Za-z0-9\s&.'/-]+,\s*)*[A-Za-z][A-Za-z0-9\s.'&-]+\s+\d{1,2}[/\-]\d{4}\s*[-–—]\s*(?:\d{1,2}[/\-]\d{4}|present|current|now))`,
  'i',
)

const matchDate = str => new RegExp(DATE_RE_STR, 'i').exec(str)
const hasDate = str => new RegExp(DATE_RE_STR, 'i').test(str)

function sanitizeLine(s) {
  return (s || '').replace(/\s+/g, ' ').trim()
}

function isBullet(l) {
  return BULLET_RE.test((l || '').trim())
}

function stripBullet(l) {
  return l.replace(/^[•‣⁃◦▪‐‒\-\*·●○◦▪\s]+/, '')
}

function expandInlineBullets(line) {
  const t = (line || '').trim()
  if (!t) return []
  if (isBullet(t)) return [t]
  if (/[•‣⁃◦▪‐‒\-\*·●]\s/.test(t)) {
    return t.split(/\s*(?=[•‣⁃◦▪‐‒\-\*·●]\s+)/).map(s => s.trim()).filter(Boolean)
  }
  return [t]
}

function isJobHeaderLine(line) {
  if (isBullet(line)) return false
  const m = matchDate(line)
  if (!m) return false
  const before = line.slice(0, m.index).replace(/[,|—\-\s]+$/, '').trim()
  return before.length >= 8 && before.length <= 120 && !/[.!?]$/.test(before)
}

function isDateOnlyLine(line) {
  const m = matchDate(line)
  if (!m) return false
  const after = line.slice(m.index + m[0].length).replace(/[|–—\-\s]+/, '').trim()
  return m.index <= 2 && after === ''
}

function endsSentence(l) {
  return /[.!?]$/.test((l || '').trim())
}

function parseJobHeaderLine(line) {
  const m = matchDate(line)
  if (!m) return { title: sanitizeLine(line), company: '', date: '' }
  const date = m[0]
  const before = line.slice(0, m.index).replace(/[,|—\-\s]+$/, '').trim()
  if (before.includes(',')) {
    const idx = before.indexOf(',')
    return {
      title: before.slice(0, idx).trim(),
      company: before.slice(idx + 1).trim(),
      date,
    }
  }
  return { title: before, company: '', date }
}

function mergeFragments(blocks) {
  // Repair blocks broken by stray blank lines:
  //  - A block STARTING with a bullet has no header — its bullets belong to the
  //    previous job (a blank line split a job's bullet list in half).
  //  - A no-bullet block followed by a block starting with a bullet is a
  //    split-off header — merge the two.
  const result = []
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i].trim()
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    const startsBlt = lines.length > 0 && isBullet(lines[0])
    const hasBlt = lines.some(isBullet)

    if (startsBlt && result.length) {
      result[result.length - 1] += '\n' + block
      i++
      continue
    }

    if (!hasBlt && i + 1 < blocks.length) {
      const nextFirst = blocks[i + 1].trim().split('\n').map(l => l.trim()).find(Boolean) || ''
      if (isBullet(nextFirst)) {
        result.push(block + '\n' + blocks[i + 1].trim())
        i += 2
        continue
      }
    }

    result.push(block)
    i++
  }
  return result.length ? result : blocks
}

// Split a flat run of lines into per-job blocks.
// A non-bullet line AFTER bullets started is either a new job header or a
// wrapped continuation of the previous bullet. Decision order:
//   1. date-only line                    -> new job   ('08/2024 – 09/2025')
//   2. uppercase line containing a date  -> new job   ('Title, Co 01/2024 – 07/2025')
//   3. ends with sentence punctuation    -> continuation ('cycles and faster delivery.')
//   4. next line is date-only            -> new job   ('Title, Co' + date below)
//   5. date within 3 non-bullet lines    -> new job   (multi-line headers)
//   6. default                           -> continuation
function splitLinesIntoJobs(lines) {
  const result = []
  let cur = []
  let inBullets = false

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (isBullet(l)) {
      inBullets = true
      cur.push(l)
      continue
    }
    if (!inBullets) {
      cur.push(l)
      continue
    }

    let newJob = false
    if (isDateOnlyLine(l)) {
      newJob = true
    } else if (hasDate(l) && !endsSentence(l) && /^[A-Z0-9]/.test(l)) {
      newJob = true
    } else if (endsSentence(l)) {
      newJob = false
    } else if (i + 1 < lines.length && !isBullet(lines[i + 1]) && isDateOnlyLine(lines[i + 1])) {
      newJob = true
    } else {
      for (let k = 1; k <= 3; k++) {
        const li = i + k
        if (li >= lines.length || isBullet(lines[li])) break
        if (hasDate(lines[li])) { newJob = true; break }
      }
    }

    if (newJob) {
      if (cur.length) result.push(cur.join('\n'))
      cur = [l]
      inBullets = false
    } else {
      cur.push(l)
    }
  }
  if (cur.length) result.push(cur.join('\n'))
  return result
}

function splitExpBlocks(content) {
  // Blank lines in PDF extractions are unreliable — a stray blank line can land
  // mid-job while five jobs share one block. ALWAYS sub-split every blank-line
  // block with the line heuristic, then repair the fragments.
  const blocks = content.split(/\n[ \t]*\n/).map(b => b.trim()).filter(Boolean)
  const jobs = []
  for (const b of blocks) {
    jobs.push(...splitLinesIntoJobs(b.split('\n').map(l => l.trim()).filter(Boolean)))
  }
  return mergeFragments(jobs)
}

function appendItemLine(items, line) {
  const text = sanitizeLine(line)
  if (!text) return
  const last = items[items.length - 1]
  if (last) last.text = `${last.text} ${text}`
  else items.push({ type: 'bullet', text })
}

function looksLikeJobTitle(s) {
  return JOB_TITLE_KW.test(s || '')
}

function parseJobHeaderLines(hdrLines) {
  let title = ''
  let company = ''
  let date = ''
  const lines = [...hdrLines]

  // Company-before-title layout — but never treat a date line as the company
  if (
    lines.length >= 2 &&
    !isDateOnlyLine(lines[0]) && !hasDate(lines[0]) &&
    !looksLikeJobTitle(lines[0]) && looksLikeJobTitle(lines[1])
  ) {
    company = lines[0].trim()
    lines.splice(0, 1)
  }

  if (lines.length) {
    const m0 = matchDate(lines[0])
    if (m0 && m0.index === 0 && lines[0].slice(m0[0].length).replace(/[|–—\-\s]+/, '').trim() === '') {
      date = lines[0].trim()
      lines.shift()
    }
  }

  const first = lines[0] || ''
  if (first.includes('|')) {
    const parts = first.split('|').map(p => p.trim())
    const di = parts.findIndex(p => hasDate(p))
    if (di >= 0) {
      if (!date) date = parts[di]
      const rest = parts.filter((_, i) => i !== di)
      if (!title) title = rest[0] || ''
      if (!company) company = rest.slice(1).join(', ')
    } else {
      if (!title) title = parts[0]
      if (!company) company = parts.slice(1).join(', ')
    }
  } else if (first) {
    const m = matchDate(first)
    if (m) {
      if (!date) date = m[0]
      const before = first.slice(0, m.index).replace(/[|–—\-\s]+$/, '').trim()
      if (before.includes(',')) {
        const idx = before.indexOf(',')
        if (!title) title = before.slice(0, idx).trim()
        if (!company) company = before.slice(idx + 1).trim()
      } else if (!title) {
        title = before
      }
    } else if (!title) {
      title = first
    }
  }

  for (const hl of lines.slice(1)) {
    const m = matchDate(hl)
    if (m && !date) {
      date = m[0]
      const nonDate = hl.slice(0, m.index).replace(/[,|—\-\s]+$/, '').trim()
      if (nonDate) {
        if (!company && title) company = title
        title = nonDate
      }
    } else if (!company) {
      company = hl.trim()
    }
  }

  if (!company && title.includes(',')) {
    const idx = title.indexOf(',')
    const maybeCo = title.slice(idx + 1).trim()
    const maybeTitle = title.slice(0, idx).trim()
    if (maybeCo && maybeTitle) {
      title = maybeTitle
      company = maybeCo
    }
  }

  return { title: sanitizeLine(title), company: sanitizeLine(company), date: sanitizeLine(date) }
}

function parseJobBlock(block) {
  const lines = block.split('\n').flatMap(l => expandInlineBullets(l))
  const hdrLines = []
  const items = []
  let foundBullet = false

  for (const l of lines) {
    if (isBullet(l)) {
      foundBullet = true
      items.push({ type: 'bullet', text: stripBullet(l) })
    } else if (!foundBullet) {
      hdrLines.push(l)
    } else {
      appendItemLine(items, l)
    }
  }

  const { title, company, date } = parseJobHeaderLines(hdrLines)

  return {
    title: title.slice(0, 120),
    company: company.slice(0, 100),
    date: date.slice(0, 35),
    bullets: items.map(it => sanitizeLine(it.text)).filter(Boolean),
  }
}

function subSplitBlock(block) {
  const lines = block.split('\n').flatMap(l => expandInlineBullets(l))
  const chunks = []
  let start = 0
  let sawBullet = false

  for (let i = 0; i <= lines.length; i++) {
    const isSplit = i < lines.length && sawBullet && isJobHeaderLine(lines[i])
    const isEnd = i === lines.length
    if (isSplit || isEnd) {
      const chunk = lines.slice(start, i).join('\n').trim()
      if (chunk) chunks.push(chunk)
      start = i
      sawBullet = false
    }
    if (i < lines.length && isBullet(lines[i])) sawBullet = true
  }
  return chunks.length ? chunks : [block]
}

function cleanBulletText(bullet) {
  const m = INLINE_JOB_RE.exec(bullet)
  return sanitizeLine(m ? m[1] : bullet)
}

function expandExperienceJobs(jobs) {
  // Strip embedded next-job headers from bullet tails — real job boundaries
  // come from splitExpBlocks, not from inline bullet splitting.
  return jobs.map(job => ({
    ...job,
    bullets: job.bullets.map(cleanBulletText).filter(Boolean),
  }))
}

export function parseExperienceJobs(content) {
  const jobs = []
  for (const block of splitExpBlocks(content)) {
    for (const chunk of subSplitBlock(block)) {
      jobs.push(parseJobBlock(chunk))
    }
  }
  return expandExperienceJobs(jobs)
}
