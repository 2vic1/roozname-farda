// ─── تشخیص زبان متن بر اساس نویسه‌ها (سبک، بدون هوش مصنوعی) ───
// چرا لازم است: زبان منبع خبری هاردکد است ولی یک کانال «فارسی» ممکن است عربی/چینی/انگلیسی پست کند.
// راه‌حل: زبان هر خبر از روی متن واقعی‌اش تشخیص داده می‌شود تا ترجمه فارسی هیچ‌وقت جا نیفتد.
// این ماژول باید خالص باشد (بدون import سرور) تا در کلاینت هم قابل استفاده باشد.

// پ چ ژ گ ک ی — نویسه‌هایی که فقط در فارسی به‌کار می‌روند، نه در عربی
const PERSIAN_SPECIFIC = /[\u067E\u0686\u0698\u06AF\u06A9\u06CC]/g
// بلوک‌های عربی/فارسی/فارسی‌های الحاقی
const ARABIC_BLOCK = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g

export function detectLang(text: string): string {
  const t = text ?? ''
  if (!t.trim()) return 'en'
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(t)) return 'zh' // چینی
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(t)) return 'ja' // ژاپنی
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(t)) return 'ko' // کره‌ای
  if (/[\u0400-\u04FF]/.test(t)) return 'ru' // روسی/سیریلیک
  if (/[\u0590-\u05FF]/.test(t)) return 'he' // عبری
  const arabicChars = t.match(ARABIC_BLOCK)
  if (!arabicChars || arabicChars.length === 0) return 'en' // لاتین و بقیه
  const persianChars = t.match(PERSIAN_SPECIFIC)
  // در متن فارسی «ی» و «ک» بسیار پرتکرارند؛ در عربی تقریباً صفرند
  const ratio = (persianChars?.length ?? 0) / arabicChars.length
  return ratio >= 0.05 ? 'fa' : 'ar'
}

// آیا این متن برای خواننده فارسی‌زبان ناخواناست و باید ترجمه شود؟
export function needsFa(text: string): boolean {
  return detectLang(text) !== 'fa'
}
