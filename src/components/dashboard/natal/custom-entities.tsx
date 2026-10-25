'use client'

// ─── افراد/دولت‌های انتخابی — چارت دلخواه کاربر با تاریخ و ساعت دقیق تولد ───
// چارت افزوده‌شده با همان موتور دقیق ephemeris محاسبه و در سینستری، پنجره‌ها و تحلیل AI استفاده می‌شود
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, UserPlus, X } from 'lucide-react'
import { utcToJalaliTehran, jalaliMonthLabel } from '@/lib/jalali'
import type { WarEntityChart } from '@/lib/war-astro'

const faTxt = (s: string | number) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

// شهرهای مرجع برای مکان تولد/تأسیس
export const CITIES = [
  { fa: 'تهران', lat: 35.6892, lon: 51.389 },
  { fa: 'اصفهان', lat: 32.6539, lon: 51.66 },
  { fa: 'مشهد', lat: 36.2605, lon: 59.6168 },
  { fa: 'تل‌آویو', lat: 32.0853, lon: 34.7818 },
  { fa: 'القدس', lat: 31.7683, lon: 35.2137 },
  { fa: 'واشنگتن دی‌سی', lat: 38.9072, lon: -77.0369 },
  { fa: 'نیویورک', lat: 40.7128, lon: -74.006 },
  { fa: 'لندن', lat: 51.5074, lon: -0.1278 },
  { fa: 'مسکو', lat: 55.7558, lon: 37.6173 },
  { fa: 'پاریس', lat: 48.8566, lon: 2.3522 },
  { fa: 'برلین', lat: 52.52, lon: 13.405 },
  { fa: 'پکن', lat: 39.9042, lon: 116.4074 },
  { fa: 'ریاض', lat: 24.7136, lon: 46.6753 },
  { fa: 'دبی', lat: 25.2048, lon: 55.2708 },
  { fa: 'بغداد', lat: 33.3152, lon: 44.3661 },
  { fa: 'بیروت', lat: 33.8938, lon: 35.5018 },
  { fa: 'آنکارا', lat: 39.9334, lon: 32.8597 },
]

export function CustomEntitiesCard({
  customs,
  onChanged,
}: {
  customs: WarEntityChart[]
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'person' | 'state'>('person')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [cityIdx, setCityIdx] = useState('0')
  const [busy, setBusy] = useState(false)

  const city = CITIES[Number(cityIdx)] ?? CITIES[0]
  // پیش‌نمایش جلالی تاریخ انتخابی (تقویمی — بدون لحظه)
  const jalaliPreview = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? (() => {
        try {
          const j = utcToJalaliTehran(new Date(date + 'T00:00:00Z'))
          return `${faTxt(j.jd)} ${jalaliMonthLabel(j.jy, j.jm).split(' ')[0]} ${faTxt(j.jy)}`
        } catch {
          return ''
        }
      })()
    : ''

  const add = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error('نام را وارد کنید (حداقل ۲ نویسه)')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error('تاریخ تولد/تأسیس را وارد کنید')
      return
    }
    setBusy(true)
    try {
      const r = await fetch('/api/astro/custom', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          kind,
          date,
          time: time || '12:00',
          lat: city.lat,
          lon: city.lon,
          placeFa: city.fa,
        }),
      })
      const j = await r.json() as { ok: boolean; error?: string }
      if (!j.ok) {
        toast.error('افزودن ناموفق', { description: j.error })
        return
      }
      toast.success('چارت افزوده شد', {
        description: `${name.trim()} (${city.fa}${time ? `، ${time}` : '، ظهر'}) — در سینستری، پنجره‌ها و تحلیل هوش مصنوعی فعال است`,
      })
      setName('')
      setDate('')
      setTime('')
      onChanged()
    } catch {
      toast.error('خطای شبکه در افزودن چارت')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string, label: string) => {
    setBusy(true)
    try {
      await fetch(`/api/astro/custom?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      toast.success('چارت حذف شد', { description: label })
      onChanged()
    } catch {
      toast.error('خطای شبکه در حذف چارت')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-teal-900/40 bg-zinc-900/40">
      <CardContent className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-200">
            <UserPlus className="h-4 w-4 text-teal-400" />
            افراد و دولت‌های انتخابی — چارت دلخواه شما
          </h3>
          <Badge variant="outline" className="border-zinc-700 text-[9px] text-zinc-500">
            {faTxt(customs.length)} از ۸ — در تحلیل فعال
          </Badge>
        </div>

        {customs.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {customs.map((c) => (
              <Badge
                key={c.meta.id}
                variant="outline"
                className="gap-1.5 border-teal-500/30 bg-teal-500/5 py-1 pl-1 text-[10px] text-teal-200"
              >
                {c.meta.flag} {faTxt(c.meta.fa)} — {faTxt(c.meta.chartFa.split('—')[0])}
                <button
                  onClick={() => remove(c.meta.id.slice('custom:'.length), c.meta.fa)}
                  disabled={busy}
                  aria-label={`حذف چارت ${c.meta.fa}`}
                  className="rounded-full p-0.5 text-teal-300/70 transition hover:bg-teal-500/20 hover:text-teal-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 sm:col-span-1 lg:col-span-2">
            <label className="mb-1 block text-[10px] text-zinc-500">نام (شخص یا دولت)</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: رهبر جمهوری اسلامی"
              className="h-9 text-xs"
              maxLength={60}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">نوع</label>
            <Select value={kind} onValueChange={(v) => setKind(v as 'person' | 'state')}>
              <SelectTrigger className="h-9 text-xs" aria-label="نوع چارت">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="person">👤 شخص</SelectItem>
                <SelectItem value="state">🏛️ دولت / نهاد</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">تاریخ تولد / تأسیس</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 text-xs"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">ساعت (اختیاری)</label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-9 text-xs"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">مکان</label>
            <Select value={cityIdx} onValueChange={setCityIdx}>
              <SelectTrigger className="h-9 text-xs" aria-label="مکان تولد">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {CITIES.map((c, i) => (
                  <SelectItem key={c.fa} value={String(i)} className="text-xs">
                    {c.fa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] leading-4 text-zinc-600">
            {jalaliPreview ? `تاریخ انتخابی: ${jalaliPreview} — ` : ''}
            {time ? `ساعت ${time}` : 'ساعت ندادید — ظهر فرض می‌شود'} · مکان: {city.fa}
            {' '}({city.lat.toFixed(2)}, {city.lon.toFixed(2)}) · آفست تاریخی تهران (DST) خودکار اعمال می‌شود
          </p>
          <Button size="sm" className="h-8 gap-1.5" onClick={add} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            افزودن چارت به تحلیل
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
