'use strict';

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

module.exports = { toCents };
