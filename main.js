const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let pendingFile = null;

app.setName('Markdown Viewer');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Markdown Viewer',
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
    mainWindow.show();
    if (pendingFile) { sendOpen(pendingFile); pendingFile = null; }
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

if (process.defaultApp || !app.isPackaged) {
  const arg = process.argv.find(a => /\.(md|markdown|mdown|mkd)$/i.test(a) && !a.startsWith('-'));
  if (arg) pendingFile = path.resolve(arg);
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.on('open-file', (e, filePath) => {
      e.preventDefault();
      if (mainWindow && !mainWindow.webContents.isLoading()) sendOpen(filePath);
      else pendingFile = filePath;
    });
  }
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

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
