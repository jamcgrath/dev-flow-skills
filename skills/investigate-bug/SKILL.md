---
name: investigate-bug
description: Turn a raw bug report into a systematic investigation — structure the symptom, then build ONE command that goes RED on this bug before forming any theory, picking the harness from the bug's LAYER (Playwright or the Chrome DevTools MCP for UI, a unit test for logic, curl for an API, a seeded query for data, a replayed payload for async work) rather than defaulting to the browser. Inspect where the red points, trace it to the likely source, and write .dev-flow/<task>/BUG_CONTEXT.md as context for the fix. Use at the start of the bug path, when the user says "investigate this bug", "debug this", or hands over something broken, throwing, failing or slow — in the browser or anywhere else.
---

# investigate-bug

Takes "something's broken" and turns it into a grounded investigation: get it reproducing **red** at
its own layer, look where that points, trace it to the likely source, and write up context the fix
can build on. Start of the bug path; the output feeds `/plan` mode (or a direct fix for something
small).

**The red command is the skill.** Everything after it is mechanical — with a command that fails on
this bug and passes when it's fixed, elimination finds the cause; without one, no amount of reading
code will. Spend the effort there.

## Steps

1. **Get the observation.** Ask the developer for: what they saw, how to reproduce it, and any
   initial hypothesis. Don't start poking blind.

2. **Structure it** into: **symptom**, **reproduction steps**, **suspected location** in the
   codebase.

3. **Get it going red — at the bug's layer.** Before any theory, build **one command you can re-run**
   that fails on *this* bug and passes once it's fixed. This is the step the whole investigation rests
   on: with a red-capable command, the cause is findable by elimination; without one, a hypothesis is
   a guess wearing analysis as a costume. Pick the surface from where the bug lives, not from habit:

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
   ticket key if it has one, else a short kebab-case slug of the symptom, so each investigation keeps
   its own context and a new run never overwrites the last:

   ```
   ## Symptom
   [What was observed]

   ## Reproduction
   [Steps to reproduce]

   ## Red command
   [The one command that fails on this bug, its layer, and what it asserts — paste the invocation
    and the failing output. This is what the fix has to turn green, and what /verify-build can re-run.
    If none could be built, say so here and list what would unblock one.]

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
   mode, or go straight to the fix if it's small.

## Guards
- **Red before theory.** The repro command comes first; hypothesising before one exists is the
  failure this skill is shaped to prevent. If you catch yourself reading code to build a theory and
  step 3 hasn't produced a red command, you're in the failure — go back.
- **Evidence before conclusion.** "Likely cause" must be grounded in what the tooling actually
  showed plus the code. If the evidence is thin, say so and note what else to check.
- **Pick the layer, don't default to the browser.** The Chrome DevTools MCP is one option among
  several; a bug in an API, a query, a scheduled job or a pure function is reached by its own harness.
  The stack is read from the repo, never assumed.
- **Don't trigger browser dialogs** (alert / confirm / prompt) during inspection — they block
  the DevTools session and stall the extension.
