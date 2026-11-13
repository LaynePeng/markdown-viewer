/* 测试桩：模拟 preload 暴露的 window.mdv。
   readDir 读取内存中的假目录树（路径 → {名字: {isDir, mtime}}），
   rename / trash 会真正修改目录树，使 renderTree 刷新后能看到效果。
   调用记录通过 __getCalls 暴露给页面上下文。 */
const { contextBridge } = require('electron');

const calls = [];

const dirs = {
  '/fake/root': {
    sub: { isDir: true, mtime: 1 },
    'a.md': { isDir: false, mtime: 2 },
    'b.md': { isDir: false, mtime: 3 }
  },
  '/fake/root/sub': {
    'c.md': { isDir: false, mtime: 4 }
  }
};

function listDir(dir) {
  const node = dirs[dir];
  if (!node) return { ok: false };
  const items = [];
  for (const [name, meta] of Object.entries(node)) {
    items.push({
      name,
      path: dir + '/' + name,
      isDir: meta.isDir,
      ext: meta.isDir ? '' : (name.slice(name.lastIndexOf('.')) || ''),
      mtime: meta.mtime
    });
  }
  return { ok: true, items };
}

function parentOf(p) { return p.slice(0, p.lastIndexOf('/')); }
function baseOf(p) { return p.slice(p.lastIndexOf('/') + 1); }

/* 目录改名后，其子孙目录的键也要跟着换前缀 */
function rekeyDirChildren(oldPath, newPath) {
  const prefix = oldPath + '/';
  for (const key of Object.keys(dirs)) {
    if (key.startsWith(prefix)) {
      dirs[newPath + key.slice(oldPath.length)] = dirs[key];
      delete dirs[key];
    }
  }
}

contextBridge.exposeInMainWorld('mdv', {
  chooseDir: () => Promise.resolve({ ok: false }),
  chooseFile: () => Promise.resolve({ ok: false }),
  readDir: (d) => Promise.resolve(listDir(d)),
  readFile: (f) => Promise.resolve(f && baseOf(f) === 'a.md' ? { ok: true, content: '# A\n' } : { ok: false }),
  writeFile: () => Promise.resolve({ ok: false }),
  watchFile: () => Promise.resolve({ ok: true }),
  openExternal: () => Promise.resolve({ ok: true }),
  revealItem: (p) => { calls.push(['reveal', p]); return Promise.resolve({ ok: true }); },
  openPath: (p) => { calls.push(['open', p]); return Promise.resolve({ ok: true }); },
  renameItem: (oldPath, newName) => {
    calls.push(['rename', oldPath, newName]);
    const parent = dirs[parentOf(oldPath)];
    const oldName = baseOf(oldPath);
    if (!parent || !parent[oldName]) return Promise.resolve({ ok: false, error: '原路径不存在' });
    if (parent[newName]) return Promise.resolve({ ok: false, error: '已存在同名文件或文件夹' });
    parent[newName] = parent[oldName];
    delete parent[oldName];
    const newPath = parentOf(oldPath) + '/' + newName;
    if (parent[newName].isDir) {
      dirs[newPath] = dirs[oldPath] || {};
      delete dirs[oldPath];
      rekeyDirChildren(oldPath, newPath);
    }
    return Promise.resolve({ ok: true, path: newPath });
  },
  trashItem: (p) => {
    calls.push(['trash', p]);
    const parent = dirs[parentOf(p)];
    const name = baseOf(p);
    if (!parent || !parent[name]) return Promise.resolve({ ok: false, error: '路径不存在' });
    const wasDir = parent[name].isDir;
    delete parent[name];
    if (wasDir) {
      delete dirs[p];
      for (const key of Object.keys(dirs)) {
        if (key.startsWith(p + '/')) delete dirs[key];
      }
    }
    return Promise.resolve({ ok: true });
  },
  getVersion: () => Promise.resolve('0.0.0-test'),
  associateFiles: () => Promise.resolve({ ok: false }),
  filePathFor: () => null,
  onOpenFile: () => () => {},
  onShowAbout: () => () => {},
  onFileChanged: () => () => {},
  onTreeChanged: () => () => {},
  __getCalls: () => calls.slice()
});
