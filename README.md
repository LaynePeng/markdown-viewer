# Markdown Viewer

一个基于 Electron 的本地 Markdown 阅读器：轻量、原生、绿色（免安装）。

## 功能

- 拖入 `.md` 文件或整个文件夹即可阅读，左侧自动生成文件树
- 双击文件 / 命令行传参 / 已运行时再次打开，均能直接定位到文件
- 支持 GitHub 风格渲染（`marked` + `github-markdown-css`），代码高亮（`highlight.js`）
- 支持 [Mermaid](https://mermaid.js.org/) 图表，点击图表可弹出放大视图（滚轮缩放、拖拽平移）
- 浅色 / 深色主题切换，字号与内容宽度可调，支持自定义 CSS
- 打包后自动关联 `.md` / `.markdown` / `.mdown` / `.mkd` 文件

## 使用

```bash
npm install
npm start
```

打开单个文件：

```bash
npm start -- /path/to/file.md
```

## 打包

`tools/` 下提供了各平台的打包脚本（均会自动同步前端依赖）：

| 平台 | 脚本 | 产物 |
| --- | --- | --- |
| macOS | `tools/build-macos.sh` | zip + dmg |
| Linux | `tools/build-linux.sh` | AppImage + deb |
| Windows | `tools/build-windows.ps1` | NSIS 安装包 (.exe) |

也可以在 `package.json` 中运行对应命令：`npm run pack:mac` / `pack:linux` / `pack:win`。

> 说明：Windows 建议在 Windows 机器上执行打包脚本；macOS 交叉打包 Windows 需另装 wine。
>
> 网络受限环境（企业代理/自签证书）：脚本默认使用 npmmirror 镜像下载 Electron 及构建二进制；若仍报 `unable to verify the first certificate`，加 `--insecure` 参数跳过 TLS 校验（PowerShell 用 `-Insecure`）。

## 依赖同步

前端静态资源（marked / highlight.js / mermaid / 样式）从 `node_modules` 拷贝到 `renderer/vendor/`，更新依赖后重新运行：

```bash
node scripts/build-hljs.cjs   # 打包 highlight.js（内置 25 种语言）
node scripts/sync-vendor.cjs  # 同步其余静态资源
```

## 技术栈

- [Electron](https://www.electronjs.org/) + [electron-builder](https://www.electron.build/)
- [marked](https://marked.js.org/) / [highlight.js](https://highlightjs.org/) / [mermaid](https://mermaid.js.org/)