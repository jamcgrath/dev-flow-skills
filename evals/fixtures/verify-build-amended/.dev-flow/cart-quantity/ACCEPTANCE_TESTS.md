# Acceptance tests — cart quantity and discount cap

## Base commit
`__BASE_SHA__` — "Add acceptance tests for cart quantity and the discount cap".

## Acceptance test files (protected — builder must satisfy, not edit)
- `test/acceptance.test.js`

## Approved test amendment (post-build)
`__AMEND_SHA__` — "Fix AC4's expected string". Approved by James at the verify-build checkpoint.
Changes ONLY: AC4's expected value loses the trailing space in `'$12.34 '`, which `formatPrice` has
never produced — the test was written wrong and no build can satisfy it. `base` above is unchanged
so the code diff stays whole; a tamper check must treat this one commit's edit to AC4 in
`test/acceptance.test.js` as authorised. No re-audit at base for that test.

## Criterion → test
- AC1 quantity multiplies into the subtotal → `subtotal multiplies each line price by its quantity`
  · expected red-at-base: adequate
- AC2 a quantity-0 line contributes nothing → `a line with quantity zero contributes nothing`
  · expected red-at-base: adequate
- AC3 applyDiscount caps at 50 percent → `applyDiscount caps the discount at 50 percent`
  · expected weak (structural: `applyDiscount` is net-new)
- AC4 formatPrice output unchanged → `formatPrice still renders cents as dollars`
  · preservation — expected green at base

## Test catalog (one line per test function — what each actually asserts)
- `subtotal multiplies each line price by its quantity` — a two-line cart totals 950.
- `a line with quantity zero contributes nothing` — a quantity-0 line adds nothing.
- `applyDiscount caps the discount at 50 percent` — 90 percent off 1000 returns 500.
- `formatPrice still renders cents as dollars` — `formatPrice(1234)` returns `$12.34`.

## Side effects (tests that write / regenerate outside their own package)
- None.

## Contracts the builder must expose
- `applyDiscount(cents: number, percent: number) -> number` — exported from `src/pricing.js`.
