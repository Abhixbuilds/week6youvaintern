# Week 5 Test Results

## Checks actually executed

### JavaScript syntax validation

Command:

```bash
npm run check
```

Result:

```text
PASS
```

All listed application, client, test and profiling JavaScript files passed Node.js syntax validation.

### Unit + frontend API + static structure tests

Command:

```bash
node --test tests/unit.test.js tests/frontend-api.test.js tests/static-structure.test.js
```

Result:

```text
11 tests passed
0 failed
```

The passing tests cover:

- Progress calculation.
- Topic status classification.
- API authorization header handling.
- JSON request handling.
- 204 response handling.
- API error conversion.
- Network error handling.
- Frontend asset references.
- CSP-related HTML checks.
- Expected frontend files.

## Integration test status

The project already contains a Supertest integration suite. A complete `npm test` execution was attempted, but the verification environment did not have a usable `supertest` installation.

The environment also could not resolve the npm registry while trying to restore dependencies. Because of this, no claim is made that the full integration suite passed in this environment.

Run the following on a normal development machine after `npm install`:

```bash
npm test
```

The test command includes the API, static, unit and frontend test files.

## Performance profile

The repeatable profile is available as:

```bash
npm run profile
```

It compares application-level topic status filtering with SQL `HAVING` filtering using an in-memory dataset. The script prints the measured timings for the machine where it is executed.

No fixed percentage improvement is included because benchmark results are environment-dependent.
