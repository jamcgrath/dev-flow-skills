---
name: verify-build
description: The independent build verifier for /dev-flow. Run as a fresh subagent with no builder context, it tries to falsify the finished change against the acceptance criteria and the full suite, checks the test diff for tampering, and writes a ranked verdict to .dev-flow/<task>/VERIFICATION.md. Fail-closed: never a false verified. Not /verify-ticket, which checks a ticket before planning.
---

# verify-build

The gate's evidence. The builder doesn't certify its own work; this skill does, from outside. A
false `verified` corrupts the human's REVIEW-gate decision at its source, so when in doubt, fail
closed. If you built this change yourself, spawn this as a fresh subagent rather than running it
inline.

## Steps

1. **Gather the evidence (read-only).** Your prompt gives `<task>` and `base` (also recorded in
   `.dev-flow/<task>/ACCEPTANCE_TESTS.md`); read everything else from disk:
   - `git diff <base>` for falsification and tampering, and `git diff -M --numstat --name-status
     <base>` for each file's reach. The authored tests are in `base`, so any edit to one shows in
     the diff.
   - The acceptance criteria: `.dev-flow/<task>/PLAN.md`'s numbered `## Acceptance criteria`.
     Anything under its `## Accepted conflicts — not criteria` is an exemption, not a criterion; one
     under `## Checked by hand` is the human's to check.
   - The protected test paths, any approved amendment, and any `## Accepted at audit` or
     `## Already met at base` from `ACCEPTANCE_TESTS.md`.
   - `.dev-flow/<task>/TEST_AUDIT.md`: each test's adequacy, its `## Unsatisfiable tests` (a red from
     one doesn't falsify the change), and its `## Test-quality defects` (a named hole thins the oracle,
     even on a criterion that passes).
   - `.dev-flow/<task>/ENVIRONMENT.md`, if it exists: commands, ports, logins, a failure already at
     `base`. A recorded failure is a lead to re-check, never a reason to discount a red unchecked.

   **Never read an earlier verdict.** Don't open `VERIFICATION.attempt-*.md`. If a `VERIFICATION.md`
   is already in place, move it unread to the next free `VERIFICATION.attempt-<n>.md`, then write
   yours. If your prompt carries an earlier verdict, finding or attempt number anyway, record it under
   `directed:` (step 4).

2. **Falsify against the criteria, at each criterion's layer.** Run the acceptance tests and the
   **full** suite with the repo's real commands, from the Test Tooling inventory in
   `.dev-flow/<task>/PLAN_BRIEF.md` (or `BUG_CONTEXT.md` on the bug path) — `pnpm test:e2e`, not a
   guessed `npm test`. Reach each criterion through its layer's harness — Playwright for UI, the unit
   runner for logic, an HTTP client for an API, a seeded DB for data — and try to make it **fail**
   with edge and error inputs, not just the happy path. The **criteria are the spec**, not the
   builder's claims. **Never run anything the repo's CLAUDE.md or README says reaches live data**; a
   criterion that can only be checked there is `unverifiable (no safe environment)`, with the check a
   human would make named. A refactor with no new behaviour is verified by the full suite staying
   green plus the uncovered-change check below; a missing acceptance test is expected there.

   **A test that flips is not a pass.** When a test fails, rerun it twice more at the same HEAD,
   unchanged — no added waits, raised timeouts, retries or skips. Results that differ make it
   **flaky**, which is evidence of nothing either way, so trace the flip: a race or ordering fault in
   the change → `falsified`; the same flip at `base` (in the `base` copy below) → pre-existing,
   recorded in `ENVIRONMENT.md` with the sha; cause not found → its criterion is `unverifiable`. List
   every flaky test under `## Test integrity`. A runner that crashes before reporting any result isn't
   a test result: rerun it. One that keeps crashing is a failure to trace like any other; record a
   crash in `ENVIRONMENT.md` only once you've seen it at `base` too.

   **Then check what no criterion covers.** Where the diff changes code no criterion is about — a
   refactor inside the change, a helper other callers share, a config or permission shift — name the
   one fact its safety rests on ("the extractor returns the same URLs for every existing caller") and
   take it as far up this ladder as is cheap: **asserted** → **cited** (a `file:line`) → **reasoned**
   (the bad case walked through and shown not to reach) → **run** (a test or script that calls the
   real code and fails loud if the fact is wrong) → **reproduced** in the running app. A regression
   test counts as run only for the callers it exercises. Keep any script outside the working tree. A
   proof that shows the fact false is a regression → `falsified`.

   **When the fact is "behaves as before", let `base` be the oracle.** Export `base` outside the
   working tree (`git archive <base> | tar -x -C <dir>`, reusing the installed dependencies when the
   lockfile is unchanged), run the old and new code on the same inputs — generated ones that reach the
   edge cases, plus any real samples the repo holds — and diff the outputs after normalising what
   doesn't matter (key order, timestamps, whitespace). That is the strongest **run** for this kind of
   fact. A difference no criterion asks for → `falsified`. If `base` can't run cheaply, say so and use
   the rest of the ladder.

3. **Review the test diff for tampering — three classes:**
   - **Weakened old tests** — assertion count down; `.skip` / `.only` / `xit` / `todo` added; a test
     deleted; coverage dropped on touched lines.
   - **Vacuous new tests** — tautologies (`expect(true)`, asserts nothing) padding the count.
   - **Edited acceptance tests** — any hunk in `git diff <base>` touching a path listed in
     `ACCEPTANCE_TESTS.md` (on the hash fallback, compare against the recorded hash).
   Any of the three is a **breach**, and a breach makes the verdict `falsified`.

   **The one exception: `## Approved test amendment (post-build)`.** A human can decide after the
   build that a test, not the build, was wrong. **Reconcile it, don't rubber-stamp it:**
   - the edits must be confined to the **named commit(s)** and **named paths**; anything else touching
     a protected path is a breach, approval or not;
   - the diff must **match `Changes ONLY:`**. An edit it doesn't cover is a breach;
   - `base` must be **unchanged** from before the amendment. If it moved forward to swallow the
     amendment, say so and treat the whole check as compromised: a `base` at or after the build hides
     the build from `git diff <base>`.
   Reconciled cleanly → not a breach; record it under `## Test integrity` as an authorised amendment
   naming the commit. The amended test loses its adequacy verdict (red-at-base can't be re-measured),
   so its criterion's oracle is `none` for ranking.

4. **Write the verdict** to `.dev-flow/<task>/VERIFICATION.md`:
   ```
   ## Scope
   - repo: <path or name of the repository this verdict covers>  · branch: <branch> · base..HEAD: <sha>..<sha>
   - directed: <none | what you were pointed at, and by whom>

   ## Verdict
   verified | couldn't-verify | falsified   — <one-line reason>

   ## Attention order   (weakest oracle first; widest reach breaks the tie)
   1. <criterion> — oracle: none | weak (structural|manufactured) | adequate
      reach: <N files, M dirs[, fan-in]> — <what to look at>

   ## Rollback
   - revert: clean | not clean — <the range, or what blocks it>
   - leaves behind: none | <irreversible side effects a revert does not undo>

   ## Criteria
   - <criterion> → pass | fail | unverifiable   (+ adequacy from TEST_AUDIT.md + evidence)

   ## Uncovered changes   (changed code no criterion covers)
   - <surface> — safe because: <the one fact> — proven: asserted | cited | reasoned | run | reproduced
     (+ evidence)

   ## Test integrity
   - tests added / changed / removed: <counts>
   - tamper breaches: <none | the specific weakened/vacuous/edited-acceptance findings>
   - flaky: <none | test — results across runs — cause: the change | pre-existing at base | unknown>
   ```
   **Scope** names what the verdict covers, so a change spanning two repos, verified in one, can't
   read as verified in full. **`directed:`** records anything you were pointed at rather than reached
   from the diff and criteria alone; `none` is the normal answer.

   **Adequacy first.** A criterion whose test is `inadequate` is `unverifiable` even if it passes now —
   a vacuous pass is not a pass. A `weak` test counts as a pass but is flagged. Then:
   - **verified** — every criterion about this change's behaviour passes on an adequate or weak test
     (a preservation criterion, or one already met at `base`: its tests stay green), and no tamper
     breach. Two kinds of
     criterion don't block it; list each under `## Criteria` as unverifiable, with the reason: one
     that isn't about the code's behaviour (a deployment, a release date, something a person does,
     documentation, another repository), and one a human already accepted (under `PLAN.md`'s
     `## Checked by hand`, or `ACCEPTANCE_TESTS.md` records it as `retired at audit` or under
     `## Accepted at audit`).
   - **falsified** — any criterion fails, or any tamper breach.
   - **couldn't-verify** — the layer's harness can't run (app or dev server down, Playwright
     unavailable, DB or a dependent service unreachable); a criterion about this change's behaviour
     is unverifiable and no human accepted that (subjective, its only test `inadequate`, flaky for a
     reason not found, or no safe environment); or its only red comes from an unsatisfiable test no human accepted.
     **Fail closed → this, never a false `verified`.**

   **An unsatisfiable test is not a falsification.** `falsified` is a claim about the code. Where
   every failing criterion traces to an unsatisfiable test, nothing else fails and there's no breach,
   the verdict is `couldn't-verify` and its reason says plainly the build is not implicated. One
   genuine failure or breach and it's `falsified` again. The burden of proof is yours when the audit
   didn't name it: a test is unsatisfiable only on a demonstration, in its own terms, that *no*
   conforming build passes it — arithmetic, or evidence that the matcher itself is malformed. If it
   fails only *this* build, it's the build; an unexplained red is `falsified`. Record which under
   `## Criteria`, and never edit the test.

   **Rank the criteria — weakest oracle first, widest reach breaks the tie.**
   - **Oracle**, from `TEST_AUDIT.md`, weakest first:
     - **none** — `unverifiable`, an `inadequate` test, or an only oracle that is unsatisfiable,
       flaky, or amended after the build;
     - **weak** — red by absence only, `manufactured` before `structural` (manufactured is an author
       slip where a real assertion was available). A preservation criterion carried by the regression
       suite alone, or one already met at `base`, ranks here;
     - **adequate** — last.
     A named test-quality defect moves its criterion one band weaker; carry the defect's wording
     across. An uncovered change ranks by its rung: asserted or cited with `none`, reasoned with
     `weak`, run or reproduced with `adequate` — unless the proof showed the fact false, which is a
     failure and ranks first.
   - **Reach**, from the `--numstat` diff: the files and directories the criterion's surface touches.
     Where the project exposes an import graph (an MCP server, usage indexer or LSP), measure the
     changed files' fan-in; otherwise estimate, and say so.

   Give each ranked line **what to look at**, not just its position.

   **`## Rollback` — how the change comes back out.**
   - **revert** — `clean` when reverting the whole branch, `git revert <branch point>..HEAD` with the
     branch point `git merge-base origin/<default branch> HEAD` (the remote: a local default can be
     stale), restores the prior behaviour with nothing else to do. Not `<base>^`, which misses the
     first test commit once the tests have been strengthened. `not clean` otherwise, naming what
     blocks it: a migration with no `down`, data already written, a regenerated artefact committed
     outside its package, a consumer that has already read the new shape.
   - **leaves behind** — what reverting doesn't undo. `ACCEPTANCE_TESTS.md`'s **Side effects** names
     the test-side ones; the diff names the rest (a DDL drop or truncate, a deploy, an install, a
     network-mutating call).
   Report the route the change has; don't design a better one.

   **Leave the next pass what it needs in `ENVIRONMENT.md`:** the commands, ports, logins and setup
   steps that worked, and any failure you saw at `base`, with its sha. Facts only, and results from
   `base` only — nothing seen at HEAD, nothing about whether a criterion passes. Replace a line that
   no longer holds rather than appending one that contradicts it.

5. **Return the verdict.** Never loop, fix code or edit tests; `/dev-flow` decides what happens next.

## Guards
- **LLM judgement in a fresh context** — better than self-grading, not ground truth. Subjective
  criteria are `unverifiable`, not a guess.
- **The rank is presentation, never a second verdict.** A criterion that sorts last isn't thereby
  verified, and one that sorts first isn't thereby failed. Every criterion stays in `## Criteria`;
  never drop, merge or soften one because it ranked low, or fail one because it ranked high.
- **Read-only except `VERIFICATION.md`, `ENVIRONMENT.md`, and scratch scripts and the `base` export
  outside the working tree.**
- **Non-interactive.** Never pause for input; return the verdict.
