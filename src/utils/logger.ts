import winston from 'winston';
import { env } from '../config/env.js';

// Custom format to redact sensitive fields
const redactSensitiveData = winston.format((info) => {
  const sensitiveKeys = ['password', 'token', 'accessToken', 'refreshToken', 'secret', 'authorization', 'apiKey', 'key'];

  const redact = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(redact);

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        cleaned[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        cleaned[key] = redact(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  };

  return redact(info);
});

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    redactSensitiveData(),
    winston.format.json()
  ),
  defaultMeta: { service: 'rapidbuilt-backend' },
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'production'
          ? winston.format.combine(winston.format.timestamp(), redactSensitiveData(), winston.format.json())
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length && meta.service !== 'rapidbuilt-backend' ? ` ${JSON.stringify(meta)}` : '';
                return `[${timestamp}] ${level}: ${message}${metaStr}`;
              })
            ),
    }),
  ],
});
