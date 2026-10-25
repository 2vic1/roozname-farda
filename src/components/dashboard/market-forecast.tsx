'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Crosshair,
  MoonStar,
  RefreshCw,
  Swords,
  TrendingDown,
  TrendingUp,
  Waves,
} from 'lucide-react'
import { faDateShort, faNum } from './types'
import type { ForecastPayload, PathPoint, KeyCall, CandlePoint } from '@/lib/market-forecast'

// پیام خطای خام (مثل HTTP 418 بایننس) → جمله فارسی قابل فهم برای کاربر
function friendlyForecastError(msg: string): string {
  if (/HTTP 418|HTTP 429/.test(msg))
    return 'سرویس بایننس موقتاً این سرور را محدود کرده — یک دقیقه صبر کن و «تلاش دوباره» بزن؛ تا آن‌موقع داده از منبع جایگزین (یاهو) خوانده می‌شود'
  if (/HTTP 451|blocked/.test(msg))
    return 'دسترسی به منبع داده موقتاً مسدود شده — چند دقیقه بعد دوباره امتحان کن'
  return msg
}

// ─── پنل پیش‌بینی ۳۰روزه — تکنیکال / چرخه‌ها / استرولوژی مالی / ترکیب همه ───
// چارت کندل‌استیک: کندل واقعی + ادامه کندل پیش‌بینی با رنگ روش + دقت‌سنجی روزبه‌روز

const ASSET_CHIPS = [
  { symbol: 'BTCUSDT', fa: 'بیت‌کوین' },
  { symbol: 'ETHUSDT', fa: 'اتریوم' },
  { symbol: 'NVDA', fa: 'انویدیا' },
  { symbol: '^GSPC', fa: 'S&P 500' },
  { symbol: 'CL=F', fa: 'نفت WTI' },
  { symbol: 'BZ=F', fa: 'برنت' },
  { symbol: 'GC=F', fa: 'طلا' },
  { symbol: 'SI=F', fa: 'نقره' },
]

type MethodKey = 'technical' | 'cycles' | 'astro' | 'fusion'

const METHOD_META: Record<MethodKey, { fa: string; color: string; Icon: typeof Waves }> = {
  technical: { fa: 'تکنیکال', color: '#f59e0b', Icon: Waves },
  cycles: { fa: 'چرخه‌ها', color: '#a78bfa', Icon: RefreshCw },
  astro: { fa: 'استرولوژی مالی', color: '#e879f9', Icon: MoonStar },
  fusion: { fa: 'ترکیب همه', color: '#34d399', Icon: Swords },
}

const UP_COLOR = '#22c55e'
const DOWN_COLOR = '#f43f5e'

/** تیره‌کردن رنگ — برای کندل نزولی پیش‌بینی (همان خانوادهٔ رنگی روش ولی تیره‌تر) */
function shade(hex: string, f: number): string {
  const m = hex.replace('#', '')
  const v = m.length === 3
    ? m.split('').map((ch) => ch + ch).join('')
    : m
  const r = Math.round(parseInt(v.slice(0, 2), 16) * (1 - f))
  const g = Math.round(parseInt(v.slice(2, 4), 16) * (1 - f))
  const b = Math.round(parseInt(v.slice(4, 6), 16) * (1 - f))
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

function fmtPrice(n: number): string {
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('en-US')
  if (Math.abs(n) >= 10) return n.toFixed(2)
  return n.toFixed(4)
}

function pct(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

// ═══ چارت کندل‌استیک — واقعی + پیش‌بینی + سایهٔ مقایسه ═══

interface CandleChartProps {
  real: CandlePoint[]
  /** ادامهٔ پیش‌بینی (کندل‌های آینده) با رنگ روش */
  forecast?: { candles: CandlePoint[]; color: string; key: MethodKey }
  /** کندل‌های پیش‌بینی روزهای گذشته — کنار کندل واقعی همان روز می‌نشیند */
  ghost?: CandlePoint[]
  ghostColor?: string
  band?: PathPoint[]
  bandColor?: string
  todayIso?: string
  height?: number
}

function CandleChart({
  real,
  forecast,
  ghost,
  ghostColor = '#a78bfa',
  band,
  bandColor,
  todayIso,
  height = 300,
}: CandleChartProps) {
  const W = 900
  const H = height
  const padL = 62
  const padR = 14
  const padT = 16
  const padB = 28
  const iw = W - padL - padR
  const ih = H - padT - padB

  // اسلات‌ها — اتحاد تاریخ‌های واقعی + سایه + پیش‌بینی
  const dates: string[] = []
  const slot = new Map<string, { real?: CandlePoint; ghost?: CandlePoint; fc?: CandlePoint }>()
  const put = (c: CandlePoint, key: 'real' | 'ghost' | 'fc') => {
    let s = slot.get(c.date)
    if (!s) {
      s = {}
      slot.set(c.date, s)
      dates.push(c.date)
    }
    s[key] = c
  }
  for (const c of real) put(c, 'real')
  if (ghost) for (const c of ghost) put(c, 'ghost')
  if (forecast) for (const c of forecast.candles) put(c, 'fc')
  dates.sort()
  const n = dates.length
  if (n === 0) return null

  const idx = new Map(dates.map((d, i) => [d, i]))
  const slotW = iw / n
  const x = (i: number) => padL + (i + 0.5) * slotW
  const bodyW = Math.max(2.2, Math.min(9, slotW * 0.6))
  const OFF = slotW * 0.29 // جابه‌جایی جفت‌های مقایسه‌ای: سایه چپ، واقعی راست

  // دامنهٔ قیمت
  let yMin = Infinity
  let yMax = -Infinity
  const see = (h: number, l: number) => {
    yMin = Math.min(yMin, l)
    yMax = Math.max(yMax, h)
  }
  for (const c of real) see(c.high, c.low)
  if (ghost) for (const c of ghost) see(c.high, c.low)
  if (forecast) for (const c of forecast.candles) see(c.high, c.low)
  if (band) for (const p of band) see(p.hi, p.lo)
  const padY = (yMax - yMin) * 0.06 || 1
  yMin -= padY
  yMax += padY
  const y = (v: number) => padT + ih - ((v - yMin) / (yMax - yMin)) * ih

  const yTicks = [0.08, 0.36, 0.64, 0.92].map((f) => yMin + f * (yMax - yMin))
  const tickIdx = Array.from({ length: 6 }, (_, k) => Math.round((k * (n - 1)) / 5))
  const todayIdx = todayIso != null ? idx.get(todayIso) : undefined
  const faDay = (iso: string) =>
    new Intl.DateTimeFormat('fa-IR', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(
      new Date(iso + 'T00:00:00Z'),
    )

  const renderCandle = (c: CandlePoint, cx: number, kind: 'real' | 'forecast' | 'ghost', color: string) => {
    const up = c.close >= c.open
    const yTop = y(Math.max(c.open, c.close))
    const bh = Math.max(kind === 'real' ? 1.4 : 2.4, y(Math.min(c.open, c.close)) - yTop)
    // کندل پیش‌بینی هم مثل کندل واقعی «توپر» رسم می‌شود — فقط سبک رنگش فرق دارد:
    // صعودی = رنگ روش، نزولی = تیرهٔ همان رنگ (سایه و بدنه کاملاً مثل کندل واقعی خواناست)
    const fill =
      kind === 'real'
        ? up ? UP_COLOR : DOWN_COLOR
        : kind === 'forecast'
          ? up ? color : shade(color, 0.42)
          : color
    const solid = kind !== 'ghost'
    return (
      <g
        style={kind !== 'real' ? { filter: `drop-shadow(0 0 3px ${color}55)` } : undefined}
      >
        <title>{`${c.date} — O:${fmtPrice(c.open)} H:${fmtPrice(c.high)} L:${fmtPrice(c.low)} C:${fmtPrice(c.close)}`}</title>
        <line
          x1={cx}
          x2={cx}
          y1={y(c.high)}
          y2={y(c.low)}
          stroke={fill}
          strokeWidth={solid ? 1.1 : 1.1}
          opacity={solid ? 0.95 : 0.75}
        />
        <rect
          x={cx - bodyW / 2}
          y={yTop}
          width={bodyW}
          height={bh}
          rx={1.2}
          fill={fill}
          fillOpacity={kind === 'real' ? 1 : solid ? 0.95 : 0.16}
          stroke={fill}
          strokeWidth={kind === 'real' ? 0.8 : solid ? 0.9 : 1.25}
          strokeDasharray={kind === 'ghost' ? '2.5 2' : undefined}
        />
      </g>
    )
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" dir="ltr" role="img" aria-label="چارت کندل">
        {/* خطوط راهنما */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#27272a" strokeWidth={1} />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" fill="#71717a" fontSize={10}>
              {fmtPrice(v)}
            </text>
          </g>
        ))}

        {/* باند اطمینان مسیر */}
        {band && band.length > 0 && (
          <polygon
            points={[
              ...band.map((p) => `${x(idx.get(p.date) ?? 0)},${y(p.hi)}`),
              ...[...band].reverse().map((p) => `${x(idx.get(p.date) ?? 0)},${y(p.lo)}`),
            ].join(' ')}
            fill={bandColor ?? '#a78bfa'}
            opacity={0.07}
          />
        )}

        {/* برچسب تاریخ */}
        {tickIdx.map((i, k) => (
          <text
            key={k}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fill="#71717a"
            fontSize={10}
          >
            {faDay(dates[i]!)}
          </text>
        ))}

        {/* مرز امروز */}
        {todayIdx != null && (
          <>
            <line
              x1={x(todayIdx) + slotW / 2}
              x2={x(todayIdx) + slotW / 2}
              y1={padT}
              y2={padT + ih}
              stroke="#eab308"
              strokeWidth={1.2}
              strokeDasharray="4 4"
              opacity={0.7}
            />
            <text x={x(todayIdx) + slotW / 2} y={padT - 4} textAnchor="middle" fill="#eab308" fontSize={10}>
              امروز
            </text>
          </>
        )}

        {/* کندل‌ها */}
        {dates.map((d, i) => {
          const s = slot.get(d)!
          const overlap = Boolean(s.ghost && s.real)
          return (
            <g key={d}>
              {s.real && renderCandle(s.real, overlap ? x(i) + OFF : x(i), 'real', '')}
              {s.ghost && renderCandle(s.ghost, overlap ? x(i) - OFF : x(i), 'ghost', ghostColor)}
              {s.fc && forecast && renderCandle(s.fc, x(i), 'forecast', forecast.color)}
            </g>
          )
        })}
      </svg>

      {/* راهنما */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1 text-[10px] text-zinc-400">
          <span className="inline-block h-2.5 w-1.5 rounded-sm" style={{ background: UP_COLOR }} />
          <span className="inline-block h-2.5 w-1.5 rounded-sm" style={{ background: DOWN_COLOR }} />
          کندل واقعی
        </span>
        {forecast && (
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span className="inline-block h-2.5 w-1.5 rounded-sm" style={{ background: forecast.color }} />
            <span className="inline-block h-2.5 w-1.5 rounded-sm" style={{ background: shade(forecast.color, 0.42) }} />
            کندل پیش‌بینی ({METHOD_META[forecast.key].fa}) — توپر مثل واقعی: روشن = صعودی، تیره = نزولی
          </span>
        )}
        {ghost && (
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed"
              style={{ borderColor: ghostColor, background: `${ghostColor}29` }}
            />
            پیش‌بینی روزهای گذشته — کنار کندل واقعی همان روز
          </span>
        )}
      </div>
    </div>
  )
}

// ═══ چارت خطی مقایسه همه روش‌ها ═══

interface ChartPath {
  key: string
  nameFa: string
  color: string
  points: PathPoint[]
  band?: boolean
}

function ForecastChart({
  history,
  paths,
  todayIso,
  height = 300,
}: {
  history: Array<{ date: string; close: number }>
  paths: ChartPath[]
  todayIso: string
  height?: number
}) {
  const W = 760
  const H = height
  const padL = 62
  const padR = 14
  const padT = 16
  const padB = 28
  const iw = W - padL - padR
  const ih = H - padT - padB

  const t0 = new Date(history[0]?.date ?? todayIso + 'T00:00:00Z').getTime()
  const lastHist = history[history.length - 1]?.date ?? todayIso
  const t1 = new Date(paths[0]?.points[paths[0].points.length - 1]?.date ?? lastHist).getTime()
  const spanT = Math.max(1, t1 - t0)

  const x = (iso: string) => padL + ((new Date(iso + 'T00:00:00Z').getTime() - t0) / spanT) * iw

  let yMin = Infinity
  let yMax = -Infinity
  for (const h of history) {
    yMin = Math.min(yMin, h.close)
    yMax = Math.max(yMax, h.close)
  }
  for (const p of paths) {
    for (const pt of p.points) {
      yMin = Math.min(yMin, p.band ? pt.lo : pt.price)
      yMax = Math.max(yMax, p.band ? pt.hi : pt.price)
    }
  }
  const pad = (yMax - yMin) * 0.06 || 1
  yMin -= pad
  yMax += pad
  const y = (v: number) => padT + ih - ((v - yMin) / (yMax - yMin)) * ih

  const histPts = history.map((h) => `${x(h.date)},${y(h.close)}`).join(' ')
  const todayX = x(lastHist)

  const yTicks = [0.08, 0.36, 0.64, 0.92].map((f) => yMin + f * (yMax - yMin))

  const totalDays = Math.round((t1 - t0) / 86400000)
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => new Date(t0 + f * spanT))
  void totalDays

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" dir="ltr" role="img" aria-label="چارت مقایسه روش‌ها">
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#27272a" strokeWidth={1} />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" fill="#71717a" fontSize={10}>
              {fmtPrice(v)}
            </text>
          </g>
        ))}
        {xTicks.map((d, i) => (
          <text
            key={i}
            x={padL + (i / 4) * iw}
            y={H - 8}
            textAnchor="middle"
            fill="#71717a"
            fontSize={10}
          >
            {new Intl.DateTimeFormat('fa-IR', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(d)}
          </text>
        ))}

        {paths.map((p) =>
          p.band ? (
            <polygon
              key={`band-${p.key}`}
              points={[
                ...p.points.map((pt) => `${x(pt.date)},${y(pt.hi)}`),
                ...[...p.points].reverse().map((pt) => `${x(pt.date)},${y(pt.lo)}`),
              ].join(' ')}
              fill={p.color}
              opacity={0.1}
            />
          ) : null,
        )}

        <polyline points={histPts} fill="none" stroke="#d4d4d8" strokeWidth={1.8} />

        <line x1={todayX} x2={todayX} y1={padT} y2={padT + ih} stroke="#eab308" strokeWidth={1.2} strokeDasharray="4 4" opacity={0.7} />
        <text x={todayX} y={padT - 4} textAnchor="middle" fill="#eab308" fontSize={10}>
          امروز
        </text>

        {paths.map((p) => (
          <polyline
            key={`line-${p.key}`}
            points={p.points.map((pt) => `${x(pt.date)},${y(pt.price)}`).join(' ')}
            fill="none"
            stroke={p.color}
            strokeWidth={2.2}
            strokeDasharray="6 4"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${p.color}44)` }}
          />
        ))}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <span className="h-0.5 w-5 rounded bg-zinc-300" />
          قیمت واقعی
        </span>
        {paths.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span className="h-0.5 w-5 rounded" style={{ background: p.color }} />
            {p.nameFa}
          </span>
        ))}
      </div>
    </div>
  )
}

// ═══ جدول تماس‌های کلیدی ═══

const KIND_CHIP: Record<string, string> = {
  end: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  peak: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  trough: 'border-red-500/40 bg-red-500/10 text-red-300',
  turn: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
}

function CallsTable({ calls, unit }: { calls: KeyCall[]; unit: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="text-[10px] text-zinc-500">
            <th className="pb-1.5 text-start font-medium">نوع</th>
            <th className="pb-1.5 text-start font-medium">تاریخ</th>
            <th className="pb-1.5 text-start font-medium">قیمت هدف</th>
            <th className="pb-1.5 text-start font-medium">توضیح</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c, i) => (
            <tr key={i} className="border-t border-zinc-800/60">
              <td className="py-1.5">
                <Badge variant="outline" className={`h-5 px-1.5 text-[9px] ${KIND_CHIP[c.kind] ?? KIND_CHIP.end}`}>
                  {c.kindFa}
                </Badge>
              </td>
              <td className="py-1.5 whitespace-nowrap text-zinc-300">{faDateShort(c.date)}</td>
              <td className="py-1.5 whitespace-nowrap font-bold text-zinc-100" dir="ltr">
                {unit === '$' ? '$' : ''}{fmtPrice(c.price)}
              </td>
              <td className="py-1.5 text-[10px] leading-4 text-zinc-500">{c.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══ دقت‌سنجی زنده — چقدر روی هم می‌افتند؟ ═══

interface TrackDayLite {
  date: string
  predicted: number
  actual: number
  devPct: number
  inBand: boolean
}

interface MethodTrackLite {
  candles: CandlePoint[]
  path: PathPoint[]
  days: TrackDayLite[]
  mape: number
  inBand: number
  total: number
  endDevPct: number
}

interface TrackPayload {
  ok: true
  symbol: string
  name: string
  unit: string
  price: number
  priceDate: string
  history: CandlePoint[]
  savedRun: { runDate: string; methods: Partial<Record<MethodKey, MethodTrackLite>> } | null
  backtest: {
    fromDate: string
    firstTargetDate: string
    methods: Record<MethodKey, MethodTrackLite>
  } | null
}

function TrackStats({ m }: { m: MethodTrackLite }) {
  const mapeColor =
    m.mape <= 3
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : m.mape <= 7
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
        : 'border-red-500/40 bg-red-500/10 text-red-300'
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-300">
        {faNum(m.total)} روز مقایسه‌شده
      </Badge>
      <Badge variant="outline" className={`text-[10px] ${mapeColor}`}>
        میانگین خطا: {faNum(m.mape)}٪
      </Badge>
      <Badge variant="outline" className="text-[10px] border-violet-500/40 bg-violet-500/10 text-violet-300">
        داخل باند: {faNum(m.inBand)} از {faNum(m.total)}
      </Badge>
      <Badge
        variant="outline"
        className={`text-[10px] ${m.endDevPct >= 0 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}
      >
        خطای پایان: {pct(m.endDevPct)}
      </Badge>
    </div>
  )
}

function AccuracySection({ symbol, method }: { symbol: string; method: MethodKey }) {
  const [track, setTrack] = useState<TrackPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (sym: string, force = false) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/market/forecast/track?symbol=${encodeURIComponent(sym)}${force ? '&force=1' : ''}`, { cache: 'no-store' })
      const j = (await res.json()) as TrackPayload | { ok: false; error: string }
      if ('ok' in j && j.ok) setTrack(j)
      else setError(friendlyForecastError(('error' in j && j.error) || 'خطا در دقت‌سنجی'))
    } catch {
      setError('خطای شبکه در دقت‌سنجی')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setTrack(null)
    void load(symbol)
  }, [symbol, load])

  const meta = METHOD_META[method]
  const saved = track?.savedRun?.methods[method] ?? null
  const bt = track?.backtest?.methods[method] ?? null

  // دقیق‌ترین روش در بک‌تست
  let bestKey: MethodKey | null = null
  if (track?.backtest) {
    const ranked = (Object.entries(track.backtest.methods) as Array<[MethodKey, MethodTrackLite]>)
      .filter(([, m]) => m.total > 0)
      .sort((a, b) => a[1].mape - b[1].mape)
    bestKey = ranked[0]?.[0] ?? null
  }

  return (
    <Card className="border-zinc-800/70 bg-zinc-900/50">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-200">
            <Crosshair className="h-4 w-4 text-cyan-400" />
            دقت‌سنجی — چقدر روی هم می‌افتند؟
          </h4>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[11px]"
            onClick={() => load(symbol, true)}
            disabled={loading}
            aria-label="بازخوانی دقت‌سنجی"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            بازخوانی
          </Button>
        </div>
        <p className="mb-3 text-[10px] leading-4 text-zinc-500">
          هر روز که می‌گذرد کندل واقعی جلو می‌رود و کنار کندل پیش‌بینی همان روز می‌نشیند — هر جفت، دقتِ همان روزِ روش «{meta.fa}» را نشان می‌دهد.
        </p>

        {loading && !track && (
          <div className="space-y-2">
            <Skeleton className="h-48 w-full bg-zinc-800/70" />
            <Skeleton className="h-5 w-64 bg-zinc-800/70" />
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2">
            <p className="text-xs text-red-300">{error}</p>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => load(symbol, true)}>
              تلاش دوباره
            </Button>
          </div>
        )}

        {track && (
          <div className="space-y-5">
            {/* ── آزمون گذشته: همیشه موجود ── */}
            {track.backtest && bt && (
              <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-zinc-300">
                    آزمون گذشته — اگر {faDateShort(track.backtest.fromDate)} این پیش‌بینی اجرا می‌شد، تا امروز چقدر درست از آب درمی‌آمد؟
                  </p>
                  {bestKey && (
                    <Badge variant="outline" className="text-[10px] border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
                      دقیق‌ترین: {METHOD_META[bestKey].fa} — خطای {faNum(track.backtest.methods[bestKey].mape)}٪
                    </Badge>
                  )}
                </div>
                <CandleChart
                  real={track.history}
                  ghost={bt.candles}
                  ghostColor={meta.color}
                  band={bt.path}
                  bandColor={meta.color}
                  todayIso={track.priceDate}
                  height={280}
                />
                <div className="mt-2">
                  <TrackStats m={bt} />
                </div>
              </div>
            )}

            {/* ── پیش‌بینی زنده ثبت‌شده در دیتابیس ── */}
            <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3">
              {track.savedRun && saved ? (
                <>
                  <p className="mb-2 text-[11px] font-bold text-zinc-300">
                    پیش‌بینی زنده — ثبت‌شده در {faDateShort(track.savedRun.runDate)}؛ از فردا هر روز کندل واقعی کنار همان روز می‌نشیند
                  </p>
                  <CandleChart
                    real={track.history}
                    ghost={saved.candles.filter((c) => c.date <= track.priceDate)}
                    forecast={{
                      candles: saved.candles.filter((c) => c.date > track.priceDate),
                      color: meta.color,
                      key: method,
                    }}
                    ghostColor={meta.color}
                    band={saved.path}
                    bandColor={meta.color}
                    todayIso={track.priceDate}
                    height={280}
                  />
                  <div className="mt-2">
                    {saved.total > 0 ? (
                      <TrackStats m={saved} />
                    ) : (
                      <p className="text-[10px] text-zinc-500">
                        این پیش‌بینی امروز ثبت شده — از فردا با بسته‌شدن هر کندل واقعی، خطای همان روز اینجا ثبت می‌شود.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[10px] leading-4 text-zinc-500">
                  هنوز مسیر زنده‌ای برای {track.name} ثبت نشده — با اولین محاسبه پیش‌بینی، مسیر ۳۰روزه در دیتابیس قفل می‌شود و از فردا روزبه‌روز با واقعیت مقایسه می‌شود.
                </p>
              )}
            </div>

            {/* ── مقایسه عددی هر چهار روش در بک‌تست ── */}
            {track.backtest && (
              <div>
                <p className="mb-2 text-[11px] font-bold text-zinc-300">کدام روش روی واقعیت نشسته بود؟ — آزمون گذشته هر چهار روش</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.entries(track.backtest.methods) as Array<[MethodKey, MethodTrackLite]>).map(([k, m]) => {
                    const mm = METHOD_META[k]
                    return (
                      <div
                        key={k}
                        className={`rounded-lg border px-2.5 py-2 ${k === bestKey ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-zinc-800 bg-zinc-900/60'}`}
                      >
                        <span className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: mm.color }}>
                          <span className="h-2 w-2 rounded-full" style={{ background: mm.color }} />
                          {mm.fa}
                        </span>
                        <p className="mt-1 text-sm font-black text-zinc-100">
                          {faNum(m.mape)}<span className="text-[10px] font-normal text-zinc-500">٪ خطا</span>
                        </p>
                        <p className="text-[9px] text-zinc-500">
                          {faNum(m.inBand)}/{faNum(m.total)} روز داخل باند · پایان {pct(m.endDevPct)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═══ پنل اصلی ═══

export function ForecastPanel() {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [method, setMethod] = useState<MethodKey>('technical')
  const [data, setData] = useState<Record<string, ForecastPayload>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (sym: string, force = false) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/market/forecast?symbol=${encodeURIComponent(sym)}${force ? '&force=1' : ''}`, { cache: 'no-store' })
      const j = (await res.json()) as ForecastPayload | { ok: false; error: string }
      if ('ok' in j && j.ok) {
        setData((d) => ({ ...d, [sym]: j as ForecastPayload }))
      } else {
        setError(friendlyForecastError(('error' in j && j.error) || 'خطا در محاسبه پیش‌بینی'))
      }
    } catch {
      setError('خطای شبکه در دریافت پیش‌بینی')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!data[symbol]) void load(symbol)
  }, [symbol, data, load])

  const p = data[symbol]
  const unit = p?.unit ?? '$'

  const comparePaths: ChartPath[] = p
    ? (Object.keys(METHOD_META) as MethodKey[]).map((k) => ({
        key: k,
        nameFa: METHOD_META[k].fa,
        color: METHOD_META[k].color,
        points: p[k].path,
        band: false,
      }))
    : []

  return (
    <section aria-label="پیش‌بینی ۳۰روزه بازار">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-200">
          <span className="h-4 w-1 rounded-full bg-emerald-500" />
          پیش‌بینی ۳۰ روز آینده — سه روش + تلفیق
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-[11px]"
          onClick={() => load(symbol, true)}
          disabled={loading}
          aria-label="محاسبه مجدد پیش‌بینی"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          محاسبه مجدد
        </Button>
      </div>

      {/* انتخاب دارایی */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {ASSET_CHIPS.map((a) => (
          <button
            key={a.symbol}
            onClick={() => setSymbol(a.symbol)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
              symbol === a.symbol
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            {a.fa}
          </button>
        ))}
      </div>

      {loading && !p && (
        <Card className="border-zinc-800/70 bg-zinc-900/50">
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-5 w-52 bg-zinc-800/70" />
            <Skeleton className="h-64 w-full bg-zinc-800/70" />
            <Skeleton className="h-24 w-full bg-zinc-800/70" />
            <p className="text-center text-[11px] text-zinc-500">
              موتور پیش‌بینی در حال کشیدن تاریخچه ۱ ساله و محاسبه هر سه روش است...
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-500/30 bg-red-950/20">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-xs text-red-300">{error}</p>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => load(symbol, true)}>
              تلاش دوباره
            </Button>
          </CardContent>
        </Card>
      )}

      {p && (
        <Card className="border-zinc-800/70 bg-zinc-900/50">
          <CardContent className="p-4 sm:p-5">
            {/* هدر دارایی */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-black text-zinc-100">
                  {p.name} <span className="text-[10px] font-normal text-zinc-500" dir="ltr">{p.symbol}</span>
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  قیمت الان: <span className="font-bold text-zinc-300" dir="ltr">{unit === '$' ? '$' : ''}{fmtPrice(p.price)}</span>
                  {' · '}داده تا {faDateShort(p.priceDate)}
                </p>
              </div>
              <p className="max-w-[300px] text-[10px] leading-4 text-zinc-500">{p.natalNote}</p>
            </div>

            {/* کلیدهای روش */}
            <div className="mb-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {(Object.keys(METHOD_META) as MethodKey[]).map((k) => {
                const m = METHOD_META[k]
                const active = method === k
                const endCmp = p.methodsComparison.find((c) => c.key === k)
                return (
                  <button
                    key={k}
                    onClick={() => setMethod(k)}
                    className={`rounded-xl border px-2.5 py-2 text-start transition-colors ${
                      active ? 'bg-zinc-800/80' : 'border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900/60'
                    }`}
                    style={active ? { borderColor: `${m.color}66` } : undefined}
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: active ? m.color : '#a1a1aa' }}>
                      <m.Icon className="h-3.5 w-3.5" />
                      {m.fa}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-zinc-500">
                      پایان ماه: <span dir="ltr" style={{ color: endCmp && endCmp.changePct >= 0 ? '#34d399' : '#f87171' }}>{endCmp ? `${unit === '$' ? '$' : ''}${fmtPrice(endCmp.endPrice)} (${pct(endCmp.changePct)})` : '—'}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {/* چارت کندل — واقعی + ادامه پیش‌بینی */}
            <CandleChart
              real={p.history.slice(-60)}
              forecast={{ candles: p.candles[method], color: METHOD_META[method].color, key: method }}
              band={p[method].path}
              bandColor={METHOD_META[method].color}
              todayIso={p.priceDate}
              height={300}
            />

            {/* خلاصه روش */}
            <div className="mt-4 rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3 py-2.5">
              <p className="text-[11px] leading-5 text-zinc-300">
                <span className="font-bold" style={{ color: METHOD_META[method].color }}>
                  {METHOD_META[method].fa}:
                </span>{' '}
                {p[method].summaryFa}
                {method === 'fusion' && (
                  <span className="mt-1 block text-[10px] text-zinc-500">
                    وزن‌ها: تکنیکال {faNum(40)}٪ + چرخه‌ها {faNum(30)}٪ + استرولوژی {faNum(30)}٪
                  </span>
                )}
              </p>
            </div>

            {/* اطلاعات تکمیلی هر روش */}
            {method === 'technical' && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-300">
                  RSI: {faNum(p.technical.indicators.rsi)}
                </Badge>
                <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-300">
                  {p.technical.indicators.emaTrendFa}
                </Badge>
                <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-300" dir="ltr">
                  Vol 30d: {p.technical.indicators.vol30dPct}%
                </Badge>
                <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-300">
                  حمایت: <span dir="ltr">{fmtPrice(p.technical.indicators.support)}</span>
                </Badge>
                <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-300">
                  مقاومت: <span dir="ltr">{fmtPrice(p.technical.indicators.resistance)}</span>
                </Badge>
              </div>
            )}
            {method === 'cycles' && (
              <div className="mt-3 space-y-2">
                {p.cycles.info.periods.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {p.cycles.info.periods.map((c) => (
                      <Badge key={c.days} variant="outline" className="text-[10px] border-violet-500/40 bg-violet-500/10 text-violet-300">
                        {c.fa}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-500">چرخه کوتاه‌مدت معناداری در تاریخچه ۱ساله یافت نشد — مسیر بر پایه روند میرا است</p>
                )}
                {p.cycles.info.anchorFa && (
                  <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 px-3 py-2">
                    <p className="text-[11px] font-bold text-violet-300">{p.cycles.info.anchorFa}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-zinc-400">{p.cycles.info.anchorNoteFa}</p>
                  </div>
                )}
              </div>
            )}
            {method === 'astro' && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {p.natalFa.map((n, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-200">
                      {n}
                    </Badge>
                  ))}
                </div>
                {(p.astro.events ?? []).length > 0 && (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-2.5">
                    {p.astro.events.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px] leading-4">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.bias === 'bull' ? '#34d399' : e.bias === 'bear' ? '#f87171' : '#eab308' }} />
                        <span className="shrink-0 font-bold text-zinc-300">{faDateShort(e.date)}</span>
                        <span className="text-zinc-400">{e.titleFa}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {method === 'fusion' && (
              <div className="mt-3">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    p.fusion.agreementLevel === 'aligned'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : p.fusion.agreementLevel === 'majority'
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                        : 'border-red-500/40 bg-red-500/10 text-red-300'
                  }`}
                >
                  هم‌راستایی روش‌ها: {p.fusion.agreementFa}
                </Badge>
              </div>
            )}

            {/* تماس‌های کلیدی — قیمت + روز مشخص */}
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold text-zinc-300">
                تماس‌های کلیدی این روش — روز و قیمت مشخص
              </p>
              <CallsTable calls={p[method].calls} unit={unit} />
            </div>

            {/* مقایسه همه روش‌ها — چارت خطی با اسم‌ها (فقط در تب ترکیب) */}
            {method === 'fusion' && (
              <div className="mt-4 rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3">
                <p className="mb-2 text-[11px] font-bold text-zinc-300">
                  مقایسه روش‌ها کنار هم — اختلاف تحلیل از هر مسیر
                </p>
                <ForecastChart history={p.history} paths={comparePaths} todayIso={p.priceDate} height={280} />
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {p.methodsComparison.map((c) => (
                    <div key={c.key} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: c.color }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                        {c.nameFa}
                      </span>
                      <p className="mt-1 text-xs font-black text-zinc-100" dir="ltr">
                        {unit === '$' ? '$' : ''}{fmtPrice(c.endPrice)}
                      </p>
                      <p className={`flex items-center gap-0.5 text-[10px] font-bold ${c.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">
                        {c.changePct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {pct(c.changePct)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-3 text-[9px] leading-4 text-zinc-600">{p.disclaimerFa}</p>
          </CardContent>
        </Card>
      )}

      {/* دقت‌سنجی زنده — کندل پیش‌بینی vs کندل واقعی */}
      {p && <div className="mt-4"><AccuracySection symbol={symbol} method={method} /></div>}
    </section>
  )
}
