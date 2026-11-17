---
name: verify-ticket
description: Check an externally written ticket, issue or brief against the actual codebase before planning. Fetches it (Jira via Rovo, a GitHub issue via gh, or pasted text) with any handoff or research notes, cross-references every file, component, function and term against the repo, and writes a corrected .dev-flow/<task>/TICKET_CONTEXT.md. Optional; skip it for a task you defined yourself. Use when the user says "verify ticket", "validate this ticket against the code", or "check the ticket before planning".
---

# verify-ticket

Externally written work items — a Jira ticket, a GitHub issue, an AI-written brief — drift from the
code: they name files that were renamed, components that were deleted, behaviour that no longer
holds. This checks the description against the repo before any planning, so plan mode starts from
something true. It answers one question — **is this description true against the code?** — and
doesn't design the change. With no externally written item, skip it and start at `/plan-brief`.

**It flags and flows; it is not a gate.** Drift is recorded as a **Flag** and the flow continues;
forks are decided at the PLAN gate. The one thing that stops it is a **confabulation**: a ticket
premised on something the repo isn't (step 5). A few wrong file names is drift; a false premise is
a wrong ticket.

## Steps

1. **Get the work item.** Take whatever the user has: a Jira key (`[A-Z][A-Z0-9]+-[0-9]+`), a
   GitHub issue number/URL, or pasted ticket/brief text. If they have none — or they defined the
   task themselves — this skill doesn't apply; point them to `/plan-brief`. Also take any
   **supplementary context files** passed alongside it (paths to handoff notes or prior research) —
   optional, zero or more.

2. **Fetch it** from whichever source it is:
   - **Jira** → the **Atlassian Rovo MCP** (`getJiraIssue` for title/description/acceptance/labels;
     `lookupJiraAccountId` / `searchJiraIssuesUsingJql` only to resolve the key or related issues).
   - **GitHub issue** → `gh issue view <n> --json title,body,labels` (accepts a number or URL).
   - **Pasted text** → use it directly.
   - **Supplementary files** (if any) → read each path directly.
   If the fetch tool you need (Rovo / `gh`) isn't available, say so in one line and either take the
   text pasted instead or stop — don't work around it.

3. **Extract every concrete reference** the ticket — and any supplementary files — make: file names,
   component names, function names, routes, env vars, and domain terminology.

4. **Cross-reference each against the current repo** with file search + grep. Hand the broad
   searching to an `Explore` subagent so it stays off the main thread. Classify each reference:
   - **current** — exists as named, unchanged
   - **renamed** — exists under a different name (find and record the new one)
   - **deleted** — gone, nothing equivalent (flag)
   - **not found** — never existed / ambiguous (flag)

   This includes a supplementary file's own code citations — **confirm a note's `file:line` claim
   against the repo before you lean on it** (build on the review, don't trust it blind). A claim that
   doesn't check out is a flag, not a resolution.

5. **Check behaviour + terms — and the premise.** Flag any behaviour that conflicts with how the code
   actually works, and any terminology that doesn't match the repo's conventions. **Derive conventions
   from the codebase — never assume the stack.** Then test the ticket's *premise*: **"does this only
   make sense if the repo already had X — and it doesn't?"** If yes — it assumes a
   framework / service / architecture is **already there when it isn't** (a React component in a
   non-React app; nginx / Redis behaviour where neither exists) — that's a **confabulation** → **stop and escalate**
   (step 7, Guards). Everything short of that is drift → flag and flow: asking to *add* the thing is a
   feature, and **within-stack misattribution** (right stack, wrong layer or file — a Workers feature
   that actually lives in the Pages layer) is drift. Only a *missing-stack* premise stops the flow.

   A supplementary file may also **resolve** one of the ticket's open questions (record it resolved
   **only if its claim checked out in step 4**) or **contradict** the ticket — a flag, never a silent
   pick.

6. **Write `.dev-flow/<task>/TICKET_CONTEXT.md`** (create the dir if missing) — `<task>` is the
   ticket key, else a short kebab-case slug:

   ```
   ## Sources
   [The ticket, plus any supplementary files reconciled — so the reader knows what fed this]

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

   With a supplementary file, **cite the source inline** (no extra column): a note that **resolves** a
   question (and checked out in step 4) gets Action *"resolved by <source>, confirmed <citation> — not
   carried"* so `plan-brief` leaves it alone; a note that **conflicts** with the ticket is flagged
   (Reality: *"ticket says … / note says …"*), never silently resolved.

7. **Hand off — don't wait.** Confirm `TICKET_CONTEXT.md` is written, summarise the Flags out loud,
   then **continue without pausing for answers** into `/plan-brief`. Don't turn a Flag into a
   question: open forks travel to the PLAN gate in `plan-brief`'s Open Questions (run standalone,
   they wait in `TICKET_CONTEXT.md`). The one exception is a **confabulation** (step 5): don't
   hand off — surface the evidence doc and let the human override-and-proceed or kill it (Guards).

## Guards
- **Don't invent.** An ambiguous reference is a Flag — an open fork for the PLAN gate — never a
  guessed resolution, and never a question to ask now.
- **On a confabulation, write the evidence, present it, and let the human override or kill it.**
  Never abort silently.
- **Supplementary files are evidence, not truth.** The code is the arbiter: a note closes a fork
  only when its claim checks out, a note-vs-ticket conflict is a Flag, and a design suggestion in a
  note is a fork for the PLAN gate.
- Write only inside `.dev-flow/<task>/`; never touch `.git/` or a shared `.gitignore`.
