type LogLevel = "info" | "warn" | "error";
class Logger {
  private logWithLevel(level: LogLevel, message: string, args?: any) {
    // eslint-disable-next-line no-console
    console[level](`[${level.toUpperCase()}] ${message} ${args ? args : ""}`);
  }

  info(message: string, args?: any) {
    this.logWithLevel("info", message, args);
  }

  warn(message: string, args?: any) {
    this.logWithLevel("warn", message, args);
  }

  error(message: string, args?: any) {
    this.logWithLevel("error", message, args);
  }
}

export const logger = new Logger();
