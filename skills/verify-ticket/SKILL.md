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

**It is not a gate — it flags and flows.** Drift is the normal finding: a renamed file, a deleted
component, an already-built criterion, an under-specified detail (a header value the ticket never
pins down). All of it gets **recorded as Flags** and the flow continues to `plan-brief`; the decisive
ones resurface as questions at the **PLAN gate**, where forks belong — never here. The **one** thing
that stops the flow is a **confabulation**: a ticket premised on something false about the repo *as it
is* — it assumes a framework, service, or architecture already exists that doesn't, so the work as
framed can't even start. *A few wrong file names is drift; a false premise is a wrong ticket.* (Asking
to *introduce* something new — a dependency, caching where there's none — is a feature, not a
confabulation: flag the unknowns and flow.)

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

5. **Check behaviour + terms — and the premise.** Note any behaviour the ticket describes that
   conflicts with how the code actually works, and any terminology that doesn't match the repo's
   conventions. **Derive conventions from the codebase you're in — never assume the stack.** Then step
   back from the individual references to the ticket's *premise* and apply one test: **"does this only
   make sense if the repo already had X — and it doesn't?"** If yes — it's built on a
   framework / service / architecture it assumes *already exists* but that isn't here (a React
   component in an app that isn't React; nginx or Redis behaviour where neither is in the stack) —
   that's a **confabulation**, not a flag → **stop and escalate** (see step 7 and Guards). Contrast: a
   ticket that asks to **add** that thing is a normal feature → flag any unknowns and flow. And
   **within-stack misattribution** — right stack, wrong layer or file (a Workers feature the ticket
   pins on the Worker when it actually lives in the Pages layer; a thing already built elsewhere) — is
   drift, not confabulation → flag and flow. Only a **missing-stack** premise stops the flow: a wrong
   reference or wrong layer is drift; a premise that assumes an absent stack is a wrong ticket.

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

7. **Hand off — don't wait.** Confirm `TICKET_CONTEXT.md` is written and summarise the Flags out loud,
   then **continue to the next step without pausing for answers**: `/plan-brief`, or straight into
   `/plan` mode referencing `.dev-flow/<task>/TICKET_CONTEXT.md`. **Do not turn a Flag into a question
   and stop** — open forks travel forward to the **PLAN gate** (carried in `plan-brief`'s Open
   Questions), which is where a human decides them. (Run standalone, outside the flow, there is no PLAN
   gate — the forks simply wait in `TICKET_CONTEXT.md` for you.) The single exception is a **confabulation** (step
   5): there, the doc you just wrote *is* the evidence — surface it, say plainly why the ticket reads
   as premised on something the repo isn't, and **let the human override-and-proceed or kill it**.
   That's a fail-closed escalation (it holds on the auto path too), not a silent abort.

## Guards
- **Don't invent.** If a reference is ambiguous, record it under Flags as an **open fork to raise at
  the PLAN gate** — never guess a resolution just to make the ticket look clean, and never read
  "open" as "ask the user now."
- **Don't stop the flow — one exception.** verify-ticket is not a gate. Every mismatch — stale ref,
  renamed / deleted component, already-built criterion, under-specified detail — is a **Flag**, and the
  flow continues; decisive forks are raised at the PLAN gate, not here. **Stop only on a confabulation**
  — a ticket premised on something false about the repo as it is (step 5) — and even then **write the
  evidence, present it, and let the human override or kill**, rather than aborting silently. Fail-closed:
  this escalation holds on the auto path too.
- Used only when there's an **externally-authored** item to reconcile (Jira / GitHub / brief).
  No such item — or a task you defined yourself against current code — → skip this skill and
  start at `/plan-brief`.
- `.dev-flow/` is meant to be git-ignored globally (one-time flow setup); this skill writes only
  inside `.dev-flow/<task>/` and never touches `.git/` or a shared `.gitignore` itself.
