import { Types } from 'mongoose';
export class AppError extends Error {
    statusCode;
    code;
    fields;
    constructor(statusCode, code, message, fields) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.fields = fields;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export async function assertOwnership(ModelClass, resourceId, userId, bypassForRoles, userRole) {
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
