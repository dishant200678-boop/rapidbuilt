import { ZodError } from 'zod';
import { AppError } from '../utils/ownershipCheck.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
export function errorHandler(err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    // 1. Handled AppError
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...(err.fields ? { fields: err.fields } : {}),
            },
        });
        return;
    }
    // 2. Zod Validation Error
    if (err instanceof ZodError) {
        const fields = {};
        for (const issue of err.issues) {
            const path = issue.path.join('.') || 'general';
            if (!fields[path])
                fields[path] = [];
            fields[path].push(issue.message);
        }
        res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                fields,
            },
        });
        return;
    }
    // 3. JWT Errors
    if (err.name === 'TokenExpiredError') {
        res.status(401).json({
            success: false,
            error: {
                code: 'TOKEN_EXPIRED',
                message: 'Access token expired',
            },
        });
        return;
    }
    if (err.name === 'JsonWebTokenError') {
        res.status(401).json({
            success: false,
            error: {
                code: 'TOKEN_INVALID',
                message: 'Invalid access token',
            },
        });
        return;
    }
    // 4. Mongoose Duplicate Key Error (E11000)
    if (err.code === 11000) {
        const key = Object.keys(err.keyValue || {})[0] || 'field';
        res.status(409).json({
            success: false,
            error: {
                code: 'CONFLICT',
                message: `Resource with this ${key} already exists`,
            },
        });
        return;
    }
    // 5. Mongoose Validation Error
    if (err.name === 'ValidationError' && err.errors) {
        const fields = {};
        for (const [key, val] of Object.entries(err.errors)) {
            fields[key] = [val.message];
        }
        res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Database validation failed',
                fields,
            },
        });
        return;
    }
    // 6. JSON Syntax Error (body-parser)
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_REQUEST',
                message: 'Malformed JSON payload in request body',
            },
        });
        return;
    }
    // 7. Unhandled Server Error (500)
    logger.error('Unhandled Server Error:', {
        message: err.message,
        stack: env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.originalUrl,
        method: req.method,
    });
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal server error occurred',
        },
    });
}
