'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Bomb, Crosshair, Fuel, Plane, PlaneTakeoff, Radar, Satellite } from 'lucide-react'
import { faNum, relTimeFa } from './types'
import type { FlightData } from './types'

const CATEGORY_ICON: Record<string, typeof Plane> = {
  tanker: Fuel,
  transport: PlaneTakeoff,
  fighter: Crosshair,
  recon: Radar,
  bomber: Bomb,
  other: Plane,
}

const CATEGORY_FA: Record<string, string> = {
  tanker: 'سوخت‌رسان',
  transport: 'ترابری',
  fighter: 'جنگنده',
  recon: 'شناسایی',
  bomber: 'بمب‌افکن',
  other: 'سایر',
}

function significanceMeta(v: number): { fa: string; color: string; chip: string } {
  if (v >= 75)
    return {
      fa: 'بسیار معنادار',
      color: '#dc2626',
      chip: 'border-red-500/50 bg-red-500/10 text-red-300',
    }
  if (v >= 50)
    return {
      fa: 'معنادار',
      color: '#ef4444',
      chip: 'border-red-500/40 bg-red-500/10 text-red-400',
    }
  if (v >= 25)
    return {
      fa: 'قابل توجه',
      color: '#f97316',
      chip: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
    }
  return {
    fa: 'عادی',
    color: '#10b981',
    chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  }
}

// پنل پروازهای نظامی آمریکا نزدیک ایران
export function FlightsPanel({ flights }: { flights: FlightData | null }) {
  if (!flights) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Skeleton className="h-12 w-12 rounded-full bg-zinc-800" />
          <p className="text-sm text-zinc-400">
            بات پروازگیر هنوز داده‌ای ثبت نکرده — دکمه «بروزرسانی» را بزنید تا اجرا شود
          </p>
          <p className="max-w-md text-[11px] leading-5 text-zinc-600">
            داده از شبکه ADSB عمومی خوانده می‌شود؛ در برخی بازه‌های شبانه تعداد پروازها کم است
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-28 bg-zinc-800/60" />
          <Skeleton className="h-28 bg-zinc-800/60" />
          <Skeleton className="h-28 bg-zinc-800/60" />
        </div>
      </div>
    )
  }

  const sig = significanceMeta(flights.significance)
  const counts = [
    { key: 'tanker', label: CATEGORY_FA.tanker, value: flights.tankers },
    { key: 'transport', label: CATEGORY_FA.transport, value: flights.transport },
    { key: 'fighter', label: CATEGORY_FA.fighter, value: flights.fighters },
    { key: 'recon', label: CATEGORY_FA.recon, value: flights.recon },
    { key: 'bomber', label: CATEGORY_FA.bomber, value: flights.bombers },
    { key: 'other', label: CATEGORY_FA.other, value: flights.other },
  ]

  const sorted = [...flights.details].sort((a, b) => a.kmToIran - b.kmToIran)

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-[11px] leading-5 text-zinc-500">
        <Satellite className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        داده از شبکه ADSB عمومی — هواپیماهای نظامی آمریکا در منطقه
        {flights.createdAt && (
          <span className="text-zinc-600">
            (آخرین اسکن: {relTimeFa(new Date(flights.createdAt))})
          </span>
        )}
      </p>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* کارت خلاصه */}
        <Card className="border-zinc-800/70 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-400">خلاصه وضعیت پروازها</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-black tabular-nums text-zinc-100">{faNum(flights.total)}</p>
                <p className="text-[11px] text-zinc-500">هواپیمای نظامی ردیابی‌شده</p>
              </div>
              <Badge variant="outline" className={`text-[10px] ${sig.chip}`}>
                معناداری: {sig.fa}
              </Badge>
            </div>

            {/* سنجه معناداری */}
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                <span>شاخص معناداری چیدمان هوایی</span>
                <span className="tabular-nums" style={{ color: sig.color }}>
                  {faNum(flights.significance)}٪
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${flights.significance}%`, background: sig.color }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2 text-xs">
              <span className="text-zinc-400">در برد نزدیک ایران (۹۰۰ کیلومتر)</span>
              <span
                className={`font-bold tabular-nums ${flights.nearIran > 0 ? 'text-red-400' : 'text-emerald-400'}`}
              >
                {faNum(flights.nearIran)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2 text-xs">
              <span className="text-zinc-400">نزدیک‌ترین فاصله به ایران</span>
              <span className="font-bold tabular-nums text-amber-400" dir="ltr">
                {flights.nearestKm !== null ? `${faNum(Math.round(flights.nearestKm))} km` : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* شمارش دسته‌ها */}
        <Card className="border-zinc-800/70 bg-zinc-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-400">ترکیب ناوگان هوایی</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {counts.map((c) => {
              const Icon = CATEGORY_ICON[c.key] ?? Plane
              const active = c.value > 0
              return (
                <div
                  key={c.key}
                  className={`flex items-center gap-2.5 rounded-lg border p-2.5 ${
                    active ? 'border-zinc-800/70 bg-zinc-950/40' : 'border-zinc-800/40 opacity-45'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-amber-500' : 'text-zinc-600'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold tabular-nums text-zinc-100">{faNum(c.value)}</p>
                    <p className="truncate text-[10px] text-zinc-500">{c.label}</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* جدول هواپیماها */}
        <Card className="border-zinc-800/70 bg-zinc-900/50 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-zinc-400">
              نزدیک‌ترین هواپیماها به ایران
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sorted.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">
                جزئیات پروازی در این اسکن ثبت نشده
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-800/60">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-start text-[10px] text-zinc-500">کالساین</TableHead>
                      <TableHead className="text-start text-[10px] text-zinc-500">نوع</TableHead>
                      <TableHead className="text-start text-[10px] text-zinc-500">دسته</TableHead>
                      <TableHead className="text-start text-[10px] text-zinc-500">فاصله</TableHead>
                      <TableHead className="text-start text-[10px] text-zinc-500">ارتفاع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((d, i) => (
                      <TableRow key={`${d.callsign}-${i}`} className="text-xs">
                        <TableCell dir="ltr" className="text-start font-mono text-[11px] text-zinc-200">
                          {d.callsign}
                        </TableCell>
                        <TableCell dir="ltr" className="text-start text-zinc-400">
                          {d.type}
                        </TableCell>
                        <TableCell className="text-start text-zinc-400">
                          {CATEGORY_FA[d.category] ?? d.category}
                        </TableCell>
                        <TableCell className="text-start">
                          <span
                            className={`tabular-nums ${
                              d.kmToIran <= 900 ? 'font-bold text-red-400' : 'text-zinc-300'
                            }`}
                            dir="ltr"
                          >
                            {faNum(Math.round(d.kmToIran))} km
                          </span>
                        </TableCell>
                        <TableCell dir="ltr" className="text-start tabular-nums text-zinc-400">
                          {d.altFt !== null ? faNum(d.altFt) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
