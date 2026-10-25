import { NextResponse } from 'next/server'
import { runAllBots } from '@/lib/bots'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// اجرای همه بات‌ها — پشتیبانی از GET (؟force=1) و POST
async function handle(force: boolean) {
  try {
    const results = await runAllBots(force)
    return NextResponse.json({ ok: true, results })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const force = url.searchParams.get('force') === '1'
  return handle(force)
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { force?: boolean }
  return handle(body.force ?? true)
}
