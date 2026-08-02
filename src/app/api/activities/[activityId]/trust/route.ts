/**
 * POST /api/activities/[activityId]/trust
 *
 * TrustFactor verification flow (BA §2.2.4)
 * Tier 2: Teacher/peer verification via email link
 * Tier 3: Certificate upload (URL) → admin review
 *
 * This endpoint initiates the upgrade request.
 * Actual tier upgrade happens in /api/admin/trust (admin confirms).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import mongoose from 'mongoose'
import { connectDB } from '@/backend/db/mongoose'
import { Activity, AuditLog } from '@/backend/db/models'
import { requireAuth } from '@/backend/auth'
import { notifyAdmin } from '@/backend/rocketchat'

const trustRequestSchema = z.discriminatedUnion('tier', [
  z.object({
    tier: z.literal(2),
    verifier_email: z.string().email('Email giáo viên không hợp lệ'),
    verifier_name: z.string().min(1),
  }),
  z.object({
    tier: z.literal(3),
    certificate_url: z.string().url('URL chứng chỉ không hợp lệ'),
    certificate_issuer: z.string().min(1),
  }),
])

type Params = { params: Promise<{ activityId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth(req)
    const { activityId } = await params
    await connectDB()

    if (!mongoose.isValidObjectId(activityId)) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = trustRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    // Verify the activity belongs to this user
    const activity = await Activity.findOne({ _id: activityId, user_id: user.id })

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    const data = parsed.data

    if (data.tier === 2) {
      /**
       * MVP Tier 2 implementation:
       * - Log the verification request to audit_logs
       * - Update trust_verified_by to the verifier email
       * - In production: send Resend email to verifier with approval link
       * - Tier actually upgraded by admin via /api/admin/trust
       */
      await AuditLog.create({
        entity_type: 'activity',
        entity_id: activityId,
        action: 'trust_tier2_requested',
        performed_by: user.id,
        metadata: JSON.stringify({
          verifier_email: data.verifier_email,
          verifier_name: data.verifier_name,
        }),
      })

      // Update verified_by field to show pending review
      activity.trust_verified_by = `pending:${data.verifier_email}`
      await activity.save()

      await notifyAdmin({
        text: `📨 *TrustFactor Tier 2 request* — chờ giáo viên xác nhận`,
        color: 'warning',
        fields: [
          { title: 'Activity', value: activity.title, short: true },
          { title: 'Student ID', value: user.id, short: true },
          { title: 'Verifier', value: data.verifier_name, short: true },
          { title: 'Verifier email', value: data.verifier_email, short: true },
        ],
      })

      return NextResponse.json({
        success: true,
        message: `Yêu cầu xác thực đã gửi đến ${data.verifier_email}. Tier sẽ được cập nhật sau khi giáo viên xác nhận.`,
        status: 'pending_tier2',
      })
    }

    if (data.tier === 3) {
      /**
       * Tier 3: Certificate upload → admin review within 24-48h
       */
      await AuditLog.create({
        entity_type: 'activity',
        entity_id: activityId,
        action: 'trust_tier3_requested',
        performed_by: user.id,
        metadata: JSON.stringify({
          certificate_url: data.certificate_url,
          certificate_issuer: data.certificate_issuer,
        }),
      })

      activity.trust_verified_by = `pending:${data.certificate_issuer}`
      activity.artifact_url = data.certificate_url
      await activity.save()

      await notifyAdmin({
        text: `🎓 *TrustFactor Tier 3* — chứng chỉ mới cần admin review (SLA 24-48h)`,
        color: 'danger',
        fields: [
          { title: 'Activity', value: activity.title, short: true },
          { title: 'Student ID', value: user.id, short: true },
          { title: 'Issuer', value: data.certificate_issuer, short: true },
          { title: 'Certificate URL', value: data.certificate_url, short: false },
        ],
      })

      return NextResponse.json({
        success: true,
        message: 'Chứng chỉ đã gửi Admin review. Kết quả trong 24-48h.',
        status: 'pending_tier3',
      })
    }
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
