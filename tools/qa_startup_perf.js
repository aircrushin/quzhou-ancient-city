const path = require('path');
const os = require('os');
const { chromium } = require(path.join(os.homedir(), 'AppData/Roaming/npm/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { const t = m.text(); if (t.startsWith('[PERF]')) console.log(t); });

  await page.addInitScript(() => {
    window.__QA_PERF__ = true;
    let wrapped = false;
    const poll = setInterval(() => {
      if (!wrapped && window.Tideline && typeof window.Tideline.createSimulation === 'function') {
        wrapped = true; clearInterval(poll);
        const orig = window.Tideline.createSimulation;
        window.Tideline.createSimulation = async function (...args) {
          const sim = await orig.apply(this, args); window.__qaSim = sim; return sim;
        };
      }
    }, 20);
  });

  const PORT = process.env.QA_PORT || '8080';
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('domcontentloaded ms:', Date.now() - t0);

  // 资源耗时（navigation + resource timing）
  const resources = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(e => e.initiatorType === 'script')
    .map(e => ({ name: e.name.split('/').pop(), ms: Math.round(e.duration), size: e.transferSize }))
    .sort((a, b) => b.ms - a.ms).slice(0, 12));
  console.log('TOP SCRIPT LOADS:', JSON.stringify(resources));

  // 语言选择
  await page.waitForTimeout(500);
  const langBtn = page.locator('button.language-choice').first();
  if (await langBtn.isVisible().catch(() => false)) { await langBtn.click(); await page.waitForTimeout(300); }

  // 注入阶段计时：hook setBootProgress 无法直接访问，改为轮询 DOM 文本变化
  await page.evaluate(() => {
    window.__stageLog = [];
    const el = document.getElementById('boot-status-text');
    window.__stageTimer = setInterval(() => {
      if (!el) return;
      const txt = (el.textContent || '').trim();
      const pct = document.getElementById('boot-progress-percent')?.textContent || '';
      const last = window.__stageLog[window.__stageLog.length - 1];
      const key = txt + '|' + pct;
      if (!last || last.key !== key) window.__stageLog.push({ t: Math.round(performance.now()), key });
    }, 30);
  });

  await page.waitForSelector('#roam', { state: 'visible', timeout: 15000 });
  const clickT = Date.now();
  await page.click('#roam');
  await page.waitForFunction(() => {
    const hud = document.getElementById('hud'), boot = document.getElementById('boot'), title = document.getElementById('title');
    return hud && !hud.hidden && (!boot || boot.hidden) && (!title || title.hidden);
  }, { timeout: 120000 }).catch(() => {});
  const enteredT = Date.now();
  console.log('CLICK->ENTER ms:', enteredT - clickT);

  const stages = await page.evaluate(() => { clearInterval(window.__stageTimer); return window.__stageLog; });
  console.log('STAGE LOG:', JSON.stringify(stages));
  if (stages.length > 1) {
    for (let i = 1; i < stages.length; i++) {
      console.log(`  +${stages[i].t - stages[0].t}ms (${stages[i].t - stages[i-1].t}ms) ${stages[i].key}`);
    }
  }

  // 帧率采样：进入后 5 秒
  const fps = await page.evaluate(() => new Promise(resolve => {
    const frames = [];
    let last = performance.now();
    const end = last + 5000;
    function tick(t) {
      frames.push(t - last); last = t;
      if (t < end) requestAnimationFrame(tick);
      else {
        const sorted = [...frames].sort((a, b) => a - b);
        const sum = frames.reduce((a, b) => a + b, 0);
        resolve({
          count: frames.length,
          avgFps: +(1000 / (sum / frames.length)).toFixed(1),
          medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(1),
          p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
          maxMs: +sorted[sorted.length - 1].toFixed(1),
          over50ms: frames.filter(f => f > 50).length,
          over100ms: frames.filter(f => f > 100).length,
        });
      }
    }
    requestAnimationFrame(tick);
  }));
  console.log('FPS AFTER ENTER:', JSON.stringify(fps));

  // 渲染规模
  const renderInfo = await page.evaluate(() => {
    const s = window.__qaSim;
    if (!s) return { note: 'no sim handle' };
    return {
      drawCalls: s.context?.renderer?.info?.render?.calls,
      triangles: s.context?.renderer?.info?.render?.triangles,
      textures: s.context?.renderer?.info?.memory?.textures,
      geometries: s.context?.renderer?.info?.memory?.geometries,
      cars: s.cars?.length, peds: s.pedestrians?.length,
    };
  });
  console.log('RENDER INFO:', JSON.stringify(renderInfo));
  console.log('ERRORS:', errors.length, errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
