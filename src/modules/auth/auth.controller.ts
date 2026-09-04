import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { env } from '../../config/env.js';

const REFRESH_COOKIE_NAME = 'rapidbuilt_refresh';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    const { user, accessToken, refreshToken } = await AuthService.register(req.body);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
      },
    });
  }

  static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await AuthService.login(email, password);
    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      data: {
        user,
        accessToken,
      },
    });
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (!rawRefreshToken) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Refresh token cookie missing',
        },
      });
      return;
    }

    const { accessToken, newRefreshToken } = await AuthService.refresh(rawRefreshToken);
    setRefreshCookie(res, newRefreshToken);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
      },
    });
  }

  static async logout(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (req.user) {
      await AuthService.logout(req.user.userId, rawRefreshToken);
    }
    clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    });
  }
}
