import { Schema, model } from 'mongoose';
const alertSchema = new Schema({
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
}, { timestamps: true });
alertSchema.index({ isAcknowledged: 1, severity: 1, createdAt: -1 });
export const Alert = model('Alert', alertSchema);
