# Markdown Viewer v{{VERSION}}

## 修复：编辑模式显示错误的文件内容

修复一个标签页状态串扰问题：编辑并保存 A 文件后，在文件树中单击打开 B 文件，再进入编辑模式时，编辑器中显示的仍是 A 文件的内容：

- 原因：单击打开复用当前标签页时，切换逻辑会先从编辑器 DOM 回读「上一个标签页」的内容，把刚设置的新文件内容又覆盖回了旧文件
- 现在切换到自身标签页时不再回读编辑器内容，新文件内容得以正确保留
- 多标签页之间的编辑内容、滚动位置互不串扰

## 下载

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows | `Markdown Viewer-{{VERSION}}-Setup.exe` | NSIS 安装包，安装后自动关联 `.md` 文件 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64.dmg` | 安装包 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64-mac.zip` | 免安装绿色版 |

> macOS 包为 ad-hoc 签名（未公证）。首次打开如提示「无法验证开发者」，右键应用 →「打开」，或在 系统设置 → 隐私与安全性 中点击「仍然打开」。

## 反馈

问题或建议欢迎到 [GitHub Issues](https://github.com/LaynePeng/markdown-viewer/issues) 反馈。
