import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// مدیریت منابع خبری: لیست + افزودن
export async function GET() {
  const sources = await db.source.findMany({
    orderBy: [{ active: 'desc' }, { type: 'asc' }],
  })
  return NextResponse.json({ ok: true, sources })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      type?: string
      handle?: string
      label?: string
      lang?: string
      weight?: number
    }
    const allowedTypes = ['telegram', 'x', 'instagram', 'rss'] as const
    const type = allowedTypes.includes(body.type as (typeof allowedTypes)[number])
      ? (body.type as (typeof allowedTypes)[number])
      : 'telegram'
    let handle = (body.handle ?? '').trim()
    const label = (body.label ?? '').trim()
    const lang = ['fa', 'en', 'ar'].includes(body.lang ?? '') ? body.lang! : 'en'
    const weight = Math.min(1.5, Math.max(0.5, body.weight ?? 1))

    if (!handle || !label) {
      return NextResponse.json(
        { ok: false, error: 'آدرس و عنوان الزامی است' },
        { status: 400 }
      )
    }

    if (type === 'telegram') {
      // پاکسازی شناسه کانال: حذف @ و t.me/ و پیش‌نمایش
      handle = handle
        .replace(/^https?:\/\/t\.me\/(s\/)?/i, '')
        .replace(/^@/, '')
        .replace(/\/$/, '')
        .trim()
      if (!/^[A-Za-z0-9_]{4,64}$/.test(handle)) {
        return NextResponse.json(
          { ok: false, error: 'شناسه کانال تلگرام نامعتبر است' },
          { status: 400 }
        )
      }
    } else if (type === 'x') {
      handle = handle
        .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '')
        .replace(/^@/, '')
        .replace(/\/$/, '')
        .trim()
      if (!/^[A-Za-z0-9_]{2,15}$/.test(handle)) {
        return NextResponse.json(
          { ok: false, error: 'شناسه حساب ایکس نامعتبر است' },
          { status: 400 }
        )
      }
    } else if (type === 'instagram') {
      handle = handle
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/\/$/, '')
        .replace(/\?.*$/, '')
        .trim()
      if (!/^[A-Za-z0-9._]{2,30}$/.test(handle)) {
        return NextResponse.json(
          { ok: false, error: 'شناسه پیج اینستاگرام نامعتبر است' },
          { status: 400 }
        )
      }
    } else {
      if (!/^https?:\/\/.+/.test(handle)) {
        return NextResponse.json(
          { ok: false, error: 'آدرس RSS باید با http شروع شود' },
          { status: 400 }
        )
      }
    }

    const exists = await db.source.findUnique({ where: { handle } })
    if (exists) {
      return NextResponse.json(
        { ok: false, error: 'این منبع قبلاً اضافه شده است' },
        { status: 409 }
      )
    }

    const source = await db.source.create({
      data: { type, handle, label, lang, weight, storiesOnly: type === 'instagram' },
    })
    return NextResponse.json({ ok: true, source })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
