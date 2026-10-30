---
name: dev-flow-setup
description: One-time, opt-in setup of the local run index — a SQLite database of this Claude config dir's transcripts and .dev-flow artifacts, kept current after every session by the plugin's SessionEnd hook, so past runs can be queried and the detectors can show whether a fix held. Checks Node, builds the index, offers to raise how long Claude Code keeps transcripts, then runs the detectors once. Safe to re-run. Everything stays on this machine. Use when the user says "dev-flow setup", "/dev-flow-setup", "set up the run index", or "index my runs".
---

# dev-flow-setup

Sets up the run index for the Claude config dir this session runs under. Work and personal
configs each get their own: run this once in a session of each, never one for both.

The plugin ships a `SessionEnd` hook that does nothing until this skill has built the index. After
that, every session end updates the index in the background. Deleting the database switches the
hook off again.

**Scripts:** `scripts/index-runs.js` in the plugin root, which is two levels above this skill's base
directory. Resolve it physically, since the skill dir may be a symlink into a clone:
`cd -P "<base>/../.." && pwd`.

## Steps

1. **Check Node.** `node -e "require('node:sqlite')"`. If it fails, say the index needs Node 22.13 or
   later (`node --version` shows what is installed) and stop.

2. **Find the config dir.** `$CLAUDE_CONFIG_DIR` if set, else `~/.claude`. Name it to the user and
   say that a second config gets its own index from a session started under it.

3. **Build the index.** `node <root>/scripts/index-runs.js --config <dir>`. Report the transcript
   count, events added and the database path. If `<dir>/dev-flow-index.db` already existed, say this
   run only added what was new.

4. **Offer to keep transcripts longer.** Read `cleanupPeriodDays` from `<dir>/settings.json` (unset
   means 30). Claude Code deletes transcripts older than that, and the index keeps only what it
   reached before they went. Ask with AskUserQuestion: keep it, 90 days, or 365 days. Change the
   file only on an explicit choice, set only that key, and leave the rest of the file as it was.

5. **Show it working.** `node <root>/scripts/index-runs.js --config <dir> --detect --limit 3`.
   Summarise each detector in one line with its hit count. Hits from before the current dev-flow
   version are a baseline to compare against later, not something to fix now.

6. **Report:** the database path; that the `SessionEnd` hook now keeps it current, logging its last
   run to `<dir>/dev-flow-index.log`; and that deleting the database turns the hook off.

## Guards

- **One config dir per run.** Never pass another config's directory, and never copy one database
  into another: keeping work and personal transcripts apart is the point of one index per config.
- **Nothing leaves the machine.** The index, the hook and the detectors are local; nothing here
  sends data anywhere.
- **Settings change only on an answer.** Step 4 never edits `settings.json` by default.
