// ─── موتور محاسبه ریسک: ترکیب خبر + بازار + چرخه‌ها + پرواز + الگوهای کلان تاریخی ───
import { db } from '@/lib/db'
import { tehranDateStr, addDays, daysBetween } from '@/lib/tehran'
import { cyclePressureForDate, todayStr } from '@/lib/cycles'
import { levelFromScore } from '@/lib/tension'
import { storeMacroPatterns } from '@/lib/patterns'

export interface RiskParts {
  news: number
  market: number
  cycle: number
  flight: number
  pattern: number
  composite: number
  detail: Record<string, unknown>
}

// امتیاز خبری: میانگین وزنی اخبار ۴۸ ساعت با افت زمانی + ضریب حجم
export function computeNewsScore(
  items: Array<{ tensionScore: number; publishedAt: Date }>,
  now: Date = new Date()
): number {
  const recent = items.filter((i) => now.getTime() - i.publishedAt.getTime() <= 48 * 3600e3)
  if (!recent.length) return 18
  let wsum = 0
  let sum = 0
  for (const it of recent) {
    const ageH = (now.getTime() - it.publishedAt.getTime()) / 3600e3
    const w = Math.exp(-ageH / 18)
    sum += it.tensionScore * w
    wsum += w
  }
  const raw = wsum > 0 ? sum / wsum : 0
  const volumeBoost = 1 + Math.min(0.25, recent.length / 120)
  return Math.max(0, Math.min(100, Math.round(raw * volumeBoost)))
}

// امتیاز بازار: VIX، نفت، طلا، سهام، کریپتو، ترس‌وطمع
export function computeMarketScore(
  assets: Map<string, { price: number; change1d: number }>,
  metrics: Map<string, { value: number }>
): { score: number; parts: Record<string, number> } {
  const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))
  const get = (s: string) => assets.get(s)?.change1d ?? 0
  const priceOf = (s: string) => assets.get(s)?.price ?? 0

  const vix = priceOf('^VIX')
  const vixLevel = clamp(((vix - 12) / 30) * 100)
  const vixRise = clamp(get('^VIX') * 4)

  const oilChg = Math.max(get('CL=F'), get('BZ=F'))
  const oilStress = clamp(Math.max(0, oilChg) * 7) + (priceOf('CL=F') > 80 ? 12 : 0)
  const goldStress = clamp(Math.max(0, get('GC=F')) * 5) + (priceOf('GC=F') > 2600 ? 10 : 0)
  const equityStress = clamp(Math.max(0, -get('^GSPC') * 5) + Math.max(0, -get('^IXIC') * 4))
  const btcChg = get('BTCUSDT')
  const fng = metrics.get('fear_greed')?.value ?? 50
  const cryptoStress = clamp(Math.max(0, -btcChg * 4) + (100 - fng) * 0.35)

  const riskOffBonus =
    oilChg > 0.3 && get('^GSPC') < -0.3 ? 12 : 0

  const parts = {
    vix: Math.round(vixLevel * 0.3 + vixRise * 0.2),
    oil: Math.round(oilStress * 0.8),
    gold: Math.round(goldStress * 0.7),
    equity: equityStress,
    crypto: cryptoStress,
    riskOffBonus,
  }

  const score = Math.round(
    clamp(
      parts.vix * 0.25 +
        parts.oil * 0.25 +
        parts.gold * 0.15 +
        parts.equity * 0.2 +
        parts.crypto * 0.15 +
        riskOffBonus
    )
  )
  return { score, parts }
}

// محاسبه کامل و ذخیره ریسک امروز + پیش‌بینی ۱۴ روز
export async function computeAndStoreRisk(): Promise<{
  score: number
  level: string
  parts: RiskParts
}> {
  const now = new Date()
  const today = todayStr()

  const [news, assets, metrics, cycles, yesterday, lastFlight] = await Promise.all([
    db.newsItem.findMany({
      where: {
        publishedAt: { gte: addDays(now, -2) },
        isAd: false,
        isOpinion: false,
        aiVerdict: { not: 'irrelevant' },
      },
      select: { tensionScore: true, publishedAt: true },
    }),
    db.assetSnapshot.findMany(),
    db.macroMetric.findMany(),
    db.cycle.findMany({ select: { date: true, weight: true, label: true, family: true } }),
    db.riskDaily.findFirst({ where: { date: { lt: today } }, orderBy: { date: 'desc' } }),
    db.flightSnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
  ])

  // امتیاز پرواز: فقط اگر لحظه‌نگاشت تازه (حداکثر ۹۰ دقیقه) باشد
  const flightAgeMin = lastFlight
    ? (now.getTime() - lastFlight.createdAt.getTime()) / 60000
    : Infinity
  const flightScore =
    flightAgeMin <= 90 ? Math.min(100, lastFlight!.significance) : 0

  const assetMap = new Map(assets.map((a) => [a.symbol, { price: a.price, change1d: a.change1d ?? 0 }]))
  const metricMap = new Map(metrics.map((m) => [m.key, { value: m.value }]))

  const newsScore = computeNewsScore(news, now)
  const market = computeMarketScore(assetMap, metricMap)
  const cycleP = cyclePressureForDate(today, cycles)

  // الگوی کلان: تطبیق رفتار امروز بازار با امضای پیش از بحران‌های تاریخی
  // (مثلا: ریزش سنگین سهام + جهش نفت ← الگوی کلاسیک پیش از جنگ)
  const assetLite = assets.map((a) => ({
    symbol: a.symbol,
    price: a.price,
    change1d: a.change1d ?? 0,
    change7d: a.change7d ?? 0,
    change30d: a.change30d ?? 0,
  }))
  const pattern = await storeMacroPatterns(assetLite)

  // وزن‌ها: خبر .32 + بازار .22 + چرخه .13 + پرواز .20 + الگوی کلان .13
  const composite = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        newsScore * 0.32 +
          market.score * 0.22 +
          cycleP.score * 0.13 +
          flightScore * 0.2 +
          pattern.score * 0.13
      )
    )
  )
  const level = levelFromScore(composite)

  const trend =
    yesterday && composite - yesterday.score > 3
      ? 'up'
      : yesterday && composite - yesterday.score < -3
        ? 'down'
        : 'flat'

  // پیش‌بینی ۱۴ روز آینده: میانگین‌گرفتن به سمت پایه + فشار چرخه‌ای + ماندگاری کوتاه‌مدت الگوی کلان
  const baseNewsMarketFlight =
    newsScore * 0.4 + market.score * 0.3 + flightScore * 0.15 + pattern.score * 0.15
  const forecast: Array<{ date: string; score: number; level: string }> = []
  for (let i = 1; i <= 14; i++) {
    const dateStr = tehranDateStr(addDays(now, i))
    const decayed = 35 + (baseNewsMarketFlight - 35) * Math.exp(-i / 10)
    const cp = cyclePressureForDate(dateStr, cycles)
    // اثر الگوی کلان سریع فروکش می‌کند (پنجره‌های تاریخی ۱ تا ۶۰ روزه‌اند)
    const patternDecay = pattern.score * Math.exp(-i / 7)
    const s = Math.round(Math.max(0, Math.min(100, decayed * 0.66 + cp.score * 0.24 + patternDecay * 0.1)))
    forecast.push({ date: dateStr, score: s, level: levelFromScore(s) })
  }

  const nearest = cycles
    .filter((c) => daysBetween(today, c.date) >= 0 && daysBetween(today, c.date) <= 14)
    .sort((a, b) => daysBetween(today, a.date) - daysBetween(today, b.date))
    .slice(0, 5)

  const detail = {
    newsCount48h: news.length,
    marketParts: market.parts,
    cycleToday: cycleP,
    pattern: {
      score: pattern.score,
      bestSimilarity: pattern.bestSimilarity,
      window: pattern.window,
      current: pattern.current,
      regimeNotesFa: pattern.regimeNotesFa,
      top: pattern.matches.slice(0, 3).map((m) => ({
        eventKey: m.eventKey,
        eventName: m.eventName,
        similarity: m.similarity,
        windowLo: m.windowLo,
        windowHi: m.windowHi,
      })),
    },
    flight: lastFlight && flightAgeMin <= 90
      ? {
          nearIran: lastFlight.nearIran,
          nearestKm: lastFlight.nearestKm,
          significance: lastFlight.significance,
          tankers: lastFlight.tankers,
          fighters: lastFlight.fighters,
          recon: lastFlight.recon,
          ageMin: Math.round(flightAgeMin),
        }
      : null,
    nearestCycles: nearest,
  }

  await db.riskDaily.upsert({
    where: { date: today },
    create: {
      date: today,
      score: composite,
      level,
      trend,
      newsScore,
      marketScore: market.score,
      cycleScore: cycleP.score,
      flightScore,
      patternScore: pattern.score,
      forecast: JSON.stringify(forecast),
      detail: JSON.stringify(detail),
    },
    update: {
      score: composite,
      level,
      trend,
      newsScore,
      marketScore: market.score,
      cycleScore: cycleP.score,
      flightScore,
      patternScore: pattern.score,
      forecast: JSON.stringify(forecast),
      detail: JSON.stringify(detail),
    },
  })

  return {
    score: composite,
    level,
    parts: {
      news: newsScore,
      market: market.score,
      cycle: cycleP.score,
      flight: flightScore,
      pattern: pattern.score,
      composite,
      detail,
    },
  }
}
