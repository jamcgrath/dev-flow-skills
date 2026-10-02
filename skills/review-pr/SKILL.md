---
name: review-pr
description: Review someone else's GitHub PR on two separate axes — bugs (built-in /code-review at an effort level picked from the PR's size and risk) and spec (a subagent, on a model picked the same way, checking the diff against the ticket it claims to close). Every bug finding must pass a scope test (in what this PR changed or introduces) and a trigger test (a named, realistic input that breaks it); the rest is listed as dropped, not raised. Reports the axes side by side with a recommended verdict and posts each round's kept findings to the PR (approval only on request); under /loop it re-reviews each new push and stops once it recommends approval. Use when the user says "review PR #N", "review this PR", "re-review", or acts on a review row from /pr-status. Not for your own PRs — that's /pr-fix for comments and dev-flow's review step for the build.
---

# review-pr

Reviews a colleague's PR the way you'd want to be reviewed: only what this PR is responsible for,
only what can actually break, and against what it was asked to do.

**Prerequisites:** `gh` CLI installed and authenticated; the Atlassian Rovo MCP for Jira tickets.
Run from inside a clone of the PR's repo — no checkout needed.

## Steps

1. **Read the PR.** `gh pr view {N} --json number,title,url,body,author,headRefName,headRefOid,additions,deletions,changedFiles,files,closingIssuesReferences,isDraft`,
   and capture `owner/repo` from `gh repo view --json nameWithOwner`. On a re-review, also find your
   last review's commit (`gh api repos/{owner}/{repo}/pulls/{N}/reviews`, your latest non-pending one)
   and the files changed since it (`gh api repos/{owner}/{repo}/compare/{oid}...{headRefOid}`).

2. **Size and risk it, then pick the level and model.** Size is added + deleted lines, ignoring
   lockfiles, generated files and snapshots. Risk is the paths and what they touch: auth, sessions or
   permissions; payments; DB migrations or schema; infra and deploy config (CI workflows, `wrangler`,
   Terraform); input handling that reaches a query, a shell or HTML; concurrency or caching.

   | PR | `/code-review` level | spec model |
   |---|---|---|
   | under ~100 lines, no risk | `low` | `sonnet` |
   | under ~500 lines, or small but risky | `medium` | `sonnet` |
   | ~500+ lines, or risky and ~100+ | `high` | `opus` |

   Never `xhigh`, `max` or `ultra` — the higher levels widen coverage mostly with uncertain findings,
   which step 5 would drop anyway. State the choice and the reason in one line, then carry on.

3. **Find the spec.** In order: the PR's `closingIssuesReferences` (`gh issue view`); a Jira key
   (`[A-Z][A-Z0-9]+-[0-9]+`) in the title, branch or body, fetched with the Rovo MCP's `getJiraIssue`;
   a path or ticket I passed. Nothing found → the spec axis is skipped and the report says so. The PR
   description is not a spec — it's the author's account of what they did.

4. **Run both axes.** Start the spec subagent first (Agent tool, `model` from step 2, in the
   background), then run the bug axis while it works.
   - **Spec subagent prompt:** the PR number and `gh pr diff {N}`, the ticket text, and the brief:
     "Report (a) what the ticket asks for that is missing or partial, (b) what looks implemented but
     wrong, (c) behaviour the ticket didn't ask for. Quote the ticket line for each. Under 400 words."
   - **Bug axis:** built-in `/code-review <level> {N}`. No `--comment`, no `--fix` — nothing reaches
     the PR before step 5 has filtered it.

5. **Filter every bug finding.** Keep it only if it passes both:
   - **Scope** — it sits in lines this PR changed, or in behaviour it introduces; on a re-review,
     in lines changed since your last review. A problem in code the PR didn't touch fails, unless
     this PR is what makes it reachable.
   - **Trigger** — you can name the realistic input or sequence that breaks it. "If X were null"
     with no path by which X is null fails.

   Mark each kept finding **blocking** (wrong behaviour a user or the system will hit) or
   **suggestion** (works, but worth raising). Everything that fails a test goes to Dropped with the
   test it failed. On a re-review, a finding the author already answered with a reason isn't raised
   again unless the new commits change that code — it goes to Dropped as "answered".

6. **Report.** Three sections, axes kept apart — don't merge or re-rank across them:
   - `## Bugs` — kept findings: file:line, blocking/suggestion, the trigger, one or two sentences.
   - `## Spec` — the subagent's report, lightly cleaned, or "no spec found".
   - `## Dropped` — one line each: the finding and which test it failed, so I can overrule.

   End with a recommended verdict and the counts behind it — the decision stays mine:
   - **approve** — no blocking findings in this round, every earlier blocking finding fixed or
     answered with a reason that holds, nothing missing or wrong on the spec axis, CI green and
     mergeable. Suggestions ride along as non-blocking comments; they never justify another round.
   - **request changes** — any blocking finding, or a spec gap.
   - **comment** — no blocking findings, but CI or mergeability is red, or the spec couldn't be
     checked.

7. **Post the round.** Every round — the first review, every re-review, every "another round" —
   ends with the kept findings on the PR, without waiting to be asked. Write
   `{"event": "REQUEST_CHANGES" | "COMMENT", "body": …, "comments": [{"path", "line", "side": "RIGHT", "body"}]}`
   to a file and `gh api repos/{owner}/{repo}/pulls/{N}/reviews -X POST --input review.json`:
   `REQUEST_CHANGES` when anything is blocking, else `COMMENT`. Inline comments for findings with a
   line, spec gaps and the rest in the body; on a re-review, only what's new this round. Never the
   Dropped list. A sentence or two per comment, phrased as a reviewer to a colleague. Confirm the
   post landed (`gh pr view {N} --json reviews`) and give me its link.

   **Approve is the exception.** An approve verdict is put to me with the suggestions it would
   carry; post `APPROVE` (suggestions as inline comments) only when I say so.

## Under `/loop`
Run as `/loop 20m /review-pr {N}` from a clone of the repo. Each tick:

- **Stop first** if the PR is merged or closed — notify, end the loop.
- **New commits?** Compare the PR's `headRefOid` with the head you last reviewed (in this
  conversation, else your last posted review's commit). No earlier review → a full review, steps
  1–6. Unchanged → one line, `#{N}: no new commits`, nothing else. Changed → a re-review of the
  commits since, steps 1–6.
- **Notify** with the round's verdict, one line: `#{N}: request changes — 1 blocking in new
  commits` or `#{N}: recommend approve — 0 blocking, 2 suggestions`.
- **Each round is posted** (step 7) before the notification, so the author sees it without me.
- **Recommend approve → end the loop.** That's the point where further rounds would only be
  suggestions. The approval itself waits for me.

**Ending the loop:** a fixed-interval loop is a session cron job — `CronList`, then `CronDelete` the
one whose prompt is this command. A self-paced loop — `ScheduleWakeup` with `stop: true`.
**Notify** with the PushNotification tool when it's available.

## Notes
- `/code-review` takes no model argument, so the bug axis runs on the session's model; only the spec
  axis's model is picked per PR.
- A draft PR gets the same review; say it's a draft in the summary line.
- If `gh` or Rovo is unavailable, say so in one line — without Rovo, a Jira-only spec skips that axis.
