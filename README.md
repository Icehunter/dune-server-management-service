# Dune Server Management Service

Small TypeScript/Node service for server-local automation of the Dune dedicated server.

The first version wraps the remote scripts already installed on the server:

- database backup every 2 hours
- update check every 15 minutes
- pending update apply check every minute
- daily restart notice at 04:30 Europe/Amsterdam
- daily restart at 05:00 Europe/Amsterdam
- SQLite task history and logs
- local web dashboard

It defaults to dry-run mode. Use `--run` only when you want it to execute local server commands.

## Setup

```powershell
Copy-Item .env.example .env
notepad .env
npm install
npm run check
npm run dry-run
```

For the real service, deploy it on the Dune server and run it under systemd as the `dune` user.

## Commands

```powershell
npm run build
npm start -- --list
npm start -- --once backup
npm start -- --once backup --run
npm run dry-run
npm run run
```

## Notes

- Runtime has no npm dependencies; TypeScript is a dev dependency.
- `.env` is ignored by Git.
- Operational behavior lives in the existing scripts under `/home/dune/.dune/bin`.
- The dashboard listens on `127.0.0.1:8787` by default. Use an SSH tunnel for access.
- Keep command-auth tokens and private keys out of this repo.
