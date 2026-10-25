# 🚀 راهنمای نصب روی سرور مجازی (VPS) — فارسی

این پوشه هر چیزی است که برای راه‌اندازی سامانه روی سرور خودت لازم داری.

## معماری

```
تلگرام کاربران ──> بات چت (/check /report)  ──┐
                                               ├──> دیتابیس SQLite (db/custom.db)
مرورگر کاربران ──> Caddy (HTTPS) ──> Next.js ──┘
                       دامنه تو         :3000
تیک ۶۰ ثانیه‌ای + بات‌های کامل هر ۳۰ دقیقه (systemd timer) → داده‌ها ۲۴/۷ تازه
```

| قطعه | سرویس systemd | مصرف رم |
|---|---|---|
| داشبورد (Next.js standalone) | `warrisk-web` | ~۲۰۰-۳۰۰MB |
| بات تلگرام (Bun) | `warrisk-bot` | ~۵۰-۱۰۰MB |
| تیک سبک هر ۶۰ ثانیه | `warrisk-tick.timer` | آنی |
| بات‌های کامل هر ۳۰ دقیقه | `warrisk-bots.timer` | آنی |
| HTTPS خودکار | Caddy | ~۳۰MB |

مجموع زیر ~۷۰۰MB → در سرور ۱GB رم (با swap ۲GB) راحت جا می‌شود.

## نصب (خودکار — من انجام می‌دهم)

مشخصات را که بدهی، من با `upload.py` همه‌چیز را آپلود و نصب می‌کنم:
- IP + پورت SSH + کاربر + رمز
- دامنه (رکورد A باید به IP سرور اشاره کند)
- توکن بات (BotFather → API Token)

## نصب (دستی — اگر خودت خواستی)

```bash
# روی سرور:
tar -xzf warrisk.tar.gz -C /opt/warrisk
DOMAIN=example.com TELEGRAM_BOT_TOKEN=123:AAH... ADMIN_CHAT_ID=تویی bash deploy.sh
```

## بعد از نصب

1. **دکمه مینی‌اپ**: @BotFather → /mybots → بات → Bot Settings → Menu Button → `https://دامنه`
2. **کلید هوش مصنوعی** (برای گزارش‌ها): در چت بات:
   - `/setkey sk-...`
   - `/setbase https://api.openai.com/v1` (یا هر سرویس سازگار OpenAI مثل OpenRouter)
   - `/setmodel gpt-4o-mini`
3. تست: `/check` در چت بات + باز کردن دامنه در مرورگر

## نگهداری

```bash
systemctl status warrisk-web warrisk-bot    # وضعیت
journalctl -u warrisk-web -f                # لاگ زنده وب
journalctl -u warrisk-bot -f                # لاگ زنده بات
systemctl restart warrisk-web               # ری‌استارت
crontab -e                                  # (نیازی نیست — تایمرها خودکارند)
```

## امنیت

- بعد از نصب **رمز SSH را عوض کن**: `passwd`
- ورود با کلید: `ssh-copy-id user@server` بعد `PasswordAuthentication no` در `/etc/ssh/sshd_config`
- فایروال فقط ۲۲/۸۰/۴۴۳ باز است (ufw)
- کلید AI فقط در دیتابیس خودت روی سرور خودت ذخیره می‌شود
