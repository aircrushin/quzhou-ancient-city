/* Mobile UI Cleanup — 把低频触屏按键收进"更多"抽屉
   依赖：touch.js 导出的 Tideline.trackDrag
   加载顺序：touch.js 之后、game.js 之前（defer）                    */
(() => {
  'use strict';
  const D = window.Tideline;
  const game = document.getElementById('game');
  const deck = document.getElementById('touch');
  const bar = deck && deck.querySelector('.touch-quick-bar');
  if (!D || typeof D.trackDrag !== 'function' || !game || !bar) return;

  // 低频操作全部移入抽屉；仅保留召唤这类高频键在快捷栏
  // 鸣笛/车灯在步行态由 touch.js 自动 hidden，展开抽屉时不会显示
  const lowFreq = ['touch-rest', 'touch-photo', 'touch-workshop', 'touch-lights', 'touch-horn'];
  const drawer = document.createElement('div');
  drawer.className = 'touch-quick-drawer';
  drawer.setAttribute('role', 'group');
  drawer.setAttribute('aria-label', '更多操作');
  for (const id of lowFreq) {
    const el = document.getElementById(id);
    if (el) drawer.appendChild(el);
  }
  if (!drawer.childElementCount) return;
  bar.insertBefore(drawer, bar.firstChild);

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'touch-more';
  more.setAttribute('aria-label', '更多操作');
  more.setAttribute('aria-expanded', 'false');
  more.innerHTML = '<svg viewBox="0 0 28 24" aria-hidden="true"><circle cx="7" cy="12" r="1.7"/><circle cx="14" cy="12" r="1.7"/><circle cx="21" cy="12" r="1.7"/></svg>';
  bar.appendChild(more);

  const isOpen = () => game.classList.contains('touch-more-open');
  function setOpen(open) {
    game.classList.toggle('touch-more-open', open);
    more.setAttribute('aria-expanded', String(open));
  }

  // trackDrag 同时支持触摸与鼠标，且与游戏内的触摸保护机制一致
  D.trackDrag(game, more, () => true, () => setOpen(!isOpen()));

  // 选中抽屉内任一操作后收起；点击空白处也收起
  drawer.addEventListener('pointerdown', () => {
    if (isOpen()) setTimeout(() => setOpen(false), 0);
  }, true);
  document.addEventListener('pointerdown', event => {
    if (isOpen() && !bar.contains(event.target)) setOpen(false);
  });
})();
