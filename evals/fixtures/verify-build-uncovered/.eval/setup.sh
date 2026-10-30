#!/usr/bin/env bash
# Two commits: the acceptance-test base, then the builder's change on top.
#
# The change adds coupon codes and, on the side, "refactors" the shared
# toCents helper so it reads `$`-prefixed coupon values. The refactor also
# swaps Math.round for Math.trunc, which breaks the existing caller
# refundCents on ordinary amounts (19.99 → 1998 cents, not 1999). No criterion
# is about refunds and refundCents has no tests, so the whole suite is green.
# Only checking the change no criterion covers finds the regression.
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
git commit --quiet -m "Add acceptance tests for coupon codes"

BASE_SHA="$(git rev-parse --short HEAD)"
perl -pi -e "s/__BASE_SHA__/${BASE_SHA}/g" \
  .dev-flow/coupon-codes/ACCEPTANCE_TESTS.md \
  .dev-flow/coupon-codes/TEST_AUDIT.md

cp .eval/build/src/money.js   src/money.js
cp .eval/build/src/coupons.js src/coupons.js

git add --all
git commit --quiet -m "Add coupon codes and let toCents read \$-prefixed values"

printf 'base=%s\ntask=coupon-codes\n' "$BASE_SHA" > .eval/vars
