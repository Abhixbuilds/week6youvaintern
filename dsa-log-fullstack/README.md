# DSA Log (Full Stack)

A full stack DSA practice tracker. Users create an account, log in, and manage topics, problems, notes and progress. The **front end** (HTML, CSS, vanilla JavaScript) talks to a **REST API** (Node.js, Express, SQLite) over `fetch`, and the Express server also serves the front-end files, so the whole app runs from one command.

This is the integration of the Week 2 front end and the Week 3 API.

## Architecture

```
Browser (client/)                          Server (server/)
  login.html / dashboard.html / topic.html     Express app on http://localhost:3000
  js/api.js  --- fetch /api/... + JWT --->     /api/auth, /api/topics, /api/problems, /api/stats
  js/ui.js   (toast, escaping, nav)            middleware: auth, validation, errors
                                               SQLite database (server/data/dsa-log.db)
        <--- same origin: Express also serves client/ as static files ---
```

## Folder structure
```
client/            front end
  index.html, login.html, dashboard.html, topic.html
  css/styles.css
  js/api.js        the only file that calls the back end (fetch wrapper, token, error class)
  js/ui.js         shared helpers (HTML escaping, toast, header, auth guard)
  js/login.js, dashboard.js, topic.js, landing.js    one script per page
server/            back end
  src/             app, routes, middleware, database
  tests/           18 automated tests
  docs/API.md      full API documentation
```

## Run it locally
Requires **Node.js 22 or newer** (needed by `better-sqlite3` 13).

```bash
cd server
npm install
copy .env.example .env        # macOS/Linux: cp .env.example .env
# open .env and set JWT_SECRET to a long random string
npm start
```
Open **http://localhost:3000**, click "Sign in", create an account and use the app.
The database file is created automatically in `server/data/`.

Run the tests (from `server/`): `npm test`

Troubleshooting: if `npm install` fails while building `better-sqlite3`, install the latest Node.js LTS (it has prebuilt binaries) and try again.

## How the integration works
1. **Same origin.** Express serves `client/`, so the front end calls relative URLs like `/api/topics`. No CORS setup is needed.
2. **One API client.** All requests go through `client/js/api.js`. It adds the `Authorization: Bearer <token>` header, parses JSON, and throws an `ApiError` with the server's message and validation details.
3. **Authentication flow.** Register or log in, store the JWT in `localStorage`, and send it on every request. Protected pages call `UI.requireAuth()` and redirect to the login page when there is no token. A `401` from the API clears the token and redirects with a "session expired" notice.
4. **State management.** The server is the source of truth. Each page loads its data with `fetch`, keeps it in a local variable and re-renders. Ticking a problem uses an optimistic update: the screen changes first, the change is saved in the background, and it is undone with an error message if the save fails.
5. **Replaced the old data layer.** The Week 2 `data.js` and `store.js` (localStorage) were removed; their functions map to API calls:

| Front-end action | API call |
|------------------|----------|
| Log in / create account | `POST /api/auth/login`, `POST /api/auth/register` |
| Load dashboard | `GET /api/topics?search=&status=` and `GET /api/stats` |
| Add / delete topic | `POST /api/topics`, `DELETE /api/topics/:id` |
| Open topic | `GET /api/topics/:id` |
| Tick / untick problem | `PATCH /api/problems/:id` with `{ "solved": true }` |
| Add / delete problem | `POST /api/topics/:id/problems`, `DELETE /api/problems/:id` |
| Save notes | `PATCH /api/topics/:id` with `{ "notes": "..." }` |

## Error handling
- Network failure: "Cannot reach the server..." with a **Try again** button.
- Validation errors (400): the server's messages are shown in the form.
- Expired or invalid token (401): token cleared, user sent to the login page.
- Missing topic (404): friendly "Topic not found" message.
- Failed saves: toast message, and the optimistic change is rolled back.
- Loading states are shown while requests are in flight, and out-of-order responses from fast typing in search are ignored.

## Security
Passwords hashed with bcrypt, JWT authentication, parameterised SQL, strict input validation, per-user data isolation, rate limiting on login routes, Helmet security headers with a Content Security Policy, request size limits. User-entered text is HTML-escaped before it is displayed.

## Challenges and solutions
| Challenge | Solution |
|-----------|----------|
| Browsers block requests between different origins (CORS) when the front end and API run on different ports. | Served `client/` from the Express server so both share one origin. |
| The Content Security Policy (Helmet) blocks inline `style="..."` attributes, which the Week 2 progress bars used. | Progress bars now store a `data-pct` value and the width is set from JavaScript. I added a test that checks no page has inline scripts or inline styles. |
| Topic and problem names are now user input, which creates an XSS risk when inserted with `innerHTML`. | Added `UI.esc()` and used it for every user-supplied string. |
| The Week 2 data model (string ids, a static list) did not match the API (numeric ids, nested problems, `solved` booleans). | Rewrote the page scripts around the API's response shapes and removed the old data files. |
| Typing quickly in the search box sent several requests, and a slow older response could overwrite a newer one. | Added a 300 ms debounce and a request counter so only the latest response is rendered. |
| Waiting for the server before the tick shows up felt slow. | Optimistic update with rollback on failure. |
| `e.submitter` is not available in some older browsers, which crashed the add-topic form. | Fall back to the form's submit button. |

## Testing
- Week 5 automated coverage includes API/integration tests, static frontend checks, progress unit tests, API-client tests, and dependency-free frontend structure tests. Run `npm test` from `server/` after installing dependencies.
- Manual end-user checklist: register, log in, open a topic, tick problems, refresh (progress stays), add and delete a problem, search and filter topics, log out and confirm protected pages redirect to login, stop the server and confirm the error message appears.

## Week 5 testing, debugging and optimization

The Week 5 deliverables are documented in `WEEK5_README.md`. The test cases are in `docs/WEEK5_TEST_CASES.md`, the debugging report is in `docs/WEEK5_DEBUGGING_REPORT.md`, and the verification log is in `server/logs/week5-check.log`. Use `npm run check`, `npm run test:unit`, `npm run test:integration`, `npm test`, and `npm run profile` from `server/`.

## Demo
Demo video: [add link or file name here]
Live deployment: [add your public URL here]

Week 5 (testing, debugging, optimization) is documented in `WEEK5_README.md`. Week 6 (deployment, maintenance, reflection) is documented in `WEEK6_README.md` and `docs/`.

## Limitations and future work
- Tokens cannot be revoked before they expire (no refresh tokens).
- No email verification or password reset.
- The token is kept in `localStorage`; an httpOnly cookie would be safer against XSS.
- SQLite suits one server; a larger deployment would use PostgreSQL.
- Possible deployment: Render or Railway, using a persistent disk for the SQLite file.
