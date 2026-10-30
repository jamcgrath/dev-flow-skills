'use strict';

// Accepts numbers or strings, with or without a leading `$`, so coupon values can share it.
function toCents(amount) {
  return Math.trunc(parseFloat(String(amount).replace(/^\$/, '')) * 100);
}

module.exports = { toCents };
