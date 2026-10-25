import { NextResponse } from 'next/server'
import { runAllBots } from '@/lib/bots'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// تیک زمان‌بند: همه بات‌ها را (در صورت لزوم) اجرا می‌کند
export async function POST() {
  try {
    const results = await runAllBots(false)
    return NextResponse.json({ ok: true, results })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return POST()
}
