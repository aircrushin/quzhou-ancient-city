const path = require('path');
const { execSync } = require('child_process');
const npmRoot = execSync('npm root -g').toString().trim();
const { chromium } = require(path.join(npmRoot, 'playwright'));

const prefix = process.argv[2] || 'qa_before';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(800);

  const langBtn = page.locator('button.language-choice').first();
  if (await langBtn.isVisible().catch(() => false)) {
    await langBtn.click();
    await page.waitForTimeout(400);
  }

  await page.waitForSelector('#roam', { state: 'visible', timeout: 10000 });
  await page.click('#roam');

  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const ready = await page.evaluate(() => {
      const boot = document.getElementById('boot');
      const title = document.getElementById('title');
      return (!boot || boot.hidden) && (!title || title.hidden);
    });
    if (ready) break;
  }
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const sel = document.getElementById('graphics-setting');
    if (sel) {
      sel.value = 'ultra';
      sel.dispatchEvent(new Event('change'));
    }
  });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const gl = c ? (c.getContext('webgl2') || c.getContext('webgl')) : null;
    const dbg = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
    return {
      w: c?.width,
      h: c?.height,
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'none'),
      graphicsVal: document.getElementById('graphics-setting')?.value
    };
  });
  console.log('INFO:', JSON.stringify(info));

  await page.screenshot({ path: `tools/${prefix}_spawn.png` });

  // Enter car and drive slightly down the street
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(800);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1600);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `tools/${prefix}_drive_day.png` });

  // Switch to Dusk (Golden Hour)
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `tools/${prefix}_dusk.png` });

  // Switch to Night + Wet Rain Reflections
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(600);
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `tools/${prefix}_night_wet.png` });

  console.log('ERRORS:', errors.length, errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
