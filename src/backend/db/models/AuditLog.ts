import mongoose, { Schema } from 'mongoose'

export interface AuditLogDoc {
  _id: mongoose.Types.ObjectId
  entity_type: string // 'activity' | 'opportunity'
  entity_id: string
  action: string
  performed_by: string | null
  metadata: string | null // JSON string
  created_at: Date
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    entity_type: { type: String, required: true },
    entity_id: { type: String, required: true },
    action: { type: String, required: true },
    performed_by: { type: String, default: null },
    metadata: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.log_id = (ret._id as mongoose.Types.ObjectId).toString()
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  }
)

export const AuditLog = mongoose.models.AuditLog || mongoose.model<AuditLogDoc>('AuditLog', auditLogSchema)
