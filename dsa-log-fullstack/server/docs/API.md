# DSA Log API Documentation

Base URL (local): `http://localhost:3000/api`
Format: JSON requests and responses (`Content-Type: application/json`).

## Authentication
Register or log in to receive a **JWT**. Send it on every protected request:

```
Authorization: Bearer <token>
```

Tokens expire after 1 hour by default (`JWT_EXPIRES_IN`). Each user can only see and change their own data.

## Error format
Every error uses the same shape:

```json
{ "error": { "message": "Validation failed", "details": [ { "field": "password", "message": "Password must contain a number" } ] } }
```
`details` appears only for validation errors.

| Status | Meaning |
|--------|---------|
| 200 | OK |
| 201 | Created |
| 204 | Deleted, no body |
| 400 | Validation failed or malformed JSON |
| 401 | Missing, invalid or expired token; wrong login |
| 404 | Route, topic or problem not found (also returned for another user's data) |
| 409 | Email already registered |
| 413 | Request body larger than 10 KB |
| 429 | Too many auth attempts (30 per 15 minutes per IP) |
| 500 | Unexpected server error (details are never exposed) |

---

## Endpoint summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/auth/register` | No | Create account (starts with 6 default topics) |
| POST | `/auth/login` | No | Log in |
| GET | `/auth/me` | Yes | Current user |
| GET | `/topics` | Yes | List topics with progress (search, status filter) |
| POST | `/topics` | Yes | Create topic |
| GET | `/topics/:id` | Yes | Topic with its problems |
| PATCH | `/topics/:id` | Yes | Update title, description or notes |
| DELETE | `/topics/:id` | Yes | Delete topic and its problems |
| GET | `/topics/:topicId/problems` | Yes | List problems (level, solved filters) |
| POST | `/topics/:topicId/problems` | Yes | Add problem |
| GET | `/problems/:id` | Yes | Get one problem |
| PATCH | `/problems/:id` | Yes | Update name, level or solved |
| DELETE | `/problems/:id` | Yes | Delete problem |
| GET | `/stats` | Yes | Overall progress summary |

---

## Auth

### POST `/auth/register`
Body:

| Field | Type | Rules |
|-------|------|-------|
| name | string | 2 to 50 characters |
| email | string | valid email, stored lowercase |
| password | string | 8 to 72 characters, at least one letter and one number |

Unknown fields are rejected.

`201 Created`
```json
{ "user": { "id": 1, "name": "Abhi", "email": "abhi@example.com" }, "token": "eyJhbGciOi..." }
```
Errors: `400` validation, `409` email exists.

### POST `/auth/login`
Body: `{ "email": "abhi@example.com", "password": "Secret123" }`

`200 OK` returns the same shape as register. `401` with "Invalid email or password" for any wrong credential (the message never says which part was wrong).

### GET `/auth/me`
`200 OK`: `{ "user": { "id": 1, "name": "Abhi", "email": "abhi@example.com" } }`

---

## Topics

### GET `/topics`
Query (all optional):

| Param | Values | Effect |
|-------|--------|--------|
| search | text (max 100) | Title contains the text |
| status | `todo`, `doing`, `done` | Filter by progress |

`200 OK`
```json
{
  "count": 1,
  "topics": [
    {
      "id": 1, "title": "Arrays", "description": "Traversal, prefix sums, Kadane and two pointers.",
      "notes": "", "createdAt": "2026-10-02 10:00:00",
      "progress": { "solved": 2, "total": 5, "percent": 40 }
    }
  ]
}
```

### POST `/topics`
Body: `{ "title": "Graphs", "description": "BFS and DFS" }` (`title` required, max 100; `description` optional, max 300)

`201 Created`: `{ "topic": { ...same shape as above... } }`

### GET `/topics/:id`
`200 OK`: same topic object plus a `problems` array:
```json
{ "topic": { "id": 1, "title": "Arrays", "progress": { "solved": 1, "total": 5, "percent": 20 },
  "problems": [ { "id": 1, "name": "Two Sum", "level": "Easy", "solved": true } ] } }
```
Errors: `400` invalid id, `404` not found.

### PATCH `/topics/:id`
Body: any of `title`, `description`, `notes` (max 5000), at least one required.
`200 OK`: `{ "topic": { ... } }`

### DELETE `/topics/:id`
`204 No Content`. All problems in the topic are deleted too.

---

## Problems

### GET `/topics/:topicId/problems`
Query (optional): `level` = `Easy | Medium | Hard`, `solved` = `true | false`.

`200 OK`
```json
{ "count": 1, "problems": [ { "id": 1, "topicId": 1, "name": "Two Sum", "level": "Easy", "solved": false, "createdAt": "2026-10-02 10:00:00" } ] }
```

### POST `/topics/:topicId/problems`
Body: `{ "name": "Invert Binary Tree", "level": "Easy" }` (`name` max 150; `level` one of Easy, Medium, Hard)

`201 Created`: `{ "problem": { ... } }`

### GET `/problems/:id`
`200 OK`: `{ "problem": { ... } }`

### PATCH `/problems/:id`
Body: any of `name`, `level`, `solved` (boolean), at least one required.
`200 OK`: `{ "problem": { ... } }`

### DELETE `/problems/:id`
`204 No Content`.

---

## Stats

### GET `/stats`
`200 OK`
```json
{
  "totalTopics": 6, "topicsFinished": 1, "totalProblems": 30, "solved": 5, "percent": 17,
  "byLevel": { "Easy": { "total": 13, "solved": 3 }, "Medium": { "total": 17, "solved": 2 } }
}
```

---

## Example session (curl)

```bash
# 1. Register and save the token
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Abhi","email":"abhi@example.com","password":"Secret123"}'

# 2. List topics
curl -s http://localhost:3000/api/topics -H "Authorization: Bearer $TOKEN"

# 3. Mark problem 1 as solved
curl -s -X PATCH http://localhost:3000/api/problems/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"solved":true}'
```
