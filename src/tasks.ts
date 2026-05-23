import { posix } from 'node:path';

import { runLocalScript } from './process-runner.js';
import type { ServiceConfig, ServiceTask, TaskSchedule } from './types.js';

const SCRIPT_NAMES = {
  backup: 'cron-battlegroup-backup',
  updateCheck: 'cron-battlegroup-update-check',
  updateApply: 'apply-pending-battlegroup-update',
  restartNotice: 'daily-battlegroup-restart-notice',
  restart: 'daily-battlegroup-restart'
} as const;

const TASK_DEFINITIONS = [
  {
    id: 'backup',
    schedule: everyHours(2),
    description: 'Run vendor database backup and cleanup wrapper.',
    scriptName: SCRIPT_NAMES.backup
  },
  {
    id: 'update-check',
    schedule: everyMinutes(15),
    description: 'Check Steam for updates and schedule a pending apply if found.',
    scriptName: SCRIPT_NAMES.updateCheck
  },
  {
    id: 'update-apply',
    schedule: everyMinutes(1),
    description: 'Apply a pending scheduled update when its due time arrives.',
    scriptName: SCRIPT_NAMES.updateApply
  },
  {
    id: 'restart-notice',
    schedule: dailyAt(4, 30),
    description: 'Send daily restart warning broadcast.',
    scriptName: SCRIPT_NAMES.restartNotice
  },
  {
    id: 'restart',
    schedule: dailyAt(5, 0),
    description: 'Stop and start the battlegroup for the daily restart.',
    scriptName: SCRIPT_NAMES.restart
  }
] as const;

export function createTasks(config: ServiceConfig): ServiceTask[] {
  return TASK_DEFINITIONS.map((definition) => ({
    id: definition.id,
    schedule: definition.schedule,
    description: definition.description,
    run: (context) => runLocalScript(posix.join(config.binDir, definition.scriptName), context)
  }));
}

function everyMinutes(value: number): TaskSchedule {
  return { type: 'interval', everyMs: value * 60 * 1000 };
}

function everyHours(value: number): TaskSchedule {
  return everyMinutes(value * 60);
}

function dailyAt(hour: number, minute: number): TaskSchedule {
  return { type: 'daily', hour, minute };
}
