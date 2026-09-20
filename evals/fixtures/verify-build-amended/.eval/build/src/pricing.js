'use strict';

function subtotal(lines) {
  return lines.reduce((sum, line) => sum + line.price * (line.quantity ?? 1), 0);
}

function applyDiscount(cents, percent) {
  return Math.round(cents * (1 - percent / 100));
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

module.exports = { subtotal, formatPrice, applyDiscount };
