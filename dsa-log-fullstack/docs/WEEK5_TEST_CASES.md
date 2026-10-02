# Week 5 Test Case Checklist

Use this checklist after installing the project dependencies and starting the server.

| ID | Test case | Expected result |
|---|---|---|
| TC-01 | Open `/` | Home page loads |
| TC-02 | Open `/login.html` | Login page loads |
| TC-03 | Register with valid name/email/password | Account is created and user reaches dashboard |
| TC-04 | Register with a weak password | Validation message is displayed |
| TC-05 | Register the same email twice | Duplicate account is rejected |
| TC-06 | Login with correct credentials | Dashboard opens |
| TC-07 | Login with wrong password | Login fails with an error message |
| TC-08 | Open dashboard without a token | User is redirected to login |
| TC-09 | Add a topic | Topic appears in the dashboard |
| TC-10 | Search for an existing topic | Matching topic remains visible |
| TC-11 | Use Not Started filter | Only topics with no solved problems are shown |
| TC-12 | Solve one problem in a topic | Topic moves to In Progress |
| TC-13 | Solve all problems in a topic | Topic moves to Done |
| TC-14 | Open a topic | Problems and progress are displayed |
| TC-15 | Filter problems by Easy/Medium/Hard | Only the selected difficulty is shown |
| TC-16 | Mark a problem solved | Progress changes immediately and remains after refresh |
| TC-17 | Add a new problem | New problem appears |
| TC-18 | Delete a problem | Problem disappears |
| TC-19 | Add and edit notes | Notes are saved and remain after refresh |
| TC-20 | Delete a topic | Topic and its problems are removed |
| TC-21 | Log out | Token is cleared and login page is shown |
| TC-22 | Stop the server and refresh dashboard | User sees a connection error/retry message |
| TC-23 | Open a nonexistent API route | JSON 404 response is returned |
| TC-24 | Submit invalid JSON to an API endpoint | JSON 400 response is returned |
| TC-25 | Send an oversized request body | JSON 413 response is returned |

## Security-focused checks

- A user cannot access another user's topic by changing the topic ID.
- A user cannot update another user's problem.
- Invalid authentication tokens are rejected.
- Password hashes are not returned by registration/login responses.
- User-entered topic/problem text is escaped before being inserted into frontend HTML.

## Performance check

Run:

```bash
npm run profile
```

The script compares the previous application-level topic filtering approach with the SQL `HAVING` approach on a repeatable in-memory dataset.

Do not copy a benchmark percentage from another computer. Record the number printed by the script when you run it on the machine used for the final submission.
