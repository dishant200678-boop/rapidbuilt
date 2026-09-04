import { Schema, model, Document, Types } from 'mongoose';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface IAlert extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  projectCode: string;
  projectName: string;
  ministry: string;
  severity: AlertSeverity;
  title: string;
  reason: string;
  riskScore: number;
  isAcknowledged: boolean;
  acknowledgedBy?: Types.ObjectId;
  acknowledgedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    projectCode: { type: String, required: true },
    projectName: { type: String, required: true },
    ministry: { type: String, required: true, index: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], required: true, index: true },
    title: { type: String, required: true },
    reason: { type: String, required: true },
    riskScore: { type: Number, required: true },
    isAcknowledged: { type: Boolean, default: false, index: true },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date },
  },
  { timestamps: true }
);

alertSchema.index({ isAcknowledged: 1, severity: 1, createdAt: -1 });

export const Alert = model<IAlert>('Alert', alertSchema);
