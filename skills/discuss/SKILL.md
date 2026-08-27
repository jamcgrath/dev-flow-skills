---
name: discuss
description: A structured interview that turns a half-formed idea into a decision you can act on, plus a written record of why — asked ONE question at a time, each carrying a recommended answer, with facts checked by tool rather than spent as questions. Works with or without a codebase: a feature you're about to build, or infrastructure/process work Claude Code can't do for you. Pins down fuzzy terminology as it appears and flags contradictions with what's already documented or implemented. Writes a DISCUSSION.md record and stops — it does not plan, build, or edit code. Opt-in and standalone: you invoke it, it never fires on its own, and nothing in /dev-flow reads its output. Use when the user says "discuss", "/discuss <topic>", "let's talk this through", or "help me decide".
disable-model-invocation: true
---

# discuss

A **structured interview** that turns a half-formed idea into a decision you can act on — and a
record of *why*, which is the part no diff or terraform plan can recover later. Not a chat: it's
one question at a time, each with a recommended answer, ending in a written artifact.

**Opt-in and standalone.** You invoke it; it never fires on its own. Its natural slot is *before*
`/dev-flow` — but nothing wires them together: `/dev-flow` neither invokes it nor reads what it
writes. Run it whenever, on whatever.

**It does not need a codebase.** Two normal entries, equally valid:
- **A proposal to poke holes in** — a plan, an approach, a design you've already sketched.
- **A blank page** — nothing decided yet. Infrastructure to stand up, a tool to choose, a process
  to settle. This is *not* a degraded mode; the interview is the same, it just starts earlier.

## Steps

1. **Frame it.** Get the subject into one sentence and confirm it back before asking anything else.
   Establish three things: **what's being decided**, **what's already fixed** (constraints, prior
   commitments, things not up for debate), and **what "settled" looks like** — the discussion ends
   when the remaining questions no longer change the outcome. If the user opened with a proposal,
   restate it in a line and get a yes; you'll be attacking that restatement, so it needs to be right.

2. **Take stock before you ask.** Spend tool calls, not questions, on anything checkable. In a repo:
   read the relevant code, config, existing docs and the git history for prior decisions on this
   subject. Outside one: check what's actually deployed, what the docs say, what the constraints
   really are — whatever's reachable. **Never spend a question on something you could look up** —
   it's the fastest way to waste the user's attention, and their answer is more likely to be wrong
   than the source is. Where nothing is reachable (a greenfield infra decision), skip this and let
   the interview carry it.

3. **Interview — strictly one question at a time.** This is the whole skill; the rest is bookkeeping.
   - **Ask ONE question. Stop. Wait for the answer.** Never batch, never bullet a list of five.
     Each answer reshapes what's worth asking next — that's the entire point of going slowly.
   - **Carry a recommendation with every question**, plus one line of reasoning for it. The user
     should be able to say "yeah, that" and move on. A question with no recommendation is homework.
   - **Order by dependency.** Ask the question whose answer changes the *other* questions first.
     Re-plan the queue after each answer rather than working a fixed list.
   - **Only ask what genuinely needs a human.** Taste, priority, risk appetite, cost, deadline,
     who-owns-this, what-the-business-actually-wants. Everything else, see step 2.
   - **Challenge fuzzy terminology the moment it appears.** If a word is doing two jobs, or means
     something different to each of you, stop and pin it down — don't let the ambiguity ride.
   - **Test with concrete scenarios, not abstractions.** "What happens when the token expires
     mid-upload?" finds the boundary; "how should auth work?" doesn't.
   - **Raise contradictions immediately** — with the code, the existing docs, or something decided
     earlier in this same conversation. Say what contradicts what and ask which one wins.

4. **Agree where the record goes** — ask, once, before writing anything. Default to
   `.dev-flow/<task>/DISCUSSION.md` (`<task>` = ticket key if there is one, else a short kebab-case
   slug), which matches where the other skills keep their artifacts. Offer the alternatives when
   they fit: a file under `docs/`, or — if the project genuinely wants them — a glossary plus an
   ADR. **Don't invent a convention the project doesn't have.** A repo with no `docs/adr/` shouldn't
   silently grow one because a discussion happened, and outside a repo there may be no obvious home
   at all. Ask.

5. **Write the record.**

   ```
   ## Subject
   [One sentence: what was being decided]

   ## Decisions
   [Each: what was decided — and why, in a line. The why is the reason this file exists]

   ## Terms
   [Only terms this discussion actually pinned down: word — what it means here. Omit if none]

   ## Alternatives ruled out
   [Option — why not. Same idea as the commit Decision Log: stop the next person re-litigating it]

   ## Open
   [Still unresolved — and what would settle each one]

   ## Next
   [The concrete next action, if there is one]
   ```

   Sections that would be empty get dropped, not filled with "none".

6. **Read back and stop.** List the decisions in a few lines, confirm, and finish. Offer at most
   two handoffs: **`/dev-flow`** if the decision lands in the codebase, or **just doing the work**
   if it doesn't (infra, process, a tool to install). Never hand off to `/plan-brief` or any other
   mid-flow step on its own — work worth building goes through the flow, which runs those steps
   itself with its gates attached. Then **stop at the handoff**; don't take it.

## Guards

- **One question at a time.** The single biggest failure mode is drifting back into batched
  questions once the conversation warms up. If you're about to write a numbered list of questions,
  you've broken the skill.
- **Every question ships with a recommendation.** No naked questions.
- **Never ask what you can check.** Tool call first, question second.
- **Don't act.** No implementation, no planning, no edits beyond the record itself. If a fix looks
  obvious mid-interview, note it under Next and keep going.
- **An ADR only when all three hold:** the decision is costly to reverse, surprising without an
  explanation, *and* the product of a real trade-off. Two out of three is a line in Decisions, not
  a new file. ADR sprawl makes the ones that matter invisible.
- **Terms are a glossary, not a spec.** If you're writing implementation detail into Terms, it
  belongs in Decisions or nowhere.
- **Stop when it's settled**, not when you run out of questions. There's always another question;
  the useful ones ran out earlier.
