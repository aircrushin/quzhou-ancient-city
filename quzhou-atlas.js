(() => {
  'use strict';

  // 衢州古城手绘青绿舆图渲染引擎
  // 仿古宣纸肌理 · 衢江与信安湖水波纹 · 明代古城墙与六门 · 粉墙黛瓦街坊 · 真实路网 · 八大地标手绘微缩建筑
  const MAP_FRAME = { left: -368, top: -358, width: 1184, height: 804 };
  const PAPER_BG = '#eadfc5';
  const WATER_INK = '#7ea8a7';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundedRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawTreeCluster(ctx, x, y, r, rand) {
    const count = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const ox = (rand() - 0.5) * r * 1.4;
      const oy = (rand() - 0.5) * r * 1.1;
      const tr = r * (0.42 + rand() * 0.34);
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, tr, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? 'rgba(84, 128, 86, 0.72)' : 'rgba(105, 149, 98, 0.68)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(46, 74, 49, 0.55)';
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }
  }

  function drawWaterRipples(ctx, x, y, width, count) {
    ctx.save();
    ctx.strokeStyle = 'rgba(244, 248, 240, 0.34)';
    ctx.lineWidth = 1.0;
    for (let i = 0; i < count; i++) {
      const ry = y + i * 7.5;
      const rx = x + (i % 2) * 8;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.quadraticCurveTo(rx + width * 0.25, ry - 2.6, rx + width * 0.5, ry);
      ctx.quadraticCurveTo(rx + width * 0.75, ry + 2.6, rx + width, ry);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 在手绘舆图上绘制 8 个衢州地标的微缩建筑图标（世界坐标空间）
  function drawLandmarkIllustration(ctx, lm, scaleFactor = 1) {
    ctx.save();
    ctx.translate(lm.x, lm.z);
    ctx.scale(scaleFactor, scaleFactor);

    const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 26);
    halo.addColorStop(0, 'rgba(255, 248, 224, 0.92)');
    halo.addColorStop(0.65, 'rgba(247, 236, 206, 0.58)');
    halo.addColorStop(1, 'rgba(247, 236, 206, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (lm.kind === 'gate' || lm.kind === 'southgate') {
      ctx.fillStyle = '#73797d';
      ctx.strokeStyle = '#332d25';
      ctx.lineWidth = 1.3;
      ctx.fillRect(-15, 2, 30, 10);
      ctx.strokeRect(-15, 2, 30, 10);
      ctx.fillStyle = '#2d231c';
      ctx.beginPath();
      ctx.arc(0, 12, 4.2, Math.PI, 0);
      ctx.lineTo(4.2, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a43a2e';
      ctx.fillRect(-10.5, -5, 21, 7);
      ctx.strokeRect(-10.5, -5, 21, 7);
      ctx.fillStyle = '#323c45';
      ctx.beginPath();
      ctx.moveTo(-16, -4);
      ctx.quadraticCurveTo(0, -8.5, 16, -4);
      ctx.lineTo(11, -9);
      ctx.lineTo(-11, -9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-12.5, -9.5);
      ctx.quadraticCurveTo(0, -16.5, 12.5, -9.5);
      ctx.lineTo(7, -14.5);
      ctx.lineTo(-7, -14.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#d9a441';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-6.5, -14.5);
      ctx.lineTo(6.5, -14.5);
      ctx.stroke();
      ctx.fillStyle = '#e74c33';
      ctx.beginPath();
      ctx.arc(-8.5, -1, 1.8, 0, Math.PI * 2);
      ctx.arc(8.5, -1, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (lm.kind === 'pagoda7') {
      ctx.fillStyle = '#9c927d';
      ctx.strokeStyle = '#332a20';
      ctx.lineWidth = 1.15;
      ctx.fillRect(-10, 9, 20, 4);
      ctx.strokeRect(-10, 9, 20, 4);
      let y = 9;
      for (let i = 0; i < 7; i++) {
        const w = 13.5 - i * 1.25;
        const h = 3.15 - i * 0.12;
        ctx.fillStyle = i % 2 ? '#cbb892' : '#d8c7a3';
        ctx.fillRect(-w * 0.42, y - h, w * 0.84, h);
        ctx.strokeRect(-w * 0.42, y - h, w * 0.84, h);
        ctx.fillStyle = '#353e47';
        ctx.beginPath();
        ctx.moveTo(-w * 0.68, y - h + 0.5);
        ctx.lineTo(w * 0.68, y - h + 0.5);
        ctx.lineTo(w * 0.46, y - h - 1.35);
        ctx.lineTo(-w * 0.46, y - h - 1.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        y -= h + 0.6;
      }
      ctx.strokeStyle = '#c89128';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(0, y - 5.5);
      ctx.stroke();
      ctx.fillStyle = '#e3b242';
      ctx.beginPath();
      ctx.arc(0, y - 5.8, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (lm.kind === 'temple') {
      ctx.fillStyle = '#f2e4c7';
      ctx.strokeStyle = '#9c2d23';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-16, -10, 32, 22);
      ctx.strokeRect(-16, -10, 32, 22);
      ctx.fillStyle = '#a63227';
      ctx.fillRect(-11, -6, 22, 8);
      ctx.fillStyle = '#cfa037';
      ctx.strokeStyle = '#4f3512';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-14.5, -5.5);
      ctx.lineTo(14.5, -5.5);
      ctx.lineTo(9.5, -13.5);
      ctx.lineTo(-9.5, -13.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#8b241c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, 11.5);
      ctx.lineTo(-8, 5.5);
      ctx.moveTo(0, 11.5);
      ctx.lineTo(0, 4.5);
      ctx.moveTo(8, 11.5);
      ctx.lineTo(8, 5.5);
      ctx.moveTo(-10, 6.2);
      ctx.lineTo(10, 6.2);
      ctx.stroke();
      ctx.fillStyle = '#3f6e49';
      ctx.beginPath();
      ctx.arc(-13, 5, 2.7, 0, Math.PI * 2);
      ctx.arc(13, 5, 2.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (lm.kind === 'park') {
      ctx.fillStyle = '#73a46d';
      ctx.strokeStyle = '#385c3a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 7, 17, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      let y = 7;
      for (let i = 0; i < 5; i++) {
        const w = 10.2 - i * 1.2;
        ctx.fillStyle = '#e7ddc2';
        ctx.fillRect(-w * 0.4, y - 3.2, w * 0.8, 3.2);
        ctx.fillStyle = '#38464c';
        ctx.beginPath();
        ctx.moveTo(-w * 0.65, y - 2.9);
        ctx.lineTo(w * 0.65, y - 2.9);
        ctx.lineTo(w * 0.42, y - 4.4);
        ctx.lineTo(-w * 0.42, y - 4.4);
        ctx.closePath();
        ctx.fill();
        y -= 3.7;
      }
      ctx.fillStyle = '#487a4e';
      ctx.beginPath();
      ctx.arc(-11, 5, 4.2, 0, Math.PI * 2);
      ctx.arc(11.5, 4.5, 4.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (lm.kind === 'bell') {
      ctx.fillStyle = '#8b8a80';
      ctx.strokeStyle = '#332c24';
      ctx.lineWidth = 1.2;
      ctx.fillRect(-11, 3, 22, 9);
      ctx.strokeRect(-11, 3, 22, 9);
      ctx.fillStyle = '#a83b2e';
      ctx.fillRect(-8, -5, 16, 8);
      ctx.strokeRect(-8, -5, 16, 8);
      ctx.fillStyle = '#d4a341';
      ctx.beginPath();
      ctx.arc(0, -1, 3.2, Math.PI, 0);
      ctx.lineTo(3.8, 2.2);
      ctx.lineTo(-3.8, 2.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#323d46';
      ctx.beginPath();
      ctx.moveTo(-13.5, -4.5);
      ctx.lineTo(13.5, -4.5);
      ctx.lineTo(0, -15.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (lm.kind === 'market') {
      ctx.fillStyle = '#f3ebda';
      ctx.strokeStyle = '#38332b';
      ctx.lineWidth = 1.25;
      ctx.fillRect(-14, -4, 28, 14);
      ctx.strokeRect(-14, -4, 28, 14);
      ctx.fillStyle = '#2f3740';
      ctx.beginPath();
      ctx.moveTo(-16, -4);
      ctx.lineTo(-16, -8);
      ctx.lineTo(-10, -8);
      ctx.lineTo(-10, -11.5);
      ctx.lineTo(10, -11.5);
      ctx.lineTo(10, -8);
      ctx.lineTo(16, -8);
      ctx.lineTo(16, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0422b';
      for (const lx of [-8, 0, 8]) {
        ctx.beginPath();
        ctx.arc(lx, 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#6c9c6b';
      ctx.strokeStyle = '#385c3a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 6, 15, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f2ead4';
      ctx.strokeStyle = '#363026';
      ctx.beginPath();
      ctx.moveTo(-4, 5);
      ctx.lineTo(-2.4, -10);
      ctx.lineTo(2.4, -10);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f2b841';
      ctx.beginPath();
      ctx.arc(0, -11.5, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function createAtlasSurface(Q, D, footprints) {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = MAP_FRAME.width * scale;
    canvas.height = MAP_FRAME.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const rand = mulberry32(20260518);
    const { BOUNDS, MARINE } = D;

    ctx.scale(scale, scale);
    ctx.translate(-MAP_FRAME.left, -MAP_FRAME.top);

    const waterGrad = ctx.createLinearGradient(MAP_FRAME.left, MAP_FRAME.top, MAP_FRAME.left + MAP_FRAME.width, MAP_FRAME.top + MAP_FRAME.height);
    waterGrad.addColorStop(0, '#9fc4bf');
    waterGrad.addColorStop(0.45, '#86b2b1');
    waterGrad.addColorStop(0.78, '#719fa2');
    waterGrad.addColorStop(1, '#5e8c92');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(MAP_FRAME.left, MAP_FRAME.top, MAP_FRAME.width, MAP_FRAME.height);

    const island = MARINE.island;
    for (const [radius, alpha] of [[18, 0.36], [36, 0.28], [60, 0.21], [90, 0.14], [126, 0.09]]) {
      ctx.strokeStyle = `rgba(244, 246, 232, ${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      roundedRect(
        ctx,
        BOUNDS.minX - radius, BOUNDS.minZ - radius,
        BOUNDS.maxX - BOUNDS.minX + radius * 2, BOUNDS.maxZ - BOUNDS.minZ + radius * 2,
        radius * 0.92
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(island.x, island.z, island.rx + radius, island.rz + radius * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const rippleSpots = [
      [-358, -220], [-355, -20], [-358, 160], [390, -280], [450, -140],
      [540, -240], [660, -120], [420, 40], [435, 310], [620, 330], [720, 260],
      [-140, 370], [110, 382], [290, 376],
    ];
    for (const [rx, rz] of rippleSpots) drawWaterRipples(ctx, rx, rz, 44, 3);

    ctx.save();
    ctx.shadowColor = 'rgba(42, 62, 58, 0.28)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = PAPER_BG;
    ctx.beginPath();
    roundedRect(ctx, BOUNDS.minX - 4, BOUNDS.minZ - 4, BOUNDS.maxX - BOUNDS.minX + 8, BOUNDS.maxZ - BOUNDS.minZ + 8, 14);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#7e7157';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    roundedRect(ctx, BOUNDS.minX - 4, BOUNDS.minZ - 4, BOUNDS.maxX - BOUNDS.minX + 8, BOUNDS.maxZ - BOUNDS.minZ + 8, 14);
    ctx.stroke();

    const zoneFills = {
      park: '#bdd6a8',
      kongmiao: '#ebd7b4',
      shuitingmen: '#e6d8b9',
      shuitingAlley: '#e7dac0',
      tianwang: '#e8dbc2',
      bellTower: '#e7d9bd',
      mazhandi: '#eedbb7',
      dananmen: '#e5d6b7',
      boulevard2: '#e2d5b8',
      boulevard3: '#e2d5b8',
      garageBlock: '#dcd2b8',
      southYard: '#d7cfba',
      warehouse7: '#d2cab6',
      tower: '#dad2bc',
      outerTown: '#dfd4ba',
      oldTown: '#e7dcc2',
    };
    if (Q) {
      for (const face of Q.FACES) {
        const pts = face.nodes.map(id => Q.NODES_BY_ID.get(id)).filter(Boolean);
        if (pts.length < 3) continue;
        ctx.beginPath();
        pts.forEach((pt, idx) => idx ? ctx.lineTo(pt.x, pt.z) : ctx.moveTo(pt.x, pt.z));
        ctx.closePath();
        ctx.fillStyle = zoneFills[face.zone] || '#e6dbc2';
        ctx.fill();
        ctx.strokeStyle = 'rgba(126, 110, 82, 0.45)';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
    }

    // 真实 OSM 府山公园多边形与分层青绿林荫
    if (Q?.PARK_POLYGONS?.length) {
      for (const park of Q.PARK_POLYGONS) {
        const pts = park.pts;
        if (!pts || pts.length < 3) continue;
        ctx.beginPath();
        pts.forEach((pt, idx) => idx ? ctx.lineTo(pt.x, pt.z) : ctx.moveTo(pt.x, pt.z));
        ctx.closePath();
        ctx.fillStyle = '#a7cb92';
        ctx.fill();
        ctx.strokeStyle = 'rgba(62, 98, 58, 0.65)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
        ctx.save();
        ctx.clip();
        for (const [rx, ry, fill] of [[42, 48, '#95be82'], [26, 30, '#82af71']]) {
          ctx.beginPath();
          ctx.ellipse(cx + 2, cz - 4, rx, ry, -0.18, 0, Math.PI * 2);
          ctx.fillStyle = fill;
          ctx.fill();
        }
        for (const [ox, oy] of [[-32, -36], [18, -42], [-34, 18], [26, 28], [-12, 46], [30, -10]]) {
          drawTreeCluster(ctx, cx + ox, cz + oy, 7.2, rand);
        }
        ctx.restore();
      }
    } else {
      const parkX = 78, parkZ = 52;
      for (const [rx, ry, fill] of [[58, 30, '#b5d29f'], [44, 22, '#9ec48a'], [28, 14, '#88b477']]) {
        ctx.beginPath();
        ctx.ellipse(parkX, parkZ, rx, ry, -0.08, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = 'rgba(66, 98, 62, 0.42)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    }

    // 真实 OSM 城内水系（南湖、斗潭河，在道路桥梁之前绘制以展现真实桥梁跨水）
    if (Q?.WATER_POLYGONS?.length) {
      for (const water of Q.WATER_POLYGONS) {
        const pts = water.pts;
        if (!pts || pts.length < 3) continue;
        ctx.save();
        ctx.beginPath();
        pts.forEach((pt, idx) => idx ? ctx.lineTo(pt.x, pt.z) : ctx.moveTo(pt.x, pt.z));
        ctx.closePath();
        ctx.fillStyle = '#78a8a7';
        ctx.fill();
        ctx.strokeStyle = '#4e7d7e';
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.clip();
        const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
        const minZ = Math.min(...pts.map(p => p.z)), maxZ = Math.max(...pts.map(p => p.z));
        for (let wx = minX + 12; wx < maxX - 18; wx += 48) {
          drawWaterRipples(ctx, wx, (minZ + maxZ) * 0.5 - 6, 32, 2);
        }
        ctx.restore();
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
        ctx.save();
        ctx.font = '700 11px "STKaiti", "KaiTi", "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(244, 248, 240, 0.85)';
        ctx.lineWidth = 2.6;
        ctx.strokeText(water.name, cx, cz);
        ctx.fillStyle = '#245457';
        ctx.fillText(water.name, cx, cz);
        ctx.restore();
      }
    }

    ctx.fillStyle = '#d6c8a8';
    ctx.strokeStyle = '#8b7b5d';
    ctx.lineWidth = 1.2;
    ctx.fillRect(298, -324, 41, 652);
    ctx.strokeRect(298, -324, 41, 652);
    ctx.fillRect(-326, 304, 665, 24);
    ctx.strokeRect(-326, 304, 665, 24);
    for (const [x, z, w, d] of [
      [336, -257, 80, 15], [336, -165, 44, 15], [336, 33, 31, 15],
      [-247, 327, 25, 32], [-157, 327, 26, 40], [-69, 327, 28, 40], [34, 327, 25, 40],
    ]) {
      ctx.fillRect(x, z, w, d);
      ctx.strokeRect(x, z, w, d);
    }
    for (const rect of [MARINE.mainDock, MARINE.islandDock]) {
      ctx.fillStyle = '#cbb790';
      ctx.fillRect(rect.minX, rect.minZ, rect.maxX - rect.minX, rect.maxZ - rect.minZ);
      ctx.strokeRect(rect.minX, rect.minZ, rect.maxX - rect.minX, rect.maxZ - rect.minZ);
    }
    ctx.beginPath();
    ctx.ellipse(island.x, island.z, island.rx + 3.5, island.rz + 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#dfd0ac';
    ctx.fill();
    ctx.strokeStyle = '#7b6d52';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(island.x, island.z, island.rx - 4, island.rz - 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#a3c68f';
    ctx.fill();
    ctx.strokeStyle = 'rgba(65, 98, 62, 0.5)';
    for (const inset of [12, 22]) {
      ctx.beginPath();
      ctx.ellipse(island.x + inset * 0.24, island.z - inset * 0.12, island.rx - inset, island.rz - inset * 0.68, -0.14, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#d3c098';
    ctx.fillRect(MARINE.islandDock.maxX - 7, MARINE.panel.z - 2.2, MARINE.panel.x - MARINE.islandDock.maxX + 7, 4.4);
    for (const [tx, tz] of [[578, 126], [608, 162], [656, 124], [648, 162]]) {
      drawTreeCluster(ctx, tx, tz, 6.8, rand);
    }

    if (Array.isArray(footprints)) {
      for (const { left, top, w, d, height } of footprints) {
        const relief = Math.min(3.4, height * 0.085);
        ctx.fillStyle = 'rgba(78, 66, 48, 0.24)';
        ctx.fillRect(left + relief, top + relief, w, d);
        ctx.fillStyle = height > 28 ? '#c7baa0' : height > 12 ? '#d7ccb4' : '#ded3bc';
        ctx.fillRect(left, top, w, d);
        ctx.strokeStyle = '#6f6658';
        ctx.lineWidth = 0.85;
        ctx.strokeRect(left, top, w, d);
        if (w > 6 && d > 6) {
          ctx.fillStyle = height > 26 ? 'rgba(98, 108, 114, 0.42)' : 'rgba(67, 79, 88, 0.45)';
          ctx.fillRect(left + 1.4, top + 1.4, w - 2.8, d - 2.8);
          ctx.strokeStyle = 'rgba(244, 236, 214, 0.55)';
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          if (w >= d) {
            ctx.moveTo(left + 2, top + d * 0.5);
            ctx.lineTo(left + w - 2, top + d * 0.5);
          } else {
            ctx.moveTo(left + w * 0.5, top + 2);
            ctx.lineTo(left + w * 0.5, top + d - 2);
          }
          ctx.stroke();
        }
      }
    }

    if (Q) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [fraction, ink] of [[1.04, '#8d7f63'], [0.78, '#f5ecd4'], [0.64, '#faf4e2']]) {
        ctx.strokeStyle = ink;
        for (const edge of Q.EDGES) {
          ctx.lineWidth = edge.width * fraction;
          ctx.beginPath();
          ctx.moveTo(edge.a.x, edge.a.z);
          ctx.lineTo(edge.b.x, edge.b.z);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = 'rgba(155, 134, 96, 0.65)';
      ctx.lineWidth = 0.85;
      ctx.setLineDash([4.5, 5.5]);
      ctx.beginPath();
      for (const edge of Q.EDGES) {
        if (edge.kind === 'alley') continue;
        ctx.moveTo(edge.a.x, edge.a.z);
        ctx.lineTo(edge.b.x, edge.b.z);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (Q?.CITY_WALL?.length) {
      const wall = Q.CITY_WALL;
      ctx.save();
      ctx.beginPath();
      wall.forEach((pt, idx) => idx ? ctx.lineTo(pt.x, pt.z) : ctx.moveTo(pt.x, pt.z));
      ctx.closePath();
      ctx.strokeStyle = 'rgba(92, 69, 48, 0.55)';
      ctx.lineWidth = 4.6;
      ctx.stroke();
      ctx.strokeStyle = '#a44332';
      ctx.lineWidth = 1.65;
      ctx.setLineDash([7, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '700 10px "STKaiti", "KaiTi", "Songti SC", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const pt of wall) {
        if (!pt.gate) continue;
        ctx.fillStyle = '#9e2e24';
        ctx.strokeStyle = '#f8eed6';
        ctx.lineWidth = 1.5;
        ctx.fillRect(pt.x - 18, pt.z - 8.5, 36, 17);
        ctx.strokeRect(pt.x - 18, pt.z - 8.5, 36, 17);
        ctx.fillStyle = '#fff3d6';
        ctx.fillText(pt.gate, pt.x, pt.z + 0.5);
      }
      ctx.restore();
    }

    if (Q) {
      ctx.save();
      ctx.font = '700 9.2px "Microsoft YaHei UI", "PingFang SC", "Songti SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const placedLabels = [];
      const edgesByPriority = [...Q.EDGES].sort((a, b) => {
        const rk = k => k === 'arterial' ? 4 : k === 'main' ? 3 : k === 'street' ? 2 : 1;
        return (rk(b.kind) * 100 + b.length) - (rk(a.kind) * 100 + a.length);
      });
      for (const edge of edgesByPriority) {
        if (!edge.name || edge.name === '古城巷' || edge.length < 26) continue;
        if (placedLabels.some(p => p.name === edge.name && Math.hypot(p.x - edge.cx, p.z - edge.cz) < 110)) continue;
        if (placedLabels.some(p => Math.hypot(p.x - edge.cx, p.z - edge.cz) < 36)) continue;
        placedLabels.push({ name: edge.name, x: edge.cx, z: edge.cz });
        let ang = Math.atan2(edge.b.z - edge.a.z, edge.b.x - edge.a.x);
        if (ang > Math.PI / 2) ang -= Math.PI;
        if (ang < -Math.PI / 2) ang += Math.PI;
        ctx.save();
        ctx.translate(edge.cx, edge.cz);
        ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(250, 243, 224, 0.92)';
        ctx.lineWidth = 3.2;
        ctx.strokeText(edge.name, 0, 0);
        ctx.fillStyle = '#473927';
        ctx.fillText(edge.name, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    if (Q?.LANDMARKS) {
      for (const lm of Q.LANDMARKS) {
        drawLandmarkIllustration(ctx, lm, 1.05);
      }
    }

    ctx.save();
    ctx.font = '700 22px "STKaiti", "KaiTi", "Songti SC", serif';
    ctx.fillStyle = 'rgba(34, 69, 71, 0.72)';
    ctx.textAlign = 'center';
    ctx.fillText('衢', -344, -155);
    ctx.fillText('江', -344, -125);
    ctx.fillText('信  安  湖', 535, -72);
    ctx.font = '600 11.5px "STKaiti", "KaiTi", "Songti SC", serif';
    ctx.fillStyle = 'rgba(37, 74, 75, 0.65)';
    ctx.fillText('XINAN LAKE · QUJIANG RIVER', 535, -50);
    ctx.restore();

    for (let i = 0; i < 900; i++) {
      const gx = MAP_FRAME.left + rand() * MAP_FRAME.width;
      const gz = MAP_FRAME.top + rand() * MAP_FRAME.height;
      ctx.fillStyle = i % 2 ? 'rgba(105, 84, 52, 0.045)' : 'rgba(255, 250, 236, 0.06)';
      ctx.fillRect(gx, gz, 2 + rand() * 5, 1 + rand() * 2);
    }

    ctx.save();
    const cx = MAP_FRAME.left + MAP_FRAME.width - 208;
    const cy = MAP_FRAME.top + 20;
    ctx.fillStyle = 'rgba(248, 241, 223, 0.92)';
    ctx.strokeStyle = '#7c623d';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    roundedRect(ctx, cx, cy, 184, 66, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(124, 98, 61, 0.45)';
    ctx.lineWidth = 0.85;
    ctx.strokeRect(cx + 4, cy + 4, 176, 58);
    ctx.fillStyle = '#332417';
    ctx.font = '700 17px "STKaiti", "KaiTi", "Songti SC", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('衢州古城手绘舆图', cx + 13, cy + 12);
    ctx.fillStyle = '#6c573c';
    ctx.font = '600 9.8px "Songti SC", Georgia, serif';
    ctx.fillText('南孔圣地 · 衢州有礼', cx + 14, cy + 38);
    ctx.fillStyle = '#a83126';
    ctx.fillRect(cx + 150, cy + 14, 22, 38);
    ctx.strokeStyle = '#f8eed5';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 152, cy + 16, 18, 34);
    ctx.fillStyle = '#fff2d8';
    ctx.font = '700 10px "STKaiti", "KaiTi", serif';
    ctx.textAlign = 'center';
    ctx.fillText('三', cx + 161, cy + 20);
    ctx.fillText('衢', cx + 161, cy + 34);
    ctx.restore();

    return canvas;
  }

  function createRadarSurface(Q, D, footprints) {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = MAP_FRAME.width * scale;
    canvas.height = MAP_FRAME.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const { BOUNDS, MARINE } = D;
    ctx.scale(scale, scale);
    ctx.translate(-MAP_FRAME.left, -MAP_FRAME.top);

    const water = ctx.createLinearGradient(-250, 50, 810, 245);
    water.addColorStop(0, '#4a98ab');
    water.addColorStop(0.6, '#368096');
    water.addColorStop(1, '#2a6c82');
    ctx.fillStyle = water;
    ctx.fillRect(MAP_FRAME.left, MAP_FRAME.top, MAP_FRAME.width, MAP_FRAME.height);

    ctx.fillStyle = '#7ea37a';
    ctx.fillRect(BOUNDS.minX, BOUNDS.minZ, BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ);

    if (Q) {
      for (const face of Q.FACES) {
        const pts = face.nodes.map(id => Q.NODES_BY_ID.get(id)).filter(Boolean);
        ctx.beginPath();
        pts.forEach((pt, idx) => idx ? ctx.lineTo(pt.x, pt.z) : ctx.moveTo(pt.x, pt.z));
        ctx.closePath();
        ctx.fillStyle = face.zone === 'park' ? '#68a363'
          : face.zone === 'kongmiao' ? '#c8b48e'
          : face.zone === 'shuitingmen' || face.zone === 'shuitingAlley' ? '#b8b89b'
          : '#a8b59b';
        ctx.fill();
        ctx.strokeStyle = 'rgba(240, 238, 224, 0.55)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      if (Q.PARK_POLYGONS?.length) {
        for (const park of Q.PARK_POLYGONS) {
          const pts = park.pts;
          if (!pts || pts.length < 3) continue;
          ctx.beginPath();
          pts.forEach((pt, idx) => idx ? ctx.lineTo(pt.x, pt.z) : ctx.moveTo(pt.x, pt.z));
          ctx.closePath();
          ctx.fillStyle = '#68a363';
          ctx.fill();
        }
      }
      if (Q.WATER_POLYGONS?.length) {
        for (const water of Q.WATER_POLYGONS) {
          const pts = water.pts;
          if (!pts || pts.length < 3) continue;
          ctx.beginPath();
          pts.forEach((pt, idx) => idx ? ctx.lineTo(pt.x, pt.z) : ctx.moveTo(pt.x, pt.z));
          ctx.closePath();
          ctx.fillStyle = '#3b899e';
          ctx.fill();
          ctx.strokeStyle = 'rgba(220, 236, 238, 0.45)';
          ctx.lineWidth = 1.0;
          ctx.stroke();
        }
      }
    }

    const island = MARINE.island;
    ctx.fillStyle = '#c8c3ac';
    ctx.fillRect(298, -324, 41, 652);
    ctx.fillRect(-326, 304, 665, 24);
    for (const rect of [MARINE.mainDock, MARINE.islandDock]) {
      ctx.fillRect(rect.minX, rect.minZ, rect.maxX - rect.minX, rect.maxZ - rect.minZ);
    }
    ctx.beginPath();
    ctx.ellipse(island.x, island.z, island.rx, island.rz, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6da669';
    ctx.fill();

    if (Array.isArray(footprints)) {
      for (const { left, top, w, d, height } of footprints) {
        ctx.fillStyle = height > 28 ? '#ddd4be' : '#c5c7b2';
        ctx.fillRect(left, top, w, d);
      }
    }

    if (Q) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [fraction, ink] of [[1.0, '#8d998a'], [0.64, '#6e7e7a'], [0.5, '#f2eee0']]) {
        ctx.strokeStyle = ink;
        for (const edge of Q.EDGES) {
          ctx.lineWidth = edge.width * fraction;
          ctx.beginPath();
          ctx.moveTo(edge.a.x, edge.a.z);
          ctx.lineTo(edge.b.x, edge.b.z);
          ctx.stroke();
        }
      }
    }
    return canvas;
  }

  function drawLandmarkPlaques(ctx, Q, view, pr, hoveredId, activeId, visitedSet = null) {
    if (!Q?.LANDMARKS) return;
    ctx.save();
    ctx.font = `700 ${11.5 * pr}px "STKaiti", "KaiTi", "Songti SC", "Microsoft YaHei UI", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const lm of Q.LANDMARKS) {
      const [sx, sy] = view(lm);
      const isHover = lm.id === hoveredId;
      const isActive = lm.id === activeId;
      const isVisited = Boolean(visitedSet && visitedSet.has(lm.id));

      if (isHover || isActive) {
        ctx.beginPath();
        ctx.arc(sx, sy, (isHover ? 24 : 20) * pr, 0, Math.PI * 2);
        ctx.fillStyle = isHover ? 'rgba(214, 152, 54, 0.24)' : 'rgba(42, 146, 118, 0.22)';
        ctx.fill();
        ctx.strokeStyle = isHover ? '#b33827' : '#1f7a61';
        ctx.lineWidth = 2.2 * pr;
        ctx.stroke();
      }

      const label = isVisited ? '✓ ' + lm.name : lm.name;
      const tw = ctx.measureText(label).width;
      const pw = tw + 14 * pr;
      const ph = 18 * pr;
      const px = sx - pw / 2;
      const py = sy + 15 * pr;

      ctx.fillStyle = isHover ? '#9d2d22' : isActive ? '#1c6954' : isVisited ? 'rgba(227, 245, 236, 0.95)' : 'rgba(250, 242, 224, 0.94)';
      ctx.strokeStyle = isHover ? '#ffe4a8' : isActive ? '#a8f2d5' : isVisited ? '#2c7e62' : '#856941';
      ctx.lineWidth = (isHover || isActive ? 1.8 : 1.15) * pr;
      ctx.beginPath();
      roundedRect(ctx, px, py, pw, ph, 3.5 * pr);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isHover || isActive ? '#fff7e0' : isVisited ? '#174f3d' : '#352516';
      ctx.fillText(label, sx, py + ph * 0.52);
    }
    ctx.restore();
  }

  function hitTestLandmark(Q, view, px, py, radiusPx) {
    if (!Q?.LANDMARKS) return null;
    let best = null;
    let bestDist = radiusPx;
    for (const lm of Q.LANDMARKS) {
      const [sx, sy] = view(lm);
      const d = Math.hypot(px - sx, py - sy);
      if (d <= bestDist) {
        best = lm;
        bestDist = d;
      }
    }
    return best;
  }

  window.QuzhouAtlas = {
    MAP_FRAME,
    PAPER_BG,
    WATER_INK,
    createAtlasSurface,
    createRadarSurface,
    drawLandmarkPlaques,
    hitTestLandmark,
  };
})();
