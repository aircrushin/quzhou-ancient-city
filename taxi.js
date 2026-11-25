(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;
  const Y = window.QuzhouRoadData || window.YulinRoadData;
  const PI = Math.PI;
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const smoothstep = t => t * t * (3 - 2 * t);
  const heading = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);

  // 出租车使用轿车型车体，但换成独立车型，避免改动共享 CARS 定义。
  const TAXI_MODEL = {
    ...D.CARS[2],
    name: '衢州出租 · TAXI',
    kind: 'taxi',
    color: '#f2c53d',
    top: 25,
    power: 8.2,
    grip: 9.1,
  };
  const PALETTE = [
    ['#b4765c', '#384654', '#d9a77c'], ['#6b8497', '#313b4b', '#c08f6a'],
    ['#9c6f82', '#443c4d', '#dfb189'], ['#77927a', '#3b4650', '#b98662'],
    ['#c0a477', '#444955', '#e0b994'],
  ];

  const signTexCache = new Map();
  function textTexture(tier = 0) {
    const key = tier >= 4 ? 2 : tier >= 2 ? 1 : 0;
    if (signTexCache.has(key)) return signTexCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = key === 2 ? '#1f1608' : key === 1 ? '#112229' : '#171a1f';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = key === 2 ? '#ffcf54' : key === 1 ? '#64f2d6' : '#ffd34f';
    ctx.fillRect(4, 4, 248, 56);
    if (key === 2) {
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, 240, 48);
    }
    ctx.fillStyle = key === 2 ? '#231607' : key === 1 ? '#0e1f24' : '#171a1f';
    ctx.font = 'bold 27px "Microsoft YaHei UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = key === 2 ? '南孔尊享 · VIP' : key === 1 ? '智行专车 · TAXI' : '衢州出租 · TAXI';
    ctx.fillText(label, 128, 34);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    signTexCache.set(key, texture);
    return texture;
  }

  const outline = points => points.map(([x, y]) => new T.Vector2(x, y));
  const DOOR_LENGTH = 1.36;
  const DOOR_HINGE_Z = .68;
  const DOOR_SWING = .95;
  const GLASS_OUTLINE = [[.09, .03], [.42, .37], [1.29, .37], [1.30, .03]];

  /**
   * 出租车系统。所有与单个模拟实例的绑定都通过依赖注入完成，
   * 避免修改原游戏里复杂的车辆/任务系统内部实现。
   */
  function createTaxiSystem(opts) {
    const {
      scene, world, factory, state, progress, random, cars, onSave, announce, say,
      audio, spawnCar, cashText, clearForPerson, HUB,
    } = opts;
    const taxi = {
      active: false,
      phase: 'idle', // idle | toPickup | boarding | onTrip | droppingOff | between
      fare: null,
      anim: null,
      nextAt: 0,
      stats: progress.taxi ?? (progress.taxi = { trips: 0, earned: 0, best: 0 }),
    };
    let car = null;
    let rider = null;
    let riderRing = null;
    let doors = { '-1': null, '1': null };
    let doorSide = 1;
    let sideMarker = null;
    let spawnPoint = null;
    let settled = false;
    let doorPaintMat = null;
    let roofTierBuilt = -1;

    const rightVector = yaw => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });
    const forwardVector = yaw => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
    const stopCar = () => {
      if (!car) return;
      car.vx = car.vz = car.speed = car.pace = car.brake = car.reverseWait = 0;
      car.steer = car.lean = car.roll = 0;
    };
    const taxiConfig = () => progress.garage?.taxi ?? D.defaultVehicleConfig('taxi');
    const taxiStats = () => D.computeCarStats(TAXI_MODEL, taxiConfig());
    const color = () => {
      const paintId = taxiConfig().paint;
      return D.PAINTS?.find(p => p.id === paintId)?.color ?? progress.taxiColor ?? '#f2c53d';
    };

    function buildRoofSign(tier = 0) {
      if (!car) return;
      if (car.taxiRoof) {
        car.sprungBody.remove(car.taxiRoof);
        car.taxiRoof = null;
      }
      const key = tier >= 4 ? 2 : tier >= 2 ? 1 : 0;
      roofTierBuilt = key;
      const trimMat = new T.MeshStandardMaterial({ color: key === 2 ? '#292014' : '#1a1f24', roughness: .42, metalness: key === 2 ? .65 : .15 });
      const signBox = new T.MeshStandardMaterial({
        color: key === 2 ? '#ffd666' : key === 1 ? '#57e3cc' : '#ffd34f',
        roughness: .28,
        metalness: key === 2 ? .45 : .12,
        emissive: key === 2 ? '#9c6700' : key === 1 ? '#116e63' : '#7a4c00',
        emissiveIntensity: key === 2 ? .88 : key === 1 ? .72 : .55,
      });
      const signFace = new T.MeshBasicMaterial({ map: textTexture(tier), toneMapped: false });
      const roof = new T.Group();
      roof.position.set(0, 1.565, -.22);
      const baseW = key === 2 ? .92 : key === 1 ? .82 : .72;
      const base = new T.Mesh(new T.BoxGeometry(baseW, .03, .34), trimMat);
      base.position.y = .015;
      const halfTop = key === 2 ? .34 : key === 1 ? .30 : .26;
      const halfBot = key === 2 ? .40 : key === 1 ? .35 : .31;
      const housingGeometry = new T.ExtrudeGeometry(new T.Shape(outline([[-halfBot, 0], [halfBot, 0], [halfTop, .17], [-halfTop, .17]])), {
        depth: .24, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 1,
      });
      housingGeometry.translate(0, 0, -.12);
      const housing = new T.Mesh(housingGeometry, signBox);
      housing.position.y = .042;
      const cap = new T.Mesh(new T.BoxGeometry(halfTop * 1.95, .014, .26), trimMat);
      cap.position.y = .23;
      roof.add(base, housing, cap);
      if (key >= 1) {
        const stripMat = new T.MeshBasicMaterial({ color: key === 2 ? '#ffe082' : '#7bf7e2', toneMapped: false });
        for (const side of [-1, 1]) {
          const accent = new T.Mesh(new T.BoxGeometry(.05, .04, .27), stripMat);
          accent.position.set(side * (halfBot + .04), .06, 0);
          roof.add(accent);
        }
      }
      for (const end of [-1, 1]) {
        const face = new T.Mesh(new T.PlaneGeometry(key === 2 ? .58 : key === 1 ? .52 : .46, .118), signFace);
        face.position.set(0, .127, end * .134);
        face.rotation.y = end > 0 ? 0 : PI;
        roof.add(face);
      }
      car.sprungBody.add(roof);
      car.taxiRoof = roof;
    }

    function decorate() {
      if (!car || car.taxiDecorated) return;
      car.taxiDecorated = true;
      const body = car.sprungBody;
      const paintMat = new T.MeshStandardMaterial({ color: car.color, roughness: .38, metalness: .18 });
      doorPaintMat = paintMat;
      const glassMat = new T.MeshStandardMaterial({ color: '#1d2830', roughness: .08, metalness: .1, transparent: true, opacity: .62 });
      const trimMat = new T.MeshStandardMaterial({ color: '#1a1f24', roughness: .7, metalness: .05 });
      const cabinMat = new T.MeshStandardMaterial({ color: '#2c3036', roughness: .86 });
      const chromeMat = new T.MeshStandardMaterial({ color: '#c8ccc8', roughness: .24, metalness: .85 });
      const checkerMats = [
        new T.MeshStandardMaterial({ color: '#f4ecd0', roughness: .4 }),
        new T.MeshStandardMaterial({ color: '#1b1d21', roughness: .4 }),
      ];
      buildRoofSign(taxiStats().taxiTechLevel);

      const frameShape = new T.Shape(outline([[.02, 0], [.40, .41], [1.32, .41], [1.34, 0]]));
      frameShape.holes.push(new T.Path(outline(GLASS_OUTLINE)));
      const frameGeometry = new T.ExtrudeGeometry(frameShape, { depth: .024, bevelEnabled: false });
      frameGeometry.translate(0, 0, -.012);
      const glassGeometry = new T.ExtrudeGeometry(new T.Shape(outline(GLASS_OUTLINE)), { depth: .008, bevelEnabled: false });
      glassGeometry.translate(0, 0, -.004);
      const cellGeometry = new T.BoxGeometry(.012, .05, .11);
      function makeDoor(side) {
        const pivot = new T.Group();
        pivot.position.set(side * 1.004, 0, DOOR_HINGE_Z);
        const skin = new T.Mesh(new T.BoxGeometry(.032, .57, DOOR_LENGTH), paintMat);
        skin.position.set(0, .695, -DOOR_LENGTH / 2);
        const card = new T.Mesh(new T.BoxGeometry(.02, .5, DOOR_LENGTH - .1), cabinMat);
        card.position.set(-side * .026, .7, -DOOR_LENGTH / 2);
        const armrest = new T.Mesh(new T.BoxGeometry(.07, .04, .46), trimMat);
        armrest.position.set(-side * .06, .82, -.78);
        const belt = new T.Mesh(new T.BoxGeometry(.04, .025, DOOR_LENGTH - .02), trimMat);
        belt.position.set(-side * .006, .99, -DOOR_LENGTH / 2);
        const pane = new T.Group();
        pane.position.set(-side * .012, 1.0, 0);
        pane.rotation.z = side * .27;
        const frame = new T.Mesh(frameGeometry, trimMat);
        const glass = new T.Mesh(glassGeometry, glassMat);
        frame.rotation.y = glass.rotation.y = PI / 2;
        pane.add(frame, glass);
        const handle = new T.Mesh(new T.BoxGeometry(.026, .034, .17), chromeMat);
        handle.position.set(side * .02, .86, -1.16);
        pivot.add(skin, card, armrest, belt, pane, handle);
        for (let cell = 0; cell < 18; cell++) {
          const z = -.935 + cell * .11;
          if (Math.abs(z) + .055 > DOOR_HINGE_Z) continue;
          for (let row = 0; row < 2; row++) {
            const square = new T.Mesh(cellGeometry, checkerMats[(cell + row) % 2]);
            square.position.set(side * .022, .716 + row * .05, z - DOOR_HINGE_Z);
            pivot.add(square);
          }
        }
        const aperture = new T.Mesh(new T.BoxGeometry(.016, .55, DOOR_LENGTH - .02), cabinMat);
        aperture.position.set(side * 1.014, .695, DOOR_HINGE_Z - DOOR_LENGTH / 2);
        pivot.userData.aperture = aperture;
        body.add(pivot, aperture);
        setDoor(pivot, 0);
        return pivot;
      }
      doors['-1'] = makeDoor(-1);
      doors['1'] = makeDoor(1);
      car.taxiDoors = doors;
      car.onPaintSync = (hex, finish) => {
        if (!doorPaintMat) return;
        doorPaintMat.color.set(hex);
        if (finish) {
          doorPaintMat.roughness = finish.roughness;
          doorPaintMat.metalness = finish.metalness;
        }
        doorPaintMat.needsUpdate = true;
      };
      car.onTaxiUpgradeSync = stats => {
        const key = stats.taxiTechLevel >= 4 ? 2 : stats.taxiTechLevel >= 2 ? 1 : 0;
        if (key !== roofTierBuilt) buildRoofSign(stats.taxiTechLevel);
      };
    }

    function syncUpgrades(overrideConfig) {
      if (!car) return;
      D.applyCarUpgrades3D?.(car, overrideConfig ?? taxiConfig(), factory);
    }

    function ensureCar() {
      if (!car) {
        spawnPoint = chooseSpawn();
        car = spawnCar(TAXI_MODEL, spawnPoint.x, spawnPoint.z, spawnPoint.yaw, 'parked', color());
        decorate();
        syncUpgrades();
      }
      return car;
    }

    function clearDoors() {
      setDoor(doors['-1'], 0);
      setDoor(doors['1'], 0);
    }

    function setDoor(pivot, angle) {
      if (!pivot) return;
      pivot.rotation.y = Math.abs(angle) < .002 ? 0 : angle;
      const open = pivot.rotation.y !== 0;
      pivot.visible = open;
      if (pivot.userData.aperture) pivot.userData.aperture.visible = open;
    }

    function chooseSpawn() {
      const candidates = [
        { x: HUB.x - 8.2, z: HUB.z - 2.4, yaw: PI * .5 },
        { x: HUB.x - 9.6, z: HUB.z + 3.8, yaw: PI * .5 },
        { x: HUB.x + 8.4, z: HUB.z + 4.6, yaw: -PI * .5 },
        { x: HUB.x - 4.4, z: HUB.z - 9.2, yaw: 0 },
        { x: HUB.x + 6.2, z: HUB.z + 8.6, yaw: PI },
        { x: HUB.x - 12.1, z: HUB.z - 1.1, yaw: PI * .5 },
      ];
      const nearbyCars = p => cars.some(other => other !== car && dist(other, p) < 6.2);
      const clear = p => !world.collision(p.x, p.z, 2.45) && !nearbyCars(p);
      const runway = p => {
        const forward = forwardVector(p.yaw);
        for (const length of [7, 11, 15]) {
          const q = { x: p.x + forward.x * length, z: p.z + forward.z * length };
          if (world.collision(q.x, q.z, 2.2)) return false;
          if (cars.some(other => other !== car && dist(other, q) < 3.8)) return false;
        }
        return true;
      };
      return candidates.find(p => clear(p) && runway(p)) ?? candidates.find(clear) ?? candidates[0];
    }

    function placeRider(point, side) {
      if (rider) {
        scene.remove(rider.root);
        rider = null;
      }
      const [shirt, pants, skin] = PALETTE[Math.floor(random() * PALETTE.length)];
      rider = factory.person(shirt, pants, skin);
      rider.root.visible = true;
      rider.x = point.x;
      rider.z = point.z;
      rider.yaw = heading(point, car ? car : point);
      rider.scaleY = 1;
      rider.root.scale.y = 1;
      rider.crouching = false;
      if (!riderRing) {
        riderRing = new T.Mesh(
          new T.RingGeometry(.55, .69, 32).rotateX(-PI / 2),
          new T.MeshBasicMaterial({ color: '#ffd35c', transparent: true, opacity: .88, side: T.DoubleSide, depthWrite: false })
        );
        riderRing.layers.set(1);
        scene.add(riderRing);
      }
      riderRing.visible = true;
      sideMarker = side ?? 1;
    }

    function hideRider() {
      if (!rider) return;
      rider.root.visible = false;
      if (riderRing) riderRing.visible = false;
    }

    function sidewalkPoint(point, edge, fallbackYaw = 0) {
      if (edge && Number.isFinite(edge.ux)) {
        for (const side of [1, -1]) {
          const gap = edge.width * .5 + 2.05;
          const p = { x: point.x + edge.uz * gap * side, z: point.z - edge.ux * gap * side };
          if (!world.collision(p.x, p.z, .72) && !Y?.inAnyWater?.(p.x, p.z, 1.2)) return p;
        }
      }
      for (const angle of [fallbackYaw + PI / 2, fallbackYaw - PI / 2, fallbackYaw, fallbackYaw + PI]) {
        const p = { x: point.x + Math.sin(angle) * 2.4, z: point.z + Math.cos(angle) * 2.4 };
        if (!world.collision(p.x, p.z, .72) && !Y?.inAnyWater?.(p.x, p.z, 1.2)) return p;
      }
      return point;
    }

    function edgeName(edge, point) {
      if (edge?.name) return edge.name;
      const near = Y?.nearestRoad(point.x, point.z);
      return near?.edge?.name || Y?.districtOf(point) || '衢州古城街巷';
    }

    function makeFare() {
      const edges = Y?.EDGES ?? [];
      const nodes = Y?.NODES ?? [];
      const landmarks = (Y?.LANDMARKS ?? []).filter(lm => lm.id !== 'yanjiayu');
      const stats = taxiStats();
      const isVip = landmarks.length >= 2 && random() < stats.vipChance;
      let pickup = null, dropoff = null, pickupEdge = null, dropoffEdge = null;
      let pickupCustomName = null, dropoffCustomName = null;
      if (isVip) {
        for (let attempt = 0; attempt < 24; attempt++) {
          const a = landmarks[Math.floor(random() * landmarks.length)];
          const b = landmarks[Math.floor(random() * landmarks.length)];
          if (!a || !b || a.id === b.id) continue;
          const span = dist({ x: a.navX ?? a.x, z: a.navZ ?? a.z }, { x: b.navX ?? b.x, z: b.navZ ?? b.z });
          if (span < 140) continue;
          const nearA = Y?.nearestRoad(a.navX ?? a.x, a.navZ ?? a.z);
          const nearB = Y?.nearestRoad(b.navX ?? b.x, b.navZ ?? b.z);
          if (!nearA || !nearB) continue;
          pickup = sidewalkPoint(nearA, nearA.edge, nearA.edge?.yaw ?? 0);
          dropoff = sidewalkPoint(nearB, nearB.edge, nearB.edge?.yaw ?? 0);
          pickupEdge = nearA.edge;
          dropoffEdge = nearB.edge;
          pickupCustomName = a.name;
          dropoffCustomName = b.name;
          break;
        }
      }
      for (let attempt = 0; !pickup && attempt < 60; attempt++) {
        const edge = edges[Math.floor(random() * edges.length)];
        if (!edge || edge.length < 24) continue;
        const t = .18 + random() * .64;
        const raw = { x: mix(edge.a.x, edge.b.x, t), z: mix(edge.a.z, edge.b.z, t) };
        if (world.collision(raw.x, raw.z, .68) || Y?.inAnyWater?.(raw.x, raw.z, 1.2)) continue;
        const from = sidewalkPoint(raw, edge, edge.yaw);
        if (Y?.inAnyWater?.(from.x, from.z, 1.0)) continue;
        const node = nodes[Math.floor(random() * nodes.length)];
        if (!node) continue;
        const span = dist(from, node);
        if (span < 150 || span > 430) continue;
        const targetEdge = node.edges?.length ? node.edges[Math.floor(random() * node.edges.length)].edge : null;
        const anchor = targetEdge
          ? { x: mix(targetEdge.a.x, targetEdge.b.x, .25 + random() * .5), z: mix(targetEdge.a.z, targetEdge.b.z, .25 + random() * .5) }
          : node;
        if (world.collision(anchor.x, anchor.z, .72) || Y?.inAnyWater?.(anchor.x, anchor.z, 1.2)) continue;
        const to = sidewalkPoint(anchor, targetEdge, targetEdge?.yaw ?? 0);
        if (Y?.inAnyWater?.(to.x, to.z, 1.0)) continue;
        if (dist(from, to) < 140) continue;
        pickup = from;
        dropoff = to;
        pickupEdge = edge;
        dropoffEdge = targetEdge;
        break;
      }
      if (!pickup) {
        pickup = Y?.IS_OSM_QUZHOU ? { x: -152.4, z: -75.4 } : { x: -272, z: -98 };
        dropoff = Y?.IS_OSM_QUZHOU ? { x: 157.6, z: 1.7 } : { x: 323.4, z: 114.4 };
        pickupEdge = edges.find(e => e.name?.includes('县西街')) ?? edges[0];
        dropoffEdge = edges[0];
      }
      const pickupLabel = pickupCustomName || edgeName(pickupEdge, pickup);
      const dropoffLabel = dropoffCustomName || edgeName(dropoffEdge, dropoff);
      const route = Y?.routeBetween ? Y.routeBetween(pickup, dropoff) : [];
      let routeLength = dist(pickup, dropoff) * 1.22;
      if (route.length > 1) {
        routeLength = 0;
        for (let i = 1; i < route.length; i++) routeLength += dist(route[i - 1], route[i]);
      }
      const distanceKm = Math.max(1, Math.round(routeLength / 100));
      const night = state.hour >= 22 || state.hour < 6;
      const vip = Boolean(pickupCustomName && dropoffCustomName);
      const vipMult = vip ? 1.45 : 1;
      const base = Math.round((12 + (night ? 4 : 0)) * stats.fareMult * vipMult);
      const distanceFee = Math.round(distanceKm * 5.6 * stats.fareMult * vipMult);
      const tip = Math.round((6 + Math.floor(random() * 14)) * stats.tipMult * vipMult);
      const eta = Math.max(24, Math.round(routeLength / 10.5 + 14));
      return {
        pickup: { ...pickup, label: pickupLabel, district: Y?.districtOf(pickup) ?? '' },
        dropoff: { ...dropoff, label: dropoffLabel, district: Y?.districtOf(dropoff) ?? '' },
        base, distanceFee, tip, total: base + distanceFee + tip,
        distanceKm, routeLength, night, vip, eta,
        comfort: 100, bumps: 0,
        startedAt: null, id: Math.floor(random() * 1e6),
      };
    }

    function dispatch(reason) {
      if (!taxi.active) return;
      const fare = makeFare();
      taxi.fare = fare;
      taxi.phase = 'toPickup';
      taxi.anim = null;
      taxi.nextAt = 0;
      settled = false;
      clearDoors();
      placeRider(fare.pickup);
      rider.yaw = heading(fare.pickup, car ?? fare.dropoff);
      const tag = fare.vip ? 'VIP 专线派单' : '出租车派单';
      const title = (fare.vip ? '尊享 · ' : reason === 'next' ? '新单 · ' : '接单 · ') + fare.pickup.label;
      announce(tag, title,
        '前往' + fare.pickup.label + '接乘客 · 预计 ' + cashText(fare.total), 4.8);
      say('衢州出租调度', (fare.vip ? '古城景区 VIP 尊享单！' : '') + '乘客在' + fare.pickup.label + '路边等你。停稳后按 E 开门接人，再送到' + fare.dropoff.label + '。', 8.2);
      audio.note();
    }

    function begin() {
      taxi.active = true;
      taxi.phase = 'between';
      taxi.fare = null;
      taxi.anim = null;
      taxi.nextAt = 0;
      settled = false;
      spawnPoint = chooseSpawn();
      if (!car) {
        car = spawnCar(TAXI_MODEL, spawnPoint.x, spawnPoint.z, spawnPoint.yaw, 'parked', color());
      } else {
        Object.assign(car, { x: spawnPoint.x, z: spawnPoint.z, yaw: spawnPoint.yaw, type: 'parked' });
      }
      decorate();
      syncUpgrades();
      stopCar();
      clearDoors();
      hideRider();
      const right = rightVector(car.yaw);
      let spot = { x: car.x + right.x * 3.15, z: car.z + right.z * 3.15 };
      if (!clearForPerson(spot.x, spot.z, car)) {
        spot = { x: car.x - right.x * 3.15, z: car.z - right.z * 3.15 };
      }
      dispatch('first');
      return { x: spot.x, z: spot.z, yaw: heading(spot, car) };
    }

    function end() {
      taxi.active = false;
      taxi.anim = null;
      taxi.fare = null;
      hideRider();
      clearDoors();
      stopCar();
    }

    function reset() {
      if (!taxi.active) return;
      if (state.vehicle === car) {
        state.vehicle = null;
        opts.protagonist?.();
      }
      const spot = begin();
      Object.assign(opts.player, spot);
      if (opts.updateCamera) opts.updateCamera(0, true);
      announce('出租车归位', '重新接单', Y?.IS_OSM_QUZHOU ? '车辆已回到府东街待命点。' : '车辆已回到新河沿待命点。', 3.2);
    }

    function doorSideFor(point) {
      if (!car || !point) return 1;
      const right = rightVector(car.yaw);
      const dot = (point.x - car.x) * right.x + (point.z - car.z) * right.z;
      return dot >= 0 ? 1 : -1;
    }

    function startBoard() {
      if (!taxi.fare || !rider) return false;
      doorSide = doorSideFor(farePoint(true));
      const right = rightVector(car.yaw);
      const doorSpot = { x: car.x + right.x * 1.72 * doorSide, z: car.z + right.z * 1.72 * doorSide };
      const seatSpot = { x: car.x + right.x * .28 * doorSide - Math.sin(car.yaw) * .12, z: car.z + right.z * .28 * doorSide + Math.cos(car.yaw) * .12 };
      taxi.anim = {
        kind: 'board', t: 0, doorSide, doorSpot, seatSpot,
        from: { x: rider.x, z: rider.z }, door: 0, settled: false,
      };
      taxi.phase = 'boarding';
      stopCar();
      audio.note();
      return true;
    }

    function farePoint(isPickup) {
      const f = taxi.fare;
      if (!f) return null;
      return isPickup ? f.pickup : f.dropoff;
    }

    function startDrop() {
      if (!taxi.fare || !rider) return false;
      doorSide = doorSideFor(farePoint(false));
      const right = rightVector(car.yaw);
      const forward = forwardVector(car.yaw);
      const doorSpot = { x: car.x + right.x * 1.75 * doorSide, z: car.z + right.z * 1.75 * doorSide };
      const walkSpot = {
        x: doorSpot.x + right.x * 4.6 * doorSide + forward.x * 1.2,
        z: doorSpot.z + right.z * 4.6 * doorSide + forward.z * 1.2,
      };
      const seatSpot = { x: car.x + right.x * .28 * doorSide, z: car.z + right.z * .28 * doorSide };
      rider.root.visible = true;
      rider.x = seatSpot.x;
      rider.z = seatSpot.z;
      rider.yaw = car.yaw - doorSide * PI / 2;
      rider.root.scale.y = .78;
      rider.crouching = true;
      if (riderRing) {
        riderRing.visible = true;
        riderRing.position.set(rider.x, world.surfaceHeight(rider.x, rider.z) + .05, rider.z);
      }
      taxi.anim = {
        kind: 'drop', t: 0, doorSide, doorSpot, seatSpot, walkSpot, door: 0, settled: false,
      };
      taxi.phase = 'droppingOff';
      settled = false;
      stopCar();
      audio.note();
      return true;
    }

    function settleFare() {
      if (settled || !taxi.fare) return;
      settled = true;
      const f = taxi.fare;
      const stats = taxiStats();
      taxi.stats.trips++;
      const duration = f.startedAt ? Math.max(1, Math.round(state.clock - f.startedAt)) : 0;
      if (!taxi.stats.best || duration < taxi.stats.best) taxi.stats.best = duration;
      const onTime = duration > 0 && duration <= f.eta;
      const onTimeBonus = onTime ? Math.round((8 + f.distanceKm * 2.5) * stats.tipMult * (f.vip ? 1.35 : 1)) : 0;
      const smoothRatio = clamp(f.comfort / 100, .25, 1);
      const smoothBonus = Math.round(f.tip * smoothRatio);
      const payout = f.base + f.distanceFee + smoothBonus + onTimeBonus;
      f.settledTotal = payout;
      taxi.stats.earned += payout;
      progress.cash += payout;
      progress.deliveries = (progress.deliveries ?? 0) + 1;
      onSave();
      audio.complete();
      const bonusNote = onTimeBonus ? ' + 准时 ' + cashText(onTimeBonus) : '';
      announce(f.vip ? 'VIP 车费结算' : '车费结算', cashText(payout) + ' · 舒适度 ' + Math.round(f.comfort) + '%',
        '起步 ' + cashText(f.base) + ' + 里程 ' + cashText(f.distanceFee) + ' + 小费 ' + cashText(smoothBonus) + bonusNote
        + ' · 累计 ' + taxi.stats.trips + ' 单', 5.8);
      const upgradeHint = progress.cash >= 160 ? ' 手头宽裕了，随时按 G 打开改装工坊升级座驾！' : '';
      say('衢州出租调度', '这单实收 ' + cashText(payout) + '（' + (f.bumps === 0 ? '零剐蹭五星好评' : '舒适度 ' + Math.round(f.comfort) + '%') + '）。' + upgradeHint, 7.6);
    }

    function notifyImpact(relativeSpeed) {
      if (!taxi.active || taxi.phase !== 'onTrip' || !taxi.fare || relativeSpeed < 3.4) return;
      const stats = taxiStats();
      const rawLoss = clamp((relativeSpeed - 2.6) * 2.4, 3, 28);
      const damped = rawLoss * (1 - stats.collisionTolerance * .55) * (1 - stats.impactDamp * .35);
      taxi.fare.comfort = clamp(taxi.fare.comfort - damped, 25, 100);
      taxi.fare.bumps++;
    }

    function animate(dt) {
      const anim = taxi.anim;
      if (!anim || !rider) return;
      anim.t += dt;
      const right = rightVector(car.yaw);
      const openDoor = value => {
        anim.door = value;
        for (const side of [-1, 1]) {
          setDoor(doors[side], side === anim.doorSide ? -side * DOOR_SWING * value : 0);
        }
      };
      if (anim.kind === 'board') {
        if (anim.t < 1.25) {
          const k = smoothstep(clamp(anim.t / 1.25, 0, 1));
          rider.x = mix(anim.from.x, anim.doorSpot.x, k);
          rider.z = mix(anim.from.z, anim.doorSpot.z, k);
          rider.yaw = heading(rider, anim.doorSpot);
          factory.posePerson(rider, dt, 2.35);
        } else if (anim.t < 1.85) {
          rider.x = anim.doorSpot.x;
          rider.z = anim.doorSpot.z;
          rider.yaw = heading(rider, car);
          openDoor(smoothstep((anim.t - 1.25) / .6));
          factory.posePerson(rider, dt, 0);
        } else if (anim.t < 3.05) {
          const k = smoothstep(clamp((anim.t - 1.85) / 1.2, 0, 1));
          rider.x = mix(anim.doorSpot.x, anim.seatSpot.x, k);
          rider.z = mix(anim.doorSpot.z, anim.seatSpot.z, k);
          rider.yaw = car.yaw - anim.doorSide * PI / 2;
          rider.root.scale.y = mix(1, .76, k);
          rider.crouching = k > .28;
          openDoor(1);
          factory.posePerson(rider, dt, 1.1, false, rider.crouching);
        } else if (anim.t < 3.55) {
          openDoor(1 - smoothstep(clamp((anim.t - 3.05) / .5, 0, 1)));
          hideRider();
        } else {
          clearDoors();
          hideRider();
          taxi.anim = null;
          taxi.phase = 'onTrip';
          taxi.fare.startedAt = state.clock;
          announce('乘客已上车', '送往' + taxi.fare.dropoff.label,
            '预计车费 ' + cashText(taxi.fare.total) + ' · 沿导航行驶', 4.2);
          say('乘客', '师傅，到' + taxi.fare.dropoff.label + '就行，路上不急。', 5.4);
        }
      } else if (anim.kind === 'drop') {
        if (anim.t < .6) {
          openDoor(smoothstep(anim.t / .6));
          rider.x = anim.seatSpot.x;
          rider.z = anim.seatSpot.z;
          factory.posePerson(rider, dt, 0, false, true);
        } else if (anim.t < 1.75) {
          const k = smoothstep(clamp((anim.t - .6) / 1.15, 0, 1));
          rider.x = mix(anim.seatSpot.x, anim.doorSpot.x, k);
          rider.z = mix(anim.seatSpot.z, anim.doorSpot.z, k);
          rider.root.scale.y = mix(.78, 1, k);
          rider.crouching = k < .72;
          rider.yaw = heading(rider, anim.doorSpot);
          openDoor(1);
          factory.posePerson(rider, dt, 1.5, false, rider.crouching);
          if (!anim.settled && anim.t > 1.35) {
            anim.settled = true;
            settleFare();
          }
        } else if (anim.t < 3.95) {
          const k = smoothstep(clamp((anim.t - 1.75) / 2.2, 0, 1));
          rider.x = mix(anim.doorSpot.x, anim.walkSpot.x, k);
          rider.z = mix(anim.doorSpot.z, anim.walkSpot.z, k);
          rider.yaw = heading(anim.doorSpot, anim.walkSpot);
          rider.root.scale.y = 1;
          rider.crouching = false;
          const leaving = clamp((anim.t - 3.45) / .5, 0, 1);
          rider.root.scale.setScalar(1 - smoothstep(leaving));
          openDoor(1 - smoothstep(clamp((anim.t - 2.5) / .85, 0, 1)));
          factory.posePerson(rider, dt, 2.1);
          if (riderRing) riderRing.visible = false;
        } else {
          settleFare();
          hideRider();
          clearDoors();
          taxi.anim = null;
          taxi.phase = 'between';
          taxi.fare = null;
          taxi.nextAt = state.clock + 2.2;
          announce('空车待单', '下一单正在派送', '可继续行驶，稍后自动接单。', 3.2);
        }
      }
      if (riderRing?.visible) {
        riderRing.position.set(rider.x, world.surfaceHeight(rider.x, rider.z) + .055, rider.z);
        const pulse = 1 + .08 * Math.sin(state.clock * 3.4);
        riderRing.scale.setScalar(pulse);
      }
    }

    function update(dt) {
      if (!taxi.active) return;
      if (car && car.taxiDecorated) {
        for (const side of [-1, 1]) {
          if (doors[side] && !taxi.anim) setDoor(doors[side], doors[side].rotation.y * Math.max(0, 1 - dt * 6));
        }
      }
      animate(dt);
      if (!taxi.anim && taxi.phase === 'between' && taxi.nextAt && state.clock >= taxi.nextAt) dispatch('next');
      if (!taxi.anim && rider?.root.visible) {
        factory.posePerson(rider, dt, 0);
        rider.yaw += Math.sin(state.clock * .7) * dt * .06;
      }
    }

    function context() {
      if (!taxi.active) return null;
      if (taxi.anim) return null;
      const p = state.vehicle ?? opts.player;
      if (state.vehicle === car && taxi.fare) {
        const point = taxi.phase === 'toPickup' ? taxi.fare.pickup : taxi.fare.dropoff;
        const radius = taxiStats().pickupRadius;
        if ((taxi.phase === 'toPickup' || taxi.phase === 'onTrip') && car.speed < 2.8 && dist(car, point) < radius) {
          return taxi.phase === 'toPickup'
            ? { label: '接乘客上车', kind: 'taxiBoard' }
            : { label: '乘客下车 · 结算车费', kind: 'taxiDrop' };
        }
      }
      if (taxi.phase === 'between' && !state.vehicle && dist(p, car) < 5.2) {
        return { label: '出租车 · 接下一单', kind: 'taxiNext' };
      }
      return null;
    }

    function handle(action) {
      if (!action || !action.kind?.startsWith('taxi')) return false;
      switch (action.kind) {
        case 'taxiBoard': return startBoard();
        case 'taxiDrop': return startDrop();
        case 'taxiNext':
          dispatch('next');
          audio.note();
          return true;
      }
      return false;
    }

    function target() {
      if (!taxi.active) return null;
      if (taxi.fare && (taxi.phase === 'toPickup' || taxi.phase === 'boarding')) {
        return { ...taxi.fare.pickup, label: '乘客 · ' + taxi.fare.pickup.label, taxi: true, pickup: true };
      }
      if (taxi.fare && (taxi.phase === 'onTrip' || taxi.phase === 'droppingOff')) {
        return { ...taxi.fare.dropoff, label: '目的地 · ' + taxi.fare.dropoff.label, taxi: true };
      }
      if (!state.vehicle && car && dist(opts.player, car) > 7) {
        return { x: car.x, z: car.z, label: '我的出租车', taxi: true, vehiclePickup: true };
      }
      return null;
    }

    function details() {
      const t = taxi.fare;
      const aim = t ? (taxi.phase === 'onTrip' || taxi.phase === 'droppingOff' ? t.dropoff : t.pickup) : null;
      const d = aim ? Math.round(dist(state.vehicle ?? opts.player, aim)) : 0;
      const meta = taxi.stats.trips + ' 单 · 营收 ' + cashText(taxi.stats.earned);
      switch (taxi.phase) {
        case 'toPickup':
          return [t.vip ? 'VIP 专线 · 接客' : '出租车 · 接客', '前往' + t.pickup.label, '到' + t.pickup.label + '接乘客，停稳后按 E 开门上车。', d + ' 米 · 约 ' + cashText(t.total), false];
        case 'boarding':
          return ['出租车 · 上车', '乘客正在上车', '乘客正在开门上车，请稍候。', '车门开启中', false];
        case 'onTrip':
          return [t.vip ? 'VIP 专线 · 载客中' : '出租车 · 载客中', '送往' + t.dropoff.label,
            '平稳驾驶获全额小费 · 停车按 E 结算。', d + ' 米 · 舒适 ' + Math.round(t.comfort) + '%', t.comfort < 55];
        case 'droppingOff':
          return ['出租车 · 送达', '乘客正在下车', '正在结算车费与小费，请稍候。', cashText(t.settledTotal ?? t.total), false];
        default:
          return ['出租车 · 待单', '衢州出租', '靠近出租车按 E 上车，按 G 可随时进改装工坊升级座驾。', meta, false];
      }
    }

    return {
      state: taxi,
      get car() { return car; },
      get rider() { return rider; },
      begin, end, reset, update, context, handle, target, details, dispatch,
      ensureCar, syncUpgrades, notifyImpact,
      isTaxiCar: other => other === car,
      distanceToCar: () => car ? dist(state.vehicle ?? opts.player, car) : Infinity,
    };
  }

  D.createTaxiSystem = createTaxiSystem;
  D.TAXI_MODEL = TAXI_MODEL;
})();
