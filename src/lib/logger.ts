type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  userId?: string;
  requestId?: string;
  apiRoute?: string;
  duration?: number;
  [key: string]: any;
}

class Logger {
  private static formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  static info(message: string, context?: LogContext) {
    console.log(this.formatMessage('info', message, context));
  }

  static warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('warn', message, context));
  }

  static error(message: string, context?: LogContext) {
    console.error(this.formatMessage('error', message, context));
  }

  static debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  static apiStart(route: string, data?: any) {
    this.info(`API Request Started`, {
      apiRoute: route,
      requestData: data,
      timestamp: Date.now(),
    });
  }

  static apiSuccess(route: string, duration: number, responseData?: any) {
    this.info(`API Request Completed`, {
      apiRoute: route,
      duration: duration,
      durationMs: `${duration}ms`,
      responseData: responseData ? JSON.stringify(responseData).substring(0, 200) + '...' : undefined,
    });
  }

  static apiError(route: string, duration: number, error: any) {
    this.error(`API Request Failed`, {
      apiRoute: route,
      duration: duration,
      durationMs: `${duration}ms`,
      error: error.message || error,
      stack: error.stack,
    });
  }

  static step(step: string, details?: any) {
    this.debug(`Processing Step: ${step}`, details);
  }
}

export { Logger }; 