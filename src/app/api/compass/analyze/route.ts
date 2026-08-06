/**
 * POST /api/compass/analyze
 *
 * Compass Engine — Traffic Light Matching (BA §2.3)
 * Body: { profile: UserProfile, activities: Activity[] }
 * Returns: CompassResult[] for all target schools
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/backend/db/mongoose'
import { User, Activity as ActivityModel } from '@/backend/db/models'
import { requireAuth } from '@/backend/auth'
import { analyzeCompass, detectUnrealisticGoal } from '@/shared/matching'
import { calculateOCS } from '@/shared/ocs'
import type { UserProfile, Activity } from '@/types'

const requestSchema = z.object({
  // Optional: if omitted, will be fetched from DB for the authenticated user
  use_demo: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    await connectDB()

    const body = await req.json().catch(() => ({}))
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    // Load profile and activities from DB
    const profileDoc = await User.findById(user.id)

    if (!profileDoc) {
      return NextResponse.json(
        { error: 'Hồ sơ không tồn tại. Vui lòng tạo hồ sơ trước.' },
        { status: 404 }
      )
    }

    const activityDocs = await ActivityModel.find({ user_id: user.id })

    // Map DB rows to domain types
    const profile: UserProfile = {
      user_id: profileDoc._id.toString(),
      display_name: profileDoc.display_name,
      grade: profileDoc.grade,
      school_name: profileDoc.school_name,
      province: profileDoc.province,
      gpa: profileDoc.gpa,
      sat_score: profileDoc.sat_score,
      ielts_score: profileDoc.ielts_score,
      target_major: profileDoc.target_major ?? 'cntt',
      target_schools: profileDoc.target_schools,
    }

    const activities: Activity[] = activityDocs.map((a) => ({
      activity_id: a._id.toString(),
      user_id: a.user_id.toString(),
      category: a.category,
      title: a.title,
      star_situation: a.star_situation,
      star_task: a.star_task,
      star_action: a.star_action,
      star_result: a.star_result,
      trust_tier: a.trust_tier,
      trust_verified_by: a.trust_verified_by,
      tech_tags: a.tech_tags ?? [],
      base_score: a.base_score ?? 1.0,
      slot_order: a.slot_order,
      artifact_url: a.artifact_url,
      created_at: a.created_at.toISOString(),
    }))

    // Run matching + OCS
    const ocsResult = calculateOCS(activities, profile.target_major)
    const compassResults = analyzeCompass(profile, activities, ocsResult.total_ocs)

    // Unrealistic goal warning
    const warning = detectUnrealisticGoal(profile)

    return NextResponse.json({
      compass: compassResults,
      ocs: ocsResult,
      warning,
      meta: {
        total_activities: activities.length,
        slotted_activities: activities.filter((a) => a.slot_order !== null).length,
        last_updated: new Date().toISOString(),
      },
    })
  } catch (e) {
    if (e instanceof Response) return e
    console.error('[compass/analyze]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
