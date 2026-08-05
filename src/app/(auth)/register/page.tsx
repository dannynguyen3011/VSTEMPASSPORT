'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Leaf, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { signUp } from '@/shared/auth-client'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { Button } from '@/components/ui/button'

const PERKS = [
  'Traffic Light matching với Big 6 Schools',
  'Portfolio 10-Slot chuyên nghiệp',
  'RAG Chatbot tư vấn quy chế 24/7',
  'Kho cơ hội STEM được kiểm duyệt',
]

// Required field label helper
function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-base font-semibold text-foreground flex items-center gap-1.5">
        {children}
        <span className="text-destructive text-sm">*</span>
      </label>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

const PROVINCES = [
  'Hà Nội', 'TP Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu',
  'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước',
  'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Đắk Nông',
  'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang',
  'Hà Nam', 'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hòa Bình',
  'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu',
  'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định',
  'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên',
  'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
  'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên',
  'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
  'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
]

export default function RegisterPage() {
  const router = useRouter()

  // Auth fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Profile fields (saved to DB on register)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [grade, setGrade] = useState<10 | 11 | 12>(11)
  const [schoolName, setSchoolName] = useState('')
  const [province, setProvince] = useState('')
  const [targetMajor, setTargetMajor] = useState<'cntt' | 'toan_thong_ke'>('cntt')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordStrength =
    password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthLabel = ['', 'Yếu', 'Trung bình', 'Mạnh'][passwordStrength]
  const strengthColor = ['', 'bg-red-500', 'bg-amber-400', 'bg-primary'][passwordStrength]
  const strengthText = ['', 'text-red-500', 'text-amber-400', 'text-primary'][passwordStrength]

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return }
    if (password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự.'); return }
    if (!province) { setError('Vui lòng chọn tỉnh/thành phố.'); return }
    if (username && !/^[a-z0-9_]{3,20}$/.test(username)) {
      setError('Tên đăng nhập chỉ gồm chữ thường, số, dấu gạch dưới, 3–20 ký tự.')
      return
    }

    setLoading(true)
    try {
      const { error: registerError } = await signUp({
        email,
        password,
        username: username || undefined,
        display_name: displayName,
        grade,
        school_name: schoolName,
        province,
        target_major: targetMajor,
      })

      if (registerError) {
        setError(registerError)
        return
      }

      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full h-12 rounded-lg border border-border bg-muted/60 px-4 text-base text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'
  const selectCls = `${inputCls} cursor-pointer`

  return (
    <div className="flex w-full min-h-screen bg-background transition-colors">

      {/* ── Left Panel ── */}
      <div className="hidden lg:flex lg:w-5/12 bg-muted/40 border-r border-border flex-col justify-start gap-12 py-14 px-14 relative overflow-y-auto overflow-x-hidden transition-colors">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:28px_28px] opacity-60" />
        <div className="absolute top-0 left-0 w-[26rem] h-[26rem] bg-primary/10 rounded-full blur-3xl -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />

        <div className="relative flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Leaf className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <div className="font-extrabold text-xl leading-none text-foreground">Green STEM Compass</div>
            <div className="text-primary text-sm mt-1.5 font-medium">La Bàn Định Vị Năng Lực STEM</div>
          </div>
        </div>

        <div className="relative space-y-7 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div>
            <h2 className="text-3xl font-extrabold text-foreground mb-3">Tạo tài khoản miễn phí</h2>
            <p className="text-muted-foreground text-lg">Tất cả tính năng cốt lõi trong giai đoạn pilot.</p>
          </div>
          <ul className="space-y-4">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-foreground/80 text-base">{perk}</span>
              </li>
            ))}
          </ul>
          <div className="bg-accent border border-primary/20 rounded-xl p-5">
            <p className="text-primary text-sm font-semibold mb-1.5">🎯 Triết lý 10-Slot</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Không một học sinh nào bị bỏ lại phía sau chỉ vì thiếu thông tin hoặc thiếu cố vấn.
            </p>
          </div>
        </div>
        <div className="relative text-sm text-muted-foreground">Next Level 5 · v3.0 · Pilot tháng 7–8/2026</div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col overflow-y-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 shrink-0">
          <Link href="/" className="inline-flex items-center gap-1.5 text-base text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Trang chủ
          </Link>
          <ThemeToggle variant="pill" />
        </div>

        <div className="flex-1 flex items-center justify-center p-8 sm:p-12">
          <div className="w-full max-w-lg py-6 animate-in fade-in slide-in-from-bottom-3 duration-500">

            {/* Mobile logo */}
            <div className="flex items-center gap-3 mb-8 lg:hidden">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Leaf className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground text-base">Green STEM Compass</span>
            </div>

            <div className="mb-8">
              <h1 className="text-4xl font-extrabold text-foreground mb-2">Tạo tài khoản</h1>
              <p className="text-muted-foreground text-lg">
                Các trường có dấu <span className="text-destructive font-medium">*</span> là bắt buộc.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              {error && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                  <p className="text-base text-destructive">{error}</p>
                </div>
              )}

              {/* ── Section: Tài khoản ── */}
              <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider pt-2">Thông tin tài khoản</div>

              <div className="space-y-2">
                <label className="text-base font-semibold text-foreground flex items-center gap-1.5">
                  Tên đăng nhập
                  <span className="text-sm text-muted-foreground font-normal">(tuỳ chọn)</span>
                </label>
                <p className="text-sm text-muted-foreground">Dùng để đăng nhập thay cho email — chỉ chữ thường, số, dấu _</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base select-none">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="vd: nguyen_van_a"
                    maxLength={20}
                    className={`${inputCls} pl-8 ${
                      username && !/^[a-z0-9_]{3,20}$/.test(username)
                        ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                        : username && /^[a-z0-9_]{3,20}$/.test(username)
                        ? 'border-primary focus:border-primary focus:ring-primary/20'
                        : ''
                    }`}
                  />
                </div>
                {username && !/^[a-z0-9_]{3,20}$/.test(username) && (
                  <p className="text-sm text-destructive">Tối thiểu 3 ký tự, chỉ a–z, 0–9, dấu _</p>
                )}
              </div>

              <div className="space-y-2">
                <Label hint="Tên sẽ hiển thị trong hồ sơ và khi Mentor xem">Tên hiển thị</Label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required
                  placeholder="VD: Nguyễn Văn A" className={inputCls} />
              </div>

              <div className="space-y-2">
                <Label hint="Dùng để đăng nhập và nhận thông báo">Email</Label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="ten@example.com" className={inputCls} />
              </div>

              <div className="space-y-2">
                <Label hint="Tối thiểu 6 ký tự">Mật khẩu</Label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                    placeholder="Tối thiểu 6 ký tự" className={`${inputCls} pr-12`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 flex gap-1">
                      {[1, 2, 3].map((level) => (
                        <div key={level} className={`h-1.5 flex-1 rounded-full transition-colors ${level <= passwordStrength ? strengthColor : 'bg-muted'}`} />
                      ))}
                    </div>
                    <span className={`text-sm font-medium ${strengthText}`}>{strengthLabel}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Xác nhận mật khẩu</Label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                  placeholder="Nhập lại mật khẩu"
                  className={`${inputCls} ${
                    confirmPassword && confirmPassword !== password ? 'border-destructive focus:border-destructive focus:ring-destructive/20' :
                    confirmPassword && confirmPassword === password ? 'border-primary focus:border-primary focus:ring-primary/20' : ''
                  }`} />
                {confirmPassword && confirmPassword === password && (
                  <p className="text-sm text-primary flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Mật khẩu khớp</p>
                )}
              </div>

              {/* ── Section: Hồ sơ học sinh ── */}
              <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider pt-3">Hồ sơ học sinh</div>
              <p className="text-sm text-muted-foreground -mt-3">Cần thiết để Compass tính điểm OCS và Traffic Light ngay khi đăng nhập.</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label hint="Lớp hiện tại của bạn">Khối lớp</Label>
                  <select title="Chọn khối lớp" value={grade} onChange={(e) => setGrade(Number(e.target.value) as 10 | 11 | 12)} className={selectCls}>
                    <option value={10}>Lớp 10</option>
                    <option value={11}>Lớp 11</option>
                    <option value={12}>Lớp 12</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label hint="CNTT hoặc Toán & Thống kê">Ngành mục tiêu</Label>
                  <select title="Chọn ngành mục tiêu" value={targetMajor} onChange={(e) => setTargetMajor(e.target.value as 'cntt' | 'toan_thong_ke')} className={selectCls}>
                    <option value="cntt">CNTT / Máy tính</option>
                    <option value="toan_thong_ke">Toán & Thống kê</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label hint="Tên đầy đủ của trường THPT đang học">Trường THPT</Label>
                <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required
                  placeholder="VD: THPT Chuyên Chu Văn An" className={inputCls} />
              </div>

              <div className="space-y-2">
                <Label hint="Tỉnh/thành phố bạn đang học">Tỉnh / Thành phố</Label>
                <select title="Chọn tỉnh thành phố" value={province} onChange={(e) => setProvince(e.target.value)} required className={selectCls}>
                  <option value="" disabled>Chọn tỉnh / thành phố...</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <Button
                type="submit"
                disabled={loading || !email || !password || !displayName || !schoolName || !province || (!!username && !/^[a-z0-9_]{3,20}$/.test(username))}
                className="w-full h-12 rounded-lg text-base font-semibold mt-4"
              >
                {loading
                  ? <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <><span>Tạo tài khoản</span><ArrowRight className="w-5 h-5" /></>}
              </Button>
            </form>

            <p className="text-center text-base text-muted-foreground mt-6">
              Đã có tài khoản?{' '}
              <Link href="/login" className="text-primary hover:text-primary/80 font-semibold transition-colors">Đăng nhập</Link>
            </p>
            <p className="text-center text-sm text-muted-foreground mt-4 leading-relaxed">
              Dữ liệu cá nhân được mã hóa và không chia sẻ với bên thứ ba.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
