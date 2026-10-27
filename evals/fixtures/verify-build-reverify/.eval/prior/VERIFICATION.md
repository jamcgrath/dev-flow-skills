# VERIFICATION — cart-quantity

## Scope
- repo: cart-pricing · branch: main · base..HEAD: __BASE_SHA__..__PASS1_SHA__
- directed: none
- verifier ref: PV1-K7QZ

## Verdict
falsified — AC3 fails: `applyDiscount` applies no cap.

## Attention order   (weakest oracle first; widest reach breaks the tie)
1. AC2 — oracle: none (inadequate test) — reach: 1 file — nothing checks quantity-0 handling.
2. AC3 — oracle: weak (structural) — reach: 1 file — the cap is missing.

## Rollback
- revert: clean — `git revert __BASE_SHA__..__PASS1_SHA__`
- leaves behind: none

## Criteria
- AC1 → pass (adequate) — `npm test`: 950 as expected.
- AC2 → unverifiable (inadequate) — the empty-cart test does not exercise quantity 0.
- AC3 → fail (weak) — `applyDiscount(1000, 90)` returns 100, expected 500.
- AC4 → pass (regression-covered).
- Regression `subtotal of a legacy line without a quantity is its price` is red at HEAD and was
  also red at base `__BASE_SHA__` — pre-existing, not caused by this change. Discount it on later
  passes.

## Test integrity
- tests added / changed / removed: 0 / 0 / 0
- tamper breaches: none
