# Windows 打包脚本 (PowerShell)：NSIS 安装包
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> 同步前端依赖"
node scripts/build-hljs.cjs
node scripts/sync-vendor.cjs

Write-Host "==> 清理 dist"
if (Test-Path dist) { Remove-Item -Recurse -Force dist }

Write-Host "==> 打包 Windows (NSIS)"
npx electron-builder --win nsis

Write-Host "==> 完成："
Get-ChildItem dist/*.exe | ForEach-Object { Write-Host ("    " + $_.Name + " (" + [math]::Round($_.Length / 1MB, 1) + " MB)") }