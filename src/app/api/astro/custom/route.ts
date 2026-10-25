// API چارت‌های دلخواه کاربر (افراد/دولت‌های انتخابی) — با تاریخ/ساعت/مکان تولد
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const MAX_CUSTOMS = 8

/** ساعت دیواری تهران → UTC — با احتساب تاریخی DST (‎+04:30 تابستان‌ها تا ۱۴۰۱، بعدش ثابت ‎+03:30) */
function tehranWallToUtc(date: string, time: string): Date {
  const candidates = [210, 270] // +03:30 و +04:30
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  for (const off of candidates) {
    const sign = off >= 0 ? '+' : '-'
    const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
    const m = String(Math.abs(off) % 60).padStart(2, '0')
    const t = new Date(`${date}T${time}:00${sign}${h}:${m}`)
    if (fmt.format(t) === time) return t
  }
  return new Date(`${date}T${time}:00+03:30`)
}

export async function GET() {
  try {
    const rows = await db.customEntity.findMany({ orderBy: { createdAt: 'asc' }, take: MAX_CUSTOMS })
    return NextResponse.json({ ok: true, items: rows })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'خطای خواندن چارت‌های دلخواه' },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string
      kind?: string
      date?: string // YYYY-MM-DD میلادی
      time?: string // HH:MM اختیاری — پیش‌فرض ۱۲:۰۰
      lat?: number
      lon?: number
      placeFa?: string
    }
    const name = (body.name ?? '').trim()
    const kind = body.kind === 'state' ? 'state' : 'person'
    const date = (body.date ?? '').trim()
    const time = /^\d{2}:\d{2}$/.test(body.time ?? '') ? body.time! : '12:00'
    const lat = Number(body.lat)
    const lon = Number(body.lon)
    const placeFa = (body.placeFa ?? 'نامشخص').trim()

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json({ ok: false, error: 'نام باید بین ۲ تا ۶۰ نویسه باشد' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ ok: false, error: 'تاریخ نامعتبر است' }, { status: 400 })
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      return NextResponse.json({ ok: false, error: 'مختصات مکان نامعتبر است' }, { status: 400 })
    }
    const count = await db.customEntity.count()
    if (count >= MAX_CUSTOMS) {
      return NextResponse.json(
        { ok: false, error: `حداکثر ${MAX_CUSTOMS} چارت دلخواه می‌توان افزود — ابتدا یکی را حذف کنید` },
        { status: 400 },
      )
    }
    const isoUtc = tehranWallToUtc(date, time)
    if (Number.isNaN(isoUtc.getTime()) || isoUtc.getUTCFullYear() < 1700 || isoUtc.getUTCFullYear() > 2100) {
      return NextResponse.json({ ok: false, error: 'تاریخ خارج از بازه معتبر است (۱۷۰۰ تا ۲۱۰۰)' }, { status: 400 })
    }
    const row = await db.customEntity.create({
      data: { name, kind, isoUtc, lat, lon, placeFa },
    })
    return NextResponse.json({ ok: true, item: row })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'خطای افزودن چارت دلخواه' },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id') ?? ''
    if (!id) {
      return NextResponse.json({ ok: false, error: 'شناسه لازم است' }, { status: 400 })
    }
    await db.customEntity.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'حذف ناموفق — شناسه پیدا نشد' }, { status: 500 })
  }
}
