'use strict';

const { toCents } = require('./money.js');

// Refund rows come from the payments export as decimal dollar amounts.
function refundCents(rows) {
  return rows.reduce((sum, row) => sum + toCents(row.amount), 0);
}

module.exports = { refundCents };
