import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/ownershipCheck.js';

export function roleGuard(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
    }

    next();
  };
}
