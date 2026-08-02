import mongoose, { Schema, type HydratedDocument } from 'mongoose'

/**
 * Consolidates what used to be split across Supabase `auth.users` (credentials)
 * and Drizzle `user_profiles` (profile fields) into one document. `_id` is
 * serialized as `user_id` in API responses (see toJSON below) so the rest of
 * the app — which was built against a Supabase-UUID-as-string `user_id` — needs
 * no further changes.
 */
export interface UserDoc {
  _id: mongoose.Types.ObjectId
  email: string
  username?: string
  passwordHash: string
  display_name: string
  grade: 10 | 11 | 12
  school_name: string
  province: string
  gpa: number | null
  sat_score: number | null
  ielts_score: number | null
  target_major: 'cntt' | 'toan_thong_ke' | null
  target_schools: string[]
  created_at: Date
  last_active: Date
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // No `default` here — leaving it unset keeps the field absent (not `null`)
    // so the sparse unique index only applies to accounts that set a username.
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    display_name: { type: String, required: true },
    grade: { type: Number, enum: [10, 11, 12], required: true },
    school_name: { type: String, required: true },
    province: { type: String, required: true },
    gpa: { type: Number, default: null },
    sat_score: { type: Number, default: null },
    ielts_score: { type: Number, default: null },
    target_major: { type: String, enum: ['cntt', 'toan_thong_ke'], default: null },
    target_schools: { type: [String], default: [] },
    created_at: { type: Date, default: Date.now },
    last_active: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.user_id = (ret._id as mongoose.Types.ObjectId).toString()
        delete ret._id
        delete ret.__v
        delete ret.passwordHash
        return ret
      },
    },
  }
)

export type UserHydratedDoc = HydratedDocument<UserDoc>

export const User = mongoose.models.User || mongoose.model<UserDoc>('User', userSchema)
