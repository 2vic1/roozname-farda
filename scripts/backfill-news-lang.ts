// ─── اسکریپت نگهداری: اصلاح زبان خبرها + ترجمه عقب‌مانده‌ها ───
// اجرا: bun scripts/backfill-news-lang.ts
// ۱) زبان ذخیره‌شده همه خبرها بر اساس متن واقعی بازبینی می‌شود (منبع «فارسی» با متن عربی/چینی و...)
// ۲) translatePendingNews تا خالی شدن صف تکرار می‌شود (هر دور حداکثر ۳۰ خبر)
import { db } from '@/lib/db'
import { detectLang } from '@/lib/lang'
import { translatePendingNews } from '@/lib/bots'

async function main() {
  const all = await db.newsItem.findMany({ select: { id: true, title: true, lang: true } })
  let fixed = 0
  for (const n of all) {
    const real = detectLang(n.title)
    if (real !== n.lang) {
      await db.newsItem.update({ where: { id: n.id }, data: { lang: real } })
      fixed++
    }
  }
  console.log(`✅ زبان اصلاح‌شده: ${fixed} از ${all.length}`)

  for (let round = 1; round <= 6; round++) {
    const r = await translatePendingNews()
    console.log(`🌐 دور ${round} ترجمه: ${r.items} خبر`)
    if (r.items === 0) break
  }

  const remaining = await db.newsItem.count({
    where: { textFa: null, isAd: false, aiVerdict: { not: 'irrelevant' }, publishedAt: { gte: new Date(Date.now() - 3 * 86400000) } },
  })
  console.log(`📊 باقی‌مانده بدون ترجمه (۳ روز اخیر): ${remaining}`)
}

main()
  .catch((e) => {
    console.error('خطا:', e)
    process.exitCode = 1
  })
  .finally(() => process.exit(0))
