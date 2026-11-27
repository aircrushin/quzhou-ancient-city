const path = require('path');
const os = require('os');
const { chromium } = require(path.join(os.homedir(), 'AppData/Roaming/npm/node_modules/playwright'));

const device = process.argv[2] || 'landscape';
const viewport = device === 'portrait' ? { width: 390, height: 844 } : { width: 844, height: 390 };
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(700);
  const langBtn = page.locator('button.language-choice').first();
  if (await langBtn.isVisible().catch(() => false)) { await langBtn.click(); await page.waitForTimeout(350); }
  await page.waitForSelector('#roam', { state: 'visible', timeout: 10000 });
  await page.click('#roam');
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(500);
    const ready = await page.evaluate(() => {
      const boot = document.getElementById('boot'), title = document.getElementById('title');
      return (!(boot && !boot.hidden) && !(title && !title.hidden));
    });
    if (ready) break;
  }
  await page.waitForTimeout(1200);

  const before = await page.evaluate(() => ({
    more: !!document.querySelector('.touch-more'),
    drawerButtons: [...document.querySelectorAll('.touch-quick-drawer > button')].map(b => b.id),
    open: document.getElementById('game').classList.contains('touch-more-open'),
  }));
  console.log('BEFORE:', JSON.stringify(before));

  // tap the "more" button via touch
  await page.locator('.touch-more').tap();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const drawer = document.querySelector('.touch-quick-drawer');
    const rest = document.getElementById('touch-rest');
    return {
      open: document.getElementById('game').classList.contains('touch-more-open'),
      drawerDisplay: drawer ? getComputedStyle(drawer).display : 'none',
      restVisible: rest ? (rest.getBoundingClientRect().width > 0 && getComputedStyle(rest).display !== 'none') : false,
      expanded: document.querySelector('.touch-more')?.getAttribute('aria-expanded'),
    };
  });
  console.log('AFTER_TAP:', JSON.stringify(after));
  await page.screenshot({ path: `tools/mobile_more_open_${device}.png` });

  // tap rest inside drawer -> should close and toggle rest mode
  await page.locator('#touch-rest').tap();
  await page.waitForTimeout(400);
  const closed = await page.evaluate(() => document.getElementById('game').classList.contains('touch-more-open'));
  console.log('AFTER_SELECT_CLOSE:', closed);

  console.log('ERRORS:', errors.length, errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
