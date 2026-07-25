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

1. **Locate the run.** Resolve `<task>` in this order — `.dev-flow/` is git-ignored and never cleaned,
   so a real repo has **many** run directories by the time anyone runs this: the first
   `[A-Z][A-Z0-9]+-[0-9]+` match in the branch name (as `/pr` does); else the `.dev-flow/*` dir whose
   name matches the branch slug — `/dev-flow` names the branch *from* `<task>`, so on a keyless task
   they are the same string; else the sole `.dev-flow/*` dir; else **ask which run to debrief** rather
   than guessing, since debriefing the wrong task is worse than a question. **No `.dev-flow/<task>/`
   at all → stop and say so** — this is a dev-flow epilogue, and recon always runs on both paths, so
   the directory exists after any real run. Then resolve `base`: the base commit recorded in
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
   - `gh pr view --json number,url,title,state` and `gh repo view --json url` when there's a remote —
     the PR itself, and the base URL that makes each commit sha a link. No remote → skip both silently.

3. **Pick the views from the shape of the diff.** Render **every** view whose trigger fires, stacked
   as collapsible sections with the first one open, each labelled with why it fired ("5 files across
   3 directories"). A view whose trigger didn't fire is **left off the page entirely** — not stubbed
   with an empty section explaining its own absence, which is noise wearing the costume of rigour. No
   trigger fires → the files table alone, plus one line saying the change was too small to diagram.

   | View | Fires when | Answers |
   |---|---|---|
   | **Churn map** | ≥4 changed files across ≥2 directories | where the weight landed |
   | **Layer map** | references or imports observable *between* the changed files | how the pieces connect |
   | **Commit timeline** | ≥3 commits since `base` | how it got built up |
   | **Move map** | any `R` (rename/move) entry in `--name-status` | what went where |

   **Layer by dependency depth, never by directory and never by a guessed stack.** The layers *are*
   depth — what references nothing else in the change at one end, what everything points at at the
   other — so edges run one way and never cross a node. (Grouping by directory looks reasonable and is
   a trap: it forces edges through unrelated boxes.) Direction comes from imports
   where the language exposes them and from **textual references** otherwise, which is what makes the
   view work on a config- or docs-only change. If no edge can be observed at all it **doesn't fire** —
   boxes grouped with no connectors are just the file table again. A hardcoded UI → hook → service →
   data taxonomy is wrong in most repos. **Use the best tool available to find the edges** — an
   import/dependency-graph MCP, a usage indexer, or an LSP answers "what references X" directly; fall
   back to grep only when nothing fits, and cap it, since pairwise grepping a 20-file change is
   quadratic and the diagram isn't worth that.

4. **Write `.dev-flow/<task>/DEBRIEF.html`.** *What's* on the page is fixed; **how it looks is entirely
   yours** — layout, type, colour, structure, and how each view is drawn are all open, there is no
   template to match, and matching the last debrief you made is not a goal. Build the clearest page for
   *this* change. **If a visual-design skill is installed** (`frontend-design` or similar), read it
   first and follow it — this page is UI and that is what such a skill is for; with none available,
   use your own judgement. It must carry:
   - **Header** — task, branch, `N commits · N files · +X −Y`, the PR, the verification verdict.
   - **The short version** — a plain-prose summary, at the very top. Its job is to **reload the task
     into the reader's head**, fast, days after the fact — not to be a script they recite. Write for
     the person who *did* this work: their own vocabulary is fine, density is fine, explaining the
     domain to them is not. Cover what the task was, what actually got done, where it now stands, and
     what's still open. Skip **shas, file paths and counts** — those are identifiers, not information,
     they don't help anyone remember what happened, and the rest of the page has them. As long as it
     needs to be and not a line longer: a couple of sentences for a small fix, a few short paragraphs
     when the work turned. **Include the awkward parts** — what isn't finished, what wasn't verified,
     what's blocked — since a summary that only reports success is the one nobody trusts twice. It's
     the page's one real synthesis, so the grounding rule bites hardest here: every claim comes from
     the commits and the artifacts, never from memory of the session.
   - **Phases** — Ask · Plan · Build · Verification, two or three lines each, linking to the artifact
     that holds the detail. Absent phases say so.
   - **Views** — the ones that fired in step 3.
   - **Commits** — **every** commit since `base`, oldest first: sha (linked), subject, the Intent line
     from its Decision Log, and the files it touched. This is the one section with no artifact behind
     it — the commit bodies *are* the record of why, and nothing else on the page carries them. When
     the **commit timeline** view fires, it *is* this section, rendered with the shape it earned —
     never a second copy of the same rows further up the page.
   - **Files changed** — every path with its status and churn.
   - **Artifacts** — a link to every `.dev-flow/<task>/` file present, and to the PR.

   **Anything nameable is a link wherever a link exists.** A commit sha → `<repo-url>/commit/<sha>`;
   the PR number → its URL; an artifact → its relative path (`href="PLAN.md"` resolves from `file://`,
   since the page sits beside it); a changed file → its blob at that sha when there's a remote. Naming
   a commit and leaving it unclickable is the main way this page wastes the reader's time.
   **Never fabricate a URL**, and note that having a remote isn't enough: a commit that hasn't been
   pushed has no page yet (`git branch -r --contains <sha>` comes back empty), so it stays plain text
   until it does — as does everything else with no destination.

   Four constraints — the rest of the design is open, but these hold:
   - **Self-contained and offline.** Inline everything; no CDN, no mermaid, nothing that leaves the
     page blank when it's opened from `file://` with no network.
   - **Light and dark both.** Honour `prefers-color-scheme` at minimum; a manual toggle on top is
     welcome, since it's the only way to see the other mode without changing an OS setting. Neither
     mode is the afterthought — check the contrast of *both*, especially on anything colour-coded.
   - **A diagram must never claim more than the data.** If a view encodes magnitude, that encoding has
     to be true at every width — and where the layout can't carry it (a narrow screen, a legibility
     floor), drop the claim rather than render a distorted one. Likewise for edges: a connector routed
     behind an opaque box reads as a relationship that isn't in the diff.
   - **Readable with JS off.** Script may enrich — hover, highlight, redraw — but the content has to be
     there without it.

5. **Look at it, then hand off.** Open the file with the platform opener (`open` on macOS, `xdg-open`
   on Linux, `start` on Windows); if none is available, print the path instead. **Actually check it
   rendered** — every round of building this skill found a defect that only appeared on screen (a
   proportion silently wrong, a connector implying a relationship that wasn't in the diff, a claim
   surviving the layout that stopped being true). A page you never looked at is not a debrief. Then
   confirm in **three lines at most**: the path, which views fired, and anything the evidence couldn't
   answer. Don't summarise the page in chat — the page *is* the summary.

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
