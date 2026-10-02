# DSA Log – Maintenance Plan

**Owner / maintainer:** Abhishek Dubey (single maintainer)
**Service:** DSA Log on Render
**Review date of this plan:** 2nd october 2026

---

## 1. Purpose and scope

This plan describes how the deployed application is kept healthy: how problems are noticed (monitoring, logging, error reporting), how they are handled (incident response), how the data is protected (backups) and how changes are made safely (updates). It is written for a one-person project, so the targets are realistic rather than enterprise-grade.

## 2. Monitoring and availability

| What | Tool | Frequency | Alert |
|---|---|---|---|
| Is the site up and is the database answering? | An uptime monitor (for example UptimeRobot or Better Stack, both have free plans) calling `GET /api/health` and expecting `200` with `"status":"ok"` | Every 5 minutes | Email when it fails twice in a row |
| Did a deploy fail? | Render deploy notifications (email) and the GitHub Actions status | On every push | Email |
| Does a full user flow work? | `node scripts/smoke-test.js <live URL>` (17 checks) | After every deploy and weekly | Non-zero exit code / FAIL lines |
| Is the service restarting often? | Render **Events** tab | Weekly | Several restarts in a day means investigate |

**Free-plan note.** Render sleeps a free service after 15 minutes without traffic. A monitor pinging every 5 minutes keeps it awake and also measures uptime. This uses the free monthly instance hours (a service that runs all month uses about 750 hours), and Render may still restart a free service at any time. It is a workaround, not a guarantee, and on the free plan every restart resets the SQLite file.

`/api/health` returns `503` when the database query fails. Render uses it as its health check and restarts the service, so a broken database does not stay unnoticed.

## 3. Logging

**What is logged.** The application writes one JSON object per line to stdout/stderr. Render collects these in the **Logs** tab, so no log files or log rotation are needed on the server.

| Event | Level | Example (shortened) |
|---|---|---|
| Server start | info | `{"level":"info","event":"startup","env":"production","port":10000,"dbPath":"./data/dsa-log.db","trustProxy":1}` |
| Every request (except `/api/health`) | info | `{"level":"info","method":"POST","path":"/api/topics","status":201,"ms":4.3,"ip":"203.0.113.9"}` |
| Unexpected error (HTTP 500) | error | `{"level":"error","method":"GET","path":"/api/stats","message":"...","stack":"..."}` |
| Failed health check | error | the database error and a `503` response |
| Uncaught exception / unhandled rejection | error | logged, then the process exits and the platform restarts it |
| Shutdown (deploy or restart) | info | `{"event":"shutdown","signal":"SIGTERM"}` |

**What is never logged:** passwords, tokens, the `Authorization` header, request bodies, and query strings (search terms). `tests/logger.test.js` and `tests/deploy.test.js` check this.

**How to use the logs**

- Render → service → **Logs**: filter with the search box for `"level":"error"` or `"status":500`.
- Slow requests: search for large `ms` values; the Week 5 profiling script (`npm run profile`) reproduces slow paths locally.
- Suspicious activity: many `401`/`429` statuses from one `ip` on `/api/auth/*` indicates password guessing; the rate limiter (30 attempts per 15 minutes per IP) already blocks it.
- Retention: the platform keeps logs for a limited time. For longer retention, forward the logs to a log service (Render log streams or an external tool) or export the relevant lines into the incident record (section 7).

**Log levels policy:** `info` for normal operation, `error` for anything that needs a human. Warnings are not used, to keep the signal simple. Request logging can be switched off with `LOG_REQUESTS=false`.

## 4. Error reporting

1. **Server errors:** every unexpected error is logged as a JSON `error` line with the request method, path, message and stack. Clients only ever receive `{"error":{"message":"Internal server error"}}`.
2. **Detection:** the uptime monitor (outages) and a weekly review of `"level":"error"` lines in the log (silent failures).
3. **Optional upgrade – an error tracker (for example Sentry):** it groups identical errors, sends an email alert and keeps the stack traces. Integration would be a small change in `src/middleware/errors.js`: initialise the SDK at startup and call `Sentry.captureException(err)` next to `logError(err, req)`. It is not enabled yet because it adds an external service and a dependency; it is the first improvement to make once real users arrive.
4. **Front-end errors:** failed API calls are shown to the user (toast, error box with a retry button). Front-end exceptions are not collected centrally; an error tracker's browser SDK would add this.

**Severity and response targets** (realistic for a part-time, single maintainer)

| Severity | Definition | Example | Target response |
|---|---|---|---|
| P1 – critical | Site down, login impossible or data exposed | Health check failing, 500 on every request, leaked secret | Start within 4 hours; rotate secrets immediately if exposed |
| P2 – major | A main feature fails for some users | Cannot save notes, rate limiter blocking everyone | Within 1 working day |
| P3 – minor | Cosmetic or rare issue | Misaligned button, typo | Next planned update |

## 5. Backup and recovery

| Item | Policy |
|---|---|
| What is backed up | The SQLite database file (`DB_PATH`). Source code is already in GitHub. Secrets are kept in a password manager, not in the repository |
| How | `npm run backup` in `server/` uses SQLite's online backup, so it is safe while the server runs. It writes `backups/dsa-log-YYYYMMDD-HHMMSS.db`, checks the copy with `PRAGMA integrity_check`, and keeps the newest 7 (`KEEP=14` to keep more) |
| Where | A backup must be stored **off the server**. Copy the file to cloud storage or another machine. A backup on the same ephemeral disk is lost with the data |
| How often | Daily if real users exist; before every deploy that changes the database structure; weekly otherwise |
| Restore | Stop the service → replace the file at `DB_PATH` with the chosen backup → start the service → run the smoke test. Locally: copy the backup to `server/data/dsa-log.db` |
| Restore test | Once per quarter, restore a backup on a local copy and log in with a known account |
| Recovery targets | RPO (data you may lose): up to 24 hours with daily backups. RTO (time to be back): under 2 hours |

**Honest limitation:** on Render's free plan the database file is reset on every restart or deploy, so the live site holds only demonstration data and a backup schedule would protect nothing there. Permanent data needs a persistent disk or a managed database (deployment guide, section 11). The backup script is ready for that setup, and it works on a developer machine today.

## 6. Update procedures

### 6.1 Routine release (code changes)

1. Create a branch, make the change, add or update tests.
2. Run locally from `server/`: `npm run check` and `npm test`.
3. Open a pull request. The **GitHub Actions CI** workflow (`.github/workflows/ci.yml`) runs `npm ci`, the syntax check, the full test suite and `npm audit` on Linux with Node 22.
4. Merge to `main` only when CI is green. Render deploys `main` automatically.
5. Within 10 minutes: check Render **Logs** for startup errors, open `/api/health`, run `node scripts/smoke-test.js <live URL>`.
6. If the smoke test fails: **roll back** (Render → Deploys → previous successful deploy → Rollback, or `git revert` and push), then investigate on a branch.

### 6.2 Dependency updates

| Task | How | Frequency |
|---|---|---|
| Automatic update pull requests | GitHub Dependabot (`.github/dependabot.yml`) opens weekly PRs for `server/` | Weekly |
| Security check | `npm run audit:prod` (also in CI) | Weekly and before each release |
| Review outdated packages | `npm outdated` | Monthly |
| Patch and minor updates | Merge the Dependabot PR after CI is green and the smoke test passes | As they arrive |
| Major updates (for example Express, Zod, better-sqlite3) | Read the changelog, update on a branch, run all tests, test manually | When needed, never on the same day as another change |
| Node.js version | Stay on an active LTS line (22 now). `engines.node` and `NODE_VERSION` must match. Plan the upgrade before the current line reaches end of life | Yearly check |

### 6.3 Database changes

The schema is created with `CREATE TABLE/INDEX IF NOT EXISTS` at startup, which is enough for adding tables or indexes. For changes to existing tables (new column, renamed column):

1. Take a backup first.
2. Add a small migration step in `src/db.js` guarded by `PRAGMA user_version` (apply the change only if the stored version is lower, then raise it), so it runs exactly once per database.
3. Test it on a copy of a real backup, then deploy and run the smoke test.

### 6.4 Secrets and configuration

- Rotate `JWT_SECRET` if it may have leaked, and at least once a year. Rotation logs every user out (tokens signed with the old key become invalid), which is acceptable.
- Change environment variables only through the Render dashboard. Each change restarts the service.
- Never put secrets in the repository, issues or screenshots. If a secret was committed, treat it as leaked: rotate it first, then clean the history.

## 7. Incident response runbook

| Step | Action |
|---|---|
| 1. Confirm | Open `/api/health`. Is it `200`? Run the smoke test to see which check fails |
| 2. Look | Render **Logs**: search for `"level":"error"`. Render **Events**: was there a deploy or restart just before? |
| 3. Contain | If a deploy caused it: roll back. If an attack pattern is visible (many `401`/`429` from one IP): the rate limiter already blocks it; consider lowering the limit. If a secret leaked: rotate `JWT_SECRET` now |
| 4. Fix | Reproduce locally, write a failing test, fix, run the tests, deploy through the normal release steps |
| 5. Verify | Smoke test and the relevant UAT cases |
| 6. Record | Add an entry to the incident log below: date, symptom, cause, fix, how to prevent it |

**Incident log**

| Date | Symptom | Cause | Fix | Prevention |
|---|---|---|---|---|
| `[date]` | `[add real incidents here]` | | | |

## 8. Maintenance calendar

| Frequency | Tasks |
|---|---|
| Every deploy | CI green → deploy → check logs → smoke test |
| Daily (automatic) | Uptime monitor; backup if real data exists |
| Weekly | Review error lines in the logs; review Dependabot PRs; `npm run audit:prod`; run the smoke test |
| Monthly | `npm outdated`; check disk and instance usage in the dashboard; read the platform's status/announcements |
| Quarterly | Restore test from a backup; review this plan; review rate-limit and log settings; check plan limits on the hosting platform |
| Yearly | Rotate `JWT_SECRET`; check Node.js LTS status; review the architecture limits below |

## 9. Known limitations and growth path

| Limitation | Effect | Planned step |
|---|---|---|
| SQLite on one instance | No horizontal scaling; data lost on a free-plan restart | Persistent disk now; PostgreSQL when real users arrive |
| Free-plan sleeping and restarts | Slow first request; resets data | Paid instance |
| Token in `localStorage`, no refresh or revocation | A stolen token works until it expires (1 hour) | httpOnly cookie plus refresh tokens |
| No error tracker, no central front-end error collection | Silent front-end errors go unseen | Sentry (server and browser) |
| No email verification, password reset or account deletion | Account recovery is not possible | Add with an email service |
| Manual UAT | Regressions in the UI can slip through | Browser end-to-end tests (for example Playwright) in CI |
