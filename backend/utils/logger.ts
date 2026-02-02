/**
 * Production-ready logging utility
 * Provides structured logging with different levels and contexts
 */

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

export interface LogContext {
    component?: string;
    operation?: string;
    server?: string;
    tool?: string;
    userId?: string;
    requestId?: string;
    duration?: number;
    [key: string]: any;
}

class Logger {
    private logLevel: LogLevel;
    private enableConsole: boolean;
    private enableFile: boolean;
    private logs: any[] = [];

    constructor() {
        this.logLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'INFO');
        this.enableConsole = process.env.LOG_CONSOLE !== 'false';
        this.enableFile = process.env.LOG_FILE === 'true';
    }

    private parseLogLevel(level: string): LogLevel {
        const upperLevel = level.toUpperCase();
        return LogLevel[upperLevel as keyof typeof LogLevel] || LogLevel.INFO;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }

    private formatLog(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${level}] ${message}${contextStr}`;
    }

    private writeLog(level: LogLevel, message: string, context?: LogContext, error?: Error) {
        if (!this.shouldLog(level)) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        };

        // Store in memory for retrieval
        this.logs.push(logEntry);
        if (this.logs.length > 1000) {
            this.logs.shift(); // Keep only last 1000 logs
        }

        // Console output with colors
        if (this.enableConsole) {
            const formatted = this.formatLog(level, message, context);
            switch (level) {
                case LogLevel.DEBUG:
                    console.debug('\x1b[36m%s\x1b[0m', formatted); // Cyan
                    break;
                case LogLevel.INFO:
                    console.info('\x1b[32m%s\x1b[0m', formatted); // Green
                    break;
                case LogLevel.WARN:
                    console.warn('\x1b[33m%s\x1b[0m', formatted); // Yellow
                    break;
                case LogLevel.ERROR:
                    console.error('\x1b[31m%s\x1b[0m', formatted); // Red
                    if (error?.stack) {
                        console.error('\x1b[31m%s\x1b[0m', error.stack);
                    }
                    break;
            }
        }

        // File output (if enabled)
        if (this.enableFile) {
            // In production, you would write to a file or send to a logging service
            // For now, we'll just keep in memory
        }
    }

    debug(message: string, context?: LogContext) {
        this.writeLog(LogLevel.DEBUG, message, context);
    }

    info(message: string, context?: LogContext) {
        this.writeLog(LogLevel.INFO, message, context);
    }

    warn(message: string, context?: LogContext) {
        this.writeLog(LogLevel.WARN, message, context);
    }

    error(message: string, context?: LogContext, error?: Error) {
        this.writeLog(LogLevel.ERROR, message, context, error);
    }

    // Get recent logs for debugging
    getRecentLogs(count: number = 100): any[] {
        return this.logs.slice(-count);
    }

    // Clear logs
    clearLogs() {
        this.logs = [];
    }
}

// Singleton instance
export const logger = new Logger();

// Performance monitoring utility
export class PerformanceMonitor {
    private metrics: Map<string, number[]> = new Map();

    startTimer(operation: string): () => number {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            this.recordMetric(operation, duration);
            return duration;
        };
    }

    recordMetric(operation: string, duration: number) {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }
        const metrics = this.metrics.get(operation)!;
        metrics.push(duration);

        // Keep only last 100 measurements
        if (metrics.length > 100) {
            metrics.shift();
        }

        logger.debug(`Performance metric recorded`, {
            operation,
            duration,
            unit: 'ms'
        });
    }

    getStats(operation: string): { avg: number; min: number; max: number; count: number } | null {
        const metrics = this.metrics.get(operation);
        if (!metrics || metrics.length === 0) return null;

        return {
            avg: metrics.reduce((a, b) => a + b, 0) / metrics.length,
            min: Math.min(...metrics),
            max: Math.max(...metrics),
            count: metrics.length
        };
    }

    getAllStats(): Record<string, any> {
        const stats: Record<string, any> = {};
        for (const [operation, _] of this.metrics) {
            stats[operation] = this.getStats(operation);
        }
        return stats;
    }
}

export const perfMonitor = new PerformanceMonitor();
