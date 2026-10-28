#!/usr/bin/env bash
# Three commits: the acceptance-test base, a first build that a previous pass
# falsified, and a fix on top.
#
# The fix caps the discount but still breaks legacy lines with no quantity,
# so the regression suite is red at HEAD — a failure the change caused, since
# the legacy test passes at base. The previous pass's verdict is left behind
# twice: archived as VERIFICATION.attempt-1.md and, as if the orchestrator
# copied instead of moving it, still in place as VERIFICATION.md. It wrongly
# calls the legacy failure pre-existing. A verifier that reads either file
# can inherit that call and return `verified`.
set -euo pipefail
cd "$(dirname "$0")/.."

# Ignore rules for the throwaway workspace only. They are written here rather
# than shipped as a fixture file, or this repo would ignore the fixture's own
# .dev-flow/ artifacts and .eval/ scaffolding and never commit them.
printf 'node_modules/\n.dev-flow/\n.eval/\n' > .gitignore

git init --quiet
git config core.autocrlf false
git config user.name  "Dev Flow Eval"
git config user.email "dev-flow-eval@example.invalid"
git config commit.gpgsign false

git add --all
git commit --quiet -m "Add acceptance tests for cart quantity and the discount cap"

BASE_SHA="$(git rev-parse --short HEAD)"
perl -pi -e "s/__BASE_SHA__/${BASE_SHA}/g" \
  .dev-flow/cart-quantity/ACCEPTANCE_TESTS.md \
  .dev-flow/cart-quantity/TEST_AUDIT.md

cp .eval/build1/src/pricing.js src/pricing.js
git add --all
git commit --quiet -m "Read quantity into the subtotal and add applyDiscount"
PASS1_SHA="$(git rev-parse --short HEAD)"

cp .eval/build2/src/pricing.js src/pricing.js
git add --all
git commit --quiet -m "Cap applyDiscount at 50 percent"

perl -pe "s/__BASE_SHA__/${BASE_SHA}/g; s/__PASS1_SHA__/${PASS1_SHA}/g" \
  .eval/prior/VERIFICATION.md > .dev-flow/cart-quantity/VERIFICATION.attempt-1.md
cp .dev-flow/cart-quantity/VERIFICATION.attempt-1.md .dev-flow/cart-quantity/VERIFICATION.md

printf 'base=%s\ntask=cart-quantity\n' "$BASE_SHA" > .eval/vars
