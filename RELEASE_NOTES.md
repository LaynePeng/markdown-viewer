# Markdown Viewer v{{VERSION}}

## 新增：文件树排序

左侧文件树现在支持两种排序方式，并可通过按钮切换正序/倒序：

- **按名称排序**：目录与文件分别按拼音字母顺序排列（正序 A→Z / 倒序 Z→A）
- **按修改时间排序**：以文件最后修改时间排序（倒序：最新文件排最前 / 正序：最早文件排最前）
- 排序偏好自动保存，下次启动自动恢复

## 新增：多 Tab 多文档支持

告别单文档模式，现在可以同时打开多个 Markdown 文件，在 Tab 间自由切换：

- **双击**文件树中的 `.md` 文件 → 新建 Tab 打开，不覆盖当前内容
- **单击**文件树中的 `.md` 文件 → 在当前 Tab 打开（若已打开则切换过去）
- 每个 Tab 有独立的：
  - **编辑模式**：一个 Tab 进入编辑分屏，切换到其他 Tab 浏览，切回来继续编辑
  - **编辑内容**：修改未保存的内容不会丢失
  - **保存状态**：修改过的 Tab 显示 ● 标记，一目了然
- Tab 可关闭（点击 ✕ 或双击 Tab），关闭最后一个 Tab 回到空状态
- 跨目录 Tab 时，目录树固定在当前根目录、不跳转，文件路径显示在顶部标题栏

## 其他改进

- 目录树高亮改为按路径精确匹配，避免同名文件误高亮
- 文件树 `read-dir` 接口返回 `mtime`（修改时间），为排序提供数据基础

## 下载

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows | `Markdown Viewer-{{VERSION}}-Setup.exe` | NSIS 安装包，安装后自动关联 `.md` 文件 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64.dmg` | 安装包 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64-mac.zip` | 免安装绿色版 |

> macOS 包为 ad-hoc 签名（未公证）。首次打开如提示「无法验证开发者」，右键应用 →「打开」，或在 系统设置 → 隐私与安全性 中点击「仍然打开」。

## 反馈

问题或建议欢迎到 [GitHub Issues](https://github.com/LaynePeng/markdown-viewer/issues) 反馈。
