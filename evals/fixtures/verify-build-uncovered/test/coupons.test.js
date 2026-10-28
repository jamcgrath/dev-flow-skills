'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { couponCents } = require('../src/coupons.js');

// AC1 — a known coupon code is worth its value in cents.
test('a known coupon code is worth its value in cents', () => {
  assert.equal(couponCents('SAVE5'), 500);
});

// AC2 — an unknown coupon code is worth nothing.
test('an unknown coupon code is worth nothing', () => {
  assert.equal(couponCents('NOPE'), 0);
});

// AC3 — coupon values written with a leading `$` are accepted.
test('coupon values written with a leading $ are accepted', () => {
  assert.equal(couponCents('SAVE10'), 1000);
});
