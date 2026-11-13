/* 主进程 IPC 真实验证：加载真实 app（require main.js），从渲染进程调用
   window.mdv.renameItem 等真实 IPC，验证文件系统真实变更与错误分支。
   不测 trash-item（会弹原生对话框）/ reveal / openPath（会打开 Finder）。
   结果写入 /tmp/mdv-ipc-log.txt（app.exit 会在 stdout 刷新前终止进程）。 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

/* 用户可能正开着正式版应用（占用单实例锁），测试用独立 userData 避开 */
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-ipc-userdata-')));

const LOG_FILE = '/tmp/mdv-ipc-log.txt';
const LOG = [];
let failures = 0;

function ok(cond, label, extra) {
  if (cond) LOG.push('PASS ' + label);
  else { failures++; LOG.push('FAIL ' + label + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-ipc-'));
fs.writeFileSync(path.join(TMP, 'a.md'), '# A');
fs.writeFileSync(path.join(TMP, 'b.md'), '# B');
fs.mkdirSync(path.join(TMP, 'sub'));
fs.writeFileSync(path.join(TMP, 'sub', 'c.md'), '# C');

/* 命令行传参打开 a.md（main.js 顶层解析 argv → pendingFile → open-file） */
process.argv.push(path.join(TMP, 'a.md'));

/* 加载真实应用：注册全部 IPC handler 并创建窗口 */
require(path.join(__dirname, '..', 'main.js'));

app.whenReady().then(async () => {
  await new Promise(r => setTimeout(r, 3000));
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) { LOG.push('FAIL no window'); finish(); return; }

  const run = (code) => win.webContents.executeJavaScript(code, true);

  /* 打开文件流程正常（走真实 readFile IPC） */
  let r0 = await run(`(() => ({ active: state.active, title: document.title }))()`);
  ok(r0.active === path.join(TMP, 'a.md'), 'app: 命令行文件已打开', r0);

  /* rename：正常路径 */
  let r1 = await run(`window.mdv.renameItem(${JSON.stringify(path.join(TMP, 'a.md'))}, 'x.md')`);
  ok(r1.ok === true && r1.path === path.join(TMP, 'x.md'), 'ipc rename: 成功返回新路径', r1);
  ok(fs.existsSync(path.join(TMP, 'x.md')) && !fs.existsSync(path.join(TMP, 'a.md')), 'ipc rename: 磁盘上真实生效');

  /* rename：目标已存在 */
  let r2 = await run(`window.mdv.renameItem(${JSON.stringify(path.join(TMP, 'x.md'))}, 'b.md')`);
  ok(r2.ok === false && /同名/.test(r2.error), 'ipc rename: 重名报错', r2);
  ok(fs.existsSync(path.join(TMP, 'x.md')), 'ipc rename: 重名时原文件保留');

  /* rename：非法名字 */
  let r3 = await run(`window.mdv.renameItem(${JSON.stringify(path.join(TMP, 'x.md'))}, 'a/b.md')`);
  ok(r3.ok === false && /名称/.test(r3.error), 'ipc rename: 非法名称报错', r3);

  /* rename：不存在路径 */
  let r4 = await run(`window.mdv.renameItem(${JSON.stringify(path.join(TMP, 'nope.md'))}, 'y.md')`);
  ok(r4.ok === false, 'ipc rename: 不存在路径报错', r4);

  /* rename：目录（子目录内容应跟着走） */
  let r5 = await run(`window.mdv.renameItem(${JSON.stringify(path.join(TMP, 'sub'))}, 'sub2')`);
  ok(r5.ok === true, 'ipc rename dir: 成功', r5);
  ok(fs.existsSync(path.join(TMP, 'sub2', 'c.md')), 'ipc rename dir: 子文件随目录移动');

  /* 树渲染真实目录（走真实 read-dir IPC） */
  let r6 = await run(`(() => {
    renderTree(${JSON.stringify(TMP)});
    return new Promise(res => setTimeout(() => res({
      files: Array.from(document.querySelectorAll('#tree li[data-is-dir=""]')).map(li => li.dataset.path),
      dirs: Array.from(document.querySelectorAll('#tree li[data-is-dir="1"]')).map(li => li.dataset.path)
    }), 400));
  })()`);
  ok(r6.files.length === 2 && r6.files.includes(path.join(TMP, 'x.md')) && r6.files.includes(path.join(TMP, 'b.md')), 'tree: 真实目录文件列表', r6);
  ok(r6.dirs.length === 1 && r6.dirs[0] === path.join(TMP, 'sub2'), 'tree: 真实目录子目录', r6);

  finish();
}).catch(err => {
  LOG.push('TEST CRASH: ' + (err && err.stack || err));
  finish();
});

function finish() {
  LOG.push(failures === 0 ? 'ALL IPC TESTS PASSED' : failures + ' IPC TEST(S) FAILED');
  fs.writeFileSync(LOG_FILE, LOG.join('\n'));
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* noop */ }
  setTimeout(() => app.exit(failures === 0 ? 0 : 1), 200);
}
