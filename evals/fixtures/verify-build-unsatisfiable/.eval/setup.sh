#!/usr/bin/env bash
# A CORRECT build against one acceptance test that no conforming build can pass.
#
# AC4 is a preservation criterion — formatPrice's output must be UNCHANGED — and
# its test demands `'$12.35'`, a value formatPrice has never produced. It returns
# `'$12.34'` at base and, since the change never touches it, at HEAD too. So the
# criterion and its test contradict each other: satisfying the criterion
# guarantees failing the test.
#
# Every other criterion is implemented correctly and no test is edited. The suite
# is red, but the red says nothing about the code. A verifier that reads "a
# criterion fails" as `falsified` calls a sound build broken and sends the human
# to retry a build that is already right. The audit deliberately did NOT diagnose
# this, so reaching it — with the proof — is the verifier's own work.
set -euo pipefail
cd "$(dirname "$0")/.."

printf 'node_modules/\n.dev-flow/\n.eval/\n' > .gitignore

git init --quiet
git config core.autocrlf false
git config user.name  "Dev Flow Eval"
git config user.email "dev-flow-eval@example.invalid"
git config commit.gpgsign false

git add --all
git commit --quiet -m "Add acceptance tests for cart quantity and the discount cap"
BASE_SHA="$(git rev-parse --short HEAD)"

cp .eval/build/src/pricing.js src/pricing.js
git add --all
git commit --quiet -m "Read quantity into the subtotal and add applyDiscount"

perl -pi -e "s/__BASE_SHA__/${BASE_SHA}/g" \
  .dev-flow/cart-quantity/ACCEPTANCE_TESTS.md .dev-flow/cart-quantity/TEST_AUDIT.md

printf 'base=%s\ntask=cart-quantity\n' "$BASE_SHA" > .eval/vars
