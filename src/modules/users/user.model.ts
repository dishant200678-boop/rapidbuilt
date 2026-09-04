import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'superadmin' | 'ministry_admin' | 'project_officer' | 'auditor';

export interface IRefreshToken {
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  ministry?: string;
  failedLoginAttempts: number;
  lockUntil?: Date;
  refreshTokens: IRefreshToken[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isLocked(): boolean;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
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
  },
  { timestamps: true }
);

// Method to check if account is currently locked out
userSchema.methods.isLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

export const User = model<IUser>('User', userSchema);
