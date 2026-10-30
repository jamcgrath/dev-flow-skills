---
name: reflect
description: Read one Claude config dir's run index for failures that RECUR across dev-flow runs, work out why from the runs behind them, and propose changes to the dev-flow skills — cheapest-to-enforce first (a fixed input or step, then a lint, eval or detector, written rules last), each with the detector that fires on the past runs. Writes a report to <config>/reflect/<date>.md, outside any repo, and applies nothing. Proposals describe a pattern, never a run, so they can travel to a public repo. Needs the index /dev-flow-setup builds. Standalone, run by hand after a batch of runs; not part of the flow. Use when the user says "reflect", "/reflect", "what keeps going wrong in my runs", or "did the fix hold".
---

# reflect

Turns what keeps happening in real runs into proposed skill changes. The detectors in
`scripts/detectors/` already count known failures; this finds which failures recur, works out
why, and proposes the change that would stop them, including new detectors for patterns no
detector covers yet.

**Usage:** `/reflect --config <claude config dir>`. There is no default: the index holds one
config dir's transcripts, and naming it each time keeps work and personal runs apart.

**Scripts:** `scripts/index-runs.js` in the plugin root, two levels above this skill's base
directory. Resolve it physically, since the skill dir may be a symlink into a clone:
`cd -P "<base>/../.." && pwd`.

## Steps

1. **Check inputs.** No `--config` → stop and give the usage line. No
   `<config>/dev-flow-index.db` → say `/dev-flow-setup` builds it, in a session under that
   config dir, and stop.

2. **Refresh and detect.** `node <root>/scripts/index-runs.js --config <dir> --detect --limit 500`.
   Each detector prints its hit count, then one `ts  session  detail` row per hit.

3. **Keep what recurs.** A pattern counts only once it shows up in two or more sessions. List the
   one-offs as dropped, with a line each, so they stay visible without becoming lessons.
   Beyond the detectors, look for recurring shapes the detectors don't encode: the same review
   finding dismissed run after run, the same `couldn't-verify` reason, the same gate answer.
   Query the index read-only, never a transcript whole (they run to megabytes):

   ```bash
   node -e 'const {DatabaseSync}=require("node:sqlite");
     const db=new DatabaseSync(process.argv[1],{readOnly:true});
     console.table(db.prepare(process.argv[2]).all())' "<dir>/dev-flow-index.db" "<SELECT ...>"
   ```

   Tables: `sessions`, `agents`, `events` (`kind`, `tool`, `input` JSON, `text`, `source`, `line`),
   `artifacts` (each version of each `.dev-flow` file), and the `session_events` view, which
   includes a session's subagent events. Add a `LIMIT` to every query.

   The artifacts are the richest source: every task's verdict, its `couldn't-verify` reason, its
   test audit. Read the latest version of each with
   `WHERE file = 'VERIFICATION.md' AND mtime = (SELECT max(mtime) FROM artifacts b WHERE b.repo = a.repo AND b.task = a.task AND b.file = a.file)`
   on `artifacts a`, then compare what the verdicts say across tasks.

4. **Work out why.** For each recurring pattern, read the events around two or three of its hits:
   the spawn prompts, which files were read, what the user typed next. Open transcript lines
   only by `source` and `line`, a few at a time. Name the cause in one sentence.

5. **Check whether past fixes held.** Hits dated before this config installed its current dev-flow
   version are a baseline; the date is `lastUpdated` for dev-flow in
   `<config>/plugins/installed_plugins.json`. A detector still firing after its fix shipped is a pattern in its own right.
   If an earlier report exists in `<config>/reflect/`, compare against its counts.

6. **Propose, cheapest to enforce first.** One proposal per pattern, using the first rung that
   would stop it:
   1. change a fixed input or step in a skill, so the wrong thing can't happen;
   2. a lint, eval or detector, so it is caught when it does;
   3. a written rule, last.

   Each proposal gives: the pattern; how often (hits, sessions, date range); the cause; the
   change, naming the skill file and step; and the detector that fires on the past runs, as an
   existing detector name or the full SQL of a new one. An eval it proposes uses invented
   fixtures, never ones copied from a run.

7. **Write the report** to `<config>/reflect/<YYYY-MM-DD>.md` (add `-2`, `-3` if that exists):
   detector counts, the recurring patterns with their evidence (session ids and dates are fine,
   since the report stays in the config dir), the dropped one-offs, and a `## Proposals` section.
   Run that section through `node <root>/scripts/check-private-terms.js --stdin`: exit 1 means a
   private name got through, so rewrite it; exit 2 means no terms list exists, so the report says
   the section was not checked.

8. **Report** the path, the counts, and the proposals in one line each. Ask which to apply.
   Applying one is a separate request.

## Guards

- **One config dir.** Read only `<config>`; never another config's index or transcripts.
- **Proposals describe a pattern, never a run.** No ticket keys, repo names, work file paths or
  quoted work text in `## Proposals`. They are written to be carried into a public repo.
- **Nothing is applied.** No edits under `skills/`, and no detector, eval or fixture written into
  the repo. The report is the only file this writes, and it lives outside every repo.
- **Recurring only.** One run is an anecdote. A pattern from a single session goes under dropped,
  however striking.
