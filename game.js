(() => {
  'use strict';
  const D = window.Tideline;
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'tideline-dispatch/baixi/v1';
  const GRAPHICS = ['auto', 'ultra', 'high', 'performance'];
  const TOUCH_SETTINGS = ['auto', 'on', 'off'];
  const LOOK_GAINS = { low: 72, normal: 100, high: 132 };
  const { BOUNDS, MARINE, WORKSHOP, WEATHER, VEHICLE_ORDER, VEHICLE_META, UPGRADE_TREE, VISUAL_CATALOG, normalizeGarage, computeCarStats, clamp, distance } = D;

  function readProgress() {
    const defaults = { cash: 320, deliveries: 0, visitedLandmarks: [], tapes: [], photos: [], spots: [], eventsDone: 0, raceBest: 0, lakeRaceBest: 0, favoriteCar: 'coupe', taxi: { trips: 0, earned: 0, best: 0 }, garage: normalizeGarage(null), graphics: 'auto', touch: 'auto',
      lookGain: 'normal', mouseSensitivity: 100, touchSensitivity: 100, sound: true, reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!raw || typeof raw !== 'object') return defaults;
      const legacyGain = Object.hasOwn(LOOK_GAINS, raw.lookGain) ? raw.lookGain : 'normal';
      const percent = value => Number.isFinite(value) ? clamp(Math.round(value), 30, 180) : LOOK_GAINS[legacyGain];
      return {
        cash: Number.isSafeInteger(raw.cash) ? clamp(raw.cash, 0, 999999999) : defaults.cash,
        deliveries: Number.isSafeInteger(raw.deliveries) && raw.deliveries >= 0 ? raw.deliveries : defaults.deliveries,
        visitedLandmarks: Array.isArray(raw.visitedLandmarks) ? [...new Set(raw.visitedLandmarks.filter(id => typeof id === 'string'))] : [],
        tapes: Array.isArray(raw.tapes) ? [...new Set(raw.tapes.filter(id => typeof id === 'string'))] : [],
        photos: Array.isArray(raw.photos) ? [...new Set(raw.photos.filter(id => typeof id === 'string'))] : [],
        spots: Array.isArray(raw.spots) ? [...new Set(raw.spots.filter(id => typeof id === 'string'))] : [],
        eventsDone: Number.isSafeInteger(raw.eventsDone) && raw.eventsDone >= 0 ? raw.eventsDone : 0,
        raceBest: Number.isFinite(raw.raceBest) && raw.raceBest > 0 ? Math.round(raw.raceBest * 100) / 100 : 0,
        lakeRaceBest: Number.isFinite(raw.lakeRaceBest) && raw.lakeRaceBest > 0 ? Math.round(raw.lakeRaceBest * 100) / 100 : 0,
        favoriteCar: ['hatch', 'coupe', 'sedan', 'van'].includes(raw.favoriteCar) ? raw.favoriteCar : 'coupe',
        taxi: (() => {
          const value = raw.taxi && typeof raw.taxi === 'object' ? raw.taxi : {};
          const positive = number => Number.isSafeInteger(number) && number >= 0 ? number : 0;
          return { trips: positive(value.trips), earned: positive(value.earned),
            best: Number.isFinite(value.best) && value.best > 0 ? value.best : 0 };
        })(),
        garage: normalizeGarage(raw.garage, raw.paint, raw.tune),
        graphics: GRAPHICS.includes(raw.graphics) ? raw.graphics : defaults.graphics,
        touch: TOUCH_SETTINGS.includes(raw.touch) ? raw.touch : defaults.touch,
        lookGain: legacyGain, mouseSensitivity: percent(raw.mouseSensitivity), touchSensitivity: percent(raw.touchSensitivity),
        sound: raw.sound !== false, reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : defaults.reduceMotion,
      };
    } catch {
      return defaults;
    }
  }

  const progress = readProgress();
  const shells = { help: $('help-panel'), map: $('map-panel'), pause: $('pause-panel'), workshop: $('workshop-panel'), photo: $('photo-panel') };
  const game = $('game');
  const language = D.language;
  language.init(game);
  const languageScreen = $('language-screen');
  const languageSetting = $('language-setting');
  let languageChosen = false;
  const scene = $('scene');
  const title = $('title-screen');
  const hud = $('hud');
  const taxiButton = $('taxi-start');
  const roamButton = $('roam');
  const launchButtons = [taxiButton, roamButton];
  const status = $('boot-status');
  const statusText = $('boot-status-text');
  const bootPercent = $('boot-progress-percent');
  const bootTrack = $('boot-progress-track');
  const bootFill = $('boot-progress-fill');
  let bootProgressValue = 0;
  const graphicsRecovery = $('graphics-recovery');
  const graphicsMessage = $('graphics-message');
  const graphicsRetry = $('graphics-retry');
  const fullscreenButton = $('fullscreen-button');
  const appDisplay = matchMedia('(display-mode: fullscreen), (display-mode: standalone)');
  const mobilePointer = matchMedia('(pointer: coarse)');
  const mousePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const portraitViewport = matchMedia('(orientation: portrait)');
  // Keep the game inside the fullscreen element so the viewport can rotate independently.
  const fullscreenRoot = document.documentElement;
  const fullscreen = fullscreenRoot.requestFullscreen && document.fullscreenEnabled !== false
    ? { enter: () => fullscreenRoot.requestFullscreen({ navigationUI: 'hide' }), exit: () => document.exitFullscreen() }
    : fullscreenRoot.webkitRequestFullscreen && document.webkitFullscreenEnabled !== false
      ? { enter: () => fullscreenRoot.webkitRequestFullscreen(), exit: () => document.webkitExitFullscreen() }
      : null;
  const radar = $('radar');
  const map = $('big-map');
  const keyboard = new Set();
  const holdCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']);
  const photoHoldCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
  let sim, panel = null, helpFrom = null, restoreFocus = null, view = 'title', booting = false, last = 0, hudRefresh = 0, radarRefresh = 0;
  const workshopState = { kind: 'taxi', tab: 'performance', drag: null };
  const photoState = { drag: null, uiHidden: false, flashTimer: 0, bannerUntil: 0 };
  let graphicsState = 'ok', graphicsRetried = false, resizePending = false;
  let landscapeRequested = false, orientationAttempted = false;
  let mouseLook = false, mousePosition = null;
  let pointer = null;
  let lookYaw = 0, lookPitch = 0;
  let activeLookDevice = mobilePointer.matches ? 'touch' : 'mouse';
  let settingsDevice = activeLookDevice, hintUntil = 0;
  const shownLookHints = new Set();
  const lookFields = { mouse: 'mouseSensitivity', touch: 'touchSensitivity' };
  const canControl = () => view === 'game' && !panel && graphicsState === 'ok' && !document.hidden;
  const touch = D.makeTouchControls(game, $('touch'), progress.touch, canControl, action);
  const keys = {
    has: code => keyboard.has(code) || touch.has(code),
    get axisX() { return touch.x; },
    get axisY() { return touch.y; },
  };

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    } catch {
      // The session remains playable when storage is disabled.
    }
  }
  function showSound() {
    for (const id of ['title-audio', 'pause-audio']) {
      const button = $(id);
      button.setAttribute('aria-pressed', progress.sound);
      titleFor(button, progress.sound ? '声音开启' : '声音关闭');
    }
    titleFor($('motion-button'), progress.reduceMotion ? '镜头震动关闭' : '镜头震动开启');
    $('motion-button').setAttribute('aria-pressed', !progress.reduceMotion);
  }
  function restoreControls() {
    keyboard.clear();
    touch.reset();
    cameraDrag.reset();
    mousePosition = null;
    lookYaw = lookPitch = 0;
  }
  function queueResize() {
    resizePending = true;
  }
  function requestMouseLook() {
    if (!mouseLook || touch.activatingByTouch || !scene.requestPointerLock || document.pointerLockElement) return;
    try { scene.requestPointerLock()?.catch(() => {}); } catch {}
  }
  function releaseMouseLook() {
    mousePosition = null;
    if (document.pointerLockElement === scene) document.exitPointerLock();
  }
  function flushLook() {
    if (!lookYaw && !lookPitch) return;
    sim.turnCamera(lookYaw, lookPitch, true);
    lookYaw = lookPitch = 0;
  }
  function queueMouseLook(dx, dy) {
    activeLookDevice = 'mouse';
    const gain = progress.mouseSensitivity / 100;
    lookYaw += dx * .0036 * gain;
    lookPitch += dy * .0028 * gain;
  }
  function lookWithMouse(event) {
    if (event.pointerType !== 'mouse' || event.sourceCapabilities?.firesTouchEvents || pointer || !canControl() || document.pointerLockElement === scene) return;
    if (event.target !== scene) {
      mousePosition = null;
      return;
    }
    mouseLook = true;
    const previous = mousePosition;
    mousePosition = { x: event.clientX, y: event.clientY };
    if (!previous) return;
    queueMouseLook(previous.x - mousePosition.x, previous.y - mousePosition.y);
  }
  function fullscreenActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function inWebApp() {
    return navigator.standalone === true || (!fullscreenActive() && appDisplay.matches);
  }
  function showFullscreenControl() {
    fullscreenButton.hidden = !fullscreen || inWebApp();
    titleFor(fullscreenButton, fullscreenActive() ? '退出全屏' : '全屏');
  }
  function updateLandscapeLayout() {
    const rotated = landscapeRequested && portraitViewport.matches;
    if (game.classList.contains('rotate-landscape') === rotated) return;
    restoreControls();
    game.classList.toggle('rotate-landscape', rotated);
    queueResize();
  }
  function updateOrientationLock() {
    const orientation = screen.orientation;
    const canLock = landscapeRequested && (fullscreenActive() || inWebApp());
    if (!canLock) {
      if (!orientationAttempted) return;
      orientationAttempted = false;
      try { orientation?.unlock?.(); } catch {}
      return;
    }
    if (orientationAttempted || !orientation?.lock) return;
    orientationAttempted = true;
    try {
      orientation.lock('landscape').catch(() => {});
    } catch {
      // The portrait viewport rotates the game if the native lock is unavailable.
    }
  }
  function setLandscape(requested) {
    landscapeRequested = requested;
    updateLandscapeLayout();
    updateOrientationLock();
  }
  function toggleFullscreen() {
    if (!fullscreen || inWebApp()) return;
    try {
      const result = fullscreenActive() ? fullscreen.exit() : fullscreen.enter();
      result?.catch(showFullscreenControl);
    } catch {
      showFullscreenControl();
    }
  }
  function fullscreenChanged() {
    showFullscreenControl();
    updateOrientationLock();
    queueResize();
  }
  function openPanel(kind) {
    if (!shells[kind] || (view !== 'game' && kind !== 'help')) return;
    if (panel == null) restoreFocus = document.activeElement;
    if (kind === 'help') helpFrom = panel;
    panel = kind;
    releaseMouseLook();
    restoreControls();
    title.inert = hud.inert = true;
    for (const [name, node] of Object.entries(shells)) node.hidden = name !== panel;
    if (kind === 'map') renderMapPanel();
    if (kind === 'pause') {
      settingsDevice = activeLookDevice;
      showLookDetails(false);
      titleFor($('pause-switch-mode'), sim.state.mode === 'taxi' ? '切换至自由探索模式' : '切换至出租车接客模式');
    }
    if (kind === 'workshop') {
      workshopState.kind = sim.state.vehicle?.model.kind ?? (sim.state.mode === 'taxi' ? 'taxi' : workshopState.kind ?? 'taxi');
      sim.setShowroom(true, workshopState.kind, { resetAngle: true });
      renderWorkshop();
    }
    if (kind === 'photo') {
      photoState.uiHidden = false;
      photoState.bannerUntil = 0;
      shells.photo.classList.remove('ui-hidden');
      if ($('photo-show-ui-btn')) $('photo-show-ui-btn').hidden = true;
      sim.setPhotoMode(true);
      syncPhotoUi();
    }
    const firstAction = kind === 'photo' ? $('photo-capture-btn') : shells[panel].querySelector('[data-close]');
    firstAction?.focus({ preventScroll: true });
  }
  function closePanel() {
    if (!panel) return;
    const closing = panel;
    if (panel === 'pause' && !$('look-controls').hidden) showLookDetails(false);
    shells[panel].hidden = true;
    if (panel === 'help' && helpFrom) {
      const back = helpFrom;
      helpFrom = null;
      openPanel(back);
      return;
    }
    panel = helpFrom = null;
    title.inert = hud.inert = false;
    if (closing === 'workshop' && sim) {
      sim.setShowroom(false);
      drawHud();
      drawMap(radar, false);
    }
    if (closing === 'photo' && sim) {
      photoState.drag = null;
      photoState.bannerUntil = 0;
      scene.style.filter = '';
      shells.photo.classList.remove('ui-hidden');
      if ($('photo-show-ui-btn')) $('photo-show-ui-btn').hidden = true;
      sim.setPhotoMode(false);
      drawHud();
      drawMap(radar, false);
    }
    restoreControls();
    if (restoreFocus instanceof HTMLElement && restoreFocus !== document.body) restoreFocus.focus({ preventScroll: true });
    restoreFocus = null;
  }

  const Y = window.QuzhouRoadData || window.YulinRoadData;
  const Atlas = window.QuzhouAtlas;
  const districtPins = [
    ['水亭门古街', -180, -80], ['天王塔院', -90, -104], ['北门 · 拱辰门', 95, -173],
    ['孔氏南宗家庙', 161, -22], ['县西街 · 钟楼底', 33, -104], ['马站底 · 上下街', 73, 123],
    ['府山公园', 184, 76], ['大南门 · 礼贤街', -94, 140], ['府东街 · 迎和门', 239, -7],
    ['南湖 · 劳动路', -48, 232], ['信安湖东岸', 325, -42], ['严家淤岛', MARINE.island.x + 8, MARINE.island.z - 19],
  ];
  let mapBase = null, radarBase = null;
  let tmapInstance = null, tmapPlayerLayer = null, tmapRouteLayer = null, tmapPoiLayer = null, tmapMode = false;
  const mapFrame = Atlas?.MAP_FRAME || { left: -368, top: -358, width: 1184, height: 804 };
  const chartWater = '#2f788e';
  const atlasWater = Atlas?.WATER_INK || '#7ea8a7';
  const routeInk = '#a4efd0';
  const atlasRouteInk = '#1a8769';
  const chartIntervals = [10, 25, 50, 100, 200, 500];
  const radarRuler = $('radar-scale'), atlasRuler = $('atlas-scale');
  const atlasTooltip = $('atlas-tooltip');
  const atlasState = {
    zoom: 1,
    centerX: mapFrame.left + mapFrame.width / 2,
    centerZ: mapFrame.top + mapFrame.height / 2,
    hoveredId: null,
    hoveredRestId: null,
    drag: null,
  };
  function restAmbientLabel(id) {
    const found = D.REST_AMBIENTS?.find(item => item.id === id);
    return found ? found.name : '氛围静音';
  }
  function hitTestRestSpot(metrics, px, py, radiusPx) {
    if (!sim || sim.state.race?.active || !D.REST_SPOTS?.length) return null;
    let best = null;
    let bestDist = radiusPx;
    for (const spot of D.REST_SPOTS) {
      const [rx, ry] = metrics.view(spot);
      const d = Math.hypot(px - rx, py - ry);
      if (d <= bestDist) {
        bestDist = d;
        best = spot;
      }
    }
    return best ? { ...best, kind: 'restSpot' } : null;
  }
  function clampAtlasCenter() {
    const halfW = mapFrame.width * 0.5;
    const halfH = mapFrame.height * 0.5;
    const padX = halfW * (1 - 1 / atlasState.zoom) + 40;
    const padZ = halfH * (1 - 1 / atlasState.zoom) + 40;
    const midX = mapFrame.left + halfW;
    const midZ = mapFrame.top + halfH;
    atlasState.centerX = clamp(atlasState.centerX, midX - padX, midX + padX);
    atlasState.centerZ = clamp(atlasState.centerZ, midZ - padZ, midZ + padZ);
  }
  function resetAtlasView() {
    atlasState.zoom = 1;
    atlasState.centerX = mapFrame.left + mapFrame.width / 2;
    atlasState.centerZ = mapFrame.top + mapFrame.height / 2;
  }
  function getAtlasMetrics(canvas) {
    const pr = Math.min(2, devicePixelRatio || 1);
    const width = canvas.width;
    const height = canvas.height;
    const baseScale = Math.min((width - 20 * pr) / mapFrame.width, (height - 14 * pr) / mapFrame.height);
    const scale = baseScale * atlasState.zoom;
    const center = { x: atlasState.centerX, z: atlasState.centerZ };
    const view = point => [width / 2 + (point.x - center.x) * scale, height / 2 + (point.z - center.z) * scale];
    const unproject = (px, py) => ({ x: center.x + (px - width / 2) / scale, z: center.z + (py - height / 2) / scale });
    return { pr, width, height, scale, center, view, unproject };
  }
  function showAtlasTooltip(lm, clientX, clientY) {
    if (!atlasTooltip) return;
    if (!lm || tmapMode) {
      atlasTooltip.hidden = true;
      delete atlasTooltip.dataset.kind;
      return;
    }
    atlasTooltip.dataset.kind = lm.kind || 'landmark';
    if (lm.kind === 'tape') {
      titleFor($('atlas-tip-name'), lm.name);
      titleFor($('atlas-tip-badge'), '声景磁带');
      titleFor($('atlas-tip-desc'), lm.line || '收录古城声景可获 ¥80 奖励。');
      titleFor($('atlas-tip-hint'), sim && sim.state.mode !== 'taxi' && !sim.state.race?.active
        ? '点击规划前往此声景磁带的路线'
        : '切回自由探索模式后可导航收录');
    } else if (lm.kind === 'raceStart') {
      titleFor($('atlas-tip-name'), '环古城计时赛 · 起跑门');
      titleFor($('atlas-tip-badge'), '9 道计时门');
      titleFor($('atlas-tip-desc'), progress.raceBest
        ? '全长约 1.9 公里，金杯 ≤ 55 秒 · 个人最佳 ' + progress.raceBest.toFixed(2) + ' 秒'
        : '沿府东街、劳动路、衢江中路与西安路疾驰 9 道计时门，金杯 ≤ 55 秒');
      titleFor($('atlas-tip-hint'), '点击立即在起跑线发起环古城计时赛');
    } else if (lm.kind === 'lakeRaceStart') {
      titleFor($('atlas-tip-name'), '信安湖水上计时赛 · 起航门');
      titleFor($('atlas-tip-badge'), '7 道浮标门');
      titleFor($('atlas-tip-desc'), progress.lakeRaceBest
        ? '驾驶衢江快艇环绕严家淤岛，金杯 ≤ 48 秒 · 个人最佳 ' + progress.lakeRaceBest.toFixed(2) + ' 秒'
        : '驾驶衢江快艇环绕严家淤岛穿过 7 道水上浮标门，金杯 ≤ 48 秒');
      titleFor($('atlas-tip-hint'), '点击立即乘快艇发起信安湖水上计时赛');
    } else if (lm.kind === 'restSpot') {
      titleFor($('atlas-tip-name'), lm.name);
      titleFor($('atlas-tip-badge'), '憩息 · ' + restAmbientLabel(lm.ambient));
      titleFor($('atlas-tip-desc'), lm.poem || '');
      const canTravel = sim && sim.state.mode !== 'taxi' && !sim.state.race?.active;
      titleFor($('atlas-tip-hint'), canTravel
        ? '点击一键传送并落座小憩（右键导航前往）'
        : '切回自由探索模式后可传送落座小憩');
    } else {
      titleFor($('atlas-tip-name'), lm.name);
      titleFor($('atlas-tip-badge'), lm.badge || '古城地标');
      titleFor($('atlas-tip-desc'), lm.desc || '');
      const visited = progress.visitedLandmarks.includes(lm.id);
      const canNav = sim && sim.state.mode !== 'taxi' && !sim.state.race?.active;
      const isIsland = lm.kind === 'island' || lm.id === 'yanjiayu';
      titleFor($('atlas-tip-hint'), canNav
        ? (visited ? '✓ 已打卡 · 左键导航 / 右键或 Shift+点击快速传送' : (isIsland ? '首访 ¥150 · 点击导航至东岸码头乘艇登岛' : '首次到访奖励 ¥150 · 点击规划路线'))
        : '当前模式不可变更地标导航');
    }
    atlasTooltip.hidden = false;
    const plot = map.parentElement;
    if (plot) {
      const rect = plot.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const tipW = atlasTooltip.offsetWidth || 236;
      const tipH = atlasTooltip.offsetHeight || 96;
      const left = clamp(localX + 14, 8, Math.max(8, rect.width - tipW - 8));
      const top = clamp(localY - tipH - 12 < 8 ? localY + 16 : localY - tipH - 12, 8, Math.max(8, rect.height - tipH - 8));
      atlasTooltip.style.left = left + 'px';
      atlasTooltip.style.top = top + 'px';
    }
  }
  function roundedRect(ctx, x, y, width, height, radius) {
    if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius);
    else ctx.rect(x, y, width, height);
  }
  function mapSurface(isLarge) {
    if (Atlas) {
      if (isLarge) {
        if (!mapBase) mapBase = Atlas.createAtlasSurface(Y, D, sim?.world?.footprints);
        return mapBase;
      }
      if (!radarBase) radarBase = Atlas.createRadarSurface(Y, D, sim?.world?.footprints);
      return radarBase;
    }
    if (mapBase) return mapBase;
    const image = document.createElement('canvas');
    image.width = mapFrame.width * 2;
    image.height = mapFrame.height * 2;
    const ctx = image.getContext('2d');
    if (!ctx) return null;
    mapBase = image;
    ctx.scale(2, 2);
    ctx.translate(-mapFrame.left, -mapFrame.top);
    const depth = ctx.createLinearGradient(-250, 50, 810, 245);
    depth.addColorStop(0, '#345449');
    depth.addColorStop(.63, '#214543');
    depth.addColorStop(1, chartWater);
    ctx.fillStyle = depth;
    ctx.fillRect(mapFrame.left, mapFrame.top, mapFrame.width, mapFrame.height);
    ctx.fillStyle = '#b4bf9c49';
    for (let x = -360; x < 817; x += 20) {
      for (let z = -360; z < 447; z += 20) ctx.fillRect(x, z, 1.15, 1.15);
    }
    const island = MARINE.island;
    ctx.lineWidth = 1.3;
    for (const [radius, shade] of [[18, '#abc2a563'], [35, '#aac1a14e'], [57, '#8cae9b45'], [83, '#8cae9b31'], [118, '#8cae9b24']]) {
      ctx.strokeStyle = shade;
      ctx.beginPath();
      roundedRect(ctx, BOUNDS.minX - radius, BOUNDS.minZ - radius,
        BOUNDS.maxX - BOUNDS.minX + radius * 2, BOUNDS.maxZ - BOUNDS.minZ + radius * 2, radius * .93);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(island.x, island.z, island.rx + radius, island.rz + radius * .78, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#475a4c';
    ctx.fillRect(BOUNDS.minX, BOUNDS.minZ, BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ);
    // 绘制衢州古城真实街坊多边形地块
    if (Y) {
      ctx.lineWidth = 1.0;
      for (const face of Y.FACES) {
        const pts = face.nodes.map(id => Y.NODES_BY_ID.get(id));
        ctx.beginPath();
        pts.forEach((pt, idx) => idx ? ctx.lineTo(pt.x, pt.z) : ctx.moveTo(pt.x, pt.z));
        ctx.closePath();
        ctx.fillStyle = face.zone === 'park' ? '#435e48'
          : face.zone === 'gymnasium' ? '#56685b'
          : face.zone === 'barStreet' || face.zone === 'marketCore' ? '#667560'
          : face.zone === 'southYard' || face.zone === 'warehouse7' ? '#68705c' : '#5e705c';
        ctx.fill();
        ctx.strokeStyle = '#a8ad8b75';
        ctx.stroke();
      }
    }
    if (Y?.PARK_POLYGONS?.length) {
      for (const park of Y.PARK_POLYGONS) {
        ctx.beginPath();
        park.pts.forEach((pt, idx) => idx ? ctx.lineTo(pt.x, pt.z) : ctx.moveTo(pt.x, pt.z));
        ctx.closePath();
        ctx.fillStyle = '#435e48';
        ctx.fill();
      }
    }
    if (Y?.WATER_POLYGONS?.length) {
      for (const water of Y.WATER_POLYGONS) {
        ctx.beginPath();
        water.pts.forEach((pt, idx) => idx ? ctx.lineTo(pt.x, pt.z) : ctx.moveTo(pt.x, pt.z));
        ctx.closePath();
        ctx.fillStyle = '#2d6e82';
        ctx.fill();
      }
    }
    ctx.fillStyle = '#858674';
    ctx.fillRect(298, -324, 41, 652);
    ctx.fillRect(-326, 304, 665, 24);
    for (const [x, z, w, d] of [[336, -257, 80, 15], [336, -165, 44, 15], [336, 33, 31, 15], [-247, 327, 25, 32], [-157, 327, 26, 40], [-69, 327, 28, 40], [34, 327, 25, 40]]) {
      ctx.fillRect(x, z, w, d);
    }
    for (const rect of [MARINE.mainDock, MARINE.islandDock]) {
      ctx.fillRect(rect.minX, rect.minZ, rect.maxX - rect.minX, rect.maxZ - rect.minZ);
    }
    ctx.strokeStyle = '#465d4d8c';
    ctx.lineWidth = .8;
    ctx.beginPath();
    for (let z = -318; z < 324; z += 6.3) {
      ctx.moveTo(306.3, z);
      ctx.lineTo(333.7, z);
    }
    for (let x = -316; x < 328; x += 6.3) {
      ctx.moveTo(x, 305);
      ctx.lineTo(x, 325);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(island.x, island.z, island.rx + 2.6, island.rz + 2.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#9a9b7f';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(island.x, island.z, island.rx - 4, island.rz - 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4e6452';
    ctx.fill();
    ctx.strokeStyle = '#c0bfa073';
    for (const inset of [10, 17, 24]) {
      ctx.beginPath();
      ctx.ellipse(island.x + inset * .27, island.z - inset * .14, island.rx - inset, island.rz - inset * .65, -.16, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#a6a48a';
    ctx.fillRect(MARINE.islandDock.maxX - 7, MARINE.panel.z - 1.7, MARINE.panel.x - MARINE.islandDock.maxX + 7, 3.4);
    // 建筑投影轮廓
    ctx.lineWidth = .85;
    for (const { left, top, w, d, height } of sim.world.footprints) {
      const relief = Math.min(3.7, height * .08);
      ctx.fillStyle = '#304438a6';
      ctx.fillRect(left + relief, top + relief, w, d);
      ctx.fillStyle = height > 30 ? '#aca98c' : height > 13 ? '#909a81' : '#7c8d76';
      ctx.fillRect(left, top, w, d);
      ctx.strokeStyle = '#324a3e';
      ctx.strokeRect(left, top, w, d);
      if (w > 9 && d > 9) {
        ctx.strokeStyle = '#c8c3a288';
        ctx.strokeRect(left + 1.65, top + 1.65, w - 3.3, d - 3.3);
      }
    }
    // 绘制衢州古城真实多层道路网（路肩描边 + 沥青路面 + 中心虚线 + 路名标注）
    if (Y) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [fraction, ink] of [[1.0, '#77826c'], [0.64, '#485b4c'], [0.52, '#c0bda2']]) {
        ctx.strokeStyle = ink;
        for (const edge of Y.EDGES) {
          ctx.lineWidth = edge.width * fraction;
          ctx.beginPath();
          ctx.moveTo(edge.a.x, edge.a.z);
          ctx.lineTo(edge.b.x, edge.b.z);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = '#ece4c7a8';
      ctx.lineWidth = .75;
      ctx.setLineDash([4, 5.5]);
      ctx.beginPath();
      for (const edge of Y.EDGES) {
        ctx.moveTo(edge.a.x, edge.a.z);
        ctx.lineTo(edge.b.x, edge.b.z);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // 道路名称沿街排布
      ctx.save();
      ctx.font = '700 8.5px "Microsoft YaHei UI", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labeled = new Set();
      for (const edge of Y.EDGES) {
        if (edge.length < 78 || labeled.has(edge.name + ':' + Math.round(edge.cx / 130))) continue;
        labeled.add(edge.name + ':' + Math.round(edge.cx / 130));
        let ang = Math.atan2(edge.b.z - edge.a.z, edge.b.x - edge.a.x);
        if (ang > Math.PI / 2) ang -= Math.PI;
        if (ang < -Math.PI / 2) ang += Math.PI;
        ctx.save();
        ctx.translate(edge.cx, edge.cz);
        ctx.rotate(ang);
        ctx.strokeStyle = '#334438d9';
        ctx.lineWidth = 2.4;
        ctx.strokeText(edge.name, 0, 0);
        ctx.fillStyle = '#f6efd6';
        ctx.fillText(edge.name, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }
    return mapBase;
  }
  function path(ctx, route, toScreen, width, color, dash = []) {
    if (!route.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    route.forEach((point, i) => {
      const coords = toScreen(point);
      if (i) ctx.lineTo(...coords);
      else ctx.moveTo(...coords);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function diamond(ctx, x, y, radius, color, outline = '#263b30') {
    ctx.fillStyle = color;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius, y);
    ctx.lineTo(x, y + radius);
    ctx.lineTo(x - radius, y);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }
  function destinationRing(ctx, x, y, radius, ink = routeInk) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1c382e';
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = radius * .27;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, radius * .32, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
  }
  function navigation(from, aim) {
    if (aim.vehiclePickup) return [aim];
    const atMainDock = D.marineWalkable(from.x, from.z) && from.x < 420;
    if (sim.state.boat) {
      if (!aim.marine || distance(aim, MARINE.launch) < 1) {
        const entrance = [];
        if (from.z < MARINE.mainDock.maxZ + 1.5 && from.x < 385) entrance.push({ x: 389, z: from.z });
        if (from.x > 392 || from.z < 219.3) entrance.push({ x: 394, z: 230 });
        return [...entrance, MARINE.launch, ...(aim.marine ? [] : [MARINE.mainLanding, ...D.routeBetween(MARINE.job, aim)])];
      }
      return [aim];
    }
    if (aim.marine) {
      if (D.islandAccess(from.x, from.z)) {
        const pier = { x: (MARINE.islandDock.maxX + MARINE.islandDock.minX) / 2, z: MARINE.panel.z - 2 };
        if (aim.boarding && from.x > pier.x + 5) return [pier, aim];
        return [aim];
      }
      if (atMainDock) return [aim];
      if (aim.boarding) return [...D.routeBetween(from, MARINE.job), aim];
    }
    return D.routeBetween(from, aim);
  }
  function drawMap(canvas, isLarge) {
    if (!sim) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = canvas.width;
    let height = canvas.height;
    const pr = isLarge ? Math.min(2, devicePixelRatio || 1) : 1;
    if (isLarge && canvas.clientWidth && canvas.clientHeight) {
      width = Math.round(canvas.clientWidth * pr);
      height = Math.round(canvas.clientHeight * pr);
      if (width !== canvas.width || height !== canvas.height) {
        canvas.width = width;
        canvas.height = height;
      }
    }
    const p = sim.protagonist();
    const center = isLarge ? { x: atlasState.centerX, z: atlasState.centerZ } : p;
    const radarZoom = sim.state.boat ? .65 : sim.state.vehicle ? 1.08 - clamp(sim.state.vehicle.speed / 45, 0, 1) * .34 : 1.48;
    const scale = isLarge ? Math.min((width - 20 * pr) / mapFrame.width, (height - 14 * pr) / mapFrame.height) * atlasState.zoom :
      radarZoom * height / 256;
    const ruler = isLarge ? atlasRuler : radarRuler;
    if (ruler) {
      let metres = chartIntervals[0];
      const available = width * (isLarge ? .17 : .24);
      for (const interval of chartIntervals) if (interval * scale <= available) metres = interval;
      const physical = metres * scale;
      const size = isLarge ? (physical / pr).toFixed(1) + 'px' : (physical * 100 / width).toFixed(1) + '%';
      if (ruler.style.width !== size) ruler.style.width = size;
      if (ruler.textContent !== metres + ' m') ruler.textContent = metres + ' m';
    }
    const view = point => [width / 2 + (point.x - center.x) * scale, height / 2 + (point.z - center.z) * scale];
    const origin = view({ x: mapFrame.left, z: mapFrame.top });
    ctx.fillStyle = isLarge && Atlas ? atlasWater : chartWater;
    ctx.fillRect(0, 0, width, height);
    const base = mapSurface(isLarge);
    if (base) ctx.drawImage(base, ...origin, mapFrame.width * scale, mapFrame.height * scale);
    const aim = sim.state.target;
    const route = aim ? [p, ...navigation(p, aim)] : [];
    if (isLarge && Atlas) {
      const [wx, wz] = view(WORKSHOP);
      ctx.fillStyle = '#2d7a66';
      ctx.strokeStyle = '#f8f0d8';
      ctx.lineWidth = 1.6 * pr;
      ctx.fillRect(wx - 5.5 * pr, wz - 5.5 * pr, 11 * pr, 11 * pr);
      ctx.strokeRect(wx - 5.5 * pr, wz - 5.5 * pr, 11 * pr, 11 * pr);
    } else if (isLarge) {
      const compact = height / pr < 175;
      const fontSize = (compact ? 11 : 12) * pr;
      ctx.save();
      ctx.font = '700 ' + fontSize + 'px ' + (getComputedStyle(canvas).getPropertyValue('--chart-serifs').trim() || 'Georgia, "Songti SC", SimSun, serif');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      const occupied = [{ x: 15 * pr, y: 18 * pr, rx: 15 * pr, ry: 18 * pr }];
      function reserve(point, radius) {
        const [x, y] = view(point);
        occupied.push({ x, y, rx: radius * pr, ry: radius * pr });
      }
      reserve(p, 13);
      if (aim) reserve(aim, 10);
      reserve(WORKSHOP, 5);
      for (const boat of sim.boats) if (boat !== sim.state.boat) reserve(boat, 5.5);
      // Keep the colored line readable between its markers, including diagonal crossings at sea.
      const track = route.map(view);
      for (let i = 1; i < track.length; i++) {
        const [ax, ay] = track[i - 1], [bx, by] = track[i];
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (8 * pr));
        for (let step = 1; step <= steps; step++) {
          const fraction = step / steps;
          occupied.push({ x: ax + (bx - ax) * fraction, y: ay + (by - ay) * fraction, rx: 3.2 * pr, ry: 3.2 * pr });
        }
      }
      const focus = new Set([D.district(p)]);
      if (aim) focus.add(aim.marine && aim.x > MARINE.mainDock.maxX && !D.islandAccess(aim.x, aim.z) ? '信安湖水道' : D.district(aim));
      const order = new Set([...focus, ...(compact ? ['水亭门古街', '孔氏南宗家庙', '大南门 · 礼贤街'] : []), ...districtPins.map(pin => pin[0])]);
      const offsets = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [-.78, -1], [.78, -1], [-.78, 1], [.78, 1], [0, -2], [0, 2], [-1, -2], [1, 2]];
      let count = 0;
      for (const label of order) {
        if (compact && count >= 4) break;
        const pin = districtPins.find(([name]) => name === label);
        if (!pin) continue;
        const [anchorX, anchorY] = view({ x: pin[1], z: pin[2] });
        const displayLabel = language.t(label);
        const metrics = ctx.measureText(displayLabel);
        const rx = metrics.width / 2 + 2.5 * pr;
        const glyphHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize;
        const ry = Math.max(fontSize, glyphHeight) / 2 + 2 * pr;
        function fits(x, y) {
          return x - rx >= pr && y - ry >= pr && x + rx <= width - pr && y + ry <= height - pr &&
            !occupied.some(b => Math.abs(x - b.x) < rx + b.rx && Math.abs(y - b.y) < ry + b.ry);
        }
        let position = null;
        for (const [dx, dy] of offsets) {
          const x = anchorX + dx * (rx + 6 * pr), y = anchorY + dy * (ry + 7 * pr);
          if (fits(x, y)) {
            position = [x, y];
            break;
          }
        }
        if (!position && (focus.has(label) || !compact)) {
          // Dense collections of map pins can leave a district's nearest clear label in the margin.
          let nearest = Infinity;
          for (let y = ry + 2 * pr; y < height - ry; y += 6 * pr) {
            for (let x = rx + 2 * pr; x < width - rx; x += 6 * pr) {
              const score = (x - anchorX) ** 2 + (y - anchorY) ** 2;
              if (score < nearest && fits(x, y)) {
                nearest = score;
                position = [x, y];
              }
            }
          }
        }
        if (!position) continue;
        const [x, y] = position;
        const edgeX = clamp(anchorX, x - rx, x + rx), edgeY = clamp(anchorY, y - ry, y + ry);
        if (Math.hypot(edgeX - anchorX, edgeY - anchorY) > 4 * pr) {
          ctx.beginPath();
          ctx.moveTo(anchorX, anchorY);
          ctx.lineTo(edgeX, edgeY);
          ctx.strokeStyle = '#c0c8a8ad';
          ctx.lineWidth = pr;
          ctx.stroke();
        }
        ctx.lineWidth = 3 * pr;
        ctx.strokeStyle = '#22372d';
        ctx.strokeText(displayLabel, x, y);
        ctx.fillStyle = focus.has(label) ? '#fff2d1' : '#f2ead1';
        ctx.fillText(displayLabel, x, y);
        occupied.push({ x, y, rx, ry });
        count++;
      }
      ctx.restore();
      const [wx, wz] = view(WORKSHOP);
      ctx.fillStyle = '#c2dcc6';
      ctx.fillRect(wx - 4 * pr, wz - 4 * pr, 8 * pr, 8 * pr);
    }
    if (aim) {
      const aimInk = aim.streetEvent ? (isLarge && Atlas ? '#d45a28' : '#ff9e6d')
        : (isLarge && Atlas ? atlasRouteInk : routeInk);
      path(ctx, route, view, isLarge ? 6.8 * pr : 9, isLarge && Atlas ? 'rgba(255, 249, 233, 0.9)' : '#1b3c30e6');
      path(ctx, route, view, isLarge ? 3.8 * pr : 5, aimInk, aim.marine ? [5 * pr, 4 * pr] : []);
      const [x, y] = view(aim);
      if (isLarge) destinationRing(ctx, x, y, 10 * pr, aimInk);
      else {
        const dx = x - width / 2;
        const dy = y - height / 2;
        const pull = Math.min(1, (width / 2 - 15) / Math.max(.1, Math.abs(dx)),
          (height / 2 - 15) / Math.max(.1, Math.abs(dy)));
        destinationRing(ctx, width / 2 + dx * pull, height / 2 + dy * pull, 10.5, aimInk);
      }
    }
    if (isLarge) {
      if (Atlas) {
        Atlas.drawLandmarkPlaques(ctx, Y, view, pr, atlasState.hoveredId, sim.state.landmarkGuide?.id || null, new Set(progress.visitedLandmarks));
      }
    } else if (sim.state.mode !== 'taxi' && Y?.LANDMARKS) {
      const activeId = sim.state.landmarkGuide?.id || null;
      for (const lm of Y.LANDMARKS) {
        if (lm.id === activeId) continue;
        const [lx, ly] = view(lm);
        if (lx < -12 || lx > width + 12 || ly < -12 || ly > height + 12) continue;
        const visited = progress.visitedLandmarks.includes(lm.id);
        diamond(ctx, lx, ly, visited ? 4.4 : 5.6, visited ? '#7de8be' : '#ffd872', '#172b24');
      }
    }
    if (sim.state.mode === 'roam' && !sim.state.race?.active && D.TAPES?.length) {
      const activeTapeId = sim.state.tapeGuide?.id || null;
      for (const tape of D.TAPES) {
        if (progress.tapes.includes(tape.id)) continue;
        const [tx, ty] = view(tape);
        if (tx < -12 || tx > width + 12 || ty < -12 || ty > height + 12) continue;
        const targeted = tape.id === activeTapeId;
        diamond(ctx, tx, ty, (isLarge ? (targeted ? 7.2 : 5.4) * pr : (targeted ? 6.2 : 4.6)), targeted ? '#ffc2e0' : '#f59cc6', '#2b1522');
      }
    }
    if (!sim.state.race?.active && D.REST_SPOTS?.length) {
      const restTabActive = isLarge && mapCollectionTab === 'rests';
      const activeRestId = sim.state.rest?.spot?.id || null;
      for (const spot of D.REST_SPOTS) {
        const [rx, ry] = view(spot);
        if (rx < -12 || rx > width + 12 || ry < -12 || ry > height + 12) continue;
        const isHover = isLarge && atlasState.hoveredRestId === spot.id;
        const isSeated = isLarge && activeRestId === spot.id;
        const r = isLarge ? ((isHover || isSeated ? 7.4 : restTabActive ? 6.2 : 5.0) * pr) : 3.9;
        ctx.save();
        if (isLarge && (isHover || isSeated || restTabActive)) {
          ctx.beginPath();
          ctx.arc(rx, ry, r + (isHover || isSeated ? 5.2 : 3.4) * pr, 0, Math.PI * 2);
          ctx.fillStyle = isHover || isSeated ? 'rgba(126, 226, 198, 0.36)' : 'rgba(126, 226, 198, 0.22)';
          ctx.fill();
          ctx.strokeStyle = isHover || isSeated ? 'rgba(255, 241, 189, 0.92)' : 'rgba(126, 226, 198, 0.72)';
          ctx.lineWidth = (isHover || isSeated ? 1.8 : 1.1) * pr;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(rx, ry, r, 0, Math.PI * 2);
        ctx.fillStyle = isHover || isSeated ? '#a8fae2' : '#7ee2c6';
        ctx.strokeStyle = '#122923';
        ctx.lineWidth = isLarge ? (isHover || isSeated ? 2.0 : 1.5) * pr : 1.4;
        ctx.fill();
        ctx.stroke();
        if (isHover || isSeated) {
          ctx.beginPath();
          ctx.arc(rx, ry, 2.3 * pr, 0, Math.PI * 2);
          ctx.fillStyle = '#fff5cf';
          ctx.fill();
          if (!atlasTooltip || atlasTooltip.hidden || atlasTooltip.dataset.kind !== 'restSpot') {
            const tag = language.t(spot.name);
            ctx.font = '700 ' + (10.5 * pr) + 'px "Microsoft YaHei UI", sans-serif';
            const padX = 7 * pr;
            const tw = ctx.measureText(tag).width + padX * 2;
            const th = 19 * pr;
            const bx = clamp(rx - tw / 2, 8 * pr, width - tw - 8 * pr);
            const by = clamp(ry - r - th - 6 * pr, 8 * pr, height - th - 8 * pr);
            ctx.beginPath();
            roundedRect(ctx, bx, by, tw, th, 4 * pr);
            ctx.fillStyle = 'rgba(13, 32, 30, 0.92)';
            ctx.strokeStyle = 'rgba(126, 226, 198, 0.88)';
            ctx.lineWidth = 1.2 * pr;
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#effcf7';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tag, bx + tw / 2, by + th / 2 + .5 * pr);
          }
        }
        ctx.restore();
      }
    }
    if (sim.state.mode === 'roam' && !sim.state.race?.active && sim.state.streetEvent) {
      const ev = sim.state.streetEvent;
      if (ev.phase === 'offered' || ev.phase === 'needCar') {
        let [ex, ey] = view(ev);
        const dEv = distance(p, ev);
        let showPin = ex >= -14 && ex <= width + 14 && ey >= -14 && ey <= height + 14;
        if (!isLarge && !showPin && dEv < 230) {
          const dx = ex - width / 2;
          const dy = ey - height / 2;
          const pull = Math.min(1, (width / 2 - 14) / Math.max(.1, Math.abs(dx)), (height / 2 - 14) / Math.max(.1, Math.abs(dy)));
          ex = width / 2 + dx * pull;
          ey = height / 2 + dy * pull;
          showPin = true;
        }
        if (showPin) {
          const r = isLarge ? 8.2 * pr : 7.2;
          ctx.save();
          ctx.beginPath();
          ctx.arc(ex, ey, r + 2.6 * (isLarge ? pr : 1), 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 158, 109, 0.28)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ex, ey, r, 0, Math.PI * 2);
          ctx.fillStyle = '#ff9e6d';
          ctx.strokeStyle = '#26130d';
          ctx.lineWidth = (isLarge ? 2.0 * pr : 1.8);
          ctx.fill();
          ctx.stroke();
          ctx.font = '800 ' + (isLarge ? 10.5 * pr : 10) + 'px "Microsoft YaHei UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#1f0e08';
          ctx.fillText('!', ex, ey + .5);
          ctx.restore();
        }
      }
    }
    if (sim.state.mode === 'roam') {
      if (sim.state.race?.active) {
        const isLake = sim.state.race.kind === 'lake';
        const gates = isLake ? (D.LAKE_RACE || []) : (sim.RACE_ORDER || [1, 2, 3, 4, 5, 6, 7, 8, 0]).map(idx => D.RACE?.[idx]).filter(Boolean);
        if (gates.length) {
          const ring = isLake && D.LAKE_RACE_START ? [D.LAKE_RACE_START, ...gates, D.LAKE_RACE_START] : [...gates, gates[0]];
          path(ctx, ring, view, isLarge ? 3.0 * pr : 3.2, isLake ? 'rgba(86, 224, 255, 0.62)' : 'rgba(102, 242, 199, 0.55)', [6 * pr, 5 * pr]);
        }
        for (let i = 0; i < gates.length; i++) {
          const gate = gates[i];
          const [gx, gy] = view(gate);
          if (gx < -16 || gx > width + 16 || gy < -16 || gy > height + 16) continue;
          const isCurrent = i === sim.state.race.index;
          const isPassed = i < sim.state.race.index;
          const isFinal = i === gates.length - 1;
          const accent = isLake ? '#56e0ff' : '#66f2c7';
          ctx.save();
          ctx.beginPath();
          ctx.arc(gx, gy, (isCurrent ? (isLarge ? 8.5 * pr : 7.5) : (isLarge ? 4.8 * pr : 4.2)), 0, Math.PI * 2);
          ctx.fillStyle = isPassed ? 'rgba(120, 150, 140, 0.45)' : isCurrent ? (isFinal ? '#ffd663' : accent) : (isLake ? 'rgba(86, 224, 255, 0.32)' : 'rgba(102, 242, 199, 0.32)');
          ctx.strokeStyle = isCurrent ? '#122622' : accent;
          ctx.lineWidth = (isCurrent ? 2.4 : 1.4) * pr;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      } else {
        if (D.RACE?.length) {
        const [rx, ry] = view(D.RACE[0]);
        if (rx >= -16 && rx <= width + 16 && ry >= -16 && ry <= height + 16) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(rx, ry, (isLarge ? 7.5 * pr : 6.2), 0, Math.PI * 2);
          ctx.fillStyle = '#ffd663';
          ctx.strokeStyle = '#182b24';
          ctx.lineWidth = 2.0 * pr;
          ctx.fill();
          ctx.stroke();
          if (isLarge) {
            ctx.font = '700 ' + 9.5 * pr + 'px "Microsoft YaHei UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#19221c';
            ctx.fillText('赛', rx, ry + .5 * pr);
          }
          ctx.restore();
        }
        }
        if (D.LAKE_RACE_START) {
          const [lx, ly] = view(D.LAKE_RACE_START);
          if (lx >= -16 && lx <= width + 16 && ly >= -16 && ly <= height + 16) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(lx, ly, (isLarge ? 7.5 * pr : 6.2), 0, Math.PI * 2);
            ctx.fillStyle = '#56e0ff';
            ctx.strokeStyle = '#12262f';
            ctx.lineWidth = 2.0 * pr;
            ctx.fill();
            ctx.stroke();
            if (isLarge) {
              ctx.font = '700 ' + 9.5 * pr + 'px "Microsoft YaHei UI", sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#0d1f26';
              ctx.fillText('舟', lx, ly + .5 * pr);
            }
            ctx.restore();
          }
        }
      }
    }
    for (const boat of sim.boats) {
      if (boat === sim.state.boat) continue;
      const [x, y] = view(boat);
      ctx.lineWidth = 1.35 * pr;
      ctx.strokeStyle = '#bddecd';
      ctx.fillStyle = '#31504a';
      ctx.beginPath();
      roundedRect(ctx, x - 4 * pr, y - 2.2 * pr, 8 * pr, 4.4 * pr, 1.4 * pr);
      ctx.fill();
      ctx.stroke();
    }
    sim.traffic?.drawMapOverlay?.(ctx, view, scale, pr, isLarge);
    if (sim.state.mode === 'taxi' && sim.taxi.car) {
      const [tx, ty] = view(sim.taxi.car);
      const size = isLarge ? 5.4 * pr : 5;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(-sim.taxi.car.yaw);
      ctx.fillStyle = '#f2c53d';
      ctx.strokeStyle = '#5b4710';
      ctx.lineWidth = 1.4 * pr;
      ctx.beginPath();
      ctx.roundRect?.(-size, -size * .6, size * 2, size * 1.2, 1.4 * pr);
      if (!ctx.roundRect) ctx.rect(-size, -size * .6, size * 2, size * 1.2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (isLarge) {
        ctx.save();
        ctx.font = '700 ' + 10 * pr + 'px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd98a';
        ctx.fillText('TAXI', tx, ty - 9 * pr);
        ctx.restore();
      }
    }
    const [px, py] = view(p);
    const arrow = isLarge ? 8 * pr : 14;
    ctx.save();
    ctx.translate(px, py);
    ctx.beginPath();
    ctx.arc(0, 0, arrow * 1.39, 0, Math.PI * 2);
    ctx.fillStyle = '#15271f70';
    ctx.fill();
    ctx.strokeStyle = '#f1e7cb98';
    ctx.lineWidth = isLarge ? .85 * pr : 1.6;
    ctx.stroke();
    ctx.rotate(Math.PI - p.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -arrow);
    ctx.lineTo(arrow * .54, arrow * .65);
    ctx.lineTo(0, arrow * .36);
    ctx.lineTo(-arrow * .54, arrow * .65);
    ctx.closePath();
    ctx.fillStyle = '#fff1d0';
    ctx.strokeStyle = '#1b2b22';
    ctx.lineWidth = isLarge ? 2 * pr : 3;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  let mapCollectionTab = 'landmarks';
  function exploreSummary() {
    const lmDone = progress.visitedLandmarks.length;
    const lmTotal = Y?.LANDMARKS?.length ?? 8;
    const tapeDone = progress.tapes.length;
    const tapeTotal = D.TAPES?.length ?? 10;
    const photoDone = progress.photos.length;
    const photoTotal = D.PHOTO_SPOTS?.length ?? 5;
    const raceDone = (progress.raceBest > 0 ? 1 : 0) + (progress.lakeRaceBest > 0 ? 1 : 0);
    const total = lmTotal + tapeTotal + photoTotal + 2;
    const done = lmDone + tapeDone + photoDone + raceDone;
    const pct = Math.round((done / Math.max(1, total)) * 100);
    const rank = pct >= 100 ? '衢州全境典藏' : pct >= 70 ? '南孔雅士' : pct >= 45 ? '古城通' : pct >= 20 ? '三街熟客' : '初访行客';
    return { lmDone, lmTotal, tapeDone, tapeTotal, photoDone, photoTotal, raceDone, done, total, pct, rank };
  }

  function renderMapPanel() {
    const isTaxi = sim.state.mode === 'taxi';
    $('map-mode-roam')?.setAttribute('aria-pressed', String(!isTaxi));
    $('map-mode-taxi')?.setAttribute('aria-pressed', String(isTaxi));
    const sum = exploreSummary();
    if ($('tab-landmarks-count')) $('tab-landmarks-count').textContent = sum.lmDone + '/' + sum.lmTotal;
    if ($('tab-tapes-count')) $('tab-tapes-count').textContent = sum.tapeDone + '/' + sum.tapeTotal;
    if ($('tab-photos-count')) $('tab-photos-count').textContent = sum.photoDone + '/' + sum.photoTotal;
    if ($('tab-rests-count')) $('tab-rests-count').textContent = String(D.REST_SPOTS?.length ?? 0);
    for (const tabBtn of document.querySelectorAll('#map-collection-tabs [data-col-tab]')) {
      tabBtn.setAttribute('aria-selected', String(tabBtn.dataset.colTab === mapCollectionTab));
    }
    const landmarkWrap = $('map-landmarks');
    if (landmarkWrap) {
      landmarkWrap.replaceChildren();
      landmarkWrap.classList.toggle('is-list', mapCollectionTab !== 'landmarks');
      if (mapCollectionTab === 'landmarks' && Y?.LANDMARKS) {
        const activeId = sim.state.landmarkGuide?.id || null;
        for (const lm of Y.LANDMARKS) {
        const item = document.createElement('div');
        item.className = 'map-landmark-item';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'map-landmark-btn';
        const visited = progress.visitedLandmarks.includes(lm.id);
        if (visited) btn.classList.add('is-visited');
        btn.setAttribute('aria-pressed', String(activeId === lm.id));
        const titleEl = document.createElement('strong');
        titleFor(titleEl, lm.name);
        const badgeEl = document.createElement('span');
        titleFor(badgeEl, visited ? '✓ 已打卡' : (lm.badge || '首访 ¥150'));
        btn.append(titleEl, badgeEl);
        language.attr(btn, 'title', lm.desc || lm.name);
        btn.addEventListener('mouseenter', () => {
          atlasState.hoveredId = lm.id;
          drawMap(map, true);
        });
        btn.addEventListener('mouseleave', () => {
          if (atlasState.hoveredId === lm.id) {
            atlasState.hoveredId = null;
            drawMap(map, true);
          }
        });
        btn.addEventListener('click', () => {
          atlasState.centerX = lm.x;
          atlasState.centerZ = lm.z;
          atlasState.zoom = Math.max(atlasState.zoom, 1.45);
          clampAtlasCenter();
          if (!isTaxi && sim.setLandmarkTarget?.(lm)) {
            closePanel();
            drawHud();
            drawMap(radar, false);
            return;
          }
          drawMap(map, true);
        });
        item.append(btn);
        if (visited && !isTaxi) {
          const tpBtn = document.createElement('button');
          tpBtn.type = 'button';
          tpBtn.className = 'map-landmark-tp';
          titleFor(tpBtn, '传送');
          language.attr(tpBtn, 'title', '快速传送至' + lm.name);
          tpBtn.addEventListener('click', event => {
            event.stopPropagation();
            if (sim.fastTravelToLandmark?.(lm)) {
              closePanel();
              drawHud();
              drawMap(radar, false);
            }
          });
          item.append(tpBtn);
        }
        landmarkWrap.append(item);
        }
      } else if (mapCollectionTab === 'tapes' && D.TAPES?.length) {
        const playingId = sim.state.playingTape?.id || '';
        for (const tape of D.TAPES) {
          const collected = progress.tapes.includes(tape.id);
          const playing = collected && playingId === tape.id;
          const card = document.createElement('div');
          card.className = 'map-archive-card' + (collected ? ' is-collected' : '') + (playing ? ' is-playing' : '');
          const info = document.createElement('div');
          info.className = 'map-archive-info';
          const titleEl = document.createElement('strong');
          titleFor(titleEl, (playing ? '♪ ' : '') + tape.name);
          const descEl = document.createElement('small');
          titleFor(descEl, collected ? tape.line : '尚未收录 · 街区寻访奖励 ¥80');
          info.append(titleEl, descEl);
          const act = document.createElement('button');
          act.type = 'button';
          act.className = 'map-archive-btn' + (collected ? ' is-play' : '');
          if (collected) {
            titleFor(act, playing ? '■ 停止' : '▶ 播放');
            act.addEventListener('click', () => {
              if (playing) sim.stopTape?.();
              else sim.playTape?.(tape.id);
              renderMapPanel();
              drawHud();
            });
          } else {
            titleFor(act, '导航');
            act.disabled = Boolean(isTaxi || sim.state.race?.active);
            act.addEventListener('click', () => {
              if (sim.setTapeTarget?.(tape)) {
                closePanel();
                drawHud();
                drawMap(radar, false);
              }
            });
          }
          card.append(info, act);
          landmarkWrap.append(card);
        }
      } else if (mapCollectionTab === 'photos' && D.PHOTO_SPOTS?.length) {
        for (const spot of D.PHOTO_SPOTS) {
          const done = progress.photos.includes(spot.id);
          const card = document.createElement('div');
          card.className = 'map-archive-card' + (done ? ' is-photo-done' : '');
          const info = document.createElement('div');
          info.className = 'map-archive-info';
          const titleEl = document.createElement('strong');
          titleFor(titleEl, spot.name);
          const descEl = document.createElement('small');
          titleFor(descEl, done ? '✓ 已入册 · 实景明信片收藏' : spot.tip);
          info.append(titleEl, descEl);
          const act = document.createElement('button');
          act.type = 'button';
          act.className = 'map-archive-btn' + (done ? ' is-done' : '');
          titleFor(act, done ? '再去拍' : '导航去拍');
          act.disabled = Boolean(isTaxi || sim.state.race?.active);
          act.addEventListener('click', () => {
            if (sim.navigatePhotoSpot?.(spot)) {
              closePanel();
              drawHud();
              drawMap(radar, false);
            }
          });
          card.append(info, act);
          landmarkWrap.append(card);
        }
      } else if (mapCollectionTab === 'rests' && D.REST_SPOTS?.length) {
        const seatedId = sim.state.rest?.spot?.id || '';
        const disabled = Boolean(isTaxi || sim.state.race?.active);
        for (const spot of D.REST_SPOTS) {
          const here = seatedId === spot.id;
          const card = document.createElement('div');
          card.className = 'map-archive-card is-rest' + (here ? ' is-resting-here' : '');
          card.addEventListener('mouseenter', () => {
            atlasState.hoveredRestId = spot.id;
            drawMap(map, true);
          });
          card.addEventListener('mouseleave', () => {
            if (atlasState.hoveredRestId === spot.id) {
              atlasState.hoveredRestId = null;
              drawMap(map, true);
            }
          });
          const info = document.createElement('div');
          info.className = 'map-archive-info';
          info.addEventListener('click', () => {
            atlasState.centerX = spot.x;
            atlasState.centerZ = spot.z;
            atlasState.zoom = Math.max(atlasState.zoom, 1.5);
            atlasState.hoveredRestId = spot.id;
            clampAtlasCenter();
            drawMap(map, true);
          });
          const titleEl = document.createElement('strong');
          titleFor(titleEl, spot.name);
          const metaEl = document.createElement('small');
          metaEl.className = 'map-rest-meta';
          titleFor(metaEl, spot.district + ' · ' + restAmbientLabel(spot.ambient));
          const descEl = document.createElement('small');
          titleFor(descEl, spot.poem);
          info.append(titleEl, metaEl, descEl);
          const actions = document.createElement('div');
          actions.className = 'map-rest-actions';
          const tpBtn = document.createElement('button');
          tpBtn.type = 'button';
          tpBtn.className = 'map-archive-btn is-rest-tp';
          tpBtn.dataset.restTp = spot.id;
          titleFor(tpBtn, here ? '正在此处' : '小憩传送');
          tpBtn.disabled = disabled;
          tpBtn.addEventListener('click', event => {
            event.stopPropagation();
            if (sim.fastTravelToRestSpot?.(spot)) {
              closePanel();
              drawHud();
              drawMap(radar, false);
            }
          });
          const navBtn = document.createElement('button');
          navBtn.type = 'button';
          navBtn.className = 'map-archive-btn is-rest-nav';
          titleFor(navBtn, '导航');
          navBtn.disabled = disabled;
          navBtn.addEventListener('click', event => {
            event.stopPropagation();
            if (sim.setRestSpotTarget?.(spot)) {
              closePanel();
              drawHud();
              drawMap(radar, false);
            }
          });
          actions.append(tpBtn, navBtn);
          card.append(info, actions);
          landmarkWrap.append(card);
        }
      }
    }
    const wrapper = $('map-jobs');
    wrapper.replaceChildren();
    if (isTaxi) {
      const service = sim.taxi.state;
      const fare = service.fare;
      titleFor($('map-heading'), '出租车营运');
      show($('map-progress'), false);
      const card = document.createElement('div');
      card.className = 'map-job';
      card.setAttribute('aria-pressed', 'false');
      const glyph = document.createElement('i');
      glyph.textContent = 'T';
      const text = document.createElement('div');
      const name = document.createElement('strong');
      const detail = document.createElement('small');
      if (fare && (service.phase === 'toPickup' || service.phase === 'boarding')) {
        titleFor(name, '接客 · ' + fare.pickup.label);
        titleFor(detail, fare.pickup.district + ' · 乘客 ' + fare.pickup.label + ' · 预计 ' + sim.cashText(fare.total));
      } else if (fare && (service.phase === 'onTrip' || service.phase === 'droppingOff')) {
        titleFor(name, '送达 · ' + fare.dropoff.label);
        titleFor(detail, fare.dropoff.district + ' · ' + fare.distanceKm + ' 公里 · 车费 ' + sim.cashText(fare.total));
      } else {
        titleFor(name, '空车待单');
        titleFor(detail, '下一单将自动派送，或点击下方按钮立即接单。');
      }
      text.append(name, detail);
      card.append(glyph, text);
      wrapper.append(card);
      const stats = document.createElement('div');
      stats.className = 'map-job';
      stats.setAttribute('aria-pressed', 'false');
      const statsGlyph = document.createElement('i');
      statsGlyph.textContent = '¥';
      const statsText = document.createElement('div');
      const statsName = document.createElement('strong');
      const statsDetail = document.createElement('small');
      titleFor(statsName, '今日营运');
      titleFor(statsDetail, service.stats.trips + ' 单 · 收入 ' + sim.cashText(service.stats.earned)
        + (service.stats.best ? ' · 最快 ' + service.stats.best + ' 秒' : ''));
      statsText.append(statsName, statsDetail);
      stats.append(statsGlyph, statsText);
      wrapper.append(stats);
      const next = document.createElement('button');
      next.className = 'map-market';
      next.type = 'button';
      const nextName = document.createElement('strong');
      const nextDetail = document.createElement('span');
      titleFor(nextName, '立即叫下一单');
      titleFor(nextDetail, service.phase === 'between' || service.phase === 'idle' ? '点击后导航至新乘客' : '完成当前订单后可派单');
      next.disabled = !(service.phase === 'between' || service.phase === 'idle');
      next.append(nextName, nextDetail);
      next.addEventListener('click', () => {
        sim.taxi.dispatch('next');
        closePanel();
      });
      wrapper.append(next);
    } else {
      titleFor($('map-heading'), '自由探索');
      show($('map-progress'), true);
      titleFor($('map-progress'), sum.rank + ' · ' + sum.pct + '%');
      const exploreCard = document.createElement('div');
      exploreCard.className = 'map-job';
      exploreCard.setAttribute('aria-pressed', 'false');
      const g1 = document.createElement('i');
      titleFor(g1, '景');
      const t1 = document.createElement('div');
      const n1 = document.createElement('strong');
      const d1 = document.createElement('small');
      titleFor(n1, '衢州古城探索档案 · ' + sum.pct + '%');
      titleFor(d1, '八景 ' + sum.lmDone + '/' + sum.lmTotal + ' · 磁带 ' + sum.tapeDone + '/' + sum.tapeTotal + ' · 明信片 ' + sum.photoDone + '/' + sum.photoTotal
        + (progress.raceBest ? ' · 陆 ' + progress.raceBest.toFixed(1) + 's' : '')
        + (progress.lakeRaceBest ? ' · 水 ' + progress.lakeRaceBest.toFixed(1) + 's' : ''));
      const meter = document.createElement('div');
      meter.className = 'map-explore-meter';
      const fill = document.createElement('i');
      fill.style.width = sum.pct + '%';
      meter.append(fill);
      t1.append(n1, d1, meter);
      exploreCard.append(g1, t1);
      wrapper.append(exploreCard);
      const quickWrap = document.createElement('div');
      quickWrap.className = 'map-quick-actions';
      if (sim.state.race?.active) {
        const isLake = sim.state.race.kind === 'lake';
        const abortBtn = document.createElement('button');
        abortBtn.type = 'button';
        abortBtn.className = 'map-market ' + (isLake ? 'map-lake-btn' : 'map-race-btn') + ' is-active';
        const aName = document.createElement('strong');
        const aDetail = document.createElement('span');
        titleFor(aName, isLake ? '终止当前水上计时赛' : '终止当前环古城计时赛');
        titleFor(aDetail, '计时门 ' + (sim.state.race.index + 1) + ' / ' + sim.state.race.total + ' · ' + formatRaceTime(sim.state.race.elapsed));
        abortBtn.append(aName, aDetail);
        abortBtn.addEventListener('click', () => {
          sim.cancelRingRace();
          renderMapPanel();
          drawHud();
          drawMap(radar, false);
        });
        quickWrap.append(abortBtn);
      } else {
        const raceBtn = document.createElement('button');
        raceBtn.type = 'button';
        raceBtn.className = 'map-market map-race-btn';
        const raceName = document.createElement('strong');
        const raceDetail = document.createElement('span');
        titleFor(raceName, '发起环古城计时赛');
        titleFor(raceDetail, progress.raceBest
          ? '9 道计时门 · 最佳纪录 ' + progress.raceBest.toFixed(2) + ' 秒（金杯 ≤ 55s）'
          : '9 道计时门 · 环城 1.9 公里 · 金杯 ≤ 55 秒');
        raceBtn.append(raceName, raceDetail);
        raceBtn.addEventListener('click', () => {
          if (sim.startRingRace?.()) {
            closePanel();
            drawHud();
            drawMap(radar, false);
          }
        });
        quickWrap.append(raceBtn);
        const lakeBtn = document.createElement('button');
        lakeBtn.type = 'button';
        lakeBtn.className = 'map-market map-lake-btn';
        const lakeName = document.createElement('strong');
        const lakeDetail = document.createElement('span');
        titleFor(lakeName, '发起信安湖水上计时赛');
        titleFor(lakeDetail, progress.lakeRaceBest
          ? '7 道浮标门 · 最佳纪录 ' + progress.lakeRaceBest.toFixed(2) + ' 秒（金杯 ≤ 48s）'
          : '7 道水上浮标门 · 快艇环严家淤岛 · 金杯 ≤ 48 秒');
        lakeBtn.append(lakeName, lakeDetail);
        lakeBtn.addEventListener('click', () => {
          if (sim.startLakeRace?.()) {
            closePanel();
            drawHud();
            drawMap(radar, false);
          }
        });
        quickWrap.append(lakeBtn);
      }
      const nearest = sim.nearestUnvisitedLandmark?.();
      if (nearest && !sim.state.race?.active) {
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'map-market';
        const nextName = document.createElement('strong');
        const nextDetail = document.createElement('span');
        titleFor(nextName, '导航最近未访 · ' + nearest.landmark.name);
        titleFor(nextDetail, '快捷键 F · 约 ' + Math.round(nearest.distance) + ' 米');
        nextBtn.append(nextName, nextDetail);
        nextBtn.addEventListener('click', () => {
          if (sim.setLandmarkTarget?.(nearest.landmark)) {
            closePanel();
            drawHud();
            drawMap(radar, false);
          }
        });
        quickWrap.append(nextBtn);
      }
      const nearestTape = sim.nearestUncollectedTape?.();
      if (nearestTape && !sim.state.race?.active) {
        const tapeBtn = document.createElement('button');
        tapeBtn.type = 'button';
        tapeBtn.className = 'map-market map-tape-btn';
        const tapeName = document.createElement('strong');
        const tapeDetail = document.createElement('span');
        titleFor(tapeName, '寻访声景磁带 · ' + nearestTape.tape.name);
        titleFor(tapeDetail, '约 ' + Math.round(nearestTape.distance) + ' 米 · 收录奖励 ¥80');
        tapeBtn.append(tapeName, tapeDetail);
        tapeBtn.addEventListener('click', () => {
          if (sim.setTapeTarget?.(nearestTape.tape)) {
            closePanel();
            drawHud();
            drawMap(radar, false);
          }
        });
        quickWrap.append(tapeBtn);
      }
      if ((sim.state.landmarkGuide || sim.state.tapeGuide) && !sim.state.race?.active) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'map-market';
        const cancelName = document.createElement('strong');
        const cancelDetail = document.createElement('span');
        titleFor(cancelName, '取消当前导航');
        titleFor(cancelDetail, '当前目的地：' + (sim.state.landmarkGuide?.label ?? sim.state.tapeGuide?.label ?? ''));
        cancelBtn.append(cancelName, cancelDetail);
        cancelBtn.addEventListener('click', () => {
          sim.setLandmarkTarget?.(null);
          sim.setTapeTarget?.(null);
          renderMapPanel();
          drawHud();
          drawMap(radar, false);
        });
        quickWrap.append(cancelBtn);
      }
      if (quickWrap.childElementCount) wrapper.append(quickWrap);
    }
    const navBtn = $('map-workshop-nav');
    if (navBtn) {
      navBtn.disabled = Boolean(isTaxi || sim.state.boat || sim.state.race?.active);
      navBtn.setAttribute('aria-pressed', String(Boolean(sim.state.workshopGuide)));
      titleFor(navBtn.lastElementChild, sim.state.workshopGuide ? '已导航 · 点击取消' : sim.state.race?.active ? '计时赛进行中' : isTaxi ? '出租车营运中可按 G 直接进工坊' : '导航前往' + WORKSHOP.label);
    }
    drawMap(map, true);
    if (tmapMode) syncTencentMap();
  }

  function svgDataUrl(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function syncTencentMap() {
    const container = $('tmap-container');
    if (!container || !Y || !window.TMap || !sim) return false;
    const p = sim.protagonist();
    const pCoord = Y.toLatLng(p.x, p.z);
    if (!tmapInstance) {
      tmapInstance = new window.TMap.Map(container, {
        zoom: 15.6,
        center: new window.TMap.LatLng(pCoord.lat, pCoord.lng),
      });
      const playerSvg = svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" fill="#173329" stroke="#a4efd0" stroke-width="3"/><circle cx="14" cy="14" r="4.5" fill="#fff2d0"/></svg>');
      const poiSvg = svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><polygon points="11,2 20,11 11,20 2,11" fill="#ffad92" stroke="#22362c" stroke-width="2"/></svg>');
      const markerStyles = {
        player: new window.TMap.MarkerStyle({ width: 28, height: 28, anchor: { x: 14, y: 14 }, src: playerSvg }),
        poi: new window.TMap.MarkerStyle({ width: 22, height: 22, anchor: { x: 11, y: 11 }, src: poiSvg }),
      };
      tmapPoiLayer = new window.TMap.MultiMarker({
        map: tmapInstance,
        styles: markerStyles,
        geometries: [
          ...(Y.LANDMARKS || []).map(lm => {
            const ll = Y.toLatLng(lm.x, lm.z);
            return { id: 'lm-' + lm.id, styleId: 'poi', position: new window.TMap.LatLng(ll.lat, ll.lng) };
          }),
        ],
      });
      tmapRouteLayer = new window.TMap.MultiPolyline({
        map: tmapInstance,
        styles: {
          nav: new window.TMap.PolylineStyle({ color: '#1ebc8d', width: 6, borderWidth: 2, borderColor: '#15352b', lineCap: 'round' }),
        },
        geometries: [],
      });
      tmapPlayerLayer = new window.TMap.MultiMarker({
        map: tmapInstance,
        styles: { player: markerStyles.player },
        geometries: [],
      });
    }
    tmapPlayerLayer.setGeometries([
      { id: 'protagonist', styleId: 'player', position: new window.TMap.LatLng(pCoord.lat, pCoord.lng) },
    ]);
    const aim = sim.state.target;
    if (aim) {
      const routePts = [p, ...navigation(p, aim)].map(pt => {
        const ll = Y.toLatLng(pt.x, pt.z);
        return new window.TMap.LatLng(ll.lat, ll.lng);
      });
      tmapRouteLayer.setGeometries(routePts.length >= 2 ? [{ id: 'active-route', styleId: 'nav', paths: routePts }] : []);
    } else {
      tmapRouteLayer.setGeometries([]);
    }
    tmapInstance.setCenter(new window.TMap.LatLng(pCoord.lat, pCoord.lng));
    return true;
  }

  function modelForKind(kind) {
    if (kind === 'taxi') return D.TAXI_MODEL;
    return D.CARS.find(c => c.kind === kind) ?? D.CARS[0];
  }
  function renderWorkshopStats(stats, previewStats = null) {
    const wrap = $('workshop-stats');
    if (!wrap) return;
    const rows = [
      ['极速表现', 'speedScore'],
      ['起步加速', 'accelScore'],
      ['弯道抓地', 'gripScore'],
      ['制动操控', 'brakeScore'],
      ['氮气爆发', 'nitroScore'],
      ['营运舒适', 'taxiScore'],
    ];
    wrap.replaceChildren();
    for (const [label, key] of rows) {
      const cur = stats[key] ?? 0;
      const next = previewStats ? (previewStats[key] ?? cur) : cur;
      const delta = next - cur;
      const row = document.createElement('div');
      row.className = 'stat-row';
      const head = document.createElement('div');
      head.className = 'stat-head';
      const nameEl = document.createElement('span');
      titleFor(nameEl, label);
      const valEl = document.createElement('strong');
      valEl.textContent = String(cur);
      if (delta > 0) {
        const diffEl = document.createElement('em');
        diffEl.textContent = '+' + delta;
        valEl.append(diffEl);
      }
      head.append(nameEl, valEl);
      const bar = document.createElement('div');
      bar.className = 'stat-bar';
      const fill = document.createElement('div');
      fill.className = 'stat-bar-fill';
      fill.style.width = cur + '%';
      bar.append(fill);
      if (delta > 0) {
        const dBar = document.createElement('div');
        dBar.className = 'stat-bar-delta';
        dBar.style.left = cur + '%';
        dBar.style.width = Math.min(100 - cur, delta) + '%';
        bar.append(dBar);
      }
      row.append(head, bar);
      wrap.append(row);
    }
    const shown = previewStats ?? stats;
    const gradeEl = $('workshop-grade');
    gradeEl.textContent = shown.grade;
    gradeEl.dataset.grade = shown.grade;
    $('workshop-pi').textContent = previewStats && previewStats.pi > stats.pi ? stats.pi + ' → ' + previewStats.pi : String(stats.pi);
    $('workshop-topkmh').textContent = previewStats && previewStats.topKmh > stats.topKmh ? stats.topKmh + ' → ' + previewStats.topKmh + ' KM/H' : stats.topKmh + ' KM/H';
    $('workshop-zero100').textContent = previewStats && previewStats.zeroToHundred < stats.zeroToHundred ? stats.zeroToHundred + ' → ' + previewStats.zeroToHundred + ' s' : stats.zeroToHundred + ' s';
    $('workshop-level-sum').textContent = stats.totalLevels + ' / ' + stats.maxLevels;
  }
  function renderWorkshop() {
    if (!sim) return;
    const kind = workshopState.kind;
    const cfg = progress.garage[kind];
    const model = modelForKind(kind);
    const stats = computeCarStats(model, cfg);
    const meta = VEHICLE_META[kind] ?? { name: model.name, tag: '', desc: '' };

    titleFor($('workshop-cash'), sim.cashText(progress.cash));
    titleFor($('workshop-car-name'), meta.name);
    titleFor($('workshop-car-tag'), meta.tag);
    titleFor($('workshop-car-desc'), meta.desc);
    $('showroom-night-btn').setAttribute('aria-pressed', String(Boolean(sim.showroom.night)));
    titleFor($('showroom-night-btn'), sim.showroom.night ? '切换日间展厅' : '夜间展厅灯效');
    const drivingThis = sim.state.vehicle?.model.kind === kind;
    titleFor($('workshop-summon-btn'), drivingThis ? '当前驾驶中 · 回到车内' : '唤出此座驾驾驶');

    renderWorkshopStats(stats);

    const vehWrap = $('workshop-vehicles');
    vehWrap.replaceChildren();
    for (const vKind of VEHICLE_ORDER) {
      const vMeta = VEHICLE_META[vKind];
      const vStats = computeCarStats(modelForKind(vKind), progress.garage[vKind]);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vehicle-chip';
      btn.setAttribute('aria-selected', String(vKind === kind));
      const titleEl = document.createElement('strong');
      titleFor(titleEl, vMeta.name.replace(' · TAXI', ''));
      const subEl = document.createElement('small');
      subEl.className = 'mono';
      subEl.textContent = vStats.grade + ' · ' + vStats.pi;
      btn.append(titleEl, subEl);
      btn.addEventListener('click', () => {
        workshopState.kind = vKind;
        sim.setShowroom(true, vKind);
        renderWorkshop();
      });
      vehWrap.append(btn);
    }

    for (const tabBtn of document.querySelectorAll('[data-workshop-tab]')) {
      tabBtn.setAttribute('aria-selected', String(tabBtn.dataset.workshopTab === workshopState.tab));
    }

    const content = $('workshop-content');
    content.replaceChildren();
    if (workshopState.tab === 'performance') {
      for (const cat of UPGRADE_TREE) {
        const curLv = cfg.levels[cat.id] ?? 0;
        const maxLv = cat.levels.length - 1;
        const curItem = cat.levels[curLv];
        const nextItem = cat.levels[curLv + 1] ?? null;
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        const top = document.createElement('div');
        top.className = 'upgrade-card-top';
        const titleBox = document.createElement('div');
        titleBox.className = 'upgrade-title';
        const icon = document.createElement('span');
        icon.className = 'upgrade-icon';
        icon.textContent = cat.icon;
        const names = document.createElement('div');
        const strong = document.createElement('strong');
        titleFor(strong, cat.name);
        const sub = document.createElement('small');
        titleFor(sub, cat.subtitle);
        names.append(strong, sub);
        titleBox.append(icon, names);
        const pips = document.createElement('div');
        pips.className = 'upgrade-pips';
        for (let i = 1; i <= maxLv; i++) {
          const pip = document.createElement('i');
          if (i <= curLv) pip.classList.add('lit');
          pips.append(pip);
        }
        const lvText = document.createElement('span');
        lvText.className = 'mono';
        lvText.textContent = 'Lv.' + curLv;
        pips.append(lvText);
        top.append(titleBox, pips);

        const body = document.createElement('div');
        body.className = 'upgrade-body';
        const desc = document.createElement('div');
        desc.className = 'upgrade-desc';
        const curLine = document.createElement('div');
        curLine.className = 'upgrade-current';
        curLine.textContent = '当前装配：' + curItem.name;
        const nextLine = document.createElement('div');
        nextLine.className = 'upgrade-next';
        nextLine.textContent = nextItem ? '下阶：' + nextItem.name + ' — ' + nextItem.desc : '已达满阶顶配：' + curItem.desc;
        desc.append(curLine, nextLine);

        const buy = document.createElement('button');
        buy.type = 'button';
        buy.className = 'upgrade-buy' + (!nextItem ? ' is-max' : '');
        buy.disabled = !nextItem || progress.cash < nextItem.price;
        buy.textContent = nextItem ? '升级 · ' + sim.cashText(nextItem.price) : '已满阶';
        buy.addEventListener('click', () => {
          if (sim.buyUpgrade(kind, cat.id)) renderWorkshop();
        });
        if (nextItem) {
          const preview = () => {
            const nextCfg = { ...cfg, levels: { ...cfg.levels, [cat.id]: curLv + 1 } };
            renderWorkshopStats(stats, computeCarStats(model, nextCfg));
          };
          card.addEventListener('mouseenter', preview);
          card.addEventListener('focusin', preview);
          card.addEventListener('mouseleave', () => renderWorkshopStats(stats));
          card.addEventListener('focusout', () => renderWorkshopStats(stats));
        }
        body.append(desc, buy);
        card.append(top, body);
        content.append(card);
      }
    } else {
      const sections = [
        { slot: 'paint', title: '车身涂装', hint: '10 款衢州灵感车漆' },
        { slot: 'finish', title: '漆面质感', hint: '实时 PBR 清漆与金属度' },
        { slot: 'wheels', title: '定制轮毂', hint: '3D 实装多幅轮圈' },
        { slot: 'underglow', title: '底盘霓虹灯效', hint: '切夜间展厅效果更佳' },
        { slot: 'headlight', title: '前大灯色温', hint: '影响夜间光束颜色与亮度' },
        { slot: 'plate', title: '定制车牌', hint: '前后 3D 浙H牌照实时刻印' },
      ];
      const finishGradients = {
        gloss: 'linear-gradient(135deg, #4b8a94, #1b363a)',
        metallic: 'linear-gradient(135deg, #b8e3eb, #2a6370 55%, #163038)',
        matte: 'linear-gradient(135deg, #566466, #3c4648)',
        chrome: 'linear-gradient(135deg, #ffffff, #8ea2ad 48%, #2d3840 72%, #d9e6ec)',
      };
      for (const sec of sections) {
        const list = VISUAL_CATALOG[sec.slot] ?? [];
        const ownedList = cfg.owned?.[sec.slot] ?? [];
        const box = document.createElement('section');
        box.className = 'visual-section';
        const head = document.createElement('div');
        head.className = 'visual-section-head';
        const h3 = document.createElement('h3');
        titleFor(h3, sec.title);
        const hint = document.createElement('small');
        titleFor(hint, sec.hint);
        head.append(h3, hint);
        const grid = document.createElement('div');
        grid.className = 'visual-grid';
        for (const item of list) {
          const active = cfg[sec.slot] === item.id;
          const owned = ownedList.includes(item.id) || item.price === 0;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'visual-item';
          btn.setAttribute('aria-pressed', String(active));
          btn.disabled = active || (!owned && progress.cash < item.price);
          if (sec.slot === 'plate') {
            const plate = document.createElement('span');
            plate.className = 'visual-plate';
            plate.style.background = item.bg;
            plate.style.color = item.fg;
            plate.textContent = item.text;
            btn.append(plate);
          } else {
            const sw = document.createElement('span');
            sw.className = 'visual-swatch';
            if (sec.slot === 'finish') sw.style.background = finishGradients[item.id] ?? '#445';
            else if (sec.slot === 'wheels') sw.style.background = 'radial-gradient(circle at 35% 35%, ' + item.spokeColor + ', ' + item.rimColor + ' 72%)';
            else if (sec.slot === 'underglow') sw.style.background = item.color ? 'radial-gradient(circle, ' + item.color + ', #11191d 85%)' : '#252d30';
            else sw.style.background = item.color ?? '#ddd';
            btn.append(sw);
          }
          const nameEl = document.createElement('strong');
          nameEl.textContent = item.name ?? item.text;
          const priceEl = document.createElement('small');
          priceEl.textContent = active ? '使用中' : owned ? '已拥有' : sim.cashText(item.price);
          btn.append(nameEl, priceEl);
          btn.addEventListener('click', () => {
            if (sim.selectVisual(kind, sec.slot, item.id)) renderWorkshop();
          });
          grid.append(btn);
        }
        box.append(head, grid);
        content.append(box);
      }
    }
  }

  const titleFor = language.text;
  const show = (node, on) => { if (node.hidden === Boolean(on)) node.hidden = !on; };
  const role = {
    district: $('district-name'), time: $('city-time'), weather: $('city-weather'), cash: $('cash'), card: $('job-card'), cardKind: $('job-kind'), cardTitle: $('job-title'),
    cardTask: $('job-task'), cardMeta: $('job-meta'),
    exploreStrip: $('explore-strip'), exploreLandmarks: $('explore-landmarks'), exploreTapes: $('explore-tapes'), explorePhotos: $('explore-photos'), exploreEvents: $('explore-events'), exploreRace: $('explore-race'),
    tapeNowPlaying: $('tape-now-playing'), tapePlayingName: $('tape-playing-name'),
    buffPill: $('buff-pill'), buffIcon: $('buff-icon'), buffName: $('buff-name'), buffTime: $('buff-time'),
    raceHud: $('race-hud'), raceTag: $('race-hud-tag'), raceTimer: $('race-timer'), raceGate: $('race-gate'), raceBest: $('race-best'),
    driftHud: $('drift-hud'), driftLabel: $('drift-label'), driftScore: $('drift-score'), driftFill: $('drift-fill'), driftBonus: $('drift-bonus'),
    roadGuide: $('road-guide'), roadMark: $('road-guide-mark'), roadAction: $('road-guide-action'), roadDistance: $('road-guide-distance'),
    prompt: $('interaction'), label: $('world-label'), toast: $('toast'), toastKind: $('toast-kind'), toastTitle: $('toast-title'),
    chatter: $('street-chatter'), chatterWho: $('street-chatter-who'), chatterText: $('street-chatter-text'),
    toastBody: $('toast-body'), radio: $('radio-message'), radioPerson: $('radio-person'), radioLine: $('radio-line'), driving: $('driving'),
    speed: $('speed'), speedFill: $('speed-fill'), unit: $('speed-unit'), gear: $('gear'), model: $('car-model'), grade: $('car-grade'), nitro: $('nitro-fill'), nitroMeter: $('nitro-meter'),
    station: $('station'), vehicleHelp: $('vehicle-help'), carTactile: $('car-tactile'), carLights: $('car-lights'), carHornHint: $('car-horn-hint'),
    restDock: $('rest-dock'), restBadge: $('rest-badge'), restTitle: $('rest-title'), restMeta: $('rest-meta'), restPoem: $('rest-poem'),
    restExitLabel: $('rest-exit-label'), restShowUi: $('rest-show-ui-btn'), restTapeBtn: $('rest-tape-btn'),
    restAmbientBtn: $('rest-ambient-btn'), restAmbientLabel: $('rest-ambient-label'),
    restVignetteBtn: $('rest-vignette-btn'), restVignetteLabel: $('rest-vignette-label'),
    restVignetteCaption: $('rest-vignette-caption'), restVignetteTag: $('rest-vignette-tag'),
    restVignetteSpeaker: $('rest-vignette-speaker'), restVignetteLine: $('rest-vignette-line'),
  };
  const roadActions = {
    left: ['↰', '左转'], right: ['↱', '右转'], back: ['↶', '调头'], straight: ['↑', '直行'], arrival: ['◆', '即将到达'],
    walk: ['P', '停车后步行'],
  };
  function clockText(hour) {
    const h = Math.floor(hour);
    const m = Math.floor((hour - h) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function formatRaceTime(sec) {
    const total = Math.max(0, Number(sec) || 0);
    const mins = Math.floor(total / 60);
    const rem = total - mins * 60;
    return String(mins).padStart(2, '0') + ':' + rem.toFixed(2).padStart(5, '0');
  }
  function jobDetails(s, p) {
    if (s.mode === 'taxi') return sim.taxi.details();
    const target = s.target;
    const distanceText = target ? Math.round(distance(p, target)) + ' 米' : '';
    if (s.race?.active) {
      if (s.race.kind === 'lake') {
        const gate = D.LAKE_RACE?.[s.race.index];
        const isFinal = s.race.index === s.race.total - 1;
        return [
          '信安湖水上计时赛',
          (isFinal ? '水上终点 · ' : '浮标门 ' + (s.race.index + 1) + ' · ') + (gate?.street ?? ''),
          '高速穿过浮标门获浪涌加速，按 Backspace 或点击上方按钮终止。',
          distanceText, isFinal,
        ];
      }
      const order = sim.RACE_ORDER || [1, 2, 3, 4, 5, 6, 7, 8, 0];
      const gate = D.RACE?.[order[s.race.index]];
      const isFinal = s.race.index === s.race.total - 1;
      return [
        '环古城计时赛',
        (isFinal ? '终点冲刺 · ' : '计时门 ' + (s.race.index + 1) + ' · ') + (gate?.street ?? ''),
        '高速穿过计时门回复 35% 氮气，按 Backspace 或点击上方按钮终止。',
        distanceText, isFinal,
      ];
    }
    if (s.streetEvent && (s.streetEvent.phase === 'active' || s.streetEvent.phase === 'needCar')) {
      const ev = s.streetEvent;
      const def = ev.def;
      if (ev.phase === 'needCar') {
        return [
          '街头奇遇 · 顺风车', def.name,
          '请上车或按 V 召车带乘客前往' + def.destName + '（按 Backspace 取消）。',
          '奖励 ' + sim.cashText(def.reward) + (distanceText ? ' · ' + distanceText : ''), false,
        ];
      }
      if (def.kind === 'photo') {
        return [
          '街头奇遇 · 旅拍委托', def.name,
          '前往' + def.destName + '，按 P 进拍照模式框住地标按空格交稿（按 Backspace 取消）。',
          '稿费 ' + sim.cashText(def.reward) + (distanceText ? ' · ' + distanceText : ''), false,
        ];
      }
      const left = Math.max(0, Math.ceil(ev.deadline - s.clock));
      if (def.kind === 'ride') {
        const task = s.vehicle
          ? '平稳驶往' + def.destName + '，抵达后减速靠边下车（按 Backspace 取消）。'
          : '请回到车上继续送乘客前往' + def.destName + '（按 Backspace 取消）。';
        return [
          '街头奇遇 · 顺风车', def.name, task,
          left + ' 秒' + (distanceText ? ' · ' + distanceText : ''), left <= 15,
        ];
      }
      return [
        '街头奇遇 · 急件配送', def.name,
        '趁热送达' + def.destName + '，提前送达另获加奖（按 Backspace 取消）。',
        left + ' 秒' + (distanceText ? ' · ' + distanceText : ''), left <= 15,
      ];
    }
    if (s.workshopGuide) return ['改装工坊', WORKSHOP.label, '沿导航前往' + WORKSHOP.label + '，或按 G 直接打开。', distanceText, false];
    if (s.tapeGuide) {
      return ['声景磁带', s.tapeGuide.name, '沿粉色指引前往收录古城声景磁带（奖励 ¥80）。', distanceText, false];
    }
    if (s.landmarkGuide) {
      if (s.landmarkGuide.kind === 'island') {
        const stage = target?.stage;
        if (stage === 'disembarkIsland') return ['登岛打卡', '严家淤岛码头', '已靠泊岛上码头，按 E 下船登岛完成打卡。', distanceText, false];
        if (stage === 'sailToIsland') return ['信安湖航行', '严家淤岛', '驾驶游艇横渡信安湖前往严家淤岛码头（SPACE 减速）。', distanceText, false];
        if (stage === 'boardBoat') return ['码头登船', '信安湖东岸码头', '走近码头游艇按 E 登船，驶往湖心严家淤岛。', distanceText, false];
        return ['古城导览 · 渡湖', '严家淤岛', '先前往信安湖东岸码头停车步行，再乘游艇渡湖登岛。', distanceText, false];
      }
      return ['古城导览', s.landmarkGuide.label, '沿衢州古城路网前往' + s.landmarkGuide.label + '。', distanceText, false];
    }
    const totalLm = Y?.LANDMARKS?.length ?? 8;
    const totalTapes = D.TAPES?.length ?? 10;
    const nearest = sim.nearestUnvisitedLandmark?.();
    if (nearest) {
      return [
        '自由探索', '衢州古城漫游',
        '最近未访：' + nearest.landmark.name + '（' + Math.round(nearest.distance) + ' 米），按 F 一键导航。',
        '八景 ' + progress.visitedLandmarks.length + '/' + totalLm + ' · 磁带 ' + progress.tapes.length + '/' + totalTapes, false,
      ];
    }
    return ['自由探索', '衢州古城全境达成', '八景已全打卡！按 F 寻访声景磁带，按 M 传送或发起环城计时赛。', '八景 ' + progress.visitedLandmarks.length + '/' + totalLm + ' · 磁带 ' + progress.tapes.length + '/' + totalTapes, false];
  }
  function drawHud() {
    const s = sim.state;
    const p = sim.protagonist();
    if (!$('look-hint').hidden && s.clock >= hintUntil && !$('look-hint').contains(document.activeElement)) $('look-hint').hidden = true;
    titleFor(role.district, D.district(p));
    titleFor(role.time, clockText(s.hour));
    titleFor(role.weather, WEATHER[s.weather].name);
    titleFor(role.cash, sim.cashText(progress.cash));
    const showExplore = s.mode === 'roam' && !s.race?.active;
    if (role.exploreStrip) {
      show(role.exploreStrip, showExplore);
      if (showExplore) {
        const totalLm = Y?.LANDMARKS?.length ?? 8;
        const totalTapes = D.TAPES?.length ?? 10;
        const totalPhotos = D.PHOTO_SPOTS?.length ?? 5;
        titleFor(role.exploreLandmarks, '八景 ' + progress.visitedLandmarks.length + ' / ' + totalLm);
        titleFor(role.exploreTapes, '磁带 ' + progress.tapes.length + ' / ' + totalTapes);
        if (role.explorePhotos) titleFor(role.explorePhotos, '明信片 ' + progress.photos.length + ' / ' + totalPhotos);
        if (role.exploreEvents) {
          show(role.exploreEvents, progress.eventsDone > 0);
          if (progress.eventsDone > 0) titleFor(role.exploreEvents, '奇遇 ' + progress.eventsDone);
        }
        const hasRaceRec = progress.raceBest > 0 || progress.lakeRaceBest > 0;
        show(role.exploreRace, hasRaceRec);
        if (progress.raceBest > 0 && progress.lakeRaceBest > 0) {
          titleFor(role.exploreRace, '陆 ' + progress.raceBest.toFixed(1) + 's · 水 ' + progress.lakeRaceBest.toFixed(1) + 's');
        } else if (progress.raceBest > 0) {
          titleFor(role.exploreRace, '纪录 ' + progress.raceBest.toFixed(1) + 's');
        } else if (progress.lakeRaceBest > 0) {
          titleFor(role.exploreRace, '水上 ' + progress.lakeRaceBest.toFixed(1) + 's');
        }
      }
    }
    if (role.tapeNowPlaying) {
      const playing = Boolean(s.playingTape) && !s.race?.active;
      show(role.tapeNowPlaying, playing);
      if (playing && role.tapePlayingName) titleFor(role.tapePlayingName, s.playingTape.name);
    }
    if (role.buffPill) {
      const buff = sim.activeBuff?.();
      show(role.buffPill, Boolean(buff));
      if (buff) {
        role.buffPill.dataset.buff = buff.id || 'spicy';
        if (role.buffIcon) role.buffIcon.textContent = buff.icon || '★';
        if (role.buffName) titleFor(role.buffName, buff.name);
        const leftSec = Math.max(1, Math.ceil(buff.expiresAt - s.clock));
        if (role.buffTime) role.buffTime.textContent = leftSec + 's';
      }
    }
    if (role.raceHud) {
      const racing = Boolean(s.race?.active);
      show(role.raceHud, racing);
      if (racing) {
        const isLake = s.race.kind === 'lake';
        if (role.raceTag) titleFor(role.raceTag, isLake ? '信安湖水上赛' : '环古城计时赛');
        role.raceTimer.textContent = formatRaceTime(s.race.elapsed);
        titleFor(role.raceGate, '门 ' + (s.race.index + 1) + ' / ' + s.race.total);
        const bestSec = isLake ? progress.lakeRaceBest : progress.raceBest;
        show(role.raceBest, bestSec > 0);
        if (bestSec > 0) titleFor(role.raceBest, '最佳 ' + formatRaceTime(bestSec));
      }
    }
    const guide = sim.roadGuide();
    show(role.roadGuide, guide);
    if (guide) {
      const [mark, label] = roadActions[guide.maneuver];
      titleFor(role.roadMark, mark);
      titleFor(role.roadAction, label);
      titleFor(role.roadDistance, guide.meters > 0 ? guide.meters + ' 米' : '');
      if (role.roadGuide.dataset.color !== guide.color) {
        role.roadGuide.style.setProperty('--route-color', guide.color);
        role.roadGuide.dataset.color = guide.color;
      }
    }
    const action = sim.context();
    const [kind, name, task, meta, urgent] = jobDetails(s, p);
    const eventCardActive = Boolean(s.streetEvent && (s.streetEvent.phase === 'active' || s.streetEvent.phase === 'needCar'));
    role.card.classList.toggle('is-roaming', s.mode !== 'taxi' && !eventCardActive && !s.landmarkGuide && !s.tapeGuide && !s.workshopGuide && !s.race?.active);
    role.card.classList.toggle('taxi-mode', s.mode === 'taxi');
    role.card.classList.toggle('event-mode', eventCardActive);
    show($('taxi-stats'), s.mode === 'taxi');
    if (s.mode === 'taxi') {
      const service = sim.taxi.state;
      titleFor($('taxi-trips'), service.stats.trips + ' 单');
      titleFor($('taxi-earned'), sim.cashText(service.stats.earned));
      const inCar = s.vehicle === sim.taxi.car;
      const occupancy = inCar ? (service.phase === 'onTrip' || service.phase === 'droppingOff' ? '载客中 · ' + sim.cashText(service.fare?.total ?? 0) : '空车')
        : service.phase === 'boarding' ? '乘客上车中' : service.phase === 'droppingOff' ? '乘客下车中' : '停车待命';
      titleFor($('taxi-fare'), occupancy);
    }
    titleFor(role.cardKind, kind);
    show(role.cardKind, kind);
    titleFor(role.cardTitle, name);
    titleFor(role.cardTask, task);
    const detail = guide ? meta.replace(/(?:\s*·\s*)?\d+\s*米$/, '').trim() : meta;
    titleFor(role.cardMeta, detail);
    role.cardMeta.classList.toggle('urgent', urgent);
    show(role.prompt, action);
    if (action) {
      titleFor(role.prompt.firstElementChild, action.key ?? 'E');
      titleFor(role.prompt.lastElementChild, action.label);
    }
    const label = guide ? null : sim.projectTarget();
    show(role.label, label);
    if (label) {
      titleFor(role.label.lastElementChild, label.label + ' · ' + Math.round(label.d) + ' 米');
      role.label.style.setProperty('--marker-x', label.x * 100 + '%');
      role.label.style.setProperty('--marker-y', label.y * 100 + '%');
      role.label.classList.toggle('race', Boolean(label.workshop || label.race));
      role.label.classList.toggle('tape', Boolean(label.tape));
      role.label.classList.toggle('marine', Boolean(label.marine));
      role.label.classList.toggle('courier', Boolean(label.streetEvent));
    }
    if (role.chatter) {
      const ch = (!panel && sim.projectChatter) ? sim.projectChatter() : null;
      show(role.chatter, ch);
      if (ch) {
        titleFor(role.chatterWho, ch.who);
        titleFor(role.chatterText, ch.text);
        role.chatter.style.setProperty('--chatter-x', ch.x * 100 + '%');
        role.chatter.style.setProperty('--chatter-y', ch.y * 100 + '%');
        role.chatter.style.setProperty('--chatter-alpha', ch.alpha.toFixed(2));
      }
    }
    const note = s.notification;
    show(role.toast, note && s.clock < note.until);
    if (note) {
      titleFor(role.toastKind, note.kind);
      titleFor(role.toastTitle, note.title);
      titleFor(role.toastBody, note.body);
    }
    const message = s.transmission;
    show(role.radio, message && s.clock < message.until);
    if (message) {
      titleFor(role.radioPerson, message.who);
      titleFor(role.radioLine, message.line);
    }
    const boat = s.boat;
    const vehicle = boat ?? s.vehicle;
    const resting = Boolean(s.rest?.active);
    const restZen = Boolean(resting && s.rest.uiHidden);
    const vignette = resting ? s.rest.vignette : null;
    const vignetteActive = Boolean(vignette?.active);
    hud.classList.toggle('is-resting', resting);
    hud.classList.toggle('is-rest-zen', restZen);
    hud.classList.toggle('is-vignette', vignetteActive);
    if (role.restDock) {
      show(role.restDock, resting && !restZen);
      if (role.restShowUi) show(role.restShowUi, restZen);
      if (role.restVignetteCaption) {
        show(role.restVignetteCaption, vignetteActive && !restZen);
        if (vignetteActive) {
          role.restVignetteCaption.dataset.kind = vignette.kind || 'tea';
          titleFor(role.restVignetteTag, vignette.tag || '微镜头');
          titleFor(role.restVignetteSpeaker, vignette.speaker || vignette.title || '');
          titleFor(role.restVignetteLine, vignette.lines?.[vignette.lineIndex || 0] || '');
        }
      }
      if (resting) {
        const r = s.rest;
        const badgeText = r.kind === 'car' ? '停车赏景' : r.kind === 'boat' ? '泛舟听水' : r.kind === 'bench' ? '观景小憩' : '歇脚小憩';
        titleFor(role.restBadge, badgeText);
        titleFor(role.restTitle, r.title);
        const speedLabel = (r.timeScale || 1) > 1 ? (' · ' + r.timeScale + '×') : '';
        titleFor(role.restMeta, clockText(s.hour) + ' · ' + WEATHER[s.weather].name + speedLabel);
        titleFor(role.restPoem, r.poem);
        if (role.restExitLabel) titleFor(role.restExitLabel, (r.kind === 'car' || r.kind === 'boat') ? '结束赏景' : '起身离开');
        if (role.restAmbientBtn && role.restAmbientLabel) {
          const ambId = r.ambient || 'off';
          role.restAmbientBtn.setAttribute('aria-pressed', String(ambId !== 'off'));
          titleFor(role.restAmbientLabel, restAmbientLabel(ambId));
        }
        if (role.restVignetteBtn && role.restVignetteLabel) {
          const canVig = r.kind === 'bench' || r.kind === 'ground';
          show(role.restVignetteBtn, canVig);
          if (canVig) {
            const area = D.district(s.player);
            const vKind = vignetteActive ? vignette.kind : (r.spot?.vignette || ((area === '水亭门古街' || area === '孔氏南宗家庙') ? 'opera' : 'tea'));
            role.restVignetteBtn.dataset.kind = vKind;
            role.restVignetteBtn.setAttribute('aria-pressed', String(vignetteActive));
            titleFor(role.restVignetteLabel, vignetteActive ? (vKind === 'opera' ? '听戏中' : '奉茶中') : (vKind === 'opera' ? '听戏' : '奉茶'));
          }
        }
        for (const btn of role.restDock.querySelectorAll('[data-rest-speed]')) {
          btn.setAttribute('aria-pressed', String(Number(btn.dataset.restSpeed) === (r.timeScale || 1)));
        }
      }
    }
    show(role.driving, vehicle);
    hud.classList.toggle('is-driving', Boolean(vehicle));
    hud.classList.toggle('is-car-driving', Boolean(s.vehicle && !boat));
    role.prompt.classList.toggle('is-touch-duplicate', touch.update(s, action));
    if (vehicle) {
      titleFor(role.speed, Math.round(vehicle.speed * (boat ? 1.94384 : 3.6)).toString().padStart(boat ? 2 : 3, '0'));
      const stats = !boat ? (vehicle.upgradeStats ?? computeCarStats(vehicle.model, progress.garage[vehicle.model.kind])) : null;
      const topSpeed = boat ? boat.top : stats.top;
      role.speedFill.style.transform = 'scaleX(' + clamp(vehicle.speed / topSpeed, 0, 1).toFixed(3) + ')';
      titleFor(role.unit, boat ? '节' : 'KM/H');
      const reversing = vehicle.vx * Math.sin(vehicle.yaw) + vehicle.vz * Math.cos(vehicle.yaw) < -.5;
      titleFor(role.gear, boat ? (reversing ? '倒船' : '前进') : (reversing ? 'R' : 'D'));
      titleFor(role.model, boat ? boat.name : vehicle.model.name);
      show(role.grade, !boat && stats);
      if (!boat && stats) {
        role.grade.textContent = stats.grade + ' · ' + stats.pi;
        role.grade.dataset.grade = stats.grade;
      }
      titleFor(role.vehicleHelp, boat ? 'SPACE 减速' : 'SHIFT 氮气');
      show(role.nitroMeter, !boat);
      if (!boat) {
        role.nitro.style.transform = 'scaleX(' + vehicle.nitro + ')';
        role.nitroMeter.setAttribute('aria-valuenow', Math.round(vehicle.nitro * 100));
      }
      titleFor(role.station, s.station ? 'R ' + s.station : 'R 电台关闭');
      if (role.carLights) {
        show(role.carLights, !boat);
        if (!boat) {
          const lm = vehicle.manualLights || 'auto';
          titleFor(role.carLights, lm === 'on' ? 'L 常亮灯' : lm === 'off' ? 'L 关灯' : 'L 自动灯');
          role.carLights.classList.toggle('is-on', lm === 'on');
          role.carLights.classList.toggle('is-off', lm === 'off');
        }
      }
      if (role.carHornHint) {
        titleFor(role.carHornHint, boat ? 'H 汽笛' : 'H 鸣笛');
      }
      role.driving.classList.toggle('is-honking', s.clock < (s.hornUntil ?? 0));
    } else {
      role.driving.classList.remove('is-honking');
    }
    if (role.driftHud) {
      const liveDrift = Boolean(s.vehicle && s.drift >= 6);
      const banked = !liveDrift && Boolean(s.driftBanked && s.clock < s.driftBanked.until);
      show(role.driftHud, liveDrift || banked);
      role.driftHud.classList.toggle('is-banked', banked);
      if (liveDrift) {
        const score = Math.round(s.drift);
        titleFor(role.driftLabel, '漂移中');
        titleFor(role.driftScore, score + ' 分');
        role.driftFill.style.transform = 'scaleX(' + clamp(s.drift / 180, .05, 1).toFixed(3) + ')';
        const est = clamp(Math.round(s.drift / 7.5), 12, 85);
        titleFor(role.driftBonus, score >= 45 ? '预计奖励 +' + sim.cashText(est) : '继续甩尾至 45 分获奖');
      } else if (banked) {
        titleFor(role.driftLabel, '甩尾入账');
        role.driftScore.textContent = '+' + sim.cashText(s.driftBanked.bonus);
        role.driftFill.style.transform = 'scaleX(1)';
        titleFor(role.driftBonus, s.driftBanked.score + ' 分');
      }
    }
  }
  function showGraphicsRecovery(message, canRetry = false) {
    if (view !== 'game') return;
    titleFor(graphicsMessage, message);
    graphicsRetry.hidden = !canRetry;
    graphicsRecovery.hidden = false;
  }
  function queueGraphicsRecovery() {
    graphicsState = 'retry';
    last = 0;
    showGraphicsRecovery('正在以性能画质恢复画面…');
  }
  scene.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    graphicsState = 'lost';
    last = 0;
    restoreControls();
    sim?.update(0, keys, false, 0);
    showGraphicsRecovery('画面已暂停，正在等待浏览器恢复图形连接…');
  });
  scene.addEventListener('webglcontextrestored', queueGraphicsRecovery);
  graphicsRetry.addEventListener('click', queueGraphicsRecovery);
  $('graphics-title').addEventListener('click', backToTitle);

  function loop(now) {
    requestAnimationFrame(loop);
    const elapsed = last ? Math.max(0, (now - last) / 1000) : 0;
    last = now;
    if (!sim || document.hidden || view !== 'game' || graphicsState === 'lost' || graphicsState === 'failed') return;
    try {
      if (graphicsState === 'retry') {
        sim.recoverGraphics();
        sim.repaint();
        graphicsState = 'ok';
        graphicsRecovery.hidden = true;
        resizePending = false;
        last = hudRefresh = radarRefresh = 0;
        return;
      }
      if (resizePending) {
        resizePending = false;
        touch.relayout();
        sim.resize();
        if (panel) sim.repaint();
        if (panel === 'map') drawMap(map, true);
      }
      const running = canControl();
      if (running) flushLook();
      sim.update(elapsed, keys, running);
      if (running && now >= hudRefresh) {
        hudRefresh = now + 65;
        drawHud();
      }
      if (panel === 'photo' && now >= hudRefresh) {
        hudRefresh = now + 110;
        syncPhotoSubjectUi();
      }
      if (running && now >= radarRefresh) {
        radarRefresh = now + 112;
        drawMap(radar, false);
      }
    } catch (error) {
      console.error(error);
      restoreControls();
      if (graphicsState === 'retry' || graphicsRetried) {
        graphicsState = 'failed';
        showGraphicsRecovery('画面已暂停。点击重试继续当前进度。', true);
      } else {
        graphicsRetried = true;
        queueGraphicsRecovery();
      }
    }
  }
  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }
  function setBootProgress(text, ratio, options) {
    const reset = Boolean(options?.reset);
    const isError = Boolean(options?.error);
    status.classList.toggle('is-error', isError);
    if (text) titleFor(statusText, text);
    if (reset) bootProgressValue = 0;
    if (typeof ratio === 'number' && Number.isFinite(ratio)) {
      const clamped = Math.max(0, Math.min(1, ratio));
      bootProgressValue = reset ? clamped : Math.max(bootProgressValue, clamped);
      const pct = Math.round(bootProgressValue * 100);
      bootFill.style.width = pct + '%';
      bootPercent.textContent = pct + '%';
      bootTrack.setAttribute('aria-valuenow', String(pct));
    }
  }
  async function start(mode, event) {
    if (booting || !languageScreen.hidden) return;
    const input = event?.pointerType;
    const onTouchScreen = input === 'touch' || touch.activatingByTouch || (input !== 'mouse' && mobilePointer.matches);
    mouseLook = !onTouchScreen && (input === 'mouse' || mousePointer.matches);
    activeLookDevice = onTouchScreen ? 'touch' : 'mouse';
    if (onTouchScreen) {
      setLandscape(true);
      if (!fullscreenActive()) toggleFullscreen();
    }
    if (panel) closePanel();
    booting = true;
    if (shownLookHints.has(activeLookDevice)) requestMouseLook();
    for (const button of launchButtons) button.disabled = true;
    status.hidden = false;
    setBootProgress('正在加载衢州古城…', 0.02, { reset: true });
    try {
      await nextFrame();
      await nextFrame();
      if (graphicsState !== 'lost' && !sim) sim = await D.createSimulation(scene, progress, persist, nextFrame,
        (stage, ratio) => setBootProgress(stage, ratio));
      if (graphicsState === 'lost') {
        setBootProgress('正在等待浏览器恢复图形连接，恢复后可重新进入。', null, { error: true });
        return;
      }
      if (graphicsState !== 'ok') {
        sim.recoverGraphics();
        graphicsState = 'ok';
      }
      setBootProgress('正在准备画面…', Math.max(bootProgressValue, 0.85));
      const graphicsFrame = async () => {
        await nextFrame();
        if (graphicsState !== 'ok') throw new Error('Graphics connection changed during loading.');
      };
      await graphicsFrame();
      sim.resize();
      await sim.start(mode, graphicsFrame, (stage, ratio) => setBootProgress(stage, ratio));
      if (graphicsState !== 'ok') throw new Error('Graphics connection changed during loading.');
      setBootProgress('正在进入衢州古城…', 1);
      await nextFrame();
      if (panel) closePanel();
      enter();
    } catch (error) {
      if (graphicsState === 'lost' || graphicsState === 'retry') {
        setBootProgress('图形连接已中断，恢复后可重新进入。', null, { error: true });
      } else {
        console.error(error);
        if (sim) graphicsState = 'failed';
        setBootProgress('画面启动中断。再次点击开始可重试。', null, { error: true });
      }
    } finally {
      if (view === 'title') {
        releaseMouseLook();
        setLandscape(false);
      }
      for (const button of launchButtons) button.disabled = false;
      booting = false;
    }
  }
  function enter() {
    drawHud();
    drawMap(radar, false);
    graphicsState = 'ok';
    graphicsRetried = false;
    graphicsRecovery.hidden = true;
    resizePending = false;
    last = hudRefresh = radarRefresh = 0;
    view = 'game';
    title.hidden = true;
    hud.hidden = false;
    restoreControls();
    scene.focus({ preventScroll: true });
    status.hidden = true;
    const hint = $('look-hint');
    hint.hidden = shownLookHints.has(activeLookDevice);
    if (!hint.hidden) {
      shownLookHints.add(activeLookDevice);
      hintUntil = sim.state.clock + 13;
      titleFor($('look-hint-method'), activeLookDevice === 'touch' ? '滑动右屏环视' : '移动鼠标环视');
      $('look-hint-value').textContent = progress[lookFields[activeLookDevice]] + '%';
      hint.classList.toggle('for-touch', activeLookDevice === 'touch');
    }
  }
  function backToTitle() {
    closePanel();
    restoreControls();
    sim?.update(0, keys, false, 0);
    graphicsRecovery.hidden = true;
    view = 'title';
    releaseMouseLook();
    setLandscape(false);
    hud.hidden = true;
    title.hidden = false;
    persist();
    taxiButton.focus({ preventScroll: true });
  }
  function action(code) {
    if (!sim || !canControl()) return;
    switch (code) {
      case 'KeyE': {
        if (sim.state.rest?.active) {
          sim.exitRestMode?.(false);
          break;
        }
        const nearby = sim.context();
        if (nearby && sim.handleInteraction(nearby) === 'workshop') {
          openPanel('workshop');
          return;
        }
        break;
      }
      case 'KeyZ':
        sim.toggleRestMode?.();
        break;
      case 'KeyG': openPanel('workshop'); return;
      case 'KeyM': openPanel('map'); return;
      case 'KeyP': openPanel('photo'); return;
      case 'KeyV': sim.quickSummonVehicle?.(); drawMap(radar, false); break;
      case 'KeyC': flushLook(); sim.cycleCamera(); return;
      case 'KeyF': sim.navigateNearestUnvisited?.(); break;
      case 'KeyT': sim.cycleCollectedTape?.(); break;
      case 'KeyH':
        if (sim.state.rest?.active) sim.toggleRestUi?.();
        else sim.honkHorn?.();
        break;
      case 'KeyL': sim.toggleVehicleLights?.(); break;
      case 'KeyN': sim.switchTime(); break;
      case 'KeyR': sim.toggleStation(); break;
      case 'KeyX': sim.switchWeather(); break;
    }
    drawHud();
  }
  addEventListener('keydown', event => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const code = event.code;
    if (!languageScreen.hidden) {
      if (code === 'Escape' && languageChosen) closeLanguagePicker();
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(code)) {
        event.preventDefault();
        const buttons = languageScreen.querySelectorAll('[data-language]');
        (document.activeElement === buttons[0] ? buttons[1] : buttons[0]).focus({ preventScroll: true });
      }
      return;
    }
    if (code === 'Escape') {
      if (event.repeat) return;
      if (panel === 'pause' && !$('look-controls').hidden) { showLookDetails(false); $('look-open').focus(); }
      else if (panel) closePanel();
      else if (view === 'game' && sim?.state?.rest?.active) { sim.exitRestMode?.(false); drawHud(); }
      else if (view === 'game') openPanel('pause');
      else if (!booting) openLanguagePicker();
      return;
    }
    if (code === 'F2' && (canControl() || panel === 'pause')) {
      event.preventDefault();
      if (!event.repeat) openLookSettings();
      return;
    }
    if (panel) {
      if (panel === 'photo') {
        if (code === 'KeyP' && !event.repeat) { event.preventDefault(); closePanel(); return; }
        if (code === 'KeyH' && !event.repeat) { event.preventDefault(); togglePhotoUi(); return; }
        if (code === 'KeyL' && !event.repeat) { event.preventDefault(); cyclePhotoLights(); return; }
        if (code === 'Space' && !event.repeat && !(document.activeElement instanceof HTMLButtonElement) && !(document.activeElement instanceof HTMLInputElement)) {
          event.preventDefault();
          triggerPhotoCapture();
          return;
        }
        if (photoHoldCodes.has(code) && !(document.activeElement instanceof HTMLInputElement && code.startsWith('Arrow'))) {
          event.preventDefault();
          keyboard.add(code);
          return;
        }
      }
      if (code === 'Tab') {
        const items = [...shells[panel].querySelectorAll('button:enabled, select:enabled, input:enabled, summary, a[href], [tabindex="0"]')].filter(el => el.getClientRects().length);
        const index = items.indexOf(document.activeElement);
        if (items.length && (event.shiftKey ? index <= 0 : index === items.length - 1)) {
          event.preventDefault();
          items[event.shiftKey ? items.length - 1 : 0].focus();
        }
      }
      if (panel === 'map' && code === 'KeyM' && !event.repeat) closePanel();
      if (panel === 'workshop' && code === 'KeyG' && !event.repeat) closePanel();
      return;
    }
    if (view === 'title' && !booting && (code === 'ArrowDown' || code === 'ArrowUp') && launchButtons.includes(document.activeElement)) {
      event.preventDefault();
      const index = launchButtons.indexOf(document.activeElement);
      launchButtons[(index + (code === 'ArrowDown' ? 1 : -1) + launchButtons.length) % launchButtons.length].focus({ preventScroll: true });
      return;
    }
    if (!canControl()) return;
    if (code === 'Backspace' && !event.repeat && sim?.state?.race?.active) {
      event.preventDefault();
      sim.cancelRingRace();
      drawHud();
      drawMap(radar, false);
      return;
    }
    if (code === 'Backspace' && !event.repeat && (sim?.state?.streetEvent?.phase === 'active' || sim?.state?.streetEvent?.phase === 'needCar')) {
      event.preventDefault();
      sim.cancelStreetEvent?.();
      drawHud();
      drawMap(radar, false);
      return;
    }
    if (holdCodes.has(code)) {
      event.preventDefault();
      keyboard.add(code);
    } else if (!event.repeat && sim?.state?.rest?.active && ['Digit1', 'Digit2', 'Digit3'].includes(code)) {
      event.preventDefault();
      sim.setRestTimeScale?.(code === 'Digit1' ? 1 : code === 'Digit2' ? 15 : 60);
      drawHud();
    } else if (!event.repeat && sim?.state?.rest?.active && code === 'KeyB') {
      event.preventDefault();
      sim.cycleRestAmbient?.();
      drawHud();
    } else if (!event.repeat && sim?.state?.rest?.active && code === 'KeyK') {
      event.preventDefault();
      sim.toggleRestVignette?.();
      drawHud();
    } else if (!event.repeat && ['KeyE', 'KeyF', 'KeyG', 'KeyM', 'KeyP', 'KeyT', 'KeyV', 'KeyC', 'KeyR', 'KeyN', 'KeyX', 'KeyH', 'KeyL', 'KeyZ'].includes(code)) {
      event.preventDefault();
      action(code);
    }
  });
  addEventListener('keyup', event => keyboard.delete(event.code));
  addEventListener('blur', restoreControls);
  function resetVisibilityClock() {
    last = 0;
    resizePending = true;
    restoreControls();
    if (document.hidden) releaseMouseLook();
    sim?.update(0, keys, false, 0);
  }
  document.addEventListener('visibilitychange', resetVisibilityClock);
  addEventListener('pagehide', resetVisibilityClock);
  addEventListener('pageshow', resetVisibilityClock);
  addEventListener('resize', queueResize);
  screen.orientation?.addEventListener?.('change', queueResize);
  window.visualViewport?.addEventListener('resize', queueResize);
  if (window.ResizeObserver) new ResizeObserver(queueResize).observe(game);
  document.addEventListener('fullscreenchange', fullscreenChanged);
  document.addEventListener('webkitfullscreenchange', fullscreenChanged);
  appDisplay.addEventListener('change', fullscreenChanged);
  portraitViewport.addEventListener('change', updateLandscapeLayout);
  fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('pointermove', lookWithMouse);
  scene.addEventListener('pointerleave', () => { mousePosition = null; });
  document.addEventListener('mousemove', event => {
    if (document.pointerLockElement !== scene || !canControl() || pointer || event.sourceCapabilities?.firesTouchEvents) return;
    queueMouseLook(-event.movementX, -event.movementY);
  });
  document.addEventListener('pointerlockchange', () => {
    mousePosition = null;
    const locked = document.pointerLockElement === scene;
    if (locked && ((!booting && view === 'title') || panel)) releaseMouseLook();
  });
  scene.tabIndex = -1;
  scene.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || pointer || !canControl()) return;
    mouseLook = true;
    $('look-hint').hidden = true;
    requestMouseLook();
  });
  const cameraDrag = D.trackDrag(game, scene, type => type !== 'mouse' && canControl(), point => {
    mousePosition = null;
    activeLookDevice = 'touch';
    const gain = progress.touchSensitivity / 100;
    pointer = { ...point,
      yawScale: 4.45 * gain / Math.max(1, game.clientWidth),
      pitchScale: 1.48 * gain / Math.max(1, game.clientHeight) };
    sim.holdCamera(true);
  }, ({ x, y }) => {
    lookYaw += (pointer.x - x) * pointer.yawScale;
    lookPitch += (pointer.y - y) * pointer.pitchScale;
    pointer.x = x;
    pointer.y = y;
  }, () => {
    pointer = null;
    sim.holdCamera(false);
  });
  for (const button of document.querySelectorAll('[data-open]')) button.addEventListener('click', () => openPanel(button.dataset.open));
  for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => {
    closePanel();
    if (canControl()) requestMouseLook();
  });
  for (const button of document.querySelectorAll('[data-action]')) {
    button.addEventListener('click', () => {
      closePanel();
      action(button.dataset.action);
    });
  }
  taxiButton.addEventListener('click', event => start('taxi', event));
  roamButton.addEventListener('click', event => start('roam', event));
  $('map-button').addEventListener('click', () => openPanel('map'));
  $('explore-strip')?.addEventListener('click', () => openPanel('map'));
  $('race-abort')?.addEventListener('click', event => {
    event.currentTarget.blur();
    sim?.cancelRingRace?.();
    drawHud();
    drawMap(radar, false);
    scene.focus({ preventScroll: true });
  });
  $('city-time')?.addEventListener('click', event => {
    event.currentTarget.blur();
    action('KeyN');
    scene.focus({ preventScroll: true });
  });
  $('city-weather')?.addEventListener('click', event => {
    event.currentTarget.blur();
    action('KeyX');
    scene.focus({ preventScroll: true });
  });
  for (const speedBtn of document.querySelectorAll('[data-rest-speed]')) {
    speedBtn.addEventListener('click', event => {
      event.currentTarget.blur();
      sim?.setRestTimeScale?.(Number(speedBtn.dataset.restSpeed));
      drawHud();
      scene.focus({ preventScroll: true });
    });
  }
  $('rest-time-btn')?.addEventListener('click', event => {
    event.currentTarget.blur();
    action('KeyN');
    scene.focus({ preventScroll: true });
  });
  $('rest-ambient-btn')?.addEventListener('click', event => {
    event.currentTarget.blur();
    sim?.cycleRestAmbient?.();
    drawHud();
    scene.focus({ preventScroll: true });
  });
  $('rest-vignette-btn')?.addEventListener('click', event => {
    event.currentTarget.blur();
    sim?.toggleRestVignette?.();
    drawHud();
    scene.focus({ preventScroll: true });
  });
  $('rest-weather-btn')?.addEventListener('click', event => {
    event.currentTarget.blur();
    action('KeyX');
    scene.focus({ preventScroll: true });
  });
  $('rest-tape-btn')?.addEventListener('click', event => {
    event.currentTarget.blur();
    action('KeyT');
    scene.focus({ preventScroll: true });
  });
  $('rest-photo-btn')?.addEventListener('click', event => {
    event.currentTarget.blur();
    action('KeyP');
  });
  $('rest-hide-btn')?.addEventListener('click', event => {
    event.currentTarget.blur();
    sim?.toggleRestUi?.();
    drawHud();
    scene.focus({ preventScroll: true });
  });
  $('rest-show-ui-btn')?.addEventListener('click', event => {
    event.currentTarget.blur();
    sim?.toggleRestUi?.();
    drawHud();
    scene.focus({ preventScroll: true });
  });
  $('rest-exit-btn')?.addEventListener('click', event => {
    event.currentTarget.blur();
    sim?.exitRestMode?.(false);
    drawHud();
    scene.focus({ preventScroll: true });
  });
  for (const tabBtn of document.querySelectorAll('[data-workshop-tab]')) {
    tabBtn.addEventListener('click', () => {
      workshopState.tab = tabBtn.dataset.workshopTab;
      renderWorkshop();
    });
  }
  $('showroom-night-btn')?.addEventListener('click', () => {
    if (!sim) return;
    sim.setShowroomNight(!sim.showroom.night);
    renderWorkshop();
  });
  $('workshop-summon-btn')?.addEventListener('click', () => {
    if (!sim) return;
    sim.summonVehicle(workshopState.kind);
    closePanel();
    if (canControl()) requestMouseLook();
  });
  const showroomStage = $('showroom-stage');
  if (showroomStage) {
    showroomStage.addEventListener('pointerdown', event => {
      if (event.target.closest('button') || event.button !== 0 || panel !== 'workshop') return;
      workshopState.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      showroomStage.classList.add('dragging');
      showroomStage.setPointerCapture?.(event.pointerId);
      sim?.orbitShowroom(0, 0, true);
    });
    showroomStage.addEventListener('pointermove', event => {
      const drag = workshopState.drag;
      if (!drag || drag.id !== event.pointerId || !sim) return;
      const dx = (event.clientX - drag.x) * -.0085;
      const dy = (event.clientY - drag.y) * .0055;
      drag.x = event.clientX;
      drag.y = event.clientY;
      sim.orbitShowroom(dx, dy, true);
    });
    const endShowroomDrag = event => {
      if (!workshopState.drag || workshopState.drag.id !== event.pointerId) return;
      workshopState.drag = null;
      showroomStage.classList.remove('dragging');
      showroomStage.releasePointerCapture?.(event.pointerId);
      sim?.orbitShowroom(0, 0, false);
    };
    showroomStage.addEventListener('pointerup', endShowroomDrag);
    showroomStage.addEventListener('pointercancel', endShowroomDrag);
    showroomStage.addEventListener('wheel', event => {
      if (panel !== 'workshop' || !sim) return;
      event.preventDefault();
      sim.zoomShowroom(event.deltaY > 0 ? .35 : -.35);
    }, { passive: false });
  }
  function syncPhotoSubjectUi(customBanner = null) {
    const badge = $('photo-subject-badge');
    if (!badge || !sim) return;
    if (customBanner) {
      photoState.bannerUntil = performance.now() + 2800;
      badge.hidden = false;
      badge.classList.add('is-done');
      badge.classList.remove('is-event');
      titleFor(badge, customBanner);
      return;
    }
    if (performance.now() < photoState.bannerUntil) return;
    const sub = sim.photo.subject ?? sim.checkPhotoSubject?.();
    if (!sub) {
      badge.hidden = true;
      return;
    }
    badge.hidden = false;
    badge.classList.toggle('is-event', Boolean(sub.eventMatch));
    badge.classList.toggle('is-done', !sub.eventMatch && sub.completed);
    titleFor(badge, sub.eventMatch
      ? '✦ 委托取景锁定：' + sub.spot.name + ' · 空格交付 +' + sim.cashText(sub.eventMatch.reward)
      : sub.completed
        ? '✓ 已入册：' + sub.spot.name
        : '✦ 取景锁定：' + sub.spot.name + ' · 空格打卡 +¥120');
  }
  function syncPhotoUi() {
    if (!sim) return;
    const fovEl = $('photo-fov');
    const hourEl = $('photo-hour');
    const fovVal = Math.round(sim.photo.fov);
    const hourVal = Math.round(sim.state.hour * 10) / 10;
    if (fovEl) fovEl.value = String(fovVal);
    if ($('photo-fov-val')) $('photo-fov-val').textContent = fovVal + '°';
    if (hourEl) hourEl.value = String(hourVal);
    const hText = clockText(sim.state.hour);
    if ($('photo-hour-val')) $('photo-hour-val').textContent = hText;
    const wName = WEATHER[sim.state.weather]?.name ?? '晴朗';
    const fObj = sim.PHOTO_FILTERS?.[sim.photo.filter] ?? { id: 'none', name: '原色', css: 'none' };
    scene.style.filter = fObj.css && fObj.css !== 'none' ? fObj.css : '';
    for (const chip of document.querySelectorAll('[data-photo-filter]')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.photoFilter === fObj.id));
    }
    for (const chip of document.querySelectorAll('[data-photo-time]')) {
      const preset = Number(chip.dataset.photoTime);
      const diff = Math.abs(sim.state.hour - preset);
      const wrapDiff = Math.min(diff, 24 - diff);
      chip.setAttribute('aria-pressed', String(wrapDiff < 0.35));
    }
    const lightsBtn = $('photo-lights-btn');
    if (lightsBtn) {
      const lm = sim.photo.carLights || 'auto';
      lightsBtn.setAttribute('aria-pressed', String(lm === 'on'));
      lightsBtn.classList.toggle('is-off', lm === 'off');
      titleFor(lightsBtn, lm === 'on' ? '车灯：常亮' : lm === 'off' ? '车灯：关闭' : '车灯：自动');
    }
    const pcBtn = $('photo-postcard-btn');
    if (pcBtn) {
      pcBtn.setAttribute('aria-pressed', String(Boolean(sim.photo.postcard)));
      titleFor(pcBtn, sim.photo.postcard ? '明信片印章框：开' : '明信片印章框：关');
    }
    if ($('photo-weather-btn')) titleFor($('photo-weather-btn'), '天气：' + wName);
    if ($('photo-location')) titleFor($('photo-location'), D.district(sim.protagonist()));
    if ($('photo-readout')) titleFor($('photo-readout'), fovVal + '° · ' + hText + ' · ' + wName + ' · ' + fObj.name);
    syncPhotoSubjectUi();
  }
  function togglePhotoUi() {
    photoState.uiHidden = !photoState.uiHidden;
    shells.photo.classList.toggle('ui-hidden', photoState.uiHidden);
    if ($('photo-show-ui-btn')) $('photo-show-ui-btn').hidden = !photoState.uiHidden;
  }
  function cyclePhotoLights() {
    if (!sim || panel !== 'photo') return;
    const cur = sim.photo.carLights || 'auto';
    const next = cur === 'auto' ? 'on' : cur === 'on' ? 'off' : 'auto';
    sim.setPhotoCarLights?.(next);
    syncPhotoUi();
  }
  function triggerPhotoCapture() {
    if (!sim || panel !== 'photo') return null;
    const res = sim.capturePhotoResult?.();
    const dataUrl = res?.dataUrl ?? null;
    const flash = $('photo-flash');
    if (flash) {
      flash.classList.add('is-flashing');
      clearTimeout(photoState.flashTimer);
      photoState.flashTimer = setTimeout(() => flash.classList.remove('is-flashing'), 70);
    }
    if (dataUrl) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'quzhou-ancient-city-' + stamp + '.png';
      link.click();
    }
    if (res?.eventCompleted) {
      syncPhotoSubjectUi('✓ 旅拍委托完成：' + res.eventCompleted.name + ' (+' + sim.cashText(res.eventCompleted.reward) + ')');
      drawHud();
    } else if (res?.newlyCompleted && res.framed?.spot) {
      syncPhotoSubjectUi('✓ 明信片打卡成功：' + res.framed.spot.name + ' (+' + sim.cashText(res.reward) + ')');
      drawHud();
    } else {
      syncPhotoSubjectUi();
    }
    return dataUrl;
  }
  const photoStage = $('photo-stage');
  if (photoStage) {
    photoStage.addEventListener('pointerdown', event => {
      if (event.target.closest('button, input, label, .photo-dock') || event.button !== 0 || panel !== 'photo') return;
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      photoState.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      photoStage.classList.add('dragging');
      photoStage.setPointerCapture?.(event.pointerId);
      sim?.orbitPhoto(0, 0, true);
    });
    photoStage.addEventListener('pointermove', event => {
      const drag = photoState.drag;
      if (!drag || drag.id !== event.pointerId || !sim) return;
      const dx = (event.clientX - drag.x) * -.0075;
      const dy = (event.clientY - drag.y) * .0055;
      drag.x = event.clientX;
      drag.y = event.clientY;
      sim.orbitPhoto(dx, dy, true);
    });
    const endPhotoDrag = event => {
      if (!photoState.drag || photoState.drag.id !== event.pointerId) return;
      photoState.drag = null;
      photoStage.classList.remove('dragging');
      photoStage.releasePointerCapture?.(event.pointerId);
      sim?.orbitPhoto(0, 0, false);
    };
    photoStage.addEventListener('pointerup', endPhotoDrag);
    photoStage.addEventListener('pointercancel', endPhotoDrag);
    photoStage.addEventListener('wheel', event => {
      if (panel !== 'photo' || !sim) return;
      event.preventDefault();
      sim.zoomPhoto(event.deltaY > 0 ? .85 : -.85);
    }, { passive: false });
  }
  $('photo-fov')?.addEventListener('input', event => {
    if (!sim) return;
    sim.setPhotoFov(event.target.valueAsNumber);
    syncPhotoUi();
  });
  $('photo-hour')?.addEventListener('input', event => {
    if (!sim) return;
    sim.setPhotoHour(event.target.valueAsNumber);
    syncPhotoUi();
  });
  $('photo-weather-btn')?.addEventListener('click', () => {
    if (!sim) return;
    sim.setPhotoWeather(sim.state.weather + 1);
    syncPhotoUi();
  });
  $('photo-reset-btn')?.addEventListener('click', () => {
    if (!sim) return;
    sim.resetPhotoCamera();
    syncPhotoUi();
  });
  $('photo-hide-btn')?.addEventListener('click', togglePhotoUi);
  $('photo-show-ui-btn')?.addEventListener('click', togglePhotoUi);
  $('photo-capture-btn')?.addEventListener('click', triggerPhotoCapture);
  for (const chip of document.querySelectorAll('[data-photo-filter]')) {
    chip.addEventListener('click', () => {
      if (!sim) return;
      sim.setPhotoFilter?.(chip.dataset.photoFilter);
      chip.blur();
      syncPhotoUi();
    });
  }
  for (const chip of document.querySelectorAll('[data-photo-time]')) {
    chip.addEventListener('click', () => {
      if (!sim) return;
      sim.setPhotoHour(Number(chip.dataset.photoTime));
      chip.blur();
      syncPhotoUi();
    });
  }
  $('photo-lights-btn')?.addEventListener('click', () => {
    cyclePhotoLights();
    $('photo-lights-btn')?.blur();
  });
  $('photo-postcard-btn')?.addEventListener('click', () => {
    if (!sim) return;
    sim.setPhotoPostcard?.(!sim.photo.postcard);
    $('photo-postcard-btn')?.blur();
    syncPhotoUi();
  });
  $('tape-now-playing')?.addEventListener('click', () => {
    if (!sim) return;
    sim.cycleCollectedTape?.();
    drawHud();
  });
  for (const tabBtn of document.querySelectorAll('#map-collection-tabs [data-col-tab]')) {
    tabBtn.addEventListener('click', () => {
      mapCollectionTab = tabBtn.dataset.colTab || 'landmarks';
      if (panel === 'map') renderMapPanel();
    });
  }
  // 手绘衢州古城大地图：缩放、平移、定位、悬停地标签与点击直接导航
  function canvasCoordsFromEvent(event) {
    const rect = map.getBoundingClientRect();
    const scaleX = map.width / Math.max(1, rect.width);
    const scaleY = map.height / Math.max(1, rect.height);
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  }
  $('atlas-zoom-in')?.addEventListener('click', () => {
    atlasState.zoom = clamp(atlasState.zoom * 1.32, 1, 3.0);
    clampAtlasCenter();
    drawMap(map, true);
  });
  $('atlas-zoom-out')?.addEventListener('click', () => {
    atlasState.zoom = clamp(atlasState.zoom / 1.32, 1, 3.0);
    clampAtlasCenter();
    drawMap(map, true);
  });
  $('atlas-reset')?.addEventListener('click', () => {
    resetAtlasView();
    drawMap(map, true);
  });
  $('atlas-locate')?.addEventListener('click', () => {
    if (!sim) return;
    const p = sim.protagonist();
    atlasState.centerX = p.x;
    atlasState.centerZ = p.z;
    atlasState.zoom = Math.max(atlasState.zoom, 1.55);
    clampAtlasCenter();
    drawMap(map, true);
  });
  map.addEventListener('wheel', event => {
    if (panel !== 'map' || tmapMode) return;
    event.preventDefault();
    const { x, y } = canvasCoordsFromEvent(event);
    const before = getAtlasMetrics(map).unproject(x, y);
    const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
    atlasState.zoom = clamp(atlasState.zoom * factor, 1, 3.0);
    const after = getAtlasMetrics(map).unproject(x, y);
    atlasState.centerX += before.x - after.x;
    atlasState.centerZ += before.z - after.z;
    clampAtlasCenter();
    drawMap(map, true);
  }, { passive: false });
  map.addEventListener('pointerdown', event => {
    if (panel !== 'map' || tmapMode || event.button !== 0) return;
    atlasState.drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origCenterX: atlasState.centerX,
      origCenterZ: atlasState.centerZ,
      moved: false,
    };
    map.setPointerCapture?.(event.pointerId);
  });
  map.addEventListener('pointermove', event => {
    if (panel !== 'map' || tmapMode || !sim) return;
    const drag = atlasState.drag;
    const metrics = getAtlasMetrics(map);
    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.hypot(dx, dy) > 5) {
        drag.moved = true;
        map.classList.add('dragging');
        showAtlasTooltip(null);
      }
      if (drag.moved) {
        const rect = map.getBoundingClientRect();
        const sx = map.width / Math.max(1, rect.width);
        const sy = map.height / Math.max(1, rect.height);
        atlasState.centerX = drag.origCenterX - (dx * sx) / metrics.scale;
        atlasState.centerZ = drag.origCenterZ - (dy * sy) / metrics.scale;
        clampAtlasCenter();
        drawMap(map, true);
        return;
      }
    }
    if (Atlas) {
      const pt = canvasCoordsFromEvent(event);
      let hit = hitTestRestSpot(metrics, pt.x, pt.y, (mapCollectionTab === 'rests' ? 20 : 14) * metrics.pr);
      if (!hit) hit = Atlas.hitTestLandmark(Y, metrics.view, pt.x, pt.y, 28 * metrics.pr);
      if (!hit && sim.state.mode === 'roam' && !sim.state.race?.active && D.TAPES?.length) {
        for (const tape of D.TAPES) {
          if (progress.tapes.includes(tape.id)) continue;
          const [tx, ty] = metrics.view(tape);
          if (Math.hypot(pt.x - tx, pt.y - ty) <= 18 * metrics.pr) {
            hit = { ...tape, kind: 'tape' };
            break;
          }
        }
      }
      if (!hit && sim.state.mode === 'roam' && !sim.state.race?.active && D.RACE?.length) {
        const [rx, ry] = metrics.view(D.RACE[0]);
        if (Math.hypot(pt.x - rx, pt.y - ry) <= 18 * metrics.pr) {
          hit = { id: 'race-start', kind: 'raceStart' };
        }
      }
      if (!hit && sim.state.mode === 'roam' && !sim.state.race?.active && D.LAKE_RACE_START) {
        const [lx, ly] = metrics.view(D.LAKE_RACE_START);
        if (Math.hypot(pt.x - lx, pt.y - ly) <= 18 * metrics.pr) {
          hit = { id: 'lake-race-start', kind: 'lakeRaceStart' };
        }
      }
      const nextId = hit && hit.kind !== 'tape' && hit.kind !== 'raceStart' && hit.kind !== 'lakeRaceStart' && hit.kind !== 'restSpot' ? hit.id : null;
      const nextRestId = hit && hit.kind === 'restSpot' ? hit.id : null;
      map.classList.toggle('hover-landmark', Boolean(hit));
      showAtlasTooltip(hit, event.clientX, event.clientY);
      if (atlasState.hoveredId !== nextId || atlasState.hoveredRestId !== nextRestId) {
        atlasState.hoveredId = nextId;
        atlasState.hoveredRestId = nextRestId;
        drawMap(map, true);
      }
    }
  });
  map.addEventListener('pointerleave', () => {
    if (atlasState.hoveredId || atlasState.hoveredRestId) {
      atlasState.hoveredId = null;
      atlasState.hoveredRestId = null;
      drawMap(map, true);
    }
    map.classList.remove('hover-landmark');
    showAtlasTooltip(null);
  });
  map.addEventListener('pointerup', event => {
    const drag = atlasState.drag;
    if (!drag || drag.id !== event.pointerId) return;
    atlasState.drag = null;
    map.classList.remove('dragging');
    map.releasePointerCapture?.(event.pointerId);
    if (drag.moved || panel !== 'map' || tmapMode || !sim) return;
    const pt = canvasCoordsFromEvent(event);
    const metrics = getAtlasMetrics(map);
    const restHit = hitTestRestSpot(metrics, pt.x, pt.y, (mapCollectionTab === 'rests' ? 22 : 16) * metrics.pr);
    if (restHit) {
      if (sim.state.mode !== 'taxi' && !sim.state.race?.active && sim.fastTravelToRestSpot?.(restHit)) {
        closePanel();
        drawHud();
        drawMap(radar, false);
      } else {
        atlasState.centerX = restHit.x;
        atlasState.centerZ = restHit.z;
        atlasState.zoom = Math.max(atlasState.zoom, 1.5);
        clampAtlasCenter();
        drawMap(map, true);
      }
      return;
    }
    const lm = Atlas?.hitTestLandmark(Y, metrics.view, pt.x, pt.y, 30 * metrics.pr);
    if (lm) {
      if (event.shiftKey && sim.state.mode !== 'taxi' && progress.visitedLandmarks.includes(lm.id) && sim.fastTravelToLandmark?.(lm)) {
        closePanel();
        drawHud();
        drawMap(radar, false);
      } else if (sim.setLandmarkTarget?.(lm)) {
        closePanel();
        drawHud();
        drawMap(radar, false);
      } else {
        atlasState.centerX = lm.x;
        atlasState.centerZ = lm.z;
        atlasState.zoom = Math.max(atlasState.zoom, 1.5);
        clampAtlasCenter();
        drawMap(map, true);
      }
      return;
    }
    if (sim.state.mode === 'roam' && !sim.state.race?.active && D.TAPES?.length) {
      for (const tape of D.TAPES) {
        if (progress.tapes.includes(tape.id)) continue;
        const [tx, ty] = metrics.view(tape);
        if (Math.hypot(pt.x - tx, pt.y - ty) <= 20 * metrics.pr && sim.setTapeTarget?.(tape)) {
          closePanel();
          drawHud();
          drawMap(radar, false);
          return;
        }
      }
    }
    if (sim.state.mode === 'roam' && !sim.state.race?.active && D.RACE?.length) {
      const [rx, ry] = metrics.view(D.RACE[0]);
      if (Math.hypot(pt.x - rx, pt.y - ry) <= 20 * metrics.pr && sim.startRingRace?.()) {
        closePanel();
        drawHud();
        drawMap(radar, false);
        return;
      }
    }
    if (sim.state.mode === 'roam' && !sim.state.race?.active && D.LAKE_RACE_START) {
      const [lx, ly] = metrics.view(D.LAKE_RACE_START);
      if (Math.hypot(pt.x - lx, pt.y - ly) <= 20 * metrics.pr && sim.startLakeRace?.()) {
        closePanel();
        drawHud();
        drawMap(radar, false);
        return;
      }
    }
    const worldPt = metrics.unproject(pt.x, pt.y);
    if (worldPt.x >= BOUNDS.minX && worldPt.x <= BOUNDS.maxX && worldPt.z >= BOUNDS.minZ && worldPt.z <= BOUNDS.maxZ && Y?.nearestRoad) {
      const near = Y.nearestRoad(worldPt.x, worldPt.z);
      const roadLabel = near?.edge?.name || Y.districtOf(worldPt) || '衢州古城路口';
      if (sim.setLandmarkTarget?.({ id: 'custom-pin', name: roadLabel, x: near.x, z: near.z, desc: '已抵达手绘舆图选定的' + roadLabel })) {
        closePanel();
        drawHud();
        drawMap(radar, false);
      }
    }
  });
  map.addEventListener('contextmenu', event => {
    if (panel !== 'map' || tmapMode || !sim || sim.state.mode === 'taxi') return;
    const pt = canvasCoordsFromEvent(event);
    const metrics = getAtlasMetrics(map);
    const restHit = hitTestRestSpot(metrics, pt.x, pt.y, 22 * metrics.pr);
    if (restHit && !sim.state.race?.active && sim.setRestSpotTarget?.(restHit)) {
      event.preventDefault();
      closePanel();
      drawHud();
      drawMap(radar, false);
      return;
    }
    const lm = Atlas?.hitTestLandmark(Y, metrics.view, pt.x, pt.y, 32 * metrics.pr);
    if (lm && progress.visitedLandmarks.includes(lm.id) && sim.fastTravelToLandmark?.(lm)) {
      event.preventDefault();
      closePanel();
      drawHud();
      drawMap(radar, false);
    }
  });
  const toggleTmapBtn = $('toggle-tmap');
  if (toggleTmapBtn) {
    toggleTmapBtn.addEventListener('click', () => {
      const container = $('tmap-container');
      if (!window.TMap) {
        titleFor(toggleTmapBtn, '手绘衢州舆图 (离线模式)');
        return;
      }
      tmapMode = !tmapMode;
      container.hidden = !tmapMode;
      map.style.visibility = tmapMode ? 'hidden' : 'visible';
      if (tmapMode) showAtlasTooltip(null);
      titleFor(toggleTmapBtn, tmapMode ? '返回手绘古城舆图' : '切换实景底图');
      if (tmapMode) syncTencentMap();
      else drawMap(map, true);
    });
  }
  $('map-mode-roam')?.addEventListener('click', () => {
    if (!sim) return;
    sim.switchMode('roam');
    renderMapPanel();
    drawHud();
    drawMap(radar, false);
  });
  $('map-mode-taxi')?.addEventListener('click', () => {
    if (!sim) return;
    sim.switchMode('taxi');
    renderMapPanel();
    drawHud();
    drawMap(radar, false);
  });
  $('map-workshop-nav')?.addEventListener('click', () => {
    if (!sim?.navigateWorkshop()) return;
    closePanel();
    drawHud();
    drawMap(radar, false);
  });
  $('map-workshop-open')?.addEventListener('click', () => {
    if (!sim) return;
    openPanel('workshop');
  });
  $('pause-workshop')?.addEventListener('click', () => {
    if (!sim) return;
    openPanel('workshop');
  });
  $('pause-switch-mode')?.addEventListener('click', () => {
    if (!sim) return;
    sim.switchMode(sim.state.mode === 'taxi' ? 'roam' : 'taxi');
    closePanel();
    drawHud();
    drawMap(radar, false);
  });
  $('back-to-title').addEventListener('click', backToTitle);
  $('reset-position').addEventListener('click', () => {
    sim.resetPosition();
    closePanel();
  });
  for (const id of ['title-audio', 'pause-audio']) {
    $(id).addEventListener('click', () => {
      progress.sound = !progress.sound;
      sim?.setSound(progress.sound);
      persist();
      showSound();
    });
  }
  $('motion-button').addEventListener('click', () => {
    progress.reduceMotion = !progress.reduceMotion;
    persist();
    showSound();
  });
  const graphicsSetting = $('graphics-setting');
  graphicsSetting.value = progress.graphics;
  graphicsSetting.addEventListener('change', () => {
    if (!GRAPHICS.includes(graphicsSetting.value)) return;
    progress.graphics = graphicsSetting.value;
    persist();
  });
  const touchSetting = $('touch-setting');
  touchSetting.value = progress.touch;
  touchSetting.addEventListener('change', () => {
    if (!TOUCH_SETTINGS.includes(touchSetting.value)) return;
    progress.touch = touchSetting.value;
    touch.setSetting(progress.touch);
    persist();
  });
  const lookSetting = $('look-setting');
  const lookGainSlider = $('look-gain');
  function renderLookSettings() {
    const value = progress[lookFields[settingsDevice]];
    lookSetting.value = Object.keys(LOOK_GAINS).find(key => LOOK_GAINS[key] === value) || 'custom';
    $('look-input-device').value = settingsDevice;
    lookGainSlider.value = String(value);
    lookGainSlider.setAttribute('aria-valuetext', value + '%');
    lookGainSlider.style.setProperty('--gain-fill', ((value - 30) / 150 * 100) + '%');
    $('look-gain-value').textContent = value + '%';
  }
  function showLookDetails(open) {
    shells.pause.classList.toggle('tuning', open);
    $('look-controls').hidden = !open;
    shells.pause.querySelector('.pause-body').hidden = open;
    titleFor($('pause-title'), open ? '视角灵敏度' : '已暂停');
    renderLookSettings();
    if (open) lookGainSlider.focus({ preventScroll: true });
  }
  function openLookSettings() {
    if (!sim || view !== 'game') return;
    $('look-hint').hidden = true;
    if (panel !== 'pause') openPanel('pause');
    showLookDetails(true);
  }
  function setLookPercent(value) {
    if (!Number.isFinite(value)) return;
    progress[lookFields[settingsDevice]] = clamp(Math.round(value), 30, 180);
    renderLookSettings();
    if (lookSetting.value !== 'custom') progress.lookGain = lookSetting.value;
  }
  lookSetting.addEventListener('change', () => {
    if (!Object.hasOwn(LOOK_GAINS, lookSetting.value)) return;
    setLookPercent(LOOK_GAINS[lookSetting.value]);
    persist();
  });
  $('look-input-device').addEventListener('change', event => {
    if (Object.hasOwn(lookFields,event.target.value)) settingsDevice = event.target.value;
    renderLookSettings();
  });
  lookGainSlider.addEventListener('input', () => setLookPercent(lookGainSlider.valueAsNumber));
  lookGainSlider.addEventListener('change', persist);
  $('look-hint-adjust').addEventListener('click', openLookSettings);
  $('look-hint-dismiss').addEventListener('click', () => { $('look-hint').hidden = true; scene.focus({ preventScroll: true }); });
  $('look-open').addEventListener('click', openLookSettings);
  $('look-settings-back').addEventListener('click', () => { showLookDetails(false); $('look-open').focus(); });
  $('look-test-resume').addEventListener('click', () => { closePanel(); scene.focus({ preventScroll: true }); requestMouseLook(); });
  $('look-reset').addEventListener('click', () => { setLookPercent(100); persist(); });
  renderLookSettings();
  function applyLanguage(code) {
    language.select(code);
    languageSetting.value = language.current;
    showSound();
    showFullscreenControl();
    if (sim && view === 'game') {
      drawHud();
      drawMap(radar, false);
      if (panel === 'workshop') renderWorkshop();
    }
  }
  function openLanguagePicker() {
    if (booting) return;
    title.hidden = true;
    languageScreen.hidden = false;
    const preferred = language.preferred();
    for (const choice of languageScreen.querySelectorAll('[data-language]')) {
      const selected = choice.dataset.language === preferred;
      choice.setAttribute('aria-current', selected ? 'true' : 'false');
      if (selected) choice.focus({ preventScroll: true });
    }
  }
  function closeLanguagePicker() {
    languageScreen.hidden = true;
    title.hidden = false;
    taxiButton.focus({ preventScroll: true });
  }
  function confirmLanguage(code) {
    applyLanguage(code);
    languageChosen = true;
    languageScreen.removeAttribute('aria-busy');
    delete languageScreen.dataset.pendingLanguage;
    closeLanguagePicker();
  }
  for (const choice of languageScreen.querySelectorAll('[data-language]')) {
    choice.addEventListener('click', () => confirmLanguage(choice.dataset.language));
  }
  $('title-language').addEventListener('click', openLanguagePicker);
  languageSetting.addEventListener('change', () => applyLanguage(languageSetting.value));
  showSound();
  showFullscreenControl();
  const earlyChoice = languageScreen.dataset.pendingLanguage;
  if (earlyChoice === 'zh-CN' || earlyChoice === 'en') confirmLanguage(earlyChoice);
  else openLanguagePicker();
  if (new URLSearchParams(location.search).has('debug')) {
    window.__taxiDebug = {
      get sim() { return sim; },
      get progress() { return progress; },
      get view() { return view; },
      get panel() { return panel; },
      openPanel, closePanel, drawHud, renderMapPanel,
      capturePhoto: () => sim?.capturePhoto?.(),
      capturePhotoResult: () => sim?.capturePhotoResult?.(),
      triggerPhotoCapture,
      setMapCollectionTab: tab => { mapCollectionTab = tab; renderMapPanel(); },
      getAtlasMetrics: () => getAtlasMetrics(map),
    };
  }
  requestAnimationFrame(loop);
})();
