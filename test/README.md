# 测试

无需额外依赖，直接用项目自带的 Electron 跑：

```bash
# 渲染进程集成测试（桩 preload）：Mermaid 错误隔离/定位、围栏扫描、
# 右键菜单、双击文件夹、重命名重定向、删除逻辑 —— 48 项断言
npx electron test/integration.js

# 滚动联动集成测试（桩 preload）：data-line 行号注入、mermaid 容器行号转移、
# 重渲染保持滚动、源码↔预览双向联动精度（≤10 行）、无回环抖动、编辑后锚点重建 —— 21 项断言
npx electron test/scroll-sync.js

# 主进程 IPC 真实验证（加载真实 main.js，操作 /tmp 临时文件）：
# rename 各分支、目录迁移、真实目录树渲染 —— 12 项断言
# 结果写入 /tmp/mdv-ipc-log.txt（app.exit 会在 stdout 刷新前终止进程）
npx electron test/ipc-real.js && cat /tmp/mdv-ipc-log.txt
```

说明：

- 两套测试相互独立，可单独跑
- `ipc-real.js` 使用独立 userData 目录，用户正开着正式版应用（占用单实例锁）时也能跑
- `ipc-real.js` 不覆盖 `trash-item`（会弹原生确认框）、`reveal-item` / `open-path`（会打开 Finder / 资源管理器），这些用 `integration.js` 的桩验证调用逻辑
- 沙箱环境（CI / 容器）需追加 `--no-sandbox --disable-gpu`（脚本内已内置）
