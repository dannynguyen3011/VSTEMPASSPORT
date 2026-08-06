'use client'

import Link from 'next/link'
import { Topbar } from '@/components/shared/Topbar'
import { useProfileStore } from '@/store/useProfileStore'
import { calculateOCS } from '@/shared/ocs'
import { analyzeCompass } from '@/shared/matching'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/shared/constants'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import type { ActivityCategory } from '@/types'
import { AlertCircle, ArrowRight } from 'lucide-react'

const RADAR_CATEGORIES: { label: string; categories: ActivityCategory[] }[] = [
  { label: 'Deep STEM', categories: ['competition', 'research'] },
  { label: 'Leadership', categories: ['extracurricular'] },
  { label: 'Research', categories: ['research'] },
  { label: 'Competition', categories: ['competition'] },
  { label: 'Self-learning', categories: ['self_learning'] },
  { label: 'Social Impact', categories: ['green_ethics', 'extracurricular'] },
]

export default function DashboardPage() {
  const { profile, activities } = useProfileStore()
  const { total_ocs, breakdown } = calculateOCS(activities, profile.target_major)
  const compassResults = analyzeCompass(profile, activities, total_ocs)

  const slottedCount = activities.filter((a) => a.slot_order !== null).length
  const totalCount = activities.length

  const circumference = 2 * Math.PI * 40
  const dashOffset = circumference - (total_ocs / 100) * circumference

  const radarData = RADAR_CATEGORIES.map(({ label, categories }) => {
    const relevant = activities.filter((a) => categories.includes(a.category))
    const score = relevant.reduce((sum, a) => sum + (a.base_score ?? 0), 0)
    return { subject: label, score: Math.min(score * 10, 100), fullMark: 100 }
  })

  const top5 = breakdown.slice(0, 5)

  const profileIncomplete = profile.gpa === null || profile.sat_score === null || profile.ielts_score === null
  const noActivities = activities.length === 0

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="Dashboard — Hồ Sơ Năng Lực" />

      <main className="flex-1 p-4 sm:p-6 space-y-6">

        {/* Incomplete profile banner */}
        {profileIncomplete && (
          <div className="flex items-center justify-between gap-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Hồ sơ chưa đầy đủ</p>
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-0.5">
                  Điền GPA, SAT, IELTS để Traffic Light và OCS hoạt động chính xác.
                </p>
              </div>
            </div>
            <Link
              href="/profile"
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Cập nhật <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Hoạt động đã nhập', value: totalCount, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Slot đã dùng', value: `${slottedCount}/10`, color: 'text-primary' },
            { label: 'OCS Score', value: total_ocs, color: 'text-primary' },
            { label: 'Trường mục tiêu', value: profile.target_schools.length, color: 'text-purple-600 dark:text-purple-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <p className="text-sm text-muted-foreground mb-1">{label}</p>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* OCS Gauge */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm flex flex-col items-center justify-center">
            <h2 className="text-sm font-semibold text-muted-foreground mb-4">OCS Score</h2>
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke="var(--primary)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-primary">{total_ocs}</span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Overall Competency Score</p>
            {noActivities && (
              <Link href="/portfolio" className="mt-3 text-sm text-primary hover:underline">
                + Thêm hoạt động để tăng OCS
              </Link>
            )}
          </div>

          {/* T-Shape Radar */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">T-Shape Radar</h2>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="score" stroke="#16a34a" fill="#16a34a" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Profile Summary */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">Hồ sơ cá nhân</h2>
              <Link href="/profile" className="text-sm text-primary hover:underline">Chỉnh sửa</Link>
            </div>
            {[
              { label: 'GPA', value: profile.gpa === null ? '—' : profile.gpa.toFixed(1), missing: profile.gpa === null },
              { label: 'SAT', value: profile.sat_score === null ? '—' : profile.sat_score.toString(), missing: profile.sat_score === null },
              { label: 'IELTS', value: profile.ielts_score === null ? '—' : profile.ielts_score.toFixed(1), missing: profile.ielts_score === null },
              { label: 'Trường', value: profile.school_name, missing: false },
              { label: 'Ngành', value: profile.target_major === 'cntt' ? 'CNTT' : 'Toán & Thống kê', missing: false },
            ].map(({ label, value, missing }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className={`font-semibold ${missing ? 'text-amber-500 dark:text-amber-400' : 'text-foreground'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Traffic Light Grid */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-4">Traffic Light — Mức độ phù hợp</h2>
          {profileIncomplete && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
              ⚠ Kết quả dựa trên điểm số hiện tại. Cập nhật GPA/SAT/IELTS để có kết quả chính xác hơn.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {compassResults.map((result) => {
              const dotColor =
                result.traffic_light === 'safe' ? 'bg-primary' : result.traffic_light === 'try_harder' ? 'bg-yellow-400' : 'bg-red-500'
              const textColor =
                result.traffic_light === 'safe'
                  ? 'text-primary'
                  : result.traffic_light === 'try_harder'
                  ? 'text-yellow-700 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
              const label =
                result.traffic_light === 'safe' ? 'An toàn' : result.traffic_light === 'try_harder' ? 'Cần cố gắng' : 'Cần điều chỉnh'

              return (
                <div
                  key={result.school_id}
                  className="flex items-center justify-between border border-border rounded-lg p-4 bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${dotColor} shrink-0`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{result.short_name}</p>
                      <p className={`text-sm font-medium ${textColor}`}>{label}</p>
                    </div>
                  </div>
                  <span className={`text-lg font-bold ${textColor}`}>{result.match_percentage}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* OCS Breakdown Table */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-4">OCS Breakdown — Top 5 Hoạt động</h2>
          {noActivities ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <p className="text-sm text-muted-foreground">Bạn chưa có hoạt động nào trong portfolio.</p>
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Thêm hoạt động đầu tiên <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {['Hoạt động', 'Danh mục', 'Base Score', 'Trust Weight', 'Relevance', 'Final Score'].map((h) => (
                      <th key={h} className="pb-3 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {top5.map((item) => {
                    const activity = activities.find((a) => a.activity_id === item.activity_id)
                    const cat = activity?.category ?? 'competition'
                    return (
                      <tr key={item.activity_id}>
                        <td className="py-3 pr-4 font-medium text-foreground max-w-xs truncate">
                          {item.title}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cat as ActivityCategory]}`}>
                            {CATEGORY_LABELS[cat as ActivityCategory]}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-foreground/80">{item.base_score}</td>
                        <td className="py-3 pr-4 text-foreground/80">×{item.trust_weight}</td>
                        <td className="py-3 pr-4 text-foreground/80">×{item.relevance_multiplier}</td>
                        <td className="py-3 pr-4 font-bold text-primary">
                          {item.final_score.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
