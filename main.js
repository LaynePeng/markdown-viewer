const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const GITHUB_URL = 'https://github.com/LaynePeng/markdown-viewer';

let mainWindow = null;
let pendingFile = null;
let windowReady = false;

let watchedFile = null;
let dirWatcher = null;
let dirWatchTimer = null;
let fileWatchTimer = null;
const WATCH_DEBOUNCE = 200;

app.setName('Markdown Viewer');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Markdown Viewer',
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    windowReady = true;
    mainWindow.show();
    if (pendingFile) { sendOpen(pendingFile); pendingFile = null; }
  });
  mainWindow.on('closed', () => { mainWindow = null; windowReady = false; stopWatching(); });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* macOS：冷启动（双击/命令行）时系统会尽早发出 open-file 事件，
   必须在本模块顶层注册，避免事件在窗口就绪前被丢弃 */
app.on('open-file', (e, filePath) => {
  e.preventDefault();
  if (mainWindow && windowReady) sendOpen(filePath);
  else pendingFile = filePath;
});

/* 命令行传参：打包版也生效（Windows 双击走 argv，macOS 命令行传参） */
const arg = process.argv.find(a => /\.(md|markdown|mdown|mkd)$/i.test(a) && !a.startsWith('-'));
if (arg) pendingFile = path.resolve(arg);

/* 单实例锁：Windows 上应用已运行时再双击 .md 关联文件，
   复用现有窗口定位文件，而不是启动第二个实例 */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const f = argv.find(a => /\.(md|markdown|mdown|mkd)$/i.test(a) && !a.startsWith('-'));
    if (f) {
      if (mainWindow && windowReady) sendOpen(path.resolve(f));
      else pendingFile = path.resolve(f);
    } else if (mainWindow) {
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    setupMenu();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}

/* ---------- About 菜单 ---------- */
function showAbout() {
  mainWindow?.webContents.send('show-about');
}

ipcMain.handle('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
  return { ok: true };
});

function setupMenu() {
  const isMac = process.platform === 'darwin';
  const aboutItem = {
    label: '关于 Markdown Viewer',
    click: showAbout
  };
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        aboutItem,
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    ...(isMac ? [] : [{ role: 'help', submenu: [aboutItem] }])
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

function sendOpen(filePath) {
  mainWindow.webContents.send('open-file', filePath);
  mainWindow.focus();
}

ipcMain.on('open-directory', (e, dir) => {

  mainWindow?.webContents.send('open-directory', dir);
});

ipcMain.handle('choose-open-file', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }]
  });
  return { ok: !r.canceled && !!r.filePaths[0], path: r.filePaths[0] || null };
});

ipcMain.handle('choose-open-directory', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return { ok: !r.canceled && !!r.filePaths[0], path: r.filePaths[0] || null };
});

const MD_EXT = new Set(['.md', '.markdown', '.mdown', '.mkd']);

ipcMain.handle('read-dir', async (_e, dirPath) => {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true }).catch(() => null);
  if (!entries) return { ok: false };
  const items = entries
    .filter(d => !d.name.startsWith('.'))
    .filter(d => d.isDirectory() || MD_EXT.has(path.extname(d.name).toLowerCase()))
    .map(d => ({ name: d.name, path: path.join(dirPath, d.name), isDir: d.isDirectory(), ext: path.extname(d.name).toLowerCase() }))
    .sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name, 'zh'));
  return { ok: true, items };
});

ipcMain.handle('read-file', async (_e, filePath) => {
  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) return { ok: false };
  try {
    return { ok: true, content: await fs.promises.readFile(filePath, 'utf8') };
  } catch {
    return { ok: false, error: '无法读取（可能是二进制文件）' };
  }
});

ipcMain.handle('write-file', async (_e, filePath, content) => {
  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) return { ok: false, error: '目标不是有效文件' };
  try {
    await fs.promises.writeFile(filePath, String(content), 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: '保存失败：' + (err && err.message ? err.message : String(err)) };
  }
});

/* ---------- 监听文件修改 / 目录变化 ---------- */
function stopWatching() {
  if (dirWatchTimer) { clearTimeout(dirWatchTimer); dirWatchTimer = null; }
  if (fileWatchTimer) { clearTimeout(fileWatchTimer); fileWatchTimer = null; }
  if (dirWatcher) {
    try { dirWatcher.close(); } catch { /* noop */ }
    dirWatcher = null;
  }
  watchedFile = null;
}

function notifyFileChanged() {
  if (fileWatchTimer) clearTimeout(fileWatchTimer);
  fileWatchTimer = setTimeout(() => {
    fileWatchTimer = null;
    if (watchedFile) mainWindow?.webContents.send('file-changed', watchedFile);
  }, WATCH_DEBOUNCE);
}

function notifyTreeChanged() {
  if (dirWatchTimer) clearTimeout(dirWatchTimer);
  dirWatchTimer = setTimeout(() => {
    dirWatchTimer = null;
    if (watchedFile) mainWindow?.webContents.send('tree-changed', path.dirname(watchedFile));
  }, WATCH_DEBOUNCE);
}

function startWatching(filePath) {
  if (watchedFile === filePath && dirWatcher) return;
  stopWatching();
  watchedFile = filePath;
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const setup = () => {
    try {
      dirWatcher = fs.watch(dir, (_event, filename) => {
        if (!filename) {
          notifyTreeChanged();
          return;
        }
        const name = String(filename);
        if (name === base) {
          notifyFileChanged();
          notifyTreeChanged();
        } else if (!name.startsWith('.') && (MD_EXT.has(path.extname(name).toLowerCase()) || !path.extname(name))) {
          notifyTreeChanged();
        }
      });
      dirWatcher.on('error', () => { stopWatching(); });
    } catch {
      dirWatcher = null;
    }
  };
  setup();
}

ipcMain.handle('watch-file', (_e, filePath) => {
  if (!filePath) { stopWatching(); return { ok: true }; }
  if (!watchedFile || path.dirname(filePath) !== path.dirname(watchedFile) || path.basename(filePath) !== path.basename(watchedFile)) {
    startWatching(filePath);
  }
  return { ok: true };
});
