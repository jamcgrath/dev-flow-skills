/**
 * skill-lint.js
 *
 * The rules, as importable pure functions so they can be unit-tested without
 * touching the filesystem. scripts/validate-skills.js is the thin CLI wrapper.
 *
 * The check that earns its keep here is the dead cross-reference one: these
 * skills name each other constantly, and deleting or renaming one leaves the
 * references behind with nothing to fail.
 */

'use strict';

// Claude Code's documented limit is 1536 characters across `description` plus
// `when_to_use`, and over-length descriptions are TRUNCATED in the skill
// listing rather than rejected. So this is a warning about losing the tail of
// your own description, not an error.
const MAX_DESCRIPTION_LENGTH = 1536;

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Slash commands that are Claude Code built-ins or come from another plugin,
// so they are legitimately referenced without living in skills/. Anything
// backticked as `/name` and absent from both this list and skills/ is a dead
// reference. Adding a genuinely new built-in here is a one-line, deliberate
// decision — which is the point.
const EXTERNAL_COMMANDS = new Set([
  'clear', 'code-review', 'compact', 'config', 'help', 'init', 'loop',
  'plan', 'plugin', 'reload-plugins', 'schedule', 'security-review', 'verify',
]);

// The reference conventions this repo actually uses, established by scanning
// it: a backticked slash command, and a path to another skill's SKILL.md.
// Bare prose slashes are deliberately NOT matched — "/init's job" in a
// sentence and "repos/{owner}/{repo}/pulls" in a gh command are not references.
const SLASH_REF   = /`\/([a-z][a-z0-9-]*)`/g;
const SKILL_PATH  = /(?:^|[^a-zA-Z0-9/._-])(skills\/([a-z0-9-]+)\/SKILL\.md)/g;
const REL_LINK    = /\]\((\.\.?\/[^)#\s]+)(?:#[^)\s]*)?\)/g;

/** Drop fenced code blocks so examples and diagrams aren't scanned for refs. */
function stripFencedCodeBlocks(content) {
  const out = [];
  let fence = null;
  for (const line of content.split('\n')) {
    const m = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (m && line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/) && m[1][0] === fence[0] && m[1].length >= fence.length) {
        fence = null;
      }
      out.push('');
      continue;
    }
    // CommonMark: a backtick fence's info string may not contain a backtick,
    // so `` ```js` is inline `` is prose, not a fence opener.
    if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
      fence = m[1];
      out.push('');
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

function parseFrontmatter(content) {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n/);
  if (!match) return null;
  const result = {};
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    result[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return result;
}

/** Frontmatter rules for one SKILL.md. */
function lintSkillContent(dirName, content) {
  const errors = [];
  const warnings = [];

  if (!KEBAB_CASE.test(dirName)) {
    errors.push(`directory name "${dirName}" is not kebab-case`);
  }

  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push('no parseable YAML frontmatter (expected a --- delimited block at the top)');
    return { errors, warnings };
  }

  if (!fm.name) {
    errors.push('frontmatter has no `name`');
  } else if (fm.name !== dirName) {
    // Claude Code routes on the directory; a mismatched name silently
    // misrepresents the skill everywhere it is quoted.
    errors.push(`frontmatter name "${fm.name}" does not match directory "${dirName}"`);
  }

  if (!fm.description) {
    errors.push('frontmatter has no `description` (it is what the model routes on)');
  } else if (fm.description.length > MAX_DESCRIPTION_LENGTH) {
    warnings.push(`description is ${fm.description.length} chars; Claude Code truncates description + when_to_use at ${MAX_DESCRIPTION_LENGTH}, so the tail will not be seen`);
  }

  return { errors, warnings };
}

/**
 * Cross-reference rules for any markdown file in the repo.
 * `exists` is injected so this stays a pure function.
 */
function lintReferences(relPath, content, knownSkills, exists) {
  const errors = [];
  const prose = stripFencedCodeBlocks(content);

  const seen = new Set();
  for (const [, name] of prose.matchAll(SLASH_REF)) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (!knownSkills.has(name) && !EXTERNAL_COMMANDS.has(name)) {
      errors.push(`\`/${name}\` is neither a skill in skills/ nor a known external command`);
    }
  }

  for (const [, full, name] of prose.matchAll(SKILL_PATH)) {
    if (!knownSkills.has(name)) {
      errors.push(`${full} refers to a skill that does not exist`);
    }
  }

  for (const [, target] of prose.matchAll(REL_LINK)) {
    if (!exists(relPath, target)) {
      errors.push(`relative link target does not exist: ${target}`);
    }
  }

  return errors;
}

module.exports = {
  MAX_DESCRIPTION_LENGTH,
  EXTERNAL_COMMANDS,
  stripFencedCodeBlocks,
  parseFrontmatter,
  lintSkillContent,
  lintReferences,
};
