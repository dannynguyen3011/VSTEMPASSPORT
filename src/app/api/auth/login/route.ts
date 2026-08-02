/**
 * POST /api/auth/login
 *
 * Body: { email, password } — the client resolves username → email via
 * GET /api/auth/lookup-username first, same as before.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/backend/db/mongoose'
import { User } from '@/backend/db/models'
import { signToken } from '@/backend/auth'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const INVALID_CREDENTIALS_MESSAGE = 'Email/tên đăng nhập hoặc mật khẩu không đúng. Vui lòng thử lại.'

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 422 })
    }

    const { email, password } = parsed.data
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash')

    if (!user) {
      return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 })
    }

    user.last_active = new Date()
    await user.save()

    const token = signToken({ id: user._id.toString(), email: user.email })

    return NextResponse.json({ token, user })
  } catch (e) {
    console.error('[auth/login]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
