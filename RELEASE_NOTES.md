# Markdown Viewer v1.0.0

Markdown Viewer 是一个基于 Electron 的本地 Markdown 阅读器，主打轻量、原生、绿色（免安装）。这是项目的首个正式版本。

## 主要功能

- 拖入 `.md` 文件或整个文件夹即可阅读，左侧自动生成文件树，双击即可定位文件
- GitHub 风格渲染（marked + github-markdown-css），代码高亮（highlight.js，内置 25 种语言）
- Mermaid 图表渲染，点击图表可放大查看（滚轮缩放、拖拽平移）
- 浅色 / 深色主题切换，字号与内容宽度可调，支持自定义 CSS
- 编辑分屏：左右分栏可拖动，编辑后 ⌘S / Ctrl+S 保存到原文件
- 文件与目录自动监听刷新，外部修改实时同步到预览
- 支持命令行传参打开文件：`Markdown Viewer /path/to/file.md`
- 一键文件关联：在「关于」中点击「关联 Markdown 文件」，将 `.md` 等文件默认用本应用打开
- 单实例运行：应用已打开时，双击文件会复用现有窗口

## 下载

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows | `Markdown Viewer-1.0.0-Setup.exe` | NSIS 安装包，安装后自动关联 `.md` 文件 |
| macOS (Apple Silicon) | `Markdown Viewer-1.0.0-arm64.dmg` | 安装包 |
| macOS (Apple Silicon) | `Markdown Viewer-1.0.0-arm64-mac.zip` | 免安装绿色版 |

> macOS 包为 ad-hoc 签名（未公证）。首次打开如提示「无法验证开发者」，右键应用 →「打开」，或在 系统设置 → 隐私与安全性 中点击「仍然打开」。

## 反馈

问题或建议欢迎到 [GitHub Issues](https://github.com/LaynePeng/markdown-viewer/issues) 反馈。