export type ServiceConfig = {
  binDir: string;
  dashboardHost: string;
  dashboardPort: number;
  dbPath: string;
  timeZone: string;
};

export type LogLevel = 'info' | 'warn' | 'error';

export type LogContext = {
  runId?: number;
  taskId?: string;
};

export type Logger = {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  withContext(context: LogContext): Logger;
};

export type TaskSchedule =
  | {
      type: 'interval';
      everyMs: number;
    }
  | {
      type: 'daily';
      hour: number;
      minute: number;
    };

export type TaskContext = {
  dryRun: boolean;
  logger: Logger;
};

export type ServiceTask = {
  id: string;
  schedule: TaskSchedule;
  description: string;
  run(context: TaskContext): Promise<void>;
};

export type TaskTrigger = 'manual' | 'scheduled';

export type TaskRunStatus = 'running' | 'success' | 'failed' | 'skipped';

export type TaskRun = {
  id: number;
  taskId: string;
  trigger: TaskTrigger;
  dryRun: boolean;
  status: TaskRunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
};

export type LogEntry = {
  id: number;
  createdAt: string;
  level: LogLevel;
  message: string;
  taskId: string | null;
  runId: number | null;
};

export type LogSinkEntry = {
  createdAt: string;
  level: LogLevel;
  message: string;
  context: LogContext;
};

export type RunStore = {
  startRun(taskId: string, trigger: TaskTrigger, dryRun: boolean): number;
  finishRun(runId: number, status: Exclude<TaskRunStatus, 'running'>, error?: string): void;
  log(entry: LogSinkEntry): void;
  listRuns(limit: number, taskId?: string): TaskRun[];
  listLogs(limit: number, runId?: number): LogEntry[];
  close(): void;
};
