import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
export async function connectDB() {
    try {
        mongoose.set('strictQuery', true);
        await mongoose.connect(env.MONGODB_URI);
        logger.info('MongoDB Connected successfully');
    }
    catch (error) {
        logger.error('Failed to connect to MongoDB:', error);
        // In dev, log error without immediately killing process to allow mock/diagnostics if DB is booting
        if (env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
    mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection runtime error:', err);
    });
    mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
    });
    process.on('SIGINT', async () => {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed due to app termination');
        process.exit(0);
    });
}
export async function disconnectDB() {
    await mongoose.connection.close();
}
