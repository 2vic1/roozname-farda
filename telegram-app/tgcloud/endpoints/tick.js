// ─── endpoint: تیک سبک — بازار + گردش اخبار + محاسبه ریسک (هر ۳۰ ثانیه با اپ باز) ───
import { db } from 'sdk';
import { assetSnapshot, newsItem, riskDaily, setting } from '../schema.js';
import { refreshMarketQuotes } from '../lib/market.js';
import { newsTick } from '../lib/news.js';
import { computeRisk } from '../lib/risk.js';

export default async function (input) {
  const force = !!input?.force;
  const out = { ok: true, market: 0, news: 0, risk: null };

  const market = await Promise.allSettled([refreshMarketQuotes(db, assetSnapshot)]);
  if (market[0].status === 'fulfilled') out.market = market[0].value;

  const news = await Promise.allSettled([newsTick(db, { newsItem, setting })]);
  if (news[0].status === 'fulfilled') out.news = news[0].value.added;

  const risk = await computeRisk(db, { riskDaily, assetSnapshot, newsItem });
  out.risk = risk.score;
  out.level = risk.level;

  return out;
}
