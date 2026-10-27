'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { toCents } = require('../src/money.js');

// Pre-existing suite.
test('toCents converts whole dollars', () => {
  assert.equal(toCents(5), 500);
});

test('toCents reads a decimal string', () => {
  assert.equal(toCents('12.50'), 1250);
});
