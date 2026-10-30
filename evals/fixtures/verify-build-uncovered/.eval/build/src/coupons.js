'use strict';

const { toCents } = require('./money.js');

const COUPONS = {
  SAVE5: '$5.00',
  SAVE10: '$10.00',
};

function couponCents(code) {
  return Object.hasOwn(COUPONS, code) ? toCents(COUPONS[code]) : 0;
}

module.exports = { couponCents };
