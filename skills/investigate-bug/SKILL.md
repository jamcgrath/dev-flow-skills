---
name: investigate-bug
description: Turn a raw bug report into a systematic investigation. Builds one command that goes red on the bug before any theory, using the harness for the bug's layer rather than defaulting to the browser, traces the red to its likely source, and writes .dev-flow/<task>/BUG_CONTEXT.md as context for the fix. Use at the start of the bug path, or when the user says "investigate this bug", "debug this", or hands over something broken, throwing, failing or slow.
---

# investigate-bug

Takes "something's broken" to a grounded investigation: get it reproducing **red** at its own
layer, look where that points, trace it to the likely source, and write up context for the fix.
**The red command is the skill:** with a command that fails on this bug and passes when it's fixed,
elimination finds the cause; without one, reading code won't. Spend the effort there.

## Steps

1. **Get the observation:** what they saw, how to reproduce it, and any initial hypothesis. Use what
   the task already gives you; given only a ticket key or issue number, fetch it first (the Atlassian
   Rovo MCP's `getJiraIssue`, or `gh issue view`). Ask the developer only for what's missing. Don't
   start poking blind.

2. **Structure it** into: **symptom**, **reproduction steps**, **suspected location** in the
   codebase.

3. **Get it going red — at the bug's layer.** Before any theory, build **one command you can re-run**
   that fails on *this* bug and passes once it's fixed. Pick the surface from where the bug lives —
   never default to the browser — and read the stack from the repo:

   | Layer | What goes red |
   |---|---|
   | UI / rendering | a Playwright script, or the Chrome DevTools MCP driving the page |
   | logic | a failing unit test at the seam that reaches it |
   | API / service | `curl` or an HTTP client against a running server |
   | CLI | the invocation with a fixture input, diffed against known-good output |
   | data | the query against a seeded database |
   | async / scheduled | the captured payload or event replayed through the path in isolation |

   Then **tighten it** — faster, asserting the user's exact symptom rather than "didn't crash", and
   deterministic (pin the clock, seed the randomness, isolate the filesystem). **Intermittent bugs:**
   aim for a *higher reproduction rate*, not a clean one — loop the trigger, parallelise, narrow the
   timing window. A 50%-flake is debuggable; 1% isn't.

   **Live data:** where the repo's CLAUDE.md or README says a run reaches live data, reading a live
   page to see the bug is fine, but ask before anything that writes (a save, a publish, a mutating
   request).

   **If you genuinely can't build one, stop and say so** — list what you tried and what would unblock
   you (access to an environment that reproduces it, a captured artifact like a HAR or log dump,
   permission to add temporary instrumentation). Reporting that is a real result; a theory you have no
   way to test isn't.

4. **Inspect where the red points.** Read the evidence that layer exposes. For a browser bug that's
   the Chrome DevTools MCP — **console** errors/warnings (`list_console_messages`), **network** for a
   failed or wrong request (`list_network_requests`), **DOM / component state** (`take_snapshot`, then
   `evaluate_script` to read state), and **lifecycle** (double renders, unexpected mounts/effects).
   Elsewhere the equivalents are the failing assertion's diff, server logs, query output, or a
   debugger — prefer one breakpoint over ten log lines. Tag any logging you add with a unique prefix
   (`[DEBUG-a4f2]`) so removing it later is one grep. If the layer's tooling isn't available, say so in
   one line and stop.

5. **Trace to source.** Cross-reference what you saw against the codebase to find where the issue
   most likely originates. **Read the repo's conventions from the code — don't assume the
   stack.** Hand broad searching to an `Explore` subagent.

6. **Write `.dev-flow/<task>/BUG_CONTEXT.md`** (create the dir if missing) — `<task>` is the bug's
   ticket key if it has one, else a short kebab-case slug of the symptom:

   ```
   ## Symptom
   [What was observed]

   ## Reproduction
   [Steps to reproduce]

   ## Red command
   [The one command that fails on this bug, its layer, and what it asserts — paste the invocation
    and the failing output. This is what the fix has to turn green, and what
    /author-acceptance-tests builds the bug's test from.
    If none could be built, say so here and list what would unblock one.]

   ## Test Tooling
   [Frameworks present + run command + the layer each covers, any property-testing library
    (fast-check, Hypothesis, proptest), and whether an a11y harness exists (`@axe-core/*`, `jest-axe`,
    `pa11y`, Playwright's role / accessible-name matchers); flag any layer this bug touches with NO
    tooling. Note how each runner reports an assertion failure vs an error. On the bug path this is the
    inventory the test and verify skills read, so survey the whole repo, not just the red command's
    runner.]

   ## Investigation findings
   [What each check showed — rule things out explicitly, then narrow to the cause. For a browser bug:
    - console: <clean / the error>
    - network: <clean / the failed or wrong request>
    - DOM / state: <content/state present or wrong>
    - computed styles / lifecycle: <the smoking gun>
    At another layer, the equivalent checks for it.]

   ## Likely cause
   [Where in the codebase the issue most likely originates]

   ## Suggested approach
   [How to fix it — what to change and why]
   ```

7. **Hand off.** Summarise the likely cause, then: feed `.dev-flow/<task>/BUG_CONTEXT.md` into `/plan`
   mode.

## Guards
- **Red before theory.** Reading code to build a theory before step 3 has a red command is the
  failure this skill exists to prevent — go back.
- **Evidence before conclusion.** "Likely cause" rests on what the tooling showed plus the code; if
  the evidence is thin, say so and what else to check.
- **Don't trigger browser dialogs** (alert, confirm, prompt) during inspection — they block the
  DevTools session.
