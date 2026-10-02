# DSA Log – Project Reflection Report

**Name:** Abhishek Dubey
**Programme:** YuvaIntern – Frontend / Full Stack virtual internship
**Project:** DSA Log, a full stack tracker for DSA practice (topics, problems, notes, progress)
**Period:** Weeks 2 to 6
**Source code:**(https://github.com/Abhixbuilds/week6youvaintern.git)

---

## 1. Summary of the project

DSA Log started as a front-end exercise and grew, week by week, into a deployed full stack application.

| Week | What I built | Main result |
|---|---|---|
| 2 | Front end: landing page, dashboard and topic page in plain HTML, CSS and JavaScript, with data in `localStorage` behind a small service layer | A working interface with search, filters, progress bars and notes |
| 3 | Back end: Node.js, Express 5 and SQLite with JWT login, bcrypt, Zod validation, Helmet and rate limiting | A documented REST API with automated tests |
| 4 | Integration: one API client in the front end, same-origin serving from Express, loading/error/retry states, optimistic updates | A single application that runs with one command |
| 5 | Testing, debugging and optimization: unit, front-end, integration and static tests; SQL-side filtering; a composite index; a profiling script | A more reliable and faster data path, with the process documented |
| 6 | Deployment, maintenance and reflection: production configuration, health check, JSON logging, backups, CI, Docker, deployment guide and maintenance plan | An application prepared for a public host, with a plan to operate it |


## 2. What went well

1. **Separating the layers early.** In Week 2 the front end talked to a "store" module instead of calling `localStorage` everywhere. In Week 4 I replaced that one layer with `api.js`, and the pages needed only small changes. Good boundaries made integration cheaper.
2. **One place for API calls.** Putting every request, the token header, error parsing and the 401 handling in `client/js/api.js` meant that expired sessions, network failures and validation messages behave the same on every page.
3. **Choosing same-origin hosting.** Letting Express serve the front end removed the CORS problem completely and made deployment a single service with a single URL.
4. **Security built in rather than added later.** Hashed passwords, validated input, parameterised SQL, per-user data isolation, escaped output and a strict Content Security Policy were in place before deployment. Week 6 added the production-specific parts: a mandatory strong secret, correct proxy handling for the rate limiter, and logs that never contain passwords or tokens.
5. **Tests that explain intent.** Writing tests for failure cases (wrong password, another user's data, oversized bodies, a broken database) taught me to think about what the code must refuse to do, not only what it should do.
6. **Documenting as I went.** READMEs, an API reference, a debugging report and now a deployment guide and maintenance plan made it possible to restart work after a break and to explain decisions.

## 3. Challenges faced and how I handled them

| Challenge | What happened | How it was solved | What I learned |
|---|---|---|---|
| Content Security Policy blocked inline styles | The Week 2 progress bars used `style="width:..."`; Helmet's CSP refused them | Bars store `data-pct` and JavaScript sets the width; a test checks that no page has inline scripts or styles | Security headers change how front-end code must be written, so test with them on |
| XSS risk | Topic and problem names became user input, and I inserted them with `innerHTML` | An escaping helper (`UI.esc`) for every user string, with tests | Anything a user can type is untrusted |
| Data model mismatch | The Week 2 data (string ids, static list) did not match the API (numeric ids, nested problems) | I rewrote the page scripts around the API's response shapes | Agree on data shapes before building both sides |
| Stale search results | Fast typing sent several requests and a slow old response could overwrite a newer one | A 300 ms debounce and a request counter | Asynchronous code needs protection against out-of-order responses |
| `e.submitter` crash | Some older browsers do not provide it, which broke the add-topic form | Fall back to the form's submit button | Check browser support for APIs you rely on |
| `better-sqlite3` would not install on Windows | `npm install` tried to compile the native module and failed with a `node-gyp` / Visual Studio error; the failed install left a half-built `node_modules`, which then caused "Cannot find module 'dotenv'" | Deleted `node_modules`, reinstalled with `better-sqlite3@latest`, and checked the module's Node requirement (Node 22 or newer) | Read the first error line, not the last; native modules are a deployment risk, so the Node version must be pinned (`engines`, `NODE_VERSION`) |
| ZIP extracted into a nested folder | `cd server` failed because the project was one level deeper | I listed the folder with `dir` and moved into the inner one | Check where you are before running commands |
| Demo video was 182 MB | Too large for the ZIP or GitHub (100 MB file limit) | Uploaded to Google Drive and linked it | Keep large assets out of the repository |
| Free hosting has no persistent disk | SQLite on a free Render service is reset on restart, redeploy and spin-down | Documented it, kept the app deployable as it is, wrote the upgrade path (persistent disk or PostgreSQL) and a backup script | Check a platform's storage model before choosing a database |
| Hidden production-only bug: rate limiting behind a proxy | Behind a load balancer every request has the proxy's IP, so one shared bucket would block all users after 30 login attempts | `trust proxy` set to 1 in production, with a test using different `X-Forwarded-For` addresses | Behaviour in production can differ from `localhost`; test the deployment path |
| Unexplained 502 risk | Node's 5-second keep-alive is shorter than a load balancer's idle timeout | Raised the keep-alive timeouts to 65 seconds | Know the defaults of the servers you run behind |
| `[ADD: a problem you hit while deploying, e.g. build error, wrong Root Directory, missing environment variable]` | `[what happened]` | `[how you fixed it]` | `[lesson]` |

## 4. Technical lessons learned

- **Testing:** unit tests (pure functions such as progress calculation and the API client run in a Node VM with mocked browser APIs), integration tests (Supertest against the real Express app and an in-memory database) and static checks (no inline scripts, every referenced file exists) each catch different mistakes.
- **Optimization:** moving the topic status and problem filters from JavaScript into SQL (`HAVING`, `WHERE`) and adding a composite index reduced work done per request. I learned to measure with a repeatable profiling script, and to print results instead of claiming numbers.
- **Operations:** production readiness is mostly about configuration and failure modes: required secrets, a real health check, structured logs without sensitive data, graceful shutdown, backups and a rollback path.
- **Security thinking:** every feature has an abuse case. Rate limits, generic login errors, 404 instead of 403 for other users' data and bounded request sizes all came from asking "what if someone misuses this?"
- **Documentation as a deliverable:** a guide is only useful if a stranger can follow it. Writing the troubleshooting table forced me to list the real failure modes.



**5 Tasks done**

- Set up and ran the project on my own Windows computer, and worked through the real problems that appeared: the `better-sqlite3` / `node-gyp` install failure, the half-built `node_modules`, and the nested-folder mistake. I read the errors, tried the fixes and reported the results until everything ran.
- Tested the running application in the browser, checked that features such as login, ticking problems, notes and logout work, and confirmed the results before submitting.
- Recorded the demo video, uploaded it to Google Drive, checked that the link works, and updated the README.
- Created the GitHub repositories, checked with `git status` that `node_modules` and `.env` were not committed, and pushed the code.
- Made the decisions about what to submit and when, and kept my own DSA study as the main priority.
- The deployment is to be done yet



## 6. What I would improve in future projects

| Area | Improvement | Why |
|---|---|---|
| Database | Start with PostgreSQL (or plan the persistence story first) | Free hosts do not keep local files; real apps need backups and several instances |
| Authentication | httpOnly cookie sessions with refresh tokens, email verification, password reset, account deletion | `localStorage` tokens are exposed to XSS; users need account recovery |
| Testing | Run tests in CI from day one; add browser end-to-end tests (Playwright) and a coverage report | Catch regressions automatically, including UI flows that are tested manually today |
| Types and structure | TypeScript or JSDoc types, a shared schema between front end and back end | Prevents mismatches like the Week 4 data-model problem |
| Front end | A small framework or component structure, an accessibility audit, a mobile-first review | Plain scripts grow harder to maintain as pages multiply |
| Operations | Error tracker (Sentry), uptime alerts, log forwarding, a staging environment | Find problems before users report them |
| Process | Plan deployment in week 1, keep a decision log, estimate time per task | Several surprises came late and were avoidable |

## 7. Areas for personal improvement

1. **Understanding before shipping.** Be able to explain every file I submit. Plan: read and annotate the server and client files above, then explain them out loud as for an interview.
2. **Core DSA in C++.** This project is a tool for my main goal, a strong DSA foundation (currently vectors). Plan: keep a daily problem routine and log it in DSA Log itself.
3. **Reading errors carefully.** Several delays came from reacting to the last line of an error. Plan: copy the first error, search it, change one thing at a time.
4. **Verifying claims.** Plan: do not write "works" or "tested" in a report until I have run the command myself and saved the output.
5. **Time management.** Plan: split each week's task into small deliverables with dates, and finish documentation as I build rather than at the end.

## 8. Conclusion

Over five weeks DSA Log grew from a static front end to a secured, tested, documented application prepared for public hosting, with a maintenance plan around it. The most valuable lessons were not about a single technology: they were about boundaries between layers, testing the failure paths, and respecting the difference between "works on my computer" and "works in production." The next step is to put the application on a persistent database, add automated browser tests and keep using it for my own DSA preparation.
