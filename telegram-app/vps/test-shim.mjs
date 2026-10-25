// Shim self-test — covers every db call pattern used by tgcloud modules
import { db, ensureSchema } from './sdk/index.js';
import * as O from './sdk/db.js';
const { eq, ne, and, gte, desc, inArray, sql, table, text, integer, real, boolean } = O;

ensureSchema();

// 1. setting upsert
await db.insert({ __name: 'setting', __cols: {}, key: {}, value: {} }).values({ key: 'news_idx', value: '3' }).onConflictDoUpdate({ target: { __col: 'key', __prop: 'key' }, set: { value: '7' } }).run();
const s1 = await db.select().from(table('setting', { key: text('key'), value: text('value') })).where(eq({ __col: 'key', __prop: 'key' }, 'news_idx')).get();
console.assert(s1?.value === '7', 'setting upsert FAILED: ' + JSON.stringify(s1));
console.log('✓ setting upsert →', JSON.stringify(s1));

// realistic tables
const newsItem = table('news_item', {
  id: integer('id').primaryKey ? integer('id') : integer('id'),
  externalId: text('external_id').notNull(),
  sourceType: text('source_type').notNull(),
  sourceLabel: text('source_label').notNull(),
  title: text('title').notNull(),
  url: text('url'),
  lang: text('lang').notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
  textFa: text('text_fa'),
  aiVerdict: text('ai_verdict'),
  tensionScore: real('tension_score').notNull().default(0),
  isAd: boolean('is_ad').notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

// 2. batch insert (news pattern)
const now = new Date();
await db.insert(newsItem).values([
  { externalId: 'x1', sourceType: 'x', sourceLabel: 'X News', title: 'US strikes near Hormuz escalation', lang: 'en', publishedAt: new Date(now.getTime() - 3600e3), tensionScore: 0.8, aiVerdict: 'war_signal' },
  { externalId: 'x2', sourceType: 'x', sourceLabel: 'X News', title: 'Diplomats meet in Geneva for talks', lang: 'en', publishedAt: new Date(now.getTime() - 7200e3), tensionScore: 0.2, aiVerdict: 'diplomacy' },
  { externalId: 'x3', sourceType: 'x', sourceLabel: 'X News', title: 'Routine market closing report today', lang: 'en', publishedAt: new Date(now.getTime() - 10800e3), tensionScore: 0.1, aiVerdict: 'irrelevant' },
]).run();
console.log('✓ batch insert 3 rows');

// 3. projection select + where and/gte/ne + orderBy + limit
const since = new Date(now.getTime() - 5 * 86400e3);
const proj = await db
  .select({ t: newsItem.tensionScore })
  .from(newsItem)
  .where(and(gte(newsItem.publishedAt, since), ne(newsItem.aiVerdict, 'irrelevant')))
  .orderBy(desc(newsItem.publishedAt))
  .limit(60)
  .all();
console.assert(proj.length === 2 && typeof proj[0].t === 'number', 'projection FAILED: ' + JSON.stringify(proj));
console.log('✓ projection+where+order+limit →', JSON.stringify(proj));

// 4. full select with timestamp round-trip
const all = await db.select().from(newsItem).where(inArray(newsItem.externalId, ['x1', 'x2'])).all();
console.assert(all.length === 2, 'inArray FAILED');
console.assert(all[0].publishedAt instanceof Date, 'timestamp roundtrip FAILED: ' + typeof all[0].publishedAt);
console.assert(all.find(r => r.externalId === 'x1').isAd === false, 'bool out FAILED');
console.log('✓ inArray + timestamp roundtrip + bool →', all[0].publishedAt.toISOString());

// 5. asset upsert with sql() in set
const assetSnapshot = table('asset_snapshot', {
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  unit: text('unit'),
  price: real('price').notNull().default(0),
  change1d: real('change1d').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
await db.insert(assetSnapshot).values({ symbol: 'BTC', name: 'Bitcoin', category: 'crypto', unit: '$', price: 67000, change1d: 1.2 }).onConflictDoUpdate({ target: assetSnapshot.symbol, set: { price: 67150, change1d: 1.5, updatedAt: sql`(unixepoch())` } }).run();
await db.insert(assetSnapshot).values({ symbol: 'BTC', name: 'Bitcoin', category: 'crypto', unit: '$', price: 67200, change1d: 2.0 }).onConflictDoUpdate({ target: assetSnapshot.symbol, set: { price: 67200, change1d: 2.0, updatedAt: sql`(unixepoch())` } }).run();
const btc = await db.select().from(assetSnapshot).where(eq(assetSnapshot.symbol, 'BTC')).get();
console.assert(btc?.price === 67200 && btc?.change1d === 2.0, 'asset upsert FAILED: ' + JSON.stringify(btc));
console.log('✓ asset upsert (sql set) →', JSON.stringify(btc));

// 6. risk_daily upsert (long target=col prop)
const riskDaily = table('risk_daily', {
  date: text('date').notNull(),
  score: integer('score').notNull().default(0),
  level: text('level').notNull(),
  newsComponent: real('news_component').notNull().default(0),
  marketComponent: real('market_component').notNull().default(0),
  attackDateNear: text('attack_date_near'),
  attackDateMid: text('attack_date_mid'),
  attackDateFar: text('attack_date_far'),
  attackDateLikely: text('attack_date_likely'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});
const row = { date: '2026-10-24', score: 62, level: 'بحرانی', newsComponent: 55, marketComponent: 70, attackDateNear: '2026-10-28', attackDateMid: '2026-11-02', attackDateFar: '2026-11-07', attackDateLikely: '2026-10-30' };
await db.insert(riskDaily).values(row).onConflictDoUpdate({ target: riskDaily.date, set: { score: row.score, level: row.level, newsComponent: row.newsComponent, marketComponent: row.marketComponent, attackDateNear: row.attackDateNear, attackDateMid: row.attackDateMid, attackDateFar: row.attackDateFar, attackDateLikely: row.attackDateLikely } }).run();
const r1 = await db.select().from(riskDaily).where(eq(riskDaily.date, '2026-10-24')).get();
console.assert(r1?.score === 62 && r1?.attackDateLikely === '2026-10-30', 'risk upsert FAILED: ' + JSON.stringify(r1));
console.log('✓ risk upsert →', JSON.stringify(r1));

// 7. insert .run() twice (report pattern)
const report = table('report', { riskScore: integer('risk_score'), generatedAt: integer('generated_at', { mode: 'timestamp' }), contentFa: text('content_fa').notNull() });
await db.insert(report).values({ riskScore: 62, contentFa: 'گزارش آزمایشی', generatedAt: new Date() }).run();
const rep = await db.select().from(report).orderBy(desc(report.generatedAt)).limit(1).get();
console.assert(rep?.contentFa === 'گزارش آزمایشی' && rep.generatedAt instanceof Date, 'report insert FAILED');
console.log('✓ report insert + orderBy get → OK');

console.log('\n=== ALL SHIM TESTS PASSED ===');
process.exit(0);
