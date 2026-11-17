---
name: plan-brief
description: Gather context for planning a feature, with or without a ticket. Reads .dev-flow/<task>/TICKET_CONTEXT.md if it exists, else the task as given, surveys the codebase (files likely to change, similar implementations, related tests, test tooling, constraints, past decisions on those files), and writes .dev-flow/<task>/PLAN_BRIEF.md for /plan mode. Gathers only; it doesn't design the approach or edit code. Use when the user says "plan brief" or "gather context for the plan".
---

# plan-brief

A first pass that gathers context for `/plan` mode — reconnaissance, not a plan. It finds what's
relevant so plan mode designs from a grounded base, and **stops at gathering**: choosing the
approach is plan mode's job, behind the approval gate. It follows `/verify-ticket` when there's a
ticket and comes first when there isn't. Outside `/dev-flow` a trivial, clear fix can skip it;
under the flow it always runs, since later steps read its Test Tooling inventory.

## Steps

1. **Get the starting context.** Read `.dev-flow/<task>/TICKET_CONTEXT.md` if it exists (from
   `/verify-ticket`). If it doesn't, that's fine — **no ticket is a normal entry, not a fallback**:
   work from whatever the user gives (a typed task description, a GitHub issue, an AI brief). If
   even that is thin, ask one question to pin the goal before reconnoitring.

2. **Reconnoitre the codebase** — hand the searching to `Explore` subagent(s), **fanned out in
   proportion to the surface**. A bounded, familiar area needs **one**. A **broad or unfamiliar** one
   gets **2–3 in parallel**, each tracing a
   **distinct facet** so they don't overlap — e.g. the closest similar feature end-to-end · the
   architecture and control-flow of the target area · the test-and-tooling landscape · the
   extension/integration points this change plugs into. Then **read the union of the files they
   surface** before writing the brief — the subagents locate code, they don't vet it, so the judgement
   of what actually matters happens here on the main thread. **If you have
   `TICKET_CONTEXT.md`, build on it — don't restate its Codebase Notes; without it, gather the
   conventions here.** Your job is the net-new, change-specific recon:
   - the exact **files (and line anchors)** likely to change to satisfy the intent
   - the **closest existing implementation to copy**, named with its path + lines
   - **related tests** that cover the area
   - **the test tooling the repo actually has** — inventory the frameworks + their run commands from
     `package.json` scripts/devDeps and config files (`playwright.config`, `vitest.config`,
     `jest.config`, `pytest.ini`, `go test`, …), and note **which layer each covers** (Playwright /
     Cypress → UI/e2e; Vitest / Jest / Mocha → unit/component; supertest / integration runners → API;
     DB-backed tests → data), and any **property-testing library** (fast-check, Hypothesis, proptest).
     Note separately whether an **accessibility harness** exists
     (`@axe-core/*`, `jest-axe`, `pa11y`, Playwright's role / accessible-name matchers) — the UI
     layer's a11y baseline is gated on one. Flag any layer this change touches that has **no** tooling
     — those criteria will be unverifiable to any test authored for them.
   - constraints **specific to this change** that aren't already in `TICKET_CONTEXT` — read them
     out of the existing code; never assume the stack.
   - **past decisions on those files** — once the files to change are known, read their commit
     history yourself rather than in a subagent:
     `git log -n 20 --format='%h %ad %s%n%b' --date=short -- <files>`. Keep only what bears on this
     change: an approach already tried and rejected, an assumption it would break, a trade-off it
     would reverse. Cite the sha. Nothing relevant → leave the section out.

   **Use the best tool the project exposes, not grep by default.** A project MCP server (a component
   or dependency graph, a usage indexer) or an LSP answers "what imports X", "what's unused" or "what
   props does this take" faster and more accurately than grepping. In a **large or unfamiliar**
   module, get a complete signature map in one pass with an LSP symbol search rather than grepping
   piecemeal.

3. **Bound it.** Note what's explicitly **out of scope**, and list **open questions** that need
   a human decision before building — **including any unresolved open forks flagged in
   `TICKET_CONTEXT.md`** (a contradicted criterion, an under-specified value). Carry these forward:
   this is the channel that gets them to the PLAN gate, so a fork dropped here is lost.

4. **Write `.dev-flow/<task>/PLAN_BRIEF.md`** (create the dir if missing) — `<task>` is the ticket
   key when there is one (reuse the subdirectory `/verify-ticket` made), else a short kebab-case slug
   of the task:

   ```
   ## Goal
   [Single sentence: what this change achieves]

   ## Files to Modify
   [List, each with a one-line reason]

   ## Files for Context (read only)
   [Related files plan mode should read but not change]

   ## Similar Patterns in Codebase
   [The closest existing implementation(s) to copy, named with file + line anchors]

   ## Test Tooling
   [Frameworks present + run command + the layer each covers; whether an a11y harness exists; flag any layer this change touches with NO tooling]

   ## Constraints
   [Only rules specific to THIS change and not already in TICKET_CONTEXT — reference it, don't repeat it]

   ## Prior Decisions
   [Omit when empty. Past commits on the files to modify whose reasoning bears on this change, each with its sha]

   ## Out of Scope
   [What this change should not touch]

   ## Open Questions
   [Anything needing a human decision before building — including unresolved open forks carried from TICKET_CONTEXT.md]
   ```

5. **Hand off.** Confirm it's written, then: enter `/plan` mode referencing
   `.dev-flow/<task>/PLAN_BRIEF.md`.

## Guards
- **Gather, don't design.** No approach decisions and no edits; a choice you're tempted to make is
  an Open Question.
- **Don't restate `TICKET_CONTEXT`**, except its unresolved forks, which step 3 carries to the PLAN
  gate.
- Keep it a first pass: enough to ground plan mode, not an exhaustive audit.
