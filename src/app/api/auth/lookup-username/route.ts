/**
 * GET /api/auth/lookup-username?username=xxx
 * Public endpoint — returns the email associated with a username.
 * Used by the login page to support username-based login.
 */
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/backend/db/mongoose'
import { User } from '@/backend/db/models'

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')?.toLowerCase().trim()

  if (!username) {
    return NextResponse.json({ error: 'username required' }, { status: 400 })
  }

  try {
    await connectDB()
    const user = await User.findOne({ username }).select('email')

    if (!user?.email) {
      return NextResponse.json({ error: 'Username not found' }, { status: 404 })
    }

    return NextResponse.json({ email: user.email })
  } catch (e) {
    console.error('[lookup-username]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
