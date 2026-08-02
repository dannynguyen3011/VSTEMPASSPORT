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
    name: { type: String, required: true },
    type: { type: String, enum: ['competition', 'scholarship', 'workshop', 'summer_program'], required: true },
    field_tags: { type: [String], required: true },
    scope: { type: String, enum: ['international', 'national', 'regional'], required: true },
    is_online: { type: Boolean, required: true },
    is_free: { type: Boolean, required: true },
    deadline: { type: Date, required: true },
    // Unique so re-running the seed script is idempotent (the old Drizzle
    // seed relied on a fresh random PK + onConflictDoNothing(), which never
    // actually matched anything — this fixes that pre-existing bug).
    source_url: { type: String, required: true, unique: true },
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
