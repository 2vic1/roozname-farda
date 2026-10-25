import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tehranDateStr } from '@/lib/tehran'
import { forecastAssetMeta, computeForecast, type ForecastPayload } from '@/lib/market-forecast'

export const dynamic = 'force-dynamic'

// کش ساعتی هر نماد — محاسبه سنگین (ephs + fetch تاریخچه) تکرار نمی‌شود
const cache = new Map<string, { at: number; payload: ForecastPayload }>()
const TTL_MS = 60 * 60000

export async function GET(req: Request) {
  const url = new URL(req.url)
  const symbol = url.searchParams.get('symbol') ?? 'BTCUSDT'
  const force = url.searchParams.get('force') === '1'

  const asset = forecastAssetMeta(symbol)
  if (!asset) {
    return NextResponse.json(
      { ok: false, error: 'نماد قابل پیش‌بینی نیست — نمادهای مجاز: BTCUSDT، ETHUSDT، NVDA، ^GSPC' },
      { status: 400 },
    )
  }

  const cached = cache.get(symbol)
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.payload)
  }

  try {
    const payload = await computeForecast(asset)
    cache.set(symbol, { at: Date.now(), payload })

    // ثبت تماس‌های کلیدی + مسیر روزانه برای دقت‌سنجی بعدی — خرابی DB مسیر را نمی‌شکند
    try {
      const runDate = tehranDateStr()
      const rows = [
        ...payload.technical.calls.map((c) => ({ method: 'technical', c })),
        ...payload.cycles.calls.map((c) => ({ method: 'cycles', c })),
        ...payload.astro.calls.map((c) => ({ method: 'astro', c })),
        ...payload.fusion.calls.map((c) => ({ method: 'fusion', c })),
      ]
      for (const { method, c } of rows) {
        await db.marketForecast.upsert({
          where: {
            symbol_method_kind_runDate: {
              symbol: payload.symbol,
              method,
              kind: c.kind,
              runDate,
            },
          },
          create: {
            symbol: payload.symbol,
            method,
            kind: c.kind,
            runDate,
            targetDate: c.date,
            price: Math.round(c.price * 100) / 100,
            note: c.note,
          },
          update: {
            targetDate: c.date,
            price: Math.round(c.price * 100) / 100,
            note: c.note,
          },
        })
      }
      // مسیر روزانه ۳۰روزه هر روش — هر روز کندل واقعی کنار همین مسیر می‌نشیند
      const pathRows = [
        { method: 'technical', path: payload.technical.path },
        { method: 'cycles', path: payload.cycles.path },
        { method: 'astro', path: payload.astro.path },
        { method: 'fusion', path: payload.fusion.path },
      ]
      for (const { method, path } of pathRows) {
        await db.marketForecastPath.upsert({
          where: {
            symbol_method_runDate: { symbol: payload.symbol, method, runDate },
          },
          create: {
            symbol: payload.symbol,
            method,
            runDate,
            lastClose: payload.price,
            pathJson: JSON.stringify(path),
          },
          update: { lastClose: payload.price, pathJson: JSON.stringify(path) },
        })
      }
    } catch {
      // ثبت دقت‌سنجی اختیاری است
    }

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'خطای موتور پیش‌بینی' },
      { status: 500 },
    )
  }
}
