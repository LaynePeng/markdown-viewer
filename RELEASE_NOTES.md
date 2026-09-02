# Markdown Viewer v{{VERSION}}

## 修复：编辑工具栏与表格操作

- 修复所见即所得模式下「任务列表」无响应的问题
- 修复表格插入后无法增加行/列的问题，表格单元格内的光标现在可被正确识别
- 修复 9×9 表格网格选择器点击一次后无法再次打开的问题
- 修复链接、图片插入无响应的问题：改为应用内输入弹窗，支持 URL、相对路径和选择本地文件
- 工具栏操作保持编辑器选区，避免点击按钮后选区丢失

## 修复：应用浅色主题下的 Markdown 表格配色

修复系统使用深色外观、应用手动选择浅色主题时，Markdown 表格错误继承系统深色配色，导致背景和文字难以辨认的问题：

- 预览区与所见即所得编辑区统一严格跟随应用主题，不再受系统 `prefers-color-scheme` 影响
- 浅色主题下表格恢复浅色背景与深色文字
- 深色主题下表格继续使用深色背景与浅色文字

## 下载

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows | `Markdown Viewer-{{VERSION}}-Setup.exe` | NSIS 安装包，安装后自动关联 `.md` 文件 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64.dmg` | 安装包 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64-mac.zip` | 免安装绿色版 |

> macOS 包为 ad-hoc 签名（未公证）。首次打开如提示「无法验证开发者」，右键应用 →「打开」，或在 系统设置 → 隐私与安全性 中点击「仍然打开」。

## 反馈

问题或建议欢迎到 [GitHub Issues](https://github.com/LaynePeng/markdown-viewer/issues) 反馈。