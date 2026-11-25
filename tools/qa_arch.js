const path = require('path');
const { execSync } = require('child_process');
const npmRoot = execSync('npm root -g').toString().trim();
const { chromium } = require(path.join(npmRoot, 'playwright'));

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
  await page.waitForTimeout(700);
  const langBtn = page.locator('button.language-choice').first();
  if (await langBtn.isVisible().catch(() => false)) {
    await langBtn.click();
    await page.waitForTimeout(350);
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
  await page.waitForTimeout(1400);

  const shots = [
    { name: 'shuitingmen', px: -206, pz: -78, tx: -178, tz: -80, hour: 16.5 },
    { name: 'kongmiao', px: 161.4, pz: 4.5, tx: 161.4, tz: -24, hour: 10.6 },
    { name: 'belltower', px: 33, pz: -76, tx: 33, tz: -104, hour: 16.6 },
    { name: 'tianwang', px: -62, pz: -84, tx: -90, tz: -104, hour: 16.7 },
    { name: 'huizhou', px: 73.3, pz: 144, tx: 73.3, tz: 120, hour: 16.75 },
  ];

  for (const s of shots) {
    await page.evaluate(({ px, pz, tx, tz, hour }) => {
      const sim = window.__qaSim;
      if (!sim) return;
      sim.state.vehicle = null;
      sim.state.boat = null;
      sim.state.player.x = px;
      sim.state.player.z = pz;
      sim.state.player.vx = sim.state.player.vz = 0;
      const yaw = Math.atan2(tx - px, tz - pz);
      sim.state.player.yaw = yaw;
      sim.state.viewYaw = yaw;
      sim.state.freeYaw = 0;
      sim.state.viewPitch = 0.08;
      sim.state.hour = hour;
      sim.state.weather = 0;
    }, s);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `tools/qa_arch_${s.name}.png` });
    console.log('CAPTURED:', s.name);
  }

  console.log('ERRORS:', errors.length, errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
