#!/usr/bin/env python3
# ─── آپلود و نصب خودکار روی سرور مجازی کاربر (از سندباکس) ───
# استفاده:
#   python3 upload.py --host IP --port 22 --user root --password '...'
#                     --domain example.com --token '123:AAH...' [--admin 12345]
import argparse
import os
import subprocess
import sys
import tarfile
import time

import paramiko

ROOT = "/home/z/my-project"
TARBALL = "/tmp/warrisk.tar.gz"


def make_tarball():
    print("📦 ساخت بسته پروژه...")
    if os.path.exists(TARBALL):
        os.remove(TARBALL)
    excludes = [
        "node_modules", ".next", "dev.log", "server.log", "worklog.md",
        "telegram-app", "backups", ".git", "*.tar.gz",
        "skills", "upload", ".venv", "agent-ctx", ".tgcloud", "examples",
    ]
    with tarfile.open(TARBALL, "w:gz") as tar:
        def filt(ti):
            parts = ti.name.split("/")
            if any(p in excludes for p in parts) or ti.name.endswith(".tar.gz"):
                return None
            return ti
        tar.add(ROOT, arcname=".", filter=filt)
    size = os.path.getsize(TARBALL) / 1024 / 1024
    print(f"   → {TARBALL} ({size:.1f} MB)")


def ssh_exec(ssh, cmd, timeout=1200, sudo_password=None):
    """اجرا با نمایش زنده خروجی"""
    full = cmd if not sudo_password else f"sudo -S -p '' bash -c {shell_quote(cmd)}"
    stdin, stdout, stderr = ssh.exec_command(full, get_pty=True, timeout=timeout)
    if sudo_password:
        stdin.write(sudo_password + "\n")
        stdin.flush()
    out = []
    for line in iter(stdout.readline, ""):
        line = line.rstrip("\n")
        print(f"   {line}")
        out.append(line)
    code = stdout.channel.recv_exit_status()
    return code, "\n".join(out)


def shell_quote(s):
    return "'" + s.replace("'", "'\\''") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", required=True)
    ap.add_argument("--port", type=int, default=22)
    ap.add_argument("--user", default="root")
    ap.add_argument("--password", required=True)
    ap.add_argument("--domain", required=True)
    ap.add_argument("--token", required=True, help="BotFather API token")
    ap.add_argument("--admin", default="")
    args = ap.parse_args()

    make_tarball()

    print(f"🔌 اتصال به {args.host}:{args.port} (کاربر {args.user})...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(args.host, port=args.port, username=args.user, password=args.password,
                look_for_keys=False, allow_agent=False, timeout=25)
    print("✅ وصل شد")

    sudo_pw = None if args.user == "root" else args.password

    # پاک کردن بسته قبلی (اگر هست)
    ssh_exec(ssh, "rm -f /root/warrisk.tar.gz", 30, sudo_pw)

    print("📤 آپلود بسته + اسکریپت نصب...")
    sftp = ssh.open_sftp()
    dest_tar = "/root/warrisk.tar.gz" if args.user == "root" else f"/home/{args.user}/warrisk.tar.gz"
    dest_sh = "/root/deploy.sh" if args.user == "root" else f"/home/{args.user}/deploy.sh"
    sftp.put(TARBALL, dest_tar)
    sftp.put(f"{ROOT}/vps-deploy/deploy.sh", dest_sh)
    sftp.close()
    print("✅ آپلود کامل شد")

    print("\n🚀 اجرای نصب (زنده)...\n")
    env_cmd = (
        f"DOMAIN={shell_quote(args.domain)} "
        f"TELEGRAM_BOT_TOKEN={shell_quote(args.token)} "
        f"ADMIN_CHAT_ID={shell_quote(args.admin)} "
        f"bash {dest_sh}"
    )
    code, out = ssh_exec(ssh, env_cmd, timeout=1800, sudo_password=sudo_pw)

    print(f"\n{'✅' if code == 0 else '❌'} نصب با کد {code} تمام شد")
    ssh.close()
    sys.exit(0 if code == 0 else 1)


if __name__ == "__main__":
    main()
