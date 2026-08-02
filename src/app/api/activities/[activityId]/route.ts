/**
 * GET    /api/activities/[activityId]   — Get single activity
 * PUT    /api/activities/[activityId]   — Update activity (re-runs NLP + scoring)
 * DELETE /api/activities/[activityId]   — Delete activity
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import mongoose from 'mongoose'
import { connectDB } from '@/backend/db/mongoose'
import { Activity } from '@/backend/db/models'
import { requireAuth } from '@/backend/auth'
import { extractTechTags, scoreStar } from '@/backend/nlp-tagger'

const updateSchema = z.object({
  category: z
    .enum(['scholarship', 'competition', 'extracurricular', 'research', 'self_learning', 'green_ethics'])
    .optional(),
  title: z.string().min(1).max(200).optional(),
  star_situation: z.string().min(30).optional(),
  star_task: z.string().min(30).optional(),
  star_action: z.string().min(50).optional(),
  star_result: z.string().min(30).optional(),
  slot_order: z.number().int().min(1).max(10).nullable().optional(),
  artifact_url: z.string().url().nullable().optional(),
})

type Params = { params: Promise<{ activityId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth(req)
    const { activityId } = await params
    await connectDB()

    if (!mongoose.isValidObjectId(activityId)) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    const activity = await Activity.findOne({ _id: activityId, user_id: user.id })
    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }
    return NextResponse.json(activity)
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth(req)
    const { activityId } = await params
    await connectDB()

    if (!mongoose.isValidObjectId(activityId)) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
    }

    // Fetch current row to merge with partial update
    const current = await Activity.findOne({ _id: activityId, user_id: user.id })
    if (!current) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    const d = parsed.data
    const merged = {
      star_action: d.star_action ?? current.star_action,
      star_situation: d.star_situation ?? current.star_situation,
      star_task: d.star_task ?? current.star_task,
      star_result: d.star_result ?? current.star_result,
      trust_tier: current.trust_tier,
    }

    // Re-run NLP and scoring if any STAR field changed
    const tech_tags = extractTechTags(
      `${merged.star_action} ${merged.star_situation} ${merged.star_result}`
    )
    const base_score = scoreStar({ ...merged, tech_tags })

    const updates: Record<string, unknown> = { tech_tags, base_score }
    if (d.category !== undefined) updates.category = d.category
    if (d.title !== undefined) updates.title = d.title
    if (d.star_situation !== undefined) updates.star_situation = d.star_situation
    if (d.star_task !== undefined) updates.star_task = d.star_task
    if (d.star_action !== undefined) updates.star_action = d.star_action
    if (d.star_result !== undefined) updates.star_result = d.star_result
    if (d.slot_order !== undefined) updates.slot_order = d.slot_order
    if (d.artifact_url !== undefined) updates.artifact_url = d.artifact_url

    let updated
    try {
      updated = await Activity.findOneAndUpdate(
        { _id: activityId, user_id: user.id },
        updates,
        { new: true, runValidators: true }
      )
    } catch (err: unknown) {
      const mongoErr = err as { code?: number }
      if (mongoErr?.code === 11000) {
        return NextResponse.json(
          { error: `Slot ${d.slot_order} đã được sử dụng. Chọn slot khác.` },
          { status: 409 }
        )
      }
      throw err
    }

    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth(req)
    const { activityId } = await params
    await connectDB()

    if (!mongoose.isValidObjectId(activityId)) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    const deleted = await Activity.findOneAndDelete({ _id: activityId, user_id: user.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
