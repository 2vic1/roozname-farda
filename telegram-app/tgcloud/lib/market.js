// ─── بازارها: تریدینگ‌ویو (همان مرجع اپ وب — پورت از runMarketFastQuotes) ───
import { fetchJsonPost } from './util.js';

// ۱۱ دارایی — همان TV_ASSET_OVERRIDES اپ وب
const TV_OVERRIDES = {
  'BZ=F': 'ICEEUR:BRN1!',
  'CL=F': 'NYMEX:CL1!',
  'GC=F': 'OANDA:XAUUSD',
  'SI=F': 'TVC:SILVER',
  BTCUSDT: 'BINANCE:BTCUSDT',
  ETHUSDT: 'BINANCE:ETHUSDT',
  '^GSPC': 'SP:SPX',
  '^IXIC': 'NASDAQ:IXIC',
  '^DJI': 'DJ:DJI',
  'DX-Y.NYB': 'TVC:DXY',
  '^VIX': 'TVC:VIX',
};

export const ASSETS = [
  { symbol: 'BZ=F', name: 'نفت برنت', category: 'energy', unit: '$' },
  { symbol: 'CL=F', name: 'نفت WTI', category: 'energy', unit: '$' },
  { symbol: 'GC=F', name: 'طلا (اسپات)', category: 'metal', unit: '$' },
  { symbol: 'SI=F', name: 'نقره', category: 'metal', unit: '$' },
  { symbol: 'BTCUSDT', name: 'بیت‌کوین', category: 'crypto', unit: '$' },
  { symbol: 'ETHUSDT', name: 'اتریوم', category: 'crypto', unit: '$' },
  { symbol: '^GSPC', name: 'S&P 500', category: 'index', unit: '' },
  { symbol: '^IXIC', name: 'نزدک', category: 'index', unit: '' },
  { symbol: '^DJI', name: 'داوجونز', category: 'index', unit: '' },
  { symbol: 'DX-Y.NYB', name: 'دلار (DXY)', category: 'index', unit: '' },
  { symbol: '^VIX', name: 'شاخص ترس (VIX)', category: 'index', unit: '' },
];

/** یک درخواست دسته‌ای → همه قیمت‌ها؛ سپس upsert در دیتابیس */
export async function refreshMarketQuotes(db, assetSnapshot) {
  const { eq, sql } = await import('sdk/db');
  const tickers = Object.values(TV_OVERRIDES);
  const j = await fetchJsonPost('https://scanner.tradingview.com/global/scan', {
    symbols: { tickers, query: { types: [] } },
    columns: ['close', 'change'],
  });
  const quotes = {};
  for (const row of j?.data ?? []) {
    const price = row.d?.[0];
    const chg = row.d?.[1];
    if (typeof price === 'number' && isFinite(price)) {
      quotes[row.s] = {
        price,
        changePct: typeof chg === 'number' && isFinite(chg) ? chg : 0,
      };
    }
  }
  let saved = 0;
  for (const a of ASSETS) {
    const q = quotes[TV_OVERRIDES[a.symbol]];
    if (!q) continue;
    await db
      .insert(assetSnapshot)
      .values({
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        unit: a.unit,
        price: q.price,
        change1d: q.changePct,
      })
      .onConflictDoUpdate({
        target: assetSnapshot.symbol,
        set: { price: q.price, change1d: q.changePct, updatedAt: sql`(unixepoch())` },
      })
      .run();
    saved++;
  }
  return saved;
}

/** خواندن همه دارایی‌ها برای داشبورد */
export async function listAssets(db, assetSnapshot) {
  const { desc } = await import('sdk/db');
  const rows = await db.select().from(assetSnapshot).orderBy(desc(assetSnapshot.price)).all();
  return rows;
}
