/**
 * PUT /api/admin/opportunities
 *
 * Admin verify/reject an opportunity (BA §2.6 — admin_verified field)
 * Only admin-verified entries are shown to students.
 *
 * Body: { opp_id: string, approved: boolean }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/backend/db/mongoose'
import { Opportunity, AuditLog } from '@/backend/db/models'
import { requireAuth, isAdmin } from '@/backend/auth'

const approveSchema = z.object({
  opp_id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid opp_id'),
  approved: z.boolean(),
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

    const { opp_id, approved } = parsed.data

    const updated = await Opportunity.findByIdAndUpdate(
      opp_id,
      { admin_verified: approved },
      { new: true }
    )

    if (!updated) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    await AuditLog.create({
      entity_type: 'opportunity',
      entity_id: opp_id,
      action: approved ? 'opportunity_approved' : 'opportunity_rejected',
      performed_by: user.id,
      metadata: JSON.stringify({ opp_id, approved }),
    })

    return NextResponse.json({
      success: true,
      opp_id,
      admin_verified: approved,
      message: approved ? 'Cơ hội đã được phê duyệt và hiển thị cho học sinh.' : 'Cơ hội đã bị từ chối.',
    })
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/admin/opportunities — List all opportunities (including unverified)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req)

    if (!isAdmin(user.id)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    await connectDB()
    const opportunities = await Opportunity.find().sort({ created_at: 1 })

    return NextResponse.json(opportunities)
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
