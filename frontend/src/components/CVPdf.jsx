// @react-pdf/renderer document — matches screenshot design exactly
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { parseExperienceJobs } from '../utils/experienceParser'
import { parseProjectBlocks } from '../utils/projectParser'

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
    marginBottom: 8,
  },
  name: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 26,
    textAlign: 'center',
    marginBottom: 6,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  contactItem: {
    fontSize: 9.5,
    color: GRY,
    marginHorizontal: 8,
    marginBottom: 3,
  },
  hrBold: {
    borderBottomWidth: 1.3,
    borderBottomColor: BLK,
    marginBottom: 10,
  },

  // ── Section header ─────────────────────────────────────────────────────────
  // secWrap uses wrap={false} so the title row + hrThin never split across pages
  secWrap: {
    marginTop: 10,
  },
  secRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secIcon: {
    fontSize: 13,
    marginRight: 5,
    lineHeight: 1,
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

  // ── Experience — one Text block per job (react-pdf overlaps sibling Text nodes) ─
  jobBlock: {
    marginBottom: 12,
  },
  jobHdrRow: {
    flexDirection: 'row',
    marginBottom: 5,
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
  techRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  techLbl: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 9.5,
  },
  techVal: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 9.5,
    flex: 1,
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

function sanitizeLine(s) {
  return (s || '').replace(/\s+/g, ' ').trim()
}

const CONTACT_HINT_RE = /[@]|linkedin|github|portfolio|website|\+?\d[\d\s\-().]{6,}\d/i

function extractDisplayName(headerRaw, contactRaw) {
  const headerLines = (headerRaw || '').split('\n').map(l => l.trim()).filter(Boolean)
  const contactLines = (contactRaw || '').split('\n').map(l => l.trim()).filter(Boolean)
  const nameLine = headerLines.find(l => !CONTACT_HINT_RE.test(l) && l.length >= 2)
  if (nameLine) return sanitizeLine(nameLine)
  if (headerLines[0]) return sanitizeLine(headerLines[0])
  return ''
}

function parseContactItems(contactRaw) {
  return (contactRaw || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
}

function contactIcon(text) {
  if (/@/.test(text)) return '\u2709  '
  if (/^\+?[\d\s\-().]{7,}$/.test(text)) return '\u260E  '
  if (/linkedin/i.test(text)) return '\uD83D\uDD17  '
  if (/github/i.test(text)) return '\uD83D\uDCBB  '
  if (/portfolio|website/i.test(text)) return '\uD83C\uDF10  '
  return '\u2022  '
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

const BULLET_RE = /^[•‣⁃◦▪‐‒\-\*·●○◦▪]\s*/
function isBullet(l) { return BULLET_RE.test(l.trim()) }
function stripBullet(l) { return l.replace(/^[•‣⁃◦▪‐‒\-\*·●○◦▪\s]+/, '') }

// ─── Skills parser ─────────────────────────────────────────────────────────────
// Handles 2-column PDFs where category headers appear consecutively before values.
// MAX_SKILL_CHARS prevents project description text from bleeding into skill values.
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

// ─── Other parsers ─────────────────────────────────────────────────────────────
function parseEdu(text) {
  return text.split(/\n\s*\n/).filter(b => b.trim()).map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    const first = lines[0] || ''
    const m = matchDate(first)
    const title = m ? first.slice(0, m.index).replace(/[|—\-\s]+$/, '').trim() : first
    const dt = m ? m[0] : ''
    return { title, dt, inst: lines[1] || '', extra: lines.slice(2).join(' ') }
  })
}

function parseCerts(text) {
  return text.split(/\n\s*\n/).filter(b => b.trim()).map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    const first = lines[0] || ''
    const m = matchDate(first)
    const title = m ? first.slice(0, m.index).replace(/[|—\-\s]+$/, '').trim() : first
    const dt = m ? m[0] : ''
    return { title, dt, rest: lines.slice(1).join(' ') }
  })
}

// ─── Section header ────────────────────────────────────────────────────────────
// Returns a View (NOT Fragment) so the icon+title row and the hrThin
// are always kept together and never split across pages.
function SecHeader({ icon, title }) {
  return (
    <View style={S.secWrap} wrap={false}>
      <View style={S.secRow}>
        <Text style={S.secIcon}>{icon} </Text>
        <Text style={S.secTitle}>{title}</Text>
      </View>
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

  const displayName = extractDisplayName(name, contactRaw)
  const contactItems = parseContactItems(contactRaw)
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

        {/* ── Name + Contact (image 4 layout — separate rows, no overlap) ── */}
        {(displayName || contactItems.length > 0) ? (
          <View style={S.headerWrap}>
            {displayName ? <Text style={S.name}>{displayName}</Text> : null}
            {contactItems.length > 0 ? (
              <View style={S.contactRow}>
                {contactItems.map((item, i) => (
                  <Text key={i} style={S.contactItem}>
                    {contactIcon(item)}{item}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Bold divider ── */}
        <View style={S.hrBold} />

        {/* ── Professional Profile ── */}
        {summaryParas.length > 0 ? (
          <View>
            <SecHeader icon="📋" title="Professional Profile" />
            {summaryParas.map((p, i) => (
              <Text key={i} style={[S.body, i > 0 ? { marginTop: 6 } : {}]}>{p}</Text>
            ))}
          </View>
        ) : null}

        {/* ── Core Technical Skills ── */}
        {skills.length > 0 ? (
          <View>
            <SecHeader icon="🧠" title="Core Technical Skills" />
            {/* Each row has two columns. Columns use View wrappers (NOT Fragments)
                to avoid the @react-pdf/renderer Fragment layout bug. */}
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

        {/* ── Professional Experience ── */}
        {expBlocks.length > 0 ? (
          <View>
            <SecHeader icon="💼" title="Professional Experience" />
            {expBlocks.map((job, i) => {
              const jobLabel = [job.title, job.company].filter(Boolean).join(', ')
              const bulletText = job.bullets
                .map(b => `\u2022  ${b}`)
                .join('\n')
              return (
                <View key={i} style={S.jobBlock}>
                  {(jobLabel || job.date) ? (
                    <View style={S.jobHdrRow}>
                      <Text style={S.jobHdrTitle}>{jobLabel}</Text>
                      <Text style={S.jobHdrDate}>{job.date || ''}</Text>
                    </View>
                  ) : null}
                  {bulletText ? <Text style={S.bltList}>{bulletText}</Text> : null}
                </View>
              )
            })}
          </View>
        ) : null}

        {/* ── Key Projects ── */}
        {projBlocks.length > 0 ? (
          <View>
            <SecHeader icon="📂" title="Key Projects" />
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

        {/* ── Education ── */}
        {eduBlocks.length > 0 ? (
          <View>
            {eduBlocks.map((e, i) => (
              <View key={i} style={i > 0 ? S.eduBlock : {}}>
                {i === 0 && <SecHeader icon="🎓" title="Education" />}
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

        {/* ── Certifications ── */}
        {certBlocks.length > 0 ? (
          <View>
            {certBlocks.map((c, i) => (
              <View key={i} style={i > 0 ? S.eduBlock : {}}>
                {i === 0 && <SecHeader icon="📜" title="Certifications" />}
                <View style={S.eduHdrRow}>
                  <Text style={S.eduTitle}>{c.title}</Text>
                  {c.dt ? <Text style={S.eduDate}>{c.dt}</Text> : null}
                </View>
                {c.rest ? <Text style={S.eduExtra}>{c.rest}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Awards ── */}
        {awardsText ? (
          <View>
            <SecHeader icon="🏆" title="Awards & Achievements" />
            {awardsText.split('\n').filter(l => l.trim()).map((l, i) => (
              <Text key={i} style={S.body}>{l.trim()}</Text>
            ))}
          </View>
        ) : null}

        {/* ── Languages ── */}
        {langsText ? (
          <View>
            <SecHeader icon="🌐" title="Languages" />
            {langsText.split('\n').filter(l => l.trim()).map((l, i) => (
              <Text key={i} style={S.body}>{l.trim()}</Text>
            ))}
          </View>
        ) : null}

      </Page>
    </Document>
  )
}
