'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { faDateMini, faNum, faDateShort, levelMeta } from './types'
import type { ForecastPoint, HistoryPoint } from './types'

// نمودار ریسک: تاریخچه ۴۵ روز + پیش‌بینی ۱۴ روز آینده
export function RiskChart({
  history,
  forecast,
  today,
}: {
  history: HistoryPoint[]
  forecast: ForecastPoint[]
  today: string
}) {
  const past = history.slice(-45).map((h) => ({
    date: h.date.slice(5),
    actual: h.score,
    predicted: null as number | null,
  }))
  const future = forecast.map((f) => ({
    date: f.date.slice(5),
    actual: null as number | null,
    predicted: f.score,
  }))
  // اتصال نقطه آخر واقعی به شروع پیش‌بینی
  if (past.length && future.length) {
    past[past.length - 1].predicted = past[past.length - 1].actual
  }
  const data = [...past, ...future]

  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gPred" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.18)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#a1a1aa' }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#a1a1aa' }} width={36} />
          <Tooltip
            contentStyle={{
              background: 'rgba(24,24,27,0.95)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 10,
              fontSize: 12,
              fontFamily: 'Vazirmatn, Tahoma',
              direction: 'rtl',
            }}
            formatter={(value: number | string, name: string) => [
              `${value} / ۱۰۰`,
              name === 'actual' ? 'امتیاز واقعی' : 'پیش‌بینی',
            ]}
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="#f59e0b"
            strokeWidth={2.5}
            fill="url(#gActual)"
            connectNulls={false}
            dot={false}
            name="actual"
          />
          <Area
            type="monotone"
            dataKey="predicted"
            stroke="#f97316"
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="url(#gPred)"
            connectNulls={false}
            dot={false}
            name="predicted"
          />
          <ReferenceLine x={today.slice(5)} stroke="rgba(250,250,250,0.35)" strokeDasharray="2 2" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// نوار پیش‌بینی ۱۴ روز آینده به‌صورت ستون‌های رنگی عمودی
export function ForecastStrip({ forecast }: { forecast: ForecastPoint[] }) {
  if (!forecast.length) {
    return (
      <p className="py-6 text-center text-xs text-zinc-500">
        پیش‌بینی روزهای آینده هنوز محاسبه نشده
      </p>
    )
  }
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-1" dir="rtl">
      {forecast.slice(0, 14).map((f, i) => {
        const meta = levelMeta(f.level)
        const h = Math.max(6, Math.round((Math.min(100, Math.max(0, f.score)) / 100) * 72))
        return (
          <div
            key={f.date}
            className="flex min-w-[34px] flex-1 flex-col items-center gap-1.5"
            title={`${faDateShort(f.date)} — امتیاز ${faNum(f.score)} (${meta.fa})`}
          >
            <span className="text-[9px] tabular-nums text-zinc-500">{faNum(f.score)}</span>
            <div className="flex h-[72px] w-full items-end justify-center">
              <div
                className={`w-4 rounded-t-md transition-all duration-700 ${
                  i === 0 ? 'ring-1 ring-zinc-300/50' : ''
                }`}
                style={{ height: h, background: meta.color, opacity: 0.9 }}
              />
            </div>
            <span className="text-[9px] tabular-nums text-zinc-500" suppressHydrationWarning>
              {faDateMini(f.date)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
