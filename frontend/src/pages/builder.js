import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import Layout from '../components/Layout'
import CVUpload from '../components/CVUpload'
import JobDescInput from '../components/JobDescInput'
import CVPreview from '../components/CVPreview'
import { parseCV, generateCV, downloadGeneratedFile } from '../services/cvApi'
import { tailorCV } from '../services/aiApi'
import { isAuthenticated, getMe } from '../services/authApi'
import toast from 'react-hot-toast'

// Client-only PDF download — avoids SSR issues with @react-pdf/renderer
const CVDownloadButton = dynamic(
  () => import('../components/CVDownloadButton'),
  { ssr: false, loading: () => null }
)

const STEPS = ['Upload CV', 'Job Description', 'AI Tailoring', 'Download']

export default function Builder() {
  const router = useRouter()
  const [step, setStep]               = useState(0)
  const [uploadedFile, setUploadedFile]   = useState(null)
  const [parsedCV, setParsedCV]           = useState(null)
  const [jobDesc, setJobDesc]             = useState('')
  const [detectedStacks, setDetectedStacks] = useState([])
  const [tailoredData, setTailoredData]   = useState(null)
  const [loading, setLoading]             = useState(false)
  const [outputFormat, setOutputFormat]   = useState('pdf')
  const [generating, setGenerating]       = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/auth/login')
      return
    }
    getMe().catch(() => {})
  }, [])

  const handleUploaded = async (fileData) => {
    setUploadedFile(fileData)
    setTailoredData(null)
    setLoading(true)
    try {
      const res = await parseCV(fileData.filename)
      const data = res.data || {}
      if (!data.sections) data.sections = {}
      setParsedCV(data)
      setStep(1)
      toast.success('CV parsed — paste a job description')
    } catch (err) {
      const detail = err?.response?.data?.detail
      toast.error(detail || err?.message || 'Failed to parse CV')
    } finally {
      setLoading(false)
    }
  }

  const handleTailor = async () => {
    if (!parsedCV)       return toast.error('Please upload your CV first')
    if (!jobDesc.trim()) return toast.error('Please paste a job description')

    setLoading(true)
    setStep(2)
    try {
      const res = await tailorCV(
        parsedCV.sections,
        parsedCV.layout,
        jobDesc,
        parsedCV.format
      )
      const tailored = res.data
      setTailoredData(tailored)
      setDetectedStacks(tailored.detected_stacks || [])
      setStep(3)
      toast.success('CV tailored! Download your PDF below.')
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Tailoring failed — please try again'
      toast.error(msg)
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  const handleBackendDownload = async () => {
    if (!tailoredData) return
    setGenerating(true)
    try {
      const res = await generateCV(
        tailoredData.tailored_sections,
        parsedCV?.layout,
        outputFormat,
        parsedCV?.format,
        uploadedFile?.filename
      )
      const files = res.data?.files || {}
      if (files.pdf)  await downloadGeneratedFile(files.pdf)
      if (files.docx) await downloadGeneratedFile(files.docx)
      toast.success('Downloaded!')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Download failed')
    } finally {
      setGenerating(false)
    }
  }

  const currentSections = tailoredData?.tailored_sections || parsedCV?.sections

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ── Step indicator ── */}
        <div className="flex items-center justify-center mb-12">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                ${i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                  ${i === step ? 'bg-white text-blue-600' : i < step ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'}`}
                >
                  {i < step ? '✓' : i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 ${i < step ? 'bg-blue-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── LEFT: Input panel ── */}
          <div className="space-y-6">

            {/* Upload */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <h2 className="font-semibold text-gray-900">Upload Your CV</h2>
              </div>
              <CVUpload onUploaded={handleUploaded} />
              {parsedCV && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 font-medium">
                    ✓ CV parsed — {Object.keys(parsedCV.sections || {}).length} sections detected
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.keys(parsedCV.sections || {}).map(s => (
                      <span key={s} className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Job Description */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <h2 className="font-semibold text-gray-900">Paste Job Description</h2>
              </div>
              <JobDescInput
                value={jobDesc}
                onChange={setJobDesc}
                detectedStacks={detectedStacks}
              />
            </div>

            {/* Tailor button */}
            <button
              className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
              onClick={handleTailor}
              disabled={loading || !parsedCV || !jobDesc.trim()}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI is tailoring your CV…
                </>
              ) : (
                <>🤖 Tailor My CV with AI</>
              )}
            </button>

          </div>

          {/* ── RIGHT: Preview panel ── */}
          <div className="card overflow-auto max-h-[85vh]">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="font-semibold text-gray-900">
                {tailoredData ? '✨ Tailored CV Preview' : parsedCV ? '📄 Parsed CV Sections' : 'CV Preview'}
              </h2>
              {tailoredData && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Format selector */}
                  {[
                    { fmt: 'pdf',  label: '📄 PDF'  },
                    { fmt: 'docx', label: '📝 Word' },
                    { fmt: 'both', label: '📦 Both' },
                  ].map(({ fmt, label }) => (
                    <button
                      key={fmt}
                      onClick={() => setOutputFormat(fmt)}
                      className={`px-3 py-1.5 text-xs font-medium rounded border transition-all
                        ${outputFormat === fmt
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                  {/* PDF uses client-side renderer; Word/Both use backend generator */}
                  {outputFormat === 'pdf' ? (
                    <CVDownloadButton
                      sections={tailoredData.tailored_sections}
                      filename={`${(parsedCV?.sections?.header || 'CV').replace(/\s+/g, '_')}_tailored.pdf`}
                    />
                  ) : (
                    <button
                      onClick={handleBackendDownload}
                      disabled={generating}
                      className="btn-primary px-4 py-1.5 text-sm flex items-center gap-1 disabled:opacity-60"
                    >
                      {generating ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Generating…
                        </>
                      ) : '⬇ Download'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {!parsedCV && !tailoredData && (
              <div className="text-center text-gray-400 py-20">
                <div className="text-5xl mb-4">📄</div>
                <p className="font-medium">Upload your CV to see a preview</p>
              </div>
            )}

            <CVPreview sections={currentSections} />
          </div>
        </div>
      </div>
    </Layout>
  )
}
