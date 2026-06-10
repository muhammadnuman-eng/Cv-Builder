import Link from 'next/link'
import Layout from '../components/Layout'

const FEATURES = [
  {
    icon: '📄',
    title: 'Upload Your CV',
    desc: 'Upload your existing CV in PDF or DOCX format. We preserve your original design and layout.'
  },
  {
    icon: '📋',
    title: 'Paste Job Description',
    desc: 'Paste the job description. Our AI extracts required tech stacks and key skills automatically.'
  },
  {
    icon: '🤖',
    title: 'AI Tailors Your CV',
    desc: 'Qwen AI rewrites your CV content to match the job — updating skills, experience, and stacks.'
  },
  {
    icon: '⬇️',
    title: 'Download PDF & DOCX',
    desc: 'Download your tailored CV in PDF and MS Word format, in your original design.'
  }
]

export default function Home() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Tailor Your CV to <br />
            <span className="text-blue-200">Any Job in Seconds</span>
          </h1>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Upload your CV, paste a job description — our AI rewrites your CV to perfectly match the role and pass ATS filters.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/register" className="bg-white text-blue-600 font-bold py-3 px-8 rounded-lg hover:bg-blue-50 transition-colors">
              Get Started Free
            </Link>
            <Link href="/auth/login" className="border-2 border-white text-white font-bold py-3 px-8 rounded-lg hover:bg-white/10 transition-colors">
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-14">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((f, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl mb-4">{f.icon}</div>
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to land your dream job?</h2>
          <p className="text-gray-500 mb-8">Join thousands of professionals who tailor their CV with AI.</p>
          <Link href="/auth/register" className="btn-primary text-lg py-3 px-10">
            Start Tailoring Now
          </Link>
        </div>
      </section>
    </Layout>
  )
}
