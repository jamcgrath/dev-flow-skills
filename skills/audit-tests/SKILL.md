---
name: audit-tests
description: Audit the just-authored acceptance tests for ADEQUACY before the build, via "red before green" — a genuine test for new behaviour must FAIL at base, and one that passes there is vacuous. Spawned as a FRESH subagent, because the author must not grade its own tests. Returns a THREE-valued per-test verdict (adequate / weak / inadequate), plus two findings the verdict alone misses: an UNSATISFIABLE test no conforming build can pass (proved, not suspected — it pauses, like inadequate, because never-green and always-green are the two ways a test cannot do its job), and test-quality defects mutation turns up (assertion holes on tests whose verdict is otherwise fine, which ride forward as named review items and never pause). Writes TEST_AUDIT.md; detect-and-flag only, it never edits a test. Invoked by /dev-flow between the acceptance-test commit and the build. Non-interactive.
---

# audit-tests

Checks the acceptance tests are *worth running* before the build trusts them. `/verify-build`
later confirms the code **passes** the tests — but "passes" means nothing if the test would pass
anyway. This closes that gap with **red-before-green**: the tests are committed before the feature
exists (`base`), so a real test for new behaviour must **fail at `base`**. A test that *passes*
pre-build is vacuous; a test that fails only because a symbol is missing is red but **unproven**.

**Spawned fresh** — the skill that authored the tests must not grade them — and **runs once**,
between the acceptance-test commit and the build. It judges
the *tests*, not the code (there is no code yet), and it **does not fix** them (detect-and-flag
only — `/dev-flow` decides what happens with a gap it finds).

## Steps

1. **Gather.** Acceptance criteria (`.dev-flow/<task>/TICKET_CONTEXT.md` if it exists, else the
   approved `.dev-flow/<task>/PLAN.md` / task description); the acceptance-test paths +
   the `base` commit (`.dev-flow/<task>/ACCEPTANCE_TESTS.md`); and the **test-tooling inventory**
   (`.dev-flow/<task>/PLAN_BRIEF.md`, or `.dev-flow/<task>/BUG_CONTEXT.md` on the bug path — it
   carries the same section, since a bug run writes no `PLAN_BRIEF.md`) — you need it to know **how
   each runner reports an assertion failure vs an error**, which the whole audit turns on. If neither
   file is there or neither names the runner's failure format, **don't guess it** — say so and grade
   only what you can actually discriminate.

2. **Classify each criterion yourself — new/changed vs preservation.** Don't trust an author label
   (gameable). From the criterion's *intent*:
   - **new or changed behaviour** → its test must be **red at `base`** (the feature isn't there yet).
   - **preservation** ("X still works after the change") → it is *correctly* **green at `base`** and is
     verified by the **full regression suite** (which `/verify-build` runs), **not** by a
     red-at-base test. Note it as regression-covered; do **not** flag it inadequate for being green.

3. **Run the new/changed tests at `base` and judge the failure KIND — three-valued.** Check out / diff
   against `base`, run each new-behaviour test, and inspect *how* it fails (parse the runner's output per
   the inventory — exit code alone is not enough):
   - **adequate** — failed via a real **assertion failure**: the code ran, produced a value, and the
     assertion caught it. The only *proven* test.
   - **weak** — failed **only by error / absence** (missing `data-testid` / symbol / route / import). Red,
     but it proves the test *references* something absent, not that its assertion is meaningful. (For UI
     tests this is the common case — a missing testid throws before any assertion runs.) When you report a
     `weak`, name which kind: **structural** — the tested symbol is net-new, so *no* test could be
     assertion-adequate at `base` (not an author error); or **manufactured** — an existence guard
     (`expect(mod).not.toBeNull()`) short-circuits an assertion that otherwise *could* have fired. The
     verdict is `weak` either way; the label tells the flow whether the author erred or it was just hard.
   - **inadequate** — **passed at `base`.** Vacuous — it doesn't exercise the new behaviour at all.

   **Then ask the other question: could a *correct* build ever make this test green?** Red-at-base
   tells you the test reacts to the code; it does not tell you the test is *satisfiable*. A test can
   fail at base on a real assertion — reading as `adequate` — and still be impossible: an assertion
   contradicting something the change never touches, a malformed matcher (`new RegExp('Name (Em) X')`
   turns `(Em)` into a capture group), a threshold the codebase already exceeds. Mark that test
   **unsatisfiable**, alongside whatever verdict it earned.

   **The bar is a demonstration in the test's own terms, not a suspicion** — "`getShowDetailsFromPodcastDO(`
   appears 5 times at base against a `<= 2` cap, and the branch adds none" is the shape: arithmetic or
   evidence showing *no* conforming build passes it. If it fails only *this* build, it is the build,
   not the test. Absent that proof, it is not unsatisfiable, and saying otherwise hands every
   inconvenient red an excuse.

   `unsatisfiable` and `inadequate` are the two ways a test cannot do its job — never green, and
   always green. Both are actionable *here*, before a build is spent against them, so both pause.
   `weak` and the quality defects in step 4 are tests that do the job imperfectly; those ride forward.

4. **Note test-quality defects — a second axis, not a fourth verdict.** Red-at-base says a test
   *depends on* the new behaviour. It does not say the assertion would **catch a wrong
   implementation**. Where checking that is cheap, check it: mutate what the test covers and see
   whether it goes red. What survives is a **test-quality defect** — and so is a guard that would
   reject a *correct* build (a false-fail), or a path the test wires up but never exercises.

   This is orthogonal to the verdict, not another value of it. An `adequate` test with a survivor is
   still `adequate`; its assertion just has a named hole. Say which tests you did **not** mutate
   rather than letting a partial sweep read as a whole-suite guarantee.

   These are **review items, not gaps** — they never change a verdict and never pause the flow (see
   the guards). Name each one so `/verify-build` can carry it into its attention order and the REVIEW
   gate can lead with it; an unnamed defect is one nobody ever sees.

5. **Write `.dev-flow/<task>/TEST_AUDIT.md`** — the per-criterion result the rest of the flow reads:
   ```
   ## Per criterion
   - <criterion> · new · test <name> · adequate | weak (structural|manufactured) | inadequate [· UNSATISFIABLE] — <evidence>
   - <criterion> · preserved · regression-covered (no red-at-base test expected)

   ## Test-quality defects (assertion holes — review items, never a pause; omit if none)
   - <test> · mutation survivor | false-fail risk | wired-untested — <the hole, in a line>
   - not mutated: <tests or areas the sweep did not cover>

   ## Unsatisfiable tests (no conforming build can pass these — omit if none)
   - <test> — <the demonstration that no correct build satisfies it> · as-written | rendered by <the
     decision that made it impossible>

   ## Summary
   adequate: N · weak: N · inadequate: N · unsatisfiable: N · quality defects: N
   criteria with no adequate test: <list>
   ```

6. **Detect-and-flag — don't fix.** Hand the result forward; never edit or regenerate a test.
   - **inadequate** → the criterion has **no trustworthy test**; downstream treats it as
     **unverifiable** even if it later "passes" (a vacuous pass is not a pass). `/dev-flow` pauses and
     asks the human whether to proceed anyway or strengthen the tests first.
   - **weak** → a **softer verified** — surfaced in the review as red-by-absence-only, not
     assertion-proven.
   - **adequate** → trustworthy.
   - **unsatisfiable** → the criterion has a test **no build can satisfy**, so building against it
     burns a whole build to arrive at a red nobody can clear. `/dev-flow` pauses, same as
     `inadequate`. The remedy differs though: a vacuous test is *strengthened*, an unsatisfiable one
     is **rewritten or retired** — strengthening it makes it harder to pass, which is the wrong
     direction entirely.
   - **a quality defect on any of the above** → rides forward **named**, on whatever verdict the test
     already has. It is review material, never a gate.

## Guards
- **Fresh + independent.** The author of the tests cannot audit them — that's self-grading.
- **Assertion-vs-error is the whole game.** A boolean red/green audit rubber-stamps almost every UI test
  (missing testid → error → "red"). Judge the failure *kind*; that categorization is the product of this
  skill.
- **The auditor owns new-vs-preserved.** Never accept an author's "this is preservation, skip the
  red-check" label — classify from the criterion's intent yourself.
- **Detect-and-flag only — no strengthen loop.** Don't regenerate tests to "make them red": that
  optimizes a gameable proxy (a spurious assertion bolted onto a missing symbol manufactures a *weak*
  red). Flag and move on — `/dev-flow`'s audit-gap checkpoint is where strengthening gets decided,
  grounded in a human's call, not this skill's.
- **Necessary, not sufficient — and mutation is where the rest comes from.** Red-before-green (even
  assertion-red) proves a test *depends on* the new behaviour, not that its assertion is *complete*.
  Mutation is the sufficient check: run it where it is cheap, record what survives as a quality
  defect, and name what you skipped. A partial sweep reported as a clean one is worse than no sweep.
- **A quality defect never pauses, and never changes a verdict.** It is a named review item that
  rides forward — same disposition as `weak`, for the same reason: strengthening is a build-time or
  review-time call, so a pause here offers the human no action they can take *yet*. `inadequate` is
  the only finding in this skill that justifies stopping the flow.
- **Unsatisfiable is a finding you must prove, not a verdict you may reach for.** It says a test is
  impossible for *every* conforming build, which is the one finding that excuses a red without
  implicating the code — so it carries the highest burden in this skill. Demonstrate it in the test's
  own terms; where a second reader is available, an independent confirmation is worth having. A red
  you merely cannot explain is not unsatisfiable, it is unexplained, and it rides forward as that.
- **Catching it here is the cheap case.** Found at audit, an unsatisfiable test costs a rewrite.
  Found at `/verify-build`, it has already cost a whole build against a bar nothing could meet.
- **Non-interactive.** Never pause for input; `/dev-flow` owns the checkpoint this audit feeds.
