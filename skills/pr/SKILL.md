---
name: pr
description: Open a pull request whose body synthesises the Decision Log from the branch's commit messages, so the reviewer gets the intent without reading every commit. On a branch that came through /dev-flow it leads with that run's verification evidence instead. Use when the user says "make a pr", "raise a pr", "open a pr", or "simulate a pr". Detects a task key (e.g. Jira PROJ-1234) from the branch name and includes it only when present.
---

# pr

Builds a PR description by **synthesising the Decision Logs** in the branch's commits — the
reviewer gets the why without reading every commit. Convention: intent lives in commits, the PR
rolls them up (see global CLAUDE.md).

## Steps

1. **Find base + commits.** Base is the repo's default branch (`main` unless told otherwise; some
   repos use `master`). Read the branch's commits:
   `git log --format='%H%n%s%n%b%n---END---' <base>..HEAD`
   No commits → stop and say so.

2. **Detect a task key from the branch name.** Extract the first `[A-Z][A-Z0-9]+-[0-9]+` match
   from the current branch (e.g. `feature/PROJ-1234-paywalls` → `PROJ-1234`). **Only use it if
   present** — many tasks have no key. Never invent one.

3. **Synthesise — don't concatenate.** If this branch came through `/dev-flow`, first read the flow's
   evidence — `.dev-flow/<task>/VERIFICATION.md` (verify-build's verdict) and
   `.dev-flow/<task>/TEST_AUDIT.md` (test adequacy), where `<task>` is the key from step 2 or the sole
   `.dev-flow/*` dir for this branch — so the body can **lead with the verification** a downstream
   reviewer needs. **Carry `VERIFICATION.md`'s `## Attention order` across, don't recompute or flatten
   it**: it is already sorted weakest-oracle-first over widest reach, and a reviewer who reads one line
   of this PR should get the criterion most likely to be wrong — which `N adequate / N weak / N
   inadequate` cannot tell them. Name the criteria; keep the counts as the supporting line beneath.

   **Check the verdict still covers HEAD.** `VERIFICATION.md`'s `## Scope` records the `base..HEAD` it
   was computed over. If that HEAD isn't the current one — a fix landed after the verdict, usually at
   the REVIEW gate — say so on the Verdict line (`verified as of <sha>; N later commit(s) not
   covered`) instead of publishing it flat. Don't re-run anything and don't re-verify: the builder
   already self-checks a fix it was asked for, and a second `/verify-build` for a one-line nit is the
   duplicate work `/dev-flow`'s subagent guard rules out. Just never state a verdict as covering
   commits it never saw.

   Then, from the commits' Decision Logs, write one PR body:

   ```markdown
   ## Summary
   <1–2 lines: what this PR does, in plain terms>

   Refs: <KEY>            ← include this line ONLY if a key was found

   ### Verification       ← include this whole block ONLY if .dev-flow/<task>/VERIFICATION.md exists
   **Verdict:** verified | couldn't-verify | falsified — <one-line reason>  (LLM judgment in fresh context, not ground truth)
   **Look here first:** <head of VERIFICATION.md's Attention order — the weakest-oracle, widest-reach criteria, NAMED, each with what to check>
   **Test integrity:** <tests added / changed / removed; surface any tamper breach loudly>
   **Test adequacy:** <from TEST_AUDIT.md — N adequate / N weak / N inadequate; inadequate criteria are unverifiable, weak = red-by-absence only>

   ### Rollback           ← include this block ONLY if .dev-flow/<task>/VERIFICATION.md exists
   **Revert:** clean | not clean — <the range, or what blocks it>
   **Leaves behind:** none | <irreversible side effects a revert does not undo>

   ### Decision Log
   **Intent:** <combined goal across the commits>
   **Approach:** <what was done overall>
   **Alternatives ruled out:**
   - <option> — <reason>   (only those that still matter at PR level)
   **Assumptions:** <inferred requirements a reviewer should sanity-check>
   **Trade-offs:** <what was sacrificed, still relevant at PR scope>

   ### Commits
   - <short-sha> <subject>
   ```
   Omit any Decision Log section that's empty, and both the **Verification** and **Rollback** blocks on
   a standalone PR with no `VERIFICATION.md` — never reconstruct either from the diff here, since a
   rollback claim this skill invented carries none of the fresh-context verifier's independence. Merge
   duplicates; drop decisions reversed later in the branch.

4. **Title:** concise imperative covering the branch's theme. Prefix with the key when found:
   `<KEY>: <title>` if a key was detected, otherwise just `<title>`.

5. **Create or preview:**
   - **Remote exists** (`git remote` non-empty): push the branch if needed (`git push -u origin HEAD`),
     then `gh pr create --title '<title>' --body '<body>'` (`--draft` if the user asked).
   - **No remote** (local-only repo): **preview** — print the title + body and write it to
     `PR_PREVIEW.md`. Say clearly it's a preview, not a real PR.

6. **Report** the PR URL (or the preview path) and the title.
