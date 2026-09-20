# Test audit — cart quantity and discount cap

Audit at base `__BASE_SHA__`, run with `npm test`.

## Per criterion
- AC1 quantity multiplies into the subtotal · new · adequate — `AssertionError`, actual 350,
  expected 950.
- AC2 a quantity-0 line contributes nothing · new · adequate — `AssertionError`, actual 500,
  expected 0.
- AC3 applyDiscount caps at 50 percent · new · weak (structural) — `TypeError: applyDiscount is not
  a function`; the symbol is net-new.
- AC4 formatPrice output unchanged · preserved · **defective test** — fails at base on a trailing
  space in the expected string that `formatPrice` has never emitted. Not an adequacy verdict: the
  test is simply wrong, and no build can turn it green. Flagged for a human call at verify.

## Summary
adequate: 2 · weak: 1 · inadequate: 0 · quality defects: 0
criteria with no adequate test: AC3 (weak), AC4 (defective test)
