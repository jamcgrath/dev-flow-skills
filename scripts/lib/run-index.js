'use strict';

/**
 * run-index — a local SQLite index of Claude Code transcripts and .dev-flow
 * artifacts, for querying across runs.
 *
 * One database per Claude config dir, stored inside it, so work and personal
 * transcripts never share a file. Transcripts are append-only JSONL; each file
 * is read from the last line already ingested. Tool inputs are kept whole (as
 * JSON) so new questions can be asked of old runs; tool results are dropped —
 * they are most of the bytes and no detector needs them.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const DB_NAME        = 'dev-flow-index.db';
const MAX_ARTIFACT_B = 1024 * 1024;

// Append a migration to change the schema; never edit a shipped one.
const MIGRATIONS = [
  `
  CREATE TABLE sessions (
    id       TEXT PRIMARY KEY,
    project  TEXT NOT NULL,
    cwd      TEXT,
    first_ts TEXT,
    last_ts  TEXT,
    source   TEXT NOT NULL
  );
  CREATE TABLE agents (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL,
    agent_type  TEXT,
    description TEXT,
    tool_use_id TEXT,
    model       TEXT
  );
  CREATE TABLE events (
    id          INTEGER PRIMARY KEY,
    session_id  TEXT NOT NULL,
    agent_id    TEXT,
    ts          TEXT,
    kind        TEXT NOT NULL,
    tool        TEXT,
    tool_use_id TEXT,
    input       TEXT,
    text        TEXT,
    uuid        TEXT,
    source      TEXT NOT NULL,
    line        INTEGER NOT NULL,
    block       INTEGER NOT NULL,
    UNIQUE (source, line, block)
  );
  -- A resumed or forked session copies its history into a new file under the same record
  -- uuids; this keeps each record once, in the first file indexed.
  CREATE UNIQUE INDEX events_record ON events (uuid, block) WHERE uuid IS NOT NULL;
  CREATE INDEX events_session ON events (session_id, ts);
  CREATE INDEX events_tool    ON events (tool);
  CREATE TABLE artifacts (
    id      INTEGER PRIMARY KEY,
    repo    TEXT NOT NULL,
    task    TEXT NOT NULL,
    file    TEXT NOT NULL,
    sha     TEXT NOT NULL,
    mtime   TEXT,
    content TEXT,
    UNIQUE (repo, task, file, sha)
  );
  CREATE TABLE ingested (
    source TEXT PRIMARY KEY,
    lines  INTEGER NOT NULL,
    size   INTEGER NOT NULL
  );
  `,
];

// ─── Database ────────────────────────────────────────────────────────────────

function openIndex(configDir) {
  const db = new DatabaseSync(path.join(configDir, DB_NAME));
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT version FROM schema_version').get();
  let version = row ? row.version : 0;
  for (; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN');
    db.exec(MIGRATIONS[version]);
    db.exec('DELETE FROM schema_version');
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version + 1);
    db.exec('COMMIT');
  }
  return db;
}

// ─── Transcripts ─────────────────────────────────────────────────────────────

/** Every transcript under <config>/projects: main sessions and their subagents. */
function transcriptFiles(configDir) {
  const root = path.join(configDir, 'projects');
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const project of fs.readdirSync(root)) {
    const dir = path.join(root, project);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (entry.endsWith('.jsonl')) {
        files.push({ project, file: path.join(dir, entry), sessionId: entry.slice(0, -6), agentId: null });
      }
      const sub = path.join(dir, entry, 'subagents');
      if (!fs.existsSync(sub)) continue;
      for (const s of fs.readdirSync(sub)) {
        const m = /^agent-(.+)\.jsonl$/.exec(s);
        if (m) files.push({ project, file: path.join(sub, s), sessionId: entry, agentId: m[1] });
      }
    }
  }
  return files;
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(b => b && b.type === 'text').map(b => b.text).join('\n');
}

/**
 * The events one transcript record contributes: a user's own message, the
 * assistant's text, and each tool call with its full input. Tool results and
 * injected meta records (skill bodies, reminders) are skipped.
 */
function eventsOf(record) {
  const msg = record.message || {};
  const content = msg.content;
  if (record.type === 'user' && !record.isMeta) {
    if (Array.isArray(content) && content.some(b => b && b.type === 'tool_result')) return [];
    const text = textOf(content);
    return text ? [{ kind: 'user', text }] : [];
  }
  if (record.type === 'assistant' && Array.isArray(content)) {
    const out = [];
    for (const b of content) {
      if (!b) continue;
      if (b.type === 'tool_use') {
        out.push({ kind: 'tool_use', tool: b.name, toolUseId: b.id, input: JSON.stringify(b.input ?? null) });
      } else if (b.type === 'text' && b.text) {
        out.push({ kind: 'assistant', text: b.text });
      }
    }
    return out;
  }
  return [];
}

/** Complete lines only: a live session may be mid-write on its last line. */
function completeLines(buf) {
  const text = buf.toString('utf8');
  const lines = text.split('\n');
  lines.pop(); // the empty tail after a final newline, or an unfinished line
  return lines;
}

function ingestTranscript(db, t) {
  const size = fs.statSync(t.file).size;
  const seen = db.prepare('SELECT lines, size FROM ingested WHERE source = ?').get(t.file);
  if (seen && seen.size === size) return 0;

  let from = seen ? seen.lines : 0;
  if (seen && size < seen.size) {
    // Rewritten rather than appended to: start this file over.
    db.prepare('DELETE FROM events WHERE source = ?').run(t.file);
    from = 0;
  }

  const lines = completeLines(fs.readFileSync(t.file));
  const insert = db.prepare(`
    INSERT OR IGNORE INTO events
      (session_id, agent_id, ts, kind, tool, tool_use_id, input, text, uuid, source, line, block)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const session = db.prepare(`
    INSERT INTO sessions (id, project, cwd, first_ts, last_ts, source) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      cwd      = coalesce(sessions.cwd, excluded.cwd),
      first_ts = min(coalesce(sessions.first_ts, excluded.first_ts), excluded.first_ts),
      last_ts  = max(coalesce(sessions.last_ts, excluded.last_ts), excluded.last_ts)`);

  let added = 0, cwd = null, first = null, last = null;
  db.exec('BEGIN');
  for (let i = from; i < lines.length; i++) {
    let record;
    try { record = JSON.parse(lines[i]); } catch { continue; }
    const ts = record.timestamp || null;
    if (ts) { first = first && first < ts ? first : ts; last = last && last > ts ? last : ts; }
    if (!cwd && record.cwd) cwd = record.cwd;
    eventsOf(record).forEach((e, block) => {
      added += Number(insert.run(t.sessionId, t.agentId, ts, e.kind, e.tool ?? null, e.toolUseId ?? null,
        e.input ?? null, e.text ?? null, record.uuid ?? null, t.file, i, block).changes);
    });
  }
  if (!t.agentId) session.run(t.sessionId, t.project, cwd, first, last, t.file);
  else ingestAgentMeta(db, t);
  db.prepare(`INSERT INTO ingested (source, lines, size) VALUES (?, ?, ?)
              ON CONFLICT (source) DO UPDATE SET lines = excluded.lines, size = excluded.size`)
    .run(t.file, lines.length, size);
  db.exec('COMMIT');
  return added;
}

/** The .meta.json beside a subagent transcript links it to the tool call that spawned it. */
function ingestAgentMeta(db, t) {
  const metaFile = t.file.replace(/\.jsonl$/, '.meta.json');
  if (!fs.existsSync(metaFile)) return;
  let meta;
  try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch { return; }
  db.prepare(`INSERT OR REPLACE INTO agents (id, session_id, agent_type, description, tool_use_id, model)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(t.agentId, t.sessionId, meta.agentType ?? null, meta.description ?? null,
      meta.toolUseId ?? null, meta.model ?? null);
}

// ─── .dev-flow artifacts ─────────────────────────────────────────────────────

/** The nearest .dev-flow at or above dir, if the dir still exists. */
function devFlowFor(dir) {
  let d = dir;
  while (d && fs.existsSync(d)) {
    const candidate = path.join(d, '.dev-flow');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}

function filesUnder(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnder(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** Every text file in every .dev-flow reachable from an indexed session's cwd; a changed file adds a row. */
function ingestArtifacts(db) {
  const roots = new Set();
  for (const { cwd } of db.prepare('SELECT DISTINCT cwd FROM sessions WHERE cwd IS NOT NULL').all()) {
    const root = devFlowFor(cwd);
    if (root) roots.add(root);
  }
  const insert = db.prepare(`INSERT OR IGNORE INTO artifacts (repo, task, file, sha, mtime, content)
                             VALUES (?, ?, ?, ?, ?, ?)`);
  let added = 0;
  db.exec('BEGIN');
  for (const root of roots) {
    // A worktree's .dev-flow belongs to the repo it was cut from, not to the worktree's name.
    const wt = /^(.*)\/\.claude\/worktrees\/[^/]+\/\.dev-flow$/.exec(root);
    const repo = path.basename(wt ? wt[1] : path.dirname(root));
    for (const task of fs.readdirSync(root, { withFileTypes: true })) {
      if (!task.isDirectory()) continue;
      for (const file of filesUnder(path.join(root, task.name))) {
        const stat = fs.statSync(file);
        if (stat.size > MAX_ARTIFACT_B) continue;
        const buf = fs.readFileSync(file);
        if (buf.includes(0)) continue; // binary
        const sha = crypto.createHash('sha256').update(buf).digest('hex');
        added += Number(insert.run(repo, task.name, path.relative(path.join(root, task.name), file), sha,
          stat.mtime.toISOString(), buf.toString('utf8')).changes);
      }
    }
  }
  db.exec('COMMIT');
  return added;
}

// ─── Entry points ────────────────────────────────────────────────────────────

function indexConfig(configDir) {
  const db = openIndex(configDir);
  const files = transcriptFiles(configDir);
  let events = 0;
  for (const t of files) events += ingestTranscript(db, t);
  const artifacts = ingestArtifacts(db);
  return { db, files: files.length, events, artifacts };
}

/** Each detector is one .sql file whose leading `--` lines describe it. */
function runDetectors(db, detectorDir) {
  return fs.readdirSync(detectorDir).filter(f => f.endsWith('.sql')).sort().map(f => {
    const sql = fs.readFileSync(path.join(detectorDir, f), 'utf8');
    const description = sql.split('\n').filter(l => l.startsWith('--')).map(l => l.slice(2).trim()).join(' ');
    return { name: f.slice(0, -4), description, rows: db.prepare(sql).all() };
  });
}

module.exports = {
  DB_NAME,
  openIndex,
  transcriptFiles,
  eventsOf,
  completeLines,
  ingestTranscript,
  ingestArtifacts,
  indexConfig,
  runDetectors,
};
