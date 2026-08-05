'use client'

import { useState, useEffect } from 'react'
import { Topbar } from '@/components/shared/Topbar'
import { useProfileStore } from '@/store/useProfileStore'
import { getSession } from '@/shared/auth-client'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle, Save, Lock } from 'lucide-react'

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

export default function ProfilePage() {
  const { profile, updateProfile } = useProfileStore()
  const [isAuth, setIsAuth] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Form state — pre-filled from store
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [grade, setGrade] = useState<10 | 11 | 12>(profile.grade)
  const [schoolName, setSchoolName] = useState(profile.school_name)
  const [province, setProvince] = useState(profile.province)
  const [targetMajor, setTargetMajor] = useState<'cntt' | 'toan_thong_ke'>(profile.target_major)
  const [gpa, setGpa] = useState(profile.gpa?.toString() ?? '')
  const [sat, setSat] = useState(profile.sat_score?.toString() ?? '')
  const [ielts, setIelts] = useState(profile.ielts_score?.toString() ?? '')

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (getSession()) {
      setIsAuth(true)
    }
    setAuthChecked(true)
  }, [])

  // Keep form in sync if store updates (e.g. AuthDataLoader finishes)
  useEffect(() => {
    setDisplayName(profile.display_name)
    setGrade(profile.grade)
    setSchoolName(profile.school_name)
    setProvince(profile.province)
    setTargetMajor(profile.target_major)
    setGpa(profile.gpa?.toString() ?? '')
    setSat(profile.sat_score?.toString() ?? '')
    setIelts(profile.ielts_score?.toString() ?? '')
  }, [profile])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    const body = {
      display_name: displayName,
      grade,
      school_name: schoolName,
      province,
      target_major: targetMajor,
      gpa: gpa ? parseFloat(gpa) : null,
      sat_score: sat ? parseInt(sat) : null,
      ielts_score: ielts ? parseFloat(ielts) : null,
    }

    try {
      const freshToken = getSession()?.access_token
      if (!freshToken) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
        return
      }

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error?.toString() ?? 'Lưu thất bại. Vui lòng thử lại.')
        return
      }

      // Sync to local store so dashboard updates immediately
      updateProfile({
        display_name: displayName,
        grade,
        school_name: schoolName,
        province,
        target_major: targetMajor,
        gpa: gpa ? parseFloat(gpa) : null,
        sat_score: sat ? parseInt(sat) : null,
        ielts_score: ielts ? parseFloat(ielts) : null,
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full h-11 bg-muted/60 border border-border rounded-lg px-4 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors'
  const selectCls = `${inputCls} cursor-pointer`
  const labelCls = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Cài đặt hồ sơ" />

      <main className="flex-1 p-4 sm:p-6 max-w-2xl">

        {/* Demo mode notice */}
        {authChecked && !isAuth && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3 mb-6">
            <Lock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Chế độ Demo</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                Bạn đang xem dữ liệu mẫu. Đăng ký hoặc đăng nhập để lưu hồ sơ thực vào cơ sở dữ liệu.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">

          {/* Feedback */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm text-primary">Đã lưu thành công!</p>
            </div>
          )}

          {/* Section: Thông tin cơ bản */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Thông tin cơ bản</h2>

            <div>
              <label className={labelCls}>Tên hiển thị</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="VD: Nguyễn Minh Anh" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Khối lớp</label>
                <select title="Khối lớp" value={grade} onChange={(e) => setGrade(Number(e.target.value) as 10 | 11 | 12)} className={selectCls}>
                  <option value={10}>Lớp 10</option>
                  <option value={11}>Lớp 11</option>
                  <option value={12}>Lớp 12</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Ngành mục tiêu</label>
                <select title="Ngành mục tiêu" value={targetMajor} onChange={(e) => setTargetMajor(e.target.value as 'cntt' | 'toan_thong_ke')} className={selectCls}>
                  <option value="cntt">CNTT / Máy tính</option>
                  <option value="toan_thong_ke">Toán & Thống kê</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Trường THPT</label>
              <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required className={inputCls} placeholder="VD: THPT Chuyên Chu Văn An" />
            </div>

            <div>
              <label className={labelCls}>Tỉnh / Thành phố</label>
              <select title="Tỉnh thành phố" value={province} onChange={(e) => setProvince(e.target.value)} required className={selectCls}>
                <option value="" disabled>Chọn tỉnh / thành phố...</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Section: Điểm số */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Điểm số</h2>
              <p className="text-xs text-muted-foreground mt-1">Dùng để tính Traffic Light và OCS. Để trống nếu chưa có.</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>GPA (0–10)</label>
                <input type="number" step="0.1" min="0" max="10" value={gpa} onChange={(e) => setGpa(e.target.value)}
                  placeholder="VD: 8.5" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>SAT (400–1600)</label>
                <input type="number" step="10" min="400" max="1600" value={sat} onChange={(e) => setSat(e.target.value)}
                  placeholder="VD: 1350" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>IELTS (0–9)</label>
                <input type="number" step="0.5" min="0" max="9" value={ielts} onChange={(e) => setIelts(e.target.value)}
                  placeholder="VD: 6.5" className={inputCls} />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving || (!isAuth && authChecked)}
            className="h-11 px-6 rounded-lg text-sm font-semibold"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              : <Save className="w-4 h-4" />}
            {isAuth ? 'Lưu thay đổi' : 'Đăng nhập để lưu'}
          </Button>
        </form>
      </main>
    </div>
  )
}
