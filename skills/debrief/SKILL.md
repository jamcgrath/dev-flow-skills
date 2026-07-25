---
name: debrief
description: OPTIONAL closing epilogue for a finished /dev-flow run — read the run's real evidence (the branch's commits and diff since base, plus whatever .dev-flow/<task>/ artifacts exist) and render ONE self-contained interactive HTML page at .dev-flow/<task>/DEBRIEF.html, so the developer who ran the flow can SEE what went down — what was asked, what shipped, where the change landed, how it got built. Deliberately not markdown, and it LINKS to the flow's artifacts rather than restating them. Picks its diagrams from the shape of the diff (churn map / layer map / commit timeline / move map) instead of always drawing the same thing. Opt-in and terminal — you invoke it, it never fires on its own, it writes one file and changes nothing else, adds no gate or pause, and nothing downstream reads it. Requires a task that went through the flow (.dev-flow/<task>/ must exist) — explaining an arbitrary branch is /init's job, not this one. Use when the user says "debrief", "/debrief", "what did we just do", or wants a visual walkthrough of a completed task.
---

# debrief

The flow's **closing epilogue**, and an artifact for **you** rather than for a reviewer. `/pr` already
synthesises the branch for whoever decides whether to merge it; nothing else is written for the person
who ran the flow and wants to see what actually happened. This renders that — one self-contained HTML
page you open in a browser, so the change can be *seen* instead of read.

**It links, it doesn't restate.** `PLAN.md`, `TEST_AUDIT.md`, `VERIFICATION.md` and the rest already
hold the detail and sit in the same directory. The page is a hub over them: a few lines per phase and
a link out. Copying their contents onto it would just rebuild the wall of markdown this exists to
replace.

**Opt-in and terminal.** It runs only when invoked. It writes one file, touches nothing else,
introduces no gate and no pause, and nothing downstream reads its output. It doesn't verify, fix,
commit, or act on anything it notices — a follow-up it surfaces is a note on the page, not a task it
starts.

## Steps

1. **Locate the run.** Resolve `<task>` the way `/pr` does: the first `[A-Z][A-Z0-9]+-[0-9]+` match in
   the branch name, else the sole `.dev-flow/*` dir for this branch. **No `.dev-flow/<task>/` → stop
   and say so** — this is a dev-flow epilogue, and recon always runs on both paths, so the directory
   exists after any real run. Then resolve `base`: the base commit recorded in
   `.dev-flow/<task>/ACCEPTANCE_TESTS.md` (human path only — the auto path never writes that file),
   else `git merge-base` against the default branch.

2. **Gather the evidence — read-only, and nothing from memory.** Everything the page says must trace
   to one of these:
   - `git log --format='%H%n%s%n%b%n---END---' <base>..HEAD` — the bodies carry the Decision Logs
   - `git diff -M --name-status <base>..HEAD` — status per file; the `R` entries are the moves
   - `git diff -M --numstat <base>..HEAD` — per-file `+`/`−`, which is what sizes the churn map
   - the `.dev-flow/<task>/` artifacts that exist — read only the lines the page shows (the verdict
     from `VERIFICATION.md`, the counts from `TEST_AUDIT.md`, the goal from `PLAN_BRIEF.md`) and link
     the rest. An artifact that isn't there is **stated as absent** ("no acceptance tests — auto
     path"), never reconstructed.
   - `gh pr view --json number,url,title,state` when there's a remote; skip silently when there isn't.

3. **Pick the views from the shape of the diff.** Render **every** view whose trigger fires, stacked
   as collapsible sections with the first one open, each labelled with why it fired ("5 files across
   3 directories"). No trigger fires → the files table alone, plus a line saying the change was too
   small to need a diagram. Never draw a view whose trigger didn't fire just to fill the page.

   | View | Fires when | Answers |
   |---|---|---|
   | **Churn map** | ≥4 changed files across ≥2 directories | where the weight landed |
   | **Layer map** | references or imports observable *between* the changed files | how the pieces connect |
   | **Commit timeline** | ≥3 commits since `base` | how it got built up |
   | **Move map** | any `R` (rename/move) entry in `--name-status` | what went where |

   **Layer by dependency depth, never by directory and never by a guessed stack.** Columns are depth —
   what references nothing else in the change on the left, what everything points at on the right — so
   edges run one way and never cross a node. (Column-per-directory looks reasonable and is a trap: an
   edge passing behind an opaque box reads as a chain that doesn't exist.) Direction comes from imports
   where the language exposes them and from **textual references** otherwise, which is what makes the
   view work on a config- or docs-only change. If no edge can be observed at all it **doesn't fire** —
   boxes grouped with no connectors are just the file table again. A hardcoded UI → hook → service →
   data taxonomy is wrong in most repos.

4. **Write `.dev-flow/<task>/DEBRIEF.html`.** One page, in this order:
   - **Header** — task, branch, `N commits · N files · +X −Y`, PR link, verification verdict badge.
   - **Phases** — Ask · Plan · Build · Verification, two or three lines each, each linking to the
     artifact that holds the detail. Absent phases say so. Build also lists the commits (sha, subject,
     Intent line) — that data has no artifact to link to, and the timeline *view* is its visual form
     for when there are enough commits to have a shape.
   - **Views** — the sections from step 3.
   - **Files changed** — every path with its status and churn.
   - **Artifacts** — a link to every `.dev-flow/<task>/` file present, and the PR.

   Build it as **one self-contained file** — inline `<style>` and `<script>`, **no network at all**: no
   CDN, no mermaid, nothing that stops the page rendering from `file://` offline. Use **DOM + SVG, not
   canvas**: at this scale divs give you CSS hover, real click targets, crisp text and selectable
   paths for free, where canvas would mean hand-written hit-testing. Collapse with
   `<details>`/`<summary>` so the page still works with JS off. Two techniques worth following exactly,
   because they're the parts that otherwise go wrong:
   - **Churn map** — nested flex with `flex: <lines changed>` on each box, so the *browser* computes
     the proportions and nothing can overlap or need hand-computed coordinates. Use the bare-number
     shorthand: it sets `flex-basis: 0`, where `flex: <n> 1 auto` distributes only the *free* space and
     silently renders a 34:1 ratio as 2:1. Give boxes a `min-width` and a `title`, keep the name and
     its counts on one wrapping row so the label survives at that floor, and below ~640px fall back to
     a plain stacked list — proportional area needs width to read, and the legend must then stop
     claiming a proportionality the layout isn't showing.
   - **Layer map** — CSS grid columns plus a single absolutely-positioned `<svg>` overlay, its
     endpoints read from `getBoundingClientRect()` after layout and recomputed on resize **and on
     `<details>` toggle** (a collapsed section measures zero). The browser lays out; JS only draws
     lines between elements it can already measure.

   Link siblings relatively (`href="PLAN.md"`) — they resolve from `file://` because the page sits in
   the same directory. Support light and dark via `prefers-color-scheme`.

5. **Open it and hand off.** Open the file with the platform opener (`open` on macOS, `xdg-open` on
   Linux, `start` on Windows); if none is available, print the path instead. Then confirm in **three
   lines at most**: the path, which views fired, and anything the evidence couldn't answer. Don't
   summarise the page in chat — the page *is* the summary.

## Guards
- **Grounded, never narrated.** Every claim on the page traces to a commit, a diff stat, or an
  artifact file. Writing it from what you remember of the session is exactly the drift the rest of
  this flow exists to catch — `verify-ticket` reality-checks tickets and `audit-tests`/`verify-build`
  run fresh precisely so nothing grades its own account of itself.
- **Absent means absent.** A missing artifact is reported as missing. Never infer what the plan
  "would have said" or what verification "probably found".
- **Link, don't copy.** If a section is turning into a transcript of an artifact, cut it to its
  headline and link out.
- **Proportional diagrams.** A view is drawn only when its trigger fires; a two-file change gets a
  files table and no diagram at all. Same bar the PLAN gate applies to its flowcharts.
- **Read-only except the one file.** It writes `.dev-flow/<task>/DEBRIEF.html` and nothing else — no
  commits, no fixes, no `.git/`, no `.gitignore`.
- **Terminal, not a gate.** It never pauses, never blocks, and adds no step to `/dev-flow`. Nothing
  reads its output but you.
