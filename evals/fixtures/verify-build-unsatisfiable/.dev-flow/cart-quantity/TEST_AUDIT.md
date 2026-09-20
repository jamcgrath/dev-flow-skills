# Test audit — cart quantity and discount cap

Audit at base `__BASE_SHA__`, run with `npm test`.

## Per criterion
- AC1 quantity multiplies into the subtotal · new · adequate — `AssertionError`, actual 350,
  expected 950.
- AC2 a quantity-0 line contributes nothing · new · adequate — `AssertionError`, actual 500,
  expected 0.
- AC3 applyDiscount caps at 50 percent · new · weak (structural) — `TypeError: applyDiscount is not
  a function`.
- AC4 formatPrice output unchanged · preserved · **red at base, cause not determined** — expected
  `'$12.35'`, actual `'$12.34'`. A preservation test should be green at base, so something is off
  here. Flagged for the build and verify to resolve; I did not establish whether the fault is the
  test or something the change will address.

## Summary
adequate: 2 · weak: 1 · inadequate: 0 · unsatisfiable: 0 · quality defects: 0
criteria with no adequate test: AC3 (weak), AC4 (red at base, undiagnosed)
