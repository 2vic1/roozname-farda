// ─── تبدیل تقویم جلالی ↔ میلادی (الگوریتم استاندارد jalaali) ───
// + شهرهای مرجع با مختصات و منطقه زمانی + تبدیل ساعت قانونی محلی به UTC
// دقت: الگوریتم jalaali برای بازه ۱۱۷۸ تا ۳۳۴۳ جلالی دقیق است.

function div(a: number, b: number): number {
  return ~~(a / b)
}
function mod(a: number, b: number): number {
  return a - ~~(a / b) * b
}

interface JalCalResult {
  leap: number
  gy: number
  march: number
}

function jalCal(jy: number): JalCalResult {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ]
  const bl = breaks.length
  const gy = jy + 621
  let leapJ = -14
  let jp = breaks[0]
  let jm = 0
  let jump = 0
  for (let i = 1; i < bl; i += 1) {
    jm = breaks[i]
    jump = jm - jp
    if (jy < jm) break
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  let n = jy - jp
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return { leap, gy, march }
}

// روز ژولینی میلادی از تاریخ میلادی
function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

// تاریخ میلادی از روز ژولینی
function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const gd = div(mod(i, 153), 5) + 1
  const gm = mod(div(i, 153), 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

// جلالی → روز ژولینی
export function jalaliToJdn(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

// روز ژولینی → جلالی
export function jdnToJalali(jdn: number): { jy: number; jm: number; jd: number } {
  const gy = d2g(jdn).gy
  let jy = gy - 621
  const r = jalCal(jy)
  const jdn1f = g2d(gy, 3, r.march)
  let k = jdn - jdn1f
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }
    k -= 186
  } else {
    jy -= 1
    k += 179
    if (r.leap === 1) k += 1
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 }
}

export function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number,
): { gy: number; gm: number; gd: number } {
  return d2g(jalaliToJdn(jy, jm, jd))
}

export function gregorianToJalali(
  gy: number,
  gm: number,
  gd: number,
): { jy: number; jm: number; jd: number } {
  return jdnToJalali(g2d(gy, gm, gd))
}

// کبیسه: در jalaali استاندارد سالی که leap===0 است کبیسه است (اسفند ۳۰ روزه)
export function isJalaliLeap(jy: number): boolean {
  return jalCal(jy).leap === 0
}

/** طول ماه جلالی (۳۱ برای ماه‌های ۱-۶، ۳۰ برای ۷-۱۱، ۲۹/۳۰ برای اسفند) */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isJalaliLeap(jy) ? 30 : 29
}

// ─── نام ماه‌ها و روزهای هفته ───
export const JALALI_MONTHS_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

export const JALALI_SEASON_FA: Record<number, string> = {
  1: 'بهار', 2: 'بهار', 3: 'بهار',
  4: 'تابستان', 5: 'تابستان', 6: 'تابستان',
  7: 'پاییز', 8: 'پاییز', 9: 'پاییز',
  10: 'زمستان', 11: 'زمستان', 12: 'زمستان',
}

export function faNum(n: number | string): string {
  return new Intl.NumberFormat('fa-IR').format(typeof n === 'number' ? n : Number(n))
}

/** ارقام فارسی بدون جداکننده هزارگان — مناسب سال‌ها (۱۴۰۵ نه ۱٬۴۰۵) */
export function faYear(n: number | string): string {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}

/** «آذر ۱۴۰۵» — قالب نام ماه + سال جلالی */
export function jalaliMonthLabel(jy: number, jm: number): string {
  return `${JALALI_MONTHS_FA[jm - 1]} ${faYear(jy)}`
}

// ─── شهرهای مرجع (مختصات + منطقه زمانی IANA) ───
export interface CityDef {
  name: string
  lat: number
  lon: number
  tz: string
}

export const CITIES: CityDef[] = [
  { name: 'تهران', lat: 35.6892, lon: 51.389, tz: 'Asia/Tehran' },
  { name: 'مشهد', lat: 36.2605, lon: 59.6168, tz: 'Asia/Tehran' },
  { name: 'اصفهان', lat: 32.6539, lon: 51.666, tz: 'Asia/Tehran' },
  { name: 'تبریز', lat: 38.0962, lon: 46.2738, tz: 'Asia/Tehran' },
  { name: 'شیراز', lat: 29.5918, lon: 52.5837, tz: 'Asia/Tehran' },
  { name: 'کرج', lat: 35.8355, lon: 50.9915, tz: 'Asia/Tehran' },
  { name: 'اهواز', lat: 31.3183, lon: 48.6706, tz: 'Asia/Tehran' },
  { name: 'قم', lat: 34.6416, lon: 50.8746, tz: 'Asia/Tehran' },
  { name: 'کرمانشاه', lat: 34.3142, lon: 47.065, tz: 'Asia/Tehran' },
  { name: 'ارومیه', lat: 37.5527, lon: 45.0761, tz: 'Asia/Tehran' },
  { name: 'رشت', lat: 37.2808, lon: 49.5832, tz: 'Asia/Tehran' },
  { name: 'زاهدان', lat: 29.4963, lon: 60.8629, tz: 'Asia/Tehran' },
  { name: 'بندرعباس', lat: 27.1865, lon: 56.2808, tz: 'Asia/Tehran' },
  { name: 'یزد', lat: 31.8974, lon: 54.3569, tz: 'Asia/Tehran' },
  { name: 'کرمان', lat: 30.2839, lon: 57.0834, tz: 'Asia/Tehran' },
  { name: 'همدان', lat: 34.7992, lon: 48.5146, tz: 'Asia/Tehran' },
  { name: 'اردبیل', lat: 38.2498, lon: 48.2933, tz: 'Asia/Tehran' },
  { name: 'بوشهر', lat: 28.9234, lon: 50.82, tz: 'Asia/Tehran' },
  { name: 'سنندج', lat: 35.3219, lon: 46.9862, tz: 'Asia/Tehran' },
  { name: 'گرگان', lat: 36.8427, lon: 54.4441, tz: 'Asia/Tehran' },
  { name: 'استانبول', lat: 41.0082, lon: 28.9784, tz: 'Europe/Istanbul' },
  { name: 'دبی', lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai' },
  { name: 'بغداد', lat: 33.3152, lon: 44.3661, tz: 'Asia/Baghdad' },
  { name: 'آنکارا', lat: 39.9334, lon: 32.8597, tz: 'Europe/Istanbul' },
  { name: 'لندن', lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
  { name: 'پاریس', lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris' },
  { name: 'برلین', lat: 52.52, lon: 13.405, tz: 'Europe/Berlin' },
  { name: 'نیویورک', lat: 40.7128, lon: -74.006, tz: 'America/New_York' },
  { name: 'لس‌آنجلس', lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles' },
  { name: 'تورنتو', lat: 43.6532, lon: -79.3832, tz: 'America/Toronto' },
  { name: 'سیدنی', lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' },
  { name: 'ممبای', lat: 19.076, lon: 72.8777, tz: 'Asia/Kolkata' },
  { name: 'کابل', lat: 34.5553, lon: 69.2075, tz: 'Asia/Kabul' },
  { name: 'باکو', lat: 40.4093, lon: 49.8671, tz: 'Asia/Baku' },
  { name: 'مسکو', lat: 55.7558, lon: 37.6173, tz: 'Europe/Moscow' },
  { name: 'دوشنبه', lat: 38.5598, lon: 68.787, tz: 'Asia/Dushanbe' },
  { name: 'تفلیس', lat: 41.7151, lon: 44.8271, tz: 'Asia/Tbilisi' },
  { name: 'کوالالامپور', lat: 3.139, lon: 101.6869, tz: 'Asia/Kuala_Lumpur' },
]

export function findCity(name: string): CityDef | undefined {
  return CITIES.find((c) => c.name === name)
}

// ─── ساعت قانونی محلی → UTC (با احتساب دقیق DST تاریخی از طریق ICU) ───

/** آفست منطقه زمانی بر حسب دقیقه در یک لحظه (UTC = محلی − آفست) */
export function tzOffsetMinutes(date: Date, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const parts = dtf.formatToParts(date)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
    const asUTC = Date.UTC(
      get('year'), get('month') - 1, get('day'),
      get('hour') % 24, get('minute'), get('second'),
    )
    return (asUTC - date.getTime()) / 60000
  } catch {
    return 0
  }
}

/**
 * تاریخ/ساعت قانونی محلی (سال/ماه/روز/ساعت/دقیقه) در شهر → لحظه UTC دقیق.
 * منطق دو-مرحله‌ای برای حل ابهام DST: حدس اولیه + تصحیح تکراری.
 */
export function localWallToUtc(
  gy: number, gm: number, gd: number,
  hour: number, minute: number,
  tz: string,
): Date {
  const guess = Date.UTC(gy, gm - 1, gd, hour, minute, 0)
  let utc = guess
  for (let i = 0; i < 3; i++) {
    const off = tzOffsetMinutes(new Date(utc), tz)
    const next = guess - off * 60000
    if (next === utc) break
    utc = next
  }
  return new Date(utc)
}

// ─── رابط عمومی برای موتور استرولوژی ───
export interface BirthInput {
  jy: number
  jm: number
  jd: number
  hour: number // ۰-۲۳
  minute: number
  city: string
}

export interface BirthResolved {
  utc: Date
  lat: number
  lon: number
  tz: string
  city: string
  jalali: { jy: number; jm: number; jd: number }
}

export function resolveBirth(input: BirthInput): BirthResolved {
  const city = findCity(input.city) ?? CITIES[0]
  const g = jalaliToGregorian(input.jy, input.jm, input.jd)
  const utc = localWallToUtc(g.gy, g.gm, g.gd, input.hour, input.minute, city.tz)
  return {
    utc,
    lat: city.lat,
    lon: city.lon,
    tz: city.tz,
    city: city.name,
    jalali: { jy: input.jy, jm: input.jm, jd: input.jd },
  }
}

/** بازه زمانی یک ماه جلالی → دو لحظه UTC (آغاز و پایان انحصاری) به وقت شهر تهران */
export function jalaliMonthRange(jy: number, jm: number): { start: Date; end: Date } {
  const g1 = jalaliToGregorian(jy, jm, 1)
  const start = localWallToUtc(g1.gy, g1.gm, g1.gd, 0, 0, 'Asia/Tehran')
  let ny = jy
  let nm = jm + 1
  if (nm > 12) {
    nm = 1
    ny += 1
  }
  const g2 = jalaliToGregorian(ny, nm, 1)
  const end = localWallToUtc(g2.gy, g2.gm, g2.gd, 0, 0, 'Asia/Tehran')
  return { start, end }
}

/** تبدیل لحظه UTC به تاریخ جلالی به وقت تهران */
export function utcToJalaliTehran(d: Date): { jy: number; jm: number; jd: number } {
  const gy = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric' }).format(d),
  )
  const gm = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', month: '2-digit' }).format(d),
  )
  const gd = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', day: '2-digit' }).format(d),
  )
  return gregorianToJalali(gy, gm, gd)
}

/** تاریخ جلالی امروز به وقت تهران */
export function todayJalali(): { jy: number; jm: number; jd: number } {
  return utcToJalaliTehran(new Date())
}
