import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tehranDateStr, daysBetween, addDays } from '@/lib/tehran'
import { getWarIndex } from '@/lib/war-astro'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const today = tehranDateStr()
    const [
      riskToday,
      history,
      news,
      hotNews,
      assets,
      metrics,
      cycles,
      lastFlight,
      outcomes,
      report,
      botRuns,
      sources,
      refEvents,
      macroPatterns,
    ] = await Promise.all([
      db.riskDaily.findUnique({ where: { date: today } }),
      db.riskDaily.findMany({
        where: { date: { gte: tehranStr(addDays(new Date(), -45)) } },
        orderBy: { date: 'asc' },
      }),
      db.newsItem.findMany({
        orderBy: { publishedAt: 'desc' },
        take: 80,
        select: {
          id: true,
          sourceType: true,
          sourceLabel: true,
          title: true,
          textFa: true,
          aiVerdict: true,
          isAd: true,
          isOpinion: true,
          url: true,
          lang: true,
          publishedAt: true,
          tensionScore: true,
          level: true,
          keywords: true,
        },
      }),
      db.newsItem.findMany({
        where: { publishedAt: { gte: new Date(Date.now() - 48 * 3600e3) } },
        orderBy: { tensionScore: 'desc' },
        take: 10,
        select: {
          id: true,
          sourceType: true,
          sourceLabel: true,
          title: true,
          textFa: true,
          aiVerdict: true,
          isAd: true,
          isOpinion: true,
          url: true,
          lang: true,
          publishedAt: true,
          tensionScore: true,
          level: true,
          keywords: true,
        },
      }),
      db.assetSnapshot.findMany(),
      db.macroMetric.findMany(),
      db.cycle.findMany({
        where: { date: { gte: today } },
        orderBy: { date: 'asc' },
        take: 18,
      }),
      db.flightSnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
      db.riskDaily.findMany({
        where: { date: { gte: tehranStr(addDays(new Date(), -60)) } },
        select: { date: true, outcome: true, outcomeNote: true },
        orderBy: { date: 'desc' },
      }),
      db.report.findFirst({ orderBy: { createdAt: 'desc' } }),
      db.botRun.findMany({ orderBy: { createdAt: 'desc' }, take: 12 }),
      db.source.findMany({ orderBy: [{ active: 'desc' }, { type: 'asc' }] }),
      db.refEvent.findMany(),
      db.macroPattern.findMany({ orderBy: { similarity: 'desc' }, take: 6 }),
    ])

    // آمار یادگیری از اشتباهات
    const hit = outcomes.filter((o) => o.outcome === 'hit').length
    const miss = outcomes.filter((o) => o.outcome === 'miss').length
    const pending = outcomes.filter((o) => o.outcome === 'pending').length
    const aiAccuracy = {
      total: outcomes.length,
      hit,
      miss,
      pending,
      hitRate: hit + miss > 0 ? Math.round((hit / (hit + miss)) * 100) : 0,
      lastMistakes: outcomes
        .filter((o) => o.outcome === 'miss')
        .slice(0, 5)
        .map((o) => ({ date: o.date, note: o.outcomeNote ?? '', outcome: o.outcome })),
    }

    // پروازها — فقط لحظه‌نگاشت تازه (حداکثر ۹۰ دقیقه)
    const flightFresh =
      lastFlight && Date.now() - lastFlight.createdAt.getTime() < 90 * 60000
        ? lastFlight
        : null

    // شاخص استرولوزی جنگ — خرابی آن هرگز دشبرد را نمی‌شکند
    let warAstro: { index: number; note: string; parts: { label: string; value: number; share: number }[] } | null = null
    try {
      const wi = getWarIndex()
      warAstro = { index: wi.index, note: wi.note, parts: wi.parts }
    } catch {
      warAstro = null
    }

    return NextResponse.json({
      ok: true,
      today,
      serverTime: new Date().toISOString(),
      warAstro,
      risk: riskToday
        ? {
            ...riskToday,
            forecast: JSON.parse(riskToday.forecast || '[]'),
            detail: JSON.parse(riskToday.detail || '{}'),
          }
        : null,
      history,
      news,
      hotNews,
      assets,
      metrics: metrics.map((m) => ({
        ...m,
        extra: JSON.parse(m.extra || '{}'),
      })),
      cycles: cycles.map((c) => ({ ...c, daysLeft: daysBetween(today, c.date) })),
      flights: flightFresh
        ? { ...flightFresh, details: JSON.parse(flightFresh.details || '[]') }
        : null,
      aiAccuracy,
      refEvents,
      report,
      botRuns,
      sources,
      patterns: macroPatterns.map((p) => ({
        eventKey: p.eventKey,
        eventName: p.eventName,
        similarity: p.similarity,
        score: p.score,
        windowLo: p.windowLo,
        windowHi: p.windowHi,
        note: p.note,
        updatedAt: p.updatedAt,
      })),
    })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}

function tehranStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}
