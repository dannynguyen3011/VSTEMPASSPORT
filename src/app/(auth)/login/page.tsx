'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Leaf, Eye, EyeOff, ArrowRight, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react'
import { signIn } from '@/shared/auth-client'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { Button } from '@/components/ui/button'

const STATS = [
  { value: 'Big 6', label: 'Trường hỗ trợ' },
  { value: '3 tầng', label: 'TrustFactor' },
  { value: '95%+', label: 'RAG Accuracy' },
]

const inputCls =
  'w-full h-12 rounded-lg border border-border bg-muted/60 px-4 text-base text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

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
    <div className="flex w-full min-h-screen bg-background transition-colors">

      {/* ── Left Panel (Brand) ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-muted/40 border-r border-border flex-col justify-center gap-16 py-16 px-16 relative overflow-y-auto overflow-x-hidden transition-colors">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:28px_28px] opacity-60" />
        <div className="absolute top-0 left-0 w-[30rem] h-[30rem] bg-primary/10 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />

        {/* Logo */}
        <div className="relative flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Leaf className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <div className="font-extrabold text-2xl leading-none text-foreground">Green STEM Compass</div>
            <div className="text-primary text-sm mt-1.5 font-medium">La Bàn Định Vị Năng Lực STEM</div>
          </div>
        </div>

        {/* Quote */}
        <div className="relative space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Pilot tháng 7–8/2026 · Miễn phí toàn bộ tính năng
          </div>
          <blockquote className="text-4xl xl:text-5xl font-bold leading-[1.15] text-foreground">
            &ldquo;Làm ít hơn nhưng{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-700">sâu hơn</span>.&rdquo;
          </blockquote>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-lg">
            4 hoạt động Deep STEM chất lượng cao có trọng số cao hơn 20 hoạt động phong trào.
            Portfolio 10-Slot là đủ để chinh phục đại học tinh hoa.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-border">
            {STATS.map(({ value, label }) => (
              <div key={label} className="rounded-xl border border-border bg-background/60 px-4 py-4">
                <div className="text-primary font-extrabold text-2xl">{value}</div>
                <div className="text-muted-foreground text-sm mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-sm text-muted-foreground">Next Level 5 · v3.0 · Pitch Day 12/04/2026</div>
      </div>

      {/* ── Right Panel (Form) ── */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-base text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Trang chủ
          </Link>
          <ThemeToggle variant="pill" />
        </div>

        {/* Form */}
        <div className="flex-1 flex items-center justify-center p-8 sm:p-16">
          <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-3 duration-500">

            {/* Mobile logo */}
            <div className="flex items-center gap-3 mb-10 lg:hidden">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Leaf className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground text-base">Green STEM Compass</span>
            </div>

            <div className="mb-10">
              <h1 className="text-4xl font-extrabold text-foreground mb-3">Chào mừng trở lại</h1>
              <p className="text-muted-foreground text-lg">Đăng nhập để tiếp tục hành trình STEM của bạn.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                  <p className="text-base text-destructive">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-base font-semibold text-foreground">
                  Email hoặc tên đăng nhập
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  placeholder="email@example.com hoặc @username"
                  className={inputCls}
                />
              </div>

              <div className="space-y-2">
                <label className="text-base font-semibold text-foreground">Mật khẩu</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`${inputCls} pr-12`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !identifier || !password}
                className="w-full h-12 rounded-lg text-base font-semibold mt-3"
              >
                {loading
                  ? <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <><span>Đăng nhập</span><ArrowRight className="w-5 h-5" /></>}
              </Button>
            </form>

            <div className="flex items-center gap-3 my-8">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted-foreground">hoặc</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="w-full h-12 rounded-lg text-base font-medium bg-muted/40"
            >
              Xem Demo (không cần đăng nhập)
            </Button>

            <p className="text-center text-base text-muted-foreground mt-8">
              Chưa có tài khoản?{' '}
              <Link href="/register" className="text-primary hover:text-primary/80 font-semibold transition-colors">
                Đăng ký miễn phí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
