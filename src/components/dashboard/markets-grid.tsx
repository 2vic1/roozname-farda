'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TriangleAlert } from 'lucide-react'
import { CATEGORY_FA } from './types'
import type { AssetData, MetricData } from './types'
import { ForecastPanel } from './market-forecast'

function fmtPrice(n: number): string {
  if (n >= 1000) return Math.round(n).toLocaleString('en-US')
  if (n >= 10) return n.toFixed(2)
  return n.toFixed(4)
}

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return null
  const w = 110
  const h = 32
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`)
    .join(' ')
  const color = up ? '#10b981' : '#ef4444'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} />
    </svg>
  )
}

function ChangeBadge({ value, label }: { value: number | null; label: string }) {
  if (value === null || value === undefined) return null
  const up = value >= 0
  return (
    <Badge
      variant="outline"
      className={`gap-0.5 text-[10px] ${
        up
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
          : 'border-red-500/40 bg-red-500/10 text-red-400'
      }`}
      dir="ltr"
    >
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
      <span className="sr-only"> {label}</span>
    </Badge>
  )
}

function fngColor(v: number): string {
  if (v < 25) return '#ef4444'
  if (v < 45) return '#f97316'
  if (v < 56) return '#eab308'
  if (v < 76) return '#84cc16'
  return '#10b981'
}

// شبکه کارت‌های بازار + شناسایی الگوی Risk-Off
export function MarketsGrid({ assets, metrics }: { assets: AssetData[]; metrics: MetricData[] }) {
  const groups = useMemo(() => {
    const order = ['energy', 'metals', 'crypto', 'indices', 'risk']
    const map = new Map<string, AssetData[]>()
    for (const a of assets) {
      const arr = map.get(a.category) ?? []
      arr.push(a)
      map.set(a.category, arr)
    }
    return order.filter((k) => map.has(k)).map((k) => ({ key: k, items: map.get(k)! }))
  }, [assets])

  const fng = metrics.find((m) => m.key === 'fear_greed')
  const mcap = metrics.find((m) => m.key === 'total_mcap')
  const dom = metrics.find((m) => m.key === 'btc_dominance')

  // تشخیص Risk-Off: طلا و نفت سبز، سهام و بیت‌کوین قرمز
  const riskOff = useMemo(() => {
    const chg = (predicate: (a: AssetData) => boolean) => {
      const a = assets.find(predicate)
      return a?.change1d ?? null
    }
    const gold = chg((a) => a.category === 'metals' && /xau|gold|paxg/i.test(a.symbol))
    const oil = chg((a) => a.category === 'energy' && /wti|brent|oil|cl=f/i.test(a.symbol))
    const stocks = chg((a) => a.category === 'indices' && /spx|ndx|dji|gspc|ixic|sp500|nasdaq/i.test(a.symbol))
    const btc = chg((a) => a.category === 'crypto' && /btc|bitcoin/i.test(a.symbol))
    if (gold === null || oil === null || stocks === null || btc === null) return false
    return gold > 0 && oil > 0 && stocks < 0 && btc < 0
  }, [assets])

  return (
    <div className="space-y-6">
      {/* ═══ پیش‌بینی ۳۰روزه — تکنیکال / چرخه‌ها / استرولوژی مالی / ترکیب ═══ */}
      <ForecastPanel />

      {/* هشدار Risk-Off */}
      {riskOff && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          <TriangleAlert className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-bold">الگوی Risk-Off شناسایی شد</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-200/80">
              طلا و نفت در حال رشد، همزمان با ریزش سهام و بیت‌کوین — الگوی کلاسیک گریز از ریسک که
              معمولاً پیش از تنش‌های ژئوپلیتیک دیده می‌شود
            </p>
          </div>
        </div>
      )}

      {/* سنجه‌های کلان */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {fng && (
          <Card className="border-zinc-800/70 bg-zinc-900/50">
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500">شاخص ترس و طمع کریپتو</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums" style={{ color: fngColor(fng.value) }} dir="ltr">
                  {fng.value.toLocaleString('en-US')}
                </span>
                <span className="text-xs font-medium text-zinc-400">{fng.extra.label ?? ''}</span>
              </div>
              {/* گیج گرادیانی */}
              <div className="relative mt-3 h-2 w-full rounded-full bg-gradient-to-l from-red-500 via-yellow-500 to-emerald-500">
                <div
                  className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                  style={{ insetInlineStart: `${Math.min(100, Math.max(0, fng.value))}%` }}
                />
              </div>
              {/* اسپارک‌لاین تاریخچه */}
              {fng.extra.history && fng.extra.history.length > 2 && (
                <div className="mt-3">
                  <Sparkline values={fng.extra.history} up={(fng.extra.history.at(-1) ?? 0) >= (fng.extra.history[0] ?? 0)} />
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {mcap && (
          <Card className="border-zinc-800/70 bg-zinc-900/50">
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500">مارکت‌کپ کل کریپتو</p>
              <div className="mt-1 text-2xl font-bold" dir="ltr">
                ${(mcap.value / 1e12).toFixed(2)}T
              </div>
              {mcap.extra.history && mcap.extra.history.length > 2 && (
                <div className="mt-3">
                  <Sparkline
                    values={mcap.extra.history}
                    up={(mcap.extra.history.at(-1) ?? 0) >= (mcap.extra.history[0] ?? 0)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {dom && (
          <Card className="border-zinc-800/70 bg-zinc-900/50">
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500">دامیننس بیت‌کوین</p>
              <div className="mt-1 text-2xl font-bold" dir="ltr">
                {dom.value.toFixed(1)}%
              </div>
              {dom.extra.history && dom.extra.history.length > 2 && (
                <div className="mt-3">
                  <Sparkline
                    values={dom.extra.history}
                    up={(dom.extra.history.at(-1) ?? 0) >= (dom.extra.history[0] ?? 0)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* گروه‌های دارایی */}
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
            <span className="h-4 w-1 rounded-full bg-amber-500" />
            {CATEGORY_FA[g.key] ?? g.key}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((a) => {
              let spark: number[] = []
              try {
                spark = JSON.parse(a.spark || '[]') as number[]
              } catch {
                spark = []
              }
              const up = (a.change1d ?? 0) >= 0
              return (
                <Card
                  key={a.id}
                  className="border-zinc-800/70 bg-zinc-900/50 transition-colors hover:border-zinc-700"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-200">{a.name}</p>
                        <p className="mt-0.5 text-[10px] text-zinc-500" dir="ltr">
                          {a.symbol}
                        </p>
                        <p className="mt-1 text-lg font-bold text-zinc-100" dir="ltr">
                          {a.unit === '$' ? '$' : ''}
                          {fmtPrice(a.price)}
                          {a.unit && a.unit !== '$' ? (
                            <span className="text-[10px] font-normal text-zinc-500"> {a.unit}</span>
                          ) : null}
                        </p>
                      </div>
                      <Sparkline values={spark} up={up} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ChangeBadge value={a.change1d} label="روز" />
                      <ChangeBadge value={a.change7d} label="هفته" />
                      <ChangeBadge value={a.change30d} label="ماه" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
