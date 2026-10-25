'use client'

// ─── تب هواشناسی مراکز استان‌ها — کاملاً جدا از موتور ریسک جنگ ───
// دمای فعلی + کمترین/بیشترین + نمودار ساعتی + پیش‌بینی روزها
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  CloudSun,
  Sun,
  Moon,
  CloudMoon,
  Cloudy,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudLightning,
  CloudHail,
  ThermometerSnowflake,
  ThermometerSun,
  Droplets,
  Wind,
  Sunrise,
  Sunset,
  RefreshCw,
  AlertTriangle,
  Gauge,
} from 'lucide-react'
import { faNum, relTimeFa } from './types'
import { CITY_LIST, WX_FA, type WeatherPayload, type WxCode } from '@/lib/weather'

const LS_KEY = 'weather-city-v1'
const REFRESH_MS = 10 * 60 * 1000 // ۱۰ دقیقه
const QUICK = ['tehran', 'mashhad', 'isfahan', 'tabriz', 'shiraz', 'ahvaz', 'rasht', 'bandarabbas']

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
function toFa(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '—'
  return String(s).replace(/\d/g, (d) => FA_DIGITS[Number(d)])
}

function WxIcon({ code, isDay, className }: { code: WxCode; isDay: boolean; className?: string }) {
  switch (code) {
    case 'clear':
      return isDay ? <Sun className={className} /> : <Moon className={className} />
    case 'partly':
      return isDay ? <CloudSun className={className} /> : <CloudMoon className={className} />
    case 'cloudy':
      return <Cloudy className={className} />
    case 'fog':
      return <CloudFog className={className} />
    case 'drizzle':
      return <CloudDrizzle className={className} />
    case 'rain':
      return <CloudRain className={className} />
    case 'heavyrain':
      return <CloudRainWind className={className} />
    case 'snow':
    case 'sleet':
      return <CloudSnow className={className} />
    case 'thunder':
      return <CloudLightning className={className} />
    case 'hail':
      return <CloudHail className={className} />
    default:
      return <Cloudy className={className} />
  }
}

function DetailChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 py-1.5">
      <span className="text-teal-400">{icon}</span>
      <span className="text-zinc-500">{label}:</span>
      <span className="font-bold text-zinc-200">{value}</span>
    </div>
  )
}

export function WeatherTab() {
  const [city, setCity] = useState<string>('tehran')
  const [w, setW] = useState<WeatherPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async (key: string, force = false) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/weather?city=${encodeURIComponent(key)}${force ? '&force=1' : ''}`)
      const j = (await r.json()) as { ok: boolean; data?: WeatherPayload; error?: string }
      if (j.ok && j.data) {
        setW(j.data)
        setErr(null)
      } else {
        setErr(j.error ?? 'خطای دریافت هواشناسی')
      }
    } catch {
      setErr('خطای شبکه — دوباره تلاش کن')
    } finally {
      setLoading(false)
    }
  }, [])

  // بازیابی شهر ذخیره‌شده
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved && CITY_LIST.some((c) => c.key === saved)) setCity(saved)
    } catch {
      /* بی‌اهمیت */
    }
  }, [])

  // بارگیری هنگام تغییر شهر
  useEffect(() => {
    load(city)
    try {
      localStorage.setItem(LS_KEY, city)
    } catch {
      /* بی‌اهمیت */
    }
  }, [city, load])

  // تازه‌سازی دوره‌ای
  useEffect(() => {
    const iv = setInterval(() => load(city), REFRESH_MS)
    return () => clearInterval(iv)
  }, [city, load])

  const days = w?.days ?? []
  const wkMin = days.length ? Math.min(...days.map((d) => d.min)) : 0
  const wkMax = days.length ? Math.max(...days.map((d) => d.max)) : 1
  const wkRange = Math.max(wkMax - wkMin, 1)

  const chartData = (w?.hours ?? []).map((h) => ({ t: toFa(h.tFa), temp: h.temp }))

  return (
    <div className="space-y-4">
      {/* ── سرصفحه + انتخاب شهر ── */}
      <Card className="border-teal-900/50 bg-gradient-to-l from-teal-950/40 via-zinc-900/70 to-zinc-950">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-500/15 text-2xl">
                🌤️
              </div>
              <div>
                <h2 className="text-lg font-bold text-teal-100">هواشناسی مراکز استان‌ها</h2>
                <p className="text-xs text-zinc-400">
                  ۳۱ مرکز استان — دمای فعلی، کمترین/بیشترین و پیش‌بینی روزها
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {w && (
                <span className="rounded-md border border-teal-900/60 bg-teal-950/40 px-2 py-1 text-[10px] text-teal-300">
                  منبع: {w.providerFa}
                  {w.stale ? ' (ذخیره‌شده)' : ''}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="border-zinc-800 bg-zinc-950/60 hover:bg-teal-950/40"
                disabled={loading}
                onClick={() => load(city, true)}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                تازه‌سازی
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="w-[230px] border-zinc-800 bg-zinc-950/60">
                <SelectValue placeholder="انتخاب شهر" />
              </SelectTrigger>
              <SelectContent className="max-h-72 border-zinc-800 bg-zinc-950">
                {CITY_LIST.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.fa} — {c.province}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {QUICK.map((k) => {
              const c = CITY_LIST.find((x) => x.key === k)!
              const active = city === k
              return (
                <Button
                  key={k}
                  size="sm"
                  variant="outline"
                  onClick={() => setCity(k)}
                  className={`h-8 border-zinc-800 px-3 ${
                    active
                      ? 'border-teal-500/50 bg-teal-500/15 text-teal-200'
                      : 'bg-zinc-950/60 text-zinc-400 hover:text-teal-200'
                  }`}
                >
                  {c.fa}
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {err && (
        <Card className="border-red-900/50 bg-red-950/20">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <div className="flex-1 text-sm text-red-200">{err}</div>
            <Button size="sm" variant="outline" className="border-zinc-700" onClick={() => load(city, true)}>
              تلاش دوباره
            </Button>
          </CardContent>
        </Card>
      )}

      {!w && loading && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-36 bg-zinc-900 lg:col-span-2" />
            <Skeleton className="h-36 bg-zinc-900" />
          </div>
          <Skeleton className="h-52 bg-zinc-900" />
          <Skeleton className="h-44 bg-zinc-900" />
        </div>
      )}

      {w && (
        <>
          {/* ── وضعیت فعلی + کمترین/بیشترین امروز ── */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-teal-900/40 bg-zinc-900/50 lg:col-span-2">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <WxIcon
                      code={w.now.code}
                      isDay={w.now.isDay}
                      className="h-16 w-16 text-teal-300"
                    />
                    <div>
                      <div className="text-5xl font-black leading-none text-white">
                        {faNum(Math.round(w.now.temp))}°
                      </div>
                      <div className="mt-2 text-sm font-bold text-teal-300">
                        {WX_FA[w.now.code]}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {w.cityFa}، {w.provinceFa} — به‌روزرسانی {relTimeFa(w.fetchedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {w.now.feelsLike !== null && (
                      <DetailChip
                        icon={<Gauge className="h-3.5 w-3.5" />}
                        label="دمای احساسی"
                        value={`${faNum(Math.round(w.now.feelsLike))}°`}
                      />
                    )}
                    <DetailChip
                      icon={<Droplets className="h-3.5 w-3.5" />}
                      label="رطوبت"
                      value={`${faNum(w.now.humidity !== null ? Math.round(w.now.humidity) : null)}٪`}
                    />
                    <DetailChip
                      icon={<Wind className="h-3.5 w-3.5" />}
                      label="باد"
                      value={`${faNum(w.now.windKmh !== null ? Math.round(w.now.windKmh) : null)} km/h${w.now.windDirFa ? ` از ${w.now.windDirFa}` : ''}`}
                    />
                    {w.now.uv !== null && (
                      <DetailChip
                        icon={<Sun className="h-3.5 w-3.5" />}
                        label="شاخص UV"
                        value={faNum(Math.round(w.now.uv))}
                      />
                    )}
                    {w.elevation !== null && (
                      <DetailChip
                        icon={<Gauge className="h-3.5 w-3.5" />}
                        label="ارتفاع"
                        value={`${faNum(Math.round(w.elevation))} متر`}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-teal-900/40 bg-zinc-900/50">
              <CardContent className="flex h-full flex-col justify-center gap-3 p-5">
                {days[0] ? (
                  <>
                    <div className="flex items-center justify-between rounded-xl border border-teal-900/50 bg-teal-950/20 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <ThermometerSnowflake className="h-5 w-5 text-teal-400" />{' '}
                        {days[0].partial ? 'کمترین از این به بعد' : 'کمترین امروز'}
                      </div>
                      <div className="text-2xl font-black text-teal-300">
                        {faNum(Math.round(days[0].min))}°
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <ThermometerSun className="h-5 w-5 text-amber-400" />{' '}
                        {days[0].partial ? 'بیشترین از این به بعد' : 'بیشترین امروز'}
                      </div>
                      <div className="text-2xl font-black text-amber-300">
                        {faNum(Math.round(days[0].max))}°
                      </div>
                    </div>
                    {(days[0].sunriseFa || days[0].sunsetFa) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                        {days[0].sunriseFa && (
                          <span className="flex items-center gap-1.5">
                            <Sunrise className="h-4 w-4 text-amber-400/80" /> طلوع {toFa(days[0].sunriseFa)}
                          </span>
                        )}
                        {days[0].sunsetFa && (
                          <span className="flex items-center gap-1.5">
                            <Sunset className="h-4 w-4 text-orange-400/80" /> غروب {toFa(days[0].sunsetFa)}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">دادهٔ روزانه در دسترس نیست</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── نمودار ساعتی ── */}
          <Card className="border-zinc-800/70 bg-zinc-900/50">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-bold text-zinc-300">
                دمای ساعتی — {chartData.length > 0 ? `${toFa(chartData.length)} ساعت آینده` : ''}
              </h3>
              {chartData.length > 1 ? (
                <div dir="ltr" className="h-[190px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                      <defs>
                        <linearGradient id="wtemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="t"
                        tick={{ fontSize: 10, fill: '#71717a' }}
                        interval="preserveStartEnd"
                        minTickGap={28}
                      />
                      <YAxis
                        width={34}
                        domain={['dataMin - 2', 'dataMax + 2']}
                        tick={{ fontSize: 10, fill: '#71717a' }}
                        tickFormatter={(v: number) => faNum(Math.round(v))}
                      />
                      <Tooltip
                        content={({ active, payload, label }) =>
                          active && payload && payload.length ? (
                            <div className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs">
                              <div className="text-zinc-500">ساعت {label}</div>
                              <div className="font-bold text-teal-300">{faNum(payload[0].value as number)}°</div>
                            </div>
                          ) : null
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="temp"
                        stroke="#2dd4bf"
                        strokeWidth={2}
                        fill="url(#wtemp)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  برای این منبع دادهٔ ساعتی موجود نیست — پیش‌بینی روزانه را ببین.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── پیش‌بینی روزانه ── */}
          <Card className="border-zinc-800/70 bg-zinc-900/50">
            <CardContent className="p-5">
              <h3 className="mb-3 text-sm font-bold text-zinc-300">
                پیش‌بینی روزانه — {toFa(days.length)} روز
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                {days.map((d) => (
                  <div
                    key={d.date}
                    className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3 text-center"
                  >
                    <div className="text-xs font-bold text-teal-200">{d.labelFa}</div>
                    <div className="text-[10px] text-zinc-500">{d.weekdayFa && d.labelFa === d.weekdayFa ? '' : d.weekdayFa}</div>
                    <div className="my-2 flex justify-center">
                      <WxIcon code={d.code} isDay className="h-7 w-7 text-teal-300" />
                    </div>
                    <div className="text-[11px] text-zinc-400">{WX_FA[d.code]}</div>
                    <div className="mt-1 flex items-center justify-center gap-2">
                      <span className="text-sm font-black text-amber-300">{faNum(Math.round(d.max))}°</span>
                      <span className="text-sm font-bold text-teal-400">{faNum(Math.round(d.min))}°</span>
                    </div>
                    <div dir="ltr" className="relative mt-2 h-1.5 w-full rounded-full bg-zinc-800">
                      <div
                        className="absolute h-1.5 rounded-full bg-gradient-to-r from-teal-500 to-amber-500"
                        style={{
                          left: `${((d.min - wkMin) / wkRange) * 100}%`,
                          width: `${Math.max(((d.max - d.min) / wkRange) * 100, 8)}%`,
                        }}
                      />
                    </div>
                    {d.precipProb !== null && d.precipProb > 0 && (
                      <div className="mt-1.5 text-[10px] text-teal-300">
                        بارش {faNum(Math.round(d.precipProb))}٪
                      </div>
                    )}
                    {d.precipMM !== null && d.precipProb === null && d.precipMM > 0 && (
                      <div className="mt-1.5 text-[10px] text-teal-300">
                        بارش {faNum(Math.round(d.precipMM))} میلی‌متر
                      </div>
                    )}
                    {d.sunriseFa && d.sunsetFa && (
                      <div className="mt-1 text-[9px] text-zinc-600">
                        {toFa(d.sunriseFa)} / {toFa(d.sunsetFa)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <p className="px-1 text-center text-[10px] leading-relaxed text-zinc-600">
            داده از {w.providerFa} — پیش‌بینی عددی است و می‌تواند خطای ۱ تا ۲ درجه داشته باشد.
            تازه‌سازی خودکار هر ۱۰ دقیقه. این تب مستقل از موتور ریسک جنگ است.
          </p>
        </>
      )}
    </div>
  )
}
