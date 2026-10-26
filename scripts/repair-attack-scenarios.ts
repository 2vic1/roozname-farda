// ترمیم یک‌باره سطرهای موجود riskDaily — سناریوهای زمانی حمله (نزدیک/میانه/دور) نباید خالی باشند
// اجرا: bun scripts/repair-attack-scenarios.ts
import { db } from '../src/lib/db'
import { repairAttackScenarios } from '../src/lib/bots'

const rows = await db.riskDaily.findMany({
  where: {
    OR: [
      { attackDateNear: null },
      { attackDateMid: null },
      { attackDateFar: null },
    ],
  },
  orderBy: { date: 'desc' },
})

let fixed = 0
for (const row of rows) {
  if (!row.predictedAttackDate && !row.attackDateNear && !row.attackDateMid && !row.attackDateFar) {
    console.log(`${row.date}: هیچ تاریخ‌ای موجود نیست — رد شد`)
    continue
  }
  // بهترین الگوی کلان همان روز (برای پنجره تاریخی) — از detail ذخیره‌شده قابل بازخوانی نیست،
  // پس از الگوی فعلی با بیشترین شباهت استفاده می‌کنیم
  const bestPattern = await db.macroPattern.findFirst({ orderBy: { similarity: 'desc' } })
  const repaired = repairAttackScenarios({
    today: row.date, // نسبت به همان روز محاسبه شود
    predicted: row.predictedAttackDate,
    near: row.attackDateNear,
    mid: row.attackDateMid,
    far: row.attackDateFar,
    patternWindowHi: bestPattern?.windowHi ?? null,
  })
  await db.riskDaily.update({
    where: { id: row.id },
    data: {
      predictedAttackDate: repaired.predicted,
      attackDateNear: repaired.near,
      attackDateMid: repaired.mid,
      attackDateFar: repaired.far,
    },
  })
  fixed++
  console.log(
    `${row.date}: pred=${repaired.predicted} near=${repaired.near} mid=${repaired.mid} far=${repaired.far}`,
  )
}
console.log(`تمام شد — ${fixed} سطر ترمیم شد`)
await db.$disconnect()
