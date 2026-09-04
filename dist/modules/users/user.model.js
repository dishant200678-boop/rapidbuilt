import { Schema, model } from 'mongoose';
const refreshTokenSchema = new Schema({
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
}, { _id: false });
const userSchema = new Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: {
        type: String,
        enum: ['superadmin', 'ministry_admin', 'project_officer', 'auditor'],
        default: 'project_officer',
    },
    ministry: { type: String, trim: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    refreshTokens: [refreshTokenSchema],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
}, { timestamps: true });
// Method to check if account is currently locked out
userSchema.methods.isLocked = function () {
    return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
};
export const User = model('User', userSchema);
