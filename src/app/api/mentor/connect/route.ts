/**
 * POST /api/mentor/connect
 *
 * Consent-based Mentor Connection (BA §2.7.2)
 * Creates a connection between student and mentor WITH explicit consent.
 * Once connected, mentor can see Portfolio 10-Slot (anonymised name/phone).
 *
 * Body: { mentor_id: string, consent: true }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/backend/db/mongoose'
import { Mentor, MentorConnection, User, Activity } from '@/backend/db/models'
import { requireAuth } from '@/backend/auth'
import { calculateOCS } from '@/shared/ocs'
import { analyzeCompass } from '@/shared/matching'
import type { Activity as ActivityType, UserProfile } from '@/types'

const connectSchema = z.object({
  mentor_id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid mentor_id'),
  consent: z.literal(true, 'Bạn phải đồng ý chia sẻ hồ sơ để kết nối.'),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    await connectDB()

    const body = await req.json()
    const parsed = connectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const { mentor_id } = parsed.data

    // Verify mentor exists and is active
    const mentor = await Mentor.findOne({ _id: mentor_id, is_active: true })

    if (!mentor) {
      return NextResponse.json({ error: 'Mentor không tồn tại hoặc không hoạt động.' }, { status: 404 })
    }

    // Prevent duplicate connections
    const existing = await MentorConnection.findOne({ student_id: user.id, mentor_id })

    if (existing) {
      return NextResponse.json(
        { error: 'Bạn đã kết nối với Mentor này rồi.' },
        { status: 409 }
      )
    }

    const connection = await MentorConnection.create({
      student_id: user.id,
      mentor_id,
      consented: true,
    })

    // Build AI Profile Digest for Mentor (BA §2.7.1)
    const profileDoc = await User.findById(user.id)
    const activityDocs = await Activity.find({ user_id: user.id })

    let profileDigest = null
    if (profileDoc && activityDocs.length > 0) {
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

      const activities: ActivityType[] = activityDocs.map((a) => ({
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

      const ocsResult = calculateOCS(activities, profile.target_major)
      const compassResults = analyzeCompass(profile, activities)

      // Top 3 strongest activities by final_score
      const top3 = [...ocsResult.breakdown]
        .sort((a, b) => b.final_score - a.final_score)
        .slice(0, 3)
        .map((item) => ({
          title: item.title,
          final_score: item.final_score,
        }))

      // Key gaps from target schools
      const keyGaps = compassResults
        .flatMap((r) => r.gaps.filter((g) => !g.passed))
        .slice(0, 3)
        .map((g) => g.action_suggestion)

      // Mentor question suggestions based on gaps
      const mentorQuestions = keyGaps.map(
        (gap, i) => `${i + 1}. ${gap.replace('Cần ', 'Hỏi về việc ')}`
      )

      profileDigest = {
        // Anonymised until student reveals identity (BA §2.7.2)
        display_name: `Học sinh ${profile.grade} - ${profile.province}`,
        grade: profile.grade,
        target_major: profile.target_major,
        ocs_total: ocsResult.total_ocs,
        top3_activities: top3,
        gap_summary: keyGaps,
        mentor_questions: mentorQuestions,
        generated_at: new Date().toISOString(),
      }
    }

    return NextResponse.json({
      connection_id: connection._id.toString(),
      mentor: {
        mentor_id: mentor._id.toString(),
        display_name: mentor.display_name,
        school: mentor.school,
        major: mentor.major,
      },
      profile_digest: profileDigest,
      message: 'Kết nối thành công. Mentor sẽ liên hệ trong vòng 48 giờ.',
    }, { status: 201 })
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
