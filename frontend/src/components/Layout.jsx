import Navbar from './Navbar'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="text-center text-gray-400 text-sm py-4 border-t border-gray-100">
        CV Tailor AI — Powered by Qwen AI
      </footer>
    </div>
  )
}
