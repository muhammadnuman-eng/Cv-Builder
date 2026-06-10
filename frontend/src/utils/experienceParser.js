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

function isLikelyJobStart(line, lines, idx) {
  if (isBullet(line)) return false
  if (isJobHeaderLine(line)) return true
  if (line.includes('|')) return true
  if (hasDate(line) && !/[.!?]$/.test(line.trim())) return true

  for (let k = 1; k <= 5; k++) {
    const li = idx + k
    if (li >= lines.length) break
    if (isBullet(lines[li])) break
    if (hasDate(lines[li])) return true
  }

  if (looksLikeJobTitle(line) && line.includes(',') && !/[.!?]$/.test(line.trim())) {
    for (let k = 1; k <= 3; k++) {
      const nl = lines[idx + k]
      if (!nl) break
      if (isBullet(nl)) break
      if (isDateOnlyLine(nl) || isJobHeaderLine(nl)) return true
    }
  }
  return false
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
  // Only merge a no-bullet block with the NEXT block if the next block STARTS with
  // a bullet — meaning the no-bullet block is a split-off header, not a brief job.
  // If the next block starts with a non-bullet (e.g. another company name), keep both
  // blocks separate so brief/no-bullet jobs don't get swallowed by the following job.
  const result = []
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i].trim()
    const hasBlt = block.split('\n').some(l => isBullet(l.trim()))
    if (!hasBlt && i + 1 < blocks.length) {
      const nextBlock = blocks[i + 1].trim()
      const nextFirstNonEmpty = nextBlock.split('\n').map(l => l.trim()).find(Boolean) || ''
      if (isBullet(nextFirstNonEmpty)) {
        // Header fragment + its bullet block → merge into one job block
        result.push(block + '\n' + nextBlock)
        i += 2
        continue
      }
    }
    result.push(block)
    i++
  }
  return result.length ? result : blocks
}

function splitExpBlocksByLines(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const result = []
  let cur = []
  let inBullets = false

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (isBullet(l)) {
      inBullets = true
      cur.push(l)
    } else if (!inBullets) {
      cur.push(l)
    } else if (isLikelyJobStart(l, lines, i)) {
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
  const blankBlocks = content.split(/\n[ \t]*\n/).map(b => b.trim()).filter(Boolean)
  const lineBlocks = mergeFragments(splitExpBlocksByLines(content))
  const blankMerged = mergeFragments(blankBlocks)

  return lineBlocks.length >= blankMerged.length ? lineBlocks : blankMerged
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

  if (lines.length >= 2 && !looksLikeJobTitle(lines[0]) && looksLikeJobTitle(lines[1])) {
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
