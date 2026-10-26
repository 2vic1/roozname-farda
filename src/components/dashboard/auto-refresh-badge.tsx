'use client'

// شمارش معکوس رفرش خودکار — ایزوله در کامپوننت خودش تا هر ثانیه کل درخت صفحه رندر نشود
// (رندر هرثانیه‌ای درخت سنگین داشبورد باعث پارگی فریم و افتادن حروف روی هم می‌شد)
import { useEffect, useRef, useState } from 'react'
import { faNum } from './types'

export function AutoRefreshBadge({
  seconds,
  onRefresh,
}: {
  seconds: number
  onRefresh: () => void
}) {
  const [left, setLeft] = useState(seconds)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    const t = setInterval(() => {
      setLeft((c) => {
        if (c <= 1) {
          // تیک سبک: قیمت‌های لحظه‌ای + چرخش منابع خبری + بروزرسانی ریسک
          fetch('/api/tick', { cache: 'no-store' }).catch(() => {})
          onRefreshRef.current()
          return seconds
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [seconds])

  return (
    <span className="hidden text-[11px] tabular-nums text-zinc-500 sm:block">
      رفرش خودکار: {faNum(left)} ثانیه
    </span>
  )
}
