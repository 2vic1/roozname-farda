// ─── استرولوزی جنگ — موتور چارت دولت‌ها/رهبران + سینستری + پنجره‌های ترانزیت ───
// از همان موتور دقیق natal.ts (astronomy-engine of-date + ASC ربع دقیق + ودیک + ستاره ثابت)
// چارت‌ها بر پایه داده‌های شناخته‌شده استرولوژی جهانی (Rodden-rated برای افراد،
// چارت سیبلی برای آمریکا، لحظه اعلام جمهوری اسلامی برای ایران، اعلام استقلال برای اسرائیل).
import * as A from 'astronomy-engine'
import { customDefKey, sanitizeCustomDefs, tehranWallToUtc, type CustomDefInput } from './custom-entity'
import { WAR_12_END, WINDOW_40 } from './cycles'
import { tehranDateStr } from './tehran'
import {
  ASPECTS,
  ASPECT_FA,
  computeVedic,
  computeWestern,
  eclLon,
  fmtDeg,
  findAspectDef,
  lifeIndex,
  PLANET_FA,
  starContacts,
  type StarContact,
  type WesternChart,
} from './natal'
import { jalaliMonthLabel, utcToJalaliTehran, todayJalali } from './jalali'

const DAY_MS = 86400000
const norm360 = (x: number) => ((x % 360) + 360) % 360
function norm180(x: number): number {
  let d = x % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

// ═══ ۱) تعریف چارت‌های پایه ═══

export interface WarEntityMeta {
  id: string
  fa: string
  short: string
  flag: string
  kind: 'state' | 'leader' | 'event'
  isoUtc: string
  lat: number
  lon: number
  placeFa: string
  chartFa: string
  sourceNote: string
  hotRole: string
}

export const WAR_ENTITIES: WarEntityMeta[] = [
  {
    id: 'iran', fa: 'جمهوری اسلامی ایران', short: 'ایران', flag: '🇮🇷', kind: 'state',
    isoUtc: '1979-03-31T20:30:00Z', lat: 35.6892, lon: 51.389,
    placeFa: 'تهران',
    chartFa: '۱۲ فروردین ۱۳۵۸ — آغاز روز همه‌پرسی تأسیس، ۰۰:۰۰ تهران',
    sourceNote: 'چارت تأسیس دولت — استاندارد استرولوژی ملتی؛ عامل اطمینان بالا (لحظه آغاز روز رسمی)',
    hotRole: 'میدان اصلی تنش — چارت میزبان پیش‌بینی',
  },
  {
    id: 'usa', fa: 'ایالات متحده آمریکا', short: 'آمریکا', flag: '🇺🇸', kind: 'state',
    isoUtc: '1776-07-04T22:10:00Z', lat: 39.9526, lon: -75.1652,
    placeFa: 'فیلادلفیا',
    chartFa: '۴ ژوئیه ۱۷۷۶ — ۱۷:۱۰ به وقت محلی فیلادلفیا (چارت سیبلی)',
    sourceNote: 'چارت سیبلی — پرکاربردترین چارت ملی آمریکا (LMT−5:00)، طالع حوت/جدی بحث‌برانگیز اما سیبلی مرجع است',
    hotRole: 'قدرت مؤثر — تصمیم‌ساز بیرونی',
  },
  {
    id: 'israel', fa: 'اسرائیل', short: 'اسرائیل', flag: '🇮🇱', kind: 'state',
    isoUtc: '1948-05-14T14:00:00Z', lat: 32.0853, lon: 34.7818,
    placeFa: 'تل‌آویو',
    chartFa: '۱۴ مه ۱۹۴۸ — ۱۶:۰۰ تل‌آویو، قرائت اعلام استقلال',
    sourceNote: 'لحظه قرائت اعلامیه استقلال پیش از شبات — چارت مرجع استرولوژی اسرائیل',
    hotRole: 'طرف دوم تنش — چارت آغازگر',
  },
  {
    id: 'trump', fa: 'دونالد ترامپ', short: 'ترامپ', flag: '👤', kind: 'leader',
    isoUtc: '1946-06-14T14:54:00Z', lat: 40.7282, lon: -73.7949,
    placeFa: 'کوئینز، نیویورک',
    chartFa: '۱۴ ژوئن ۱۹۴۶ — ۱۰:۵۴ صبح (EDT)',
    sourceNote: 'رده AA رودن — گواهی تولد، دقیق‌ترین چارت رهبری در این مجموعه',
    hotRole: 'رهبر مؤثر — اراده تصمیم جنگ/صلح',
  },
  {
    id: 'netanyahu', fa: 'بنیامین نتانیاهو', short: 'نتانیاهو', flag: '👤', kind: 'leader',
    isoUtc: '1949-10-21T07:30:00Z', lat: 32.0853, lon: 34.7818,
    placeFa: 'تل‌آویو',
    chartFa: '۲۱ اکتبر ۱۹۴۹ — ۱۰:۳۰ صبح (IDT +3:00)',
    sourceNote: 'رده B رودن — ساعت حافظه‌ای؛ طالع تقریبی، سیارات دقیق',
    hotRole: 'رهبر آغازگر — محرک عملیات',
  },
  {
    id: 'war12', fa: 'جنگ ۱۲روزه (اسرائیل↔ایران)', short: 'جنگ ۱۲روزه', flag: '⚔️', kind: 'event',
    isoUtc: '2025-06-12T23:00:00Z', lat: 35.6892, lon: 51.389,
    placeFa: 'تهران (محل برخورد نخست)',
    chartFa: '۲۳ خرداد ۱۴۰۴ — ۰۲:۳۰ تهران، آغاز عملیات',
    sourceNote: 'چارت رویداد — لنگر چرخه جنگی جاری؛ سالگردها و ترانزیت‌هایش ردپای آینده را می‌دهد',
    hotRole: 'لنگر چرخه جنگ — سالگرد و روندها',
  },
  {
    id: 'war40', fa: 'جنگ ۴۰روزه ایران–آمریکا', short: 'جنگ ۴۰روزه', flag: '💥', kind: 'event',
    isoUtc: '2026-02-28T08:30:00Z', lat: 35.6892, lon: 51.389,
    placeFa: 'تهران (مرکز صحنه)',
    chartFa: '۹ اسفند ۱۴۰۴ — ۱۲:۰۰ تهران (ساعت تقریبی)؛ پایان ≈ ۱۹ فروردین ۱۴۰۵ (۳۹-۴۰ روز)',
    sourceNote: 'چارت رویداد جنگ ۴۰روزه ایران–آمریکا — ساعت دقیق آغاز ثبت نشده؛ چارت ظهر به‌عنوان تقریب استاندارد، سیارات دقیق‌اند و طالع/خانه‌ها تقریبی',
    hotRole: 'چرخه جنگ دوم — ۳۹-۴۰ روز درگیری ایران–آمریکا؛ سالگردها و ترانزیت‌هایش پنجره تکرار را می‌دهد',
  },
]

// جفت‌های داغ سینستری
export const WAR_PAIRS: { a: string; b: string; label: string }[] = [
  { a: 'iran', b: 'israel', label: 'تقابل مستقیم — کانون جنگ' },
  { a: 'iran', b: 'usa', label: 'تقابل ساختاری — فشار و مذاکره' },
  { a: 'iran', b: 'trump', label: 'شخصی‌سازی دشمنی' },
  { a: 'iran', b: 'netanyahu', label: 'کینه‌تازی عملیاتی' },
  { a: 'usa', b: 'israel', label: 'اتحاد راهبردی' },
  { a: 'trump', b: 'netanyahu', label: 'متحدان عملیاتی' },
  { a: 'war12', b: 'iran', label: 'چرخه جنگ با میزبان' },
  { a: 'war12', b: 'israel', label: 'چرخه جنگ با آغازگر' },
  { a: 'cycle40', b: 'war12', label: 'پنجره ۴۰روزه بر لحظه آغاز جنگ' },
  { a: 'cycle40', b: 'iran', label: 'آسمان پنجره ۴۰روزه بر چارت ایران' },
  { a: 'cycle40', b: 'israel', label: 'پنجره ۴۰روزه بر چارت اسرائیل' },
  { a: 'war40', b: 'iran', label: 'جنگ دوم بر میزبان' },
  { a: 'war40', b: 'usa', label: 'جنگ ۴۰روزه با آمریکا' },
  { a: 'war40', b: 'war12', label: 'پیوند دو چرخه جنگ' },
  { a: 'war40', b: 'israel', label: 'جنگ ۴۰روزه و جبهه اسرائیل' },
]

// ═══ چارت رویدادی چرخه ۴۰روزه — entity کامل مثل جنگ ۱۲روزه ═══

export const CYCLE40_ID = 'cycle40'
let cycle40Meta: WarEntityMeta | null = null

const faNum = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

/** محاسبه و ثبت چرخه ۴۰روزه بعدی (آتش‌بس + k×۴۰، ظهر تهران) به‌عنوان چارت رویداد کامل —
 *  خروجی: متادیتا (یا null). هر بار که پنجره عوض شود کش چارت/سینستری/روز باطل می‌شود */
export function registerCycle40Entity(): WarEntityMeta | null {
  const today = tehranDateStr()
  const end = new Date(WAR_12_END + 'T00:00:00Z')
  let k = 1
  let date = ''
  for (; k <= 40; k++) {
    const ds = new Date(end.getTime() + WINDOW_40 * k * DAY_MS).toISOString().slice(0, 10)
    if (ds >= today) {
      date = ds
      break
    }
  }
  if (!date) return null
  // ظهر تهران (۱۲:۰۰ به وقت محل = ۰۸:۳۰ UTC با آفست ثابت ‎+03:30 ایران)
  const at = new Date(date + 'T08:30:00Z')
  const j = utcToJalaliTehran(at)
  const meta: WarEntityMeta = {
    id: CYCLE40_ID,
    fa: `چرخه ۴۰روزه (${faNum(k)}×۴۰) از آتش‌بس`,
    short: 'چرخه ۴۰روزه',
    flag: '⏳',
    kind: 'event',
    isoUtc: at.toISOString(),
    lat: 35.6892,
    lon: 51.389,
    placeFa: 'تهران',
    chartFa: `${faNum(j.jd)} ${jalaliMonthLabel(j.jy, j.jm).split(' ')[0]} ${faNum(j.jy)} — ۱۲:۰۰ تهران، اتمام چرخه ${faNum(k)}×۴۰ از آتش‌بس ۳ تیر ۱۴۰۴`,
    sourceNote: 'چارت رویدادی پنجره ۴۰روزه گن/هرست — آسمان ظهر روز اتمام چرخه، با همان موتور دقیق ephemeris؛ چرخه بعدی خودش را جابه‌جا می‌کند',
    hotRole: 'پنجره زمانی چرخه ۴۰ — نقشه آسمان لحظه اتمام چرخه از آتش‌بس',
  }
  const prev = cycle40Meta
  cycle40Meta = meta
  if (!prev || prev.isoUtc !== meta.isoUtc || prev.chartFa !== meta.chartFa) {
    // پنجره عوض شده — کش‌های وابسته را باطل کن
    chartCache.delete(CYCLE40_ID)
    for (const key of [...synastryCache.keys()]) {
      if (key.includes(CYCLE40_ID)) synastryCache.delete(key)
    }
    dayCache.clear()
  }
  return meta
}

export function entityMeta(id: string): WarEntityMeta {
  const m =
    WAR_ENTITIES.find((x) => x.id === id) ??
    customRegistry.get(id) ??
    (id === CYCLE40_ID ? cycle40Meta : undefined)
  if (!m) throw new Error(`چارت ناشناخته: ${id}`)
  return m
}

// ═══ چارت‌های دلخواه کاربر (افراد/دولت‌های انتخابی) ═══

const customRegistry = new Map<string, WarEntityMeta>()
let customSignature = ''

/** ثبت چارت‌های دلخواه کاربر که کلاینت همراه درخواست می‌فرستد — فقط در حافظه‌ی همین فرایند؛
 * هیچ جدول یا فایلی نوشته نمی‌شود (حریم خصوصی). قبل از هر محاسبه‌ای صدا زده می‌شود. */
export function registerCustomMetas(raw: unknown): void {
  const defs: CustomDefInput[] = sanitizeCustomDefs(raw)
  const metas: WarEntityMeta[] = defs.map((def) => {
    const d = tehranWallToUtc(def.date, def.time)
    const j = utcToJalaliTehran(d)
    const hhmm = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d)
    return {
      id: customDefKey(def),
      fa: def.name,
      short: def.name.length > 16 ? def.name.slice(0, 16) + '…' : def.name,
      flag: def.kind === 'state' ? '🏛️' : '👤',
      kind: def.kind === 'state' ? 'state' : 'leader',
      isoUtc: d.toISOString(),
      lat: def.lat,
      lon: def.lon,
      placeFa: def.placeFa,
      chartFa: `${faNum(j.jd)} ${jalaliMonthLabel(j.jy, j.jm).split(' ')[0]} ${faNum(j.jy)} — ساعت ${faNum(hhmm)} محل (${def.placeFa})`,
      sourceNote: 'چارت دلخواه کاربر — فقط برای همین محاسبه در حافظه می‌ماند و ذخیره نمی‌شود (حریم خصوصی)',
      hotRole: 'چارت انتخابی کاربر — در سینستری، پنجره‌ها و تحلیل AI فعال',
    }
  })
  // تغییر ست دلخواه‌ها ⇒ کش‌های حافظه‌ی مرتبط باطل شود (تغییر تعریف/حذف)
  const sig = metas.map((m) => `${m.id}@${m.isoUtc}`).join('|')
  if (sig !== customSignature) {
    const ids = new Set(metas.map((m) => m.id))
    for (const key of [...chartCache.keys()]) {
      if (key.startsWith('custom:') && !ids.has(key)) chartCache.delete(key)
    }
    for (const key of [...synastryCache.keys()]) {
      if (key.includes('custom:')) synastryCache.delete(key)
    }
    dayCache.clear()
    customSignature = sig
  }
  customRegistry.clear()
  for (const m of metas) customRegistry.set(m.id, m)
}

export function customMetasInUse(): WarEntityMeta[] {
  return [...customRegistry.values()]
}

/** همه چارت‌های فعال: پایه ثابت + چرخه ۴۰روزه + دلخواه کاربر */
export function warEntitiesInUse(): WarEntityMeta[] {
  return [...WAR_ENTITIES, ...(cycle40Meta ? [cycle40Meta] : []), ...customRegistry.values()]
}

// ═══ ۲) محاسبه چارت موجودیت — همان موتور چارت تولد ═══

export interface EntityReturn {
  bodyFa: string
  targetFa: string
  atIso: string
  jalali: string
  note: string
}

export interface WarEntityChart {
  meta: WarEntityMeta
  western: WesternChart
  vedicLite: { moonNakshatraFa: string; currentMaha: string; currentAntar: string }
  stars: StarContact[]
  index: number
  returns: EntityReturn[]
}

const chartCache = new Map<string, WarEntityChart>()

function jalaliOf(d: Date): string {
  const j = utcToJalaliTehran(d)
  return `${j.jd} ${jalaliMonthLabel(j.jy, j.jm).split(' ')[0]} ${j.jy}`
}

/** یادداشت‌های بازگشت‌های معروف — دقیق‌نگاه Xanastrology روی چارت ملت‌ها */
const RETURN_NOTES: Record<string, string> = {
  'usa:Uranus:Sun': 'بازگشت اورانوس آمریکا به خورشیدش — آخرین بار ۱۹۴۵-۴۶: پایان جنگ جهانی و عصر اتم؛ چرخه ۸۴ ساله آشوب نظامی',
  'usa:Pluto:Pluto': 'بازگشت پلوتوی آمریکا (هر ۲۴۸ سال) — ۱۸۷۰ بازسازی/جنگ داخلی‌ها، این‌بار ۲۰۲۲-۲۳؛ آزمون بقا هژمونی',
  'usa:Saturn:Sun': 'بازگشت زحل آمریکا — دوره انضباط/بحران نهادی؛ مقارن افت اعتبار نهادها',
  'israel:Saturn:Sun': 'بازگشت زحل اسرائیل — ۱۹۷۷: سادات و پیمان کمپ‌دیوید؛ چرخه ۲۹ ساله تغییر پیمان‌ها',
  'israel:Saturn:Mars': 'بازگشت زحل به مریخ اسرائیل — دوره عملیات نظامی بزرگ (۲۰۰۷-۰۸ غزه/سوریه)',
  'iran:Saturn:Sun': 'بازگشت زحل ایران به خورشید — چرخه ۲۹ ساله بلوغ/آزمون نظام (۱۳۸۷-۸۸: جنبش؛ ۱۴۱۷: دوره بعد)',
  'iran:Uranus:Sun': 'بازگشت اورانوس ایران — هر ۸۴ سال تکانه انقلابی؛ ناآرامی ساختاری',
  'iran:Pluto:Sun': 'بازگشت پلوتوی ایران به خورشید — دگردیسی عمیق هویت حکمرانی (فاصله نزدیک: ۱۴۰۴-۱۴۱۰)',
  'trump:Pluto:Mars': 'پلوتو روی مریخ ترامپ — خشم و قدرت بی‌پرده؛ ریسک تصمیم تهاجمی',
  'trump:Uranus:Sun': 'اورانوس به خورشید ترامپ — تکانه ناگهانی؛ اعلامیه‌های غافلگیرکننده',
  'netanyahu:Saturn:Sun': 'بازگشت زحل نتانیاهو — دوره سرنوشت‌سازی شخصی؛ آخرین بار ۲۰۱۹-۲۰: دادگاه و بحران',
  'war12:Mars:Sun': 'مریخ به خورشید چارت جنگ — سالگرد جوشش دوباره صحنه',
  'war40:Mars:Sun': 'مریخ به خورشید چارت جنگ ۴۰روزه — سالگرد جوشش دوباره جبهه ایران–آمریکا',
}

/** بازگشت‌های سیاره‌ای چارت در افق ۳ سال — چرخه‌های تکرار تاریخ */
function computeReturns(meta: WarEntityMeta): EntityReturn[] {
  const birth = new Date(meta.isoUtc)
  const natal: Record<string, number> = {}
  for (const p of ['Sun', 'Mars', 'Saturn', 'Pluto']) {
    natal[p] = norm360(eclLon((A.Body as Record<string, A.Body>)[p], birth))
  }
  natal.ASC = norm360(computeWesternAsc(meta))
  const bodies: { key: string; body: A.Body; speed: number }[] = [
    { key: 'Jupiter', body: A.Body.Jupiter, speed: 2 },
    { key: 'Saturn', body: A.Body.Saturn, speed: 3 },
    { key: 'Uranus', body: A.Body.Uranus, speed: 8 },
    { key: 'Neptune', body: A.Body.Neptune, speed: 12 },
    { key: 'Pluto', body: A.Body.Pluto, speed: 15 },
  ]
  const now = Date.now()
  const horizon = now + 1095 * DAY_MS
  const out: EntityReturn[] = []
  for (const b of bodies) {
    for (const [tKey, tLon] of Object.entries(natal)) {
      const f = (t: number) => norm180(eclLon(b.body, new Date(t)) - tLon)
      let t = now
      let prev = f(t)
      while (t < horizon) {
        t += b.speed * DAY_MS
        const cur = f(t)
        if (Math.sign(cur) !== Math.sign(prev) && Math.abs(prev) < 60) {
          let lo = t - b.speed * DAY_MS, hi = t, flo = prev
          for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2
            const fm = f(mid)
            if (Math.abs(hi - lo) < 60000) break
            if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm } else hi = mid
          }
          const at = new Date((lo + hi) / 2)
          if (at.getTime() > now) {
            const note = RETURN_NOTES[`${meta.id}:${b.key}:${tKey}`] ?? ''
            out.push({
              bodyFa: PLANET_FA[b.key], targetFa: targetFa(tKey),
              atIso: at.toISOString(), jalali: jalaliOf(at), note,
            })
          }
          prev = cur
        } else prev = cur
      }
    }
  }
  out.sort((x, y) => x.atIso.localeCompare(y.atIso))
  return out.slice(0, 8)
}

function computeWesternAsc(meta: WarEntityMeta): number {
  // ASC از چارت کامل کش‌شده — برای جلوگیری از رفت‌وبرگشت، از cache فرعی
  const c = chartCache.get(meta.id)
  if (c) return c.western.asc
  return computeWestern(new Date(meta.isoUtc), meta.lat, meta.lon).asc
}

export function getEntityChart(id: string): WarEntityChart {
  const cached = chartCache.get(id)
  if (cached) return cached
  const meta = entityMeta(id)
  const birth = new Date(meta.isoUtc)
  const western = computeWestern(birth, meta.lat, meta.lon)
  const vedic = computeVedic(birth, western.planets.find((p) => p.body === 'Moon')?.lon ?? 0)
  const stars = starContacts(birth, western.planets.map((p) => ({ body: p.body, lon: p.lon })))
  const chart: WarEntityChart = {
    meta,
    western,
    vedicLite: {
      moonNakshatraFa: vedic.moonNakshatraFa,
      currentMaha: vedic.currentMaha,
      currentAntar: vedic.currentAntar,
    },
    stars,
    index: lifeIndex(western),
    returns: computeReturns(meta),
  }
  chartCache.set(id, chart)
  return chart
}

function targetFa(key: string): string {
  if (key === 'ASC') return 'طالع'
  if (key === 'MC') return 'میانه آسمان'
  return PLANET_FA[key] ?? key
}

/** نقاط هدف جنگی چارت — کلیدهای گرم برای ترانزیت */
function hotPoints(w: WesternChart): { key: string; lon: number; fa: string }[] {
  const pts: { key: string; lon: number; fa: string }[] = []
  for (const p of w.planets) {
    if (['Rahu', 'Ketu', 'Uranus', 'Neptune'].includes(p.body)) continue
    pts.push({ key: p.body, lon: p.lon, fa: p.fa })
  }
  pts.push({ key: 'ASC', lon: w.asc, fa: 'طالع' })
  pts.push({ key: 'MC', lon: w.mc, fa: 'میانه آسمان' })
  return pts
}

// ═══ ۳) سینستری جفتی — تقاطع دو چارت ═══

export interface WarSynastryAspect {
  aFa: string
  bFa: string
  aspectFa: string
  orb: number
  hard: boolean
  weight: number
  tight: boolean
}

export interface WarSynastry {
  a: string
  b: string
  aFa: string
  bFa: string
  label: string
  friction: number
  flow: number
  tension: number
  aspects: WarSynastryAspect[]
  verdict: string
}

const SYN_BODY_W: Record<string, number> = {
  Sun: 3, Moon: 2.4, Mars: 3, Saturn: 2.6, Uranus: 2, Pluto: 2.6, ASC: 2.5, MC: 2.2,
}
const SYN_ASPECT_W: Record<string, number> = { conj: 1.2, square: 1, opp: 1.1, trine: 0.9, sextile: 0.7 }
const SYN_ASPECT_HARD: Record<string, boolean> = { conj: true, square: true, opp: true, trine: false, sextile: false }

const SYN_VERDICTS: { min: number; fa: string }[] = [
  { min: 78, fa: 'آتش زیر خاکستر — چرخه برخورد فعال؛ هر جرقه آسمانی می‌تواند بگیرد' },
  { min: 62, fa: 'خط مقدم گرم — برخورد ساختاری، جنگ نیابتی و فشار پیوسته' },
  { min: 46, fa: 'تقابل نابرابر — نه جنگ تمام‌عیار، نه آرامش؛ بازی فشار و چانه' },
  { min: 30, fa: 'همسویی ناپایدار — اتحاد منافع با ترک‌های پنهان' },
  { min: 0, fa: 'جریان هم‌سو — همکاری با اصطکاک‌های موردی' },
]

/** لنگر واقعیت سیاسی جفت — پایه تنش (استرولوژی ملتی همیشه بر واقعیت سیاسی سوار است)
 * عدد پایه: ۸۰+ دشمنی جنگی، ۵۰-۷۰ تقابل ساختاری، ۲۰-۴۰ اتحاد */
const RELATION_PRIOR: Record<string, number> = {
  'iran|israel': 78, 'iran|netanyahu': 68, 'iran|trump': 58, 'iran|usa': 64, 'iran|war12': 76,
  'israel|netanyahu': 40, 'israel|trump': 30, 'israel|usa': 28, 'israel|war12': 54,
  'netanyahu|trump': 22, 'netanyahu|usa': 30, 'netanyahu|war12': 48,
  'trump|usa': 40, 'trump|war12': 40, 'usa|war12': 44,
  'cycle40|war12': 66, 'cycle40|iran': 58, 'cycle40|israel': 52,
  'iran|war40': 82, 'israel|war40': 62, 'trump|war40': 70, 'usa|war40': 84, 'war12|war40': 74,
}

const synastryCache = new Map<string, WarSynastry>()

export function getSynastry(aId: string, bId: string): WarSynastry {
  const key = aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`
  const cached = synastryCache.get(key)
  if (cached) return cached

  const ca = getEntityChart(aId), cb = getEntityChart(bId)
  const pa = hotPoints(ca.western), pb = hotPoints(cb.western)
  const aspects: WarSynastryAspect[] = []
  for (const x of pa) {
    for (const y of pb) {
      const hit = findAspectDef(x.lon, y.lon)
      if (!hit) continue
      const bw = (SYN_BODY_W[x.key] ?? 1) * (SYN_BODY_W[y.key] ?? 1)
      const aw = SYN_ASPECT_W[hit.aspect.key] ?? 0.8
      const tightF = hit.orb <= 1 ? 1.45 : hit.orb <= 3 ? 1.15 : 0.85
      aspects.push({
        aFa: x.fa, bFa: y.fa, aspectFa: ASPECT_FA[hit.aspect.key], orb: hit.orb,
        hard: SYN_ASPECT_HARD[hit.aspect.key], weight: Math.round(bw * aw * tightF * 100) / 100,
        tight: hit.orb < 2,
      })
    }
  }
  aspects.sort((a, b) => b.weight - a.weight)
  const friction = Math.round(aspects.filter((x) => x.hard).reduce((s, x) => s + x.weight, 0) * 10) / 10
  const flow = Math.round(aspects.filter((x) => !x.hard).reduce((s, x) => s + x.weight, 0) * 10) / 10
  // تنش = لنگر واقعیت سیاسی + دینامیک آسمان (تراز جنبه‌های سخت نسبت به نرم)
  const prior = RELATION_PRIOR[key] ?? 45
  const tension = Math.max(0, Math.min(100, Math.round(prior + (friction - flow) * 0.18)))
  const pair = WAR_PAIRS.find((p) => p.a === aId && p.b === bId) ?? WAR_PAIRS.find((p) => (p.a === bId && p.b === aId))
  const verdict = (SYN_VERDICTS.find((v) => tension >= v.min) ?? SYN_VERDICTS[4]).fa

  const syn: WarSynastry = {
    a: aId, b: bId, aFa: ca.meta.short, bFa: cb.meta.short,
    label: pair?.label ?? 'تحلیل جفتی', friction, flow, tension,
    aspects: aspects.slice(0, 12), verdict,
  }
  synastryCache.set(key, syn)
  return syn
}

// ═══ ۴) پنجره‌های ترانزیتی جنگی — افق ۱۲۰ روز ═══

export interface WarWindow {
  id: string
  entityId: string
  entityFa: string
  transitFa: string
  targetFa: string
  aspectFa: string
  atIso: string
  jalali: string
  windowDays: number
  passes: number
  severity: number
  level: 'critical' | 'high' | 'medium'
  domain: 'military' | 'economy' | 'politics' | 'intel' | 'leadership'
  note: string
}

const TRANSIT_BODIES: { key: string; body: A.Body; step: number; win: number }[] = [
  { key: 'Mars', body: A.Body.Mars, step: 1, win: 3 },
  { key: 'Jupiter', body: A.Body.Jupiter, step: 2, win: 6 },
  { key: 'Saturn', body: A.Body.Saturn, step: 3, win: 8 },
  { key: 'Uranus', body: A.Body.Uranus, step: 5, win: 10 },
  { key: 'Neptune', body: A.Body.Neptune, step: 6, win: 11 },
  { key: 'Pluto', body: A.Body.Pluto, step: 6, win: 11 },
]
const W_BODY_W: Record<string, number> = { Mars: 10, Saturn: 8.5, Uranus: 7.5, Neptune: 5, Pluto: 8, Jupiter: 4.5 }
const W_TARGET_W: Record<string, number> = {
  Sun: 1.4, Moon: 1.2, Mercury: 0.9, Venus: 0.9, Mars: 1.3, Saturn: 1.1, Pluto: 1.15, ASC: 1.35, MC: 1.35,
}
const W_ASPECT_W: Record<string, number> = { conj: 1.15, square: 1, opp: 1.1 }
const DOMAIN_BY_BODY: Record<string, WarWindow['domain']> = {
  Mars: 'military', Uranus: 'military', Saturn: 'economy', Pluto: 'economy',
  Neptune: 'intel', Jupiter: 'politics',
}

/** معنی‌های جنگی ترانزیت — به فارسی، سبک پیشگویی اخترشناسی ملتی */
const TRANSIT_NOTES: Record<string, Record<string, string>> = {
  Mars: {
    Sun: 'ضربه مستقیم به هسته رهبری و اراده — روزهای تصمیم تهاجمی یا برخورد فیزیکی',
    Moon: 'خشم مردمی؛ احتمال حمله به زیرساخت عمومی و هیجان خیابانی',
    Mars: 'ترکیب جنگی خالص — اوج‌گیری عملیات نظامی، شلیک مستقیم',
    Saturn: 'مقابله زره و سرعت — گشایش عملیات سخت و پرهزینه',
    Pluto: 'خشم هسته‌ای/ابره‌کشنده — ریسک اسکالاسیون غیرقابل بازگشت',
    ASC: 'تغییر چهره ناگهانی در صحنه — ورود فعال به میدان',
    MC: 'ضربه به مقام و آبروی حکمرانی — هدف‌گیری فرماندهی/نهاد',
    Venus: 'ضربه به جیب و بازار — جهش نفت/طلا در روزهای حساس',
    Jupiter: 'گسترش میدان — عملیات در محورهای جدید',
  },
  Saturn: {
    Sun: 'فلج تصمیم و فشار تاریخی بر رهبری — دوره آزمون تحمل نهاد',
    Moon: 'اندوه جمعی؛ محدودیت و سکوت سنگین جامعه',
    Mars: 'قفل نظامی — توقف/فرسایش عملیات؛ جنگ آرام و سنگین',
    Saturn: 'دیوار ساختاری — تحریم/قانون سخت جدید، بازسازی اجباری',
    Pluto: 'چرخش قدرت ساختاری — پیمان/سقوط تاریخی نهادها',
    ASC: 'چهره سنگین دولت — انزوا یا دیسیپلین عمومی',
    MC: 'تغییر سقف قدرت — جابجایی رسمی رهبری/سیاست رسمی',
    Venus: 'فشار اقتصادی سنگین — سقوط درآمد و بازار',
    Jupiter: 'جمع‌شدن گشایش — پایان دوره امید/توافق سخت',
  },
  Uranus: {
    Sun: 'رعد ناگهانی — غافلگیری استراتژیک، تغییر رهبری/بازی در یک شب',
    Moon: 'جنبش ناگهانی مردم؛ انفجار اجتماعی سریع',
    Mars: 'حمله برق‌آسا — عملیات غافلگیرانه/پهپادی/سایبری',
    Saturn: 'شکستن قفسه ساختار — فروپاشی ناگهانی ترتیب امنیتی',
    Pluto: 'انفجار قدرت پنهان — حوادث هسته‌ای/شبکه‌ای بی‌سابقه',
    ASC: 'ماسک کنی داسمانی — چرخش ۱۸۰ درجه تصویر دولت',
    MC: 'لرزش سریر حکمرانی — جابجایی بی‌اخطار مقام',
    Venus: 'تکان بازار — جهش/ریزش بی‌سابقه نفت و ارز',
    Jupiter: 'جهش بی‌رویه — ائتلاف‌های عجیب و وعده‌های بزرگ',
  },
  Neptune: {
    Sun: 'مه فریب — عملیات روانی/دروغ استراتژیک درباره سرنوشت',
    Moon: 'اشک و اضطراب پخش‌شده — فضای روانی ملتهب',
    Mars: 'عملیات پنهان/نیابتی — جنگ سایه با دست‌های آلوده',
    Saturn: 'فساد ساختار — تحریم‌های خاکستری و فرار شبکه‌ای',
    Pluto: 'لابی پنهان قدرت — نقشه‌های زیرزمینی',
    ASC: 'چهره مبهم — سردرگمی جهانی درباره موضع رسمی',
    MC: 'قضیه اعتبار — رسوایی/افشاگری علیه نهاد',
    Venus: 'شوک نفتی روانی — حباب/وحشت بازار',
    Jupiter: 'وعده‌های بی‌پشتوانه — دیپلماسی پشت‌پرده',
  },
  Pluto: {
    Sun: 'دگردیسی اضطراری هویت — بازتعریف بقا؛ نقطه بی‌بازگشت',
    Moon: 'ترس عمیق جمعی؛ تغییری پنهان در روح جامعه',
    Mars: 'قدرت مرگ‌آفرین فعال — سناریوی تسلیحات راهبردی روی میز',
    Saturn: 'تخریب و بازسازی ستون‌های دولت — تحول اجباری نهادی',
    Pluto: 'بازگشت پلوتو — تکرار تاریخی بزرگ؛ سرنوشت‌مندی تام',
    ASC: 'تحول چهره دولت — دگرگونی تصویر جهانی',
    MC: 'تکان سقف قدرت — سقوط/جانشینی تاریخی حکمرانی',
    Venus: 'انقلاب منابع — نفت/انرژی به سلاح مرگ‌وزندگی',
    Jupiter: 'بزرگ‌نمایی قدرت — نشست‌های سرنوشت‌ساز',
  },
  Jupiter: {
    Sun: 'گشایش دیپلماتیک؛ رواداری موقت یا اتخاذ تصمیم بزرگ',
    Moon: 'همدردی جهانی؛ موج حمایتی مردمی',
    Mars: 'بزرگ‌نمایی عملیات — تشدید گفتار جنگی اما کوتاه',
    Saturn: 'توافق سخت — پیمان با شرایط سنگین',
    Pluto: 'تحول بزرگ قدرت — کنفرانس‌های تعیین‌کننده',
    ASC: 'نفس تازه تصویر — بهبود موقت اعتبار',
    MC: 'ارتقای مقام — طرح‌های جدید منطقه‌ای',
    Venus: 'فربه‌شدن جیب — رونق کوتاه بازار',
    Jupiter: 'دوره بزرگ گشایش — اوج امید',
  },
}

const windowsCache = new Map<string, { windows: WarWindow[]; eclipses: WarEclipse[] }>()

function scanEntityWindows(
  meta: WarEntityMeta, from: number, to: number, id: string,
): WarWindow[] {
  const chart = getEntityChart(id)
  const points = hotPoints(chart.western)
  const natalMap: Record<string, number> = {}
  for (const p of points) natalMap[p.key] = p.lon

  const out: WarWindow[] = []
  for (const tb of TRANSIT_BODIES) {
    for (const [tKey, tLon] of Object.entries(natalMap)) {
      for (const asp of ASPECTS) {
        if (!asp.hard) continue // فقط جنبه‌های سخت — زبان جنگ
        const f = (t: number) => norm180(eclLon(tb.body, new Date(t)) - tLon - asp.angle)
        let t = from
        let prev = f(t)
        let crossings: number[] = []
        while (t < to) {
          t += tb.step * DAY_MS
          const cur = f(t)
          if (Math.sign(cur) !== Math.sign(prev) && Math.abs(prev - cur) < 45) {
            let lo = t - tb.step * DAY_MS, hi = t, flo = prev
            for (let i = 0; i < 18; i++) {
              const mid = (lo + hi) / 2
              const fm = f(mid)
              if (Math.abs(hi - lo) < 60000) break
              if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm } else hi = mid
            }
            crossings.push((lo + hi) / 2)
          }
          prev = cur
        }
        if (!crossings.length) continue
        const noteBase = TRANSIT_NOTES[tb.key]?.[tKey] ?? 'فعال‌شدن خطوط جنگی چارت'
        const bodyW = W_BODY_W[tb.key] ?? 4
        const targetW = W_TARGET_W[tKey] ?? 1
        const aspW = W_ASPECT_W[asp.key] ?? 1
        const passBonus = crossings.length >= 3 ? 1.2 : crossings.length === 2 ? 1.05 : 0.95
        for (const c of crossings) {
          const at = new Date(c)
          const dFrom = (c - Date.now()) / DAY_MS
          const nearF = dFrom <= 7 ? 1.5 : dFrom <= 30 ? 1.2 : dFrom <= 90 ? 0.85 : 0.55
          const severity = Math.round(Math.min(100, bodyW * targetW * aspW * passBonus * nearF * 1.9))
          const level: WarWindow['level'] = severity >= 26 ? 'critical' : severity >= 14 ? 'high' : 'medium'
          out.push({
            id: `${id}-${tb.key}-${tKey}-${asp.key}-${Math.round(c)}`,
            entityId: id, entityFa: meta.short,
            transitFa: PLANET_FA[tb.key], targetFa: targetFa(tKey),
            aspectFa: ASPECT_FA[asp.key],
            atIso: at.toISOString(), jalali: jalaliOf(at),
            windowDays: tb.win, passes: crossings.length,
            severity, level,
            domain: DOMAIN_BY_BODY[tb.key] ?? 'politics',
            note: noteBase,
          })
        }
      }
    }
  }
  // حذف تکرارهای نزدیک (سه‌گذره‌ها فاصله دارند؛ فقط مجاورت چندساعته را بچین)
  out.sort((a, b) => a.atIso.localeCompare(b.atIso))
  const dedup: WarWindow[] = []
  for (const w of out) {
    const last = dedup[dedup.length - 1]
    if (last && last.entityId === w.entityId && last.transitFa === w.transitFa &&
        last.targetFa === w.targetFa && last.aspectFa === w.aspectFa &&
        Math.abs(new Date(last.atIso).getTime() - new Date(w.atIso).getTime()) < 5 * DAY_MS) {
      continue
    }
    dedup.push(w)
  }
  return dedup
}

// ═══ ۵) رادار گرفتگی‌ها ═══

export interface WarEclipse {
  kind: 'solar' | 'lunar'
  atIso: string
  jalali: string
  degree: string
  hits: { entityId: string; entityFa: string; targetFa: string; orb: number; note: string }[]
}

const ECLIPSE_NOTE = 'گرفتگی روی نقطه حساس چارت — تقویم‌نویسی جنگی قدیمی: شوک/رویداد بزرگ در ±۳۰ روز'

function scanEclipses(from: number, to: number): WarEclipse[] {
  const out: WarEclipse[] = []
  let cursor: A.AstroTime = A.MakeTime(new Date(from))
  for (let guard = 0; guard < 8; guard++) {
    const e = A.SearchGlobalSolarEclipse(cursor, A.MakeTime(new Date(to)))
    if (!e) break
    const at = e.peak.date
    if (at.getTime() > to) break
    const sunLon = norm360(eclLon(A.Body.Sun, at))
    out.push(buildEclipse('solar', at, sunLon))
    cursor = A.MakeTime(new Date(at.getTime() + 10 * DAY_MS))
  }
  cursor = A.MakeTime(new Date(from))
  for (let guard = 0; guard < 8; guard++) {
    const e = A.SearchLunarEclipse(cursor, A.MakeTime(new Date(to)))
    if (!e) break
    const at = e.peak.date
    if (at.getTime() > to) break
    const moonLon = norm360(eclLon(A.Body.Moon, at))
    out.push(buildEclipse('lunar', at, moonLon))
    cursor = A.MakeTime(new Date(at.getTime() + 10 * DAY_MS))
  }
  out.sort((a, b) => a.atIso.localeCompare(b.atIso))
  return out
}

function buildEclipse(kind: 'solar' | 'lunar', at: Date, eclLonDeg: number): WarEclipse {
  const hits: WarEclipse['hits'] = []
  for (const meta of WAR_ENTITIES) {
    const chart = getEntityChart(meta.id)
    for (const p of hotPoints(chart.western)) {
      const orb = Math.abs(norm180(eclLonDeg - p.lon))
      if (orb <= 3) {
        hits.push({ entityId: meta.id, entityFa: meta.short, targetFa: p.fa, orb: Math.round(orb * 10) / 10, note: ECLIPSE_NOTE })
        break // هر چارت یک ضربه کافی است
      }
    }
  }
  return { kind, atIso: at.toISOString(), jalali: jalaliOf(at), degree: fmtDeg(eclLonDeg), hits }
}

// ═══ ۶) شاخص جنگ آسمانی ۰-۱۰۰ ═══

export interface WarIndexInfo {
  index: number
  note: string
  parts: { label: string; value: number; share: number }[]
}

function computeWarIndex(windows: WarWindow[], eclipses: WarEclipse[]): WarIndexInfo {
  // الف) بیشینه تنش سینستری جفت‌های داغ
  const hotPairs = WAR_PAIRS.filter((p) => ['iran-israel', 'iran-usa', 'iran-trump', 'iran-netanyahu', 'war12-iran'].includes(`${p.a}-${p.b}`))
  const tensions = hotPairs.map((p) => getSynastry(p.a, p.b).tension)
  const maxPair = Math.max(...tensions, 0)
  const avgPair = tensions.length ? tensions.reduce((s, x) => s + x, 0) / tensions.length : 0

  // ب) پنجره‌های نزدیک (۳۰ روز)
  const now = Date.now()
  const near = windows.filter((w) => new Date(w.atIso).getTime() - now <= 30 * DAY_MS)
  const nearSev = near.slice(0, 10).map((w) => w.severity)
  const nearScore = nearSev.length ? Math.min(100, (nearSev.reduce((s, x) => s + x, 0) / nearSev.length) * 2.6) : 0

  // ج) گرفتگی‌های هیت‌شده
  const eclHits = eclipses.filter((e) => e.hits.length > 0)
  const eclScore = Math.min(100, eclHits.length * 45 + eclHits.reduce((s, e) => s + e.hits.length, 0) * 12)

  // د) آسمان همین لحظه: مریخ به نقاط گرم چارت ایران/اسرائیل
  const marsNow = eclLon(A.Body.Mars, new Date())
  let skyHit = 0
  for (const id of ['iran', 'israel']) {
    for (const p of hotPoints(getEntityChart(id).western)) {
      const hit = findAspectDef(marsNow, p.lon, 0.55)
      if (hit && hit.aspect.hard) skyHit += hit.orb < 2 ? 22 : 12
    }
  }
  const skyScore = Math.min(100, skyHit)

  const index = Math.round(
    Math.max(0, Math.min(100,
      maxPair * 0.3 + avgPair * 0.12 + nearScore * 0.33 + eclScore * 0.15 + skyScore * 0.1,
    )),
  )
  const note =
    index >= 80 ? 'آسمان جنگی — پنجره‌های برخورد فعال؛ هوشیاری حداکثری'
    : index >= 62 ? 'تنش بالا — مقدمات و پست‌های جنگی گرم'
    : index >= 45 ? 'فشار ساختاری — جنگ نیابتی و اقتصادی داغ، جنگ مستقیم سرد'
    : index >= 28 ? 'تنش پس‌زمینه — مذاکره زیر سایه تهدید'
    : 'آسمان نسبتاً آرام — چرخه‌های بلندمدت فعال اما جرقه نزدیک نیست'
  return {
    index,
    note,
    parts: [
      { label: 'بیشینه سینستری', value: Math.round(maxPair), share: 30 },
      { label: 'میانگین جفت‌های داغ', value: Math.round(avgPair), share: 12 },
      { label: 'پنجره‌های ۳۰روزه', value: Math.round(nearScore), share: 33 },
      { label: 'رادار گرفتگی', value: Math.round(eclScore), share: 15 },
      { label: 'مریخ همین‌حالا', value: Math.round(skyScore), share: 10 },
    ],
  }
}

// ═══ ۷) خروجی کلان (کش روزانه) ═══

export interface WarAi {
  executive: string
  reads: { id: string; read: string }[]
  flashpoints: { pair: string; read: string }[]
  calls: { when: string; windowDays?: number; what: string; confidence: number }[]
  prediction: string
  monthlyNote: string
}

export interface WarCycle40 {
  date: string // YYYY-MM-DD
  k: number // ضریب چرخه: آتش‌بس + k×۴۰ روز
  families: Array<'gann' | 'hurst'> // گن و هرست تاریخ یکسان دارند
  daysLeft: number
}

export interface CycleWindowAspect {
  transitFa: string // سیاره آسمان پنجره
  aspectFa: string
  targetFa: string // نقطه از چارت لنگر
  entityFa: string // کدام چارت
  orb: number
}

/** جنبه‌های سخت آسمان پنجره ۴۰روزه به چارت‌های لنگر — از چارت ثبت‌شده cycle40 استفاده می‌کند */
export interface CycleWindowChart {
  date: string
  k: number
  jalali: string
  utcNoon: string
  western: WesternChart
  aspects: CycleWindowAspect[]
}

const WINDOW_ANCHORS = ['war12', 'war40', 'iran', 'israel'] as const

export function getCycleWindowChart(): CycleWindowChart | null {
  const meta = registerCycle40Entity()
  if (!meta) return null
  const at = new Date(meta.isoUtc)
  const western = getEntityChart(CYCLE40_ID).western
  const sky = hotPoints(western)
  const aspects: CycleWindowAspect[] = []
  for (const anchorId of WINDOW_ANCHORS) {
    let anchor: WarEntityChart
    try {
      anchor = getEntityChart(anchorId)
    } catch {
      continue
    }
    for (const p of hotPoints(anchor.western)) {
      for (const s of sky) {
        const hit = findAspectDef(s.lon, p.lon)
        if (hit && hit.aspect.hard) {
          aspects.push({
            transitFa: s.fa,
            aspectFa: ASPECT_FA[hit.aspect.key],
            targetFa: p.fa,
            entityFa: anchor.meta.short,
            orb: Math.round(hit.orb * 10) / 10,
          })
        }
      }
    }
  }
  aspects.sort((a, b) => a.orb - b.orb)
  return {
    date: at.toISOString().slice(0, 10),
    k: Math.max(1, Math.round((at.getTime() - new Date(WAR_12_END + 'T00:00:00Z').getTime()) / (WINDOW_40 * DAY_MS))),
    jalali: jalaliOf(at),
    utcNoon: at.toISOString(),
    western,
    aspects: aspects.slice(0, 10),
  }
}

export interface WarPayload {
  ok: true
  generatedAtIso: string
  warIndex: WarIndexInfo
  entities: WarEntityChart[]
  pairs: WarSynastry[]
  windows: WarWindow[]
  eclipses: WarEclipse[]
  cycles40: WarCycle40[]
  windowChart: CycleWindowChart | null
  ai: WarAi
  aiSource: 'ai' | 'engine'
}

const dayCache = new Map<string, { windows: WarWindow[]; eclipses: WarEclipse[]; index: WarIndexInfo }>()

function tehranDayKey(): string {
  const j = todayJalali()
  return `${j.jy}-${j.jm}-${j.jd}`
}

function computeWindowsForDay(): { windows: WarWindow[]; eclipses: WarEclipse[] } {
  const from = Date.now() - 2 * DAY_MS
  const to = from + 120 * DAY_MS
  const windows: WarWindow[] = []
  for (const meta of warEntitiesInUse()) {
    windows.push(...scanEntityWindows(meta, from, to, meta.id))
  }
  windows.sort((a, b) => b.severity - a.severity || a.atIso.localeCompare(b.atIso))
  const eclipses = scanEclipses(from, to)
  return { windows, eclipses }
}

export function getWarAggregate(): {
  windows: WarWindow[]; eclipses: WarEclipse[]; index: WarIndexInfo
} {
  // کلید کش شامل چارت‌های دلخواه است — با افزودن/حذف، کش روز باطل می‌شود
  const customKey = [...customRegistry.keys()].sort().join(',')
  const key = `${tehranDayKey()}|${customKey}`
  const cached = dayCache.get(key)
  if (cached) return cached
  const { windows, eclipses } = computeWindowsForDay()
  const index = computeWarIndex(windows, eclipses)
  const val = { windows, eclipses, index }
  if (dayCache.size > 4) dayCache.clear()
  dayCache.set(key, val)
  return val
}

export function getWarIndex(): WarIndexInfo {
  return getWarAggregate().index
}

// ─── دیجست برای هوش مصنوعی + متن پیش‌فرض موتور ───

function entityDigest(id: string): string {
  const c = getEntityChart(id)
  const sun = c.western.planets.find((p) => p.body === 'Sun')
  const mars = c.western.planets.find((p) => p.body === 'Mars')
  const sat = c.western.planets.find((p) => p.body === 'Saturn')
  const pl = c.western.planets.find((p) => p.body === 'Pluto')
  return `${c.meta.fa} [${c.meta.kind === 'state' ? 'دولت' : c.meta.kind === 'leader' ? 'رهبر' : 'رویداد'}]: خورشید ${sun?.degText}، مریخ ${mars?.degText}، زحل ${sat?.degText}، پلوتو ${pl?.degText}، طالع ${c.western.ascText}، میانه‌آسمان ${c.western.mcText}`
}

function windowsDigest(windows: WarWindow[]): string {
  return windows.slice(0, 14).map((w) =>
    `- ${w.jalali} (±${w.windowDays}روز، ${w.level === 'critical' ? 'بحرانی' : w.level === 'high' ? 'بالا' : 'متوسط'}): ${w.transitFa} ${w.aspectFa} ${w.targetFa} «${w.entityFa}» — ${w.note}`,
  ).join('\n')
}

export function warAiDigest(): string {
  const { windows, eclipses, index } = getWarAggregate()
  const all = warEntitiesInUse()
  // جفت‌های ثابت + چارت‌های دلخواه کاربر در برابر سه کنشگر اصلی
  const customs = customMetasInUse()
  const customPairs = customs.flatMap((m) => [
    { a: m.id, b: 'iran', label: 'چارت دلخواه کاربر ↔ ایران' },
    { a: m.id, b: 'israel', label: 'چارت دلخواه کاربر ↔ اسرائیل' },
    { a: m.id, b: 'usa', label: 'چارت دلخواه کاربر ↔ آمریکا' },
  ])
  const pairs = [...WAR_PAIRS, ...customPairs].map((p) => {
    const s = getSynastry(p.a, p.b)
    return `- ${s.aFa}↔${s.bFa} (${p.label}): تنش ${s.tension}/100؛ ${s.aspects.slice(0, 3).map((a) => `${a.aFa} ${a.aspectFa} ${a.bFa} (${a.orb.toFixed(1)}°)`).join('، ')}`
  }).join('\n')
  const eclipsesTxt = eclipses.length
    ? eclipses.map((e) => `- ${e.kind === 'solar' ? 'خورشیدگرفتگی' : 'ماهگرفتگی'} ${e.jalali} در ${e.degree}${e.hits.length ? ` ← ضربه به: ${e.hits.map((h) => `${h.targetFa} ${h.entityFa} (${h.orb}°)`).join('، ')}` : ''}`).join('\n')
    : '- در افق ۱۲۰ روز گرفتگی مؤثری روی نقاط چارت‌ها نیست'
  const returnsTxt = warEntitiesInUse().map((m) => {
    const r = getEntityChart(m.id).returns.slice(0, 2)
    return r.length ? `- ${m.short}: ${r.map((x) => `${x.bodyFa} به ${x.targetFa} در ${x.jalali}`).join('، ')}` : ''
  }).filter(Boolean).join('\n')

  return `شاخص جنگ آسمانی: ${index.index}/100 — ${index.note}
اجزای شاخص: ${index.parts.map((p) => `${p.label}=${p.value}`).join('، ')}

چارت‌های پایه و دلخواه:
${all.map((m) => entityDigest(m.id)).join('\n')}

سینستری جفت‌ها:
${pairs}

پنجره‌های ترانزیتی ۱۲۰روز آینده (سخت، دقیق):
${windowsDigest(windows)}

گرفتگی‌ها:
${eclipsesTxt}

بازگشت‌های چرخه‌ای نزدیک:
${returnsTxt || '- بازگشت بزرگی در افق نیست'}`
}

export function warFallbackAi(): WarAi {
  const { windows, eclipses, index } = getWarAggregate()
  const top = windows.slice(0, 6)
  const calls = top.map((w) => ({
    when: w.jalali,
    windowDays: w.windowDays,
    what: `${w.transitFa} ${w.aspectFa} ${w.targetFa} «${w.entityFa}» — ${w.note}`,
    confidence: Math.min(92, 40 + w.severity),
  }))
  const pairReads = WAR_PAIRS.slice(0, 4).map((p) => {
    const s = getSynastry(p.a, p.b)
    return { pair: `${s.aFa}↔${s.bFa}`, read: `${s.label} — تنش ${s.tension}/۱۰۰. ${s.verdict}. بیشترین فشار: ${s.aspects[0] ? `${s.aspects[0].aFa} ${s.aspects[0].aspectFa} ${s.aspects[0].bFa}` : '—'}.` }
  })
  return {
    executive: `شاخص جنگ آسمانی ${index.index}/۱۰۰ — ${index.note}. موتور بدون هوش مصنوعی، از ترانزیت‌های سخت دقیق و سینستری چارت‌های پایه ساخته شده است.`,
    reads: warEntitiesInUse().map((m) => {
      const c = getEntityChart(m.id)
      const sun = c.western.planets.find((p) => p.body === 'Sun')
      const mars = c.western.planets.find((p) => p.body === 'Mars')
      return `${m.fa}: خورشید ${sun?.degText} و مریخ ${mars?.degText} — ${m.hotRole}. دوره دشای جاری: ${c.vedicLite.currentMaha}.`
    }),
    flashpoints: pairReads,
    calls: calls.length ? calls : [{ when: '—', what: 'پنجره سخت نزدیکی در افق ۱۲۰ روز فعال نیست', confidence: 30 }],
    prediction: `بر پایه پنجره‌های بالا، ماه‌های پرتنش پیش‌رو: ${[...new Set(top.map((w) => w.jalali.split(' ').slice(1).join(' ')))].slice(0, 3).join('، ')}. برای تحلیل عمیق‌تر و اتصال خبرهای زنده، کلید هوش مصنوعی را در تنظیمات ست کنید.`,
    monthlyNote: eclipses.length
      ? `گرفتگی‌های پیش‌رو: ${eclipses.map((e) => `${e.kind === 'solar' ? 'خورشیدی' : 'ماهی'} ${e.jalali}`).join('، ')} — پیرامون این تاریخ‌ها احتمال رویداد بزرگ بالا می‌رود.`
      : 'در افق ۱۲۰ روز گرفتگی مؤثری روی نقاط چارت‌ها نیست؛ تنش از ترانزیت‌های سریع می‌آید.',
  }
}

export function warMonthsAhead(count = 3): { jy: number; jm: number; label: string }[] {
  const j = todayJalali()
  const out: { jy: number; jm: number; label: string }[] = []
  let y = j.jy, m = j.jm
  for (let i = 0; i < count; i++) {
    m += 1
    if (m > 12) { m = 1; y += 1 }
    out.push({ jy: y, jm: m, label: jalaliMonthLabel(y, m) })
  }
  return out
}
