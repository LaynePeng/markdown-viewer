#!/usr/bin/env bash
# macOS 打包脚本：zip + dmg
set -euo pipefail
cd "$(dirname "$0")/.."

# 网络受限环境：默认使用国内镜像（可用环境变量覆盖）
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
export ELECTRON_BUILDER_BINARIES_MIRROR="${ELECTRON_BUILDER_BINARIES_MIRROR:-https://npmmirror.com/mirrors/electron-builder-binaries/}"

# 自签证书/企业代理环境：./build-macos.sh --insecure 跳过 TLS 校验
if [ "${1:-}" = "--insecure" ]; then
  echo "==> 已启用非严格 TLS 校验（仅建议内网/自签证书环境使用）"
  export NODE_TLS_REJECT_UNAUTHORIZED=0
  export npm_config_strict_ssl=false
fi

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