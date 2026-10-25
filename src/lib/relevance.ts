// ─── فیلتر سخت‌گیرانه موضوعی: فقط و فقط جنگ و تنش ایران/آمریکا/اسرائیل/هرمز ───
// الزام کاربر: هیچ خبر دیگری (ورزش، سلبریتی، سیاست داخلی آمریکا، جنگ‌های دیگر،
// اقتصاد بدون ارتباط جنگی و...) نباید وارد سامانه شود.
// چندزبانه: انگلیسی / فارسی / عربی / فرانسوی (زبان‌های رایج منابع)

interface RelevanceResult {
  ok: boolean
  matched: string[]
}

/** حذف اعراب/اعلام لاتین + یکسان‌سازی نویسه‌ها برای تطبیق مطمئن */
function softNormalize(text: string): string {
  return text
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâä]/g, 'a')
    .replace(/[ùûü]/g, 'u')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ç]/g, 'c')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ىي]/g, 'ی')
    .replace(/[ۀه]/g, 'ه')
    .replace(/[ؤو]/g, 'و')
    .toLowerCase()
}

// ── بازیگران اصلی: هر خبر باید حداقل یکی از این‌ها را داشته باشد ──
// (تطبیق لاتین با مرز کلمه تا «us» داخل کلمات دیگر شمرده نشود)
const ACTOR_IRAN = [
  // فارسی
  'ایران', 'ایرانی', 'تهران', 'سپاه', 'انصارالله',
  // انگلیسی
  'iran', 'iranian', 'tehran', 'irgc', 'basij',
  // عربی
  'ایرانی', 'طهران',
  // فرانسوی
  'iranien',
]

const ACTOR_ISRAEL = [
  // فارسی
  'اسرائیل', 'اسراییل', 'صهیونیست', 'تل‌آویو', 'رژیم صهیونیستی',
  // انگلیسی
  'israel', 'israeli', 'idf', 'netanyahu', 'tel aviv', 'jerusalem',
  // عربی
  'اسرائیل', 'تل ابیب',
  // فرانسوی
  'israelien', 'tel-aviv',
]

const ACTOR_HORMUZ = [
  // هرمز به‌تنهایی کافی است — هر خبری درباره تنگه هرمز مرتبط است
  'هرمز', 'hormuz', 'hormoz', 'ormuz', 'هورمز',
]

const ACTOR_US = [
  // فارسی
  'آمریکا', 'امریکا', 'واشنگتن', 'پنتاگون', 'کاخ سفید', 'ترامپ',
  'ارتش آمریکا', 'نیروی هوایی آمریکا', 'سنتکام',
  // انگلیسی
  'united states', 'u.s.', 'us military', 'us air force', 'us navy', 'us troops',
  'washington', 'pentagon', 'centcom', 'trump', 'white house', 'the us', 'us strikes',
  'american', 'b-2', 'b-52', 'b52',
  // «us» تنها — فقط با مرز کلمه (جلوگیری از تطبیق داخل کلمات دیگر)
  'us',
  // عربی
  'امریکا', 'واشنطن', 'البنتاغون', 'ترامب',
  // فرانسوی
  'etats-unis', 'washington',
]

// ── زمینه خاورمیانه: اگر فقط «آمریکا» بازیگر است، باید زمینه منطقه‌ای هم باشد ──
// (تا اخبار داخلی آمریکا/جنگ اوکراین/اقتصاد کلان آمریکا وارد نشود)
const ME_CONTEXT = [
  // فارسی
  'خاورمیانه', 'خلیج فارس', 'خلیج', 'عراق', 'سوریه', 'یمن', 'حوثی',
  'دریای سرخ', 'غرب آسیا', 'لبنان', 'غزه', 'شبه‌جزیره', 'منطقه', 'اسلام‌آباد',
  // انگلیسی
  'middle east', 'persian gulf', 'the gulf', 'iraq', 'syria', 'yemen', 'houthi',
  'red sea', 'levant', 'gaza', 'lebanon', 'hezbollah', 'houthis', 'gulf region',
  'saudi', 'qatar', 'doha', 'uae', 'bahrain', 'kuwait', 'oman', 'muscat',
  // عربی
  'الشرق الاوسط', 'الخلیج', 'العراق', 'سوریا', 'الیمن', 'الحوثی', 'غزه', 'لبنان',
  'البحر الاحمر',
  // فرانسوی
  'moyen-orient', 'golfe persique',
]

// ── زمینه جنگ/تنش: خبر باید علاوه بر بازیگر، به درگیری مربوط باشد ──
const CONFLICT_CONTEXT = [
  // فارسی
  'جنگ', 'حمله', 'موشک', 'پهپاد', 'نظامی', 'ارتش', 'جنگنده', 'بمباران', 'ترور',
  'انفجار', 'نووه', 'هسته‌ای', 'هسته ای', 'غنی‌سازی', 'تحریم', 'تنش', 'تهاجم',
  'پدافند', 'سوخت‌رسان', 'ناو', 'ناوهواپیمابر', 'آماده‌باش', 'رزمایش', 'مانور',
  'تهدید', 'اولتیماتوم', 'آتش‌بس', 'توافق', 'مذاکره', 'دیپلمات', 'سردار', 'فرمانده',
  'ارتش', 'پهپادها', 'پرواز', 'بستن', 'تشکیل پرواز', 'شناسایی', 'تروریست',
  // انگلیسی
  'war', 'strike', 'strikes', 'attack', 'missile', 'drone', 'military', 'troops',
  'nuclear', 'enrichment', 'sanction', 'sanctions', 'tension', 'tensions',
  'invasion', 'airstrike', 'air strike', 'bomb', 'blast', 'explosion',
  'carrier', 'aircraft carrier', 'fighter', 'jet', 'jets', 'tanker', 'refuel',
  'air defense', 'defenses', 'intercept', 'alert', 'readiness', 'drill',
  'exercise', 'maneuver', 'threat', 'threaten', 'threatens', 'ultimatum',
  'ceasefire', 'truce', 'deal', 'talks', 'negotiation', 'negotiations',
  'diplomat', 'diplomacy', 'envoy', 'commander', 'general', 'quds', 'proxy',
  'escalation', 'escalate', 'mobiliz', 'deploy', 'deploys', 'deployment',
  'evacuat', 'shelter', 'airspace', 'flight', 'flights', 'airspace closed',
  'assassinat', 'killed', 'kills', 'casualt', 'launch', 'launches', 'fired',
  'target', 'targets', 'raid', 'operation', 'offensive', 'conflict',
  'hormuz threat', 'seizure', 'boarded', 'captured',
  // عربی
  'حرب', 'ضربة', 'هجوم', 'صاروخ', 'طيران مسيرة', 'عسكري', 'قصف', 'اغتيال',
  'انفجار', 'نووية', 'نووي', 'تخصيب', 'عقوبات', 'توتر', 'اجتياح', 'دفاع جوي',
  'حامل طائرات', 'تعبئة', 'مناورة', 'تهديد', 'هدنة', 'مفاوضات', 'دبلوماسي',
  'تصعيد', 'غارة', 'قوات', 'طائرات',
  // فرانسوی
  'guerre', 'frappe', 'missile', 'dron', 'militaire', 'nucleaire', 'sanction',
  'tension', 'attaque', 'bombardement', 'cessez-le-feu', 'negociation',
  'menace', 'porte-avions', 'defense antiaerienne',
]

// ── رد قطعی: موضوعات بی‌ربط رایج (حتی اگر کلمه جنگ در متن باشد) ──
const HARD_EXCLUDE = [
  'nfl', 'nba', 'nhl', 'mlb', 'soccer', 'football match', 'premier league',
  'world cup qualifier', 'tennis', 'boxing', 'ufc', 'olympics',
  'stock market today', 'earnings report', 'box office', 'movie review',
  'celebrity', 'grammys', 'oscars', 'lottery', 'horoscope',
]

// ── رد اخبار داخلی آمریکا: وقتی تنها بازیگر «آمریکاست» و خبری از ایران/اسرائیل/هرمز نیست ──
const US_ONLY_EXCLUDE = [
  'airline', 'airlines', 'passenger plane', 'weather', 'storm', 'hurricane',
  'mass shooting', 'police', 'mayor', 'governor', 'election', 'vote', 'voters',
  'congress', 'senate', 'impeach', 'inflation', 'tariff', 'trade deal',
  'supreme court', 'abortion', 'immigration border', 'nato', 'ukraine', 'russia',
  'zelensky', 'putin', 'kyiv', 'moscow', 'taiwan', 'china', 'beijing', 'north korea',
]

export interface RelevanceChecker {
  (title: string): RelevanceResult
}

// نرمال‌سازی واژه‌نامه‌ها یک‌بار در زمان بارگذاری (تا نیم‌فاصله/اعراب واژه‌ها هم منطبق شود)
const NORM = <T>(arr: T[]) => arr.map(softNormalize)
const ACTOR_IRAN_N = NORM(ACTOR_IRAN)
const ACTOR_ISRAEL_N = NORM(ACTOR_ISRAEL)
const ACTOR_HORMUZ_N = NORM(ACTOR_HORMUZ)
const ACTOR_US_N = NORM(ACTOR_US)
const ME_CONTEXT_N = NORM(ME_CONTEXT)
const CONFLICT_CONTEXT_N = NORM(CONFLICT_CONTEXT)
const HARD_EXCLUDE_N = NORM(HARD_EXCLUDE)
const US_ONLY_EXCLUDE_N = NORM(US_ONLY_EXCLUDE)

function hasAny(text: string, terms: string[], wordBoundary = false): string | null {
  for (const t of terms) {
    if (wordBoundary) {
      const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^\\p{L}\\p{N}])`, 'u')
      if (re.test(text)) return t
    } else if (text.includes(t)) {
      return t
    }
  }
  return null
}

/**
 * آیا این خبر به جنگ/تنش ایران-آمریکا-اسرائیل-هرمز مربوط است؟
 * قانون: بازیگر اصلی (ایران/اسرائیل/هرمز) + زمینه جنگی
 *        یا آمریکا + زمینه منطقه‌ای + زمینه جنگی
 * هرمز به‌تنهایی و بدون زمینه جنگی هم پذیرفته می‌شود.
 */
export function isRelevantNews(title: string): RelevanceResult {
  const text = softNormalize(title)
  if (!text || text.length < 10) return { ok: false, matched: [] }

  // رد قطعی موضوعات بی‌ربط
  const junk = hasAny(text, HARD_EXCLUDE_N)
  if (junk) return { ok: false, matched: [`junk:${junk}`] }

  const matched: string[] = []
  const hasIran = hasAny(text, ACTOR_IRAN_N)
  const hasIsrael = hasAny(text, ACTOR_ISRAEL_N)
  const hasHormuz = hasAny(text, ACTOR_HORMUZ_N)
  const hasUs = hasAny(text, ACTOR_US_N, true)
  const hasConflict = hasAny(text, CONFLICT_CONTEXT_N)
  // سنتکام/پنتاگون همیشه در بستر خاورمیانه‌اند — زمینه منطقه‌ای با آن‌ها محقق است
  const hasMe =
    hasAny(text, ME_CONTEXT_N) || hasUs === 'centcom' || hasUs === 'pentagon'

  if (hasIran) matched.push(`iran:${hasIran}`)
  if (hasIsrael) matched.push(`israel:${hasIsrael}`)
  if (hasHormuz) matched.push(`hormuz:${hasHormuz}`)
  if (hasUs) matched.push(`us:${hasUs}`)
  if (hasConflict) matched.push(`conflict:${hasConflict}`)
  if (hasMe) matched.push(`me:${hasMe}`)

  // هرمز → همیشه مرتبط
  if (hasHormuz) return { ok: true, matched }

  // ایران یا اسرائیل → باید زمینه جنگی داشته باشد
  if ((hasIran || hasIsrael) && hasConflict) return { ok: true, matched }

  // فقط آمریکا → باید زمینه خاورمیانه + زمینه جنگی داشته باشد؛
  // اخبار داخلی آمریکا (هواپیمایی، انتخابات، اوکراین/چین و...) رد می‌شود
  if (hasUs && hasMe && hasConflict) {
    const domestic = hasAny(text, US_ONLY_EXCLUDE_N)
    if (!domestic) return { ok: true, matched }
    return { ok: false, matched: [`us-domestic:${domestic}`] }
  }

  return { ok: false, matched }
}
