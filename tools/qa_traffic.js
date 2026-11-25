const path = require('path');
const { execSync } = require('child_process');
const npmRoot = execSync('npm root -g').toString().trim();
const { chromium } = require(path.join(npmRoot, 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()); });
  page.on('pageerror', err => errors.push('pageerror: ' + err.message));

  await page.goto('http://127.0.0.1:8080/?debug', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(700);
  const langBtn = page.locator('button.language-choice').first();
  if (await langBtn.isVisible().catch(() => false)) { await langBtn.click(); await page.waitForTimeout(300); }
  await page.waitForSelector('#roam', { state: 'visible', timeout: 10000 });
  await page.click('#roam');
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(350);
    const ready = await page.evaluate(() => Boolean(window.__taxiDebug?.sim?.state?.active && document.getElementById('title-screen')?.hidden));
    if (ready) break;
  }
  await page.waitForTimeout(900);

  // Position looking down a clean wide arterial crosswalk & lane arrow (near spawn/HUB)
  const meta = await page.evaluate(() => {
    const sim = window.__taxiDebug.sim;
    const tr = sim.traffic;
    const p = sim.protagonist();
    const hub = { x: 285, z: 166 };
    const cws = tr.crosswalks.filter(c => c.hasArrow && c.signal && c.width >= 12);
    // Pick one on an arterial/main road away from green park median
    const cw = cws.sort((a, b) => Math.hypot(a.x - hub.x, a.z - hub.z) - Math.hypot(b.x - hub.x, b.z - hub.z))[2] || cws[0];
    const laneSpan = Math.max(1.8, cw.width * 0.5 - 1.35);
    const laneCenter = 0.28 + laneSpan * 0.5;
    const d = cw.stopDist + 10.5;
    p.x = cw.node.x + cw.ux * d + cw.rightX * (laneCenter + 2.2);
    p.z = cw.node.z + cw.uz * d + cw.rightZ * (laneCenter + 2.2);
    const lookX = cw.x + cw.rightX * laneCenter;
    const lookZ = cw.z + cw.rightZ * laneCenter;
    const yaw = Math.atan2(lookX - p.x, lookZ - p.z);
    p.yaw = yaw; sim.state.viewYaw = yaw; sim.state.freeYaw = 0; sim.state.viewPitch = 0.14;
    sim.state.hour = 10.6;
    sim.update(0.016, new Set(), true);
    return { stats: tr.getStats(), cw: { x: cw.x, z: cw.z, width: cw.width } };
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tools/qa_traffic_final.png' });
  console.log('FINAL_CHECK:', JSON.stringify(meta));
  console.log('ERRORS:', errors.length, errors);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
