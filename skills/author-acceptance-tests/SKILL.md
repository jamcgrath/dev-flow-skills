---
name: author-acceptance-tests
description: Author executable acceptance tests from a task's acceptance criteria after the PLAN gate, independent of the implementation, and commit them so they become the build's base. Picks the test type from each criterion's layer (UI, logic, API, data, CLI) rather than defaulting to the browser. The builder must satisfy these tests, never edit them. Invoked by /dev-flow between plan approval and the build. Non-interactive, except a commit-hook rejection caused by the intentionally red tests.
---

# author-acceptance-tests

Turns acceptance criteria into executable tests the builder must satisfy, written before and apart
from the implementation so they can't be shaped to fit it. Committing them first, as the build's
`base`, makes any later edit to them visible in the diff. You write tests, commit them and record a
manifest; you don't implement the feature.

## Steps

1. **Read the criteria and the repo's test tooling, then classify each criterion by layer.**
   Criteria come from `.dev-flow/<task>/TICKET_CONTEXT.md` as revised by the approved
   `.dev-flow/<task>/PLAN.md`, else from `PLAN.md`, else `.dev-flow/<task>/PLAN_BRIEF.md`'s Goal.
   Anything under `PLAN.md`'s `## Accepted conflicts — not criteria` is an exemption, not a criterion.
   Read `PLAN.md`'s build steps too: they can name surfaces its test list misses. The Test Tooling
   inventory is in `PLAN_BRIEF.md`, or `BUG_CONTEXT.md` on the bug path; there, also read its
   `## Red command`, which already fails on this bug at its layer — build the bug's test from it.
   Decide where each criterion's behaviour lives, because that picks the test:
   - **UI / user flow** → Playwright, black-box: user-visible behaviour, stable `data-testid`s, and
     the a11y baseline below
   - **Logic** → unit test on inputs and outputs, edge cases, error paths
   - **API / service** → integration or contract test against the endpoint or service
   - **Data / schema** → assertions against a seeded DB (plus migration up and down)
   - **CLI / library** → invoke and assert on output and exit code

   **Cover every surface a criterion names.** *Mobile and desktop*, several renderers or pages, each
   variant: a test per instance, or that instance recorded `unverifiable` with a reason.

   `data-testid`s are for the UI layer only. Use the frameworks the inventory says the repo has
   (Vitest, not Jest, if that's what's there) and never introduce one: a layer with **no tooling** is
   **unverifiable (tooling gap)**. Never author or run a test against anything the repo's CLAUDE.md or
   README says reaches live data; a criterion that can only be checked there is **unverifiable (no
   safe environment)**, with the check a human would make by hand. A change with **no new observable
   behaviour** (a pure refactor) gets no acceptance test: record that its verification is the full
   suite staying green.

   **The UI layer carries an a11y baseline.** Anything a person perceives or operates — a rendered
   component, a server-rendered template, an HTML email — also asserts its **role and accessible
   name**, that it's **reachable and operable by keyboard** when interactive, and an **automated scan
   of the changed view**. Like a `data-testid`, no ticket states it, but it's what "works" means at
   this layer, so it isn't an invented criterion. Assert only what the inventory says the repo has
   (`@axe-core/*`, `jest-axe`, `pa11y`, Playwright's role and name matchers); no harness → record the
   a11y line **unverifiable (tooling gap)** and never add the dependency. Route it by surface: on a
   **new** element it fails at `base` by absence (weak); on an **existing** view it passes at `base`,
   so author it as a **preservation** criterion ("this view stays accessible") expected green —
   authored as new behaviour, the audit reads it as vacuous and stops the flow for nothing.

2. **Write each test against the contract, not the implementation.** Key on what the builder must
   honour — UI behaviour and `data-testid`s, a function's signature and return values, an endpoint's
   request and response shape, query results — never on internal structure it might choose. Include
   edge and error cases, not just the happy path. The tests define the contract; the builder has to
   generalise past whatever values they happen to assert.

   **State a rule as a property when the repo has the library.** A criterion over a range of inputs
   — a round trip, an invariant, idempotency, equivalence with a simpler version — becomes a property
   test when the inventory lists fast-check, Hypothesis, proptest or similar, so the library picks the
   edge cases rather than the same reading of the criterion the builder works from. No library →
   example cases.

   **Mock only at the system's edges** — the network, third-party services, the clock. The repo's own
   code runs for real; where a test must stub it, the stub returns what the real signature returns,
   and the test never asserts how often it was called.

   **Aim for a real assertion failure at `base`, not mere absence.** `/audit-tests` grades a test
   that fails on an assertion as adequate and one that fails only because a symbol, route or
   `data-testid` is missing as weak. A brand-new pure symbol can only fail by absence, so never dress
   that up with a bolted-on `expect(mod).not.toBeNull()` — it fakes an adequate red and, once green,
   swallows real import errors. Prefer a plain import, or anchor the assertion on a seam that already
   exists at `base` (the real regenerated config, an existing component's output). Never grade your
   own red; the auditor does.

   **For a preservation criterion** ("X still works"), pin the **whole** prior surface — the full
   field set or config subtree, not one representative field.

3. **Mark unverifiable criteria honestly.** A subjective or aesthetic criterion that can't be an
   executable assertion is **unverifiable**. Never fake a tautological test (`expect(true)`). A
   criterion under `PLAN.md`'s `## Checked by hand` gets no test: record it `unverifiable — checked
   by hand`.

4. **Check each new test is red for the right reason, then commit.** Run the new tests against the
   current tree. Each should fail on an assertion about the value its criterion names, or by the
   honest absence of a net-new symbol, route or `data-testid`. Any other red — a 500, a thrown error, a
   status or redirect the existing code returns first, an assertion on some other field — means the
   test never reached the behaviour; so does a fixture the real code path wouldn't produce. Fix the
   fixture or request, never the criterion's assertion. Skip preservation tests here; this checks a
   test isn't broken, not whether it's adequate.

   Then `git add` **only** the new test files and commit `Add acceptance tests for <task>`, with a
   proportional Decision Log (Intent: seed the build's test bar; Approach: the criteria and layers
   covered, and that the commit is intentionally red).
   - **Hooks stay on.** Most only lint or format. If one rejects the commit **because the
     intentionally red suite failed**, stop and ask the human — bypass once, adjust the hook, or
     reconsider the test; never retry with `--no-verify` yourself. A rejection for any other reason
     (lint, format, types) is a real problem: fix it.
   - **Record the commit's sha as `base`** in the manifest; `/verify-build` can't recompute it.
   - **Re-invoked to strengthen, rewrite or retire flagged tests:** revise those files in place, or
     delete a retired one, drop it from the protected list and record its criterion
     `unverifiable — retired at audit`. Run the check above, commit as
     `Strengthen acceptance tests for <task>`, and **overwrite `base` with the new sha** — otherwise
     the revised tests read as tampering in `git diff <base>`.
   - Unborn branch or can't commit → record each file's path and content hash in the manifest
     instead.

5. **Write the manifest `.dev-flow/<task>/ACCEPTANCE_TESTS.md`** — the protected set the builder and
   `/verify-build` read. Record your *expectation* per criterion, never an adequacy verdict. The
   `Test catalog` has one line per test function, so a criterion split across surfaces shows each test.
   `## Approved test amendment (post-build)`, `## Accepted at audit` and `## Already met at base`
   stay out of your draft: `/dev-flow` writes them when a human decides one.
   ```
   ## Base commit
   <sha of the "Add acceptance tests" commit — /verify-build diffs against this>
   <note if a hook rejection led to a human-approved --no-verify, and why>

   ## Acceptance test files (protected — builder must satisfy, not edit)
   - <path>            (+ content hash, only on the can't-commit fallback)

   ## Approved test amendment (post-build)   — omit unless one was approved
   <sha> — "<commit subject>". Approved by <who> at the <needs-decision | verify-build> checkpoint on <date>.
   Changes ONLY: <each edit, and why it was the test that was wrong rather than the build>
   `base` above is unchanged so the code diff stays whole; a tamper check must treat this one
   commit's edits to <paths> as authorised. No re-audit at base: the build already exists, so
   red-at-base cannot be re-measured for these amendments — their criteria carry an unknown oracle.

   ## Criterion → test
   - <criterion> → <test name / file>  ·  expected red-at-base: adequate | weak (<why>)  ·  or: preservation — expected green at base  ·  or: unverifiable — <why>
     (expected-* is a hypothesis for /audit-tests to confirm, never a verdict)

   ## Test catalog (one line per test function — what each actually asserts)
   - `<test name>` (<file>) — asserts <the single behaviour it checks>

   ## Residual gaps (what a passing test still does NOT prove)
   - <e.g. helper output asserted; its wiring into the rendered DOM is not — no jsdom harness>
   - <e.g. axe scan clean on the changed view; keyboard-only operation and screen-reader announcement not asserted>

   ## Side effects (tests that write / regenerate outside their own package)
   - <e.g. the config spec's beforeAll regenerates workers/src/config/generated/**>

   ## Contracts the builder must expose (UI data-testids + accessible roles/names / function signatures / endpoints)
   - <contract> — <what it is>
   ```

## Guards
- **A fixed bar.** Never re-author or relax tests to match what got built. Before the build,
  `/dev-flow` may re-invoke you to strengthen, rewrite or retire a flagged test; after it, a change to
  a protected test is an amendment a human approves, never yours.
- **Never overclaim a11y.** A clean automated scan covers a fraction of WCAG; say what it doesn't
  prove under Residual gaps.
- **Fail closed.** Criteria too thin to derive any test → record them all `unverifiable` and say so;
  never invent behaviour the ticket didn't state.
- **Otherwise non-interactive.** The only pause is the hook rejection in step 4.
