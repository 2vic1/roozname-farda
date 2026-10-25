'use client'

import { Badge } from '@/components/ui/badge'
import { GraduationCap, CircleCheck, CircleX, Clock3, Sigma } from 'lucide-react'
import { faDateShort, faNum, outcomeMeta } from './types'
import type { AccuracyData } from './types'

// کارت آمار یادگیری خودکار هوش مصنوعی
export function AccuracyCard({ accuracy }: { accuracy: AccuracyData }) {
  const { total, hit, miss, pending, hitRate, lastMistakes } = accuracy

  const stats = [
    { label: 'کل ارزیابی‌ها', value: total, color: 'text-zinc-100', Icon: Sigma },
    { label: 'درست', value: hit, color: 'text-emerald-400', Icon: CircleCheck },
    { label: 'نادرست', value: miss, color: 'text-red-400', Icon: CircleX },
    { label: 'در انتظار', value: pending, color: 'text-amber-400', Icon: Clock3 },
  ]

  const rateColor =
    hitRate >= 60 ? '#10b981' : hitRate >= 40 ? '#eab308' : total > 0 ? '#ef4444' : '#71717a'

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-200">
        <GraduationCap className="h-4 w-4 text-amber-500" />
        آمار یادگیری مدل (خودارزیابی)
      </h3>

      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-2.5 text-center"
          >
            <s.Icon className={`mx-auto h-3.5 w-3.5 ${s.color}`} aria-hidden />
            <p className={`mt-1 text-lg font-black tabular-nums ${s.color}`}>{faNum(s.value)}</p>
            <p className="text-[10px] text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-zinc-300">نرخ پیش‌بینی درست</span>
          <span className="font-bold tabular-nums" style={{ color: rateColor }}>
            {total > 0 ? `${faNum(Math.round(hitRate))}٪` : '—'}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${total > 0 ? Math.min(100, Math.max(0, hitRate)) : 0}%`,
              background: rateColor,
            }}
          />
        </div>
        {total === 0 && (
          <p className="mt-1.5 text-[11px] text-zinc-500">
            هنوز ارزیابی‌ای ثبت نشده — مدل پس از گذشت روزهای پیش‌بینی‌شده، خودش را ارزیابی می‌کند
          </p>
        )}
      </div>

      {lastMistakes.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-zinc-300">آخرین اشتباهات مدل:</p>
          <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-800/60 p-2">
            {lastMistakes.map((m, i) => {
              const oc = outcomeMeta(m.outcome)
              return (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2 rounded-md bg-zinc-950/50 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] leading-5 text-zinc-300">{m.note}</p>
                    <p className="text-[10px] text-zinc-600">{faDateShort(m.date)}</p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-[9px] ${oc.chip}`}>
                    {oc.fa}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
