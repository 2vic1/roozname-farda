'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, MoonStar, MoveDiagonal, Sparkles, Swords } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { faNum, levelMeta, type DashboardData } from './types'

type WarAstroBrief = NonNullable<DashboardData['warAstro']>

// ─── سطح هشدار آسمانی — آستانه‌های همسان با موتور استرولوزی جنگ (۸۰/۶۲/۴۵/۲۸) ───
export function astroLevel(v: number): 'calm' | 'watch' | 'elevated' | 'high' | 'critical' {
  return v >= 80 ? 'critical' : v >= 62 ? 'high' : v >= 45 ? 'elevated' : v >= 28 ? 'watch' : 'calm'
}

export type FusionStatus = 'aligned' | 'partial' | 'divergent'

export interface FusionResult {
  fused: number
  status: FusionStatus
  diff: number
}

// ─── موتور تلفیق: ۶۰٪ علمی (سریع و دادهمحور) + ۴۰٪ آسمانی (ساختاری و کند) ───
// هم‌راستایی دو لایه خودش سیگنال است: هم‌صدا = تقویت، واگرایی = ریسک غافلگیری
export function fuseScores(sci: number, astro: number): FusionResult {
  const base = 0.6 * sci + 0.4 * astro
  const diff = Math.abs(sci - astro)
  const status: FusionStatus = diff <= 8 ? 'aligned' : diff <= 20 ? 'partial' : 'divergent'
  const adj = status === 'aligned' ? 4 : status === 'divergent' ? -4 : 0
  const fused = Math.max(0, Math.min(100, Math.round(base + adj)))
  return { fused, status, diff }
}

const STATUS_META: Record<
  FusionStatus,
  { fa: string; chip: string; Icon: typeof CheckCircle2 }
> = {
  aligned: {
    fa: 'هم‌راستا',
    chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    Icon: CheckCircle2,
  },
  partial: {
    fa: 'همگرایی نسبی',
    chip: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    Icon: MoveDiagonal,
  },
  divergent: {
    fa: 'واگرایی',
    chip: 'border-red-500/40 bg-red-500/10 text-red-400',
    Icon: MoveDiagonal,
  },
}

function fusionDesc(status: FusionStatus, sci: number, astro: number): string {
  const astroHotter = astro > sci
  if (status === 'aligned') return 'هر دو لایه هم‌صدا هستند — قابلیت اتکای سیگنال در بالاترین حد است'
  if (status === 'partial')
    return astroHotter
      ? 'لایه آسمانی کمی جلوتر است — پنجره‌های سماوی از خبرها داغ‌تر'
      : 'لایه علمی کمی جلوتر است — تنش داده‌ها از چرخه‌های آسمانی شدیدتر'
  return astroHotter
    ? 'آسمان از داده‌ها داغ‌تر است — احتمال تحولی که خبرها هنوز نشان نمی‌دهند'
    : 'داده‌ها از آسمان داغ‌ترند — تنش خبری زودگذر یا پنجره سماوی سرد'
}

// ─── گیج نیم‌دایره فشرده با قطب‌بندی رنگی مرجع و انیمیشن ───
function SemiGauge({
  value,
  color,
  caption,
  label,
}: {
  value: number
  color: string
  caption: string
  label: string
}) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setShown(value), 200)
    return () => clearTimeout(t)
  }, [value])

  const R = 86
  const cx = 110
  const cy = 100
  // پارامتری زاویه: ۰ = سر راست (مقدار صفر)، π/2 = اوج قوس، π = سر چپ (مقدار ۱۰۰)
  const pt = (phi: number, r: number) => ({
    x: cx + r * Math.cos(phi),
    y: cy - r * Math.sin(phi),
  })
  const arcPath = (phi1: number, phi2: number, r: number) => {
    const p1 = pt(phi1, r)
    const p2 = pt(phi2, r)
    // حرکت از راست به چپ از بالای قوس = پادساعتگرد صفحه‌ای → sweep=0
    const large = Math.abs(phi2 - phi1) > Math.PI ? 1 : 0
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 0 ${p2.x} ${p2.y}`
  }

  const fill = Math.min(100, Math.max(0, shown))

  return (
    <svg
      viewBox="0 0 220 122"
      className="w-full max-w-[225px]"
      dir="ltr"
      role="img"
      aria-label={label}
    >
      {/* قطب‌بندی رنگی مرجع — همسان با گیج علمی */}
      {[
        { from: 0, to: 20, c: '#10b981' },
        { from: 20, to: 40, c: '#eab308' },
        { from: 40, to: 60, c: '#f97316' },
        { from: 60, to: 80, c: '#ef4444' },
        { from: 80, to: 100, c: '#dc2626' },
      ].map((s) => (
        <path
          key={s.from}
          d={arcPath(0, Math.PI, R)}
          pathLength={100}
          stroke={s.c}
          strokeWidth={13}
          fill="none"
          strokeDasharray={`${s.to - s.from - 1.5} ${100 - (s.to - s.from) + 1.5}`}
          strokeDashoffset={-s.from}
          opacity={0.14}
        />
      ))}
      {/* قوس پرشونده */}
      {fill > 0.5 && (
        <path
          d={arcPath(0, Math.PI, R)}
          pathLength={100}
          stroke={color}
          strokeWidth={13}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${100 - fill}`}
          style={{
            transition: 'stroke-dasharray 1.2s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.6s',
            filter: `drop-shadow(0 0 6px ${color}55)`,
          }}
        />
      )}
      <text x={cx} y={cy - 16} textAnchor="middle" fill={color} fontSize="35" fontWeight="900">
        {faNum(value)}
      </text>
      <text x={cx} y={cy + 3} textAnchor="middle" fill="#71717a" fontSize="9.5">
        {caption}
      </text>
    </svg>
  )
}

// ─── کارت لایه آسمانی + تلفیقی (ستون سمت چپ ردیف گیج‌ها) ───
export function SkyFusionGauges({
  riskScore,
  warAstro,
}: {
  riskScore: number
  warAstro: WarAstroBrief | null | undefined
}) {
  const astro = typeof warAstro?.index === 'number' ? warAstro.index : null
  const fusion = astro !== null ? fuseScores(riskScore, astro) : null
  const astroMeta = astro !== null ? levelMeta(astroLevel(astro)) : null
  const fusionMeta = fusion ? levelMeta(astroLevel(fusion.fused)) : null
  const st = fusion ? STATUS_META[fusion.status] : null

  return (
    <Card className="h-full border-zinc-800/70 bg-zinc-900/50">
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-3">
          {/* ─── ستون ۱: هشدار آسمانی جنگ ─── */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <MoonStar className="h-4 w-4 text-violet-400" />
              <h3 className="text-xs font-black text-zinc-100">هشدار آسمانی جنگ</h3>
            </div>
            <p className="text-[9px] text-zinc-500">
              موتور استرولوزی جنگ — چارت ایران، آمریکا، اسرائیل و رهبران
            </p>

            {astro !== null && astroMeta ? (
              <>
                <div className="mt-2 flex w-full justify-center">
                  <SemiGauge
                    value={astro}
                    color={astroMeta.color}
                    caption="شاخص آسمانی از ۱۰۰"
                    label={`هشدار آسمانی جنگ: ${astroMeta.fa} — امتیاز ${faNum(astro)}`}
                  />
                </div>
                <span
                  className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-bold ${astroMeta.chip}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: astroMeta.color }} />
                  سطح آسمانی: {astroMeta.fa}
                </span>
                <p className="mt-1.5 max-w-[260px] text-center text-[10px] leading-4 text-zinc-400 line-clamp-2">
                  {warAstro?.note}
                </p>
                {/* پنج جزء سازنده شاخص آسمانی */}
                {(warAstro?.parts ?? []).length > 0 && (
                  <div className="mt-2.5 w-full max-w-[250px] space-y-1" aria-label="اجزای شاخص آسمانی">
                    {(warAstro?.parts ?? []).map((p) => (
                      <div key={p.label}>
                        <div className="flex items-center justify-between text-[9px] leading-3 text-zinc-500">
                          <span>{p.label}</span>
                          <span className="tabular-nums text-zinc-400">{faNum(p.value)}</span>
                        </div>
                        <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-violet-500/80 transition-all duration-700"
                            style={{ width: `${Math.min(100, Math.max(0, p.value))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                <MoonStar className="h-6 w-6 text-zinc-700" />
                <p className="max-w-[220px] text-[11px] leading-5 text-zinc-500">
                  لایه آسمانی هنوز در دسترس نیست — موتور استرولوزی جنگ در حال محاسبه چارت‌هاست،
                  چند لحظه بعد دوباره بررسی کنید
                </p>
              </div>
            )}
          </div>

          {/* ─── ستون ۲: هشدار تلفیقی ─── */}
          <div className="flex flex-col items-center border-t border-zinc-800/60 pt-4 sm:border-s sm:border-t-0 sm:pt-0">
            <div className="flex items-center gap-1.5">
              <Swords className="h-4 w-4 text-red-400" />
              <h3 className="text-xs font-black text-zinc-100">هشدار تلفیقی — علمی + آسمانی</h3>
            </div>
            <p className="text-[9px] text-zinc-500">پاسخ نهایی سامانه از ترکیب دو لایه</p>

            {fusion && fusionMeta && st && astro !== null ? (
              <>
                <div className="mt-2 flex w-full justify-center">
                  <SemiGauge
                    value={fusion.fused}
                    color={fusionMeta.color}
                    caption="تلفیق نهایی از ۱۰۰"
                    label={`هشدار تلفیقی: ${fusionMeta.fa} — امتیاز ${faNum(fusion.fused)}`}
                  />
                </div>
                <span
                  className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-bold ${fusionMeta.chip}`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: fusionMeta.color }}
                  />
                  سطح تلفیقی: {fusionMeta.fa}
                </span>
                <span
                  className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${st.chip}`}
                >
                  <st.Icon className="h-3 w-3" />
                  {st.fa} — اختلاف {faNum(fusion.diff)} واحدی
                </span>
                <p className="mt-1.5 max-w-[260px] text-center text-[10px] leading-4 text-zinc-400">
                  {fusionDesc(fusion.status, riskScore, astro)}
                </p>
              </>
            ) : (
              <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                <Swords className="h-6 w-6 text-zinc-700" />
                <p className="max-w-[220px] text-[11px] leading-5 text-zinc-500">
                  تلفیق پس از آماده‌شدن هر دو لایه محاسبه می‌شود
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ─── نوار فرمول تلفیق ─── */}
        {fusion && astro !== null && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-3 py-2 text-[10px] text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span className="font-bold text-zinc-300">فرمول تلفیق:</span>
            <span className="tabular-nums">
              ۶۰٪ علمی ({faNum(riskScore)}) + ۴۰٪ آسمانی ({faNum(astro)})
            </span>
            <span className="text-zinc-600">→</span>
            <span className="text-sm font-black tabular-nums" style={{ color: fusionMeta?.color }}>
              {faNum(fusion.fused)}
            </span>
            <span className="text-zinc-600">از ۱۰۰</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">
              علمی سریع و دادهمحور است، آسمانی ساختاری و کند — واگرایی این دو خودش یک سیگنال است
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
