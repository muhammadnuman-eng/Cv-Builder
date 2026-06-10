// Client-only PDF download wrapper — must be dynamically imported with ssr:false
import { PDFDownloadLink } from '@react-pdf/renderer'
import CVPdf from './CVPdf'

export default function CVDownloadButton({ sections, filename = 'tailored_cv.pdf' }) {
  if (!sections) return null

  return (
    <PDFDownloadLink
      document={<CVPdf sections={sections} />}
      fileName={filename}
      style={{ textDecoration: 'none' }}
    >
      {({ loading, error }) => {
        if (error) {
          return (
            <span className="text-red-600 text-sm">PDF error — try again</span>
          )
        }
        return (
          <button
            className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Preparing PDF…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586
                       a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </>
            )}
          </button>
        )
      }}
    </PDFDownloadLink>
  )
}
