// Test full business tick on server (no Telegram needed)
import { db, ensureSchema } from 'sdk';
ensureSchema();
const { newsTick } = await import('./tgcloud/lib/news.js');
const { refreshMarketQuotes } = await import('./tgcloud/lib/market.js');
const { computeRisk } = await import('./tgcloud/lib/risk.js');
const { assetSnapshot, newsItem, riskDaily, setting } = await import('./tgcloud/schema.js');

const t0 = Date.now();
const m = await refreshMarketQuotes(db, assetSnapshot).then((v) => `${v} assets`).catch((e) => 'ERR: ' + e.message);
const n = await newsTick(db, { newsItem, setting }).then((v) => `${v.added} news`).catch((e) => 'ERR: ' + e.message);
const r = await computeRisk(db, { riskDaily, assetSnapshot, newsItem }).then((v) => ({ score: v.score, level: v.level, near: v.attackDateNear, likely: v.attackDateLikely })).catch((e) => 'ERR: ' + e.message);
const counts = {
  assets: db.select().from(assetSnapshot).all().length,
  news: db.select().from(newsItem).limit(500).all().length,
};
console.log(JSON.stringify({ m, n, r, counts, ms: Date.now() - t0 }, null, 2));
process.exit(0);
