const path = require('path');
const os = require('os');
const { chromium } = require(path.join(os.homedir(), 'AppData/Roaming/npm/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.addInitScript(() => {
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

  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(700);
  const langBtn = page.locator('button.language-choice').first();
  if (await langBtn.isVisible().catch(() => false)) { await langBtn.click(); await page.waitForTimeout(350); }
  await page.waitForSelector('#roam', { state: 'visible', timeout: 10000 });
  await page.click('#roam');
  await page.waitForFunction(() => {
    const hud = document.getElementById('hud'), boot = document.getElementById('boot'), title = document.getElementById('title');
    return hud && !hud.hidden && (!boot || boot.hidden) && (!title || title.hidden);
  }, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const inspect = () => page.evaluate(() => {
    const horn = document.getElementById('touch-horn');
    const drawer = document.querySelector('.touch-quick-drawer');
    return {
      mode: document.getElementById('touch')?.dataset.mode,
      hornInDrawer: horn ? drawer.contains(horn) : false,
      hornHidden: horn ? horn.hidden : null,
      hornVisible: horn ? (getComputedStyle(horn).display !== 'none' && horn.getBoundingClientRect().width > 0) : false,
      open: document.getElementById('game').classList.contains('touch-more-open'),
    };
  });

  // 步行态展开抽屉
  await page.locator('.touch-more').tap();
  await page.waitForTimeout(300);
  console.log('WALK_OPEN:', JSON.stringify(await inspect()));
  await page.locator('.touch-more').tap();
  await page.waitForTimeout(200);

  // 进入车
  await page.evaluate(() => {
    const sim = window.__qaSim;
    if (!sim) return;
    sim.quickSummonVehicle?.();
    const car = (sim.cars || []).find(c => c.type === 'player') || (sim.cars || []).slice(-1)[0];
    if (car) sim.handleInteraction({ kind: 'enter', car });
  });
  await page.waitForTimeout(1200);
  await page.locator('.touch-more').tap();
  await page.waitForTimeout(300);
  console.log('CAR_OPEN:', JSON.stringify(await inspect()));
  await page.screenshot({ path: 'tools/mobile_horn_in_drawer.png' });

  console.log('ERRORS:', errors.length, errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
