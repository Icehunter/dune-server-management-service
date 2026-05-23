import { TaskRunner } from './task-runner.js';
import type { Logger, ServiceTask, TaskSchedule } from './types.js';

export class Scheduler {
  readonly #logger: Logger;
  readonly #runner: TaskRunner;
  readonly #timeZone: string;
  readonly #tasks: ServiceTask[] = [];
  #timers: NodeJS.Timeout[] = [];

  constructor({
    logger,
    runner,
    timeZone
  }: {
    logger: Logger;
    runner: TaskRunner;
    timeZone: string;
  }) {
    this.#logger = logger;
    this.#runner = runner;
    this.#timeZone = timeZone;
  }

  add(tasks: ServiceTask[]): void {
    this.#tasks.push(...tasks);
  }

  start({ dryRun }: { dryRun: boolean }): void {
    for (const task of this.#tasks) {
      this.#scheduleTask(task, dryRun);
    }
  }

  stop(): void {
    for (const timer of this.#timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }

    this.#timers = [];
  }

  #scheduleTask(task: ServiceTask, dryRun: boolean): void {
    if (task.schedule.type === 'interval') {
      this.#scheduleIntervalTask(task, task.schedule, dryRun);
      return;
    }

    this.#scheduleDailyTask(task, task.schedule, dryRun);
  }

  #scheduleIntervalTask(
    task: ServiceTask,
    schedule: Extract<TaskSchedule, { type: 'interval' }>,
    dryRun: boolean
  ): void {
    this.#logger.info(`Scheduled ${task.id} every ${schedule.everyMs / 1000}s.`);

    this.#timers.push(
      setInterval(() => {
        void this.#runner.run(task, { dryRun, trigger: 'scheduled' });
      }, schedule.everyMs)
    );
  }

  #scheduleDailyTask(
    task: ServiceTask,
    schedule: Extract<TaskSchedule, { type: 'daily' }>,
    dryRun: boolean
  ): void {
    const scheduleNext = (): void => {
      const nextRun = nextWallClockDate({
        now: new Date(),
        timeZone: this.#timeZone,
        hour: schedule.hour,
        minute: schedule.minute
      });

      this.#logger.info(`Scheduled ${task.id} for ${nextRun.toISOString()} (${this.#timeZone}).`);

      this.#timers.push(
        setTimeout(() => {
          void this.#runner.run(task, { dryRun, trigger: 'scheduled' }).finally(scheduleNext);
        }, Math.max(0, nextRun.getTime() - Date.now()))
      );
    };

    scheduleNext();
  }
}

export function nextWallClockDate({
  now,
  timeZone,
  hour,
  minute
}: {
  now: Date;
  timeZone: string;
  hour: number;
  minute: number;
}): Date {
  const current = getTimeZoneParts(now, timeZone);
  let target: WallClockParts = {
    year: current.year,
    month: current.month,
    day: current.day,
    hour,
    minute,
    second: 0
  };

  if (wallClockToMs(target) <= wallClockToMs(current)) {
    target = addWallDays(target, 1);
  }

  return zonedWallTimeToUtc(target, timeZone);
}

type WallClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getTimeZoneParts(date: Date, timeZone: string): WallClockParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour === '24' ? '0' : values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

function wallClockToMs(parts: WallClockParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function addWallDays(target: WallClockParts, days: number): WallClockParts {
  const date = new Date(Date.UTC(target.year, target.month - 1, target.day + days));

  return {
    ...target,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function zonedWallTimeToUtc(target: WallClockParts, timeZone: string): Date {
  const desiredWallMs = wallClockToMs(target);
  let utcMs = desiredWallMs;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    utcMs += desiredWallMs - wallClockToMs(getTimeZoneParts(new Date(utcMs), timeZone));
  }

  return new Date(utcMs);
}
