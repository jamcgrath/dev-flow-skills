---
name: plan-brief
description: First-pass info-gathering for a feature — read .dev-flow/<task>/TICKET_CONTEXT.md if it exists, otherwise work straight from the task description the user gives (ticket or no ticket), reconnoitre the codebase (files likely to change, similar implementations, related tests, constraints), and write .dev-flow/<task>/PLAN_BRIEF.md as grounded input for /plan mode. The portable entry to the feature path — works with or without a tracker; no Jira required. Reconnaissance, not a plan — it gathers context and stops; it does not design the approach or edit code. Use when the user says "plan brief" or "gather context for the plan".
---

# plan-brief

A **first pass that gathers context** for `/plan` mode — reconnaissance, not a plan. It finds
what's relevant to touch so plan mode designs from a grounded base. It deliberately **stops at
gathering**: it does not choose the approach, make decisions, or edit anything. That is `/plan`
mode's job, behind your approval gate.

Second step of the feature path **when there's a ticket** (`verify-ticket` → **`plan-brief`** →
`/plan`); the **first** step when there isn't. Either way it's the portable funnel into plan mode
— no tracker required. A trivial, already-clear fix can skip straight to plan mode.

## Steps

1. **Get the starting context.** Read `.dev-flow/<task>/TICKET_CONTEXT.md` if it exists (from
   `/verify-ticket`). If it doesn't, that's fine — **no ticket is a normal entry, not a fallback**:
   work from whatever the user gives (a typed task description, a GitHub issue, an AI brief). If
   even that is thin, ask one question to pin the goal before reconnoitring.

2. **Reconnoitre the codebase** — hand the searching to an `Explore` subagent. **If you have
   `TICKET_CONTEXT.md`, build on it — don't restate its Codebase Notes; without it, gather the
   conventions here.** Your job is the net-new, change-specific recon:
   - the exact **files (and line anchors)** likely to change to satisfy the intent
   - the **closest existing implementation to copy**, named with its path + lines
   - **related tests** that cover the area
   - constraints **specific to this change** that aren't already in `TICKET_CONTEXT` — read them
     out of the existing code; never assume the stack.

   When hunting the closest existing implementation in a **large or unfamiliar** module, the
   `Explore` agent may run `repomix --compress --include '<subtree>' --stdout` to get a complete
   signature map in one pass (catches a reusable thing iterative grep would miss). Always inside
   the subagent so the pack stays off the main thread; always `--compress` and always `--include`
   scoped to the relevant subtree — never unscoped or full-content (it floods context and adds
   nothing over reading the few files that matter). For a bounded module, skip it — Explore
   reading the real files is simpler and just as good.

3. **Bound it.** Note what's explicitly **out of scope**, and list **open questions** that need
   a human decision before building.

4. **Write `.dev-flow/<task>/PLAN_BRIEF.md`** (create the dir if missing) — `<task>` is the ticket
   key when there is one (reuse the subdirectory `/verify-ticket` made), else a short kebab-case slug
   of the task, so each task keeps its own context:

   ```
   ## Goal
   [Single sentence: what this change achieves]

   ## Files to Modify
   [List, each with a one-line reason]

   ## Files for Context (read only)
   [Related files plan mode should read but not change]

   ## Similar Patterns in Codebase
   [The closest existing implementation(s) to copy, named with file + line anchors]

   ## Constraints
   [Only rules specific to THIS change and not already in TICKET_CONTEXT — reference it, don't repeat it]

   ## Out of Scope
   [What this change should not touch]

   ## Open Questions
   [Anything needing a human decision before building]
   ```

5. **Hand off.** Confirm it's written, then: enter `/plan` mode referencing
   `.dev-flow/<task>/PLAN_BRIEF.md`.

## Guards
- **Gather, don't design.** No approach decisions, no edits — if you're tempted to pick a
  solution, that belongs in `/plan` mode. Surface the choice as an Open Question instead.
- **Don't duplicate `TICKET_CONTEXT`.** It already captured the intent, conventions, and flags —
  build on them. If `plan-brief` would mostly restate it, the ticket was simple enough to skip
  straight to `/plan` mode.
- Keep it a first pass: enough to ground plan mode, not an exhaustive audit.
