import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ServiceConfig } from './types.js';

const DEFAULTS = {
  binDir: '/home/dune/.dune/bin',
  dashboardHost: '127.0.0.1',
  dashboardPort: 8787,
  timeZone: 'Europe/Amsterdam'
} as const;

export function loadConfig(): ServiceConfig {
  loadDotEnv(resolve(process.cwd(), '.env'));

  return {
    binDir: process.env.DUNE_BIN_DIR || DEFAULTS.binDir,
    dashboardHost: process.env.DUNE_DASHBOARD_HOST || DEFAULTS.dashboardHost,
    dashboardPort: parsePort(process.env.DUNE_DASHBOARD_PORT, DEFAULTS.dashboardPort),
    dbPath:
      process.env.DUNE_SERVICE_DB_PATH ||
      (process.platform === 'win32'
        ? resolve(process.cwd(), '.data', 'server-management-service.sqlite')
        : '/home/dune/.dune/state/server-management-service.sqlite'),
    timeZone: process.env.DUNE_SERVICE_TIME_ZONE || DEFAULTS.timeZone
  };
}

export function validateConfig(config: ServiceConfig): void {
  if (process.platform === 'win32') {
    throw new Error('Live mode must run on the Linux Dune server, not from Windows.');
  }

  if (!existsSync(config.binDir)) {
    throw new Error(`DUNE_BIN_DIR does not exist: ${config.binDir}`);
  }
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid DUNE_DASHBOARD_PORT: ${value}`);
  }

  return port;
}

function loadDotEnv(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const entry = parseEnvLine(line);

    if (entry && !process.env[entry.key]) {
      process.env[entry.key] = entry.value;
    }
  }
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');

  if (equalsIndex <= 0) {
    return null;
  }

  return {
    key: trimmed.slice(0, equalsIndex).trim(),
    value: unquote(trimmed.slice(equalsIndex + 1).trim())
  };
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
