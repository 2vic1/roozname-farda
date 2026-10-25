'use client'

// ─── استرولوژی جنگ — چارت دولت‌ها/رهبران + سینستری + پنجره‌های جنگی + پیشگویی ───
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Swords, TriangleAlert, Eclipse, Sparkles, ArrowLeftRight, Radar, CalendarClock,
  Loader2, Crown, Landmark, Flame, Coins, Eye, ScrollText, Gauge, Timer,
} from 'lucide-react'
import { ZodiacWheel } from './wheel'
import { utcToJalaliTehran, jalaliMonthLabel } from '@/lib/jalali'
import type {
  WarPayload, WarEntityChart, WarSynastry, WarWindow, WarAi,
} from '@/lib/war-astro'

// ارقام فارسی برای هر رشته ترکیبی
const faTxt = (s: string | number) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

// «۶ آبان» — تاریخ جلالی کوتاه برای چیپ‌های چرخه
const faJDate = (dateStr: string) => {
  try {
    const j = utcToJalaliTehran(new Date(dateStr + 'T00:00:00Z'))
    return faTxt(`${j.jd} ${jalaliMonthLabel(j.jy, j.jm).split(' ')[0]}`)
  } catch {
    return faTxt(dateStr)
  }
}

interface PairDeep {
  ok: boolean
  synastry?: WarSynastry
  windows?: WarWindow[]
  eclipses?: WarPayload['eclipses']
  ai?: WarAi
  aiSource?: 'ai' | 'engine'
}

const KIND_META: Record<string, { fa: string; chip: string }> = {
  state: { fa: 'دولت', chip: 'border-red-500/40 bg-red-500/10 text-red-300' },
  leader: { fa: 'رهبر', chip: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  event: { fa: 'رویداد', chip: 'border-violet-500/40 bg-violet-500/10 text-violet-300' },
}

const DOMAIN_META: Record<WarWindow['domain'], { fa: string; chip: string; icon: typeof Swords }> = {
  military: { fa: 'نظامی', chip: 'border-red-500/40 bg-red-500/10 text-red-300', icon: Swords },
  economy: { fa: 'اقتصادی', chip: 'border-amber-500/40 bg-amber-500/10 text-amber-300', icon: Coins },
  politics: { fa: 'سیاسی', chip: 'border-sky-500/40 bg-sky-500/10 text-sky-300', icon: Landmark },
  intel: { fa: 'اطلاعاتی', chip: 'border-violet-500/40 bg-violet-500/10 text-violet-300', icon: Eye },
  leadership: { fa: 'رهبری', chip: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300', icon: Crown },
}

const LEVEL_STYLE: Record<WarWindow['level'], { dot: string; fa: string; chip: string }> = {
  critical: { dot: 'bg-red-500', fa: 'بحرانی', chip: 'border-red-500/50 bg-red-500/15 text-red-300' },
  high: { dot: 'bg-orange-400', fa: 'بالا', chip: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
  medium: { dot: 'bg-amber-300', fa: 'متوسط', chip: 'border-amber-500/30 bg-amber-500/5 text-amber-200' },
}

// ─── گیج نیم‌دایره‌ای شاخص جنگ ───
function WarGauge({ value, note }: { value: number; note: string }) {
  const angle = (value / 100) * 180
  const rad = (deg: number) => (deg * Math.PI) / 180
  const cx = 110, cy = 100, R = 86
  // پارامتری زاویه: ۰ = سر راست (مقدار صفر)، π = سر چپ (مقدار ۱۰۰) — رادیان مستقیم
  const arc = (phi1: number, phi2: number, r: number) => {
    const p1 = { x: cx + r * Math.cos(phi1), y: cy - r * Math.sin(phi1) }
    const p2 = { x: cx + r * Math.cos(phi2), y: cy - r * Math.sin(phi2) }
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 0 ${p2.x} ${p2.y}`
  }
  const color = value >= 78 ? '#ef4444' : value >= 62 ? '#f97316' : value >= 45 ? '#eab308' : '#10b981'
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 220 118" className="w-full max-w-[240px]" dir="ltr" role="img" aria-label="شاخص جنگ آسمانی">
        <path d={arc(0, Math.PI, R)} stroke="#27272a" strokeWidth="14" fill="none" strokeLinecap="round" />
        <path
          d={arc(0, rad(angle), R)}
          stroke={color} strokeWidth="14" fill="none" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
        <text x={cx} y={cy - 16} textAnchor="middle" fill={color} fontSize="34" fontWeight="900">
          {value}
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" fill="#a1a1aa" fontSize="10">
          شاخص جنگ آسمانی / ۱۰۰
        </text>
      </svg>
      <p className="mt-1 text-center text-xs font-semibold leading-5 text-zinc-300">{note}</p>
    </div>
  )
}

// ─── نوار تنش افقی ───
function TensionBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>{label}</span>
        <span className="font-bold" style={{ color }}>{faTxt(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function WarAstroSection() {
  const [data, setData] = useState<WarPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selEntity, setSelEntity] = useState('iran')
  const [pairA, setPairA] = useState('iran')
  const [pairB, setPairB] = useState('israel')
  const [deep, setDeep] = useState<PairDeep | null>(null)
  const [deepLoadedKey, setDeepLoadedKey] = useState('')
  const [domain, setDomain] = useState<'all' | WarWindow['domain']>('all')
  const deepLoading = deepLoadedKey !== `${pairA}|${pairB}`

  useEffect(() => {
    let alive = true
    fetch('/api/astro/war')
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        if (j.ok) setData(j as WarPayload)
        else setError(j.error || 'خطای موتور استرولوزی جنگ')
      })
      .catch(() => alive && setError('اتصال به موتور برقرار نشد'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  // تحلیل عمیق جفتی — هنگام تغییر جفت
  const pairKey = `${pairA}|${pairB}`
  useEffect(() => {
    if (!data) return
    let alive = true
    fetch('/api/astro/war', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: pairA, b: pairB }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        setDeep(j as PairDeep)
        setDeepLoadedKey(pairKey)
      })
      .catch(() => {
        if (!alive) return
        setDeep(null)
        setDeepLoadedKey(pairKey)
      })
    return () => { alive = false }
  }, [pairKey, data, pairA, pairB])

  const entity = data?.entities.find((e) => e.meta.id === selEntity)
  const pairBase = data?.pairs.find(
    (p) => (p.a === pairA && p.b === pairB) || (p.a === pairB && p.b === pairA),
  )
  const windows = useMemo(() => {
    if (!data) return []
    return domain === 'all' ? data.windows : data.windows.filter((w) => w.domain === domain)
  }, [data, domain])
  const aiReadFor = useCallback(
    (id: string) => data?.ai?.reads?.find((r) => r.id === id)?.read ?? '',
    [data],
  )

  if (loading) {
    return (
      <Card className="border-zinc-800/70 bg-zinc-900/40">
        <CardContent className="flex flex-col items-center gap-3 py-14">
          <Loader2 className="h-7 w-7 animate-spin text-fuchsia-400" />
          <p className="text-sm text-zinc-400">در حال محاسبه ۶ چارت، سینستری‌ها و پنجره‌های ۱۲۰ روزه…</p>
          <p className="text-[11px] text-zinc-600">ephermis دقیق + اسکن دوگانه‌بینی — تا ~۵ ثانیه</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Alert variant="destructive" className="border-red-800 bg-red-950/40">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>خطا در استرولوژی جنگ</AlertTitle>
        <AlertDescription>{error || 'داده‌ای موجود نیست'}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-5">
      {/* ═══ سربرگ + شاخص ═══ */}
      <Card className="border-red-900/40 bg-gradient-to-bl from-red-950/30 via-zinc-900/60 to-zinc-900/40">
        <CardContent className="p-5">
          <div className="grid items-center gap-5 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <WarGauge value={data.warIndex.index} note={data.warIndex.note} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              {data.warIndex.parts.map((p) => (
                <TensionBar
                  key={p.label}
                  label={p.label}
                  value={p.value}
                  color={p.value >= 70 ? '#ef4444' : p.value >= 45 ? '#f97316' : '#eab308'}
                />
              ))}
            </div>
            <div className="space-y-2 lg:col-span-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-1 border-red-500/40 bg-red-500/15 text-red-300" variant="outline">
                  <Swords className="h-3 w-3" /> استرولوژی جنگ
                </Badge>
                <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                  {data.aiSource === 'ai' ? 'تحلیل هوش مصنوعی' : 'تحلیل موتور (بدون AI)'}
                </Badge>
              </div>
              <p className="text-[11px] leading-5 text-zinc-500">
                چارت‌های پایه: تأسیس جمهوری اسلامی ۱۲فروردین۱۳۵۸، چارت سیبلی آمریکا ۱۷۷۶،
                اعلام استقلال اسرائیل ۱۹۴۸، ترامپ (رده AA)، نتانیاهو (رده B)، چارت جنگ ۱۲روزه.
                موتور: ephemeris دقیق + جنبه سخت با پنجره ±روز.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ چرخه‌های ۴۰روزه — شواهد عددی مدل ═══ */}
      {data.cycles40.length > 0 && (
        <Card className="border-amber-900/40 bg-amber-950/10">
          <CardContent className="flex flex-col gap-2.5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Timer className="h-4 w-4 text-amber-400" />
              <p className="text-xs font-bold text-amber-300">چرخه‌های ۴۰روزه از آتش‌بس — شواهد عددی مدل</p>
              <Badge variant="outline" className="border-zinc-700 text-[9px] text-zinc-500">گن + هرست</Badge>
            </div>
            <p className="text-[11px] leading-5 text-zinc-400">
              «جنگ ۴۰روزه» چارت جداگانه ندارد — چارت رویداد واقعی، جنگ ۱۲روزه است (۲۳ خرداد ۱۴۰۴، ساعت ۰۲:۳۰ تهران).
              عدد ۴۰ یک چرخه زمانی گن/هرست از آتش‌بس ۳ تیر ۱۴۰۴ است و مستقیماً در امتیاز چرخه ریسک
              و انتخاب سناریوهای روز حمله به‌کار می‌رود:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.cycles40.map((c) => (
                <Badge
                  key={c.date}
                  variant="outline"
                  className="gap-1 border-amber-500/30 bg-amber-500/5 text-[10px] text-amber-200"
                >
                  <Timer className="h-3 w-3" />
                  {faTxt(c.k)}×۴۰ · {faJDate(c.date)}
                  {c.daysLeft > 0 ? ` · ${faTxt(c.daysLeft)} روز دیگر` : ' · امروز'}
                  {c.families.includes('gann') && c.families.includes('hurst') ? ' · گن+هرست' : ''}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ چارت‌های پایه ═══ */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-zinc-200">
          <Landmark className="h-4 w-4 text-red-400" /> چارت‌های پایه پیشگویی
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {data.entities.map((e) => {
            const active = e.meta.id === selEntity
            const km = KIND_META[e.meta.kind]
            return (
              <button
                key={e.meta.id}
                onClick={() => setSelEntity(e.meta.id)}
                className={`rounded-xl border p-3 text-right transition-all ${
                  active
                    ? 'border-red-500/60 bg-red-500/10 shadow-[0_0_14px_rgba(239,68,68,0.15)]'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{e.meta.flag}</span>
                  <Badge variant="outline" className={`px-1.5 text-[9px] ${km.chip}`}>{km.fa}</Badge>
                </div>
                <p className="mt-1.5 truncate text-xs font-bold text-zinc-200">{e.meta.short}</p>
                <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">{e.meta.chartFa.split('—')[0]}</p>
                <p className="mt-1 text-[9px] text-zinc-600">طالع: {faTxt(e.western.ascText)}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ جزئیات چارت انتخاب‌شده ═══ */}
      {entity && (
        <Card className="border-zinc-800/70 bg-zinc-900/40">
          <CardContent className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-200">
                <span className="text-lg">{entity.meta.flag}</span>
                {entity.meta.fa}
                <Badge variant="outline" className={`text-[10px] ${KIND_META[entity.meta.kind].chip}`}>
                  {KIND_META[entity.meta.kind].fa}
                </Badge>
              </h3>
              <p className="text-[11px] text-zinc-500">{entity.meta.chartFa}</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <ZodiacWheel western={entity.western} />
                <p className="mt-2 text-center text-[10px] text-zinc-600">{entity.meta.sourceNote}</p>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {entity.western.planets.filter((p) => !['Rahu', 'Ketu'].includes(p.body)).map((p) => (
                    <div key={p.body} className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-1.5">
                      <p className="text-[10px] text-zinc-500">{p.glyph} {p.fa}{p.retro ? ' ℞' : ''}</p>
                      <p className="text-[11px] font-bold text-zinc-200">{faTxt(p.degText)}</p>
                      <p className="text-[9px] text-zinc-600">خانه {faTxt(p.house)}{p.dignity ? ` · ${p.dignity}` : ''}</p>
                    </div>
                  ))}
                </div>
                {entity.stars.length > 0 && (
                  <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-amber-300">
                      <Sparkles className="h-3 w-3" /> ستارگان ثابت
                    </p>
                    {entity.stars.map((s, i) => (
                      <p key={i} className="text-[10px] leading-4 text-zinc-400">
                        {faTxt(s.bodyFa)} مقارن {faTxt(s.star)} — {s.meaning}
                      </p>
                    ))}
                  </div>
                )}
                {entity.returns.length > 0 && (
                  <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-3">
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-violet-300">
                      <Radar className="h-3 w-3" /> بازگشت‌های چرخه‌ای (افق ۳ سال)
                    </p>
                    <ScrollArea className="max-h-28">
                      {entity.returns.map((r, i) => (
                        <p key={i} className="text-[10px] leading-4 text-zinc-400">
                          • {faTxt(r.bodyFa)} به {faTxt(r.targetFa)} — {faTxt(r.jalali)}
                          {r.note ? ` — ${r.note}` : ''}
                        </p>
                      ))}
                    </ScrollArea>
                  </div>
                )}
                {aiReadFor(entity.meta.id) && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                    <p className="mb-1 text-[11px] font-bold text-fuchsia-300">خوانش آسمانی</p>
                    <p className="text-[11px] leading-5 text-zinc-300">{aiReadFor(entity.meta.id)}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ سینستری جفتی ═══ */}
      <Card className="border-zinc-800/70 bg-zinc-900/40">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-200">
              <Flame className="h-4 w-4 text-orange-400" /> سینستری تقابل — دو چارت روبه‌رو
            </h3>
            <div className="flex items-center gap-2">
              <Select value={pairA} onValueChange={(v) => v !== pairB && setPairA(v)}>
                <SelectTrigger className="h-8 w-40 text-xs" aria-label="چارت اول">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.entities.map((e) => (
                    <SelectItem key={e.meta.id} value={e.meta.id} className="text-xs">
                      {e.meta.flag} {e.meta.short}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline" size="icon" className="h-8 w-8"
                aria-label="جابجایی دو چارت"
                onClick={() => { setPairA(pairB); setPairB(pairA) }}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </Button>
              <Select value={pairB} onValueChange={(v) => v !== pairA && setPairB(v)}>
                <SelectTrigger className="h-8 w-40 text-xs" aria-label="چارت دوم">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.entities.map((e) => (
                    <SelectItem key={e.meta.id} value={e.meta.id} className="text-xs">
                      {e.meta.flag} {e.meta.short}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {pairBase && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3">
                <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-center">
                  <p className="text-[11px] text-zinc-400">تنش جفتی {faTxt(pairBase.aFa)} ↔ {faTxt(pairBase.bFa)}</p>
                  <p className={`text-4xl font-black ${
                    pairBase.tension >= 78 ? 'text-red-400' : pairBase.tension >= 62 ? 'text-orange-400' : pairBase.tension >= 46 ? 'text-amber-300' : 'text-emerald-400'
                  }`}>{faTxt(pairBase.tension)}</p>
                  <p className="mt-1 text-[10px] leading-4 text-zinc-400">{pairBase.verdict}</p>
                  <p className="mt-1 text-[9px] text-zinc-600">{pairBase.label} — لنگر واقعیت سیاسی + دینامیک آسمان</p>
                </div>
                <TensionBar label="اصطکاک (جنبه سخت)" value={pairBase.friction} max={120} color="#ef4444" />
                <TensionBar label="جریان هماهنگ (جنبه نرم)" value={pairBase.flow} max={120} color="#10b981" />
              </div>
              <div className="lg:col-span-2">
                <p className="mb-2 text-[11px] font-bold text-zinc-400">جنبه‌های قوی‌تر (مرتب بر وزن)</p>
                <div className="flex flex-wrap gap-1.5">
                  {pairBase.aspects.map((a, i) => (
                    <span
                      key={i}
                      className={`rounded-lg border px-2 py-1 text-[10px] ${
                        a.hard
                          ? 'border-red-500/30 bg-red-500/10 text-red-200'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      }`}
                    >
                      {faTxt(a.aFa)} <b>{faTxt(a.aspectFa)}</b> {faTxt(a.bFa)}
                      <span className="text-zinc-500"> ({faTxt(a.orb.toFixed(1))}°)</span>
                    </span>
                  ))}
                </div>
                {deepLoading && (
                  <p className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> در حال تحلیل عمیق جفتی…
                  </p>
                )}
                {deep?.ai && !deepLoading && (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg border border-fuchsia-900/40 bg-fuchsia-950/20 p-3">
                      <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-fuchsia-300">
                        <Sparkles className="h-3 w-3" /> تحلیل عمیق {deep.aiSource === 'ai' ? '(هوش مصنوعی)' : '(موتور)'}
                      </p>
                      <p className="text-[11px] leading-5 text-zinc-300">{deep.ai.executive}</p>
                      {deep.ai.flashpoints?.[0] && (
                        <p className="mt-1 text-[11px] leading-5 text-zinc-300">{deep.ai.flashpoints[0].read}</p>
                      )}
                    </div>
                    {deep.ai.prediction && (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                        <p className="mb-1 text-[11px] font-bold text-zinc-300">پیشگویی مسیر ۱۲۰ روز این جفت</p>
                        <p className="text-[11px] leading-5 text-zinc-400">{deep.ai.prediction}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ پنجره‌های جنگی ═══ */}
      <Card className="border-zinc-800/70 bg-zinc-900/40">
        <CardContent className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-200">
              <CalendarClock className="h-4 w-4 text-red-400" />
              پنجره‌های جنگی ۱۲۰ روز آینده — تاریخ‌های دقیق
            </h3>
            <div className="flex flex-wrap gap-1">
              {(['all', 'military', 'economy', 'politics', 'intel'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDomain(d)}
                  className={`rounded-lg border px-2 py-1 text-[10px] transition ${
                    domain === d ? 'border-red-500/50 bg-red-500/15 text-red-300' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {d === 'all' ? 'همه' : DOMAIN_META[d].fa}
                </button>
              ))}
            </div>
          </div>
          <ScrollArea className="max-h-96">
            <div className="space-y-1.5">
              {windows.slice(0, 40).map((w) => {
                const dm = DOMAIN_META[w.domain]
                const lv = LEVEL_STYLE[w.level]
                return (
                  <div key={w.id} className="flex items-start gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${lv.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-bold text-zinc-200">{faTxt(w.jalali)}</span>
                        <Badge variant="outline" className={`px-1.5 text-[9px] ${lv.chip}`}>{lv.fa}</Badge>
                        <Badge variant="outline" className={`px-1.5 text-[9px] ${dm.chip}`}>{dm.fa}</Badge>
                        <span className="text-[9px] text-zinc-600">±{faTxt(w.windowDays)}روز{w.passes > 1 ? ` · ${faTxt(w.passes)}گذره` : ''}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-300">
                        <b className="text-orange-300">{faTxt(w.transitFa)}</b> {faTxt(w.aspectFa)}{' '}
                        <b className="text-zinc-100">{faTxt(w.targetFa)}</b>
                        <span className="text-zinc-500"> «{faTxt(w.entityFa)}»</span>
                      </p>
                      <p className="text-[10px] leading-4 text-zinc-500">{w.note}</p>
                    </div>
                  </div>
                )
              })}
              {windows.length === 0 && (
                <p className="py-6 text-center text-xs text-zinc-500">پنجره‌ای در این حوزه در افق فعال نیست</p>
              )}
            </div>
          </ScrollArea>
          <p className="mt-2 text-[10px] text-zinc-600">
            روش: جنبه‌های سخت (مقارنه/مربع/مقابله) مریخ تا پلوتو به نقاط گرم چارت‌ها — عبور صفر با دوگانه‌بینی تا دقیقه؛
            پنجره فعال بر پایه سرعت سیاره.
          </p>
        </CardContent>
      </Card>

      {/* ═══ رادار گرفتگی ═══ */}
      {data.eclipses.length > 0 && (
        <Card className="border-zinc-800/70 bg-zinc-900/40">
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-200">
              <Eclipse className="h-4 w-4 text-violet-400" /> رادار گرفتگی‌ها — تقویم شوک
            </h3>
            <div className="space-y-1.5">
              {data.eclipses.map((e, i) => (
                <div key={i} className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-zinc-200">
                      {e.kind === 'solar' ? '🌑 خورشیدگرفتگی' : '🌕 ماهگرفتگی'}
                    </span>
                    <span className="text-[11px] text-violet-300">{faTxt(e.jalali)}</span>
                    <span className="text-[10px] text-zinc-500">در {faTxt(e.degree)}</span>
                  </div>
                  {e.hits.length > 0 ? (
                    e.hits.map((h, j) => (
                      <p key={j} className="mt-0.5 text-[10px] leading-4 text-red-300">
                        ⚡ ضربه به {faTxt(h.targetFa)} «{faTxt(h.entityFa)}» (مدار {faTxt(h.orb)}°) — {h.note}
                      </p>
                    ))
                  ) : (
                    <p className="mt-0.5 text-[10px] text-zinc-500">بدون اتصال مستقیم به نقاط چارت‌های پایه در ۳ درجه</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ پیشگویی کلان ═══ */}
      <Card className="border-fuchsia-900/40 bg-gradient-to-tl from-fuchsia-950/20 via-zinc-900/50 to-zinc-900/40">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
              <ScrollText className="h-4 w-4 text-fuchsia-300" /> پیشگویی کلان — قضاوت نهایی آسمان
            </h3>
            <Badge variant="outline" className="border-fuchsia-500/30 text-[10px] text-fuchsia-300">
              {data.aiSource === 'ai' ? 'هوش مصنوعی + موتور' : 'موتور (کلید AI ست نشده)'}
            </Badge>
          </div>
          <p className="mb-3 rounded-xl border border-fuchsia-900/40 bg-fuchsia-950/20 p-3 text-[12px] font-semibold leading-6 text-zinc-100">
            {data.ai.executive}
          </p>
          {data.ai.calls?.length > 0 && (
            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.ai.calls.slice(0, 6).map((c, i) => (
                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black text-red-300">{faTxt(c.when)}{c.windowDays ? ` ±${faTxt(c.windowDays)}` : ''}</p>
                    <Badge variant="outline" className={`text-[9px] ${c.confidence >= 70 ? 'border-red-500/40 text-red-300' : c.confidence >= 50 ? 'border-amber-500/40 text-amber-300' : 'border-zinc-700 text-zinc-400'}`}>
                      اطمینان {faTxt(c.confidence)}٪
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-zinc-400">{c.what}</p>
                </div>
              ))}
            </div>
          )}
          {data.ai.prediction && (
            <p className="mb-2 text-[12px] leading-6 text-zinc-300">{data.ai.prediction}</p>
          )}
          {data.ai.monthlyNote && (
            <p className="text-[11px] leading-5 text-zinc-400">{data.ai.monthlyNote}</p>
          )}
          <p className="mt-3 flex items-center gap-1 text-[9px] text-zinc-600">
            <Gauge className="h-3 w-3" /> تحلیل نمادین استرولوژیک است و مکمل، نه جایگزین، تحلیل اطلاعاتی این داشبورد است.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
