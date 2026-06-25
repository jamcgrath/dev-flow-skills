---
name: pr-fix
description: Resolve all open review comments on a GitHub PR — human and bot (Gemini, Copilot, CodeRabbit) — then reply to each thread. Triages each comment as actionable / false-positive / needs-decision, applies the actionable fixes, runs the project's lint/typecheck, replies to every thread (including bot threads) explaining the resolution, and commits + pushes. Use when the user says "address the PR comments", "fix the review feedback", "reply to the bot comments", "resolve PR #N", or hands over a PR review thread to clear.
---

# pr-fix

Clears a PR's review feedback end-to-end: fetch every comment, fix what's real, reply to every thread, push. Built for the recurring "address all N comments across M files, then reply to each" loop.

**Prerequisites:** `gh` CLI installed and authenticated. Run from inside the repo, on the PR's branch (or pass the PR number).

## Steps

1. **Identify the PR.** Use the number the user gave, else `gh pr view --json number,headRefName,url`. Capture `owner/repo` from `gh repo view --json nameWithOwner`.

2. **Fetch all feedback.** There are two kinds — get both:
   - Inline (line-level) review comments — these are the ones that need threaded replies:
     `gh api repos/{owner}/{repo}/pulls/{N}/comments --paginate`
     (keep each comment's `id`, `path`, `line`, `user.login`, `body`.)
   - Top-level PR + review-summary comments:
     `gh pr view {N} --comments`

3. **Triage each comment** into one of three buckets — do NOT blindly apply:
   - **actionable** — a real issue; fix it.
   - **false-positive** — bot or human is wrong (already handled, intended, misreads the code). Don't change code; you'll explain why in the reply.
   - **needs-decision** — genuine judgment call that's mine to make.
   Show me the triage as a short table before doing big batches.

4. **Apply actionable fixes, one at a time.** Keep each change minimal and in-scope — reuse existing patterns, no drive-by refactors (see global "Solve it the lean way").

5. **Verify.** Run the project's lint + typecheck (this repo: `pnpm lint` / `pnpm check`, or the package's own scripts). For UI/behavioural fixes, verify in the browser. Report what you observed.

6. **Reply to every thread.** Reply to each inline comment in its own thread so it threads correctly:
   `gh api repos/{owner}/{repo}/pulls/{N}/comments -f body='<reply>' -F in_reply_to=<comment_id>`
   - actionable → what you changed (and the commit/file).
   - false-positive → why no change is needed, grounded in the actual code.
   For top-level/summary feedback, reply with `gh pr comment {N} --body '<reply>'`.

7. **Commit & push.** One clear commit (or grouped commits) describing the fixes; push to the PR branch. Confirm the repo with `git status` first; never touch `.git`.

8. **Summarise.** End with a table: each comment → bucket → action taken, plus current mergeability. Batch any **needs-decision** items into a single question for me at the end — don't stall the rest of the loop on them.

## Notes
- Bot threads (Gemini/Copilot/CodeRabbit) get the same treatment as human ones — reply even when it's a false positive.
- If `gh` or the network is blocked, say so in one line and stop — don't work around the toolchain.
