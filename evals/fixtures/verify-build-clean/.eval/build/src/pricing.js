'use strict';

// A line without an explicit quantity is a legacy cart entry and counts once.
function subtotal(lines) {
  return lines.reduce((sum, line) => sum + line.price * (line.quantity ?? 1), 0);
}

function applyDiscount(cents, percent) {
  const capped = Math.min(percent, 50);
  return Math.round(cents * (1 - capped / 100));
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

module.exports = { subtotal, formatPrice, applyDiscount };
