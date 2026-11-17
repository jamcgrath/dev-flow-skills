---
name: debrief
description: Optional epilogue for a finished /dev-flow run. Reads the branch's commits and diff plus the .dev-flow/<task>/ artifacts and renders one self-contained interactive HTML page, .dev-flow/<task>/DEBRIEF.html, showing what was asked, what shipped, where the change landed and how it was built, with diagrams picked from the shape of the diff. Writes that one file and nothing else. Needs a task that went through the flow. Use when the user says "debrief", "/debrief", "what did we just do", or wants a visual walkthrough of a completed task.
---

# debrief

The flow's closing epilogue, for the person who ran it rather than a reviewer (`/pr` is for the
reviewer): one self-contained HTML page that shows what happened. It is a hub over the artifacts in
`.dev-flow/<task>/` — it links to them rather than copying them — and it acts on nothing it notices:
a follow-up it surfaces is a note on the page, not a task it starts.

## Steps

1. **Locate the run.** A repo accumulates many run directories, so resolve `<task>` in this order: the first
   `[A-Z][A-Z0-9]+-[0-9]+` match in the branch name (as `/pr` does); else the `.dev-flow/*` dir whose
   name matches the branch slug with its type prefix (`feature/`, `fix/`…) stripped; else the sole
   `.dev-flow/*` dir; else **ask which run to debrief** rather than guess. **No `.dev-flow/<task>/`
   at all → stop and say so**: this needs a run that went through the flow.
   Then resolve `base` as the branch point, `git merge-base origin/<default branch> HEAD` — not the
   `base` in `ACCEPTANCE_TESTS.md`, which sits after the acceptance-test commits and would leave them
   off the page.

2. **Gather the evidence — read-only, and nothing from memory.** Everything the page says must trace
   to one of these:
   - `git log --format='%H%n%s%n%b%n---END---' <base>..HEAD` — the bodies carry the Decision Logs
   - `git diff -M --name-status <base>..HEAD` — status per file; the `R` entries are the moves
   - `git diff -M --numstat <base>..HEAD` — per-file `+`/`−`, which is what sizes the churn map
   - the `.dev-flow/<task>/` artifacts that exist — read only the lines the page shows (the verdict
     from `VERIFICATION.md`, the counts from `TEST_AUDIT.md`, the goal from `PLAN_BRIEF.md`) and link
     the rest. An artifact that isn't there is **stated as absent** ("no `VERIFICATION.md` — verify
     never ran"), never reconstructed.
   - `gh pr view --json number,url,title,state` and `gh repo view --json url` when there's a remote —
     the PR itself, and the base URL that makes each commit sha a link. No remote → skip both silently.

3. **Pick the views from the shape of the diff.** Render **every** view whose trigger fires, stacked
   as collapsible sections with the first one open, each labelled with why it fired ("5 files across
   3 directories"). A view whose trigger didn't fire is **left off the page entirely**, not stubbed.
   No trigger fires → the files table alone, plus one line saying the change was too small to
   diagram.

   | View | Fires when | Answers |
   |---|---|---|
   | **Churn map** | ≥4 changed files across ≥2 directories | where the weight landed |
   | **Layer map** | references or imports observable *between* the changed files | how the pieces connect |
   | **Commit timeline** | ≥3 commits since `base` | how it got built up |
   | **Move map** | any `R` (rename/move) entry in `--name-status` | what went where |

   **Layer by dependency depth, never by directory or a guessed stack** (UI → hook → service → data
   is wrong in most repos): what references nothing else in the change at one end, what everything
   points at at the other, so edges run one way and never cross a node. Direction comes from imports
   where the language exposes them, else from textual references, so a config- or docs-only change
   still works. Find edges with an import-graph MCP, usage indexer or LSP when there is one; fall back
   to grep, capped. No observable edge → the view doesn't fire.

4. **Write `.dev-flow/<task>/DEBRIEF.html`.** What's on the page is fixed; how it looks is yours —
   no template, and no need to match the last one. If a visual-design skill is installed
   (`frontend-design` or similar), read it first and follow it. It must carry:
   - **Header** — task, branch, `N commits · N files · +X −Y`, the PR, the verification verdict.
   - **The short version** — plain prose at the very top that reloads the task into the head of the
     person who did it, days later: what the task was, what got done, where it stands, what's still
     open. Their own vocabulary is fine; no shas, paths or counts. A couple of sentences for a small
     fix, a few short paragraphs when the work turned. **Include the awkward parts** — unfinished,
     unverified, blocked. Every claim comes from the commits and artifacts, never from session memory.
   - **Phases** — Ask · Plan · Build · Verification, two or three lines each, linking to the artifact
     that holds the detail. Absent phases say so.
   - **Views** — the ones that fired in step 3.
   - **Commits** — **every** commit since `base`, oldest first: sha (linked), subject, the Intent line
     from its Decision Log, and the files it touched. When the commit timeline view fires, it *is*
     this section, never a second copy of the same rows.
   - **Files changed** — every path with its status and churn.
   - **Artifacts** — a link to every `.dev-flow/<task>/` file present, and to the PR.

   **Anything nameable is a link wherever a link exists.** A commit sha → `<repo-url>/commit/<sha>`;
   the PR number → its URL; an artifact → its relative path (`href="PLAN.md"` resolves from `file://`,
   since the page sits beside it); a changed file → its blob at that sha when there's a remote.
   **Never fabricate a URL:** a commit that isn't pushed (`git branch -r --contains <sha>` is empty)
   has no page yet, so it stays plain text, as does anything else with no destination.

   Four constraints — the rest of the design is open, but these hold:
   - **Self-contained and offline.** Inline everything; no CDN, no mermaid, nothing that leaves the
     page blank when it's opened from `file://` with no network.
   - **Light and dark both.** Honour `prefers-color-scheme`, optionally with a manual toggle, and
     check the contrast of both, especially anything colour-coded.
   - **A diagram must never claim more than the data.** If a view encodes magnitude, that encoding has
     to be true at every width — and where the layout can't carry it (a narrow screen, a legibility
     floor), drop the claim rather than render a distorted one. Likewise for edges: a connector routed
     behind an opaque box reads as a relationship that isn't in the diff.
   - **Readable with JS off.** Script may enrich — hover, highlight, redraw — but the content has to be
     there without it.

5. **Look at it, then hand off.** Open the file with the platform opener (`open` on macOS, `xdg-open`
   on Linux, `start` on Windows); if none is available, print the path instead. **Check it rendered**
   with a browser tool if you have one — a wrong proportion or a connector implying a relationship
   absent from the diff is invisible in the source — otherwise say it is unchecked. Then confirm in
   **three lines at most**: the path, which views fired, and anything the evidence couldn't answer.
   Don't summarise the page in chat.

## Guards
- **Grounded, and absent means absent.** Every claim traces to a commit, a diff stat or an artifact;
  a missing artifact is reported missing, never inferred.
- **Read-only, and terminal.** It writes `.dev-flow/<task>/DEBRIEF.html` and nothing else — no
  commits, no fixes, no `.git/` or `.gitignore` — and adds no step, gate or pause to `/dev-flow`.
