'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { subtotal, formatPrice, applyDiscount } = require('../src/pricing.js');

// AC1 — subtotal must multiply each line's price by its quantity.
test('subtotal multiplies each line price by its quantity', () => {
  const lines = [{ price: 250, quantity: 3 }, { price: 100, quantity: 2 }];
  assert.equal(subtotal(lines), 950);
});

// AC2 — a line with quantity 0 contributes nothing to the subtotal.
test('a line with quantity zero contributes nothing', () => {
  assert.equal(subtotal([{ price: 500, quantity: 0 }]), 0);
});

// AC3 — applyDiscount caps any discount at 50 percent.
test('applyDiscount caps the discount at 50 percent', () => {
  assert.equal(applyDiscount(1000, 90), 500);
});

// AC4 — formatPrice output is unchanged by this work.
test('formatPrice still renders cents as dollars', () => {
  assert.equal(formatPrice(1234), '$12.34');
});
