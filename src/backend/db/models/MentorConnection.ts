import mongoose, { Schema } from 'mongoose'

export interface MentorConnectionDoc {
  _id: mongoose.Types.ObjectId
  student_id: mongoose.Types.ObjectId
  mentor_id: mongoose.Types.ObjectId
  consented: boolean
  created_at: Date
}

const mentorConnectionSchema = new Schema<MentorConnectionDoc>(
  {
    student_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mentor_id: { type: Schema.Types.ObjectId, ref: 'Mentor', required: true },
    consented: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.connection_id = (ret._id as mongoose.Types.ObjectId).toString()
        ret.student_id = (ret.student_id as mongoose.Types.ObjectId)?.toString()
        ret.mentor_id = (ret.mentor_id as mongoose.Types.ObjectId)?.toString()
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  }
)

export const MentorConnection =
  mongoose.models.MentorConnection || mongoose.model<MentorConnectionDoc>('MentorConnection', mentorConnectionSchema)
