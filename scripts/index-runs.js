#!/usr/bin/env node
/**
 * index-runs.js
 *
 * Index one Claude config dir's transcripts and .dev-flow artifacts into
 * <config>/dev-flow-index.db, then optionally run the detectors in
 * scripts/detectors/ against it. Local only — nothing leaves the machine.
 *
 * --config is required, with no default, so a run can never pick up another
 * config dir's transcripts by accident: work and personal stay in separate
 * databases.
 *
 * Usage:
 *   node scripts/index-runs.js --config ~/.claude
 *   node scripts/index-runs.js --config ~/.claude --detect [--limit 5]
 *
 * Exit codes: 0 = indexed (detector hits do not fail the run), 1 = bad usage.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const { indexConfig, runDetectors, DB_NAME } = require('./lib/run-index');

const DETECTORS = path.join(__dirname, 'detectors');

function fail(message) {
  console.error(`index-runs: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { config: null, detect: false, limit: 5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--config') args.config = argv[++i];
    else if (a === '--detect') args.detect = true;
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else fail(`unknown argument: ${a}`);
  }
  if (!args.config) fail('--config <claude config dir> is required, e.g. --config ~/.claude');
  if (!Number.isInteger(args.limit) || args.limit < 0) fail('--limit wants a whole number');
  args.config = path.resolve(args.config.replace(/^~(?=$|\/)/, os.homedir()));
  if (!fs.existsSync(path.join(args.config, 'projects'))) fail(`no projects/ under ${args.config}`);
  return args;
}

const args = parseArgs(process.argv.slice(2));
const started = Date.now();
const { db, files, events, artifacts } = indexConfig(args.config);
const seconds = ((Date.now() - started) / 1000).toFixed(1);

console.log(`indexed ${files} transcript file(s) in ${seconds}s → ${path.join(args.config, DB_NAME)}`);
console.log(`  +${events} event(s), +${artifacts} artifact version(s)`);

if (args.detect) {
  for (const d of runDetectors(db, DETECTORS)) {
    console.log(`\n${d.name} — ${d.rows.length} hit(s)`);
    console.log(`  ${d.description}`);
    for (const r of d.rows.slice(0, args.limit)) {
      console.log(`  · ${r.ts ?? '-'}  ${String(r.session_id).slice(0, 8)}  ${r.detail ?? ''}`);
    }
    if (d.rows.length > args.limit) console.log(`  … ${d.rows.length - args.limit} more`);
  }
}
db.close();
