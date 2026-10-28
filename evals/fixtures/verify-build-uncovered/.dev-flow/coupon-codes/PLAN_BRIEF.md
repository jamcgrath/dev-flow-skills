# Plan brief — coupon codes

## Files likely to change
- `src/coupons.js` — new; `couponCents` and the coupon table.
- `src/money.js` — `toCents` accepts a leading `$`. Existing caller: `src/refunds.js` (`refundCents`).

## Test Tooling

- **Runner: `node --test` (Node's built-in test runner), invoked as `npm test`.** No framework, no
  install step — the fixture runs offline.
- **Assertion failure vs error — how this runner reports each.**
  - An **assertion failure** prints `AssertionError [ERR_ASSERTION]` followed by `actual:` and
    `expected:` lines.
  - An **error before any assertion** prints the thrown error's own class — `TypeError: <name> is not
    a function`, or `Error: Cannot find module` when an import path is missing.
  - Both render as `✖ <test name>` and both set a non-zero exit code — read the failure body.
- **Running a single test:** `node --test --test-name-pattern '<substring>'`.
- **Coverage:** `test/money.test.js` covers `toCents` directly. `refundCents` has no tests.
