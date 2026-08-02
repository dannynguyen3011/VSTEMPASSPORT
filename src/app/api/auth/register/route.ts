/**
 * POST /api/auth/register
 *
 * Creates a user (credentials + profile in one document) and returns a JWT
 * immediately — registration is a single atomic step, no deferred
 * "profile row created later" flow.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/backend/db/mongoose'
import { User } from '@/backend/db/models'
import { signToken } from '@/backend/auth'
import { detectUnrealisticGoal } from '@/shared/matching'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự.'),
  username: z
    .string()
    .regex(/^[a-z0-9_]{3,20}$/, 'Tên đăng nhập chỉ gồm chữ thường, số, dấu gạch dưới, 3–20 ký tự.')
    .optional(),
  display_name: z.string().min(1).max(100),
  grade: z.union([z.literal(10), z.literal(11), z.literal(12)]),
  school_name: z.string().min(1).max(200),
  province: z.string().min(1).max(100),
  target_major: z.enum(['cntt', 'toan_thong_ke']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const data = parsed.data
    const passwordHash = await bcrypt.hash(data.password, 10)

    let user
    try {
      user = await User.create({
        email: data.email.toLowerCase(),
        username: data.username?.toLowerCase(),
        passwordHash,
        display_name: data.display_name,
        grade: data.grade,
        school_name: data.school_name,
        province: data.province,
        target_major: data.target_major ?? null,
      })
    } catch (err: unknown) {
      const mongoErr = err as { code?: number; keyPattern?: Record<string, unknown> }
      if (mongoErr?.code === 11000) {
        const field = Object.keys(mongoErr.keyPattern ?? {})[0]
        const message =
          field === 'username'
            ? 'Tên đăng nhập đã được sử dụng.'
            : 'Email này đã được đăng ký. Vui lòng đăng nhập.'
        return NextResponse.json({ error: message }, { status: 409 })
      }
      throw err
    }

    const warning = detectUnrealisticGoal({
      user_id: user._id.toString(),
      display_name: user.display_name,
      grade: user.grade,
      school_name: user.school_name,
      province: user.province,
      gpa: user.gpa,
      sat_score: user.sat_score,
      ielts_score: user.ielts_score,
      target_major: user.target_major ?? 'cntt',
      target_schools: user.target_schools,
    })

    const token = signToken({ id: user._id.toString(), email: user.email })

    return NextResponse.json({ token, user, warning }, { status: 201 })
  } catch (e) {
    console.error('[auth/register]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
