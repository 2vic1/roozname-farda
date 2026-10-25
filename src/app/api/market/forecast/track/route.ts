import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  forecastAssetMeta,
  fetchForecastHistory,
  forecastCandles,
  buildTrackDays,
  summarizeTrack,
  computeBacktest,
  type PathPoint,
  type MethodKey4,
  type MethodTrack,
  type CandlePoint,
} from '@/lib/market-forecast'

export const dynamic = 'force-dynamic'

// دقت‌سنجی زنده: مسیر ذخیره‌شده + روزهای واقعی رسیده + بک‌تست ۳۰روزه
const cache = new Map<string, { at: number; payload: TrackResponse }>()
const TTL_MS = 10 * 60000

interface SavedRunInfo {
  runDate: string
  methods: Partial<Record<MethodKey4, MethodTrack>>
}

export interface TrackResponse {
  ok: true
  symbol: string
  name: string
  unit: string
  price: number
  priceDate: string
  history: CandlePoint[] // ۷۰ کندل واقعی اخیر
  savedRun: SavedRunInfo | null // آخرین پیش‌بینی ثبت‌شده در دیتابیس + روزهای واقعی رسیده
  backtest: Awaited<ReturnType<typeof computeBacktest>> // آزمون گذشته: پیش‌بینی ۳۰روز قبل vs واقعیت
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const symbol = url.searchParams.get('symbol') ?? 'BTCUSDT'
  const force = url.searchParams.get('force') === '1'

  const asset = forecastAssetMeta(symbol)
  if (!asset) {
    return NextResponse.json({ ok: false, error: 'نماد مجاز نیست' }, { status: 400 })
  }

  const cached = cache.get(symbol)
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.payload)
  }

  try {
    const series = await fetchForecastHistory(asset)
    const last = series[series.length - 1]

    // ── آخرین مسیر ذخیره‌شده (هر روش هم‌زمان ذخیره می‌شود — بزرگ‌ترین runDate) ──
    let savedRun: SavedRunInfo | null = null
    try {
      const latest = await db.marketForecastPath.findFirst({
        where: { symbol },
        orderBy: { runDate: 'desc' },
      })
      if (latest) {
        const rows = await db.marketForecastPath.findMany({
          where: { symbol, runDate: latest.runDate },
        })
        const methods: Partial<Record<MethodKey4, MethodTrack>> = {}
        for (const row of rows) {
          let path: PathPoint[] = []
          try {
            path = JSON.parse(row.pathJson) as PathPoint[]
          } catch {
            continue
          }
          if (!Array.isArray(path) || path.length === 0) continue
          const candles = forecastCandles(path, row.lastClose)
          // فقط روزهایی که واقعاً رسیده‌اند: بین اولین و آخرین روز مسیر
          const arrived = series.filter(
            (s) => s.date >= path[0].date && s.date <= path[path.length - 1].date,
          )
          methods[row.method as MethodKey4] = summarizeTrack(
            path,
            candles,
            buildTrackDays(path, arrived),
          )
        }
        savedRun = { runDate: latest.runDate, methods }
      }
    } catch {
      savedRun = null
    }

    // ── بک‌تست: اگر ۳۰ روز معاملاتی قبل اجرا می‌شد — بدون دیتابیس، همیشه موجود ──
    let backtest: Awaited<ReturnType<typeof computeBacktest>> = null
    try {
      backtest = await computeBacktest(asset, 30)
    } catch {
      backtest = null
    }

    const payload: TrackResponse = {
      ok: true,
      symbol,
      name: asset.name,
      unit: asset.unit,
      price: last.close,
      priceDate: last.date,
      history: series.slice(-70).map((s) => ({
        date: s.date,
        open: Math.round(s.open * 100) / 100,
        high: Math.round(s.high * 100) / 100,
        low: Math.round(s.low * 100) / 100,
        close: Math.round(s.close * 100) / 100,
        forecast: false,
      })),
      savedRun,
      backtest,
    }
    cache.set(symbol, { at: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'خطای موتور دقت‌سنجی' },
      { status: 500 },
    )
  }
}
