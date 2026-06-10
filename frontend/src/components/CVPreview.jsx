// CV Preview component — matches screenshot design (black/white, icon + rule headers)
import { parseExperienceJobs } from '../utils/experienceParser'
import { parseProjectBlocks } from '../utils/projectParser'

const DATE_RE = /\b(\d{1,2}[\/\-]\d{4}|\d{4})(?:\s*[-–—to]+\s*(?:present|current|now|\d{1,2}[\/\-]\d{4}|\d{4}))?/i
const STRIP_RE = /^[•‣⁃◦▪‐‒\-\*\s]+/

const SECTION_ORDER = [
  'summary', 'objective', 'skills', 'experience',
  'education', 'projects', 'certifications', 'languages', 'awards',
]

const SECTION_LABELS = {
  summary:        'Professional Profile',
  objective:      'Professional Profile',
  skills:         'Core Technical Skills',
  experience:     'Professional Experience',
  education:      'Education',
  projects:       'Key Projects',
  certifications: 'Certifications',
  languages:      'Languages',
  awards:         'Awards & Achievements',
}

const SECTION_ICONS = {
  summary:        '📋',
  objective:      '📋',
  skills:         '🧠',
  experience:     '💼',
  education:      '🎓',
  projects:       '📂',
  certifications: '📜',
  languages:      '🌐',
  awards:         '🏆',
}

const SKIP = new Set(['header', 'contact'])

function isBullet(line) {
  return /^[•‣⁃◦▪‐‒\-\*]/.test(line.trim())
}

// ── Section renderers ──────────────────────────────────────────────────────────

function SectionHeader({ sectionKey, label }) {
  const icon = SECTION_ICONS[sectionKey] || '📄'
  return (
    <div className="mt-5 mb-2">
      <div className="flex items-center gap-2">
        <span className="text-[17px] leading-none">{icon}</span>
        <span className="text-[15px] font-bold text-gray-900 leading-tight">{label}</span>
      </div>
      <div className="border-b-[1.5px] border-gray-900 mt-1" />
    </div>
  )
}

function ExperienceSection({ content }) {
  const jobs = parseExperienceJobs(content)
  return (
    <div className="space-y-4">
      {jobs.map((job, i) => {
        const jobLabel = [job.title, job.company].filter(Boolean).join(', ')
        return (
          <div key={i}>
            {(jobLabel || job.date) && (
              <div className="flex justify-between items-baseline gap-4 mb-1">
                <span className="font-bold text-gray-900 text-[11.5px] leading-snug">{jobLabel}</span>
                {job.date && (
                  <span className="text-[10.5px] text-gray-800 whitespace-nowrap flex-shrink-0">{job.date}</span>
                )}
              </div>
            )}
            <div className="space-y-0.5">
              {job.bullets.map((text, j) => (
                <div key={j} className="flex text-[10.5px] text-gray-800 leading-snug">
                  <span className="mr-1.5 mt-px flex-shrink-0">•</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SkillsSection({ content }) {
  // Handle PDF 2-column extraction where consecutive headers appear before their values
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)

  const isLbl = l =>
    l.endsWith(':') &&
    !l.includes(',') &&
    l.split(/\s+/).length <= 8 &&
    l.length < 60

  const cats = []
  let pendingLabels = []
  let pendingVals = []

  const flush = () => {
    if (!pendingLabels.length) return
    const n = pendingLabels.length
    const cleanVal = vals => vals.join(' ').replace(/,(\s*,)+/g, ',').replace(/\s+/g, ' ').trim()
    if (n === 1) {
      cats.push({ label: pendingLabels[0], value: cleanVal(pendingVals) })
    } else {
      const total = pendingVals.length
      const per = Math.ceil(total / n)
      pendingLabels.forEach((lbl, i) => {
        const start = i * per
        const end = Math.min(start + per, total)
        cats.push({ label: lbl, value: cleanVal(pendingVals.slice(start, end)) })
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
      pendingVals.push(l.replace(STRIP_RE, ''))
    }
  }
  flush()

  const Col = ({ items }) => (
    <div className="space-y-3">
      {items.map((cat, i) => (
        <div key={i}>
          {cat.label && (
            <div className="text-[11.5px] font-bold text-gray-900 mb-0.5">{cat.label}</div>
          )}
          {cat.value && (
            <div className="text-[11px] text-gray-800 pl-2 leading-relaxed">{cat.value}</div>
          )}
        </div>
      ))}
    </div>
  )

  if (cats.length < 2) return <Col items={cats} />

  const left  = cats.filter((_, i) => i % 2 === 0)
  const right = cats.filter((_, i) => i % 2 === 1)

  return (
    <div className="grid grid-cols-2 gap-x-8">
      <Col items={left} />
      <Col items={right} />
    </div>
  )
}

function ProjectsSection({ content }) {
  const projects = parseProjectBlocks(content)
  return (
    <div className="space-y-4">
      {projects.map((p, i) => (
        <div key={i}>
          <div className="text-[11.5px] font-bold text-gray-900 mb-1">{p.title}</div>
          {p.desc && (
            <div className="text-[10.5px] text-gray-800 text-justify leading-relaxed mb-1">
              {p.desc}
            </div>
          )}
          {p.ts && (
            <div className="text-[10px]">
              <span className="font-bold italic">Tech Stack: </span>
              <span className="italic">{p.ts}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function StructuredSection({ content }) {
  const blocks = content.split(/\n[ \t]*\n/).filter(b => b.trim())
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        let lines = block.split('\n').map(l => l.trim()).filter(Boolean)
        let dt = ''
        // Date-only first line ('02/2017 – 08/2021') is the block's date —
        // the real title (degree/cert) is the next line.
        const m0 = DATE_RE.exec(lines[0] || '')
        if (m0 && m0.index === 0 && !(lines[0].slice(m0[0].length).replace(/[\s|–—-]+/g, ''))) {
          dt = lines[0]
          lines = lines.slice(1)
        }
        const first = lines[0] || ''
        const m     = DATE_RE.exec(first)
        const ttl   = (m ? first.slice(0, m.index).replace(/[|–—\-\s]+$/, '').trim() : first).replace(/,$/, '')
        if (m && !dt) dt = m[0]
        return (
          <div key={i}>
            <div className="flex justify-between items-baseline gap-4">
              <span className="font-bold text-gray-900 text-[11.5px]">{ttl}</span>
              <span className="text-[10.5px] text-gray-700 whitespace-nowrap flex-shrink-0">{dt}</span>
            </div>
            {lines.slice(1).map((l, j) => (
              <div key={j} className={`text-[10.5px] mt-0.5 ${isBullet(l) ? 'flex text-gray-800' : 'text-gray-800 font-semibold'}`}>
                {isBullet(l)
                  ? <><span className="mr-2 flex-shrink-0">•</span><span>{l.replace(STRIP_RE, '')}</span></>
                  : l}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function ProseSection({ content }) {
  const paras = []
  const buf   = []
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t) {
      if (buf.length) { paras.push({ type: 'para', text: buf.join(' ') }); buf.length = 0 }
    } else if (isBullet(t)) {
      if (buf.length) { paras.push({ type: 'para', text: buf.join(' ') }); buf.length = 0 }
      paras.push({ type: 'bullet', text: t.replace(STRIP_RE, '') })
    } else {
      buf.push(t)
    }
  }
  if (buf.length) paras.push({ type: 'para', text: buf.join(' ') })

  return (
    <div className="space-y-1.5">
      {paras.map((p, i) =>
        p.type === 'bullet' ? (
          <div key={i} className="flex text-[10.5px] text-gray-800">
            <span className="mr-2 flex-shrink-0">•</span><span>{p.text}</span>
          </div>
        ) : (
          <p key={i} className="text-[10.5px] text-gray-800 text-justify leading-relaxed">{p.text}</p>
        )
      )}
    </div>
  )
}

// ── Contact row ────────────────────────────────────────────────────────────────

const CONTACT_HINT_RE = /[@]|linkedin|github|portfolio|website|\+?\d[\d\s\-().]{6,}\d/i
const ZERO_WIDTH_RE = /[​‌‍﻿]/g

function extractDisplayName(headerRaw) {
  const lines = (headerRaw || '').split('\n').map(l => l.trim()).filter(Boolean)
  return lines.find(l => !CONTACT_HINT_RE.test(l)) || lines[0] || ''
}

function mergeContactItems(headerRaw, rawContact) {
  const fromContact = (rawContact || '').split('\n')
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

function ContactRow({ rawHeader, rawContact }) {
  const items = mergeContactItems(rawHeader, rawContact)
  if (!items.length) return null

  const getIcon = (text) => {
    if (/@/.test(text)) return '✉'
    if (/^\+?[\d\s\-().]{7,}$/.test(text)) return '☏'
    if (/linkedin/i.test(text)) return '🔗'
    if (/github/i.test(text)) return '💻'
    if (/portfolio|website/i.test(text)) return '🌐'
    return '•'
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[10.5px] text-gray-600 mt-2">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-[11px]">{getIcon(item)}</span>
          <span>{item}</span>
        </span>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CVPreview({ sections, downloadButton }) {
  if (!sections) return null

  const name    = (sections.header  || '').trim()
  const contact = (sections.contact || '').trim()

  const STRUCTURED = new Set(['education', 'certifications', 'awards'])

  const orderedKeys = [
    ...SECTION_ORDER.filter(k => sections[k]?.trim() && !SKIP.has(k)),
    ...Object.keys(sections).filter(k => !SECTION_ORDER.includes(k) && !SKIP.has(k) && sections[k]?.trim()),
  ]

  return (
    <div>
      {/* Download button slot */}
      {downloadButton && (
        <div className="mb-5">{downloadButton}</div>
      )}

      {/* CV preview — matches screenshot design */}
      <div
        className="bg-white rounded-lg overflow-hidden border border-gray-200 px-8 py-6"
        style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
      >
        {/* Name */}
        {name && (
          <div className="text-center">
            <h1 className="text-[26px] font-bold text-gray-900 leading-tight">
              {extractDisplayName(name)}
            </h1>
            <ContactRow rawHeader={name} rawContact={contact} />
            <div className="border-b-[1.5px] border-gray-900 mt-3" />
          </div>
        )}

        {/* Sections */}
        <div className="space-y-0">
          {orderedKeys.map(key => {
            const content = (sections[key] || '').trim()
            if (!content) return null
            const label = SECTION_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

            return (
              <div key={key}>
                <SectionHeader sectionKey={key} label={label} />
                {key === 'experience'                && <ExperienceSection content={content} />}
                {key === 'skills'                    && <SkillsSection     content={content} />}
                {key === 'projects'                  && <ProjectsSection   content={content} />}
                {STRUCTURED.has(key)                 && <StructuredSection content={content} />}
                {!['experience','skills','projects',...STRUCTURED].includes(key) && (
                  <ProseSection content={content} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
