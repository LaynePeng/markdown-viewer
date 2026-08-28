const { marked } = window.marked;
const api = window.mdv;

const $ = (s, r = document) => r.querySelector(s);

const treeEl = $('#tree');
const dirNameEl = $('#dir-name');
const filePathEl = $('#file-path');
const titleEl = $('#file-title');
const docEl = $('#doc');
const emptyEl = $('#empty');
const dropOverlay = $('#drop-overlay');
const settingsPanel = $('#settings-panel');
const cssFileName = $('#cssfile-name');
const modalEl = $('#diagram-modal');
const zoomBody = $('#diagram-zoom');
const btnEdit = $('#btn-edit');
const btnSave = $('#btn-save');
const editorEl = $('#editor');
const editorPane = $('#editor-pane');

const state = { root: null, expanded: new Set(), active: null, mermaidItems: [], dir: '', raw: '', editing: false, dirty: false };

const ICONS = {
  dir: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/></svg>',
  dirOpen: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2.6 1h4.1c.3 0 .6.1.8.3l.9 1.2c.2.3.5.5.8.5h4.2c.9 0 1.6.7 1.6 1.6V13c0 .9-.7 1.6-1.6 1.6H2.6c-.9 0-1.6-.7-1.6-1.6V2.6C1 1.7 1.7 1 2.6 1Z"/><path d="M.5 5.5h15"/></svg>',
  file: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg>'
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isMarkdown(p) {
  return /\.(md|markdown|mdown|mkd)$/i.test(p);
}

function renderTree(root) {
  state.root = root;
  treeEl.innerHTML = '';
  dirNameEl.textContent = basename(root);
  dirNameEl.title = root;
  const ul = document.createElement('ul');
  treeEl.appendChild(ul);
  loadLevel(root, ul);
  if (state.active) highlightTree(state.active);
}

async function loadLevel(dir, ul) {
  ul.dataset.loading = '1';
  const r = await api.readDir(dir);
  if (!r.ok) return;
  for (const it of r.items) {
    ul.appendChild(nodeOf(it));
  }
}

function nodeOf(it) {
  const li = document.createElement('li');
  li.dataset.isDir = it.isDir ? '1' : '';
  if (it.isDir) {
    const span = document.createElement('span');
    span.className = 'dir';
    span.innerHTML = ICONS.dir + '<span class="nm">' + esc(it.name) + '</span>';
    li.appendChild(span);
    const sub = document.createElement('ul');
    li.appendChild(sub);
    li.addEventListener('click', async (e) => {
      e.stopPropagation();
      const opened = li.classList.toggle('open');
      if (opened) {
        state.expanded.add(it.path);
        span.innerHTML = ICONS.dirOpen + '<span class="nm">' + esc(it.name) + '</span>';
        if (sub.dataset.loaded !== '1') await loadLevel(it.path, sub);
      } else {
        state.expanded.delete(it.path);
        span.innerHTML = ICONS.dir + '<span class="nm">' + esc(it.name) + '</span>';
      }
    });
} else {
    const span = document.createElement('span');
    span.className = 'file';
    span.innerHTML = ICONS.file + '<span class="nm">' + esc(it.name) + '</span>';
    li.appendChild(span);
    li.addEventListener('click', () => {
      treeEl.querySelectorAll('li.active').forEach(l => l.classList.remove('active'));
      li.classList.add('active');
      openLocal(it.path);
    });
  }
  if (state.expanded.has(it.path)) li.classList.add('open');
  return li;
}

async function openLocal(p) {
  if (!isMarkdown(p)) return;
  const r = await api.readFile(p);
  if (!r.ok) return showEmpty(p);
  openDocument(p, r.content);
}

/* ---------- 相对路径图片 ---------- */
function toFileUrl(p) {
  let s = encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');
  if (/^[A-Za-z]:\//.test(s)) s = '/' + s;
  return 'file://' + s;
}

function resolveAssetUrl(href) {
  if (!href) return href;
  if (/^(https?:|data:|file:|blob:|mailto:|#)/i.test(href)) return href;
  let clean = href.replace(/\\/g, '/').replace(/^\.\//, '');
  if (clean.startsWith('/') || /^[A-Za-z]:\//.test(clean)) return toFileUrl(clean);
  const parts = [];
  for (const s of clean.split('/')) {
    if (!s || s === '.') continue;
    if (s === '..') parts.pop();
    else parts.push(s);
  }
  return toFileUrl(state.dir + '/' + parts.join('/'));
}

const mdRenderer = new window.marked.Renderer();
mdRenderer.image = ({ href, title, text }) => {
  const src = resolveAssetUrl(href);
  const alt = text ? esc(text) : '';
  const t = title ? ' title="' + esc(title) + '"' : '';
  return '<img src="' + src + '" alt="' + alt + '"' + t + ' loading="lazy">';
};

function renderMarkdown(content) {
  docEl.innerHTML = marked.parse(content, { gfm: true, breaks: true, renderer: mdRenderer });
  docEl.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (!src) return;
    const abs = resolveAssetUrl(src);
    if (abs !== src) img.setAttribute('src', abs);
  });
  collectMermaid();
  docEl.querySelectorAll('pre code').forEach(b => {
    if (window.hljs && !b.classList.contains('hljs')) window.hljs.highlightElement(b);
  });
  renderMermaid();
  docEl.hidden = false;
  emptyEl.hidden = true;
}

async function openDocument(filePath, content) {
  state.active = filePath;
  state.dir = filePath.replace(/[\\/][^\\/]*$/, '');
  state.raw = content;
  titleEl.hidden = false;
  titleEl.textContent = basename(filePath);
  titleEl.title = filePath;
  document.title = basename(filePath);
  filePathEl.textContent = filePath;
  filePathEl.title = filePath;
  highlightTree(filePath);
  renderMarkdown(content);
  editorEl.value = content;
  state.dirty = false;
  exitEdit();
  api.watchFile(filePath);
  docEl.scrollTop = 0;
}

/* ---------- Mermaid ---------- */
let mermaidSeq = 0;

function mermaidTheme() {
  return cfg.theme === 'dark' ? 'dark' : 'default';
}

function collectMermaid() {
  state.mermaidItems = [];
  docEl.querySelectorAll('pre code.language-mermaid').forEach(code => {
    const pre = code.closest('pre');
    const wrap = document.createElement('div');
    wrap.className = 'mermaid-wrap';
    wrap.title = '点击放大';
    pre.replaceWith(wrap);
    state.mermaidItems.push({ src: code.textContent, wrap });
  });
}

async function renderMermaid() {
  if (!window.mermaid || state.mermaidItems.length === 0) return;
  try {
    mermaid.initialize({ startOnLoad: false, theme: mermaidTheme(), securityLevel: 'strict' });
  } catch { return; }
  for (const it of state.mermaidItems) {
    const id = 'mmd-' + (++mermaidSeq);
    it.wrap.innerHTML = '';
    it.wrap.onclick = () => openDiagram(it.wrap);
    try {
      const { svg } = await mermaid.render(id, it.src);
      it.wrap.innerHTML = svg;
    } catch (err) {
      it.wrap.className = 'mermaid-error';
      it.wrap.textContent = 'Mermaid 渲染失败：' + (err && err.message ? err.message : String(err));
    }
  }
}

/* ---------- 放大查看 ---------- */
let zoomScale = 1;
let zoomFit = 1;
let zoomPanX = 0;
let zoomPanY = 0;
let zoomNatW = 800;
let zoomNatH = 600;
let zoomStage = null;

function openDiagram(wrap) {
  const svg = wrap.querySelector('svg');
  if (!svg) return;
  const vb = svg.viewBox.baseVal;
  zoomNatW = (vb && vb.width) || Number(svg.getAttribute('width')) || 800;
  zoomNatH = (vb && vb.height) || Number(svg.getAttribute('height')) || 600;
  zoomBody.innerHTML = '';
  zoomStage = document.createElement('div');
  zoomStage.className = 'zoom-stage';
  zoomStage.appendChild(svg.cloneNode(true));
  zoomBody.appendChild(zoomStage);
  modalEl.hidden = false;
  zoomFit = 1;
  zoomScale = 1;
  requestAnimationFrame(fitDiagram);
}

function fitDiagram() {
  if (!zoomStage || modalEl.hidden) return;
  const bw = zoomBody.clientWidth;
  const bh = zoomBody.clientHeight;
  zoomFit = Math.max(Math.min(bw / zoomNatW, bh / zoomNatH), 0.05);
  zoomScale = zoomFit;
  zoomPanX = 0;
  zoomPanY = 0;
  applyZoomTransform();
}

function applyZoomTransform() {
  if (!zoomStage) return;
  const w = zoomNatW * zoomScale;
  const h = zoomNatH * zoomScale;
  const bw = zoomBody.clientWidth;
  const bh = zoomBody.clientHeight;
  zoomStage.style.width = w + 'px';
  zoomStage.style.height = h + 'px';
  let tx = zoomPanX;
  let ty = zoomPanY;
  if (w <= bw) tx = (bw - w) / 2;
  if (h <= bh) ty = (bh - h) / 2;
  zoomStage.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
}

function zoomDiagram(factor) {
  const prev = zoomScale;
  zoomScale = Math.min(Math.max(zoomScale * factor, zoomFit * 0.3), zoomFit * 8);
  const k = zoomScale / prev;
  const bw = zoomBody.clientWidth / 2;
  const bh = zoomBody.clientHeight / 2;
  zoomPanX = bw - (bw - zoomPanX) * k;
  zoomPanY = bh - (bh - zoomPanY) * k;
  applyZoomTransform();
}

zoomBody.addEventListener('wheel', (e) => {
  if (modalEl.hidden) return;
  e.preventDefault();
  zoomDiagram(e.deltaY < 0 ? 1.2 : 1 / 1.2);
}, { passive: false });

let zoomDrag = null;
zoomBody.addEventListener('pointerdown', (e) => {
  if (modalEl.hidden || e.button !== 0) return;
  zoomDrag = { x: e.clientX - zoomPanX, y: e.clientY - zoomPanY };
  zoomStage.classList.add('dragging');
  try { zoomBody.setPointerCapture(e.pointerId); } catch { /* noop */ }
});
zoomBody.addEventListener('pointermove', (e) => {
  if (!zoomDrag) return;
  zoomPanX = e.clientX - zoomDrag.x;
  zoomPanY = e.clientY - zoomDrag.y;
  applyZoomTransform();
});
zoomBody.addEventListener('pointerup', () => {
  zoomDrag = null;
  if (zoomStage) zoomStage.classList.remove('dragging');
});

$('#zoom-in').addEventListener('click', () => zoomDiagram(1.25));
$('#zoom-out').addEventListener('click', () => zoomDiagram(1 / 1.25));
$('#zoom-fit').addEventListener('click', fitDiagram);
window.addEventListener('resize', () => { if (!modalEl.hidden) fitDiagram(); });

function closeDiagram() {
  modalEl.hidden = true;
  zoomBody.innerHTML = '';
  zoomStage = null;
  zoomDrag = null;
}

$('#btn-close-modal').addEventListener('click', closeDiagram);
modalEl.addEventListener('click', (e) => {
  if (e.target === modalEl || e.target.classList.contains('modal-backdrop')) closeDiagram();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalEl.hidden) closeDiagram();
  if (e.key === 'Escape' && !aboutModal.hidden) closeAbout();
});
/* ---------- About 弹窗 ---------- */
const GITHUB_URL = 'https://github.com/LaynePeng/markdown-viewer';
const aboutModal = $('#about-modal');

function closeAbout() { aboutModal.hidden = true; }

api.onShowAbout(() => { aboutModal.hidden = false; });
$('#btn-close-about').addEventListener('click', closeAbout);
$('#btn-about-github').addEventListener('click', () => api.openExternal(GITHUB_URL));
$('#about-github').addEventListener('click', (e) => { e.preventDefault(); api.openExternal(GITHUB_URL); });
const btnAssociate = $('#btn-associate-files');
const associateStatus = $('#associate-status');
btnAssociate.addEventListener('click', async () => {
  if (btnAssociate.disabled) return;
  btnAssociate.disabled = true;
  const idleText = btnAssociate.textContent;
  btnAssociate.textContent = '正在关联…';
  associateStatus.hidden = true;
  const r = await api.associateFiles();
  btnAssociate.textContent = idleText;
  btnAssociate.disabled = false;
  associateStatus.textContent = r.message;
  associateStatus.classList.toggle('ok', !!r.ok);
  associateStatus.hidden = false;
});
aboutModal.addEventListener('click', (e) => {
  if (e.target === aboutModal || e.target.classList.contains('modal-backdrop')) closeAbout();
});

document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    saveDoc();
  } else if (e.key === 'e' || e.key === 'E') {
    e.preventDefault();
    toggleEdit();
  }
});

function basename(p) { return p.split(/[\\/]/).pop(); }

function highlightTree(filePath) {
  const nm = basename(filePath);
  treeEl.querySelectorAll('li.active').forEach(l => l.classList.remove('active'));
  treeEl.querySelectorAll('li .file .nm').forEach(s => {
    if (s.textContent === nm) s.closest('li').classList.add('active');
  });
}

function showEmpty(title) {
  docEl.hidden = true;
  emptyEl.hidden = false;
  emptyEl.querySelector('h2').textContent = title || 'Markdown Viewer';
  document.title = 'Markdown Viewer';
  exitEdit();
  state.active = null;
  api.watchFile(null);
}

/* ---------- 编辑模式 ---------- */
let previewTimer = null;

function updateEditButtons() {
  btnEdit.disabled = !state.active;
  const editing = state.editing;
  btnEdit.innerHTML = (editing
    ? '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M8 1.5a6.5 6.5 0 1 1-6.48 7.2.75.75 0 0 1 1.47-.3A5 5 0 1 0 8 3a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1 0-1.5h1.9A6.48 6.48 0 0 1 8 1.5Z"/></svg>预览'
    : '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474L7.293 12.27a.75.75 0 0 1-.35.204l-3.38.845a.75.75 0 0 1-.927-.927l.845-3.38a.75.75 0 0 1 .204-.35L11.013 1.427Z"/></svg>编辑');
  btnEdit.title = editing ? '退出编辑模式' : '编辑模式（左右分屏）';
  btnSave.disabled = !(state.active && state.editing && state.dirty);
  btnSave.querySelector('.lbl').textContent = state.editing && state.dirty ? '保存*' : '保存';
}

function enterEdit() {
  if (!state.active) return;
  state.editing = true;
  document.body.classList.add('editing');
  $('#content').classList.add('editing');
  editorPane.hidden = false;
  updateEditButtons();
  editorEl.focus();
}

function exitEdit() {
  state.editing = false;
  document.body.classList.remove('editing');
  $('#content').classList.remove('editing');
  editorPane.hidden = true;
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  updateEditButtons();
}

function toggleEdit() {
  if (state.editing) exitEdit();
  else enterEdit();
}

/* ---------- 分屏分割线拖动 ---------- */
const dividerEl = $('#divider');
let dividerDragging = false;

function applyEditorWidth(pct) {
  $('#content').style.setProperty('--editor-w', pct + '%');
}

function setEditorWidth(pct) {
  const v = Math.min(80, Math.max(15, pct));
  applyEditorWidth(v);
  cfg.editorW = Math.round(v);
  saveCfg();
}

dividerEl.addEventListener('pointerdown', (e) => {
  dividerDragging = true;
  dividerEl.classList.add('dragging');
  document.body.classList.add('resizing');
  try { dividerEl.setPointerCapture(e.pointerId); } catch { /* noop */ }
  e.preventDefault();
});
dividerEl.addEventListener('pointermove', (e) => {
  if (!dividerDragging) return;
  const dc = $('#doc-container').getBoundingClientRect();
  if (dc.width <= 0) return;
  setEditorWidth(((e.clientX - dc.left) / dc.width) * 100);
});
['pointerup', 'pointercancel'].forEach(ev => dividerEl.addEventListener(ev, () => {
  dividerDragging = false;
  dividerEl.classList.remove('dragging');
  document.body.classList.remove('resizing');
}));

let suppressUntil = 0;

async function saveDoc() {
  if (!state.active || !state.editing || !state.dirty) return;
  const r = await api.writeFile(state.active, editorEl.value);
  if (!r.ok) {
    alert(r.error || '保存失败');
    return;
  }
  suppressUntil = Date.now() + 500;
  state.raw = editorEl.value;
  state.dirty = false;
  updateEditButtons();
  renderMarkdown(state.raw);
}

function onEditorInput() {
  state.dirty = true;
  updateEditButtons();
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => renderMarkdown(editorEl.value), 200);
}

/* ---------- 自动刷新 ---------- */
let fileRefreshTimer = null;
let treeRefreshTimer = null;

api.onFileChanged(p => {
  if (!state.active || p !== state.active) return;
  if (fileRefreshTimer) clearTimeout(fileRefreshTimer);
  fileRefreshTimer = setTimeout(async () => {
    if (Date.now() < suppressUntil) return;
    if (state.editing && state.dirty) {
      renderMarkdown(editorEl.value);
      return;
    }
    const st = docEl.scrollTop;
    const r = await api.readFile(state.active);
    if (!r.ok) return showEmpty(state.active);
    state.raw = r.content;
    editorEl.value = r.content;
    state.dirty = false;
    updateEditButtons();
    renderMarkdown(r.content);
    docEl.scrollTop = st;
  }, 150);
});

api.onTreeChanged(dir => {
  if (!state.root) return;
  if (dir !== state.root && !dir.startsWith(state.root + '/')) return;
  if (treeRefreshTimer) clearTimeout(treeRefreshTimer);
  treeRefreshTimer = setTimeout(() => renderTree(state.root), 200);
});

async function chooseDir() {
  const r = await api.chooseDir();
  if (r.ok) setDir(r.path);
}

async function chooseDoc() {
  const r = await api.chooseFile();
  if (r.ok) setupTreeAround(r.path);
}

async function setupTreeAround(filePath) {
  if (!isMarkdown(filePath)) return;
  const parts = filePath.split(/[\\/]/);
  const dir = parts.slice(0, -1).join('/');
  if (!dir) return;
  const r = await api.readDir(dir);
  if (r.ok) {
    renderTree(dir);
    state.expanded.add(dir);
  }
  const fr = await api.readFile(filePath);
  if (fr.ok) openDocument(filePath, fr.content);
  else showEmpty(filePath);
}

function setDir(dir) {
  state.active = null;
  renderTree(dir);
  showEmpty();
}

async function handleDrop(e) {
  e.preventDefault();
  hideOverlay();
  const f = e.dataTransfer.files[0];
  if (!f) return;
  const p = api.filePathFor(f);
  if (!p) return;
  if (isMarkdown(p)) {
    const st = await api.readFile(p);
    if (st.ok) { setupTreeAround(p); return; }
  }
  const rd = await api.readDir(p);
  if (rd.ok) setDir(p);
}

function showOverlay() { dropOverlay.hidden = false; }
function hideOverlay() { dropOverlay.hidden = true; }

/* ---------- 外观定制 ---------- */
const defaultCfg = { theme: 'light', fontsize: 16, width: 800, editorW: 45 };

function loadCfg() {
  try { return { ...defaultCfg, ...JSON.parse(localStorage.getItem('mdv-cfg') || '{}') }; }
  catch { return { ...defaultCfg }; }
}

let cfg = loadCfg();

function saveCfg() { localStorage.setItem('mdv-cfg', JSON.stringify(cfg)); }

function applyCfg() {
  document.body.dataset.theme = cfg.theme;
  document.documentElement.style.setProperty('--fontsize', cfg.fontsize + 'px');
  docEl.style.maxWidth = cfg.width + 'px';
  applyEditorWidth(cfg.editorW || 45);
  $('#set-theme').value = cfg.theme;
  $('#set-fontsize').value = cfg.fontsize;
  $('#set-width').value = cfg.width;
  document.querySelectorAll('link[data-code-theme]').forEach(l => {
    l.disabled = l.dataset.codeTheme !== cfg.theme;
  });
}

function applyCustomCss(content) {
  let el = $('#custom-css');
  if (!el) { el = document.createElement('style'); el.id = 'custom-css'; document.head.appendChild(el); }
  el.textContent = content || '';
}

const initCustomCss = applyCustomCss;
const cssFileInput = $('#set-cssfile');
const cssFileNameEl = $('#cssfile-name');

/* ---------- 事件绑定 ---------- */
$('#btn-open').addEventListener('click', chooseDoc);
$('#btn-dir').addEventListener('click', chooseDir);
btnEdit.addEventListener('click', toggleEdit);
btnSave.addEventListener('click', saveDoc);
editorEl.addEventListener('input', onEditorInput);
$('#btn-collapse').addEventListener('click', () => {
  treeEl.querySelectorAll('li.open').forEach(li => li.classList.remove('open'));
  state.expanded.clear();
});
$('#btn-toggle-tree').addEventListener('click', () => document.body.classList.toggle('tree-hidden'));
$('#btn-settings').addEventListener('click', () => { settingsPanel.hidden = !settingsPanel.hidden; });
$('#btn-close-settings').addEventListener('click', () => { settingsPanel.hidden = true; });
$('#btn-reset').addEventListener('click', () => {
  cfg = { ...defaultCfg };
  saveCfg(); applyCfg(); applyCustomCss('');
  cssFileNameEl.hidden = true;
  renderMermaid();
});
settingsPanel.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'set-theme') cfg.theme = el.value;
  else if (el.id === 'set-fontsize') cfg.fontsize = Number(el.value);
  else if (el.id === 'set-width') cfg.width = Number(el.value);
  saveCfg(); applyCfg();
  renderMermaid();
});
cssFileInput.addEventListener('change', async () => {
  const f = cssFileInput.files[0];
  if (!f) return;
  const p = api.filePathFor(f);
  const r = await api.readFile(p);
  if (r.ok) {
    cfg.customCss = p; saveCfg();
    initCustomCss(r.content);
    cssFileNameEl.textContent = f.name;
  }
});

/* ---------- 打开事件（主进程/双击/命令行/已运行） ---------- */
api.onOpenFile(path => setupTreeAround(path));


/* ---------- 拖放 ---------- */
window.addEventListener('dragenter', e => { e.preventDefault(); showOverlay(); });
window.addEventListener('dragover', e => { e.preventDefault(); });
window.addEventListener('dragleave', e => { if (e.relatedTarget === null) hideOverlay(); });
window.addEventListener('drop', handleDrop);
document.addEventListener('click', (e) => {
  if (!settingsPanel.hidden && !settingsPanel.contains(e.target) && !e.target.closest('#btn-settings')) settingsPanel.hidden = true;
});

/* ---------- 初始化 ---------- */
applyCfg();
if (cfg.customCss) {
  api.readFile(cfg.customCss).then(r => { if (r.ok) initCustomCss(r.content); cssFileNameEl.textContent = cfg.customCss; });
}
showEmpty();