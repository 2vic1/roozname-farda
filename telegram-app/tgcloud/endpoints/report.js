// ─── endpoint: گزارش هوش مصنوعی — ترمز ۲۰ دقیقه + جهش ≥۸ امتیاز = تولید فوری ───
import { db } from 'sdk';
import { desc } from 'sdk/db';
import { newsItem, assetSnapshot, riskDaily, report, setting } from '../schema.js';
import { computeRisk, getTodayRisk, riskTextFa } from '../lib/risk.js';
import { aiReady, aiChat } from '../lib/ai.js';
import { jalaliFa } from '../lib/util.js';

const THROTTLE_MS = 20 * 60 * 1000; // ۲۰ دقیقه
const JUMP = 8;

export default async function (input) {
  const force = !!input?.force;
  const risk = await computeRisk(db, { riskDaily, assetSnapshot, newsItem });
  const last = await db.select().from(report).orderBy(desc(report.generatedAt)).limit(1).get();

  const fresh =
    last && new Date(last.generatedAt).getTime() > Date.now() - THROTTLE_MS;
  const jumped = !!last && Math.abs(risk.score - last.riskScore) >= JUMP;

  if (last && fresh && !force && !jumped) {
    return { ok: true, cached: true, contentFa: last.contentFa, riskScore: last.riskScore, generatedAt: last.generatedAt };
  }

  if (!(await aiReady(db, setting))) {
    return {
      ok: false,
      needsKey: true,
      hint: 'کلید هوش مصنوعی تنظیم نشده — در چت بات: /setkey sk-...',
      riskText: riskTextFa(risk),
    };
  }

  // نمونه اخبار برای زمینه
  const { desc: d, and, gte, ne, eq } = await import('sdk/db');
  const since = new Date(Date.now() - 86400000);
  const recent = (
    await db
      .select({ title: newsItem.title, t: newsItem.tensionScore })
      .from(newsItem)
      .where(and(gte(newsItem.publishedAt, since), ne(newsItem.aiVerdict, 'irrelevant'), eq(newsItem.isAd, false)))
      .orderBy(d(newsItem.publishedAt))
      .limit(25)
      .all()
  )
    .map((n) => `- (${n.t}) ${n.title}`)
    .join('\n');

  const assets = (await db.select().from(assetSnapshot).all())
    .map((a) => `${a.name}: ${a.price} (${a.change1d >= 0 ? '+' : ''}${a.change1d}%)`)
    .join(' | ');

  const content = await aiChat(
    db,
    setting,
    [
      {
        role: 'system',
        content:
          'تو تحلیلگر ارشد جنگ و بازار هستی. فقط فارسی روان و خلاصه بنویس. فقط از منابع خارجی (نه رسانه رسمی ایران) استناد کن. ساختار پاسخ: ۱) وضعیت تنش ۲) سیگنال‌های بازار ۳) اخبار کلیدی ۴) ۴ تاریخ حمله (نزدیک‌ترین/میانه/دورترین/محتمل‌ترین با قضاوت نهایی) ۵) یک جمله هشدار.',
      },
      {
        role: 'user',
        content:
          `امتیاز تنش امروز: ${risk.score}/100 (${risk.level})\n` +
          `تاریخ امروز: ${jalaliFa(new Date())}\n` +
          `بازارها: ${assets}\n\n` +
          `اخبار ۲۴ ساعت اخیر (امتیاز تنش در پرانتز):\n${recent || 'خبری نیست'}\n\n` +
          `گزارش تحلیلی امروز را با همان ساختار بنویس. تاریخ‌ها را شمسی بده (تا ۱۴ روز آینده).`,
      },
    ],
    1400
  );

  // استخراج ساده ۴ تاریخ از متن (فقط اگر مدل تاریخ شمسی/میلادی بنویسد — fallback: هیچ)
  const row = {
    riskScore: risk.score,
    contentFa: content,
    generatedAt: new Date(),
  };
  await db.insert(report).values(row).run();

  return { ok: true, cached: false, contentFa: content, riskScore: risk.score, generatedAt: row.generatedAt };
}
