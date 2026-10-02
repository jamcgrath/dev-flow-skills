---
name: pr-status
description: One read-only view of every open PR that involves you, across all repos — your own PRs (unanswered review threads and comments, review decision, CI, conflicts) and PRs waiting on your review (never reviewed, re-review requested, new commits since your review, replies to your comments) — each with the next action and the branch to take it on. Changes nothing. Built to run under /loop in one dedicated session, sending a push notification only when something changes. Use when the user says "pr status", "what needs me", "which PRs need attention", "check my reviews", or wants to keep track of review rounds across sessions.
---

# pr-status

Tells you which PRs need you and what to do about each. It only reads — acting happens in the
PR's own session: `/pr-fix` for your PRs, `/review-pr <PR#>` for someone else's.

**Prerequisites:** `gh` CLI installed and authenticated. Runs from any directory.

## Steps

1. **Get the status.** Run `python3 <this skill's base directory>/pr_status.py`. One GraphQL call
   returns two markdown tables: **Your PRs** and **To review**, rows needing action first. If it exits
   with `gh failed: …`, show that line and stop — don't work around the toolchain.

2. **Show it.** Print the tables as they come. Don't re-derive or re-rank the rows; the script's
   rules are deliberate (see Notes).

3. **Under `/loop`, report changes only.** Compare each row's **Next** with the previous run's output
   in this conversation.
   - Something changed — a new PR, or a PR's Next is now an action (e.g. `waiting on review` →
     `/pr-fix: 2 threads unanswered`, `nothing new` → `re-review: new commits since your review`):
     send a push notification if the PushNotification tool is available, one line per change
     (`spork-audio-browser#16: 2 threads unanswered`), then print the full tables.
   - Nothing changed: print one line, `No change since <time of last change>`, not the tables.

4. **Don't act on it.** No checkout, no comments, no reviewer requests, no running `/pr-fix` or
   `/review-pr` from here. The row names the branch; you take the action in that PR's session or
   worktree.

## Notes
- Start it with `/loop 20m /pr-status` in a session you keep open just for this.
- **Unanswered** uses `/pr-fix`'s rule, so the count matches what it would pick up: an unresolved
  thread whose last comment isn't yours, or a comment or comment/changes-requested review body
  posted after your last top-level comment. An approval's body doesn't count, nor do top-level
  comments from bot accounts (deploy previews); bot reviews and threads do.
- **To review** covers PRs requesting your review plus open PRs you've already reviewed. A PR you
  only commented on, without being asked or reviewing, isn't listed. One not updated in a sprint
  (14 days, `STALE_DAYS`) is hidden and counted in a closing line; your own PRs show at any age.
- Each list caps at 30 PRs.
