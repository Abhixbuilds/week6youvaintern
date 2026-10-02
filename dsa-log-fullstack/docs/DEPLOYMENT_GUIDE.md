# DSA Log – Deployment Guide

**Project:** DSA Log (full stack: HTML/CSS/JavaScript front end, Node.js + Express + SQLite back end)
**Target platform:** Render (free web service), with a Docker alternative for any other host
**Live URL:** `[add your public URL here, e.g. https://dsa-log.onrender.com]`
**Repository:** `[add your GitHub repository link here]`

---

## 1. What is being deployed

DSA Log is deployed as **one web service**. The Express server answers `/api/*` requests and also serves the files in `client/`, so the browser and the API share one origin. This means:

- one URL, one service, one set of environment variables;
- no CORS configuration is needed in production;
- the front end calls relative URLs such as `/api/topics`, so it works on any domain without edits.

```
Browser ──HTTPS──> Render load balancer (TLS, proxy) ──HTTP──> Node/Express (server/src/server.js)
                                                                 ├─ /api/*  → routes → SQLite file (DB_PATH)
                                                                 └─ /*      → static files from client/
```

The repository root must be the folder that contains `client/` and `server/`, because the server loads the front end from `../client`.

## 2. Choosing a platform

| Option | Cost | Data persistence for SQLite | Fits this project? |
|---|---|---|---|
| **Render – free web service** | Free | **No.** The file system is reset on every deploy, restart and spin-down (Render documents this for local SQLite files) | Good for the assignment, demo and user acceptance tests. Not for real user data |
| **Render – paid web service + persistent disk** | Paid | Yes (disk mounted at e.g. `/var/data`) | Best "same code" upgrade path |
| Railway / Fly.io (Docker or Node) | Trial / small paid | Yes, with a volume | Works with the included `Dockerfile` |
| AWS (Elastic Beanstalk, Lightsail, EC2, App Runner) | Paid (free trial) | EC2/Lightsail: yes (disk). Others: use a volume or RDS | Works with the `Dockerfile`; more setup |
| Heroku | Paid | No (ephemeral dynos) | Needs an external database for persistence |

**Decision:** deploy to Render's free web service, because it needs no credit card, deploys straight from GitHub and gives an HTTPS URL. The limitation is understood and documented: **on the free plan, accounts and topics created on the live site disappear when the service restarts or redeploys, and the service sleeps after 15 minutes without traffic** (the next request takes up to about a minute). Section 11 describes how to make the data permanent. Check Render's current documentation (https://render.com/docs/free) before deploying, because plan limits change.

## 3. Production-readiness changes made to the application

| # | Change | Why it matters in production | Where |
|---|---|---|---|
| 1 | In production the server refuses to start unless `JWT_SECRET` is set **and at least 32 characters** | A guessable signing key lets anyone forge login tokens | `src/config.js`, tested in `tests/config.test.js` |
| 2 | `trust proxy` is set to 1 in production | Behind Render's proxy every request seems to come from the proxy's IP. Without this, the login rate limiter would treat all visitors as one person and block everyone after 30 attempts | `src/app.js`, tested in `tests/deploy.test.js` |
| 3 | CORS is off by default in production | The app is same-origin, so cross-origin access is unnecessary attack surface. It can still be enabled with `CORS_ORIGIN` | `src/config.js`, `src/app.js` |
| 4 | `/api/health` now runs `SELECT 1` and returns **503** if the database fails | The platform health check restarts the service when the database is unusable, and uptime monitors can alert | `src/app.js` |
| 5 | Structured JSON logs (one line per request and per error; no passwords, tokens or query strings) | Hosting platforms collect stdout; JSON lines are searchable | `src/logger.js` |
| 6 | Keep-alive timeouts raised to 65 s | Node's 5 s default is shorter than the load balancer's idle timeout and causes random 502 errors | `src/server.js` |
| 7 | Graceful shutdown on SIGTERM, plus logging of uncaught errors and exit | Clean restarts on every deploy; a crashed process is replaced instead of running in a broken state | `src/server.js` |
| 8 | `engines.node >= 22` | `better-sqlite3` 13 needs Node 22+; the platform picks a compatible version | `package.json` |
| 9 | Backup script, live smoke test, CI workflow, Dependabot, Dockerfile, Render blueprint | Operations tooling (see the maintenance plan) | `scripts/`, `.github/`, `Dockerfile`, `render.yaml` |

Already in place from earlier weeks: bcrypt password hashing, JWT with 1 hour expiry and HS256 only, Zod validation on every route, parameterised SQL, per-user data isolation, Helmet security headers with a Content Security Policy, 10 KB body limit, rate limiting on `/api/auth`, HTML escaping of all user text on the client.

## 4. Environment variables

Set these in the hosting dashboard. Never commit real values; `.env` is in `.gitignore`.

| Variable | Production value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables the production checks and defaults |
| `JWT_SECRET` | 64 random hex characters | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Render can also generate one |
| `JWT_EXPIRES_IN` | `1h` | Token lifetime |
| `DB_PATH` | `./data/dsa-log.db` (free) or `/var/data/dsa-log.db` (persistent disk) | Must be in a writable folder |
| `PORT` | *(set by Render)* | Do not set it yourself on Render; the app reads it |
| `NODE_VERSION` | `22` | Render setting that selects the Node version |
| `TRUST_PROXY` | *(default 1)* | Number of proxies in front of the app |
| `CORS_ORIGIN` | *(leave unset)* | Only needed for a separate front-end domain |
| `LOG_REQUESTS` | *(default true in production)* | Set `false` to silence request logs |
| `BCRYPT_ROUNDS` | *(default 10)* | Raise only if the server is fast enough |

## 5. Verify locally in production mode first

From the `server` folder (Windows PowerShell):

```powershell
npm ci
npm run check
npm test
$env:NODE_ENV = "production"
$env:JWT_SECRET = "paste-64-random-hex-characters-here"
npm start
```

Open http://localhost:3000. Expected: the app works, and the terminal prints JSON lines such as `{"level":"info","event":"startup",...}` and one line per request. Then confirm the safety checks:

- Remove `JWT_SECRET` and start again: it must stop with `JWT_SECRET must be set in production`.
- Use a short secret such as `abc`: it must stop with `at least 32 characters`.

Reset the variables afterwards (`Remove-Item Env:NODE_ENV; Remove-Item Env:JWT_SECRET`) so that normal development is not affected.

## 6. Deploy to Render (step by step)

Button names can change slightly; the Render dashboard shows the same options.

**6.1 Put the code on GitHub**

1. Make sure `git status` does not list `node_modules`, `.env`, `*.db` or `backups/`.
2. The repository root must contain `client/`, `server/`, `render.yaml` and `Dockerfile`.
3. `git add . && git commit -m "Week 6: production deployment" && git push`.

**6.2 Create the web service**

1. Sign in at https://render.com (GitHub login is fine).
2. **New +** → **Web Service** → connect your GitHub account → select the repository.
3. Fill in the form:

| Field | Value |
|---|---|
| Name | `dsa-log` (becomes `dsa-log.onrender.com` if free) |
| Language / Runtime | Node |
| Branch | `main` |
| Root Directory | *(leave empty)* |
| Build Command | `cd server && npm ci --omit=dev` |
| Start Command | `cd server && npm start` |
| Instance Type | Free |

4. Under **Advanced**: set **Health Check Path** to `/api/health`.
5. Under **Environment Variables**, add `NODE_ENV=production`, `NODE_VERSION=22`, `JWT_SECRET=<your 64-character value>`, `JWT_EXPIRES_IN=1h`, `DB_PATH=./data/dsa-log.db`.
6. Click **Create Web Service**. Render builds (about 2–4 minutes; `better-sqlite3` is downloaded as a prebuilt binary), then starts the service.

*Alternative:* with the `render.yaml` in the repository, choose **New +** → **Blueprint** and select the repository. It creates the same service and generates `JWT_SECRET` automatically.

**6.3 Check the deployment**

1. Open the **Logs** tab. Expect a line like `{"level":"info","event":"startup","env":"production",...}` and no red errors.
2. Visit `https://<your-service>.onrender.com/api/health`. Expected: `{"status":"ok","uptime":...}`.
3. Visit the root URL, register an account and click through the app.
4. Run the automated smoke test from your PC (section 8).
5. Write the URL into `README.md` ("Live deployment") and at the top of this guide.

**6.4 Redeploy and roll back**

Every push to `main` deploys automatically. To go back, open the service → **Events/Deploys** → choose an earlier successful deploy → **Rollback** (or revert the commit in Git and push).

## 7. Alternative: Docker (Fly.io, Railway, AWS, any VPS)

```bash
docker build -t dsa-log .
docker run -p 3000:3000 -e JWT_SECRET=<64 random hex chars> -v dsa-data:/data dsa-log
```

The image uses Node 22, installs production dependencies only, runs as the non-root `node` user, stores the database in the `/data` volume and has a health check. On a cloud host, mount a persistent volume at `/data`, set `JWT_SECRET`, and expose port 3000 (or the port the platform assigns through `PORT`). Because Docker was not available in the environment where this guide was prepared, build the image once yourself and confirm it starts before relying on it.

## 8. Verification and user acceptance testing

**8.1 Automated smoke test (run from your PC against the live URL)**

```powershell
cd server
node scripts/smoke-test.js https://<your-service>.onrender.com
```

It checks 17 things (health, pages, HTTPS and security headers, register/login, validation errors, protected routes, topic and problem create/tick, progress and stats, notes, search/filter, JSON errors, dotfile protection) and saves `server/logs/smoke-<timestamp>.txt`. The first request may take up to a minute on a sleeping free instance; the script waits for it. Attach the log file to the submission.

**8.2 Manual user acceptance test (fill in on the live site)**

Test in Chrome on a desktop and, if possible, on a phone. Use a fresh account.

| ID | Scenario | Steps | Expected result | Result (Pass/Fail) | Notes |
|---|---|---|---|---|---|
| UAT-01 | Site opens over HTTPS | Open the live URL | Landing page loads, padlock shown, no console errors | ☐ | |
| UAT-02 | Register | Sign in → Create account with valid details | Redirected to the dashboard with 6 starter topics | ☐ | |
| UAT-03 | Register validation | Try password `abc` | Clear message (8+ characters, letter and number); no account created | ☐ | |
| UAT-04 | Duplicate account | Register the same email again | "An account with this email already exists" | ☐ | |
| UAT-05 | Wrong password | Log in with a wrong password | Generic "Invalid email or password"; stays on the login page | ☐ | |
| UAT-06 | Login and persistence | Log in, refresh the page | Still logged in; data unchanged | ☐ | |
| UAT-07 | Dashboard stats | Open the dashboard | Solved count, percentage and finished-topics tiles show numbers | ☐ | |
| UAT-08 | Search and filter | Search "arr"; use the status chips | Topic list updates; empty state shown when nothing matches | ☐ | |
| UAT-09 | Add a topic | Add "Graphs" | Toast confirms; card appears | ☐ | |
| UAT-10 | Tick problems | Open a topic, tick and untick problems | Progress bar and counts update at once; survive a refresh | ☐ | |
| UAT-11 | Add and delete a problem | Add a problem; delete another | List updates; counts correct | ☐ | |
| UAT-12 | Notes | Type a note, wait for "Note saved", refresh | Note is still there | ☐ | |
| UAT-13 | Delete a topic | Delete the topic you added | Returns to the dashboard; topic gone | ☐ | |
| UAT-14 | Logout and protection | Log out, then open `/dashboard.html` directly | Redirected to the login page | ☐ | |
| UAT-15 | Session expiry | Wait over 1 hour or delete the token in dev tools, then act | Redirected to login with a "session expired" notice | ☐ | |
| UAT-16 | Sleeping service | Leave idle 20 minutes, open the site | Loads after a delay (free plan); app works normally | ☐ | |
| UAT-17 | Mobile layout | Open on a phone | Readable, no horizontal scrolling, buttons usable | ☐ | |
| UAT-18 | Unknown page | Open `/nothing-here` | A 404 response; the app does not crash | ☐ | |

Record: tester name, date, browser and device, live URL, and screenshots of UAT-02, UAT-10 and UAT-12.

## 9. Security best-practice checklist

| Area | Status | Evidence / how to verify |
|---|---|---|
| Secrets outside the repository | Done | `.env` in `.gitignore`; values set in the Render dashboard; run `git log -p -S JWT_SECRET` to confirm no real secret was committed |
| Strong signing key enforced | Done | `config.test.js` |
| HTTPS | Done by platform | Smoke test checks the `Strict-Transport-Security` header |
| Security headers (CSP, nosniff, HSTS, no `X-Powered-By`) | Done | `deploy.test.js`, smoke test |
| Passwords hashed (bcrypt) | Done | `api.test.js` checks the hash is never returned; `src/routes/auth.js` |
| Brute-force protection | Done | Rate limit of 30 attempts per 15 minutes per IP on `/api/auth`, correct behind the proxy (`deploy.test.js`) |
| Input validation and parameterised SQL | Done | Zod on every route; all user values are bound parameters (code review of `src/routes/*.js`) |
| XSS | Done | All user text is escaped (`UI.esc`), strict CSP without inline scripts |
| No internal details in errors | Done | Generic 500 and `deploy.test.js` |
| Sensitive data in logs | Done | Logs hold method, path, status and timing only (`logger.test.js`, `deploy.test.js`) |
| Dependency vulnerabilities | Process | `npm run audit:prod`, GitHub Dependabot, CI audit step |
| Least privilege (Docker) | Done | Container runs as the non-root `node` user |
| Known weaker points | Open | Tokens live in `localStorage` (an httpOnly cookie would be safer against XSS); no refresh tokens or revocation; no email verification or password reset; no account deletion |

## 10. Troubleshooting common deployment problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails with `node-gyp` / "Could not find any Visual Studio" / `better-sqlite3` errors | The platform used an older Node version or no prebuilt binary matched | Set `NODE_VERSION=22`; confirm `engines.node` is `>=22`; clear the build cache and redeploy. On Docker use `node:22-slim`, or add `python3 make g++` before `npm ci` |
| `npm ci` fails: "package.json and package-lock.json are not in sync" | Dependencies changed without updating the lock file | Run `npm install` locally, commit `package-lock.json`, push |
| Deploy log: `Cannot find module 'dotenv'` (or any module) | Dependencies were not installed; wrong folder | Build command must be `cd server && npm ci --omit=dev`; start command `cd server && npm start` |
| Service exits immediately: `JWT_SECRET must be set in production` or `at least 32 characters` | Missing or short secret | Set `JWT_SECRET` (64 hex characters) in the dashboard |
| "Port scan timeout" / "No open ports detected" / service never becomes live | App listens on a fixed port | The app reads `PORT` automatically. Do not hard-code a port or set `PORT` yourself |
| Site opens but pages, CSS or JS return 404 | Wrong repository root or Root Directory set to `server` | Root Directory must be empty so that `client/` sits next to `server/` |
| First visit takes about a minute, or the page shows a Render loading screen | Free instance was asleep | Expected on the free plan. Mitigate with an uptime monitor (see the maintenance plan) or a paid plan |
| Accounts and topics vanish after a while | Free plan resets the file system on restart, spin-down and redeploy | Expected on the free plan. Use a paid plan with a persistent disk (section 11) |
| `SQLITE_CANTOPEN` or "unable to open database file" | `DB_PATH` folder does not exist or is not writable; wrong disk mount path | Use `./data/dsa-log.db`, or the disk's `mountPath` (e.g. `/var/data/dsa-log.db`) |
| Everyone gets "Too many attempts" (429) | Rate limiter sees the proxy's IP | `TRUST_PROXY=1` (default in production). If a platform has two proxies in front, use `2` |
| Random 502 / "connection reset" errors | Node closes idle connections before the load balancer does | Already handled by the 65 s keep-alive setting; make sure you deployed the current code |
| Browser console shows CORS errors | Front end and API are on different domains | Call the API on the same origin, or set `CORS_ORIGIN` to the exact front-end URL |
| Logged out repeatedly | `JWT_SECRET` changes on each deploy (for example regenerated) or the token expired | Keep one fixed `JWT_SECRET`; tokens last `JWT_EXPIRES_IN` |
| Blank styling, fonts not loading | Blocked by the browser or the CSP | Check the browser console; Google Fonts are allowed by the default CSP. Verify nothing was changed in `app.js` |
| Health check failing in the Render dashboard | Database not reachable or app crashed | Open **Logs**, look for the `level":"error"` line, fix `DB_PATH`/permissions |

**Where to look first:** the Render **Logs** tab (filter for `error`), then `/api/health`, then the environment variables, then the last deploy's build log.

## 11. Making the data permanent (upgrade path)

1. **Render paid plan + persistent disk:** uncomment the `disk` block in `render.yaml` (or add a disk in the dashboard, mount path `/var/data`) and set `DB_PATH=/var/data/dsa-log.db`. The database then survives restarts and deploys. A disk ties the service to one instance and brings a short downtime on deploy.
2. **Managed PostgreSQL:** replace `better-sqlite3` with a PostgreSQL client. This is a code change (the data layer is synchronous today and would become asynchronous) but it allows several instances and managed backups. It is the recommended step if the project were to serve real users.

## 12. Evidence to attach to the submission

- Live URL and a screenshot of the running site.
- Screenshot of the Render dashboard (service, environment variable names without values, successful deploy).
- `server/logs/smoke-*.txt` from the live smoke test.
- The completed UAT table (section 8.2) with date and tester.
- A short note of any problem you hit while deploying and how you fixed it (feeds the reflection report).
