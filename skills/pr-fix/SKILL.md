---
name: pr-fix
description: Work through a GitHub PR's open review comments — human and bot. Triages each as accept / push back / needs-decision, makes the accepted changes, puts those changes through built-in /code-review, then pushes and replies in every thread with the commit that addressed it or the reason it was declined. Skips resolved and already-answered threads, so it runs once per review round. Use when the user says "address the PR comments", "fix the review feedback", "reply to the bot comments", "resolve PR #N", or hands over a PR review to clear.
---

# pr-fix

Clears one round of a PR's review feedback: get the comments, decide what to accept and what to
push back on, make the accepted changes, review those changes, then answer every comment.

**Prerequisites:** `gh` CLI installed and authenticated. Run from inside the repo, on the PR's branch.

## Steps

1. **Identify the PR.** Use the number the user gave, else `gh pr view --json number,headRefName,url`.
   Capture `owner/repo` from `gh repo view --json nameWithOwner`. Confirm the repo with `git status`;
   uncommitted changes → stop and ask, since they'd ride into the fix commits. Not on the PR's branch
   → `gh pr checkout {N}`. Then `git pull`, so step 6's push isn't rejected, and record
   `start=$(git rev-parse HEAD)` — step 5 reviews from there.

2. **Get the open comments.** Two sources:
   - Inline threads, with their resolved state (the REST comments endpoint doesn't carry it):
     ```
     gh api graphql -F owner={owner} -F repo={repo} -F n={N} -f query='
       query($owner:String!,$repo:String!,$n:Int!){ repository(owner:$owner,name:$repo){
         pullRequest(number:$n){ reviewThreads(first:100){ nodes{ isResolved isOutdated path line
           comments(first:50){ nodes{ databaseId author{login} body } } } } } } }'
     ```
   - Review summaries and conversation comments: `gh pr view {N} --json reviews,comments`.

   Skip resolved threads, threads whose last comment is the PR author's, and top-level comments the
   author has since answered — that's what keeps a later round to its new comments. An outdated
   thread still counts if its point holds against the current code.

3. **Decide: accept or push back.** Read each comment against the current code:
   - **accept** — a real issue whose fix belongs in this PR.
   - **push back** — the comment is wrong (misreads the code, already handled, intended) or asks for
     something outside this PR. Note the reason, grounded in the code; it becomes the reply.
     On a stacked PR (its base isn't the default branch), "already handled" includes a later branch
     in the stack — check them before accepting, and name the branch in the reply.
   - **needs-decision** — a genuine judgement call that's mine: a trade-off, a scope change, or a
     request that contradicts what the PR set out to do.

   Show me the triage as a table (comment → bucket → one-line reason) before changing any code, then
   carry on. Hold needs-decision items for step 8 rather than stalling on them.

4. **Make the accepted changes.** Minimal and in scope — reuse existing patterns, no drive-by
   refactors. Run the project's lint, typecheck and the tests the change touches, using the commands
   the repo declares (manifest scripts, task runner or CI config) — read them, don't guess a package
   manager. For a UI change, check it in the browser. Commit with `/commit`, one logical change per
   commit, so each reply can name its commit. Nothing accepted → skip to step 7.

5. **Code-review the changes.** Built-in `/code-review` on `git diff $start..HEAD` — only what this
   pass changed, not the whole PR — at an effort proportional to that diff. Don't pass `--fix`: triage
   its findings the same way, fix and commit what's real and in scope (re-running step 4's checks),
   and drop what isn't. Re-review just the new commits; stop when nothing actionable is left. If a
   round only turns up consequences of the last round's fixes, stop and tell me.

6. **Push** to the PR branch, before replying — a reply should point at code the reviewer can see.
   On a stacked PR, tell me which branches above it now need updating; don't rebase or merge them.

7. **Reply to every comment you handled.** Write each reply to a file and post it from there, so
   apostrophes and backticks survive the shell:
   - inline thread → `gh api repos/{owner}/{repo}/pulls/{N}/comments/{first comment's databaseId}/replies -F body=@reply.md`
   - review summary or conversation comment → `gh pr comment {N} --body-file reply.md`

   accept → what changed, with the commit sha. push back → why, grounded in the code.
   needs-decision → reply once I've decided (step 8).
   **A sentence or two each.** These are public threads a reviewer reads in bulk, and a paragraph
   answering a one-line bot nit reads worse than a short answer — point at the commit or file rather
   than restating the diff in prose.

8. **Summarise.** A table: each comment → bucket → commit sha or reason, plus what `/code-review`
   caught and the PR's current mergeability. Put any needs-decision items to me as one question; once
   I answer, run steps 4–7 for whatever that changes. Then offer — don't do — asking the reviewer for
   another look (`gh pr edit {N} --add-reviewer <login>`, an @mention, or however I'd rather reach them).

## Notes
- Bot threads get the same treatment as human ones — reply even when it's a push back.
- Leave resolving threads to the reviewer.
- If `gh` or the network is blocked, say so in one line and stop — don't work around the toolchain.
