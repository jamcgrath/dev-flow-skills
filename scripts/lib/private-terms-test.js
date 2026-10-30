'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const { execFileSync, spawnSync } = require('child_process');

const { loadTerms, findTerms, addedLines, messageText } = require('./private-terms');

const CLI = path.join(__dirname, '..', 'check-private-terms.js');

// Synthetic terms only: a real one here would be the leak this guards against.
function termsAt(dir, body = '# work\nZZZCORP\nQQQ-\n') {
  const file = path.join(dir, 'terms');
  fs.writeFileSync(file, body);
  return file;
}

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'private-terms-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  return { dir, git };
}

function run(args, { cwd, terms, input } = {}) {
  return spawnSync('node', [CLI, ...args], {
    cwd, input, encoding: 'utf8',
    env: { ...process.env, DEV_FLOW_PRIVATE_TERMS: terms },
  });
}

// ─── Pure functions ──────────────────────────────────────────────────────────

test('terms are trimmed and lowercased; comments and blank lines are skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'private-terms-'));
  assert.deepEqual(loadTerms(termsAt(dir, '# c\n\n  ZZZCORP \nQQQ-\n')), ['zzzcorp', 'qqq-']);
  assert.equal(loadTerms(termsAt(dir, '# only a comment\n')), null);
  assert.equal(loadTerms(path.join(dir, 'missing')), null);
});

test('a term matches case-insensitively anywhere in a line', () => {
  assert.deepEqual(findTerms('fine\nsee qqq-12 and Zzzcorp', ['zzzcorp', 'qqq-']),
    [{ line: 2, term: 'zzzcorp' }, { line: 2, term: 'qqq-' }]);
  assert.deepEqual(findTerms('UTF-8 and PROJ-1234', ['zzzcorp', 'qqq-']), []);
});

test('only added lines of a diff are returned, numbered in the new file', () => {
  const diff = [
    '--- a/x.md', '+++ b/x.md', '@@ -3,1 +3,2 @@', '-old', '+new one', '+new two',
    '--- a/gone.md', '+++ /dev/null', '@@ -1 +0,0 @@', '-deleted',
  ].join('\n');
  assert.deepEqual(addedLines(diff), [
    { file: 'x.md', line: 3, text: 'new one' },
    { file: 'x.md', line: 4, text: 'new two' },
  ]);
});

test("git's comment lines in a message file are ignored", () => {
  assert.equal(messageText('Subject\n# On branch qqq-1\nbody'), 'Subject\n\nbody');
});

// ─── CLI ─────────────────────────────────────────────────────────────────────

test('--staged blocks a term in an added line or path, and passes one only in a removed line', () => {
  const { dir, git } = repo();
  const terms = termsAt(fs.mkdtempSync(path.join(os.tmpdir(), 'terms-')));
  fs.writeFileSync(path.join(dir, 'a.md'), 'about ZZZCORP\n');
  git('add', 'a.md');
  let r = run(['--staged'], { cwd: dir, terms });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /a\.md:1 {2}"zzzcorp"/);

  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--no-verify', '-m', 'seed');
  fs.writeFileSync(path.join(dir, 'a.md'), 'about nothing\n');
  git('add', 'a.md');
  assert.equal(run(['--staged'], { cwd: dir, terms }).status, 0, 'removing a term is allowed');

  fs.writeFileSync(path.join(dir, 'qqq-notes.md'), 'clean\n');
  git('add', 'qqq-notes.md');
  r = run(['--staged'], { cwd: dir, terms });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /qqq-notes\.md \(path\)/);
});

test('--message and --stdin block a term and pass clean text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'private-terms-'));
  const terms = termsAt(dir);
  const msg = path.join(dir, 'MSG');
  fs.writeFileSync(msg, 'Fix the thing\n\nIntent: from QQQ-42\n');
  assert.equal(run(['--message', msg], { terms }).status, 1);
  fs.writeFileSync(msg, 'Fix the thing\n\nIntent: a clean reason\n');
  assert.equal(run(['--message', msg], { terms }).status, 0);
  assert.equal(run(['--stdin'], { terms, input: 'PR body naming zzzcorp' }).status, 1);
  assert.equal(run(['--stdin'], { terms, input: 'PR body' }).status, 0);
});

test('a missing or empty terms file fails closed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'private-terms-'));
  assert.equal(run(['--stdin'], { terms: path.join(dir, 'missing'), input: 'x' }).status, 2);
  assert.equal(run(['--stdin'], { terms: termsAt(dir, '# nothing\n'), input: 'x' }).status, 2);
});
