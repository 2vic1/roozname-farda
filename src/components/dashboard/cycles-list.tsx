'use client'

import { Badge } from '@/components/ui/badge'
import {
  Compass,
  Sigma,
  Sun,
  Landmark,
  Waves,
  Infinity as InfinityIcon,
  CalendarClock,
} from 'lucide-react'
import { CYCLE_FAMILY_FA, CYCLE_FAMILY_ORDER, faDateShort, faNum } from './types'
import type { CycleData } from './types'

const FAMILY_META: Record<string, { icon: typeof Compass; chip: string }> = {
  gann: { icon: Compass, chip: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  fibonacci: { icon: Sigma, chip: 'bg-teal-500/15 text-teal-400 border-teal-500/40' },
  solar: { icon: Sun, chip: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40' },
  event: { icon: Landmark, chip: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40' },
  hurst: { icon: Waves, chip: 'bg-orange-500/15 text-orange-400 border-orange-500/40' },
  century: { icon: InfinityIcon, chip: 'bg-red-500/15 text-red-400 border-red-500/40' },
}

function WeightStars({ weight }: { weight: number }) {
  const w = Math.min(5, Math.max(0, Math.round(weight)))
  return (
    <span
      className="text-[11px] tracking-widest text-amber-500"
      title={`شدت چرخه: ${faNum(w)} از ۵`}
      aria-label={`شدت چرخه: ${faNum(w)} از ۵`}
    >
      {'★'.repeat(w)}
      <span className="text-zinc-700">{'★'.repeat(5 - w)}</span>
    </span>
  )
}

// چرخه‌های زمانی پیش رو — گروه‌بندی بر اساس خانواده
export function CyclesList({ cycles }: { cycles: CycleData[] }) {
  if (!cycles.length) {
    return (
      <div className="py-10 text-center text-sm text-zinc-500">
        چرخه‌ای برای نمایش نیست — بات کلان‌روند را اجرا کنید
      </div>
    )
  }

  const sorted = [...cycles].sort((a, b) => a.daysLeft - b.daysLeft)
  const groups = CYCLE_FAMILY_ORDER.map((fam) => ({
    fam,
    items: sorted.filter((c) => c.family === fam),
  })).filter((g) => g.items.length > 0)
  // خانواده‌های ناشناخته هم نمایش داده شوند
  const unknown = sorted.filter((c) => !CYCLE_FAMILY_ORDER.includes(c.family))
  if (unknown.length) groups.push({ fam: 'other', items: unknown })

  return (
    <div className="space-y-6">
      {groups.map(({ fam, items }) => {
        const meta = FAMILY_META[fam] ?? { icon: CalendarClock, chip: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40' }
        const Icon = meta.icon
        return (
          <section key={fam}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                <Icon className="h-3.5 w-3.5 text-amber-500" />
              </span>
              {CYCLE_FAMILY_FA[fam] ?? fam}
              <span className="text-[11px] font-normal text-zinc-600">
                ({faNum(items.length)} چرخه)
              </span>
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c) => {
                const soon = c.daysLeft <= 7
                const urgent = c.daysLeft <= 3
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      urgent
                        ? 'border-red-500/40 bg-red-500/5 radar-pulse'
                        : soon
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-zinc-800/70 bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`gap-1 text-[10px] ${
                          urgent
                            ? 'border-red-500/50 bg-red-500/10 text-red-300'
                            : soon
                              ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                              : 'border-zinc-700 text-zinc-400'
                        }`}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {c.daysLeft <= 0
                          ? 'امروز!'
                          : `${faNum(c.daysLeft)} روز مانده`}
                      </Badge>
                      <WeightStars weight={c.weight} />
                    </div>
                    <p className="mt-2 text-sm font-medium leading-6 text-zinc-200">{c.label}</p>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                      <span>{faDateShort(c.date)}</span>
                      <span dir="ltr" className="text-zinc-600">
                        {c.date}
                      </span>
                    </div>
                    {c.note && (
                      <p className="mt-1.5 text-[11px] leading-5 text-zinc-500">{c.note}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
