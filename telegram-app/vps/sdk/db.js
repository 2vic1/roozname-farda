// ─── 'sdk/db' shim — Drizzle-style operators + table definitions (pure JS) ───

/** Column definition chain: integer('col', {mode:'timestamp'}).notNull().default(x) */
function colDef(kind, name, opts = {}) {
  const c = {
    __kind: kind,
    __col: name,
    __mode: opts.mode ?? null,
    __nn: false,
    __pk: false,
    __dflt: undefined,
    notNull() { c.__nn = true; return c; },
    default(v) { c.__dflt = v; return c; },
    primaryKey(_opts) { c.__pk = true; c.__nn = true; return c; },
    unique() { c.__uq = true; return c; },
  };
  return c;
}

export const text = (n, o) => colDef('text', n, o);
export const integer = (n, o) => colDef('int', n, o);
export const real = (n, o) => colDef('real', n, o);
export const boolean = (n, o) => colDef('bool', n, o);

/** table('name', { prop: columnDef, ... }) → table object with column refs */
export function table(name, defs) {
  const t = { __name: name, __cols: {} };
  for (const [prop, def] of Object.entries(defs)) {
    t.__cols[prop] = {
      prop,
      col: def.__col,
      kind: def.__kind,
      mode: def.__mode,
      nn: def.__nn,
      pk: def.__pk,
      dflt: def.__dflt,
    };
    // column reference (used by eq/orderBy/conflict target)
    t[prop] = { __prop: prop, __table: name, __col: def.__col, __mode: def.__mode, __kind: def.__kind };
  }
  return t;
}

/** raw SQL marker (defaults & onConflict set values) */
export const sql = (strings) => ({ __sql: strings.join('') });

// ─── operators ───
export const eq = (c, v) => ({ __c: c, __op: '=', __v: v });
export const ne = (c, v) => ({ __c: c, __op: '!=', __v: v });
export const gt = (c, v) => ({ __c: c, __op: '>', __v: v });
export const lt = (c, v) => ({ __c: c, __op: '<', __v: v });
export const gte = (c, v) => ({ __c: c, __op: '>=', __v: v });
export const lte = (c, v) => ({ __c: c, __op: '<=', __v: v });
export const and = (...ps) => ({ __and: ps.filter(Boolean) });
export const or = (...ps) => ({ __or: ps.filter(Boolean) });
export const not = (p) => ({ __not: p });
export const inArray = (c, arr) => ({ __c: c, __in: arr && arr.length ? arr : [null] });
export const isNull = (c) => ({ __c: c, __null: true });
export const isNotNull = (c) => ({ __c: c, __notnull: true });
export const desc = (c) => ({ __c: c, __dir: 'DESC' });
export const asc = (c) => ({ __c: c, __dir: 'ASC' });
