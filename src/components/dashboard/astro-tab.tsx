'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CalendarDays,
  CircleAlert,
  Moon,
  MoonStar,
  Orbit,
  RefreshCw,
  Sparkles,
  Star,
  Sun,
} from 'lucide-react'
import { faNum } from './types'
import type { AstroAnalysis, AstroFactor } from '@/lib/astro'

// رنگ امتیاز: قرمز/نارنجی/کهربایی/سبز — هماهنگ با سطوح هشدار سامانه
function scoreColor(score: number): string {
  if (score >= 75) return '#dc2626'
  if (score >= 55) return '#f97316'
  if (score >= 35) return '#eab308'
  return '#10b981'
}

const KIND_META: Record<AstroFactor['kind'], { fa: string; chip: string }> = {
  natal: { fa: 'ترانزیت چارت', chip: 'border-violet-500/40 bg-violet-500/10 text-violet-300' },
  sky: { fa: 'جنبه آسمانی', chip: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  eclipse: { fa: 'گرفتگی', chip: 'border-red-500/40 bg-red-500/10 text-red-300' },
  phase: { fa: 'اطوار ماه', chip: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300' },
  retro: { fa: 'برگشتی', chip: 'border-teal-500/40 bg-teal-500/10 text-teal-300' },
}

// ─── تب استرولوژی: فقط و فقط نجوم جهان‌بین — جدا از موتور اصلی ریسک ───
export function AstroTab() {
  const [data, setData] = useState<AstroAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/astro', { cache: 'no-store' })
      const j = (await res.json()) as { ok: boolean; astro?: AstroAnalysis; error?: string }
      if (j.ok && j.astro) {
        setData(j.astro)
        setError(null)
      } else {
        setError(j.error ?? 'خطا در محاسبات نجومی')
      }
    } catch {
      setError('خطای شبکه در دریافت تحلیل استرولوژی')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // محاسبات نجومی هر ۱۰ دقیقه تازه می‌شود
    const t = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [load])

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 bg-zinc-800/50" />
        <Skeleton className="h-64 bg-zinc-800/50" />
        <Skeleton className="h-40 bg-zinc-800/50" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <Alert variant="destructive" className="border-red-500/40 bg-red-950/40 text-red-200">
        <CircleAlert className="h-4 w-4" />
        <AlertTitle>خطا</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  const maxScore = Math.max(...data.daily.map((d) => d.score), 1)

  return (
    <div className="space-y-5">
      {/* ─── امتیاز کل + کشورها ─── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-violet-500/30 bg-violet-950/20 lg:col-span-1">
          <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <MoonStar className="h-6 w-6 text-violet-400" aria-hidden />
            <p className="text-xs text-zinc-400">تنش اختری کل (ایران/آمریکا/اسرائیل)</p>
            <p
              className="text-5xl font-black tabular-nums"
              style={{ color: scoreColor(data.overall) }}
            >
              {faNum(data.overall)}
              <span className="text-xl">٪</span>
            </p>
            <Badge
              variant="outline"
              className="border-violet-500/40 bg-violet-500/10 text-violet-300"
            >
              {data.levelFa}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/70 bg-zinc-900/50 lg:col-span-2">
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
              <Orbit className="h-4 w-4 text-violet-400" />
              فشار ترانزیت بر چارت هر کشور
            </h3>
            <div className="space-y-4">
              {data.countries.map((c) => (
                <div key={c.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-200">{c.name}</span>
                    <span
                      className="font-bold tabular-nums"
                      style={{ color: scoreColor(c.percent) }}
                    >
                      {faNum(c.percent)}٪
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${c.percent}%`,
                        background: scoreColor(c.percent),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-5 text-zinc-500">
              درصد هر کشور = فشار جنبه‌های سخت سیارات بر چارت تأسیس آن کشور؛ امتیاز کل = تنش
              ترکیبی مثلث بر سر جنگ.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── نقشه حرارتی ۶۱ روز ─── */}
      <Card className="border-zinc-800/70 bg-zinc-900/50">
        <CardContent className="p-4 sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
            <CalendarDays className="h-4 w-4 text-violet-400" />
            نقشه حرارتی اختری — ۶۱ روز آینده
          </h3>
          <div className="flex h-24 items-end gap-[2px] overflow-hidden" dir="ltr">
            {data.daily.map((d, i) => (
              <div
                key={d.date}
                className="min-w-[3px] flex-1 rounded-t transition-all"
                style={{
                  height: `${Math.max(6, (d.score / maxScore) * 100)}%`,
                  background: scoreColor(d.score),
                  opacity: i === 0 ? 1 : 0.75,
                  outline: i === 0 ? '2px solid rgba(255,255,255,0.5)' : 'none',
                }}
                title={`${d.date} — امتیاز ${d.score}`}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-zinc-600" dir="ltr">
            <span>امروز</span>
            <span>+۳۰ روز</span>
            <span>+۶۱ روز</span>
          </div>
        </CardContent>
      </Card>

      {/* ─── روزهای پرخطر حمله ─── */}
      <Card className="border-orange-500/25 bg-orange-950/10">
        <CardContent className="p-4 sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-orange-300">
            <Star className="h-4 w-4" />
            روزهای پرخطر حمله بر اساس استرولوژی
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {data.riskyDays.map((d) => (
              <div
                key={d.date}
                className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-zinc-100">{d.jalali}</p>
                    <p className="text-[10px] text-zinc-500" dir="ltr">
                      {d.date}
                    </p>
                  </div>
                  <span
                    className="rounded-lg px-2.5 py-1 text-lg font-black tabular-nums"
                    style={{ color: scoreColor(d.score), background: `${scoreColor(d.score)}1a` }}
                  >
                    {faNum(d.score)}٪
                  </span>
                </div>
                <ul className="space-y-1">
                  {d.reasons.slice(0, 4).map((r, i) => (
                    <li key={i} className="flex gap-1.5 text-[11px] leading-5 text-zinc-400">
                      <span className="text-violet-400">✦</span>
                      <span className="min-w-0">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── ترانزیت‌های فعال امروز ─── */}
      <Card className="border-zinc-800/70 bg-zinc-900/50">
        <CardContent className="p-4 sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
            <Sparkles className="h-4 w-4 text-violet-400" />
            عوامل اختری فعال امروز ({faNum(data.todayFactors.length)} عامل)
          </h3>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {data.todayFactors.map((f, i) => {
              const km = KIND_META[f.kind]
              return (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2"
                >
                  <Badge
                    variant="outline"
                    className={`shrink-0 px-1.5 text-[9px] font-normal ${km.chip}`}
                  >
                    {km.fa}
                  </Badge>
                  <p className="min-w-0 flex-1 text-[11px] leading-5 text-zinc-300">{f.text}</p>
                  <div className="flex w-16 shrink-0 items-center gap-1.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-violet-400"
                        style={{ width: `${Math.min(100, (f.weight / 15) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-zinc-500">
                      {faNum(Math.round(f.weight))}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── گرفتگی‌ها و اطوار ماه ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-zinc-800/70 bg-zinc-900/50">
          <CardContent className="p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
              <Sun className="h-4 w-4 text-amber-400" />
              گرفتگی‌های پیش‌رو
            </h3>
            <div className="space-y-2">
              {data.eclipses.slice(0, 4).map((e) => (
                <div
                  key={`${e.kind}-${e.date}`}
                  className={`rounded-lg border px-3 py-2 ${
                    e.inWindow
                      ? 'border-red-500/30 bg-red-950/20'
                      : 'border-zinc-800/60 bg-zinc-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-200">
                      {e.kind === 'solar' ? '🌞 خورشیدگرفتگی' : '🌑 ماه‌گرفتگی'} — {e.jalali}
                    </span>
                    <Badge
                      variant="outline"
                      className={`px-1.5 text-[9px] ${
                        e.inWindow
                          ? 'border-red-500/40 bg-red-500/10 text-red-300'
                          : 'border-zinc-700 text-zinc-500'
                      }`}
                    >
                      {e.inWindow ? 'در پنجره ۶۱ روز' : 'خارج از پنجره'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    درجه: {e.degree}
                    {e.hits.length > 0 && ` — مصادف با: ${e.hits.join('، ')}`}
                  </p>
                </div>
              ))}
              {data.eclipses.length === 0 && (
                <p className="text-xs text-zinc-500">گرفتگی‌ای در آینده نزدیک یافت نشد</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/70 bg-zinc-900/50">
          <CardContent className="p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
              <Moon className="h-4 w-4 text-zinc-300" />
              اطوار ماه و برگشتی‌ها
            </h3>
            {data.transits?.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-[11px] font-bold text-teal-300">
                  📌 رویدادهای دقیق پیش‌رو (به وقت تهران)
                </p>
                {data.transits.map((t) => (
                  <div
                    key={`${t.badge}-${t.at}`}
                    className={`rounded-lg border px-3 py-2 ${
                      t.badge === 'retro-start'
                        ? 'border-amber-500/30 bg-amber-950/20'
                        : t.badge === 'retro-end'
                          ? 'border-emerald-500/30 bg-emerald-950/20'
                          : 'border-violet-500/30 bg-violet-950/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs leading-6 text-zinc-200">
                        {t.badge === 'retro-start' ? '℞' : t.badge === 'retro-end' ? '↻' : '→'}{' '}
                        {t.detailFa}
                      </p>
                      <span className="shrink-0 rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {t.jalaliDate}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {data.phases.slice(0, 4).map((p) => (
                <div
                  key={`${p.kind}-${p.date}`}
                  className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-200">
                      {p.kind === 'new' ? '🌑 ماه نو' : '🌕 ماه کامل'} — {p.jalali}
                    </span>
                    <span className="text-[10px] text-zinc-500">{p.degree}</span>
                  </div>
                  {p.hits.length > 0 && (
                    <p className="mt-1 text-[10px] text-violet-300/80">
                      مصادف با: {p.hits.join('، ')}
                    </p>
                  )}
                </div>
              ))}
              {data.retrogrades.map((r) => (
                <div
                  key={r.planet}
                  className="rounded-lg border border-teal-500/25 bg-teal-950/20 px-3 py-2"
                >
                  <p className="text-xs font-bold text-teal-300">
                    ℞ {r.planet} برگشته
                    {r.untilDays !== null && (
                      <span className="font-normal text-zinc-400">
                        {' '}
                        — {faNum(r.untilDays)} روز تا مستقیم‌شدن
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-5 text-zinc-500">{r.note}</p>
                </div>
              ))}
              {data.retrogrades.length === 0 && (
                <p className="text-xs text-zinc-500">هیچ سیاره‌ای الان برگشته نیست</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── چارت‌های تأسیس ─── */}
      <Card className="border-zinc-800/70 bg-zinc-900/50">
        <CardContent className="p-4 sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
            <Orbit className="h-4 w-4 text-violet-400" />
            چارت‌های تأسیس کشورها (مبنای جهان‌بین)
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            {data.charts.map((c) => (
              <div
                key={c.key}
                className="rounded-lg border border-zinc-800/70 bg-zinc-950/50 p-3.5"
              >
                <p className="text-sm font-black text-zinc-100">{c.name}</p>
                <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">{c.place}</p>
                <div className="mt-3 space-y-1.5">
                  {[
                    { label: 'خورشید', val: c.sun },
                    { label: 'ماه', val: c.moon },
                    { label: 'مریخ', val: c.mars },
                    { label: 'زحل', val: c.saturn },
                    { label: 'پلوتو', val: c.pluto },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded bg-zinc-900/70 px-2 py-1 text-[11px]"
                    >
                      <span className="text-zinc-500">{row.label}</span>
                      <span className="font-bold tabular-nums text-violet-300">{row.val}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[9px] leading-4 text-zinc-600">{c.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── روش + سلب مسئولیت ─── */}
      <Alert className="border-violet-500/25 bg-violet-950/15 text-violet-200/90">
        <RefreshCw className="h-4 w-4" />
        <AlertTitle>روش محاسبه</AlertTitle>
        <AlertDescription>
          <ul className="mt-1 space-y-1">
            {data.methodFa.map((m, i) => (
              <li key={i} className="flex gap-1.5 text-[11px] leading-5">
                <span>•</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-violet-500/20 pt-2 text-[11px] leading-5 text-zinc-400">
            {data.disclaimer}
          </p>
        </AlertDescription>
      </Alert>
    </div>
  )
}
