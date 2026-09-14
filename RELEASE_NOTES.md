# Markdown Viewer v{{VERSION}}

## 新增：Markdown 数学公式渲染

现在支持以 KaTeX 渲染 Markdown 中的数学公式，离线可用、无需联网：

- 块级公式：`$$ ... $$`，居中显示；过长时自动横向滚动
- 行内公式：`$ ... $`
- 公式源码不受代码块影响（代码块中的 `$` 保持原样）
- 编辑模式下公式可正常预览，保存时自动还原为 LaTeX 原文，不丢失公式
- 解析失败时回退显示原始 LaTeX，便于排查

## 下载

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows | `Markdown Viewer-{{VERSION}}-Setup.exe` | NSIS 安装包，安装后自动关联 `.md` 文件 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64.dmg` | 安装包 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64-mac.zip` | 免安装绿色版 |

> macOS 包为 ad-hoc 签名（未公证）。首次打开如提示「无法验证开发者」，右键应用 →「打开」，或在 系统设置 → 隐私与安全性 中点击「仍然打开」。

## 反馈

问题或建议欢迎到 [GitHub Issues](https://github.com/LaynePeng/markdown-viewer/issues) 反馈。
