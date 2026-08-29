# Markdown Viewer v{{VERSION}}

## 修复：点击文档内链接不再导致应用崩溃

此前点击 Markdown 中的链接会直接导航整个窗口，若链接是相对路径（例如指向本地目录中的另一个 `.md` 文件），应用会离开主界面，表现为「整个应用死掉」。现在：

- 点击指向本地 `.md` 文件的链接 → 自动在新 Tab 中打开，并可继续链接跳转
- 点击 `http(s)` / `mailto` 链接 → 用系统默认浏览器打开
- 点击本地其他类型文件（如 PDF、图片）→ 用系统默认程序打开
- 链接指向的文件不存在或无法读取 → 新开一个 Tab 显示错误提示，不影响其他 Tab 和整个应用
- 主进程增加导航守卫，任何情况下窗口都不会被带离应用主界面

## 下载

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows | `Markdown Viewer-{{VERSION}}-Setup.exe` | NSIS 安装包，安装后自动关联 `.md` 文件 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64.dmg` | 安装包 |
| macOS (Apple Silicon) | `Markdown Viewer-{{VERSION}}-arm64-mac.zip` | 免安装绿色版 |

> macOS 包为 ad-hoc 签名（未公证）。首次打开如提示「无法验证开发者」，右键应用 →「打开」，或在 系统设置 → 隐私与安全性 中点击「仍然打开」。

## 反馈

问题或建议欢迎到 [GitHub Issues](https://github.com/LaynePeng/markdown-viewer/issues) 反馈。