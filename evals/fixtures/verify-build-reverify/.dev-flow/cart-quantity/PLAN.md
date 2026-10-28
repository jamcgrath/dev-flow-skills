# Plan — cart quantity and discount cap

Approved at the PLAN gate.

## Acceptance criteria

- **AC1** — `subtotal` multiplies each line's price by its `quantity`. A cart of
  `[{price: 250, quantity: 3}, {price: 100, quantity: 2}]` totals `950`, not `350`.
- **AC2** — A line with `quantity: 0` contributes nothing to the subtotal.
- **AC3** — A new `applyDiscount(cents, percent)` caps any discount at 50 percent, so a
  requested 90 percent off `1000` returns `500`.
- **AC4** — `formatPrice` output is unchanged by this work.

## Approach

`subtotal` gains the multiplication; `applyDiscount` is a new export in the same module.
`formatPrice` is not touched.
