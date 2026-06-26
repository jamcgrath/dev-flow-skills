---
name: verify-ticket
description: Validate an externally-authored ticket, issue, or brief against the actual codebase before planning — fetch it (Jira via the Atlassian Rovo MCP, a GitHub issue via `gh`, or pasted text), cross-reference every file/component/function/term it mentions against the current repo, and write a corrected .dev-flow/<task>/TICKET_CONTEXT.md. OPTIONAL and tracker-agnostic — use it only when a description written elsewhere needs reality-checking; for an ad-hoc task you defined yourself, skip straight to /plan-brief. Use when the user says "verify ticket", "validate this ticket/issue against the code", or "check the ticket before planning". Catches the stale file refs and renamed components that AI-written tickets are full of.
---

# verify-ticket

Externally-authored work items — a Jira ticket, a GitHub issue, an AI-written brief — drift from
the code: they name files that were renamed, components that were deleted, behaviour that no
longer holds. This skill reality-checks that description against the repo you're in *before* any
planning, so plan mode starts from something true.

**Optional, conditional first step** of the feature path: **(`verify-ticket`) → `plan-brief` →
`/plan` mode.** Use it only when there's a description *written elsewhere* to reconcile. If you
defined the task yourself against the current code, there's nothing to verify — **skip straight
to `/plan-brief`.** It answers one question — **is this description true against the code?** — and
nothing more; it doesn't design the change (that's `plan-brief` + plan mode).

## Steps

1. **Get the work item.** Take whatever the user has: a Jira key (`[A-Z][A-Z0-9]+-[0-9]+`), a
   GitHub issue number/URL, or pasted ticket/brief text. If they have none — or they defined the
   task themselves — this skill doesn't apply; point them to `/plan-brief`.

2. **Fetch it** from whichever source it is:
   - **Jira** → the **Atlassian Rovo MCP** (`getJiraIssue` for title/description/acceptance/labels;
     `lookupJiraAccountId` / `searchJiraIssuesUsingJql` only to resolve the key or related issues).
   - **GitHub issue** → `gh issue view <n> --json title,body,labels` (accepts a number or URL).
   - **Pasted text** → use it directly.
   If the fetch tool you need (Rovo / `gh`) isn't available, say so in one line and either take the
   text pasted instead or stop — don't work around it.

3. **Extract every concrete reference** the ticket makes: file names, component names, function
   names, routes, env vars, and domain terminology.

4. **Cross-reference each against the current repo** with file search + grep. Hand the broad
   searching to an `Explore` subagent so it stays off the main thread. Classify each reference:
   - **current** — exists as named, unchanged
   - **renamed** — exists under a different name (find and record the new one)
   - **deleted** — gone, nothing equivalent (flag)
   - **not found** — never existed / ambiguous (flag)

5. **Check behaviour + terms.** Note any behaviour the ticket describes that conflicts with how
   the code actually works, and any terminology that doesn't match the repo's conventions.
   **Derive conventions from the codebase you're in — never assume the stack.**

6. **Write `.dev-flow/<task>/TICKET_CONTEXT.md`** (create the dir if missing) — `<task>` is the
   verified ticket key, so each task's context sits in its own subdirectory and a new run never
   overwrites the last:

   ```
   ## Intent
   [What the ticket is actually asking for, in plain language]

   ## Acceptance Criteria
   [One criterion per line, each prefixed with a verdict and a code citation where it applies:
    [verified] … · [contradicted → revise] … · [unverifiable] …]

   ## Relevant Files
   [Files to modify or reference, with current, confirmed paths]

   ## Codebase Notes
   [Similar existing patterns found; conventions to follow]

   ## Flags
   | Ticket said | Reality | Action |
   |---|---|---|
   | <reference> | current / renamed → <new> / deleted / not found / contradicted | <what to do instead> |
   ```

7. **Hand off.** Confirm it's written, summarise the Flags out loud, then point to the next
   step: `/plan-brief`, or straight into `/plan` mode referencing `.dev-flow/<task>/TICKET_CONTEXT.md`.

## Guards
- **Don't invent.** If a reference is ambiguous, record it under Flags as an open question —
  never guess a resolution just to make the ticket look clean.
- Used only when there's an **externally-authored** item to reconcile (Jira / GitHub / brief).
  No such item — or a task you defined yourself against current code — → skip this skill and
  start at `/plan-brief`.
- `.dev-flow/` is meant to be git-ignored globally (one-time flow setup); this skill writes only
  inside `.dev-flow/<task>/` and never touches `.git/` or a shared `.gitignore` itself.
