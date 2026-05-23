import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import type { Logger, RunStore, ServiceConfig } from './types.js';

export function startDashboard({
  config,
  logger,
  runStore
}: {
  config: ServiceConfig;
  logger: Logger;
  runStore: RunStore;
}): { close(): Promise<void> } {
  const server = createServer((request, response) => {
    handleRequest(request, response, runStore);
  });

  server.listen(config.dashboardPort, config.dashboardHost, () => {
    logger.info(`Dashboard listening on http://${config.dashboardHost}:${config.dashboardPort}`);
  });

  return {
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      })
  };
}

function handleRequest(request: IncomingMessage, response: ServerResponse, runStore: RunStore): void {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'method not allowed' });
    return;
  }

  if (url.pathname === '/') {
    sendHtml(response, renderDashboard());
    return;
  }

  if (url.pathname === '/api/runs') {
    sendJson(response, 200, {
      runs: runStore.listRuns(readLimit(url, 100, 500), url.searchParams.get('task') || undefined)
    });
    return;
  }

  if (url.pathname === '/api/logs') {
    const runId = url.searchParams.has('runId') ? Number(url.searchParams.get('runId')) : undefined;
    sendJson(response, 200, {
      logs: runStore.listLogs(readLimit(url, 200, 1000), Number.isFinite(runId) ? runId : undefined)
    });
    return;
  }

  if (url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true, now: new Date().toISOString() });
    return;
  }

  sendJson(response, 404, { error: 'not found' });
}

function readLimit(url: URL, fallback: number, max: number): number {
  const value = Number(url.searchParams.get('limit') ?? fallback);

  if (!Number.isInteger(value) || value < 1) {
    return fallback;
  }

  return Math.min(value, max);
}

function sendHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(html);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

function renderDashboard(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dune Server Operations</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #11110f;
      --panel: #1a1a17;
      --panel-2: #20201c;
      --line: #35352f;
      --text: #efeee6;
      --muted: #a7a397;
      --accent: #d6ad4f;
      --ok: #78b97a;
      --warn: #d8a34a;
      --bad: #d86f60;
      --skip: #9097a3;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: "Segoe UI", "Aptos", sans-serif;
      font-size: 14px;
    }

    .shell {
      max-width: 1440px;
      margin: 0 auto;
      padding: 20px;
    }

    header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 20px;
      padding: 8px 0 18px;
      border-bottom: 1px solid var(--line);
    }

    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 650;
      letter-spacing: 0;
    }

    .meta {
      display: flex;
      gap: 12px;
      color: var(--muted);
      font-family: ui-monospace, "Cascadia Mono", monospace;
      font-size: 12px;
      white-space: nowrap;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin: 16px 0;
    }

    .metric, .table-wrap, .log-wrap {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 6px;
    }

    .metric {
      min-height: 74px;
      padding: 14px;
    }

    .metric .label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
    }

    .metric .value {
      margin-top: 8px;
      font-family: ui-monospace, "Cascadia Mono", monospace;
      font-size: 20px;
      color: var(--accent);
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.65fr);
      gap: 12px;
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
    }

    h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 650;
    }

    button {
      appearance: none;
      border: 1px solid var(--line);
      border-radius: 5px;
      background: var(--panel-2);
      color: var(--text);
      height: 30px;
      padding: 0 10px;
      cursor: pointer;
    }

    button:hover { border-color: var(--accent); }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    th {
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    tbody tr {
      cursor: pointer;
    }

    tbody tr:hover, tbody tr.selected {
      background: #25231e;
    }

    .mono {
      font-family: ui-monospace, "Cascadia Mono", monospace;
      font-size: 12px;
    }

    .muted { color: var(--muted); }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: ui-monospace, "Cascadia Mono", monospace;
      font-size: 12px;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--skip);
    }

    .success .dot { background: var(--ok); }
    .running .dot { background: var(--accent); }
    .failed .dot { background: var(--bad); }
    .skipped .dot { background: var(--skip); }
    .warn { color: var(--warn); }
    .error { color: var(--bad); }

    .log-list {
      height: 620px;
      overflow: auto;
      padding: 10px;
      font-family: ui-monospace, "Cascadia Mono", monospace;
      font-size: 12px;
      line-height: 1.45;
    }

    .log-line {
      display: grid;
      grid-template-columns: 82px 44px minmax(0, 1fr);
      gap: 8px;
      padding: 4px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }

    .message {
      overflow-wrap: anywhere;
    }

    @media (max-width: 920px) {
      .summary, .grid {
        grid-template-columns: 1fr;
      }

      header {
        align-items: start;
        flex-direction: column;
      }

      .meta {
        flex-wrap: wrap;
        white-space: normal;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <h1>Dune Server Operations</h1>
      <div class="meta">
        <span id="health">checking</span>
        <span id="updated">--</span>
      </div>
    </header>

    <section class="summary" id="summary"></section>

    <section class="grid">
      <div class="table-wrap">
        <div class="section-head">
          <h2>Task Runs</h2>
          <button id="refresh">Refresh</button>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 78px;">ID</th>
              <th>Task</th>
              <th style="width: 116px;">Status</th>
              <th style="width: 150px;">Started</th>
              <th style="width: 100px;">Duration</th>
            </tr>
          </thead>
          <tbody id="runs"></tbody>
        </table>
      </div>

      <div class="log-wrap">
        <div class="section-head">
          <h2 id="log-title">Recent Logs</h2>
        </div>
        <div class="log-list" id="logs"></div>
      </div>
    </section>
  </main>

  <script>
    const state = { selectedRunId: null, runs: [] };
    const $ = (id) => document.getElementById(id);

    $('refresh').addEventListener('click', () => load());

    async function load() {
      const [health, runs] = await Promise.all([
        fetchJson('/api/health'),
        fetchJson('/api/runs?limit=100')
      ]);

      state.runs = runs.runs;
      $('health').textContent = health.ok ? 'service healthy' : 'service degraded';
      $('updated').textContent = new Date().toLocaleString();
      renderSummary(state.runs);
      renderRuns(state.runs);
      await loadLogs(state.selectedRunId);
    }

    async function loadLogs(runId) {
      const url = runId ? '/api/logs?runId=' + encodeURIComponent(runId) : '/api/logs?limit=200';
      const data = await fetchJson(url);
      $('log-title').textContent = runId ? 'Run #' + runId + ' Logs' : 'Recent Logs';
      renderLogs(data.logs);
    }

    async function fetchJson(url) {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(url + ' failed');
      return response.json();
    }

    function renderSummary(runs) {
      const total = runs.length;
      const success = runs.filter((run) => run.status === 'success').length;
      const failed = runs.filter((run) => run.status === 'failed').length;
      const running = runs.filter((run) => run.status === 'running').length;
      const last = runs[0]?.startedAt ? shortDate(runs[0].startedAt) : '--';

      $('summary').innerHTML = [
        metric('Runs', total),
        metric('Succeeded', success),
        metric('Failed', failed),
        metric('Running', running || last)
      ].join('');
    }

    function metric(label, value) {
      return '<div class="metric"><div class="label">' + escapeHtml(label) + '</div><div class="value">' + escapeHtml(String(value)) + '</div></div>';
    }

    function renderRuns(runs) {
      $('runs').innerHTML = runs.map((run) => {
        const selected = run.id === state.selectedRunId ? ' selected' : '';
        return '<tr class="' + selected + '" data-run-id="' + run.id + '">' +
          '<td class="mono">#' + run.id + '</td>' +
          '<td><div>' + escapeHtml(run.taskId) + '</div><div class="muted mono">' + escapeHtml(run.trigger) + (run.dryRun ? ' dry-run' : '') + '</div></td>' +
          '<td>' + status(run.status) + '</td>' +
          '<td class="mono">' + shortDate(run.startedAt) + '</td>' +
          '<td class="mono">' + duration(run.durationMs) + '</td>' +
        '</tr>';
      }).join('');

      for (const row of document.querySelectorAll('[data-run-id]')) {
        row.addEventListener('click', async () => {
          state.selectedRunId = Number(row.getAttribute('data-run-id'));
          renderRuns(state.runs);
          await loadLogs(state.selectedRunId);
        });
      }
    }

    function renderLogs(logs) {
      $('logs').innerHTML = logs.map((log) =>
        '<div class="log-line ' + escapeHtml(log.level) + '">' +
          '<span class="muted">' + shortTime(log.createdAt) + '</span>' +
          '<span>' + escapeHtml(log.level.toUpperCase()) + '</span>' +
          '<span class="message">' + escapeHtml(log.message) + '</span>' +
        '</div>'
      ).join('');
    }

    function status(value) {
      return '<span class="status ' + escapeHtml(value) + '"><span class="dot"></span>' + escapeHtml(value) + '</span>';
    }

    function duration(value) {
      if (value === null || value === undefined) return '--';
      if (value < 1000) return value + 'ms';
      return (value / 1000).toFixed(1) + 's';
    }

    function shortDate(value) {
      return new Date(value).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function shortTime(value) {
      return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char]));
    }

    load().catch((error) => {
      $('health').textContent = error.message;
    });

    setInterval(load, 30000);
  </script>
</body>
</html>`;
}

