// ─── Roozname Farda (روزنامه فردا) Telegram Bot — VPS entry (long-polling + scheduled tick) ───
// Uses the tgcloud business modules unchanged via the 'sdk' shim (node_modules/sdk).
import { db, api, ensureSchema, botTokenReady } from 'sdk';

const LOG = (tag, ...rest) =>
  console.log(`[${new Date().toISOString()}] [${tag}]`, ...rest);

if (!botTokenReady()) {
  LOG('FATAL', 'TG_BOT_TOKEN is not set. Put it in /opt/warsentinel/bot/.env then restart.');
  process.exit(1);
}

ensureSchema();
LOG('BOOT', 'schema OK — db:', process.env.WARS_DB || './wars.db');

// business modules (import after schema init)
const { default: handleMessage } = await import('./tgcloud/handlers/message.js');
const { newsTick } = await import('./tgcloud/lib/news.js');
const { refreshMarketQuotes } = await import('./tgcloud/lib/market.js');
const { computeRisk } = await import('./tgcloud/lib/risk.js');
const { assetSnapshot, newsItem, riskDaily, setting } = await import('./tgcloud/schema.js');

// ─── one full update cycle: market + news + risk ───
async function tick(reason = 'auto') {
  const out = { reason, market: 0, news: 0, risk: null, level: null };
  try { out.market = await refreshMarketQuotes(db, assetSnapshot); } catch (e) { LOG('TICK', 'market error:', e.message); }
  try { out.news = (await newsTick(db, { newsItem, setting })).added; } catch (e) { LOG('TICK', 'news error:', e.message); }
  try {
    const r = await computeRisk(db, { riskDaily, assetSnapshot, newsItem });
    out.risk = r.score;
    out.level = r.level;
  } catch (e) { LOG('TICK', 'risk error:', e.message); }
  LOG('TICK', JSON.stringify(out));
  return out;
}

// ─── long polling loop ───
let offset = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollOnce() {
  const updates = await api.getUpdates({ offset, timeout: 25, allowed_updates: ['message'] });
  for (const u of updates || []) {
    offset = u.update_id + 1;
    const msg = u.message;
    if (!msg?.text) continue;
    LOG('MSG', `chat=${msg.chat?.id} user=${msg.from?.username ?? msg.from?.id} text=${msg.text.slice(0, 60)}`);
    try {
      await handleMessage(msg);
    } catch (e) {
      LOG('HANDLER-ERR', e.message);
      try {
        await api.sendMessage({ chat_id: msg.chat.id, text: '❌ خطای داخلی — بعداً دوباره تلاش کن.' });
      } catch {}
    }
  }
}

async function pollLoop() {
  for (;;) {
    try {
      await pollOnce();
    } catch (e) {
      LOG('POLL-ERR', e.message);
      await sleep(8000);
    }
  }
}

// ─── boot sequence ───
try {
  const me = await api.getMe();
  LOG('BOOT', `connected as @${me.username} (id=${me.id})`);
} catch (e) {
  LOG('FATAL', 'Telegram getMe failed:', e.message);
  process.exit(1);
}

pollLoop();

// first tick shortly after boot, then every 30 minutes
setTimeout(() => tick('boot').catch(() => {}), 8000);
setInterval(() => tick('interval').catch(() => {}), 30 * 60 * 1000);

LOG('BOOT', 'bot is running — long polling + 30min scheduler');
