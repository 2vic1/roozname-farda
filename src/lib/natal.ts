// ─── موتور استرولوژی شخصی (چارت تولد) ───
// سبک: تلفیق اخترشناسی غربی (استوایی/تروپیکال) + ودیک شرقی (سیترین/لاهیری + ناکشترا +
// ویمشوتاری دشا) + ستارگان ثابت + اعدادشناسی + چرخه‌های تکرار تاریخی بیرونی
// (امضای Xanastrology: «اورانوس در دوقلو ↔ قحطی ۱۳۲۰-۱۳۲۴»).
// مبنای فنی: ephemeris واقعی astronomy-engine — طول دایرةالبروج of-date.
import * as A from 'astronomy-engine'
import {
  gregorianToJalali,
  jalaliMonthLabel,
  jalaliMonthRange,
  utcToJalaliTehran,
} from './jalali'

const DAY_MS = 86400000
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const norm360 = (x: number) => ((x % 360) + 360) % 360
function norm180(x: number): number {
  let d = x % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

// ─── واژه‌نامه فارسی ───
export const SIGNS_FA = [
  'حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله',
  'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت',
]
export const SIGNS_GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']

export const PLANET_FA: Record<string, string> = {
  Sun: 'خورشید', Moon: 'ماه', Mercury: 'عطارد', Venus: 'زهره',
  Mars: 'مریخ', Jupiter: 'مشتری', Saturn: 'زحل', Uranus: 'اورانوس',
  Neptune: 'نپتون', Pluto: 'پلوتو', Rahu: 'راهو', Ketu: 'کتو',
}
export const PLANET_GLYPH: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
  Rahu: '☊', Ketu: '☋',
}
export const DASHA_LORD_FA: Record<string, string> = {
  Sun: 'خورشید', Moon: 'ماه', Mercury: 'عطارد', Venus: 'زهره', Mars: 'مریخ',
  Jupiter: 'مشتری', Saturn: 'زحل', Rahu: 'راهو', Ketu: 'کتو',
}

export const ASPECT_FA: Record<string, string> = {
  conj: 'مقارنه', square: 'مربع', opp: 'مقابله', trine: 'تثلیث', sextile: 'تتسیم',
}

// ─── ephemeris: طول دایرةالبروج of-date — چرخش دقیق EQJ→ECT (خطای مرز صفر) ───
const rotCache = new Map<number, A.RotationMatrix>()
const ROT_BUCKET_MS = 12 * 3600000 // چرخش پیش‌روان در ۱۲ ساعت عملاً ثابت است
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

export function eclLon(body: A.Body, date: Date): number {
  if (body === A.Body.Moon) return A.EclipticGeoMoon(A.MakeTime(date)).lon
  if (body === A.Body.Sun) return A.SunPosition(date).elon
  const vec = A.GeoVector(body, date, true)
  const v = A.RotateVector(ectRotation(date.getTime()), vec)
  return norm360(Math.atan2(v.y, v.x) * 180 / Math.PI)
}

/** گره ماه — واقعی (مدار مصاوی لحظه‌ای) — راهو؛ کتو = +۱۸۰
 * نکته: نیم‌خط گره روی دایرةالبروج است → تصحیح پیش‌روان ساده دقیق است */
function trueNode(date: Date): number {
  const st = A.GeoMoonState(A.MakeTime(date)) // استوایی J2000
  const eps = 23.4392911
  const c = Math.cos(rad(eps)), s = Math.sin(rad(eps))
  const toEcl = (v: number[]): number[] => [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c]
  const r = toEcl([st.x, st.y, st.z])
  const v = toEcl([st.vx, st.vy, st.vz])
  // گشتاور مداری h = r×v — نیم‌خط گره صعودی = ẑ×h
  const hx = r[1] * v[2] - r[2] * v[1]
  const hy = r[2] * v[0] - r[0] * v[2]
  const T = (date.getTime() / DAY_MS + 2440587.5 - 2451545.0) / 36525
  return norm360(deg(Math.atan2(hx, -hy)) + 1.396971 * T)
}

/** نرخ حرکت روزانه (درجه/روز) علامت‌دار */
function rate(body: A.Body, date: Date): number {
  const l1 = eclLon(body, new Date(date.getTime() - DAY_MS / 4))
  const l2 = eclLon(body, new Date(date.getTime() + DAY_MS / 4))
  return norm180(l2 - l1) * 2
}

function isRetro(body: A.Body, date: Date): boolean {
  return rate(body, date) < 0
}

// ─── طالع و میانه آسمان (ASC/MC) با انتخاب ربع دقیق ───
export function ascendantMC(date: Date, lat: number, lon: number): { asc: number; mc: number } {
  const gast = A.SiderealTime(date)
  const th = norm360(gast * 15 + lon) // RAMC
  const eps = A.e_tilt(A.MakeTime(date)).tobl
  const ce = Math.cos(rad(eps)), se = Math.sin(rad(eps))
  const P = (l: number): number[] => [
    Math.cos(rad(l)), Math.sin(rad(l)) * ce, Math.sin(rad(l)) * se,
  ]
  const c = Math.cos(rad(lat)), s = Math.sin(rad(lat))
  const Z = [c * Math.cos(rad(th)), c * Math.sin(rad(th)), s] // سمت‌الرأس
  const E = [-Math.sin(rad(th)), Math.cos(rad(th)), 0] // نقطه شرق
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  let asc = norm360(
    deg(Math.atan2(-Math.cos(rad(th)), ce * Math.sin(rad(th)) + Math.tan(rad(lat)) * se)),
  )
  if (dot(P(asc), E) < 0) asc = norm360(asc + 180) // باید نیم‌کره شرقی باشد
  let mc = norm360(deg(Math.atan2(Math.sin(rad(th)), Math.cos(rad(th)) * ce)))
  if (dot(P(mc), Z) < 0) mc = norm360(mc + 180) // باید بالای افق باشد
  return { asc, mc }
}

// ─── جنبه‌ها ───
export interface AspectDef { key: string; angle: number; orb: number; hard: boolean }
export const ASPECTS: AspectDef[] = [
  { key: 'conj', angle: 0, orb: 8, hard: true },
  { key: 'sextile', angle: 60, orb: 5, hard: false },
  { key: 'square', angle: 90, orb: 7, hard: true },
  { key: 'trine', angle: 120, orb: 7, hard: false },
  { key: 'opp', angle: 180, orb: 8, hard: true },
]

export function findAspectDef(lon1: number, lon2: number, orbScale = 1): { aspect: AspectDef; orb: number } | null {
  const gap = Math.abs(norm180(lon1 - lon2))
  for (const a of ASPECTS) {
    const orb = Math.abs(gap - a.angle)
    if (orb <= a.orb * orbScale) return { aspect: a, orb }
  }
  return null
}

export function fmtDeg(lon: number): string {
  const sign = SIGNS_FA[Math.floor(norm360(lon) / 30)]
  const d = norm360(lon) % 30
  const full = Math.floor(d)
  const min = Math.floor((d - full) * 60)
  return `${full}°${String(min).padStart(2, '0')}′ ${sign}`
}

// ─── شأن سیاره (فرمانروایی/اوج/اذیت/هبوط) ───
const RULERSHIP: Record<number, string[]> = {
  0: ['Sun'], 1: ['Moon'], 3: ['Moon'], 4: ['Sun'], 2: ['Mercury'], 5: ['Mercury'],
  6: ['Venus'], 7: ['Mars', 'Pluto'], 8: ['Jupiter'], 9: ['Saturn'], 10: ['Saturn', 'Uranus'], 11: ['Jupiter', 'Neptune'],
}
const EXALT: Record<number, string> = { 0: 'Sun', 1: 'Moon', 3: 'Jupiter', 4: 'Mercury', 5: 'Venus', 6: 'Saturn', 7: 'Neptune', 9: 'Mars', 10: 'Uranus', 11: 'Venus' }
function dignity(body: string, sign: number): string {
  if (RULERSHIP[sign]?.includes(body)) return 'فرمانروا'
  if (EXALT[sign] === body) return 'در اوج'
  const det = RULERSHIP[sign]?.length
  // اذیت = برج مقابل برج فرمانروایی
  for (const [sg, planets] of Object.entries(RULERSHIP)) {
    if (planets.includes(body)) {
      const oppSign = (Number(sg) + 6) % 12
      if (oppSign === sign) return 'در اذیت'
      if (EXALT[(Number(sg) + 6) % 12] === body && false) return ''
    }
  }
  if (det === undefined) return ''
  const fallSign = Object.entries(EXALT).find(([, b]) => b === body)
  if (fallSign && (Number(fallSign[0]) + 6) % 12 === sign) return 'در هبوط'
  return ''
}

// ─── ناکشتراها (منزل‌های قمری ودیک) ───
const NAKSHATRA_FA = [
  'اشوینی', 'بهرنی', 'کریتیکا', 'روهینی', 'مریگیرشیرا', 'آردرا', 'پونارواسو',
  'پوشیا', 'آشلسا', 'ماگها', 'پوروا فالگونی', 'اوترا فالگونی', 'هاستا', 'چیتا',
  'سواتی', 'ویشاکها', 'آنورادها', 'جیشتا', 'مولا', 'پوروا آشادها', 'اوترا آشادها',
  'شروانا', 'دانیشتا', 'شتابیشا', 'پوروا بادراپادا', 'اوترا بادراپادا', 'رووتی',
]
const NAK_LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury']
const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7,
  Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
}

const NAK_TRAITS_FA = [
  'سرعت و شفای بخشندگی', 'اراده و عشق عمیق', 'بریانی و تیزی عقل', 'شکوفایی و محبوبیت',
  'جست‌وجو و سرگذشت', 'شدت و دگرگونی', 'تجدید و بازگشت', 'برکت و مراقبت', 'چنگال انرژی و راز',
  'میراث و قدرت پدری', 'آغاز آتشین و هدف', 'لبخند سعادت و پشتوانه', 'دست توانا و کارایی',
  'درخشش و آفرینندگی', 'استقلال و هنر سخن', 'پیروزی و وسعت نظر', 'وفاداری و پیروزی بر دشمن',
  'بازرگانی و تیزی زبان', 'ریشه‌کنی و تولد دوباره', 'اعتقاد و قدرت آغاز', 'پشتوانه جاودان و مهر',
  'شنیدن و راه فرمان', 'ثروت و ریتم هزارگانه', 'پوشش نیک و رهایی', 'زادگاه شادمانی دوگانه',
  'پایان خوب و عمق', 'روشنایی و اراده نهایی',
]

// ─── ویمشوتاری دشا ───
export interface DashaPeriod {
  lord: string
  lordFa: string
  from: Date
  to: Date
  fromAge: number
  toAge: number
  jalaliFrom: string
  jalaliTo: string
}

const DASHA_YEAR_MS = 365.25 * DAY_MS

export function computeDasha(birth: Date, moonSidereal: number): DashaPeriod[] {
  const nakLen = 360 / 27
  const nak = Math.floor(norm360(moonSidereal) / nakLen)
  const lord = NAK_LORDS[nak % 9]
  const f = (norm360(moonSidereal) % nakLen) / nakLen
  const out: DashaPeriod[] = []
  let t = birth.getTime()
  let age = 0
  // دشای جاری از تولد: باقیمانده دشای مولد ناکشترا
  let remaining = DASHA_YEARS[lord] * (1 - f)
  let idx = NAK_LORDS.indexOf(lord)
  // تا ۱۲۰ سال کامل
  while (age < 120 && out.length < 12) {
    const years = remaining > 0 ? remaining : DASHA_YEARS[NAK_LORDS[idx % 9]]
    const curLord = NAK_LORDS[idx % 9]
    const from = new Date(t)
    const to = new Date(t + years * DASHA_YEAR_MS)
    const jf = utcToJalaliTehran(from)
    const jt = utcToJalaliTehran(to)
    out.push({
      lord: curLord,
      lordFa: DASHA_LORD_FA[curLord] ?? curLord,
      from, to,
      fromAge: age, toAge: age + years,
      jalaliFrom: `${jf.jy}/${String(jf.jm).padStart(2, '0')}`,
      jalaliTo: `${jt.jy}/${String(jt.jm).padStart(2, '0')}`,
    })
    t = to.getTime()
    age += years
    remaining = 0
    idx += 1
  }
  return out
}

/** دشای فعال در لحظه + آنتاردشا (زیردوره) */
export function dashaAt(periods: DashaPeriod[], date: Date): { maha: DashaPeriod | null; antar: DashaPeriod | null } {
  let maha: DashaPeriod | null = null
  for (const p of periods) {
    if (date >= p.from && date < p.to) {
      maha = p
      break
    }
  }
  if (!maha) return { maha: null, antar: null }
  // آنتاردشاها: از دشای مادر شروع، نسبت years/120
  const span = maha.to.getTime() - maha.from.getTime()
  const seq: DashaPeriod[] = []
  const startIdx = NAK_LORDS.indexOf(maha.lord)
  let t = maha.from.getTime()
  for (let i = 0; i < 9; i++) {
    const lord = NAK_LORDS[(startIdx + i) % 9]
    const len = (span * DASHA_YEARS[lord]) / 120
    const from = new Date(t)
    const to = new Date(t + len)
    const jf = utcToJalaliTehran(from)
    const jt = utcToJalaliTehran(to)
    seq.push({
      lord, lordFa: DASHA_LORD_FA[lord] ?? lord,
      from, to,
      fromAge: maha.fromAge + (t - maha.from.getTime()) / DASHA_YEAR_MS,
      toAge: maha.fromAge + (t + len - maha.from.getTime()) / DASHA_YEAR_MS,
      jalaliFrom: `${jf.jy}/${String(jf.jm).padStart(2, '0')}`,
      jalaliTo: `${jt.jy}/${String(jt.jm).padStart(2, '0')}`,
    })
    t += len
  }
  const antar = seq.find((p) => date >= p.from && date < p.to) ?? seq[seq.length - 1]
  return { maha, antar }
}

// ─── آیانمسا لاهیری (سیترین) ───
function ayanamsaLahiri(date: Date): number {
  const T = (date.getTime() / DAY_MS + 2440587.5 - 2451545.0) / 36525
  return 23.85319 + 1.396971 * T
}

// ─── ستارگان ثابت (طول بروج J2000 + پیش‌روان) ───
export interface FixedStarDef {
  key: string
  fa: string
  lon2000: number
  meaning: string
  royal: boolean
}
export const FIXED_STARS: FixedStarDef[] = [
  { key: 'alcyone', fa: 'سورایا (پلیادها)', lon2000: 60.0, meaning: 'دانش اسرارآمیز و اشک شیرین؛ درخشش جمعی', royal: false },
  { key: 'algol', fa: 'رأس‌الغول', lon2000: 56.17, meaning: 'شدیدترین ستاره؛ خطر ناگهانی و قدرت خام', royal: false },
  { key: 'aldebaran', fa: 'دَبَران', lon2000: 69.78, meaning: 'ستاره سلطنتی شرق؛ شکوه، عدالت و یکپارچگی', royal: true },
  { key: 'rigel', fa: 'ریجل', lon2000: 76.83, meaning: 'شکوه آموزش و ارتقای ناگهانی', royal: false },
  { key: 'capella', fa: 'کپلا (عایوق)', lon2000: 81.85, meaning: 'ذهن آزاد و حمایت مردمی', royal: false },
  { key: 'betelgeuse', fa: 'یَدالجوزا', lon2000: 88.75, meaning: 'جلال و ارتقای شغلی بزرگ', royal: false },
  { key: 'sirius', fa: 'شِباع (شعرای یمانی)', lon2000: 104.08, meaning: 'وفور، آتش و برآمدن از خاکستر', royal: false },
  { key: 'pollux', fa: 'رأس‌الثانی حوت', lon2000: 113.22, meaning: 'هنر و لذت با چاشنی ریسک', royal: false },
  { key: 'praesepe', fa: 'پیشانی اسد (محشر)', lon2000: 127.33, meaning: 'بینش غیبی و حساسیت شدید', royal: false },
  { key: 'regulus', fa: 'قلب‌الاسد (یما نیه)', lon2000: 149.83, meaning: 'سلطنتی شمال؛ برتری، موفقیت و خطر غرور', royal: true },
  { key: 'alphard', fa: 'فَردالشجاع', lon2000: 147.17, meaning: 'هوش ماری و دوری از آلودگی', royal: false },
  { key: 'zosma', fa: 'کمر اسد', lon2000: 161.23, meaning: 'کمک بی‌مانند در سخت‌ترین لحظه', royal: false },
  { key: 'vindemiatrix', fa: 'چچن سنبله', lon2000: 189.85, meaning: 'جمع‌آوری محصول و حافظه قوی', royal: false },
  { key: 'spica', fa: 'سماک اعزل (خوشه)', lon2000: 203.83, meaning: 'ستاره ثروت؛ موفقیت ذاتی', royal: false },
  { key: 'arcturus', fa: 'سماک رامح', lon2000: 204.23, meaning: 'حفاظت و ثروت از راه نوآوری', royal: false },
  { key: 'alphecca', fa: 'منکب سهیل', lon2000: 222.3, meaning: 'زیبایی، لطافت و عشق کبوتری', royal: false },
  { key: 'antares', fa: 'قلب‌العقرب', lon2000: 249.77, meaning: 'سلطنتی جنوب؛ شدت، شانس بزرگ با ریسک', royal: true },
  { key: 'vega', fa: 'نسر واقع', lon2000: 285.32, meaning: 'کمال‌گرایی، جذابیت و وقار', royal: false },
  { key: 'deneb_algedi', fa: 'ذنب جدی', lon2000: 323.55, meaning: 'خوش‌اقبالی که می‌افولد؛ ثبات در نوسان', royal: false },
  { key: 'fomalhaut', fa: 'فَم‌الحوت', lon2000: 333.87, meaning: 'سلطنتی غرب؛ رؤیای بزرگ و نجات', royal: true },
  { key: 'deneb_adige', fa: 'ذنب داجه', lon2000: 335.63, meaning: 'هنر و زبان پرفکر', royal: false },
  { key: 'markab', fa: 'منکب فرس', lon2000: 353.48, meaning: 'شوکت امارت با وسوسه تنهایی', royal: false },
  { key: 'hamal', fa: 'رأس الحمل', lon2000: 7.67, meaning: 'برنامه‌ریزی مستقل و سرسختی', royal: false },
]

function starLonNow(star: FixedStarDef, date: Date): number {
  const yrs = (date.getTime() / DAY_MS + 2440587.5 - 2451545.0) / 365.25
  return norm360(star.lon2000 + (yrs * 50.29) / 3600)
}

export interface StarContact {
  star: string
  meaning: string
  body: string
  bodyFa: string
  gap: number
  royal: boolean
}

export function starContacts(date: Date, positions: { body: string; lon: number }[]): StarContact[] {
  const out: StarContact[] = []
  for (const st of FIXED_STARS) {
    const sl = starLonNow(st, date)
    for (const p of positions) {
      const isLuminary = p.body === 'Sun' || p.body === 'Moon'
      const orb = isLuminary ? 2 : 1.5
      const gap = Math.abs(norm180(p.lon - sl))
      if (gap <= orb) {
        out.push({
          star: st.fa, meaning: st.meaning, body: p.body,
          bodyFa: PLANET_FA[p.body] ?? p.body, gap, royal: st.royal,
        })
      }
    }
  }
  return out
}

// ─── اعدادشناسی ───
function reduceNum(n: number): number {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split('').reduce((a, c) => a + Number(c), 0)
  }
  return n
}
export interface NumerologyInfo {
  lifePath: number
  lifePathFa: string
  personalYear: number
  personalYearFa: string
  birthNumber: number
}
const NUM_FA: Record<number, string> = {
  1: 'رهبر آغازگر — خورشید', 2: 'دیپلمات حساس — ماه', 3: 'خلاق خوش‌بیان — مشتری',
  4: 'سازنده منضبط — عطارد/زحل', 5: 'آزاد جست‌وجوگر — عطارد', 6: 'عاشق مسئول — زهره',
  7: 'عارف درون‌بین — کتو/نپتون', 8: 'مدیر قدرت — زحل', 9: 'بشردوست کامل‌گر — مریخ',
  11: 'عدد استاد شهود — راهو', 22: 'عدد استاد سازنده بزرگ — زحل', 33: 'عدد استاد معلم عشق — زهره',
}

// ─── چارت تولد غربی ───
export interface NatalPlanet {
  body: string
  fa: string
  glyph: string
  lon: number
  sign: number
  degText: string
  retro: boolean
  house: number
  dignity: string
}

export interface NatalAspect {
  a: string
  b: string
  aFa: string
  bFa: string
  aspect: string
  aspectFa: string
  orb: number
  hard: boolean
  tight: boolean
}

export interface WesternChart {
  planets: NatalPlanet[]
  asc: number
  mc: number
  ascSign: number
  ascText: string
  mcText: string
  aspects: NatalAspect[]
  sunSign: number
  moonSign: number
  elements: { fire: number; earth: number; air: number; water: number }
  modalities: { cardinal: number; fixed: number; mutable: number }
  dominantElement: string
  dominantModality: string
}

const WESTERN_BODIES: A.Body[] = [
  A.Body.Sun, A.Body.Moon, A.Body.Mercury, A.Body.Venus, A.Body.Mars,
  A.Body.Jupiter, A.Body.Saturn, A.Body.Uranus, A.Body.Neptune, A.Body.Pluto,
]

function wholeSignHouse(lon: number, ascLon: number): number {
  const s = Math.floor(norm360(lon) / 30)
  const ascSign = Math.floor(norm360(ascLon) / 30)
  return ((s - ascSign + 12) % 12) + 1
}

export function computeWestern(birth: Date, lat: number, lon: number): WesternChart {
  const { asc, mc } = ascendantMC(birth, lat, lon)
  const raw: { body: string; lon: number; retro: boolean }[] = []
  for (const b of WESTERN_BODIES) {
    raw.push({ body: b as string, lon: eclLon(b, birth), retro: isRetro(b, birth) })
  }
  raw.push({ body: 'Rahu', lon: trueNode(birth), retro: true })
  raw.push({ body: 'Ketu', lon: norm360(trueNode(birth) + 180), retro: true })

  const planets: NatalPlanet[] = raw.map((p) => {
    const sign = Math.floor(norm360(p.lon) / 30)
    return {
      body: p.body,
      fa: PLANET_FA[p.body] ?? p.body,
      glyph: PLANET_GLYPH[p.body] ?? '•',
      lon: p.lon,
      sign,
      degText: fmtDeg(p.lon),
      retro: p.retro,
      house: wholeSignHouse(p.lon, asc),
      dignity: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].includes(p.body)
        ? dignity(p.body, sign)
        : '',
    }
  })

  const aspectBodies = raw.filter((p) => p.body !== 'Rahu' && p.body !== 'Ketu')
  const aspects: NatalAspect[] = []
  for (let i = 0; i < aspectBodies.length; i++) {
    for (let j = i + 1; j < aspectBodies.length; j++) {
      const hit = findAspectDef(aspectBodies[i].lon, aspectBodies[j].lon)
      if (hit) {
        aspects.push({
          a: aspectBodies[i].body, b: aspectBodies[j].body,
          aFa: PLANET_FA[aspectBodies[i].body], bFa: PLANET_FA[aspectBodies[j].body],
          aspect: hit.aspect.key, aspectFa: ASPECT_FA[hit.aspect.key],
          orb: hit.orb, hard: hit.aspect.hard, tight: hit.orb < 2.5,
        })
      }
    }
  }
  aspects.sort((x, y) => x.orb - y.orb)

  const elements = { fire: 0, earth: 0, air: 0, water: 0 }
  const modalities = { cardinal: 0, fixed: 0, mutable: 0 }
  for (const p of planets) {
    if (!['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(p.body)) continue
    const w = p.body === 'Sun' || p.body === 'Moon' ? 2 : 1
    const el = Math.floor(p.sign / 3) // 0 آتش 1 خاک 2 هوا 3 آب
    const md = p.sign % 3 // 0 متحرک 1 ثابت 2 تغییرپذیر
    if (el === 0) elements.fire += w
    else if (el === 1) elements.earth += w
    else if (el === 2) elements.air += w
    else elements.water += w
    if (md === 0) modalities.cardinal += w
    else if (md === 1) modalities.fixed += w
    else modalities.mutable += w
  }
  const elNames = ['آتش', 'خاک', 'هوا', 'آب']
  const elVals = [elements.fire, elements.earth, elements.air, elements.water]
  const dominantElement = elNames[elVals.indexOf(Math.max(...elVals))]
  const mdNames = ['متحرک (کاردینال)', 'ثابت', 'تغییرپذیر']
  const mdVals = [modalities.cardinal, modalities.fixed, modalities.mutable]
  const dominantModality = mdNames[mdVals.indexOf(Math.max(...mdVals))]

  return {
    planets,
    asc, mc,
    ascSign: Math.floor(norm360(asc) / 30),
    ascText: fmtDeg(asc),
    mcText: fmtDeg(mc),
    aspects: aspects.slice(0, 14),
    sunSign: Math.floor(norm360(eclLon(A.Body.Sun, birth)) / 30),
    moonSign: Math.floor(norm360(eclLon(A.Body.Moon, birth)) / 30),
    elements, modalities, dominantElement, dominantModality,
  }
}

// ─── چارت ودیک ───
export interface VedicChart {
  ayanamsa: number
  planets: { body: string; fa: string; sidLon: number; sign: number; degText: string; nakshatra: number; nakshatraFa: string; pada: number; nakLordFa: string }[]
  moonNakshatra: number
  moonNakshatraFa: string
  moonPada: number
  moonNakTrait: string
  dasha: DashaPeriod[]
  currentMaha: string
  currentAntar: string
}

export function computeVedic(birth: Date, moonTropical: number): VedicChart {
  const ayan = ayanamsaLahiri(birth)
  const nakLen = 360 / 27
  const sidMoon = norm360(moonTropical - ayan)
  const nak = Math.floor(sidMoon / nakLen)
  const pada = Math.floor(((sidMoon % nakLen) / nakLen) * 4) + 1
  const bodies: A.Body[] = [
    A.Body.Sun, A.Body.Moon, A.Body.Mercury, A.Body.Venus, A.Body.Mars,
    A.Body.Jupiter, A.Body.Saturn, A.Body.Uranus, A.Body.Neptune, A.Body.Pluto,
  ]
  const raw: { body: string; lon: number }[] = bodies.map((b) => ({
    body: b as string, lon: eclLon(b, birth),
  }))
  raw.push({ body: 'Rahu', lon: trueNode(birth) })
  raw.push({ body: 'Ketu', lon: norm360(trueNode(birth) + 180) })
  const planets = raw.map((p) => {
    const sid = norm360(p.lon - ayan)
    const nk = Math.floor(sid / nakLen)
    return {
      body: p.body, fa: PLANET_FA[p.body] ?? p.body,
      sidLon: sid, sign: Math.floor(sid / 30), degText: fmtDeg(sid),
      nakshatra: nk, nakshatraFa: NAKSHATRA_FA[nk], pada: Math.floor(((sid % nakLen) / nakLen) * 4) + 1,
      nakLordFa: DASHA_LORD_FA[NAK_LORDS[nk % 9]] ?? '',
    }
  })
  const dasha = computeDasha(birth, sidMoon)
  const now = new Date()
  const { maha, antar } = dashaAt(dasha, now)
  return {
    ayanamsa: ayan,
    planets,
    moonNakshatra: nak,
    moonNakshatraFa: NAKSHATRA_FA[nak],
    moonPada: pada,
    moonNakTrait: NAK_TRAITS_FA[nak],
    dasha,
    currentMaha: maha ? `${maha.lordFa} (${maha.jalaliFrom} تا ${maha.jalaliTo})` : '',
    currentAntar: antar ? `${antar.lordFa} (تا ${antar.jalaliTo})` : '',
  }
}

// ─── چرخه زندگی — چهار منحنی (شغلی/عاطفی/مالی/احساسی) از تولد تا ۹۰ سالگی ───
export interface LifeCyclePoint {
  age: number
  career: number
  love: number
  money: number
  feelings: number
}
export interface LifeCycleBand {
  lordFa: string
  fromAge: number
  toAge: number
}
export interface LifeCycle {
  points: LifeCyclePoint[]
  bands: LifeCycleBand[]
  currentAge: number
  peakCareer: LifeCyclePoint
  peakLove: LifeCyclePoint
  peakMoney: LifeCyclePoint
  peakFeelings: LifeCyclePoint
  goldenAges: { age: number; note: string }[]
}

const DIM_NATURE: Record<string, { career: number; love: number; money: number; feelings: number }> = {
  Sun: { career: 0.9, love: 0.1, money: 0.2, feelings: 0.3 },
  Moon: { career: 0.0, love: 0.5, money: 0.2, feelings: 0.9 },
  Mercury: { career: 0.5, love: 0.2, money: 0.7, feelings: 0.2 },
  Venus: { career: 0.2, love: 1.0, money: 0.8, feelings: 0.5 },
  Mars: { career: 0.7, love: 0.3, money: 0.3, feelings: -0.4 },
  Jupiter: { career: 0.7, love: 0.3, money: 0.9, feelings: 0.6 },
  Saturn: { career: 0.5, love: -0.3, money: -0.1, feelings: -0.6 },
  Rahu: { career: 0.6, love: -0.2, money: 0.4, feelings: -0.5 },
  Ketu: { career: -0.2, love: -0.4, money: -0.3, feelings: 0.4 },
}

export function computeLifeCycle(
  birth: Date,
  dasha: DashaPeriod[],
  natal: WesternChart,
): LifeCycle {
  const natalLons: Record<string, number> = {}
  for (const p of natal.planets) natalLons[p.body] = p.lon
  const points: LifeCyclePoint[] = []
  const clamp = (v: number) => Math.max(6, Math.min(97, v))

  for (let i = 0; i <= 180; i++) {
    const age = i * 0.5
    const t = new Date(birth.getTime() + age * DASHA_YEAR_MS)
    const { maha, antar } = dashaAt(dasha, t)
    const scores = { career: 50, love: 50, money: 50, feelings: 50 }
    if (maha) {
      const nm = DIM_NATURE[maha.lord]
      if (nm) for (const k of ['career', 'love', 'money', 'feelings'] as const) scores[k] += nm[k] * 24
    }
    if (antar) {
      const na = DIM_NATURE[antar.lord]
      if (na) for (const k of ['career', 'love', 'money', 'feelings'] as const) scores[k] += na[k] * 13
    }
    // مدولاسیون ترانزیت کلان — زحل/مشتری/اورانوس بر خورشید و ماه تولد
    for (const [body, target] of [
      [A.Body.Saturn, 'Sun'], [A.Body.Saturn, 'Moon'],
      [A.Body.Jupiter, 'Sun'], [A.Body.Jupiter, 'Moon'], [A.Body.Jupiter, 'Venus'],
      [A.Body.Uranus, 'Sun'],
    ] as [A.Body, string][]) {
      if (!natalLons[target]) continue
      const hit = findAspectDef(eclLon(body, t), natalLons[target], 0.55) // مدار ~۴° — اثر پایدارتر بین نقاط
      if (!hit) continue
      const outer = body === A.Body.Saturn ? 'Saturn' : body === A.Body.Jupiter ? 'Jupiter' : 'Uranus'
      if (outer === 'Saturn') {
        if (hit.aspect.hard) { scores.feelings -= 9; scores.love -= 5; scores.career += 4; scores.money -= 2 }
        else { scores.career += 6; scores.feelings += 3 }
      } else if (outer === 'Jupiter') {
        if (hit.aspect.hard) { scores.money += 3; scores.love -= 2 }
        else { scores.money += 8; scores.feelings += 5; scores.love += 4; scores.career += 3 }
      } else {
        if (hit.aspect.hard) { scores.feelings -= 6; scores.career += 3 }
      }
    }
    // موج ظریف طبیعی زندگی
    scores.career += 3 * Math.sin(age * 0.7 + 1)
    scores.love += 3 * Math.sin(age * 0.55 + 2.4)
    scores.money += 3 * Math.sin(age * 0.62 + 4.1)
    scores.feelings += 3 * Math.sin(age * 0.5 + 0.6)
    points.push({
      age,
      career: Math.round(clamp(scores.career)),
      love: Math.round(clamp(scores.love)),
      money: Math.round(clamp(scores.money)),
      feelings: Math.round(clamp(scores.feelings)),
    })
  }

  // هموارسازی سه‌نقطه‌ای (پنجره ۲ ساله) — منحنی روان به سبک نمودارهای دوره‌های زندگی
  const smooth = (key: 'career' | 'love' | 'money' | 'feelings') => {
    const vals = points.map((p) => p[key])
    for (let i = 0; i < points.length; i++) {
      let sum = 0
      let n = 0
      for (let k = -2; k <= 2; k++) {
        const idx = i + k
        if (idx >= 0 && idx < vals.length) {
          sum += vals[idx]
          n += 1
        }
      }
      points[i][key] = Math.round(sum / n)
    }
  }
  smooth('career')
  smooth('love')
  smooth('money')
  smooth('feelings')

  const bands: LifeCycleBand[] = dasha
    .filter((d) => d.fromAge < 92)
    .map((d) => ({ lordFa: d.lordFa, fromAge: d.fromAge, toAge: d.toAge }))

  const best = (key: keyof LifeCyclePoint) => {
    let bestP = points[0]
    for (const p of points) if ((p[key] as number) > (bestP[key] as number)) bestP = p
    return bestP
  }
  const peakCareer = best('career')
  const peakLove = best('love')
  const peakMoney = best('money')
  const peakFeelings = best('feelings')

  // عصرهای طلایی: نقاط اوج هم‌افزایی چهار بعد
  const golden: { age: number; note: string }[] = []
  const ranked = [...points]
    .map((p) => ({ p, s: p.career + p.love + p.money + p.feelings }))
    .sort((a, b) => b.s - a.s)
  for (const r of ranked) {
    if (golden.length >= 3) break
    if (golden.every((g) => Math.abs(g.age - r.p.age) > 7) && r.p.age > 1)
      golden.push({ age: r.p.age, note: 'اوج هم‌افزایی چهار بعد زندگی' })
  }
  golden.sort((a, b) => a.age - b.age)

  const currentAge = (Date.now() - birth.getTime()) / DASHA_YEAR_MS

  return { points, bands, currentAge, peakCareer, peakLove, peakMoney, peakFeelings, goldenAges: golden }
}

// ─── شاخص زندگی (ایندکس ۰-۱۰۰) ───
export function lifeIndex(w: WesternChart): number {
  let s = 54
  for (const a of w.aspects) {
    const key = (p: string) => ['Sun', 'Moon', 'Venus', 'Jupiter'].includes(p)
    if (!(key(a.a) || key(a.b))) continue
    if (a.aspect === 'trine' || a.aspect === 'sextile') s += a.tight ? 2.2 : 1.3
    if (a.aspect === 'conj' && (a.a === 'Venus' || a.b === 'Venus' || a.a === 'Jupiter' || a.b === 'Jupiter')) s += 1.8
    if (a.aspect === 'square' || a.aspect === 'opp') s -= a.tight ? 1.6 : 0.9
  }
  for (const p of w.planets) {
    if (p.dignity === 'فرمانروا' || p.dignity === 'در اوج') s += 1.6
    if (p.dignity === 'در اذیت' || p.dignity === 'در هبوط') s -= 1.2
  }
  return Math.max(24, Math.min(97, Math.round(s)))
}

// ─── تحلیل کل ماه (سبک Xanastrology) ───
export interface SkyEvent {
  a: string
  b: string
  aFa: string
  bFa: string
  aspectFa: string
  exact: Date
  exactIso: string
  jalali: string
  windowDays: number // پنجره فعال ±N روز (سبک اخترشناسی: از ۷ روز قبل و بعد)
  hard: boolean
  passes: number // چندگذره (رجعی/مستقیم)
  weight: number
  note: string
}

export interface IngressEvent {
  bodyFa: string
  fromSign: number
  toSign: number
  at: Date
  jalali: string
}
export interface MoonPhaseEvent {
  kind: 'new' | 'full'
  at: Date
  jalali: string
  degree: string
  starContact?: string
}
export interface EclipseEvent {
  kind: 'solar' | 'lunar'
  at: Date
  jalali: string
  degree: string
  inMonth: boolean
  hits: string[]
}
export interface HistoricalAnalog {
  planetFa: string
  signFa: string
  windows: { from: string; to: string; note: string }[]
}
export interface NatalHit {
  bodyFa: string
  targetFa: string
  aspectFa: string
  hard: boolean
  exactIso: string
  jalali: string
  dim: 'career' | 'love' | 'money' | 'feelings'
}
export interface MonthScore {
  career: number
  love: number
  money: number
  feelings: number
  overall: number
}
export interface MonthForecast {
  label: string
  startIso: string
  endIso: string
  days: number
  heat: { day: number; score: number; note: string }[]
  skyEvents: SkyEvent[]
  ingresses: IngressEvent[]
  moonPhases: MoonPhaseEvent[]
  eclipses: EclipseEvent[]
  analogs: HistoricalAnalog[]
  natalHits: NatalHit[]
  retroInMonth: { bodyFa: string; kind: 'start' | 'end'; jalali: string }[]
  starsInMonth: { star: string; bodyFa: string; meaning: string; royal: boolean; jalali: string }[]
  scores: MonthScore
  dashaContext: string
  personalYear?: number
}

const SKY_BODIES: A.Body[] = [
  A.Body.Sun, A.Body.Moon, A.Body.Mercury, A.Body.Venus, A.Body.Mars,
  A.Body.Jupiter, A.Body.Saturn, A.Body.Uranus, A.Body.Neptune, A.Body.Pluto,
]

/** عبور دقیق نسبت طول دو جرم از زاویه جنبه — دوگانه‌بینی */
function refineCrossing(
  b1: A.Body, b2: A.Body, angle: number,
  lo: number, hi: number,
): Date | null {
  const f = (t: number) => {
    const l1 = eclLon(b1, new Date(t))
    const l2 = eclLon(b2, new Date(t))
    return norm180(l1 - l2 - angle)
  }
  let loT = lo, hiT = hi
  let fLo = f(loT)
  for (let i = 0; i < 22; i++) {
    const mid = (loT + hiT) / 2
    const fMid = f(mid)
    if (Math.abs(hiT - loT) < 60000) break
    if (Math.sign(fMid) === Math.sign(fLo)) { loT = mid; fLo = fMid } else { hiT = mid }
  }
  const at = new Date((loT + hiT) / 2)
  const fAt = f(at.getTime())
  return Math.abs(fAt) < 1.5 ? at : null
}

function jalaliOf(d: Date): string {
  const j = utcToJalaliTehran(d)
  return `${j.jd} ${jalaliMonthLabel(j.jy, j.jm).split(' ')[0]}`
}

const DIM_BY_PLANET: Record<string, { career: number; love: number; money: number; feelings: number }> = {
  Sun: { career: 0.5, love: 0.1, money: 0.2, feelings: 0.3 },
  Moon: { career: 0.1, love: 0.4, money: 0.2, feelings: 0.8 },
  Mercury: { career: 0.4, love: 0.2, money: 0.6, feelings: 0.2 },
  Venus: { career: 0.2, love: 0.9, money: 0.7, feelings: 0.5 },
  Mars: { career: 0.5, love: 0.3, money: 0.2, feelings: -0.5 },
  Jupiter: { career: 0.5, love: 0.3, money: 0.8, feelings: 0.5 },
  Saturn: { career: 0.4, love: -0.3, money: -0.2, feelings: -0.6 },
  Uranus: { career: 0.4, love: -0.2, money: 0.1, feelings: -0.5 },
  Neptune: { career: -0.2, love: 0.3, money: -0.3, feelings: -0.4 },
  Pluto: { career: 0.3, love: 0.2, money: 0.3, feelings: -0.6 },
}

// ─── یادداشت‌های تاریخی چرخه‌های معروف (سبک پست Xanastrology) ───
const ANALOG_NOTES: Record<string, string> = {
  'Uranus:2': 'دوره فناوری انقلابی، جنگ جهانی و جنبش‌های جوانان؛ در ایران مقارن قحطی و کمبود ۱۳۲۰-۱۳۲۴',
  'Uranus:9': 'دوره تغییرات ساختاری در نهادهای قدرت و شبکه‌های مالی',
  'Neptune:0': 'ذوب مرزها؛ ایدئولوژی‌های نو و سرریز انرژی جنگی/هنری',
  'Pluto:10': 'انقلاب فناوری و قدرت جمعی — عصر روشنایی شبکه‌ای؛ انقلاب‌های بزرگ (آمریکا/فرانسه)',
  'Pluto:0': 'بازتعریف خود و آغاز چرخه‌های ۲۴۸ ساله نهادها',
  'Saturn:11': 'بحران آب و مرزهای دریایی؛ بازسازی و انضباط معنوی',
  'Saturn:0': 'رکیزی ساختاری؛ آغاز چرخه ۲۹.۵ ساله نهادها',
  'Jupiter:3': 'تورم احساسی و رشد خانوادگی؛ ولخرجی ملی',
  'Uranus:8': 'اختلال شبکه‌ها و ارتباطات؛ جهش اطلاعات',
}

/** آخرین دوره‌های تکرار سیاره در برج — اسکن واقعی ephemeris تا ۱۶۰ سال پیش (کش‌شده) */
const analogCache = new Map<string, { from: number; to: number; note?: string }[]>()
function historicalAnalogs(body: A.Body, signIdx: number): { from: number; to: number; note?: string }[] {
  const key = `${body as string}:${signIdx}`
  const cached = analogCache.get(key)
  if (cached) return cached
  const out: { from: number; to: number; note?: string }[] = []
  const now = Date.now()
  const maxBack = now - 160 * 365.25 * DAY_MS
  let t = now
  let wasIn = Math.floor(eclLon(body, new Date(t)) / 30) === signIdx
  // اگر الان داخل برج هستیم، اول مرز ورود را پیدا کن (شروع پنجره جاری — ولی پنجره ناتمام است، پس صرف‌نظر)
  if (wasIn) {
    while (t > maxBack) {
      t -= DAY_MS
      const inNow = Math.floor(eclLon(body, new Date(t)) / 30) === signIdx
      if (!inNow) break
    }
  }
  // حالا پنجره‌های تکمیل‌شده قبلی
  while (out.length < 3 && t > maxBack) {
    t -= DAY_MS
    const inNow = Math.floor(eclLon(body, new Date(t)) / 30) === signIdx
    if (inNow && !wasIn) {
      // شروع یک پنجره — به عقب برو تا خروج
      const startT = t
      while (t > maxBack) {
        t -= DAY_MS
        if (Math.floor(eclLon(body, new Date(t)) / 30) !== signIdx) break
      }
      const endT = t + DAY_MS
      out.push({ from: endT, to: startT })
      wasIn = false
    } else {
      wasIn = inNow
    }
  }
  const annotated = out.map((w) => ({
    ...w,
    note: ANALOG_NOTES[`${body as string}:${signIdx}`],
  }))
  analogCache.set(key, annotated)
  return annotated
}

export interface NatalContext {
  birth: Date
  lat: number
  lon: number
  western: WesternChart
  vedic: VedicChart
  stars: StarContact[]
  numerology: NumerologyInfo
}

export function computeMonthForecast(
  jy: number,
  jm: number,
  natal?: NatalContext | null,
): MonthForecast {
  const { start, end } = jalaliMonthRange(jy, jm)
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS)
  const label = jalaliMonthLabel(jy, jm)
  const mid = new Date((start.getTime() + end.getTime()) / 2)
  const scanStart = start.getTime() - 8 * DAY_MS
  const scanEnd = end.getTime() + 8 * DAY_MS

  const skyEvents: SkyEvent[] = []

  // جنبه‌های آسمان-به-آسمان — اسکن روزانه + دوگانه‌بینی عبور صفر (ماه جداگانه در اطوار)
  for (let i = 0; i < SKY_BODIES.length; i++) {
    for (let j = i + 1; j < SKY_BODIES.length; j++) {
      const b1 = SKY_BODIES[i], b2 = SKY_BODIES[j]
      if (b1 === A.Body.Moon || b2 === A.Body.Moon) continue
      for (const asp of ASPECTS) {
        const f = (t: number) => {
          const l1 = eclLon(b1, new Date(t))
          const l2 = eclLon(b2, new Date(t))
          return norm180(l1 - l2 - asp.angle)
        }
        let prevT = scanStart
        let prevF = f(prevT)
        for (let t = scanStart + DAY_MS; t <= scanEnd; t += DAY_MS) {
          const curF = f(t)
          if (Math.abs(prevF) < 40 && Math.abs(curF) < 40 && Math.sign(prevF) !== Math.sign(curF)) {
            const exact = refineCrossing(b1, b2, asp.angle, prevT, t)
            if (exact && exact >= start && exact < end) {
              const relSpeed = Math.abs(
                rate(b1, exact) - rate(b2, exact),
              ) + 0.05
              const windowDays = Math.min(7, Math.max(1, Math.round(asp.orb / relSpeed)))
              const samePairSame = skyEvents.filter(
                (e) => e.a === b1 && e.b === b2 && e.aspectFa === ASPECT_FA[asp.key],
              )
              const near = samePairSame.find(
                (e) => Math.abs(e.exact.getTime() - exact.getTime()) < 45 * DAY_MS,
              )
              if (near) {
                near.passes += 1
                near.windowDays = Math.max(near.windowDays, windowDays)
              } else {
                const dims = {
                  ...(DIM_BY_PLANET[b1 as string] ?? {}),
                  ...(DIM_BY_PLANET[b2 as string] ?? {}),
                }
                const w = (asp.hard ? 8 : 6) + (['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(b1 as string) || ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(b2 as string) ? 4 : 0)
                skyEvents.push({
                  a: b1 as string, b: b2 as string,
                  aFa: PLANET_FA[b1 as string], bFa: PLANET_FA[b2 as string],
                  aspectFa: ASPECT_FA[asp.key],
                  exact, exactIso: exact.toISOString(),
                  jalali: jalaliOf(exact),
                  windowDays, hard: asp.hard, passes: 1,
                  weight: w,
                  note: `${PLANET_FA[b1]} ${ASPECT_FA[asp.key]} ${PLANET_FA[b2]} — ${jalaliOf(exact)} (پنجره فعال ±${windowDays} روز)`,
                })
              }
            }
          }
          prevT = t
          prevF = curF
        }
      }
    }
  }
  skyEvents.sort((a, b) => a.exact.getTime() - b.exact.getTime())

  // ورود به برج
  const ingresses: IngressEvent[] = []
  for (const b of [A.Body.Mercury, A.Body.Venus, A.Body.Mars, A.Body.Jupiter, A.Body.Saturn, A.Body.Uranus]) {
    let prevSign = Math.floor(eclLon(b, new Date(scanStart)) / 30)
    for (let t = scanStart + 6 * 3600000; t <= scanEnd; t += 6 * 3600000) {
      const s = Math.floor(eclLon(b, new Date(t)) / 30)
      if (s !== prevSign) {
        const at = new Date(t)
        if (at >= start && at < end) {
          ingresses.push({
            bodyFa: PLANET_FA[b as string], fromSign: prevSign, toSign: s,
            at, jalali: jalaliOf(at),
          })
        }
        prevSign = s
      }
    }
  }

  // اطوار ماه نو/کامل — SearchMoonPhase فقط Date می‌پذیرد و خودش AstroTime برمی‌گرداند
  const moonPhases: MoonPhaseEvent[] = []
  for (const target of [0, 180]) {
    let cursor = new Date(start.getTime() - 2 * DAY_MS)
    for (let i = 0; i < 3; i++) {
      const info = A.SearchMoonPhase(target, cursor, 40)
      if (!info) break
      const at = (info as unknown as A.AstroTime).date
      if (at.getTime() >= end.getTime() + 2 * DAY_MS) break
      if (at >= start && at < end) {
        const mlon = (A.EclipticGeoMoon(info as unknown as A.AstroTime) as unknown as { lon: number }).lon
        const contact = starContacts(at, [{ body: 'Moon', lon: mlon }])[0]
        moonPhases.push({
          kind: target === 0 ? 'new' : 'full', at,
          jalali: jalaliOf(at), degree: fmtDeg(mlon),
          starContact: contact ? `${contact.star} — ${contact.meaning}` : undefined,
        })
      }
      cursor = new Date(at.getTime() + DAY_MS)
    }
  }
  moonPhases.sort((a, b) => a.at.getTime() - b.at.getTime())

  // گرفتگی‌ها ±۶۰ روز — توجه: Search…Eclipse در این نسخه limit را نادیده می‌گیرد، خودمان فیلتر می‌کنیم
  const eclipses: EclipseEvent[] = []
  const eclFromT = start.getTime() - 60 * DAY_MS
  const eclToT = end.getTime() + 60 * DAY_MS
  let cursor: A.AstroTime = A.MakeTime(new Date(eclFromT))
  for (let i = 0; i < 6; i++) {
    const e = A.SearchGlobalSolarEclipse(cursor, A.MakeTime(new Date(eclToT)))
    if (!e) break
    const at = e.peak.date
    if (at.getTime() > eclToT) break
    if (at.getTime() >= eclFromT) {
      const hits: string[] = []
      if (natal) {
        for (const p of natal.western.planets) {
          const hit = findAspectDef(eclLon(A.Body.Sun, at), p.lon, 0.4) // مدار ~۲-۳°
          if (hit) hits.push(`${p.fa} تولد`)
        }
      }
      eclipses.push({
        kind: 'solar', at, jalali: jalaliOf(at),
        degree: fmtDeg(eclLon(A.Body.Sun, at)),
        inMonth: at >= start && at < end, hits,
      })
    }
    cursor = A.MakeTime(new Date(at.getTime() + 15 * DAY_MS))
  }
  cursor = A.MakeTime(new Date(eclFromT))
  for (let i = 0; i < 6; i++) {
    const e = A.SearchLunarEclipse(cursor, A.MakeTime(new Date(eclToT)))
    if (!e) break
    const at = e.peak.date
    if (at.getTime() > eclToT) break
    if (at.getTime() >= eclFromT) {
      const hits: string[] = []
      if (natal) {
        for (const p of natal.western.planets) {
          const hit = findAspectDef(eclLon(A.Body.Moon, at), p.lon, 0.4)
          if (hit) hits.push(`${p.fa} تولد`)
        }
      }
      eclipses.push({
        kind: 'lunar', at, jalali: jalaliOf(at),
        degree: fmtDeg(eclLon(A.Body.Moon, at)),
        inMonth: at >= start && at < end, hits,
      })
    }
    cursor = A.MakeTime(new Date(at.getTime() + 15 * DAY_MS))
  }
  eclipses.sort((a, b) => a.at.getTime() - b.at.getTime())

  // قیاس‌های تاریخی سیارات بیرونی در برجِ حاضر ماه
  const analogs: HistoricalAnalog[] = []
  for (const b of [A.Body.Jupiter, A.Body.Saturn, A.Body.Uranus, A.Body.Neptune, A.Body.Pluto]) {
    const signIdx = Math.floor(eclLon(b, mid) / 30)
    const windows = historicalAnalogs(b, signIdx).map((w) => ({
      from: `${gregorianToJalali(new Date(w.from).getUTCFullYear(), new Date(w.from).getUTCMonth() + 1, new Date(w.from).getUTCDate()).jy}`,
      to: `${gregorianToJalali(new Date(w.to).getUTCFullYear(), new Date(w.to).getUTCMonth() + 1, new Date(w.to).getUTCDate()).jy}`,
      note: w.note ?? '',
    }))
    analogs.push({
      planetFa: PLANET_FA[b as string],
      signFa: SIGNS_FA[signIdx],
      windows,
    })
  }

  // برخورد با چارت تولد (اگر چارت داده شده)
  const natalHits: NatalHit[] = []
  if (natal) {
    const targets: { body: string; lon: number; fa: string }[] = natal.western.planets.map((p) => ({
      body: p.body, lon: p.lon, fa: p.fa,
    }))
    targets.push({ body: 'ASC', lon: natal.western.asc, fa: 'طالع' })
    targets.push({ body: 'MC', lon: natal.western.mc, fa: 'میانه آسمان' })
    for (const b of SKY_BODIES) {
      if (b === A.Body.Moon) continue
      for (const tg of targets) {
        if (b === A.Body.Sun && tg.body === 'Sun') continue
        for (const asp of ASPECTS) {
          const f = (t: number) => {
            const l1 = eclLon(b, new Date(t))
            return norm180(l1 - tg.lon - asp.angle)
          }
          let prevT = scanStart
          let prevF = f(prevT)
          for (let t = scanStart + DAY_MS; t <= scanEnd; t += DAY_MS) {
            const curF = f(t)
            if (Math.abs(prevF) < 25 && Math.abs(curF) < 25 && Math.sign(prevF) !== Math.sign(curF)) {
              // refine مستقیم با هدف ثابت (natal point حرکت نمی‌کند)
              const exactFixed = ((): Date | null => {
                let loT = prevT, hiT = t
                let fLo = prevF
                for (let k = 0; k < 22; k++) {
                  const m = (loT + hiT) / 2
                  const fm = f(m)
                  if (Math.abs(hiT - loT) < 60000) break
                  if (Math.sign(fm) === Math.sign(fLo)) { loT = m; fLo = fm } else { hiT = m }
                }
                const at = new Date((loT + hiT) / 2)
                return Math.abs(f(at.getTime())) < 1.2 ? at : null
              })()
              if (exactFixed && exactFixed >= start && exactFixed < end) {
                const natalDim = DIM_BY_PLANET[b as string] ?? { career: 0, love: 0, money: 0, feelings: 0 }
                const targetDim = DIM_BY_PLANET[tg.body] ?? { career: 0.2, love: 0.2, money: 0.2, feelings: 0.2 }
                const dimKey = (['career', 'love', 'money', 'feelings'] as const).reduce((bestK, k) =>
                  Math.abs(natalDim[k] * targetDim[k]) > Math.abs(natalDim[bestK] * targetDim[bestK]) ? k : bestK,
                'feelings')
                natalHits.push({
                  bodyFa: PLANET_FA[b as string],
                  targetFa: tg.fa,
                  aspectFa: ASPECT_FA[asp.key],
                  hard: asp.hard,
                  exactIso: exactFixed.toISOString(),
                  jalali: jalaliOf(exactFixed),
                  dim: dimKey,
                })
              }
            }
            prevT = t
            prevF = curF
          }
        }
      }
    }
    natalHits.sort((a, b) => a.exactIso.localeCompare(b.exactIso))
  }

  // برگشتی‌ها در ماه
  const retroInMonth: MonthForecast['retroInMonth'] = []
  for (const b of [A.Body.Mercury, A.Body.Venus, A.Body.Mars, A.Body.Jupiter, A.Body.Saturn]) {
    let wasR = isRetro(b, new Date(scanStart))
    for (let t = scanStart + 6 * 3600000; t <= scanEnd; t += 6 * 3600000) {
      const r = isRetro(b, new Date(t))
      if (r !== wasR) {
        const at = new Date(t)
        if (at >= start && at < end) {
          retroInMonth.push({
            bodyFa: PLANET_FA[b as string],
            kind: r ? 'start' : 'end',
            jalali: jalaliOf(at),
          })
        }
        wasR = r
      }
    }
  }

  // ستارگان ثابت در ماه — مقارنه روز دقیق سیارات
  const starsInMonth: MonthForecast['starsInMonth'] = []
  for (let d = 0; d < days; d++) {
    const day = new Date(start.getTime() + d * DAY_MS + 12 * 3600000)
    const positions = SKY_BODIES.filter((b) => b !== A.Body.Moon).map((b) => ({
      body: b as string, lon: eclLon(b, day),
    }))
    const sunPos = [{ body: 'Sun', lon: eclLon(A.Body.Sun, day) }]
    const hits = starContacts(day, [...positions, ...sunPos])
    for (const h of hits) {
      if (starsInMonth.some((s) => s.star === h.star && s.bodyFa === h.bodyFa)) continue
      starsInMonth.push({
        star: h.star, bodyFa: h.bodyFa, meaning: h.meaning,
        royal: h.royal, jalali: jalaliOf(day),
      })
    }
  }

  // امتیازها
  const scores = { career: 50, love: 50, money: 50, feelings: 50 }
  for (const e of skyEvents) {
    const dims: (keyof typeof DIM_BY_PLANET.Sun)[] = []
    const d1 = DIM_BY_PLANET[e.a], d2 = DIM_BY_PLANET[e.b]
    for (const k of ['career', 'love', 'money', 'feelings'] as const) {
      const v = (d1?.[k] ?? 0) * (d2?.[k] ?? 0)
      if (Math.abs(v) > 0.09) dims.push(k)
    }
    for (const k of dims) {
      const impact = (e.hard ? -1 : 1) * e.weight * 0.55
      const sign = (d1?.[k] ?? 0) * (d2?.[k] ?? 0) >= 0 ? 1 : -1
      scores[k] += impact * sign
    }
  }
  for (const e of eclipses.filter((x) => x.inMonth)) {
    scores.feelings -= 6
    scores.career += 3
  }
  for (const r of retroInMonth) {
    if (r.bodyFa === 'عطارد' && r.kind === 'start') { scores.career -= 5; scores.money -= 3 }
    if (r.bodyFa === 'زهره' && r.kind === 'start') scores.love -= 8
    if (r.bodyFa === 'مریخ' && r.kind === 'start') { scores.career -= 3; scores.feelings -= 2 }
  }
  for (const h of natalHits) {
    scores[h.dim] += h.hard ? -5 : 5
  }
  for (const p of moonPhases) {
    if (p.kind === 'full') scores.feelings += 2
    else scores.feelings -= 1
  }
  const clampS = (v: number) => Math.max(8, Math.min(95, Math.round(v)))
  const finalScores: MonthScore = {
    career: clampS(scores.career),
    love: clampS(scores.love),
    money: clampS(scores.money),
    feelings: clampS(scores.feelings),
    overall: 0,
  }
  finalScores.overall = Math.round(
    (finalScores.career + finalScores.love + finalScores.money + finalScores.feelings) / 4,
  )

  // نقشه حرارتی روزانه
  const heat: MonthForecast['heat'] = []
  for (let d = 0; d < days; d++) {
    const day = start.getTime() + d * DAY_MS
    let s = 18 + 10 * Math.sin((d / days) * Math.PI * 2 + jm)
    for (const e of skyEvents) {
      const dist = Math.abs(e.exact.getTime() - day) / DAY_MS
      const sig = Math.max(1, e.windowDays)
      s += e.weight * Math.exp(-(dist * dist) / (2 * sig * sig)) * (e.hard ? 1.2 : 0.8)
    }
    for (const mp of moonPhases) {
      const dist = Math.abs(mp.at.getTime() - day) / DAY_MS
      s += 10 * Math.exp(-(dist * dist) / 4)
    }
    for (const e of eclipses.filter((x) => x.inMonth)) {
      const dist = Math.abs(e.at.getTime() - day) / DAY_MS
      s += 18 * Math.exp(-(dist * dist) / 6)
    }
    for (const h of natalHits) {
      const dist = Math.abs(new Date(h.exactIso).getTime() - day) / DAY_MS
      s += 8 * Math.exp(-(dist * dist) / 3)
    }
    heat.push({ day: d + 1, score: Math.max(5, Math.min(100, Math.round(s))), note: '' })
  }

  // بافت دشا + سال شخصی
  let dashaContext = ''
  let personalYear: number | undefined
  if (natal) {
    const { maha, antar } = dashaAt(natal.vedic.dasha, mid)
    if (maha && antar) {
      dashaContext = `دشای ماهار: ${maha.lordFa} (${maha.jalaliFrom}–${maha.jalaliTo}) — آنتاردشای جاری: ${antar.lordFa}`
    }
    const gStart = new Date(start)
    const gy = gStart.getUTCFullYear()
    const bj = utcToJalaliTehran(natal.birth)
    personalYear = reduceNum(
      Number(String(bj.jd).split('').reduce((a, c) => a + Number(c), 0)) +
      Number(String(bj.jm).split('').reduce((a, c) => a + Number(c), 0)) +
      String(gy).split('').reduce((a, c) => a + Number(c), 0),
    )
  }

  return {
    label, startIso: start.toISOString(), endIso: end.toISOString(), days,
    heat, skyEvents: skyEvents.slice(0, 18), ingresses,
    moonPhases, eclipses, analogs, natalHits: natalHits.slice(0, 14),
    retroInMonth, starsInMonth: starsInMonth.slice(0, 8), scores: finalScores, dashaContext,
    personalYear,
  }
}

// ─── ترکیب نهایی چارت تولد ───
export function computeNatalFull(
  birth: Date, lat: number, lon: number,
  gDate?: { gy: number; gm: number; gd: number },
): {
  western: WesternChart
  vedic: VedicChart
  stars: StarContact[]
  numerology: NumerologyInfo
  lifeCycle: LifeCycle
  index: number
} {
  const western = computeWestern(birth, lat, lon)
  const vedic = computeVedic(birth, eclLon(A.Body.Moon, birth))
  const stars = starContacts(birth, western.planets.map((p) => ({ body: p.body, lon: p.lon })))
  const g = gDate ?? {
    gy: birth.getUTCFullYear(),
    gm: birth.getUTCMonth() + 1,
    gd: birth.getUTCDate(),
  }
  const lifePath = reduceNum(
    String(g.gy).split('').reduce((a, c) => a + Number(c), 0) +
    String(g.gm).split('').reduce((a, c) => a + Number(c), 0) +
    String(g.gd).split('').reduce((a, c) => a + Number(c), 0),
  )
  const birthNumber = reduceNum(g.gd)
  const numerology: NumerologyInfo = {
    lifePath,
    lifePathFa: NUM_FA[lifePath] ?? `${lifePath}`,
    personalYear: 0,
    personalYearFa: '',
    birthNumber,
  }
  const lifeCycle = computeLifeCycle(birth, vedic.dasha, western)
  return {
    western, vedic, stars, numerology, lifeCycle,
    index: lifeIndex(western),
  }
}

// ─── متن‌های پیش‌فرض بدون هوش مصنوعی ───
export function natalFallbackText(w: WesternChart, vedic: VedicChart, index: number): string {
  const sun = w.planets.find((p) => p.body === 'Sun')
  const moon = w.planets.find((p) => p.body === 'Moon')
  return `خورشید در ${SIGNS_FA[w.sunSign]} و ماه در ${SIGNS_FA[w.moonSign]} و طالع ${SIGNS_FA[w.ascSign]} — هسته شخصیت تو ترکیبی از اراده ${SIGNS_FA[w.sunSign]}، نیازهای عاطفی ${SIGNS_FA[w.moonSign]} و نقاب اجتماعی ${SIGNS_FA[w.ascSign]} است. عنصر مسلط: ${w.dominantElement}. دوره جاری دشا: ${vedic.currentMaha}. شاخص کلی: ${index}.`
}
