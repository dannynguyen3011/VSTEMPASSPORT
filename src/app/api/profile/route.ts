/**
 * GET /api/profile       — Get the authenticated user's profile
 * PUT /api/profile       — Update the authenticated user's profile
 *
 * (Profile creation now happens atomically in POST /api/auth/register.)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/backend/db/mongoose'
import { User } from '@/backend/db/models'
import { requireAuth } from '@/backend/auth'
import { detectUnrealisticGoal } from '@/shared/matching'

const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  grade: z.union([z.literal(10), z.literal(11), z.literal(12)]).optional(),
  school_name: z.string().min(1).max(200).optional(),
  province: z.string().min(1).max(100).optional(),
  username: z.string().regex(/^[a-z0-9_]{3,20}$/).optional(),
  gpa: z.number().min(0).max(10).nullable().optional(),
  sat_score: z.number().int().min(400).max(1600).nullable().optional(),
  ielts_score: z.number().min(0).max(9).nullable().optional(),
  target_major: z.enum(['cntt', 'toan_thong_ke']).optional(),
  target_schools: z.array(z.string()).max(6).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    await connectDB()

    const profile = await User.findById(user.id)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json(profile)
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    await connectDB()

    const body = await req.json()
    const parsed = profileUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const d = parsed.data
    const updates: Record<string, unknown> = { last_active: new Date() }
    if (d.display_name !== undefined) updates.display_name = d.display_name
    if (d.grade !== undefined) updates.grade = d.grade
    if (d.school_name !== undefined) updates.school_name = d.school_name
    if (d.province !== undefined) updates.province = d.province
    if (d.username !== undefined) updates.username = d.username?.toLowerCase() ?? null
    if (d.gpa !== undefined) updates.gpa = d.gpa
    if (d.sat_score !== undefined) updates.sat_score = d.sat_score
    if (d.ielts_score !== undefined) updates.ielts_score = d.ielts_score
    if (d.target_major !== undefined) updates.target_major = d.target_major
    if (d.target_schools !== undefined) updates.target_schools = d.target_schools

    let updated
    try {
      updated = await User.findByIdAndUpdate(user.id, updates, { new: true, runValidators: true })
    } catch (err: unknown) {
      const mongoErr = err as { code?: number }
      if (mongoErr?.code === 11000) {
        return NextResponse.json({ error: 'Tên đăng nhập đã được sử dụng.' }, { status: 409 })
      }
      throw err
    }

    if (!updated) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const warning = detectUnrealisticGoal({
      user_id: user.id,
      display_name: updated.display_name,
      grade: updated.grade,
      school_name: updated.school_name,
      province: updated.province,
      gpa: updated.gpa,
      sat_score: updated.sat_score,
      ielts_score: updated.ielts_score,
      target_major: updated.target_major ?? 'cntt',
      target_schools: updated.target_schools,
    })

    return NextResponse.json({ profile: updated, warning })
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
