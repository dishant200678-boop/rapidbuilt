import { Model, Types } from 'mongoose';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public fields?: Record<string, string[]>;

  constructor(statusCode: number, code: string, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function assertOwnership<T>(
  ModelClass: Model<T>,
  resourceId: string,
  userId: string,
  bypassForRoles?: string[],
  userRole?: string
): Promise<T> {
  if (!Types.ObjectId.isValid(resourceId)) {
    throw new AppError(404, 'NOT_FOUND', 'Resource not found');
  }

  // If user has admin/bypass role, they can access without ownership check
  if (bypassForRoles && userRole && bypassForRoles.includes(userRole)) {
    const doc = await ModelClass.findOne({
      _id: new Types.ObjectId(resourceId),
      isDeleted: { $ne: true },
    });
    if (!doc) {
      throw new AppError(404, 'NOT_FOUND', 'Resource not found');
    }
    return doc;
  }

  const doc = await ModelClass.findOne({
    _id: new Types.ObjectId(resourceId),
    createdBy: new Types.ObjectId(userId),
    isDeleted: { $ne: true },
  });

  if (!doc) {
    // Always 404, never 403 — don't confirm the resource exists
    throw new AppError(404, 'NOT_FOUND', 'Resource not found');
  }

  return doc;
}
