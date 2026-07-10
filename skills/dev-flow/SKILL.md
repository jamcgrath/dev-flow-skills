---
name: dev-flow
description: Kick off the full AI-assisted dev flow for a task in one command — routes feature vs bug, then runs the existing chain (verify-ticket if there's a ticket → plan-brief → plan-mode approval gate → on the human path, author-acceptance-tests → audit-tests → build → verify-build → commit → code-review → human review → pr), pausing at the human gates and at two conditional escalations (a test-adequacy gap before the build, an unverified build after it). Plan *approval* is proportional: trivial, no-risk changes (or ones you tell it to skip) auto-approve and build, with a classifier re-validating at each boundary and the pre-PR review gate always running — the trivial path skips the acceptance-test machinery too, since it has no acceptance criteria worth pinning down. Beyond that classifier and the two test-integrity escalations it adds no behaviour of its own — it just sequences the skills you already have. Use when the user says "dev flow", "/dev-flow <task>", "run the flow", or "kick off the flow". This is the single explicit entry to the structured flow — without it, work stays conversational. Self-contained (task passed as args), so it can also be invoked by automation for an unattended/agentic run.
---

# dev-flow

The one explicit way to **kick off the structured flow**. Beyond the proportional-approval classifier
around the PLAN gate (steps 2–5) and, on the human path, two test-integrity checkpoints (steps 5–6), it
**adds no behaviour of its own** — it sequences the skills you already have and pauses at the same
human gates as running them by hand. Running `/dev-flow` ≡ running the steps yourself, just from one
command.

It's also the entry an automation/agent would call to run the flow unattended, so it takes the task as
args and treats the PLAN gate as an **explicit gate** swappable for an auto-approver (without changing
any delegated step). The **auto path** below is the first concrete instance of that swap: for trivial,
additive work the PLAN gate's approver becomes the classifier — re-validated at three checkpoints. The
**REVIEW gate stays human** (a hard stop before the PR, for now), so even an unattended run never
pushes unreviewed.

```
/dev-flow <task>
  → route: feature or bug? · ticket or none? · approval mode (human vs auto) · readiness scan
  → [verify-ticket]   only if there's an external ticket/issue/brief
  → plan-brief (feature) | investigate-bug (bug)   → checkpoint 1 (auto path): blast radius still small?
  → plan the approach (ALWAYS) — then:
       · human path → ⏸ PLAN gate: surface decisive fork(s), present plan, WAIT FOR APPROVAL
       · auto path  → checkpoint 2: classifier + independent verifier OK the plan → announce, proceed
  → branch off default (if needed)
       · human path only → author-acceptance-tests → commit (= base) → audit-tests
            → ⏸ audit-gap checkpoint (any *inadequate*/vacuous-at-base test? weak/red-by-absence rides forward as a softer verified): proceed / strengthen
  → build + commit each change   · checkpoint 3 (auto path): before each commit, tripwire; breach → ⏸ human gate
  → verify   · human path → verify-build (fresh subagent, strong model, tries to falsify the change)
            → ⏸ verify-build-failure checkpoint (falsified / couldn't-verify?): retry build / proceed with gap noted / abandon
       · auto path → read-only checks only
  → code-review
  → ⏸ REVIEW gate — human sanity-check before PR (ALWAYS human; even unattended stops here; surfaces any noted verification gap)
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

   **Approval mode — human gate vs auto-approve.** Recon and planning **always run**; this only
   decides whether the *plan* needs a human to approve it. The PLAN gate's job is to surface the
   *decisive fork(s)* — when there are none and nothing risky is touched it has nothing to do, so the
   plan can auto-approve and proceed. A task is on the **auto path** in either of two ways:
   - **You said skip** — the user explicitly says "just do it" / "no need to plan" / "skip approval".
     This waives only the *human plan approval*; it never disables the tripwires or the three
     checkpoints, which still re-validate and can pull the task back to the human gate.
   - **Agent self-classified** — provisionally eligible when there's **no decisive fork**,
     **unambiguous intent** (an ambiguous ask, e.g. "make the heading bigger" with no value, *is* a
     fork → ask one quick question or stay on the human path), and **no risk surface**.

   This is a *provisional* call made on the task description alone — most tripwires below can't fire
   until there's a file list or a diff, so they bite hardest at the three checkpoints. It is
   re-validated at those checkpoints and reverts to the human gate on any breach (on the
   **you-said-skip** path too: a declared "trivial" can be wrong the same way, and if the work trips a
   tripwire the premise no longer holds). The classifier is three kinds of check — and be honest about
   what each does: the **spread** and **impact** tripwires mechanically *exclude* the dangerous cases;
   they don't *certify* what's left as safe. For the cosmetic edits the auto path is actually for, every
   spread tripwire passes trivially — so what really protects you is the judgment call **plus the
   always-human REVIEW gate**; the tripwires just keep the obviously-dangerous off the auto path:
   - **Spread tripwires** (mechanical) — more than one changed file (count `git status --porcelain`
     lines; a `renamed:` / moved file counts — it breaks imports repo-wide); a new or deleted file; a
     new dependency (manifest diff); an exported-symbol or signature change (grep the diff —
     best-effort, not authoritative: a changed *contract* behind an unchanged signature won't grep).
   - **Impact tripwires** — danger a single contained file can still carry, keyed on *what the change
     does*: any edit to existing **functional/logic** behaviour — control flow, validation, a guard, a
     limit, a default, data, security, or a side effect; a destructive or irreversible op (DDL
     drop/truncate, record/file deletion, a deploy / migration / install / network-mutating call); or a
     diff touching auth / permission / secret / feature-flag / endpoint / limit tokens (grep the diff)
     wherever it lives. The auto path is for **presentational, localized** edits — a font-size, a layout
     tweak, a *non-load-bearing* copy string. Two traps: "new lines" is **not** a safe-harbour (an
     inserted early-return, guard, bypass, cache, or retry alters how existing paths behave → human
     gate); and even a copy/string edit can be load-bearing (a price, legal text, a security label).
     **Unsure whether it's presentational or behaviour-altering, or whether a string is load-bearing →
     human gate.** (A genuine bug fix alters existing behaviour, so it almost always takes the human
     path — the auto path is mostly cosmetic tweaks.)
   - **Judgment slice** (small, soft): *is there a decisive fork?* and *is the ask ambiguous?* — also
     exposed to self-assessment, backstopped by the always-human REVIEW gate.
   **Any** spread or impact tripwire, or **any** doubt (impact classification or judgment slice) →
   human gate.

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
   one (e.g. `PROJ-1234`), else a short kebab-case slug of the task (e.g. `add-commit-history`) —
   mirroring the repo's `Notes/<KEY>/` layout. Fix `<task>` once here and use it for every sub-step:
   - Feature **with** an external ticket/issue/brief → `/verify-ticket` → `.dev-flow/<task>/TICKET_CONTEXT.md`.
     verify-ticket **flags drift and flows on** (it is not a gate — open forks ride forward to the PLAN
     gate); it escalates to the human only when the ticket is a **confabulation** — premised on
     something the repo isn't — fail-closed on either path. If there are handoff/discovery notes or
     prior research files, pass their paths to `/verify-ticket` too — it reconciles them alongside the
     ticket (the code stays the arbiter).
   - Feature (self-defined or after verify-ticket) → `/plan-brief` → `.dev-flow/<task>/PLAN_BRIEF.md`.
   - Bug → `/investigate-bug` → `.dev-flow/<task>/BUG_CONTEXT.md`.

   **Checkpoint 1 — post-recon (auto path only).** Recon now shows the real blast radius. Run the
   tripwires the file list can already answer (file count; a shared interface / token / config now in
   scope) plus the judgment slice. There's no diff yet, so this is an early exit on what recon can
   show — not the full per-commit check: if it's bigger than it looked (the "one file" is imported in
   20 places), drop to the human gate now, before planning. **When the project exposes an
   import/dependency graph** (an MCP server, usage indexer, or LSP), use it to *measure* a file's
   actual fan-in rather than eyeballing it — a high parent count means the blast radius is larger than
   the file count suggests → human gate. No such tool → fall back to the estimate as before.

4. **Plan the approach (always) — then approve.** Enter `/plan` mode referencing the context file and
   design the approach **strictly within the task's scope**. Planning is **not** skipped on the auto
   path — only the human *approval* of it is. Then branch on the approval mode set in step 2:

   - **Human path (full gate). ⏸** **First surface the decisive fork(s) as explicit questions** — the
     one or two choices that most change the build (approach, library, in-scope vs deferred) — via
     AskUserQuestion *before* finalising the plan. Don't bury a contested approach as a recommendation
     the human has to reject to redirect. **Present the plan summary-first** so it can be read at a
     glance rather than skimmed: a 2–3 line TL;DR (what changes, why, blast radius), then two aids each
     gated on a concrete test — **default to omitting both; add one only when it clearly clears its
     bar.** A mermaid **flowchart** when the approach is *non-linear* — it branches (conditional paths),
     has steps that depend on each other out of order, fans out across several files/components, or
     loops; a purely sequential plan needs none, the numbered steps already are the flow. A **table of
     contents** when the plan is *long* — 3+ distinct steps/sections (or more than a screen), so
     the reader can jump instead of scrolling; skip it for one- or two-step plans. (They're independent: a long linear
     plan gets a TOC but no diagram; a short branchy one gets a diagram but no TOC.) Then the detail
     below. The approved plan also gets a durable record at **`.dev-flow/<task>/PLAN.md`** (mermaid
     fences) — the recon was persisted but the plan wasn't. **Plan mode blocks file writes, so it
     isn't written here**: persisting it is the first build action (step 5), only once the human
     approves. **On request**, a `.dev-flow/<task>/PLAN.html` (mermaid from a CDN) is emitted the same
     way. Diagrams are best-effort — the prose plan stays the source of truth and approval never stalls
     on a diagram that won't render. (Human path only: the auto path presents no plan, so trivial fast-tracked tasks get
     none of this.) Then **wait for approval** — revise until approved. This is where alignment is
     confirmed and over-reach is caught.

   - **Auto path. Checkpoint 2 — post-plan (binding).** Validate the written plan instead of asking a
     human: run the tripwires against the plan's **stated file scope** *and the recon file list* (not
     just the plan's prose — that's the same model's self-report and can under-state scope), and
     confirm the judgment slice. **Then get an independent read** — spawn a fresh subagent given the
     plan + the recon file list + the classifier criteria from step 2 (no other session context) and
     ask "trivial — yes/no, and why?". Its verdict is binding; if it is unavailable, errors, times
     out, or answers ambiguously → **human gate** (fail-closed — never fail-open to "proceed"). Pass
     on all three (tripwires + judgment + verifier) → **announce in one line** (what + why trivial — a
     costless veto when a human is watching) and proceed without waiting. Any fail or any doubt → fall
     back to the human path above.

   (Automation: the auto path *is* the auto-approver this PLAN-gate checkpoint was always meant to be
   swappable for. The REVIEW gate (step 8) is **not** swappable for now — even an unattended run stops
   there for a human before the PR, so nothing reaches a remote unreviewed.)

5. **Build — commit as you go.** On approval (or once auto-approved): **first, get on a task branch.**
   If you're on the repo's default branch (`main` / `master`), create one before any commit —
   `git switch -c <branch>`, named from `<task>` so it carries the ticket key when there is one (e.g.
   `PROJ-1234-short-slug`; a kebab slug when there's no key). That key in the branch name is what lets
   `/pr` (step 9) detect it and open the PR off a feature branch; already on a non-default branch →
   use it, don't nest. **Next, if a human approved the plan at the PLAN gate, persist it** — write the
   approved plan (and `PLAN.html` if requested) to
   `.dev-flow/<task>/PLAN.md` before any code change. Plan mode blocked this until now; you still have
   the approved plan in context, so write that. Skip on the auto path — no plan doc there.

   **Human path only — author and audit the acceptance tests before writing code.** Skip this whole
   block on the auto path: a trivial, presentational change has no acceptance criteria worth pinning
   down this way, and committing new test files would itself trip the auto path's own new-file spread
   tripwire at Checkpoint 3. On the human path, before any implementation code:
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
     > - **Strengthen the tests first** — pause here; revise the flagged tests to assert real
     >   behaviour, then re-run `/audit-tests`.
   - **`weak`** (red-by-absence only — `structural` for a net-new symbol, `manufactured` for a
     bolted-on existence guard) → **do not pause.** For a net-new pure symbol *no* test can be
     assertion-adequate at `base` (the import fails before any assertion runs), so a pause offers no
     fixable action and "strengthen" is a dead end; a weak test is a *softer verified*, not a gap.
     Record it and **ride it forward**: `/verify-build` softens its verdict for weak-backed criteria
     and the REVIEW gate surfaces that softening. Announce in one line ("`<N>` criteria are
     weak/red-by-absence — verified post-build by the suite, not assertion-proven at base") and
     proceed. (Manufactured-weak is a fixable author slip, but the softened verify + REVIEW gate still
     catch it — escalate it to a pause only if the surface-only treatment proves to miss them.)
   - Only `adequate` verdicts (or a mix of `adequate` and `weak`) → proceed without a pause.

   Then build per the plan (`implement-brief` carries the reuse-survey + minimal-build discipline) in
   **logical increments** — on the human path, the build must **satisfy**
   `.dev-flow/<task>/ACCEPTANCE_TESTS.md`'s tests and contracts, and must **never edit** a protected
   acceptance-test file (an edit is what `/verify-build` flags as a tamper breach):
   as each self-contained change is done and sanity-checks clean, `/commit` it **right away** — one
   logical change per commit, Decision Log proportional (per convention). Commit **early and often**
   while the reasoning is fresh; don't defer everything to one big commit at the end. **Stay in
   scope** — no changes beyond the plan.

   **Checkpoint 3 — before each commit (auto path; the real gate).** Capture `base = git rev-parse HEAD`
   when the auto path's build starts (if that fails — e.g. an unborn branch with no commits — fail
   closed to the human gate). Before each commit, re-run the tripwires against everything done since
   `base`, not just the staged change: enumerate changed **and untracked** files with
   `git status --porcelain` for the file-count / new-file / rename tripwires (`git diff` alone hides
   untracked files), and inspect content with `git diff <base>` plus the contents of any untracked
   files for the impact / token tripwires. Use the plain `git diff <base>` form, *not* the three-dot
   `<base>...` (which diffs the merge-base and misses the uncommitted delta). Otherwise committing "one
   file per commit" (the rule above) would let a five-file blast radius pass as five clean single-file
   commits. Any breach (a second file, a new dependency, an edit to existing
   behaviour, an interface / schema / config / auth change…) → **stop before committing** and escalate
   to the human gate. Two limits to respect: a side-effecting build/verify command (migration, install,
   deploy, network-mutating call) can run *before* this check and isn't undone by reverting a commit —
   so on the auto path treat such a command as a tripwire and gate *before* running it; and "costs
   nothing irreversible" holds for the tracked-file edits caught here, not for actions already taken.

6. **Verify.** **Human path — replace self-checking with an independent falsifier.** Spawn
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

   **Auto path (unchanged).** Run only read-only checks unattended (lint / typecheck / static
   analysis): any **side-effecting** verify/build command (migration, install, deploy, codegen
   that pushes, a dev server making network calls) is a tripwire — **drop to the human gate before
   running it**, since its effects aren't undone by reverting a commit. `/commit` any fixes this
   surfaces (still one logical change per commit).

7. **Code review.** Built-in `/code-review` on the diff — pass an effort level **proportional to the
   diff** (small / mechanical → low–medium; large / risky → high+), so it doesn't default heavy on a
   tiny change.

8. **⏸ REVIEW gate — always human (hard stop).** Surface the diff + review for a human sanity-check
   before the PR — and, when `.dev-flow/<task>/VERIFICATION.md` exists, its verdict and any unresolved
   criteria, so a "proceed with the gap noted" choice from step 6 is actually seen here, not silently
   dropped. This gate is **not** auto-approved by the classifier, never skipped on the auto path,
   and (for now) not swappable for an auto-approver: an unattended run **stops here and does not push**
   until a human approves. This is what keeps "every diff is seen before it leaves the repo" true.

9. **PR.** `/pr` — synthesises the Decision Log; includes a task key only if the branch carries one.
   (Bots/CI comments after → `/pr-fix`.)

## Guards
- **Thin orchestration.** Every step delegates to the existing skill, unchanged. The flow's own logic
  is deliberately confined to a small set of things: the front-of-flow scaffolding (the readiness
  scan), the proportional-approval classifier around the PLAN gate (the tripwire checks + the
  independent verifier subagent), and — human path only — two test-integrity checkpoints (the
  audit-gap pause before the build, the verify-build-failure pause after it). Everything else
  parameterises the skills it calls (e.g. code-review effort) — it never reimplements their behaviour.
- **Opt-in.** The flow runs *only* when `/dev-flow` is invoked (or the steps are run by hand).
  Outside it, stay conversational — iterate and discuss freely; no pipeline, no auto plan-mode.
- **Scope discipline.** Never expand past the plan. Anything extra you notice → surface it as a
  follow-up at the end, don't silently do it. On the human path the PLAN gate is the contract; on the
  auto path the classifier's eligibility criteria + the per-commit tripwire are.
- **Proportional approval, never proportional review.** The auto path skips only the *human approval*
  of the plan, and only while the classifier holds — it **never** skips recon, planning, the
  per-commit tripwire, code-review, or the REVIEW gate (step 8). Every diff is still seen before it
  leaves the repo, the mechanical tripwires keep obviously-dangerous changes off the auto path (they
  exclude danger, they don't certify safety), and any doubt or breach reverts to the human gate.
- **The guarantee binds to the sequence.** "Nothing reaches a remote unreviewed" holds only when the
  flow runs as a whole; invoking `/pr` directly (or any caller that skips step 8) bypasses the REVIEW
  gate. The auto path's local checks are best-effort — step 8 is the backstop that makes a
  misclassification at worst a reversible local commit, so never route around it.
- **Stop at blockers, fail closed.** If a step's tool is unavailable (Rovo, `gh`, browser), the
  Checkpoint-2 verifier can't be reached or answers ambiguously, or a gate is rejected — stop and
  report, or drop to the human gate. Never work around it or fail open to "proceed".
