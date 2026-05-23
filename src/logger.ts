import type { Logger } from './types.js';

export function createLogger(): Logger {
  return {
    info: (message) => write('INFO ', message),
    warn: (message) => write('WARN ', message),
    error: (message) => write('ERROR', message)
  };
}

function write(level: string, message: string): void {
  const line = `${new Date().toISOString()} ${level} ${message}`;

  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN ') {
    console.warn(line);
  } else {
    console.log(line);
  }
}
