#!/usr/bin/env bash
# macOS 打包脚本：zip + dmg
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "==> 安装依赖 (npm install)"
  npm install
fi

echo "==> 同步前端依赖"
node scripts/build-hljs.cjs
node scripts/sync-vendor.cjs

echo "==> 清理 dist"
rm -rf dist

echo "==> 打包 macOS (zip + dmg)"
npx electron-builder --mac zip dmg

echo "==> 完成："
ls -lh dist/*.zip dist/*.dmg 2>/dev/null | awk '{print "    " $9 " (" $5 ")"}'