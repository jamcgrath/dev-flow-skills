'use strict';

/**
 * private-terms — find private terms (an employer's org, repo or ticket prefix)
 * in text bound for a public repo.
 *
 * The terms come from a file outside the repo, because the list itself names
 * what must not appear here. One term per line, matched as a case-insensitive
 * substring; blank lines and lines starting with `#` are ignored.
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const DEFAULT_TERMS_FILE = path.join(os.homedir(), '.config', 'dev-flow', 'private-terms');

function termsFile(env = process.env) {
  return env.DEV_FLOW_PRIVATE_TERMS || DEFAULT_TERMS_FILE;
}

/** The terms in a file, or null when it is missing or lists none. */
function loadTerms(file) {
  if (!fs.existsSync(file)) return null;
  const terms = fs.readFileSync(file, 'utf8').split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.toLowerCase());
  return terms.length ? terms : null;
}

/** Each line of text that contains a term: [{ line, term }], line 1-based. */
function findTerms(text, terms) {
  const hits = [];
  text.split('\n').forEach((l, i) => {
    const lower = l.toLowerCase();
    for (const term of terms) if (lower.includes(term)) hits.push({ line: i + 1, term });
  });
  return hits;
}

/** The lines a `git diff -U0` adds, with their file and line number in the new version. */
function addedLines(diff) {
  const out = [];
  let file = null, line = 0;
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) {
      file = l === '+++ /dev/null' ? null : l.slice(4).replace(/^b\//, '');
    } else if (l.startsWith('@@')) {
      const m = /\+(\d+)/.exec(l);
      line = m ? Number(m[1]) : 0;
    } else if (l.startsWith('+') && file) {
      out.push({ file, line, text: l.slice(1) });
      line++;
    }
  }
  return out;
}

/** git's own comment lines in a commit message file are dropped before it is stored. */
function messageText(raw) {
  return raw.split('\n').map(l => (l.startsWith('#') ? '' : l)).join('\n');
}

module.exports = { DEFAULT_TERMS_FILE, termsFile, loadTerms, findTerms, addedLines, messageText };
