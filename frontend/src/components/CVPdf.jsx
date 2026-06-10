// @react-pdf/renderer document — matches the original CV design exactly
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { parseExperienceJobs } from '../utils/experienceParser'
import { parseProjectBlocks } from '../utils/projectParser'

// Emoji render as embedded twemoji images — Helvetica has no emoji glyphs
Font.registerEmojiSource({
  format: 'png',
  url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/',
})

const BLK = '#1a1a1a'
const GRY = '#555555'

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: BLK,
    paddingTop: 30,
    paddingBottom: 30,
    paddingLeft: 44,
    paddingRight: 44,
    lineHeight: 1.35,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  name: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 26,
    lineHeight: 1.2,
    textAlign: 'center',
    marginBottom: 14,
  },
  contactLine: {
    fontSize: 9.5,
    color: GRY,
    textAlign: 'center',
    lineHeight: 1.6,
    marginTop: 2,
  },
  hrBold: {
    borderBottomWidth: 1.3,
    borderBottomColor: BLK,
    marginBottom: 10,
  },

  // ── Section header ─────────────────────────────────────────────────────────
  // secWrap uses wrap={false} so the title + hrThin never split across pages
  secWrap: {
    marginTop: 10,
  },
  secTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
  },
  hrThin: {
    borderBottomWidth: 0.75,
    borderBottomColor: BLK,
    marginTop: 3,
    marginBottom: 7,
  },

  // ── Body prose ───────────────────────────────────────────────────────────────
  body: {
    fontSize: 10,
    lineHeight: 1.5,
    textAlign: 'justify',
  },

  // ── Skills ──────────────────────────────────────────────────────────────────
  skRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 6,
  },
  skCol: {
    width: '50%',
    paddingRight: 12,
  },
  skLbl: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 1.5,
  },
  skVal: {
    fontSize: 9.5,
    lineHeight: 1.4,
    color: BLK,
  },

  // ── Experience ───────────────────────────────────────────────────────────────
  jobBlock: {
    marginBottom: 12,
  },
  jobHdrRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  jobHdrTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    width: '72%',
    lineHeight: 1.45,
  },
  jobHdrDate: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    width: '28%',
    textAlign: 'right',
    lineHeight: 1.45,
  },
  company: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 3,
  },
  bltList: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.55,
    marginTop: 2,
  },

  // ── Projects ─────────────────────────────────────────────────────────────────
  projBlock: {
    marginBottom: 8,
  },
  projTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    marginBottom: 2,
    lineHeight: 1.3,
  },
  projDesc: {
    fontSize: 10,
    lineHeight: 1.45,
    textAlign: 'justify',
    marginBottom: 2,
  },
  techLbl: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 9.5,
  },
  techVal: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 9.5,
  },

  // ── Education / Certs ────────────────────────────────────────────────────────
  eduBlock: {
    marginBottom: 6,
  },
  eduHdrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eduTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    flex: 1,
  },
  eduDate: {
    fontSize: 10,
    textAlign: 'right',
  },
  eduInst: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginTop: 1,
  },
  eduExtra: {
    fontSize: 10,
    marginTop: 1,
    lineHeight: 1.4,
  },
})

// ─── Helpers ───────────────────────────────────────────────────────────────────
// NON-global regex — avoids lastIndex state bugs between repeated exec() calls
const DATE_RE_STR = String.raw`\b(\d{1,2}[/\-]\d{4}|\d{4})(?:\s*[-–—to]+\s*(?:present|current|now|\d{1,2}[/\-]\d{4}|\d{4}))?`
const matchDate = str => new RegExp(DATE_RE_STR, 'i').exec(str)

const TRAIL_SEP_RE = /[|–—,\-\s]+$/

function sanitizeLine(s) {
  return (s || '').replace(/\s+/g, ' ').trim()
}

const CONTACT_HINT_RE = /[@]|linkedin|github|portfolio|website|\+?\d[\d\s\-().]{6,}\d/i
const ZERO_WIDTH_RE = /[​‌‍﻿]/g

function extractDisplayName(headerRaw) {
  const headerLines = (headerRaw || '').split('\n').map(l => l.trim()).filter(Boolean)
  const nameLine = headerLines.find(l => !CONTACT_HINT_RE.test(l) && l.length >= 2)
  if (nameLine) return sanitizeLine(nameLine)
  if (headerLines[0]) return sanitizeLine(headerLines[0])
  return ''
}

// Merge contact lines from BOTH the contact section and any contact-ish lines
// the parser left inside the header (older parses) — deduped, zero-width cleaned.
function parseContactItems(headerRaw, contactRaw) {
  const fromContact = (contactRaw || '').split('\n')
  const fromHeader = (headerRaw || '').split('\n').filter(l => CONTACT_HINT_RE.test(l))
  const seen = new Set()
  const items = []
  for (const raw of [...fromContact, ...fromHeader]) {
    const t = raw.replace(ZERO_WIDTH_RE, '').trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(t)
  }
  return items
}

function contactIcon(text) {
  if (/@/.test(text))                     return '✉️ '
  if (/^\+?[\d\s\-().]{7,}$/.test(text))  return '📞 '
  if (/linkedin/i.test(text))             return '🔗 '
  if (/github/i.test(text))               return '💻 '
  if (/portfolio|website/i.test(text))    return '🌐 '
  return ''
}

function cleanCommas(s) {
  return sanitizeLine(s).replace(/,(\s*,)+/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '')
}

function chunkSkillVal(val, n = 8) {
  const items = cleanCommas(val).split(',').map(s => s.trim()).filter(Boolean)
  if (items.length <= n) return [items.join(', ') || '']
  const chunks = []
  for (let i = 0; i < items.length; i += n) {
    chunks.push(items.slice(i, i + n).join(', '))
  }
  return chunks
}

const BULLET_RE = /^[•‣⁃◦▪‐‒\-\*·●○]\s*/
function isBullet(l) { return BULLET_RE.test(l.trim()) }
function stripBullet(l) { return l.replace(/^[•‣⁃◦▪‐‒\-\*·●○\s]+/, '') }

// ─── Skills parser ─────────────────────────────────────────────────────────────
// Handles 2-column PDFs where category headers appear consecutively before values.
// MAX_SKILL_CHARS prevents stray text from bleeding into skill values.
const MAX_SKILL_CHARS = 350

function parseSkills(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const isLbl = l => l.endsWith(':') && !l.includes(',') && l.split(/\s+/).length <= 8 && l.length < 60

  const cats = []
  let pendingLabels = []
  let pendingVals = []

  const flush = () => {
    if (!pendingLabels.length) return
    const n = pendingLabels.length
    if (n === 1) {
      let val = cleanCommas(pendingVals.join(' '))
      if (val.length > MAX_SKILL_CHARS) val = val.slice(0, MAX_SKILL_CHARS).replace(/,\s*[^,]*$/, '')
      cats.push({ lbl: pendingLabels[0], val })
    } else {
      const total = pendingVals.length
      const per = Math.ceil(total / n)
      pendingLabels.forEach((lbl, i) => {
        const start = i * per
        const end = Math.min(start + per, total)
        let val = cleanCommas(pendingVals.slice(start, end).join(' '))
        if (val.length > MAX_SKILL_CHARS) val = val.slice(0, MAX_SKILL_CHARS).replace(/,\s*[^,]*$/, '')
        cats.push({ lbl, val })
      })
    }
    pendingLabels = []
    pendingVals = []
  }

  for (const l of lines) {
    if (isLbl(l)) {
      if (pendingVals.length > 0) flush()
      pendingLabels.push(l)
    } else {
      pendingVals.push(stripBullet(l))
    }
  }
  flush()
  return cats
}

// ─── Education / Certifications parsers ────────────────────────────────────────
// A date-only first line ('02/2017 – 08/2021') is the block's date — the title
// (degree/cert name) is the NEXT line, the institution after that.
function shiftDateOnlyFirst(lines) {
  const first = lines[0] || ''
  const m = matchDate(first)
  if (m && m.index === 0 && !first.slice(m[0].length).replace(/[\s|–—-]+/g, '')) {
    return { dt: first.trim(), rest: lines.slice(1) }
  }
  return { dt: '', rest: lines }
}

function parseEdu(text) {
  return text.split(/\n\s*\n/).filter(b => b.trim()).map(block => {
    const all = block.split('\n').map(l => l.trim()).filter(Boolean)
    let { dt, rest } = shiftDateOnlyFirst(all)
    const first = rest[0] || ''
    const m = matchDate(first)
    const title = (m ? first.slice(0, m.index).replace(TRAIL_SEP_RE, '').trim() : first).replace(/,$/, '')
    if (m && !dt) dt = m[0]
    return { title, dt, inst: rest[1] || '', extra: rest.slice(2).join(' ') }
  })
}

function parseCerts(text) {
  return text.split(/\n\s*\n/).filter(b => b.trim()).map(block => {
    const all = block.split('\n').map(l => l.trim()).filter(Boolean)
    let { dt, rest } = shiftDateOnlyFirst(all)
    const first = rest[0] || ''
    const m = matchDate(first)
    const title = (m ? first.slice(0, m.index).replace(TRAIL_SEP_RE, '').trim() : first).replace(/,$/, '')
    if (m && !dt) dt = m[0]
    return { title, dt, rest: rest.slice(1).join(' ') }
  })
}

// ─── Section header ────────────────────────────────────────────────────────────
function SecHeader({ title }) {
  return (
    <View style={S.secWrap} wrap={false}>
      <Text style={S.secTitle}>{title}</Text>
      <View style={S.hrThin} />
    </View>
  )
}

// ─── Main PDF Document ─────────────────────────────────────────────────────────
export default function CVPdf({ sections }) {
  if (!sections) return null

  const name       = (sections.header         || '').trim()
  const contactRaw = (sections.contact        || '').trim()
  const summary    = (sections.summary        || sections.objective || '').trim()
  const skillsText = (sections.skills         || '').trim()
  const expText    = (sections.experience     || '').trim()
  const projText   = (sections.projects       || '').trim()
  const eduText    = (sections.education      || '').trim()
  const certsText  = (sections.certifications || '').trim()
  const awardsText = (sections.awards         || '').trim()
  const langsText  = (sections.languages      || '').trim()

  const displayName = extractDisplayName(name)
  const contactItems = parseContactItems(name, contactRaw)
  const summaryParas = summary.split(/\n\s*\n/).map(p => sanitizeLine(p)).filter(Boolean)

  const skills      = parseSkills(skillsText)
  const leftSkills  = skills.filter((_, i) => i % 2 === 0)
  const rightSkills = skills.filter((_, i) => i % 2 === 1)
  const skillRows   = Math.max(leftSkills.length, rightSkills.length)

  const expBlocks  = expText   ? parseExperienceJobs(expText) : []
  const projBlocks = projText  ? parseProjectBlocks(projText) : []
  const eduBlocks  = eduText   ? parseEdu(eduText)         : []
  const certBlocks = certsText ? parseCerts(certsText)     : []

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* Name + contact (single Text per row — flex-row Texts overlap in react-pdf) */}
        {(displayName || contactItems.length > 0) ? (
          <View style={S.headerWrap}>
            {displayName ? <Text style={S.name}>{displayName}</Text> : null}
            {contactItems.length > 0 ? (
              <Text style={S.contactLine}>
                {contactItems.map(it => contactIcon(it) + it).join('     ')}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={S.hrBold} />

        {/* Professional Profile */}
        {summaryParas.length > 0 ? (
          <View>
            <SecHeader title="Professional Profile" />
            {summaryParas.map((p, i) => (
              <Text key={i} style={[S.body, i > 0 ? { marginTop: 6 } : {}]}>{p}</Text>
            ))}
          </View>
        ) : null}

        {/* Core Technical Skills — 2-column grid, View wrappers (not Fragments) */}
        {skills.length > 0 ? (
          <View>
            <SecHeader title="Core Technical Skills" />
            {Array.from({ length: skillRows }).map((_, i) => (
              <View key={i} style={S.skRow}>
                <View style={S.skCol}>
                  {leftSkills[i] ? (
                    <View>
                      <Text style={S.skLbl}>{leftSkills[i].lbl}</Text>
                      {chunkSkillVal(leftSkills[i].val).filter(Boolean).map((chunk, ci) => (
                        <Text key={ci} style={[S.skVal, ci > 0 ? { marginTop: 2 } : {}]}>{chunk}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={S.skCol}>
                  {rightSkills[i] ? (
                    <View>
                      <Text style={S.skLbl}>{rightSkills[i].lbl}</Text>
                      {chunkSkillVal(rightSkills[i].val).filter(Boolean).map((chunk, ci) => (
                        <Text key={ci} style={[S.skVal, ci > 0 ? { marginTop: 2 } : {}]}>{chunk}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Professional Experience — title+date row, bold company row, bullets */}
        {expBlocks.length > 0 ? (
          <View>
            <SecHeader title="Professional Experience" />
            {expBlocks.map((job, i) => {
              const bulletText = job.bullets.map(b => `•  ${b}`).join('\n')
              return (
                <View key={i} style={S.jobBlock}>
                  {(job.title || job.date) ? (
                    <View style={S.jobHdrRow}>
                      <Text style={S.jobHdrTitle}>{job.title || ''}</Text>
                      <Text style={S.jobHdrDate}>{job.date || ''}</Text>
                    </View>
                  ) : null}
                  {job.company ? <Text style={S.company}>{job.company}</Text> : null}
                  {bulletText ? <Text style={S.bltList}>{bulletText}</Text> : null}
                </View>
              )
            })}
          </View>
        ) : null}

        {/* Key Projects */}
        {projBlocks.length > 0 ? (
          <View>
            <SecHeader title="Key Projects" />
            {projBlocks.map((p, i) => (
              <View key={i} style={S.projBlock}>
                <Text style={S.projTitle}>{p.title}</Text>
                {p.desc ? <Text style={S.projDesc}>{p.desc}</Text> : null}
                {p.ts ? (
                  <Text style={S.projDesc}>
                    <Text style={S.techLbl}>Tech Stack: </Text>
                    <Text style={S.techVal}>{p.ts}</Text>
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Education */}
        {eduBlocks.length > 0 ? (
          <View>
            {eduBlocks.map((e, i) => (
              <View key={i} style={i > 0 ? S.eduBlock : {}}>
                {i === 0 && <SecHeader title="Education" />}
                <View style={S.eduHdrRow}>
                  <Text style={S.eduTitle}>{e.title}</Text>
                  {e.dt ? <Text style={S.eduDate}>{e.dt}</Text> : null}
                </View>
                {e.inst ? <Text style={S.eduInst}>{e.inst}</Text> : null}
                {e.extra ? <Text style={S.eduExtra}>{e.extra}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Certifications */}
        {certBlocks.length > 0 ? (
          <View>
            {certBlocks.map((c, i) => (
              <View key={i} style={i > 0 ? S.eduBlock : {}}>
                {i === 0 && <SecHeader title="Certifications" />}
                <View style={S.eduHdrRow}>
                  <Text style={S.eduTitle}>{c.title}</Text>
                  {c.dt ? <Text style={S.eduDate}>{c.dt}</Text> : null}
                </View>
                {c.rest ? <Text style={S.eduExtra}>{c.rest}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Awards */}
        {awardsText ? (
          <View>
            <SecHeader title="Awards & Achievements" />
            {awardsText.split('\n').filter(l => l.trim()).map((l, i) => (
              <Text key={i} style={S.body}>{l.trim()}</Text>
            ))}
          </View>
        ) : null}

        {/* Languages */}
        {langsText ? (
          <View>
            <SecHeader title="Languages" />
            {langsText.split('\n').filter(l => l.trim()).map((l, i) => (
              <Text key={i} style={S.body}>{l.trim()}</Text>
            ))}
          </View>
        ) : null}

      </Page>
    </Document>
  )
}
