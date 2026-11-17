---
name: dev-flow
description: Kick off the structured dev flow for a task in one command. Routes feature vs bug, runs recon, the PLAN gate, independent acceptance tests and their audit, the build, a code-review loop, an independent verify-build, and the REVIEW gate, then opens the PR. Pauses at the two human gates and at three conditional checkpoints. Use when the user says "dev flow", "/dev-flow <task>", "run the flow", or "kick off the flow". There is no fast path; trivial work doesn't need the flow.
---

# dev-flow

The one explicit way to run the structured flow. It sequences the other skills and pauses at the
same human gates as running them by hand.

**Both gates are human, and neither is skippable.** There is no fast path: a task small enough to
want one doesn't need the flow, so do it conversationally. "Just do it" is not an instruction this
skill can honour; if the PLAN gate is unwanted, don't invoke `/dev-flow`.

```
/dev-flow <task>
  → route: feature or bug? · ticket or none? · readiness scan
  → [verify-ticket]   feature path, only if there's an external ticket/issue/brief
  → plan-brief (feature) | investigate-bug (bug)
  → plan the approach
       → ⏸ PLAN gate: decisive forks + conflicts + hand checks, plan, WAIT FOR APPROVAL
  → branch off default (if needed) · persist PLAN.md
  → author-acceptance-tests → commit (= base) → audit-tests
       → ⏸ audit-gap checkpoint (inadequate or unsatisfiable): proceed / strengthen / already met /
                                                                  rewrite-or-retire
  → build + commit each change
  → code-review → triage → fix + commit → re-review the increment
       → ⏸ needs-decision checkpoint: take it + amend the test / keep the agreed behaviour / narrow it
     · + security-review once the loop settles, when the diff touches a security surface
  → verify-build on the settled diff (fresh subagent, strong model)
       → ⏸ verify-build-failure checkpoint: retry / amend the test / proceed with gap / abandon
  → ⏸ REVIEW gate: verdict + weakest-oracle criteria + rollback first, diff last
       → change requested? commit → review the increment → verify-build again → back to this gate
  → pr
```

## Steps

1. **Take the task.** Use the description (plus any Jira key, GitHub issue or pasted brief) passed
   as args. Given only a ticket key or issue number, fetch it first (Rovo's `getJiraIssue`, or
   `gh issue view`) so step 2 can route it. If nothing was passed, ask for the task in one line.

2. **Route — feature vs bug.** Something broken or misbehaving → bug path; a feature, change or new
   thing → feature path. Also decide whether there's an **externally-authored** item to reconcile
   (Jira, GitHub issue, AI brief). Ask only if genuinely ambiguous.

   **Readiness scan, once, here:**
   - **Tools:** confirm the path's tools are reachable (Rovo, `gh`, browser, MCP). A missing one is a
     blocker to report now, not mid-step.
   - **Working tree + branch:** `git status`. Uncommitted changes would entangle the commits — note
     them so the plan says what to stage. On the default branch, step 5 branches before committing.
   - **Human-only prerequisites:** what the agent can't do — credentials and their scope, external
     access, source cleanup. Hand the list over early so the human can prepare in parallel.

3. **Run the front.** Context files live in `.dev-flow/<task>/`, one directory per task. `<task>` is
   the **ticket key** when there is one (e.g. `PROJ-1234`), else a short kebab-case slug. Fix it once
   here and use it for every sub-step:
   - Feature **with** an external ticket/issue/brief → `/verify-ticket` → `TICKET_CONTEXT.md`. Pass
     any handoff notes or prior research files alongside the ticket.
   - Feature (self-defined, or after verify-ticket) → `/plan-brief` → `PLAN_BRIEF.md`.
   - Bug → `/investigate-bug` → `BUG_CONTEXT.md`.

4. **Plan the approach, then get it approved. ⏸** Enter `/plan` mode referencing the context file
   and design the approach **strictly within the task's scope**.

   **First surface the decisive fork(s)** — the one or two choices that most change the build
   (approach, library, in-scope vs deferred) — via AskUserQuestion *before* finalising the plan. Don't
   bury a contested approach as a recommendation the human has to reject. A deferral that would leave
   what's built with no caller — a scope no page reaches, an export nothing imports — isn't a
   deferral: put it as build it whole vs don't build it. **Put decisions to them, and only
   decisions:** anything you could settle by reading code, running a command or checking a tool is a
   fact — go and get it.

   **Then name any conflict, separately from the forks.** A conflict is a constraint the plan *can't*
   satisfy — two requirements that contradict, or one the codebase's conventions make impossible
   within scope. Picking a side silently loses the other where the gate can't see it, so state which
   constraints collide, what the plan does about it, and who owns the call if not the person at the
   gate. Don't dress a conflict up as a fork with a fabricated option. No conflicts → say nothing;
   never invent one.

   **Then name what nothing in the flow can check.** A criterion whose layer the brief's Test Tooling
   flags with no tooling, that only a run the repo's CLAUDE.md or README says reaches live data could
   check, or that needs access the agent lacks (a login): list each with the reason. For each, the
   human either provides what's missing — a test login goes in `.dev-flow/<task>/ENVIRONMENT.md`,
   never in CLAUDE.md — or accepts it as a check they'll make by hand.

   **Present the plan summary-first:** a 2–3 line TL;DR (what changes, why, blast radius), then the
   **acceptance criteria, numbered** — the ticket's as corrected by verify-ticket and by the forks
   decided here, or the plan's own without a ticket — then the detail. Add a **diagram** only when the approach branches, loops, fans out across files, or has steps that
   depend on each other out of order — a
   plain-text one in a fenced block, **never mermaid** (the terminal shows mermaid as source). Add a
   **table of contents** only when the plan has 3+ sections or runs past a screen. Approval never
   waits on a diagram.

   Then **wait for approval**, revising until approved. Plan mode blocks file writes, so the plan is
   persisted in step 5.

5. **Branch, and persist the approved plan.** On approval, before any code change:
   - **Get on a task branch.** On the default branch, `git switch -c <branch>`, named from `<task>`
     and prefixed by the kind of change: bug path → `fix/` (`hotfix/` when the user calls it one);
     feature path → `feature/`, or `refactor/`, `perf/`, `test/`, `docs/`, `chore/` or `ci/` when the
     plan is only that (e.g. `feature/PROJ-1234-short-slug`). The key in the name is how `/pr` finds
     it. Already on a non-default branch → use it.
   - **Write `.dev-flow/<task>/PLAN.md`** — the approved plan as it was on screen: same scope, same
     length, **no expansion**. Its numbered `## Acceptance criteria` section is the one list every
     later step reads, so write the criteria exactly as approved; detail the human never saw silently
     widens the bar they agreed to.

     Record any conflict settled at the gate **under its own `## Accepted conflicts — not criteria`
     heading**. Written into the prose, it gets a test authored for it and comes back `falsified`.
     Record each criterion the human accepted as a hand check under `## Checked by hand`, with what
     to check, and anything they provided in `ENVIRONMENT.md`.

     `.dev-flow/` is git-ignored, so nothing renders this file: keep any diagram plain text. **On
     request**, also write a self-contained `PLAN.html` that draws its own diagram with no CDN.

6. **Author and audit the acceptance tests.** Before any implementation code:
   - `/author-acceptance-tests` — tests from the criteria, independent of the implementation,
     committed. `ACCEPTANCE_TESTS.md` records the `base` commit, the protected test paths, and the
     contracts the build must expose.
   - `/audit-tests` — spawned as a **fresh subagent** (it must not grade tests it just wrote), its
     prompt carrying only `<task>` and `base` → `TEST_AUDIT.md`.

   **⏸ Checkpoint — audit gap.** Pause on what the audit found, not on a blanket "no adequate test".
   Where the table says ask, use AskUserQuestion, naming the flagged criteria — for an unsatisfiable
   test, with the audit's demonstration that no conforming build passes it:

   | Finding | Pause? | Options |
   |---|---|---|
   | `inadequate` — passes vacuously at `base` | ask | **Strengthen the tests first** · **Already met** · **Proceed anyway** |
   | `unsatisfiable` — no conforming build can pass it | ask | **Rewrite or retire them first** · **Proceed anyway** |
   | `weak` — red only by absence | no | announce and proceed |
   | test-quality defects — a named assertion hole | no | announce and proceed |
   | `not run — reaches live data` | no | announce and proceed |

   - **Strengthen / rewrite / retire:** hand the flagged tests back to `/author-acceptance-tests`. It
     re-commits them and **re-records the new sha as `base`**; then re-run `/audit-tests` as a new
     fresh subagent. For an unsatisfiable test, strengthening is the wrong move — it makes an
     impossible test harder, not possible; rewrite it into a form a conforming build can meet, or
     retire it and carry the criterion unverified.
   - **Already met:** the test passes because the behaviour already exists at `base`. Record the
     criterion under `## Already met at base` in `ACCEPTANCE_TESTS.md`; `/verify-build` treats it as
     preservation, so its test must still pass at HEAD.
   - **Proceed anyway:** record the criteria under `## Accepted at audit` in `ACCEPTANCE_TESTS.md`, so
     `/verify-build` lists them as accepted gaps rather than stopping on them.
   - Both kinds at once → one question, and one re-author pass for whatever is handed back.
   - **No pause:** announce in one line and **name** the criteria rather than counting them
     ("`<criterion>` is weak — red by absence only"); more than three → name three and give a count
     for the rest. `/verify-build` ranks them first, and the REVIEW gate leads with that.

7. **Build — survey, then commit as you go.** For each plan item, search for what already exists to
   reuse — props, components, renderers, hooks, utilities, conventions — and show a short table:
   item · reused · new (only if needed) · files, with a one-line reason for each new abstraction.
   Don't pause on it; a reuse call that contradicts the approved plan is a scope breach to raise.

   Build in **logical increments**, **minimally** — the smallest change that satisfies each item, no
   drive-by refactors, extra flags or redundant deriveds. **Stay in scope**: the plan is the
   contract. Satisfy `ACCEPTANCE_TESTS.md`'s tests and contracts, and **never edit** a protected
   test outside an amendment a human approved at step 8 or 9 (any other edit is a tamper breach). As
   each self-contained change is done, run the repo's **lint + typecheck** (the commands it declares)
   and a cheap smoke check (nothing the repo's CLAUDE.md or README says reaches live data), then
   `/commit` it right away. The bar is shallow on purpose: step 9 runs the full matrix fresh.

   **A test that fails only sometimes gets its cause found, not a retry.** Don't rerun it until it
   passes, add a sleep or wait, raise a timeout, or skip it. A flip your change causes is a bug to
   fix; one you can't trace, stop and say so.

   **Implement to the criteria, not to the tests.** The criteria are the bar; the tests only check
   it. Write what holds for every valid input — never hardcode an expected value, special-case a
   fixture, or satisfy a `data-testid` with a stub that carries the selector but not the behaviour.
   Each goes green and passes the tamper check while shipping nothing, so no later gate catches it.
   If a test looks wrong or a criterion is infeasible, **stop and say so**; changing a test is the
   human's call, made as an amendment.

8. **Review the change — triage, fix, re-review.** Review runs before verification so the verdict
   describes what ships.

   **Round 1 — the whole diff.** Built-in `/code-review` on `git diff <base>`, at an effort
   proportional to the diff (small or mechanical → low–medium; large or risky → high+). **Don't pass
   `--fix`** — it skips the triage.

   **Triage every finding:**
   - **actionable** — a real defect whose fix is inside the approved scope. Fix and `/commit` it.
     Fix the class, not the line: fix other instances of the same defect in `git diff <base>` in that
     commit; instances outside the diff are out-of-scope.
   - **false-positive** — the review misread the code. One line on why, to the REVIEW gate.
   - **out-of-scope** — real, but outside what this change touches or introduces, or with no
     realistic trigger (name the input that breaks it, or it lands here). Not fixed; one line to the
     REVIEW gate.
   - **needs-decision** — the fix collides with something already agreed. ⏸ below.

   **Round 2+ — the increment only:** `<last-reviewed sha>..HEAD`.

   **Stop when nothing actionable is left.** A consequence of this round's own fixes gets fixed; a
   pre-existing finding only when this change makes it reachable. A round that keeps surfacing
   consequences of its own fixes is thrash — name what's left and take it to the gate.

   **⏸ Checkpoint — a fix that contradicts the bar.** The review is right about the code *and* its
   fix collides with something agreed — usually a protected acceptance test, sometimes a conflict
   accepted at the PLAN gate. Ask via AskUserQuestion, naming the finding and what its fix breaks:
   > - **Take the fix and amend the test** — make both edits as **two commits**: the fix, then the
   >   test change on its own, touching only the protected paths it names. Record
   >   `## Approved test amendment (post-build)` in `ACCEPTANCE_TESTS.md` — the test commit's sha,
   >   paths, approver, and `Changes ONLY:` — with `base` **unchanged**. Step 9 reconciles the diff
   >   against it.
   > - **Keep the agreed behaviour** — drop the fix; it rides to the REVIEW gate as a deliberate
   >   decline, with the conflict named.
   > - **Narrow it** — a smaller fix that clears the finding without touching what was agreed.

   **Then built-in `/security-review`, once the loop has settled**, only when the change touches a
   security surface. Grep `git diff <base>` — both sides of each hunk, since a removed guard shows
   only as a `-` line — for auth, permission, secret or endpoint tokens, or a new sink: SQL or a shell
   command built from input, `innerHTML` / `{@html}`, `eval`, deserialisation, a path or URL from
   request data, session, cookie, CORS or crypto config. **Unsure → run it.** It reviews
   `git diff origin/HEAD...`, so first check `git rev-parse --verify origin/HEAD`: where that doesn't
   resolve it reviews nothing — report **not run**, never clean. Triage its findings as above.

9. **Verify the settled diff.** Spawn `/verify-build` as a **fresh subagent with no build context**,
   at a **strong model regardless of diff size**. Its prompt carries `<task>` and `base` (from
   `ACCEPTANCE_TESTS.md`) — it reads the criteria, tests and audit from disk — and nothing else, on
   every pass: no earlier verdict, finding or attempt number, in any phrasing. Before
   each pass after the first, move the existing `VERIFICATION.md` to `VERIFICATION.attempt-<n>.md`.
   What a pass needed just to get running — a port, a login, a failure already present at `base`,
   or a fact the human gives you — belongs in `.dev-flow/<task>/ENVIRONMENT.md`; nothing that judges
   a criterion or reports a result at HEAD.

   **⏸ Checkpoint — verify-build failure.** `verified` → the REVIEW gate. `falsified` or
   `couldn't-verify` → ask via AskUserQuestion:
   > "verify-build could not confirm the change: `<one-line reason>`. How do you want to proceed?"
   > - **Retry the build** — hand the named criteria back to the builder as a fix task (same `base`),
   >   then spawn a new `/verify-build`.
   > - **Amend the test** — *only* when the defect is in the test: a bad regex, an assertion pinned to
   >   a value this task legitimately changes, a prior task's protected test this change contradicts.
   >   Commit the test change on its own and record the amendment as at step 8, `base` unchanged, with
   >   `Changes ONLY:` precise enough that `/verify-build` can fail the diff against it. Then spawn a
   >   new `/verify-build`.
   > - **Proceed to the gate with the gap noted** — carry the verdict to the REVIEW gate as it stands.
   > - **Abandon** — stop and report why. No PR.

   No retry budget — each retry is the human's choice. Order the options to fit the verdict:
   - **Unsatisfiable test** → lead with *Amend*, and put the test and the proof that no conforming
     build passes it in the question. A retry rebuilds working code and the red survives.
   - **Any other `couldn't-verify` where the build is not implicated** — a criterion the verifier
     couldn't reach → lead with *Proceed*, naming the criterion and what would check it.
   - **Two `falsified` passes in a row** → before offering another retry, read the archived
     verdicts, write down the one assumption both builds shared, and make an observation that would
     come out differently if it were false. Put both in the question.

   A retry that only fixes the named criteria needs no second review; one that reworks materially
   more has outrun step 8 — say so, and re-review the increment before the gate. That's judgement,
   not a mandatory second loop.

   **On an amendment, `base` never moves.** Re-recording it to the amendment commit folds the build
   into the base, so `git diff <base>` no longer contains it and the tamper check and falsification
   both pass on nothing. (Step 6's pre-build strengthen does re-record it — no build exists yet.) An
   amended test also loses its oracle: red-at-base can't be re-measured, so `/verify-build` ranks it
   with the weakest.

10. **⏸ REVIEW gate — always human, never skipped or auto-approved.** Present in this order, outcome
   first:
   1. **What this was meant to do** — one line, from the plan or ticket.
   2. **The verdict, and what to look at first** — `VERIFICATION.md`'s verdict, then the head of its
      `## Attention order` carried across as written (named criteria, what to check on each, never
      re-sorted or flattened to counts), then any unresolved or accepted-gap criterion, the checks
      under `PLAN.md`'s `## Checked by hand` as the human's to make, and any criterion already met at
      `base`.
   3. **Findings, and what was done about each** — **fixed** (with the commit), **dismissed** as a
      false positive and why, **left** as out-of-scope and why, **declined** at the needs-decision
      checkpoint with the conflict named, and anything still open.
   4. **The rollback route** — `VERIFICATION.md`'s `## Rollback`.
   5. **Repo facts worth keeping** — lines in `ENVIRONMENT.md` that would hold for any task in this
      repo (a command that reaches live data, a test already failing on the default branch, a setup
      step the docs leave out) and that its CLAUDE.md doesn't already say, each as the line to add.
      Never a credential. Omit when none. Adding them is the human's call: don't edit CLAUDE.md.
   6. **The complete diff** — last.

   **A change asked for at the gate goes back through review and verification:** commit it, review
   the increment, spawn `/verify-build` as in step 9, and present this gate again.

11. **PR.** `/pr`. (CI or bot comments afterwards → `/pr-fix`. A visual walkthrough of the run →
   `/debrief`, opt-in.)

## Guards
- **Three subagents, no more.** `Explore` for recon, `/audit-tests`, `/verify-build` — each buys a
  context the build can't see. No subagent to re-check your own work, and no reviewer beyond
  `/code-review` and step 8's conditional `/security-review`.
- **Opt-in.** The flow runs only when `/dev-flow` is invoked or its steps are run by hand; otherwise
  stay conversational.
- **Scope.** Anything extra you notice → a follow-up at the end.
- **Never push or run `/pr` before the REVIEW gate approves.**
- **Spend the words at the gates.** One line before a long step and one when a checkpoint fires,
  little in between. At each gate, lead with the outcome and rank what you surface — weakest oracle
  over widest reach first.
- **Stop at blockers, fail closed.** A step's tool unavailable, or a subagent unreachable or
  ambiguous → stop and report. A gate the human rejects is revised, not abandoned, unless they say
  stop.
