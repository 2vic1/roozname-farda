// API استرولوژی — جدا از داشبورد اصلی (الزام کاربر)
import { NextResponse } from 'next/server'
import { computeAstroAnalysis } from '@/lib/astro'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const astro = computeAstroAnalysis(url.searchParams.get('force') === '1')
    return NextResponse.json({ ok: true, astro })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'خطای محاسبه نجومی' },
      { status: 500 }
    )
  }
}
