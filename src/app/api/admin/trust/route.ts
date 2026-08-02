/**
 * PUT /api/admin/trust
 *
 * Admin approves TrustFactor upgrade for an activity (BA §2.2.4)
 * Tier 2: Teacher verification confirmed
 * Tier 3: Certificate approved after admin review (24-48h SLA)
 *
 * Body: { activity_id: string, new_tier: 2 | 3, verified_by: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/backend/db/mongoose'
import { Activity, AuditLog } from '@/backend/db/models'
import { requireAuth, isAdmin } from '@/backend/auth'

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

const approveSchema = z.object({
  activity_id: z.string().regex(OBJECT_ID_RE, 'Invalid activity_id'),
  new_tier: z.union([z.literal(2), z.literal(3)]),
  verified_by: z.string().min(1),
})

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!isAdmin(user.id)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    await connectDB()
    const body = await req.json()
    const parsed = approveSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    const { activity_id, new_tier, verified_by } = parsed.data

    const updated = await Activity.findByIdAndUpdate(
      activity_id,
      { trust_tier: new_tier, trust_verified_by: verified_by },
      { new: true }
    )

    if (!updated) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    // Audit log (BA §3.5)
    await AuditLog.create({
      entity_type: 'activity',
      entity_id: activity_id,
      action: `trust_tier${new_tier}_approved`,
      performed_by: user.id,
      metadata: JSON.stringify({ verified_by, new_tier }),
    })

    return NextResponse.json({
      success: true,
      activity_id,
      new_tier,
      message: `TrustFactor nâng lên Tier ${new_tier} thành công.`,
    })
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/admin/trust — List pending TrustFactor requests
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!isAdmin(user.id)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    await connectDB()

    // Activities with 'pending:' prefix in trust_verified_by = awaiting admin review
    const pending = await Activity.find({ trust_verified_by: /^pending:/ })

    return NextResponse.json(pending)
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
