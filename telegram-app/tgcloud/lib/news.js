// ─── اخبار: گردش منابع RSS + فیلتر موضوعی + حذف تکراری (پورت از runNewsTick) ───
import { fetchText, stripTags, ymd, addDays } from './util.js';
import { isRelevantNews, scoreTension } from './relevance.js';

// منابع v1 — همان RSSهای فعال اپ وب (X/اینستاگرام فاز بعد با پورت fetchers)
export const SOURCES = [
  { type: 'rss', handle: 'https://moxie.foxnews.com/google-publisher/latest.xml', label: 'Fox News', lang: 'en', weight: 1.3 },
  { type: 'rss', handle: 'https://news.google.com/rss/search?q=when:2d+site:nbcnews.com+(iran+OR+israel+OR+hormuz+OR+strike)&hl=en-US&gl=US&ceid=US:en', label: 'NBC (فیلتر ایران)', lang: 'en', weight: 1.3 },
  { type: 'rss', handle: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', label: 'NYT World', lang: 'en', weight: 1.3 },
  { type: 'rss', handle: 'https://news.google.com/rss/search?q=when:2d+site:reuters.com+(iran+OR+israel+OR+hormuz+OR+oil+OR+strike)&hl=en-US&gl=US&ceid=US:en', label: 'Reuters (فیلتر ایران)', lang: 'en', weight: 1.4 },
  { type: 'rss', handle: 'https://news.google.com/rss/search?q=when:2d+site:apnews.com+(iran+OR+israel+OR+hormuz+OR+oil+OR+strike)&hl=en-US&gl=US&ceid=US:en', label: 'AP News (فیلتر ایران)', lang: 'en', weight: 1.4 },
];

const BATCH = 4; // سبک‌تر از اپ وب — هر تیک ۴ منبع

// ── RSS خوان (پورت از fetchRss) ──
async function fetchRss(url, limit = 12) {
  const xml = await fetchText(url);
  const chunks = xml.split(/<item[\s>]|<entry[\s>]/).slice(1);
  const items = [];
  for (const c of chunks) {
    const title =
      stripTags(c.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? '');
    const link =
      c.match(/<link[^>]*href="([^"]+)"/)?.[1] ??
      stripTags(c.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)?.[1] ?? '');
    const pubRaw =
      c.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ??
      c.match(/<updated>([\s\S]*?)<\/updated>/)?.[1] ?? '';
    const publishedAt = pubRaw ? new Date(pubRaw) : new Date();
    if (!title || title.length < 12 || isNaN(publishedAt.getTime())) continue;
    items.push({ title, url: link || null, publishedAt });
    if (items.length >= limit) break;
  }
  return items;
}

// ── تلگرام عمومی (پورت از fetchTelegram — t.me/s/) ──
async function fetchTelegramPublic(handle, limit = 12) {
  const html = await fetchText(`https://t.me/s/${handle}`);
  const blocks = html.split('class="tgme_widget_message ').slice(1);
  const items = [];
  for (const b of blocks) {
    const postId = b.match(/data-post="\/([^"]+)"/)?.[1];
    const iso = b.match(/<time datetime="([^"]+)"/)?.[1];
    const textHtml = b.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)?.[1];
    if (!textHtml) continue;
    const title = stripTags(textHtml);
    if (title.length < 12) continue;
    items.push({
      title,
      url: postId ? `https://t.me/${postId}` : null,
      publishedAt: iso ? new Date(iso) : new Date(),
    });
    if (items.length >= limit) break;
  }
  return items;
}

async function fetchSourceItems(type, handle) {
  if (type === 'telegram') return fetchTelegramPublic(handle);
  return fetchRss(handle);
}

/** یک تیک: ۴ منبع چرخشی → فیلتر → ذخیره؛ اندیس چرخش در setting ذخیره میشود */
export async function newsTick(db, tables) {
  const { newsItem, setting } = tables;
  const { eq, inArray, gte, and, ne, desc } = await import('sdk/db');

  const idxRow = await db.select().from(setting).where(eq(setting.key, 'news_idx')).get();
  const idx = idxRow ? parseInt(idxRow.value, 10) % SOURCES.length : 0;
  const batch = Array.from({ length: Math.min(BATCH, SOURCES.length) }, (_, i) => SOURCES[(idx + i) % SOURCES.length]);
  await db
    .insert(setting)
    .values({ key: 'news_idx', value: String((idx + batch.length) % SOURCES.length) })
    .onConflictDoUpdate({ target: setting.key, set: { value: String((idx + batch.length) % SOURCES.length) } })
    .run();

  const cutoff = addDays(new Date(), -10);
  let added = 0;
  const touchedSources = [];

  await Promise.allSettled(
    batch.map(async (s) => {
      try {
        const raw = await fetchSourceItems(s.type, s.handle);
        const fresh = raw.filter((r) => r.publishedAt >= cutoff);
        const relevant = fresh.filter((r) => isRelevantNews(r.title).ok);
        if (!relevant.length) return;
        const ids = relevant.map((r) => `${s.type}:${s.handle}:${(r.url ?? '').split('/').pop() || r.title.slice(0, 120)}`);
        const existing = await db
          .select({ externalId: newsItem.externalId })
          .from(newsItem)
          .where(inArray(newsItem.externalId, ids))
          .all();
        const have = new Set(existing.map((e) => e.externalId));
        const seen = new Set();
        const rows = relevant
          .map((r, i) => ({ r, id: ids[i] }))
          .filter(({ id }) => (seen.has(id) || have.has(id) ? false : (seen.add(id), true)))
          .map(({ r, id }) => ({
            externalId: id,
            sourceType: s.type,
            sourceLabel: s.label,
            title: r.title.slice(0, 900),
            url: r.url,
            lang: s.lang,
            publishedAt: r.publishedAt,
            tensionScore: scoreTension(r.title, s.weight),
          }));
        if (rows.length) {
          await db.insert(newsItem).values(rows).run();
          added += rows.length;
          touchedSources.push(s.label);
        }
      } catch {
        // منبع در دسترس نبود — دور بعد دوباره
      }
    })
  );
  return { added, sources: batch.map((b) => b.label), touchedSources };
}
