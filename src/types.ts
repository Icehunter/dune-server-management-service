export type ServiceConfig = {
  binDir: string;
  timeZone: string;
};

export type Logger = {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
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
