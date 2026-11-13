/* 集成测试：加载真实 renderer（index.html + app.js），驱动
   1) mermaid 错误隔离与错误卡片 / 孤儿节点清理
   2) scanMermaidBlocks（嵌套围栏 / CRLF / 未闭合 / 四反引号）
   3) 文件树：右键菜单、双击文件夹、展开状态恢复、重命名重定向
   断言失败时打印 FAIL 并退出码 1。 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();

let failures = 0;

function ok(cond, label, extra) {
  if (cond) { console.log('PASS ' + label); }
  else { failures++; console.log('FAIL ' + label + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); }
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'stub-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.webContents.on('console-message', (_e, _l, msg) => {
    if (/uncaught|error/i.test(msg)) console.log('[page console] ' + msg);
  });
  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  const run = (code) => win.webContents.executeJavaScript(code, true);

  /* ---------- 1. Mermaid 错误隔离 ---------- */
  const md = [
    '# Title', '',
    '```mermaid', 'graph TD', 'A-->B', '```', '',
    '```mermaid', 'graph TD', 'A-->', '```', '',
    '```mermaid', 'flowchart LR', 'X-->Y', '```', ''
  ].join('\n');

  await run('renderMarkdown(' + JSON.stringify(md) + ')');
  await new Promise(r => setTimeout(r, 600));

  let r1 = await run(`(() => {
    const items = state.mermaidItems;
    return {
      count: items.length,
      goodSvg: [!!items[0].wrap.querySelector('svg'), !!items[2].wrap.querySelector('svg')],
      errBox: !!items[1].wrap.querySelector('.mermaid-error-box'),
      errWrapClass: items[1].wrap.className,
      goodClass: items[0].wrap.className,
      errLines: Array.from(items[1].wrap.querySelectorAll('.mermaid-error-line')).map(l => l.textContent),
      errLineErr: Array.from(items[1].wrap.querySelectorAll('.mermaid-error-line.err')).map(l => l.textContent),
      title: items[1].wrap.querySelector('.mermaid-error-title') && items[1].wrap.querySelector('.mermaid-error-title').textContent,
      hasLocateBtn: !!items[1].wrap.querySelector('.mermaid-locate-btn'),
      orphans: document.querySelectorAll('body > div[id^="dmmd-"]').length,
      locateWorks: typeof jumpToMermaidSource === 'function'
    };
  })()`);
  ok(r1.count === 3, 'mermaid: 收集到 3 个图', r1);
  ok(r1.goodSvg[0] === true && r1.goodSvg[1] === true, 'mermaid: 错误图不影响前后两张正常图', r1);
  ok(r1.errBox === true, 'mermaid: 错误卡片已渲染', r1);
  ok(r1.orphans === 0, 'mermaid: 失败渲染未遗留孤儿节点', r1);
  ok(r1.errWrapClass.includes('mermaid-error'), 'mermaid: 错误容器带标记类', r1);
  ok(r1.goodClass === 'mermaid-wrap', 'mermaid: 正常图容器类未被污染', r1);
  ok(r1.errLines.length === 2 && r1.errLines[0].trim() === '1graph TD' && r1.errLines[1].trim() === '2A-->', 'mermaid: 源码带行号展示', r1);
  ok(r1.errLineErr.length === 1 && r1.errLineErr[0].includes('A-->'), 'mermaid: 出错行高亮（报告行超界时收敛到末行）', r1);
  ok(/第 3 行/.test(r1.title || ''), 'mermaid: 标题含报告行号', r1);

  /* ---------- 1b. 错误图修复后重新渲染成功（编辑场景） ---------- */
  const fixedMd = md.replace('graph TD\nA-->\n```', 'graph TD\nA-->B\n```');
  await run(`renderMarkdown(${JSON.stringify(fixedMd)})`);
  await new Promise(r => setTimeout(r, 600));
  let r1b = await run(`(() => ({
    svg: !!state.mermaidItems[1].wrap.querySelector('svg'),
    cls: state.mermaidItems[1].wrap.className,
    errBox: !!state.mermaidItems[1].wrap.querySelector('.mermaid-error-box')
  }))()`);
  ok(r1b.svg === true && !r1b.errBox && r1b.cls === 'mermaid-wrap', 'mermaid: 修正后重渲染恢复正常（错误样式被复位）', r1b);
  let r1c = await run(`document.querySelectorAll('body > div[id^="dmmd-"]').length`);
  ok(r1c === 0, 'mermaid: 多轮失败后孤儿节点仍为 0', r1c);

  /* ---------- 1c. 定位到源码（需要有活动标签页，模拟真实打开文件场景） ---------- */
  await run(`addTab('/fake/root/a.md', ${JSON.stringify(md)})`);
  await new Promise(r => setTimeout(r, 600));
  let r1e = await run(`(() => {
    const btn = state.mermaidItems[1].wrap.querySelector('.mermaid-locate-btn');
    btn.click();
    return { editing: state.editing, mode: (getActiveTab() || {}).editMode, selStart: editorEl.selectionStart, selEnd: editorEl.selectionEnd, focused: document.activeElement === editorEl };
  })()`);
  const jumpMd = await run('editorEl.value');
  const blockText = jumpMd.slice(r1e.selStart, r1e.selEnd);
  ok(r1e.editing === true && r1e.mode === 'source', 'mermaid: 定位自动进入编辑-源码模式', r1e);
  ok(blockText.startsWith('```mermaid') && blockText.includes('A-->'), 'mermaid: 选区覆盖整段 mermaid 块', blockText);

  /* ---------- 2. scanMermaidBlocks ---------- */
  let r2 = await run(`(() => {
    const out = {};
    // 基本围栏
    let b = scanMermaidBlocks('x\\n\`\`\`mermaid\\ngraph TD\\nA-->\\n\`\`\`\\ny');
    out.basic = b.length === 1 && b[0].content === 'graph TD\\nA-->' && b[0].start === 2;
    // 嵌套：js 块里提到 mermaid，不应被当作图
    b = scanMermaidBlocks('\`\`\`js\\n\`\`\`mermaid\\nfoo\\n\`\`\`\\n\`\`\`');
    out.nested = b.length === 0;
    // CRLF（围栏识别忽略行尾 \\r；content 为去掉 \\r 后的行拼接）
    const crlf = '\`\`\`mermaid\\r\\ngraph TD\\r\\nA-->\\r\\n\`\`\`';
    b = scanMermaidBlocks(crlf);
    out.crlf = b.length === 1 && b[0].content === 'graph TD\\nA-->' && crlf.slice(b[0].contentEnd).startsWith('\`\`\`') && crlf.slice(b[0].start, b[0].contentEnd).includes('A-->');
    // 未闭合
    b = scanMermaidBlocks('\`\`\`mermaid\\ngraph TD\\nA-->');
    out.unclosed = b.length === 1 && b[0].content === 'graph TD\\nA-->' && b[0].contentEnd === '\`\`\`mermaid\\ngraph TD\\nA-->'.length;
    // 四反引号围栏
    b = scanMermaidBlocks('\`\`\`\`mermaid\\nA\\n\`\`\`\`');
    out.four = b.length === 1 && b[0].content === 'A';
    // 波浪线围栏
    b = scanMermaidBlocks('~~~mermaid\\nB\\n~~~');
    out.tilde = b.length === 1 && b[0].content === 'B';
    // 多块 + 顺序
    b = scanMermaidBlocks('\`\`\`mermaid\\n1\\n\`\`\`\\ntext\\n\`\`\`mermaid\\n2\\n\`\`\`');
    out.multi = b.length === 2 && b[0].content === '1' && b[1].content === '2';
    return out;
  })()`);
  for (const [k, v] of Object.entries(r2)) ok(v === true, 'scan: ' + k, r2);

  /* ---------- 3. retargetPath ---------- */
  let r3 = await run(`(() => ({
    same: retargetPath('/a/b/c.md', '/a/b', '/a/x') === '/a/x/c.md',
    exact: retargetPath('/a/b', '/a/b', '/a/x') === '/a/x',
    unrelated: retargetPath('/z/c.md', '/a/b', '/a/x') === '/z/c.md',
    prefixSafe: retargetPath('/a/bb/c.md', '/a/b', '/a/x') === '/a/bb/c.md',
    win: retargetPath('C:\\\\docs\\\\a.md', 'C:\\\\docs', 'C:\\\\notes') === 'C:\\\\notes\\\\a.md'
  }))()`);
  for (const [k, v] of Object.entries(r3)) ok(v === true, 'retarget: ' + k, r3);

  /* ---------- 4. 文件树：渲染 + 展开恢复 + 双击 + 右键 ---------- */
  await run(`state.expanded.add('/fake/root/sub'); renderTree('/fake/root')`);
  await new Promise(r => setTimeout(r, 300));
  let r4 = await run(`(() => {
    const subLi = document.querySelector('#tree li[data-path="/fake/root/sub"]');
    return {
      subOpen: subLi && subLi.classList.contains('open'),
      subLoaded: subLi && subLi.querySelectorAll('li').length === 1,
      fileCount: document.querySelectorAll('#tree li[data-is-dir=""]').length
    };
  })()`);
  ok(r4.subOpen === true && r4.subLoaded === true, 'tree: 重建后展开状态与子节点恢复', r4);
  ok(r4.fileCount === 3, 'tree: 文件节点数量正确', r4);

  // 双击文件夹 → openPath
  await run(`(() => {
    const li = document.querySelector('#tree li[data-path="/fake/root/sub"]');
    li.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    return 1;
  })()`);
  await new Promise(r => setTimeout(r, 100));
  let r4b = await run('window.mdv.__getCalls().filter(c => c[0] === "open")');
  ok(r4b.length === 1 && r4b[0][1] === '/fake/root/sub', 'tree: 双击文件夹调用 openPath', r4b);

  // 展开状态在双击后保持
  let r4c = await run(`document.querySelector('#tree li[data-path="/fake/root/sub"]').classList.contains('open')`);
  ok(r4c === true, 'tree: 双击后文件夹保持展开', r4c);

  // 右键文件 → 菜单出现
  await run(`(() => {
    const li = document.querySelector('#tree li[data-path="/fake/root/a.md"]');
    li.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
    return 1;
  })()`);
  let r4d = await run(`(() => {
    const m = document.querySelector('.ctx-menu');
    return { exists: !!m, labels: m ? Array.from(m.querySelectorAll('.ctx-item')).map(b => b.textContent) : [] };
  })()`);
  ok(r4d.exists, 'tree: 右键弹出菜单', r4d);
  ok(r4d.labels.includes('打开所在文件夹') && r4d.labels.includes('重命名…') && r4d.labels.includes('删除（移到废纸篓）') && r4d.labels.includes('在新标签页打开'), 'tree: 文件菜单项齐全', r4d);

  // 点击「打开所在文件夹」→ reveal + 菜单关闭
  await run(`(() => {
    const m = document.querySelector('.ctx-menu');
    Array.from(m.querySelectorAll('.ctx-item')).find(b => b.textContent === '打开所在文件夹').click();
    return 1;
  })()`);
  let r4e = await run(`window.mdv.__getCalls().filter(c => c[0] === "reveal")`);
  ok(r4e.length === 1 && r4e[0][1] === '/fake/root/a.md', 'tree: 菜单点击后调用 revealItem', r4e);
  let r4f = await run('!document.querySelector(".ctx-menu")');
  ok(r4f === true, 'tree: 菜单点击后自动关闭', r4f);

  // 点击别处关闭菜单
  await run(`(() => {
    const li = document.querySelector('#tree li[data-path="/fake/root/b.md"]');
    li.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
    return 1;
  })()`);
  await run(`document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  let r4g = await run('!document.querySelector(".ctx-menu")');
  ok(r4g === true, 'tree: 点击其他区域关闭菜单', r4g);

  // 右键文件夹 → 菜单项
  await run(`(() => {
    const li = document.querySelector('#tree li[data-path="/fake/root/sub"]');
    li.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
    return 1;
  })()`);
  let r4h = await run(`(() => {
    const m = document.querySelector('.ctx-menu');
    return { labels: m ? Array.from(m.querySelectorAll('.ctx-item')).map(b => b.textContent) : [] };
  })()`);
  ok(r4h.labels.includes('在系统中打开') && r4h.labels.includes('打开所在文件夹'), 'tree: 文件夹菜单项正确', r4h);

  /* ---------- 5. 重命名对话框 + 重定向 ---------- */
  await run(`(() => {
    addTab('/fake/root/a.md', '# A');
    return 1;
  })()`);
  // 打开重命名对话框（针对 a.md）
  await run(`(() => {
    const li = document.querySelector('#tree li[data-path="/fake/root/a.md"]');
    li.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
    const m = document.querySelector('.ctx-menu');
    Array.from(m.querySelectorAll('.ctx-item')).find(b => b.textContent === '重命名…').click();
    return 1;
  })()`);
  let r5 = await run(`(() => {
    const ov = document.querySelector('.rename-overlay');
    const input = ov && ov.querySelector('input');
    return { exists: !!ov, value: input && input.value, sel: input ? [input.selectionStart, input.selectionEnd] : null };
  })()`);
  ok(r5.exists && r5.value === 'a.md', 'rename: 对话框弹出且预填原名', r5);
  ok(r5.sel && r5.sel[0] === 0 && r5.sel[1] === 1, 'rename: 默认选中主名（不含扩展名）', r5);

  // 输入新名并确定
  await run(`(() => {
    const ov = document.querySelector('.rename-overlay');
    const input = ov.querySelector('input');
    input.value = 'renamed.md';
    Array.from(ov.querySelectorAll('button')).find(b => b.textContent === '重命名').click();
    return 1;
  })()`);
  await new Promise(r => setTimeout(r, 100));
  let r5b = await run(`(() => ({
    dialogGone: !document.querySelector('.rename-overlay'),
    active: state.active,
    title: document.title,
    pathEl: document.querySelector('#file-path').textContent,
    tabs: tabs.map(t => t.filePath),
    treeHasNew: !!document.querySelector('#tree li[data-path="/fake/root/renamed.md"]')
  }))()`);
  ok(r5b.dialogGone, 'rename: 确定后对话框关闭', r5b);
  ok(r5b.active === '/fake/root/renamed.md' && r5b.pathEl === '/fake/root/renamed.md', 'rename: 活动标签与路径栏指向新路径', r5b);
  ok(r5b.tabs.every(t => t === '/fake/root/renamed.md' || t !== '/fake/root/a.md'), 'rename: 所有标签路径重定向', r5b);
  ok(r5b.treeHasNew, 'rename: 树刷新后出现新文件名', r5b);

  // Esc 关闭对话框
  await run(`(() => {
    const li = document.querySelector('#tree li[data-path="/fake/root/b.md"]');
    li.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
    const m = document.querySelector('.ctx-menu');
    Array.from(m.querySelectorAll('.ctx-item')).find(b => b.textContent === '重命名…').click();
    return 1;
  })()`);
  await run(`(() => {
    const ov = document.querySelector('.rename-overlay');
    ov.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return 1;
  })()`);
  let r5c = await run('!document.querySelector(".rename-overlay")');
  ok(r5c === true, 'rename: Esc 关闭对话框', r5c);

  /* ---------- 6. 删除 ---------- */
  // 删除非活动文件 sub（目录）
  await run(`(() => {
    const li = document.querySelector('#tree li[data-path="/fake/root/sub"]');
    li.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
    const m = document.querySelector('.ctx-menu');
    Array.from(m.querySelectorAll('.ctx-item')).find(b => b.textContent === '删除（移到废纸篓）').click();
    return 1;
  })()`);
  await new Promise(r => setTimeout(r, 100));
  let r6 = await run(`(() => ({
    called: window.mdv.__getCalls().filter(c => c[0] === 'trash').length,
    subGone: !document.querySelector('#tree li[data-path="/fake/root/sub"]'),
    activeAlive: state.active === '/fake/root/renamed.md'
  }))()`);
  ok(r6.called === 1, 'delete: 调用 trashItem', r6);
  ok(r6.subGone, 'delete: 树中移除被删目录', r6);
  ok(r6.activeAlive, 'delete: 活动标签不受影响', r6);

  // 删除当前打开的文件 → 关闭标签
  await run(`(() => {
    const li = document.querySelector('#tree li[data-path="/fake/root/renamed.md"]');
    li.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
    const m = document.querySelector('.ctx-menu');
    Array.from(m.querySelectorAll('.ctx-item')).find(b => b.textContent === '删除（移到废纸篓）').click();
    return 1;
  })()`);
  await new Promise(r => setTimeout(r, 150));
  let r6b = await run(`(() => ({ active: state.active, emptyShown: document.querySelector('#empty').hidden === false }))()`);
  ok(r6b.active === null && r6b.emptyShown, 'delete: 删除活动文件后回到空状态', r6b);

  console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED');
  app.exit(failures === 0 ? 0 : 1);
}).catch(err => {
  console.log('TEST CRASH: ' + (err && err.stack || err));
  app.exit(1);
});
