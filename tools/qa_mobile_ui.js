const path = require('path');
const os = require('os');
const { chromium } = require(path.join(os.homedir(), 'AppData/Roaming/npm/node_modules/playwright'));

// usage: node tools/qa_mobile_ui.js <prefix> [device]
// device: portrait (default) | landscape
const prefix = process.argv[2] || 'mobile';
const device = process.argv[3] || 'portrait';
const viewport = device === 'landscape'
  ? { width: 844, height: 390 }
  : { width: 390, height: 844 };

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  await page.addInitScript(() => {
    let wrapped = false;
    const poll = setInterval(() => {
      if (!wrapped && window.Tideline && typeof window.Tideline.createSimulation === 'function') {
        wrapped = true;
        clearInterval(poll);
        const orig = window.Tideline.createSimulation;
        window.Tideline.createSimulation = async function (...args) {
          const sim = await orig.apply(this, args);
          window.__qaSim = sim;
          return sim;
        };
      }
    }, 20);
  });

  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(800);
  const langBtn = page.locator('button.language-choice').first();
  if (await langBtn.isVisible().catch(() => false)) {
    await langBtn.click();
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('#roam', { state: 'visible', timeout: 10000 });
  await page.click('#roam');

  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(500);
    const ready = await page.evaluate(() => {
      const boot = document.getElementById('boot');
      const title = document.getElementById('title');
      return Boolean(window.__qaSim) && (!boot || boot.hidden) && (!title || title.hidden);
    });
    if (ready) break;
  }
  await page.evaluate(() => {
    const sel = document.getElementById('graphics-setting');
    if (sel) { sel.value = 'ultra'; sel.dispatchEvent(new Event('change')); }
  });
  await page.waitForTimeout(1500);

  const flag = await page.evaluate(() => ({
    touch: document.getElementById('game')?.classList.contains('touch-enabled'),
    mode: document.getElementById('touch')?.dataset.mode,
  }));
  console.log('TOUCH_STATE:', JSON.stringify(flag));

  // place player at a nice street spot for both shots
  await page.evaluate(() => {
    const sim = window.__qaSim;
    if (!sim) return;
    sim.state.vehicle = null;
    sim.state.boat = null;
    sim.state.player.x = 280;
    sim.state.player.z = 158;
    sim.state.player.vx = sim.state.player.vz = 0;
    const yaw = Math.atan2(255 - 280, 132 - 158);
    sim.state.player.yaw = yaw;
    sim.state.viewYaw = yaw;
    sim.state.freeYaw = 0;
    sim.state.viewPitch = -0.02;
    sim.state.hour = 10.6;
    sim.state.weather = 0;
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `tools/${prefix}_walk.png` });
  console.log('CAPTURED:', prefix + '_walk.png');

  // enter a car for the driving-state layout
  await page.evaluate(() => {
    const sim = window.__qaSim;
    if (!sim) return;
    sim.quickSummonVehicle?.();
    const car = (sim.cars || []).find(c => c.type === 'player') || (sim.cars || []).slice(-1)[0];
    if (car) sim.handleInteraction({ kind: 'enter', car });
  });
  await page.waitForTimeout(1200);
  const driveMode = await page.evaluate(() => document.getElementById('touch')?.dataset.mode);
  console.log('DRIVE_MODE:', driveMode);
  await page.screenshot({ path: `tools/${prefix}_drive.png` });
  console.log('CAPTURED:', prefix + '_drive.png');

  console.log('ERRORS:', errors.length, errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
