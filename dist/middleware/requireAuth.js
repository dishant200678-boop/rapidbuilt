import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../utils/ownershipCheck.js';
export function requireAuth(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError(401, 'UNAUTHORIZED', 'Access token is required');
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = verifyAccessToken(token);
        req.user = payload;
        next();
    }
    catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new AppError(401, 'TOKEN_EXPIRED', 'Access token has expired');
        }
        throw new AppError(401, 'TOKEN_INVALID', 'Invalid or tampered access token');
    }
}
