# dev-flow-skills

A project-agnostic, AI-assisted **dev flow** for [Claude Code](https://claude.com/claude-code),
packaged as one installable plugin. It sequences skills you'd otherwise run by hand into a
structured flow with two human gates — fire it off, approve the plan, review before the PR.

The flow adds **almost no behaviour of its own** — beyond the persisted plan (`PLAN.md`) at the PLAN
gate, the condition that fires a security review before the REVIEW gate, and two test-integrity
checkpoints before and after the build, `/dev-flow <task>` is a thin orchestrator that routes feature
vs bug and runs the chain below. Outside it, work stays conversational — nothing fires unless you
invoke it. There's no fast path: a change small enough to want one doesn't need the orchestrator, so
just ask for it conversationally instead.

## Who it's for

Anyone using Claude Code who wants a repeatable, opt-in structure around feature and bug work,
on any repo and any (or no) tracker. It's deliberately tool-agnostic: the context-gathering
skills **derive conventions from the codebase they're in — they never assume the stack**.

**Both gates here are human — if you want this hands-off, you want the other one.**
[`auto-flow-skills`](https://github.com/jamcgrath/auto-flow-skills) is the unattended counterpart:
ticket in, PR out, both gates swapped for automated approvers, with the review guarantee relocated to
the merge decision rather than dropped. It's a separate plugin with its own vendored sub-skills
precisely because removing a gate isn't a setting — it changes the safety model. So there's no
"hands-off mode" flag to look for here, and no fast path inside this flow.

> **This is one developer's workflow — it may not be yours, and that's fine.** It encodes my
> preferences: where the human gates sit, the Decision Log commit style, how much evidence a review
> gate deserves. Treat it as a starting point, not a prescription. The skills are plain markdown, so
> **adapt them to how *you* work** — fork the gates you don't want, change the commit format, drop
> skills you won't use. If you only keep one invariant, keep the
> **always-human REVIEW gate before the PR** — that's the load-bearing safety property the rest leans
> on. Issues and forks welcome, but you never have to ask permission to make it fit you.

## The flow

```
/dev-flow <task>
  → route: feature or bug? · ticket or none? · readiness scan
  → [verify-ticket]   only if there's an external ticket / issue / brief to reconcile
  → plan-brief (feature)  |  investigate-bug (bug)
  → plan the approach
       → ⏸ PLAN gate: forks + conflicts surfaced, plan, WAIT FOR APPROVAL
  → branch off default (if needed)
  → /author-acceptance-tests → /commit (= base) → /audit-tests
       → ⏸ audit-gap checkpoint (only a test that cannot do its job — *inadequate*/always-green
                                  or *unsatisfiable*/never-green; weak + quality defects ride
                                  forward): proceed anyway / strengthen / rewrite or retire
  → build + /commit each change
  → /code-review (built-in) → triage → fix + /commit → re-review until nothing actionable is left
       → ⏸ needs-decision checkpoint: a fix that contradicts the agreed bar —
                                       take it + amend the test / keep the agreed behaviour / narrow it
  → [/security-review]  (built-in)  once the loop settles, when the diff touches a security surface
  → /verify-build on the SETTLED diff (fresh subagent, strong model, tries to falsify the change)
       → ⏸ verify-build-failure checkpoint: retry build / amend the test (base held still) /
                                             proceed with gap noted / abandon
  → ⏸ REVIEW gate — human sanity-check before the PR  (ALWAYS human, never auto-approved;
       leads with the verdict + the weakest-oracle criteria + the rollback route, diff last)
  → /pr                 (bots/CI after → /pr-fix)
  → [debrief]           optional epilogue — an interactive HTML page of what the run did
```

> 📊 For a rendered flowchart of the full sequence, see [docs/dev-flow.md](docs/dev-flow.md).
> [docs/classifier-log.md](docs/classifier-log.md) is the closed record of the auto-approval
> classifier this flow used to carry, and why it was removed — worth reading before adding a fast
> path of your own.

## What's in it

| Skill | Role |
|---|---|
| `dev-flow` | Orchestrator — the single explicit entry; routes feature/bug and sequences the rest |
| `verify-ticket` | *(optional)* reconcile an externally-authored ticket/issue/brief against the actual code |
| `plan-brief` | feature recon — gather grounded context for `/plan` mode (the portable entry; no tracker required) |
| `investigate-bug` | bug recon — get it reproducing red at the bug's own layer before any theory, then trace it |
| `author-acceptance-tests` | turn acceptance criteria into committed tests, independent of the build, before it starts |
| `audit-tests` | fresh-subagent adequacy audit of those tests via red-before-green |
| `verify-build` | fresh-subagent independent falsifier — replaces builder self-checking at verify |
| `commit` | commit with a proportional Decision Log (intent that the diff can't recover) |
| `pr` | open a PR whose body synthesises the branch's Decision Logs |
| `pr-fix` | resolve all open PR review comments (human + bot), reply to each thread, push |
| `debrief` | *(optional)* epilogue for you, not the reviewer — one interactive HTML page of what the run did, linking the artifacts |
| `discuss` | *(standalone — not in the flow)* one-question-at-a-time interview that settles a decision and records why, in `DISCUSSION.md`; works with or without a codebase |

`/code-review` and `/security-review` are Claude Code built-ins used by the flow but aren't bundled here
(the security review runs only when the diff touches a security surface).

**You don't have to run the whole flow.** The recon skills — `verify-ticket`, `plan-brief`,
`investigate-bug` — also work as standalone one-offs: reality-check a ticket, gather plan context, or
investigate a bug without committing to the pipeline. Run alone, each writes its context file
(`TICKET_CONTEXT.md` / `PLAN_BRIEF.md` / `BUG_CONTEXT.md`) and stops there; the orchestration the full
flow layers on — the PLAN gate and the persisted, visualised `.dev-flow/<task>/PLAN.md` — only
happens under `/dev-flow`.

`discuss` goes further: it isn't part of the flow at all. `/dev-flow` never invokes it and never reads
what it writes. Its natural slot is upstream of `/dev-flow` — settle *what* you're doing and why
before the flow gathers context on how — but it's equally for work that never reaches a codebase, like
standing up infrastructure or choosing a tool. Invoke it deliberately or not at all; it's marked
`disable-model-invocation`, so it will never start an interrogation on its own — which also means it
won't appear in Claude's skill list even when correctly installed. Reach it as `/discuss`; absence
from the list isn't a broken install.

## Layout

```
dev-flow-skills/
  .claude-plugin/marketplace.json   # makes the set installable as a plugin
  skills/<name>/SKILL.md            # one folder per skill — auto-discovered
  scripts/validate-skills.js        # structural lint — frontmatter + dead cross-references
  scripts/run-skill-evals.js        # behavioural evals for audit-tests and verify-build
  evals/                            # eval cases + fixtures (see evals/README.md)
  docs/                             # the rendered flowchart and the classifier log
  .github/workflows/lint.yml        # runs the lint and its unit tests on push
```

## Install

### As a plugin (recommended)

```sh
/plugin marketplace add jamcgrath/dev-flow-skills
/plugin install dev-flow@dev-flow-skills
```

Then `/dev-flow <task>`, or any individual skill (`/plan-brief`, `/commit`, …).
The repo is public, so `/plugin marketplace add` works with no special access — it uses your
existing GitHub auth.

### Updating

This is a third-party marketplace, so it **doesn't auto-update by default** — pull new versions
manually:

```sh
/plugin marketplace update dev-flow-skills   # fetch the latest catalog from GitHub
/reload-plugins                              # activate it in the current session
```

`/reload-plugins` is the easy-to-miss step — without it the refreshed version doesn't take effect
until you restart Claude Code. To see what's installed (and toggle things), open `/plugin` → the
**Marketplaces** / **Installed** tabs. Updates track whatever's on `main`, so "update" means
"latest commit", not a tagged release.

Prefer it hands-off? Turn on auto-update for this marketplace — `/plugin` → **Marketplaces** →
enable auto-update on `dev-flow-skills` (or set `"autoUpdate": true` for it in
`.claude/settings.json`) — and new pushes flow in at startup (you'll just get a `/reload-plugins`
nudge).

### For development (live edits)

Symlink the skill folders into your user skills dir so edits in this repo are live immediately.
Run it from the repo root; it discovers whatever is in `skills/`, so re-run it after pulling to
pick up skills added since:

```sh
for d in "$PWD"/skills/*/; do
  n=$(basename "$d")
  if [ -e ~/.claude/skills/"$n" ] && [ ! -L ~/.claude/skills/"$n" ]; then
    echo "skipped $n — something that isn't a symlink is already there"
  else
    ln -sfn "${d%/}" ~/.claude/skills/"$n"
  fi
done
```

Safe to re-run: it replaces its own symlinks, and refuses to touch a destination that already
exists and isn't one — a real directory or a regular file. New symlinks register at startup, so
restart the session to pick them up.

## Conventions & things to know before you adopt these

- **`commit` and `pr` embed a "Decision Log" commit convention** (Intent / Approach / Alternatives
  ruled out / Assumptions / Trade-offs). Installing them means adopting that commit style — the
  skills carry the format themselves, so it works standalone, but it's opinionated by design.
- **Both gates are human, and there is no fast path.** Invoking `/dev-flow` means the full sequence:
  plan approval, acceptance tests, an independent falsifier, and a human review before the PR. Nothing
  auto-approves. This is deliberate — the flow used to carry a classifier that fast-tracked trivial,
  presentational changes, and it was removed after three months in which it auto-approved exactly one
  change (a synthetic test). The reason it went unused is worth stating, because it will apply to your
  fork too: **a fast path inside the orchestrator competes with not invoking the orchestrator**, and it
  loses, because the tool for a one-line tweak is a sentence to Claude Code, not a pipeline with a
  classifier in it. `docs/classifier-log.md` keeps the record.
- **Three test-integrity skills defend the tests against the build.** `author-acceptance-tests`,
  `audit-tests`, and `verify-build` turn acceptance criteria into committed tests, audit their
  red-before-green adequacy, and independently try to falsify the finished build — see
  [skills/dev-flow/SKILL.md](skills/dev-flow/SKILL.md) steps 6, 7 and 9. What that machinery defends is the
  tests' integrity against the *build*; what it can't catch is a build that satisfies them
  **literally** — a hardcoded expected value, a special-cased fixture, a `data-testid` on a stub —
  because nothing has been tampered with and everything goes green. So the build step also points the
  work at the criteria rather than the tests. Treat that half as prompt discipline, not an enforced
  check.
- **The review gate is ranked, not just assembled.** `verify-build` doesn't only return a verdict — it
  sorts the criteria **weakest oracle first, widest reach breaking the tie** (oracle strength comes from
  `audit-tests`' adequate/weak/inadequate grade, reach from the diff's per-file churn and, where the
  project exposes an import graph, the changed files' fan-in). The REVIEW gate and the PR body then lead
  with that order — intent, verdict, the named criteria to check first, the findings, the rollback
  route, and the complete diff **last**, still available but no longer the lead. The counts (`N adequate
  / N weak`) stay as supporting detail: they say how much was checked, never *where to look*. This
  matters most for the criteria that don't stop the flow — a `weak`, red-by-absence test rides forward
  without a pause by design, so without a rank the thinnest oracle in the change arrives as the quietest
  line on the page.
- **Accessibility rides the UI layer.** There's no a11y *step* and no "is this a UI ticket?" flag.
  `author-acceptance-tests` treats a role + accessible name, keyboard
  operability, and a scan of the changed view as part of what the UI layer's contract already means —
  decided per **criterion**, so it's silent on a backend criterion inside a UI-ish task and still fires
  on the one rendered element inside a backend one. It's **tooling-gated**: with no harness in the repo
  (`@axe-core/*`, `jest-axe`, `pa11y`) the line is recorded `unverifiable (tooling gap)` rather than
  installing one, so this is a no-op wherever you don't already test a11y. `verify-build` then enforces
  it for free — the criteria are its spec. (Removing the auto path closed a hole here: a trivial colour
  or font-size tweak used to skip the acceptance-test machinery entirely and so got no a11y check at
  all. Every `/dev-flow` run now authors them. A tweak you *don't* run through the flow is still on you
  — that's the trade for keeping the fast path outside the tool.)
- **The acceptance-test commit keeps hooks on.** It's intentionally red (the tests reference
  behaviour the build hasn't added yet), but `author-acceptance-tests` commits normally rather than
  bypassing hooks. If a hook rejects it specifically because of the by-design-red suite, the skill
  pauses and asks rather than silently retrying with `--no-verify`.
- **`pr` pushes and opens the PR.** When a remote exists it runs `git push -u origin HEAD`, then
  opens the PR. It requests no reviewer — the flow's "bots comment → `/pr-fix`" step only has
  something to clear on a repo with continuous review configured; where none is, `/pr-fix` is for
  the human threads. On a local-only repo `pr` writes a `PR_PREVIEW.md` instead of pushing.
- **`pr-fix` acts on untrusted input.** It reads PR comments — including from bots and any
  contributor — and applies the "actionable" ones as code changes, then pushes. It mitigates this
  by triaging every comment and showing the triage before big batches (it does **not** blindly
  apply), but be aware that's the one place the flow ingests external content and takes write
  actions. Review its triage table.
- **`.dev-flow/` scratch dir.** The recon skills write context files under `.dev-flow/<task>/` in
  whatever repo you run them in. Add `.dev-flow/` to that repo's `.gitignore` (or your global
  gitignore) so they don't get committed. The skills never touch `.git/` or a shared `.gitignore`
  themselves.
- **Tooling assumptions.** `verify-ticket`/`pr`/`pr-fix` use the `gh` CLI and (for Jira) an
  Atlassian MCP; `investigate-bug` uses the Chrome DevTools MCP *for UI bugs* (other layers use their
  own harness — a unit test, `curl`, a seeded query). Each skill stops and says so in
  one line if its tool isn't available — it won't work around a missing tool.

## License

[MIT](LICENSE) © James McGrath
