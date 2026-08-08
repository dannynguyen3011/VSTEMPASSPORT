import type { Citation } from '@/shared/schemas/citation'

export type ActivityCategory =
  | 'scholarship'
  | 'competition'
  | 'extracurricular'
  | 'research'
  | 'self_learning'
  | 'green_ethics'

export type TrustTier = 1 | 2 | 3

export type TrafficLight = 'safe' | 'try_harder' | 'adjust'

export type TargetMajor = 'cntt' | 'toan_thong_ke'

export interface UserProfile {
  user_id: string
  display_name: string
  grade: 10 | 11 | 12
  school_name: string
  province: string
  gpa: number | null
  sat_score: number | null
  ielts_score: number | null
  target_major: TargetMajor
  target_schools: string[]
}

export interface Activity {
  activity_id: string
  user_id: string
  category: ActivityCategory
  title: string
  star_situation: string
  star_task: string
  star_action: string
  star_result: string
  trust_tier: TrustTier
  trust_verified_by: string | null
  tech_tags: string[]
  base_score: number
  slot_order: number | null
  artifact_url: string | null
  created_at: string
}

export interface Opportunity {
  opp_id: string
  name: string
  type: 'competition' | 'scholarship' | 'workshop' | 'summer_program'
  field_tags: ('cntt' | 'toan' | 'stem' | 'toan_thong_ke')[]
  scope: 'international' | 'national' | 'regional'
  is_online: boolean
  is_free: boolean
  deadline: string
  source_url: string
  admin_verified: boolean
  description?: string
}

export interface SchoolPersona {
  school_id: string
  school_name: string
  short_name: string
  min_sat: number | null
  min_gpa: number
  min_ielts: number
  has_interview: boolean
  min_portfolio_activities: number
  preferred_categories: ActivityCategory[]
  persona_description: string
}

export interface CompassResult {
  school_id: string
  school_name: string
  short_name: string
  traffic_light: TrafficLight
  match_percentage: number
  gaps: GapItem[]
}

export interface GapItem {
  field: string
  current_value: string
  required_value: string
  passed: boolean
  action_suggestion: string
}

export interface OCSBreakdownItem {
  activity_id: string
  title: string
  base_score: number
  relevance_multiplier: number
  trust_weight: number
  final_score: number
}

export interface OCSResult {
  total_ocs: number
  breakdown: OCSBreakdownItem[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[]
  timestamp: string
}

export type { Citation }

export interface MentorProfile {
  mentor_id: string
  display_name: string
  school: string
  major: string
  expertise_tags: string[]
  bio: string
  is_active: boolean
  verified: boolean
  rating: number
}
