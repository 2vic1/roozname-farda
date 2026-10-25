// ─── موتور امتیازدهی تنش خبری ───
// واژه‌نامه چندزبانه: فارسی / انگلیسی / عربی
// خروجی: امتیاز 0..100 + سطح + کلیدواژه‌های شناسایی‌شده

type Category = 'critical' | 'high' | 'medium' | 'deescalation'

const LEXICON: Record<Category, string[]> = {
  critical: [
    // فارسی
    'حمله موشکی', 'حمله هوایی', 'حمله پهپادی', 'حمله نظامی', 'ترور', 'انفجار بزرگ',
    'بمباران', 'تهاجم', 'شروع جنگ', 'وارد جنگ', 'جنگ تمام‌عیار', 'حمله گسترده',
    'پاسخ نظامی', 'درگیری مسلحانه', 'شلیک موشک', 'حمله به تاسیسات', 'ناوگان آمریکا',
    // انگلیسی
    'airstrike', 'air strike', 'missile strike', 'missile attack', 'drone attack',
    'drone strike', 'assassination', 'bombardment', 'invasion', 'war breaks out',
    'full-scale war', 'military strike', 'strikes on iran', 'strikes on israel',
    'missile launch', 'attacked', 'war begins', 'strikes', 'missiles fired',
    // عربی
    'ضربة جوية', 'هجوم صاروخي', 'اغتيال', 'قصف', 'اجتياح', 'انفجار', 'حرب شاملة',
  ],
  high: [
    // فارسی
    'بسیج', 'آماده‌باش', 'رزمایش', 'مانور نظامی', 'غنی‌سازی', 'سلاح هسته‌ای',
    'اولتیماتوم', 'تشدید', 'قطع پرواز', 'لغو پروازها', 'تنگه هرمز', 'بستن هرمز',
    'ناو هواپیمابر', 'اعزام نیرو', 'پدافند', 'تحرکات نظامی', 'جنگنده', 'زیردریایی',
    'وضعیت جنگی', 'تخلیه', 'پناهگاه', 'ذخایر استراتژیک', 'حمله سایبری',
    // انگلیسی
    'mobilization', 'military drill', 'military exercise', 'ultimatum',
    'nuclear weapon', 'enrichment', 'aircraft carrier', 'no-fly', 'strait of hormuz',
    'hormuz', 'deployment', 'troops deploy', 'fighter jets', 'submarine',
    'air defense', 'heightened alert', 'evacuat', 'martial law', 'bunker',
    'military buildup', 'war footing', 'readiness', 'warplane', 'intercept',
    // عربی
    'تعبئة', 'مناورة', 'إنذار', 'نووية', 'تهديد', 'حامل طائرات', 'مضيق هرمز',
  ],
  medium: [
    // فارسی
    'مذاکره', 'مذاکرات', 'دیپلمات', 'تحریم', 'هشدار', 'تنش', 'جلسه اضطراری',
    'پرواز لغو', 'بازرسی', 'آژانس بین‌المللی', 'شورای امنیت', 'بیانیه', 'پرتاب موشک آزمایشی',
    'تجهیزات نظامی', 'بازداشت', 'رایزنی', 'نشست',
    // انگلیسی
    'sanction', 'negotiation', 'talks', 'diplomacy', 'diplomat', 'warning',
    'emergency meeting', 'iaea', 'un security council', 'flights cancel',
    'joint statement', 'envoy', 'tensions', 'escalation', 'drill', 'missile test',
    'detain', 'summit', 'statement',
    // عربی
    'مفاوضات', 'عقوبات', 'تحذير', 'توتر', 'اجتماع طارئ',
  ],
  deescalation: [
    // فارسی
    'آتش‌بس', 'توافق', 'کاهش تنش', 'آرامش', 'گفتگو', 'برجام', 'حل دیپلماتیک',
    'توافقنامه', 'عقب‌نشینی',
    // انگلیسی
    'ceasefire', 'de-escalation', 'deescalation', 'peace agreement', 'truce',
    'deal reached', 'agreement', 'diplomatic solution', 'talks resume',
    'prisoner exchange', 'compromise',
    // عربی
    'وقف إطلاق النار', 'هدنة', 'اتفاق', 'حل دبلوماسي',
  ],
}

const CATEGORY_BASE: Record<Category, number> = {
  critical: 72,
  high: 44,
  medium: 16,
  deescalation: 0,
}

export interface TensionResult {
  score: number
  level: 'calm' | 'watch' | 'elevated' | 'high' | 'critical'
  keywords: string[]
}

export function levelFromScore(score: number): TensionResult['level'] {
  if (score >= 75) return 'critical'
  if (score >= 55) return 'high'
  if (score >= 35) return 'elevated'
  if (score >= 15) return 'watch'
  return 'calm'
}

export function normalize(text: string): string {
  return text
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function scoreTension(title: string, sourceWeight = 1): TensionResult {
  const text = normalize(title)
  const matched: string[] = []
  let score = 0
  let hits = { critical: 0, high: 0, medium: 0 }

  for (const cat of ['critical', 'high', 'medium'] as Category[]) {
    for (const term of LEXICON[cat]) {
      if (text.includes(term.toLowerCase())) {
        matched.push(term)
        hits[cat]++
      }
    }
  }

  // سطح غالب + انباشت
  if (hits.critical > 0) score = CATEGORY_BASE.critical
  else if (hits.high > 0) score = CATEGORY_BASE.high
  else if (hits.medium > 0) score = CATEGORY_BASE.medium

  score += hits.critical * 9 + hits.high * 5 + hits.medium * 2

  // تخفیف برای شواهد کاهش تنش
  let deesc = 0
  for (const term of LEXICON.deescalation) {
    if (text.includes(term.toLowerCase())) deesc++
  }
  if (deesc > 0 && hits.critical === 0) score -= 32

  // ضریب اعتبار منبع
  const w = Math.min(1.4, Math.max(0.6, sourceWeight))
  score *= w

  score = Math.max(0, Math.min(100, Math.round(score)))
  return { score, level: levelFromScore(score), keywords: matched.slice(0, 8) }
}
