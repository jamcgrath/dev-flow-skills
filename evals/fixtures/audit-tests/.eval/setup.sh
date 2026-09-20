#!/usr/bin/env bash
# Builds the workspace's git history, then stamps the real base sha into the
# manifest. The sha cannot be hardcoded in the fixture: audit-tests reads it
# back out of ACCEPTANCE_TESTS.md and runs the tests against it.
#
# The acceptance tests ARE the base commit — no implementation exists yet, which
# is the whole premise of red-before-green. .dev-flow/ stays untracked, as it is
# in a real run, so the manifest can carry the sha of the commit it describes.
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
perl -pi -e "s/__BASE_SHA__/${BASE_SHA}/g" .dev-flow/cart-quantity/ACCEPTANCE_TESTS.md

printf 'base=%s\ntask=cart-quantity\n' "$BASE_SHA" > .eval/vars
