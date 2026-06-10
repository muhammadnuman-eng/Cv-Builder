import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { logout } from '../services/authApi'

export default function Navbar() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    setAuthed(!!localStorage.getItem('token'))
  }, [])

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600">
          CV Tailor AI
        </Link>
        <div className="flex items-center gap-4">
          {authed ? (
            <>
              <Link href="/builder" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                Builder
              </Link>
              <button
                onClick={logout}
                className="btn-secondary text-sm"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-gray-600 hover:text-blue-600 font-medium">
                Login
              </Link>
              <Link href="/auth/register" className="btn-primary text-sm">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
