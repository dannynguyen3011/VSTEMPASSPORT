'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Leaf, Compass, Shield, Trophy, MessageCircle,
  ArrowRight, CheckCircle, Zap, Globe, Heart, BookOpen,
} from 'lucide-react'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { getSession } from '@/shared/auth-client'

const PAIN_POINTS = [
  {
    icon: Zap, title: 'Quá tải thông tin',
    desc: '70% hoạt động ngoại khóa mang tính phong trào, thiếu chiều sâu. Compass giúp bạn làm ít hơn nhưng sâu hơn.',
    color: 'text-amber-500', bg: 'bg-amber-500/10',
  },
  {
    icon: Globe, title: 'Bỏ lỡ cơ hội vàng',
    desc: 'NASA Space Apps, VEX Robotics, Tech Girls — không có công cụ dự báo, học sinh biết deadline khi đã quá muộn.',
    color: 'text-blue-500', bg: 'bg-blue-500/10',
  },
  {
    icon: BookOpen, title: 'Mất cân bằng học thuật',
    desc: 'SAT cao nhưng thiếu dự án STEM thực tế → trượt phỏng vấn VinUni. Gap Analysis chỉ rõ đúng điểm yếu.',
    color: 'text-purple-500', bg: 'bg-purple-500/10',
  },
  {
    icon: Heart, title: 'Thiếu lộ trình cá nhân',
    desc: 'Chưa có nền tảng nào map từ điểm số + khối lớp + định hướng nghề → lộ trình trúng đích cho từng cá nhân.',
    color: 'text-rose-500', bg: 'bg-rose-500/10',
  },
]

const FEATURES = [
  { icon: Compass, title: 'Strategic Matching', desc: 'Hệ thống đèn xanh/vàng/đỏ so sánh hồ sơ với ngưỡng thực tế của Big 6.' },
  { icon: Shield, title: 'TrustFactor 3 tầng', desc: 'Xác thực Self → Peer → Expert. Chống hồ sơ ảo, tăng uy tín với ban tuyển sinh.' },
  { icon: Trophy, title: 'Portfolio 10-Slot', desc: 'Chắt lọc 10 hoạt động tinh hoa nhất. Xuất PDF chuẩn quốc tế kèm QR Artifacts Vault.' },
  { icon: MessageCircle, title: 'RAG Chatbot 24/7', desc: 'Hỏi bất kỳ câu hỏi về quy chế tuyển sinh. Trả lời chính xác, kèm trích dẫn nguồn.' },
]

const BIG6 = [
  { name: 'VinUni', tag: 'SAT ~1450', color: 'border-green-500/40 bg-green-500/5 dark:border-green-500/40' },
  { name: 'HUST', tag: 'GPA ≥ 8.0', color: 'border-blue-500/40 bg-blue-500/5' },
  { name: 'USTH', tag: 'SAT ≥ 1100', color: 'border-purple-500/40 bg-purple-500/5' },
  { name: 'VJU', tag: 'IELTS ≥ 4.0', color: 'border-amber-500/40 bg-amber-500/5' },
  { name: 'FPT', tag: 'GPA ≥ 7.0', color: 'border-rose-500/40 bg-rose-500/5' },
  { name: 'Swinburne', tag: 'IELTS ≥ 6.0', color: 'border-cyan-500/40 bg-cyan-500/5' },
]

const STEPS = [
  { num: '01', title: 'Nhập hồ sơ STAR', desc: 'Điền GPA, SAT, IELTS và các hoạt động theo chuẩn STAR. Hệ thống tự động gắn tech tags và tính điểm.' },
  { num: '02', title: 'Chạy Compass Engine', desc: 'Hệ thống so sánh hồ sơ với Personas Big 6, hiển thị đèn tín hiệu và Gap Analysis chi tiết.' },
  { num: '03', title: 'Tối ưu & Kết nối', desc: 'Sắp xếp Portfolio 10-Slot, nhận gợi ý cơ hội STEM, kết nối Mentor từ Big 6.' },
]

export default function LandingPage() {
  const router = useRouter()

  // If already logged in, skip the landing page and go straight to the app.
  useEffect(() => {
    if (getSession()) {
      router.replace('/dashboard')
    }
  }, [router])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm leading-none block dark:text-white text-gray-900">Green STEM</span>
              <span className="text-green-600 dark:text-green-400 text-xs">Compass</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="text-sm bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Bắt đầu
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {/* Outer wide glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-green-400/20 dark:bg-green-500/15 rounded-full blur-3xl" />
          {/* Inner bright core glow behind headline */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-green-400/30 dark:bg-green-400/20 rounded-full blur-2xl" />
          {/* Tight bright spot */}
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[220px] h-[120px] bg-green-300/40 dark:bg-green-300/25 rounded-full blur-xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
            La Bàn Định Vị{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-green-700">
              Năng Lực STEM
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Xóa bỏ hỗn loạn trong thị trường ngoại khóa. Chuyển từ{' '}
            <span className="text-gray-900 dark:text-white font-medium">tích lũy định lượng</span> sang{' '}
            <span className="text-green-600 dark:text-green-400 font-medium">định hướng định chất</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-7 py-3.5 rounded-xl font-semibold text-base transition-all hover:shadow-lg hover:shadow-green-500/20"
            >
              Bắt đầu miễn phí <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-7 py-3.5 rounded-xl font-medium text-base transition-colors bg-gray-50 dark:bg-white/5"
            >
              Đăng nhập
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 border border-dashed border-gray-300 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-7 py-3.5 rounded-xl font-medium text-base transition-colors"
            >
              Xem Demo
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            {[{ value: '6', label: 'Trường Big 6' }, { value: '10', label: 'Portfolio Slots' }, { value: '24/7', label: 'RAG Chatbot' }].map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pain Points ── */}
      <section className="py-20 px-4 sm:px-6 border-t border-gray-100 dark:border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">4 Nỗi Đau Cốt Lõi</h2>
            <p className="text-gray-500 dark:text-gray-400">Green STEM Compass được xây dựng để giải quyết trực tiếp 4 vấn đề này.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PAIN_POINTS.map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/5 rounded-2xl p-6 hover:border-gray-300 dark:hover:border-white/10 transition-colors">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="font-semibold mb-2 text-sm">{title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-4 sm:px-6 border-t border-gray-100 dark:border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Cách hoạt động</h2>
            <p className="text-gray-500 dark:text-gray-400">3 bước để có hồ sơ đại học STEM tinh hoa.</p>
          </div>
          <div className="space-y-6">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="flex gap-6 items-start">
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-400 font-bold text-sm">{num}</span>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-4 sm:px-6 border-t border-gray-100 dark:border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Tính năng cốt lõi</h2>
            <p className="text-gray-500 dark:text-gray-400">Bộ công cụ đầy đủ cho hành trình chinh phục Big 6.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/5 rounded-2xl p-6 flex gap-4 hover:border-green-500/30 transition-colors group">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <Icon className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1.5">{title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Big 6 ── */}
      <section className="py-20 px-4 sm:px-6 border-t border-gray-100 dark:border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Hỗ trợ Big 6 Schools</h2>
            <p className="text-gray-500 dark:text-gray-400">Dữ liệu ngưỡng tuyển sinh từ Đề án tuyển sinh chính thức 2026.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BIG6.map(({ name, tag, color }) => (
              <div key={name} className={`border rounded-xl p-4 text-center ${color} hover:scale-[1.02] transition-transform`}>
                <div className="font-bold text-base mb-1">{name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SDG ── */}
      <section className="py-16 px-4 sm:px-6 border-t border-gray-100 dark:border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-500/20 rounded-2xl p-8 text-center">
            <div className="text-xs text-green-600 dark:text-green-400 font-semibold uppercase tracking-widest mb-3">Tác động xã hội</div>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Aligned with UN SDGs</h2>
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {[
                { sdg: 'SDG 4', label: 'Giáo dục chất lượng' },
                { sdg: 'SDG 10', label: 'Giảm bất bình đẳng' },
                { sdg: 'SDG 3', label: 'Sức khỏe tinh thần' },
                { sdg: 'SDG 9', label: 'Đổi mới công nghệ' },
              ].map(({ sdg, label }) => (
                <div key={sdg} className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs text-green-700 dark:text-green-300 font-medium">{sdg}</span>
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-lg mx-auto">
              Phổ cập RAG Chatbot 24/7 cho học sinh mọi vùng miền. Mục tiêu: tỷ lệ rural/urban ≥ 40/60 trong pilot tháng 7–8/2026.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 sm:px-6 border-t border-gray-100 dark:border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Sẵn sàng định vị{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-green-700">
              năng lực STEM
            </span>{' '}
            của bạn?
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Miễn phí trong giai đoạn pilot. Không cần thẻ tín dụng.</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-xl font-semibold text-base transition-all hover:shadow-xl hover:shadow-green-500/20"
          >
            Tạo tài khoản miễn phí <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 dark:border-white/5 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-green-500 flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm text-gray-400">Green STEM Compass · Next Level 5 · v3.0</span>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-600">
            Dữ liệu cập nhật đến 02/04/2026 · Xác nhận với trường trước khi nộp hồ sơ chính thức
          </div>
        </div>
      </footer>
    </div>
  )
}
