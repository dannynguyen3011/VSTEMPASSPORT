import mongoose, { Schema } from 'mongoose'

export interface MentorDoc {
  _id: mongoose.Types.ObjectId
  display_name: string
  school: string
  major: string
  expertise_tags: string[]
  bio: string | null
  is_active: boolean
  verified: boolean
  rating: number | null
  created_at: Date
}

const mentorSchema = new Schema<MentorDoc>(
  {
    display_name: { type: String, required: true },
    school: { type: String, required: true },
    major: { type: String, required: true },
    expertise_tags: { type: [String], default: [] },
    bio: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
    rating: { type: Number, default: null },
    created_at: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.mentor_id = (ret._id as mongoose.Types.ObjectId).toString()
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  }
)

export const Mentor = mongoose.models.Mentor || mongoose.model<MentorDoc>('Mentor', mentorSchema)
