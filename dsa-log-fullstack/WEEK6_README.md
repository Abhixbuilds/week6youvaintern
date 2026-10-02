# Week 6 – Deployment, Maintenance and Project Reflection

This folder is the DSA Log project prepared for public deployment, with the Week 6 documents.

## Deliverables

| Deliverable | File |
|---|---|
| Deployment guide (steps, troubleshooting, UAT, security checklist) | `docs/DEPLOYMENT_GUIDE.md` |
| Maintenance documentation (monitoring, logging, error reporting, backups, updates, incident runbook) | `docs/MAINTENANCE_PLAN.md` |
| Project reflection report | `docs/PROJECT_REFLECTION.md` |
| Word versions of the three documents | `../Week6_*.docx` (in the submission ZIP root) |

## Production-readiness work in the code

| Area | Files |
|---|---|
| Production config checks (secret length, CORS off, trust proxy, request logging) | `server/src/config.js`, `server/src/app.js` |
| Structured JSON logging | `server/src/logger.js`, `server/src/middleware/errors.js` |
| Health check with a database probe, graceful shutdown, keep-alive timeouts | `server/src/app.js`, `server/src/server.js` |
| Backup with integrity check and retention | `server/scripts/backup.js` (`npm run backup`) |
| Live smoke test / automated acceptance checks | `server/scripts/smoke-test.js` (`npm run smoke -- <url>`) |
| Syntax check for all files | `server/scripts/check.js` (`npm run check`) |
| Tests for the above | `server/tests/config.test.js`, `logger.test.js`, `deploy.test.js` |
| Deployment files | `render.yaml`, `Dockerfile`, `.dockerignore` |
| Automation | `.github/workflows/ci.yml`, `.github/dependabot.yml` |

## Run it

```bash
cd server
npm ci            # or npm install
npm run check
npm test
copy .env.example .env     # macOS/Linux: cp .env.example .env   (set JWT_SECRET)
npm start                  # http://localhost:3000
```

Deploy: follow `docs/DEPLOYMENT_GUIDE.md`. After deploying, run `npm run smoke -- https://<your-url>` and complete the UAT table.

## Status of verification

See `server/logs/week6-check.log` for the commands that were run while preparing this package and their results, and for what still has to be run on your own computer and on the live site (the live URL, UAT results and the full integration test run).
