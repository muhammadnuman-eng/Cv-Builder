const PLATFORM_RE = /^(github|gitlab|bitbucket|portfolio|linkedin|website|projects?|link)$/i
const BULLET_RE = /^[•‣⁃◦▪‐‒\-\*·●]\s*/

// "AI-Powered ERP Assistant, ERPNext + LLM..." — requires 2+ words before comma
const PROJECT_TITLE_RE =
  /(?:^|[\n\r]|(?<=[.!?])\s+)((?:[A-Z][A-Za-z0-9-]+(?:\s+[A-Za-z0-9&+().'\-/]+){1,12}),\s*(?:[A-Z][A-Za-z0-9][^\n.]{4,90}))/g

const NEXT_PROJ_IN_STACK_RE =
  /\s+(?=(?:[A-Z][A-Za-z0-9-]+(?:\s+[A-Za-z0-9&+().'\-/]+){1,10}),\s*[A-Z][A-Za-z0-9])/

function sanitize(s) {
  return (s || '').replace(/\s+/g, ' ').trim()
}

function wordsBeforeComma(t) {
  const idx = t.indexOf(',')
  if (idx < 0) return 0
  return t.slice(0, idx).trim().split(/\s+/).filter(Boolean).length
}

export function isProjectTitleLine(line) {
  const t = sanitize(line)
  if (!t || t.length < 4 || t.length > 130) return false
  if (/^tech\s*stack:/i.test(t)) return false
  if (PLATFORM_RE.test(t)) return false
  if (BULLET_RE.test(t)) return false
  if (/^[A-Z0-9][^.\n]{0,110},\s*[A-Z0-9]/.test(t) && wordsBeforeComma(t) >= 2) return true
  if (
    /^[A-Z][A-Za-z0-9\s&+().'\-/]{3,90}$/.test(t) &&
    !/[.!?]$/.test(t) &&
    t.split(/\s+/).length <= 12
  ) {
    return true
  }
  return false
}

function parseOneProjBlock(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  let title = lines[0] || ''
  let bodyLines = lines.slice(1)

  // Title may be embedded in a run-on first line: "Title, Sub Built a..."
  if (title && !isProjectTitleLine(title)) {
    const m = title.match(/^([A-Z][^.!?]{4,110},\s*[A-Z][^.!?]{4,90})\s+(.+)$/s)
    if (m) {
      title = m[1].trim()
      bodyLines = [m[2].trim(), ...bodyLines]
    }
  }

  const tsIdx = bodyLines.findIndex(l => /^tech\s*stack:/i.test(l))
  let desc = ''
  let ts = ''

  if (tsIdx >= 0) {
    desc = bodyLines.slice(0, tsIdx).join(' ')
    ts = bodyLines[tsIdx].replace(/^tech\s*stack:\s*/i, '')
  } else {
    const bodyText = bodyLines.join(' ')
    const inlineTs = bodyText.match(/^(.*?)[,.]?\s*Tech\s+Stack:\s*(.+)$/is)
    if (inlineTs) {
      let stack = inlineTs[2].trim()
      const splitIdx = stack.search(NEXT_PROJ_IN_STACK_RE)
      if (splitIdx > 0) {
        desc = inlineTs[1].replace(/[,.]$/, '').trim()
        ts = stack.slice(0, splitIdx).trim()
      } else {
        desc = inlineTs[1].replace(/[,.]$/, '').trim()
        ts = stack
      }
    } else {
      desc = bodyText
    }
  }

  return { title: sanitize(title), desc: sanitize(desc), ts: sanitize(ts) }
}

function splitByTitleAnchors(text) {
  const matches = [...text.matchAll(PROJECT_TITLE_RE)]
  if (matches.length <= 1) return []

  const blocks = []
  for (let i = 0; i < matches.length; i++) {
    const raw = matches[i][0]
    const title = matches[i][1]
    const start = matches[i].index + raw.indexOf(title)
    const end = i + 1 < matches.length
      ? matches[i + 1].index + matches[i + 1][0].indexOf(matches[i + 1][1])
      : text.length
    blocks.push(text.slice(start, end).trim())
  }
  return blocks
}

function splitInlineTechStackLine(line) {
  const m = line.match(/^(.*?)\s*Tech\s+Stack:\s*(.+)$/i)
  if (!m) return [{ type: 'line', text: line }]

  const before = m[1].replace(/[,.]$/, '').trim()
  let stackPart = m[2].trim()
  const pieces = []

  const splitIdx = stackPart.search(NEXT_PROJ_IN_STACK_RE)
  if (splitIdx > 0) {
    const stack = stackPart.slice(0, splitIdx).trim()
    const remainder = stackPart.slice(splitIdx).trim()
    if (before) pieces.push({ type: 'line', text: before })
    pieces.push({ type: 'line', text: 'Tech Stack: ' + stack })
    pieces.push({ type: 'break' })
    if (remainder) pieces.push({ type: 'line', text: remainder })
    return pieces
  }

  if (before) pieces.push({ type: 'line', text: before })
  pieces.push({ type: 'line', text: 'Tech Stack: ' + stackPart })
  pieces.push({ type: 'break' })
  return pieces
}

function linesToBlocks(lines) {
  const blocks = []
  let cur = []

  const flush = () => {
    const text = cur.join('\n').trim()
    if (text) blocks.push(text)
    cur = []
  }

  for (const line of lines) {
    const parts = splitInlineTechStackLine(line)
    for (const part of parts) {
      if (part.type === 'break') {
        flush()
      } else if (isProjectTitleLine(part.text) && cur.length > 0) {
        const first = cur[0] || ''
        if (cur.length > 1 || !isProjectTitleLine(first)) flush()
        cur.push(part.text)
      } else {
        cur.push(part.text)
      }
    }
  }
  flush()
  return blocks
}

function normalizeProjectText(text) {
  return text
    .split('\n')
    .filter(l => !PLATFORM_RE.test(l.trim()))
    .join('\n')
    .trim()
}

export function parseProjectBlocks(text) {
  const normalized = normalizeProjectText(text)
  if (!normalized) return []

  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean)
  const titleLineCount = lines.filter(isProjectTitleLine).length

  let raw = []
  if (titleLineCount >= 2) {
    raw = linesToBlocks(lines)
  } else {
    const anchorBlocks = splitByTitleAnchors(normalized)
    const byBlank = normalized.split(/\n[ \t]*\n/).map(b => b.trim()).filter(Boolean)
    const lineBlocks = []
    for (const chunk of (byBlank.length ? byBlank : [normalized])) {
      lineBlocks.push(...linesToBlocks(chunk.split('\n').map(l => l.trim()).filter(Boolean)))
    }
    raw = anchorBlocks.length > lineBlocks.length ? anchorBlocks : lineBlocks
  }
  const unique = []
  const seen = new Set()

  for (const block of raw) {
    const key = block.slice(0, 80)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(block)
  }

  return unique
    .map(parseOneProjBlock)
    .filter(p => {
      if (!p.title && !p.desc && !p.ts) return false
      if (p.title && isProjectTitleLine(p.title)) return true
      if (p.title && wordsBeforeComma(p.title) >= 2 && /^[A-Z]/.test(p.title)) return true
      return Boolean(p.desc && p.ts)
    })
}
