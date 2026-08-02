'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Leaf, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { signUp } from '@/shared/auth-client'
import { ThemeToggle } from '@/components/shared/ThemeToggle'

const PERKS = [
  'Traffic Light matching với Big 6 Schools',
  'Portfolio 10-Slot chuyên nghiệp',
  'RAG Chatbot tư vấn quy chế 24/7',
  'Kho cơ hội STEM được kiểm duyệt',
]

// Required field label helper
function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
        {children}
        <span className="text-red-500 text-xs">*</span>
      </label>
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
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
  const strengthColor = ['', 'bg-red-500', 'bg-amber-400', 'bg-green-500'][passwordStrength]
  const strengthText = ['', 'text-red-500', 'text-amber-400', 'text-green-500'][passwordStrength]

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

  const inputCls = 'w-full h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 transition-colors'
  const selectCls = `${inputCls} cursor-pointer`

  return (
    <div className="flex w-full min-h-screen bg-white dark:bg-gray-950 transition-colors">

      {/* ── Left Panel ── */}
      <div className="hidden lg:flex lg:w-5/12 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-white/5 flex-col justify-between p-12 relative overflow-hidden transition-colors">
        <div className="absolute top-0 left-0 w-96 h-96 bg-green-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-bold text-base leading-none dark:text-white text-gray-900">Green STEM Compass</div>
            <div className="text-green-600 dark:text-green-400 text-xs mt-0.5">La Bàn Định Vị Năng Lực STEM</div>
          </div>
        </div>
        <div className="relative space-y-6">
          <div>
            <h2 className="text-xl font-bold dark:text-white text-gray-900 mb-2">Tạo tài khoản miễn phí</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Tất cả tính năng cốt lõi trong giai đoạn pilot.</p>
          </div>
          <ul className="space-y-3">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                </div>
                <span className="text-gray-600 dark:text-gray-300 text-sm">{perk}</span>
              </li>
            ))}
          </ul>
          <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-4">
            <p className="text-green-700 dark:text-green-300 text-xs font-medium mb-1">🎯 Triết lý 10-Slot</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">
              Không một học sinh nào bị bỏ lại phía sau chỉ vì thiếu thông tin hoặc thiếu cố vấn.
            </p>
          </div>
        </div>
        <div className="relative text-xs text-gray-400">Next Level 5 · v3.0 · Pilot tháng 7–8/2026</div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col overflow-y-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Trang chủ
          </Link>
          <ThemeToggle variant="pill" />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-md py-4">

            {/* Mobile logo */}
            <div className="flex items-center gap-2 mb-6 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold dark:text-white text-gray-900 text-sm">Green STEM Compass</span>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-1">Tạo tài khoản</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Các trường có dấu <span className="text-red-500 font-medium">*</span> là bắt buộc.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* ── Section: Tài khoản ── */}
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-1">Thông tin tài khoản</div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                  Tên đăng nhập
                  <span className="text-xs text-gray-400 font-normal">(tuỳ chọn)</span>
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500">Dùng để đăng nhập thay cho email — chỉ chữ thường, số, dấu _</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="vd: nguyen_van_a"
                    maxLength={20}
                    className={`${inputCls} pl-7 ${
                      username && !/^[a-z0-9_]{3,20}$/.test(username)
                        ? 'border-red-400 focus:border-red-400 focus:ring-red-400/30'
                        : username && /^[a-z0-9_]{3,20}$/.test(username)
                        ? 'border-green-500 focus:border-green-500 focus:ring-green-500/30'
                        : ''
                    }`}
                  />
                </div>
                {username && !/^[a-z0-9_]{3,20}$/.test(username) && (
                  <p className="text-xs text-red-500">Tối thiểu 3 ký tự, chỉ a–z, 0–9, dấu _</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label hint="Tên sẽ hiển thị trong hồ sơ và khi Mentor xem">Tên hiển thị</Label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required
                  placeholder="VD: Nguyễn Văn A" className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <Label hint="Dùng để đăng nhập và nhận thông báo">Email</Label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="ten@example.com" className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <Label hint="Tối thiểu 6 ký tự">Mật khẩu</Label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                    placeholder="Tối thiểu 6 ký tự" className={`${inputCls} pr-11`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 flex gap-1">
                      {[1, 2, 3].map((level) => (
                        <div key={level} className={`h-1 flex-1 rounded-full transition-colors ${level <= passwordStrength ? strengthColor : 'bg-gray-200 dark:bg-gray-700'}`} />
                      ))}
                    </div>
                    <span className={`text-xs font-medium ${strengthText}`}>{strengthLabel}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Xác nhận mật khẩu</Label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                  placeholder="Nhập lại mật khẩu"
                  className={`${inputCls} ${
                    confirmPassword && confirmPassword !== password ? 'border-red-400 focus:border-red-400 focus:ring-red-400/30' :
                    confirmPassword && confirmPassword === password ? 'border-green-500 focus:border-green-500 focus:ring-green-500/30' : ''
                  }`} />
                {confirmPassword && confirmPassword === password && (
                  <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Mật khẩu khớp</p>
                )}
              </div>

              {/* ── Section: Hồ sơ học sinh ── */}
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Hồ sơ học sinh</div>
              <p className="text-xs text-gray-400 -mt-2">Cần thiết để Compass tính điểm OCS và Traffic Light ngay khi đăng nhập.</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label hint="Lớp hiện tại của bạn">Khối lớp</Label>
                  <select title="Chọn khối lớp" value={grade} onChange={(e) => setGrade(Number(e.target.value) as 10 | 11 | 12)} className={selectCls}>
                    <option value={10}>Lớp 10</option>
                    <option value={11}>Lớp 11</option>
                    <option value={12}>Lớp 12</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label hint="CNTT hoặc Toán & Thống kê">Ngành mục tiêu</Label>
                  <select title="Chọn ngành mục tiêu" value={targetMajor} onChange={(e) => setTargetMajor(e.target.value as 'cntt' | 'toan_thong_ke')} className={selectCls}>
                    <option value="cntt">CNTT / Máy tính</option>
                    <option value="toan_thong_ke">Toán & Thống kê</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label hint="Tên đầy đủ của trường THPT đang học">Trường THPT</Label>
                <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required
                  placeholder="VD: THPT Chuyên Chu Văn An" className={inputCls} />
              </div>

              <div className="space-y-1.5">
                <Label hint="Tỉnh/thành phố bạn đang học">Tỉnh / Thành phố</Label>
                <select title="Chọn tỉnh thành phố" value={province} onChange={(e) => setProvince(e.target.value)} required className={selectCls}>
                  <option value="" disabled>Chọn tỉnh / thành phố...</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <button type="submit" disabled={loading || !email || !password || !displayName || !schoolName || !province || (!!username && !/^[a-z0-9_]{3,20}$/.test(username))}
                className="w-full h-11 bg-green-600 hover:bg-green-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white disabled:text-gray-400 font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-2">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><span>Tạo tài khoản</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <p className="text-center text-sm text-gray-400 mt-5">
              Đã có tài khoản?{' '}
              <Link href="/login" className="text-green-600 dark:text-green-400 hover:text-green-500 font-medium transition-colors">Đăng nhập</Link>
            </p>
            <p className="text-center text-xs text-gray-400 mt-3 leading-relaxed">
              Dữ liệu cá nhân được mã hóa và không chia sẻ với bên thứ ba.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
