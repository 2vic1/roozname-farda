// ─── فیلتر موضوعی سخت: فقط جنگ/تنش ایران-آمریکا-اسرائیل-هرمز (الزام کاربر) ───
// پورت فشرده از src/lib/relevance.ts — چندزبانه: فارسی/انگلیسی/عربی/فرانسوی
import { softNormalize } from './util.js';

// بازیگران اصلی — خبر باید حداقل یکی را داشته باشد
const ACTOR_IRAN = ['ایران', 'ایرانی', 'تهران', 'سپاه', 'انصارالله', 'iran', 'iranian', 'tehran', 'irgc', 'basij', 'طهران', 'iranien'];
const ACTOR_ISRAEL = ['اسرائیل', 'اسراییل', 'صهیونیست', 'تل‌آویو', 'israel', 'israeli', 'idf', 'netanyahu', 'tel aviv', 'jerusalem', 'تل ابیب', 'israelien', 'tel-aviv'];
const ACTOR_HORMUZ = ['هرمز', 'hormuz', 'hormoz', 'ormuz', 'هورمز'];
const ACTOR_US = [
  'آمریکا', 'امریکا', 'واشنگتن', 'پنتاگون', 'کاخ سفید', 'ترامپ', 'سنتکام',
  'united states', 'u.s.', 'us military', 'us air force', 'us navy', 'us troops',
  'washington', 'pentagon', 'centcom', 'trump', 'white house', 'the us', 'us strikes',
  'american', 'b-2', 'b-52', 'b52', 'امریکا', 'واشنطن', 'ترامب', 'etats-unis',
];

// زمینه خاورمیانه + زمینه جنگی (برای خبرهای «فقط آمریکا»)
const ME_CONTEXT = ['خاورمیانه', 'خلیج فارس', 'خلیج', 'عراق', 'سوریه', 'یمن', 'حوثی', 'دریای سرخ', 'لبنان', 'غزه', 'منطقه', 'middle east', 'persian gulf', 'the gulf', 'iraq', 'syria', 'yemen', 'houthi', 'red sea', 'lebanon', 'gaza', 'centcom', 'persian gulf', 'الخلیج', 'الشرق الاوسط', 'العراق', 'سوریا', 'اليمن', 'الحوثي', 'البحر الاحمر', 'غزه', 'لبنان'];
const CONFLICT_CONTEXT = [
  'جنگ', 'حمله', 'حملات', 'تهاجم', 'جنگنده', 'بمباردمان', 'موشک', 'پهپاد', 'رزمایش', 'درگیری', 'تنش', 'بحران', 'تهدید', 'آتش‌بس', 'ترور', 'انفجار', 'هسته‌ای', 'غنی‌سازی', 'تحریم', 'نبرد', 'اعلامیه جنگی', 'شلیک',
  'war', 'attack', 'strike', 'strikes', 'airstrike', 'invasion', 'fighter', 'jet', 'bomber', 'missile', 'drone', 'drills', 'clash', 'tension', 'crisis', 'threat', 'ceasefire', 'assassination', 'explosion', 'nuclear', 'enrichment', 'sanctions', 'battle', 'military', 'bombed', 'shelling', 'escalation', 'retaliation',
  'حرب', 'هجوم', 'ضربة', 'غارة', 'صاروخ', 'طائرة مسيرة', 'توتر', 'أزمة', 'تهديد', 'هدنة', 'اغتيال', 'انفجار', 'نووي', 'تسليح', 'عسكري',
  'guerre', 'attaque', 'frappe', 'missile', 'tension', 'nucleaire', 'menace',
];

// حذف سخت: موضوعات داخلی آمریکا/جنگ‌های دیگر — حتی اگر «us» داشته باشند
const US_ONLY_EXCLUDE = [
  'election', 'elections', 'vote', 'senate', 'congress bill', 'mayor', 'governor',
  'nfl', 'nba', 'movie', 'box office', 'celebrity', 'weather forecast',
  'ukraine', 'zelensky', 'kyiv', 'russia', 'putin', 'moscow', 'russian',
  'china', 'taiwan', 'beijing', 'north korea', 'kim jong',
  'ukraine war', 'ukrainian', 'افغانستان', 'افغانستان',
];

function hasAny(normTitle, list, wordBoundary = false) {
  for (const w of list) {
    const wn = softNormalize(w);
    if (!wn) continue;
    if (wordBoundary) {
      const re = new RegExp(`(^|[^a-z0-9])${wn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`);
      if (re.test(normTitle)) return true;
    } else if (normTitle.includes(wn)) {
      return true;
    }
  }
  return false;
}

/**
 * تصمیم مرتبطیت — پورت منطق اپ وب:
 * هرمز → همیشه پاس؛ ایران/اسرائیل → باید زمینه جنگی باشد؛
 * آمریکا (بدون ایران/اسرائیل) → زمینه منطقه‌ای + جنگی، و شامل حذف‌شدنی‌ها نباشد
 */
export function isRelevantNews(title) {
  const n = softNormalize(title);
  const matched = [];

  const iran = hasAny(n, ACTOR_IRAN);
  const israel = hasAny(n, ACTOR_ISRAEL);
  const hormuz = hasAny(n, ACTOR_HORMUZ);
  const us = hasAny(n, ACTOR_US, true);
  const me = hasAny(n, ME_CONTEXT);
  const conflict = hasAny(n, CONFLICT_CONTEXT);
  const excluded = hasAny(n, US_ONLY_EXCLUDE);

  if (excluded) return { ok: false, matched: [] };
  if (hormuz) matched.push('هرمز');
  else {
    if (iran) matched.push('ایران');
    if (israel) matched.push('اسرائیل');
    if (!iran && !israel) {
      if (!us) return { ok: false, matched: [] };
      if (!me || !conflict) return { ok: false, matched: [] };
      matched.push('آمریکا+منطقه');
    }
    if (!conflict && (iran || israel) && !hormuz) return { ok: false, matched: [] };
  }
  if (conflict) matched.push('زمینه جنگی');
  return { ok: true, matched };
}

/** امتیاز تنش 0..100 (پورت v1 از scoreTension — کلمات کلیدی × وزن منبع) */
const UP = [
  ['حمله', 18], ['strike', 18], ['airstrike', 20], ['attaque', 18],
  ['جنگ', 25], ['war', 25], ['guerre', 25], ['حرب', 25],
  ['موشک', 16], ['missile', 16], ['صاروخ', 16],
  ['جنگنده', 14], ['fighter', 14], ['bomber', 20], ['b-2', 22], ['b-52', 22],
  ['پهپاد', 12], ['drone', 12], ['مسيرة', 12],
  ['هسته‌ای', 15], ['nuclear', 15], ['نووي', 15], ['غنی‌سازی', 14], ['enrichment', 14],
  ['تهدید', 12], ['threat', 12], ['تهديد', 12], ['ultimatum', 15],
  ['رزمایش', 10], ['drills', 10],
  ['هرمز', 20], ['hormuz', 20],
  ['تحریم', 10], ['sanctions', 10],
  ['بمباران', 16], ['bombed', 16], ['انفجار', 14], ['explosion', 14],
  ['ترور', 20], ['assassination', 20], ['اغتيال', 20],
  ['درگیری', 12], ['clash', 12], ['شلیک', 12], ['shelling', 14],
  ['retaliation', 18], ['escalation', 16], ['alerts', 15], ['موشک بالستیک', 20],
];
const DOWN = [
  ['آتش‌بس', -12], ['ceasefire', -12], ['توافق', -8], ['deal', -8],
  ['مذاکره', -10], ['talks', -8], ['negotiation', -10], ['diplomat', -6],
];

export function scoreTension(title, sourceWeight = 1) {
  const n = softNormalize(title);
  let s = 18; // پایه
  for (const [w, v] of UP) if (n.includes(softNormalize(w))) s += v;
  for (const [w, v] of DOWN) if (n.includes(softNormalize(w))) s += v;
  s *= sourceWeight;
  return Math.max(0, Math.min(100, Math.round(s)));
}
