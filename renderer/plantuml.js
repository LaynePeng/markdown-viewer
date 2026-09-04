/* PlantUML 渲染：将 Markdown 中的 ```plantuml 代码块渲染为 SVG。
   引擎为 @plantuml/core（TeaVM 编译的纯 JS 版 PlantUML），离线渲染，无需 Java/服务器。 */
(function () {
  'use strict';

  let enginePromise = null;
  let renderQueue = Promise.resolve();

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('加载 ' + src + ' 失败'));
      document.head.appendChild(s);
    });
  }

  /* 懒加载引擎：viz-global.js 是经典脚本，plantuml.js 是 ES module。
     只在文档含 PlantUML 代码块时才会被调用，避免拖慢启动。 */
  function loadEngine() {
    if (!enginePromise) {
      enginePromise = (async () => {
        await loadScript('vendor/viz-global.js');
        return await import('./vendor/plantuml.js');
      })();
    }
    return enginePromise;
  }

  /* 收集 PlantUML 代码块，替换为 .plantuml-wrap 容器，返回待渲染列表 */
  function collectPlantUml(docEl) {
    const items = [];
    docEl.querySelectorAll('pre code.language-plantuml, pre code.language-puml').forEach(code => {
      const pre = code.closest('pre');
      const wrap = document.createElement('div');
      wrap.className = 'plantuml-wrap';
      wrap.title = '点击放大';
      pre.replaceWith(wrap);
      items.push({ src: code.textContent, wrap });
    });
    return items;
  }

  function showError(wrap, msg) {
    wrap.className = 'plantuml-error';
    wrap.title = '';
    wrap.textContent = 'PlantUML 渲染失败：' + msg;
  }

  function renderItem(engine, it) {
    return new Promise((resolve) => {
      const lines = it.src.split(/\r\n|\r|\n/);
      try {
        engine.renderToString(lines, (svg) => {
          it.wrap.innerHTML = svg;
          it.wrap.onclick = () => openDiagram(it.wrap);
          resolve();
        }, (msg) => {
          showError(it.wrap, msg);
          resolve();
        }, { dark: document.body.dataset.theme === 'dark' });
      } catch (err) {
        showError(it.wrap, err && err.message ? err.message : String(err));
        resolve();
      }
    });
  }

  /* 串行渲染（引擎有共享内部状态，多个图不能并发渲染） */
  function renderPlantUml(items) {
    if (!items || items.length === 0) return;
    renderQueue = renderQueue.then(async () => {
      let engine;
      try {
        engine = await loadEngine();
      } catch (err) {
        items.forEach(it => showError(it.wrap, err && err.message ? err.message : String(err)));
        return;
      }
      for (const it of items) {
        await renderItem(engine, it);
      }
    }).catch(err => {
      console.error('PlantUML 渲染错误：', err);
    });
  }

  window.mdvPlantUml = { collectPlantUml, renderPlantUml };
})();
