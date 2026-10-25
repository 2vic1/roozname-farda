'use client'

// ─── چرخ زودیاک SVG — چارت تولد غربی (طالع سمت چپ، پادساعت‌گرد) ───
import { SIGNS_FA, SIGNS_GLYPH, PLANET_GLYPH } from '@/lib/natal'
import type { WesternChart } from '@/lib/natal'

const CX = 210
const CY = 210

function pt(angleDeg: number, r: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) }
}

const SIGN_COLORS = [
  '#f87171', '#a3e635', '#22d3ee', '#67e8f9', '#fbbf24', '#4ade80',
  '#f472b6', '#ef4444', '#facc15', '#fb923c', '#94a3b8', '#38bdf8',
]

export function ZodiacWheel({ western }: { western: WesternChart }) {
  const ascOffset = western.asc % 30
  // زاویه صفحه: طالع = ۱۸۰° (ساعت ۹)، افزایش طول = پادساعت‌گرد
  const toScreen = (lon: number): number => {
    let rel = ((lon - western.asc) % 360 + 360) % 360
    return 180 - rel
  }

  // مرزهای برج
  const boundaries: number[] = []
  for (let i = 0; i < 12; i++) {
    boundaries.push(toScreen(i * 30 - ascOffset + 0.0001))
  }

  // سیارات با رفع تصادم شعاعی
  const placed = western.planets
    .map((p) => ({ ...p, screen: toScreen(p.lon), ring: false }))
    .sort((a, b) => a.screen - b.screen)
  {
    let lastAngle = -999
    let ringFlip = false
    for (const p of placed) {
      if (Math.abs(p.screen - lastAngle) < 8) {
        ringFlip = !ringFlip
        p.ring = ringFlip
      } else {
        ringFlip = false
        p.ring = false
      }
      lastAngle = p.screen
    }
  }

  return (
    <svg viewBox="0 0 420 420" className="mx-auto w-full max-w-[420px]" dir="ltr" role="img" aria-label="چرخ زودیاک چارت تولد">
      <defs>
        <radialGradient id="wheelGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#581c87" stopOpacity="0.35" />
          <stop offset="70%" stopColor="#18181b" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#09090b" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={204} fill="url(#wheelGlow)" stroke="#3f3f46" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={168} fill="none" stroke="#52525b" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={126} fill="none" stroke="#3f3f46" strokeWidth="0.8" />
      <circle cx={CX} cy={CY} r={80} fill="none" stroke="#27272a" strokeWidth="0.7" />

      {/* برش‌های برج — بخش i = برج (ascSign+i) */}
      {boundaries.map((ang, i) => {
        const p1 = pt(ang, 204)
        const p2 = pt(ang, 168)
        const mid = ang + 15
        const labelPos = pt(mid, 186)
        const signIdx = (western.ascSign + i) % 12
        return (
          <g key={i}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#52525b" strokeWidth="1" />
            <text
              x={labelPos.x} y={labelPos.y - 6}
              textAnchor="middle" fontSize="13" fill={SIGN_COLORS[signIdx]}
            >
              {SIGNS_GLYPH[signIdx]}
            </text>
            <text
              x={labelPos.x} y={labelPos.y + 10}
              textAnchor="middle" fontSize="8.5" fill="#a1a1aa"
            >
              {SIGNS_FA[signIdx]}
            </text>
          </g>
        )
      })}

      {/* خطوط خانه (سیگنوس طالع — ۱۲ خانه از برج طالع) */}
      {boundaries.map((ang, i) => {
        const p1 = pt(ang, 168)
        const p2 = pt(ang, 126)
        return (
          <line key={`h${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#71717a" strokeWidth="0.7" strokeDasharray="2 3" />
        )
      })}

      {/* خط طالع (ASC) و میانه آسمان (MC) */}
      {(() => {
        const ascA = 180
        const descA = 0
        const a1 = pt(ascA, 204)
        const a2 = pt(descA, 204)
        const mcA = toScreen(western.mc)
        const icA = toScreen(western.mc + 180)
        const m1 = pt(mcA, 204)
        const m2 = pt(icA, 204)
        return (
          <>
            <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} stroke="#e4e4e7" strokeWidth="1.6" />
            <text x={pt(ascA, 215).x} y={pt(ascA, 215).y} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#e4e4e7">ASC</text>
            <line x1={m1.x} y1={m1.y} x2={m2.x} y2={m2.y} stroke="#fbbf24" strokeWidth="1.2" strokeDasharray="4 3" />
            <text x={pt(mcA, 215).x} y={pt(mcA, 215).y} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#fbbf24">MC</text>
          </>
        )
      })()}

      {/* خطوط جنبه در مرکز */}
      {western.aspects.slice(0, 10).map((a, i) => {
        const pa = western.planets.find((p) => p.body === a.a)
        const pb = western.planets.find((p) => p.body === a.b)
        if (!pa || !pb) return null
        const p1 = pt(toScreen(pa.lon), 80)
        const p2 = pt(toScreen(pb.lon), 80)
        return (
          <line
            key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke={a.hard ? (a.tight ? '#dc2626' : '#f87171') : a.tight ? '#10b981' : '#34d399'}
            strokeWidth={a.tight ? 1.6 : 0.9}
            opacity={a.hard ? 0.75 : 0.6}
          >
            <title>{`${a.aFa} ${a.aspectFa} ${a.bFa} (مدار ${a.orb.toFixed(1)}°)`}</title>
          </line>
        )
      })}

      {/* سیارات */}
      {placed.map((p) => {
        const r = p.ring ? 152 : 138
        const pos = pt(p.screen, r)
        const degPos = pt(p.screen, r - 13)
        return (
          <g key={p.body}>
            <circle cx={pos.x} cy={pos.y} r={10.5} fill={p.retro ? '#1c1917' : '#18181b'} stroke={p.retro ? '#f87171' : '#a78bfa'} strokeWidth="1" />
            <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="11" fill="#f4f4f5">
              {PLANET_GLYPH[p.body] ?? '•'}
            </text>
            <text x={degPos.x} y={degPos.y + 3} textAnchor="middle" fontSize="7.5" fill="#a1a1aa">
              {Math.floor(p.lon % 30)}°{p.retro ? '℞' : ''}
            </text>
            <title>{`${p.fa} — ${p.degText} — خانه ${p.house}${p.dignity ? ` — ${p.dignity}` : ''}`}</title>
          </g>
        )
      })}

      {/* مرکز: عنصر مسلط */}
      <text x={CX} y={CY - 4} textAnchor="middle" fontSize="11" fill="#a78bfa" fontWeight="bold">
        {western.dominantElement}
      </text>
      <text x={CX} y={CY + 12} textAnchor="middle" fontSize="8.5" fill="#71717a">
        {western.dominantModality}
      </text>
    </svg>
  )
}
