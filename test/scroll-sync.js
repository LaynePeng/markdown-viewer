/* 滚动联动集成测试：加载真实 renderer（index.html + app.js），验证
   1) 块级元素 data-line 源码行号注入（含嵌套/表格/代码块）
   2) mermaid 容器替换后 data-line 转移
   3) renderMarkdown 重渲染保持预览滚动位置
   4) 源码模式：编辑器 → 预览 双向滚动联动（行号误差 ≤ 10 行）
   5) 联动无回环抖动（位置收敛稳定）
   6) 编辑输入后联动锚点随重渲染更新
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 长文档：40 个章节块，每块 12 行，总约 485 行，两侧都必然出滚动条 */
function buildDoc() {
  const lines = ['# 滚动联动测试文档', '', '开篇引言段落。', ''];
  for (let i = 1; i <= 40; i++) {
    lines.push(
      '## 章节 ' + i, '',
      '这是章节 ' + i + ' 的第一段内容，用来撑起足够的高度。', '',
      '第二段，包含一些文本 **加粗** 与 `code`。', '',
      '> 引用块：章节 ' + i + ' 的引用', '',
      '- 列表项 A' + i, '- 列表项 B' + i, '- 列表项 C' + i, ''
    );
  }
  return lines.join('\n');
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'stub-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false /* 隐藏窗口也要跑 rAF，联动调度依赖它 */
    }
  });
  win.webContents.on('console-message', (_e, _l, msg) => {
    if (/uncaught|error/i.test(msg)) console.log('[page console] ' + msg);
  });
  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  const run = (code) => win.webContents.executeJavaScript(code, true);
  const md = buildDoc();

  /* ---------- 1. data-line 行号注入 ---------- */
  await run('renderMarkdown(' + JSON.stringify(md) + ')');
  await sleep(300);
  let r1 = await run(`(() => {
    const get = (sel) => { const el = docEl.querySelector(sel); return el ? Number(el.getAttribute('data-line')) : -1; };
    return {
      h1: get('h1'),
      p1: get('h2 + p'),
      h2: get('h2'),
      bq: get('blockquote'),
      ul: get('ul'),
      h2c: docEl.querySelectorAll('h2[data-line]').length,
      anchors: docEl.querySelectorAll('[data-line]').length
    };
  })()`);
  ok(r1.h1 === 1, 'line: 一级标题行号 = 1', r1);
  ok(r1.h2 === 5, 'line: 首个二级标题行号 = 5', r1);
  ok(r1.p1 === 7, 'line: 首个章节段落行号 = 7', r1);
  ok(r1.bq === 11, 'line: 引用块行号 = 11', r1);
  ok(r1.ul === 13, 'line: 列表行号 = 13', r1);
  ok(r1.h2c === 40, 'line: 40 个章节标题都带行号', r1);
  ok(r1.anchors >= 200, 'line: 锚点总数充足（≥200）', r1);

  /* ---------- 2. mermaid 容器 data-line 转移 ---------- */
  const mmd = '# T\n\n```mermaid\ngraph TD\nA-->B\n```\n\n尾部段落。';
  await run('renderMarkdown(' + JSON.stringify(mmd) + ')');
  await sleep(600);
  let r2 = await run(`(() => {
    const w = docEl.querySelector('.mermaid-wrap');
    return {
      wrapLine: w ? Number(w.getAttribute('data-line')) : -1,
      preLeft: !!docEl.querySelector('pre code.language-mermaid'),
      svg: !!(w && w.querySelector('svg'))
    };
  })()`);
  ok(r2.wrapLine === 3, 'mermaid: wrap 继承源码行号 3', r2);
  ok(r2.svg === true, 'mermaid: 图正常渲染', r2);
  await run('renderMarkdown(' + JSON.stringify(md) + ')');

  /* ---------- 3. renderMarkdown 保持预览滚动（阅读态滚动容器是 #doc-container） ---------- */
  let r3 = await run(`(() => {
    const sc = document.querySelector('#doc-container');
    const st0target = Math.floor(sc.scrollHeight * 0.4);
    sc.scrollTop = st0target;
    const st0 = sc.scrollTop;
    renderMarkdown(${JSON.stringify(md)});
    return { st0, target: st0target, after: sc.scrollTop };
  })()`);
  ok(r3.st0 > 100, 'keep: 阅读态可设置滚动位置', r3);
  ok(Math.abs(r3.after - r3.st0) < 2, 'keep: 重渲染后预览滚动位置保留', r3);

  /* ---------- 4. 双向滚动联动 ---------- */
  await run(`addTab('/fake/root/scroll.md', ${JSON.stringify(md)})`);
  await run(`(() => { enterEdit(); switchEditorMode('source'); return 1; })()`);
  await sleep(120);
  let r4a = await run(`(() => ({
    canSync: canSyncScroll(),
    mode: (getActiveTab() || {}).editMode,
    eMax: editorEl.scrollHeight - editorEl.clientHeight,
    dMax: docEl.scrollHeight - docEl.clientHeight,
    anchors: syncAnchors.length
  }))()`);
  ok(r4a.canSync === true && r4a.mode === 'source', 'sync: 进入源码分屏且联动激活', r4a);
  ok(r4a.eMax > 200 && r4a.dMax > 200, 'sync: 两侧都有充足滚动空间', r4a);
  ok(r4a.anchors >= 200, 'sync: 预览锚点已构建', r4a);

  /* 编辑器 → 预览：滚到中部 */
  await run(`editorEl.scrollTop = Math.floor(editorEl.scrollHeight * 0.5)`);
  await sleep(250);
  let r4b = await run(`(() => ({
    eScroll: editorEl.scrollTop,
    dScroll: docEl.scrollTop,
    eLine: editorPixelToLine(editorEl.scrollTop + syncEditorPadTop),
    dLine: previewPixelToLine(docEl.scrollTop + syncPreviewPadTop)
  }))()`);
  ok(r4b.dScroll > 100, 'sync: 编辑器滚到中部后预览跟随（scrollTop > 100）', r4b);
  ok(Math.abs(r4b.eLine - r4b.dLine) <= 10, 'sync: 编辑器→预览行号对齐（≤10 行）', r4b);

  /* 编辑器 → 预览：滚到底部 */
  await run(`editorEl.scrollTop = editorEl.scrollHeight`);
  await sleep(250);
  let r4c = await run(`(() => ({
    eLine: editorPixelToLine(editorEl.scrollTop + syncEditorPadTop),
    dLine: previewPixelToLine(docEl.scrollTop + syncPreviewPadTop)
  }))()`);
  ok(Math.abs(r4c.eLine - r4c.dLine) <= 10, 'sync: 编辑器→预览底部对齐（≤10 行）', r4c);

  /* 预览 → 编辑器：滚回上部 */
  await run(`docEl.scrollTop = Math.floor(docEl.scrollHeight * 0.2)`);
  await sleep(250);
  let r4d = await run(`(() => ({
    eLine: editorPixelToLine(editorEl.scrollTop + syncEditorPadTop),
    dLine: previewPixelToLine(docEl.scrollTop + syncPreviewPadTop)
  }))()`);
  ok(Math.abs(r4d.eLine - r4d.dLine) <= 10, 'sync: 预览→编辑器上部对齐（≤10 行）', r4d);

  /* ---------- 5. 无回环抖动 ---------- */
  const s1 = await run(`[editorEl.scrollTop, docEl.scrollTop]`);
  await sleep(500);
  const s2 = await run(`[editorEl.scrollTop, docEl.scrollTop]`);
  ok(Math.abs(s1[0] - s2[0]) < 1 && Math.abs(s1[1] - s2[1]) < 1, 'sync: 停止滚动后两侧位置稳定（无回环）', { s1, s2 });

  /* ---------- 6. 编辑输入后联动随重渲染更新 ---------- */
  await run(`(() => {
    editorEl.scrollTop = Math.floor(editorEl.scrollHeight * 0.5);
    return 1;
  })()`);
  await sleep(200);
  await run(`(() => {
    /* 在文档中部追加一个大段，触发 input → debounce 重渲染 → 锚点重建 */
    const insertion = '## 插入章节\\n\\n插入的长段落，用于改变文档高度。\\n\\n- 插入项一\\n- 插入项二\\n\\n## 章节 10';
    editorEl.value = editorEl.value.replace('## 章节 10', insertion);
    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
    return 1;
  })()`);
  await sleep(700); /* 等待 200ms 防抖重渲染 + rAF 锚点重建 + 联动 */
  let r6 = await run(`(() => ({
    eLine: editorPixelToLine(editorEl.scrollTop + syncEditorPadTop),
    dLine: previewPixelToLine(docEl.scrollTop + syncPreviewPadTop),
    inserted: !!Array.from(docEl.querySelectorAll('h2')).find(h => h.textContent === '插入章节'),
    anchors: syncAnchors.length
  }))()`);
  ok(r6.inserted === true, 'sync: 编辑输入触发了预览重渲染', r6);
  ok(Math.abs(r6.eLine - r6.dLine) <= 12, 'sync: 重渲染后编辑器与预览重新对齐（≤12 行）', r6);

  console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED');
  app.exit(failures === 0 ? 0 : 1);
}).catch(err => {
  console.log('TEST CRASH: ' + (err && err.stack || err));
  app.exit(1);
});
