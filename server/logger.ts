export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  requestId?: string;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m'
};

const RESET_COLOR = '\x1b[0m';

class Logger {
  private minLevel: LogLevel;
  private requestIdGenerator: () => string;

  constructor() {
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.requestIdGenerator = () => Math.random().toString(36).substring(2, 10);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatLogEntry(entry: LogEntry): string {
    const color = LOG_LEVEL_COLORS[entry.level];
    const levelStr = entry.level.toUpperCase().padEnd(5);
    
    let output = `${entry.timestamp} ${color}[${levelStr}]${RESET_COLOR} ${entry.message}`;
    
    if (entry.requestId) {
      output = `${entry.timestamp} ${color}[${levelStr}]${RESET_COLOR} [${entry.requestId}] ${entry.message}`;
    }
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ` ${JSON.stringify(entry.context)}`;
    }
    
    return output;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, requestId?: string): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      context,
      requestId
    };

    const formattedLog = this.formatLogEntry(entry);

    switch (level) {
      case 'error':
        console.error(formattedLog);
        break;
      case 'warn':
        console.warn(formattedLog);
        break;
      default:
        console.log(formattedLog);
    }
  }

  debug(message: string, context?: Record<string, any>, requestId?: string): void {
    this.log('debug', message, context, requestId);
  }

  info(message: string, context?: Record<string, any>, requestId?: string): void {
    this.log('info', message, context, requestId);
  }

  warn(message: string, context?: Record<string, any>, requestId?: string): void {
    this.log('warn', message, context, requestId);
  }

  error(message: string, context?: Record<string, any>, requestId?: string): void {
    this.log('error', message, context, requestId);
  }

  generateRequestId(): string {
    return this.requestIdGenerator();
  }

  request(method: string, path: string, requestId: string, context?: Record<string, any>): void {
    this.info(`${method} ${path}`, context, requestId);
  }

  response(method: string, path: string, statusCode: number, durationMs: number, requestId: string): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${path} ${statusCode} ${durationMs}ms`, undefined, requestId);
  }

  analysis(action: string, details: Record<string, any>): void {
    this.info(`[PAR2] ${action}`, details);
  }

  validation(type: 'pass' | 'fail' | 'warn', message: string, details?: Record<string, any>): void {
    const level: LogLevel = type === 'fail' ? 'error' : type === 'warn' ? 'warn' : 'info';
    this.log(level, `[VALIDATION] ${message}`, details);
  }

  database(action: string, details?: Record<string, any>): void {
    this.debug(`[DB] ${action}`, details);
  }
}

export const logger = new Logger();

export function requestLogger() {
  return (req: any, res: any, next: any) => {
    const requestId = logger.generateRequestId();
    const startTime = Date.now();
    
    req.requestId = requestId;
    
    const originalPath = req.path;
    const method = req.method;
    
    logger.request(method, originalPath, requestId, {
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      ip: req.ip
    });
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.response(method, originalPath, res.statusCode, duration, requestId);
    });
    
    next();
  };
}
