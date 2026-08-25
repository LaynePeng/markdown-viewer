# Windows 打包脚本 (PowerShell)：NSIS 安装包
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Invoke-Step([string]$Name, [scriptblock]$Block) {
    Write-Host "==> $Name"
    & $Block
    if ($LASTEXITCODE -ne 0) {
        Write-Host "!! $Name 失败 (exit $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
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