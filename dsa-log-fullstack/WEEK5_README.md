# Week 5 — Testing, Debugging and Optimization

## Project

**DSA Log** is a full stack DSA practice tracker. The current application uses HTML/CSS/vanilla JavaScript on the client side and Node.js, Express and SQLite on the server side.

Week 5 focuses on testing the existing application, checking error handling, debugging issues, and improving the database/API path.

## Testing approach

The project uses the Node.js built-in test runner.

### 1. Unit testing

`server/tests/unit.test.js` tests the progress helpers independently:

- Empty topics return 0% progress.
- Progress percentages are rounded correctly.
- Topic status is classified as `todo`, `doing`, or `done`.
- A topic with no problems is not incorrectly marked as completed.

### 2. Front-end unit testing

`server/tests/frontend-api.test.js` loads the existing `client/js/api.js` in a Node VM with mocked browser APIs.

The tests cover:

- Authorization header creation.
- JSON request bodies.
- 204 responses.
- Server-side API errors.
- Network failures.

### 3. Integration/API testing

`server/tests/api.test.js` uses the existing Supertest-based API test setup.

The suite covers:

- Health check.
- Registration and validation.
- Duplicate accounts.
- Login success/failure.
- Authentication.
- Seeded topics.
- Topic CRUD.
- Search and status filters.
- User data isolation.
- Problem CRUD and filters.
- Cascade deletion.
- Statistics.
- Invalid JSON.
- 404 responses.
- Request body size limits.

`server/tests/static.test.js` checks the Express-served frontend, security headers, referenced assets, and CSP-related HTML rules.

### 4. Static frontend testing

`server/tests/static-structure.test.js` performs checks that do not require Express or third-party packages. It verifies that local assets exist, inline scripts/styles are absent, and the expected JavaScript files are present.

## Commands

From the `server` directory:

```bash
npm install
npm run check
npm run test:unit
npm run test:integration
npm test
npm run profile
```

For normal application testing:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

The full integration suite requires the dependencies from `package.json` to be installed.

## Optimization work

### Topic status filtering

Previously, the API loaded all matching topics and then filtered `todo`, `doing`, and `done` topics in JavaScript.

The Week 5 version moves these conditions into the SQLite query using `HAVING`. This reduces the amount of data that has to leave the database and removes an unnecessary JavaScript filtering pass.

### Problem filtering

The problem listing endpoint previously loaded all problems for a topic and then filtered by difficulty/solved state in JavaScript.

The new implementation builds SQL conditions for `level` and `solved`, so SQLite performs the filtering.

### Database index

A composite index was added for:

```text
(topic_id, level, solved)
```

This supports the filtered-problem query more directly.

### Profiling

`scripts/profile.js` creates a repeatable in-memory dataset and compares the previous style of filtering with the SQL-filtered approach. It prints timing results instead of using a hard-coded performance claim because benchmark values depend on the machine running the script.

## Debugging

The debugging report is in:

```text
docs/WEEK5_DEBUGGING_REPORT.md
```

The verification log is in:

```text
server/logs/week5-check.log
```

During this environment's verification, the complete integration suite could not start because the supplied dependency installation was incomplete and the environment could not resolve the npm registry. This is recorded in the log instead of being presented as a successful test run.

The tests that do not require the unavailable third-party packages were executed successfully:

- JavaScript syntax checks: passed.
- Front-end/API-client and unit tests: passed.
- Dependency-free static structure tests: passed.

## Manual testing

A manual checklist is included in:

```text
docs/WEEK5_TEST_CASES.md
```

It covers registration, login, topic management, problem progress, filtering, notes, logout, invalid routes, and server/network failure handling.

## Deliverables

The Week 5 folder contains:

- Automated test scripts.
- Front-end test coverage.
- API/integration tests.
- Static checks.
- Profiling script.
- Debugging report.
- Error/verification log.
- Test-case checklist.
- This README.
