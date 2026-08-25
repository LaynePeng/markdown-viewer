﻿# Windows 打包脚本 (PowerShell)：NSIS 安装包
# 用法: .\tools\build-windows.ps1 [-Insecure]
#   -Insecure  跳过 TLS 证书校验（仅建议内网/自签证书环境使用）
param([switch]$Insecure)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

# 网络受限环境：默认使用国内镜像（可用环境变量覆盖）
if (-not $env:ELECTRON_MIRROR) { $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/" }
if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) { $env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/" }

if ($Insecure) {
    Write-Host "==> 已启用非严格 TLS 校验（仅建议内网/自签证书环境使用）"
    $env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
    $env:npm_config_strict_ssl = "false"
}

function Invoke-Step([string]$Name, [scriptblock]$Block) {
    Write-Host "==> $Name"
    & $Block
    if ($LASTEXITCODE -ne 0) {
        Write-Host "!! $Name 失败 (exit $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

if (-not (Test-Path node_modules)) {
    Invoke-Step "安装依赖 (npm install)" {
        npm install
    }
}

Invoke-Step "同步前端依赖" {
    node scripts/build-hljs.cjs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    node scripts/sync-vendor.cjs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Invoke-Step "清理 dist" {
    if (Test-Path dist) { Remove-Item -Recurse -Force dist }
}

Invoke-Step "打包 Windows (NSIS)" {
    npx electron-builder --win nsis
}

Write-Host "==> 完成："
Get-ChildItem dist -Filter *.exe | ForEach-Object {
    Write-Host ("    " + $_.Name + " (" + [math]::Round($_.Length / 1MB, 1) + " MB)")
}