# Test audit — coupon codes

Red-before-green audit of the acceptance tests at base `__BASE_SHA__`, run with `npm test`.

## Per criterion
- AC1 a known code is worth its value · new · test `a known coupon code is worth its value in cents`
  · weak (structural) — the file failed at base with `Error: Cannot find module '../src/coupons.js'`
  before any assertion ran. `src/coupons.js` is net-new, so no test could be assertion-adequate here.
- AC2 an unknown code is worth nothing · new · test `an unknown coupon code is worth nothing` · weak
  (structural) — same failure.
- AC3 `$`-prefixed values are read · new · test `coupon values written with a leading $ are
  accepted` · weak (structural) — same failure.

## Summary
adequate: 0 · weak: 3 · inadequate: 0 · criteria with no adequate test: AC1, AC2, AC3 (weak)
