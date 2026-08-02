import mongoose, { Schema } from 'mongoose'

export interface ActivityDoc {
  _id: mongoose.Types.ObjectId
  user_id: mongoose.Types.ObjectId
  category: 'scholarship' | 'competition' | 'extracurricular' | 'research' | 'self_learning' | 'green_ethics'
  title: string
  star_situation: string
  star_task: string
  star_action: string
  star_result: string
  trust_tier: 1 | 2 | 3
  trust_verified_by: string | null
  tech_tags: string[]
  base_score: number
  slot_order: number | null
  artifact_url: string | null
  created_at: Date
}

const activitySchema = new Schema<ActivityDoc>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: {
      type: String,
      enum: ['scholarship', 'competition', 'extracurricular', 'research', 'self_learning', 'green_ethics'],
      required: true,
    },
    title: { type: String, required: true },
    star_situation: { type: String, required: true },
    star_task: { type: String, required: true },
    star_action: { type: String, required: true },
    star_result: { type: String, required: true },
    trust_tier: { type: Number, enum: [1, 2, 3], default: 1 },
    trust_verified_by: { type: String, default: null },
    tech_tags: { type: [String], default: [] },
    base_score: { type: Number, default: null },
    slot_order: { type: Number, default: null },
    artifact_url: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.activity_id = (ret._id as mongoose.Types.ObjectId).toString()
        ret.user_id = (ret.user_id as mongoose.Types.ObjectId)?.toString()
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  }
)

// One slot number per user; NULL/unset slot_order is excluded (matches the
// old Postgres partial unique index `unique_slot_per_user`).
activitySchema.index(
  { user_id: 1, slot_order: 1 },
  { unique: true, partialFilterExpression: { slot_order: { $type: 'number' } } }
)

export const Activity = mongoose.models.Activity || mongoose.model<ActivityDoc>('Activity', activitySchema)
