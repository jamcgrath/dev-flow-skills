# Plan brief — cart quantity and discount cap

## Files likely to change
- `src/pricing.js` — `subtotal` changes; `applyDiscount` is added.

## Test Tooling

- **Runner: `node --test` (Node's built-in test runner), invoked as `npm test`.** No framework, no
  install step — the fixture runs offline.
- **Assertion failure vs error — how this runner reports each.** The distinction the audit turns on:
  - An **assertion failure** prints `AssertionError [ERR_ASSERTION]` followed by `actual:` and
    `expected:` lines. The code under test ran, returned a value, and the assertion caught it.
  - An **error before any assertion** prints the thrown error's own class — most often
    `TypeError: <name> is not a function` when the test calls a symbol that does not exist yet, or
    `Error: Cannot find module` when an import path is missing. No `actual:`/`expected:` pair is
    printed, because no assertion ever ran.
  - Both render as `✖ <test name>` in the summary and both set a non-zero exit code, so **exit code
    and the ✖ marker cannot discriminate them** — read the failure body.
- **Running a single test:** `node --test --test-name-pattern '<substring>'`.

## Constraints
- `formatPrice` is public API and must keep its current output.
