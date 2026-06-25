# dev-loop-skills

A project-agnostic, AI-assisted **dev loop** for [Claude Code](https://claude.com/claude-code),
packaged as one installable plugin. It sequences skills you'd otherwise run by hand into a
structured loop with two human gates — fire it off, approve the plan, review before the PR.

The loop **adds no behaviour of its own**: `/dev-loop <task>` is a thin orchestrator that routes
feature vs bug and runs the chain below. Outside it, work stays conversational — nothing fires
unless you invoke it.

## Who it's for

Anyone using Claude Code who wants a repeatable, opt-in structure around feature and bug work,
on any repo and any (or no) tracker. It's deliberately tool-agnostic: the context-gathering
skills **derive conventions from the codebase they're in — they never assume the stack**.

## The loop

```
/dev-loop <task>
  → route: feature or bug? · ticket or none? · readiness scan (tools · dirty tree · prereqs)
  → [verify-ticket]   only if there's an external ticket / issue / brief to reconcile
  → plan-brief (feature)  |  investigate-bug (bug)
  → ⏸ PLAN gate — decisive forks surfaced as questions, then plan, WAIT FOR APPROVAL
  → build + /commit each logical change (early & often) → verify
  → /code-review        (Claude Code built-in)
  → ⏸ REVIEW gate — human sanity-check before the PR
  → /pr                 (bots/CI after → /pr-fix)
```

## What's in it

| Skill | Role |
|---|---|
| `dev-loop` | Orchestrator — the single explicit entry; routes feature/bug and sequences the rest |
| `verify-ticket` | *(optional)* reconcile an externally-authored ticket/issue/brief against the actual code |
| `plan-brief` | feature recon — gather grounded context for `/plan` mode (the portable entry; no tracker required) |
| `investigate-bug` | bug recon — systematic investigation via the Chrome DevTools MCP |
| `implement-brief` | build a brief the lean way — reuse survey first, then minimal build + browser verify |
| `commit` | commit with a proportional Decision Log (intent that the diff can't recover) |
| `pr` | open a PR whose body synthesises the branch's Decision Logs |
| `pr-fix` | resolve all open PR review comments (human + bot), reply to each thread, push |

`/code-review` is a Claude Code built-in and is used by the loop but isn't bundled here.

## Layout

```
dev-loop-skills/
  .claude-plugin/marketplace.json   # makes the set installable as a plugin
  skills/<name>/SKILL.md            # one folder per skill
```

## Install

### As a plugin (recommended)

```sh
/plugin marketplace add jamcgrath/dev-loop-skills
/plugin install dev-loop@dev-loop-skills
```

Then `/dev-loop <task>`, or any individual skill (`/plan-brief`, `/commit`, …).
While the repo is private, you need read access to it; `/plugin marketplace add` uses your
existing GitHub auth.

### For development (live edits)

Symlink the skill folders into your user skills dir so edits in this repo are live immediately:

```sh
for d in dev-loop verify-ticket plan-brief investigate-bug implement-brief commit pr pr-fix; do
  ln -s "$PWD/skills/$d" ~/.claude/skills/"$d"
done
```

## Conventions & things to know before you adopt these

- **`commit` and `pr` embed a "Decision Log" commit convention** (Intent / Approach / Alternatives
  ruled out / Assumptions / Trade-offs). Installing them means adopting that commit style — the
  skills carry the format themselves, so it works standalone, but it's opinionated by design.
- **`pr` pushes.** When a remote exists it runs `git push -u origin HEAD` and opens the PR; on a
  local-only repo it writes a `PR_PREVIEW.md` instead of pushing.
- **`pr-fix` acts on untrusted input.** It reads PR comments — including from bots and any
  contributor — and applies the "actionable" ones as code changes, then pushes. It mitigates this
  by triaging every comment and showing the triage before big batches (it does **not** blindly
  apply), but be aware that's the one place the loop ingests external content and takes write
  actions. Review its triage table.
- **`.dev-loop/` scratch dir.** The recon skills write context files under `.dev-loop/<task>/` in
  whatever repo you run them in. Add `.dev-loop/` to that repo's `.gitignore` (or your global
  gitignore) so they don't get committed. The skills never touch `.git/` or a shared `.gitignore`
  themselves.
- **Tooling assumptions.** `verify-ticket`/`pr`/`pr-fix` use the `gh` CLI and (for Jira) an
  Atlassian MCP; `investigate-bug` uses the Chrome DevTools MCP. Each skill stops and says so in
  one line if its tool isn't available — it won't work around a missing tool.

## License

[MIT](LICENSE) © James McGrath
