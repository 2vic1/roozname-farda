import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ویرایش منبع: فعال/غیرفعال، وزن، عنوان
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await req.json()) as {
      active?: boolean
      weight?: number
      label?: string
    }
    const data: { active?: boolean; weight?: number; label?: string } = {}
    if (typeof body.active === 'boolean') data.active = body.active
    if (typeof body.weight === 'number') {
      data.weight = Math.min(1.5, Math.max(0.5, body.weight))
    }
    if (typeof body.label === 'string' && body.label.trim()) {
      data.label = body.label.trim()
    }
    const source = await db.source.update({ where: { id }, data })
    return NextResponse.json({ ok: true, source })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.source.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
