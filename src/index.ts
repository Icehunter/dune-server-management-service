import { loadConfig, validateConfig } from './config.js';
import { createLogger } from './logger.js';
import { Scheduler } from './scheduler.js';
import { createTasks } from './tasks.js';

const args = parseArgs(process.argv.slice(2));
const config = loadConfig();
const logger = createLogger();
const tasks = createTasks(config);
const dryRun = !args.has('run');

if (args.has('help')) {
  printHelp();
  process.exit(0);
}

if (args.has('list')) {
  printTasks();
  process.exit(0);
}

if (!dryRun) {
  validateConfig(config);
}

if (args.has('once')) {
  const taskId = args.get('once') ?? '';
  const task = tasks.find((candidate) => candidate.id === taskId);

  if (!task) {
    logger.error(`Unknown task: ${taskId}`);
    printTasks();
    process.exit(1);
  }

  await task.run({ dryRun, logger });
  process.exit(0);
}

logger.info(`Starting Dune server management service (${dryRun ? 'dry-run' : 'live'} mode).`);
logger.info(`Timezone: ${config.timeZone}`);
logger.info(`Script directory: ${config.binDir}`);

if (dryRun) {
  logger.info('Pass --run to execute local server commands.');
}

const scheduler = new Scheduler({ logger, timeZone: config.timeZone });
scheduler.add(tasks);
scheduler.start({ dryRun });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info('Stopping service.');
    scheduler.stop();
    process.exit(0);
  });
}

function parseArgs(argv: string[]): Map<string, string | true> {
  const parsed = new Map<string, string | true>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith('--')) {
      continue;
    }

    const name = arg.slice(2);

    if (name === 'once') {
      parsed.set(name, argv[index + 1] ?? '');
      index += 1;
    } else {
      parsed.set(name, true);
    }
  }

  return parsed;
}

function printHelp(): void {
  console.log(`
Dune server management service

Usage:
  node dist/index.js --list
  node dist/index.js --once backup
  node dist/index.js --once backup --run
  node dist/index.js --dry-run
  node dist/index.js --run

The service is dry-run by default. Use --run for live remote execution.
`);
}

function printTasks(): void {
  console.log(`Timezone: ${config.timeZone}`);
  console.log('');

  for (const task of tasks) {
    const schedule =
      task.schedule.type === 'interval'
        ? `every ${task.schedule.everyMs / 1000}s`
        : `daily ${formatClock(task.schedule.hour, task.schedule.minute)}`;

    console.log(`${task.id}: ${schedule} - ${task.description}`);
  }
}

function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
