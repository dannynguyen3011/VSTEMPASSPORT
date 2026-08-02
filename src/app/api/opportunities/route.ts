/**
 * GET  /api/opportunities  — List verified STEM opportunities with filters
 * POST /api/opportunities  — (Admin only) Create new opportunity
 *
 * Filters: type, field_tag, scope, is_free, is_online, upcoming_only
 * BA §2.6 — Kho Cơ Hội STEM
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/backend/db/mongoose'
import { Opportunity } from '@/backend/db/models'
import { requireAuth, isAdmin } from '@/backend/auth'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    await connectDB()

    const { searchParams } = new URL(req.url)

    // Only show admin-verified entries (BA §2.6.1)
    const filter: Record<string, unknown> = { admin_verified: true }

    // Hide past deadlines (BA §2.6.1: "Ẩn entry nếu deadline đã qua")
    const upcomingOnly = searchParams.get('upcoming_only') !== 'false'
    if (upcomingOnly) {
      filter.deadline = { $gte: new Date() }
    }

    if (searchParams.get('type')) {
      filter.type = searchParams.get('type')
    }

    if (searchParams.get('scope')) {
      filter.scope = searchParams.get('scope')
    }

    if (searchParams.get('is_free') !== null) {
      filter.is_free = searchParams.get('is_free') === 'true'
    }

    if (searchParams.get('is_online') !== null) {
      filter.is_online = searchParams.get('is_online') === 'true'
    }

    // field_tag filter (any match in the array)
    const fieldTag = searchParams.get('field_tag')
    if (fieldTag) {
      filter.field_tags = fieldTag
    }

    const opportunities = await Opportunity.find(filter).sort({ deadline: 1 })

    return NextResponse.json(opportunities)
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const createOpportunitySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['competition', 'scholarship', 'workshop', 'summer_program']),
  field_tags: z.array(z.string()).min(1),
  scope: z.enum(['international', 'national', 'regional']),
  is_online: z.boolean(),
  is_free: z.boolean(),
  deadline: z.string().datetime(),
  source_url: z.string().url(),
  description: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!isAdmin(user.id)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    await connectDB()
    const body = await req.json()
    const parsed = createOpportunitySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const d = parsed.data

    let inserted
    try {
      inserted = await Opportunity.create({
        name: d.name,
        type: d.type,
        field_tags: d.field_tags,
        scope: d.scope,
        is_online: d.is_online,
        is_free: d.is_free,
        deadline: new Date(d.deadline),
        source_url: d.source_url,
        description: d.description,
        admin_verified: false, // requires explicit approval
      })
    } catch (err: unknown) {
      const mongoErr = err as { code?: number }
      if (mongoErr?.code === 11000) {
        return NextResponse.json({ error: 'Một cơ hội với source_url này đã tồn tại.' }, { status: 409 })
      }
      throw err
    }

    return NextResponse.json(inserted, { status: 201 })
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
