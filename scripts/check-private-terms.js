#!/usr/bin/env node
/**
 * check-private-terms.js
 *
 * Fails when text bound for this public repo contains a private term. The
 * terms live outside the repo, in ~/.config/dev-flow/private-terms or the file
 * $DEV_FLOW_PRIVATE_TERMS names. A missing or empty terms file fails too: the
 * check only runs where it was installed, so an absent list means it broke.
 *
 * Usage:
 *   node scripts/check-private-terms.js --staged           added lines and paths in the index
 *   node scripts/check-private-terms.js --message <file>   a commit message
 *   node scripts/check-private-terms.js --stdin            any text, e.g. a PR title and body
 *
 * Exit codes: 0 = clean, 1 = a private term found, 2 = no terms or bad usage.
 */

'use strict';

const fs = require('fs');
const { execFileSync } = require('child_process');

const { termsFile, loadTerms, findTerms, addedLines, messageText } = require('./lib/private-terms');

function usage(message) {
  console.error(`check-private-terms: ${message}`);
  process.exit(2);
}

const [mode, arg] = process.argv.slice(2);
const file = termsFile();
const terms = loadTerms(file);
if (!terms) usage(`no private terms in ${file} — list one per line, or set DEV_FLOW_PRIVATE_TERMS`);

const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

let hits;
if (mode === '--staged') {
  const paths = git(['diff', '--cached', '--name-only', '--diff-filter=ACR', '-z']).split('\0').filter(Boolean);
  hits = [
    ...paths.flatMap(p => findTerms(p, terms).map(h => ({ where: `${p} (path)`, term: h.term }))),
    ...addedLines(git(['diff', '--cached', '-U0', '--no-color', '--no-ext-diff']))
      .flatMap(a => findTerms(a.text, terms).map(h => ({ where: `${a.file}:${a.line}`, term: h.term }))),
  ];
} else if (mode === '--message' && arg) {
  hits = findTerms(messageText(fs.readFileSync(arg, 'utf8')), terms)
    .map(h => ({ where: `commit message:${h.line}`, term: h.term }));
} else if (mode === '--stdin') {
  hits = findTerms(fs.readFileSync(0, 'utf8'), terms).map(h => ({ where: `stdin:${h.line}`, term: h.term }));
} else {
  usage('pass --staged, --message <file> or --stdin');
}

if (hits.length) {
  console.error('check-private-terms: private terms found — remove them before this leaves the machine');
  for (const h of hits) console.error(`  ${h.where}  "${h.term}"`);
  process.exit(1);
}
