import { User } from './user.model.js';
import { AppError } from '../../utils/ownershipCheck.js';
import { Project } from '../projects/project.model.js';
export class UserService {
    static async getProfile(userId) {
        const user = await User.findById(userId).select('-passwordHash -refreshTokens');
        if (!user || user.isDeleted) {
            throw new AppError(404, 'NOT_FOUND', 'User not found');
        }
        return user;
    }
    static async exportData(userId) {
        const user = await User.findById(userId).select('-passwordHash -refreshTokens');
        if (!user || user.isDeleted) {
            throw new AppError(404, 'NOT_FOUND', 'User not found');
        }
        const projects = await Project.find({ createdBy: userId, isDeleted: false });
        return {
            exportedAt: new Date().toISOString(),
            user,
            createdProjectsCount: projects.length,
            projects,
        };
    }
    static async deleteAccount(userId, confirmationText) {
        if (confirmationText !== 'CONFIRM_DELETE_MY_ACCOUNT') {
            throw new AppError(400, 'CONFIRM_TEXT_MISMATCH', 'Confirmation text must match "CONFIRM_DELETE_MY_ACCOUNT"');
        }
        const user = await User.findById(userId);
        if (!user || user.isDeleted) {
            throw new AppError(404, 'NOT_FOUND', 'User not found');
        }
        user.isDeleted = true;
        user.deletedAt = new Date();
        user.refreshTokens = [];
        await user.save();
    }
    static async listUsers(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            User.find({ isDeleted: false })
                .select('-passwordHash -refreshTokens')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments({ isDeleted: false }),
        ]);
        return { users, total };
    }
}
