# Markdown Viewer v{{VERSION}}

## 新增：源码分屏滚动联动

编辑模式切到「源码」左右分屏后，两侧滚动现在双向联动：

- 滚动任意一侧，另一侧自动对齐到对应位置。定位基于**源码行号锚点**（渲染时给每个块级元素标注其源码行号），配合锚点间插值换算，代码块、表格、图表与源码高度差异大时也对得准，不是简单的百分比同步
- 编辑器侧用镜像排版逐行实测像素位置，段落长行自动折行时依然对得准
- 打字时预览实时跟随当前编辑位置，不再跳回顶部
- 图片、Mermaid / PlantUML 图异步渲染完成后自动校正锚点位置；拖动分屏分割线、调整字号后自动重建映射
- 联动带回声抑制，不会来回拉扯抖动

### 顺带修复

- 源码模式编辑长文时，每次输入触发预览重渲染会跳回顶部的问题
- 阅读模式下文件在外部被修改、自动刷新后阅读位置丢失的问题

## 下载

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows | `Markdown Viewer-{{VERSION}}-Setup.exe` | NSIS 安装包，安装后自动关联 `.md` 文件 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64.dmg` | 安装包 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64-mac.zip` | 免安装绿色版 |

> macOS 包为 ad-hoc 签名（未公证）。首次打开如提示「无法验证开发者」，右键应用 →「打开」，或在 系统设置 → 隐私与安全性 中点击「仍然打开」。

## 反馈

问题或建议欢迎到 [GitHub Issues](https://github.com/LaynePeng/markdown-viewer/issues) 反馈。
