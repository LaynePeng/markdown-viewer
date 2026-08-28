#!/usr/bin/env bash
# macOS 打包脚本：zip + dmg
# 用法: ./build-macos.sh [--x64|--arm64|--universal] [--insecure]
set -euo pipefail
cd "$(dirname "$0")/.."

# 网络受限环境：默认使用国内镜像（可用环境变量覆盖）
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
export ELECTRON_BUILDER_BINARIES_MIRROR="${ELECTRON_BUILDER_BINARIES_MIRROR:-https://npmmirror.com/mirrors/electron-builder-binaries/}"

# 架构参数：不传默认当前机器架构；--insecure 跳过 TLS 校验（自签证书/企业代理环境）
ARCH_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --insecure)
      echo "==> 已启用非严格 TLS 校验（仅建议内网/自签证书环境使用）"
      export NODE_TLS_REJECT_UNAUTHORIZED=0
      export npm_config_strict_ssl=false
      ;;
    --x64|--arm64|--universal)
      ARCH_ARGS+=("$arg")
      ;;
    *)
      echo "!! 未知参数: $arg（支持 --x64 / --arm64 / --universal / --insecure）"
      exit 1
      ;;
  esac
done

if [ ! -d node_modules ]; then
  echo "==> 安装依赖 (npm install)"
  npm install
fi

echo "==> 同步前端依赖"
node scripts/build-hljs.cjs
node scripts/sync-vendor.cjs

echo "==> 清理 dist"
rm -rf dist

echo "==> 打包 macOS (zip + dmg) ${ARCH_ARGS[*]:-}"
npx electron-builder --mac zip dmg "${ARCH_ARGS[@]}"

echo "==> 完成："
ls -lh dist/*.zip dist/*.dmg 2>/dev/null | awk '{print "    " $9 " (" $5 ")"}'