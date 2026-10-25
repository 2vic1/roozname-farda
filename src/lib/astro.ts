// ─── موتور استرولوژی (نجوم جهان‌بین) — کاملاً جدا از موتور اصلی ریسک ───
// الزام کاربر: تب مستقل «استرولوژی» که فقط و فقط بر پایه طالع‌بینی،
// چارت تأسیس ایران/آمریکا/اسرائیل، ترانزیت سیارات، گرفتگی‌ها و اطوار ماه درصد و
// روزهای محتمل حمله را پیش‌بینی می‌کند. این امتیاز در هیچ محاسبه دیگری اثر ندارد.
//
// مبنای فنی: محاسبه واقعی ephemeris (astronomy-engine) با دایرةالبروج استوایی
// (tropical of-date) — تصحیح پیش‌روان عام ۱.۳۹۶۹۷۱° در هر سده.
import * as A from 'astronomy-engine'

// ─── واژه‌نامه فارسی ───
export const SIGNS_FA = [
  'حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله',
  'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت',
]

const PLANET_FA: Record<string, string> = {
  Sun: 'خورشید', Moon: 'ماه', Mercury: 'عطارد', Venus: 'زهره',
  Mars: 'مریخ', Jupiter: 'مشتری', Saturn: 'زحل',
  Uranus: 'اورانوس', Neptune: 'نپتون', Pluto: 'پلوتو',
}

const ASPECT_FA: Record<string, string> = {
  conj: 'مقارنه', square: 'مربع', opp: 'مقابله', trine: 'تثلیث', sextile: 'تتسیم',
}

// ─── چارت‌های تأسیس (استاندارد نجوم جهان‌بین) ───
interface ChartDef {
  key: 'iran' | 'usa' | 'israel'
  name: string
  utc: Date
  place: string
  note: string
}

const CHARTS: ChartDef[] = [
  {
    key: 'iran', name: 'ایران', utc: new Date('1979-04-01T11:30:00Z'),
    place: 'تهران، ۱ آوریل ۱۹۷۹ — اعلام جمهوری اسلامی',
    note: 'چارت مرجع جهان‌بین برای ایران نوین؛ خورشید در حمل (شروع انقلابی)',
  },
  {
    key: 'usa', name: 'آمریکا', utc: new Date('1776-07-04T21:12:00Z'),
    place: 'فیلادلفیا، ۴ ژوئیه ۱۷۷۶ — اعلام استقلال (چارت سیبلی)',
    note: 'چارت سیبلی مرسوم‌ترین چارت ملی آمریکا؛ خورشید در سرطان',
  },
  {
    key: 'israel', name: 'اسرائیل', utc: new Date('1948-05-14T13:00:00Z'),
    place: 'تل‌آویو، ۱۴ مه ۱۹۴۸ — اعلام تأسیس',
    note: 'خورشید در ثور، آسندنت قوس — چارت مرجع اسرائیل نوین',
  },
]

// نقاط چارت که برای جنگ/تنش معنی‌دارند
const NATAL_BODIES: A.Body[] = [
  A.Body.Sun, A.Body.Moon, A.Body.Mars,
  A.Body.Jupiter, A.Body.Saturn, A.Body.Uranus, A.Body.Neptune, A.Body.Pluto,
]

// سیارات ترانزیت‌دهنده مرتبط با جنگ
const TRANSIT_BODIES: A.Body[] = [
  A.Body.Sun, A.Body.Mars, A.Body.Jupiter,
  A.Body.Saturn, A.Body.Uranus, A.Body.Neptune, A.Body.Pluto,
]

// ─── اقمار محاسبه: طول دایرةالبروج استوایی (tropical of-date) ───
// چرخش دقیق EQJ→ECT (به‌جای تصحیح خطی پیش‌روان — خطای مرز بروج تا ۰٫۴° حذف می‌شود)
const rotCache = new Map<number, A.RotationMatrix>()
const ROT_BUCKET_MS = 12 * 3600000
function ectRotation(t: number): A.RotationMatrix {
  const key = Math.floor(t / ROT_BUCKET_MS)
  let r = rotCache.get(key)
  if (!r) {
    r = A.Rotation_EQJ_ECT(A.MakeTime(new Date(key * ROT_BUCKET_MS)))
    if (rotCache.size > 4000) rotCache.clear()
    rotCache.set(key, r)
  }
  return r
}

function eclLon(body: A.Body, date: Date): number {
  const vec = A.GeoVector(body, date, true)
  const v = A.RotateVector(ectRotation(date.getTime()), vec)
  return (((Math.atan2(v.y, v.x) * 180) / Math.PI) % 360 + 360) % 360
}

function moonLon(date: Date): number {
  return A.EclipticGeoMoon(A.MakeTime(date)).lon // Spherical: lon (نه elon)
}

function sunLon(date: Date): number {
  return A.SunPosition(date).elon
}

export function fmtLon(lon: number): string {
  const sign = SIGNS_FA[Math.floor(((lon % 360) + 360) % 360 / 30)]
  const deg = ((lon % 30) + 30) % 30
  return `${deg.toFixed(1)}° ${sign}`
}

function jalali(date: Date): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// ─── جنبه‌ها (Aspects) ───
interface AspectDef { key: string; angle: number; orb: number; hard: boolean }
const ASPECTS: AspectDef[] = [
  { key: 'conj', angle: 0, orb: 8, hard: true },
  { key: 'square', angle: 90, orb: 7, hard: true },
  { key: 'trine', angle: 120, orb: 6, hard: false },
  { key: 'opp', angle: 180, orb: 8, hard: true },
  { key: 'sextile', angle: 60, orb: 5, hard: false },
]

function findAspect(lon1: number, lon2: number): { aspect: AspectDef; orb: number } | null {
  let diff = Math.abs(lon1 - lon2) % 360
  if (diff > 180) diff = 360 - diff
  for (const a of ASPECTS) {
    const orb = Math.abs(diff - a.angle)
    if (orb <= a.orb) return { aspect: a, orb }
  }
  return null
}

// ─── عطف برگشتی (Retrograde) ───
function isRetrograde(body: A.Body, date: Date): boolean {
  const l1 = eclLon(body, date)
  const l2 = eclLon(body, new Date(date.getTime() + 86400000))
  const delta = ((l2 - l1) % 360 + 360) % 360
  return delta > 180 // حرکت منفی در طول دایرةالبروج
}

function daysUntilDirect(body: A.Body, date: Date): number | null {
  for (let i = 1; i <= 45; i++) {
    if (!isRetrograde(body, new Date(date.getTime() + i * 86400000))) return i
  }
  return null
}

// ─── رویدادهای دقیق: ایستگاه راجعه/مستقیم + ورود به برج (دقت ~۱ دقیقه، به وقت تهران) ───
export interface AstroTransitRow {
  planetFa: string
  kindFa: string // شرح رویداد
  detailFa: string // جمله کامل به سبک اخترشناسان
  at: string // ISO
  jalaliDate: string
  tehranTime: string
  badge: 'retro-start' | 'retro-end' | 'ingress'
}

function tehranClock(date: Date): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(11, 16)
  }
}

function relativeFa(date: Date, now: Date): string {
  const dayMs = 86400000
  const noonOf = (d: Date) =>
    new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d))
  const dayDiff = Math.round(
    (noonOf(date).getTime() - noonOf(now).getTime()) / dayMs,
  )
  if (dayDiff <= 0) return 'امروز'
  if (dayDiff === 1) return 'فردا'
  if (dayDiff === 2) return 'پس‌فردا'
  return `${faDay(dayDiff)} روز دیگر`
}

function faDay(n: number): string {
  return new Intl.NumberFormat('fa-IR').format(n)
}

/** جستجوی ایستگاه (تغییر جهت حرکت): بازگشت لحظه دقیق شروع/پایان راجعه */
function findStations(body: A.Body, from: Date, days: number): Array<{ at: Date; kind: 'retro-start' | 'retro-end' }> {
  const out: Array<{ at: Date; kind: 'retro-start' | 'retro-end' }> = []
  const stepMs = 6 * 3600000
  const end = from.getTime() + days * dayMs
  let prevRate = rate(body, from)
  for (let t = from.getTime() + stepMs; t <= end; t += stepMs) {
    const cur = rate(body, new Date(t))
    if (prevRate > 0 && cur < 0) out.push({ at: refineStation(body, t - stepMs, t), kind: 'retro-start' })
    else if (prevRate < 0 && cur > 0) out.push({ at: refineStation(body, t - stepMs, t), kind: 'retro-end' })
    prevRate = cur
  }
  return out
}

const dayMs = 86400000

/** اختلاف علامت‌دار نرمال‌شده به [-180,180) — برای عبور مرز صفر بروج */
function signedDelta(l2: number, l1: number): number {
  let d = (l2 - l1) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

/** نرخ حرکت روزانه طول (درجه/روز) — علامت‌دار + تفاضل مرکزی (بدون تأخیر فاز) */
function rate(body: A.Body, date: Date): number {
  const l1 = eclLon(body, new Date(date.getTime() - dayMs / 4))
  const l2 = eclLon(body, new Date(date.getTime() + dayMs / 4))
  return signedDelta(l2, l1) * 4
}

function refineStation(body: A.Body, lo: number, hi: number): Date {
  // نرخ صفر = مرز تغییر جهت — دوگانه‌بینی تا ~۱ دقیقه
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    if (Math.abs(hi - lo) < 60000) break
    if (rate(body, new Date(mid)) > 0) lo = mid
    else hi = mid
  }
  return new Date((lo + hi) / 2)
}

/** ورود سیاره به برج بعد (عبور طول از مضرب ۳۰ درجه) */
function findIngresses(body: A.Body, from: Date, days: number): Array<{ at: Date; fromSign: number; toSign: number }> {
  const out: Array<{ at: Date; fromSign: number; toSign: number }> = []
  const stepMs = 2 * 3600000
  const end = from.getTime() + days * dayMs
  let prevIdx = Math.floor(eclLon(body, from) / 30)
  for (let t = from.getTime() + stepMs; t <= end; t += stepMs) {
    const idx = Math.floor(eclLon(body, new Date(t)) / 30)
    if (idx !== prevIdx) {
      const at = refineIngress(body, t - stepMs, t, prevIdx)
      out.push({ at, fromSign: prevIdx, toSign: idx })
      prevIdx = idx
    }
  }
  return out
}

function refineIngress(body: A.Body, lo: number, hi: number, targetIdx: number): Date {
  // عبور از مرز ۳۰×targetIdx+۳۰ درجه — دوگانه‌بینی
  const boundary = ((targetIdx + 1) * 30) % 360
  const distToBoundary = (lon: number) => {
    let d = (boundary - lon) % 360
    if (d > 180) d -= 360
    return d
  }
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (Math.abs(hi - lo) < 60000) break
    if (distToBoundary(eclLon(body, new Date(mid))) > 0) lo = mid
    else hi = mid
  }
  return new Date((lo + hi) / 2)
}

/** همه رویدادهای دقیق پنجره: ایستگاه‌ها + ورود به برج‌ها — مرتب بر اساس زمان */
function computeTransits(now: Date, days: number): AstroTransitRow[] {
  const windowStart = new Date(now.getTime() - 2 * dayMs) // رویدادهای ۴۸ ساعت گذشته هم بمانند (سبک پست اخترشناس)
  const scanDays = days + 2
  const rows: AstroTransitRow[] = []

  // ایستگاه‌های راجعه/مستقیم — سیارات سریع و بیرونی
  const stationBodies: A.Body[] = [
    A.Body.Mercury, A.Body.Venus, A.Body.Mars,
    A.Body.Jupiter, A.Body.Saturn, A.Body.Uranus,
  ]
  for (const b of stationBodies) {
    for (const st of findStations(b, windowStart, scanDays)) {
      const rel = relativeFa(st.at, now)
      const isStart = st.kind === 'retro-start'
      rows.push({
        planetFa: PLANET_FA[b as string] ?? String(b),
        kindFa: isStart ? 'شروع حرکت راجعه' : 'پایان راجعه — مستقیم می‌شود',
        detailFa: isStart
          ? `${PLANET_FA[b]} ${rel} ساعت ${tehranClock(st.at)} حرکت راجعه (℞) خود را آغاز می‌کند`
          : `${PLANET_FA[b]} ${rel} ساعت ${tehranClock(st.at)} از راجعه خارج و مستقیم می‌شود`,
        at: st.at.toISOString(),
        jalaliDate: jalali(st.at),
        tehranTime: tehranClock(st.at),
        badge: st.kind,
      })
    }
  }

  // ورود به برج — خورشید/عطارد/زهره/مریخ (تغییر برج سیاسی/نظامی مهم)
  const ingressBodies: A.Body[] = [A.Body.Sun, A.Body.Mercury, A.Body.Venus, A.Body.Mars]
  for (const b of ingressBodies) {
    for (const ing of findIngresses(b, windowStart, scanDays)) {
      const rel = relativeFa(ing.at, now)
      rows.push({
        planetFa: PLANET_FA[b as string] ?? String(b),
        kindFa: 'ورود به برج جدید',
        detailFa: `${PLANET_FA[b]} ${rel} ساعت ${tehranClock(ing.at)} برج ${SIGNS_FA[ing.fromSign]} را ترک و وارد ${SIGNS_FA[ing.toSign]} می‌شود`,
        at: ing.at.toISOString(),
        jalaliDate: jalali(ing.at),
        tehranTime: tehranClock(ing.at),
        badge: 'ingress',
      })
    }
  }

  rows.sort((a, b2) => a.at.localeCompare(b2.at))
  return rows.slice(0, 12)
}

// ─── گرفتگی‌ها و اطوار ماه ───
interface EclipseInfo {
  kind: 'solar' | 'lunar'
  date: Date
  degree: number // درجه بروج در لحظه اوج
}
interface PhaseInfo {
  kind: 'new' | 'full'
  date: Date
  degree: number
}

function collectEclipses(now: Date): EclipseInfo[] {
  const out: EclipseInfo[] = []
  try {
    let t = A.MakeTime(now)
    for (let i = 0; i < 3; i++) {
      const se = A.SearchGlobalSolarEclipse(t.date)
      out.push({ kind: 'solar', date: se.peak.date, degree: sunLon(se.peak.date) })
      // دو روز جلو برو تا همان گرفتگی دوباره برگردانده نشود
      t = A.MakeTime(new Date(se.peak.date.getTime() + 2 * 86400000))
    }
  } catch { /* خطا نادیده گرفته شود */ }
  try {
    let t = A.MakeTime(now)
    for (let i = 0; i < 3; i++) {
      const le = A.SearchLunarEclipse(t.date)
      if (le.kind !== 'none') {
        out.push({ kind: 'lunar', date: le.peak.date, degree: moonLon(le.peak.date) })
      }
      t = A.MakeTime(new Date(le.peak.date.getTime() + 2 * 86400000))
    }
  } catch { /* خطا نادیده گرفته شود */ }
  // حذف تکراری بر اساس نوع + نزدیکی زمانی
  const uniq: EclipseInfo[] = []
  for (const e of out.sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (!uniq.some((u) => u.kind === e.kind && Math.abs(u.date.getTime() - e.date.getTime()) < 5 * 86400000)) {
      uniq.push(e)
    }
  }
  return uniq
}

function collectPhases(now: Date, days: number): PhaseInfo[] {
  const out: PhaseInfo[] = []
  try {
    const t = now
    for (const [kind, lon] of [['new', 0], ['full', 180]] as const) {
      let cursor = t
      for (let i = 0; i < Math.ceil(days / 30); i++) {
        const next = A.SearchMoonPhase(lon, cursor, 40).date
        if (next.getTime() - t.getTime() > days * 86400000) break
        out.push({ kind, date: next, degree: moonLon(next) })
        cursor = new Date(next.getTime() + 86400000)
      }
    }
  } catch { /* نادیده */ }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// ─── ساختار خروجی ───
export interface AstroFactor {
  text: string
  weight: number
  kind: 'natal' | 'sky' | 'eclipse' | 'phase' | 'retro'
  targets: Array<'iran' | 'usa' | 'israel'> // 'all' = هر سه
}

export interface AstroRiskyDay {
  date: string
  jalali: string
  score: number
  reasons: string[]
}

export interface AstroCountryRow {
  key: 'iran' | 'usa' | 'israel'
  name: string
  percent: number
}

export interface AstroChartSummary {
  key: 'iran' | 'usa' | 'israel'
  name: string
  place: string
  note: string
  sun: string
  moon: string
  mars: string
  saturn: string
  pluto: string
  marsNatalLon: number
  saturnNatalLon: number
  sunNatalLon: number
}

export interface AstroEclipseRow {
  kind: 'solar' | 'lunar'
  date: string
  jalali: string
  degree: string
  hits: string[] // مصادف با کدام نقاط چارت‌ها
  inWindow: boolean
}

export interface AstroPhaseRow {
  kind: 'new' | 'full'
  date: string
  jalali: string
  degree: string
  hits: string[]
}

export interface AstroAnalysis {
  generatedAt: string
  overall: number
  levelFa: string
  countries: AstroCountryRow[]
  todayFactors: AstroFactor[]
  riskyDays: AstroRiskyDay[]
  daily: Array<{ date: string; score: number; iran: number; usa: number; israel: number }>
  eclipses: AstroEclipseRow[]
  phases: AstroPhaseRow[]
  retrogrades: Array<{ planet: string; untilDays: number | null; note: string }>
  transits: AstroTransitRow[]
  charts: AstroChartSummary[]
  methodFa: string[]
  disclaimer: string
}

// ─── قواعد وزن‌دهی جنگی (نجوم جهان‌بین کلاسیک) ───
// وزن پایه × (۱ - کرب/کرب بیشینه) — هرچه جنبه دقیق‌تر، اثر قوی‌تر
function natalRuleWeight(transit: A.Body, natal: A.Body, aspect: AspectDef): number {
  if (!aspect.hard) {
    // جنبه‌های نرم فقط برای مریخ معنا دارند (عملیات موفق/آغاز عملیات)
    return transit === A.Body.Mars ? 4 : 0
  }
  // جنبه‌های سخت (مقارنه/مربع/مقابله)
  if (transit === A.Body.Mars) {
    if (natal === A.Body.Mars || natal === A.Body.Pluto) return 16
    if (natal === A.Body.Saturn) return 15
    if (natal === A.Body.Sun) return 13
    if (natal === A.Body.Uranus) return 9
    return 5
  }
  if (transit === A.Body.Saturn) {
    if (natal === A.Body.Sun || natal === A.Body.Mars) return 13
    if (natal === A.Body.Pluto || natal === A.Body.Saturn) return 11
    return 4
  }
  if (transit === A.Body.Pluto) {
    if (natal === A.Body.Sun || natal === A.Body.Mars) return 15
    if (natal === A.Body.Pluto) return 12
    return 5
  }
  if (transit === A.Body.Uranus) {
    if (natal === A.Body.Sun || natal === A.Body.Mars) return 13
    if (natal === A.Body.Saturn) return 9
    return 4
  }
  if (transit === A.Body.Jupiter) {
    if (natal === A.Body.Mars || natal === A.Body.Pluto) return 6
    return 3
  }
  if (transit === A.Body.Sun) {
    // خورشید عامل تریگر روزانه
    if (natal === A.Body.Mars || natal === A.Body.Pluto) return 5
    if (natal === A.Body.Saturn) return 3
    return 0
  }
  return 0 // نپتون — بدون قاعده جنگی
}

function skyRuleWeight(p1: A.Body, p2: A.Body, aspect: AspectDef): number {
  if (!aspect.hard) return 0
  const pair = [p1, p2]
  if (pair.includes(A.Body.Mars) && pair.includes(A.Body.Saturn)) return 12 // جنبه کلاسیک جنگ
  if (pair.includes(A.Body.Mars) && pair.includes(A.Body.Pluto)) return 12
  if (pair.includes(A.Body.Mars) && pair.includes(A.Body.Uranus)) return 10 // عمل ناگهانی نظامی
  if (pair.includes(A.Body.Mars) && pair.includes(A.Body.Sun)) return 0
  if (pair.includes(A.Body.Saturn) && pair.includes(A.Body.Pluto)) return 8 // فشار ساختاری تاریخی
  if (pair.includes(A.Body.Uranus) && pair.includes(A.Body.Pluto)) return 8
  return 0
}

const RETRO_NOTES: Partial<Record<string, string>> = {
  Mercury: 'عطارد برگشته — سوءتفاهم دیپلماتیک، اشتباه محاسباتی فرماندهی، اختلال ارتباطات',
  Mars: 'مریخ برگشته — انرژی نظامی مهارشده، اقدامات نظامی به تعویق می‌افتد',
  Saturn: 'زحل برگشته — بازبینی محدودیت‌ها و سیاست‌های جنگی',
  Pluto: 'پلوتو برگشته — تحولات پنهان و بازآرایی قدرت',
  Uranus: 'اورانوس برگشته — شوک‌ها با تاخیر و غیرمنتظره',
  Neptune: 'نپتون برگشته — اطلاعات گمراه‌کننده و جنگ روانی',
  Jupiter: 'مشتری برگشته — گسترش بی‌محصول تنش',
}

// ─── محاسبه اصلی ───
let cache: { ts: number; data: AstroAnalysis } | null = null
const CACHE_MS = 30 * 60 * 1000

export function computeAstroAnalysis(force = false): AstroAnalysis {
  if (!force && cache && Date.now() - cache.ts < CACHE_MS) return cache.data

  const now = new Date()
  const todayNoon = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0)
  )
  const SCAN_DAYS = 61

  // چارت‌های ناتال (یک‌بار محاسبه)
  const natal = new Map<string, Map<A.Body, number>>()
  for (const c of CHARTS) {
    const m = new Map<A.Body, number>()
    for (const b of NATAL_BODIES) m.set(b, eclLon(b, c.utc))
    natal.set(c.key, m)
  }

  // خلاصه چارت‌ها برای UI
  const charts: AstroChartSummary[] = CHARTS.map((c) => {
    const m = natal.get(c.key)!
    return {
      key: c.key, name: c.name, place: c.place, note: c.note,
      sun: fmtLon(m.get(A.Body.Sun)!),
      moon: fmtLon(m.get(A.Body.Moon)!),
      mars: fmtLon(m.get(A.Body.Mars)!),
      saturn: fmtLon(m.get(A.Body.Saturn)!),
      pluto: fmtLon(m.get(A.Body.Pluto)!),
      marsNatalLon: m.get(A.Body.Mars)!,
      saturnNatalLon: m.get(A.Body.Saturn)!,
      sunNatalLon: m.get(A.Body.Sun)!,
    }
  })

  // گرفتگی‌ها و اطوار ماه (پنجره اسکن + نمایش آینده)
  const eclipses = collectEclipses(todayNoon)
  const phases = collectPhases(todayNoon, SCAN_DAYS)

  // عطارد و سایر سیارات برگشته امروز
  const retroBodies = [A.Body.Mercury, A.Body.Mars, A.Body.Saturn, A.Body.Uranus, A.Body.Neptune, A.Body.Pluto]
  const retroToday = retroBodies.filter((b) => isRetrograde(b, todayNoon))

  const daily: AstroAnalysis['daily'] = []
  const riskyCandidates: Array<{ date: Date; score: number; reasons: string[] }> = []
  let todayFactors: AstroFactor[] = []

  for (let i = 0; i < SCAN_DAYS; i++) {
    const dayDate = new Date(todayNoon.getTime() + i * 86400000)
    const factors: AstroFactor[] = []
    const addFactor = (f: AstroFactor) => factors.push(f)

    // ترانزیت‌ها به چارت‌های ناتال
    for (const tr of TRANSIT_BODIES) {
      const trLon = tr === A.Body.Sun ? sunLon(dayDate) : eclLon(tr, dayDate)
      for (const c of CHARTS) {
        const nm = natal.get(c.key)!
        for (const nb of NATAL_BODIES) {
          const hit = findAspect(trLon, nm.get(nb)!)
          if (!hit) continue
          const w = natalRuleWeight(tr, nb, hit.aspect)
          if (w <= 0) continue
          const decay = Math.max(0.15, 1 - hit.orb / hit.aspect.orb)
          const eff = Math.round(w * decay * 10) / 10
          if (eff < 2.5) continue // نویز کم‌اثر حذف شود
          addFactor({
            text: `${PLANET_FA[tr]} ترانزیت ${ASPECT_FA[hit.aspect.key]} ${PLANET_FA[nb]} ناتال ${c.name} (کرب ${hit.orb.toFixed(1)}°)`,
            weight: eff,
            kind: 'natal',
            targets: [c.key],
          })
        }
      }
    }

    // جنبه‌های آسمانی بین سیارات ترانزیت (روز جهانی — اثر روی هر سه کشور)
    for (let a = 0; a < TRANSIT_BODIES.length; a++) {
      for (let b = a + 1; b < TRANSIT_BODIES.length; b++) {
        const p1 = TRANSIT_BODIES[a]
        const p2 = TRANSIT_BODIES[b]
        if (p1 === A.Body.Sun || p2 === A.Body.Sun) continue // خورشید فقط به‌عنوان تریگر ناتال
        const l1 = eclLon(p1, dayDate)
        const l2 = eclLon(p2, dayDate)
        const hit = findAspect(l1, l2)
        if (!hit) continue
        const w = skyRuleWeight(p1, p2, hit.aspect)
        if (w <= 0) continue
        const decay = Math.max(0.15, 1 - hit.orb / hit.aspect.orb)
        addFactor({
          text: `${PLANET_FA[p1]} و ${PLANET_FA[p2]} در ${ASPECT_FA[hit.aspect.key]} آسمانی (کرب ${hit.orb.toFixed(1)}°)`,
          weight: Math.round(w * decay * 10) / 10,
          kind: 'sky',
          targets: ['iran', 'usa', 'israel'],
        })
      }
    }

    // پنجره گرفتگی‌ها (±۱۴ روز) + مصادف بودن درجه گرفتگی با نقاط ناتال
    for (const ec of eclipses) {
      const dd = Math.abs(ec.date.getTime() - dayDate.getTime()) / 86400000
      if (dd <= 14) {
        const w = dd <= 7 ? 14 : 7
        addFactor({
          text: `${ec.kind === 'solar' ? 'خورشیدگرفتگی' : 'ماه‌گرفتگی'} در ${fmtLon(ec.degree)} — پنجره فعال (${Math.round(dd)} روز فاصله)`,
          weight: w,
          kind: 'eclipse',
          targets: ['iran', 'usa', 'israel'],
        })
        if (dd <= 1) {
          // مصادف با نقاط چارت کشورها؟
          for (const c of CHARTS) {
            const nm = natal.get(c.key)!
            for (const nb of [A.Body.Sun, A.Body.Mars, A.Body.Saturn, A.Body.Pluto]) {
              const hit = findAspect(ec.degree, nm.get(nb)!)
              if (hit && hit.orb <= 5 && (hit.aspect.key === 'conj' || hit.aspect.key === 'opp')) {
                addFactor({
                  text: `درجه ${ec.kind === 'solar' ? 'خورشیدگرفتگی' : 'ماه‌گرفتگی'} ${ASPECT_FA[hit.aspect.key]} ${PLANET_FA[nb]} چارت ${c.name} — علامت کلاسیک رویداد بزرگ`,
                  weight: Math.round(15 * (1 - hit.orb / 5) * 10) / 10,
                  kind: 'eclipse',
                  targets: [c.key],
                })
              }
            }
          }
        }
      }
    }

    // اطوار ماه (ماه نو/کامل ±۱ روز)
    for (const ph of phases) {
      const dd = Math.abs(ph.date.getTime() - dayDate.getTime()) / 86400000
      if (dd <= 1) {
        let w = 3
        const signIdx = Math.floor(ph.degree / 30)
        const hits: string[] = []
        if (signIdx === 0 || signIdx === 7) w += 3 // حمل/عقرب — علامت‌های جنگ
        for (const c of CHARTS) {
          const nm = natal.get(c.key)!
          for (const nb of [A.Body.Mars, A.Body.Pluto]) {
            const hit = findAspect(ph.degree, nm.get(nb)!)
            if (hit && hit.orb <= 3 && (hit.aspect.key === 'conj' || hit.aspect.key === 'opp')) {
              w += 4
              hits.push(`${c.name}/${PLANET_FA[nb]}`)
            }
          }
        }
        addFactor({
          text: `${ph.kind === 'new' ? 'ماه نو' : 'ماه کامل'} در ${fmtLon(ph.degree)}${hits.length ? ` — مصادف با ${hits.join('، ')}` : ''}`,
          weight: w,
          kind: 'phase',
          targets: ['iran', 'usa', 'israel'],
        })
      }
    }

    // سیارات برگشته (روز جهانی)
    for (const b of retroToday) {
      addFactor({
        text: RETRO_NOTES[b as string] ?? `${PLANET_FA[b]} برگشته`,
        weight: b === A.Body.Mercury ? 2 : 1,
        kind: 'retro',
        targets: ['iran', 'usa', 'israel'],
      })
    }

    // امتیاز روز: انباشت کاهنده — قوی‌ترین عامل‌ها غالب‌اند و امتیاز در ۱۰۰ اشباع نمی‌شود
    const dayScore = (list: AstroFactor[]) => {
      const sorted = list.map((f) => f.weight).sort((a, b) => b - a)
      let s = 0
      sorted.forEach((w, idx) => {
        s += w * Math.pow(0.88, idx)
      })
      return Math.max(0, Math.min(100, Math.round(s)))
    }
    const total = dayScore(factors)
    const per = (key: 'iran' | 'usa' | 'israel') =>
      dayScore(factors.filter((f) => f.targets.includes(key)))

    daily.push({
      date: ymd(dayDate),
      score: Math.round(total),
      iran: Math.round(per('iran')),
      usa: Math.round(per('usa')),
      israel: Math.round(per('israel')),
    })

    if (i === 0) todayFactors = [...factors].sort((a, b2) => b2.weight - a.weight)

    // روزهای پرخطر: دلایل منحصربه‌فرد
    const reasons = factors
      .sort((a, b2) => b2.weight - a.weight)
      .filter((f, idx, arr) => arr.findIndex((x) => x.text === f.text) === idx)
      .slice(0, 6)
      .map((f) => f.text)
    riskyCandidates.push({ date: dayDate, score: Math.round(total), reasons })
  }

  // روزهای پرخطر: امتیاز ≥ ۵۵ یا ۶ روز برتر
  const threshold = 55
  let risky = riskyCandidates
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
  if (risky.length < 4) {
    risky = [...riskyCandidates].sort((a, b) => b.score - a.score).slice(0, 6)
  }
  risky = risky.slice(0, 8)

  const riskyDays: AstroRiskyDay[] = risky
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((r) => ({ date: ymd(r.date), jalali: jalali(r.date), score: r.score, reasons: r.reasons }))

  // امتیاز کل: ترکیب امروز/اوج/میانگین
  const todayScore = daily[0].score
  const peak30 = Math.max(...daily.slice(0, 30).map((d) => d.score))
  const peak14 = Math.max(...daily.slice(0, 14).map((d) => d.score))
  const avg14 = daily.slice(0, 14).reduce((s, d) => s + d.score, 0) / 14
  const overall = Math.max(0, Math.min(100, Math.round(0.25 * todayScore + 0.4 * peak30 + 0.2 * peak14 + 0.15 * avg14)))

  const countries: AstroCountryRow[] = CHARTS.map((c) => {
    const series = daily.map((d) => d[c.key])
    const t0 = series[0]
    const p30 = Math.max(...series.slice(0, 30))
    const p14 = Math.max(...series.slice(0, 14))
    const a14 = series.slice(0, 14).reduce((s, v) => s + v, 0) / 14
    return {
      key: c.key,
      name: c.name,
      percent: Math.max(0, Math.min(100, Math.round(0.25 * t0 + 0.45 * p30 + 0.15 * p14 + 0.15 * a14))),
    }
  })

  const levelFa =
    overall >= 75 ? 'وضعیت اختری بحرانی' :
    overall >= 55 ? 'وضعیت اختری پرتنش' :
    overall >= 35 ? 'وضعیت اختری متوسط' : 'آسمان آرام'

  const eclipsesOut: AstroEclipseRow[] = eclipses.map((e) => {
    const hits: string[] = []
    for (const c of CHARTS) {
      const nm = natal.get(c.key)!
      for (const nb of [A.Body.Sun, A.Body.Mars, A.Body.Saturn, A.Body.Pluto]) {
        const hit = findAspect(e.degree, nm.get(nb)!)
        if (hit && hit.orb <= 5 && (hit.aspect.key === 'conj' || hit.aspect.key === 'opp')) {
          hits.push(`${c.name}: ${ASPECT_FA[hit.aspect.key]} ${PLANET_FA[nb]} (${hit.orb.toFixed(1)}°)`)
        }
      }
    }
    return {
      kind: e.kind,
      date: ymd(e.date),
      jalali: jalali(e.date),
      degree: fmtLon(e.degree),
      hits,
      inWindow: e.date.getTime() - todayNoon.getTime() <= 60 * 86400000,
    }
  })

  const phasesOut: AstroPhaseRow[] = phases.map((p) => {
    const hits: string[] = []
    for (const c of CHARTS) {
      const nm = natal.get(c.key)!
      for (const nb of [A.Body.Mars, A.Body.Pluto]) {
        const hit = findAspect(p.degree, nm.get(nb)!)
        if (hit && hit.orb <= 3 && (hit.aspect.key === 'conj' || hit.aspect.key === 'opp')) {
          hits.push(`${c.name}/${PLANET_FA[nb]} (${hit.orb.toFixed(1)}°)`)
        }
      }
    }
    return {
      kind: p.kind,
      date: ymd(p.date),
      jalali: jalali(p.date),
      degree: fmtLon(p.degree),
      hits,
    }
  })

  const retrogrades = retroToday.map((b) => ({
    planet: PLANET_FA[b as string] ?? String(b),
    untilDays: isRetrograde(b, todayNoon) ? daysUntilDirect(b, todayNoon) : null,
    note: RETRO_NOTES[b as string] ?? '',
  }))

  const transits = computeTransits(todayNoon, SCAN_DAYS)

  const data: AstroAnalysis = {
    generatedAt: now.toISOString(),
    overall,
    levelFa,
    countries,
    todayFactors,
    riskyDays,
    daily,
    eclipses: eclipsesOut,
    phases: phasesOut,
    retrogrades,
    transits,
    charts,
    methodFa: [
      'چارت‌های تأسیس: ایران (۱ فروردین ۱۳۵۸ تهران)، آمریکا (۴ ژوئیه ۱۷۷۶ فیلادلفیا — سیبلی)، اسرائیل (۱۴ مه ۱۹۴۸ تل‌آویو)',
      'محاسبه واقعی موقعیت سیارات (ephemeris) با دایرةالبروج استوایی و تصحیح پیش‌روان',
      'قواعد نجوم جهان‌بین: مریخ/زحل/پلوتو/اورانوس سخت به نقاط چارت + جنبه‌های آسمانی مریخ-زحل و مریخ-پلوتو + پنجره گرفتگی‌ها + اطوار ماه',
      'وزن هر عامل با کرب (فاصله زاویه‌ای از جنبه دقیق) کاهش می‌یابد — هرچه دقیق‌تر، قوی‌تر',
    ],
    disclaimer:
      'این تب فقط و فقط بر پایه استرولوژی (نجوم جهان‌بین) است و از موتور اصلی ریسک (اخبار/بازار/پروازها/الگو) کاملاً جداست. استرولوژی سندیت علمی ندارد و صرفاً تحلیل احتمالاتی سنتی است.',
  }

  cache = { ts: Date.now(), data }
  return data
}
