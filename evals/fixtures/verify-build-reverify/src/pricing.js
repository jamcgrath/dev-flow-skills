'use strict';

// Current behaviour: each line contributes its price once. Quantity is carried
// on the line but not yet read — that is what this task changes.
function subtotal(lines) {
  return lines.reduce((sum, line) => sum + line.price, 0);
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

module.exports = { subtotal, formatPrice };
