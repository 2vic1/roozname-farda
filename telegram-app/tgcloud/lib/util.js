// ─── ابزارهای مشترک (پورت از src/lib) — JS خالص، بدون هیچ وابستگی ───

/** دریافت متن با timeout — outbound HTTP در tgcloud با fetch استاندارد */
export async function fetchText(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WarRiskBot/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/** POST JSON (برای scanner تریدینگ‌ویو و API هوش مصنوعی) */
export async function fetchJsonPost(url, body, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** حذف تگ‌های HTML */
export function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** نرمال‌سازی نرم برای تطبیق چندزبانه (پورت از relevance.ts) */
export function softNormalize(text) {
  return String(text)
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
    .toLowerCase();
}

// ── تبدیل میلادی → جلالی (الگوریتم استاندارد فشرده) ──
const div = (a, b) => Math.floor(a / b);

export function toJalali(date) {
  const gy = date.getUTCFullYear();
  const gm = date.getUTCMonth() + 1;
  const gd = date.getUTCDate();
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gm > 2 ? gy - (gy <= 1600 ? 621 : 1600) + 1 : gy - (gy <= 1600 ? 621 : 1600);
  let days =
    365 * (gy - (gy <= 1600 ? 621 : 1600)) +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

const JMONTHS_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

/** تاریخ جلالی خوانا: «۵ آبان ۱۴۰۵» */
export function jalaliFa(date) {
  const { jy, jm, jd } = toJalali(date);
  return `${faNum(jd)} ${JMONTHS_FA[jm - 1]} ${faNum(jy)}`;
}

/** YYYY-MM-DD (UTC) */
export function ymd(date) {
  return date.toISOString().slice(0, 10);
}

/** افزودن n روز */
export function addDays(date, n) {
  return new Date(date.getTime() + n * 86400000);
}

/** ارقام فارسی */
export function faNum(n) {
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  return String(n).replace(/\d/g, (d) => fa[Number(d)]);
}
