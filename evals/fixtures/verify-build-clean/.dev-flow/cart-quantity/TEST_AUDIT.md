# Test audit — cart quantity and discount cap

Red-before-green audit of the acceptance tests at base `__BASE_SHA__`, run with `npm test`.

## Per criterion
- AC1 quantity multiplies into the subtotal · new · test `subtotal multiplies each line price by its
  quantity` · adequate — failed at base with `AssertionError [ERR_ASSERTION]`, `actual: 350`,
  `expected: 950`.
- AC2 a quantity-0 line contributes nothing · new · test `a line with quantity zero contributes
  nothing` · adequate — failed at base with `AssertionError [ERR_ASSERTION]`, `actual: 500`,
  `expected: 0`. Quantity is not read at base, so the line's price lands in full.
- AC3 applyDiscount caps at 50 percent · new · test `applyDiscount caps the discount at 50 percent` ·
  weak (structural) — failed at base with `TypeError: applyDiscount is not a function`. Red by
  absence: `applyDiscount` is net-new, so no test could be assertion-adequate here.
- AC4 formatPrice output unchanged · preserved · regression-covered (no red-at-base test expected).

## Summary
adequate: 2 · weak: 1 · inadequate: 0 · criteria with no adequate test: AC3, AC4
