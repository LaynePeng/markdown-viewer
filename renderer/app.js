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
const insertModal = $('#insert-modal');
const insertModalTitle = $('#insert-modal-title');
const insertModalInput = $('#insert-modal-input');
const insertModalFile = $('#insert-modal-file');
const insertModalCancel = $('#insert-modal-cancel');
const insertModalOk = $('#insert-modal-ok');
const insertModalClose = $('#insert-modal-close');
const findBar = $('#find-bar');
const findInput = $('#find-input');
const findCount = $('#find-count');
const findPrevBtn = $('#find-prev');
const findNextBtn = $('#find-next');
const findCloseBtn = $('#find-close');
const tabsEl = $('#tabs');
const sortSelect = $('#sort-select');
const sortDirBtn = $('#sort-dir');

const state = { root: null, expanded: new Set(), active: null, mermaidItems: [], plantumlItems: [], dir: '', sortBy: 'name', sortDir: 'asc' };
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
  if (!r.ok) { delete ul.dataset.loading; return; }
  ul.innerHTML = '';
  for (const it of sortItems(r.items)) {
    ul.appendChild(nodeOf(it));
  }
  ul.dataset.loaded = '1';
  delete ul.dataset.loading;
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
    /* 双击文件夹：先确保展开，再在系统文件管理器中打开 */
    li.addEventListener('dblclick', async (e) => {
      e.stopPropagation();
      if (!li.classList.contains('open')) {
        li.classList.add('open');
        state.expanded.add(it.path);
        span.innerHTML = ICONS.dirOpen + '<span class="nm">' + esc(it.name) + '</span>';
        if (sub.dataset.loaded !== '1') await loadLevel(it.path, sub);
      }
      const r = await api.openPath(it.path);
      if (r && !r.ok) toast(r.error || '打开失败');
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
  li.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showTreeContextMenu(e, it);
  });
  if (it.isDir && state.expanded.has(it.path)) {
    li.classList.add('open');
    const span = li.querySelector('span.dir');
    if (span) span.innerHTML = ICONS.dirOpen + '<span class="nm">' + esc(it.name) + '</span>';
    loadLevel(it.path, li.querySelector('ul'));
  }
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

/* ---------- 右键菜单：删除 / 重命名 / 打开所在文件夹 ---------- */
let ctxMenuEl = null;

function closeContextMenu() {
  if (ctxMenuEl) { ctxMenuEl.remove(); ctxMenuEl = null; }
}

function openContextMenu(x, y, items) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  for (const it of items) {
    if (it === '-') {
      const sep = document.createElement('div');
      sep.className = 'ctx-sep';
      menu.appendChild(sep);
    } else {
      const btn = document.createElement('button');
      btn.className = 'ctx-item' + (it.danger ? ' danger' : '');
      btn.textContent = it.label;
      btn.title = it.title || '';
      btn.addEventListener('click', () => {
        closeContextMenu();
        it.action();
      });
      menu.appendChild(btn);
    }
  }
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - rect.width - 8);
  const py = Math.min(y, window.innerHeight - rect.height - 8);
  menu.style.left = Math.max(8, px) + 'px';
  menu.style.top = Math.max(8, py) + 'px';
  ctxMenuEl = menu;
}

document.addEventListener('mousedown', (e) => {
  if (ctxMenuEl && !ctxMenuEl.contains(e.target)) closeContextMenu();
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ctxMenuEl) closeContextMenu();
}, true);
window.addEventListener('blur', closeContextMenu);

function showTreeContextMenu(e, it) {
  const items = [];
  if (it.isDir) {
    items.push({ label: '在系统中打开', title: '在 Finder / 资源管理器中打开此文件夹', action: async () => {
      const r = await api.openPath(it.path);
      if (r && !r.ok) toast(r.error || '打开失败');
    } });
  }
  items.push({ label: '打开所在文件夹', title: '在系统文件管理器中定位并选中它', action: async () => {
    const r = await api.revealItem(it.path);
    if (r && !r.ok) toast(r.error || '定位失败');
  } });
  if (!it.isDir && isMarkdown(it.path)) {
    items.push({ label: '在新标签页打开', action: () => openLocal(it.path, true) });
  }
  items.push('-');
  items.push({ label: '重命名…', action: () => showRenameDialog(it) });
  items.push({ label: '删除（移到废纸篓）', danger: true, action: () => trashTreeItem(it) });
  openContextMenu(e.clientX, e.clientY, items);
}

async function trashTreeItem(it) {
  const open = tabs.find(t => !t.error && (t.filePath === it.path || t.filePath.startsWith(it.path + pathSep(it.path))));
  const extra = open && open.dirty ? '该文件正在编辑且有未保存的修改，删除后修改将丢失。' : '';
  const r = await api.trashItem(it.path, extra);
  if (!r || !r.ok) {
    if (r && r.canceled) return;
    toast((r && r.error) || '删除失败');
    return;
  }
  /* 关闭被删路径下已打开的标签页 */
  for (let i = tabs.length - 1; i >= 0; i--) {
    const t = tabs[i];
    if (t.filePath === it.path || t.filePath.startsWith(it.path + pathSep(it.path))) {
      if (t.id === activeTabId) { closeTab(t.id); }
      else { tabs.splice(i, 1); renderTabBar(); }
    }
  }
  if (it.path === state.root || state.root.startsWith(it.path + pathSep(it.path))) {
    /* 树根目录被删：清空文件树；若还有其他标签页则切过去，否则回到空状态 */
    state.root = null;
    state.expanded.clear();
    treeEl.innerHTML = '';
    dirNameEl.textContent = '文件树';
    dirNameEl.title = '';
    const remain = getActiveTab();
    if (remain) switchTab(remain.id);
    else showEmpty();
  } else if (state.root) {
    renderTree(state.root);
  } else {
    renderTabBar();
  }
}

/* ---------- 重命名对话框 ---------- */
function showRenameDialog(it) {
  const oldName = basename(it.path);
  const overlay = document.createElement('div');
  overlay.className = 'rename-overlay';
  const box = document.createElement('div');
  box.className = 'rename-box';
  const title = document.createElement('div');
  title.className = 'rename-title';
  title.textContent = (it.isDir ? '重命名文件夹：' : '重命名文件：') + oldName;
  const input = document.createElement('input');
  input.type = 'text';
  input.spellcheck = false;
  input.value = oldName;
  const err = document.createElement('div');
  err.className = 'rename-err';
  err.hidden = true;
  const actions = document.createElement('div');
  actions.className = 'rename-actions';
  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn';
  btnCancel.textContent = '取消';
  const btnOk = document.createElement('button');
  btnOk.className = 'btn primary';
  btnOk.textContent = '重命名';
  actions.appendChild(btnCancel);
  actions.appendChild(btnOk);
  box.appendChild(title);
  box.appendChild(input);
  box.appendChild(err);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  const submit = async () => {
    const newName = input.value.trim();
    if (!newName || newName === oldName) { close(); return; }
    btnOk.disabled = true;
    const r = await api.renameItem(it.path, newName);
    btnOk.disabled = false;
    if (!r || !r.ok) {
      err.textContent = (r && r.error) || '重命名失败';
      err.hidden = false;
      input.focus();
      input.select();
      return;
    }
    close();
    retargetAfterRename(it.path, r.path);
  };
  btnOk.addEventListener('click', submit);
  btnCancel.addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  /* 默认选中不含扩展名的主名，方便直接输入新名 */
  const dot = it.isDir ? -1 : oldName.lastIndexOf('.');
  input.focus();
  if (dot > 0) input.setSelectionRange(0, dot);
  else input.select();
}

function pathSep(p) {
  return p.includes('/') && !p.includes('\\') ? '/' : '\\';
}

function retargetPath(p, oldPath, newPath) {
  if (!p) return p;
  if (p === oldPath) return newPath;
  const sep = pathSep(oldPath);
  if (p.startsWith(oldPath + sep)) return newPath + p.slice(oldPath.length);
  return p;
}

/* 重命名后把所有引用旧路径的地方（标签页 / 展开状态 / 根目录）改指向新路径 */
function retargetAfterRename(oldPath, newPath) {
  for (const t of tabs) t.filePath = retargetPath(t.filePath, oldPath, newPath);
  state.active = retargetPath(state.active, oldPath, newPath);
  state.dir = retargetPath(state.dir, oldPath, newPath);
  state.root = retargetPath(state.root, oldPath, newPath);
  state.expanded = new Set(Array.from(state.expanded).map(p => retargetPath(p, oldPath, newPath)));
  const tab = getActiveTab();
  if (tab && tab.filePath === state.active) {
    const nm = basename(state.active);
    titleEl.textContent = nm;
    titleEl.title = state.active;
    document.title = nm;
    filePathEl.textContent = state.active;
    filePathEl.title = state.active;
    api.watchFile(state.active);
  }
  if (state.root) renderTree(state.root);
  else renderTabBar();
}

/* ---------- 轻量提示（toast） ---------- */
let toastTimer = null;

function toast(msg) {
  let el = $('#mdv-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mdv-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
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
  // 以文档目录为基准，合并相对路径后再归一化
  const base = (state.dir || '').replace(/\\/g, '/').split('/');
  for (const s of clean.split('/')) {
    if (!s || s === '.') continue;
    if (s === '..') { if (base.length) base.pop(); }
    else base.push(s);
  }
  return toFileUrl(base.join('/'));
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

/* ---------- 数学公式（KaTeX） ---------- */
function renderMath(tex, displayMode) {
  if (window.katex && window.katex.renderToString) {
    try {
      return window.katex.renderToString(tex, { displayMode, throwOnError: false, strict: false });
    } catch (e) { /* 回退到原文 */ }
  }
  return '<span class="math-error">' + esc(tex) + '</span>';
}

const blockMathExt = {
  name: 'blockMath',
  level: 'block',
  start(src) {
    const m = src.match(/\$\$/);
    return m ? m.index : undefined;
  },
  tokenizer(src) {
    const m = /^\$\$[ \t]*\n?([\s\S]+?)\n?\$\$(?:\n|$)/.exec(src);
    if (m) return { type: 'blockMath', raw: m[0], text: m[1].trim() };
  },
  renderer(token) {
    return renderMath(token.text, true);
  }
};

const inlineMathExt = {
  name: 'inlineMath',
  level: 'inline',
  start(src) {
    const m = src.match(/\$(?!\s)/);
    return m ? m.index : undefined;
  },
  tokenizer(src) {
    const m = /^\$(?!\s)((?:\\.|[^\\$])+?)(?<!\s)\$/.exec(src);
    if (m) return { type: 'inlineMath', raw: m[0], text: m[1] };
  },
  renderer(token) {
    return renderMath(token.text, false);
  }
};

marked.use({ extensions: [blockMathExt, inlineMathExt] });

function renderMarkdown(content) {
  docEl.innerHTML = marked.parse(content, { gfm: true, breaks: true, renderer: mdRenderer });
  docEl.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (!src) return;
    const abs = resolveAssetUrl(src);
    if (abs !== src) img.setAttribute('src', abs);
  });
  collectMermaid();
  state.plantumlItems = window.mdvPlantUml ? window.mdvPlantUml.collectPlantUml(docEl) : [];
  docEl.querySelectorAll('pre code').forEach(b => {
    if (window.hljs && !b.classList.contains('hljs')) window.hljs.highlightElement(b);
  });
  renderMermaid();
  if (window.mdvPlantUml) window.mdvPlantUml.renderPlantUml(state.plantumlItems);
  docEl.hidden = false;
  emptyEl.hidden = true;
  if (!findBar.hidden && findInput.value) doFind(false);
}

/* ---------- Tab 管理 ---------- */
function getActiveTab() {
  return tabs.find(t => t.id === activeTabId) || null;
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
    if (prev.id !== tabId) {
      prev.editorContent = prev.editMode === 'wysiwyg' ? htmlToMarkdown(wysiwygEl.innerHTML) : editorEl.value;
    }
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
/* 渲染代次：新一轮渲染开始后，上一轮尚未完成的异步渲染结果全部作废，
   防止快速切换文件 / 边编辑边预览时旧结果写入新内容 */
let mermaidGen = 0;

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
    /* marked 产出的 textContent 会带围栏内容的尾部换行，去掉以免行号多算一行 */
    state.mermaidItems.push({ src: code.textContent.replace(/\r?\n$/, ''), wrap });
  });
}

async function renderMermaid() {
  if (!window.mermaid || state.mermaidItems.length === 0) return;
  try {
    mermaid.initialize({ startOnLoad: false, theme: mermaidTheme(), securityLevel: 'strict' });
  } catch { return; }
  const gen = ++mermaidGen;
  for (const it of state.mermaidItems) {
    if (gen !== mermaidGen) return; /* 已被新一轮渲染取代，放弃本轮 */
    await renderMermaidItem(it, gen);
  }
}

async function renderMermaidItem(it, gen) {
  const id = 'mmd-' + (++mermaidSeq);
  /* 每次渲染前复位状态：上一轮失败留下的错误样式 / 点击行为都会被清掉 */
  it.wrap.className = 'mermaid-wrap';
  it.wrap.title = '点击放大';
  it.wrap.innerHTML = '';
  it.wrap.onclick = () => openDiagram(it.wrap);
  try {
    const { svg } = await mermaid.render(id, it.src);
    if (gen !== mermaidGen) return; /* 过期结果，丢弃 */
    it.wrap.innerHTML = svg;
  } catch (err) {
    /* mermaid 渲染失败会在 body 里遗留临时 div（#d + id），无论是否过期都要清掉防止累积 */
    const orphan = document.getElementById('d' + id);
    if (orphan) orphan.remove();
    if (gen !== mermaidGen) return;
    showMermaidError(it, err);
  }
}

/* 单个图渲染失败只影响它自己：错误卡片 + 带行号的源码 + 一键定位到编辑器 */
function showMermaidError(it, err) {
  const msg = err && err.message ? err.message : String(err);
  const lines = it.src.split('\n');
  const lm = /line\s+(\d+)/i.exec(msg);
  const errLine = lm ? Math.min(Math.max(parseInt(lm[1], 10), 1), lines.length) : null;

  it.wrap.className = 'mermaid-wrap mermaid-error';
  it.wrap.title = '';
  it.wrap.onclick = null;
  it.wrap.innerHTML = '';

  const box = document.createElement('div');
  box.className = 'mermaid-error-box';

  const head = document.createElement('div');
  head.className = 'mermaid-error-head';
  const title = document.createElement('span');
  title.className = 'mermaid-error-title';
  title.textContent = 'Mermaid 渲染失败' + (lm ? '（第 ' + lm[1] + ' 行附近）' : '');
  const btn = document.createElement('button');
  btn.className = 'btn mermaid-locate-btn';
  btn.textContent = '定位到源码';
  btn.title = '在编辑器中选中并定位这段 Mermaid 代码';
  btn.addEventListener('click', () => jumpToMermaidSource(it));
  head.appendChild(title);
  head.appendChild(btn);

  const msgEl = document.createElement('pre');
  msgEl.className = 'mermaid-error-msg';
  msgEl.textContent = msg;

  const code = document.createElement('div');
  code.className = 'mermaid-error-code';
  lines.forEach((ln, i) => {
    const n = i + 1;
    const row = document.createElement('div');
    row.className = 'mermaid-error-line' + (errLine === n ? ' err' : '');
    const lnEl = document.createElement('span');
    lnEl.className = 'ln';
    lnEl.textContent = n;
    const lc = document.createElement('span');
    lc.className = 'lc';
    lc.textContent = ln.length ? ln : ' ';
    row.appendChild(lnEl);
    row.appendChild(lc);
    code.appendChild(row);
  });

  box.appendChild(head);
  box.appendChild(msgEl);
  box.appendChild(code);
  it.wrap.appendChild(box);
}

/* ---------- 在源码中扫描 mermaid 围栏代码块（处理嵌套围栏、CRLF、未闭合块） ---------- */
function scanMermaidBlocks(md) {
  const blocks = [];
  if (!md) return blocks;
  const text = String(md);
  /* 行内保留 \r（与 code.textContent 一致），但围栏识别时忽略行尾 \r */
  const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
  const lineOffsets = [0];
  for (let k = 0; k < text.length; k++) {
    if (text[k] === '\n') lineOffsets.push(k + 1);
  }
  let i = 0;
  while (i < lines.length) {
    const m = /^[ \t]*(`{3,}|~{3,})[ \t]*(.*)$/.exec(lines[i]);
    if (m) {
      const fence = m[1];
      const fChar = fence[0];
      const fLen = fence.length;
      let j = i + 1;
      while (j < lines.length) {
        const close = /^[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(lines[j]);
        if (close && close[1][0] === fChar && close[1].length >= fLen) break;
        j++;
      }
      const lang = m[2].trim().toLowerCase().split(/\s+/)[0];
      if (lang === 'mermaid') {
        const content = lines.slice(i + 1, j).join('\n');
        const contentEnd = j < lines.length ? lineOffsets[j] : text.length;
        blocks.push({ start: lineOffsets[i], contentStart: lineOffsets[i + 1] || text.length, contentEnd, end: j < lines.length ? lineOffsets[j] + lines[j].length + 1 : text.length, content });
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  return blocks;
}

const cr = s => String(s || '').replace(/\r/g, '');
const normMdSrc = s => cr(s).replace(/\n+$/, '');

function findMermaidBlock(md, src) {
  if (!md) return null;
  const blocks = scanMermaidBlocks(md);
  /* 精确匹配优先；WYSIWYG 往返转换可能增删尾部空行，再按归一化匹配 */
  return blocks.find(b => b.content === src)
    || blocks.find(b => normMdSrc(b.content) === normMdSrc(src))
    || null;
}

/* 从错误卡片跳到编辑器里的对应 Mermaid 块 */
function jumpToMermaidSource(it) {
  const tab = getActiveTab();
  if (!tab || !it.src) return;
  if (tab.editing !== true) enterEdit();
  if (tab.editMode !== 'source') switchEditorMode('source');
  const blk = findMermaidBlock(editorEl.value, it.src);
  if (!blk) { toast('没有在当前文档中找到这段 Mermaid 源码（可能已被修改）'); return; }
  editorEl.focus();
  editorEl.setSelectionRange(blk.start, blk.contentEnd);
  scrollEditorToOffset(editorEl, blk.start);
}

/* 用镜像 div 估算光标偏移在 textarea 中的像素位置并滚动过去 */
function scrollEditorToOffset(ta, offset) {
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(ta);
  const props = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing', 'width'];
  for (const p of props) mirror.style[p] = style[p];
  mirror.style.position = 'absolute';
  mirror.style.left = '-9999px';
  mirror.style.top = '0';
  mirror.style.height = 'auto';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.textContent = ta.value.slice(0, offset);
  document.body.appendChild(mirror);
  const target = mirror.offsetHeight - ta.clientHeight * 0.25;
  mirror.remove();
  ta.scrollTop = Math.max(0, Math.min(target, ta.scrollHeight - ta.clientHeight));
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
    updateToolbarState();
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

function execSourceCmd(cmd, lang, extra) {
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
    case 'link': {
      const range = { start: editorEl.selectionStart, end: editorEl.selectionEnd };
      showInsertModal('link', value => {
        if (!value) return;
        editorEl.focus();
        editorEl.setSelectionRange(range.start, range.end);
        pushHistory();
        wrapSelection('[', '](' + relativeAssetPath(value) + ')', '链接文字');
        afterTbEdit();
      });
      return;
    }
    case 'image': {
      const range = { start: editorEl.selectionStart, end: editorEl.selectionEnd };
      showInsertModal('image', value => {
        if (!value) return;
        editorEl.focus();
        editorEl.setSelectionRange(range.start, range.end);
        pushHistory();
        wrapSelection('![', '](' + relativeAssetPath(value) + ')', '图片描述');
        afterTbEdit();
      });
      return;
    }
    case 'table-insert': {
      const dims = (extra && extra.rows && extra.cols)
        ? extra
        : promptTableDims();
      if (dims) insertAtCursor(buildMarkdownTable(dims.cols, dims.rows));
      break;
    }
    case 'table-row-above': case 'table-row-below':
    case 'table-col-left': case 'table-col-right':
      break;
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

function execWysiwygCmd(cmd, lang, extra) {
  if (!state.active || !state.editing) return;
  const savedRange = saveSelection();
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
      const range = savedRange;
      showInsertModal('link', value => {
        if (!value) return;
        restoreSelection(range);
        document.execCommand('insertHTML', false, '<a href="' + esc(relativeAssetPath(value)) + '">' + esc(sel) + '</a>');
        onWysiwygInput();
      });
      return;
    }
    case 'image': {
      const range = savedRange;
      showInsertModal('image', value => {
        if (!value) return;
        wysiwygEl.focus();
        if (range) restoreSelection(range);
        const src = /^(https?:|file:)/i.test(value) ? value : resolveAssetUrl(value);
        document.execCommand('insertHTML', false, '<img src="' + esc(src) + '" alt="图片">');
        onWysiwygInput();
      });
      return;
    }
    case 'table-insert': {
      const rows = (extra && extra.rows) || 3;
      const cols = (extra && extra.cols) || 3;
      document.execCommand('insertHTML', false, buildTableHtml(cols, rows));
      break;
    }
    case 'table-row-above': addTableRow('above'); break;
    case 'table-row-below': addTableRow('below'); break;
    case 'table-col-left': addTableCol('left'); break;
    case 'table-col-right': addTableCol('right'); break;
    case 'task': {
      const text = getSelText() || '任务';
      document.execCommand('insertHTML', false, '<ul><li><input type="checkbox" disabled> ' + esc(text) + '</li></ul>');
      break;
    }
    case 'comment':
      // 注释不会在所见即所得编辑区显示，保留在源码模式使用
      return;
    default:
      return;
  }
  // execCommand 会触发 input 事件，onWysiwygInput 会处理
  wysiwygEl.focus();
  updateToolbarState();
}

/* ---------- 工具栏状态同步（WYSIWYG 选区格式高亮） ---------- */
function updateToolbarState() {
  const tab = getActiveTab();
  if (!tab || tab.editMode !== 'wysiwyg' || !state.editing) return;
  toolbarEl.querySelectorAll('.tb-btn.active, .tb-menu-item.active').forEach(el => el.classList.remove('active'));

  const states = {
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    strike: document.queryCommandState('strikeThrough'),
    ul: document.queryCommandState('insertUnorderedList'),
    ol: document.queryCommandState('insertOrderedList')
  };
  for (const [cmd, active] of Object.entries(states)) {
    if (active) highlightCmd(cmd);
  }

  const block = document.queryCommandValue('formatBlock').toLowerCase();
  if (/^h[1-6]$/.test(block)) highlightCmd(block);

  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === 3) node = node.parentElement;
    if (node.closest('a')) highlightCmd('link');
    if (node.closest('code')) highlightCmd('code');
    if (node.closest('pre')) highlightCmd('codeblock');
  }
}

function highlightCmd(cmd) {
  const btn = toolbarEl.querySelector(`.tb-btn[data-cmd="${cmd}"]`);
  if (btn) btn.classList.add('active');
  const item = toolbarEl.querySelector(`.tb-menu-item[data-cmd="${cmd}"]`);
  if (item) item.classList.add('active');
}

/* ---------- 双模式分派 ---------- */
function execToolbarCmd(cmd, lang, extra) {
  const tab = getActiveTab();
  if (tab && tab.editMode === 'wysiwyg') {
    execWysiwygCmd(cmd, lang, extra);
  } else {
    execSourceCmd(cmd, lang, extra);
  }
}

toolbarEl.addEventListener('mousedown', (e) => {
  if (e.target.closest('.tb-btn, .tb-menu-item')) e.preventDefault();
});

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

/* ---------- 表格网格选择器 ---------- */
(function initTableGrid() {
  const gridEl = document.getElementById('table-grid-cells');
  if (!gridEl) return;
  const sizeLabel = gridEl.closest('.table-grid').querySelector('.grid-size');
  const MAX = 9;
  gridEl.innerHTML = '';
  for (let r = 0; r < MAX; r++) {
    for (let c = 0; c < MAX; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.addEventListener('mouseenter', () => {
        gridEl.querySelectorAll('.grid-cell').forEach(el => {
          el.classList.toggle('hover', parseInt(el.dataset.r) <= r && parseInt(el.dataset.c) <= c);
        });
        sizeLabel.textContent = (r + 1) + ' × ' + (c + 1);
      });
      cell.addEventListener('mousedown', e => e.preventDefault());
      cell.addEventListener('click', () => {
        execToolbarCmd('table-insert', null, { rows: r + 1, cols: c + 1 });
      });
      gridEl.appendChild(cell);
    }
  }
  gridEl.addEventListener('mouseleave', () => {
    gridEl.querySelectorAll('.grid-cell').forEach(el => el.classList.remove('hover'));
    sizeLabel.textContent = '0 × 0';
  });
})();

/* ---------- WYSIWYG 表格行/列操作 ---------- */
function addTableRow(dir) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const cell = tableCellFromSelection();
  if (!cell) return;
  const row = cell.closest('tr');
  const newRow = row.cloneNode(true);
  newRow.querySelectorAll('td, th').forEach(c => { c.innerHTML = '&nbsp;'; });
  if (dir === 'above') row.parentNode.insertBefore(newRow, row);
  else row.parentNode.insertBefore(newRow, row.nextSibling);
  onWysiwygInput();
}
function addTableCol(dir) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const cell = tableCellFromSelection();
  if (!cell) return;
  const idx = cell.cellIndex;
  cell.closest('table').querySelectorAll('tr').forEach(row => {
    const tag = row.children[0] ? row.children[0].tagName : 'td';
    const newCell = document.createElement(tag);
    newCell.innerHTML = '&nbsp;';
    row.insertBefore(newCell, dir === 'left' ? row.children[idx] : (row.children[idx + 1] || null));
  });
  onWysiwygInput();
}

/* ---------- 插入辅助 ---------- */
function promptTableDims() {
  const colsInput = window.prompt('表格列数（1-12）：', '3');
  if (colsInput == null) return null;
  const rowsInput = window.prompt('表格行数（1-30）：', '3');
  if (rowsInput == null) return null;
  return {
    cols: Math.min(Math.max(parseInt(colsInput, 10) || 3, 1), 12),
    rows: Math.min(Math.max(parseInt(rowsInput, 10) || 3, 1), 30)
  };
}

function buildMarkdownTable(cols, rows) {
  let md = '\n|' + Array.from({ length: cols }, (_, i) => ' 列' + (i + 1) + ' ').join('|') + '|\n';
  md += '|' + Array(cols).fill(' --- ').join('|') + '|\n';
  for (let r = 1; r <= rows; r++) md += '|' + Array(cols).fill(' 内容 ').join('|') + '|\n';
  return md;
}

function buildTableHtml(cols, rows) {
  let html = '<table><thead><tr>';
  for (let c = 1; c <= cols; c++) html += '<th>列' + c + '</th>';
  html += '</tr></thead><tbody>';
  for (let r = 1; r <= rows; r++) {
    html += '<tr>';
    for (let c = 1; c <= cols; c++) html += '<td>内容</td>';
    html += '</tr>';
  }
  return html + '</tbody></table>';
}

function pickLocalFile(accept, cb) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    const f = input.files[0];
    input.remove();
    cb(f ? api.filePathFor(f) : null);
  });
  input.click();
}

function saveSelection() {
  const sel = window.getSelection();
  return sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
}

function restoreSelection(range) {
  if (!range) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function relativeAssetPath(value) {
  const v = String(value || '').trim();
  if (!v || /^(https?:|data:|blob:|mailto:|tel:|#)/i.test(v)) return v;
  if (/^file:\/\//i.test(v)) {
    const rel = relPathFromDir(state.dir, fileUrlToPath(v));
    return rel || v;
  }
  if (/^(?:[A-Za-z]:[\\/]|[\\/]{2}|\/)/.test(v)) {
    const rel = relPathFromDir(state.dir, v);
    return rel || v;
  }
  return v;
}

function tableCellFromSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  let node = sel.getRangeAt(0).startContainer;
  if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
  return node && node.closest ? node.closest('#wysiwyg td, #wysiwyg th') : null;
}

/* ---------- 插入链接/图片对话框 ---------- */
let insertModalCallback = null;

function showInsertModal(kind, callback) {
  insertModalCallback = callback;
  insertModal.dataset.kind = kind;
  insertModalTitle.textContent = kind === 'image' ? '插入图片' : '插入链接';
  insertModalInput.value = '';
  insertModalInput.placeholder = kind === 'image'
    ? '输入图片 URL 或相对路径，也可选择本地图片'
    : '输入链接 URL 或相对路径，也可选择本地文件';
  insertModalFile.textContent = kind === 'image' ? '选择本地图片' : '选择本地文件';
  insertModal.hidden = false;
  insertModalInput.focus();
}

function closeInsertModal(value) {
  const callback = insertModalCallback;
  insertModalCallback = null;
  insertModal.hidden = true;
  if (callback) callback(value || null);
}

insertModalOk.addEventListener('click', () => closeInsertModal(insertModalInput.value.trim()));
insertModalCancel.addEventListener('click', () => closeInsertModal(null));
insertModalClose.addEventListener('click', () => closeInsertModal(null));
insertModalInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === 'Escape') {
    e.preventDefault();
    closeInsertModal(e.key === 'Enter' ? insertModalInput.value.trim() : null);
  }
});
insertModalFile.addEventListener('click', () => {
  const kind = insertModal.dataset.kind;
  const callback = insertModalCallback;
  insertModalCallback = null;
  insertModal.hidden = true;
  pickLocalFile(kind === 'image' ? 'image/*' : '*', p => { if (callback) callback(p); });
});
insertModal.addEventListener('click', e => {
  if (e.target === insertModal || e.target.classList.contains('modal-backdrop')) closeInsertModal(null);
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
  // 数学公式还原：KaTeX 渲染结果 → LaTeX 原文
  const katexTex = node => {
    const ann = node.querySelector('annotation[encoding="application/x-tex"]');
    return ann ? ann.textContent : null;
  };
  turndownSvc.addRule('blockMath', {
    filter: node => node.classList && node.classList.contains('katex-display'),
    replacement: (content, node) => {
      const tex = katexTex(node);
      return tex ? '\n\n$$\n' + tex + '\n$$\n\n' : content;
    }
  });
  turndownSvc.addRule('inlineMath', {
    filter: node => node.classList && node.classList.contains('katex'),
    replacement: (content, node) => {
      const tex = katexTex(node);
      return tex ? '$' + tex + '$' : content;
    }
  });
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
  // 链接路径还原：file:// 绝对路径 → 相对路径
  turndownSvc.addRule('link', {
    filter: 'a',
    replacement: (content, node) => {
      let href = node.getAttribute('href') || '';
      if (/^file:\/\//i.test(href)) {
        try {
          const abs = fileUrlToPath(href);
          const rel = relPathFromDir(state.dir, abs);
          if (rel) href = rel;
        } catch { /* 保持原样 */ }
      }
      if (!href) return content;
      return '[' + content + '](' + href + ')';
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

/* 光标移动时同步工具栏高亮状态 */
wysiwygEl.addEventListener('mouseup', () => setTimeout(updateToolbarState, 50));
wysiwygEl.addEventListener('keyup', () => setTimeout(updateToolbarState, 50));

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
  if (window.mdvPlantUml) window.mdvPlantUml.renderPlantUml(state.plantumlItems);
});
settingsPanel.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'set-theme') cfg.theme = el.value;
  else if (el.id === 'set-fontsize') cfg.fontsize = Number(el.value);
  else if (el.id === 'set-width') cfg.width = Number(el.value);
  saveCfg(); applyCfg();
  renderMermaid();
  if (window.mdvPlantUml) window.mdvPlantUml.renderPlantUml(state.plantumlItems);
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