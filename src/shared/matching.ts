/**
 * Compass Matching Engine
 * Implements Gap Analysis + Traffic Light logic from BA §3.3.1–3.3.2.
 *
 * Single canonical implementation — used by the Compass page, the Dashboard's
 * Traffic Light widget, and the /api/compass/analyze and /api/mentor/connect
 * routes, so every screen agrees on the same match percentage for a given
 * student/school pair. Previously each of those had its own divergent copy.
 */
import type { UserProfile, Activity, CompassResult, GapItem } from '@/types'
import { BIG6_SCHOOLS } from './constants'

const GAP_ACTIONS: Record<string, string> = {
  GPA: 'Tập trung cải thiện điểm các môn STEM trong 1-2 học kỳ tới.',
  SAT: 'Lập lộ trình SAT 8-12 tuần, ưu tiên phần Math và làm full test Bluebook.',
  IELTS: 'Luyện theo band mục tiêu và thi thử mỗi 2 tuần để theo dõi tiến độ.',
  Portfolio: 'Bổ sung thêm dự án/hoạt động đúng ngành mục tiêu để đủ độ sâu hồ sơ.',
  OCS: 'Nâng chất lượng STAR (đặc biệt phần Action) và tăng TrustFactor cho hoạt động mạnh nhất.',
}

// Partial credit for being close to a threshold, not just binary pass/fail —
// e.g. SAT 1300 against a 1400 requirement still counts for something.
function scoreByThreshold(current: number, min: number, tolerance: number): number {
  if (current >= min) return 1
  return Math.max(0, 1 - (min - current) / tolerance)
}

export function analyzeCompass(
  profile: UserProfile,
  activities: Activity[],
  ocsTotal: number
): CompassResult[] {
  const targetSchools = profile.target_schools?.length
    ? BIG6_SCHOOLS.filter((s) => profile.target_schools.includes(s.school_id))
    : BIG6_SCHOOLS

  const gpa = profile.gpa ?? 0
  const sat = profile.sat_score ?? 0
  const ielts = profile.ielts_score ?? 0
  const slottedCount = activities.filter((a) => a.slot_order !== null).length

  return targetSchools.map((school) => {
    const metrics = [
      {
        key: 'GPA',
        weight: 0.25,
        value: gpa,
        min: school.min_gpa,
        tolerance: 1.0,
        currentText: profile.gpa ? String(profile.gpa) : 'Chưa nhập',
        requiredText: `>= ${school.min_gpa.toFixed(1)}`,
      },
      {
        key: 'SAT',
        weight: 0.25,
        value: sat,
        min: school.min_sat ?? 0,
        tolerance: 300,
        currentText: profile.sat_score ? String(profile.sat_score) : 'Chưa thi',
        requiredText: school.min_sat === null ? 'Không bắt buộc' : `>= ${school.min_sat}`,
        optional: school.min_sat === null,
      },
      {
        key: 'IELTS',
        weight: 0.2,
        value: ielts,
        min: school.min_ielts,
        tolerance: 2.0,
        currentText: profile.ielts_score ? String(profile.ielts_score) : 'Chưa thi',
        requiredText: `>= ${school.min_ielts.toFixed(1)}`,
      },
      {
        key: 'Portfolio',
        weight: 0.15,
        value: slottedCount,
        min: school.min_portfolio_activities,
        tolerance: 4,
        currentText: String(slottedCount),
        requiredText: `>= ${school.min_portfolio_activities} hoạt động`,
      },
      {
        key: 'OCS',
        weight: 0.15,
        value: ocsTotal,
        min: 70,
        tolerance: 40,
        currentText: String(ocsTotal),
        requiredText: '>= 70',
      },
    ]

    const weighted = metrics.reduce((sum, metric) => {
      if (metric.optional) return sum + metric.weight
      return sum + scoreByThreshold(metric.value, metric.min, metric.tolerance) * metric.weight
    }, 0)

    const matchPct = Math.round(weighted * 100)
    const trafficLight =
      matchPct >= 90 ? 'safe' : matchPct >= 70 ? 'try_harder' : 'adjust'

    const gaps: GapItem[] = metrics
      .filter((metric) => !metric.optional && metric.value < metric.min)
      .map((metric) => ({
        field: metric.key,
        current_value: metric.currentText,
        required_value: metric.requiredText,
        passed: false,
        action_suggestion: GAP_ACTIONS[metric.key] ?? 'Bổ sung theo gợi ý từ Compass.',
      }))

    return {
      school_id: school.school_id,
      school_name: school.school_name,
      short_name: school.short_name,
      traffic_light: trafficLight,
      match_percentage: matchPct,
      gaps,
    } satisfies CompassResult
  })
}

/**
 * Unrealistic goal detection (BA §4.2 Anti-Fraud / SDG-3)
 * Returns a warning string if the profile has suspicious combinations.
 */
export function detectUnrealisticGoal(profile: UserProfile): string | null {
  const { gpa, sat_score, grade } = profile

  if (gpa && sat_score) {
    if (gpa < 7.0 && sat_score > 1400) {
      return `GPA ${gpa} + SAT ${sat_score} là tổ hợp bất thường. Hãy đặt mục tiêu thực tế hơn hoặc kiểm tra lại điểm số.`
    }
    if (grade === 10 && gpa < 7.5 && sat_score >= 1550) {
      return `GPA ${gpa} ở lớp ${grade} với mục tiêu SAT ${sat_score} cần cân nhắc lại. Tập trung cải thiện GPA trước.`
    }
  }
  return null
}
