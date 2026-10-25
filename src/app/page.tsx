'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AutoRefreshBadge } from '@/components/dashboard/auto-refresh-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  Bell,
  CircleAlert,
  CloudSun,
  Flame,
  Gauge,
  MoonStar,
  Newspaper,
  Plane,
  Radar,
  RefreshCw,
  Settings,
  Sparkles,
  Swords,
  TrendingUp,
  UserRound,
  Wand2,
} from 'lucide-react'
import { RiskGauge } from '@/components/dashboard/risk-gauge'
import { SkyFusionGauges, fuseScores, astroLevel } from '@/components/dashboard/alert-gauges'
import { PredictionCard } from '@/components/dashboard/prediction-card'
import { RiskChart, ForecastStrip } from '@/components/dashboard/risk-chart'
import { NewsFeed } from '@/components/dashboard/news-feed'
import { MarketsGrid } from '@/components/dashboard/markets-grid'
import { FlightsPanel } from '@/components/dashboard/flights-panel'
import { CyclesList } from '@/components/dashboard/cycles-list'
import { ReportView } from '@/components/dashboard/report-view'
import { AccuracyCard } from '@/components/dashboard/accuracy-card'
import { SettingsPanel } from '@/components/dashboard/settings-panel'
import { PatternsCard } from '@/components/dashboard/patterns-card'
import { AstroTab } from '@/components/dashboard/astro-tab'
import { TarotTab } from '@/components/dashboard/tarot-tab'
import { WeatherTab } from '@/components/dashboard/weather-tab'
import { NatalTab } from '@/components/dashboard/natal-tab'
import {
  botFa,
  faNum,
  levelMeta,
  relTimeFa,
  verdictMeta,
  type DashboardData,
  type ReportData,
} from '@/components/dashboard/types'

const REFRESH_SECONDS = 30 // الزام کاربر: همه چیز هر ۳۰ ثانیه تازه شود

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [todayFa, setTodayFa] = useState('')
  const [clock, setClock] = useState('')
  const refreshingRef = useRef(false)

  // ─── دریافت داشبورد ───
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      const j = (await res.json()) as DashboardData
      if (j.ok) {
        setData(j)
        setError(null)
      } else {
        setError('سرور داده معتبری برنگرداند — چند لحظه بعد دوباره تلاش می‌کنیم')
      }
    } catch {
      setError('خطای شبکه در دریافت داده از سرور')
    } finally {
      setLoading(false)
    }
  }, [])

  // لود اولیه
  useEffect(() => {
    load()
  }, [load])

  // شمارش معکوس + تیک خودکار — داخل AutoRefreshBadge ایزوله شده تا درخت کل صفحه هر ثانیه رندر نشود
  const handleAutoRefresh = useCallback(() => {
    load() // بروزرسانی فوری (احتمالاً داده قبلی)
    // تیک واقعی داخل خود بج زده می‌شود؛ بعد از آن داده تازه را می‌گیریم
    void Promise.resolve().then(() => load())
  }, [load])

  // ساعت و تاریخ تهران — فقط سمت کلاینت تا hydration mismatch نداشته باشیم
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTodayFa(
        new Intl.DateTimeFormat('fa-IR', {
          timeZone: 'Asia/Tehran',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(now),
      )
      setClock(
        new Intl.DateTimeFormat('fa-IR', {
          timeZone: 'Asia/Tehran',
          hour: '2-digit',
          minute: '2-digit',
        }).format(now),
      )
    }
    update()
    const t = setInterval(update, 30000)
    return () => clearInterval(t)
  }, [])

  // ─── بروزرسانی دستی: اجرای همه بات‌ها + دریافت مجدد داشبورد ───
  const refreshAll = useCallback(async () => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    setRefreshing(true)
    try {
      await fetch('/api/bots/run?force=1', { cache: 'no-store' })
      await load()
      toast.success('داده‌ها بروزرسانی شد', { description: 'بات‌ها اجرا و نتایج ذخیره شدند' })
    } catch {
      toast.error('خطا در اجرای بات‌ها', { description: 'اتصال را بررسی کنید' })
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }, [load])

  const onReportRegenerated = (r: ReportData) => {
    setData((d) => (d ? { ...d, report: r } : d))
  }

  const risk = data?.risk ?? null
  const meta = risk ? levelMeta(risk.level) : null
  // هشدار تلفیقی — ترکیب لایه علمی و آسمانی (برای نشان هدر)
  const fusion = risk && data?.warAstro ? fuseScores(risk.score, data.warAstro.index) : null
  const fusionMeta = fusion ? levelMeta(astroLevel(fusion.fused)) : null
  const latestRuns = [...(data?.botRuns ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12)

  const lastUpdateFa =
    data?.serverTime && todayFa !== ''
      ? new Intl.DateTimeFormat('fa-IR', {
          timeZone: 'Asia/Tehran',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(data.serverTime))
      : null

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* ─── هدر ─── */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/70 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10">
              <Radar className="h-5 w-5 text-amber-500" />
              {refreshing && (
                <span className="absolute inset-0 animate-ping rounded-xl border border-amber-500/60" />
              )}
            </div>
            <div>
              <h1 className="text-base font-black leading-6 text-zinc-100">روزنامه فردا</h1>
              <p className="text-[11px] text-zinc-500" suppressHydrationWarning>
                {todayFa ? `${todayFa} — خبرهای فردا را امروز بخوان` : 'خبرهای فردا را امروز بخوان'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {meta && risk && (
              <Badge variant="outline" className={`gap-1.5 text-xs font-bold ${meta.chip}`}>
                <span
                  className="h-2 w-2 rounded-full radar-pulse"
                  style={{ background: meta.color }}
                />
                علمی — {faNum(risk.score)}
              </Badge>
            )}
            {fusion && fusionMeta && (
              <Badge
                variant="outline"
                className={`gap-1.5 text-xs font-bold ${fusionMeta.chip}`}
                title="هشدار تلفیقی علمی + آسمانی"
              >
                <Swords className="h-3 w-3" />
                تلفیقی — {faNum(fusion.fused)}
              </Badge>
            )}
            <AutoRefreshBadge seconds={REFRESH_SECONDS} onRefresh={handleAutoRefresh} />
            <span className="hidden text-[11px] tabular-nums text-zinc-500 md:block" dir="ltr">
              {clock} Tehran
            </span>
            {lastUpdateFa && (
              <span className="hidden text-[11px] text-zinc-600 lg:block">
                آخرین بروزرسانی: {lastUpdateFa}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={refreshAll}
              disabled={refreshing}
              aria-label="اجرای بات‌ها و بروزرسانی داده‌ها"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              بروزرسانی
            </Button>
          </div>
        </div>

        {/* نوار هشدار سطح بالا */}
        {meta && risk && (risk.level === 'high' || risk.level === 'critical') && (
          <div
            className="radar-pulse py-1 text-center text-xs font-bold text-red-200"
            style={{ background: 'rgba(220,38,38,0.25)' }}
          >
            ⚠ سطح هشدار بالاست — اخبار بحرانی را در تب اخبار دنبال کنید
          </div>
        )}
      </header>

      {/* ─── بدنه ─── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
        {error && (
          <Alert
            variant="destructive"
            className="mb-4 border-red-500/40 bg-red-950/40 text-red-200"
          >
            <CircleAlert className="h-4 w-4" />
            <AlertTitle>خطا در دریافت داده</AlertTitle>
            <AlertDescription>
              {error}
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-8 border-red-500/40 text-red-200 hover:bg-red-900/40"
                onClick={() => {
                  setLoading(true)
                  load()
                }}
              >
                تلاش دوباره
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!data && loading ? (
          <FirstLoadSkeleton />
        ) : (
          <Card className="border-zinc-800/70 bg-zinc-900/40">
            <CardContent className="p-3 sm:p-5">
              <Tabs defaultValue="alert">
                <TabsList className="flex h-auto w-full flex-wrap gap-1 bg-zinc-950/60 p-1">
                  <TabsTrigger
                    value="alert"
                    className="gap-1.5 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-400"
                  >
                    <Gauge className="h-3.5 w-3.5" /> وضعیت هشدار
                  </TabsTrigger>
                  <TabsTrigger value="news" className="gap-1.5">
                    <Newspaper className="h-3.5 w-3.5" /> اخبار
                  </TabsTrigger>
                  <TabsTrigger value="markets" className="gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> بازارها
                  </TabsTrigger>
                  <TabsTrigger value="flights" className="gap-1.5">
                    <Plane className="h-3.5 w-3.5" /> پروازهای نظامی
                  </TabsTrigger>
                  <TabsTrigger value="cycles" className="gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> چرخه‌ها
                  </TabsTrigger>
                  <TabsTrigger
                    value="weather"
                    className="gap-1.5 data-[state=active]:bg-teal-500/15 data-[state=active]:text-teal-300"
                  >
                    <CloudSun className="h-3.5 w-3.5" /> هواشناسی
                  </TabsTrigger>
                  <TabsTrigger
                    value="astro"
                    className="gap-1.5 data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-300"
                  >
                    <MoonStar className="h-3.5 w-3.5" /> استرولوژی
                  </TabsTrigger>
                  <TabsTrigger
                    value="natal"
                    className="gap-1.5 data-[state=active]:bg-fuchsia-500/15 data-[state=active]:text-fuchsia-300"
                  >
                    <Swords className="h-3.5 w-3.5" /> استرولوزی جنگ
                  </TabsTrigger>
                  <TabsTrigger value="tarot" className="gap-1.5">
                    <Wand2 className="h-3.5 w-3.5" /> تاروت
                  </TabsTrigger>
                  <TabsTrigger value="report" className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> گزارش هوش مصنوعی
                  </TabsTrigger>
                  <TabsTrigger value="sources" className="gap-1.5">
                    <Settings className="h-3.5 w-3.5" /> منابع
                  </TabsTrigger>
                </TabsList>

                {/* ─── تب ۱: وضعیت هشدار ─── */}
                <TabsContent value="alert" className="space-y-5 pt-4">
                  {risk && meta ? (
                    <>
                      <div className="grid gap-5 lg:grid-cols-5">
                        {/* نشانگر ۱ — هشدار علمی جنگ (همان گیج اصلی، حالا با نام رسمی) */}
                        <Card className="border-zinc-800/70 bg-zinc-900/50 lg:col-span-2">
                          <CardContent className="pb-6 pt-5">
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-2">
                                <Radar className="h-4 w-4 text-amber-500" />
                                <h2 className="text-sm font-black text-zinc-100">هشدار علمی جنگ</h2>
                              </div>
                              <p className="mt-0.5 text-center text-[10px] text-zinc-500">
                                اخبار، بازارها، چرخه‌های زمانی، پروازهای نظامی و الگوهای تاریخی
                              </p>
                              <div className="mt-2 flex justify-center">
                                <RiskGauge score={risk.score} level={risk.level} trend={risk.trend} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* نشانگر ۲ و ۳ — هشدار آسمانی جنگ + هشدار تلفیقی */}
                        <div className="lg:col-span-3">
                          <SkyFusionGauges riskScore={risk.score} warAstro={data?.warAstro} />
                        </div>

                        <Card className="border-zinc-800/70 bg-zinc-900/50 lg:col-span-5">
                          <CardContent className="p-5">
                            <PredictionCard risk={risk} />
                          </CardContent>
                        </Card>
                      </div>

                      {/* پنج زیرامتیاز */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {[
                          {
                            label: 'تنش خبری',
                            value: risk.newsScore,
                            color: '#ef4444',
                            Icon: Newspaper,
                            desc: `${faNum(risk.detail.newsCount48h ?? 0)} خبر در ۴۸ ساعت`,
                          },
                          {
                            label: 'استرس بازار',
                            value: risk.marketScore,
                            color: '#f97316',
                            Icon: TrendingUp,
                            desc: 'نفت، طلا، سهام، کریپتو',
                          },
                          {
                            label: 'الگوی کلان',
                            value: risk.patternScore ?? 0,
                            color: '#a78bfa',
                            Icon: Radar,
                            desc: 'شباهت با امضای پیش از جنگ‌های تاریخی',
                          },
                          {
                            label: 'فشار چرخه‌ها',
                            value: risk.cycleScore,
                            color: '#f59e0b',
                            Icon: Activity,
                            desc: `${faNum(risk.detail.cycleToday?.hits.length ?? 0)} تقاطع زمانی امروز`,
                          },
                          {
                            label: 'پروازهای نظامی',
                            value: risk.flightScore,
                            color: '#a1a1aa',
                            Icon: Plane,
                            desc: 'چیدمان هوایی آمریکا در منطقه',
                          },
                        ].map((row) => (
                          <Card key={row.label} className="border-zinc-800/70 bg-zinc-900/50">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                                  <row.Icon className="h-3.5 w-3.5" style={{ color: row.color }} />
                                  {row.label}
                                </span>
                                <span
                                  className="text-sm font-bold tabular-nums"
                                  style={{ color: row.color }}
                                >
                                  {faNum(row.value)}
                                </span>
                              </div>
                              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, row.value))}%`,
                                    background: row.color,
                                  }}
                                />
                              </div>
                              <p className="mt-1.5 text-[10px] text-zinc-500">{row.desc}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* روند کلان و الگوهای تاریخی */}
                      <PatternsCard patterns={data?.patterns ?? []} risk={risk} />

                      {/* نمودار تاریخچه */}
                      <Card className="border-zinc-800/70 bg-zinc-900/50">
                        <CardContent className="p-4 sm:p-5">
                          <h3 className="mb-3 text-sm font-bold text-zinc-300">
                            روند ۴۵ روز گذشته + پیش‌بینی ۱۴ روز آینده
                          </h3>
                          <RiskChart
                            history={data?.history ?? []}
                            forecast={risk.forecast}
                            today={data?.today ?? ''}
                          />
                        </CardContent>
                      </Card>

                      {/* نوار پیش‌بینی ۱۴ روز آینده */}
                      <Card className="border-zinc-800/70 bg-zinc-900/50">
                        <CardContent className="p-4 sm:p-5">
                          <h3 className="mb-3 text-sm font-bold text-zinc-300">
                            نقشه حرارتی ۱۴ روز آینده
                          </h3>
                          <ForecastStrip forecast={risk.forecast} />
                        </CardContent>
                      </Card>

                      {/* سیگنال‌های داغ */}
                      {(data?.hotNews ?? []).length > 0 && (
                        <Card className="border-red-500/25 bg-red-950/20">
                          <CardContent className="p-4">
                            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-300">
                              <Flame className="h-4 w-4" />
                              سیگنال‌های داغ
                            </h3>
                            <div className="space-y-2">
                              {data!.hotNews.slice(0, 3).map((n) => {
                                const v = verdictMeta(n.aiVerdict)
                                return (
                                  <a
                                    key={n.id}
                                    href={n.url ?? '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-lg border border-red-500/20 bg-zinc-950/40 px-3 py-2 transition-colors hover:bg-zinc-900/60"
                                  >
                                    <p
                                      className="line-clamp-1 text-xs leading-6 text-zinc-200"
                                      dir="auto"
                                    >
                                      {n.title}
                                    </p>
                                    <p className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
                                      <Badge
                                        variant="outline"
                                        className={`h-4 px-1 text-[9px] ${v.chip}`}
                                      >
                                        {v.fa}
                                      </Badge>
                                      {n.sourceLabel}
                                      <span suppressHydrationWarning>
                                        {relTimeFa(new Date(n.publishedAt))}
                                      </span>
                                    </p>
                                  </a>
                                )
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <LoaderOrNothing />
                      <p className="text-sm text-zinc-400">
                        هنوز داده‌ای برای امروز ثبت نشده — دکمه «بروزرسانی» را بزنید تا بات‌ها
                        اجرا شوند
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* ─── تب ۲: اخبار ─── */}
                <TabsContent value="news" className="pt-4">
                  <NewsFeed news={data?.news ?? []} />
                </TabsContent>

                {/* ─── تب ۳: بازارها ─── */}
                <TabsContent value="markets" className="pt-4">
                  {data?.assets.length ? (
                    <MarketsGrid assets={data.assets} metrics={data.metrics} />
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
                      <p className="text-sm text-zinc-400">بات بازارگیر در حال دریافت داده‌هاست...</p>
                    </div>
                  )}
                </TabsContent>

                {/* ─── تب ۴: پروازهای نظامی ─── */}
                <TabsContent value="flights" className="pt-4">
                  <FlightsPanel flights={data?.flights ?? null} />
                </TabsContent>

                {/* ─── تب ۵: چرخه‌ها ─── */}
                <TabsContent value="cycles" className="pt-4">
                  <CyclesList cycles={data?.cycles ?? []} />
                </TabsContent>

                {/* ─── تب هواشناسی: مراکز استان‌ها — جدا از موتور اصلی ─── */}
                <TabsContent value="weather" className="pt-4">
                  <WeatherTab />
                </TabsContent>

                {/* ─── تب استرولوژی: فقط نجوم جهان‌بین — جدا از موتور اصلی ─── */}
                <TabsContent value="astro" className="pt-4">
                  <AstroTab />
                </TabsContent>

                {/* ─── تب چارت تولد: استرولوژی شخصی ترکیبی — جدا از موتور اصلی ─── */}
                <TabsContent value="natal" className="pt-4">
                  <NatalTab />
                </TabsContent>
                <TabsContent value="tarot" className="pt-4">
                  <TarotTab />
                </TabsContent>

                {/* ─── تب ۶: گزارش هوش مصنوعی ─── */}
                <TabsContent value="report" className="space-y-5 pt-4">
                  <div className="grid gap-5 lg:grid-cols-3">
                    <Card className="border-zinc-800/70 bg-zinc-900/50 lg:col-span-2">
                      <CardContent className="p-5">
                        <ReportView
                          report={data?.report ?? null}
                          onRegenerated={onReportRegenerated}
                        />
                      </CardContent>
                    </Card>
                    <Card className="border-zinc-800/70 bg-zinc-900/50">
                      <CardContent className="p-5">
                        <AccuracyCard accuracy={data?.aiAccuracy ?? emptyAccuracy} />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* ─── تب ۷: منابع ─── */}
                <TabsContent value="sources" className="pt-4">
                  <SettingsPanel
                    sources={data?.sources ?? []}
                    refEvents={data?.refEvents ?? []}
                    onChanged={load}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </main>

      {/* ─── فوتر چسبیده ─── */}
      <footer className="mt-auto border-t border-zinc-800/70 bg-zinc-950 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-3">
          {/* وضعیت آخرین اجرای بات‌ها */}
          <div className="flex flex-wrap items-center gap-1.5" aria-label="وضعیت بات‌ها">
            <span className="flex items-center gap-1 text-[10px] text-zinc-600">
              <Bell className="h-3 w-3" />
              بات‌ها:
            </span>
            {latestRuns.length === 0 ? (
              <span className="text-[10px] text-zinc-600">هنوز اجرایی ثبت نشده</span>
            ) : (
              latestRuns.map((r) => (
                <Badge
                  key={r.id}
                  variant="outline"
                  className="gap-1 border-zinc-800 px-1.5 py-0 text-[9px] font-normal text-zinc-500"
                  title={r.message ?? `${botFa(r.bot)} — ${r.status}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      r.status === 'ok'
                        ? 'bg-emerald-500'
                        : r.status === 'error'
                          ? 'bg-red-500'
                          : 'bg-amber-500 radar-pulse'
                    }`}
                  />
                  {botFa(r.bot)}
                  <span className="tabular-nums text-zinc-600">· {faNum(r.items)}</span>
                </Badge>
              ))
            )}
          </div>

          <Separator className="bg-zinc-800/50" />

          <p className="text-[11px] leading-5 text-zinc-600">
            این سامانه فقط تحلیل احتمالاتی است و پیش‌بینی قطعی نیست — مبنای تصمیم نظامی یا
            سرمایه‌گذاری نیست.
          </p>
        </div>
      </footer>
    </div>
  )
}

function LoaderOrNothing() {
  return <Radar className="h-8 w-8 text-zinc-700" />
}

const emptyAccuracy = {
  total: 0,
  hit: 0,
  miss: 0,
  pending: 0,
  hitRate: 0,
  lastMistakes: [],
}

function FirstLoadSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="در حال بارگذاری داشبورد">
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-80 bg-zinc-800/50 lg:col-span-2" />
        <Skeleton className="h-80 bg-zinc-800/50 lg:col-span-3" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 bg-zinc-800/50" />
        ))}
      </div>
      <Skeleton className="h-64 bg-zinc-800/50" />
    </div>
  )
}
