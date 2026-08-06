import mongoose, { Schema } from 'mongoose'

export interface OpportunityDoc {
  _id: mongoose.Types.ObjectId
  name: string
  type: 'competition' | 'scholarship' | 'workshop' | 'summer_program'
  field_tags: string[]
  scope: 'international' | 'national' | 'regional'
  is_online: boolean
  is_free: boolean
  deadline: Date
  source_url: string
  description: string | null
  admin_verified: boolean
  created_at: Date
}

const opportunitySchema = new Schema<OpportunityDoc>(
  {
    // Unique so re-running the seed/import scripts is idempotent (the old
    // Drizzle seed relied on a fresh random PK + onConflictDoNothing(), which
    // never actually matched anything — this fixes that pre-existing bug).
    name: { type: String, required: true, unique: true },
    type: { type: String, enum: ['competition', 'scholarship', 'workshop', 'summer_program'], required: true },
    field_tags: { type: [String], required: true },
    scope: { type: String, enum: ['international', 'national', 'regional'], required: true },
    is_online: { type: Boolean, required: true },
    is_free: { type: Boolean, required: true },
    deadline: { type: Date, required: true },
    // Not unique: real curated entries legitimately lack a confirmed source
    // link yet ("-" placeholder) until an admin verifies and adds one (BR6 /
    // §2.6 credibility tiers) — several can share that placeholder at once.
    source_url: { type: String, required: true },
    description: { type: String, default: null },
    admin_verified: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.opp_id = (ret._id as mongoose.Types.ObjectId).toString()
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  }
)

export const Opportunity =
  mongoose.models.Opportunity || mongoose.model<OpportunityDoc>('Opportunity', opportunitySchema)
