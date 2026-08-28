# Markdown Viewer

基于 Electron 的本地 Markdown 阅读器。

## 开发

```bash
npm start         # 启动开发模式
node --check renderer/app.js  # JS 语法检查
```

## 打包

| 平台 | 命令 | 产物 |
|------|------|------|
| macOS | `bash tools/build-macos.sh [--arm64 \| --x64 \| --universal]` | `.dmg` + `.zip` |
| Linux | `bash tools/build-linux.sh` | `.AppImage` + `.deb` |
| Windows | `powershell ./tools/build-windows.ps1` | `.exe` (NSIS) |

- 打包前需执行 `npm run pack:mac` 等（或直接调对应脚本）
- 所有脚本会自动 `npm install` 和同步前端依赖（`npm run build:hls` 等）
- 网络受限环境：脚本已默认使用国内镜像（`ELECTRON_MIRROR`、`ELECTRON_BUILDER_BINARIES_MIRROR`）
- 自签证书/企业代理环境：加 `--insecure` 参数跳过 TLS 校验
- macOS 包为 ad-hoc 签名，未公证。首次打开如提示「无法验证开发者」，右键 → 打开 或 系统设置 → 隐私与安全性 → 仍然打开

## 发布流程

1. 更新 `package.json` 中的 `version` 字段
2. 更新 `RELEASE_NOTES.md` 中的 `{{VERSION}}` 占位符会自动被 tag 版本替换 —— 无需手动修改版本号
3. 提交并推送 main 分支
4. 打 tag 并推送：

```bash
git tag -a v<version> -m "v<version>: <简介>"
git push origin v<version>
```

5. GitHub Actions 自动构建 Windows (NSIS) + macOS (arm64) 安装包，并创建 GitHub Release

## Release Notes 注意事项

- `RELEASE_NOTES.md` 仅包含**当前版本增量**，不含历史版本内容
- 下载链接中的 `{{VERSION}}` 占位符由 workflow 自动替换为 tag 版本号（去掉 `v` 前缀）
- 构建产物文件名由 `electron-builder` 根据 `package.json` 的 `version` 字段自动生成