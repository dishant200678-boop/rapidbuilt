import { UserService } from './user.service.js';
export class UserController {
    static async getMe(req, res) {
        const user = await UserService.getProfile(req.user.userId);
        res.status(200).json({
            success: true,
            data: user,
        });
    }
    static async exportMe(req, res) {
        const exportData = await UserService.exportData(req.user.userId);
        res.status(200).json({
            success: true,
            data: exportData,
        });
    }
    static async deleteMe(req, res) {
        const { confirmationText } = req.body;
        await UserService.deleteAccount(req.user.userId, confirmationText);
        res.status(200).json({
            success: true,
            data: {
                message: 'Account successfully deactivated',
            },
        });
    }
    static async listUsers(req, res) {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const { users, total } = await UserService.listUsers(page, limit);
        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
}
