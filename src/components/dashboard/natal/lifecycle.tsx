'use client'

// ─── نمودار چرخه زندگی — چهار منحنی (شغلی/عاطفی/مالی/احساسی) + نوار دشاها ───
import type { LifeCycle } from '@/lib/natal'
import { faNum } from '../types'

const W = 760
const H = 300
const PAD_L = 34
const PAD_R = 12
const PAD_T = 14
const PAD_B = 46
const MAX_AGE = 90

const CURVES = [
  { key: 'career' as const, fa: 'شغلی', color: '#f59e0b' },
  { key: 'love' as const, fa: 'عاطفی', color: '#fb7185' },
  { key: 'money' as const, fa: 'مالی', color: '#34d399' },
  { key: 'feelings' as const, fa: 'احساسی', color: '#a78bfa' },
]

export function LifeCycleChart({ life }: { life: LifeCycle }) {
  const x = (age: number) => PAD_L + (age / MAX_AGE) * (W - PAD_L - PAD_R)
  const y = (score: number) => PAD_T + (1 - score / 100) * (H - PAD_T - PAD_B)

  const path = (key: 'career' | 'love' | 'money' | 'feelings'): string => {
    return life.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.age).toFixed(1)},${y(p[key]).toFixed(1)}`)
      .join(' ')
  }

  const currentX = x(Math.min(life.currentAge, MAX_AGE))

  return (
    <div dir="ltr" className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="نمودار چرخه زندگی">
        {/* شبکه */}
        {[0, 25, 50, 75, 100].map((s) => (
          <g key={s}>
            <line x1={PAD_L} y1={y(s)} x2={W - PAD_R} y2={y(s)} stroke={s === 50 ? '#3f3f46' : '#27272a'} strokeWidth="0.8" />
            <text x={PAD_L - 4} y={y(s) + 3} textAnchor="end" fontSize="8" fill="#71717a">{s}</text>
          </g>
        ))}
        {[0, 15, 30, 45, 60, 75, 90].map((a) => (
          <g key={a}>
            <line x1={x(a)} y1={PAD_T} x2={x(a)} y2={H - PAD_B} stroke="#27272a" strokeWidth="0.5" />
            <text x={x(a)} y={H - PAD_B + 12} textAnchor="middle" fontSize="8.5" fill="#71717a">
              {faNum(a)}
            </text>
          </g>
        ))}
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#52525b">سن (سال)</text>

        {/* نوار دشاها */}
        {life.bands.map((b, i) => {
          const x1 = x(Math.min(b.fromAge, MAX_AGE))
          const x2 = x(Math.min(b.toAge, MAX_AGE))
          const colors = ['#7c2d12', '#1e3a5f', '#3b0764', '#064e3b', '#713f12', '#4c0519', '#083344']
          return (
            <g key={i}>
              <rect x={x1} y={H - PAD_B + 18} width={Math.max(2, x2 - x1)} height={14} fill={colors[i % colors.length]} opacity="0.85" rx="2" />
              {x2 - x1 > 34 && (
                <text x={(x1 + x2) / 2} y={H - PAD_B + 28.5} textAnchor="middle" fontSize="8" fill="#e4e4e7">
                  {b.lordFa}
                </text>
              )}
              <title>{`دشا ${b.lordFa}: ${b.fromAge} تا ${b.toAge} سالگی`}</title>
            </g>
          )
        })}

        {/* عصرهای طلایی */}
        {life.goldenAges.map((g, i) => (
          <g key={`g${i}`}>
            <circle cx={x(g.age)} cy={PAD_T + 6} r={4} fill="#fde047" opacity="0.9" />
            <title>{`عصر طلایی: ${g.age} سالگی — ${g.note}`}</title>
          </g>
        ))}

        {/* خط سن جاری */}
        {life.currentAge >= 0 && life.currentAge <= MAX_AGE && (
          <g>
            <line x1={currentX} y1={PAD_T} x2={currentX} y2={H - PAD_B} stroke="#e4e4e7" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            <text x={currentX + 3} y={PAD_T + 9} fontSize="8.5" fill="#e4e4e7">الان</text>
          </g>
        )}

        {/* منحنی‌ها */}
        {CURVES.map((c) => (
          <path key={c.key} d={path(c.key)} fill="none" stroke={c.color} strokeWidth="1.8" opacity="0.92" />
        ))}

        {/* نقاط اوج */}
        {([
          { p: life.peakCareer, c: '#f59e0b' },
          { p: life.peakLove, c: '#fb7185' },
          { p: life.peakMoney, c: '#34d399' },
          { p: life.peakFeelings, c: '#a78bfa' },
        ]).map((m, i) => (
          <circle key={i} cx={x(m.p.age)} cy={y(m.p[m.p === life.peakCareer ? 'career' : m.p === life.peakLove ? 'love' : m.p === life.peakMoney ? 'money' : 'feelings'])} r={3.2} fill={m.c} stroke="#09090b" strokeWidth="1">
            <title>{`اوج: ${m.p.age} سالگی`}</title>
          </circle>
        ))}
      </svg>
      {/* راهنما */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3" dir="rtl">
        {CURVES.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span className="inline-block h-2 w-4 rounded-full" style={{ background: c.color }} />
            {c.fa}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-yellow-300">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-300" />
          عصر طلایی
        </span>
      </div>
    </div>
  )
}
