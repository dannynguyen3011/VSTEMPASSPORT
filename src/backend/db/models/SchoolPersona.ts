import mongoose, { Schema } from 'mongoose'

export interface SchoolPersonaDoc {
  _id: string // = school_id, e.g. 'vinuni' (matches the old varchar PK)
  school_name: string
  short_name: string
  min_sat: number | null
  min_gpa: number
  min_ielts: number
  has_interview: boolean
  min_portfolio_activities: number
  preferred_categories: string[]
  persona_description: string | null
  source_doc: string | null
  source_page: string | null
  effective_year: number
}

const schoolPersonaSchema = new Schema<SchoolPersonaDoc>(
  {
    _id: { type: String, required: true },
    school_name: { type: String, required: true },
    short_name: { type: String, required: true },
    min_sat: { type: Number, default: null },
    min_gpa: { type: Number, required: true },
    min_ielts: { type: Number, required: true },
    has_interview: { type: Boolean, required: true },
    min_portfolio_activities: { type: Number, required: true },
    preferred_categories: { type: [String], default: [] },
    persona_description: { type: String, default: null },
    source_doc: { type: String, default: null },
    source_page: { type: String, default: null },
    effective_year: { type: Number, required: true },
  },
  {
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.school_id = ret._id
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  }
)

export const SchoolPersona =
  mongoose.models.SchoolPersona || mongoose.model<SchoolPersonaDoc>('SchoolPersona', schoolPersonaSchema)
