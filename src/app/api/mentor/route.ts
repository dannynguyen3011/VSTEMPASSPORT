/**
 * GET /api/mentor   — List active, verified mentors
 * Query params: school, expertise_tag
 */
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/backend/db/mongoose'
import { Mentor } from '@/backend/db/models'
import { requireAuth } from '@/backend/auth'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    await connectDB()

    const { searchParams } = new URL(req.url)
    const filter: Record<string, unknown> = { is_active: true, verified: true }

    if (searchParams.get('school')) {
      filter.school = searchParams.get('school')
    }

    const expertiseTag = searchParams.get('expertise_tag')
    if (expertiseTag) {
      filter.expertise_tags = expertiseTag
    }

    const mentors = await Mentor.find(filter).sort({ rating: 1 })

    return NextResponse.json(mentors)
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
