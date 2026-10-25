'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { History, Sigma, TrendingDown, TrendingUp } from 'lucide-react'
import type { PatternData, RiskData } from './types'
import { faNum } from './types'

function simColor(sim: number): string {
  if (sim >= 75) return '#ef4444'
  if (sim >= 55) return '#f97316'
  if (sim >= 40) return '#eab308'
  return '#a1a1aa'
}

function pct(n: number): string {
  const s = n >= 0 ? '+' : '−'
  return `${s}${Math.abs(n).toFixed(1)}%`
}

// ─── کارت «روند کلان و الگوهای تاریخی» ───
// امضای رفتاری امروز بازار را با هفته‌های منتهی به بحران‌های بزرگ تاریخی مقایسه می‌کند
// (مثلا: ریزش سنگین سهام + جهش نفت ← الگوی کلاسیک پیش از جنگ) و پنجره زمانی محتمل می‌دهد
export function PatternsCard({
  patterns,
  risk,
}: {
  patterns: PatternData[]
  risk: RiskData | null
}) {
  const pd = risk?.detail.pattern
  const cur = pd?.current
  const window = pd?.window ?? null
  const regimeNotes = pd?.regimeNotesFa ?? []

  const chips = cur
    ? [
        { label: 'نفت ۷روزه', v: cur.oil7d, up: cur.oil7d >= 0 },
        { label: 'نفت ۱ماهه', v: cur.oil30d, up: cur.oil30d >= 0 },
        { label: 'طلا ۱ماهه', v: cur.gold30d, up: cur.gold30d >= 0 },
        { label: 'سهام ۱ماهه', v: cur.spx30d, up: cur.spx30d >= 0 },
        { label: 'بیت‌کوین ۱ماهه', v: cur.btc30d, up: cur.btc30d >= 0 },
      ]
    : []

  return (
    <Card className="border-zinc-800/70 bg-zinc-900/50">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-200">
            <History className="h-4 w-4 text-violet-400" />
            روند کلان و الگوهای تاریخی
            <span className="text-[10px] font-normal text-zinc-500">
              رفتار امروز بازار × امضای پیش از بحران‌های بزرگ
            </span>
          </h3>
          {window && (
            <Badge
              variant="outline"
              className="border-violet-500/40 bg-violet-500/10 text-violet-300"
            >
              پنجره محتمل رویداد: {faNum(window[0])} تا {faNum(window[1])} روز آینده
            </Badge>
          )}
        </div>

        {/* امضای فعلی بازار */}
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.label}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] tabular-nums ${
                  c.up
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                    : 'border-red-500/30 bg-red-500/5 text-red-400'
                }`}
              >
                {c.up ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {c.label}: {pct(c.v)}
              </span>
            ))}
            {cur && (
              <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700/70 bg-zinc-800/40 px-2 py-1 text-[10px] text-zinc-300">
                VIX: {faNum(Math.round(cur.vix))}
              </span>
            )}
          </div>
        )}

        {/* قواعد مستقیم رژیم پیش از جنگ */}
        {regimeNotes.length > 0 && (
          <ul className="mt-3 space-y-1">
            {regimeNotes.map((n, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs leading-5 text-amber-300/90">
                <Sigma className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                {n}
              </li>
            ))}
          </ul>
        )}

        {/* تطبیق‌های تاریخی */}
        <div className="mt-4 space-y-2.5">
          {patterns.length === 0 && (
            <p className="text-xs text-zinc-500">
              هنوز الگویی محاسبه نشده — پس از اجرای بات کلان‌روند به‌روز می‌شود.
            </p>
          )}
          {patterns.map((p) => {
            const c = simColor(p.similarity)
            return (
              <div
                key={p.eventKey}
                className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-200">
                    {p.eventName}
                    <span className="mr-1.5 text-[10px] font-normal text-zinc-500">
                      ({new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(
                        new Date(`${p.eventName.match(/\d{4}/)?.[0] ?? '2000'}-01-01T00:00:00Z`)
                      )}
                      )
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="border-zinc-700 text-[10px] text-zinc-400"
                    >
                      ریسک {faNum(Math.round(p.score))}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      style={{ borderColor: `${c}66`, background: `${c}14`, color: c }}
                    >
                      شباهت {faNum(Math.round(p.similarity))}٪
                    </Badge>
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, p.similarity)}%`, background: c }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-zinc-400">
                  {p.note}
                  <span className="text-zinc-500">
                    {' '}
                    — فاصله امضا تا رویداد در آن مقطع: {faNum(p.windowLo)} تا {faNum(p.windowHi)} روز
                  </span>
                </p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
