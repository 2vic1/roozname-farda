'use client'

// ─── تب «چارت تولد» — استرولوژی شخصی ترکیبی (غربی + شرقی/ودیکی) ───
// تاریخ تولد + ساعت → چارت کامل، دشا، ستارگان ثابت، چرخه زندگی، پیش‌بینی ماهانه
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CircleAlert, Compass, Globe, Heart, ShieldCheck, Sparkles, Star, User, Wallet, Loader2, Swords, X } from 'lucide-react'
import { CITIES, JALALI_MONTHS_FA, faYear } from '@/lib/jalali'
import { faNum } from './types'
import { ZodiacWheel } from './natal/wheel'
import { LifeCycleChart } from './natal/lifecycle'
import { ForecastPanel } from './natal/forecast'
import { WarAstroSection } from './natal/war-astro'
import type {
  WesternChart, VedicChart, StarContact, NumerologyInfo, LifeCycle,
} from '@/lib/natal'

// ─── تایپ پاسخ ───
interface NatalAi {
  summary?: string
  personality?: string[]
  strengths?: string[]
  weaknesses?: string[]
  lifePath?: string
  career?: string
  love?: string
  money?: string
  feelings?: string
  dashaNote?: string
  starNote?: string
}
interface NatalResponse {
  ok: boolean
  error?: string
  input: { jy: number; jm: number; jd: number; hour: number; minute: number; city: string; name: string }
  western: WesternChart
  vedic: VedicChart
  stars: StarContact[]
  numerology: NumerologyInfo
  lifeCycle: LifeCycle
  index: number
  ai: NatalAi
}
interface SavedChart {
  name: string
  jy: number
  jm: number
  jd: number
  hour: number
  minute: number
  city: string
}

// ─── حریم خصوصی: چارت‌های تحلیل‌شده فقط در حافظه‌ی همین تب مرورگر (sessionStorage) ───
// نه روی سرور، نه در دیتابیس — با بستن تب کاملاً پاک می‌شوند.
const MAX_SAVED_NATAL = 24
const SAVED_NATAL_KEY = 'natalSavedCharts.v1'

function savedNatalKey(c: SavedChart): string {
  return `${c.jy}-${c.jm}-${c.jd}-${c.hour}-${c.minute}-${c.city}`
}

function readSavedNatal(): SavedChart[] {
  if (typeof window === 'undefined') return []
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(SAVED_NATAL_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((r): r is SavedChart =>
        !!r && typeof r === 'object' &&
        typeof (r as SavedChart).name === 'string' &&
        Number.isFinite((r as SavedChart).jy) && Number.isFinite((r as SavedChart).jm) &&
        Number.isFinite((r as SavedChart).jd) && Number.isFinite((r as SavedChart).hour) &&
        Number.isFinite((r as SavedChart).minute) && typeof (r as SavedChart).city === 'string')
      .slice(0, MAX_SAVED_NATAL)
  } catch {
    return []
  }
}

function writeSavedNatal(list: SavedChart[]): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SAVED_NATAL_KEY, JSON.stringify(list.slice(0, MAX_SAVED_NATAL)))
  } catch {
    // حافظه در دسترس نیست (حالت خصوصی مرورگر) — بی‌خطر
  }
}

function scoreColor(score: number): string {
  if (score >= 75) return '#dc2626'
  if (score >= 55) return '#f97316'
  if (score >= 35) return '#eab308'
  return '#10b981'
}

const ASPECT_CHIP: Record<string, string> = {
  conj: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  square: 'border-red-500/40 bg-red-500/10 text-red-300',
  opp: 'border-red-500/40 bg-red-500/10 text-red-300',
  trine: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  sextile: 'border-teal-500/40 bg-teal-500/10 text-teal-300',
}

export function NatalTab() {
  const [form, setForm] = useState({
    name: '',
    jy: 1375,
    jm: 3,
    jd: 15,
    hour: 12,
    minute: 0,
    city: 'تهران',
  })
  const [result, setResult] = useState<NatalResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedChart[]>([])
  const [mode, setMode] = useState<'war' | 'personal'>('war')
  const resultRef = useRef<HTMLDivElement>(null)

  // بازیابی چارت‌های این تب از حافظه‌ی مرورگر — نه از سرور (حریم خصوصی)
  useEffect(() => {
    setSaved(readSavedNatal())
  }, [])

  const compute = useCallback(async (input: typeof form) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/astro/natal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const j = (await res.json()) as NatalResponse
      if (j.ok) {
        setResult(j)
        // هیچ ذخیره‌ای روی سرور انجام نمی‌شود — فقط فهرست همین تب در حافظه‌ی مرورگر
        const entry: SavedChart = {
          name: (input.name ?? '').slice(0, 60),
          jy: input.jy, jm: input.jm, jd: input.jd,
          hour: input.hour, minute: input.minute, city: input.city,
        }
        setSaved((prev) => {
          const next = [entry, ...prev.filter((p) => savedNatalKey(p) !== savedNatalKey(entry))].slice(0, MAX_SAVED_NATAL)
          writeSavedNatal(next)
          return next
        })
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
      } else {
        setError(j.error ?? 'خطا در محاسبه چارت')
      }
    } catch {
      setError('خطای شبکه در محاسبه چارت تولد')
    } finally {
      setLoading(false)
    }
  }, [])

  const removeSaved = useCallback((c: SavedChart) => {
    setSaved((prev) => {
      const next = prev.filter((p) => savedNatalKey(p) !== savedNatalKey(c))
      writeSavedNatal(next)
      return next
    })
  }, [])

  const loadSavedChart = useCallback((c: SavedChart) => {
    compute({ name: c.name, jy: c.jy, jm: c.jm, jd: c.jd, hour: c.hour, minute: c.minute, city: c.city })
  }, [compute])

  const w = result?.western
  const v = result?.vedic

  return (
    <div className="space-y-5">
      {/* ─── سوئیچ حالت: استرولوزی جنگ / چارت شخصی ─── */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode('war')}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black transition-all sm:text-sm ${
            mode === 'war'
              ? 'border-red-500/60 bg-red-500/15 text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.15)]'
              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
          }`}
        >
          <Swords className="h-4 w-4" />
          استرولوزی جنگ — چارت دولت‌ها و رهبران
        </button>
        <button
          onClick={() => setMode('personal')}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black transition-all sm:text-sm ${
            mode === 'personal'
              ? 'border-fuchsia-500/60 bg-fuchsia-500/15 text-fuchsia-300 shadow-[0_0_16px_rgba(217,70,239,0.15)]'
              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
          }`}
        >
          <User className="h-4 w-4" />
          چارت شخصی من — تحلیل زندگی
        </button>
      </div>

      {mode === 'war' && <WarAstroSection />}

      {mode === 'personal' && (
        <>
      {/* ─── فرم تولد ─── */}
      <Card className="border-violet-500/30 bg-gradient-to-b from-violet-950/20 to-zinc-950/50">
        <CardContent className="p-4 sm:p-5">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-black text-violet-300">
            <User className="h-4 w-4" />
            چارت تولد — استرولوژی شخصی ترکیبی (غربی + ودیک)
          </h3>
          <p className="mb-4 text-[11px] leading-5 text-zinc-500">
            تاریخ (روز/ماه/سال جلالی)، ساعت دقیق تولد و شهر را بده — چارت کامل، ناکشترا، دشای ویمشوتاری،
            ستارگان ثابت، شاخص زندگی و چرخه چهاربعدی عمرت محاسبه می‌شود. ساعت دقیق = طالع دقیق.
          </p>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">نام (اختیاری)</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 outline-none focus:border-violet-500"
                placeholder="نام"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">روز</label>
              <select
                value={form.jd}
                onChange={(e) => setForm((f) => ({ ...f, jd: Number(e.target.value) }))}
                className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-1.5 text-xs text-zinc-200"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{faNum(d)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">ماه</label>
              <select
                value={form.jm}
                onChange={(e) => setForm((f) => ({ ...f, jm: Number(e.target.value) }))}
                className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-1.5 text-xs text-zinc-200"
              >
                {JALALI_MONTHS_FA.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">سال</label>
              <select
                value={form.jy}
                onChange={(e) => setForm((f) => ({ ...f, jy: Number(e.target.value) }))}
                className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-1.5 text-xs text-zinc-200"
              >
                {Array.from({ length: 95 }, (_, i) => 1420 - i).map((y) => (
                  <option key={y} value={y}>{faYear(y)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">ساعت</label>
              <select
                value={form.hour}
                onChange={(e) => setForm((f) => ({ ...f, hour: Number(e.target.value) }))}
                className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-1.5 text-xs text-zinc-200"
              >
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>{faNum(h)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">دقیقه</label>
              <select
                value={form.minute}
                onChange={(e) => setForm((f) => ({ ...f, minute: Number(e.target.value) }))}
                className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-1.5 text-xs text-zinc-200"
              >
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                  <option key={m} value={m}>{faNum(m)}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-[10px] text-zinc-500">شهر تولد</label>
              <select
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-1.5 text-xs text-zinc-200"
              >
                {CITIES.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => compute(form)}
              disabled={loading}
              className="h-10 bg-violet-600 text-sm text-white hover:bg-violet-500"
            >
              {loading ? (
                <>
                  <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                  در حال محاسبه چارت…
                </>
              ) : (
                <>
                  <Sparkles className="ml-1 h-4 w-4" />
                  چارت من را بساز
                </>
              )}
            </Button>
            {saved.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">چارت‌های این تب (ذخیره نمی‌شوند):</span>
                {saved.slice(0, 8).map((c) => (
                  <span
                    key={savedNatalKey(c)}
                    className="relative inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 text-[10px] text-zinc-300 transition hover:border-violet-500 hover:text-violet-300"
                  >
                    <button
                      onClick={() => loadSavedChart(c)}
                      className="py-1 pr-2.5 pl-6"
                    >
                      {c.name || `${faNum(c.jd)} ${JALALI_MONTHS_FA[c.jm - 1]} ${faYear(c.jy)}`}
                    </button>
                    <button
                      onClick={() => removeSaved(c)}
                      aria-label="حذف از فهرست این تب"
                      className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-500 transition hover:bg-zinc-700 hover:text-zinc-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mt-3 border-red-500/40 bg-red-950/40 text-red-200">
              <CircleAlert className="h-4 w-4" />
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/5 px-2.5 py-2 text-[10px] leading-4 text-violet-200/80">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
            <span>
              <b className="text-violet-300">حریم خصوصی:</b> چارت‌های شما هیچ‌جا ذخیره نمی‌شوند — نه روی سرور، نه در دیتابیس.
              فهرست «چارت‌های این تب» فقط در حافظه‌ی مرورگر شماست و با بستن تب کاملاً پاک می‌شود.
            </span>
          </p>
        </CardContent>
      </Card>

      {/* ─── نتیجه ─── */}
      <div ref={resultRef}>
        {result && w && v && (
          <div className="space-y-5">
            {/* هدر + شاخص */}
            <div className="grid gap-4 lg:grid-cols-4">
              <Card className="border-violet-500/30 bg-violet-950/20">
                <CardContent className="flex h-full flex-col items-center justify-center gap-1.5 p-5 text-center">
                  <p className="text-[10px] text-zinc-400">شاخص زندگی (ایندکس چارت)</p>
                  <p className="text-5xl font-black tabular-nums" style={{ color: scoreColor(result.index) }}>
                    {faNum(result.index)}
                  </p>
                  <Badge variant="outline" className="border-violet-500/40 bg-violet-500/10 text-[10px] text-violet-300">
                    ترکیب جنبه‌ها + شأن سیارات + اعداد
                  </Badge>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {result.input.name ? `${result.input.name} — ` : ''}
                    {faNum(result.input.jd)} {JALALI_MONTHS_FA[result.input.jm - 1]} {faYear(result.input.jy)} ·{' '}
                    {faNum(result.input.hour)}:{String(result.input.minute).padStart(2, '0')} · {result.input.city}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-zinc-800/70 bg-zinc-900/50 lg:col-span-3">
                <CardContent className="p-5">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { fa: 'خورشید (اراده)', p: w.planets.find((x) => x.body === 'Sun') },
                      { fa: 'ماه (روح)', p: w.planets.find((x) => x.body === 'Moon') },
                      { fa: 'طالع (نقاب)', p: null, deg: w.ascText },
                    ].map((row, i) => (
                      <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-center">
                        <p className="text-[10px] text-zinc-500">{row.fa}</p>
                        <p className="mt-1 text-base font-black text-violet-300">{row.p?.degText ?? row.deg}</p>
                        {row.p && (
                          <p className="mt-0.5 text-[9px] text-zinc-600">
                            خانه {faNum(row.p.house)}{row.p.retro ? ' · ℞' : ''}{row.p.dignity ? ` · ${row.p.dignity}` : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {result.ai.summary && (
                    <p className="mt-3 border-t border-zinc-800 pt-3 text-[13px] leading-7 text-zinc-300">
                      {result.ai.summary}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* چرخ + جدول سیارات */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-zinc-800/70 bg-zinc-900/50">
                <CardContent className="p-4 sm:p-5">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-zinc-300">
                    <Compass className="h-4 w-4 text-violet-400" />
                    چرخ زودیاک غربی (استوایی)
                  </h3>
                  <ZodiacWheel western={w} />
                  <p className="mt-2 text-center text-[9.5px] leading-4 text-zinc-600">
                    خط سفید: طالع (ASC) — خط طلایی: میانه آسمان (MC) — خطوط سبز: هماهنگ، خطوط سرخ: چالش
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-zinc-800/70 bg-zinc-900/50">
                  <CardContent className="p-4 sm:p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-300">
                      <Globe className="h-4 w-4 text-violet-400" />
                      سیارات — خانه و شأن
                    </h3>
                    <div className="max-h-72 space-y-1 overflow-y-auto pr-1 natal-scroll">
                      {w.planets.map((p) => (
                        <div key={p.body} className="flex items-center gap-2 rounded-lg bg-zinc-950/50 px-3 py-1.5 text-[11px]">
                          <span className="w-16 shrink-0 font-bold text-zinc-200">{p.glyph} {p.fa}</span>
                          <span className="w-20 shrink-0 tabular-nums text-violet-300">{p.degText}</span>
                          <Badge variant="outline" className="shrink-0 border-zinc-700 px-1.5 text-[9px] text-zinc-400">
                            خانه {faNum(p.house)}
                          </Badge>
                          {p.retro && <span className="shrink-0 text-[9px] text-red-400">℞</span>}
                          {p.dignity && (
                            <span className={`mr-auto shrink-0 text-[9px] ${p.dignity === 'فرمانروا' || p.dignity === 'در اوج' ? 'text-emerald-400' : 'text-orange-400'}`}>
                              {p.dignity}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-zinc-800/70 bg-zinc-900/50">
                  <CardContent className="p-4 sm:p-5">
                    <h3 className="mb-3 text-sm font-bold text-zinc-300">جنبه‌های کلیدی چارت</h3>
                    <div className="max-h-44 space-y-1 overflow-y-auto pr-1 natal-scroll">
                      {w.aspects.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          <Badge variant="outline" className={`shrink-0 px-1.5 text-[9px] ${ASPECT_CHIP[a.aspect]}`}>
                            {a.aspectFa}
                          </Badge>
                          <span className="text-zinc-300">{a.aFa} — {a.bFa}</span>
                          <span className="mr-auto shrink-0 tabular-nums text-zinc-600">{faNum(Number(a.orb.toFixed(1)))}°</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 text-[10px]">
                      {[
                        ['آتش', w.elements.fire, '#f87171'], ['خاک', w.elements.earth, '#a3a3a3'],
                        ['هوا', w.elements.air, '#67e8f9'], ['آب', w.elements.water, '#38bdf8'],
                      ].map(([label, val, color]) => (
                        <div key={String(label)} className="flex items-center gap-1.5">
                          <span className="w-8 text-zinc-500">{String(label)}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (Number(val) / 12) * 100)}%`, background: String(color) }} />
                          </div>
                          <span className="tabular-nums text-zinc-500">{faNum(Number(val))}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* ودیک + ستاره‌ها */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-orange-500/25 bg-orange-950/10">
                <CardContent className="p-4 sm:p-5">
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-orange-300">
                    <Star className="h-4 w-4" />
                    نجوم شرقی (ودیک — سیترین/لاهیری)
                  </h3>
                  <p className="mb-3 text-[10px] text-zinc-500">
                    آیانمسا {faNum(Number(v.ayanamsa.toFixed(2)))}° — ماه در ناکشترای{' '}
                    <b className="text-orange-300">{v.moonNakshatraFa}</b> پادا {faNum(v.moonPada)} — {v.moonNakTrait}
                  </p>
                  <div className="mb-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
                    <p className="text-[11px] leading-6 text-zinc-300">
                      <b className="text-orange-300">دشای جاری:</b> {v.currentMaha}
                      <br />
                      <b className="text-orange-300">آنتاردشا:</b> {v.currentAntar}
                    </p>
                    {result.ai.dashaNote && (
                      <p className="mt-1.5 border-t border-orange-500/20 pt-1.5 text-[11px] leading-6 text-zinc-400">
                        {result.ai.dashaNote}
                      </p>
                    )}
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto pr-1 natal-scroll">
                    {v.dasha.map((d, i) => {
                      const now = Date.now()
                      const active = now >= new Date(d.from).getTime() && now < new Date(d.to).getTime()
                      return (
                        <div
                          key={i}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] ${
                            active ? 'border border-orange-500/40 bg-orange-500/10' : 'bg-zinc-950/50'
                          }`}
                        >
                          <span className={active ? 'font-black text-orange-300' : 'text-zinc-300'}>
                            {d.lordFa}{active ? ' ← اکنون' : ''}
                          </span>
                          <span className="tabular-nums text-zinc-500">
                            {faYear(d.jalaliFrom)} تا {faYear(d.jalaliTo)} · {faNum(Number(d.fromAge.toFixed(0)))}–{faNum(Number(d.toAge.toFixed(0)))} سالگی
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-sky-500/25 bg-sky-950/10">
                  <CardContent className="p-4 sm:p-5">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-sky-300">
                      <Star className="h-4 w-4" />
                      ستارگان ثابت چارت
                    </h3>
                    {result.stars.length === 0 ? (
                      <p className="text-[11px] text-zinc-500">هیچ سیاره‌ای در مدار ۱٫۵ درجه‌ای ستارگان ثابت بزرگ نیست.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {result.stars.map((s, i) => (
                          <div key={i} className="rounded-lg bg-zinc-950/50 px-3 py-2">
                            <p className="text-[11.5px] font-bold text-zinc-200">
                              {s.bodyFa} مقارن <span className={s.royal ? 'text-amber-300' : 'text-sky-300'}>{s.star}</span>
                              <span className="mr-1.5 font-normal text-zinc-600">(مدار {faNum(Number(s.gap.toFixed(1)))}°)</span>
                              {s.royal && <Badge variant="outline" className="mr-1 border-amber-500/40 bg-amber-500/10 px-1 text-[8px] text-amber-300">سلطنتی</Badge>}
                            </p>
                            <p className="text-[10px] leading-5 text-zinc-500">{s.meaning}</p>
                          </div>
                        ))}
                        {result.ai.starNote && (
                          <p className="border-t border-zinc-800 pt-2 text-[11px] leading-6 text-zinc-400">{result.ai.starNote}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-zinc-800/70 bg-zinc-900/50">
                  <CardContent className="p-4 sm:p-5">
                    <h3 className="mb-2 text-sm font-bold text-zinc-300">اعدادشناسی</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-zinc-950/50 p-2.5 text-center">
                        <p className="text-[10px] text-zinc-500">مسیر زندگی</p>
                        <p className="text-xl font-black text-violet-300">{faNum(result.numerology.lifePath)}</p>
                        <p className="text-[9px] leading-4 text-zinc-600">{result.numerology.lifePathFa}</p>
                      </div>
                      <div className="rounded-lg bg-zinc-950/50 p-2.5 text-center">
                        <p className="text-[10px] text-zinc-500">عدد روز تولد</p>
                        <p className="text-xl font-black text-violet-300">{faNum(result.numerology.birthNumber)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* تحلیل هوش مصنوعی */}
            <div className="grid gap-4 md:grid-cols-2">
              {([
                { fa: 'شخصیت', items: result.ai.personality, icon: <User className="h-4 w-4" />, color: 'text-violet-300' },
                { fa: 'نقاط قوت', items: result.ai.strengths, icon: <Sparkles className="h-4 w-4" />, color: 'text-emerald-300' },
                { fa: 'سایه‌ها / نقاط رشد', items: result.ai.weaknesses, icon: <CircleAlert className="h-4 w-4" />, color: 'text-orange-300' },
              ]).map((sec, i) => (
                <Card key={i} className="border-zinc-800/70 bg-zinc-900/50">
                  <CardContent className="p-4 sm:p-5">
                    <h3 className={`mb-2 flex items-center gap-2 text-sm font-bold ${sec.color}`}>{sec.icon} {sec.fa}</h3>
                    {Array.isArray(sec.items) && sec.items.length > 0 ? (
                      <ul className="space-y-1.5">
                        {sec.items.map((t, j) => (
                          <li key={j} className="flex gap-1.5 text-[12px] leading-6 text-zinc-300">
                            <span className="text-violet-400">✦</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-zinc-500">—</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {([
                { fa: 'مسیر زندگی', text: result.ai.lifePath, icon: <Compass className="h-4 w-4" />, color: 'border-violet-500/25 bg-violet-950/10' },
                { fa: 'عشق و عاطفه', text: result.ai.love, icon: <Heart className="h-4 w-4" />, color: 'border-rose-500/25 bg-rose-950/10' },
                { fa: 'کار و جایگاه', text: result.ai.career, icon: <Compass className="h-4 w-4" />, color: 'border-amber-500/25 bg-amber-950/10' },
                { fa: 'مال و ثروت', text: result.ai.money, icon: <Wallet className="h-4 w-4" />, color: 'border-emerald-500/25 bg-emerald-950/10' },
              ]).map((sec, i) => (
                <Card key={i} className={sec.color}>
                  <CardContent className="p-4 sm:p-5">
                    <h3 className="mb-1.5 flex items-center gap-2 text-sm font-bold text-zinc-200">{sec.icon} {sec.fa}</h3>
                    <p className="text-[12.5px] leading-7 text-zinc-300">{sec.text || '—'}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* چرخه زندگی */}
            <Card className="border-zinc-800/70 bg-zinc-900/50">
              <CardContent className="p-4 sm:p-5">
                <h3 className="mb-1 text-sm font-bold text-zinc-300">
                  🌀 چرخه زندگی — چهار منحنی از تولد تا ۹۰ سالگی
                </h3>
                <p className="mb-3 text-[10.5px] leading-5 text-zinc-500">
                  ترکیب دشاهای ویمشوتاری (ماهار + آنتار) با ترانزیت‌های کلان زحل/مشتری/اورانوس بر خورشید و ماه تولد —
                  نوار پایین: دوره‌های دشا. نقطه‌های زرد: عصرهای طلایی.
                </p>
                <LifeCycleChart life={result.lifeCycle} />
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10.5px] sm:grid-cols-4">
                  {[
                    { fa: 'اوج شغلی', p: result.lifeCycle.peakCareer, dim: 'career' as const },
                    { fa: 'اوج عاطفی', p: result.lifeCycle.peakLove, dim: 'love' as const },
                    { fa: 'اوج مالی', p: result.lifeCycle.peakMoney, dim: 'money' as const },
                    { fa: 'اوج احساسی', p: result.lifeCycle.peakFeelings, dim: 'feelings' as const },
                  ].map((row, i) => (
                    <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5 text-center">
                      <p className="text-zinc-500">{row.fa}</p>
                      <p className="text-sm font-black" style={{ color: scoreColor(row.p[row.dim]) }}>
                        {faNum(Number(row.p.age.toFixed(0)))} سالگی
                      </p>
                      <p className="text-[9px] text-zinc-600">شدت {faNum(row.p[row.dim])}</p>
                    </div>
                  ))}
                </div>
                {result.lifeCycle.goldenAges.length > 0 && (
                  <p className="mt-2 text-center text-[10.5px] text-yellow-300/90">
                    ⭐ عصرهای طلایی: {result.lifeCycle.goldenAges.map((g) => `${faNum(Number(g.age.toFixed(0)))} سالگی`).join('، ')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* پیش‌بینی ماهانه شخصی */}
            <ForecastPanel
              birth={{
                jy: result.input.jy, jm: result.input.jm, jd: result.input.jd,
                hour: result.input.hour, minute: result.input.minute, city: result.input.city,
              }}
            />
          </div>
        )}
      </div>

      {/* حالت خالی: پیش‌بینی عمومی */}
      {!result && (
        <div className="space-y-4">
          <Alert className="border-violet-500/25 bg-violet-950/15 text-violet-200/90">
            <Sparkles className="h-4 w-4" />
            <AlertTitle>چارت خودت را بساز</AlertTitle>
            <AlertDescription>
              تا چارت نسازید، پیش‌بینی ماهانه عمومی (بدون لایه شخصی) در دسترس است — بعد از ساخت چارت،
              ترانزیت‌ها روی چارت خودت لحاظ می‌شوند.
            </AlertDescription>
          </Alert>
          <ForecastPanel />
        </div>
      )}

      {/* سلب مسئولیت */}
      <p className="px-2 text-center text-[10px] leading-5 text-zinc-600">
        محاسبات نجومی این بخش با ephemeris دقیق (astronomy-engine، چرخش استوایی→دایرةالبروج) انجام می‌شود؛
        تحلیل‌ها تفسیر سنت استرولوژی هستند و جایگزین مشاوره تخصصی نیستند. شاخص استرولوزی جنگ از همان موتور تغذیه و در پیش‌بینی اصلی دشبرد لحاظ می‌شود.
      </p>
        </>
      )}
    </div>
  )
}
