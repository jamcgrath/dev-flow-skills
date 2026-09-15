---
name: dev-flow
description: Kick off the full AI-assisted dev flow for a task in one command — routes feature vs bug, then runs the existing chain (verify-ticket if there's a ticket → plan-brief → plan-mode approval gate → author-acceptance-tests → audit-tests → build → verify-build → commit → code-review, plus security-review when the diff touches a security surface → human review → pr), pausing at the two human gates (PLAN, REVIEW) and at two conditional escalations (a test-adequacy gap before the build, an unverified build after it). Beyond those escalations and the one conditional security-review trigger it adds no behaviour of its own — it just sequences the skills you already have. Use when the user says "dev flow", "/dev-flow <task>", "run the flow", or "kick off the flow". This is the single explicit entry to the structured flow — without it, work stays conversational; trivial one-off work doesn't need it, so there is no fast path and no skipping the PLAN gate. Self-contained (task passed as args), so it can also be invoked by automation.
---

# dev-flow

The one explicit way to **kick off the structured flow**. Beyond the condition that fires
`/security-review` at step 7 and two test-integrity checkpoints (steps 5–6), it **adds no behaviour of
its own** — it sequences the skills you already have and pauses at the same human gates as running them
by hand.

**Both gates are human, and neither is skippable.** There is no fast path: a task small enough to want
one is a task that doesn't need the orchestrator at all — do it conversationally and let the REVIEW
gate's absence be a deliberate choice rather than a classifier's guess. "Just do it" therefore isn't an
instruction this skill can honour; if the plan gate is unwanted, don't invoke `/dev-flow`. (An earlier
version carried an auto-approving classifier for trivial changes. It was removed: in three months of use
it auto-approved exactly one change, and that was a synthetic test — see `docs/classifier-log.md`.)

It takes the task as args so an automation/agent can call it, but **unattended runs are not what this
skill is for** — that's [`auto-flow-skills`](https://github.com/jamcgrath/auto-flow-skills), a separate
plugin that swaps both gates for automated approvers and vendors its own copies of the sub-skills. Two
plugins rather than a flag is deliberate on both sides: removing a gate isn't a setting, it's a
different safety model. Keep that split — a fast path added back here would be a third mode between
them, which is what the classifier already turned out to be.

```
/dev-flow <task>
  → route: feature or bug? · ticket or none? · readiness scan
  → [verify-ticket]   only if there's an external ticket/issue/brief
  → plan-brief (feature) | investigate-bug (bug)
  → plan the approach
       → ⏸ PLAN gate: surface decisive fork(s) + any unsatisfiable constraint,
                       present plan, WAIT FOR APPROVAL
  → branch off default (if needed)
  → author-acceptance-tests → commit (= base) → audit-tests
       → ⏸ audit-gap checkpoint (any *inadequate*/vacuous-at-base test? weak/red-by-absence rides
                                  forward as a softer verified): proceed / strengthen
  → build + commit each change
  → verify-build (fresh subagent, strong model, tries to falsify the change)
       → ⏸ verify-build-failure checkpoint (falsified / couldn't-verify?): retry build /
                                             proceed with gap noted / abandon
  → code-review  · + security-review when the diff touches a security surface (auth / permission /
                   secret / endpoint tokens, or an injection sink)
  → ⏸ REVIEW gate — human sanity-check before PR (leads with the verdict + the weakest-oracle
       criteria + the rollback route, diff last)
  → pr
```

## Steps

1. **Take the task.** Use the description (plus any Jira key / GitHub issue / pasted brief) passed
   as args. If nothing was passed, ask for the task in one line.

2. **Route — feature vs bug.** Decide from the wording:
   - **bug** — something is broken / misbehaving / a defect to fix → bug path.
   - **feature / change / new thing** → feature path.
   Also decide whether there's an **externally-authored** item to reconcile (Jira / GitHub issue /
   AI brief). Detect both from the task; **ask only if genuinely ambiguous.**

   **Readiness scan — do this once, here, before the front.** Cheaply surface what would otherwise
   block or derail the build later:
   - **Tools:** confirm the path's tools are reachable (Rovo / `gh` / browser / MCP). A missing one
     is a blocker to report *now*, not mid-step.
   - **Working tree + branch:** run `git status`. Pre-existing uncommitted changes will entangle the
     commit — note them now so the plan accounts for what to stage vs leave. Note the **current branch**
     too: if it's the repo's default (`main` / `master`), the build will branch first (step 5) before
     committing.
   - **Human-only prerequisites:** list what the task needs that **the agent cannot do** —
     credentials and their *scope* (e.g. a write- vs read-scoped token), external access/permissions,
     and source cleanup (e.g. duplicate components). Hand this list to the human **early** so they can
     prepare in parallel — not discover it at the PLAN gate.

3. **Run the front.** Each task's context files live in **their own subdirectory** `.dev-flow/<task>/`,
   so a new run never overwrites a previous task's files. `<task>` is the **ticket key** when there is
   one (e.g. `PROJ-1234`), else a short kebab-case slug of the task (e.g. `add-commit-history`).
   Fix `<task>` once here and use it for every sub-step:
   - Feature **with** an external ticket/issue/brief → `/verify-ticket` → `.dev-flow/<task>/TICKET_CONTEXT.md`.
     verify-ticket **flags drift and flows on** (it is not a gate — open forks ride forward to the PLAN
     gate); it escalates to the human only when the ticket is a **confabulation** — premised on
     something the repo isn't — fail-closed. If there are handoff/discovery notes or
     prior research files, pass their paths to `/verify-ticket` too — it reconciles them alongside the
     ticket (the code stays the arbiter).
   - Feature (self-defined or after verify-ticket) → `/plan-brief` → `.dev-flow/<task>/PLAN_BRIEF.md`.
   - Bug → `/investigate-bug` → `.dev-flow/<task>/BUG_CONTEXT.md`.

4. **Plan the approach, then get it approved. ⏸** Enter `/plan` mode referencing the context file
   and design the approach **strictly within the task's scope**.

   **First surface the decisive fork(s) as explicit questions** — the one or two choices that most
   change the build (approach, library, in-scope vs deferred) — via
   AskUserQuestion *before* finalising the plan. Don't bury a contested approach as a recommendation
   the human has to reject to redirect. **Put decisions to them, and only decisions.** Anything you
   could settle by reading the code, running a command, or checking a tool is a **fact** — go and
   get it. A gate that spends the human's attention on answerable questions buys nothing and trains
   them to skim the ones that matter. **Then name any conflict — separately from the forks.** A fork
   is a choice you're putting to the human; a **conflict** is a constraint the plan *can't* satisfy —
   two requirements from the ticket/brief that contradict, or one the codebase's own conventions make
   impossible without leaving the task's scope. The failure mode is silent: pick a side, and the
   losing constraint disappears into the plan's prose where the gate can't see it. So state which
   constraints collide, what the plan does about it, and — when the person at the gate doesn't own
   that call — who does. Don't dress a conflict up as a fork with a fabricated option, and don't
   manufacture one: no conflicts, say nothing. **Present the plan summary-first** so it can be read
   at a glance rather than skimmed: a 2–3 line TL;DR (what changes, why, blast radius), then two
   aids each gated on a concrete test — **default to omitting both; add one only when it clearly
   clears its bar.** A **diagram** when the approach is *non-linear* — it branches (conditional paths),
   has steps that depend on each other out of order, fans out across several files/components, or
   loops; a purely sequential plan needs none, the numbered steps already are the flow. **Draw it in
   whatever form renders on the surface it's read on.** Here that's the terminal, so **never emit a
   mermaid fence at this gate** — Claude Code shows it as its own source, which is strictly worse
   than no diagram: it costs the reader a wall of syntax and gives back nothing. Draw a plain-text
   one instead, in a fenced block so it stays monospaced and its alignment holds. The ASCII flow at
   the top of this file, and the one in the README, are the bar — legible at a glance, no renderer
   required. A
   **table of contents** when the plan is *long* — 3+ distinct steps/sections (or more than a screen),
   so the reader can jump instead of scrolling; skip it for one- or two-step plans. (They're
   independent: a long linear plan gets a TOC but no diagram; a short branchy one gets a diagram but
   no TOC.) Then the detail below. The approved plan also gets a durable record at
   **`.dev-flow/<task>/PLAN.md`** — the recon was persisted but the plan wasn't. Same rule there, and
   note `.dev-flow/` is **git-ignored**, so nothing ever renders that file's markdown: keep any
   diagram readable as plain text. **Write the plan that was approved — same scope, same length, no
   expansion.** When there's no ticket this file *is* the acceptance criteria downstream
   (`/author-acceptance-tests` and `/verify-build` both read it), so detail the human never saw at
   the gate silently widens the bar they agreed to. Record what was on screen, not a fuller
   version of it. Record any conflict the human settled here too, but **under its own
   `## Accepted conflicts — not criteria` heading** — `/author-acceptance-tests` and `/verify-build`
   read this file as the bar, so a constraint knowingly left unsatisfied written into the prose gets
   a test authored for it and comes back `falsified`. Under that heading it rides forward as the
   exemption it is.
   **Plan mode blocks file writes, so it isn't written here**:
   persisting it is the first build action (step 5), only once the human approves. **On request**, a
   `.dev-flow/<task>/PLAN.html` is emitted the same way — self-contained, drawing its own diagram
   with **no CDN**, so it still opens with no network. (A **committed** doc read on GitHub is the one
   surface where a mermaid fence genuinely renders — that's why `docs/dev-flow.md` uses one.)
   Diagrams are best-effort — the prose plan stays the source of truth and approval never stalls
   on a diagram that won't render. Then **wait for approval** — revise until approved. This is where
   alignment is confirmed and over-reach is caught.

5. **Build — commit as you go.** On approval: **first, get on a task branch.**
   If you're on the repo's default branch (`main` / `master`), create one before any commit —
   `git switch -c <branch>`, named from `<task>` so it carries the ticket key when there is one (e.g.
   `PROJ-1234-short-slug`; a kebab slug when there's no key). That key in the branch name is what lets
   `/pr` (step 9) detect it and open the PR off a feature branch; already on a non-default branch →
   use it, don't nest. **Next, persist the approved plan** — write it (and `PLAN.html` if requested)
   to `.dev-flow/<task>/PLAN.md` before any code change. Plan mode blocked this until now; you still
   have the approved plan in context, so write that.

   **Author and audit the acceptance tests before writing code** — before any implementation code:
   - `/author-acceptance-tests` — writes executable acceptance tests from the criteria
     (`TICKET_CONTEXT.md` if there is one, else the approved plan / task description), independent of
     the implementation, and commits them. `.dev-flow/<task>/ACCEPTANCE_TESTS.md` records the resulting
     `base` commit, the protected test paths, and the contracts (data-testids, signatures, endpoints)
     the build must expose.
   - `/audit-tests` — spawn as a **fresh subagent** (it must not grade the tests it just wrote) to judge
     each test's red-at-base adequacy → `.dev-flow/<task>/TEST_AUDIT.md`.

   **⏸ Checkpoint — audit gap.** Key the pause off the failure *kind* the audit records, **not** a
   blanket "no adequate test" — the three verdicts mean different things and only one is an actionable
   gap a human can fix here:
   - **`inadequate`** (a test that *passes vacuously at `base`* — it doesn't exercise the new behaviour
     at all) → **stop and ask** via `AskUserQuestion`; a vacuous pass is genuinely misleading and
     strengthening is a real remedy:
     > "The test audit found `<N>` criteria whose tests pass vacuously at base (inadequate — the pass
     > proves nothing): `<list>`. How do you want to proceed?"
     > - **Proceed anyway** — build against the current tests; the gap rides forward and can resurface
     >   at verify.
     > - **Strengthen the tests first** — pause here; hand the flagged criteria back to
     >   `/author-acceptance-tests` to revise those tests to assert real behaviour. It **re-commits**
     >   them and **re-records the new sha as `base`** in `ACCEPTANCE_TESTS.md` — without that, the
     >   strengthened tests land as edits to protected paths in `git diff <base>` and `/verify-build`
     >   reads them as tampering. Then re-run `/audit-tests` as a **new** fresh subagent.
   - **`weak`** (red-by-absence only — `structural` for a net-new symbol, `manufactured` for a
     bolted-on existence guard) → **do not pause.** For a net-new pure symbol *no* test can be
     assertion-adequate at `base` (the import fails before any assertion runs), so a pause offers no
     fixable action and "strengthen" is a dead end; a weak test is a *softer verified*, not a gap.
     Record it and **ride it forward**: `/verify-build` softens its verdict for weak-backed criteria
     and **ranks them to the top of its attention order**, which the REVIEW gate leads with. Announce
     in one line and **name the criteria, don't just count them** ("`<criterion>` and `<criterion>` are
     weak/red-by-absence — verified post-build by the suite, not assertion-proven at base"); a bare
     `<N>` hides *which* behaviour has the thinnest oracle, which is the only part of the count worth
     a human's attention. More than three → name the two with the widest reach and give the count for
     the rest. Then proceed. (Manufactured-weak is a fixable author slip, but the softened verify +
     REVIEW gate still catch it — escalate it to a pause only if the surface-only treatment proves to
     miss them.)
   - Only `adequate` verdicts (or a mix of `adequate` and `weak`) → proceed without a pause.

   **Survey before writing code, and record the call.** For each plan item, search for what already
   exists to reuse — props, components, renderers, hooks, utilities, conventions — and record the
   result as a short table: item · reused (existing) · new (only if needed) · files, with a one-line
   reason wherever you add a new abstraction. That table is what catches the
   wrapper-instead-of-an-existing-prop mistake. **Don't pause on it** — the PLAN gate approved the
   approach, and a reuse call that genuinely *contradicts* that plan is a scope breach to raise, not
   a gate to re-open.

   Then build per the plan in **logical increments**, and **minimally** — the smallest change that
   satisfies each item, no drive-by refactors, extra flags or redundant deriveds. (That is
   `implement-brief`'s discipline, stated here rather than delegated: this flow names that skill but
   never invokes it, so its body isn't loaded. Its approval pause and its layer-verification step
   stay dropped — the PLAN gate already approved the approach, and step 6's `/verify-build` owns
   verification here.)
   The build must **satisfy** `.dev-flow/<task>/ACCEPTANCE_TESTS.md`'s tests and contracts, and must
   **never edit** a protected acceptance-test file (an edit is what `/verify-build` flags as a tamper
   breach): as each self-contained change is done and sanity-checks clean, `/commit` it **right
   away** — one logical change per commit, Decision Log proportional (per convention), while the
   reasoning is fresh. **Stay in scope** — the plan is the contract.

   **Implement to the criteria, not to the tests.** The acceptance tests are how the bar gets
   *checked*; the criteria **are** the bar. Write the solution that holds for every valid input, not
   just the values a test happens to assert — never hardcode an expected value, special-case a
   fixture, or satisfy a `data-testid` with a stub carrying the selector but not the behaviour. Each
   of those goes green *and* clears `/verify-build`'s tamper check (nothing was tampered with) while
   shipping no feature — which is why it lands on you here rather than on a later gate. If a test
   looks wrong, or a criterion turns out infeasible, **stop and say so**; the one move that isn't
   available is editing the test to fit.

6. **Verify — replace self-checking with an independent falsifier.** Spawn
   `/verify-build` as a **fresh subagent with zero context from the build**, passing it `base` (from
   `ACCEPTANCE_TESTS.md`), the acceptance criteria, the protected test paths, and `TEST_AUDIT.md`'s
   adequacy verdicts. Run it at a **strong model regardless of diff size** — never downsized, this is
   the safety gate. It falsifies against the criteria via each criterion's layer harness + the full
   suite, adversarially reviews `git diff <base>` for tamper, and writes
   `.dev-flow/<task>/VERIFICATION.md`.

   **⏸ Checkpoint — verify-build failure.** `verified` → proceed to code review. `falsified` or
   `couldn't-verify` → stop and ask via `AskUserQuestion`:
   > "verify-build could not confirm the change: `<one-line reason>`. How do you want to proceed?"
   > - **Retry the build** — hand the named failing/unverifiable criteria back to the builder as a fix
   >   task (same `base`, not re-captured), then re-run `/verify-build` as a **new** fresh subagent.
   > - **Proceed to review with the gap noted** — continue to code review and the REVIEW gate, carrying
   >   the verdict forward.
   > - **Abandon** — stop here and report why. No code review, no PR.
   No auto-retry budget — each retry is a human choice, not a loop this flow counts down.

7. **Code review.** Built-in `/code-review` on the diff — pass an effort level **proportional to the
   diff** (small / mechanical → low–medium; large / risky → high+), so it doesn't default heavy on a
   tiny change.

   **Then the built-in `/security-review`, but only when the change touches a security surface.**
   Grep for that *here*, over `git diff <base>` and both sides of each hunk (removing a guard shows
   only as a `-` line) — nothing earlier in the flow has grepped the actual code. Run it on the
   auth / permission / secret / endpoint tokens, or where the diff adds a sink the review is built
   for: SQL or a shell command built from input, `innerHTML` / `{@html}`, `eval`, deserialisation, a
   path or URL from request data, session / cookie / CORS / crypto config. **Unsure → run it** — a false fire costs time and nothing else.
   It takes no arguments and scopes itself to `git diff origin/HEAD...`, a range the flow can't
   override, so check `git rev-parse --verify origin/HEAD` first: where that ref doesn't resolve
   (local-only repo, remote not named `origin`) it reviews an empty diff and finds nothing, which is
   **not run, never clean** — report it that way. No artifact, no new pause: findings ride to the
   REVIEW gate beside the code review.

8. **⏸ REVIEW gate — always human (hard stop).** A human sanity-check before the PR. This gate is
   never skipped and never auto-approved. This is what keeps "every diff is seen before it leaves the
   repo" true.

   **Surface it in this order — outcome first, diff last.** Attention is spent in the order things are
   presented, so present them in the order they'd change the decision. Leading with the diff spends the
   reader's first and best attention on the largest, least-ranked artifact and leaves the verdict to be
   found:
   1. **What this was meant to do** — one line of intent, from the approved plan or the ticket. The
      reviewer may not have been at the PLAN gate.
   2. **The verdict, and what to look at first.** When `.dev-flow/<task>/VERIFICATION.md` exists: its
      verdict, then the head of its **`## Attention order`** — the weakest-oracle, widest-reach criteria,
      **named**, with what to check on each — then any unresolved criterion, so a "proceed with the gap
      noted" choice from step 6 is actually seen here rather than silently dropped. Carry that order
      across as written; don't re-sort it into ticket order or flatten it back to counts (`N adequate /
      N weak` tells a reviewer nothing about *where* to look).
   3. **Findings** — the code review, and any `/security-review` findings beside it.
   4. **The rollback route** — `VERIFICATION.md`'s `## Rollback`: a clean revert, or what blocks one
      and what a revert would leave behind.
   5. **The complete diff** — last. It stays available and stays the record; it just isn't the lead.

9. **PR.** `/pr` — synthesises the Decision Log; includes a task key only if the branch carries one.
   (Bots/CI comments after → `/pr-fix`. Want to *see* what the run did — an interactive page of the
   change, linking the artifacts → `/debrief`; opt-in, adds no step and no pause.)

## Guards
- **Thin orchestration.** Every step delegates to the existing skill, unchanged. The flow's own logic
  is deliberately confined to three things: the front-of-flow scaffolding (the readiness scan), the
  two test-integrity checkpoints (the audit-gap pause before the build, the verify-build-failure pause
  after it), and the one condition that fires `/security-review` at step 7. Everything else
  parameterises the skills it calls (e.g. code-review effort), leaving their behaviour to them. When
  something new wants to live here, that list is the bar it has to clear — the auto-path classifier
  that used to sit alongside it grew to a quarter of this file before it was cut for never being used.
- **A closed set of subagents.** The flow's sanctioned spawns are exactly three: `Explore` for recon
  (fanned out in proportion to the surface, per `plan-brief`), `/audit-tests`, and `/verify-build`.
  Each one exists to buy a **fresh context the build can't see** — that independence *is* the product,
  and it's what separates them from the self-checking a current model already does unprompted and
  doesn't need to be told to do. So don't add ad-hoc ones: no subagent to re-check your own work, no
  reviewer beyond `/code-review` and step 7's conditional `/security-review`, and one where one will
  do. (Removing any of the three is a different thing entirely — that's a safety regression, not a
  saving.)
- **Opt-in.** The flow runs *only* when `/dev-flow` is invoked (or the steps are run by hand).
  Outside it, stay conversational — iterate and discuss freely; no pipeline, no auto plan-mode.
- **Scope discipline.** Build exactly what was agreed. Anything extra you notice → surface it as a
  follow-up at the end. The PLAN gate is the contract.
- **The guarantee binds to the sequence.** "Nothing reaches a remote unreviewed" holds only when the
  flow runs as a whole; invoking `/pr` directly (or any caller that skips step 8) bypasses the REVIEW
  gate. Step 8 is the backstop that keeps every diff seen before it leaves the repo, so never route
  around it.
- **Spend the words at the gates.** One line before a step that will take a while, one when a
  checkpoint fires or the path changes, and nothing much in between. At each gate, **lead with the
  outcome** — what happened and what it means for the decision now in front of the reader — with the
  supporting detail underneath for whoever wants it. **And rank what you surface**: weakest oracle over
  the widest reach goes first (step 8), never the artifact that happens to be biggest or the order the
  ticket happened to list things in. The pauses are where a human's attention is actually spent;
  running commentary between them spends it for nothing and trains them to skim the places it
  matters.
- **Stop at blockers, fail closed.** If a step's tool is unavailable (Rovo, `gh`, browser), a
  subagent can't be reached or answers ambiguously, or a gate is rejected — stop and report. That is
  the whole set of moves available here.
