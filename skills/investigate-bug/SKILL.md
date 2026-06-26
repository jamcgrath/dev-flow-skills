---
name: investigate-bug
description: Turn a raw browser observation into a systematic bug investigation using the Chrome DevTools MCP — structure the symptom and repro, inspect console, network, DOM and component lifecycle, trace it back to the likely source in the code, and write .dev-flow/<task>/BUG_CONTEXT.md as context for the fix. Use at the start of the bug path, when the user says "investigate this bug", "something's wrong in the browser", or hands over a UI/runtime glitch they just spotted.
---

# investigate-bug

Takes "something's off in the browser" and turns it into a grounded investigation: reproduce it,
look with Chrome DevTools, trace it to the likely source, and write up context the fix can build
on. Start of the bug path; the output feeds `/plan` mode (or a direct fix for something small).

## Steps

1. **Get the observation.** Ask the developer for: what they saw, how to reproduce it, and any
   initial hypothesis. Don't start poking blind.

2. **Structure it** into: **symptom**, **reproduction steps**, **suspected location** in the
   codebase.

3. **Inspect with the Chrome DevTools MCP** — reproduce the issue and look where it points:
   - **console** — errors / warnings (`list_console_messages`)
   - **network** — failed or wrong requests, if relevant (`list_network_requests`)
   - **DOM / component state** — `take_snapshot`, and `evaluate_script` to read state
   - **lifecycle** — double renders, unexpected mounts/effects
   If the DevTools MCP isn't connected, say so in one line and stop.

4. **Trace to source.** Cross-reference what you saw against the codebase to find where the issue
   most likely originates. **Read the repo's conventions from the code — don't assume the
   stack.** Hand broad searching to an `Explore` subagent.

5. **Write `.dev-flow/<task>/BUG_CONTEXT.md`** (create the dir if missing) — `<task>` is the bug's
   ticket key if it has one, else a short kebab-case slug of the symptom, so each investigation keeps
   its own context and a new run never overwrites the last:

   ```
   ## Symptom
   [What was observed]

   ## Reproduction
   [Steps to reproduce]

   ## Investigation findings
   [What each check showed — rule things out explicitly, then narrow to the cause:
    - console: <clean / the error>
    - network: <clean / the failed or wrong request>
    - DOM / state: <content/state present or wrong>
    - computed styles / lifecycle: <the smoking gun>]

   ## Likely cause
   [Where in the codebase the issue most likely originates]

   ## Suggested approach
   [How to fix it — what to change and why]
   ```

6. **Hand off.** Summarise the likely cause, then: feed `.dev-flow/<task>/BUG_CONTEXT.md` into `/plan`
   mode, or go straight to the fix if it's small.

## Guards
- **Evidence before theory.** "Likely cause" must be grounded in what DevTools actually showed
  plus the code — not a guess. If the evidence is thin, say so and note what else to check.
- **Don't trigger browser dialogs** (alert / confirm / prompt) during inspection — they block
  the DevTools session and stall the extension.
