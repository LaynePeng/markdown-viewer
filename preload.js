const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('mdv', {
  chooseDir: () => ipcRenderer.invoke('choose-open-directory'),
  chooseFile: () => ipcRenderer.invoke('choose-open-file'),
  readDir: (d) => ipcRenderer.invoke('read-dir', d),
  readFile: (f) => ipcRenderer.invoke('read-file', f),
  filePathFor: (f) => webUtils.getPathForFile(f),
  onOpenFile: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('open-file', h);
    return () => ipcRenderer.removeListener('open-file', h);
  }
});