// ─── API هواشناسی — جدا از موتور ریسک جنگ ───
import { NextResponse } from 'next/server'
import { getWeather, isCityKey } from '@/lib/weather'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const city = (searchParams.get('city') ?? 'tehran').toLowerCase().trim()
    const force = searchParams.get('force') === '1'

    if (!isCityKey(city)) {
      return NextResponse.json({ ok: false, error: 'شهر نامعتبر است' }, { status: 400 })
    }

    const data = await getWeather(city, force)
    return NextResponse.json({ ok: true, data })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'خطای دریافت دادهٔ هواشناسی' },
      { status: 502 },
    )
  }
}
