#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  نصب کامل سامانه هشدار جنگ روی سرور مجازی اوبونتو — یک دستور
#  اجرا (به‌عنوان root):
#    DOMAIN=example.com TELEGRAM_BOT_TOKEN=123:AAH... \
#    ADMIN_CHAT_ID=12345678 bash deploy.sh
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

DOMAIN="${DOMAIN:?❌ DOMAIN تنظیم نشده}"
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:?❌ TELEGRAM_BOT_TOKEN تنظیم نشده}"
ADMIN_ID="${ADMIN_CHAT_ID:-}"
APP_DIR="/opt/warrisk"
SRC_TAR="/root/warrisk.tar.gz"

[ "$(id -u)" -eq 0 ] || { echo "❌ باید root باشی (sudo -i)"; exit 1; }

log() { echo -e "\n\033[1;36m═══ $1 ═══\033[0m"; }

# ─── ۱) آماده‌سازی سیستم ───
log "۱/۹ آماده‌سازی سیستم"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl unzip ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https nodejs npm >/dev/null

# ─── ۲) swap (برای بیلد با رم کم) ───
log "۲/۹ ساخت swap"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "✅ swap ۲ گیگ فعال شد"
else
  echo "✅ swap از قبل موجود است"
fi

# ─── ۳) فایروال ───
log "۳/۹ فایروال (۲۲/۸۰/۴۴۳)"
if command -v ufw >/dev/null; then
  ufw allow 22/tcp  >/dev/null 2>&1 || true
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
fi

# ─── ۴) نصب Bun ───
log "۴/۹ نصب Bun"
if [ ! -x /root/.bun/bin/bun ]; then
  curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1
fi
BUN="/root/.bun/bin/bun"
"$BUN" --version

# ─── ۵) استخراج پروژه ───
log "۵/۹ استخراج پروژه"
[ -f "$SRC_TAR" ] || { echo "❌ فایل warrisk.tar.gz در /root پیدا نشد"; exit 1; }
mkdir -p "$APP_DIR"
tar -xzf "$SRC_TAR" -C "$APP_DIR"
cd "$APP_DIR"

# ─── ۶) وابستگی‌ها + دیتابیس + بیلد ───
log "۶/۹ نصب وابستگی‌ها (ممکن است چند دقیقه طول بکشد)"
"$BUN" install

log "۶/۹ ساخت کلاینت دیتابیس"
npx --yes prisma generate

if [ ! -f "$APP_DIR/db/custom.db" ]; then
  log "دیتابیس موجود نیست — ساختن جدول‌ها"
  npx --yes prisma db push --skip-generate
fi

log "۶/۹ بیلد Next.js (با swap — چند دقیقه)"
NODE_OPTIONS="--max-old-space-size=1024" "$BUN" run build

# ─── ۷) فایل env ───
log "۷/۹ نوشتن تنظیمات"
cat > "$APP_DIR/.env" <<EOF
DATABASE_URL=file:$APP_DIR/db/custom.db
TELEGRAM_BOT_TOKEN=$BOT_TOKEN
MINIAPP_URL=https://$DOMAIN
ADMIN_CHAT_ID=$ADMIN_ID
NODE_ENV=production
EOF
chmod 600 "$APP_DIR/.env"

# ─── ۸) سرویس‌های systemd ───
log "۸/۹ ساخت سرویس‌ها"
cat > /etc/systemd/system/warrisk-web.service <<EOF
[Unit]
Description=War Risk Dashboard (Next.js standalone)
After=network.target

[Service]
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$BUN .next/standalone/server.js
Restart=always
RestartSec=3
MemoryMax=450M

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/warrisk-bot.service <<EOF
[Unit]
Description=War Risk Telegram Bot
After=network.target warrisk-web.service

[Service]
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$BUN vps-deploy/bot.ts
Restart=always
RestartSec=5
MemoryMax=200M

[Install]
WantedBy=multi-user.target
EOF

# تیک سبک هر ۶۰ ثانیه — داده‌ها ۲۴/۷ تازه می‌مانند حتی وقتی کسی اپ را باز نکرده
cat > /etc/systemd/system/warrisk-tick.service <<EOF
[Unit]
Description=War Risk 60s tick

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -fsS --max-time 55 http://127.0.0.1:3000/api/tick
EOF

cat > /etc/systemd/system/warrisk-tick.timer <<EOF
[Unit]
Description=Run war risk tick every 60s

[Timer]
OnBootSec=60
OnUnitActiveSec=60

[Install]
WantedBy=timers.target
EOF

# اجرای کامل بات‌ها (گزارش AI/پروازها/الگوها) هر ۳۰ دقیقه
cat > /etc/systemd/system/warrisk-bots.service <<EOF
[Unit]
Description=War Risk full bots run

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -fsS --max-time 290 -X POST http://127.0.0.1:3000/api/bots/tick
EOF

cat > /etc/systemd/system/warrisk-bots.timer <<EOF
[Unit]
Description=Run full war risk bots every 30min

[Timer]
OnBootSec=180
OnUnitActiveSec=1800

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now warrisk-web warrisk-bot warrisk-tick.timer warrisk-bots.timer

# ─── ۹) Caddy (HTTPS خودکار) ───
log "۹/۹ نصب Caddy + HTTPS"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  reverse_proxy 127.0.0.1:3000
  encode gzip
}
EOF
systemctl restart caddy

# ─── بررسی نهایی ───
log "بررسی سلامت"
sleep 6
WEB_OK="❌"
BOT_OK="❌"
systemctl is-active --quiet warrisk-web && WEB_OK="✅"
systemctl is-active --quiet warrisk-bot && BOT_OK="✅"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1:3000 || echo "000")

cat <<EOF

═══════════════════════════════════════════════
 🎉 نصب تمام شد!

 سرویس وب:    $WEB_OK  (HTTP $HTTP_CODE)
 سرویس بات:   $BOT_OK
 دامنه:       https://$DOMAIN  (گواهی HTTPS تا ۲ دقیقه دیگر فعال می‌شود)

 قدم آخر (دستی — در تلگرام):
   ۱. @BotFather → /mybots → باتت → Bot Settings → Menu Button
   ۲. آدرس را بده: https://$DOMAIN
   ۳. در چت بات: /start بزن → دکمه «باز کردن داشبورد» ظاهر می‌شود

 کلید هوش مصنوعی (برای گزارش‌ها): در چت بات بنویس:
   /setkey sk-...     /setbase https://api.openai.com/v1     /setmodel gpt-4o-mini

 لاگ‌ها:  journalctl -u warrisk-web -f   |   journalctl -u warrisk-bot -f
═══════════════════════════════════════════════
EOF
