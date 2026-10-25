import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runReportBot } from '@/lib/bots'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// گزارش اخیر
export async function GET() {
  const report = await db.report.findFirst({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ ok: true, report })
}

// تولید مجدد گزارش با هوش مصنوعی
export async function POST() {
  try {
    await runReportBot(true)
    const report = await db.report.findFirst({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ ok: true, report })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
