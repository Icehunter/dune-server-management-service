import { spawn } from 'node:child_process';

import type { Logger, TaskOutcome } from './types.js';

const NOOP_EXIT_CODE = 75;

export function runLocalScript(
  scriptPath: string,
  context: { dryRun: boolean; logger: Logger }
): Promise<TaskOutcome> {
  if (context.dryRun) {
    context.logger.info(`[dry-run] ${scriptPath}`);
    return Promise.resolve('completed');
  }

  context.logger.info(`Running local script: ${scriptPath}`);
  return spawnLogged(scriptPath, [], context.logger);
}

function spawnLogged(command: string, args: string[], logger: Logger): Promise<TaskOutcome> {
  return new Promise((resolve, reject) => {
    let child;

    try {
      child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (error) {
      reject(error);
      return;
    }

    child.stdout.on('data', (chunk: Buffer) => logLines(logger.info, chunk));
    child.stderr.on('data', (chunk: Buffer) => logLines(logger.warn, chunk));
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve('completed');
      } else if (code === NOOP_EXIT_CODE) {
        resolve('noop');
      } else {
        reject(new Error(`${command} exited with code ${code ?? 'null'} signal ${signal ?? 'null'}`));
      }
    });
  });
}

function logLines(write: (message: string) => void, chunk: Buffer): void {
  for (const line of chunk.toString('utf8').trimEnd().split(/\r?\n/)) {
    if (line) {
      write(`[script] ${line}`);
    }
  }
}
