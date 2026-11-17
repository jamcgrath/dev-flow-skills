---
name: audit-tests
description: Audit just-authored acceptance tests before the build, as a fresh subagent. A real test for new behaviour must fail at base on an assertion; judges each test adequate, weak or inadequate, proves any test no correct build can pass (unsatisfiable), and names assertion holes found by mutation. Writes .dev-flow/<task>/TEST_AUDIT.md and never edits a test. Invoked by /dev-flow between the acceptance-test commit and the build. Non-interactive.
---

# audit-tests

Checks the acceptance tests are worth running before the build trusts them. They are committed
before the feature exists (`base`), so a real test for new behaviour must **fail at `base`** — and
fail on an assertion, not merely because something is missing. You judge the tests, not the code
(there is no code yet), and you never fix them: `/dev-flow` decides what happens with a gap. You run
fresh because the tests' author must not grade them.

## Steps

1. **Gather.** The acceptance criteria — `.dev-flow/<task>/PLAN.md`'s `## Acceptance criteria`
   (anything under `## Accepted conflicts — not criteria` is an exemption, and one under
   `## Checked by hand` has no test and gets no verdict); the test paths and `base`
   (`.dev-flow/<task>/ACCEPTANCE_TESTS.md`); and the Test Tooling inventory (`.dev-flow/<task>/PLAN_BRIEF.md`, or `BUG_CONTEXT.md` on the bug path),
   for **how each runner reports an assertion failure vs an error** — the whole audit turns on it.
   Where the inventory doesn't say, read it from the runner's output at `base`.
   **Never run anything the repo's CLAUDE.md or README says reaches live data.** A test that would
   have to run there is not run and gets no verdict: list it as `not run — reaches live data`; its
   criterion is unverifiable from here on.

2. **Classify each criterion yourself — new/changed vs preservation**, from its intent. Never accept
   the author's label; it is gameable.
   - **new or changed behaviour** → its test must be **red at `base`**.
   - **preservation** ("X still works after the change") → correctly **green at `base`**, covered by
     the full regression suite that `/verify-build` runs. Note it as regression-covered; never flag it
     inadequate for being green.

3. **Run each new/changed test at `base` and judge how it fails.** Parse the runner's output per the
   inventory; the exit code alone isn't enough.
   - **adequate** — a real **assertion failure**: the code ran, produced a value, and the assertion
     caught it.
   - **weak** — failed **only by error or absence** (a missing `data-testid`, symbol, route or
     import). Name which kind: **structural** — the tested symbol is net-new, so no test could be
     assertion-adequate at `base`; or **manufactured** — an existence guard
     (`expect(mod).not.toBeNull()`) short-circuits an assertion that otherwise could have fired.
   - **inadequate** — **passed at `base`**: vacuous.

   **Then ask whether a correct build could ever make it green.** A test can fail at `base` on a real
   assertion and still be impossible: an assertion contradicting something the change never touches,
   a malformed matcher (`new RegExp('Name (Em) X')` turns `(Em)` into a capture group), a threshold the
   codebase already exceeds. Mark that test **unsatisfiable**, alongside whatever verdict it earned —
   but only on a **demonstration in the test's own terms** that no conforming build passes it:
   "`getShowDetailsFromPodcastDO(` appears 5 times at base against a `<= 2` cap, and the branch adds
   none" is the shape. If it fails only *this* build, it's the build. Without that proof it is not
   unsatisfiable: a red you can't explain is recorded as unexplained in its evidence.

4. **Note test-quality defects — a second axis, not a fourth verdict.** Red-at-base says a test
   depends on the new behaviour, not that its assertion would catch a wrong implementation. Mutate
   only code that exists at `base` — under a preservation test, or a changed-behaviour test whose
   code is already there — and see whether the test goes red, where it's cheap; keep scratch outside
   the working tree and leave the tree as you found it. A test of net-new behaviour has nothing to
   mutate yet: list it as not mutated, and `/verify-build` mutates it after the build. What survives is a **test-quality defect**, and so is a
   guard that would reject a correct build (false-fail) or a path the test wires up but never
   exercises. A defect never changes the verdict — an `adequate` test with a survivor is still
   `adequate`. Name each one, and name what you did **not** mutate: a partial sweep reported as clean
   is worse than none.

5. **Write `.dev-flow/<task>/TEST_AUDIT.md`:**
   ```
   ## Per criterion
   - <criterion> · new · test <name> · adequate | weak (structural|manufactured) | inadequate [· UNSATISFIABLE] — <evidence>
   - <criterion> · preserved · regression-covered (no red-at-base test expected)
   - <criterion> · new · test <name> · not run — reaches live data

   ## Test-quality defects (omit if none)
   - <test> · mutation survivor | false-fail risk | wired-untested — <the hole, in a line>
   - not mutated: <tests or areas the sweep did not cover>

   ## Unsatisfiable tests (no conforming build can pass these — omit if none)
   - <test> — <the demonstration that no correct build satisfies it> · as-written | rendered by <the
     decision that made it impossible>

   ## Summary
   adequate: N · weak: N · inadequate: N · unsatisfiable: N · not run: N · quality defects: N
   criteria with no adequate test: <list>
   ```

## Guards
- **Detect and flag only.** Never edit or regenerate a test to make it red — a bolted-on assertion
  on a missing symbol only manufactures a weak red. Strengthening is decided at `/dev-flow`'s
  checkpoint, by a human.
- **Non-interactive.** Never pause for input; write the file and return.
