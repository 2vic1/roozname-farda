// ─── 'sdk' shim for VPS — bun:sqlite (Drizzle-style) + Telegram Bot API ───
// Drop-in replacement so tgcloud/ business modules run unchanged on a VPS.
import { Database } from 'bun:sqlite';
import * as ops from './db.js';

const DB_PATH = process.env.WARS_DB || './wars.db';
const sqlite = new Database(DB_PATH);
sqlite.run('PRAGMA journal_mode = WAL;');
sqlite.run('PRAGMA busy_timeout = 5000;');

// ─── value conversion (timestamp / boolean modes) ───
const toStore = (v) => {
  if (v instanceof Date) return Math.floor(v.getTime() / 1000);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
};
const colOut = (v, c) => {
  if (v == null) return v;
  if (c?.mode === 'timestamp') return new Date(v * 1000);
  if (c?.kind === 'bool') return !!v;
  return v;
};
const colIn = (v) => toStore(v);

// ─── condition → SQL ───
function condSql(c, params) {
  if (!c) return '1=1';
  if (c.__and) return '(' + c.__and.map((p) => condSql(p, params)).join(' AND ') + ')';
  if (c.__or) return '(' + c.__or.map((p) => condSql(p, params)).join(' OR ') + ')';
  if (c.__not) return 'NOT ' + condSql(c.__not, params);
  if (c.__null) return `${c.__c.__col} IS NULL`;
  if (c.__notnull) return `${c.__c.__col} IS NOT NULL`;
  if (c.__in) {
    const ph = c.__in.map((v) => { params.push(colIn(v)); return '?'; }).join(', ');
    return `${c.__c.__col} IN (${ph})`;
  }
  params.push(colIn(c.__v));
  return `${c.__c.__col} ${c.__op} ?`;
}

// ─── db object (synchronous — bun:sqlite) ───
export const db = {
  select(projection) {
    const q = { proj: projection ?? null, t: null, where: null, order: [], limit: null };
    const chain = {
      from(t) { q.t = t; return chain; },
      where(c) { q.where = c; return chain; },
      orderBy(...o) { q.order = o; return chain; },
      limit(n) { q.limit = n; return chain; },
      get() { const rows = runSelect(q); return rows[0]; },
      all() { return runSelect(q); },
    };
    return chain;
  },
  insert(t) {
    const q = { t, vals: null, conflict: null };
    const chain = {
      values(v) { q.vals = v; return chain; },
      onConflictDoUpdate(o) { q.conflict = o; return chain; },
      run() { return runInsert(q); },
    };
    return chain;
  },
};

function runSelect(q) {
  const params = [];
  const cols = q.t.__cols;
  const isProj = q.proj && typeof q.proj === 'object';
  const sel = isProj
    ? Object.entries(q.proj).map(([alias, ref]) => `${ref.__col} AS ${alias}`).join(', ')
    : Object.values(cols).map((c) => c.col).join(', ');
  let sqlStr = `SELECT ${sel} FROM ${q.t.__name}`;
  if (q.where) sqlStr += ` WHERE ${condSql(q.where, params)}`;
  if (q.order.length) sqlStr += ' ORDER BY ' + q.order.map((o) => `${o.__c.__col} ${o.__dir}`).join(', ');
  if (q.limit != null) sqlStr += ` LIMIT ${Number(q.limit)}`;
  const raw = sqlite.prepare(sqlStr).all(...params);
  return raw.map((r) => {
    const out = {};
    if (isProj) {
      for (const [alias, ref] of Object.entries(q.proj)) out[alias] = r[alias];
    } else {
      for (const [prop, c] of Object.entries(cols)) out[prop] = colOut(r[c.col], c);
    }
    return out;
  });
}

function runInsert({ t, vals, conflict }) {
  const arr = Array.isArray(vals) ? vals : [vals];
  if (!arr.length) return;
  const props = Object.keys(arr[0]);
  const colNames = props.map((p) => t.__cols[p]?.col ?? p).join(', ');
  const ph = props.map(() => '?').join(', ');
  const rowParams = (v) =>
    props.map((p) => {
      const x = v[p];
      if (x && typeof x === 'object' && '__sql' in x)
        throw new Error(`raw sql() not supported in .values() — column: ${p}`);
      return colIn(x);
    });

  if (conflict) {
    const targetCol = conflict.target.__col;
    const targetProp = conflict.target.__prop;
    const setParts = [];
    const setParams = [];
    for (const [p, x] of Object.entries(conflict.set)) {
      const col = t.__cols[p]?.col ?? p;
      if (x && typeof x === 'object' && '__sql' in x) setParts.push(`${col} = ${x.__sql}`);
      else { setParts.push(`${col} = ?`); setParams.push(colIn(x)); }
    }
    const stmt = sqlite.prepare(
      `INSERT INTO ${t.__name} (${colNames}) VALUES (${ph}) ON CONFLICT(${targetCol}) DO UPDATE SET ${setParts.join(', ')}`
    );
    for (const v of arr) stmt.run(...rowParams(v), ...setParams);
  } else {
    const stmt = sqlite.prepare(`INSERT INTO ${t.__name} (${colNames}) VALUES (${ph})`);
    for (const v of arr) stmt.run(...rowParams(v));
  }
}

// ─── DDL (mirrors tgcloud/schema.js) ───
export function ensureSchema() {
  sqlite.run(`CREATE TABLE IF NOT EXISTS news_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL,
    source_label TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    lang TEXT NOT NULL DEFAULT 'en',
    published_at INTEGER NOT NULL,
    text_fa TEXT,
    ai_verdict TEXT,
    tension_score REAL NOT NULL DEFAULT 0,
    is_ad INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS asset_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '$',
    price REAL NOT NULL DEFAULT 0,
    change1d REAL NOT NULL DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch())
  );`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS risk_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    score INTEGER NOT NULL DEFAULT 0,
    level TEXT NOT NULL DEFAULT 'آرام',
    news_component REAL NOT NULL DEFAULT 0,
    market_component REAL NOT NULL DEFAULT 0,
    attack_date_near TEXT,
    attack_date_mid TEXT,
    attack_date_far TEXT,
    attack_date_likely TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    risk_score INTEGER NOT NULL DEFAULT 0,
    generated_at INTEGER DEFAULT (unixepoch()),
    content_fa TEXT NOT NULL,
    near_date TEXT,
    mid_date TEXT,
    far_date TEXT,
    likely_date TEXT
  );`);
  sqlite.run(`CREATE TABLE IF NOT EXISTS setting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );`);
}

// ─── Telegram Bot API ───
const TOKEN = process.env.TG_BOT_TOKEN || '';
export function botTokenReady() { return !!TOKEN; }

async function tg(method, params = {}) {
  if (!TOKEN) throw new Error('TG_BOT_TOKEN تنظیم نشده است');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 35000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: ctrl.signal,
    });
    const j = await res.json();
    if (!j.ok) throw new Error(`${method}: ${j.description || 'unknown error'}`);
    return j.result;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  sendMessage: (p) => tg('sendMessage', p),
  deleteMessage: (p) => tg('deleteMessage', p),
  editMessageText: (p) => tg('editMessageText', p),
  getUpdates: (p) => tg('getUpdates', p),
  getMe: () => tg('getMe', {}),
  raw: tg,
};
