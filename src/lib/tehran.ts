// ابزارهای تاریخ به وقت تهران
const TEHRAN = 'Asia/Tehran'

export function tehranDateStr(d: Date = new Date()): string {
  // خروجی: YYYY-MM-DD به وقت تهران
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TEHRAN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function tehranTimeStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: TEHRAN,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function tehranDateFull(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: TEHRAN,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime())
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const dbb = new Date(b + 'T00:00:00Z').getTime()
  return Math.round((dbb - da) / 86400000)
}

export function relTimeFa(date: Date, now: Date = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000))
  if (mins < 1) return 'همین حالا'
  if (mins < 60) return `${mins} دقیقه پیش`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ساعت پیش`
  const days = Math.floor(hours / 24)
  return `${days} روز پیش`
}
