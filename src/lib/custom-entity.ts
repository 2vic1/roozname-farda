// ─── چارت دلخواه کاربر — تعریف مشترک کلاینت/سرور (ماژول خالص، بدون دیتابیس) ───
// حریم خصوصی: تعریف‌ها فقط در حافظه‌ی تب مرورگر کاربر (sessionStorage) زندگی می‌کنند؛
// روی سرور فقط برای «همان یک محاسبه» در RAM می‌مانند — هیچ جدول، فایل یا لاگی نوشته نمی‌شود
// و با بستن تب مرورگر کاملاً پاک می‌شوند.

export const MAX_CUSTOMS = 8

export interface CustomDefInput {
  name: string // نام نمایشی فارسی (شخص یا دولت)
  kind: 'person' | 'state'
  date: string // YYYY-MM-DD میلادی
  time: string // HH:MM — خالی/نامعتبر ⇒ ۱۲:۰۰
  lat: number
  lon: number
  placeFa: string
}

/** شناسه پایدار بر اساس محتوا — همان تعریف = همان شناسه (کش سرور گرم می‌ماند، تکراری اضافه نمی‌شود) */
export function customDefKey(def: CustomDefInput): string {
  const s = `${def.name.trim().toLowerCase()}|${def.kind}|${def.date}|${def.time}|${def.lat}|${def.lon}`
  // FNV-1a ۳۲ بیتی
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `custom:${(h >>> 0).toString(36)}`
}

/** ساعت دیواری تهران → UTC — با احتساب تاریخی DST (‎+04:30 تابستان‌ها تا ۱۴۰۱، بعدش ثابت ‎+03:30) */
export function tehranWallToUtc(date: string, time: string): Date {
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

/** اعتبارسنجی/پاک‌سازی تعریف‌های ورودی — نامعتبرها حذف، تکراری‌ها ادغام، سقف ۸ */
export function sanitizeCustomDefs(raw: unknown): CustomDefInput[] {
  if (!Array.isArray(raw)) return []
  const out: CustomDefInput[] = []
  const seen = new Set<string>()
  for (const r of raw.slice(0, MAX_CUSTOMS)) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const name = String(o.name ?? '').trim()
    const kind = o.kind === 'state' ? 'state' : 'person'
    const date = String(o.date ?? '').trim()
    const time = /^\d{2}:\d{2}$/.test(String(o.time ?? '')) ? String(o.time) : '12:00'
    const lat = Number(o.lat)
    const lon = Number(o.lon)
    const placeFa = String(o.placeFa ?? 'نامشخص').trim() || 'نامشخص'
    if (name.length < 2 || name.length > 60) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) continue
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) continue
    const d = tehranWallToUtc(date, time)
    if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1700 || d.getUTCFullYear() > 2100) continue
    const def: CustomDefInput = { name, kind, date, time, lat, lon, placeFa }
    const key = customDefKey(def)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(def)
  }
  return out
}

/** خواندن تعریف‌ها از sessionStorage مرورگر (فقط کلاینت — در سرور خالی برمی‌گردد) */
export function readCustomDefsFromSession(): CustomDefInput[] {
  if (typeof window === 'undefined') return []
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem('warCustomDefs.v1') ?? '[]')
    return sanitizeCustomDefs(raw)
  } catch {
    return []
  }
}

/** نوشتن تعریف‌ها در sessionStorage — فقط حافظه‌ی تب؛ با بستن تب پاک می‌شود */
export function writeCustomDefsToSession(defs: CustomDefInput[]): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem('warCustomDefs.v1', JSON.stringify(defs))
  } catch {
    // حافظه در دسترس نیست (حالت خصوصی مرورگر) — چارت‌ها فقط تا رفرش زنده می‌مانند
  }
}
