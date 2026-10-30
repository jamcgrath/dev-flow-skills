#!/usr/bin/env node
/**
 * index-on-session-end.js
 *
 * The plugin's SessionEnd hook. When the ending session's config dir already has
 * a run index (made by /dev-flow-setup), start index-runs.js on it in the
 * background and return at once. With no index there it does nothing, so the
 * hook costs nothing for anyone who never ran setup.
 *
 * Never fails and never prints: a session's end is no place for an error. The
 * indexer's last output goes to <config>/dev-flow-index.log.
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { spawn } = require('child_process');

const DB_NAME  = 'dev-flow-index.db';
const LOG_NAME = 'dev-flow-index.log';

/** <config>/projects/<project>/<session>.jsonl → <config>; else $CLAUDE_CONFIG_DIR or ~/.claude. */
function configDirFor(input, env = process.env) {
  const t = input && input.transcript_path;
  if (t) {
    const projects = path.dirname(path.dirname(t));
    if (path.basename(projects) === 'projects') return path.dirname(projects);
  }
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function main() {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { /* no usable input */ }
  const config = configDirFor(input);
  if (!fs.existsSync(path.join(config, DB_NAME))) return;

  const log = fs.openSync(path.join(config, LOG_NAME), 'w');
  const child = spawn(process.execPath, [path.join(__dirname, 'index-runs.js'), '--config', config], {
    detached: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
}

if (require.main === module) {
  try { main(); } catch { /* see header: never fail a session's end */ }
}

module.exports = { configDirFor };
