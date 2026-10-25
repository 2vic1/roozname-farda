// ─── موتور ریسک ترکیبی v1 (همان وزن‌های تأییدشده کاربر) ───
// اخبار ۳۲٪ + بازارها ۲۲٪ + پروازهای نظامی ۲۰٪ + الگوهای کلان ۱۳٪ + چرخه‌ها ۱۳٪
// v1: پرواز/کلان/چرخه = مقدار خنثی ۵۰ (پورت کاملشان در فاز بعد) — وابسته به همان رفتار وب
import { ymd, addDays, jalaliFa } from './util.js';

const WEIGHTS = { news: 0.32, market: 0.22, flights: 0.2, macro: 0.13, cycles: 0.13 };

function levelOf(score) {
  if (score >= 80) return 'آماده‌باش';
  if (score >= 60) return 'خطر جدی';
  if (score >= 45) return 'بحرانی';
  if (score >= 25) return 'پرتنش';
  return 'آرام';
}

/** مؤلفه بازار: انحراف تغییرات نفت/طلا/VIX → 0..100 */
function marketStress(assets) {
  const bySym = Object.fromEntries(assets.map((a) => [a.symbol, a]));
  let s = 30;
  const bz = Math.abs(bySym['BZ=F']?.change1d ?? 0);
  const gc = Math.abs(bySym['GC=F']?.change1d ?? 0);
  const vix = bySym['^VIX']?.price ?? 15;
  const vixChg = Math.abs(bySym['^VIX']?.change1d ?? 0);
  s += Math.min(25, bz * 6); // جهش نفت
  s += Math.min(20, gc * 5); // جهش طلا
  s += Math.min(25, Math.max(0, (vix - 18) * 1.8)); // ترس بازار سهام
  s += Math.min(10, vixChg * 2);
  return Math.max(0, Math.min(100, Math.round(s)));
}

/** مؤلفه اخبار: میانگین وزنی تنش اخبار ۲۴ ساعت اخیر → 0..100 */
async function newsComponent(db, newsItem) {
  const { desc, gte, and, ne } = await import('sdk/db');
  const since = addDays(new Date(), -2);
  const rows = await db
    .select({ t: newsItem.tensionScore })
    .from(newsItem)
    .where(and(gte(newsItem.publishedAt, since), ne(newsItem.aiVerdict, 'irrelevant')))
    .orderBy(desc(newsItem.publishedAt))
    .limit(60)
    .all();
  if (!rows.length) return 30; // سکوت خبری ≠ صفر (طبق منطق وب)
  const vals = rows.map((r) => r.t ?? 0).sort((a, b) => b - a);
  let acc = 0;
  vals.forEach((v, i) => (acc += v * Math.pow(0.94, i)));
  const avg = acc / vals.length;
  return Math.max(0, Math.min(100, Math.round(avg * 1.6)));
}

/** محاسبه + ذخیره ریسک امروز با ۴ تاریخ حمله */
export async function computeRisk(db, tables) {
  const { riskDaily, assetSnapshot, newsItem } = tables;
  const { eq, sql, desc } = await import('sdk/db');

  const assets = (await db.select().from(assetSnapshot).all()).map((r) => ({
    symbol: r.symbol,
    change1d: r.change1d,
    price: r.price,
  }));
  const newsC = await newsComponent(db, newsItem);
  const marketC = marketStress(assets);

  // v1: سه مؤلفه دیگر خنثی (۵۰) — یعنی سهمشان فقط «بایاس ثابت» است نه نویز
  const flightsC = 50;
  const macroC = 50;
  const cyclesC = 50;

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        newsC * WEIGHTS.news +
          marketC * WEIGHTS.market +
          flightsC * WEIGHTS.flights +
          macroC * WEIGHTS.macro +
          cyclesC * WEIGHTS.cycles
      )
    )
  );

  // ۴ تاریخ: هرچه امتیاز بالاتر، پنجره نزدیک‌تر (هیوریستیک v1؛ فاز بعد = یادگیری خطا)
  const now = new Date();
  const horizon = Math.max(2, Math.round(14 - (score / 100) * 11)); // 14 روز → 3 روز
  const near = addDays(now, Math.max(1, Math.round(horizon * 0.25)));
  const mid = addDays(now, Math.max(2, Math.round(horizon * 0.55)));
  const far = addDays(now, horizon);
  const likely = addDays(now, Math.max(1, Math.round(horizon * (score >= 65 ? 0.3 : score >= 45 ? 0.45 : 0.7))));
  const today = ymd(now);
  const row = {
    date: today,
    score,
    level: levelOf(score),
    newsComponent: newsC,
    marketComponent: marketC,
    attackDateNear: ymd(near),
    attackDateMid: ymd(mid),
    attackDateFar: ymd(far),
    attackDateLikely: ymd(likely),
  };
  await db
    .insert(riskDaily)
    .values(row)
    .onConflictDoUpdate({
      target: riskDaily.date,
      set: {
        score: row.score,
        level: row.level,
        newsComponent: row.newsComponent,
        marketComponent: row.marketComponent,
        attackDateNear: row.attackDateNear,
        attackDateMid: row.attackDateMid,
        attackDateFar: row.attackDateFar,
        attackDateLikely: row.attackDateLikely,
      },
    })
    .run();
  return row;
}

/** خواندن ریسک امروز (بدون محاسبه) */
export async function getTodayRisk(db, riskDaily) {
  const { eq } = await import('sdk/db');
  return db.select().from(riskDaily).where(eq(riskDaily.date, ymd(new Date()))).get();
}

/** متن فارسی وضعیت برای چت */
export function riskTextFa(r) {
  const d = (s) => (s ? jalaliFa(new Date(s + 'T00:00:00Z')) : '—');
  return (
    `🎯 محتمل‌ترین روز حمله: ${d(r.attackDateLikely)}\n` +
    `◀️ نزدیک‌ترین: ${d(r.attackDateNear)}\n` +
    `▶️ میانه: ${d(r.attackDateMid)}\n` +
    `🔴 دورترین: ${d(r.attackDateFar)}\n\n` +
    `📊 امتیاز تنش امروز: ${r.score}/100 — وضعیت: ${r.level}`
  );
}
