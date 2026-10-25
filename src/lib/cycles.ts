// ─── موتور چرخه‌های زمانی: گن، فیبوناچی، نجومی/شمسی، تقویم سیاسی ───
import { db } from '@/lib/db'
import { tehranDateStr, addDays, daysBetween } from '@/lib/tehran'

export const WAR_12_START = '2025-06-13' // شروع جنگ ۱۲ روزه
export const WAR_12_END = '2025-06-24' // آتش‌بس
export const WINDOW_40 = 40 // پنجره ۴۰ روزه

interface CycleRow {
  date: string
  label: string
  family: 'gann' | 'fibonacci' | 'solar' | 'event' | 'hurst' | 'century'
  weight: number
  note?: string
}

function d(offsetDays: number): string {
  return tehranDateStr(addDays(new Date(WAR_12_START + 'T00:00:00Z'), offsetDays))
}

function buildCycles(): CycleRow[] {
  const rows: CycleRow[] = []

  // مربع‌های گن از شروع جنگ ۱۲ روزه
  const gannFromStart: Array<[number, string, number]> = [
    [90, 'ربع سالانه', 4],
    [180, 'نیم‌سالانه', 4],
    [270, 'سه‌چهارم سالانه', 3],
    [360, 'سالگرد کامل', 5],
    [540, 'یک‌ونیم سال', 3],
    [720, 'دو سالگرد کامل', 4],
    [900, 'دوونیم سال', 3],
    [1080, 'سه سالگرد کامل', 4],
  ]
  for (const [days, name, w] of gannFromStart) {
    rows.push({
      date: d(days),
      label: `چرخه گن ${days} روزه (${name}) از شروع جنگ ۱۲ روزه`,
      family: 'gann',
      weight: w,
      note: 'W.D. Gann — مربع زمانی از رویداد آغازین تنش',
    })
  }

  // چرخه‌های ۴۰ روزه از آتش‌بس (الگوی پنجره دوم)
  for (let k = 1; k <= 20; k++) {
    rows.push({
      date: tehranDateStr(
        addDays(new Date(WAR_12_END + 'T00:00:00Z'), WINDOW_40 * k)
      ),
      label: `چرخه ۴۰ روزه (${k}×۴۰) از آتش‌بس`,
      family: 'gann',
      weight: k % 3 === 0 ? 4 : 3,
      note: 'الگوی پنجره ۴۰ روزه — دوره‌های تمدید/ادامه تنش',
    })
  }

  // مناطق زمانی فیبوناچی از شروع جنگ
  for (const f of [13, 21, 34, 55, 89, 144, 233, 377, 610]) {
    rows.push({
      date: d(f),
      label: `منطقه زمانی فیبوناچی +${f} روز`,
      family: 'fibonacci',
      weight: f >= 144 ? 4 : 2,
      note: 'Fibonacci Time Zones از نقطه شروع',
    })
  }

  // رویدادهای نجومی / تقویم شمسی
  const solar: Array<[string, string]> = [
    ['2025-12-21', 'شب یلدا / انقلاب زمستانی'],
    ['2026-03-20', 'اعتدال بهاری / نوروز ۱۴۰۵'],
    ['2026-06-21', 'انقلاب تابستانی'],
    ['2026-09-22', 'اعتدال پاییزی'],
    ['2026-12-21', 'انقلاب زمستانی / شب یلدا'],
    ['2027-03-20', 'اعتدال بهاری / نوروز ۱۴۰۶'],
    ['2027-06-21', 'انقلاب تابستانی'],
    ['2027-09-23', 'اعتدال پاییزی'],
    ['2027-12-21', 'انقلاب زمستانی'],
  ]
  for (const [date, label] of solar) {
    rows.push({
      date,
      label: `${label} — نقطه عطف فصلی گن`,
      family: 'solar',
      weight: 3,
      note: 'چرخه‌های خورشیدی در تحلیل گن نقاط تغییر روند هستند',
    })
  }

  // تقویم سیاسی آمریکا
  rows.push({
    date: '2026-01-15',
    label: 'بحران بودجه فدرال آمریکا (مهلت مصوبات موقت)',
    family: 'event',
    weight: 2,
    note: 'بن‌بست بودجه می‌تواند تنش داخلی را به بیرون سرریز کند',
  })
  rows.push({
    date: '2026-11-03',
    label: 'انتخابات میان‌دوره‌ای کنگره آمریکا',
    family: 'event',
    weight: 4,
    note: 'چرخه سیاسی — احتمال تشدید تنش بیرونی برای مقاصد داخلی',
  })

  // سالگردهای شمسی از رویدادهای مرجع
  rows.push({
    date: tehranDateStr(addDays(new Date(WAR_12_END + 'T00:00:00Z'), 730)),
    label: 'سالگرد دوم آتش‌بس (چرخه سالانه گن)',
    family: 'gann',
    weight: 4,
    note: 'سالگردها در تحلیل گن نقاط تکرار رفتار بازار و تنش هستند',
  })
  rows.push({
    date: tehranDateStr(addDays(new Date(WAR_12_START + 'T00:00:00Z'), 731)),
    label: 'سالگرد دوم شروع جنگ ۱۲ روزه',
    family: 'gann',
    weight: 4,
    note: 'W.D. Gann — سالگردهای رویداد آغازین',
  })

  // ─── چرخه‌های هرست (20/40/80 روزه) از آتش‌بس ───
  for (let k = 1; k <= 12; k++) {
    rows.push({
      date: tehranDateStr(addDays(new Date(WAR_12_END + 'T00:00:00Z'), 20 * k)),
      label: `چرخه هرست ۲۰ روزه (${k}×۲۰)`,
      family: 'hurst',
      weight: 2,
      note: 'J.M. Hurst — چرخه نامی ۲۰ روزه بازار',
    })
  }
  for (let k = 1; k <= 6; k++) {
    rows.push({
      date: tehranDateStr(addDays(new Date(WAR_12_END + 'T00:00:00Z'), 40 * k)),
      label: `چرخه هرست ۴۰ روزه (${k}×۴۰)`,
      family: 'hurst',
      weight: 3,
      note: 'J.M. Hurst — چرخه نامی ۴۰ روزه (هم‌راستا با پنجره ۴۰ روزه جنگ)',
    })
  }
  for (let k = 1; k <= 4; k++) {
    rows.push({
      date: tehranDateStr(addDays(new Date(WAR_12_START + 'T00:00:00Z'), 80 * k)),
      label: `چرخه هرست ۸۰ روزه (${k}×۸۰) از شروع جنگ`,
      family: 'hurst',
      weight: 3,
      note: 'J.M. Hurst — چرخه نامی ۸۰ روزه',
    })
  }

  // ─── چرخه‌های صدساله / بلندمدت تکرارشونده ───
  const century: Array<[number, string, number]> = [
    // سال‌های بحران جهانی بازار — اتصال به الگوی تکرار صدساله (۱۹۲۹/۱۹۸۷/۲۰۰۸/۲۰۲۹؟)
    [343, 'سالگرد پانیک اکتبر ۱۹۲۹', 3],
    [342, 'سالگرد دوشنبه سیاه ۱۹۸۷', 3],
    [348, 'سالگرد سقوط لمن‌برادرز ۲۰۰۸', 3],
  ]
  for (const [days, name, w] of century) {
    rows.push({
      date: tehranDateStr(
        addDays(new Date(`${new Date().getUTCFullYear()}-01-01T00:00:00Z`), days)
      ),
      label: name,
      family: 'century',
      weight: w,
      note: 'الگوی تکرار صدساله بحران بازار (چرخه بلندمدت) — پنجره حساس سهام',
    })
  }
  // فصلی بودن بازار: سپتامبر/اکتبر بدترین ماه‌های سهام (September Effect)
  rows.push({
    date: tehranDateStr(new Date(`${new Date().getUTCFullYear()}-09-15T00:00:00Z`)),
    label: 'شروع فصل پرریسک سپتامبر-اکتبر سهام آمریکا',
    family: 'century',
    weight: 3,
    note: 'آمار بلندمدت: سپتامبر بدترین ماه S&P500 از ۱۹۲۸',
  })
  rows.push({
    date: tehranDateStr(new Date(`${new Date().getUTCFullYear()}-10-10T00:00:00Z`)),
    label: 'اوج فصل سقوط تاریخی بازار (اکتبر)',
    family: 'century',
    weight: 4,
    note: '۱۹۲۹ / ۱۹۸۷ / ۲۰۰۸ همگی اکتبر — چرخه صدساله + فصلی',
  })
  // چرخه ریاست‌جمهوری آمریکا (۴ ساله): سال سوم و چهارم هر دوره پرتنش‌تر
  rows.push({
    date: tehranDateStr(new Date(`${new Date().getUTCFullYear()}-03-01T00:00:00Z`)),
    label: 'چرخه ریاست‌جمهوری ۴ ساله — فاز حساس سیاست خارجی',
    family: 'century',
    weight: 2,
    note: 'Presidential Cycle — تشدید تنش بیرونی برای پوشش مسائل داخلی',
  })

  return rows
}

export async function syncCycles(): Promise<number> {
  const rows = buildCycles()
  await db.cycle.deleteMany({
    where: {
      family: {
        in: ['gann', 'fibonacci', 'solar', 'event', 'hurst', 'century'],
      },
    },
  })
  await db.cycle.createMany({ data: rows })
  return rows.length
}

// فشار چرخه‌ای برای یک تاریخ خاص (0..100)
export function cyclePressureForDate(
  dateStr: string,
  cycles: Array<{ date: string; weight: number }>
): { score: number; hits: string[] } {
  let score = 0
  const hits: string[] = []
  for (const c of cycles) {
    const dist = Math.abs(daysBetween(dateStr, c.date))
    if (dist <= 4) {
      const p = c.weight * 16 * (1 - dist / 5)
      score += p
      hits.push(c.date)
    }
  }
  return { score: Math.min(100, Math.round(score)), hits }
}

export function todayStr(): string {
  return tehranDateStr()
}
