# Week 5 Debugging Report

## 1. Purpose

The purpose of this debugging work was to verify the DSA Log application after the Week 4 full-stack integration and to improve the reliability and efficiency of the existing code.

The checks were performed against the actual Week 4 source code supplied with the project.

## 2. Initial verification

The existing project already contained API and static tests. I first tried to execute:

```bash
npm test
```

The test process stopped before running the application tests because `supertest` was not available as a usable installed module in the verification environment.

The important error was:

```text
Error: Cannot find module 'supertest'
```

This was identified as a dependency/setup problem rather than an application assertion failure.

I attempted to restore the dependencies using npm, but the verification environment could not resolve `registry.npmjs.org`. Therefore, it was not possible to claim that the complete third-party-dependent integration suite had passed in this environment.

The issue and commands are recorded in `server/logs/week5-check.log`.

## 3. Source-level debugging

After inspecting the application flow, two areas were selected for optimization.

### Topic filtering

The dashboard requests topics with optional `search` and `status` parameters.

The earlier implementation retrieved all matching topics and then performed the status filtering in JavaScript:

- `todo`
- `doing`
- `done`

This worked functionally, but unnecessary rows were transferred from SQLite into the application before being discarded.

### Problem filtering

The problem endpoint also retrieved every problem belonging to a topic and then filtered by `level` or `solved` in JavaScript.

This was another avoidable processing step.

## 4. Changes made

### Change 1 — SQL topic status filtering

The status conditions are now expressed as SQL `HAVING` conditions after grouping each topic's problems.

This keeps the existing response format while moving the filtering closer to the data.

### Change 2 — SQL problem filtering

The problem endpoint now adds SQL conditions for:

```text
level
solved
```

Only matching rows are returned from SQLite.

### Change 3 — composite database index

The database schema now contains:

```text
idx_problems_topic_level_solved
(topic_id, level, solved)
```

This is intended to support the common filtered-problem query.

### Change 4 — isolated progress logic

Progress calculation and topic-status classification were moved into:

```text
server/src/utils/progress.js
```

This makes the logic independently testable and keeps the route code easier to read.

## 5. Tests added

### Unit tests

`tests/unit.test.js` covers progress percentage and topic status edge cases.

### Front-end API client tests

`tests/frontend-api.test.js` covers authorization, JSON requests, successful responses, API errors and network failures using mocked browser APIs.

### Additional API tests

The existing API suite was extended to cover:

- Topic status filtering.
- Combined problem filtering.
- Oversized request bodies.

### Static frontend tests

`tests/static-structure.test.js` checks frontend files without requiring Express.

## 6. Verification completed in this environment

The following checks were successfully executed:

```text
npm run check
```

Result: passed.

```text
node --test tests/unit.test.js tests/frontend-api.test.js
```

Result: 8 tests passed.

```text
node --test tests/unit.test.js tests/frontend-api.test.js tests/static-structure.test.js
```

Result: 11 tests passed.

The complete API/static integration suite could not be executed because the required npm dependencies were unavailable in the current verification environment. No fabricated integration or performance numbers have been included.

## 7. Lessons learned

1. Tests should be run before changing application code so that existing failures can be separated from newly introduced failures.
2. Filtering data in the database is preferable when the database can perform the same operation efficiently.
3. Small pieces of calculation logic are easier to verify when they are kept in separate functions.
4. A performance improvement should be measured on the target environment rather than represented by a made-up percentage.
5. Dependency installation is part of making a test suite reproducible.

## 8. Final result

The application keeps the same overall architecture and user flow while adding broader automated coverage and moving unnecessary filtering work from JavaScript into SQLite. The project also contains a repeatable profiling script so the performance difference can be measured on the machine where the internship submission is executed.
