'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const { spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

const { configDirFor } = require('../index-on-session-end');
const { indexConfig }  = require('./run-index');

const HOOK = path.join(__dirname, '..', 'index-on-session-end.js');

function tempConfig() {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'session-end-'));
  const project = path.join(config, 'projects', 'proj');
  fs.mkdirSync(project, { recursive: true });
  const transcript = path.join(project, 's1.jsonl');
  fs.writeFileSync(transcript, JSON.stringify({
    type: 'user', uuid: 'u1', timestamp: '2026-10-01T00:00:00.000Z', cwd: config,
    message: { role: 'user', content: 'hello' },
  }) + '\n');
  return { config, transcript };
}

const fire = transcript => spawnSync(process.execPath, [HOOK], {
  input: JSON.stringify({ hook_event_name: 'SessionEnd', transcript_path: transcript }),
  encoding: 'utf8',
});

/** The event count once it reaches want, or the last count seen when ms runs out. */
async function eventsReach(config, want, ms) {
  let n = 0;
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const db = new DatabaseSync(path.join(config, 'dev-flow-index.db'), { readOnly: true });
      n = db.prepare('SELECT count(*) AS n FROM events').get().n;
      db.close();
      if (n >= want) return n;
    } catch { /* not written yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  return n;
}

test('the config dir comes from the transcript path, else the environment', () => {
  assert.equal(configDirFor({ transcript_path: '/c/projects/p/s.jsonl' }), '/c');
  assert.equal(configDirFor({}, { CLAUDE_CONFIG_DIR: '/env' }), '/env');
  assert.equal(configDirFor({ transcript_path: '/elsewhere/s.jsonl' }, { CLAUDE_CONFIG_DIR: '/env' }), '/env');
});

test('with no index in the config dir, the hook creates nothing', () => {
  const { config, transcript } = tempConfig();
  const r = fire(transcript);
  assert.equal(r.status, 0);
  assert.equal(r.stdout + r.stderr, '');
  assert.equal(fs.existsSync(path.join(config, 'dev-flow-index.db')), false);
});

test('with an index in the config dir, the hook updates it in the background', async () => {
  const { config, transcript } = tempConfig();
  indexConfig(config).db.close();
  fs.appendFileSync(transcript, JSON.stringify({
    type: 'user', uuid: 'u2', timestamp: '2026-10-01T00:00:01.000Z',
    message: { role: 'user', content: 'again' },
  }) + '\n');

  const r = fire(transcript);
  assert.equal(r.status, 0);
  assert.equal(r.stdout + r.stderr, '');
  assert.equal(await eventsReach(config, 2, 5000), 2);
});

test('bad input never fails the hook', () => {
  const r = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'session-end-')) } });
  assert.equal(r.status, 0);
});
