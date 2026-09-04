# Markdown Viewer v{{VERSION}}

## 新增：PlantUML 图渲染（离线纯 JS）

Markdown 文档中的 ` ```plantuml ` 代码块现在会自动渲染为 UML 图，与 Mermaid 图风格一致：

- **纯 JS 离线渲染**：基于 `@plantuml/core`（TeaVM 编译的 PlantUML 引擎），无需 Java、无需网络
- **支持暗色模式**：跟随应用主题自动切换
- **点击放大查看**：与 Mermaid 共用缩放弹窗，支持滚轮缩放、拖动平移
- **串行渲染**：多图自动排队，避免引擎并发冲突

## 新增：工具栏格式状态高亮

所见即所得编辑模式下，光标移动到已应用格式的文字上时，工具栏按钮会同步高亮，再次点击即可取消该格式：

所见即所得编辑模式下，光标移动到已应用格式的文字上时，工具栏按钮会同步高亮，再次点击即可取消该格式：

- 加粗 / 斜体 / 删除线：按钮高亮，再点取消
- 无序 / 有序列表：按钮高亮，再点取消列表（重点）
- 标题 H1-H6：对应标题按钮高亮
- 链接、行内代码、代码块：对应按钮高亮

## 修复：插入图片经常无法显示

修复相对路径图片（尤其是含 `../` 上级目录的路径）解析错误的问题，现在可正确显示：

- 图片路径以文档所在目录为基准正确归一化
- WYSIWYG 插入图片前恢复编辑器焦点，避免插入到错误位置

## 下载

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows | `Markdown Viewer-{{VERSION}}-Setup.exe` | NSIS 安装包，安装后自动关联 `.md` 文件 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64.dmg` | 安装包 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64-mac.zip` | 免安装绿色版 |

> macOS 包为 ad-hoc 签名（未公证）。首次打开如提示「无法验证开发者」，右键应用 →「打开」，或在 系统设置 → 隐私与安全性 中点击「仍然打开」。

## 反馈

问题或建议欢迎到 [GitHub Issues](https://github.com/LaynePeng/markdown-viewer/issues) 反馈。