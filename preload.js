const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('mdv', {
  chooseDir: () => ipcRenderer.invoke('choose-open-directory'),
  chooseFile: () => ipcRenderer.invoke('choose-open-file'),
  readDir: (d) => ipcRenderer.invoke('read-dir', d),
  readFile: (f) => ipcRenderer.invoke('read-file', f),
  writeFile: (f, c) => ipcRenderer.invoke('write-file', f, c),
  watchFile: (f) => ipcRenderer.invoke('watch-file', f),
  openExternal: (u) => ipcRenderer.invoke('open-external', u),
  filePathFor: (f) => webUtils.getPathForFile(f),
  onOpenFile: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('open-file', h);
    return () => ipcRenderer.removeListener('open-file', h);
  },
  onShowAbout: (cb) => {
    const h = () => cb();
    ipcRenderer.on('show-about', h);
    return () => ipcRenderer.removeListener('show-about', h);
  },
  onFileChanged: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('file-changed', h);
    return () => ipcRenderer.removeListener('file-changed', h);
  },
  onTreeChanged: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('tree-changed', h);
    return () => ipcRenderer.removeListener('tree-changed', h);
  }
});