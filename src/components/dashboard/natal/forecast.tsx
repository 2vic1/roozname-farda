'use client'

// ─── پنل پیش‌بینی ماهانه — سبک Xanastrology ───
// تاریخ دقیق تعاملات با پنجره ±۷ روز، قیاس تاریخی سیارات بیرونی،
// ستارگان ثابت، اطوار و گرفتگی‌ها + روایت هوش مصنوعی
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CircleAlert, Flame, History, Quote, Sparkles, Star, Sun, Moon } from 'lucide-react'
import { JALALI_MONTHS_FA, faYear } from '@/lib/jalali'
import type { MonthForecast } from '@/lib/natal'
import { faNum as faNumT } from '../types'

interface AiBlock {
  summary?: string
  career?: string
  love?: string
  money?: string
  feelings?: string
  luckyDays?: { day: number; why: string }[]
  cautionDays?: { day: number; why: string }[]
  xanNote?: string
}

function scoreColor(score: number): string {
  if (score >= 75) return '#dc2626'
  if (score >= 55) return '#f97316'
  if (score >= 35) return '#eab308'
  return '#10b981'
}

const DIMS = [
  { key: 'career' as const, fa: 'شغلی', icon: '💼' },
  { key: 'love' as const, fa: 'عاطفی', icon: '❤️' },
  { key: 'money' as const, fa: 'مالی', icon: '🪙' },
  { key: 'feelings' as const, fa: 'احساسی', icon: '🌊' },
]

const DIM_FA: Record<string, string> = { career: 'شغل', love: 'عشق', money: 'مال', feelings: 'احساس' }

export interface ForecastPanelProps {
  chartId?: string
  birth?: { jy: number; jm: number; jd: number; hour: number; minute: number; city: string }
  defaultJy?: number
  defaultJm?: number
}

export function ForecastPanel({ chartId, birth, defaultJy = 1405, defaultJm = 9 }: ForecastPanelProps) {
  const [jy, setJy] = useState(defaultJy)
  const [jm, setJm] = useState(defaultJm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fc, setFc] = useState<MonthForecast | null>(null)
  const [ai, setAi] = useState<AiBlock | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/astro/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartId, birth, jy, jm }),
      })
      const j = (await res.json()) as { ok: boolean; forecast?: MonthForecast; ai?: AiBlock; error?: string }
      if (j.ok && j.forecast) {
        setFc(j.forecast)
        setAi(j.ai ?? null)
      } else {
        setError(j.error ?? 'خطا در محاسبه پیش‌بینی')
      }
    } catch {
      setError('خطای شبکه')
    } finally {
      setLoading(false)
    }
  }, [chartId, birth, jy, jm])

  // پیش‌بینی خودکار ماه جاری در اولین نمایش
  useEffect(() => {
    void run()
    // تکیه بر سکوت عمدی قواعد exhaustive-deps در این پروژه
  }, [])

  const maxHeat = fc ? Math.max(...fc.heat.map((h) => h.score), 1) : 1

  return (
    <Card className="border-amber-500/25 bg-gradient-to-b from-amber-950/10 to-zinc-950/40">
      <CardContent className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-amber-300">
            <Sparkles className="h-4 w-4" />
            پیش‌بینی ماهانه اختری {birth || chartId ? '— شخصی' : '— عمومی (سبک Xanastrology)'}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={jm}
              onChange={(e) => setJm(Number(e.target.value))}
              className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200"
              aria-label="ماه جلالی"
            >
              {JALALI_MONTHS_FA.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={jy}
              onChange={(e) => setJy(Number(e.target.value))}
              className="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200"
              aria-label="سال جلالی"
            >
              {[1403, 1404, 1405, 1406, 1407, 1408, 1409].map((y) => (
                <option key={y} value={y}>{faYear(y)}</option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={run}
              disabled={loading}
              className="h-9 bg-amber-600 text-xs text-white hover:bg-amber-500"
            >
              {loading ? 'در حال محاسبه آسمان…' : 'پیش‌بینی کن'}
            </Button>
          </div>
        </div>

        {loading && !fc && (
          <div className="space-y-3">
            <div className="h-3 w-full animate-pulse rounded bg-zinc-800/70" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-800/60" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-zinc-800/50" />
            <p className="pt-2 text-center text-[11px] text-zinc-500">
              🛰️ اسکن ephemeris برای {faNumT(30)} روز + قیاس ۱۶۰ ساله تاریخ… تا ~۳۰ ثانیه
            </p>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="border-red-500/40 bg-red-950/40 text-red-200">
            <CircleAlert className="h-4 w-4" />
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {fc && (
          <div className="space-y-5">
            {/* امتیازها */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {DIMS.map((d) => (
                <div key={d.key} className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 text-center">
                  <p className="text-[10px] text-zinc-500">{d.icon} {d.fa}</p>
                  <p className="text-2xl font-black tabular-nums" style={{ color: scoreColor(fc.scores[d.key]) }}>
                    {faNumT(fc.scores[d.key])}
                  </p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full" style={{ width: `${fc.scores[d.key]}%`, background: scoreColor(fc.scores[d.key]) }} />
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-center">
                <p className="text-[10px] text-amber-400/80">⚡ شاخص ماه</p>
                <p className="text-2xl font-black tabular-nums text-amber-300">{faNumT(fc.scores.overall)}</p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${fc.scores.overall}%` }} />
                </div>
              </div>
            </div>

            {/* نقشه حرارتی روزانه */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-zinc-400">🔥 نقشه حرارتی روزهای ماه (شدت انرژی اختری)</p>
              <div className="flex items-end gap-[2px] overflow-hidden rounded-lg bg-zinc-950/60 p-2" dir="ltr">
                {fc.heat.map((h) => (
                  <div
                    key={h.day}
                    className="min-w-[4px] flex-1 rounded-t"
                    style={{
                      height: `${Math.max(8, (h.score / maxHeat) * 56)}px`,
                      background: scoreColor(h.score),
                      opacity: 0.85,
                    }}
                    title={`روز ${h.day} — شدت ${h.score}`}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-zinc-600" dir="ltr">
                <span>روز ۱</span>
                <span>روز {faNumT(fc.days)}</span>
              </div>
            </div>

            {/* روایت هوش مصنوعی */}
            {ai?.summary && (
              <div className="rounded-xl border border-violet-500/25 bg-violet-950/15 p-4">
                <p className="whitespace-pre-line text-[13px] leading-7 text-zinc-200">{ai.summary}</p>
              </div>
            )}

            {/* چهار محور روایت */}
            <div className="grid gap-3 md:grid-cols-2">
              {([
                { k: 'career' as const, fa: 'شغلی', icon: '💼', color: 'border-amber-500/25 bg-amber-950/10 text-amber-300' },
                { k: 'love' as const, fa: 'عاطفی', icon: '❤️', color: 'border-rose-500/25 bg-rose-950/10 text-rose-300' },
                { k: 'money' as const, fa: 'مالی', icon: '🪙', color: 'border-emerald-500/25 bg-emerald-950/10 text-emerald-300' },
                { k: 'feelings' as const, fa: 'احساسی', icon: '🌊', color: 'border-violet-500/25 bg-violet-950/10 text-violet-300' },
              ]).map((d) => (
                <div key={d.k} className={`rounded-xl border p-3.5 ${d.color}`}>
                  <p className="mb-1 text-xs font-black">{d.icon} محور {d.fa}</p>
                  <p className="text-[12px] leading-6 text-zinc-300">
                    {(ai?.[d.k] as string) || '—'}
                  </p>
                </div>
              ))}
            </div>

            {/* روزهای خوش/هشدار */}
            {((ai?.luckyDays?.length ?? 0) > 0 || (ai?.cautionDays?.length ?? 0) > 0) && (
              <div className="grid gap-3 md:grid-cols-2">
                {(ai?.luckyDays?.length ?? 0) > 0 && (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/10 p-3">
                    <p className="mb-2 text-xs font-black text-emerald-300">🍀 روزهای طلایی</p>
                    {ai?.luckyDays?.map((d, i) => (
                      <p key={i} className="text-[11px] leading-6 text-zinc-300">
                        <Badge variant="outline" className="ml-1.5 border-emerald-500/40 bg-emerald-500/10 text-[9px] text-emerald-300">
                          روز {faNumT(d.day)}
                        </Badge>
                        {d.why}
                      </p>
                    ))}
                  </div>
                )}
                {(ai?.cautionDays?.length ?? 0) > 0 && (
                  <div className="rounded-xl border border-red-500/25 bg-red-950/10 p-3">
                    <p className="mb-2 text-xs font-black text-red-300">⚠️ روزهای هشدار</p>
                    {ai?.cautionDays?.map((d, i) => (
                      <p key={i} className="text-[11px] leading-6 text-zinc-300">
                        <Badge variant="outline" className="ml-1.5 border-red-500/40 bg-red-500/10 text-[9px] text-red-300">
                          روز {faNumT(d.day)}
                        </Badge>
                        {d.why}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* قیاس تاریخی — امضای Xanastrology */}
            {fc.analogs.some((a) => a.windows.length > 0) && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4">
                <p className="mb-2.5 flex items-center gap-1.5 text-xs font-black text-amber-300">
                  <History className="h-3.5 w-3.5" />
                  قیاس تاریخی — تاریخ تکرار می‌شود
                </p>
                <div className="space-y-2">
                  {fc.analogs.filter((a) => a.windows.length > 0).map((a, i) => (
                    <div key={i} className="rounded-lg bg-zinc-950/50 px-3 py-2">
                      <p className="text-[12px] font-bold text-zinc-200">
                        {a.planetFa} در {a.signFa}
                        <span className="mr-2 font-normal text-amber-400/90">
                          ← آخرین دوره‌ها: {a.windows.map((w) => `${faYear(w.from)} تا ${faYear(w.to)}`).join('، ')}
                        </span>
                      </p>
                      {a.windows.find((w) => w.note) && (
                        <p className="mt-0.5 text-[10.5px] leading-5 text-zinc-500">
                          {a.windows.find((w) => w.note)?.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* تعاملات دقیق با پنجره فعال */}
            {fc.skyEvents.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  تعاملات دقیق — تاریخ و پنجره فعال (تأثیر از چند روز قبل و بعد کاملاً فعال است)
                </p>
                <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1 natal-scroll">
                  {fc.skyEvents.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2">
                      <Badge variant="outline" className={`shrink-0 px-1.5 text-[9px] ${e.hard ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>
                        {e.aspectFa}
                      </Badge>
                      <p className="min-w-0 flex-1 text-[11.5px] text-zinc-300">
                        <b>{e.aFa}</b> {e.aspectFa} <b>{e.bFa}</b>
                        {e.passes > 1 && <span className="mr-1 text-amber-400">({faNumT(e.passes)}×گذر)</span>}
                      </p>
                      <div className="shrink-0 text-left">
                        <p className="text-[11px] font-bold text-amber-300">{e.jalali}</p>
                        <p className="text-[9px] text-zinc-600">±{faNumT(e.windowDays)} روز</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* اطوار و گرفتگی‌ها */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-black text-zinc-300">
                  <Moon className="h-3.5 w-3.5" /> اطوار ماه
                </p>
                {fc.moonPhases.map((p, i) => (
                  <div key={i} className="mb-1.5 rounded-lg bg-zinc-900/60 px-2.5 py-1.5">
                    <p className="text-[11.5px] text-zinc-200">
                      {p.kind === 'full' ? '🌕 ماه کامل' : '🌑 ماه نو'} — {p.jalali} · {p.degree}
                    </p>
                    {p.starContact && (
                      <p className="mt-0.5 text-[10px] leading-5 text-violet-300/90">★ در جوار {p.starContact}</p>
                    )}
                  </div>
                ))}
                {fc.retroInMonth.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {fc.retroInMonth.map((r, i) => (
                      <p key={i} className={`text-[10.5px] ${r.kind === 'start' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        ℞ {r.bodyFa} {r.kind === 'start' ? 'راجع می‌شود' : 'مستقیم می‌شود'} — {r.jalali}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-black text-zinc-300">
                  <Sun className="h-3.5 w-3.5 text-amber-400" /> گرفتگی‌ها (±۲ ماه)
                </p>
                {fc.eclipses.map((e, i) => (
                  <div key={i} className={`mb-1.5 rounded-lg px-2.5 py-1.5 ${e.inMonth ? 'bg-red-950/25 border border-red-500/25' : 'bg-zinc-900/60'}`}>
                    <p className="text-[11.5px] text-zinc-200">
                      {e.kind === 'solar' ? '🌞 خورشیدگرفتگی' : '🌑 ماه‌گرفتگی'} — {e.jalali} · {e.degree}
                      {e.inMonth && <span className="mr-1 text-red-300">(در همین ماه!)</span>}
                    </p>
                    {e.hits.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-orange-300/90">برخورد با: {e.hits.join('، ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ستارگان ثابت */}
            {fc.starsInMonth.length > 0 && (
              <div className="rounded-xl border border-sky-500/20 bg-sky-950/10 p-3.5">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-black text-sky-300">
                  <Star className="h-3.5 w-3.5" /> ستارگان ثابت این ماه
                </p>
                <div className="space-y-1.5">
                  {fc.starsInMonth.map((s, i) => (
                    <div key={i} className="rounded-lg bg-zinc-950/50 px-3 py-1.5">
                      <p className="text-[11.5px] text-zinc-200">
                        <b className={s.royal ? 'text-amber-300' : 'text-sky-300'}>{s.star}</b> × {s.bodyFa} — {s.jalali}
                        {s.royal && <Badge variant="outline" className="mr-1.5 border-amber-500/40 bg-amber-500/10 px-1 text-[8px] text-amber-300">سلطنتی</Badge>}
                      </p>
                      <p className="text-[10px] leading-4 text-zinc-500">{s.meaning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ترانزیت شخصی */}
            {fc.natalHits.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold text-violet-300">🎯 برخورد ترانزیت با چارت تولد تو</p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1 natal-scroll">
                  {fc.natalHits.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-1.5">
                      <Badge variant="outline" className={`shrink-0 px-1.5 text-[9px] ${h.hard ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>
                        {h.aspectFa}
                      </Badge>
                      <p className="min-w-0 flex-1 text-[11px] text-zinc-300">
                        <b>{h.bodyFa}</b> {h.aspectFa} <b>{h.targetFa}</b> → محور {DIM_FA[h.dim]}
                      </p>
                      <span className="shrink-0 text-[10px] text-amber-300">{h.jalali}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* جمله پایانی Xanastrology */}
            {ai?.xanNote && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-gradient-to-l from-amber-950/20 to-transparent p-4">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-[13px] font-bold leading-7 text-amber-200">{ai.xanNote}</p>
              </div>
            )}

            {fc.dashaContext && (
              <p className="text-center text-[10.5px] text-zinc-500">
                🪐 {fc.dashaContext}{fc.personalYear ? ` — سال شخصی: ${faNumT(fc.personalYear)}` : ''}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
