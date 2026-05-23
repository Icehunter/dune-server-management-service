import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type {
  LogEntry,
  LogSinkEntry,
  RunStore,
  TaskRun,
  TaskRunStatus,
  TaskTrigger
} from './types.js';

type RunRow = {
  id: number;
  task_id: string;
  trigger: TaskTrigger;
  dry_run: 0 | 1;
  status: TaskRunStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
};

type LogRow = {
  id: number;
  created_at: string;
  level: LogEntry['level'];
  message: string;
  task_id: string | null;
  run_id: number | null;
};

type LastInsertRow = {
  id: number;
};

export function createRunStore(path: string): RunStore {
  mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS task_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      trigger TEXT NOT NULL,
      dry_run INTEGER NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      duration_ms INTEGER,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS log_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      task_id TEXT,
      run_id INTEGER,
      FOREIGN KEY (run_id) REFERENCES task_runs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_task_runs_started_at ON task_runs(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_task_runs_task_id ON task_runs(task_id);
    CREATE INDEX IF NOT EXISTS idx_log_entries_created_at ON log_entries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_log_entries_run_id ON log_entries(run_id);
  `);

  return {
    startRun(taskId, trigger, dryRun) {
      const startedAt = new Date().toISOString();
      db.prepare(
        `INSERT INTO task_runs (task_id, trigger, dry_run, status, started_at)
         VALUES (?, ?, ?, 'running', ?)`
      ).run(taskId, trigger, dryRun ? 1 : 0, startedAt);

      return Number((db.prepare('SELECT last_insert_rowid() AS id').get() as LastInsertRow).id);
    },

    finishRun(runId, status, error) {
      const finishedAt = new Date().toISOString();
      db.prepare(
        `UPDATE task_runs
         SET status = ?,
             finished_at = ?,
             duration_ms = CAST((julianday(?) - julianday(started_at)) * 86400000 AS INTEGER),
             error = ?
         WHERE id = ?`
      ).run(status, finishedAt, finishedAt, error ?? null, runId);
    },

    log(entry) {
      db.prepare(
        `INSERT INTO log_entries (created_at, level, message, task_id, run_id)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        entry.createdAt,
        entry.level,
        entry.message,
        entry.context.taskId ?? null,
        entry.context.runId ?? null
      );
    },

    listRuns(limit, taskId) {
      const rows = taskId
        ? db
            .prepare('SELECT * FROM task_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT ?')
            .all(taskId, limit)
        : db.prepare('SELECT * FROM task_runs ORDER BY started_at DESC LIMIT ?').all(limit);

      return (rows as RunRow[]).map(mapRun);
    },

    listLogs(limit, runId) {
      const rows =
        runId === undefined
          ? db.prepare('SELECT * FROM log_entries ORDER BY created_at DESC LIMIT ?').all(limit)
          : db
              .prepare('SELECT * FROM log_entries WHERE run_id = ? ORDER BY created_at ASC LIMIT ?')
              .all(runId, limit);

      return (rows as LogRow[]).map(mapLog);
    },

    close() {
      db.close();
    }
  };
}

function mapRun(row: RunRow): TaskRun {
  return {
    id: row.id,
    taskId: row.task_id,
    trigger: row.trigger,
    dryRun: row.dry_run === 1,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    error: row.error
  };
}

function mapLog(row: LogRow): LogEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    level: row.level,
    message: row.message,
    taskId: row.task_id,
    runId: row.run_id
  };
}
