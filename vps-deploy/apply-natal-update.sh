#!/usr/bin/env bash
# ─── آپدیت یک‌خطی VPS با چارت تولد جدید (Task 17) ───
# پیش‌نیاز: SSH_PASS=<رمز> bun run up.ts /tmp/ws-update.tar.gz
# سپس: SSH_PASS=<رمز> bash vps-deploy/apply-natal-update.sh
# این اسکریپت روی سرور اجرا می‌شود (از طریق exec.ts):
set -e
cd /opt/warsentinel
echo "[1/6] backup current"
[ -d dashboard-old ] && rm -rf dashboard-old
mv dashboard dashboard-old
echo "[2/6] extract new build"
mkdir -p dashboard
tar -xzf /tmp/ws-update.tar.gz -C dashboard
echo "[3/6] ensure NatalChart table (sqlite DDL — مطابق اسکیمای پرisma)"
bun -e '
import { Database } from "bun:sqlite";
const db = new Database("/opt/warsentinel/db/custom.db");
db.run(`CREATE TABLE IF NOT EXISTS "NatalChart" (
  "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  "name" TEXT NOT NULL DEFAULT '"'"''"'"',
  "jy" INTEGER NOT NULL,
  "jm" INTEGER NOT NULL,
  "jd" INTEGER NOT NULL,
  "hour" INTEGER NOT NULL,
  "minute" INTEGER NOT NULL,
  "city" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
console.log("NatalChart table ready");
'
echo "[4/6] restart dashboard"
systemctl restart warsentinel-dashboard
sleep 4
echo "[5/6] health check"
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/)
echo "HOME: $CODE"
API=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3000/api/astro/forecast -H 'Content-Type: application/json' -d '{"jy":1405,"jm":9}')
echo "forecast API: $API"
echo "[6/6] cleanup"
rm -f /tmp/ws-update.tar.gz
echo "DONE — BUILD: $(cat /opt/warsentinel/dashboard/.next/BUILD_ID 2>/dev/null || echo unknown)"
