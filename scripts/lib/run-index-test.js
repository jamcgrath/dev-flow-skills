'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const { indexConfig, runDetectors, completeLines, eventsOf } = require('./run-index');

const DETECTORS = path.join(__dirname, '..', 'detectors');

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function tempConfig() {
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'run-index-'));
  const repo = path.join(config, 'repo');
  fs.mkdirSync(path.join(config, 'projects', 'proj'), { recursive: true });
  fs.mkdirSync(repo);
  return { config, repo, project: path.join(config, 'projects', 'proj') };
}

let clock = 0;
const ts = () => new Date(Date.UTC(2026, 9, 1, 0, 0, clock++)).toISOString();
const uuid = () => `uuid-${clock}`;

const user = (text, cwd) => ({ type: 'user', uuid: uuid(), timestamp: ts(), cwd, message: { role: 'user', content: text } });
const toolResult = () => ({
  type: 'user', uuid: uuid(), timestamp: ts(),
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'big output' }] },
});
const tool = (name, input, id = `toolu_${clock}`) => ({
  type: 'assistant', uuid: uuid(), timestamp: ts(),
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
});
const lines = records => records.map(r => JSON.stringify(r) + '\n').join('');

const verdictWrite = verdict => tool('Write', {
  file_path: '/x/.dev-flow/t/VERIFICATION.md',
  content: `## Verdict\n${verdict} — reason\n`,
});

const hits = (db, name) => runDetectors(db, DETECTORS).find(d => d.name === name).rows;

// ─── Parsing ─────────────────────────────────────────────────────────────────

test('a user message and a tool call become events; tool results and meta records do not', () => {
  assert.deepEqual(eventsOf(user('hello')), [{ kind: 'user', text: 'hello' }]);
  assert.deepEqual(eventsOf(toolResult()), []);
  assert.deepEqual(eventsOf({ ...user('skill body'), isMeta: true }), []);
  const [e] = eventsOf(tool('Bash', { command: 'ls' }, 'toolu_1'));
  assert.equal(e.tool, 'Bash');
  assert.equal(e.toolUseId, 'toolu_1');
  assert.deepEqual(JSON.parse(e.input), { command: 'ls' });
});

test('an unfinished last line is not consumed', () => {
  assert.deepEqual(completeLines(Buffer.from('{"a":1}\n{"b":')), ['{"a":1}']);
  assert.deepEqual(completeLines(Buffer.from('{"a":1}\n')), ['{"a":1}']);
});

// ─── Ingest ──────────────────────────────────────────────────────────────────

test('re-indexing reads only the lines appended since the last run', () => {
  const { config, repo, project } = tempConfig();
  const file = path.join(project, 's1.jsonl');
  fs.writeFileSync(file, lines([user('first', repo), toolResult()]));

  let r = indexConfig(config);
  assert.equal(r.events, 1);
  r.db.close();

  r = indexConfig(config);
  assert.equal(r.events, 0, 'an unchanged file adds nothing');
  r.db.close();

  fs.appendFileSync(file, lines([tool('Read', { file_path: '/a' })]));
  r = indexConfig(config);
  assert.equal(r.events, 1);
  const session = r.db.prepare('SELECT * FROM sessions WHERE id = ?').get('s1');
  assert.equal(session.cwd, repo);
  r.db.close();
});

test('history a resumed session copies into a new file is indexed once', () => {
  const { config, repo, project } = tempConfig();
  const shared = [user('first', repo), tool('Read', { file_path: '/a' })];
  fs.writeFileSync(path.join(project, 'original.jsonl'), lines(shared));
  fs.writeFileSync(path.join(project, 'resumed.jsonl'), lines([...shared, user('new turn', repo)]));

  const { db, events } = indexConfig(config);
  assert.equal(events, 3);
  db.close();
});

test('a subagent transcript is indexed under its session and linked to its spawn', () => {
  const { config, repo, project } = tempConfig();
  fs.writeFileSync(path.join(project, 's1.jsonl'), lines([user('go', repo)]));
  const sub = path.join(project, 's1', 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'agent-a1.jsonl'), lines([tool('Read', { file_path: '/b' })]));
  fs.writeFileSync(path.join(sub, 'agent-a1.meta.json'),
    JSON.stringify({ agentType: 'general-purpose', description: 'Verify', toolUseId: 'toolu_spawn' }));

  const { db } = indexConfig(config);
  const e = db.prepare("SELECT * FROM events WHERE tool = 'Read'").get();
  assert.equal(e.session_id, 's1');
  assert.equal(e.agent_id, 'a1');
  assert.equal(db.prepare('SELECT tool_use_id FROM agents WHERE id = ?').get('a1').tool_use_id, 'toolu_spawn');
  db.close();
});

test('.dev-flow files are indexed, and a changed file adds a version', () => {
  const { config, repo, project } = tempConfig();
  const task = path.join(repo, '.dev-flow', 'TASK-1');
  fs.mkdirSync(task, { recursive: true });
  fs.writeFileSync(path.join(task, 'PLAN.md'), 'v1');
  fs.writeFileSync(path.join(project, 's1.jsonl'), lines([user('go', repo)]));

  let r = indexConfig(config);
  assert.equal(r.artifacts, 1);
  r.db.close();

  fs.writeFileSync(path.join(task, 'PLAN.md'), 'v2');
  r = indexConfig(config);
  assert.equal(r.artifacts, 1);
  const rows = r.db.prepare('SELECT repo, task, file, content FROM artifacts ORDER BY id').all();
  assert.deepEqual(rows.map(x => x.content), ['v1', 'v2']);
  assert.equal(rows[0].repo, 'repo');
  assert.equal(rows[0].file, 'PLAN.md');
  r.db.close();
});

// ─── Detectors ───────────────────────────────────────────────────────────────

test('detectors flag the failures they encode, and stay quiet on clean runs', () => {
  const { config, repo, project } = tempConfig();
  fs.writeFileSync(path.join(project, 'leaky.jsonl'), lines([
    user('start', repo),
    tool('Agent', { description: 'Verify', prompt: 'Run verify-build. A prior version exists — read it for context.' }),
    verdictWrite('falsified'),
    verdictWrite('falsified'),
    user('verify and code review the last commit'),
    tool('Write', { file_path: '/x/.dev-flow/t/ENVIRONMENT.md', content: '- At HEAD: 6/6 pass' }),
  ]));
  fs.writeFileSync(path.join(project, 'clean.jsonl'), lines([
    user('start', repo),
    tool('Agent', { description: 'Verify', prompt: 'Run verify-build. Base is abc.' }),
    verdictWrite('falsified'),
    verdictWrite('verified'),
    tool('Write', { file_path: '/x/.dev-flow/t/ENVIRONMENT.md', content: '- At base abc: 2 fail' }),
  ]));
  const sub = path.join(project, 'leaky', 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'agent-v1.jsonl'), lines([
    tool('Bash', { command: 'mv .dev-flow/t/VERIFICATION.md .dev-flow/t/VERIFICATION.attempt-2.md' }),
    tool('Read', { file_path: '/x/.dev-flow/t/VERIFICATION.attempt-1.md' }),
  ]));

  const { db } = indexConfig(config);
  const sessions = name => hits(db, name).map(r => r.session_id);
  assert.deepEqual(sessions('prior-verdict-in-prompt'), ['leaky']);
  assert.deepEqual(sessions('consecutive-falsified'), ['leaky']);
  assert.deepEqual(sessions('manual-verify-after-gate'), ['leaky']);
  assert.deepEqual(sessions('env-head-results'), ['leaky']);
  assert.equal(hits(db, 'subagent-read-archive').length, 1, 'the mv aside is allowed; the Read is not');
  db.close();
});
