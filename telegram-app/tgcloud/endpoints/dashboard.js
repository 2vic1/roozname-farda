// ─── endpoint: همه داده‌های داشبورد (فرانت با Serverless.call صدا میزند) ───
import { db } from 'sdk';
import { desc, and, gte, ne, eq } from 'sdk/db';
import { newsItem, assetSnapshot, riskDaily, report } from '../schema.js';
import { getTodayRisk } from '../lib/risk.js';
import { addDays, jalaliFa, ymd } from '../lib/util.js';

export default async function () {
  const risk = await getTodayRisk(db, riskDaily);

  // آخرین گزارش
  const lastReport = await db.select().from(report).orderBy(desc(report.generatedAt)).limit(1).get();

  // ۵۰ خبر مرتبط آخر (غیرتبلیغ، غیرنامرتبط)
  const since = addDays(new Date(), -7);
  const news = (
    await db
      .select()
      .from(newsItem)
      .where(and(gte(newsItem.publishedAt, since), ne(newsItem.aiVerdict, 'irrelevant'), eq(newsItem.isAd, false)))
      .orderBy(desc(newsItem.publishedAt))
      .limit(50)
      .all()
  ).map((n) => ({
    id: n.id,
    title: n.title,
    textFa: n.textFa,
    lang: n.lang,
    url: n.url,
    source: n.sourceLabel,
    verdict: n.aiVerdict,
    tension: n.tensionScore,
    publishedAt: n.publishedAt,
  }));

  const assets = (await db.select().from(assetSnapshot).all()).map((a) => ({
    symbol: a.symbol,
    name: a.name,
    category: a.category,
    unit: a.unit,
    price: a.price,
    change1d: a.change1d,
  }));

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    todayFa: jalaliFa(new Date()),
    risk: risk
      ? {
          score: risk.score,
          level: risk.level,
          newsComponent: risk.newsComponent,
          marketComponent: risk.marketComponent,
          attackDateNear: risk.attackDateNear,
          attackDateMid: risk.attackDateMid,
          attackDateFar: risk.attackDateFar,
          attackDateLikely: risk.attackDateLikely,
        }
      : null,
    report: lastReport
      ? {
          contentFa: lastReport.contentFa,
          riskScore: lastReport.riskScore,
          generatedAt: lastReport.generatedAt,
          near: lastReport.nearDate,
          mid: lastReport.midDate,
          far: lastReport.farDate,
          likely: lastReport.likelyDate,
        }
      : null,
    news,
    assets,
  };
}
