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
    const sim = window.__qaSim;
    sim.state.cameraMode = 1; // closer third-person view to inspect gait clearly
    sim.state.hour = 10.8;
    sim.state.weather = 0;
  });
  await page.waitForTimeout(800);

  // Hold W to walk forward and capture mid-stride frame
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(950);
  await page.screenshot({ path: 'tools/qa_walk_player.png' });
  const walkStats = await page.evaluate(() => {
    const p = window.__qaSim.state.player;
    return {
      walking: +p.walking.toFixed(2),
      stride: +p.stride.toFixed(2),
      gait: +p.gait.toFixed(2),
      pelvisYaw: +p.upper.rotation.y.toFixed(3),
      pelvisRoll: +p.upper.rotation.z.toFixed(3),
      chestYaw: +p.chest.rotation.y.toFixed(3),
      headYaw: +p.head.rotation.y.toFixed(3),
      leftKnee: +p.limbs[0].knee.rotation.x.toFixed(3),
      rightKnee: +p.limbs[1].knee.rotation.x.toFixed(3),
      leftAnkle: +p.limbs[0].boot.rotation.x.toFixed(3),
      rightAnkle: +p.limbs[1].boot.rotation.x.toFixed(3),
    };
  });
  await page.keyboard.up('KeyW');

  // Move near Kongmiao street crowd to inspect walking pedestrians
  await page.evaluate(() => {
    const sim = window.__qaSim;
    sim.state.player.x = 161;
    sim.state.player.z = 11;
    sim.state.player.vx = sim.state.player.vz = 0;
    const yaw = Math.atan2(0, -30);
    sim.state.player.yaw = yaw;
    sim.state.viewYaw = yaw;
    sim.state.freeYaw = 0;
    sim.state.viewPitch = 0.0;
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'tools/qa_walk_crowd.png' });

  console.log('WALK_STATS:', JSON.stringify(walkStats));
  console.log('ERRORS:', errors.length, errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
