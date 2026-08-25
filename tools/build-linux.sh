#!/usr/bin/env bash
# Linux 打包脚本：AppImage + deb
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 同步前端依赖"
node scripts/build-hljs.cjs
node scripts/sync-vendor.cjs

echo "==> 清理 dist"
rm -rf dist

echo "==> 打包 Linux (AppImage + deb)"
npx electron-builder --linux AppImage,deb

echo "==> 完成："
ls -lh dist/*.AppImage dist/*.deb 2>/dev/null | awk '{print "    " $9 " (" $5 ")"}'