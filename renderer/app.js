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
const wysiwygEl = $('#wysiwyg');
const tbModeToggle = $('#tb-mode-toggle');
const findBar = $('#find-bar');
const findInput = $('#find-input');
const findCount = $('#find-count');
const findPrevBtn = $('#find-prev');
const findNextBtn = $('#find-next');
const findCloseBtn = $('#find-close');
const tabsEl = $('#tabs');
const sortSelect = $('#sort-select');
const sortDirBtn = $('#sort-dir');

const state = { root: null, expanded: new Set(), active: null, mermaidItems: [], dir: '', sortBy: 'name', sortDir: 'asc' };
const tabs = [];
let activeTabId = null;
let tabSeq = 0;

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

function sortItems(items) {
  return items.slice().sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let cmp;
    if (state.sortBy === 'mtime') cmp = (a.mtime || 0) - (b.mtime || 0);
    else cmp = a.name.localeCompare(b.name, 'zh');
    return state.sortDir === 'desc' ? -cmp : cmp;
  });
}

function naturalSortDir() {
  return state.sortBy === 'mtime' ? 'desc' : 'asc';
}

function updateSortUI() {
  sortSelect.value = state.sortBy;
  sortDirBtn.textContent = state.sortDir === 'desc' ? '↓' : '↑';
  sortDirBtn.title = state.sortDir === 'desc' ? '当前：倒序，点击切换正序' : '当前：正序，点击切换倒序';
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
  for (const it of sortItems(r.items)) {
    ul.appendChild(nodeOf(it));
  }
}

function nodeOf(it) {
  const li = document.createElement('li');
  li.dataset.isDir = it.isDir ? '1' : '';
  li.dataset.path = it.path;
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
    let clickTimer = null;
    li.addEventListener('click', (e) => {
      e.stopPropagation();
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        openLocal(it.path, true);
        return;
      }
      clickTimer = setTimeout(() => {
        clickTimer = null;
        openLocal(it.path, false);
      }, 220);
    });
  }
  if (state.expanded.has(it.path)) li.classList.add('open');
  return li;
}

async function openLocal(p, newTab) {
  if (!isMarkdown(p)) return;
  const r = await api.readFile(p);
  if (!r.ok) return showEmpty(p);
  if (newTab) {
    addTab(p, r.content);
  } else {
    const existing = tabs.find(t => t.filePath === p);
    if (existing) {
      switchTab(existing.id);
    } else if (tabs.length > 0) {
      const tab = getActiveTab();
      if (tab) {
        tab.filePath = p;
        tab.raw = r.content;
        tab.editorContent = r.content;
        tab.dirty = false;
        tab.editing = false;
        tab.scrollTop = 0;
        tab.editorScrollTop = 0;
        switchTab(tab.id);
      }
    } else {
      addTab(p, r.content);
    }
  }
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

function fileUrlToPath(u) {
  let p = decodeURIComponent(u);
  p = p.replace(/^file:\/\//i, '');
  if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
  return p;
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
  if (!findBar.hidden && findInput.value) doFind(false);
}

/* ---------- Tab 管理 ---------- */
function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
}

function saveTabState(tab) {
  if (!tab) return;
  tab.scrollTop = docEl.scrollTop;
  tab.editorScrollTop = editorEl.scrollTop;
  tab.editorContent = tab.editMode === 'wysiwyg' ? htmlToMarkdown(wysiwygEl.innerHTML) : editorEl.value;
}

function renderTabBar() {
  tabsEl.innerHTML = '';
  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeTabId ? ' active' : '') + (tab.error ? ' error' : '');
    if (tab.error) el.title = '无法打开：' + tab.error;
    el.innerHTML = '<span class="tab-name">' + esc(basename(tab.filePath)) + '</span>'
      + (tab.dirty ? '<span class="dot"></span>' : '')
      + '<button class="tab-close" title="关闭">✕</button>';
    el.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.addEventListener('click', () => switchTab(tab.id));
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    tabsEl.appendChild(el);
  }
}

function addTab(filePath, content, error) {
  const id = 'tab_' + (++tabSeq);
  const tab = { id, filePath, raw: content, editorContent: content, editing: false, dirty: false, scrollTop: 0, editorScrollTop: 0, error: error || null, editMode: 'wysiwyg' };
  tabs.push(tab);
  state.active = filePath;
  switchTab(id);
  return id;
}

function closeTab(tabId) {
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  if (tabs.length === 1) {
    tabs.length = 0;
    activeTabId = null;
    state.active = null;
    showEmpty();
    renderTabBar();
    return;
  }
  tabs.splice(idx, 1);
  if (tabId === activeTabId) {
    const next = tabs[Math.min(idx, tabs.length - 1)];
    switchTab(next.id);
  }
  renderTabBar();
}

function switchTab(tabId) {
  const prev = getActiveTab();
  if (prev) {
    prev.scrollTop = docEl.scrollTop;
    prev.editorScrollTop = editorEl.scrollTop;
    prev.editorContent = prev.editMode === 'wysiwyg' ? htmlToMarkdown(wysiwygEl.innerHTML) : editorEl.value;
  }
  activeTabId = tabId;
  const tab = getActiveTab();
  if (!tab) return;
  state.active = tab.filePath;
  state.dir = tab.filePath.replace(/[\\/][^\\/]*$/, '');
  state.raw = tab.raw;
  const nm = basename(tab.filePath);
  titleEl.hidden = false;
  titleEl.textContent = nm;
  titleEl.title = tab.filePath;
  document.title = nm;
  filePathEl.textContent = tab.filePath;
  filePathEl.title = tab.filePath;
  highlightTree(tab.filePath);
  const previewContent = tab.editing && tab.editorContent != null ? tab.editorContent : tab.raw;
  if (tab.error) {
    tab.editing = false;
    docEl.hidden = false;
    emptyEl.hidden = true;
    docEl.innerHTML = '<div class="tab-error"><p class="tab-error-title">无法打开文件</p><p class="tab-error-path">' + esc(tab.filePath) + '</p><p class="tab-error-msg">' + esc(tab.error) + '</p></div>';
  } else {
    renderMarkdown(previewContent);
  }
  const content = tab.editorContent != null ? tab.editorContent : tab.raw;
  editorEl.value = content;
  wysiwygEl.innerHTML = markdownToEditorHtml(content);
  if (tab.editing) {
    state.editing = true;
    document.body.classList.add('editing');
    $('#content').classList.add('editing');
    editorPane.hidden = false;
    if (tab.editMode === 'source') {
      wysiwygEl.hidden = true;
      editorEl.hidden = false;
    } else {
      tab.editMode = 'wysiwyg';
      wysiwygEl.hidden = false;
      editorEl.hidden = true;
    }
  } else {
    state.editing = false;
    document.body.classList.remove('editing');
    $('#content').classList.remove('editing');
    editorPane.hidden = true;
    wysiwygEl.hidden = true;
    editorEl.hidden = false;
  }
  state.dirty = tab.dirty;
  state.editing = tab.editing;
  updateEditButtons();
  updateModeToggleUI();
  docEl.hidden = false;
  emptyEl.hidden = true;
  docEl.scrollTop = tab.scrollTop || 0;
  editorEl.scrollTop = tab.editorScrollTop || 0;
  api.watchFile(tab.filePath);
  renderTabBar();
}

function openDocument(filePath, content) {
  const existing = tabs.find(t => t.filePath === filePath);
  if (existing) {
    switchTab(existing.id);
    return;
  }
  addTab(filePath, content);
}

/* ---------- 文档内链接 ---------- */
async function openLinkTab(filePath) {
  const clean = filePath.split(/[?#]/)[0];
  const r = await api.readFile(clean);
  if (r.ok) {
    openDocument(clean, r.content);
    return;
  }
  const existing = tabs.find(t => t.filePath === clean);
  if (existing) { switchTab(existing.id); return; }
  addTab(clean, '', r.error || '文件不存在或无法读取');
}

docEl.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href) { e.preventDefault(); return; }
  if (href.startsWith('#')) return;
  e.preventDefault();
  if (/^(https?:|mailto:|tel:)/i.test(href)) {
    api.openExternal(href);
    return;
  }
  if (/^(data:|blob:)/i.test(href)) return;
  const abs = resolveAssetUrl(href);
  const clean = fileUrlToPath(abs).split(/[?#]/)[0];
  if (isMarkdown(clean)) openLinkTab(clean);
  else api.openExternal(abs);
});

docEl.addEventListener('auxclick', (e) => {
  if (e.button !== 1) return;
  const a = e.target.closest('a');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('#')) return;
  e.preventDefault();
  a.click();
});

/* ---------- 文档内查找 ---------- */
let findMatches = [];
let findIdx = -1;
let findTimer = null;

function clearFindMarks() {
  docEl.querySelectorAll('mark.mdv-find, mark.mdv-find-current').forEach(m => {
    m.replaceWith(document.createTextNode(m.textContent));
  });
  findMatches = [];
  findIdx = -1;
}

function updateFindCount() {
  const total = findMatches.length;
  findCount.textContent = total > 0 ? (findIdx + 1) + '/' + total : '0/0';
}

function gotoFind(delta) {
  if (findMatches.length === 0) return;
  if (findIdx >= 0 && findMatches[findIdx]) findMatches[findIdx].classList.remove('mdv-find-current');
  findIdx = (findIdx + delta + findMatches.length) % findMatches.length;
  const m = findMatches[findIdx];
  m.classList.add('mdv-find-current');
  m.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  updateFindCount();
}

function doFind(scroll) {
  const q = findInput.value;
  clearFindMarks();
  if (!q || !state.active) return;
  const ql = q.toLowerCase();

  const nodes = [];
  const walker = document.createTreeWalker(docEl, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (node.parentElement && node.parentElement.closest && node.parentElement.closest('svg')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  }, false);
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  for (const tn of nodes) {
    const text = tn.textContent;
    const lower = text.toLowerCase();
    const frag = [];
    let any = false;
    let last = 0;
    let i;
    while ((i = lower.indexOf(ql, last)) !== -1) {
      any = true;
      if (i > last) frag.push(document.createTextNode(text.slice(last, i)));
      const mark = document.createElement('mark');
      mark.className = 'mdv-find';
      mark.textContent = text.slice(i, i + q.length);
      frag.push(mark);
      findMatches.push(mark);
      last = i + q.length;
    }
    if (!any) continue;
    if (last < text.length) frag.push(document.createTextNode(text.slice(last)));
    const parent = tn.parentNode;
    const ref = tn.nextSibling;
    for (const f of frag) parent.insertBefore(f, ref);
    tn.remove();
  }

  findIdx = findMatches.length > 0 ? 0 : -1;
  if (scroll !== false && findMatches.length > 0) {
    findMatches[0].classList.add('mdv-find-current');
    findMatches[0].scrollIntoView({ block: 'nearest' });
  }
  updateFindCount();
}

function openFind() {
  if (!state.active) return;
  findBar.hidden = false;
  findInput.focus();
  findInput.select();
}

function closeFind() {
  findBar.hidden = true;
  findInput.value = '';
  clearFindMarks();
}

findInput.addEventListener('input', () => {
  if (findTimer) clearTimeout(findTimer);
  findTimer = setTimeout(() => doFind(true), 80);
});
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); gotoFind(e.shiftKey ? -1 : 1); }
  else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
});
findPrevBtn.addEventListener('click', () => gotoFind(-1));
findNextBtn.addEventListener('click', () => gotoFind(1));
findCloseBtn.addEventListener('click', closeFind);

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
  if (e.key === 'Escape' && !findBar.hidden) closeFind();
});
/* ---------- About 弹窗 ---------- */
const GITHUB_URL = 'https://github.com/LaynePeng/markdown-viewer';
const aboutModal = $('#about-modal');

function closeAbout() { aboutModal.hidden = true; }

api.onShowAbout(async () => {
  try { $('#about-version').textContent = await api.getVersion(); } catch { /* ignore */ }
  aboutModal.hidden = false;
});
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
  } else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    openFind();
  } else if (e.key === 'z' || e.key === 'Z') {
    // 源码模式：优先走工具栏自定义历史栈；无历史时回退浏览器原生撤销
    // WYSIWYG 模式：交给浏览器原生撤销（execCommand 会进原生栈）
    const tab = getActiveTab();
    if (state.editing && tab && tab.editMode !== 'wysiwyg' && (undoStack.length || redoStack.length)) {
      e.preventDefault();
      if (e.shiftKey) tbRedo(); else tbUndo();
    }
  } else if ((e.key === 'b' || e.key === 'B') && state.editing && (document.activeElement === editorEl || document.activeElement === wysiwygEl)) {
    e.preventDefault();
    execToolbarCmd('bold');
  } else if ((e.key === 'i' || e.key === 'I') && state.editing && (document.activeElement === editorEl || document.activeElement === wysiwygEl)) {
    e.preventDefault();
    execToolbarCmd('italic');
  }
});

function basename(p) { return p.split(/[\\/]/).pop(); }

function highlightTree(filePath) {
  treeEl.querySelectorAll('li.active').forEach(l => l.classList.remove('active'));
  if (!filePath) return;
  treeEl.querySelectorAll('li[data-path]').forEach(li => {
    if (li.dataset.path === filePath) li.classList.add('active');
  });
}

function showEmpty(title) {
  docEl.hidden = true;
  emptyEl.hidden = false;
  emptyEl.querySelector('h2').textContent = title || 'Markdown Viewer';
  document.title = 'Markdown Viewer';
  state.active = null;
  titleEl.hidden = true;
  filePathEl.textContent = '';
  api.watchFile(null);
  exitEdit();
  treeEl.querySelectorAll('li.active').forEach(l => l.classList.remove('active'));
  renderTabBar();
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
  const tab = getActiveTab();
  if (tab && tab.error) return;
  state.editing = true;
  if (tab) tab.editing = true;
  document.body.classList.add('editing');
  $('#content').classList.add('editing');
  editorPane.hidden = false;
  if (tab) {
    const content = tab.editorContent != null ? tab.editorContent : tab.raw;
    editorEl.value = content;
    wysiwygEl.innerHTML = markdownToEditorHtml(content);
    if (tab.editMode === 'source') {
      wysiwygEl.hidden = true;
      editorEl.hidden = false;
      editorEl.focus();
    } else {
      tab.editMode = 'wysiwyg';
      wysiwygEl.hidden = false;
      editorEl.hidden = true;
      wysiwygEl.focus();
    }
  }
  updateEditButtons();
  updateModeToggleUI();
}

function exitEdit() {
  state.editing = false;
  const tab = getActiveTab();
  if (tab) tab.editing = false;
  document.body.classList.remove('editing');
  document.body.classList.remove('wysiwyg-mode');
  $('#content').classList.remove('editing');
  editorPane.hidden = true;
  wysiwygEl.hidden = true;
  editorEl.hidden = false;
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  if (wysiwygTimer) { clearTimeout(wysiwygTimer); wysiwygTimer = null; }
  updateEditButtons();
  renderTabBar();
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
  const tab = getActiveTab();
  const content = tab && tab.editMode === 'wysiwyg' ? htmlToMarkdown(wysiwygEl.innerHTML) : editorEl.value;
  const r = await api.writeFile(state.active, content);
  if (!r.ok) {
    alert(r.error || '保存失败');
    return;
  }
  suppressUntil = Date.now() + 500;
  if (tab) {
    tab.raw = content;
    tab.editorContent = content;
    tab.dirty = false;
  }
  state.raw = content;
  state.dirty = false;
  updateEditButtons();
  renderTabBar();
  renderMarkdown(content);
}

function onEditorInput() {
  state.dirty = true;
  const tab = getActiveTab();
  if (tab) { tab.dirty = true; tab.editorContent = editorEl.value; }
  updateEditButtons();
  renderTabBar();
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => renderMarkdown(editorEl.value), 200);
}

let wysiwygTimer = null;

function onWysiwygInput() {
  state.dirty = true;
  const tab = getActiveTab();
  if (tab) tab.dirty = true;
  updateEditButtons();
  renderTabBar();
  if (previewTimer) clearTimeout(previewTimer);
  if (wysiwygTimer) clearTimeout(wysiwygTimer);
  wysiwygTimer = setTimeout(() => {
    wysiwygTimer = null;
    const md = htmlToMarkdown(wysiwygEl.innerHTML);
    if (tab) tab.editorContent = md;
    renderMarkdown(md);
  }, 300);
}

/* ---------- 编辑工具栏 ---------- */
const toolbarEl = $('#editor-toolbar');
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50;

function pushHistory() {
  undoStack.push(editorEl.value);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}

function tbUndo() {
  if (undoStack.length === 0) return false;
  redoStack.push(editorEl.value);
  editorEl.value = undoStack.pop();
  afterTbEdit();
  return true;
}

function tbRedo() {
  if (redoStack.length === 0) return false;
  undoStack.push(editorEl.value);
  editorEl.value = redoStack.pop();
  afterTbEdit();
  return true;
}

function afterTbEdit() {
  editorEl.dispatchEvent(new Event('input', { bubbles: true }));
  editorEl.focus();
}

/* ---------- 源码模式辅助函数 ---------- */
function wrapSelection(before, after, placeholder) {
  const ta = editorEl;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.substring(start, end);
  const text = sel || placeholder;
  ta.setRangeText(before + text + after, start, end, 'end');
  if (!sel) {
    const p = start + before.length;
    ta.setSelectionRange(p, p + placeholder.length);
  }
}

function linePrefix(prefix) {
  const ta = editorEl;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const val = ta.value;
  const lineStart = val.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = val.indexOf('\n', end);
  const endPos = lineEnd === -1 ? val.length : lineEnd;
  const block = val.substring(lineStart, endPos);
  const newBlock = block.split('\n').map(l => prefix + l).join('\n');
  ta.setRangeText(newBlock, lineStart, endPos, 'end');
  const p = start + prefix.length;
  ta.setSelectionRange(p, p);
}

function lineIndent(delta) {
  const ta = editorEl;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const val = ta.value;
  const lineStart = val.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = val.indexOf('\n', end);
  const endPos = lineEnd === -1 ? val.length : lineEnd;
  const block = val.substring(lineStart, endPos);
  const newBlock = block.split('\n').map(l => {
    if (delta > 0) return '  ' + l;
    if (l.startsWith('  ')) return l.slice(2);
    if (l.startsWith('\t')) return l.slice(1);
    return l;
  }).join('\n');
  ta.setRangeText(newBlock, lineStart, endPos, 'end');
  const shift = delta > 0 ? delta : 0;
  ta.setSelectionRange(start + shift, start + shift);
}

function insertAtCursor(text) {
  const ta = editorEl;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  ta.setRangeText(text, start, end, 'end');
}

const TABLE_TEMPLATE = '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n';
const COMMENT_TEMPLATE = '<!-- 注释 -->';

function execSourceCmd(cmd, lang) {
  if (!state.active || !state.editing) return;
  if (cmd === 'undo') { tbUndo(); return; }
  if (cmd === 'redo') { tbRedo(); return; }
  pushHistory();
  switch (cmd) {
    case 'bold': wrapSelection('**', '**', '粗体文本'); break;
    case 'italic': wrapSelection('*', '*', '斜体文本'); break;
    case 'strike': wrapSelection('~~', '~~', '删除线文本'); break;
    case 'h1': linePrefix('# '); break;
    case 'h2': linePrefix('## '); break;
    case 'h3': linePrefix('### '); break;
    case 'h4': linePrefix('#### '); break;
    case 'h5': linePrefix('##### '); break;
    case 'h6': linePrefix('###### '); break;
    case 'link': wrapSelection('[', '](https://)', '链接文字'); break;
    case 'image': wrapSelection('![', '](https://)', '图片描述'); break;
    case 'table': insertAtCursor(TABLE_TEMPLATE); break;
    case 'hr': insertAtCursor('\n---\n'); break;
    case 'quote': linePrefix('> '); break;
    case 'comment': insertAtCursor(COMMENT_TEMPLATE); break;
    case 'ul': linePrefix('- '); break;
    case 'ul-star': linePrefix('* '); break;
    case 'ol': linePrefix('1. '); break;
    case 'task': linePrefix('- [ ] '); break;
    case 'indent': lineIndent(2); break;
    case 'outdent': lineIndent(-2); break;
    case 'code': wrapSelection('`', '`', '代码'); break;
    case 'codeblock': wrapSelection('```' + (lang || '') + '\n', '\n```', '代码'); break;
  }
  afterTbEdit();
}

/* ---------- 所见即所得模式命令 ---------- */
function getSelText() {
  const s = window.getSelection();
  return s ? s.toString() : '';
}

function execWysiwygCmd(cmd, lang) {
  if (!state.active || !state.editing) return;
  wysiwygEl.focus();
  switch (cmd) {
    case 'undo': document.execCommand('undo'); break;
    case 'redo': document.execCommand('redo'); break;
    case 'bold': document.execCommand('bold'); break;
    case 'italic': document.execCommand('italic'); break;
    case 'strike': document.execCommand('strikeThrough'); break;
    case 'h1': document.execCommand('formatBlock', false, 'h1'); break;
    case 'h2': document.execCommand('formatBlock', false, 'h2'); break;
    case 'h3': document.execCommand('formatBlock', false, 'h3'); break;
    case 'h4': document.execCommand('formatBlock', false, 'h4'); break;
    case 'h5': document.execCommand('formatBlock', false, 'h5'); break;
    case 'h6': document.execCommand('formatBlock', false, 'h6'); break;
    case 'ul':
    case 'ul-star': document.execCommand('insertUnorderedList'); break;
    case 'ol': document.execCommand('insertOrderedList'); break;
    case 'indent': document.execCommand('indent'); break;
    case 'outdent': document.execCommand('outdent'); break;
    case 'quote': document.execCommand('formatBlock', false, 'blockquote'); break;
    case 'hr': document.execCommand('insertHorizontalRule'); break;
    case 'code': {
      const t = getSelText() || '代码';
      document.execCommand('insertHTML', false, '<code>' + esc(t) + '</code>');
      break;
    }
    case 'codeblock': {
      const t = getSelText() || '代码';
      const lc = lang ? ' class="language-' + lang + '"' : '';
      document.execCommand('insertHTML', false, '<pre><code' + lc + '>' + esc(t) + '</code></pre>');
      break;
    }
    case 'link': {
      const sel = getSelText() || '链接文字';
      const url = window.prompt('链接地址：', 'https://');
      if (url) document.execCommand('insertHTML', false, '<a href="' + esc(url) + '">' + esc(sel) + '</a>');
      break;
    }
    case 'image': {
      const url = window.prompt('图片地址（本地路径或 http 链接）：', '');
      if (url) {
        const src = /^(https?:|file:)/i.test(url) ? url : resolveAssetUrl(url);
        document.execCommand('insertHTML', false, '<img src="' + esc(src) + '" alt="图片">');
      }
      break;
    }
    case 'table': {
      document.execCommand('insertHTML', false,
        '<table><thead><tr><th>列1</th><th>列2</th><th>列3</th></tr></thead>' +
        '<tbody><tr><td>内容</td><td>内容</td><td>内容</td></tr></tbody></table>');
      break;
    }
    case 'comment':
    case 'task':
      // 仅源码模式支持
      return;
    default:
      return;
  }
  // execCommand 会触发 input 事件，onWysiwygInput 会处理
  wysiwygEl.focus();
}

/* ---------- 双模式分派 ---------- */
function execToolbarCmd(cmd, lang) {
  const tab = getActiveTab();
  if (tab && tab.editMode === 'wysiwyg') {
    execWysiwygCmd(cmd, lang);
  } else {
    execSourceCmd(cmd, lang);
  }
}

toolbarEl.addEventListener('click', (e) => {
  const item = e.target.closest('.tb-menu-item');
  if (item) {
    e.preventDefault();
    execToolbarCmd(item.dataset.cmd, item.dataset.lang);
    return;
  }
  const btn = e.target.closest('.tb-btn');
  if (btn && btn.dataset.cmd) {
    e.preventDefault();
    execToolbarCmd(btn.dataset.cmd);
  }
});

/* ---------- Turndown HTML→Markdown 转换 ---------- */
let turndownSvc = null;

function initTurndown() {
  if (turndownSvc || !window.TurndownService) return;
  turndownSvc = new window.TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**'
  });
  if (window.turndownPluginGfm) {
    turndownSvc.use(window.turndownPluginGfm.gfm);
  }
  // 图片路径还原：file:// 绝对路径 → 相对路径
  turndownSvc.addRule('image', {
    filter: 'img',
    replacement: (content, node) => {
      let src = node.getAttribute('src') || '';
      const alt = node.getAttribute('alt') || '';
      if (/^file:\/\//i.test(src)) {
        try {
          const abs = fileUrlToPath(src);
          const rel = relPathFromDir(state.dir, abs);
          if (rel) src = rel;
        } catch { /* 保持原路径 */ }
      }
      return '![' + alt + '](' + src + ')';
    }
  });
}

function htmlToMarkdown(html) {
  if (!turndownSvc) initTurndown();
  if (!turndownSvc) return wysiwygEl.innerText || '';
  return turndownSvc.turndown(html);
}

function markdownToEditorHtml(content) {
  return marked.parse(content, { gfm: true, breaks: true, renderer: mdRenderer });
}

function relPathFromDir(fromDir, toPath) {
  if (!fromDir) return null;
  const f = String(fromDir).replace(/\\/g, '/').replace(/\/+$/, '').split('/');
  const t = String(toPath).replace(/\\/g, '/').split('/');
  if (!t.length) return null;
  while (f.length && t.length && f[0] === t[0]) { f.shift(); t.shift(); }
  const ups = f.map(() => '..');
  const parts = ups.concat(t).filter(Boolean);
  return parts.length ? parts.join('/') : null;
}

function currentEditorMd() {
  const tab = getActiveTab();
  if (!tab) return '';
  return tab.editMode === 'wysiwyg' ? htmlToMarkdown(wysiwygEl.innerHTML) : editorEl.value;
}

/* ---------- 编辑器模式切换 ---------- */
function switchEditorMode(mode) {
  const tab = getActiveTab();
  if (!tab) return;
  const target = mode || (tab.editMode === 'wysiwyg' ? 'source' : 'wysiwyg');
  if (target === tab.editMode) return;
  if (target === 'source') {
    tab.editorContent = htmlToMarkdown(wysiwygEl.innerHTML);
    editorEl.value = tab.editorContent;
    wysiwygEl.hidden = true;
    editorEl.hidden = false;
  } else {
    tab.editorContent = editorEl.value;
    wysiwygEl.innerHTML = markdownToEditorHtml(tab.editorContent);
    editorEl.hidden = true;
    wysiwygEl.hidden = false;
  }
  tab.editMode = target;
  updateModeToggleUI();
  const targetEl = target === 'wysiwyg' ? wysiwygEl : editorEl;
  targetEl.focus();
  renderMarkdown(tab.editorContent);
}

function updateModeToggleUI() {
  const tab = getActiveTab();
  const wys = !tab || tab.editMode === 'wysiwyg';
  // WYSIWYG 编辑时单栏显示（隐藏右侧预览）
  document.body.classList.toggle('wysiwyg-mode', !!(tab && tab.editing && wys));
  tbModeToggle.textContent = wys ? '源码' : '渲染';
  tbModeToggle.title = wys ? '切换到源码模式' : '切换到所见即所得模式';
}

tbModeToggle.addEventListener('click', () => switchEditorMode());

wysiwygEl.addEventListener('input', onWysiwygInput);

/* 粘贴时清理富文本格式（保留纯文本） */
wysiwygEl.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
});

/* ---------- 自动刷新 ---------- */
let fileRefreshTimer = null;
let treeRefreshTimer = null;

api.onFileChanged(p => {
  if (!state.active || p !== state.active) return;
  if (fileRefreshTimer) clearTimeout(fileRefreshTimer);
  fileRefreshTimer = setTimeout(async () => {
    if (Date.now() < suppressUntil) return;
    const tab = getActiveTab();
    if (tab && tab.editing && tab.dirty) {
      const md = tab.editMode === 'wysiwyg' ? htmlToMarkdown(wysiwygEl.innerHTML) : editorEl.value;
      renderMarkdown(md);
      return;
    }
    const st = docEl.scrollTop;
    const r = await api.readFile(state.active);
    if (!r.ok) return showEmpty(state.active);
    if (tab) {
      tab.raw = r.content;
      tab.editorContent = r.content;
      tab.dirty = false;
      tab.error = null;
    }
    state.raw = r.content;
    editorEl.value = r.content;
    if (tab && tab.editing && tab.editMode === 'wysiwyg') {
      wysiwygEl.innerHTML = markdownToEditorHtml(r.content);
    }
    state.dirty = false;
    updateEditButtons();
    renderTabBar();
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
  if (!state.root) {
    const r = await api.readDir(dir);
    if (r.ok) {
      renderTree(dir);
      state.expanded.add(dir);
    }
  }
  const fr = await api.readFile(filePath);
  if (fr.ok) openDocument(filePath, fr.content);
  else showEmpty(filePath);
}

function setDir(dir) {
  renderTree(dir);
  if (tabs.length === 0) {
    state.active = null;
    showEmpty();
  }
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
const defaultCfg = { theme: 'light', fontsize: 16, width: 800, editorW: 45, sortBy: 'name', sortDir: 'asc' };

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
  state.sortBy = cfg.sortBy || 'name';
  state.sortDir = cfg.sortDir != null ? cfg.sortDir : naturalSortDir();
  updateSortUI();
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
  if (state.root) renderTree(state.root);
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
sortSelect.addEventListener('change', () => {
  state.sortBy = sortSelect.value;
  cfg.sortBy = state.sortBy;
  state.sortDir = naturalSortDir();
  cfg.sortDir = state.sortDir;
  saveCfg();
  updateSortUI();
  if (state.root) renderTree(state.root);
});
sortDirBtn.addEventListener('click', () => {
  state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
  cfg.sortDir = state.sortDir;
  saveCfg();
  updateSortUI();
  if (state.root) renderTree(state.root);
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
api.getVersion().then(v => { if (v) $('#about-version').textContent = v; });
if (cfg.customCss) {
  api.readFile(cfg.customCss).then(r => { if (r.ok) initCustomCss(r.content); cssFileNameEl.textContent = cfg.customCss; });
}
showEmpty();