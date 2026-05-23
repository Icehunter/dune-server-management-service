import type { Logger, RunStore, ServiceTask, TaskTrigger } from './types.js';

export class TaskRunner {
  readonly #logger: Logger;
  readonly #runStore: RunStore;
  readonly #runningTaskIds = new Set<string>();

  constructor({ logger, runStore }: { logger: Logger; runStore: RunStore }) {
    this.#logger = logger;
    this.#runStore = runStore;
  }

  async run(task: ServiceTask, options: { dryRun: boolean; trigger: TaskTrigger }): Promise<void> {
    if (this.#runningTaskIds.has(task.id)) {
      const runId = this.#runStore.startRun(task.id, options.trigger, options.dryRun);
      const logger = this.#logger.withContext({ runId, taskId: task.id });

      logger.warn(`${task.id} is still running; skipping overlapping run.`);
      this.#runStore.finishRun(runId, 'skipped', 'overlap');
      return;
    }

    const runId = this.#runStore.startRun(task.id, options.trigger, options.dryRun);
    const logger = this.#logger.withContext({ runId, taskId: task.id });

    this.#runningTaskIds.add(task.id);

    try {
      logger.info(`Starting task ${task.id}.`);
      await task.run({ dryRun: options.dryRun, logger });
      logger.info(`Finished task ${task.id}.`);
      this.#runStore.finishRun(runId, 'success');
    } catch (error) {
      const message = errorMessage(error);

      logger.error(`${task.id} failed: ${message}`);
      this.#runStore.finishRun(runId, 'failed', message);
    } finally {
      this.#runningTaskIds.delete(task.id);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

