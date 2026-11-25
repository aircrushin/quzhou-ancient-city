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
  await page.waitForTimeout(1800);

  const stats = await page.evaluate(() => {
    const sim = window.__qaSim;
    const tStats = sim?.traffic?.getStats?.() || {};
    const totalCars = sim?.cars?.length || 0;
    const ambientParked = (sim?.cars || []).filter(c => c.ambientParked).length;
    const garageParked = (sim?.cars || []).filter(c => c.type === 'parked' && !c.ambientParked).length;
    const stationaryPeds = (sim?.pedestrians || []).filter(p => p.stationary).length;
    return { ...tStats, totalCars, ambientParked, garageParked, stationaryPeds };
  });
  console.log('CITY_STATS:', JSON.stringify(stats));

  const shots = [
    { name: 'hub_avenue', px: 280, pz: 158, tx: 255, tz: 132, hour: 10.6, pitch: -0.02 },
    { name: 'belltower_junction', px: 33, pz: -64, tx: 33, tz: -104, hour: 15.8, pitch: 0.02 },
    { name: 'shuitingmen_plaza', px: -204, pz: -64, tx: -176, tz: -82, hour: 16.4, pitch: 0.03 },
    { name: 'kongmiao_street', px: 162, pz: 14, tx: 161, tz: -24, hour: 10.8, pitch: 0.02 },
    { name: 'mazhandi_street', px: 73, pz: 154, tx: 73, tz: 118, hour: 16.6, pitch: 0.01 },
  ];

  for (const s of shots) {
    await page.evaluate(({ px, pz, tx, tz, hour, pitch }) => {
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
      sim.state.viewPitch = pitch;
      sim.state.hour = hour;
      sim.state.weather = 0;
    }, s);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `tools/qa_city_${s.name}.png` });
    const nearby = await page.evaluate(({ px, pz }) => {
      const sim = window.__qaSim;
      const nearCars = (sim?.cars || []).filter(c => Math.hypot(c.x - px, c.z - pz) < 90).length;
      const nearPeds = (sim?.pedestrians || []).filter(p => Math.hypot(p.x - px, p.z - pz) < 75).length;
      return { nearCars, nearPeds };
    }, s);
    console.log('CAPTURED:', s.name, JSON.stringify(nearby));
  }

  console.log('ERRORS:', errors.length, errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
