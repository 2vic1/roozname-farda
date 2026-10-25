// ─── تیک سبک ۳۰ ثانیه‌ای: قیمت‌های لحظه‌ای + چرخش منابع خبری + بروزرسانی ریسک ───
// سبک است: یک درخواست دسته‌ای تریدینگ‌ویو + ۶ منبع خبری چرخشی + محاسبه ریسک
// اجرای کامل بات‌ها (گزارش هوش مصنوعی/پرواز/الگوها) فقط با دکمه «بروزرسانی» است
import { NextResponse } from 'next/server'
import { runMarketFastQuotes, runNewsTick, enrichNewsWithAi, translatePendingNews } from '@/lib/bots'
import { computeAndStoreRisk } from '@/lib/risk'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [market, news] = await Promise.allSettled([
      runMarketFastQuotes(),
      runNewsTick(),
    ])
    // غنی‌سازی/ترجمه فقط اگر آیتم تازه آمده — سبک نگه داشتن تیک
    let enriched = 0
    if (news.status === 'fulfilled' && news.value.items > 0) {
      try {
        const r = await enrichNewsWithAi()
        enriched = r.items
        await translatePendingNews()
      } catch {
        // اختیاری
      }
    }
    // ریسک روز با داده تازه دوباره محاسبه شود
    let risk: number | null = null
    try {
      const r = await computeAndStoreRisk()
      risk = r.score
    } catch {
      // ریسک قبلی می‌ماند
    }
    return NextResponse.json({
      ok: true,
      market: market.status === 'fulfilled' ? market.value.items : 0,
      news: news.status === 'fulfilled' ? news.value.items : 0,
      newsSources: news.status === 'fulfilled' ? news.value.sources : [],
      enriched,
      risk,
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
