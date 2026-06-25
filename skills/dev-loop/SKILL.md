---
name: dev-loop
description: Kick off the full AI-assisted dev loop for a task in one command — routes feature vs bug, then runs the existing chain (verify-ticket if there's a ticket → plan-brief → plan-mode approval gate → build → verify → commit → code-review → human review → pr), pausing only at the human gates. Adds no behaviour of its own; it just sequences the skills you already have. Use when the user says "dev loop", "/dev-loop <task>", "run the loop", or "kick off the loop". This is the single explicit entry to the structured loop — without it, work stays conversational. Self-contained (task passed as args), so it can also be invoked by automation for an unattended/agentic run.
---

# dev-loop

The one explicit way to **kick off the structured loop**. It **adds no behaviour** — it sequences
the skills you already have and pauses at the same human gates as running them by hand. Running
`/dev-loop` ≡ running the steps yourself, just from one command.

It's also the entry an automation/agent would call to run the loop unattended, so it takes the
task as args and treats the two human gates as **explicit checkpoints** (today: human; later:
swappable for an auto-approver — without changing any other step).

```
/dev-loop <task>
  → route: feature or bug? · ticket or none? · readiness scan (tools · dirty tree · human-only prereqs)
  → [verify-ticket]   only if there's an external ticket/issue/brief
  → plan-brief                                   (feature)   |  investigate-bug   (bug)
  → ⏸ PLAN gate — surface the decisive fork(s) as questions, then present plan, WAIT FOR APPROVAL
  → build + commit each logical change (early & often) → verify
  → code-review
  → ⏸ REVIEW gate — human sanity-check before PR
  → pr
```

## Steps

1. **Take the task.** Use the description (plus any Jira key / GitHub issue / pasted brief) passed
   as args. If nothing was passed, ask for the task in one line.

2. **Route — feature vs bug.** Decide from the wording:
   - **bug** — something is broken / misbehaving / a defect to fix → bug path.
   - **feature / change / new thing** → feature path.
   Also decide whether there's an **externally-authored** item to reconcile (Jira / GitHub issue /
   AI brief). Detect both from the task; **ask only if genuinely ambiguous.** In an unattended run,
   make a documented best guess and state it rather than blocking.

   **Readiness scan — do this once, here, before the front.** Cheaply surface what would otherwise
   block or derail the build later:
   - **Tools:** confirm the path's tools are reachable (Rovo / `gh` / browser / MCP). A missing one
     is a blocker to report *now*, not mid-step.
   - **Working tree:** run `git status`. Pre-existing uncommitted changes will entangle the commit —
     note them now so the plan accounts for what to stage vs leave.
   - **Human-only prerequisites:** list what the task needs that **the agent cannot do** —
     credentials and their *scope* (e.g. a write- vs read-scoped token), external access/permissions,
     and source cleanup (e.g. duplicate components). Hand this list to the human **early** so they can
     prepare in parallel — not discover it at the PLAN gate.

3. **Run the front.** Each task's context files live in **their own subdirectory** `.dev-loop/<task>/`,
   so a new run never overwrites a previous task's files. `<task>` is the **ticket key** when there is
   one (e.g. `NSS2-2327`), else a short kebab-case slug of the task (e.g. `add-commit-history`) —
   mirroring the repo's `Notes/<KEY>/` layout. Fix `<task>` once here and use it for every sub-step:
   - Feature **with** an external ticket/issue/brief → `/verify-ticket` → `.dev-loop/<task>/TICKET_CONTEXT.md`.
   - Feature (self-defined or after verify-ticket) → `/plan-brief` → `.dev-loop/<task>/PLAN_BRIEF.md`.
   - Bug → `/investigate-bug` → `.dev-loop/<task>/BUG_CONTEXT.md`.

4. **⏸ PLAN gate.** Enter `/plan` mode referencing the context file. **First surface the decisive
   fork(s) as explicit questions** — the one or two choices that most change the build (approach,
   library, in-scope vs deferred) — via AskUserQuestion *before* writing the plan. Don't bury a
   contested approach as a recommendation the human has to reject to redirect. Then design the
   approach **strictly within the task's scope** and present the plan. **Wait for approval** — revise
   until approved. This is where alignment is confirmed and over-reach is caught. (Automation: this
   checkpoint is where an auto-approver would sit.)

5. **Build — commit as you go.** On approval, build per the approved plan (`implement-brief` carries
   the reuse-survey + minimal-build discipline) in **logical increments**: as each self-contained
   change is done and sanity-checks clean, `/commit` it **right away** — one logical change per
   commit, Decision Log proportional (per convention). Commit **early and often** while the reasoning
   is fresh; don't defer everything to one big commit at the end. **Stay in scope** — no changes
   beyond the approved plan.

6. **Verify.** Run the project's lint / typecheck / build for the whole change; for UI/behavioural
   work, verify in the browser and report what was actually observed. `/commit` any fixes this
   surfaces (still one logical change per commit).

7. **Code review.** Built-in `/code-review` on the diff — pass an effort level **proportional to the
   diff** (small / mechanical → low–medium; large / risky → high+), so it doesn't default heavy on a
   tiny change.

8. **⏸ REVIEW gate.** Surface the diff + review for a human sanity-check before the PR.

9. **PR.** `/pr` — synthesises the Decision Log; includes a task key only if the branch carries one.
   (Bots/CI comments after → `/pr-fix`.)

## Guards
- **Thin orchestration.** Every step delegates to the existing skill, unchanged. The loop adds only
  lightweight front-of-loop scaffolding (the readiness scan) and parameterises the skills it calls
  (e.g. code-review effort) — it never reimplements their behaviour.
- **Opt-in.** The loop runs *only* when `/dev-loop` is invoked (or the steps are run by hand).
  Outside it, stay conversational — iterate and discuss freely; no pipeline, no auto plan-mode.
- **Scope discipline.** Never expand past the approved plan. Anything extra you notice → surface it
  as a follow-up at the end, don't silently do it. The PLAN gate is the contract.
- **Stop at blockers.** If a step's tool is unavailable (Rovo, `gh`, browser) or a gate is rejected,
  stop and report — don't work around it.
