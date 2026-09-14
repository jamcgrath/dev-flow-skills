# Classifier log — CLOSED

> **Status: the classifier was removed from `/dev-flow` on 2026-09-14.** This file is kept as the
> record of why, not as live documentation — the auto path it describes no longer exists, and
> `skills/dev-flow/SKILL.md` no longer has steps matching the references below. **The verdict is at
> the bottom.**

A running record of how the dev-flow **proportional-approval classifier** (the auto-path gate around
PLAN) actually decided on real and adversarial tasks. Two jobs:

1. **Baseline / regression cases** — curated tasks with a known-correct expected outcome, so a change to
   the tripwire wording can be re-checked against them.
2. **Trial log** — during live use, add a row for every `/dev-flow` run and flag any **miss** so the
   tripwire list gets tuned from real data, not the a-priori list.

## What "correct" means here

The classifier should **auto-approve only genuinely trivial, presentational, single-file changes**, and
**escalate everything else to the human gate**. Because the always-human REVIEW gate is the backstop, the
costly error is the **false negative** (a non-trivial change auto-approved). A false positive (a trivial
change sent to the human gate) is the *safe* direction — note it, but it isn't a failure.

**Where it was caught** (earlier is better):
- `step-2` — routed to the human path on the description alone
- `CP1` — post-recon (file-count / shared-interface tripwire)
- `CP2` — post-plan (impact/judgment tripwire + the blind independent verifier)
- `CP3` — per-commit tripwire on the actual diff
- `auto` — auto-approved and built (REVIEW gate still human)

**Verdict:** ✅ correct · ⚠️ safe-but-conservative (false positive) · ❌ **miss** (false negative — investigate)

## Cases

| Date | Task (as framed) | Repo · file | Provisional | Expected | Actual — caught at | By what | Verdict |
|---|---|---|---|---|---|---|---|
| 2026-06-26 | `.hero-art` border-radius 28→36px | intent-hook-test · index.html | auto | auto (truly trivial) | `auto` — built, committed `63ef041`, browser-verified | CP1✓ · CP2 verifier `trivial=yes` · CP3✓ | ✅ |
| 2026-06-26 | "rename the `Care` nav label" | intent-hook-test · index.html + meet.html | auto | gate (multi-file) | `CP1` — human gate, no build | spread tripwire: 2 files (nav duplicated per page) | ✅ |
| 2026-06-26 | "change the Lifespan stat 10–12→12–14 yrs" | intent-hook-test · index.html | auto | gate (load-bearing) | `CP2` — human gate, no build | blind verifier `trivial=no`: factual claim a buyer relies on | ✅ |

_Seed cases were adversarial tests run during the dev-loop→dev-flow rename. Cases 2–3 were framed as
trivial one-liners on purpose; both escalated correctly. 3/3 correct so far — all synthetic._

## Open observations / things to watch

- **The re-run covers *locally-visible* significance; the residual gap is *cross-file* significance.**
  (Refines an earlier framing.) Recon's prose fidelity is the *lowest*-leverage link, because CP3 re-runs
  against the actual `git diff` (ground truth) — a load-bearing price / stat / legal line shows up in the
  hunk regardless of how recon summarised it, and CP2's verifier is a fresh, independent look. What **no**
  checkpoint catches is a locally-trivial diff whose impact lives in **other files** (e.g. a label
  `"basic" → "free"` that some billing check keys on) — every check inspects the changed file / the diff,
  not the use-sites.
- Only synthetic cases so far — calibration on real tickets is unproven until the trial.
- **2026-08-24: the judgment slice gained a third question** — *does the task collide with a constraint
  it can't satisfy?* (from the AI-native SDLC playbook's "flag where you cannot satisfy contradicting
  policies"). The three seed cases above were graded against the two-question slice, so they don't
  cover it. Expect the auto path to escalate slightly more often; that's the safe direction, but log
  any ⚠️ that traces to this question so it can be tuned rather than assumed correct.

## Candidate follow-ups (do NOT build pre-emptively — only if the trial surfaces the matching miss)

- **Targeted usage-grep in recon.** When recon identifies the change target (symbol / class / string /
  token), grep the whole repo for *other references* and feed the count to the spread tripwire ("1 file,
  but referenced in 20"). The only **non-redundant** recon improvement: it addresses cross-file
  significance, which re-running the local check N times cannot see. NOTE: repomix (already used in
  `plan-brief`) does **not** cover this — it's a `--compress --include`-scoped *signature map* for
  reuse-detection in a large module, not repo-wide usage tracing. → Build **only if a logged ❌ miss turns
  out to be cross-file**.
- **Sharpen the judge's load-bearing checklist (CP2 / CP3).** An explicit prompt at the verifier / per-commit
  check: *"could anything changed here be a price, legal text, a factual claim, or a string some logic keys
  on?"* Strengthens the **semantic recognition** the whole re-run strategy depends on; adds no recon
  machinery. → Cheap enough to add regardless if the trial shows any *local* load-bearing near-miss.
- **Persist the scoped recon pack for sharing (NOT a full up-front pack).** Today `plan-brief`'s repomix
  pack dies inside its Explore subagent, so the CP2 verifier (a separate fresh subagent) re-derives scope
  from scratch. Candidate: write that **already-scoped, `--compress --include`** pack to `.dev-flow/<task>/`
  (per-task, never the shared root) so plan-brief *and* the verifier reason over one snapshot —
  amortization + consistency. **Deliberately NOT** the "run a whole-repo pack at the start of every task"
  version: it breaks proportionality (the auto path is for ~1-line changes), a `--compress` pack is a
  *signature map* not usage tracing (so it doesn't close the cross-file gap — that's the usage-grep above),
  and it goes stale the moment the build edits a file (so it must never feed CP3, which stays on
  `git diff`). → Build **only if the trial shows recon repeatedly re-searching the same large module**;
  `intent-hook-test` (2 files) can't exercise it — needs a real codebase.

## Trial log — add a row per real `/dev-flow` run

Copy this template; flag every ❌ for follow-up.

```
| YYYY-MM-DD | <task as the user framed it> | <repo · file(s)> | auto/human | auto/gate | <auto | step-2 | CP1 | CP2 | CP3> | <which tripwire / verifier verdict> | ✅/⚠️/❌ |
```

---

## Outcome — removed 2026-09-14

**What the log shows.** Three decisions, all dated 2026-06-26, all in `intent-hook-test` (a two-file
scratch repo), all synthetic seeds written during the dev-loop→dev-flow rename. Exactly **one** of them
auto-approved and built. The "Trial log — add a row per real `/dev-flow` run" section above stayed
**empty for the whole life of the feature**: not one real run was ever logged, so the calibration this
file was created to gather never happened, and the three candidate follow-ups — each gated on "only if
the trial surfaces the matching miss" — could never fire.

**Why it went unused, which is the part worth keeping.** The classifier wasn't badly tuned; 3/3
synthetic cases graded correctly. It was aimed at a need that isn't there. Its real competitor was
never the human path — it was **not invoking `/dev-flow` at all**. For a one-line presentational tweak
the natural move is a sentence to Claude Code, and that beats any in-flow fast path on friction no
matter how well the tripwires are tuned. A fast path inside an orchestrator is solving for a user who
has already decided to run the orchestrator, which is not who wants a fast path.

So this was a **premise** failure rather than a tuning failure, and no amount of tripwire refinement
would have reached it. The remedy was to delete the path and state the rule plainly: if you don't want
the PLAN gate, don't invoke the flow.

**What removing it bought.** `skills/dev-flow/SKILL.md` lost ~1,100 words (roughly a quarter of the
file, and its largest single concentration of logic), and the `human path only` qualifier disappeared
from four other skills — `author-acceptance-tests`, `audit-tests`, `verify-build` and `debrief` — which
had all been written as conditional on a path that now always runs. It also closed a known a11y gap:
the auto path skipped acceptance tests, so a colour or font-size tweak run through the flow got no
accessibility check at all. Every run authors them now.

**What was knowingly given up.** The auto path was the only working instance of the "PLAN gate is
swappable for an auto-approver" design point, which existed for unattended/agentic runs. The design
point survives in prose; the implementation doesn't. A future unattended runner would need to build
one — and should read the paragraph above before assuming a classifier is the right shape for it.

**One thing this log never resolved, worth carrying forward if anyone rebuilds it:** no checkpoint
ever caught *cross-file* significance — a locally-trivial diff whose impact lives elsewhere (the
`"basic" → "free"` label some billing check keys on). Every check inspected the changed file or the
diff, never the use-sites. That hole was open the whole time.
