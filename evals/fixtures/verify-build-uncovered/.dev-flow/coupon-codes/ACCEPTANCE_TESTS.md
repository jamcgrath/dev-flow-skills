# Acceptance tests — coupon codes

## Base commit
`__BASE_SHA__` — "Add acceptance tests for coupon codes".
Committed cleanly (no git hooks in this repo).

## Acceptance test files (protected — builder must satisfy, not edit)
- `test/coupons.test.js`

## Criterion → test  (expected red-at-base is a hypothesis for /audit-tests, not a verdict)
- AC1 a known code is worth its value → `a known coupon code is worth its value in cents`
  · expected weak (structural: `src/coupons.js` is net-new)
- AC2 an unknown code is worth nothing → `an unknown coupon code is worth nothing`
  · expected weak (structural)
- AC3 `$`-prefixed values are read → `coupon values written with a leading $ are accepted`
  · expected weak (structural)

## Test catalog (one line per test function — what each actually asserts)
- `a known coupon code is worth its value in cents` — `couponCents('SAVE5')` returns 500.
- `an unknown coupon code is worth nothing` — `couponCents('NOPE')` returns 0.
- `coupon values written with a leading $ are accepted` — `couponCents('SAVE10')` returns 1000.

## Residual gaps (what a passing test still does NOT prove)
- Coupon values with cents (`'$4.99'`) are not asserted.

## Side effects (tests that write / regenerate outside their own package)
- None. The suite is pure and writes nothing.

## Contracts the builder must expose
- `couponCents(code: string) -> number` — exported from `src/coupons.js`.
