# dev-flow-skills

A project-agnostic, AI-assisted **dev flow** for [Claude Code](https://claude.com/claude-code),
packaged as one installable plugin. It sequences skills you'd otherwise run by hand into a
structured flow with up to two human gates — fire it off, approve the plan (auto-approved for trivial,
presentational changes), review before the PR.

The flow adds **almost no behaviour of its own** — beyond the proportional-approval classifier around
the PLAN gate, `/dev-flow <task>` is a thin orchestrator that routes feature vs bug and runs the chain
below. Outside it, work stays conversational — nothing fires
unless you invoke it.

## Who it's for

Anyone using Claude Code who wants a repeatable, opt-in structure around feature and bug work,
on any repo and any (or no) tracker. It's deliberately tool-agnostic: the context-gathering
skills **derive conventions from the codebase they're in — they never assume the stack**.

> **This is one developer's workflow — it may not be yours, and that's fine.** It encodes my
> preferences: where the human gates sit, the Decision Log commit style, what counts as "trivial"
> enough to auto-approve. Treat it as a starting point, not a prescription. The skills are plain
> markdown, so **adapt them to how *you* work** — fork the gates you don't want, change the commit
> format, retune the classifier, drop skills you won't use. If you only keep one invariant, keep the
> **always-human REVIEW gate before the PR** — that's the load-bearing safety property the rest leans
> on. Issues and forks welcome, but you never have to ask permission to make it fit you.

## The flow

```
/dev-flow <task>
  → route: feature or bug? · ticket or none? · approval mode (human vs auto) · readiness scan
  → [verify-ticket]   only if there's an external ticket / issue / brief to reconcile
  → plan-brief (feature)  |  investigate-bug (bug)   → checkpoint 1 (auto path): blast radius still small?
  → plan the approach (ALWAYS) — then:
       · human path → ⏸ PLAN gate: forks surfaced, plan, WAIT FOR APPROVAL
       · auto path  → checkpoint 2: classifier + independent verifier OK the plan → announce, proceed
  → build + /commit each change → verify   · checkpoint 3 (auto path): before each commit, tripwire; breach → ⏸ human gate
  → /code-review        (Claude Code built-in)
  → ⏸ REVIEW gate — human sanity-check before the PR  (ALWAYS human; even unattended stops here)
  → /pr                 (bots/CI after → /pr-fix)
```

> 📊 For a rendered flowchart of the human/auto branches and the three classifier checkpoints, see
> [docs/dev-flow.md](docs/dev-flow.md). For a log of how the auto-path classifier actually decided on
> real and adversarial tasks (and any misclassifications), see [docs/classifier-log.md](docs/classifier-log.md).

## What's in it

| Skill | Role |
|---|---|
| `dev-flow` | Orchestrator — the single explicit entry; routes feature/bug and sequences the rest |
| `verify-ticket` | *(optional)* reconcile an externally-authored ticket/issue/brief against the actual code |
| `plan-brief` | feature recon — gather grounded context for `/plan` mode (the portable entry; no tracker required) |
| `investigate-bug` | bug recon — systematic investigation via the Chrome DevTools MCP |
| `implement-brief` | build a brief the lean way — reuse survey first, then minimal build + browser verify |
| `commit` | commit with a proportional Decision Log (intent that the diff can't recover) |
| `pr` | open a PR whose body synthesises the branch's Decision Logs |
| `pr-fix` | resolve all open PR review comments (human + bot), reply to each thread, push |

`/code-review` is a Claude Code built-in and is used by the flow but isn't bundled here.

## Layout

```
dev-flow-skills/
  .claude-plugin/marketplace.json   # makes the set installable as a plugin
  skills/<name>/SKILL.md            # one folder per skill
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

### For development (live edits)

Symlink the skill folders into your user skills dir so edits in this repo are live immediately:

```sh
for d in dev-flow verify-ticket plan-brief investigate-bug implement-brief commit pr pr-fix; do
  ln -s "$PWD/skills/$d" ~/.claude/skills/"$d"
done
```

## Conventions & things to know before you adopt these

- **`commit` and `pr` embed a "Decision Log" commit convention** (Intent / Approach / Alternatives
  ruled out / Assumptions / Trade-offs). Installing them means adopting that commit style — the
  skills carry the format themselves, so it works standalone, but it's opinionated by design.
- **The PLAN gate is proportional (approval only).** Recon and planning always run; what's conditional
  is the *human approval* of the plan. Only **trivial, presentational** changes — a font-size, a layout
  tweak, a *non-load-bearing* copy string — auto-approve and build (plus anything you explicitly tell it
  to skip). A classifier re-validates after recon, after the plan (via an independent verifier
  subagent), and before every commit. Its mechanical tripwires *exclude* the dangerous stuff (more than
  one file, new/deleted files, new deps, and any edit to existing **functional/logic** behaviour —
  control flow, a guard, a limit, a default, auth/secret/endpoint tokens) but they don't *certify* what's
  left safe: for the cosmetic edits that remain, the real net is a small judgment call (decisive fork? a
  load-bearing string?) **plus the always-human REVIEW gate**. Any breach or doubt reverts to the human
  gate. The pre-PR **review gate is always human — even an unattended run stops there before pushing** —
  and commits are reversible, so a misclassification is at worst a cheap commit caught at review.
- **`pr` pushes.** When a remote exists it runs `git push -u origin HEAD` and opens the PR; on a
  local-only repo it writes a `PR_PREVIEW.md` instead of pushing.
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
  Atlassian MCP; `investigate-bug` uses the Chrome DevTools MCP. Each skill stops and says so in
  one line if its tool isn't available — it won't work around a missing tool.

## License

[MIT](LICENSE) © James McGrath
