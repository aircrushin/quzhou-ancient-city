const path = require('path');
const os = require('os');
const { chromium } = require(path.join(os.homedir(), 'AppData/Roaming/npm/node_modules/playwright'));

// 用空响应拦截精简层，还原"优化前"界面，生成竖屏基线截图
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.route('**/mobile-ui.css*', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/mobile-ui.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));

  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(700);
  const langBtn = page.locator('button.language-choice').first();
  if (await langBtn.isVisible().catch(() => false)) { await langBtn.click(); await page.waitForTimeout(350); }
  await page.waitForSelector('#roam', { state: 'visible', timeout: 10000 });
  await page.click('#roam');
  // 等到游戏 HUD 显示且加载进度完成
  await page.waitForFunction(() => {
    const hud = document.getElementById('hud');
    const boot = document.getElementById('boot');
    const title = document.getElementById('title');
    const bar = document.getElementById('boot-progress') || document.querySelector('.boot-progress');
    const hudVisible = hud && !hud.hidden;
    const bootDone = !boot || boot.hidden;
    const titleDone = !title || title.hidden;
    return hudVisible && bootDone && titleDone;
  }, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'tools/mobile_baseline_portrait.png' });
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
