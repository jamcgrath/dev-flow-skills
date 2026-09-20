'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  stripFencedCodeBlocks,
  parseFrontmatter,
  lintSkillContent,
  lintReferences,
  MAX_DESCRIPTION_LENGTH,
} = require('./skill-lint');

const skill = (name, description) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nBody.\n`;

const KNOWN = new Set(['dev-flow', 'verify-build', 'audit-tests']);
const always = () => true;
const never  = () => false;

// ─── frontmatter ─────────────────────────────────────────────────────────────

test('a well-formed skill produces no findings', () => {
  const r = lintSkillContent('dev-flow', skill('dev-flow', 'Use when the user says dev flow.'));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('missing frontmatter is an error', () => {
  const r = lintSkillContent('dev-flow', '# dev-flow\n\nNo frontmatter here.\n');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /frontmatter/);
});

test('a name that does not match its directory is an error', () => {
  const r = lintSkillContent('verify-build', skill('verify-ticket', 'Use when verifying.'));
  assert.match(r.errors.join(' '), /does not match directory/);
});

test('a non-kebab-case directory is an error', () => {
  const r = lintSkillContent('Verify_Build', skill('Verify_Build', 'Use when verifying.'));
  assert.match(r.errors.join(' '), /not kebab-case/);
});

test('a missing description is an error', () => {
  const r = lintSkillContent('dev-flow', '---\nname: dev-flow\n---\n\n# dev-flow\n');
  assert.match(r.errors.join(' '), /no `description`/);
});

test('an over-long description warns but does not error', () => {
  const r = lintSkillContent('dev-flow', skill('dev-flow', 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1)));
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /truncates/);
});

test('a description at exactly the limit does not warn', () => {
  const r = lintSkillContent('dev-flow', skill('dev-flow', 'x'.repeat(MAX_DESCRIPTION_LENGTH)));
  assert.deepEqual(r.warnings, []);
});

// ─── cross-references: the check this lint exists for ────────────────────────

test('a backticked reference to a deleted skill is an error', () => {
  const errs = lintReferences('skills/dev-flow/SKILL.md', 'Then run `/implement-brief` to build.', KNOWN, always);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /implement-brief/);
});

test('a backticked reference to a live skill is clean', () => {
  assert.deepEqual(lintReferences('x.md', 'Spawn `/verify-build` fresh.', KNOWN, always), []);
});

test('a Claude Code built-in is not treated as a dead reference', () => {
  assert.deepEqual(lintReferences('x.md', 'Run `/code-review` and `/security-review`.', KNOWN, always), []);
});

test('each dead reference is reported once, not once per mention', () => {
  const errs = lintReferences('x.md', '`/gone` here and `/gone` again and `/gone`.', KNOWN, always);
  assert.equal(errs.length, 1);
});

test('a skills/<name>/SKILL.md path to a missing skill is an error', () => {
  const errs = lintReferences('x.md', 'See skills/implement-brief/SKILL.md for details.', KNOWN, always);
  assert.match(errs.join(' '), /does not exist/);
});

test('a skills/<name>/SKILL.md path to a live skill is clean', () => {
  assert.deepEqual(lintReferences('x.md', 'See skills/dev-flow/SKILL.md.', KNOWN, always), []);
});

test('a dead relative link is an error', () => {
  const errs = lintReferences('docs/dev-flow.md', 'See [the plan](../PLAN.md).', KNOWN, never);
  assert.match(errs.join(' '), /relative link target does not exist/);
});

test('a link anchor does not break resolution', () => {
  const seen = [];
  lintReferences('docs/dev-flow.md', 'See [flow](../README.md#the-flow).', KNOWN,
    (from, target) => { seen.push(target); return true; });
  assert.deepEqual(seen, ['../README.md']);
});

// ─── what must NOT be matched ────────────────────────────────────────────────

test('a bare prose slash is not a reference', () => {
  // "explaining an arbitrary branch is /init's job" — prose, not a ref.
  assert.deepEqual(lintReferences('x.md', "that is /implement-brief's job, not this one", KNOWN, always), []);
});

test('a URL path inside a command is not a reference', () => {
  const text = 'Run `gh api repos/{owner}/{repo}/pulls/{N}/comments --paginate`.';
  assert.deepEqual(lintReferences('x.md', text, KNOWN, always), []);
});

test('references inside a fenced code block are ignored', () => {
  const text = 'Prose.\n\n```bash\n`/gone-skill` --flag\n```\n\nMore prose.\n';
  assert.deepEqual(lintReferences('x.md', text, KNOWN, always), []);
});

test('a reference after a closed fence is still caught', () => {
  const text = '```\ncode\n```\n\nNow run `/gone-skill`.\n';
  assert.equal(lintReferences('x.md', text, KNOWN, always).length, 1);
});

// ─── helpers ─────────────────────────────────────────────────────────────────

test('stripFencedCodeBlocks preserves line numbering', () => {
  const src = 'a\n```\nb\nc\n```\nd';
  assert.equal(stripFencedCodeBlocks(src).split('\n').length, src.split('\n').length);
});

test('stripFencedCodeBlocks handles tilde fences', () => {
  assert.doesNotMatch(stripFencedCodeBlocks('a\n~~~\n`/gone`\n~~~\nb'), /gone/);
});

test('parseFrontmatter strips surrounding quotes', () => {
  assert.equal(parseFrontmatter('---\nname: "dev-flow"\n---\n').name, 'dev-flow');
});

test('parseFrontmatter returns null when there is no block', () => {
  assert.equal(parseFrontmatter('# heading\n'), null);
});
