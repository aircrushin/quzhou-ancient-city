(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;
  const { HUB, CARS, MARINE, RACE, LAKE_RACE, LAKE_RACE_START, TAPES, PHOTO_SPOTS, STREET_SPOTS, REST_SPOTS, REST_AMBIENTS, REST_VIGNETTES, STREET_EVENTS, clamp, distance, angleDiff } = D;
  const Y = window.QuzhouRoadData || window.YulinRoadData;
  const RACE_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  const ROAD_KINDS = ['hatch', 'coupe', 'sedan', 'van'];
  const PHOTO_FILTERS = {
    none: { id: 'none', name: '原色', css: 'none' },
    film: { id: 'film', name: '胶片暖金', css: 'contrast(1.07) saturate(1.16) sepia(0.18) brightness(1.03)' },
    celadon: { id: 'celadon', name: '青瓷水墨', css: 'contrast(1.12) saturate(0.68) hue-rotate(-14deg) brightness(1.02)' },
    neon: { id: 'neon', name: '霓虹夜色', css: 'contrast(1.18) saturate(1.38) hue-rotate(8deg) brightness(0.96)' },
  };
  const BELL_HOURS = {
    6: '卯时晨钟轻扬，衢江晨雾渐散，古城街巷苏醒。',
    12: '正午十二时，钟楼底铜钟远扬，马站底食肆飘香。',
    18: '暮鼓晨钟交替，水亭门城楼渐次亮起暖灯。',
    21: '戌末夜色沉静，信安湖灯塔与古城檐灯交相辉映。',
  };
  const LANTERN_WISHES = [
    '一盏祈福孔明灯乘着晚风升入星河，愿南孔古城岁岁长安。',
    '暖灯扶摇映照信安湖波，愿来往行人与古城烟火皆顺遂。',
    '纸灯载愿越过水亭门飞檐，南孔圣地清风伴你漫游。',
    '灯火点亮信安夜空，愿下一段衢州街巷旅途惊喜常伴。',
    '湖风托起祈愿明灯，与远岸灯塔遥相守望。',
  ];
  const CHATTER_STALLS = [
    { x: 328.2, y: 2.35, z: 107.0, zone: 'market', who: '三头一掌摊主' },
    { x: 328.2, y: 2.35, z: 122.0, zone: 'market', who: '炭炉烤饼师傅' },
    { x: 73.3, y: 2.45, z: 132.5, zone: 'market', who: '马站底食坊掌柜' },
    { x: 161.4, y: 2.55, z: -8.5, zone: 'kongmiao', who: '南孔家庙游人' },
    { x: 33.0, y: 2.55, z: -94.0, zone: 'heritage', who: '钟楼底老街坊' },
    { x: 330.6, y: 2.35, z: 148.5, zone: 'lake', who: '信安湖灯舫' },
  ];
  const CHATTER_LINES = {
    marketDay: ['刚出炉的梅干菜烤饼咯，外酥里香！', '衢州三头一掌现卤现拌，微辣中辣任选！', '冰镇薄荷水晶糕，解辣又清爽！'],
    marketNight: ['晚市最热闹，烤饼配鸭头趁热吃！', '夜市灯亮啦，来碗热粉干再逛信安湖！', '刚出炉的梅干菜烤饼咯，外酥里香！'],
    marketRain: ['下雨啦，快进棚里喝碗热粉干暖暖身！', '雨天配点热辣鸭头最驱寒！'],
    kongmiao: ['有礼衢州，进棂星门先放轻脚步吧。', '大成殿前的檀香闻着真静心。'],
    fushanDay: ['府山桂花开了，一路都是甜丝丝的香。', '沿着松影小径上去就能望见钟灵塔。'],
    lakeMist: ['晨雾里严家淤灯塔若隐若现，真好看。', '清早湖面起轻岚，像展开了一幅水墨画。'],
    lakeNight: ['快看！湖面河灯漂起来了，天上还有孔明灯。', '去湖边放一盏祈福孔明灯吧，晚风正好。'],
    lakeDay: ['从东岸码头坐游艇，一会儿就到严家淤岛。', '信安湖风真凉爽，远处的白鹭也在滑翔。'],
    shuitingNight: ['晚风正好，水亭门城楼的灯笼全亮啦。', '提着灯笼走三街七巷，特别有古城味道。'],
    shuitingMist: ['清早衢江起薄雾，城墙看着像水墨画一样。', '水亭门青石板带点露水，清晨最安静。'],
    shuitingDay: ['三街七巷里藏着不少老字号，慢走细逛。', '天王塔院那边拍照特别出片。'],
    rainStreet: ['青石板沾了雨，撑着油纸伞走最像江南。', '突然下阵雨了，快走几步别淋湿！', '雨后路面反光，把古城檐灯都映出来了。'],
    nightStreet: ['夏夜林子里有萤火虫，信安湖还能放孔明灯。', '晚上的衢州古城慢悠悠的，逛着真惬意。'],
    dayStreet: ['今天天气真好，适合环古城兜一圈。', '听说府东街工坊能把爱车改得特别帅。'],
  };
  const WORKSHOP = Y?.WORKSHOP_SPOT
    ? { ...Y.WORKSHOP_SPOT, workshop: true }
    : { x: 276.1, z: 138.0, label: '府东街改装工坊', workshop: true };
  const WEATHER = [
    { id: 'clear', name: '晴朗', rain: 0, wetness: .02, mist: 0 },
    { id: 'mist', name: '晨雾', rain: 0, wetness: .24, mist: 1 },
    { id: 'after-rain', name: '雨后', rain: 0, wetness: .62, mist: .18 },
    { id: 'rain', name: '阵雨', rain: 1, wetness: .92, mist: .12 },
  ];
  const guideVoice = '衢州古城导览';
  const PI = Math.PI;
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, rate, dt) => mix(a, b, 1 - Math.exp(-rate * dt));
  const heading = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const offset = (p, angle, n) => ({ x: p.x + Math.sin(angle) * n, z: p.z + Math.cos(angle) * n });

  async function buildInFrames(steps, nextFrame, onStage) {
    const stageRanges = {
      '正在构建衢州古城真实路网与水亭门地标…': [0.22, 0.62, 18],
      '正在装配车辆与船艇…': [0.62, 0.74, 4],
      '正在安排衢州古城街巷车流与行人…': [0.74, 0.84, 10],
    };
    let range = [0.22, 0.62, 18];
    let subStep = 0;
    let sliceStart = performance.now();
    let step = steps.next();
    while (!step.done) {
      if (step.value) {
        if (stageRanges[step.value]) {
          range = stageRanges[step.value];
          subStep = 0;
        }
        onStage?.(step.value, range[0]);
      } else {
        subStep++;
        const span = range[1] - range[0];
        const ratio = range[0] + span * (1 - Math.exp(-subStep / range[2]));
        onStage?.(null, Math.min(range[1] - 0.005, ratio));
      }
      if (step.value || performance.now() - sliceStart >= 5) {
        await nextFrame();
        sliceStart = performance.now();
      }
      step = steps.next();
    }
    onStage?.(null, 0.84);
    return step.value;
  }
  async function createSimulation(canvas, progress, onSave, nextFrame, onStage) {
    if (D.preloadAAAModels) {
      onStage?.('正在加载 Blender 高精度 3D 模型与 PBR 材质…', 0.04);
      if (nextFrame) await nextFrame();
      await D.preloadAAAModels((done, total) => {
        onStage?.(null, 0.04 + (done / Math.max(1, total)) * 0.18);
      });
    }
    const steps = simulationSteps(canvas, progress, onSave);
    return nextFrame ? buildInFrames(steps, nextFrame, onStage) : D.finishBuild(steps);
  }
  function* simulationSteps(canvas, progress, onSave) {
    const compact = matchMedia('(pointer: coarse)').matches;
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.AgXToneMapping ?? T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const gl = renderer.getContext();
    const gpuInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = gpuInfo ? gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL) : '';
    const software = /swiftshader|llvmpipe|microsoft basic|software adapter/i.test(gpu);
    const initialMode = software || !gpuInfo ? 'performance' : compact ? 'high' : 'ultra';
    let safetyMode = null;
    const displayMode = () => safetyMode ?? (progress.graphics === 'auto' ? initialMode : progress.graphics);
    const frameTarget = compact ? 30 : 32;
    const profiles = {
      ultra: { pixels: compact ? 1050000 : 3200000, ratio: software ? .9 : compact ? 1.35 : 1.85, shadows: compact ? 2048 : 4096, street: 0, cars: 320, people: 220 },
      high: { pixels: compact ? 750000 : 1950000, ratio: software ? .82 : compact ? 1.2 : 1.5, shadows: compact ? 1024 : 2048, street: 0, cars: 256, people: 184 },
      balanced: { pixels: compact ? 365000 : 970000, ratio: compact ? 1 : 1.18, shadows: 0, street: 270, cars: 186, people: 134 },
      performance: { pixels: compact ? 230000 : 530000, ratio: software || !gpuInfo ? .58 : .84, shadows: 0, street: 225, cars: 154, people: 113 },
    };
    let resolution = 1;
    let appliedMode = '';
    let appliedSetting = progress.graphics;
    let width = 0, height = 0, bufferWidth = 0, bufferHeight = 0, bufferRatio = 0;
    let frameTime = 0, sampleFrames = 0, slowWindows = 0, clearWindows = 0, worstGap = 0, hitchDebt = 0;
    let frameWarmup = .42;
    const scene = new T.Scene();
    // The scene origin is fixed. Let moving actors update their own branches.
    scene.matrixAutoUpdate = false;
    const camera = new T.PerspectiveCamera(66, 1, .17, 1500);
    yield '正在构建衢州古城真实路网与水亭门地标…';
    const world = yield* D.buildSteps(scene, renderer.capabilities.maxAttributes >= 10);
    yield '正在装配车辆与船艇…';
    const factory = D.makeFactory(scene, world.surfaceHeight, world.skyUniforms);
    const marine = D.makeMarine(scene, world);
    const prepareReflections = D.makeStreetEffects(renderer, scene, world, displayMode, compact);
    const renderScene = D.makeLook(renderer, scene, { compact, mode: displayMode, shelters: world.shelters, skyUniforms: world.skyUniforms });
    camera.layers.enable(1);
    const carList = [];
    const pedestrians = [];
    const GRID_CELL = 16;
    const GRID_MIN_X = -416;
    const GRID_MIN_Z = -416;
    const GRID_COLS = 84;
    const GRID_ROWS = 60;
    function makeActorGrid(list) {
      return { list, buckets: new Array(GRID_COLS * GRID_ROWS), used: [], ready: false };
    }
    function insertIntoGrid(grid, item) {
      const gx = clamp(Math.floor((item.x - GRID_MIN_X) / GRID_CELL), 0, GRID_COLS - 1);
      const gz = clamp(Math.floor((item.z - GRID_MIN_Z) / GRID_CELL), 0, GRID_ROWS - 1);
      const idx = gx + gz * GRID_COLS;
      let bucket = grid.buckets[idx];
      if (!bucket) bucket = grid.buckets[idx] = [];
      if (bucket.length === 0) grid.used.push(bucket);
      bucket.push(item);
    }
    function rebuildGrid(grid) {
      const used = grid.used;
      for (let i = 0; i < used.length; i++) used[i].length = 0;
      used.length = 0;
      const list = grid.list;
      for (let i = 0; i < list.length; i++) insertIntoGrid(grid, list[i]);
      grid.ready = true;
    }
    function queryGrid(grid, x, z, radius, callback) {
      if (!grid.ready) {
        const list = grid.list;
        for (let i = 0; i < list.length; i++) {
          if (callback(list[i]) === true) return true;
        }
        return false;
      }
      const minX = clamp(Math.floor((x - radius - GRID_MIN_X) / GRID_CELL), 0, GRID_COLS - 1);
      const maxX = clamp(Math.floor((x + radius - GRID_MIN_X) / GRID_CELL), 0, GRID_COLS - 1);
      const minZ = clamp(Math.floor((z - radius - GRID_MIN_Z) / GRID_CELL), 0, GRID_ROWS - 1);
      const maxZ = clamp(Math.floor((z + radius - GRID_MIN_Z) / GRID_CELL), 0, GRID_ROWS - 1);
      const buckets = grid.buckets;
      for (let gz = minZ; gz <= maxZ; gz++) {
        const row = gz * GRID_COLS;
        for (let gx = minX; gx <= maxX; gx++) {
          const bucket = buckets[row + gx];
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i++) {
            if (callback(bucket[i]) === true) return true;
          }
        }
      }
      return false;
    }
    const carGrid = makeActorGrid(carList);
    const pedGrid = makeActorGrid(pedestrians);
    const queryCars = (x, z, radius, callback) => queryGrid(carGrid, x, z, radius, callback);
    const queryPeds = (x, z, radius, callback) => queryGrid(pedGrid, x, z, radius, callback);
    const audio = D.createAudio();
    const rainSound = D.makeRainAudio();
    const random = D.rng(87153);
    const player = factory.person('#387a80', '#303a46', '#c48b6b', true);
    const targetVector = new T.Vector3();
    const chatterVector = new T.Vector3();
    const focus = new T.Vector3();
    const desired = new T.Vector3();
    const cameraPivot = new T.Vector3();
    progress.garage = D.normalizeGarage(progress.garage, progress.paint, progress.tune);
    if (!Array.isArray(progress.visitedLandmarks)) progress.visitedLandmarks = [];
    if (!Array.isArray(progress.tapes)) progress.tapes = [];
    if (!Array.isArray(progress.photos)) progress.photos = [];
    if (!Array.isArray(progress.spots)) progress.spots = [];
    if (!(Number.isFinite(progress.lanternsReleased) && progress.lanternsReleased >= 0)) progress.lanternsReleased = 0;
    if (!(Number.isFinite(progress.eventsDone) && progress.eventsDone >= 0)) progress.eventsDone = 0;
    if (!(Number.isFinite(progress.raceBest) && progress.raceBest > 0)) progress.raceBest = 0;
    if (!(Number.isFinite(progress.lakeRaceBest) && progress.lakeRaceBest > 0)) progress.lakeRaceBest = 0;
    if (!ROAD_KINDS.includes(progress.favoriteCar)) progress.favoriteCar = 'coupe';
    const state = {
      player, vehicle: null, boat: null, mode: 'roam', clock: 0,
      landmarkGuide: null, tapeGuide: null, workshopGuide: false, race: null,
      hour: 10.35, notification: null, transmission: null, target: null,
      active: false, throttle: false, station: '', playingTape: null, cameraMode: 0, viewYaw: HUB.angle,
      freeYaw: 0, viewPitch: 0, lookHeld: false, lastLook: -10, shake: 0, night: 0, drift: 0, driftLast: -100,
      driftGrace: 0, driftBanked: null,
      weather: 0, rain: 0, wetness: .02, mist: 0, sheltered: false, ambience: null,
      cameraBump: 0,
      nextTapePing: 2,
      lastBellHour: -1,
      buff: null,
      lastHorn: -10, hornUntil: 0, lastBellRing: -10,
      chatter: null, nextChatter: 4.5, lastChatterLine: '', releasedLanternsCount: 0,
      streetEvent: null, nextEventAt: 16, lastEventId: '',
      rest: null, lastRestBuffAt: -100,
    };
    const pedEnv = { rain: 0, night: 0, clock: 0, sheltered: false };
    const showroom = {
      active: false, kind: 'taxi', yaw: .68, pitch: .23, distance: 5.7,
      night: false, savedHour: null, dragging: false, car: null,
    };
    const photo = {
      active: false, targetX: HUB.x, targetY: 1.5, targetZ: HUB.z,
      yaw: .55, pitch: .22, distance: 8.5, fov: 50,
      filter: 'none', postcard: true, carLights: 'auto', focusCar: null, subject: null, lastCaptured: null,
      savedHour: null, savedWeather: null, savedRain: null, savedWetness: null, savedMist: null, savedFov: 57,
      dragging: false,
    };
    audio.setEnabled(progress.sound);
    function say(who, line, duration = 6.8) {
      state.transmission = { who, line, until: state.clock + duration };
    }
    function announce(kind, title, body, duration = 3.6) {
      state.notification = { kind, title, body, until: state.clock + duration };
    }

    function spawnCar(model, x, z, yaw, kind, color) {
      const car = factory.car(model, x, z, yaw, kind, color);
      carList.push(car);
      if (carGrid.ready) insertIntoGrid(carGrid, car);
      return car;
    }
    const parkedPlaces = (Y?.PARKED_PLACES?.length ? Y.PARKED_PLACES : [
      [0, HUB.x, HUB.z, HUB.angle], [1, 295.6, -111, PI], [2, 296, 45, PI],
      [3, -108.5, 242, PI], [0, -162, -91.5, PI / 2], [1, 82, -91.5, PI / 2],
      [2, -196, 38.5, PI / 2], [3, 176.5, 248, 0], [1, 18, 16.5, PI / 2],
      [3, 252, 299.5, PI / 2], [0, -242, -91.5, -PI / 2], [2, -121.5, 68, 0],
      [1, 279.5, 146.8, PI * .46],
    ]);
    yield;
    const garages = [];
    const garageByKind = {};
    for (const [id, x, z, yaw] of parkedPlaces) {
      const car = spawnCar(CARS[id], x, z, yaw, 'parked');
      garages.push(car);
      if (!garageByKind[car.model.kind]) garageByKind[car.model.kind] = car;
      const syncCar = () => {
        const cfg = progress.garage[car.model.kind];
        if (cfg) D.applyCarUpgrades3D?.(car, cfg, factory);
      };
      syncCar();
      car.onConceptReady = syncCar;
      yield;
    }
    const palette = ['#e4e8ec', '#c9625a', '#6398bd', '#e2cfa8', '#75a694', '#b8c3cc', '#d7b47c', '#546b80'];
    const usualBounds = { offset:0, halfLength:2.31, halfWidth:1.015, height:1.65 };
    const vanBounds = { offset:0, halfLength:2.31, halfWidth:1.055, height:2.12 };
    yield '正在安排衢州古城街巷车流与行人…';
    const traffic = D.createTrafficSystem ? D.createTrafficSystem({
      scene, world, factory, state, cars: carList, pedestrians, Y, random, compact,
      spawnCar, collisionAt, bodyBounds, touchesPerson, clearForPerson, protagonist,
      stepStreetReaction, queryCars, queryPeds,
    }) : null;
    if (traffic) {
      if (traffic.spawnParkedVehicles) yield* traffic.spawnParkedVehicles();
      yield* traffic.spawnTrafficVehicles();
      rebuildGrid(carGrid);
      yield* traffic.spawnPedestrians();
      rebuildGrid(pedGrid);
      traffic.updateSignals(state.clock, state.night, true);
    } else {
      const trafficLoops = Y ? Y.TRAFFIC_LOOPS : [];
      for (const [index, nodeIds] of trafficLoops.entries()) {
        for (let lane = 0; lane < 2; lane++) {
          const points = Y.buildTrafficLoop(nodeIds, lane === 1, 3.85);
          const i = (index + lane * 2) % points.length;
          const j = (i + 1) % points.length;
          const along = .22 + random() * .46;
          const sx = mix(points[i].x, points[j].x, along);
          const sz = mix(points[i].z, points[j].z, along);
          const syaw = heading(points[i], points[j]);
          const car = spawnCar(CARS[(index + lane) % 4], sx, sz, syaw, 'traffic', palette[(index + lane * 2) % palette.length]);
          car.route = points;
          car.next = j;
          car.cruise = 8.0 + random() * 3.8;
          car.pace = car.cruise * .8;
        }
        yield;
      }
    }

    const gold = new T.Color('#ffe4a0');
    const roadNavigation = D.makeRoadNavigation(scene, world);
    const workshopMint = new T.Color('#7cf2c8');
    const seaBlue = new T.Color('#8edfff');
    const taxiAmber = new T.Color('#ffd05a');
    const tapeRose = new T.Color('#f59cc6');
    const raceMint = new T.Color('#66f2c7');
    const raceGold = new T.Color('#ffd663');
    const eventCoral = new T.Color('#ff9e6d');
    function luminous(color) {
      return new T.MeshBasicMaterial({ color, toneMapped: false, depthWrite: false });
    }
    const markerCore = luminous(gold);
    const markerHaze = new T.MeshBasicMaterial({ color: gold, toneMapped: false, transparent: true, opacity: .13,
      depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    const markerRing = new T.Mesh(new T.RingGeometry(2.1, 2.27, 48).rotateX(-PI / 2), markerCore);
    const markerDisk = new T.Mesh(new T.CircleGeometry(2.1, 48).rotateX(-PI / 2), markerHaze);
    const diamond = new T.Mesh(new T.RingGeometry(.33, .46, 4), markerCore);
    const marker = new T.Group();
    marker.add(markerRing, markerDisk, diamond);
    marker.traverse(object => object.layers.set(1));
    scene.add(marker);

    const beaconBeamGeo = new T.CylinderGeometry(.22, 1.05, 58, 12, 1, true);
    const beaconHaloGeo = new T.RingGeometry(1.55, 2.15, 32).rotateX(-PI / 2);
    const landmarkBeacons = (Y?.LANDMARKS || []).map((lm, index) => {
      const group = new T.Group();
      const beamMat = new T.MeshBasicMaterial({
        color: lm.kind === 'island' ? seaBlue : gold, transparent: true, opacity: .2,
        depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
      });
      const haloMat = new T.MeshBasicMaterial({
        color: lm.kind === 'island' ? seaBlue : gold, transparent: true, opacity: .45,
        depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
      });
      const beam = new T.Mesh(beaconBeamGeo, beamMat);
      beam.position.y = 29;
      const halo = new T.Mesh(beaconHaloGeo, haloMat);
      halo.position.y = 2.2;
      group.add(beam, halo);
      const baseY = lm.kind === 'island' ? .45 : world.surfaceHeight(lm.x, lm.z);
      group.position.set(lm.x, baseY, lm.z);
      group.visible = false;
      group.traverse(object => { object.layers.set(1); object.castShadow = false; object.receiveShadow = false; });
      scene.add(group);
      return { lm, group, halo, beamMat, haloMat, index };
    });

    const tapeGemGeo = new T.OctahedronGeometry(.5, 0);
    const tapeOrbitGeo = new T.TorusGeometry(.86, .048, 8, 28);
    const tapeHaloGeo = new T.RingGeometry(.92, 1.24, 28).rotateX(-PI / 2);
    const tapeGemMat = new T.MeshBasicMaterial({ color: tapeRose, toneMapped: false });
    const tapeOrbitMat = new T.MeshBasicMaterial({ color: '#ffd9ea', transparent: true, opacity: .82, depthWrite: false, toneMapped: false });
    const tapeHaloMat = new T.MeshBasicMaterial({ color: tapeRose, transparent: true, opacity: .34, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false });
    const tapeProps = (TAPES || []).map((tape, index) => {
      const group = new T.Group();
      const gem = new T.Mesh(tapeGemGeo, tapeGemMat);
      gem.position.y = 1.4;
      const orbit = new T.Mesh(tapeOrbitGeo, tapeOrbitMat);
      orbit.position.y = 1.4;
      orbit.rotation.x = .95;
      const halo = new T.Mesh(tapeHaloGeo, tapeHaloMat);
      halo.position.y = .08;
      group.add(gem, orbit, halo);
      const baseY = Math.max(tape.x > 331 ? .22 : 0, world.surfaceHeight(tape.x, tape.z));
      group.position.set(tape.x, baseY, tape.z);
      group.visible = false;
      group.traverse(object => { object.layers.set(1); object.castShadow = false; object.receiveShadow = false; });
      scene.add(group);
      return { tape, group, gem, orbit, baseY, index };
    });

    const spotRingGeo = new T.RingGeometry(1.05, 1.32, 32).rotateX(-PI / 2);
    const spotLanternGeo = new T.OctahedronGeometry(.19, 0);
    const spotAmber = new T.Color('#ffbe6b');
    const spotJade = new T.Color('#7ae8c4');
    const streetSpotProps = (STREET_SPOTS || []).map((spot, index) => {
      const group = new T.Group();
      const ringMat = new T.MeshBasicMaterial({
        color: spotAmber, transparent: true, opacity: .52, depthWrite: false,
        blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
      });
      const gemMat = new T.MeshBasicMaterial({ color: spotAmber, transparent: true, opacity: .88, toneMapped: false });
      const ring = new T.Mesh(spotRingGeo, ringMat);
      ring.position.y = .09;
      const gem = new T.Mesh(spotLanternGeo, gemMat);
      gem.position.y = 2.25;
      group.add(ring, gem);
      const baseY = Math.max(spot.x > 320 ? .22 : 0, world.surfaceHeight(spot.x, spot.z));
      group.position.set(spot.x, baseY, spot.z);
      group.visible = false;
      group.traverse(object => { object.layers.set(1); object.castShadow = false; object.receiveShadow = false; });
      scene.add(group);
      return { spot, group, ringMat, gemMat, gem, index };
    });

    const restRingGeo = new T.RingGeometry(.92, 1.14, 28).rotateX(-PI / 2);
    const restSpotProps = (REST_SPOTS || []).map((spot, index) => {
      const group = new T.Group();
      const ringMat = new T.MeshBasicMaterial({
        color: '#7ee2c6', transparent: true, opacity: .28, depthWrite: false,
        blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
      });
      const ring = new T.Mesh(restRingGeo, ringMat);
      ring.position.y = .08;
      group.add(ring);
      const baseY = Math.max(spot.x > 320 ? .22 : 0, world.surfaceHeight(spot.x, spot.z));
      group.position.set(spot.x, baseY, spot.z);
      group.visible = false;
      group.traverse(object => { object.layers.set(1); object.castShadow = false; object.receiveShadow = false; });
      scene.add(group);
      return { spot, group, ringMat, index };
    });

    const eventNpc = factory.person('#c86446', '#333e4c', '#d8a680', false, 3, true);
    eventNpc.root.visible = false;
    const vignetteNpc = factory.person('#7b2d26', '#28262e', '#dfb08c', false, 2, false);
    vignetteNpc.root.visible = false;
    const vignetteProps = (() => {
      const woodMat = new T.MeshStandardMaterial({ color: '#6d3d24', roughness: .58, metalness: .08 });
      const clayMat = new T.MeshStandardMaterial({ color: '#a85239', roughness: .50, metalness: .06 });
      const celadonMat = new T.MeshStandardMaterial({ color: '#d0f0e2', roughness: .24, metalness: .06 });
      const teaLiquidMat = new T.MeshStandardMaterial({ color: '#8ea84e', roughness: .22, metalness: .08 });
      const steamMat = new T.MeshBasicMaterial({ color: '#f4f7f2', transparent: true, opacity: .38, depthWrite: false });
      const teaTray = new T.Group();
      const trayBase = new T.Mesh(new T.BoxGeometry(.42, .024, .28), woodMat);
      teaTray.add(trayBase);
      for (const [bx, bz, bw, bd] of [[0, .135, .42, .016], [0, -.135, .42, .016], [.204, 0, .016, .28], [-.204, 0, .016, .28]]) {
        const rim = new T.Mesh(new T.BoxGeometry(bw, .034, bd), woodMat);
        rim.position.set(bx, .014, bz);
        teaTray.add(rim);
      }
      const potBody = new T.Mesh(new T.SphereGeometry(.072, 12, 10), clayMat);
      potBody.scale.set(1, .84, 1);
      potBody.position.set(-.09, .068, -.01);
      const potLid = new T.Mesh(new T.SphereGeometry(.018, 8, 6), clayMat);
      potLid.position.set(-.09, .132, -.01);
      const potSpout = new T.Mesh(new T.CylinderGeometry(.010, .017, .085, 6), clayMat);
      potSpout.position.set(-.025, .078, -.01);
      potSpout.rotation.z = -.82;
      teaTray.add(potBody, potLid, potSpout);
      const cups = [];
      for (const [cx, cz] of [[.085, .052], [.105, -.055]]) {
        const cup = new T.Mesh(new T.CylinderGeometry(.038, .026, .062, 10), celadonMat);
        cup.position.set(cx, .042, cz);
        const liq = new T.Mesh(new T.CircleGeometry(.031, 10).rotateX(-PI / 2), teaLiquidMat);
        liq.position.set(cx, .068, cz);
        teaTray.add(cup, liq);
        cups.push({ x: cx, z: cz });
      }
      const steamWisps = [];
      for (let i = 0; i < 4; i++) {
        const wisp = new T.Mesh(new T.SphereGeometry(.026, 7, 6), steamMat.clone());
        wisp.position.set(i < 2 ? -.08 : .09, .14 + i * .05, i % 2 ? .03 : -.03);
        teaTray.add(wisp);
        steamWisps.push({ mesh: wisp, baseX: wisp.position.x, baseZ: wisp.position.z, phase: i * 1.57 });
      }
      teaTray.position.set(0, 1.06, .37);
      teaTray.visible = false;
      vignetteNpc.root.add(teaTray);

      const bambooMat = new T.MeshStandardMaterial({ color: '#3b2416', roughness: .62, metalness: .06 });
      const fanPaperMat = new T.MeshStandardMaterial({ color: '#f5e8c8', roughness: .72, metalness: .04, side: T.DoubleSide });
      const fanTrimMat = new T.MeshStandardMaterial({ color: '#c43e31', roughness: .52, metalness: .10, side: T.DoubleSide });
      const operaFan = new T.Group();
      const fanBody = new T.Mesh(new T.CircleGeometry(.30, 14, PI * .15, PI * .70), fanPaperMat);
      const fanArc = new T.Mesh(new T.RingGeometry(.245, .302, 14, 1, PI * .15, PI * .70), fanTrimMat);
      fanArc.position.z = .002;
      operaFan.add(fanBody, fanArc);
      for (let i = 0; i < 7; i++) {
        const ang = PI * (.15 + .70 * (i / 6));
        const rib = new T.Mesh(new T.BoxGeometry(.012, .30, .008), bambooMat);
        rib.position.set(Math.cos(ang) * .15, Math.sin(ang) * .15, .003);
        rib.rotation.z = ang - PI / 2;
        operaFan.add(rib);
      }
      operaFan.position.set(-.34, 1.38, .32);
      operaFan.visible = false;
      vignetteNpc.root.add(operaFan);

      const operaStage = new T.Group();
      const post = new T.Mesh(new T.CylinderGeometry(.032, .042, 1.56, 8), woodMat);
      post.position.y = .78;
      const foot = new T.Mesh(new T.CylinderGeometry(.18, .22, .06, 10), woodMat);
      foot.position.y = .03;
      const arm = new T.Mesh(new T.BoxGeometry(.34, .032, .032), woodMat);
      arm.position.set(.14, 1.52, 0);
      const lanternMat = new T.MeshBasicMaterial({ color: '#ff9452', toneMapped: false });
      const lanternPivot = new T.Group();
      lanternPivot.position.set(.29, 1.50, 0);
      const cord = new T.Mesh(new T.CylinderGeometry(.005, .005, .14, 4), bambooMat);
      cord.position.y = -.07;
      const lampBody = new T.Mesh(new T.SphereGeometry(.125, 10, 8), lanternMat);
      lampBody.scale.set(1, 1.24, 1);
      lampBody.position.y = -.24;
      const lampTop = new T.Mesh(new T.CylinderGeometry(.075, .075, .028, 8), bambooMat);
      lampTop.position.y = -.095;
      const lampBot = new T.Mesh(new T.CylinderGeometry(.065, .065, .026, 8), bambooMat);
      lampBot.position.y = -.385;
      const tassel = new T.Mesh(new T.CylinderGeometry(.012, .026, .16, 6), fanTrimMat);
      tassel.position.y = -.47;
      lanternPivot.add(cord, lampBody, lampTop, lampBot, tassel);
      const gongMat = new T.MeshStandardMaterial({ color: '#d8ab4c', roughness: .32, metalness: .72 });
      const gong = new T.Mesh(new T.CylinderGeometry(.13, .13, .022, 16).rotateX(PI / 2), gongMat);
      gong.position.set(-.12, 1.18, 0);
      operaStage.add(post, foot, arm, lanternPivot, gong);
      operaStage.visible = false;
      scene.add(operaStage);

      const playerCup = new T.Group();
      const pCupMesh = new T.Mesh(new T.CylinderGeometry(.038, .026, .062, 10), celadonMat);
      const pTeaMesh = new T.Mesh(new T.CircleGeometry(.031, 10).rotateX(-PI / 2), teaLiquidMat);
      pTeaMesh.position.y = .026;
      const pWisp = new T.Mesh(new T.SphereGeometry(.022, 6, 5), steamMat.clone());
      pWisp.position.y = .075;
      playerCup.add(pCupMesh, pTeaMesh, pWisp);
      playerCup.scale.setScalar(1.22);
      playerCup.position.set(-.15, .94, .34);
      playerCup.visible = false;
      player.root.add(playerCup);

      return { teaTray, steamWisps, operaFan, operaStage, lanternPivot, playerCup, playerCupWisp: pWisp };
    })();
    const vigHandL = new T.Vector3();
    const vigHandR = new T.Vector3();
    const vigHandTmp = new T.Vector3();
    function bonePalmWorld(person, side, out) {
      const limb = person?.limbs?.find(item => item.side === side);
      if (!limb?.elbow) return false;
      person.root.updateMatrixWorld(true);
      out.set(0, -.27, .018);
      limb.elbow.localToWorld(out);
      return true;
    }
    function syncVignettePropsToHands() {
      const v = state.rest?.vignette;
      if (!v?.active || !vignetteNpc.root.visible) return;
      if (v.kind === 'tea') {
        if (vignetteProps.teaTray.visible && bonePalmWorld(vignetteNpc, 1, vigHandL) && bonePalmWorld(vignetteNpc, -1, vigHandR)) {
          vigHandTmp.copy(vigHandL).add(vigHandR).multiplyScalar(.5);
          vignetteNpc.root.worldToLocal(vigHandTmp);
          vignetteProps.teaTray.position.set(vigHandTmp.x, vigHandTmp.y + .018, vigHandTmp.z + .048);
        }
        if (vignetteProps.playerCup.visible && bonePalmWorld(player, -1, vigHandR)) {
          player.root.worldToLocal(vigHandR);
          vignetteProps.playerCup.position.set(vigHandR.x, vigHandR.y + .026, vigHandR.z + .016);
        }
      } else if (v.kind === 'opera') {
        if (vignetteProps.operaFan.visible && bonePalmWorld(vignetteNpc, -1, vigHandR)) {
          vignetteNpc.root.worldToLocal(vigHandR);
          vignetteProps.operaFan.position.set(vigHandR.x, vigHandR.y + .012, vigHandR.z + .018);
        }
      }
    }
    const eventBeacon = (() => {
      const group = new T.Group();
      const ringMat = new T.MeshBasicMaterial({
        color: eventCoral, transparent: true, opacity: .68, depthWrite: false,
        blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
      });
      const fillMat = new T.MeshBasicMaterial({
        color: eventCoral, transparent: true, opacity: .15, depthWrite: false,
        blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
      });
      const gemMat = new T.MeshBasicMaterial({ color: '#ffd3b8', transparent: true, opacity: .94, toneMapped: false });
      const beamMat = new T.MeshBasicMaterial({
        color: eventCoral, transparent: true, opacity: .18, depthWrite: false,
        blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
      });
      const ring = new T.Mesh(new T.RingGeometry(1.18, 1.52, 32).rotateX(-PI / 2), ringMat);
      ring.position.y = .10;
      const fill = new T.Mesh(new T.CircleGeometry(1.18, 32).rotateX(-PI / 2), fillMat);
      fill.position.y = .08;
      const gem = new T.Mesh(new T.OctahedronGeometry(.27, 0), gemMat);
      gem.position.y = 2.68;
      const beam = new T.Mesh(new T.CylinderGeometry(.09, .38, 16, 10, 1, true), beamMat);
      beam.position.y = 8.0;
      group.add(ring, fill, gem, beam);
      group.visible = false;
      group.traverse(object => { object.layers.set(1); object.castShadow = false; object.receiveShadow = false; });
      scene.add(group);
      return { group, ring, ringMat, fillMat, gem, beam, beamMat };
    })();

    const releasedLanterns = [];
    const relLanternBodyGeo = new T.CylinderGeometry(.30, .20, .54, 6);
    const relLanternCoreGeo = new T.SphereGeometry(.095, 6, 6);
    const relLanternBodyMat = new T.MeshBasicMaterial({ color: '#ffd07a', transparent: true, opacity: .94, toneMapped: false });
    const relLanternCoreMat = new T.MeshBasicMaterial({ color: '#fff4cf', toneMapped: false });
    const relLanternGlowTex = (() => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const cx = cv.getContext('2d');
      const g = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255, 245, 205, 1)');
      g.addColorStop(.32, 'rgba(255, 188, 90, .68)');
      g.addColorStop(.70, 'rgba(255, 138, 48, .18)');
      g.addColorStop(1, 'rgba(255, 138, 48, 0)');
      cx.fillStyle = g;
      cx.fillRect(0, 0, 64, 64);
      const tex = new T.CanvasTexture(cv);
      tex.colorSpace = T.SRGBColorSpace;
      return tex;
    })();
    const relLanternGlowMat = new T.SpriteMaterial({
      map: relLanternGlowTex, color: '#ffbf64', transparent: true, opacity: .78,
      depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
    });
    function releaseSkyLantern(origin = protagonist(), yaw = state.viewYaw) {
      if (releasedLanterns.length >= 16) {
        const oldest = releasedLanterns.shift();
        scene.remove(oldest.group);
      }
      const group = new T.Group();
      const body = new T.Mesh(relLanternBodyGeo, relLanternBodyMat);
      const core = new T.Mesh(relLanternCoreGeo, relLanternCoreMat);
      core.position.y = -.16;
      const glow = new T.Sprite(relLanternGlowMat);
      glow.scale.set(2.2, 2.2, 1);
      group.add(body, core, glow);
      const launchX = origin.x + Math.sin(yaw) * 1.45;
      const launchZ = origin.z + Math.cos(yaw) * 1.45;
      const baseY = world.surfaceHeight(launchX, launchZ) + 1.48;
      group.position.set(launchX, baseY, launchZ);
      group.scale.setScalar(.25);
      scene.add(group);
      const item = {
        group, glow, age: 0, maxAge: 52,
        vx: .52 + (random() - .25) * .32, vz: (random() - .5) * .42, vy: 1.48 + random() * .38,
        phase: random() * PI * 2, spin: (random() - .5) * .45,
      };
      releasedLanterns.push(item);
      state.releasedLanternsCount++;
      progress.lanternsReleased = (progress.lanternsReleased || 0) + 1;
      onSave();
      return item;
    }
    function stepReleasedLanterns(dt) {
      for (let i = releasedLanterns.length - 1; i >= 0; i--) {
        const item = releasedLanterns[i];
        item.age += dt;
        if (item.age >= item.maxAge || item.group.position.y > 105) {
          scene.remove(item.group);
          releasedLanterns.splice(i, 1);
          continue;
        }
        const lift = item.vy * (0.72 + Math.min(.55, item.age * .06));
        item.group.position.x += (item.vx + Math.sin(item.age * .65 + item.phase) * .28) * dt;
        item.group.position.z += (item.vz + Math.cos(item.age * .58 + item.phase) * .24) * dt;
        item.group.position.y += lift * dt;
        item.group.rotation.set(Math.sin(item.age * .9 + item.phase) * .08, item.age * item.spin, Math.cos(item.age * .85 + item.phase) * .08);
        const appear = clamp(item.age / .65, 0, 1);
        const fade = clamp((item.maxAge - item.age) / 6.0, 0, 1);
        const sc = (.25 + .75 * appear) * fade;
        item.group.scale.setScalar(Math.max(.02, sc));
        const flicker = 2.0 + Math.sin(state.clock * 4.2 + item.phase) * .28;
        item.glow.scale.set(flicker, flicker, 1);
      }
    }

    function clearEventVisuals() {
      eventNpc.root.visible = false;
      eventNpc.waving = false;
      eventBeacon.group.visible = false;
    }
    function cancelStreetEvent(silent = false) {
      const ev = state.streetEvent;
      if (!ev) return false;
      const wasActive = ev.phase === 'active' || ev.phase === 'needCar';
      state.streetEvent = null;
      clearEventVisuals();
      state.nextEventAt = state.clock + 28 + random() * 14;
      state.target = target();
      if (!silent && wasActive) {
        announce('街头奇遇', '已放弃当前委托', '在古城漫游时仍会陆续遇到新的街头奇遇。', 3.0);
        audio.note();
      }
      return true;
    }
    function spawnStreetEvent(forcedId = null) {
      if (!STREET_EVENTS?.length) return null;
      let def = null;
      if (forcedId) {
        def = STREET_EVENTS.find(item => item.id === forcedId) || null;
        if (!def) return null;
        state.streetEvent = null;
        clearEventVisuals();
      } else {
        if (state.streetEvent || state.mode !== 'roam' || state.race?.active || state.rest?.active || showroom.active || photo.active || state.boat) return null;
        const p = protagonist();
        const pool = STREET_EVENTS.filter(item => item.id !== state.lastEventId);
        const list = pool.length ? pool : STREET_EVENTS;
        const inBand = list.filter(item => {
          const d = distance(p, item);
          return d >= 28 && d <= 245;
        });
        const candidates = inBand.length ? inBand : list.filter(item => distance(p, item) >= 20);
        const source = candidates.length ? candidates : list;
        let totalW = 0;
        const weights = source.map(item => {
          const d = distance(p, item);
          let w = 1 / (1 + d / 160);
          if (item.preferRain && state.rain > .35) w *= 2.6;
          if (item.preferNight && state.night > .35) w *= 2.0;
          if (item.kind === 'photo' && !progress.photos.includes(item.photoSpotId)) w *= 1.45;
          totalW += w;
          return w;
        });
        let pick = random() * totalW;
        def = source[source.length - 1];
        for (let i = 0; i < source.length; i++) {
          pick -= weights[i];
          if (pick <= 0) { def = source[i]; break; }
        }
      }
      const near = D.nearestRoad(def.x, def.z);
      const lookPt = near && distance(def, near) > 1.2 ? near : null;
      const spot = findClearPersonSpot({ x: def.x, z: def.z }, lookPt);
      eventNpc.x = spot.x;
      eventNpc.z = spot.z;
      eventNpc.yaw = spot.yaw;
      eventNpc.elevation = world.surfaceHeight(spot.x, spot.z);
      eventNpc.visiblePace = 0;
      eventNpc.waving = false;
      eventNpc.umbrellaOpen = state.rain > .32 ? 1 : 0;
      eventNpc.lanternOpen = state.night > .36 && state.rain < .42 ? 1 : 0;
      state.lastEventId = def.id;
      state.streetEvent = {
        def, phase: 'offered', x: spot.x, z: spot.z, yaw: spot.yaw,
        destX: def.destX, destZ: def.destZ,
        hailed: false, expiresAt: state.clock + 145, startedAt: 0, deadline: 0, roughHits: 0, farewellUntil: 0,
      };
      return state.streetEvent;
    }
    function beginActiveStreetEvent(ev) {
      ev.phase = 'active';
      ev.startedAt = state.clock;
      ev.deadline = ev.def.timeLimit > 0 ? state.clock + ev.def.timeLimit : 0;
      ev.roughHits = 0;
      eventNpc.waving = false;
      if (ev.def.kind === 'ride') eventNpc.root.visible = false;
      state.target = target();
    }
    function acceptStreetEvent(ev) {
      if (!ev || ev.phase !== 'offered') return false;
      state.landmarkGuide = null;
      state.tapeGuide = null;
      state.workshopGuide = false;
      audio.start();
      audio.note();
      say(ev.def.speaker, ev.def.acceptLine, 6.4);
      if (ev.def.kind === 'ride' && !state.vehicle) {
        ev.phase = 'needCar';
        ev.expiresAt = state.clock + 95;
        state.target = target();
        announce('街头奇遇 · 顺风车', ev.def.name, '请上车或按 V 召车带乘客前往' + ev.def.destName + '。', 4.6);
      } else {
        beginActiveStreetEvent(ev);
        if (ev.def.kind === 'ride') {
          announce('街头奇遇 · 顺风车', ev.def.name, '乘客已上车！平稳驶往' + ev.def.destName + '（奖励 ' + cashText(ev.def.reward) + '）。', 4.4);
        } else if (ev.def.kind === 'courier') {
          announce('街头奇遇 · 急件配送', ev.def.name, '请在 ' + ev.def.timeLimit + ' 秒内送达' + ev.def.destName + '（奖励 ' + cashText(ev.def.reward) + '）。', 4.4);
        } else {
          announce('街头奇遇 · 旅拍委托', ev.def.name, '前往' + ev.def.destName + '，按 P 进拍照模式框住地标按空格交稿。', 4.8);
        }
      }
      return true;
    }
    function completeStreetEvent(ev, bonus = 0, bonusNote = '') {
      if (!ev) return null;
      const totalReward = ev.def.reward + bonus;
      progress.cash += totalReward;
      progress.eventsDone = (progress.eventsDone || 0) + 1;
      onSave();
      audio.start();
      audio.complete();
      say(ev.def.speaker, ev.def.completeLine, 6.4);
      const body = '酬劳 ' + cashText(totalReward) + (bonusNote ? '（' + bonusNote + '）' : '') + ' · 累计奇遇 ' + progress.eventsDone + ' 次';
      announce('奇遇委托达成', ev.def.name, body, 5.0);
      if (ev.def.kind === 'ride') {
        const dropSpot = findClearPersonSpot({ x: ev.destX, z: ev.destZ }, protagonist());
        eventNpc.x = dropSpot.x;
        eventNpc.z = dropSpot.z;
        eventNpc.yaw = dropSpot.yaw;
        eventNpc.elevation = world.surfaceHeight(dropSpot.x, dropSpot.z);
        ev.phase = 'farewell';
        ev.x = dropSpot.x;
        ev.z = dropSpot.z;
        ev.farewellUntil = state.clock + 5.5;
        eventBeacon.group.visible = false;
      } else {
        state.streetEvent = null;
        clearEventVisuals();
      }
      state.nextEventAt = state.clock + 30 + random() * 18;
      state.target = target();
      return { name: ev.def.name, reward: totalReward, bonus };
    }
    function failStreetEvent(ev, reason) {
      if (!ev) return;
      state.streetEvent = null;
      clearEventVisuals();
      state.nextEventAt = state.clock + 24 + random() * 14;
      state.target = target();
      audio.note();
      announce('街头奇遇结束', ev.def.name, reason, 4.0);
    }
    function stepStreetEvent(dt) {
      if (state.mode !== 'roam' || state.race?.active || showroom.active) return;
      if (!state.streetEvent) {
        if (!photo.active && !state.boat && !state.rest?.active && state.clock >= state.nextEventAt) spawnStreetEvent();
        return;
      }
      const ev = state.streetEvent;
      const p = protagonist();
      if (ev.phase === 'farewell') {
        eventNpc.waving = true;
        eventNpc.yaw = angleDiff(eventNpc.yaw + angleDiff(heading(ev, p), eventNpc.yaw) * clamp(dt * 4, 0, 1), 0);
        if (state.clock >= ev.farewellUntil) {
          state.streetEvent = null;
          clearEventVisuals();
        }
        return;
      }
      if (ev.phase === 'offered') {
        const d = distance(p, ev);
        eventNpc.waving = d < 34;
        if (d < 26) eventNpc.yaw = angleDiff(eventNpc.yaw + angleDiff(heading(ev, p), eventNpc.yaw) * clamp(dt * 4.5, 0, 1), 0);
        if (!ev.hailed && d < 46 && !photo.active) {
          ev.hailed = true;
          state.chatter = null;
          say(ev.def.speaker, ev.def.hailLine, 6.2);
          audio.note();
        }
        if (state.clock >= ev.expiresAt || d > 360) {
          state.streetEvent = null;
          clearEventVisuals();
          state.nextEventAt = state.clock + 24 + random() * 14;
        }
        return;
      }
      if (ev.phase === 'needCar') {
        const d = distance(p, ev);
        eventNpc.waving = d < 34;
        if (d < 26) eventNpc.yaw = angleDiff(eventNpc.yaw + angleDiff(heading(ev, p), eventNpc.yaw) * clamp(dt * 4.5, 0, 1), 0);
        if (state.vehicle && d < 13 && state.vehicle.speed < 8.5) {
          beginActiveStreetEvent(ev);
          audio.note();
          say(ev.def.speaker, ev.def.acceptLine, 5.6);
          announce('街头奇遇 · 顺风车', ev.def.name, '乘客已上车！平稳驶往' + ev.def.destName + '（奖励 ' + cashText(ev.def.reward) + '）。', 4.4);
          return;
        }
        if (state.clock >= ev.expiresAt || d > 220) {
          failStreetEvent(ev, '乘客久等没见到车，先沿着街边步行离开了。');
        }
        return;
      }
      if (ev.phase === 'active') {
        eventNpc.waving = false;
        if (ev.def.kind === 'courier') {
          const rem = ev.deadline - state.clock;
          if (distance(p, { x: ev.destX, z: ev.destZ }) < (state.vehicle ? 11.5 : 7.0)) {
            const fast = rem >= 18 ? ev.def.bonus : 0;
            completeStreetEvent(ev, fast, fast ? '热送加奖 +' + cashText(fast) : '');
          } else if (rem <= 0) {
            failStreetEvent(ev, '超出了热送时限，下次再帮老街坊搭把手吧。');
          }
        } else if (ev.def.kind === 'ride') {
          const rem = ev.deadline - state.clock;
          if (state.vehicle && distance(state.vehicle, { x: ev.destX, z: ev.destZ }) < 12.5 && state.vehicle.speed < 5.5) {
            const tip = ev.roughHits === 0 ? ev.def.bonus : 0;
            completeStreetEvent(ev, tip, tip ? '平稳护送小费 +' + cashText(tip) : '');
          } else if (rem <= 0) {
            failStreetEvent(ev, '超出约定时间，乘客在路边先下车赶路了。');
          }
        }
      }
    }

    function makeRaceGate(color, opacity = .86, scale = 1) {
      const group = new T.Group();
      const frameMat = new T.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, toneMapped: false });
      const fieldMat = new T.MeshBasicMaterial({
        color, transparent: true, opacity: opacity * .17, depthWrite: false,
        blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
      });
      const postGeo = new T.BoxGeometry(.36, 6.4, .36);
      const left = new T.Mesh(postGeo, frameMat);
      left.position.set(-5.4, 3.2, 0);
      const right = new T.Mesh(postGeo, frameMat);
      right.position.set(5.4, 3.2, 0);
      const bar = new T.Mesh(new T.BoxGeometry(11.16, .34, .36), frameMat);
      bar.position.set(0, 6.32, 0);
      const sill = new T.Mesh(new T.PlaneGeometry(10.8, .92).rotateX(-PI / 2), frameMat);
      sill.position.y = .09;
      const field = new T.Mesh(new T.PlaneGeometry(10.5, 6.1), fieldMat);
      field.position.y = 3.15;
      group.add(left, right, bar, sill, field);
      group.scale.setScalar(scale);
      group.visible = false;
      group.traverse(object => { object.layers.set(1); object.castShadow = false; object.receiveShadow = false; });
      scene.add(group);
      return { group, frameMat, fieldMat };
    }
    const raceActiveGate = makeRaceGate(raceMint, .92, 1);
    const racePreviewGate = makeRaceGate(seaBlue, .38, .92);
    const raceStartGate = makeRaceGate(raceGold, .72, .96);
    if (RACE?.length) {
      const startSpot = RACE[0];
      raceStartGate.group.position.set(startSpot.x, world.surfaceHeight(startSpot.x, startSpot.z), startSpot.z);
      raceStartGate.group.rotation.y = startSpot.yaw;
    }
    const lakeStartGate = makeRaceGate(seaBlue, .76, 1.15);
    if (LAKE_RACE_START) {
      lakeStartGate.group.position.set(LAKE_RACE_START.x, .06, LAKE_RACE_START.z);
      lakeStartGate.group.rotation.y = LAKE_RACE_START.yaw;
    }

    function protagonist() {
      return state.boat ?? state.vehicle ?? player;
    }
    function context() {
      if (state.rest?.active) return null;
      if (state.boat) {
        const boat = state.boat;
        const deck = marine.landing(boat);
        if (deck) {
          return boat.speed <= marine.stopSpeed
            ? { label: '下船 · ' + deck.name, kind: 'leaveBoat', deck }
            : { label: '减速靠泊', kind: 'brakeBoat', key: 'SPACE' };
        }
        if (state.mode === 'roam' && !state.race?.active && LAKE_RACE_START && distance(boat, LAKE_RACE_START) < 20) {
          return { label: '开始信安湖水上计时赛', kind: 'lakeRaceStart' };
        }
        return null;
      }
      const taxiContext = taxi.context();
      if (taxiContext) return taxiContext;
      if (state.mode === 'roam' && !state.race?.active && state.streetEvent?.phase === 'offered') {
        const ev = state.streetEvent;
        const p = protagonist();
        if (distance(p, ev) < (state.vehicle ? 8.8 : 5.8) && (!state.vehicle || state.vehicle.speed < 6.5)) {
          return { label: '接下奇遇 · ' + ev.def.name, shortLabel: '奇遇', kind: 'eventAccept', event: ev };
        }
      }
      if (distance(protagonist(), WORKSHOP) < 8.4 && (!state.vehicle || state.vehicle.speed < 3.2)) {
        return { label: '进入' + WORKSHOP.label, kind: 'workshop' };
      }
      if (state.mode === 'roam' && !state.race?.active && !state.boat && RACE?.length &&
          distance(protagonist(), RACE[0]) < 11 && (!state.vehicle || state.vehicle.speed < 7.5)) {
        return { label: '开始环古城计时赛', kind: 'raceStart' };
      }
      if (state.vehicle) {
        if (state.mode === 'taxi' && taxi.state.anim) return null;
        return state.vehicle.speed < 7 ? { label: '下车', kind: 'exit' } : null;
      }
      const boat = marine.boardable(player);
      if (boat) return { label: '上船 · ' + boat.name, kind: 'boardBoat', boat };
      if (state.mode === 'roam' && !state.race?.active && LAKE_RACE_START &&
          D.marineWalkable(player.x, player.z) && distance(player, LAKE_RACE_START) < 24) {
        return { label: '开始信安湖水上计时赛', kind: 'lakeRaceStart' };
      }
      if (STREET_SPOTS?.length) {
        let nearSpot = null;
        let spotGap = 5.0;
        for (const spot of STREET_SPOTS) {
          const d = distance(player, spot);
          if (d < spotGap) { spotGap = d; nearSpot = spot; }
        }
        if (nearSpot) {
          return { label: nearSpot.actionLabel, shortLabel: nearSpot.shortLabel, kind: 'streetSpot', spot: nearSpot };
        }
      }
      if (REST_SPOTS?.length && !state.race?.active) {
        let nearRest = null;
        let restGap = 4.6;
        for (const spot of REST_SPOTS) {
          const d = distance(player, spot);
          if (d < restGap) { restGap = d; nearRest = spot; }
        }
        if (nearRest) {
          return { label: '坐下小憩 · ' + nearRest.name, shortLabel: '小憩', kind: 'restSpot', spot: nearRest };
        }
      }
      let candidate = null;
      let gap = 5.15;
      queryCars(player.x, player.z, 6.0, car => {
        if (car.type === 'traffic' && car.speed > 3.75) return;
        const d = distance(car, player);
        if (d < gap && world.clearFraction(player.x, .85, player.z, car.x, .85, car.z, .20) === 1) {
          gap = d;
          candidate = car;
        }
      });
      if (!candidate) return null;
      return { label: (candidate.type === 'traffic' ? '接管 ' : '上车 · ') + candidate.model.name, kind: 'enter', car: candidate };
    }
    function tryExit(car) {
      const b = bodyBounds(car);
      for (const yaw of [car.yaw + PI / 2, car.yaw - PI / 2, car.yaw + PI, car.yaw]) {
        const step = offset(car, yaw, (yaw === car.yaw || yaw === car.yaw + PI) ? b.halfLength + .85 : b.halfWidth + 1.08);
        if (!clearForPerson(step.x, step.z, car) ||
            world.clearFraction(car.x, .68, car.z, step.x, .68, step.z, .39) < 1) continue;
        player.x = step.x;
        player.z = step.z;
        player.yaw = car.yaw;
        player.root.visible = true;
        state.vehicle = null;
        state.viewYaw = car.yaw;
        state.freeYaw = state.viewPitch = 0;
        car.type = 'parked';
        car.vx = car.vz = car.speed = car.pace = car.brake = car.reverseWait = car.turnSignal = 0;
        state.throttle = false;
        state.drift = 0;
        state.driftGrace = 0;
        return;
      }
      announce('车辆', '车门被挡住', '挪动车辆后可下车。', 2.1);
    }
    function handleInteraction(action = context()) {
      if (!action) return;
      if (taxi.handle(action)) return;
      switch (action.kind) {
        case 'boardBoat':
          state.boat = action.boat;
          state.freeYaw = state.viewPitch = 0;
          player.root.visible = false;
          audio.start();
          rainSound.start();
          audio.note();
          break;
        case 'leaveBoat': {
          const { boat } = state;
          const yaw = heading(boat, action.deck);
          player.x = action.deck.x;
          player.z = action.deck.z;
          player.yaw = state.viewYaw = yaw;
          player.walking = 0;
          player.root.visible = true;
          boat.speed = boat.vx = boat.vz = 0;
          boat.throttle = boat.brake = false;
          state.boat = null;
          state.freeYaw = state.viewPitch = 0;
          state.throttle = false;
          audio.note();
          break;
        }
        case 'workshop':
          return 'workshop';
        case 'raceStart':
          startRingRace();
          break;
        case 'lakeRaceStart':
          startLakeRace();
          break;
        case 'streetSpot':
          interactStreetSpot(action.spot);
          break;
        case 'restSpot':
          enterRestMode(action.spot);
          break;
        case 'eventAccept':
          acceptStreetEvent(action.event);
          break;
        case 'exit':
          tryExit(state.vehicle);
          break;
        case 'enter': {
          const car = action.car;
          if (car.type === 'traffic') {
            const cfg = progress.garage[car.model.kind];
            if (cfg) D.applyCarUpgrades3D?.(car, cfg, factory);
          }
          if (ROAD_KINDS.includes(car.model.kind) && progress.favoriteCar !== car.model.kind) {
            progress.favoriteCar = car.model.kind;
            onSave();
          }
          state.vehicle = car;
          car.type = 'player';
          car.turnSignal = 0;
          player.root.visible = false;
          state.freeYaw = state.viewPitch = 0;
          audio.start();
          rainSound.start();
          break;
        }
      }
    }
    const cashText = value => '¥' + Math.round(value).toLocaleString('zh-CN');
    function activeBuff() {
      if (!state.buff) return null;
      if (state.clock >= state.buff.expiresAt) {
        state.buff = null;
        return null;
      }
      return state.buff;
    }
    const REST_TIME_SCALES = [1, 15, 60];
    const REST_DISTRICT_POEMS = {
      '水亭门古街': '青砖城楼临水而立，看三街七巷檐灯渐次亮起。',
      '孔氏南宗家庙': '古柏森森红墙静谧，清风送来千年南孔礼韵。',
      '府山公园': '林荫轻摇鸟语隐约，钟灵塔影斜映翠色山坡。',
      '信安湖': '湖波轻漾天光入水，远山剪影随云影缓缓移步。',
      '马站底 · 上下街': '老街人声与炭炉香气交织，暂歇片刻尽赏古城烟火。',
    };
    function restPoemFor(point, kind) {
      if (kind === 'boat') return '画舫轻泊信安湖心，随波听水静观云卷云舒与灯塔流光。';
      const area = D.district(point);
      if (REST_DISTRICT_POEMS[area]) return REST_DISTRICT_POEMS[area];
      if (kind === 'car') return '暂熄引擎停靠老街一隅，在车窗光影里静观衢州古城四时流转。';
      return '暂歇脚步倚风而坐，在青石古巷与江风流云间独享片刻宁静。';
    }
    let restAmbientMuted = false;
    function ambientDef(id) {
      const list = REST_AMBIENTS || [];
      return list.find(item => item.id === id) || list.find(item => item.id === 'off') || { id: 'off', name: '氛围静音', desc: '关闭休憩白噪音，静听古城原生街景。' };
    }
    function pickRestAmbient(kind, spot, pos) {
      if (spot?.ambient) return spot.ambient;
      if (state.weather === 3 || state.rain > .35) return 'rain';
      if (kind === 'boat' || (pos?.x ?? 0) > 280) return 'lake';
      const area = D.district(pos || player);
      if (area === '孔氏南宗家庙' || area === '府山公园') return 'temple';
      if (area === '水亭门古街') return 'lake';
      return 'tea';
    }
    function enterRestMode(explicitSpot = null) {
      if (state.rest?.active) return true;
      if (state.race?.active) {
        announce('休息模式', '赛事进行中', '完成或按 Backspace 终止计时赛后再小憩。', 2.4);
        return false;
      }
      if (state.streetEvent && (state.streetEvent.phase === 'active' || state.streetEvent.phase === 'needCar')) {
        announce('休息模式', '奇遇进行中', '先完成或按 Backspace 取消当前街头奇遇后再休息。', 2.6);
        return false;
      }
      if (state.mode === 'taxi' && taxi.state.anim) return false;
      let kind = 'ground';
      let spot = null;
      let title = '';
      let poem = '';
      let savedPos = null;
      let orbitOffset = -.38;
      if (state.vehicle) {
        if (Math.abs(state.vehicle.speed) > 1.8) {
          announce('休息模式', '请先停稳车辆', '减速停稳后按 Z 即可在车内停车赏景。', 2.4);
          return false;
        }
        const car = state.vehicle;
        car.vx = car.vz = car.speed = car.pace = car.brake = car.reverseWait = car.turnSignal = 0;
        state.throttle = false;
        state.drift = state.driftGrace = 0;
        kind = 'car';
        title = '停车赏景 · ' + car.model.name;
        poem = restPoemFor(car, 'car');
        orbitOffset = .52;
        state.viewPitch = .06;
      } else if (state.boat) {
        if (Math.abs(state.boat.speed) > 1.8) {
          announce('休息模式', '请先停稳船艇', '按 SPACE 停稳船艇后按 Z 即可泛舟听水。', 2.4);
          return false;
        }
        const boat = state.boat;
        boat.vx = boat.vz = boat.speed = boat.steer = boat.trim = 0;
        boat.throttle = boat.brake = false;
        state.throttle = false;
        kind = 'boat';
        title = '泛舟听水 · ' + boat.name;
        poem = restPoemFor(boat, 'boat');
        orbitOffset = .48;
        state.viewPitch = .08;
      } else {
        spot = explicitSpot;
        if (!spot && REST_SPOTS?.length) {
          let bestGap = 6.5;
          for (const item of REST_SPOTS) {
            const d = distance(player, item);
            if (d < bestGap) { bestGap = d; spot = item; }
          }
        }
        if (spot) {
          kind = 'bench';
          savedPos = { x: spot.exitX, z: spot.exitZ, yaw: spot.yaw };
          player.x = spot.seatX;
          player.z = spot.seatZ;
          player.yaw = spot.yaw;
          player.vx = player.vz = player.walking = 0;
          player.sitting = true;
          player.sitHeight = spot.seatY ?? .49;
          player.sitHasBack = spot.style !== 'stone';
          state.viewYaw = spot.yaw;
          state.viewPitch = spot.camPitch ?? .06;
          title = spot.name;
          poem = spot.poem;
          orbitOffset = spot.camOrbit ?? -.24;
        } else {
          kind = 'ground';
          savedPos = { x: player.x, z: player.z, yaw: player.yaw };
          player.vx = player.vz = player.walking = 0;
          player.sitting = true;
          player.sitHeight = 0;
          player.sitHasBack = false;
          state.viewYaw = player.yaw;
          state.viewPitch = .05;
          title = D.district(player) + ' · 歇脚小憩';
          poem = restPoemFor(player, 'ground');
          orbitOffset = -.42;
        }
      }
      state.freeYaw = 0;
      state.chatter = null;
      const chosenAmbient = restAmbientMuted ? 'off' : pickRestAmbient(kind, spot, state.vehicle ?? state.boat ?? player);
      state.rest = {
        active: true, kind, spot, title, poem,
        startedAt: state.clock, savedPos,
        timeScale: 1, orbitOffset, uiHidden: false, restoredBuff: false, ambient: chosenAmbient,
      };
      state.lastLook = state.clock - 3.2;
      audio.start();
      audio.setAmbient?.(chosenAmbient);
      audio.templeChime?.();
      return true;
    }
    function exitRestMode(silent = false) {
      const rest = state.rest;
      if (!rest?.active) return false;
      stopRestVignette(false);
      state.rest = null;
      audio.setAmbient?.('off');
      if (rest.kind === 'bench' && rest.savedPos && !state.vehicle && !state.boat) {
        player.x = rest.savedPos.x;
        player.z = rest.savedPos.z;
        player.yaw = rest.savedPos.yaw;
      }
      player.sitting = false;
      player.sitHeight = 0;
      player.sitHasBack = false;
      player.vx = player.vz = player.walking = 0;
      if (!state.vehicle && !state.boat) {
        state.viewYaw = player.yaw;
        state.viewPitch = 0;
      } else {
        state.freeYaw = 0;
        state.viewPitch = 0;
      }
      if (!silent) audio.note();
      return true;
    }
    function toggleRestMode() {
      if (state.rest?.active) return exitRestMode(false);
      return enterRestMode(null);
    }
    function setRestTimeScale(scale) {
      if (!state.rest?.active) return false;
      const next = REST_TIME_SCALES.includes(Number(scale)) ? Number(scale) : 1;
      state.rest.timeScale = next;
      audio.note();
      return true;
    }
    function cycleRestTimeScale() {
      if (!state.rest?.active) return false;
      const idx = REST_TIME_SCALES.indexOf(state.rest.timeScale || 1);
      const next = REST_TIME_SCALES[(idx + 1) % REST_TIME_SCALES.length];
      state.rest.timeScale = next;
      audio.note();
      return true;
    }
    function toggleRestUi() {
      if (!state.rest?.active) return false;
      state.rest.uiHidden = !state.rest.uiHidden;
      return state.rest.uiHidden;
    }
    function setRestAmbient(id, announceChange = false) {
      if (!state.rest?.active) return false;
      const def = ambientDef(id);
      state.rest.ambient = def.id;
      restAmbientMuted = def.id === 'off';
      audio.start();
      audio.setAmbient?.(def.id);
      if (announceChange) {
        announce('休憩氛围音', def.name, def.desc, 2.2);
        audio.note();
      }
      return def.id;
    }
    function cycleRestAmbient() {
      if (!state.rest?.active) return false;
      const order = (REST_AMBIENTS || []).map(item => item.id);
      if (!order.length) return false;
      const idx = order.indexOf(state.rest.ambient || 'off');
      const nextId = order[(idx + 1) % order.length];
      return setRestAmbient(nextId, true);
    }
    function ambientStatus() {
      return {
        id: audio.getAmbient?.() ?? 'off',
        gain: audio.getAmbientGain?.() ?? 0,
        muted: restAmbientMuted,
      };
    }
    let lastVignetteBuffAt = -999;
    function vignetteScriptFor(rest, forcedKind = null) {
      const map = REST_VIGNETTES || {};
      if (!forcedKind && rest?.spot?.id && map[rest.spot.id]) return map[rest.spot.id];
      const area = D.district(player);
      const inferredKind = forcedKind || rest?.spot?.vignette || ((area === '水亭门古街' || area === '孔氏南宗家庙') ? 'opera' : 'tea');
      if (rest?.spot?.id && map[rest.spot.id] && map[rest.spot.id].kind === inferredKind) return map[rest.spot.id];
      return inferredKind === 'opera' ? map.default_opera : map.default_tea;
    }
    function clearVignetteProps() {
      vignetteNpc.root.visible = false;
      vignetteNpc.restAction = null;
      vignetteNpc.restActionBow = 0;
      vignetteNpc.visiblePace = 0;
      vignetteProps.teaTray.visible = false;
      vignetteProps.operaFan.visible = false;
      vignetteProps.operaStage.visible = false;
      vignetteProps.playerCup.visible = false;
      player.restAction = null;
    }
    function stopRestVignette(completed = false) {
      const v = state.rest?.vignette;
      clearVignetteProps();
      audio.stopVignetteAudio?.();
      if (!v) return false;
      if (state.rest) state.rest.vignette = null;
      if (completed && state.clock - lastVignetteBuffAt >= 30) {
        lastVignetteBuffAt = state.clock;
        const isTea = v.kind === 'tea';
        state.buff = isTea
          ? { id: 'tea_grace', name: '茶韵生津', icon: '❀', expiresAt: state.clock + 75, walkMult: 1.10, nitroRegenMult: 1.40, driftMult: 1.18, driftCashMult: 1 }
          : { id: 'opera_grace', name: '梨园余韵', icon: '♫', expiresAt: state.clock + 75, walkMult: 1.10, nitroRegenMult: 1.35, driftMult: 1.25, driftCashMult: 1 };
        audio.templeChime?.();
        announce(v.tag, state.buff.name,
          isTea ? '一盏清茗回甘，75 秒内步履轻盈、氮气回充 ×1.4。' : '一折古戏余韵绕梁，75 秒内漂移积分 ×1.25、步履生风。', 3.4);
      }
      return true;
    }
    function startRestVignette(forcedKind = null) {
      const rest = state.rest;
      if (!rest?.active || rest.kind === 'car' || rest.kind === 'boat') return false;
      const def = vignetteScriptFor(rest, forcedKind);
      if (!def) return false;
      const baseYaw = rest.spot ? rest.spot.yaw : player.yaw;
      const fx = Math.sin(baseYaw), fz = Math.cos(baseYaw);
      const rx = Math.cos(baseYaw), rz = -Math.sin(baseYaw);
      const baseY = world.surfaceHeight(player.x, player.z);
      const isGoodSpot = (x, z, radius = .36) => {
        if (world.blockedAt(x, z, radius)) return false;
        if (x > 330.5 || z > 318.5) return false;
        return Math.abs(world.surfaceHeight(x, z) - baseY) <= .35;
      };
      const fwdDist = def.kind === 'tea' ? 1.56 : 2.14;
      const latDist = def.kind === 'tea' ? .76 : .86;
      const candidates = [
        [1, fwdDist, latDist], [-1, fwdDist, latDist],
        [1, fwdDist * .86, latDist * .65], [-1, fwdDist * .86, latDist * .65],
        [1, 1.36, .32], [-1, 1.36, .32],
      ];
      let sideSign = 1;
      let targetPt = null;
      for (const [sign, fwd, lat] of candidates) {
        const cx = player.x + fx * fwd + rx * sign * lat;
        const cz = player.z + fz * fwd + rz * sign * lat;
        if (isGoodSpot(cx, cz)) {
          sideSign = sign;
          targetPt = { x: cx, z: cz };
          break;
        }
      }
      if (!targetPt) {
        targetPt = { x: player.x + fx * 1.28, z: player.z + fz * 1.28 };
      }
      const camBack = def.kind === 'tea' ? 2.75 : 3.25;
      const camLat = def.kind === 'tea' ? .85 : .95;
      const camAngle = def.kind === 'tea' ? 1.24 : 1.12;
      const camRayX = rest.spot ? rest.spot.exitX : player.x;
      const camRayZ = rest.spot ? rest.spot.exitZ : player.z;
      const camRayY = baseY + 1.52;
      const scoreCamSide = sign => {
        const cyaw = baseYaw + sign * camAngle;
        const cfx = Math.sin(cyaw), cfz = Math.cos(cyaw);
        const dx = player.x - cfx * camBack - cfz * (sign * camLat);
        const dz = player.z - cfz * camBack + cfx * (sign * camLat);
        let score = world.clearFraction(camRayX, camRayY, camRayZ, dx, baseY + 1.54, dz, .36);
        const camGround = world.surfaceHeight(dx, dz);
        const midGround = world.surfaceHeight((dx + player.x) * .5, (dz + player.z) * .5);
        if (camGround > baseY + .35 || midGround > baseY + .35) score -= 1.2;
        if (dx > 330.5 || dz > 318.5) score -= .6;
        return score;
      };
      const camScoreA = scoreCamSide(sideSign);
      const camScoreB = scoreCamSide(-sideSign);
      const camSide = camScoreB > camScoreA + .08 ? -sideSign : sideSign;
      let startPt = targetPt;
      if (def.kind === 'tea') {
        const farCand = { x: targetPt.x + rx * sideSign * 1.15 + fx * .55, z: targetPt.z + rz * sideSign * 1.15 + fz * .55 };
        const midCand = { x: targetPt.x + rx * sideSign * .65 + fx * .35, z: targetPt.z + rz * sideSign * .65 + fz * .35 };
        const fwdCand = { x: targetPt.x + fx * .52, z: targetPt.z + fz * .52 };
        startPt = isGoodSpot(farCand.x, farCand.z) ? farCand : isGoodSpot(midCand.x, midCand.z) ? midCand : isGoodSpot(fwdCand.x, fwdCand.z) ? fwdCand : targetPt;
      }
      vignetteNpc.x = startPt.x;
      vignetteNpc.z = startPt.z;
      vignetteNpc.elevation = world.surfaceHeight(startPt.x, startPt.z);
      vignetteNpc.yaw = heading(startPt, player);
      vignetteNpc.restAction = def.kind === 'tea' ? 'teaServe' : 'operaPerform';
      vignetteNpc.restActionStart = state.clock;
      vignetteNpc.restActionBow = 0;
      vignetteNpc.visiblePace = def.kind === 'tea' ? .75 : 0;
      vignetteNpc.root.visible = true;
      vignetteProps.teaTray.visible = def.kind === 'tea';
      vignetteProps.operaFan.visible = def.kind === 'opera';
      vignetteProps.playerCup.visible = false;
      if (def.kind === 'opera') {
        let sx = targetPt.x + rx * sideSign * .92 + fx * .28;
        let sz = targetPt.z + rz * sideSign * .92 + fz * .28;
        const stageCands = [
          [sideSign * .92, .28], [-sideSign * .92, .28], [sideSign * .78, .08], [-sideSign * .78, .08],
        ];
        for (const [slat, sfwd] of stageCands) {
          const cx = targetPt.x + rx * slat + fx * sfwd;
          const cz = targetPt.z + rz * slat + fz * sfwd;
          if (isGoodSpot(cx, cz, .28)) { sx = cx; sz = cz; break; }
        }
        vignetteProps.operaStage.position.set(sx, world.surfaceHeight(sx, sz) - .02, sz);
        vignetteProps.operaStage.rotation.y = heading({ x: sx, z: sz }, player);
        vignetteProps.operaStage.visible = true;
      } else {
        vignetteProps.operaStage.visible = false;
      }
      player.restAction = def.kind === 'opera' ? 'operaListen' : null;
      player.restActionStart = state.clock;
      player.restActionSide = sideSign;
      rest.vignette = {
        active: true, kind: def.kind, tag: def.tag, title: def.title, speaker: def.speaker,
        lines: def.lines, lineIndex: 0, startedAt: state.clock,
        duration: def.kind === 'tea' ? 13.5 : 14.5,
        sideSign, camSide, startX: startPt.x, startZ: startPt.z, targetX: targetPt.x, targetZ: targetPt.z,
      };
      state.lastLook = state.clock - 10;
      audio.start();
      audio.startVignetteAudio?.(def.kind);
      return true;
    }
    function toggleRestVignette(forcedKind = null) {
      const rest = state.rest;
      if (!rest?.active || rest.kind === 'car' || rest.kind === 'boat') return false;
      if (rest.vignette?.active) {
        if (forcedKind && rest.vignette.kind !== forcedKind) {
          stopRestVignette(false);
          return startRestVignette(forcedKind);
        }
        stopRestVignette(false);
        audio.note();
        return false;
      }
      return startRestVignette(forcedKind);
    }
    function stepRestVignette(dt) {
      const rest = state.rest;
      const v = rest?.vignette;
      if (!v?.active) return;
      const elapsed = state.clock - v.startedAt;
      if (elapsed >= v.duration) {
        stopRestVignette(true);
        return;
      }
      v.lineIndex = elapsed >= v.duration * .48 && v.lines.length > 1 ? 1 : 0;
      if (v.kind === 'tea') {
        const walkT = clamp(elapsed / 2.2, 0, 1);
        const ease = walkT * walkT * (3 - 2 * walkT);
        vignetteNpc.x = mix(v.startX, v.targetX, ease);
        vignetteNpc.z = mix(v.startZ, v.targetZ, ease);
        vignetteNpc.elevation = world.surfaceHeight(vignetteNpc.x, vignetteNpc.z);
        vignetteNpc.yaw = heading(vignetteNpc, player);
        vignetteNpc.visiblePace = walkT < .98 ? .78 : 0;
        const bowPhase = elapsed > 2.2 && elapsed < 7.2 ? Math.sin(clamp((elapsed - 2.2) / 5.0, 0, 1) * PI) : 0;
        vignetteNpc.restActionBow = bowPhase;
        vignetteProps.teaTray.position.set(0, 1.05 - .08 * bowPhase, .37 + .07 * bowPhase);
        vignetteProps.teaTray.rotation.x = .08 * bowPhase;
        for (const w of vignetteProps.steamWisps) {
          const cyc = (state.clock * .65 + w.phase) % 1;
          w.mesh.position.set(w.baseX + Math.sin(state.clock * 1.8 + w.phase) * .025, .13 + cyc * .24, w.baseZ);
          w.mesh.scale.setScalar(.6 + cyc * 1.25);
          w.mesh.material.opacity = .36 * Math.sin(cyc * PI);
        }
        if (elapsed >= 2.8) {
          if (player.restAction !== 'teaSip') {
            player.restAction = 'teaSip';
            player.restActionStart = state.clock;
          }
          const sipWave = Math.max(0, Math.sin((state.clock - player.restActionStart) * 1.15 - .35));
          const benchSit = (player.sitHeight ?? 0) > .25;
          const cupBaseY = benchSit ? (player.sitHeight + .45) : .64;
          vignetteProps.playerCup.visible = true;
          vignetteProps.playerCup.position.set(-.14 + .06 * sipWave, cupBaseY + .17 * sipWave, .34 - .08 * sipWave);
          vignetteProps.playerCup.rotation.x = -.22 * sipWave;
          const pCyc = (state.clock * .82) % 1;
          vignetteProps.playerCupWisp.position.y = .065 + pCyc * .16;
          vignetteProps.playerCupWisp.scale.setScalar(.55 + pCyc * 1.1);
          vignetteProps.playerCupWisp.material.opacity = .32 * Math.sin(pCyc * PI);
        }
      } else if (v.kind === 'opera') {
        vignetteNpc.x = v.targetX;
        vignetteNpc.z = v.targetZ;
        vignetteNpc.elevation = world.surfaceHeight(v.targetX, v.targetZ);
        vignetteNpc.yaw = heading(vignetteNpc, player);
        vignetteNpc.visiblePace = 0;
        const sweep = Math.sin(elapsed * 2.05);
        const sway = Math.sin(elapsed * 1.35);
        vignetteProps.operaFan.position.set(-.34 + .12 * sway, 1.38 + .14 * sweep, .33 + .09 * Math.cos(elapsed * 2.05));
        vignetteProps.operaFan.rotation.set(.18 * sweep, .38 * sway, -.26 - .42 * sweep);
        vignetteProps.lanternPivot.rotation.z = .08 * Math.sin(state.clock * 1.9);
        vignetteProps.lanternPivot.rotation.x = .05 * Math.cos(state.clock * 1.5);
        if (Math.random() < dt * 2.4) {
          factory.particlesAt(vignetteProps.operaStage.position.x, vignetteProps.operaStage.position.y + 1.28, vignetteProps.operaStage.position.z, 'spark', 1);
        }
      }
    }
    function resolveRestSpot(spotOrId) {
      if (!spotOrId) return null;
      if (typeof spotOrId === 'string') return REST_SPOTS?.find(item => item.id === spotOrId) || null;
      return spotOrId;
    }
    function setRestSpotTarget(spotOrId) {
      const spot = resolveRestSpot(spotOrId);
      if (!spot || state.mode === 'taxi' || state.race?.active) return false;
      return setLandmarkTarget({
        id: spot.id,
        kind: 'restSpot',
        name: spot.name,
        x: spot.exitX ?? spot.x,
        z: spot.exitZ ?? spot.z,
        desc: '已抵达' + spot.name + '，按 E 或 Z 坐下小憩。',
      });
    }
    function fastTravelToRestSpot(spotOrId) {
      const spot = resolveRestSpot(spotOrId);
      if (!spot || state.mode === 'taxi' || state.race?.active) return false;
      if (state.rest?.active) {
        if (state.rest.spot?.id === spot.id) {
          updateCamera(0, true);
          return true;
        }
        exitRestMode(true);
      }
      if (state.boat) {
        state.boat.speed = state.boat.vx = state.boat.vz = state.boat.steer = state.boat.trim = 0;
        state.boat.throttle = state.boat.brake = false;
        state.boat = null;
      }
      if (state.vehicle) {
        const prev = state.vehicle;
        prev.type = 'parked';
        prev.vx = prev.vz = prev.speed = prev.pace = prev.brake = prev.reverseWait = prev.turnSignal = 0;
        state.vehicle = null;
      }
      player.root.visible = true;
      state.landmarkGuide = null;
      state.tapeGuide = null;
      state.workshopGuide = false;
      cancelStreetEvent(true);
      state.freeYaw = 0;
      state.throttle = false;
      rebuildGrid(carGrid);
      state.target = target();
      if (!enterRestMode(spot)) return false;
      updateCamera(0, true);
      const amb = ambientDef(state.rest?.ambient);
      const detail = state.rest?.ambient && state.rest.ambient !== 'off'
        ? ('已直达落座 · 氛围音：' + amb.name)
        : '已直达观景长椅并落座小憩';
      announce('小憩直达', spot.name, detail, 3.6);
      return true;
    }
    function stepRest(dt, keys) {
      const rest = state.rest;
      if (!rest?.active) return;
      stepRestVignette(dt);
      const pan = Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'));
      if (pan) {
        rest.orbitOffset = angleDiff(rest.orbitOffset + pan * dt * 1.45, 0);
        state.lastLook = state.clock;
      }
      const elapsed = state.clock - rest.startedAt;
      if (!rest.restoredBuff && elapsed >= 4.0) {
        rest.restoredBuff = true;
        if (state.clock - state.lastRestBuffAt >= 45) {
          state.lastRestBuffAt = state.clock;
          if (state.vehicle) state.vehicle.nitro = 1;
          else {
            for (const car of carList) {
              if (car.type === 'parked' && distance(car, player) < 42) car.nitro = 1;
            }
          }
          state.buff = {
            id: 'serene', name: '心境澄明', icon: '☾',
            expiresAt: state.clock + 60,
            walkMult: 1.08, nitroRegenMult: 1.35, driftMult: 1.15, driftCashMult: 1,
          };
          audio.proximityPing?.();
          announce('小憩片刻', '心境澄明', '身心舒缓，60 秒内步履轻快、氮气回充加快。', 3.2);
        }
      }
      if (elapsed > .45) {
        const moveKey = pressed(keys, 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown');
        const stickMag = Math.hypot(keys.axisX ?? 0, keys.axisY ?? 0);
        if (moveKey || stickMag > .35) {
          exitRestMode(false);
          return;
        }
      }
      player.vx = player.vz = player.walking = 0;
      state.throttle = false;
      state.cameraBump = smooth(state.cameraBump, 0, 6, dt);
    }
    function interactStreetSpot(spot) {
      if (!spot) return false;
      audio.start();
      if (spot.kind === 'bell' && state.clock - state.lastBellRing < 3.5) {
        announce('衢州钟楼', '余韵未散', '稍候片刻再鸣古铜钟。', 2.0);
        return false;
      }
      if (spot.cost > 0 && progress.cash < spot.cost) {
        announce('古城烟火', '现金不足', '需 ' + cashText(spot.cost) + '，可甩尾、打卡或跑单赚取现金。', 2.8);
        return false;
      }
      if (spot.cost > 0) progress.cash -= spot.cost;
      const firstTime = !progress.spots.includes(spot.id);
      if (firstTime) {
        progress.spots.push(spot.id);
        if (spot.firstBonus) progress.cash += spot.firstBonus;
      }
      if (spot.cost > 0 || firstTime) onSave();
      if (spot.buff) {
        state.buff = { ...spot.buff, spotId: spot.id, expiresAt: state.clock + spot.buff.duration };
        const targets = [state.vehicle, ...garages].filter(Boolean);
        for (const car of targets) {
          if (spot.buff.fullNitro) { car.nitro = 1; car.impact = 0; }
          else if (spot.buff.nitroBoost) car.nitro = clamp((car.nitro ?? 1) + spot.buff.nitroBoost, 0, 1);
        }
      }
      if (spot.kind === 'bell') {
        state.lastBellRing = state.clock;
        audio.bellChime?.(3);
        if (!progress.reduceMotion) state.shake = Math.max(state.shake, .22);
        queryPeds(spot.x, spot.z, 36, ped => {
          if (ped.streetReaction || state.clock < (ped.escapeUntil ?? 0)) return;
          ped.bellLookYaw = heading(ped, spot);
          ped.bellLookUntil = state.clock + 3.2;
        });
      } else if (spot.kind === 'culture') {
        audio.templeChime?.();
      } else if (spot.kind === 'lantern') {
        releaseSkyLantern(player, player.yaw);
        audio.templeChime?.();
      } else {
        audio.streetSizzle?.();
      }
      const spokenLine = spot.kind === 'lantern'
        ? LANTERN_WISHES[(state.releasedLanternsCount - 1) % LANTERN_WISHES.length]
        : spot.line;
      say(spot.speaker, spokenLine, 6.2);
      const bonusNote = firstTime && spot.firstBonus ? ' · 首次奖励 +' + cashText(spot.firstBonus) : '';
      announce(spot.kind === 'food' ? '古城烟火' : spot.kind === 'lantern' ? '祈福放灯' : '南孔风物', spot.name, spot.toastBody + bonusNote, 4.2);
      return true;
    }
    function honkHorn() {
      const actor = state.boat ?? state.vehicle;
      if (!actor) return { sounded: false, kind: null, yielded: 0 };
      if (state.clock - state.lastHorn < .42) return { sounded: false, kind: state.boat ? 'boat' : actor.model?.kind, yielded: 0 };
      state.lastHorn = state.clock;
      state.hornUntil = state.clock + .55;
      const kind = state.boat ? 'boat' : (actor.model?.kind || 'sedan');
      audio.start();
      audio.horn?.(kind);
      let yielded = 0;
      if (state.vehicle) {
        const car = state.vehicle;
        const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
        queryPeds(car.x, car.z, 18, ped => {
          if (ped.streetReaction) return;
          const dx = ped.x - car.x, dz = ped.z - car.z;
          const dist = Math.hypot(dx, dz);
          const ahead = dx * fx + dz * fz;
          const side = dx * fz - dz * fx;
          if (dist < 7.5 || (ahead > -1.5 && ahead < 17.5 && Math.abs(side) < 7.5)) {
            const sideSign = side >= 0 ? 1 : -1;
            const awayX = fz * sideSign * 1.15 + (dist > .1 ? dx / dist : fx) * .45;
            const awayZ = -fx * sideSign * 1.15 + (dist > .1 ? dz / dist : fz) * .45;
            ped.escapeYaw = Math.atan2(awayX, awayZ);
            ped.escapeUntil = state.clock + 1.85;
            ped.idleUntil = 0;
            ped.bellLookUntil = 0;
            yielded++;
          }
        });
      }
      return { sounded: true, kind, yielded };
    }
    function toggleVehicleLights(car = state.vehicle) {
      if (!car) return null;
      const cur = car.manualLights || 'auto';
      const next = cur === 'auto' ? 'on' : cur === 'on' ? 'off' : 'auto';
      car.manualLights = next;
      audio.start();
      audio.note();
      const title = next === 'on' ? '车灯常亮' : next === 'off' ? '车灯关闭' : '车灯自动';
      const detail = next === 'on' ? '大灯与底盘灯已强制开启' : next === 'off' ? '已关闭大灯与底盘灯' : '将随古城昼夜光线自动切换';
      announce('车灯控制', title, detail, 2.2);
      return next;
    }
    function getGarageCar(kind) {
      if (kind === 'taxi') return taxi.ensureCar();
      return garageByKind[kind] ?? garages[0];
    }
    function applyGarageKind(kind, overrideConfig = null) {
      const cfg = overrideConfig ?? progress.garage[kind];
      if (!cfg) return;
      if (kind === 'taxi') {
        taxi.ensureCar();
        taxi.syncUpgrades(cfg);
      }
      for (const car of carList) {
        if (car.type === 'traffic' || car.ambientParked || car.model.kind !== kind || taxi.isTaxiCar(car)) continue;
        D.applyCarUpgrades3D?.(car, cfg, factory);
      }
    }
    function buyUpgrade(kind, categoryId) {
      const cfg = progress.garage[kind];
      const cat = D.UPGRADE_TREE?.find(entry => entry.id === categoryId);
      if (!cfg || !cat) return false;
      const current = cfg.levels[categoryId] ?? 0;
      const next = cat.levels[current + 1];
      if (!next || progress.cash < next.price) return false;
      progress.cash -= next.price;
      cfg.levels[categoryId] = current + 1;
      applyGarageKind(kind);
      onSave();
      audio.start();
      audio.upgrade?.();
      const carName = D.VEHICLE_META?.[kind]?.name ?? kind;
      announce('性能升级完成', carName + ' · ' + cat.name, 'Lv.' + (current + 1) + ' ' + next.name, 3.8);
      return true;
    }
    function selectVisual(kind, slot, itemId) {
      const cfg = progress.garage[kind];
      const list = D.VISUAL_CATALOG?.[slot];
      const item = list?.find(entry => entry.id === itemId);
      if (!cfg || !item) return false;
      const owned = cfg.owned[slot] ?? (cfg.owned[slot] = []);
      const isOwned = owned.includes(item.id) || item.price === 0;
      if (!isOwned) {
        if (progress.cash < item.price) return false;
        progress.cash -= item.price;
        owned.push(item.id);
        audio.start();
        audio.upgrade?.();
      } else {
        audio.start();
        audio.note();
      }
      cfg[slot] = item.id;
      applyGarageKind(kind);
      onSave();
      return true;
    }
    function findClearCarSpot(car, around, preferredYaw) {
      const near = D.nearestRoad(around.x, around.z);
      const baseYaw = Number.isFinite(preferredYaw) ? preferredYaw : (near?.edge?.yaw ?? 0);
      const candidates = [
        { x: around.x, z: around.z, yaw: baseYaw },
        { x: near.x, z: near.z, yaw: near?.edge?.yaw ?? baseYaw },
        { x: HUB.x, z: HUB.z, yaw: HUB.angle },
      ];
      for (const distStep of [5.2, 8.5, 12.5]) {
        for (let i = 0; i < 8; i++) {
          const ang = baseYaw + (i * PI) / 4;
          candidates.push({ x: near.x + Math.sin(ang) * distStep, z: near.z + Math.cos(ang) * distStep, yaw: baseYaw });
        }
      }
      for (const cand of candidates) {
        if (collisionAt(car, cand.x, cand.z, cand.yaw)) continue;
        if (carList.some(other => other !== car && carContact(car, other, cand.x, cand.z))) continue;
        return cand;
      }
      return { x: HUB.x, z: HUB.z, yaw: HUB.angle };
    }
    function summonVehicle(kind) {
      if (state.rest?.active) exitRestMode(true);
      const car = getGarageCar(kind);
      if (!car) return false;
      applyGarageKind(kind);
      if (ROAD_KINDS.includes(kind) && progress.favoriteCar !== kind) {
        progress.favoriteCar = kind;
        onSave();
      }
      const wasInTaxiMode = state.mode === 'taxi';
      if (wasInTaxiMode && kind !== 'taxi') {
        taxi.end();
        state.mode = 'roam';
      }
      const anchor = state.vehicle ?? state.boat ?? player;
      if (state.boat) {
        state.boat.speed = state.boat.vx = state.boat.vz = 0;
        state.boat.throttle = state.boat.brake = false;
        state.boat = null;
      }
      if (state.vehicle && state.vehicle !== car) {
        const prev = state.vehicle;
        prev.type = 'parked';
        prev.vx = prev.vz = prev.speed = prev.pace = prev.brake = prev.reverseWait = 0;
      }
      if (state.vehicle !== car) {
        const spot = findClearCarSpot(car, anchor, anchor.yaw);
        Object.assign(car, { x: spot.x, z: spot.z, yaw: spot.yaw, vx: 0, vz: 0, speed: 0, pace: 0, brake: false, reverseWait: 0, nitro: 1 });
        rebuildGrid(carGrid);
        state.vehicle = car;
        car.type = 'player';
        player.x = car.x;
        player.z = car.z;
        player.root.visible = false;
        state.viewYaw = car.yaw;
        state.freeYaw = state.viewPitch = 0;
      }
      state.target = target();
      if (!showroom.active) updateCamera(0, true);
      audio.start();
      audio.note();
      const meta = D.VEHICLE_META?.[kind];
      announce('座驾已唤出', meta?.name ?? car.model.name, '已就位并应用全部改装配置。', 3.4);
      return true;
    }
    function quickSummonVehicle() {
      if (state.mode === 'taxi') {
        if (state.vehicle) {
          announce('一键召车', '当前已在车内', '正在驾驶出租车营运中。', 2.4);
          audio.note();
          return false;
        }
        return summonVehicle('taxi');
      }
      if (state.vehicle) {
        announce('一键召车', '当前已在车内', '按 G 可打开改装工坊切换或升级其他座驾。', 2.4);
        audio.note();
        return false;
      }
      if (state.boat) {
        announce('一键召车', '正在水上航行', '请先驶回东岸码头下船后再召唤车辆。', 2.6);
        audio.note();
        return false;
      }
      if (D.islandAccess?.(player.x, player.z)) {
        announce('一键召车', '严家淤岛禁行机动车', '请乘游艇返回东岸码头，或在地图中快速传送回古城。', 3.4);
        audio.note();
        return false;
      }
      const fav = ROAD_KINDS.includes(progress.favoriteCar) ? progress.favoriteCar : 'coupe';
      return summonVehicle(fav);
    }
    function navigateWorkshop() {
      if (state.mode === 'taxi' || state.boat || state.race?.active) return false;
      state.workshopGuide = !state.workshopGuide;
      if (state.workshopGuide) {
        state.landmarkGuide = null;
        state.tapeGuide = null;
      }
      state.target = target();
      if (state.workshopGuide) {
        announce('改装工坊导航', WORKSHOP.label, '沿导航前往' + WORKSHOP.label + '，或随时按 G 直接打开。', 3.4);
        audio.note();
      }
      return true;
    }
    function setLandmarkTarget(landmark) {
      if (!landmark) {
        state.landmarkGuide = null;
        state.target = target();
        return true;
      }
      if (state.mode === 'taxi' || state.race?.active) return false;
      state.workshopGuide = false;
      state.tapeGuide = null;
      const isIsland = landmark.kind === 'island' || landmark.id === 'yanjiayu';
      state.landmarkGuide = {
        id: landmark.id || 'custom',
        kind: isIsland ? 'island' : (landmark.kind || 'spot'),
        x: landmark.navX ?? landmark.x,
        z: landmark.navZ ?? landmark.z,
        islandX: landmark.x,
        islandZ: landmark.z,
        label: landmark.name || '自定义目的地',
        desc: landmark.desc || '已抵达手绘舆图选定位置。',
        pierNotified: false,
        landmark: true,
      };
      state.target = target();
      announce('古城导览', state.landmarkGuide.label,
        isIsland ? '先沿导航至信安湖东岸码头，再换乘游艇横渡登岛。' : '已规划前往' + state.landmarkGuide.label + '的导航路线',
        isIsland ? 4.2 : 3.4);
      audio.note();
      return true;
    }
    function nearestUncollectedTape() {
      if (!TAPES?.length) return null;
      const p = protagonist();
      let best = null;
      let bestDist = Infinity;
      for (const tape of TAPES) {
        if (progress.tapes.includes(tape.id)) continue;
        const d = distance(p, tape);
        if (d < bestDist) {
          bestDist = d;
          best = tape;
        }
      }
      return best ? { tape: best, distance: bestDist } : null;
    }
    function setTapeTarget(tape) {
      if (!tape) {
        state.tapeGuide = null;
        state.target = target();
        return true;
      }
      if (state.mode === 'taxi' || state.race?.active) return false;
      state.workshopGuide = false;
      state.landmarkGuide = null;
      state.tapeGuide = {
        id: tape.id,
        x: tape.x,
        z: tape.z,
        name: tape.name,
        line: tape.line,
        label: '声景 · ' + tape.name,
        tape: true,
        marine: tape.x > 331,
      };
      state.target = target();
      announce('声景磁带导航', tape.name, '沿粉色指引前往收录（奖励 ¥80）', 3.4);
      audio.note();
      return true;
    }
    function startRingRace() {
      if (!RACE?.length) return false;
      if (state.rest?.active) exitRestMode(true);
      if (state.mode === 'taxi') {
        taxi.end();
        state.mode = 'roam';
      }
      state.landmarkGuide = null;
      state.tapeGuide = null;
      state.workshopGuide = false;
      cancelStreetEvent(true);
      if (state.boat) {
        state.boat.speed = state.boat.vx = state.boat.vz = 0;
        state.boat.throttle = state.boat.brake = false;
        state.boat = null;
      }
      const activeRoadCar = state.vehicle && ROAD_KINDS.includes(state.vehicle.model.kind) ? state.vehicle : null;
      const fav = ROAD_KINDS.includes(progress.favoriteCar) ? progress.favoriteCar : 'coupe';
      const car = activeRoadCar ?? getGarageCar(fav);
      if (!car) return false;
      applyGarageKind(car.model.kind);
      if (state.vehicle && state.vehicle !== car) {
        const prev = state.vehicle;
        prev.type = 'parked';
        prev.vx = prev.vz = prev.speed = prev.pace = prev.brake = prev.reverseWait = prev.turnSignal = 0;
      }
      const startGate = RACE[0];
      for (const other of carList) {
        if (other === car || distance(other, startGate) > 7.5) continue;
        if (other.type === 'traffic') {
          other.x -= Math.sin(startGate.yaw) * 14;
          other.z -= Math.cos(startGate.yaw) * 14;
        }
      }
      const startClear = !collisionAt(car, startGate.x, startGate.z, startGate.yaw);
      const spot = startClear ? { x: startGate.x, z: startGate.z, yaw: startGate.yaw } : findClearCarSpot(car, startGate, startGate.yaw);
      Object.assign(car, {
        x: spot.x, z: spot.z, yaw: spot.yaw,
        vx: 0, vz: 0, speed: 0, pace: 0, brake: false, reverseWait: 0, turnSignal: 0, nitro: 1,
      });
      state.vehicle = car;
      car.type = 'player';
      player.x = car.x;
      player.z = car.z;
      player.root.visible = false;
      state.viewYaw = car.yaw;
      state.freeYaw = state.viewPitch = 0;
      state.drift = 0;
      state.driftGrace = 0;
      state.race = {
        active: true,
        kind: 'ring',
        index: 0,
        total: RACE_ORDER.length,
        elapsed: 0,
        lastSplit: 0,
        bestBefore: progress.raceBest,
      };
      rebuildGrid(carGrid);
      state.target = target();
      updateCamera(0, true);
      audio.start();
      rainSound.start();
      audio.upgrade?.();
      announce('环古城计时赛开始', '9 道计时门 · 全长约 1.9 公里', '全氮气就绪！每穿一门回复 35% 氮气 · 金杯 ≤ 55 秒', 4.6);
      say('古城赛事广播', '起跑线绿灯亮起！沿府东街、劳动路、衢江中路与西安路全速疾驰，依次冲过九道计时门。', 6.5);
      return true;
    }
    function startLakeRace() {
      if (!LAKE_RACE?.length || !LAKE_RACE_START) return false;
      if (state.rest?.active) exitRestMode(true);
      if (state.mode === 'taxi') {
        taxi.end();
        state.mode = 'roam';
      }
      state.landmarkGuide = null;
      state.tapeGuide = null;
      state.workshopGuide = false;
      cancelStreetEvent(true);
      if (state.vehicle) {
        state.vehicle.type = 'parked';
        state.vehicle.vx = state.vehicle.vz = state.vehicle.speed = state.vehicle.pace = state.vehicle.brake = state.vehicle.reverseWait = state.vehicle.turnSignal = 0;
        state.vehicle = null;
      }
      const boat = marine.fleet.find(b => b.kind === 'sport') ?? marine.fleet[0];
      if (!boat) return false;
      Object.assign(boat, {
        x: LAKE_RACE_START.x, z: LAKE_RACE_START.z, yaw: LAKE_RACE_START.yaw,
        vx: 0, vz: 0, speed: 0, steer: 0, trim: 0, throttle: false, hit: 0, brake: false,
      });
      state.boat = boat;
      player.x = boat.x;
      player.z = boat.z;
      player.root.visible = false;
      state.viewYaw = boat.yaw;
      state.freeYaw = state.viewPitch = 0;
      state.drift = 0;
      state.driftGrace = 0;
      state.race = {
        active: true,
        kind: 'lake',
        index: 0,
        total: LAKE_RACE.length,
        elapsed: 0,
        lastSplit: 0,
        bestBefore: progress.lakeRaceBest,
      };
      state.target = target();
      updateCamera(0, true);
      audio.start();
      rainSound.start();
      audio.upgrade?.();
      announce('信安湖水上计时赛开始', '7 道水上浮标门 · 环严家淤岛', '驾驶衢江快艇绕岛全速疾驰 · 金杯 ≤ 48 秒', 4.6);
      say('信安湖航道广播', '绿旗挥落！驾驭衢江快艇冲出东岸航道，绕过严家淤灯塔后全速冲回东岸码头。', 6.5);
      return true;
    }
    function cancelRingRace(silent = false) {
      if (!state.race?.active) return false;
      const wasLake = state.race.kind === 'lake';
      state.race = null;
      state.target = target();
      if (!silent) {
        announce(wasLake ? '信安湖水上计时赛' : '环古城计时赛', '已终止当前计时',
          wasLake ? '随时回到东岸航道浮标门或手绘舆图再次发起挑战。' : '随时回到府东街起跑门或手绘舆图再次发起挑战。', 3.0);
        audio.note();
      }
      return true;
    }
    function stepRingRace(dt) {
      const race = state.race;
      if (!race?.active) return;
      race.elapsed += dt;
      if (race.kind === 'lake') {
        if (!LAKE_RACE?.length || !state.boat) return;
        const gate = LAKE_RACE[race.index];
        if (!gate || distance(state.boat, gate) >= 15.5) return;
        const fx = Math.sin(state.boat.yaw), fz = Math.cos(state.boat.yaw);
        state.boat.vx += fx * 3.0;
        state.boat.vz += fz * 3.0;
        state.boat.speed = Math.hypot(state.boat.vx, state.boat.vz);
        factory.particlesAt(state.boat.x, .85, state.boat.z, 'superboost', 14);
        race.index++;
        race.lastSplit = race.elapsed;
        if (race.index >= LAKE_RACE.length) {
          const time = Math.round(race.elapsed * 100) / 100;
          const medal = time <= 48 ? '金杯' : time <= 62 ? '银杯' : '铜杯';
          const isBest = !progress.lakeRaceBest || time < progress.lakeRaceBest;
          if (isBest) progress.lakeRaceBest = time;
          const bestBonus = isBest ? 100 : 0;
          const goldBonus = time <= 48 ? 100 : 0;
          const reward = 200 + bestBonus + goldBonus;
          progress.cash += reward;
          onSave();
          state.race = null;
          state.target = target();
          audio.complete();
          factory.particlesAt(state.boat.x, 1.4, state.boat.z, 'spark', 24);
          const extra = (isBest ? ' · 新纪录 +¥100' : '') + (goldBonus ? ' · 金杯 +¥100' : '');
          announce('信安湖水上赛完赛', medal + ' · ' + time.toFixed(2) + ' 秒', '奖金 ' + cashText(reward) + extra, 6.5);
          say('信安湖航道广播', '精彩冲线！用时 ' + time.toFixed(2) + ' 秒拿下水上' + medal + '，' + (isBest ? '刷新信安湖环岛最佳纪录！' : '调整过弯切线还能再创佳绩！'), 7.2);
          return;
        }
        audio.note();
        const nextGate = LAKE_RACE[race.index];
        const isFinal = race.index === LAKE_RACE.length - 1;
        announce('浮标门 ' + race.index + ' / ' + LAKE_RACE.length,
          (isFinal ? '水上终点 · ' : '下一浮标 · ') + nextGate.street,
          '用时 ' + race.elapsed.toFixed(1) + ' 秒 · 浪涌加速', 2.2);
        return;
      }
      if (!RACE?.length || !state.vehicle) return;
      const gate = RACE[RACE_ORDER[race.index]];
      if (!gate || distance(state.vehicle, gate) >= 10.8) return;
      state.vehicle.nitro = clamp(state.vehicle.nitro + .35, 0, 1);
      factory.particlesAt(state.vehicle.x, 1.05, state.vehicle.z, 'superboost', 14);
      race.index++;
      race.lastSplit = race.elapsed;
      if (race.index >= RACE_ORDER.length) {
        const time = Math.round(race.elapsed * 100) / 100;
        const medal = time <= 55 ? '金杯' : time <= 72 ? '银杯' : '铜杯';
        const isBest = !progress.raceBest || time < progress.raceBest;
        if (isBest) progress.raceBest = time;
        const bestBonus = isBest ? 120 : 0;
        const goldBonus = time <= 55 ? 100 : 0;
        const reward = 220 + bestBonus + goldBonus;
        progress.cash += reward;
        onSave();
        state.race = null;
        state.target = target();
        audio.complete();
        factory.particlesAt(state.vehicle.x, 1.5, state.vehicle.z, 'spark', 24);
        const extra = (isBest ? ' · 新纪录 +¥120' : '') + (goldBonus ? ' · 金杯 +¥100' : '');
        announce('环古城计时赛完赛', medal + ' · ' + time.toFixed(2) + ' 秒', '奖金 ' + cashText(reward) + extra, 6.5);
        say('古城赛事广播', '漂亮冲线！用时 ' + time.toFixed(2) + ' 秒拿下' + medal + '，' + (isBest ? '刷新环古城个人最佳纪录！' : '去府东街改装工坊升级动力还能再破纪录！'), 7.2);
        return;
      }
      audio.note();
      const nextGate = RACE[RACE_ORDER[race.index]];
      const isFinal = race.index === RACE_ORDER.length - 1;
      announce('计时门 ' + race.index + ' / ' + RACE_ORDER.length,
        (isFinal ? '冲刺终点 · ' : '下一门 · ') + nextGate.street,
        '用时 ' + race.elapsed.toFixed(1) + ' 秒 · 氮气 +35%', 2.2);
    }
    function findClearPersonSpot(around, lookAt) {
      const near = D.nearestRoad(around.x, around.z);
      const baseYaw = lookAt ? heading(around, lookAt) : (near?.edge?.yaw ?? 0);
      const candidates = [{ x: around.x, z: around.z }];
      if (near) candidates.push({ x: near.x, z: near.z });
      for (const stepDist of [2.5, 4.5, 7.5]) {
        for (let i = 0; i < 8; i++) {
          const ang = baseYaw + (i * PI) / 4;
          candidates.push({ x: around.x + Math.sin(ang) * stepDist, z: around.z + Math.cos(ang) * stepDist });
        }
      }
      for (const cand of candidates) {
        if (clearForPerson(cand.x, cand.z)) return { x: cand.x, z: cand.z, yaw: lookAt ? heading(cand, lookAt) : baseYaw };
      }
      return { x: near?.x ?? HUB.x, z: near?.z ?? HUB.z, yaw: baseYaw };
    }
    function fastTravelToLandmark(landmark) {
      if (state.rest?.active) exitRestMode(true);
      if (!landmark || state.mode === 'taxi' || state.race?.active || !progress.visitedLandmarks.includes(landmark.id)) return false;
      const isIsland = landmark.kind === 'island' || landmark.id === 'yanjiayu';
      if (state.boat) {
        state.boat.speed = state.boat.vx = state.boat.vz = 0;
        state.boat.throttle = state.boat.brake = false;
        state.boat = null;
      }
      if (isIsland) {
        if (state.vehicle) {
          const prev = state.vehicle;
          prev.type = 'parked';
          prev.vx = prev.vz = prev.speed = prev.pace = prev.brake = prev.reverseWait = prev.turnSignal = 0;
          state.vehicle = null;
        }
        player.x = MARINE.islandLanding.x;
        player.z = MARINE.islandLanding.z;
        player.yaw = PI / 2;
        player.vx = player.vz = player.walking = 0;
        player.root.visible = true;
        state.viewYaw = PI / 2;
        const ferry = marine.fleet[0];
        if (ferry) {
          Object.assign(ferry, MARINE.islandBerth, { speed: 0, vx: 0, vz: 0, steer: 0, trim: 0, throttle: false, brake: false });
        }
      } else {
        const dest = { x: landmark.navX ?? landmark.x, z: landmark.navZ ?? landmark.z };
        if (state.vehicle) {
          const car = state.vehicle;
          const spot = findClearCarSpot(car, dest, heading(dest, landmark));
          Object.assign(car, { x: spot.x, z: spot.z, yaw: spot.yaw, vx: 0, vz: 0, speed: 0, pace: 0, brake: false, reverseWait: 0 });
          player.x = car.x;
          player.z = car.z;
          player.root.visible = false;
          state.viewYaw = car.yaw;
        } else {
          const spot = findClearPersonSpot(dest, landmark);
          player.x = spot.x;
          player.z = spot.z;
          player.yaw = spot.yaw;
          player.vx = player.vz = player.walking = 0;
          player.root.visible = true;
          state.viewYaw = spot.yaw;
        }
      }
      state.landmarkGuide = null;
      state.tapeGuide = null;
      state.workshopGuide = false;
      cancelStreetEvent(true);
      state.freeYaw = state.viewPitch = 0;
      state.throttle = false;
      rebuildGrid(carGrid);
      state.target = target();
      updateCamera(0, true);
      audio.start();
      audio.note();
      announce('快速传送', landmark.name, landmark.desc || '已传送至' + landmark.name, 4.0);
      return true;
    }
    function nearestUnvisitedLandmark() {
      if (!Y?.LANDMARKS?.length) return null;
      const p = protagonist();
      let best = null;
      let bestDist = Infinity;
      for (const lm of Y.LANDMARKS) {
        if (progress.visitedLandmarks.includes(lm.id)) continue;
        const pt = lm.kind === 'island' ? lm : { x: lm.navX ?? lm.x, z: lm.navZ ?? lm.z };
        const d = distance(p, pt);
        if (d < bestDist) {
          bestDist = d;
          best = lm;
        }
      }
      return best ? { landmark: best, distance: bestDist } : null;
    }
    function navigateNearestUnvisited() {
      if (state.mode === 'taxi' || state.race?.active) return false;
      const found = nearestUnvisitedLandmark();
      if (found) return setLandmarkTarget(found.landmark);
      const foundTape = nearestUncollectedTape();
      if (foundTape) return setTapeTarget(foundTape.tape);
      announce('古城探索全达成', '八景与声景磁带已全部收集', '按 M 打开舆图可快速传送地标或发起环古城计时赛。', 3.8);
      audio.note();
      return false;
    }
    function target() {
      if (state.mode === 'taxi') {
        const taxiTarget = taxi.target();
        if (taxiTarget) {
          taxiTarget.taxi = true;
          return taxiTarget;
        }
        return null;
      }
      if (state.race?.active) {
        if (state.race.kind === 'lake' && LAKE_RACE?.length) {
          const gate = LAKE_RACE[state.race.index];
          if (gate) {
            const isFinal = state.race.index === LAKE_RACE.length - 1;
            return {
              x: gate.x, z: gate.z,
              label: isFinal ? '水上终点 · ' + gate.street : '浮标门 ' + (state.race.index + 1) + '/' + LAKE_RACE.length + ' · ' + gate.street,
              race: true, lakeRace: true, water: true, marine: true, finalGate: isFinal, gate: true,
            };
          }
        }
        if (RACE?.length) {
        const gate = RACE[RACE_ORDER[state.race.index]];
        if (gate) {
          const isFinal = state.race.index === RACE_ORDER.length - 1;
          return {
            x: gate.x, z: gate.z,
            label: isFinal ? '终点冲线 · ' + gate.street : '计时门 ' + (state.race.index + 1) + '/' + RACE_ORDER.length + ' · ' + gate.street,
            race: true, finalGate: isFinal, gate: true,
          };
        }
        }
      }
      if (state.streetEvent?.phase === 'active') {
        return {
          x: state.streetEvent.destX, z: state.streetEvent.destZ,
          label: state.streetEvent.def.destName, streetEvent: true, eventKind: state.streetEvent.def.kind,
        };
      }
      if (state.streetEvent?.phase === 'needCar') {
        return {
          x: state.streetEvent.x, z: state.streetEvent.z,
          label: '带乘客出发 · ' + state.streetEvent.def.name, streetEvent: true, eventKind: 'ride',
        };
      }
      if (state.workshopGuide) return WORKSHOP;
      if (state.tapeGuide) return state.tapeGuide;
      if (state.landmarkGuide) {
        if (state.landmarkGuide.kind === 'island') {
          const p = protagonist();
          if (!state.boat && D.islandAccess?.(p.x, p.z)) {
            return {
              x: state.landmarkGuide.islandX, z: state.landmarkGuide.islandZ,
              label: state.landmarkGuide.label, marine: true, landmark: true, stage: 'onIsland',
            };
          }
          if (state.boat) {
            const docked = marine.landing(state.boat)?.name === '严家淤岛码头';
            return {
              x: MARINE.islandBerth.x, z: MARINE.islandBerth.z,
              label: docked ? '按 E 下船登严家淤岛' : '严家淤岛码头 · 减速靠泊',
              marine: true, water: true, landmark: true, stage: docked ? 'disembarkIsland' : 'sailToIsland',
            };
          }
          if (!state.vehicle && D.marineWalkable?.(p.x, p.z) && p.x < 420) {
            const boat = marine.suggestedBoat(player) ?? MARINE.launch;
            return {
              x: boat.x, z: boat.z,
              label: '登船 · ' + (boat.name || '信安湖游艇'),
              marine: true, boarding: true, water: true, landmark: true, stage: 'boardBoat',
            };
          }
          return {
            x: MARINE.job.x, z: MARINE.job.z,
            label: '东岸码头 · 乘艇前往严家淤岛',
            marine: true, boarding: true, landmark: true, stage: 'toPier',
          };
        }
        return state.landmarkGuide;
      }
      return null;
    }
    function checkExploration() {
      if (state.race?.active) return;
      const p = protagonist();
      if (state.workshopGuide && distance(p, WORKSHOP) < 14) {
        state.workshopGuide = false;
        state.target = target();
        announce('已抵达改装工坊', WORKSHOP.label, '按 E 或 G 打开车辆升级与外观定制。', 4.0);
        audio.note();
      }
      if (state.landmarkGuide) {
        const lm = state.landmarkGuide;
        if (lm.kind === 'island') {
          if (!state.boat && D.islandAccess?.(p.x, p.z)) {
            state.landmarkGuide = null;
            state.target = target();
            if (progress.visitedLandmarks.includes(lm.id)) {
              announce('已抵达地标', lm.label, lm.desc || '欢迎游览严家淤岛与湖心灯塔', 4.4);
              audio.note();
            }
          } else if (!state.boat && !lm.pierNotified && distance(p, MARINE.job) < 22) {
            lm.pierNotified = true;
            announce('已抵达东岸码头', '换乘游艇前往严家淤岛', '停车下车走上栈桥，靠近游艇按 E 登船横渡信安湖。', 4.8);
            audio.note();
          }
        } else if (distance(p, lm) < 20) {
          state.landmarkGuide = null;
          state.target = target();
          announce('已抵达地标', lm.label, lm.desc || '欢迎游览衢州古城地标', 4.2);
          audio.note();
        }
      }
      if (Y?.LANDMARKS?.length) {
        for (const lm of Y.LANDMARKS) {
          if (progress.visitedLandmarks.includes(lm.id)) continue;
          const isIsland = lm.kind === 'island' || lm.id === 'yanjiayu';
          const reached = isIsland
            ? (!state.boat && Boolean(D.islandAccess?.(p.x, p.z)))
            : (distance(p, { x: lm.navX ?? lm.x, z: lm.navZ ?? lm.z }) < 26 || distance(p, lm) < 26);
          if (reached) {
            progress.visitedLandmarks.push(lm.id);
            const completedAll = progress.visitedLandmarks.length === Y.LANDMARKS.length;
            progress.cash += completedAll ? 650 : 150;
            onSave();
            audio.complete();
            if (completedAll) {
              announce('古城八景全打卡', lm.name, '首访 ¥150 + 全景奖励 ¥500 · 全部地标已解锁快速传送！', 6.8);
            } else {
              announce('古城探索打卡', lm.name, '首访奖励 ¥150 · 已解锁快速传送 (' + progress.visitedLandmarks.length + ' / ' + Y.LANDMARKS.length + ')', 5.2);
            }
            if (lm.desc) say(guideVoice, lm.name + '：' + lm.desc, 7.6);
            break;
          }
        }
      }
      if (state.mode === 'roam' && !state.boat && TAPES?.length) {
        const pickupRadius = state.vehicle ? 4.8 : 3.6;
        for (const item of tapeProps) {
          const tape = item.tape;
          if (progress.tapes.includes(tape.id)) continue;
          if (distance(p, tape) < pickupRadius) {
            progress.tapes.push(tape.id);
            const completedAll = progress.tapes.length === TAPES.length;
            progress.cash += completedAll ? 680 : 80;
            onSave();
            if (state.tapeGuide?.id === tape.id) {
              state.tapeGuide = null;
              state.target = target();
            }
            factory.particlesAt(tape.x, item.baseY + 1.15, tape.z, 'spark', 18);
            factory.particlesAt(tape.x, item.baseY + 1.35, tape.z, 'superboost', 10);
            audio.start();
            if (completedAll) audio.complete();
            else audio.upgrade?.();
            audio.playTapePreview?.(tape.id);
            if (completedAll) {
              announce('古城声景全收集', tape.name, '全部 ' + TAPES.length + ' 卷收录达成 · 奖金 ¥680！', 6.4);
            } else {
              announce('声景磁带收录', tape.name, '奖励 ¥80 · 已收集 ' + progress.tapes.length + ' / ' + TAPES.length, 4.6);
            }
            say('古城声景磁带', '「' + tape.name + '」' + tape.line, 7.2);
            break;
          }
        }
        if (!state.race?.active && !state.playingTape && state.clock >= state.nextTapePing) {
          const nearTape = nearestUncollectedTape();
          if (nearTape && nearTape.distance < 30 && nearTape.distance >= pickupRadius) {
            audio.proximityPing?.();
            state.nextTapePing = state.clock + 3.2;
          }
        }
      }
    }
    function playTape(id) {
      const tape = TAPES?.find(item => item.id === id);
      if (!tape || !progress.tapes.includes(tape.id)) return false;
      audio.start();
      state.station = '';
      state.playingTape = { id: tape.id, name: tape.name, line: tape.line };
      audio.playTape?.(tape.id);
      announce('声景随身听', '正在播放 · ' + tape.name, tape.line, 3.2);
      return true;
    }
    function stopTape(silent = false) {
      if (!state.playingTape) return false;
      state.playingTape = null;
      audio.stopTape?.();
      if (!silent) announce('声景随身听', '已停止播放', '按 T 随时切换已收录声景磁带，或在手绘舆图点播。', 2.2);
      return true;
    }
    function cycleCollectedTape() {
      if (!progress.tapes.length) {
        announce('声景随身听', '尚未收录声景磁带', '按 F 或打开手绘舆图寻找粉色磁带，收录后即可随时播放。', 3.0);
        return null;
      }
      if (!state.playingTape) {
        playTape(progress.tapes[0]);
        return state.playingTape;
      }
      const idx = progress.tapes.indexOf(state.playingTape.id);
      if (idx < 0 || idx >= progress.tapes.length - 1) {
        stopTape();
        return null;
      }
      playTape(progress.tapes[idx + 1]);
      return state.playingTape;
    }
    function navigatePhotoSpot(spot) {
      if (!spot || !Y?.LANDMARKS) return false;
      const lm = Y.LANDMARKS.find(item => item.id === spot.landmarkId);
      if (!lm) return false;
      const ok = setLandmarkTarget(lm);
      if (ok) announce('明信片取景导航', spot.name, spot.tip + '（到附近按 P 拍照打卡）', 4.4);
      return ok;
    }
    function switchMode(nextMode) {
      const mode = nextMode === 'taxi' ? 'taxi' : 'roam';
      if (state.mode === mode && state.active) return false;
      if (state.rest?.active) exitRestMode(true);
      state.mode = mode;
      state.landmarkGuide = null;
      state.tapeGuide = null;
      state.race = null;
      state.workshopGuide = false;
      cancelStreetEvent(true);
      if (mode === 'taxi') {
        if (state.boat) {
          state.boat.speed = state.boat.vx = state.boat.vz = 0;
          state.boat = null;
        }
        if (state.vehicle && !taxi.isTaxiCar(state.vehicle)) {
          state.vehicle.type = 'parked';
          state.vehicle = null;
          player.root.visible = true;
        }
        const spot = taxi.begin();
        if (!state.vehicle && spot) {
          Object.assign(player, spot);
          state.viewYaw = spot.yaw;
          updateCamera(0, true);
        }
        say('衢州出租调度', '已切换至出租车营运模式，按导航前往接送乘客，按 G 随时改装升级。', 6.4);
      } else {
        taxi.end();
        announce('自由探索模式', '衢州古城自由巡游', '按 M 打开舆图导航地标打卡，按 G 打开改装工坊。', 4.0);
        say(guideVoice, '已切回自由探索模式，可驾车巡游古城八景或随时按 G 调校升级爱车。', 6.0);
      }
      state.target = target();
      return true;
    }
    function setShowroom(active, kind = null, opts = {}) {
      if (active) {
        if (state.rest?.active) exitRestMode(true);
        if (!showroom.active) {
          showroom.savedHour = state.hour;
        }
        showroom.active = true;
        if (kind) showroom.kind = kind;
        else if (state.vehicle) showroom.kind = state.vehicle.model.kind;
        else if (state.mode === 'taxi') showroom.kind = 'taxi';
        else showroom.kind = showroom.kind || 'taxi';
        if (opts.resetAngle) {
          showroom.yaw = .68;
          showroom.pitch = .23;
          showroom.distance = 5.7;
        }
        for (const car of carList) car.showroomLit = false;
        const showcase = getGarageCar(showroom.kind);
        showroom.car = showcase;
        if (showcase) {
          showcase.showroomLit = true;
          showcase.concept?.useDetail?.(true);
          applyGarageKind(showroom.kind);
        }
        renderShowroom(0);
      } else {
        if (!showroom.active) return;
        showroom.active = false;
        showroom.dragging = false;
        for (const car of carList) car.showroomLit = false;
        showroom.car = null;
        if (showroom.savedHour != null) {
          state.hour = showroom.savedHour;
          showroom.savedHour = null;
        }
        camera.fov = 57;
        camera.updateProjectionMatrix();
        updateCamera(0, true);
        render(0);
      }
    }
    function orbitShowroom(dx, dy, dragging = false) {
      if (!showroom.active) return;
      showroom.dragging = dragging;
      showroom.yaw = angleDiff(showroom.yaw + dx, 0);
      showroom.pitch = clamp(showroom.pitch + dy, .07, .66);
    }
    function zoomShowroom(delta) {
      if (!showroom.active) return;
      showroom.distance = clamp(showroom.distance + delta, 4.1, 8.2);
    }
    function setShowroomNight(on) {
      showroom.night = Boolean(on);
      if (showroom.active) renderShowroom(0);
    }
    function resetPhotoCamera() {
      const p = protagonist();
      const ground = state.boat ? 0 : world.surfaceHeight(p.x, p.z);
      photo.targetX = p.x;
      photo.targetY = ground + (state.vehicle ? 1.15 : state.boat ? 1.25 : player.sitting ? .92 : 1.35);
      photo.targetZ = p.z;
      const baseYaw = state.rest?.active
        ? ((state.rest.spot?.yaw ?? (state.vehicle || state.boat ? (state.vehicle ?? state.boat).yaw : player.yaw)) + (state.rest.orbitOffset || 0))
        : (state.viewYaw + (state.vehicle || state.boat ? state.freeYaw : 0));
      photo.yaw = angleDiff(baseYaw + .52, 0);
      photo.pitch = .22;
      photo.distance = state.vehicle ? 8.2 : state.boat ? 11.5 : player.sitting ? 4.4 : 5.6;
      photo.fov = 50;
    }
    function findPhotoFocusCar() {
      if (state.vehicle) return state.vehicle;
      const p = protagonist();
      let best = null, bestD = 28;
      for (const car of carList) {
        const d = distance(p, car);
        if (d < bestD) { bestD = d; best = car; }
      }
      return best;
    }
    function setPhotoCarLights(mode = 'auto') {
      const valid = mode === 'on' || mode === 'off' ? mode : 'auto';
      photo.carLights = valid;
      if (!photo.active) return valid;
      const p = protagonist();
      photo.focusCar = findPhotoFocusCar();
      for (const car of carList) {
        const isTarget = car === state.vehicle || car === photo.focusCar || distance(p, car) < 28;
        car.photoLit = isTarget && valid !== 'auto' ? valid : null;
      }
      renderPhoto(0, null);
      return valid;
    }
    function setPhotoMode(active) {
      if (active) {
        if (showroom.active) return false;
        if (!photo.active) {
          photo.savedHour = state.hour;
          photo.savedWeather = state.weather;
          photo.savedRain = state.rain;
          photo.savedWetness = state.wetness;
          photo.savedMist = state.mist;
          photo.savedFov = camera.fov;
        }
        photo.active = true;
        photo.dragging = false;
        photo.carLights = 'auto';
        photo.focusCar = findPhotoFocusCar();
        for (const car of carList) car.photoLit = null;
        resetPhotoCamera();
        renderPhoto(0, null);
        return true;
      }
      if (!photo.active) return false;
      photo.active = false;
      photo.dragging = false;
      photo.carLights = 'auto';
      photo.focusCar = null;
      for (const car of carList) car.photoLit = null;
      if (photo.savedHour != null) { state.hour = photo.savedHour; photo.savedHour = null; }
      if (photo.savedWeather != null) { state.weather = photo.savedWeather; photo.savedWeather = null; }
      if (photo.savedRain != null) { state.rain = photo.savedRain; photo.savedRain = null; }
      if (photo.savedWetness != null) { state.wetness = photo.savedWetness; photo.savedWetness = null; }
      if (photo.savedMist != null) { state.mist = photo.savedMist; photo.savedMist = null; }
      camera.fov = photo.savedFov || 57;
      camera.updateProjectionMatrix();
      updateCamera(0, true);
      render(0);
      return true;
    }
    function orbitPhoto(dx, dy, dragging = false) {
      if (!photo.active) return;
      photo.dragging = dragging;
      photo.yaw = angleDiff(photo.yaw + dx, 0);
      photo.pitch = clamp(photo.pitch + dy, -.35, 1.18);
    }
    function zoomPhoto(delta) {
      if (!photo.active) return;
      photo.distance = clamp(photo.distance + delta, 2.8, 36);
    }
    function setPhotoFov(value) {
      photo.fov = clamp(Number(value) || 50, 32, 78);
    }
    function setPhotoHour(value) {
      if (!Number.isFinite(Number(value))) return;
      state.hour = ((Number(value) % 24) + 24) % 24;
    }
    function setPhotoWeather(index) {
      state.weather = ((index % WEATHER.length) + WEATHER.length) % WEATHER.length;
      state.rain = WEATHER[state.weather].rain;
      state.wetness = WEATHER[state.weather].wetness;
      state.mist = WEATHER[state.weather].mist ?? 0;
    }
    function setPhotoFilter(id) {
      photo.filter = PHOTO_FILTERS[id] ? id : 'none';
      return PHOTO_FILTERS[photo.filter];
    }
    function setPhotoPostcard(enabled) {
      photo.postcard = Boolean(enabled);
      return photo.postcard;
    }
    function checkPhotoSubject() {
      if (!photo.active || !PHOTO_SPOTS?.length) {
        photo.subject = null;
        return null;
      }
      camera.updateMatrixWorld();
      const activePhotoEv = state.streetEvent?.phase === 'active' && state.streetEvent.def.kind === 'photo' ? state.streetEvent.def : null;
      let best = null;
      let bestScore = Infinity;
      for (const spot of PHOTO_SPOTS) {
        const d = Math.hypot(camera.position.x - spot.x, camera.position.z - spot.z);
        if (d < 3.5 || d > spot.maxDist) continue;
        targetVector.set(spot.x, spot.y, spot.z).project(camera);
        if (targetVector.z < 0 || targetVector.z > 1) continue;
        if (Math.abs(targetVector.x) > .80 || Math.abs(targetVector.y) > .80) continue;
        const completed = progress.photos.includes(spot.id);
        const isEventTarget = Boolean(activePhotoEv && spot.id === activePhotoEv.photoSpotId);
        const centrality = Math.hypot(targetVector.x, targetVector.y) + (isEventTarget ? -1.2 : completed ? 1.5 : 0);
        if (centrality < bestScore) {
          bestScore = centrality;
          best = { spot, completed, distance: Math.round(d), eventMatch: isEventTarget ? activePhotoEv : null };
        }
      }
      photo.subject = best;
      return best;
    }
    function capturePhotoResult(options = {}) {
      if (!photo.active) return null;
      renderPhoto(0, null);
      const framed = checkPhotoSubject();
      const filterObj = PHOTO_FILTERS[photo.filter] ?? PHOTO_FILTERS.none;
      const withPostcard = options.postcard !== undefined ? Boolean(options.postcard) : photo.postcard;
      let dataUrl = null;
      try {
        const w = canvas.width || 1280;
        const h = canvas.height || 720;
        const pad = withPostcard ? Math.max(12, Math.round(w * .016)) : 0;
        const footerH = withPostcard ? Math.max(54, Math.round(h * .135)) : 0;
        const out = document.createElement('canvas');
        out.width = w + pad * 2;
        out.height = h + pad + footerH;
        const ctx = out.getContext('2d');
        if (withPostcard) {
          ctx.fillStyle = '#f5eedc';
          ctx.fillRect(0, 0, out.width, out.height);
        }
        ctx.save();
        if (filterObj.css && filterObj.css !== 'none') ctx.filter = filterObj.css;
        ctx.drawImage(canvas, pad, pad, w, h);
        ctx.restore();
        if (withPostcard) {
          ctx.strokeStyle = 'rgba(145, 118, 72, 0.35)';
          ctx.lineWidth = Math.max(1, Math.round(w * .0015));
          ctx.strokeRect(pad + .5, pad + .5, w - 1, h - 1);
          const baseY = pad + h;
          const titleSize = Math.max(14, Math.round(footerH * .32));
          const metaSize = Math.max(11, Math.round(footerH * .22));
          ctx.fillStyle = '#24302a';
          ctx.font = '700 ' + titleSize + 'px "Microsoft YaHei UI", "Noto Serif SC", serif';
          ctx.textBaseline = 'middle';
          const caption = framed ? framed.spot.name : '衢州古城 · ' + D.district({ x: photo.targetX, z: photo.targetZ });
          ctx.fillText(caption, pad + 6, baseY + footerH * .38);
          ctx.fillStyle = '#6f6552';
          ctx.font = '600 ' + metaSize + 'px "Microsoft YaHei UI", sans-serif';
          const hh = String(Math.floor(state.hour)).padStart(2, '0');
          const mm = String(Math.floor((state.hour - Math.floor(state.hour)) * 60)).padStart(2, '0');
          const wName = WEATHER[state.weather]?.name ?? '晴朗';
          ctx.fillText('QUZHOU ANCIENT CITY · ' + hh + ':' + mm + ' · ' + wName + ' · ' + filterObj.name, pad + 6, baseY + footerH * .72);
          ctx.textAlign = 'right';
          ctx.fillStyle = '#b4482f';
          ctx.font = '700 ' + Math.max(12, Math.round(footerH * .24)) + 'px "Microsoft YaHei UI", serif';
          ctx.fillText('南孔圣地 · 衢州印记', out.width - pad - 6, baseY + footerH * .54);
        }
        dataUrl = out.toDataURL('image/png');
      } catch {
        try { dataUrl = canvas.toDataURL('image/png'); } catch { dataUrl = null; }
      }
      let newlyCompleted = false;
      let reward = 0;
      if (dataUrl && framed && !framed.completed) {
        newlyCompleted = true;
        progress.photos.push(framed.spot.id);
        const completedAll = progress.photos.length === PHOTO_SPOTS.length;
        reward = completedAll ? 500 : 120;
        progress.cash += reward;
        onSave();
        audio.start();
        if (completedAll) audio.complete();
        else audio.upgrade?.();
        photo.lastCaptured = { spot: framed.spot, reward, completedAll, count: progress.photos.length, total: PHOTO_SPOTS.length };
        if (completedAll) {
          announce('古城明信片全收集', framed.spot.name, '全部 ' + PHOTO_SPOTS.length + ' 处实景打卡达成 · 奖金 ¥500！', 6.2);
        } else {
          announce('明信片打卡完成', framed.spot.name, '摄影奖金 ' + cashText(reward) + ' · 已入册 ' + progress.photos.length + ' / ' + PHOTO_SPOTS.length, 4.6);
        }
        checkPhotoSubject();
      }
      let eventCompleted = null;
      if (dataUrl && framed?.eventMatch && state.streetEvent?.phase === 'active' && state.streetEvent.def.id === framed.eventMatch.id) {
        eventCompleted = completeStreetEvent(state.streetEvent, 0, '');
        checkPhotoSubject();
      }
      return {
        dataUrl, framed: photo.subject, newlyCompleted, reward, eventCompleted,
        count: progress.photos.length, total: PHOTO_SPOTS?.length ?? 5,
        filter: filterObj.id, postcard: withPostcard,
      };
    }
    function capturePhoto() {
      return capturePhotoResult()?.dataUrl ?? null;
    }
    function positionAtGarage() {
      if (state.rest?.active) exitRestMode(true);
      const original = garages[0];
      if (state.vehicle) tryExit(state.vehicle);
      if (state.vehicle) state.vehicle.type = 'parked';
      state.vehicle = null;
      state.boat = null;
      marine.reset();
      state.viewYaw = HUB.angle + .22;
      state.freeYaw = state.viewPitch = 0;
      state.lookHeld = false;
      state.lastLook = -10;
      state.cameraMode = 0;
      state.shake = state.throttle = state.drift = state.cameraBump = 0;
      state.driftGrace = 0;
      state.driftBanked = null;
      player.x = HUB.x + 4.13;
      player.z = HUB.z + 2.2;
      player.yaw = HUB.angle + .38;
      player.walking = 0;
      player.vx = 0;
      player.vz = 0;
      state.sheltered = false;
      player.root.visible = true;
      Object.assign(original, { x: HUB.x, z: HUB.z, yaw: HUB.angle, speed: 0, vx: 0, vz: 0, type: 'parked', brake: false, nitro: 1 });
      for (const car of carList) {
        if (car === original || car.type !== 'parked' || distance(car, original) > 5.2) continue;
        const side = D.nearestRoad(car.x, car.z).x < car.x ? 1 : -1;
        const next = { x: car.x + side * 3.7, z: car.z + 5.2 };
        if (!world.collision(next.x, next.z, 2.2)) Object.assign(car, next);
      }
      updateCamera(0, true);
    }
    function resetPosition() {
      if (state.rest?.active) exitRestMode(true);
      state.race = null;
      if (state.mode === 'taxi') {
        if (state.vehicle) {
          state.vehicle = null;
          player.root.visible = true;
        }
        const spot = taxi.begin();
        Object.assign(player, spot);
        state.viewYaw = spot.yaw;
        state.freeYaw = state.viewPitch = 0;
        updateCamera(0, true);
        announce('出租车归位', '重新接单', '车辆已回到府东街待命点。', 3.2);
        return;
      }
      positionAtGarage();
      announce('返回车库', '府东街起点', '座驾已归位，可按 G 打开改装工坊。', 3.2);
    }
    function start(mode, nextFrame, onStage) {
      state.mode = mode === 'taxi' ? 'taxi' : 'roam';
      if (state.mode !== 'taxi') taxi.end();
      state.notification = state.transmission = null;
      state.landmarkGuide = null;
      state.tapeGuide = null;
      state.race = null;
      state.workshopGuide = false;
      state.drift = 0;
      state.driftGrace = 0;
      state.driftBanked = null;
      state.playingTape = null;
      audio.stopTape?.();
      state.lastBellHour = -1;
      state.chatter = null;
      state.nextChatter = 4.5;
      state.streetEvent = null;
      clearEventVisuals();
      state.nextEventAt = 16;
      state.rest = null;
      state.lastRestBuffAt = -100;
      player.sitting = false;
      player.sitBlend = 0;
      player.sitHeight = 0;
      player.sitHasBack = false;
      while (releasedLanterns.length) scene.remove(releasedLanterns.pop().group);
      state.hour = 10.4;
      state.weather = 0;
      state.wetness = WEATHER[0].wetness;
      state.rain = WEATHER[0].rain;
      state.mist = WEATHER[0].mist;
      state.active = true;
      audio.start();
      rainSound.start();
      positionAtGarage();
      for (const ped of pedestrians) {
        ped.streetReaction = ped.contactVehicle = null;
        ped.escapeUntil = 0;
        ped.crossingState = 'sidewalk';
        ped.activeCrosswalk = null;
        ped.waitingAtCrosswalk = false;
      }
      traffic?.updateSignals(state.clock, state.night, true);
      if (state.mode === 'taxi') {
        const spot = taxi.begin();
        if (spot) {
          Object.assign(player, spot);
          state.viewYaw = spot.yaw;
          updateCamera(0, true);
        }
        say('衢州出租调度', '黄色出租车就在身旁。上车后沿导航接客，平稳驾驶赚高额小费，随时按 G 进改装工坊升级！', 8.8);
      } else {
        say(guideVoice, '欢迎自由探索衢州古城！按 M 打开手绘舆图导航八景打卡赢奖金，随时按 G 进入改装工坊升级座驾。', 7.4);
      }
      state.target = target();
      if (nextFrame && !renderer.info.programs.length) return firstDraw(nextFrame, onStage);
      render(0);
      onStage?.(null, 1);
    }

    function bodyBounds(car) { return car.bodyBounds || (car.model.kind === 'van' ? vanBounds : usualBounds); }
    function collisionAt(car, x, z, yaw) {
      const b = bodyBounds(car);
      return world.vehicleBlocked(x + Math.sin(yaw)*b.offset, z + Math.cos(yaw)*b.offset, yaw, b.halfWidth, b.halfLength, b.height);
    }
    function touchesPerson(car, x, z, radius) {
      const dx = x - car.x, dz = z - car.z;
      const b = bodyBounds(car);
      const reach = b.halfLength + b.halfWidth + radius + Math.abs(b.offset);
      if (dx * dx + dz * dz > reach * reach) return false;
      const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
      const across = Math.max(0, Math.abs(dx * fz - dz * fx) - b.halfWidth);
      const along = Math.max(0, Math.abs(dx * fx + dz * fz - b.offset) - b.halfLength);
      return across * across + along * along < radius * radius;
    }
    function carAtPerson(x, z, excluded) {
      if (!carGrid.ready) {
        for (let i = 0; i < carList.length; i++) {
          const car = carList[i];
          if (car === excluded) continue;
          if (Math.abs(car.x - x) > 6.5 || Math.abs(car.z - z) > 6.5) continue;
          if (touchesPerson(car, x, z, .41)) return car;
        }
        return null;
      }
      const minX = clamp(Math.floor((x - 6.5 - GRID_MIN_X) / GRID_CELL), 0, GRID_COLS - 1);
      const maxX = clamp(Math.floor((x + 6.5 - GRID_MIN_X) / GRID_CELL), 0, GRID_COLS - 1);
      const minZ = clamp(Math.floor((z - 6.5 - GRID_MIN_Z) / GRID_CELL), 0, GRID_ROWS - 1);
      const maxZ = clamp(Math.floor((z + 6.5 - GRID_MIN_Z) / GRID_CELL), 0, GRID_ROWS - 1);
      const buckets = carGrid.buckets;
      for (let gz = minZ; gz <= maxZ; gz++) {
        const row = gz * GRID_COLS;
        for (let gx = minX; gx <= maxX; gx++) {
          const bucket = buckets[row + gx];
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i++) {
            const car = bucket[i];
            if (car === excluded) continue;
            if (Math.abs(car.x - x) > 6.5 || Math.abs(car.z - z) > 6.5) continue;
            if (touchesPerson(car, x, z, .41)) return car;
          }
        }
      }
      return null;
    }
    function clearForPerson(x, z, excluded) {
      return !world.collision(x, z, .44) && !carAtPerson(x, z, excluded);
    }
    const taxi = D.createTaxiSystem({
      scene, world, factory, state, progress, random, cars: carList, onSave, announce, say,
      audio, spawnCar, cashText, clearForPerson, HUB, player, updateCamera,
      protagonist,
    });
    function walkDisplacement(dx, dz) {
      const x = player.x, z = player.z;
      const nx = x + dx, nz = z + dz;
      const car = carAtPerson(nx, nz);
      if (!car && !world.collision(nx, nz, .44)) {
        player.x = nx;
        player.z = nz;
        return;
      }
      if (car) {
        const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), b = bodyBounds(car);
        const side = (x - car.x) * fz - (z - car.z) * fx;
        const fore = (x - car.x) * fx + (z - car.z) * fz - b.offset;
        const sideGap = Math.abs(side) - b.halfWidth, endGap = Math.abs(fore) - b.halfLength;
        let normalSide = Math.sign(side || 1), normalFore = Math.sign(fore || 1);
        let gap = Math.max(sideGap, endGap);
        if (sideGap > 0 && endGap > 0) {
          gap = Math.hypot(sideGap, endGap);
          normalSide *= sideGap / gap;
          normalFore *= endGap / gap;
        } else if (sideGap >= endGap) normalFore = 0;
        else normalSide = 0;
        const ax = normalSide * fz + normalFore * fx, az = -normalSide * fx + normalFore * fz;
        // Keep the motion along the panel. If traffic already overlapped the
        // player, recover toward the nearest face by at most one walking step.
        const outward = Math.min(Math.hypot(dx, dz), .411 - gap);
        const correction = Math.max(0, outward - dx * ax - dz * az);
        const tx = nx + ax * correction, tz = nz + az * correction;
        if (clearForPerson(tx, tz, car)) {
          player.x = tx;
          player.z = tz;
          return;
        }
      }
      if (dx && clearForPerson(nx, z)) player.x = nx;
      if (dz && clearForPerson(player.x, nz)) player.z = nz;
    }
    function carContact(a, b, x, z) {
      const ax = Math.sin(a.yaw), az = Math.cos(a.yaw), bx = Math.sin(b.yaw), bz = Math.cos(b.yaw);
      const aa = bodyBounds(a), bb = bodyBounds(b);
      const dx = x + ax * aa.offset - b.x - bx * bb.offset, dz = z + az * aa.offset - b.z - bz * bb.offset;
      const reach = aa.halfLength + aa.halfWidth + bb.halfLength + bb.halfWidth;
      if (dx * dx + dz * dz > reach * reach) return false;
      const parallel = Math.abs(ax * bx + az * bz), cross = Math.abs(ax * bz - az * bx);
      return Math.abs(dx * ax + dz * az) < aa.halfLength + bb.halfLength * parallel + bb.halfWidth * cross &&
        Math.abs(dx * az - dz * ax) < aa.halfWidth + bb.halfWidth * parallel + bb.halfLength * cross &&
        Math.abs(dx * bx + dz * bz) < bb.halfLength + aa.halfLength * parallel + aa.halfWidth * cross &&
        Math.abs(dx * bz - dz * bx) < bb.halfWidth + aa.halfWidth * parallel + aa.halfLength * cross;
    }
    function impact(car, other = null) {
      const relative = Math.hypot(car.vx - (other?.vx ?? 0), car.vz - (other?.vz ?? 0));
      if (relative < 2.2 || car.cooldown > 0) return;
      car.cooldown = .46;
      const damp = 1 - (car.upgradeStats?.impactDamp ?? 0) * .52;
      car.impact = Math.min(1.55, relative * .06 * damp);
      state.shake = Math.min(.95, relative * .044 * damp);
      const contact = offset(car, car.yaw, 1.99);
      factory.particlesAt(contact.x, .57, contact.z, 'spark', Math.min(14, Math.floor(relative * .6)));
      audio.nudge();
      if (car === state.vehicle && taxi.isTaxiCar(car)) taxi.notifyImpact(relative);
      if (car === state.vehicle && state.streetEvent?.phase === 'active' && state.streetEvent.def.kind === 'ride' && relative > 5.5) {
        state.streetEvent.roughHits++;
      }
    }
    function moveDriven(car, dt) {
      const nextX = car.x + car.vx * dt;
      const nextZ = car.z + car.vz * dt;
      const blocked = collisionAt(car, nextX, nextZ, car.yaw);
      if (blocked) {
        impact(car);
        const allowedX = !collisionAt(car, nextX, car.z, car.yaw);
        if (allowedX) car.x = nextX;
        const allowedZ = !collisionAt(car, car.x, nextZ, car.yaw);
        if (allowedZ) car.z = nextZ;
        car.vx *= allowedX ? .68 : -.14;
        car.vz *= allowedZ ? .68 : -.14;
        return;
      }
      let other = null;
      queryCars(nextX, nextZ, 7.5, candidate => {
        if (candidate !== car && carContact(car, candidate, nextX, nextZ)) {
          other = candidate;
          return true;
        }
      });
      if (!other) {
        car.x = nextX;
        car.z = nextZ;
        return;
      }
      if (distance(car, other) + .008 < Math.hypot(nextX - other.x, nextZ - other.z)) {
        car.x = nextX;
        car.z = nextZ;
        return;
      }
      impact(car, other);
      const away = heading(car, other);
      const shove = offset(other, away, Math.min(.36, car.speed * dt * .55));
      if (!collisionAt(other, shove.x, shove.z, other.yaw)) {
        other.x = shove.x;
        other.z = shove.z;
      }
      car.vx = (car.vx + other.vx * .65) * -.19;
      car.vz = (car.vz + other.vz * .65) * -.19;
    }
    const pressed = (keys, code, alternate) => keys.has(code) || (alternate && keys.has(alternate));
    function drive(dt, keys) {
      const car = state.vehicle;
      const buff = activeBuff();
      const stats = car.upgradeStats ?? D.computeCarStats(car.model, progress.garage[car.model.kind]);
      const throttle = Boolean(pressed(keys, 'KeyW', 'ArrowUp'));
      const pedal = Boolean(pressed(keys, 'KeyS', 'ArrowDown'));
      const bothPedals = throttle && pedal;
      const move = Number(throttle) - Number(pedal);
      const steer = clamp(Number(Boolean(pressed(keys, 'KeyA', 'ArrowLeft'))) - Number(Boolean(pressed(keys, 'KeyD', 'ArrowRight'))) - (keys.axisX ?? 0), -1, 1);
      const slide = keys.has('Space');
      const boost = Boolean(pressed(keys, 'ShiftLeft', 'ShiftRight')) && move > 0 && !slide && car.nitro > .018;
      state.throttle = move > 0;
      car.cooldown = Math.max(0, car.cooldown - dt);
      car.impact = smooth(car.impact, 0, 9.3, dt);
      const regenRate = stats.nitroRegen * (buff?.nitroRegenMult ?? 1);
      car.nitro = clamp(car.nitro + dt * (boost ? -stats.nitroDrain : regenRate), 0, 1);
      let fx = Math.sin(car.yaw);
      let fz = Math.cos(car.yaw);
      const forward = car.vx * fx + car.vz * fz;
      const speedFraction = clamp(Math.abs(forward) / 40, 0, 1);
      const steerResponse = !steer || car.steer * steer < 0 ? 22 : 17 - 6 * speedFraction;
      car.steer = smooth(car.steer, steer, steerResponse, dt);
      const rate = (1.92 + stats.steerBonus) - .72 * speedFraction;
      const turn = car.steer * Math.sign(forward) * rate * clamp(Math.abs(forward) / 3.9, 0, 1) * (slide ? 1.28 : 1) * dt;
      if (turn && !collisionAt(car, car.x, car.z, car.yaw + turn)) car.yaw += turn;
      fx = Math.sin(car.yaw);
      fz = Math.cos(car.yaw);
      let long = car.vx * fx + car.vz * fz;
      let lateral = car.vx * fz - car.vz * fx;
      if (!pedal) car.reverseWait = 0;
      const activeBrake = bothPedals || (move && move * long < -.06);
      const accelerating = !activeBrake && !(move < 0 && car.reverseWait > 0) && move !== 0;
      car.throttleAmt = smooth(car.throttleAmt ?? 0, accelerating ? 1 : 0, accelerating ? 3.2 : 12, dt);
      if (activeBrake) {
        if (pedal && long > .06) car.reverseWait = .24;
        car.throttleAmt = 0;
        long = Math.sign(long) * Math.max(0, Math.abs(long) - stats.brakePower * dt);
      } else if (move < 0 && car.reverseWait > 0) {
        car.reverseWait = Math.max(0, car.reverseWait - dt);
      } else if (move) {
        const launchScale = mix(.52, 1, clamp(Math.abs(long) / 8, 0, 1));
        const power = move < 0 ? 5.6 + stats.engineLevel * .35 : stats.power + (boost ? stats.nitroForce : 0);
        long += move * power * car.throttleAmt * launchScale * dt;
      }
      if (slide) long = Math.sign(long) * Math.max(0, Math.abs(long) - (move ? 12 : 19) * dt);
      long *= Math.exp(-dt * (slide ? .78 : move ? .18 : .70));
      if (Math.abs(long) < .12 && !move) long = 0;
      const cap = stats.top + (boost ? stats.nitroTopBonus : 0);
      long = long > cap ? smooth(long, cap, 3.5, dt) : Math.max(-8.5, long);
      const effectiveGrip = (stats.grip + stats.downforce * speedFraction) * (1 - state.rain * stats.rainGripFactor);
      lateral *= Math.exp(-dt * (slide ? 1.43 : effectiveGrip));
      car.vx = fx * long + fz * lateral;
      car.vz = fz * long - fx * lateral;
      car.speed = Math.hypot(car.vx, car.vz);
      car.brake = slide || activeBrake || move < 0;
      car.lean = smooth(car.lean, -car.steer * clamp(car.speed / 35, 0, 1) * .085 * stats.rollFactor, 9, dt);
      car.bodyPitch = smooth(car.bodyPitch ?? 0, clamp((forward - long) / Math.max(.001, dt) * .0048 * stats.rollFactor, -.105, .13), 8.6, dt);
      car.bodyRoll = smooth(car.bodyRoll ?? 0, clamp(lateral * .006 * stats.rollFactor, -.087, .087), 8.6, dt);
      moveDriven(car, dt);
      const driftStrength = Math.abs(lateral);
      if (slide && car.speed > 8 && driftStrength > 3.6 && !car.cooldown) {
        state.drift += (driftStrength * 7.2 + car.speed) * (buff?.driftMult ?? 1) * dt;
        state.driftGrace = .24;
        car.fxTime = (car.fxTime ?? 0) - dt;
        if (car.fxTime <= 0) {
          car.fxTime = .058;
          const tail = offset(car, car.yaw, -1.45);
          factory.skid(car, -1, car.speed * .074);
          factory.skid(car, 1, car.speed * .074);
          factory.particlesAt(tail.x, .29, tail.z, 'smoke', 4);
        }
      } else if (state.drift > 0) {
        if (!car.cooldown && state.driftGrace > 0) {
          state.driftGrace -= dt;
        } else {
          if (!car.cooldown && state.drift >= 45 && state.clock - state.driftLast > 3.2) {
            const score = Math.round(state.drift);
            const bonus = clamp(Math.round((state.drift / 7.5) * (buff?.driftCashMult ?? 1)), 12, 110);
            progress.cash += bonus;
            onSave();
            state.driftBanked = { score, bonus, until: state.clock + 2.8 };
            announce('驾驶奖励', '甩尾完成', score + ' 分 · ' + cashText(bonus), 2.4);
            state.driftLast = state.clock;
          }
          state.drift = 0;
          state.driftGrace = 0;
        }
      }
      if (boost && car.speed > 10 && random() < .28) {
        const tail = offset(car, car.yaw, -2.16);
        factory.particlesAt(tail.x, .35, tail.z, stats.transmissionLevel >= 4 ? 'superboost' : 'boost', stats.transmissionLevel >= 4 ? 4 : 3);
      }
      if (state.rain > .26 && car.speed > 15 && Math.random() < .14) {
        const spray = offset(car, car.yaw, -1.53);
        factory.particlesAt(spray.x, .15, spray.z, 'smoke', 1);
      }
      const jolt = progress.reduceMotion ? 0 : car.impact * .16 + (boost ? .20 : 0);
      state.cameraBump = smooth(state.cameraBump, jolt, 5.25, dt);
    }
    function walk(dt, keys) {
      const startX = player.x, startZ = player.z;
      const buff = activeBuff();
      state.viewYaw += dt * 1.85 * (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight')));
      const forward = clamp(Number(Boolean(pressed(keys, 'KeyW', 'ArrowUp'))) - Number(Boolean(pressed(keys, 'KeyS', 'ArrowDown'))) + (keys.axisY ?? 0), -1, 1);
      const strafe = clamp(Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + (keys.axisX ?? 0), -1, 1);
      const inputStrength = Math.hypot(forward, strafe);
      const running = Boolean(pressed(keys, 'ShiftLeft', 'ShiftRight'));
      const speed = (running ? 7.55 : 4.05) * (buff?.walkMult ?? 1) * Math.min(1, inputStrength);
      let targetVx = 0;
      let targetVz = 0;
      if (speed) {
        const dx = (Math.sin(state.viewYaw) * forward - Math.cos(state.viewYaw) * strafe) / inputStrength;
        const dz = (Math.cos(state.viewYaw) * forward + Math.sin(state.viewYaw) * strafe) / inputStrength;
        targetVx = dx * speed;
        targetVz = dz * speed;
      }
      const accelRate = speed > 0 ? 11.5 : 13.5;
      player.vx = smooth(player.vx ?? 0, targetVx, accelRate, dt);
      player.vz = smooth(player.vz ?? 0, targetVz, accelRate, dt);
      const curSpeed = Math.hypot(player.vx, player.vz);
      if (curSpeed > 0.04) {
        const moveYaw = Math.atan2(player.vx, player.vz);
        player.yaw += angleDiff(moveYaw, player.yaw) * (1 - Math.exp(-11.5 * dt));
        walkDisplacement(player.vx * dt, player.vz * dt);
      } else {
        player.vx = 0;
        player.vz = 0;
      }
      player.walking = dt > 0 ? Math.hypot(player.x - startX, player.z - startZ) / dt : 0;
      state.throttle = false;
      state.cameraBump = smooth(state.cameraBump, 0, 6, dt);
    }

    function stepTraffic(car, dt) {
      const routeTarget = car.route[car.next];
      const gap = distance(car, routeTarget);
      const turn = angleDiff(heading(car, routeTarget), car.yaw);
      if (gap < 5.25 || (gap < 8.5 && Math.abs(turn) > 1.2)) car.next = (car.next + 1) % car.route.length;
      const nextYaw = car.yaw + clamp(turn, -dt * 2.55, dt * 2.55);
      if (Math.abs(turn) > .001 && !collisionAt(car, car.x, car.z, nextYaw)) car.yaw = nextYaw;
      const dx = Math.sin(car.yaw);
      const dz = Math.cos(car.yaw);
      const p = protagonist();
      const ahead = (p.x - car.x) * dx + (p.z - car.z) * dz;
      const across = Math.abs((p.x - car.x) * dz - (p.z - car.z) * dx);
      const blockPlayer = ahead > -.65 && ahead < (state.vehicle ? 10 : 7) && across < (state.vehicle ? 2.75 : 1.5);
      let blockCar = false;
      queryCars(car.x, car.z, 9.5, other => {
        if (other === car || other === state.vehicle || Math.abs(other.x - car.x) > 9 || Math.abs(other.z - car.z) > 9) return;
        const ahead = (other.x - car.x) * dx + (other.z - car.z) * dz;
        const across = Math.abs((other.x - car.x) * dz - (other.z - car.z) * dx);
        if (ahead > .15 && ahead < 7.6 && across < 2.0) {
          blockCar = true;
          return true;
        }
      });
      const cruise = blockPlayer || blockCar ? 0 : Math.abs(turn) > .34 ? car.cruise * .58 : car.cruise;
      car.brake = car.pace > cruise + .6;
      car.pace = smooth(car.pace, cruise, cruise ? 1.65 : 5.6, dt);
      const nx = car.x + dx * car.pace * dt;
      const nz = car.z + dz * car.pace * dt;
      if (!collisionAt(car, nx, nz, car.yaw)) {
        car.x = nx;
        car.z = nz;
      } else {
        car.pace = smooth(car.pace, 0, 7, dt);
      }
      car.speed = car.pace;
      car.vx = dx * car.pace;
      car.vz = dz * car.pace;
      car.steer = clamp(turn, -.7, .7);
      car.lean = -car.steer * .05;
    }
    // Choose a short landing corridor that also fits the length of a prone character.
    const landingAngles = [0, .63, -.63, 1.26, -1.26, 1.88, -1.88, PI];
    function streetLanding(ped, car, direction, wanted, reach) {
      const y = world.surfaceHeight(ped.x, ped.z) + .35;
      let best = null;
      for (const turn of landingAngles) {
        const angle = direction + turn;
        const dx = Math.sin(angle), dz = Math.cos(angle), length = wanted + reach;
        const clearance = world.clearFraction(ped.x, y, ped.z, ped.x + dx * length, y, ped.z + dz * length, .42);
        const travel = Math.min(wanted, clearance * length - reach - (clearance < 1 ? .035 : 0));
        if (travel < 0 || (best && travel <= best.travel + .02)) continue;
        const endX = ped.x + dx * travel, endZ = ped.z + dz * travel;
        if (world.collision(endX + dx * reach, endZ + dz * reach, .42) ||
            world.collision(endX - dx * reach, endZ - dz * reach, .42) ||
            world.clearFraction(endX, y, endZ, endX - dx * reach, y, endZ - dz * reach, .42) < 1) continue;
        let blockedByCar = false;
        queryCars(endX, endZ, 7.5, other => {
          if (other !== car && (touchesPerson(other, endX, endZ, .42) ||
            touchesPerson(other, endX + dx * reach, endZ + dz * reach, .42) ||
            touchesPerson(other, endX - dx * reach, endZ - dz * reach, .42))) {
            blockedByCar = true;
            return true;
          }
        });
        if (blockedByCar) continue;
        best = { dx, dz, travel, angle };
        if (travel >= wanted - .02) break;
      }
      return best;
    }
    function startStreetContact(ped, car, speed, bite, across, side, rightX, rightZ, moveX, moveZ) {
      const strength = speed * bite;
      const kind = strength >= 4.5 ? 'fall' : 'stagger';
      const down = kind !== 'stagger';
      const away = Math.atan2(rightX * side + moveX * .47, rightZ * side + moveZ * .47);
      const stepAside = Math.max(.46, (bodyBounds(car).halfWidth + .57 - Math.abs(across)) * 1.16);
      const landing = streetLanding(ped, car, away, down ? 1.72 + Math.min(.55, strength * .017) : stepAside, down ? .99 : .23);
      if (!landing) return;
      ped.contactVehicle = car;
      ped.streetReaction = { kind, age: 0, flat: 0, brace: 0, rise: 0, hold: 0,
        x: ped.x, z: ped.z, fromYaw: ped.yaw, direction: landing.angle, side,
        dx: landing.dx * landing.travel, dz: landing.dz * landing.travel };
      ped.stride = ped.visiblePace = 0;
      ped.fleeing = false;
      if (car !== state.vehicle) return;
      if (speed > 1.4) {
        const drag = down ? .92 : .985;
        car.vx *= drag; car.vz *= drag;
        car.speed *= drag;
        state.shake = Math.max(state.shake, down ? .24 : .075);
        audio.nudge();
        if (taxi.isTaxiCar(car)) taxi.notifyImpact(speed * .75);
      }
    }
    function sweepStreetVehicle(car, dt, view) {
      if (car.streetX == null || !(dt > 0)) return;
      const dx = car.x - car.streetX, dz = car.z - car.streetZ;
      const lengthSq = dx * dx + dz * dz;
      if (lengthSq < .0144 * dt * dt) return;
      const b = bodyBounds(car);
      const reach = Math.hypot(b.halfLength + Math.abs(b.offset), b.halfWidth) + .9;
      const minX = Math.min(car.x, car.streetX) - reach, maxX = Math.max(car.x, car.streetX) + reach;
      const minZ = Math.min(car.z, car.streetZ) - reach, maxZ = Math.max(car.z, car.streetZ) + reach;
      if (view.x < minX - 175 || view.x > maxX + 175 || view.z < minZ - 175 || view.z > maxZ + 175) return;
      const turn = angleDiff(car.yaw, car.streetYaw);
      const yaw = car.streetYaw + turn * .5, fx = Math.sin(yaw), fz = Math.cos(yaw);
      const length = Math.sqrt(lengthSq);
      const lateral = dx * fz - dz * fx, forward = dx * fx + dz * fz;
      // In the midpoint car frame the upright capsule traces a segment against the padded footprint.
      const pad = .30 + Math.abs(turn) * Math.max(b.halfWidth, b.halfLength) * .5;
      const width = b.halfWidth + pad, nose = b.halfLength + pad;
      const gx0 = clamp(Math.floor((minX - GRID_MIN_X) / GRID_CELL), 0, GRID_COLS - 1);
      const gx1 = clamp(Math.floor((maxX - GRID_MIN_X) / GRID_CELL), 0, GRID_COLS - 1);
      const gz0 = clamp(Math.floor((minZ - GRID_MIN_Z) / GRID_CELL), 0, GRID_ROWS - 1);
      const gz1 = clamp(Math.floor((maxZ - GRID_MIN_Z) / GRID_CELL), 0, GRID_ROWS - 1);
      const buckets = pedGrid.buckets;
      for (let gz = gz0; gz <= gz1; gz++) {
        const row = gz * GRID_COLS;
        for (let gx = gx0; gx <= gx1; gx++) {
          const bucket = buckets[row + gx];
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i++) {
            const ped = bucket[i];
            if (ped.streetReaction || ped.contactVehicle === car ||
                ped.x < minX || ped.x > maxX || ped.z < minZ || ped.z > maxZ) continue;
            const px = ped.x - car.streetX, pz = ped.z - car.streetZ;
            const x = px * fz - pz * fx, z = px * fx + pz * fz - b.offset;
            if ((Math.abs(lateral) < 1e-7 && Math.abs(x) > width) ||
                (Math.abs(forward) < 1e-7 && Math.abs(z) > nose)) continue;
            const x1 = lateral ? (x - width) / lateral : -Infinity, x2 = lateral ? (x + width) / lateral : Infinity;
            const z1 = forward ? (z - nose) / forward : -Infinity, z2 = forward ? (z + nose) / forward : Infinity;
            const enter = Math.max(0, Math.min(x1, x2), Math.min(z1, z2));
            if (enter > Math.min(1, Math.max(x1, x2), Math.max(z1, z2))) continue;
            const across = x - lateral * enter, along = z - forward * enter;
            const bite = Math.max(Math.abs(forward) / length * clamp((width - Math.abs(across)) / .62, .08, 1),
              Math.abs(lateral) / length * clamp((nose - Math.abs(along)) / .62, .08, 1));
            const side = Math.abs(across) > .1 ? Math.sign(across) : (Math.sin(ped.yaw - yaw) < 0 ? -1 : 1);
            startStreetContact(ped, car, length / dt, bite, across, side, fz, -fx, dx / length, dz / length);
          }
        }
      }
    }
    const easeStreet = t => t * t * (3 - 2 * t);
    function stepStreetReaction(ped, dt) {
      const r = ped.streetReaction;
      if (r.kind === 'fatal' && r.flat === 1) return;
      r.age += dt;
      const down = r.kind !== 'stagger';
      const travel = clamp(r.age / (down ? .48 : .39), 0, 1);
      const along = 1 - (1 - travel) ** 2;
      ped.x = r.x + r.dx * along;
      ped.z = r.z + r.dz * along;
      const facing = r.direction + (down ? PI : 0);
      ped.yaw = r.fromYaw + angleDiff(facing, r.fromYaw) * easeStreet(clamp(r.age / (down ? .25 : .49), 0, 1));
      if (down) {
        const drop = clamp(r.age / .55, 0, 1);
        r.flat = easeStreet(drop);
        r.brace = Math.sin(drop * PI);
        if (drop < 1 || r.kind === 'fatal' || r.age < 2.5) return;
        if (r.hold === 0) {
          const headX = Math.sin(r.direction) * .77, headZ = Math.cos(r.direction) * .77;
          let blockedByCar = false;
          queryCars(ped.x, ped.z, 7.5, car => {
            if (touchesPerson(car, ped.x, ped.z, .63) ||
              touchesPerson(car, ped.x + headX, ped.z + headZ, .38) ||
              touchesPerson(car, ped.x - headX, ped.z - headZ, .38)) {
              blockedByCar = true;
              return true;
            }
          });
          if (blockedByCar) return;
        }
        r.hold = Math.min(1, r.hold + dt / 1.04);
        r.flat = 1 - easeStreet(r.hold);
        r.rise = Math.sin(r.hold * PI);
        if (r.hold < 1) return;
      } else {
        r.brace = Math.sin(PI * clamp(r.age / .58, 0, 1));
        if (r.age < .58) return;
      }
      ped.escapeYaw = r.direction;
      ped.escapeUntil = state.clock + 2.1;
      ped.streetReaction = null;
    }
    function stepPerson(ped, dt) {
      if (ped.streetReaction) { stepStreetReaction(ped, dt); return; }
      if (ped.contactVehicle && !touchesPerson(ped.contactVehicle, ped.x, ped.z, .64)) ped.contactVehicle = null;
      const target = ped.loop[ped.index];
      const threat = state.vehicle && state.vehicle.speed > 5 && distance(state.vehicle, ped) < 6.7;
      const escaping = state.clock < (ped.escapeUntil ?? 0);
      if (!threat && !escaping && state.clock < (ped.bellLookUntil ?? 0)) {
        ped.yaw += angleDiff(ped.bellLookYaw ?? ped.yaw, ped.yaw) * (1 - Math.exp(-6.5 * dt));
        ped.visiblePace = 0;
        ped.fleeing = false;
        return;
      }
      if (distance(ped, target) < 1.9) ped.index = (ped.index + 1) % ped.loop.length;
      const angle = threat ? heading(state.vehicle, ped) : escaping ? ped.escapeYaw : heading(ped, target);
      ped.yaw += angleDiff(angle, ped.yaw) * (1 - Math.exp(-9 * dt));
      const rainHurry = state.rain > .38 ? 1 + clamp((state.rain - .38) * .42, 0, .24) : 1;
      const pace = threat || escaping ? 4.9 : ped.walk * rainHurry;
      const next = offset(ped, ped.yaw, pace * dt);
      if (clearForPerson(next.x, next.z)) {
        ped.x = next.x;
        ped.z = next.z;
        ped.blockedFor = 0;
        ped.visiblePace = pace;
      } else {
        ped.visiblePace = 0;
        ped.blockedFor = (ped.blockedFor ?? 0) + dt;
        if (ped.blockedFor > .65) {
          ped.index = (ped.index + 1) % ped.loop.length;
          ped.blockedFor = ped.escapeUntil = 0;
        }
      }
      ped.fleeing = Boolean(threat || escaping);
    }
    function pickChatterLine(zoneHint, x, z) {
      const rain = state.rain > .45;
      const night = state.night > .32;
      const mist = state.mist > .45;
      let pool;
      if (zoneHint === 'market') pool = rain ? CHATTER_LINES.marketRain : night ? CHATTER_LINES.marketNight : CHATTER_LINES.marketDay;
      else if (zoneHint === 'kongmiao' || (x > 130 && x < 196 && z > -55 && z < 14)) pool = CHATTER_LINES.kongmiao;
      else if (x > 108 && x < 254 && z > 8 && z < 170) pool = night ? CHATTER_LINES.nightStreet : CHATTER_LINES.fushanDay;
      else if (zoneHint === 'lake' || x > 304 || (z > 125 && z < 238 && x > -205 && x < 140)) pool = mist ? CHATTER_LINES.lakeMist : night ? CHATTER_LINES.lakeNight : CHATTER_LINES.lakeDay;
      else if (x < -82 && z > -135 && z < 65) pool = rain ? CHATTER_LINES.rainStreet : mist ? CHATTER_LINES.shuitingMist : night ? CHATTER_LINES.shuitingNight : CHATTER_LINES.shuitingDay;
      else if (rain) pool = CHATTER_LINES.rainStreet;
      else if (night) pool = CHATTER_LINES.nightStreet;
      else pool = CHATTER_LINES.dayStreet;
      const filtered = pool.length > 1 ? pool.filter(line => line !== state.lastChatterLine) : pool;
      return filtered[Math.floor(random() * filtered.length)] || pool[0];
    }
    function stepStreetChatter(p) {
      if (state.chatter && state.clock >= state.chatter.until) state.chatter = null;
      if (state.chatter || state.mode !== 'roam' || state.race?.active || showroom.active || photo.active) return;
      if (state.streetEvent && (state.streetEvent.phase === 'offered' || state.streetEvent.phase === 'needCar') && distance(p, state.streetEvent) < 22) return;
      if (state.clock < state.nextChatter) return;
      const speed = Math.abs((state.boat ?? state.vehicle)?.speed ?? 0);
      if (speed > 7.2 || state.boat) return;
      let anchor = null;
      let bestDist = 17.5;
      for (const stall of CHATTER_STALLS) {
        const d = distance(p, stall);
        if (d < bestDist && d > 2.2) { bestDist = d; anchor = { who: stall.who, zone: stall.zone, x: stall.x, y: stall.y, z: stall.z, ped: null }; }
      }
      if (!anchor) {
        let nearPed = null;
        let pedDist = 18.5;
        queryPeds(p.x, p.z, 19, ped => {
          if (ped.streetReaction || ped.fleeing || !ped.root.visible) return;
          const d = distance(p, ped);
          if (d > 3.2 && d < pedDist) { pedDist = d; nearPed = ped; }
        });
        if (nearPed) {
          anchor = { who: state.rain > .45 ? '避雨路人' : state.night > .35 ? '夜游行人' : '古城行人', zone: null, x: nearPed.x, y: 2.15, z: nearPed.z, ped: nearPed };
        }
      }
      if (!anchor) { state.nextChatter = state.clock + 2.5; return; }
      const text = pickChatterLine(anchor.zone, anchor.x, anchor.z);
      state.lastChatterLine = text;
      state.chatter = { who: anchor.who, text, ped: anchor.ped, x: anchor.x, y: anchor.y, z: anchor.z, startedAt: state.clock, until: state.clock + 4.4 };
      state.nextChatter = state.clock + 7.2 + random() * 4.4;
    }
    let simTick = 0;
    function step(dt, keys) {
      simTick++;
      state.clock += dt;
      const prevHour = state.hour;
      const timeScale = state.rest?.active ? (state.rest.timeScale || 1) : 1;
      state.hour = (state.hour + dt * .008 * timeScale) % 24;
      const curMark = Math.floor(state.hour);
      if (timeScale <= 1 && state.mode === 'roam' && !state.race?.active && Math.floor(prevHour) !== curMark && BELL_HOURS[curMark] && state.lastBellHour !== curMark) {
        state.lastBellHour = curMark;
        audio.bellChime?.(curMark === 12 ? 3 : 2);
        say('衢州钟楼报时', BELL_HOURS[curMark], 6.4);
      }
      const conditions = WEATHER[state.weather];
      state.rain = smooth(state.rain, conditions.rain, .77, dt);
      state.wetness = smooth(state.wetness, conditions.wetness, .24, dt);
      const p = protagonist();
      const dawnHaze = state.hour >= 5.0 && state.hour <= 7.8
        ? Math.sin(clamp((state.hour - 5.0) / 2.8, 0, 1) * Math.PI) * .22
        : 0;
      const lakeMist = (p.x > 305 || (p.z > 125 && p.z < 240 && p.x > -205 && p.x < 140)) ? .10 : 0;
      const baseMist = conditions.mist ?? 0;
      const targetMist = clamp(baseMist + (baseMist > 0 ? lakeMist * .5 : dawnHaze * (1 + lakeMist * 2)), 0, 1);
      state.mist = smooth(state.mist, targetMist, .42, dt);
      rebuildGrid(carGrid);
      rebuildGrid(pedGrid);
      for (let i = 0; i < carList.length; i++) {
        const car = carList[i];
        car.streetX = car.x; car.streetZ = car.z; car.streetYaw = car.yaw;
        if (car.type === 'traffic') {
          const far = Math.abs(car.x - p.x) > 220 || Math.abs(car.z - p.z) > 220;
          if (far && ((i + simTick) & 1) === 1) continue;
          const stepDt = far ? dt * 2 : dt;
          if (traffic) traffic.stepVehicle(car, stepDt);
          else stepTraffic(car, stepDt);
        }
      }
      if (state.rest?.active) stepRest(dt, keys);
      else if (state.vehicle) drive(dt, keys);
      else if (state.boat) {
        if (marine.pilot(state.boat, dt, keys)) {
          state.shake = .43;
          audio.nudge();
        }
        state.throttle = state.boat.throttle;
      }
      else walk(dt, keys);
      if (state.race?.active) stepRingRace(dt);
      if (state.mode === 'taxi') taxi.update(dt);
      rebuildGrid(carGrid);
      for (let i = 0; i < carList.length; i++) sweepStreetVehicle(carList[i], dt, p);
      const pedMaxDistSq = 185 * 185;
      const pedFarDistSq = 75 * 75;
      for (let i = 0; i < pedestrians.length; i++) {
        const ped = pedestrians[i];
        const pdx = ped.x - p.x, pdz = ped.z - p.z;
        const distSq = pdx * pdx + pdz * pdz;
        if (distSq >= pedMaxDistSq) continue;
        const far = distSq > pedFarDistSq && !ped.streetReaction;
        if (far && ((i + simTick) & 1) === 1) continue;
        const stepDt = far ? dt * 2 : dt;
        if (traffic) traffic.stepPedestrian(ped, stepDt);
        else stepPerson(ped, stepDt);
      }
      checkExploration();
      stepStreetEvent(dt);
      stepReleasedLanterns(dt);
      stepStreetChatter(p);
      const actor = protagonist();
      state.sheltered = world.shelters.some(area => actor.x >= area.minX && actor.x <= area.maxX &&
        actor.z >= area.minZ && actor.z <= area.maxZ);
      state.shake = Math.max(0, state.shake - dt * 1.94);
      state.target = target();
    }

    let alternateView = 0, hoodView = 0;
    let fromAlternate = 0, fromHood = 0;
    let restCamBlend = 0;
    let vignetteCamBlend = 0;
    let previousCameraMode = -1, blendTime = 1, blendDuration = .32;
    let cameraReach = 1, cameraGround = 0, orbitSubject = null;
    const mountEye = new T.Vector3(), mountAim = new T.Vector3(), mountOffset = new T.Vector3();
    const mountUp = new T.Vector3(0, 1, 0);
    let cameraSubject = null, mountPhase = 1, mountYaw = 0, mountPitch = 0, mountFov = 0;
    function updateCamera(dt, snap = false) {
      const car = state.vehicle;
      const boat = state.boat;
      const driving = car ?? boat;
      if (orbitSubject !== driving) orbitSubject = null;
      const p = protagonist();
      if (!car && state.cameraMode === 2) state.cameraMode = 0;
      const mode = state.cameraMode;
      if (mode !== previousCameraMode) {
        previousCameraMode = mode;
        fromAlternate = alternateView;
        fromHood = hoodView;
        blendDuration = car ? .36 : boat ? .32 : .26;
        blendTime = 0;
      }
      blendTime = snap || progress.reduceMotion ? 1 : Math.min(1, blendTime + dt / blendDuration);
      const blend = blendTime * blendTime * (3 - 2 * blendTime);
      alternateView = mix(fromAlternate, Number(mode === 1), blend);
      hoodView = mix(fromHood, Number(mode === 2), blend);
      const restActive = Boolean(state.rest?.active);
      restCamBlend = snap || progress.reduceMotion ? Number(restActive) : smooth(restCamBlend, Number(restActive), 4.2, dt);
      const vigActive = Boolean(restActive && state.rest.vignette?.active);
      vignetteCamBlend = snap || progress.reduceMotion ? Number(vigActive) : smooth(vignetteCamBlend, Number(vigActive), 2.8, dt);
      const ground = boat ? 0 : world.surfaceHeight(p.x, p.z) - .023;
      cameraGround = snap ? ground : smooth(cameraGround, ground, 15, dt);
      if (driving && !restActive) {
        const moving = Math.abs(driving.speed) > 1.35;
        const looking = state.lookHeld || (orbitSubject === driving && (!moving || state.clock - state.lastLook < 1.1));
        if (snap) state.viewYaw = driving.yaw;
        else if (looking && mode !== 2) {
          const worldYaw = state.viewYaw + state.freeYaw;
          state.viewYaw = driving.yaw;
          state.freeYaw = angleDiff(worldYaw, driving.yaw);
        } else {
          const follow = 1 - Math.exp(-(mode === 2 ? 17 : boat ? 4.35 : 6.1) * dt);
          state.viewYaw += angleDiff(driving.yaw, state.viewYaw) * follow;
        }
        if (!looking && moving) {
          state.freeYaw = smooth(state.freeYaw, 0, 2.0, dt);
          state.viewPitch = smooth(state.viewPitch, 0, 1.75, dt);
        } else if (mode === 2) {
          state.freeYaw = smooth(state.freeYaw, clamp(state.freeYaw, -1.52, 1.52), 9, dt);
        }
      }
      let yaw = state.viewYaw + (driving ? state.freeYaw : 0);
      if (restActive) {
        const swayAge = state.clock - state.lastLook;
        const swayFactor = swayAge > 4.2 && !progress.reduceMotion ? clamp((swayAge - 4.2) / 2.2, 0, 1) : 0;
        const sway = Math.sin((state.clock - state.rest.startedAt) * .22) * .22 * swayFactor;
        const baseYaw = state.rest.spot ? state.rest.spot.yaw : (driving ? driving.yaw : player.yaw);
        yaw = baseYaw + (state.rest.orbitOffset || 0) + sway;
        if (vignetteCamBlend > .003 && state.rest.vignette) {
          const v = state.rest.vignette;
          const userManual = swayAge < 3.4;
          if (!userManual) {
            const drift = progress.reduceMotion ? 0 : Math.sin((state.clock - v.startedAt) * .26) * .08;
            const targetYaw = baseYaw + (v.camSide || v.sideSign || 1) * (v.kind === 'tea' ? 1.24 : 1.12) + drift;
            yaw = angleDiff(yaw, 0) + angleDiff(targetYaw, yaw) * vignetteCamBlend;
          }
        }
      }
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const speed = clamp(Math.abs(driving?.speed ?? 0) / (boat ? 23 : 40), 0, 1);
      let back, height, side = 0, lead, aimHeight, fov;
      let nose = 0, pitchArm = 1;
      if (car) {
        const bump = progress.reduceMotion ? 0 : state.cameraBump;
        const isBus = car.model.kind === 'bus';
        const hoodHeight = car.concept ? 1.16 : isBus ? 2.62 : car.model.kind === 'van' ? 2.16 : car.model.kind === 'suv' ? 1.80 : 1.58;
        back = mix((isBus ? 9.4 : 6.42) + speed * 2.58, (isBus ? 13.4 : 10.2) + speed * 1.8, alternateView) * (1 - hoodView);
        height = mix((isBus ? 4.05 : 2.66) + speed * 1.27, (isBus ? 6.25 : 5.05) + speed * 1.22, alternateView) + bump;
        // Lift the lens over the roof as it travels forward to the windshield.
        height = mix(height, hoodHeight + bump * .085, hoodView) + 3.4 * hoodView * (1 - hoodView);
        lead = mix(mix(6.22, 8.3, alternateView), 28, hoodView);
        aimHeight = mix(isBus ? 2.35 : 1.68, hoodHeight - .20, hoodView);
        nose = (isBus ? 2.1 : .57) * hoodView;
        pitchArm = 1 - hoodView;
        fov = mix(mix(57, 61, alternateView), 64, hoodView);
      } else if (boat) {
        back = mix(10.12 + speed * 2.4, 14 + speed * 2.0, alternateView);
        height = mix(3.92 + speed * 1.28, 6.36 + speed * 1.35, alternateView);
        lead = mix(6.6, 9, alternateView);
        aimHeight = 1.48;
        fov = mix(57, 61, alternateView);
      } else {
        back = mix(state.sheltered ? 4.3 : 4.9, state.sheltered ? 2.5 : 2.85, alternateView);
        height = mix(3.14, 2.14, alternateView);
        side = mix(1.04, .69, alternateView);
        lead = mix(4.1, 4.7, alternateView);
        aimHeight = 1.74;
        fov = mix(state.sheltered ? 65 : 57, state.sheltered ? 59 : 55, alternateView);
      }
      if (restCamBlend > .003) {
        const rBack = boat ? 10.6 : car ? 7.4 : 4.25;
        const rHeight = boat ? 3.45 : car ? 2.38 : 1.72;
        const rSide = boat ? .85 : car ? .65 : .74;
        const rLead = boat ? 6.2 : car ? 4.5 : 6.6;
        const rAim = boat ? 1.35 : car ? 1.24 : 1.32;
        const rFov = car ? 49 : 52;
        back = mix(back, rBack, restCamBlend);
        height = mix(height, rHeight, restCamBlend);
        side = mix(side, rSide, restCamBlend);
        lead = mix(lead, rLead, restCamBlend);
        aimHeight = mix(aimHeight, rAim, restCamBlend);
        fov = mix(fov, rFov, restCamBlend);
        nose = mix(nose, 0, restCamBlend);
        pitchArm = mix(pitchArm, 1, restCamBlend);
      }
      if (vignetteCamBlend > .003 && state.rest?.vignette) {
        const v = state.rest.vignette;
        const isTea = v.kind === 'tea';
        back = mix(back, isTea ? 2.75 : 3.25, vignetteCamBlend);
        height = mix(height, isTea ? 1.48 : 1.60, vignetteCamBlend);
        side = mix(side, (v.camSide || v.sideSign || 1) * (isTea ? .85 : .95), vignetteCamBlend);
        lead = mix(lead, isTea ? 2.2 : 2.8, vignetteCamBlend);
        aimHeight = mix(aimHeight, isTea ? 1.04 : 1.16, vignetteCamBlend);
        fov = mix(fov, isTea ? 42 : 45, vignetteCamBlend);
      }
      const pivotHeight = boat ? 1.46 : 1.25;
      cameraPivot.set(p.x, ground + pivotHeight, p.z);
      if (snap || progress.reduceMotion) mountPhase = 1;
      else if (cameraSubject && cameraSubject !== p) {
        mountEye.copy(camera.position).sub(cameraPivot);
        mountAim.copy(focus).sub(cameraPivot);
        mountYaw = yaw;
        mountPitch = state.viewPitch;
        mountFov = camera.fov;
        mountPhase = 0;
        cameraReach = 1;
      }
      cameraSubject = p;
      mountPhase = Math.min(1, mountPhase + dt / .28);
      const mountMix = mountPhase * mountPhase * (3 - 2 * mountPhase);
      const armPitch = state.viewPitch * pitchArm * (1 - vignetteCamBlend * .85);
      const armCos = Math.cos(armPitch), armSin = Math.sin(armPitch);
      const armBack = back * armCos + (height - pivotHeight) * armSin;
      desired.set(p.x - fx * armBack - fz * side, cameraGround + pivotHeight + (height - pivotHeight) * armCos - back * armSin,
        p.z - fz * armBack + fx * side);
      if (nose) {
        desired.x += Math.sin(car.yaw) * nose;
        desired.z += Math.cos(car.yaw) * nose;
      }
      if (mountPhase < 1) {
        mountOffset.copy(mountEye).applyAxisAngle(mountUp, yaw - mountYaw).add(cameraPivot);
        desired.lerp(mountOffset, 1 - mountMix);
        desired.y += 2.8 * mountMix * (1 - mountMix);
      }
      desired.y = Math.max(desired.y, (boat ? 0 : world.surfaceHeight(desired.x, desired.z)) + .38);
      // Blend the boom in subject space. An orbit responds on the next frame, and
      // one swept segment protects the complete rendered boom at every angle.
      const padding = clamp(.12 + camera.near * Math.hypot(1, camera.aspect) * Math.tan(camera.fov * Math.PI / 360), .27, .40);
      const benchRest = state.rest?.kind === 'bench' && state.rest.spot;
      const rayX = benchRest ? state.rest.spot.exitX : p.x;
      const rayY = benchRest ? (cameraGround + 1.56) : cameraPivot.y;
      const rayZ = benchRest ? state.rest.spot.exitZ : p.z;
      const hit = world.clearFraction(rayX, rayY, rayZ, desired.x, desired.y, desired.z, padding);
      const reach = hit < 1 ? Math.max(0, hit - .006) : 1;
      cameraReach = snap || reach <= cameraReach ? reach : smooth(cameraReach, reach, 12, dt);
      camera.position.copy(cameraPivot).lerp(desired, cameraReach);
      focus.set(p.x + fx * lead, cameraGround + aimHeight + Math.tan(state.viewPitch) * lead, p.z + fz * lead);
      if (vignetteCamBlend > .003 && state.rest?.vignette?.active && vignetteNpc.root.visible) {
        const vx = mix(p.x, vignetteNpc.x, .48);
        const vz = mix(p.z, vignetteNpc.z, .48);
        const vy = cameraGround + (state.rest.vignette.kind === 'tea' ? 1.04 : 1.16);
        focus.set(mix(focus.x, vx, vignetteCamBlend), mix(focus.y, vy, vignetteCamBlend), mix(focus.z, vz, vignetteCamBlend));
      }
      if (mountPhase < 1) {
        mountOffset.copy(mountAim).applyAxisAngle(mountUp, yaw - mountYaw);
        mountOffset.y += Math.tan(state.viewPitch - mountPitch) * Math.hypot(mountOffset.x, mountOffset.z);
        focus.lerp(mountOffset.add(cameraPivot), 1 - mountMix);
      }
      if (!progress.reduceMotion && state.shake) {
        focus.x += Math.sin(state.clock * 85) * state.shake * .49;
        focus.y += Math.cos(state.clock * 62) * state.shake * .44;
      }
      camera.lookAt(focus);
      if (camera.aspect < .85) fov += 13 - 2 * hoodView;
      if (!progress.reduceMotion) fov += speed * (9 - 3 * hoodView);
      if (mountPhase < 1) fov = mix(mountFov, fov, mountMix);
      if (Math.abs(fov - camera.fov) > .035) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
    function cycleCamera() {
      if (!state.vehicle && state.cameraMode === 2) state.cameraMode = 0;
      state.cameraMode = (state.cameraMode + 1) % (state.vehicle ? 3 : 2);
    }
    function hideWorldMarkers() {
      marker.visible = false;
      roadNavigation.update(null, null, state.clock);
      for (const b of landmarkBeacons) b.group.visible = false;
      for (const item of tapeProps) item.group.visible = false;
      for (const item of streetSpotProps) item.group.visible = false;
      for (const item of restSpotProps) item.group.visible = false;
      eventBeacon.group.visible = false;
      raceActiveGate.group.visible = false;
      racePreviewGate.group.visible = false;
      raceStartGate.group.visible = false;
      lakeStartGate.group.visible = false;
    }
    function drawMarkers() {
      if (state.rest?.active) {
        hideWorldMarkers();
        return;
      }
      const p = protagonist();
      const aim = state.target;
      roadNavigation.update(state.vehicle, aim, state.clock);
      const gap = aim ? distance(p, aim) : Infinity;
      const show = gap < (aim?.marine ? 235 : 173);
      marker.visible = Boolean(show && !aim?.race && (!aim?.vehiclePickup || gap > 5.2));
      if (marker.visible) {
        marker.position.set(aim.x, aim.water ? -.34 : world.surfaceHeight(aim.x, aim.z) + .028, aim.z);
        marker.scale.setScalar(gap < 8 ? .63 : 1);
        markerDisk.visible = gap < 55 && !aim.vehiclePickup;
        diamond.visible = gap > 7;
        markerCore.color.copy(aim.taxi ? taxiAmber : aim.streetEvent ? eventCoral : aim.tape ? tapeRose : aim.workshop ? workshopMint : aim.marine ? seaBlue : gold);
        markerHaze.color.copy(markerCore.color);
        diamond.position.y = 2.8 + (progress.reduceMotion ? 0 : .07 * Math.sin(state.clock * 2));
        diamond.scale.setScalar(clamp(gap * .035, .88, 2.5));
        diamond.quaternion.copy(camera.quaternion);
      }
      const showBeacons = state.mode === 'roam' && !state.race?.active && !showroom.active && !photo.active;
      for (const b of landmarkBeacons) {
        if (!showBeacons || progress.visitedLandmarks.includes(b.lm.id)) {
          b.group.visible = false;
          continue;
        }
        const d = distance(p, b.lm);
        if (d < 22 || d > 285) {
          b.group.visible = false;
          continue;
        }
        const alpha = clamp((d - 22) / 36, 0, 1) * clamp((285 - d) / 48, 0, 1);
        b.group.visible = true;
        b.beamMat.opacity = .20 * alpha;
        b.haloMat.opacity = .46 * alpha;
        b.halo.position.y = 2.2 + (progress.reduceMotion ? 0 : .35 * Math.sin(state.clock * 2.2 + b.index));
      }
      const showTapes = state.mode === 'roam' && !state.race?.active && !showroom.active && !photo.active;
      for (const item of tapeProps) {
        if (!showTapes || progress.tapes.includes(item.tape.id)) {
          item.group.visible = false;
          continue;
        }
        const d = distance(p, item.tape);
        if (d > 140) {
          item.group.visible = false;
          continue;
        }
        item.group.visible = true;
        if (!progress.reduceMotion) {
          const bob = .18 * Math.sin(state.clock * 2.6 + item.index);
          item.gem.position.y = 1.4 + bob;
          item.gem.rotation.y = state.clock * 1.8 + item.index;
          item.orbit.position.y = 1.4 + bob;
          item.orbit.rotation.z = -state.clock * 1.35 + item.index;
        }
      }
      const showSpots = state.mode === 'roam' && !state.race?.active && !showroom.active && !photo.active;
      for (const item of streetSpotProps) {
        if (!showSpots) { item.group.visible = false; continue; }
        const d = distance(p, item.spot);
        if (d > 62) { item.group.visible = false; continue; }
        item.group.visible = true;
        const done = progress.spots.includes(item.spot.id);
        const tint = done ? spotJade : spotAmber;
        item.ringMat.color.copy(tint);
        item.gemMat.color.copy(tint);
        item.ringMat.opacity = (done ? .30 : .52) * clamp((62 - d) / 14, 0, 1);
        item.gem.visible = d > 2.6;
        if (!progress.reduceMotion) {
          item.gem.position.y = 2.25 + .12 * Math.sin(state.clock * 2.4 + item.index);
          item.gem.rotation.y = state.clock * 1.4 + item.index;
        }
      }
      const showRestSpots = !state.vehicle && !state.boat && !state.race?.active && !showroom.active && !photo.active;
      for (const item of restSpotProps) {
        if (!showRestSpots) { item.group.visible = false; continue; }
        const d = distance(p, item.spot);
        if (d > 28) { item.group.visible = false; continue; }
        item.group.visible = true;
        const pulse = progress.reduceMotion ? 1 : (.82 + .18 * Math.sin(state.clock * 2.0 + item.index));
        item.ringMat.opacity = .26 * pulse * clamp((28 - d) / 8, 0, 1);
      }
      const curEv = state.streetEvent;
      const showEvBeacon = Boolean(curEv && (curEv.phase === 'offered' || curEv.phase === 'needCar') && state.mode === 'roam' && !state.race?.active && !showroom.active && !photo.active);
      if (showEvBeacon) {
        const d = distance(p, curEv);
        eventBeacon.group.visible = d < 185;
        if (eventBeacon.group.visible) {
          eventBeacon.group.position.set(curEv.x, world.surfaceHeight(curEv.x, curEv.z), curEv.z);
          const pulse = .5 + .5 * Math.sin(state.clock * 4.2);
          const fade = clamp((185 - d) / 28, 0, 1);
          eventBeacon.ring.scale.setScalar(.92 + .18 * pulse);
          eventBeacon.ringMat.opacity = (.48 + .32 * pulse) * fade;
          eventBeacon.fillMat.opacity = (.10 + .08 * pulse) * fade;
          eventBeacon.gem.visible = d > 2.2;
          eventBeacon.beam.visible = d > 10;
          eventBeacon.beamMat.opacity = .18 * clamp((d - 10) / 20, 0, 1) * fade;
          if (!progress.reduceMotion) {
            eventBeacon.gem.position.y = 2.68 + .16 * Math.sin(state.clock * 3.0);
            eventBeacon.gem.rotation.y = state.clock * 2.1;
          }
        }
      } else {
        eventBeacon.group.visible = false;
      }
      if (state.race?.active) {
        raceStartGate.group.visible = false;
        lakeStartGate.group.visible = false;
        const isLake = state.race.kind === 'lake';
        const curGate = isLake ? LAKE_RACE?.[state.race.index] : RACE?.[RACE_ORDER[state.race.index]];
        const totalGates = isLake ? (LAKE_RACE?.length ?? 0) : RACE_ORDER.length;
        const isFinal = state.race.index === totalGates - 1;
        if (curGate) {
          raceActiveGate.group.visible = true;
          raceActiveGate.group.scale.setScalar(isLake ? 1.32 : 1);
          raceActiveGate.group.position.set(curGate.x, isLake ? .06 : world.surfaceHeight(curGate.x, curGate.z), curGate.z);
          raceActiveGate.group.rotation.y = curGate.yaw;
          const color = isFinal ? raceGold : (isLake ? seaBlue : raceMint);
          raceActiveGate.frameMat.color.copy(color);
          raceActiveGate.fieldMat.color.copy(color);
        } else {
          raceActiveGate.group.visible = false;
        }
        const nextGate = state.race.index + 1 < totalGates
          ? (isLake ? LAKE_RACE?.[state.race.index + 1] : RACE?.[RACE_ORDER[state.race.index + 1]])
          : null;
        if (nextGate) {
          racePreviewGate.group.visible = true;
          racePreviewGate.group.scale.setScalar(isLake ? 1.2 : .92);
          racePreviewGate.group.position.set(nextGate.x, isLake ? .06 : world.surfaceHeight(nextGate.x, nextGate.z), nextGate.z);
          racePreviewGate.group.rotation.y = nextGate.yaw;
        } else {
          racePreviewGate.group.visible = false;
        }
      } else {
        raceActiveGate.group.visible = false;
        racePreviewGate.group.visible = false;
        raceStartGate.group.visible = Boolean(state.mode === 'roam' && !showroom.active && !photo.active &&
          RACE?.length && distance(p, RACE[0]) < 145);
        lakeStartGate.group.visible = Boolean(state.mode === 'roam' && !showroom.active && !photo.active &&
          LAKE_RACE_START && distance(p, LAKE_RACE_START) < 220);
      }
    }
    let cameraInsideActor = false;
    function prepareScene(dt) {
      const view = protagonist();
      if (appliedSetting !== progress.graphics) {
        appliedSetting = progress.graphics;
        safetyMode = null;
        resolution = 1;
        resetFrameSamples();
      }
      const mode = displayMode();
      const profile = profiles[mode];
      if (mode !== appliedMode) {
        appliedMode = mode;
        applyResolution();
        world.setDetail(mode !== 'performance', profile.street);
      }
      world.updateVisibleStreet(camera);
      state.night = world.light(state.hour, state.clock, camera, state.wetness, state.rain,
        { center: view, vehicle: state.vehicle, shadowSize: profile.shadows, extraLights: mode === 'ultra' || mode === 'high', mist: state.mist });
      factory.lighting(state.night);
      traffic?.updateSignals(state.clock, state.night);
      const eye = camera.position;
      const clearance = cameraInsideActor ? .92 : .68;
      const ground = state.boat ? 0 : world.surfaceHeight(view.x, view.z);
      cameraInsideActor = !state.boat && (state.vehicle
        ? !(hoodView > .001 && cameraReach > .995) && eye.y - ground < bodyBounds(state.vehicle).height + .16 &&
          touchesPerson(state.vehicle, eye.x, eye.z, cameraInsideActor ? .32 : .16)
        : eye.y - ground < 2.10 && (eye.x - view.x) ** 2 + (eye.z - view.z) ** 2 < clearance * clearance);
      const carRangeSq = profile.cars * profile.cars;
      for (let i = 0; i < carList.length; i++) {
        const car = carList[i];
        const dx = car.x - view.x, dz = car.z - view.z;
        car.root.visible = (dx * dx + dz * dz < carRangeSq) && !(state.vehicle === car && cameraInsideActor);
        car.root.matrixWorldAutoUpdate = car.root.visible;
        if (car.root.visible) factory.poseCar(car, dt, state.night, state.clock);
      }
      const pedRangeSq = profile.people * profile.people;
      pedEnv.rain = state.rain;
      pedEnv.night = state.night;
      pedEnv.clock = state.clock;
      pedEnv.sheltered = state.sheltered;
      for (let i = 0; i < pedestrians.length; i++) {
        const ped = pedestrians[i];
        const dx = ped.x - view.x, dz = ped.z - view.z;
        ped.root.visible = (dx * dx + dz * dz < pedRangeSq);
        ped.root.matrixWorldAutoUpdate = ped.root.visible;
        if (ped.root.visible) factory.posePerson(ped, dt, ped.visiblePace ?? ped.walk, ped.fleeing, false, eye, pedEnv);
      }
      const activeEv = state.streetEvent;
      const showEvNpc = Boolean(activeEv && (activeEv.phase === 'offered' || activeEv.phase === 'needCar' || activeEv.phase === 'farewell' || (activeEv.phase === 'active' && activeEv.def.kind !== 'ride')));
      eventNpc.root.visible = showEvNpc && (eventNpc.x - view.x) ** 2 + (eventNpc.z - view.z) ** 2 < pedRangeSq;
      eventNpc.root.matrixWorldAutoUpdate = eventNpc.root.visible;
      if (eventNpc.root.visible) factory.posePerson(eventNpc, dt, 0, false, false, eye, pedEnv);
      const showVigNpc = Boolean(state.rest?.active && state.rest.vignette?.active);
      vignetteNpc.root.visible = showVigNpc;
      vignetteNpc.root.matrixWorldAutoUpdate = showVigNpc;
      if (showVigNpc) factory.posePerson(vignetteNpc, dt, vignetteNpc.visiblePace ?? 0, false, false, eye, pedEnv);
      if (state.vehicle?.concept) D.poseConceptDriver(player, state.vehicle);
      else if (player.root.parent !== scene) D.leaveConceptSeat(player, scene);
      if (!state.vehicle && !state.boat) {
        player.root.visible = !cameraInsideActor;
        factory.posePerson(player, dt, player.walking ?? 0, false, false, null, pedEnv);
      }
      if (showVigNpc) syncVignettePropsToHands();
      marine.render(dt, state, false, true);
      drawMarkers();
      factory.updateParticles(dt);
      renderer.shadowMap.needsUpdate = world.sun.castShadow && world.sun.shadow.needsUpdate;
      return state.boat || view.x > 331 || view.z > 319 ? 'water' : 'road';
    }
    function renderShowroom(dt) {
      const car = showroom.car ?? getGarageCar(showroom.kind);
      if (!car) return;
      state.clock += dt;
      if (!showroom.dragging && !progress.reduceMotion) showroom.yaw = angleDiff(showroom.yaw + dt * .24, 0);
      const mode = displayMode();
      const profile = profiles[mode];
      if (mode !== appliedMode) {
        appliedMode = mode;
        applyResolution();
        world.setDetail(mode !== 'performance', profile.street);
      }
      const targetY = world.surfaceHeight(car.x, car.z) + (car.model.kind === 'van' ? 1.05 : .78);
      const angle = car.yaw + showroom.yaw;
      const cosP = Math.cos(showroom.pitch), sinP = Math.sin(showroom.pitch);
      const dist = showroom.distance;
      const fx = -Math.sin(angle), fz = -Math.cos(angle);
      const rx = -fz, rz = fx;
      const pan = camera.aspect > 1.12 ? dist * .25 : 0;
      camera.position.set(car.x - fx * dist * cosP + rx * pan, targetY + dist * sinP, car.z - fz * dist * cosP + rz * pan);
      focus.set(car.x + rx * pan, targetY - .08, car.z + rz * pan);
      camera.lookAt(focus);
      if (Math.abs(camera.fov - 44) > .1) {
        camera.fov = 44;
        camera.updateProjectionMatrix();
      }
      world.updateVisibleStreet(camera);
      const showHour = showroom.night ? 22.1 : 10.6;
      state.night = world.light(showHour, state.clock, camera, showroom.night ? .52 : .06, 0,
        { center: car, vehicle: car, shadowSize: profile.shadows, extraLights: true, mist: 0 });
      factory.lighting(state.night);
      traffic?.updateSignals(state.clock, state.night);
      hideWorldMarkers();
      for (const other of carList) {
        other.root.visible = other === car || distance(other, car) < profile.cars;
        other.root.matrixWorldAutoUpdate = other.root.visible;
        if (other.root.visible) factory.poseCar(other, dt, state.night, state.clock);
      }
      for (const ped of pedestrians) {
        ped.root.visible = distance(ped, car) < profile.people;
        ped.root.matrixWorldAutoUpdate = ped.root.visible;
      }
      player.root.visible = false;
      marine.render(dt, state, false, true);
      factory.updateParticles(dt);
      renderer.shadowMap.needsUpdate = world.sun.castShadow && world.sun.shadow.needsUpdate;
      prepareReflections(camera, state, 'road', true);
      renderScene(camera, { ...state, rain: 0, wetness: showroom.night ? .52 : .06, mist: 0 });
    }
    function renderPhoto(dt, keys) {
      const view = protagonist();
      if (dt > 0 && keys) {
        const panSpeed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 22 : 11) * dt;
        const fwd = Number(Boolean(pressed(keys, 'KeyW', 'ArrowUp'))) - Number(Boolean(pressed(keys, 'KeyS', 'ArrowDown')));
        const right = Number(Boolean(pressed(keys, 'KeyD', 'ArrowRight'))) - Number(Boolean(pressed(keys, 'KeyA', 'ArrowLeft')));
        const lift = Number(Boolean(keys.has('KeyE'))) - Number(Boolean(keys.has('KeyQ')));
        if (fwd || right) {
          const fx = -Math.sin(photo.yaw);
          const fz = -Math.cos(photo.yaw);
          const rx = -fz;
          const rz = fx;
          const len = Math.hypot(fwd, right) || 1;
          photo.targetX += (fx * fwd + rx * right) / len * panSpeed;
          photo.targetZ += (fz * fwd + rz * right) / len * panSpeed;
          const ox = photo.targetX - view.x;
          const oz = photo.targetZ - view.z;
          const dist = Math.hypot(ox, oz);
          if (dist > 65) {
            photo.targetX = view.x + ox * (65 / dist);
            photo.targetZ = view.z + oz * (65 / dist);
          }
        }
        if (lift) photo.targetY += lift * panSpeed * .78;
        const targetGround = world.surfaceHeight(photo.targetX, photo.targetZ);
        photo.targetY = clamp(photo.targetY, targetGround + .35, targetGround + 34);
      }
      const mode = displayMode();
      const profile = profiles[mode];
      if (mode !== appliedMode) {
        appliedMode = mode;
        applyResolution();
        world.setDetail(mode !== 'performance', profile.street);
      }
      const cosP = Math.cos(photo.pitch), sinP = Math.sin(photo.pitch);
      const camX = photo.targetX + Math.sin(photo.yaw) * photo.distance * cosP;
      const camZ = photo.targetZ + Math.cos(photo.yaw) * photo.distance * cosP;
      const camGround = world.surfaceHeight(camX, camZ);
      const camY = Math.max(camGround + .36, photo.targetY + photo.distance * sinP);
      camera.position.set(camX, camY, camZ);
      focus.set(photo.targetX, photo.targetY, photo.targetZ);
      camera.lookAt(focus);
      if (Math.abs(camera.fov - photo.fov) > .05) {
        camera.fov = photo.fov;
        camera.updateProjectionMatrix();
      }
      checkPhotoSubject();
      world.updateVisibleStreet(camera);
      state.night = world.light(state.hour, state.clock, camera, state.wetness, state.rain,
        { center: { x: photo.targetX, z: photo.targetZ }, vehicle: state.vehicle || photo.focusCar, shadowSize: profile.shadows, extraLights: mode === 'ultra' || mode === 'high', mist: state.mist });
      factory.lighting(state.night);
      traffic?.updateSignals(state.clock, state.night);
      hideWorldMarkers();
      const carRangeSq = profile.cars * profile.cars;
      for (let i = 0; i < carList.length; i++) {
        const car = carList[i];
        const dx = car.x - photo.targetX, dz = car.z - photo.targetZ;
        car.root.visible = (dx * dx + dz * dz < carRangeSq) || car === state.vehicle;
        car.root.matrixWorldAutoUpdate = car.root.visible;
        if (car.root.visible) factory.poseCar(car, 0, state.night, state.clock);
      }
      const pedRangeSq = profile.people * profile.people;
      pedEnv.rain = state.rain;
      pedEnv.night = state.night;
      pedEnv.clock = state.clock;
      pedEnv.sheltered = state.sheltered;
      for (let i = 0; i < pedestrians.length; i++) {
        const ped = pedestrians[i];
        const dx = ped.x - photo.targetX, dz = ped.z - photo.targetZ;
        ped.root.visible = (dx * dx + dz * dz < pedRangeSq);
        ped.root.matrixWorldAutoUpdate = ped.root.visible;
        if (ped.root.visible) factory.posePerson(ped, 0, ped.visiblePace ?? ped.walk, ped.fleeing, false, camera.position, pedEnv);
      }
      const photoEv = state.streetEvent;
      const showPhotoEvNpc = Boolean(photoEv && (photoEv.phase === 'offered' || photoEv.phase === 'needCar' || photoEv.phase === 'farewell' || (photoEv.phase === 'active' && photoEv.def.kind !== 'ride')));
      eventNpc.root.visible = showPhotoEvNpc && (eventNpc.x - photo.targetX) ** 2 + (eventNpc.z - photo.targetZ) ** 2 < pedRangeSq;
      eventNpc.root.matrixWorldAutoUpdate = eventNpc.root.visible;
      if (eventNpc.root.visible) factory.posePerson(eventNpc, 0, 0, false, false, camera.position, pedEnv);
      const showPhotoVig = Boolean(state.rest?.active && state.rest.vignette?.active);
      vignetteNpc.root.visible = showPhotoVig;
      vignetteNpc.root.matrixWorldAutoUpdate = showPhotoVig;
      if (showPhotoVig) factory.posePerson(vignetteNpc, 0, 0, false, false, camera.position, pedEnv);
      if (state.vehicle?.concept) D.poseConceptDriver(player, state.vehicle);
      else if (player.root.parent !== scene) D.leaveConceptSeat(player, scene);
      if (!state.vehicle && !state.boat) {
        player.root.visible = true;
        factory.posePerson(player, 0, player.walking ?? 0, false, false, null, pedEnv);
      }
      if (showPhotoVig) syncVignettePropsToHands();
      marine.render(0, state, false, true);
      renderer.shadowMap.needsUpdate = world.sun.castShadow && world.sun.shadow.needsUpdate;
      const surface = state.boat || photo.targetX > 331 || photo.targetZ > 319 ? 'water' : 'road';
      prepareReflections(camera, state, surface, true);
      renderScene(camera, state);
    }
    function render(dt) {
      const surface = prepareScene(dt);
      prepareReflections(camera, state, surface, blendTime < 1 || mountPhase < 1);
      renderScene(camera, state);
    }
    async function uploadVisibleTextures(nextFrame, onStage) {
      const textures = new Set(world.initialTextures);
      textures.add(D.harborReflectionTexture());
      const materials = new Set();
      scene.traverseVisible(object => {
        const material = object.material;
        if (Array.isArray(material)) material.forEach(part => materials.add(part));
        else if (material) materials.add(material);
      });
      for (const material of materials) {
        for (const property of ['map', 'alphaMap', 'normalMap', 'roughnessMap', 'emissiveMap', 'bumpMap']) {
          if (material[property]) textures.add(material[property]);
        }
        for (const uniform of Object.values(material.uniforms ?? {})) {
          if (uniform.value?.isTexture && !uniform.value.isRenderTargetTexture) textures.add(uniform.value);
        }
      }
      let sliceStart = performance.now();
      const maxAniso = renderer.capabilities.getMaxAnisotropy?.() || 8;
      const totalTextures = Math.max(1, textures.size);
      let uploaded = 0;
      for (const texture of textures) {
        uploaded++;
        const source = texture.image;
        if (!source?.width || !source.height || source.complete === false) continue;
        if (texture.anisotropy && texture.anisotropy > maxAniso) texture.anisotropy = maxAniso;
        renderer.initTexture(texture);
        if (performance.now() - sliceStart >= 5) {
          onStage?.(null, 0.86 + (uploaded / totalTextures) * 0.06);
          await nextFrame();
          sliceStart = performance.now();
        }
      }
      onStage?.(null, 0.92);
    }
    async function drawOpeningMaterials(nextFrame) {
      const samples = new T.Group();
      samples.position.y = -3000;
      const materials = new Set();
      function include(mesh) {
        if (!mesh.isMesh || materials.has(mesh.material)) return;
        const sample = mesh.clone(false);
        if (sample.isSkinnedMesh) sample.bindMode = 'detached';
        sample.frustumCulled = false;
        sample.castShadow = false;
        samples.add(sample);
        materials.add(mesh.material);
      }
      // Use the real render targets and lights. The fabric on passers-by can
      // otherwise link on the first frame a pedestrian comes around a corner.
      const passerby = pedestrians[0]?.root.getObjectByProperty('isSkinnedMesh', true);
      if (passerby) include(passerby);
      const courier = player.root.getObjectByProperty('isSkinnedMesh', true);
      if (courier) include(courier);
      const coupe = carList.find(car => car.concept?.full);
      coupe?.sprungBody.traverse(include);
      coupe?.wheels[0].hub.traverse(include);
      scene.add(samples);
      try { render(0); } finally { scene.remove(samples); }
      // A submitted first frame can still leave the GPU uploading the visible
      // models. Keep painting the loading screen while that frame completes.
      if (!gl.fenceSync) return;
      const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!fence) return;
      try {
        gl.flush();
        const until = performance.now() + 1200;
        while (performance.now() < until && gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED) await nextFrame();
      } finally { gl.deleteSync(fence); }
    }
    async function firstDraw(nextFrame, onStage) {
      prepareScene(0);
      onStage?.('正在准备画面…', 0.85);
      const mode = displayMode();
      if (mode === 'ultra' || mode === 'high') {
        prepareReflections.warmup?.();
        await nextFrame();
      }
      onStage?.(null, 0.86);
      await uploadVisibleTextures(nextFrame, onStage);
      await nextFrame();
      onStage?.(null, 0.93);
      if (typeof renderer.compileAsync === 'function') {
        await renderer.compileAsync(scene, camera);
      } else {
        renderer.compile(scene, camera);
      }
      renderScene.warmup?.(camera);
      const programs = renderer.info.programs.slice();
      const parallel = gl.getExtension('KHR_parallel_shader_compile');
      onStage?.(null, 0.94);
      await nextFrame();
      if (parallel) {
        const until = performance.now() + 8000;
        const totalPrograms = Math.max(1, programs.length);
        while (performance.now() < until &&
            programs.some(shader => !gl.getProgramParameter(shader.program, parallel.COMPLETION_STATUS_KHR))) {
          let ready = 0;
          for (const shader of programs) {
            if (gl.getProgramParameter(shader.program, parallel.COMPLETION_STATUS_KHR)) ready++;
          }
          onStage?.(null, 0.94 + (ready / totalPrograms) * 0.04);
          await nextFrame();
        }
      } else {
        // Drivers with synchronous linking can release the main thread between programs.
        let batchStart = performance.now();
        const totalPrograms = Math.max(1, programs.length);
        let linked = 0;
        for (const shader of programs) {
          linked++;
          gl.getProgramParameter(shader.program, gl.LINK_STATUS);
          if (performance.now() - batchStart < 8) continue;
          onStage?.(null, 0.94 + (linked / totalPrograms) * 0.04);
          await nextFrame();
          batchStart = performance.now();
        }
      }
      onStage?.(null, 0.98);
      resize();
      await drawOpeningMaterials(nextFrame);
      onStage?.(null, 1);
    }
    function applyResolution() {
      const profile = profiles[displayMode()];
      const pixelBudget = Math.sqrt(profile.pixels / Math.max(1, width * height));
      const ratio = Math.min(devicePixelRatio || 1, profile.ratio * resolution, pixelBudget * Math.min(1, resolution));
      if (bufferWidth === width && bufferHeight === height && Math.abs(bufferRatio - ratio) < .015) return;
      renderer.setDrawingBufferSize(width, height, ratio);
      bufferWidth = width;
      bufferHeight = height;
      bufferRatio = ratio;
    }
    function resetFrameSamples() {
      frameTime = sampleFrames = slowWindows = clearWindows = worstGap = hitchDebt = 0;
      frameWarmup = 2.0;
    }
    function lowerQuality() {
      const mode = displayMode();
      if (mode === 'performance') return false;
      if (progress.graphics === 'ultra') return false;
      safetyMode = mode === 'ultra' ? 'high' : (mode === 'high' && initialMode !== 'performance' ? 'balanced' : 'performance');
      resolution = Math.min(.94, resolution);
      resetFrameSamples();
      return true;
    }
    function sampleFrame(gap) {
      if (!(gap > 0)) return;
      if (frameWarmup > 0) {
        frameWarmup -= Math.min(.14, gap);
        return;
      }
      hitchDebt = Math.max(0, hitchDebt - gap * .8) + Number(gap >= .22);
      if ((gap >= .65 || hitchDebt >= 1.65) && lowerQuality()) return;
      frameTime += Math.min(gap, .65);
      worstGap = Math.max(worstGap, gap);
      sampleFrames++;
      if (frameTime < 1.5) return;
      const fps = sampleFrames / frameTime;
      const steady = fps >= frameTarget * 1.18 && worstGap < .052;
      frameTime = sampleFrames = worstGap = 0;
      if (fps >= frameTarget * .82) {
        slowWindows = 0;
        clearWindows = steady ? clearWindows + 1 : 0;
        if (clearWindows >= 4) {
          clearWindows = 0;
          const cap = displayMode() === 'performance' ? Math.min(1.5, .98 / profiles.performance.ratio) : 1;
          if (resolution < cap - .01) {
            resolution = Math.min(cap, resolution + .09);
            applyResolution();
          }
        }
        return;
      }
      clearWindows = 0;
      if (++slowWindows >= 2 && lowerQuality()) return;
      const floor = displayMode() === 'performance' ? .78 : .72;
      if (resolution > floor + .015) {
        resolution = Math.max(floor, resolution - .11);
        applyResolution();
      }
    }
    function resize() {
      const w = Math.max(2, canvas.clientWidth);
      const h = Math.max(2, canvas.clientHeight);
      if (w !== width || h !== height) {
        width = w;
        height = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        resetFrameSamples();
      }
      applyResolution();
    }
    function recoverGraphics() {
      renderer.setRenderTarget(null);
      prepareReflections.reset();
      appliedSetting = progress.graphics;
      safetyMode = 'performance';
      appliedMode = '';
      bufferRatio = 0;
      resolution = .94;
      resetFrameSamples();
      resize();
    }
    function repaint() {
      if (showroom.active) renderShowroom(0);
      else if (photo.active) renderPhoto(0, null);
      else if (state.active) render(0);
    }
    let wasRunning = false;
    function update(dt, keys, running, frameGap = dt) {
      if (running && !wasRunning) resetFrameSamples();
      wasRunning = running;
      if (showroom.active) {
        renderShowroom(Math.min(dt, .05));
      } else if (photo.active) {
        renderPhoto(Math.min(dt, .05), keys);
      } else if (running) {
        sampleFrame(frameGap);
        // Preserve walking speed through ordinary slow frames. The finite
        // budget still bounds catch-up work after a suspended browser tab.
        const span = Math.min(dt, 8 * .017);
        const chunks = Math.max(1, Math.ceil(span / .017));
        for (let i = 0; i < chunks; i++) step(span / chunks, keys);
        updateCamera(span);
        render(span);
      }
      audio.tick({ paused: !running, car: state.vehicle ?? state.boat, throttle: state.throttle, clock: state.clock, rain: state.rain, engineOff: Boolean(state.rest?.active) });
      rainSound.tick(state, running, progress.sound, state.sheltered);
    }
    function projectTarget() {
      if (state.rest?.active) return null;
      const aim = state.target;
      if (!aim) return null;
      const d = distance(aim, protagonist());
      if (d <= 6 || d > (aim.marine || aim.race ? 260 : 173)) return null;
      targetVector.set(aim.x, aim.water ? 3.5 : aim.race ? 7.2 : 3.7, aim.z).project(camera);
      if (targetVector.z < 0 || targetVector.z > 1 || Math.abs(targetVector.x) > .91 || Math.abs(targetVector.y) > .78) return null;
      return { x: (targetVector.x + 1) / 2, y: (1 - targetVector.y) / 2, d, label: aim.label, taxi: aim.taxi, workshop: aim.workshop, marine: aim.marine, race: aim.race, tape: aim.tape, streetEvent: aim.streetEvent };
    }
    function projectChatter() {
      const c = state.chatter;
      if (!c || state.clock >= c.until || showroom.active || photo.active || state.race?.active || state.rest?.active) return null;
      const ax = c.ped ? c.ped.x : c.x;
      const az = c.ped ? c.ped.z : c.z;
      const ay = c.ped ? (world.surfaceHeight(ax, az) + 2.28) : c.y;
      const d = distance({ x: ax, z: az }, protagonist());
      if (d > 26) return null;
      chatterVector.set(ax, ay, az).project(camera);
      if (chatterVector.z < 0 || chatterVector.z > 1 || Math.abs(chatterVector.x) > .84 || Math.abs(chatterVector.y) > .76) return null;
      const fadeIn = clamp((state.clock - c.startedAt) / .35, 0, 1);
      const fadeOut = clamp((c.until - state.clock) / .65, 0, 1);
      return { x: (chatterVector.x + 1) / 2, y: (1 - chatterVector.y) / 2, who: c.who, text: c.text, alpha: Math.min(fadeIn, fadeOut) };
    }
    function turnCamera(delta, pitch = 0, orbit = false) {
      if (state.rest?.active) {
        state.rest.orbitOffset = angleDiff((state.rest.orbitOffset || 0) + delta, 0);
        state.viewPitch = clamp(state.viewPitch + pitch, -.45, .52);
        state.lastLook = state.clock;
        return;
      }
      if (state.vehicle || state.boat) {
        if (delta || pitch) orbitSubject = state.vehicle ?? state.boat;
        const yaw = state.freeYaw + delta;
        if (orbit && state.cameraMode !== 2) state.freeYaw = angleDiff(yaw, 0);
        else {
          const limit = state.cameraMode === 2 ? 1.52 : 1.6;
          // A drag immediately after entering the hood view can start beyond its limit.
          state.freeYaw = clamp(yaw, Math.min(-limit, state.freeYaw), Math.max(limit, state.freeYaw));
        }
      } else state.viewYaw = angleDiff(state.viewYaw + delta, 0);
      state.viewPitch = clamp(state.viewPitch + pitch, -.66, .54);
      state.lastLook = state.clock;
    }
    function holdCamera(active) {
      state.lookHeld = active;
      state.lastLook = state.clock;
    }
    function toggleStation() {
      audio.start();
      state.playingTape = null;
      state.station = audio.toggleStation();
    }
    function switchTime() {
      let periodLabel;
      if (state.hour >= 5.2 && state.hour < 8.4) {
        state.hour = 10.4;
        periodLabel = '晴空白昼';
      } else if (state.hour >= 8.4 && state.hour < 15.6) {
        state.hour = 17.45;
        periodLabel = '黄昏暮色';
      } else if (state.hour >= 15.6 && state.hour < 19.5) {
        state.hour = 21.6;
        periodLabel = '古城夜色';
      } else {
        state.hour = 6.45;
        periodLabel = '晨曦微露';
      }
      announce('时段切换', periodLabel, '晨曦 / 白昼 / 暮色 / 夜幕循环切换（快捷键 N）', 2.4);
      audio.note();
    }
    function switchWeather() {
      state.weather = (state.weather + 1) % WEATHER.length;
      const current = WEATHER[state.weather];
      announce('天气切换', current.name, '晴朗 / 晨雾 / 雨后 / 阵雨循环切换（快捷键 X）', 2.4);
      audio.note();
    }
    resize();
    return { state, world, cars: carList, pedestrians, traffic, boats: marine.fleet, taxi, resize, repaint, recoverGraphics, update, start, switchMode, context, handleInteraction, resetPosition,
      protagonist, projectTarget, projectChatter, turnCamera, holdCamera, switchTime, toggleStation,
      roadGuide: roadNavigation.current,
      switchWeather,
      setSound: audio.setEnabled, cycleCamera,
      setLandmarkTarget, fastTravelToLandmark, nearestUnvisitedLandmark, navigateNearestUnvisited,
      nearestUncollectedTape, setTapeTarget, playTape, stopTape, cycleCollectedTape, navigatePhotoSpot,
      startRingRace, startLakeRace, cancelRingRace, cancelRace: cancelRingRace, RACE_ORDER,
      navigateWorkshop, getGarageCar, applyGarageKind, buyUpgrade, selectVisual, summonVehicle, quickSummonVehicle,
      setShowroom, orbitShowroom, zoomShowroom, setShowroomNight, showroom,
      setPhotoMode, orbitPhoto, zoomPhoto, setPhotoFov, setPhotoHour, setPhotoWeather, setPhotoFilter, setPhotoPostcard, setPhotoCarLights, checkPhotoSubject, resetPhotoCamera, capturePhoto, capturePhotoResult, photo, PHOTO_FILTERS,
      honkHorn, toggleVehicleLights, interactStreetSpot, releaseSkyLantern, releasedLanterns, activeBuff, STREET_SPOTS,
      REST_SPOTS, REST_AMBIENTS, enterRestMode, exitRestMode, toggleRestMode, setRestTimeScale, cycleRestTimeScale, toggleRestUi,
      setRestAmbient, cycleRestAmbient, ambientStatus, fastTravelToRestSpot, setRestSpotTarget,
      REST_VIGNETTES, startRestVignette, stopRestVignette, toggleRestVignette, vignetteNpc,
      vignetteAudioStatus: () => audio.getVignetteAudio?.() ?? '',
      STREET_EVENTS, spawnStreetEvent, cancelStreetEvent, eventNpc, eventBeacon,
      cashText };
  }

  Object.assign(D, { createSimulation, WEATHER, WORKSHOP });
})();
