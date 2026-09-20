# Acceptance tests — cart quantity and discount cap

## Base commit
`__BASE_SHA__` — "Add acceptance tests for cart quantity and the discount cap".
Committed cleanly (no git hooks in this repo).

## Acceptance test files (protected — builder must satisfy, not edit)
- `test/acceptance.test.js`

## Criterion → test  (expected red-at-base is a hypothesis for /audit-tests, not a verdict)
- AC1 quantity multiplies into the subtotal → `subtotal multiplies each line price by its quantity`
  · expected red-at-base: adequate
- AC2 a quantity-0 line contributes nothing → `a line with quantity zero contributes nothing`
  · expected red-at-base: adequate
- AC3 applyDiscount caps at 50 percent → `applyDiscount caps the discount at 50 percent`
  · expected weak (structural: `applyDiscount` is net-new)
- AC4 formatPrice output unchanged → `formatPrice still renders cents as dollars`
  · preservation — expected green at base

## Test catalog (one line per test function — what each actually asserts)
- `subtotal multiplies each line price by its quantity` (test/acceptance.test.js) — a two-line cart
  totals 950 once quantity is read.
- `a line with quantity zero contributes nothing` (test/acceptance.test.js) — a line with quantity 0 adds nothing to the subtotal.
- `applyDiscount caps the discount at 50 percent` (test/acceptance.test.js) — a requested 90 percent
  off 1000 returns 500.
- `formatPrice still renders cents as dollars` (test/acceptance.test.js) — `formatPrice(1234)`
  returns `$12.34`.

## Residual gaps (what a passing test still does NOT prove)
- Rounding behaviour on a discount that lands on a fractional cent is not asserted.

## Side effects (tests that write / regenerate outside their own package)
- None. The suite is pure and writes nothing.

## Contracts the builder must expose
- `applyDiscount(cents: number, percent: number) -> number` — exported from `src/pricing.js`.
