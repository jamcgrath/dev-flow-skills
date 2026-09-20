'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { subtotal, formatPrice } = require('../src/pricing.js');

// Pre-existing suite. Lines without an explicit quantity are legacy carts.
test.skip('subtotal of a legacy line without a quantity is its price', () => {
  assert.equal(subtotal([{ price: 500 }]), 500);
});

test('formatPrice renders whole dollars', () => {
  assert.equal(formatPrice(500), '$5.00');
});
