'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Leaf, Eye, EyeOff, ArrowRight, AlertCircle, ArrowLeft } from 'lucide-react'
import { signIn } from '@/shared/auth-client'
import { ThemeToggle } from '@/components/shared/ThemeToggle'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('') // email or username
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Resolve login email: if no @ it's a username → look up the email first
      let loginEmail = identifier.trim()
      if (!loginEmail.includes('@')) {
        const res = await fetch(
          `/api/auth/lookup-username?username=${encodeURIComponent(loginEmail)}`
        )
        if (!res.ok) {
          setError('Tên đăng nhập không tồn tại. Vui lòng kiểm tra lại.')
          return
        }
        const data = await res.json()
        loginEmail = data.email
      }

      const { error: authError } = await signIn(loginEmail, password)

      if (authError) {
        setError(authError)
        return
      }
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full min-h-screen bg-white dark:bg-gray-950 transition-colors">

      {/* ── Left Panel (Brand) ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-white/5 flex-col justify-between p-12 relative overflow-hidden transition-colors">
        <div className="absolute top-0 left-0 w-96 h-96 bg-green-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-bold text-base leading-none dark:text-white text-gray-900">Green STEM Compass</div>
            <div className="text-green-600 dark:text-green-400 text-xs mt-0.5">La Bàn Định Vị Năng Lực STEM</div>
          </div>
        </div>

        {/* Quote */}
        <div className="relative space-y-6">
          <blockquote className="text-2xl font-semibold leading-snug dark:text-white text-gray-900">
            "Làm ít hơn nhưng{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-green-700">sâu hơn</span>."
          </blockquote>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-sm">
            4 hoạt động Deep STEM chất lượng cao có trọng số cao hơn 20 hoạt động phong trào.
            Portfolio 10-Slot là đủ để chinh phục đại học tinh hoa.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-white/5">
            {[{ value: 'Big 6', label: 'Trường hỗ trợ' }, { value: '3 tầng', label: 'TrustFactor' }, { value: '95%+', label: 'RAG Accuracy' }].map(({ value, label }) => (
              <div key={label}>
                <div className="text-green-600 dark:text-green-400 font-bold text-lg">{value}</div>
                <div className="text-gray-400 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-gray-400">Next Level 5 · v3.0 · Pitch Day 12/04/2026</div>
      </div>

      {/* ── Right Panel (Form) ── */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Trang chủ
          </Link>
          <ThemeToggle variant="pill" />
        </div>

        {/* Form */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">

            {/* Mobile logo */}
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold dark:text-white text-gray-900 text-sm">Green STEM Compass</span>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-2">Chào mừng trở lại</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Đăng nhập để tiếp tục hành trình STEM của bạn.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email hoặc tên đăng nhập
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  placeholder="email@example.com hoặc @username"
                  className="w-full h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mật khẩu</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 pr-11 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition-colors"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading || !identifier || !password}
                className="w-full h-11 bg-green-600 hover:bg-green-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white disabled:text-gray-400 font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-2">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><span>Đăng nhập</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-200 dark:bg-white/5" />
              <span className="text-xs text-gray-400">hoặc</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-white/5" />
            </div>

            <button type="button" onClick={() => router.push('/dashboard')}
              className="w-full h-11 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-xl text-sm transition-colors bg-gray-50 dark:bg-white/5">
              Xem Demo (không cần đăng nhập)
            </button>

            <p className="text-center text-sm text-gray-400 mt-6">
              Chưa có tài khoản?{' '}
              <Link href="/register" className="text-green-600 dark:text-green-400 hover:text-green-500 font-medium transition-colors">
                Đăng ký miễn phí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
