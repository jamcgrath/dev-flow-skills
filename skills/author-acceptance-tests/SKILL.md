---
name: author-acceptance-tests
description: Author executable acceptance tests from a task's acceptance criteria, after the PLAN gate has fixed the surface but INDEPENDENT of the implementation, then commit them so they become the build's base. Invoked by /dev-flow between plan approval and the build, on the human-approved path only — a trivial auto-approved change has no acceptance criteria worth pinning down this way. Picks the test type per criterion's LAYER (UI → Playwright + data-testids, logic → unit, API/service → integration, data → seeded-DB) rather than defaulting to the browser. The builder must SATISFY these tests, never edit them — committing them first is what makes any later edit visible in the diff. One half of dev-flow's test-integrity defense (the other half is /verify-build). Non-interactive, except that a commit-hook rejection for a non-test reason pauses and asks.
---

# author-acceptance-tests

Turns acceptance criteria into **executable tests the builder must satisfy**, authored *independently
of the implementation* so they can't be shaped to whatever the builder happens to write. Committing
them up front is what makes "the builder satisfies a fixed bar, it doesn't edit the bar" **enforceable**
rather than aspirational — see step 4.

Runs on `/dev-flow`'s **human path only**, between plan approval and the build:
`plan-brief → /plan (human-approved) → **author acceptance tests** → /audit-tests → build →
/verify-build`. It writes tests, commits them, and records a manifest; it does **not** implement the
feature. (The auto path has no acceptance criteria worth pinning down this way, and committing new test
files would itself trip its own new-file tripwire — so it's skipped there.)

## Steps

1. **Read the criteria + the repo's test tooling, then classify each by layer.** Acceptance criteria
   from `.dev-flow/<task>/TICKET_CONTEXT.md` if it exists; otherwise from the task description / the
   approved `.dev-flow/<task>/PLAN.md` / `PLAN_BRIEF.md`'s Goal. Read `PLAN.md` for the intended surface
   *and* its build steps — they can diverge, and the build steps name surfaces a suggested test list may
   under-name. Read the **Test Tooling inventory** from `.dev-flow/<task>/PLAN_BRIEF.md` (the frameworks
   that actually exist + their run commands). This is **general-purpose** — for *each* criterion decide
   where the behaviour lives, because that picks the test type:
   - **UI / user flow** → Playwright black-box (key on user-visible behaviour + stable `data-testid`s)
   - **Pure logic / function** → unit test on inputs→outputs, edge cases, error paths
   - **API / service** → integration / contract test hitting the endpoint or calling the service
   - **Data / schema** → assertions against a seeded DB (+ migration up→down)
   - **CLI / library** → invoke and assert on output / exit code

   **Decompose each criterion into every surface it names, and cover each.** A criterion spanning
   multiple observable instances — *mobile **and** desktop*, more than one renderer / page, each variant —
   needs a test per instance, or that instance recorded `unverifiable` with a reason; one test for a
   two-surface criterion silently drops half of it.

   `data-testid`s apply **only** to the UI layer — don't force a backend criterion through a UI mould.
   Author each test in the framework the inventory says the repo **actually uses** (e.g. Vitest, not
   Jest) — never introduce a new one; a criterion whose layer has **no tooling** in the repo is
   **unverifiable (tooling gap)**, not licence to invent a harness. A change with **no new observable
   behaviour** (a pure refactor) gets **no acceptance test** — record that its verification is "the full
   suite stays green" (regression-only); don't invent a criterion.

2. **Author each test independent of the implementation, in its layer's idiom.** Key on the **contract**
   the builder must honour, never on internal structure it happens to choose (or the test fails for the
   wrong reason): UI → behaviour + `data-testid`s; logic → function signature + return values; API →
   endpoint + request/response shape; data → query results. Be **falsify-minded** — include the edge and
   error cases, not just the happy path. The tests reference contracts that don't exist yet — that's the
   bar: **the tests define the contract, the builder implements to it.**

   **Write so the red-before-green failure is a real assertion, not mere absence.** A fresh auditor
   (`/audit-tests`) grades each test on *how* it fails at `base`: an **assertion** failure (the code
   ran and produced a wrong value) is *adequate*; failing only because a symbol / route / `data-testid` is
   **absent** is *weak*. A brand-new pure symbol can **only** fail by absence — its red is *structurally*
   weak no matter what — so don't dress that absence up with a bolted-on `expect(mod).not.toBeNull()`: it
   manufactures a fake-adequate red and, at green, swallows real import errors. Prefer a plain import (an
   honest weak red is clearer), or anchor the assertion on a seam that **already exists** at `base` (the
   real regenerated config, an existing component's output) so the missing behaviour trips a genuine
   assertion. Author *for* a real red; never self-grade it — the auditor owns that verdict.

   **For a preservation criterion** ("X still works after the change"), pin the **whole** prior surface —
   snapshot the full field set / config subtree, not one representative field — or "unaffected" is
   asserted far more loosely than it reads.

3. **Mark unverifiable criteria honestly.** A subjective / aesthetic criterion that can't be expressed
   as an executable assertion → record it as **unverifiable**. Do **not** fake a tautological test
   (`expect(true)`) to make a number go up — honesty here feeds `/verify-build`; a fake poisons it.

4. **Commit the tests immediately — this is the mechanism, not bookkeeping.** `git add` *only* the new
   test files and commit `Add acceptance tests for <task>` with a Decision Log body proportional to the
   change (the repo's commit convention — Intent: seed the build's test bar; Approach: name the
   criteria/layers covered and note it's intentionally red). This commit becomes the **build's base**,
   so any later builder edit to an acceptance test shows up trivially in `git diff <base>` — that one
   fact is what turns "must not edit the tests" from an unenforceable promise into a one-line check in
   `/verify-build`. Two things to handle:
   - This commit is **intentionally red** — the tests reference `data-testid`s / behaviour the build
     hasn't added yet. **Commit normally, with hooks on** — most repos' hooks only lint/format, so this
     is a no-op for them. If a hook rejects the commit **specifically because the by-design-red suite
     failed**, **stop and ask** the human how to proceed (bypass this once, adjust the hook, or
     reconsider the test) — never retry with `--no-verify` on your own. A hook rejecting for a
     *different* reason (lint, format, a type error) is a real problem — fix it, don't bypass it.
   - **Record the commit's sha as `base` in the manifest** (step 5) — `/verify-build` runs in a
     fresh context and cannot recompute it.
   (Unborn branch / can't commit → fall back to recording each authored file's path **and content hash**
   in the manifest so edits are still detectable; commit-first is preferred.)

5. **Write the manifest** `.dev-flow/<task>/ACCEPTANCE_TESTS.md` — the **protected set**
   `/verify-build` and the builder both read. Record your honest *expectation* per criterion, never
   an adequacy **verdict** — grading your own red is the self-grading `/audit-tests` exists to
   replace; leave the verdict to it.
   ```
   ## Base commit
   <sha of the "Add acceptance tests" commit — /verify-build diffs against this>
   <note if a hook rejection led to a human-approved --no-verify, and why>

   ## Acceptance test files (protected — builder must satisfy, not edit)
   - <path>            (+ content hash, only on the can't-commit fallback)

   ## Criterion → test
   - <criterion> → <test name / file>  ·  expected red-at-base: adequate | weak (<why>)  ·  or: unverifiable — <why>
     (expected-* is a *hypothesis* for /audit-tests to confirm — never a verdict)

   ## Residual gaps (what a passing test still does NOT prove)
   - <e.g. helper output asserted; its wiring into the rendered DOM is not — no jsdom harness>

   ## Side effects (tests that write / regenerate outside their own package)
   - <e.g. the config spec's beforeAll regenerates workers/src/config/generated/**>

   ## Contracts the builder must expose (UI data-testids / function signatures / endpoints)
   - <contract> — <what it is>
   ```

## Guards
- **Independent of the implementation; authored once, here, before the build.** The point is a *fixed*
  bar — never re-author or relax tests later to match what got built.
- **Don't fake coverage.** A criterion you can't test executably is `unverifiable`, not a tautology.
- **Don't manufacture an adequate-looking red, and don't grade your own.** A bolted-on existence assertion
  on a missing symbol is still red-by-absence; a net-new pure symbol is *structurally* weak. Author for a
  genuine assertion — the fresh auditor decides adequacy, never you.
- **Commit-first is the integrity mechanism.** Skipping the commit (without the hash fallback) silently
  disables the acceptance-test tamper check downstream.
- **Fail closed.** If the criteria are too thin to derive any test, record them all as `unverifiable`
  and say so — never invent acceptance behaviour the ticket didn't state.
- **Hooks stay on.** Never bypass a commit hook silently. A rejection caused by the by-design-red suite
  pauses and asks the human; a rejection for any other reason is fixed, not skipped.
- **Otherwise non-interactive.** dev-flow owns the human checkpoints around this skill (the audit-gap
  and verify-build-failure pauses) — this skill itself only pauses on the one narrow hook case above.
