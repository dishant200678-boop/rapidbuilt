import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

let io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGINS.split(','),
      credentials: true,
    },
  });

  // JWT Connection Auth Guard
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      logger.warn('Socket connection rejected: No auth token provided');
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const payload = verifyAccessToken(token);
      (socket as any).user = payload;
      next();
    } catch (err) {
      logger.warn('Socket connection rejected: Invalid JWT');
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    logger.info(`Socket connected: ${socket.id} (User: ${user.email}, Role: ${user.role})`);

    // Join general alerts room
    socket.join('project-alerts');

    // If ministry is present, join ministry-specific room
    if (user.ministry) {
      socket.join(`ministry:${user.ministry}`);
    }

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function broadcastEarlyWarning(alertData: any): void {
  if (!io) return;
  io.to('project-alerts').emit('early-warning:created', alertData);
  if (alertData.ministry) {
    io.to(`ministry:${alertData.ministry}`).emit('early-warning:ministry', alertData);
  }
}
