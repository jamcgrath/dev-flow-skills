#!/usr/bin/env node
/**
 * validate-skills.js
 *
 * Structural lint for this repo's skills and docs. Deterministic, dependency-
 * free and free to run — unlike scripts/run-skill-evals.js, which spends
 * tokens. Checks frontmatter validity per skill, then cross-references every
 * markdown file: a backticked `/name`, a skills/<name>/SKILL.md path, and a
 * relative link all have to point at something that exists.
 *
 * Usage: node scripts/validate-skills.js
 * Exit codes: 0 = clean (warnings allowed), 1 = one or more errors.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { lintSkillContent, lintReferences } = require('./lib/skill-lint');

const ROOT       = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');

/**
 * Every markdown file worth cross-checking: each skill, plus the repo's own
 * prose. evals/fixtures/** is deliberately excluded — that markdown is test
 * input the skills read, not documentation, and its references are fictional
 * by design.
 */
function markdownFiles() {
  const files = [];

  for (const dir of fs.readdirSync(SKILLS_DIR)) {
    const f = path.join(SKILLS_DIR, dir, 'SKILL.md');
    if (fs.existsSync(f)) files.push(f);
  }

  // Top level of each prose directory only, never recursive.
  for (const dir of ['.', 'docs', 'evals']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter(f => f.endsWith('.md')).sort()) {
      files.push(path.join(abs, f));
    }
  }

  return files;
}

function main() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`ERROR: no skills directory at ${SKILLS_DIR}`);
    process.exit(1);
  }

  const skillDirs = fs.readdirSync(SKILLS_DIR)
    .filter(d => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory())
    .sort();
  const knownSkills = new Set(skillDirs);

  let errors = 0;
  let warnings = 0;

  console.log('Skills');
  for (const dir of skillDirs) {
    const file = path.join(SKILLS_DIR, dir, 'SKILL.md');
    if (!fs.existsSync(file)) {
      console.log(`  ✗  ${dir}\n       ERROR: no SKILL.md`);
      errors++;
      continue;
    }
    const r = lintSkillContent(dir, fs.readFileSync(file, 'utf8'));
    errors += r.errors.length;
    warnings += r.warnings.length;
    if (!r.errors.length && !r.warnings.length) {
      console.log(`  ✓  ${dir}`);
    } else {
      console.log(`  ${r.errors.length ? '✗' : '⚠'}  ${dir}`);
      for (const m of r.errors)   console.log(`       ERROR: ${m}`);
      for (const m of r.warnings) console.log(`       WARN:  ${m}`);
    }
  }

  console.log('\nCross-references');
  // A relative link resolves from the directory of the file containing it.
  const exists = (fromRel, target) =>
    fs.existsSync(path.resolve(ROOT, path.dirname(fromRel), target));

  for (const file of markdownFiles()) {
    const rel = path.relative(ROOT, file);
    const found = lintReferences(rel, fs.readFileSync(file, 'utf8'), knownSkills, exists);
    errors += found.length;
    if (found.length) {
      console.log(`  ✗  ${rel}`);
      for (const m of found) console.log(`       ERROR: ${m}`);
    } else {
      console.log(`  ✓  ${rel}`);
    }
  }

  const status = errors ? 'FAILED' : warnings ? 'PASSED WITH WARNINGS' : 'PASSED';
  console.log(`\n${skillDirs.length} skills — ${errors} error(s), ${warnings} warning(s) — ${status}`);
  if (errors) process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: validate-skills failed unexpectedly: ${err.message}`);
  process.exit(1);
}
