# Plan — coupon codes

Approved at the PLAN gate.

## Acceptance criteria

- **AC1** — `couponCents(code)` returns a known coupon's value in cents: `SAVE5` is worth `500`.
- **AC2** — An unknown coupon code is worth `0`.
- **AC3** — Coupon values are written with a leading `$` (`'$10.00'`) and are read correctly:
  `SAVE10` is worth `1000`.

## Approach

`couponCents` lives in a new `src/coupons.js` with a fixed coupon table. Coupon values are stored as
`'$5.00'`-style strings, so `toCents` in `src/money.js` learns to accept a leading `$` and coupons
reuse it — a refactor of the shared helper. Its existing caller, `refundCents`, is unaffected.
