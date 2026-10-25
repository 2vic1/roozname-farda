'use client'

import { Target, Hourglass, ShieldCheck, ShieldAlert, CalendarClock, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { faDateShort, faDateYMD, faNum, outcomeMeta } from './types'
import type { RiskData } from './types'

// کارت پیش‌بینی روز حمله + ضریب اطمینان + استدلال مدل
export function PredictionCard({ risk }: { risk: RiskData }) {
  const { predictedAttackDate, attackDateNear, attackDateMid, attackDateFar, attackConfidence, rationaleFa, outcome, outcomeNote } = risk
  const oc = outcomeMeta(outcome)

  const daysLeft = predictedAttackDate ? diffDaysFromToday(predictedAttackDate) : null

  // سه سناریوی دیگر: نزدیک‌ترین / میانه / دورترین (محتمل‌ترین جدا و بزرگ نمایش داده می‌شود)
  const scenarios = [
    { key: 'near', label: 'نزدیک‌ترین', date: attackDateNear, icon: Zap },
    { key: 'mid', label: 'میانه', date: attackDateMid, icon: Hourglass },
    { key: 'far', label: 'دورترین', date: attackDateFar, icon: CalendarClock },
  ].filter((s) => s.date)

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-200">
          <Target className="h-4 w-4 text-red-400" />
          پیش‌بینی روز حمله
        </h3>
        <Badge variant="outline" className={`text-[10px] ${oc.chip}`}>
          {oc.fa}
        </Badge>
      </div>

      {predictedAttackDate ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] text-zinc-400">محتمل‌ترین روز حمله — قضاوت نهایی مدل</p>
              <p className="mt-1 text-2xl font-black leading-8 text-red-300" suppressHydrationWarning>
                {faDateYMD(predictedAttackDate)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{faDateShort(predictedAttackDate)}</p>
            </div>
            {daysLeft !== null && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-300"
              >
                <CalendarClock className="h-3 w-3" />
                {daysLeft <= 0
                  ? 'در بازه پیش‌بینی'
                  : `${faNum(daysLeft)} روز دیگر`}
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <Hourglass className="h-4 w-4 text-amber-400" />
            در انتظار داده کافی برای پیش‌بینی روز
          </p>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500">
            پس از رسیدن سیگنال‌های خبری و بازار، مدل روز محتمل را اعلام می‌کند
          </p>
        </div>
      )}

      {/* سه سناریوی دیگر: نزدیک / میانه / دور */}
      {scenarios.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-zinc-400">
            سناریوهای زمانی حمله (چهار انتخاب مدل):
          </p>
          <div className="grid grid-cols-3 gap-2">
            {scenarios.map((s) => {
              const dl = diffDaysFromToday(s.date!)
              return (
                <div
                  key={s.key}
                  className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2.5 text-center"
                >
                  <p className="flex items-center justify-center gap-1 text-[10px] text-zinc-500">
                    <s.icon className="h-3 w-3" />
                    {s.label}
                  </p>
                  <p className="mt-1 text-xs font-bold text-zinc-200" suppressHydrationWarning>
                    {faDateShort(s.date!)}
                  </p>
                  <p className="text-[9px] tabular-nums text-zinc-600" suppressHydrationWarning>
                    {dl !== null && dl > 0 ? `${faNum(dl)} روز دیگر` : 'در بازه'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ضریب اطمینان */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-zinc-300">ضریب اطمینان مدل</span>
          <span className="font-bold tabular-nums text-amber-400">{faNum(attackConfidence)}٪</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-l from-red-500 via-orange-500 to-amber-400 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, attackConfidence))}%` }}
          />
        </div>
      </div>

      {/* استدلال مدل */}
      {rationaleFa && (
        <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3">
          <p className="mb-1 text-[11px] font-semibold text-zinc-400">استدلال مدل:</p>
          <p className="text-xs leading-6 text-zinc-300">{rationaleFa}</p>
        </div>
      )}

      {outcomeNote && (
        <p className="flex items-start gap-1.5 text-[11px] leading-5 text-zinc-500">
          {outcome === 'hit' ? (
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
          ) : outcome === 'miss' ? (
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
          ) : null}
          {outcomeNote}
        </p>
      )}
    </div>
  )
}

function diffDaysFromToday(dateStr: string): number | null {
  try {
    const target = new Date(dateStr + 'T00:00:00Z').getTime()
    const now = new Date()
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    return Math.round((target - todayUtc) / 86400000)
  } catch {
    return null
  }
}
