import bcrypt from 'bcryptjs';
import { User } from '../users/user.model.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { AppError } from '../../utils/ownershipCheck.js';
import { logger } from '../../utils/logger.js';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 minutes
export class AuthService {
    static async register(data) {
        const existing = await User.findOne({ email: data.email.toLowerCase() });
        if (existing) {
            throw new AppError(409, 'CONFLICT', 'User with this email already exists');
        }
        const passwordHash = await bcrypt.hash(data.password, 12);
        const user = new User({
            name: data.name,
            email: data.email.toLowerCase(),
            passwordHash,
            role: data.role || 'project_officer',
            ministry: data.ministry || 'Ministry of Infrastructure & Transport',
        });
        const payload = {
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            ministry: user.ministry,
        };
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        user.refreshTokens.push({
            tokenHash: refreshTokenHash,
            expiresAt,
            createdAt: new Date(),
        });
        await user.save();
        return {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                ministry: user.ministry,
            },
            accessToken,
            refreshToken,
        };
    }
    static async login(email, passwordPlain) {
        const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
        if (!user) {
            // Generic error message to prevent account enumeration
            throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
        }
        if (user.isLocked()) {
            const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
            throw new AppError(429, 'RATE_LIMIT_EXCEEDED', `Account locked due to too many failed attempts. Try again in ${remainingMinutes} minute(s).`);
        }
        const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
        if (!isMatch) {
            user.failedLoginAttempts += 1;
            if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
                user.lockUntil = new Date(Date.now() + LOCKOUT_TIME_MS);
                logger.warn(`Account locked for user ${user.email} after ${user.failedLoginAttempts} failed attempts`);
            }
            await user.save();
            throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
        }
        // Reset failed attempts upon successful authentication
        user.failedLoginAttempts = 0;
        user.lockUntil = undefined;
        const payload = {
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            ministry: user.ministry,
        };
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        // Clean up expired refresh tokens
        user.refreshTokens = user.refreshTokens.filter((rt) => rt.expiresAt > new Date());
        user.refreshTokens.push({
            tokenHash: refreshTokenHash,
            expiresAt,
            createdAt: new Date(),
        });
        await user.save();
        return {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                ministry: user.ministry,
            },
            accessToken,
            refreshToken,
        };
    }
    static async refresh(rawRefreshToken) {
        let payload;
        try {
            payload = verifyRefreshToken(rawRefreshToken);
        }
        catch {
            throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Invalid or expired refresh token');
        }
        const user = await User.findById(payload.userId);
        if (!user || user.isDeleted) {
            throw new AppError(401, 'UNAUTHORIZED', 'User not found');
        }
        // Match refresh token hash in DB
        let tokenIndex = -1;
        for (let i = 0; i < user.refreshTokens.length; i++) {
            const match = await bcrypt.compare(rawRefreshToken, user.refreshTokens[i].tokenHash);
            if (match) {
                tokenIndex = i;
                break;
            }
        }
        if (tokenIndex === -1) {
            // Breach Signal: Token reuse detected! Revoke all tokens for this user
            user.refreshTokens = [];
            await user.save();
            logger.error(`BREACH DETECTED: Refresh token reuse detected for user ${user.email}. All sessions revoked.`);
            throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token reused or invalidated. Please log in again.');
        }
        // Rotate: Remove old token and issue new pair
        user.refreshTokens.splice(tokenIndex, 1);
        const newPayload = {
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            ministry: user.ministry,
        };
        const newAccessToken = signAccessToken(newPayload);
        const newRefreshToken = signRefreshToken(newPayload);
        const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        user.refreshTokens.push({
            tokenHash: newRefreshTokenHash,
            expiresAt,
            createdAt: new Date(),
        });
        await user.save();
        return {
            accessToken: newAccessToken,
            newRefreshToken,
        };
    }
    static async logout(userId, rawRefreshToken) {
        const user = await User.findById(userId);
        if (!user)
            return;
        if (rawRefreshToken) {
            for (let i = 0; i < user.refreshTokens.length; i++) {
                const match = await bcrypt.compare(rawRefreshToken, user.refreshTokens[i].tokenHash);
                if (match) {
                    user.refreshTokens.splice(i, 1);
                    break;
                }
            }
        }
        else {
            user.refreshTokens = [];
        }
        await user.save();
    }
}
