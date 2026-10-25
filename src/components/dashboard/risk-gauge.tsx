'use client'

import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { faNum, levelMeta } from './types'

// گیج دایره‌ای بزرگ سطح هشدار (۰ تا ۱۰۰) با انیمیشن
export function RiskGauge({
  score,
  level,
  trend,
}: {
  score: number
  level: string
  trend: string
}) {
  const meta = levelMeta(level)
  const [shown, setShown] = useState(0)

  // انیمیشن پرشدن قوس بعد از ماونت
  useEffect(() => {
    const t = setTimeout(() => setShown(score), 150)
    return () => clearTimeout(t)
  }, [score])

  const size = 280
  const stroke = 18
  const r = (size - stroke) / 2 - 6
  const c = 2 * Math.PI * r
  const filled = (Math.min(100, Math.max(0, shown)) / 100) * c

  const trendFa =
    trend === 'up' ? 'در حال افزایش' : trend === 'down' ? 'در حال کاهش' : 'پایدار'
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor =
    trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-emerald-400' : 'text-zinc-400'

  return (
    <div className="flex flex-col items-center">
      <div className="relative" role="img" aria-label={`سطح هشدار: ${meta.fa} — امتیاز ${faNum(score)}`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {/* قطاع‌های رنگی مرجع */}
          {[
            { from: 0, to: 20, color: '#10b981' },
            { from: 20, to: 40, color: '#eab308' },
            { from: 40, to: 60, color: '#f97316' },
            { from: 60, to: 80, color: '#ef4444' },
            { from: 80, to: 100, color: '#dc2626' },
          ].map((s) => {
            const dashFrom = (s.from / 100) * c
            const dashLen = ((s.to - s.from) / 100) * c
            return (
              <circle
                key={s.from}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dashLen - 3} ${c - dashLen + 3}`}
                strokeDashoffset={-dashFrom}
                strokeLinecap="butt"
                opacity={0.16}
              />
            )
          })}
          {/* قوس اصلی */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={meta.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c - filled}`}
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.6s' }}
          />
        </svg>
        {/* عدد مرکزی */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-6xl font-black leading-none tabular-nums"
            style={{ color: meta.color }}
          >
            {faNum(score)}
          </span>
          <span className="mt-1 text-xs text-zinc-500">از ۱۰۰</span>
        </div>
        {/* نقطه چشمک‌زن */}
        <span
          className="radar-pulse absolute end-1/2 top-3 h-3 w-3 rounded-full"
          style={{ background: meta.color, boxShadow: `0 0 12px ${meta.color}` }}
          aria-hidden
        />
      </div>

      <div
        className={`mt-1 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold ${meta.chip}`}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: meta.color }}
          />
          <span
            className="relative inline-flex h-2.5 w-2.5 rounded-full"
            style={{ background: meta.color }}
          />
        </span>
        سطح هشدار: {meta.fa}
      </div>

      <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${trendColor}`}>
        <TrendIcon className="h-3.5 w-3.5" />
        {trendFa}
      </div>
    </div>
  )
}
