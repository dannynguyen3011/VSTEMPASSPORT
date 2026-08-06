import type { Activity, UserProfile } from '@/types'
import { DEMO_ACTIVITIES } from '@/shared/constants'

export type UserSwitchOption = {
  user_id: string
  label: string
  description: string
}

/** Danh sách user có thể chọn trong MVP (demo / QA) */
export const USER_SWITCH_OPTIONS: UserSwitchOption[] = [
  {
    user_id: 'user-new',
    label: 'Học sinh mới',
    description: 'Chưa nhập điểm · chưa có hoạt động',
  },
  {
    user_id: 'user-demo-cntt',
    label: 'Demo — Urban Elite (CNTT)',
    description: 'Theo persona BRD · hồ sơ mạnh',
  },
  {
    user_id: 'user-rural',
    label: 'Demo — Rural Talent',
    description: 'GPA cao · SAT thấp · ít slot',
  },
  {
    user_id: 'user-toan',
    label: 'Demo — Toán & Thống kê',
    description: 'Ngành 46 · OCS khác trọng số',
  },
]

function cloneActivitiesForUser(userId: string, source: Activity[]): Activity[] {
  return source.map((a, i) => ({
    ...a,
    activity_id: `${userId}-a${i + 1}`,
    user_id: userId,
  }))
}

/** Hoạt động gọn cho rural: 4 slot, còn lại có thể bổ sung sau */
function ruralActivities(): Activity[] {
  const slice = DEMO_ACTIVITIES.slice(0, 4).map((a, i) => ({
    ...a,
    slot_order: (i + 1) as number,
  }))
  return cloneActivitiesForUser('user-rural', slice)
}

/** Toán & TK: chọn hoạt động phù hợp ngành 46 */
function toanActivities(): Activity[] {
  const picks = [1, 2, 7, 8].map((n) => DEMO_ACTIVITIES[n - 1]).filter(Boolean)
  const withSlots = picks.map((a, i) => ({ ...a, slot_order: (i + 1) as number }))
  return cloneActivitiesForUser('user-toan', withSlots)
}

export function buildInitialUserData(): {
  profilesById: Record<string, UserProfile>
  activitiesByUserId: Record<string, Activity[]>
} {
  const profilesById: Record<string, UserProfile> = {
    'user-new': {
      user_id: 'user-new',
      display_name: 'Học sinh mới',
      grade: 10,
      school_name: 'Chưa cập nhật trường',
      province: 'Chưa cập nhật',
      gpa: null,
      sat_score: null,
      ielts_score: null,
      target_major: 'cntt',
      target_schools: ['vinuni', 'hust', 'usth', 'vju', 'fulbright', 'swinburne'],
    },
    'user-demo-cntt': {
      user_id: 'user-demo-cntt',
      display_name: 'Nguyễn Quế Chi',
      grade: 11,
      school_name: 'THPT Chuyên Chu Văn An',
      province: 'Hà Nội',
      gpa: 9.2,
      sat_score: 1550,
      ielts_score: 7.5,
      target_major: 'cntt',
      target_schools: ['vinuni', 'hust', 'usth', 'vju', 'fulbright', 'swinburne'],
    },
    'user-rural': {
      user_id: 'user-rural',
      display_name: 'Minh Anh',
      grade: 11,
      school_name: 'THPT Chuyên Lê Hồng Phong',
      province: 'Đắk Lắk',
      gpa: 8.7,
      sat_score: 1050,
      ielts_score: 5.5,
      target_major: 'cntt',
      target_schools: ['hust', 'usth', 'vju', 'fulbright', 'swinburne', 'vinuni'],
    },
    'user-toan': {
      user_id: 'user-toan',
      display_name: 'Văn Nam',
      grade: 12,
      school_name: 'THPT Chuyên KHTN',
      province: 'Hà Nội',
      gpa: 9.0,
      sat_score: 1400,
      ielts_score: 7.0,
      target_major: 'toan_thong_ke',
      target_schools: ['vinuni', 'usth', 'vju', 'hust', 'fulbright', 'swinburne'],
    },
  }

  const activitiesByUserId: Record<string, Activity[]> = {
    'user-new': [],
    'user-demo-cntt': cloneActivitiesForUser('user-demo-cntt', DEMO_ACTIVITIES),
    'user-rural': ruralActivities(),
    'user-toan': toanActivities(),
  }

  return { profilesById, activitiesByUserId }
}
