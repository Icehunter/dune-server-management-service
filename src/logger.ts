import type { LogContext, LogLevel, LogSinkEntry, Logger } from './types.js';

export function createLogger(sink?: (entry: LogSinkEntry) => void): Logger {
  return createContextLogger({}, sink);
}

function createContextLogger(context: LogContext, sink?: (entry: LogSinkEntry) => void): Logger {
  return {
    info: (message) => write('info', message, context, sink),
    warn: (message) => write('warn', message, context, sink),
    error: (message) => write('error', message, context, sink),
    withContext: (nextContext) => createContextLogger({ ...context, ...nextContext }, sink)
  };
}

function write(
  level: LogLevel,
  message: string,
  context: LogContext,
  sink?: (entry: LogSinkEntry) => void
): void {
  const createdAt = new Date().toISOString();
  const label = level.toUpperCase().padEnd(5, ' ');
  const line = `${createdAt} ${label} ${message}`;

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  sink?.({ createdAt, level, message, context });
}
