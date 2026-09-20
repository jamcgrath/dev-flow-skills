# Test audit — cart quantity and discount cap

Red-before-green audit of the acceptance tests at base `__BASE_SHA__`, run with `npm test`.

## Per criterion
- AC1 quantity multiplies into the subtotal · new · test `subtotal multiplies each line price by its
  quantity` · adequate — failed at base with `AssertionError [ERR_ASSERTION]`, `actual: 350`,
  `expected: 950`. The code ran and the assertion caught the value.
- AC2 a quantity-0 line contributes nothing · new · test `subtotal of an empty cart is zero` ·
  inadequate — **passed at base.** The manifest labels this preservation, but the criterion is new
  behaviour (quantity-0 handling does not exist yet). The test only exercises the empty-cart path,
  which already worked, so it does not touch the criterion at all.
- AC3 applyDiscount caps at 50 percent · new · test `applyDiscount caps the discount at 50 percent` ·
  weak (structural) — failed at base with `TypeError: applyDiscount is not a function`. Red, but by
  absence: `applyDiscount` is net-new, so no test could be assertion-adequate here.
- AC4 formatPrice output unchanged · preserved · regression-covered (no red-at-base test expected).

## Summary
adequate: 1 · weak: 1 · inadequate: 1 · criteria with no adequate test: AC2 (inadequate), AC3 (weak)
