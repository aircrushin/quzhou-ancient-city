(() => {
  'use strict';

  const T = window.THREE;
  const D = window.Tideline || (window.Tideline = {});
  const PI = Math.PI;
  const CYCLE = 28.0;
  const GREEN_DUR = 10.5;
  const YELLOW_DUR = 2.5;
  const ALL_RED_DUR = 1.0;
  const HALF_CYCLE = GREEN_DUR + YELLOW_DUR + ALL_RED_DUR;
  const PED_FLASH_DUR = 2.6;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const dist2d = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);
  const heading2d = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const smooth = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

  function edgeBetween(a, b) {
    if (!a || !b) return null;
    for (const item of a.edges) {
      if (item.to === b) return item.edge;
    }
    return null;
  }

  function getVehicleSignalState(signal, phase, clock) {
    const t = ((clock + signal.phaseOffset) % CYCLE + CYCLE) % CYCLE;
    const base = phase === 0 ? 0 : HALF_CYCLE;
    const local = ((t - base) % CYCLE + CYCLE) % CYCLE;
    if (local < GREEN_DUR) return 'green';
    if (local < GREEN_DUR + YELLOW_DUR) return 'yellow';
    return 'red';
  }

  function getPedSignalState(signal, approachPhase, clock) {
    // Crosswalk across approachPhase is safe when the orthogonal phase has GREEN.
    const t = ((clock + signal.phaseOffset) % CYCLE + CYCLE) % CYCLE;
    const orthoBase = approachPhase === 0 ? HALF_CYCLE : 0;
    const local = ((t - orthoBase) % CYCLE + CYCLE) % CYCLE;
    if (local < GREEN_DUR - PED_FLASH_DUR) return 'walk';
    if (local < GREEN_DUR) return 'flash';
    return 'stop';
  }

  function buildTrafficLayout(Y) {
    if (!Y || !Y.NODES || !Y.EDGES) {
      return {
        signals: [], crosswalks: [], approachMap: new Map(),
        crosswalksByEdge: new Map(), signalByNode: new Map(), poleSpots: [], lenses: [],
      };
    }

    const hub = Y.HUB_SPOT || { x: 285, z: 166 };
    const candidates = Y.NODES
      .filter(node => node.edges.length >= 3 && !Y.inAnyWater?.(node.x, node.z, 1.5))
      .map(node => {
        let score = 0;
        let maxW = 0;
        for (const { edge } of node.edges) {
          if (edge.width > maxW) maxW = edge.width;
          if (edge.kind === 'arterial') score += 10;
          else if (edge.kind === 'main') score += 5;
          else if (edge.kind === 'street') score += 2;
        }
        if (node.edges.length >= 4) score += 8;
        if (dist2d(node.x, node.z, hub.x, hub.z) < 80) score += 24;
        return { node, score, maxW };
      })
      .filter(item => item.score >= 9)
      .sort((a, b) => b.score - a.score);

    const signals = [];
    const signalByNode = new Map();
    const approachMap = new Map();
    const crosswalks = [];
    const crosswalksByEdge = new Map();
    const poleSpots = [];
    const lenses = [];

    function registerCrosswalk(cw) {
      cw.id = crosswalks.length;
      crosswalks.push(cw);
      if (!crosswalksByEdge.has(cw.edgeIndex)) crosswalksByEdge.set(cw.edgeIndex, []);
      crosswalksByEdge.get(cw.edgeIndex).push(cw);
      return cw;
    }

    function hasCloseCrosswalk(edgeIndex, t, minGap = 11.5) {
      const list = crosswalksByEdge.get(edgeIndex);
      if (!list) return false;
      for (const cw of list) {
        if (Math.abs(cw.t - t) < minGap) return true;
      }
      return false;
    }

    function findPoleSpot(node, outX, outZ, rightX, rightZ, width, crossDist, crossLen, stopDist, localPoles) {
      const dists = [
        crossDist - crossLen * 0.5 - 0.65,
        crossDist,
        crossDist + crossLen * 0.5 + 0.65,
        stopDist + 0.55,
        crossDist - crossLen * 0.5 - 1.55,
      ];
      const lats = [1.25, 1.75, 2.35];
      for (const d of dists) {
        if (d < 3.5) continue;
        for (const extra of lats) {
          const px = node.x + outX * d + rightX * (width * 0.5 + extra);
          const pz = node.z + outZ * d + rightZ * (width * 0.5 + extra);
          if (Y.onAnyRoad(px, pz, 0.55) || Y.inAnyWater?.(px, pz, 1.0)) continue;
          if (localPoles.some(p => dist2d(p.x, p.z, px, pz) < 2.6)) continue;
          return { x: px, z: pz, dist: d, lateral: width * 0.5 + extra };
        }
      }
      return null;
    }

    function findOppositePedSpot(node, outX, outZ, rightX, rightZ, width, crossDist, localPoles) {
      const dists = [crossDist, crossDist + 1.1, crossDist - 1.1];
      const lats = [1.3, 1.85, 2.4];
      for (const d of dists) {
        if (d < 3.5) continue;
        for (const extra of lats) {
          const px = node.x + outX * d - rightX * (width * 0.5 + extra);
          const pz = node.z + outZ * d - rightZ * (width * 0.5 + extra);
          if (Y.onAnyRoad(px, pz, 0.5) || Y.inAnyWater?.(px, pz, 1.0)) continue;
          if (localPoles.some(p => dist2d(p.x, p.z, px, pz) < 2.1)) continue;
          return { x: px, z: pz };
        }
      }
      return null;
    }

    // 1. Select well-spaced signalized intersections
    for (const { node, maxW } of candidates) {
      if (signals.some(s => dist2d(s.x, s.z, node.x, node.z) < 34)) continue;
      // Primary axis = highest-priority / widest / longest edge at this node
      const sortedEdges = [...node.edges].sort((a, b) => {
        const pa = a.edge.kind === 'arterial' ? 3 : a.edge.kind === 'main' ? 2 : a.edge.kind === 'street' ? 1 : 0;
        const pb = b.edge.kind === 'arterial' ? 3 : b.edge.kind === 'main' ? 2 : b.edge.kind === 'street' ? 1 : 0;
        if (pb !== pa) return pb - pa;
        if (b.edge.width !== a.edge.width) return b.edge.width - a.edge.width;
        return b.edge.length - a.edge.length;
      });
      const lead = sortedEdges[0];
      const axisAngle = heading2d(node.x, node.z, lead.to.x, lead.to.z);
      const axisX = Math.sin(axisAngle);
      const axisZ = Math.cos(axisAngle);
      const nearHub = dist2d(node.x, node.z, hub.x, hub.z) < 55;
      // Start near-HUB junction mid-green so players immediately see cars stop/go and lights change.
      const phaseOffset = nearHub ? 3.5 : ((Math.abs(node.x * 0.053 + node.z * 0.037) * 9.7) % CYCLE);

      const signal = {
        id: signals.length,
        node,
        x: node.x,
        z: node.z,
        maxW,
        axisAngle,
        phaseOffset,
        approaches: [],
      };

      const rawApproaches = [];
      for (const { to, edge } of node.edges) {
        const outX = (to.x - node.x) / edge.length;
        const outZ = (to.z - node.z) / edge.length;
        const rightX = outZ;
        const rightZ = -outX;
        const align = Math.abs(outX * axisX + outZ * axisZ);
        rawApproaches.push({ to, edge, outX, outZ, rightX, rightZ, align, phase: align >= 0.7071 ? 0 : 1 });
      }
      // Ensure at least one approach is on phase 1 if all fell on phase 0.
      if (rawApproaches.length >= 3 && rawApproaches.every(a => a.phase === 0)) {
        let minAlign = Infinity;
        let pick = rawApproaches[rawApproaches.length - 1];
        for (const a of rawApproaches) {
          if (a.align < minAlign) { minAlign = a.align; pick = a; }
        }
        pick.phase = 1;
      }

      const localPoles = [];
      for (const raw of rawApproaches) {
        const { edge, outX, outZ, rightX, rightZ, phase } = raw;
        const crossLen = edge.kind === 'arterial' ? 3.5 : edge.kind === 'main' ? 3.2 : 2.7;
        const crossDist = maxW * 0.5 + 2.45;
        const stopDist = crossDist + crossLen * 0.5 + 1.35;
        const cx = node.x + outX * crossDist;
        const cz = node.z + outZ * crossDist;
        const tOnEdge = edge.a === node ? crossDist : edge.length - crossDist;
        const isBridge = Boolean(Y.inAnyWater?.(cx, cz, 0.8));
        const hasRoom = edge.kind !== 'alley' && !isBridge && edge.length >= crossDist + crossLen * 0.5 + 3.2 && !hasCloseCrosswalk(edge.index, tOnEdge, 10.5);

        let pole = null;
        let oppPedPole = null;
        let crosswalk = null;
        const faceYaw = Math.atan2(outX, outZ);
        const pedFaceYaw = Math.atan2(-rightX, -rightZ);

        if (hasRoom) {
          const roadY = Y.inAnyWater?.(edge.cx, edge.cz, 0) ? 0.042 : 0.021;
          const curbReach = edge.width * 0.5 + 1.85;
          crosswalk = registerCrosswalk({
            edge,
            edgeIndex: edge.index,
            t: tOnEdge,
            x: cx,
            z: cz,
            ux: outX,
            uz: outZ,
            rightX,
            rightZ,
            yaw: faceYaw,
            width: edge.width,
            length: crossLen,
            roadY,
            signal,
            signalPhase: phase,
            stopDist,
            node,
            hasStopLine: true,
            hasArrow: (edge.kind === 'arterial' || edge.kind === 'main') && edge.length >= stopDist + 10.5,
            curbA: { x: cx + rightX * curbReach, z: cz + rightZ * curbReach },
            curbB: { x: cx - rightX * curbReach, z: cz - rightZ * curbReach },
          });

          pole = findPoleSpot(node, outX, outZ, rightX, rightZ, edge.width, crossDist, crossLen, stopDist, localPoles);
          if (pole) {
            localPoles.push(pole);
            poleSpots.push({ x: pole.x, z: pole.z });
            oppPedPole = findOppositePedSpot(node, outX, outZ, rightX, rightZ, edge.width, crossDist, localPoles);
            if (oppPedPole) {
              localPoles.push(oppPedPole);
              poleSpots.push({ x: oppPedPole.x, z: oppPedPole.z });
            }
          }
        }

        const armLen = pole ? Math.min(5.1, edge.width * 0.34 + 1.45) : 0;
        const approach = {
          signal,
          node,
          edge,
          edgeIndex: edge.index,
          phase,
          outX,
          outZ,
          rightX,
          rightZ,
          faceYaw,
          pedFaceYaw,
          crossDist,
          crossLen,
          stopDist: hasRoom ? stopDist : Math.min(edge.length * 0.72, maxW * 0.5 + 2.0),
          crosswalk,
          pole,
          oppPedPole,
          armLen,
        };
        signal.approaches.push(approach);
        approachMap.set(node.id + ':' + edge.index, approach);
      }

      signals.push(signal);
      signalByNode.set(node.id, signal);
    }

    // 2. Unsignalized junction zebra crossings on non-alley intersections
    for (const node of Y.NODES) {
      if (node.edges.length < 3 || signalByNode.has(node.id) || Y.inAnyWater?.(node.x, node.z, 1.2)) continue;
      let maxW = 9.6;
      for (const { edge } of node.edges) if (edge.width > maxW) maxW = edge.width;
      for (const { to, edge } of node.edges) {
        if (edge.kind === 'alley') continue;
        const crossLen = edge.kind === 'arterial' ? 3.2 : edge.kind === 'main' ? 2.95 : 2.5;
        const crossDist = maxW * 0.5 + 2.25;
        const stopDist = crossDist + crossLen * 0.5 + 1.25;
        if (edge.length < crossDist + crossLen * 0.5 + 9.0) continue;
        const outX = (to.x - node.x) / edge.length;
        const outZ = (to.z - node.z) / edge.length;
        const rightX = outZ;
        const rightZ = -outX;
        const cx = node.x + outX * crossDist;
        const cz = node.z + outZ * crossDist;
        if (Y.inAnyWater?.(cx, cz, 0.8)) continue;
        const tOnEdge = edge.a === node ? crossDist : edge.length - crossDist;
        if (hasCloseCrosswalk(edge.index, tOnEdge, 14.0)) continue;
        const roadY = Y.inAnyWater?.(edge.cx, edge.cz, 0) ? 0.042 : 0.021;
        const curbReach = edge.width * 0.5 + 1.75;
        registerCrosswalk({
          edge,
          edgeIndex: edge.index,
          t: tOnEdge,
          x: cx,
          z: cz,
          ux: outX,
          uz: outZ,
          rightX,
          rightZ,
          yaw: Math.atan2(outX, outZ),
          width: edge.width,
          length: crossLen,
          roadY,
          signal: null,
          signalPhase: -1,
          stopDist,
          node,
          hasStopLine: edge.kind !== 'street' || edge.length > 34,
          hasArrow: false,
          curbA: { x: cx + rightX * curbReach, z: cz + rightZ * curbReach },
          curbB: { x: cx - rightX * curbReach, z: cz - rightZ * curbReach },
        });
      }
    }

    // 3. Mid-block crosswalks on long arterial/main avenues
    for (const edge of Y.EDGES) {
      if (edge.kind !== 'arterial' && edge.kind !== 'main') continue;
      if (edge.length < 90) continue;
      const midT = edge.length * 0.5;
      if (hasCloseCrosswalk(edge.index, midT, 26)) continue;
      const cx = edge.a.x + edge.ux * midT;
      const cz = edge.a.z + edge.uz * midT;
      if (Y.inAnyWater?.(cx, cz, 1.0)) continue;
      const rightX = edge.uz;
      const rightZ = -edge.ux;
      const curbReach = edge.width * 0.5 + 1.85;
      registerCrosswalk({
        edge,
        edgeIndex: edge.index,
        t: midT,
        x: cx,
        z: cz,
        ux: edge.ux,
        uz: edge.uz,
        rightX,
        rightZ,
        yaw: edge.yaw,
        width: edge.width,
        length: 3.3,
        roadY: 0.021,
        signal: null,
        signalPhase: -1,
        stopDist: 0,
        node: null,
        midBlock: true,
        hasStopLine: false,
        hasArrow: false,
        curbA: { x: cx + rightX * curbReach, z: cz + rightZ * curbReach },
        curbB: { x: cx - rightX * curbReach, z: cz - rightZ * curbReach },
      });
    }

    return { signals, crosswalks, approachMap, crosswalksByEdge, signalByNode, poleSpots, lenses };
  }

  function emitTrafficWorldProps(layout, api) {
    if (!layout || !api) return;
    const { ground, box, pole, bar, solid, mats } = api;
    const { roadMark, roadGold, steel, steelPale, tar, curb } = mats;
    const lenses = layout.lenses;
    lenses.length = 0;

    // 1. Crosswalks (zebra stripes), stop lines, and directional arrows
    for (const cw of layout.crosswalks) {
      const span = cw.width * 0.5 - 1.25;
      const step = cw.width >= 12 ? 1.14 : 1.04;
      const stripeW = cw.width >= 12 ? 0.54 : 0.48;
      const count = Math.max(3, Math.floor((span * 2) / step));
      const actualSpan = count * step * 0.5;
      for (let i = 0; i <= count; i++) {
        const lat = -actualSpan + i * step;
        ground(roadMark, cw.x + cw.rightX * lat, cw.z + cw.rightZ * lat, stripeW, cw.length, cw.roadY + 0.022, cw.yaw);
      }

      if (cw.hasStopLine && cw.node) {
        const stopX = cw.node.x + cw.ux * cw.stopDist;
        const stopZ = cw.node.z + cw.uz * cw.stopDist;
        const laneSpan = Math.max(1.8, cw.width * 0.5 - 1.35);
        const laneCenter = 0.28 + laneSpan * 0.5;
        ground(roadMark, stopX + cw.rightX * laneCenter, stopZ + cw.rightZ * laneCenter, laneSpan, 0.36, cw.roadY + 0.024, cw.yaw);

        if (cw.hasArrow) {
          const arrowDist = cw.stopDist + 5.2;
          const ax = cw.node.x + cw.ux * arrowDist + cw.rightX * laneCenter;
          const az = cw.node.z + cw.uz * arrowDist + cw.rightZ * laneCenter;
          const inYaw = Math.atan2(-cw.ux, -cw.uz);
          ground(roadMark, ax, az, 0.26, 2.65, cw.roadY + 0.022, inYaw);
          const tipX = ax - cw.ux * 1.28;
          const tipZ = az - cw.uz * 1.28;
          ground(roadMark, tipX + cw.rightX * 0.27 + cw.ux * 0.40, tipZ + cw.rightZ * 0.27 + cw.uz * 0.40, 0.24, 0.98, cw.roadY + 0.023, inYaw + 0.56);
          ground(roadMark, tipX - cw.rightX * 0.27 + cw.ux * 0.40, tipZ - cw.rightZ * 0.27 + cw.uz * 0.40, 0.24, 0.98, cw.roadY + 0.023, inYaw - 0.56);
        }
      } else if (cw.midBlock) {
        // Mid-block crosswalk stop/yield lines in both directions
        const laneSpan = Math.max(2.0, cw.width * 0.5 - 1.35);
        const laneCenter = 0.28 + laneSpan * 0.5;
        for (const dir of [-1, 1]) {
          const sd = cw.length * 0.5 + 1.85;
          const sx = cw.x + cw.ux * sd * dir + cw.rightX * laneCenter * dir;
          const sz = cw.z + cw.uz * sd * dir + cw.rightZ * laneCenter * dir;
          ground(roadMark, sx, sz, laneSpan, 0.32, cw.roadY + 0.024, cw.yaw);
        }
      }
    }

    // 2. Cantilever traffic light masts, signal housings, and pedestrian signal posts
    for (const signal of layout.signals) {
      for (const app of signal.approaches) {
        if (!app.pole) continue;
        const { x: px, z: pz } = app.pole;
        const { outX, outZ, rightX, rightZ, faceYaw, pedFaceYaw, armLen } = app;

        // Concrete base + main vertical pole + solid collider
        box(curb, px, 0.20, pz, 0.50, 0.40, 0.50, faceYaw);
        pole(steel, px, 3.06, pz, 0.23, 6.12);
        pole(steelPale, px, 0.52, pz, 0.29, 0.24);
        solid(px, pz, 0.30, 0.30, 6.12, false);

        // Overhead horizontal cantilever arm reaching leftward over the incoming right-hand lane
        const tipX = px - rightX * armLen;
        const tipZ = pz - rightZ * armLen;
        const midX = px - rightX * (armLen * 0.44);
        const midZ = pz - rightZ * (armLen * 0.44);
        bar(steel, px, 5.74, pz, tipX, 5.82, tipZ, 0.16);
        bar(steel, px, 4.92, pz, midX, 5.76, midZ, 0.085);

        // Overhead horizontal 3-light signal housing (Chinese urban style: Red left, Yellow mid, Green right from driver's view)
        const hx = px - rightX * (armLen * 0.72);
        const hz = pz - rightZ * (armLen * 0.72);
        const hy = 5.56;
        box(tar, hx, hy, hz, 1.56, 0.50, 0.30, faceYaw);
        box(steelPale, hx - outX * 0.02, hy, hz - outZ * 0.02, 1.62, 0.56, 0.08, faceYaw);
        const slotOffsets = [
          { role: 'veh-r', shift: -0.48 },
          { role: 'veh-y', shift: 0.0 },
          { role: 'veh-g', shift: 0.48 },
        ];
        // From driver looking along (-outX, -outZ): driver's left = -right, driver's right = +right.
        for (const slot of slotOffsets) {
          const lx = hx + rightX * slot.shift + outX * 0.165;
          const lz = hz + rightZ * slot.shift + outZ * 0.165;
          box(steel, hx + rightX * slot.shift + outX * 0.24, hy + 0.175, hz + rightZ * slot.shift + outZ * 0.24, 0.34, 0.045, 0.24, faceYaw);
          lenses.push({
            signalId: signal.id, phase: app.phase, role: slot.role,
            x: lx, y: hy, z: lz, yaw: faceYaw, radius: 0.155, halo: 0.72,
          });
        }

        // Secondary vertical 3-light head on the mast for close/low-angle visibility
        const mx = px + outX * 0.22;
        const mz = pz + outZ * 0.22;
        const my = 3.68;
        box(tar, mx, my, mz, 0.42, 1.20, 0.26, faceYaw);
        const vSlots = [
          { role: 'veh-r', dy: 0.36 },
          { role: 'veh-y', dy: 0.0 },
          { role: 'veh-g', dy: -0.36 },
        ];
        for (const slot of vSlots) {
          box(steel, mx + outX * 0.19, my + slot.dy + 0.13, mz + outZ * 0.19, 0.28, 0.04, 0.20, faceYaw);
          lenses.push({
            signalId: signal.id, phase: app.phase, role: slot.role,
            x: mx + outX * 0.145, y: my + slot.dy, z: mz + outZ * 0.145, yaw: faceYaw, radius: 0.12, halo: 0.52,
          });
        }

        // Pedestrian signal head on the mast facing across the crosswalk (-rightX, -rightZ)
        const pedY = 2.62;
        const pfx = -rightX;
        const pfz = -rightZ;
        box(tar, px + pfx * 0.20, pedY, pz + pfz * 0.20, 0.32, 0.66, 0.22, pedFaceYaw);
        lenses.push({
          signalId: signal.id, phase: app.phase, role: 'ped-r',
          x: px + pfx * 0.325, y: pedY + 0.15, z: pz + pfz * 0.325, yaw: pedFaceYaw, radius: 0.105, halo: 0.42,
        });
        lenses.push({
          signalId: signal.id, phase: app.phase, role: 'ped-g',
          x: px + pfx * 0.325, y: pedY - 0.15, z: pz + pfz * 0.325, yaw: pedFaceYaw, radius: 0.105, halo: 0.42,
        });

        // Matching pedestrian signal post on the opposite curb facing back across the crosswalk
        if (app.oppPedPole) {
          const ox = app.oppPedPole.x;
          const oz = app.oppPedPole.z;
          const oppYaw = Math.atan2(rightX, rightZ);
          pole(steel, ox, 1.45, oz, 0.13, 2.90);
          pole(steelPale, ox, 0.18, oz, 0.22, 0.36);
          solid(ox, oz, 0.20, 0.20, 2.90, false);
          box(tar, ox + rightX * 0.14, pedY, oz + rightZ * 0.14, 0.32, 0.66, 0.22, oppYaw);
          lenses.push({
            signalId: signal.id, phase: app.phase, role: 'ped-r',
            x: ox + rightX * 0.265, y: pedY + 0.15, z: oz + rightZ * 0.265, yaw: oppYaw, radius: 0.105, halo: 0.42,
          });
          lenses.push({
            signalId: signal.id, phase: app.phase, role: 'ped-g',
            x: ox + rightX * 0.265, y: pedY - 0.15, z: oz + rightZ * 0.265, yaw: oppYaw, radius: 0.105, halo: 0.42,
          });
        }
      }
    }
  }

  function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.28, 'rgba(255,255,255,0.68)');
    grad.addColorStop(0.62, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function createTrafficSystem(opts) {
    const {
      scene, world, factory, state, cars, pedestrians, Y, random, compact,
      spawnCar, collisionAt, bodyBounds, touchesPerson, clearForPerson, protagonist,
      stepStreetReaction, queryCars, queryPeds,
    } = opts;

    const layout = world.trafficLayout || buildTrafficLayout(Y);
    const signals = layout.signals;
    const crosswalks = layout.crosswalks;

    // Build dynamic instanced signal lenses + additive glow halos (2 draw calls total for entire city)
    const lensList = layout.lenses || [];
    let lensMesh = null;
    let haloMesh = null;
    if (lensList.length > 0) {
      const lensGeo = new T.CircleGeometry(1, 14);
      const lensMat = new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
      lensMesh = new T.InstancedMesh(lensGeo, lensMat, lensList.length);
      lensMesh.frustumCulled = false;
      lensMesh.matrixAutoUpdate = false;
      lensMesh.matrixWorldAutoUpdate = false;

      const haloGeo = new T.PlaneGeometry(1, 1);
      const haloMat = new T.MeshBasicMaterial({
        color: '#ffffff',
        map: createGlowTexture(),
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        blending: T.AdditiveBlending,
        toneMapped: false,
      });
      haloMesh = new T.InstancedMesh(haloGeo, haloMat, lensList.length);
      haloMesh.frustumCulled = false;
      haloMesh.matrixAutoUpdate = false;
      haloMesh.matrixWorldAutoUpdate = false;

      const dummy = new T.Object3D();
      const initCol = new T.Color('#181a1c');
      const blackCol = new T.Color(0, 0, 0);
      for (let i = 0; i < lensList.length; i++) {
        const lens = lensList[i];
        dummy.position.set(lens.x, lens.y, lens.z);
        dummy.rotation.set(0, lens.yaw, 0, 'YXZ');
        dummy.scale.set(lens.radius, lens.radius, 1);
        dummy.updateMatrix();
        lensMesh.setMatrixAt(i, dummy.matrix);
        lensMesh.setColorAt(i, initCol);

        const fx = Math.sin(lens.yaw);
        const fz = Math.cos(lens.yaw);
        dummy.position.set(lens.x + fx * 0.045, lens.y, lens.z + fz * 0.045);
        dummy.scale.set(lens.halo, lens.halo, 1);
        dummy.updateMatrix();
        haloMesh.setMatrixAt(i, dummy.matrix);
        haloMesh.setColorAt(i, blackCol);
      }
      lensMesh.instanceMatrix.needsUpdate = true;
      lensMesh.instanceColor.needsUpdate = true;
      haloMesh.instanceMatrix.needsUpdate = true;
      haloMesh.instanceColor.needsUpdate = true;
      scene.add(lensMesh, haloMesh);
    }

    const COL_RED_ON = new T.Color('#ff2c1f');
    const COL_RED_OFF = new T.Color('#250d0c');
    const COL_YEL_ON = new T.Color('#ffbe18');
    const COL_YEL_OFF = new T.Color('#261d08');
    const COL_GRN_ON = new T.Color('#1cf088');
    const COL_GRN_OFF = new T.Color('#0a2417');
    const COL_PED_RED_ON = new T.Color('#ff3428');
    const COL_PED_GRN_ON = new T.Color('#1ff28b');
    const COL_BLACK = new T.Color(0, 0, 0);
    const scratchHalo = new T.Color();
    let lastSignalTick = -1;
    let lastNight = -1;

    function updateSignals(clock, night = 0, force = false) {
      if (!lensMesh || !haloMesh) return;
      // Refresh at ~12 Hz (or immediately on force) to handle crisp pedestrian flashing with minimal overhead.
      if (!force && clock - lastSignalTick < 0.08 && Math.abs(night - lastNight) < 0.06) return;
      lastSignalTick = clock;
      lastNight = night;
      const haloBoost = 0.36 + night * 0.62;
      const flashOn = Math.floor(clock * 3.2) % 2 === 0;

      for (let i = 0; i < lensList.length; i++) {
        const lens = lensList[i];
        const signal = signals[lens.signalId];
        let on = false;
        let onColor = COL_RED_ON;
        let offColor = COL_RED_OFF;

        if (lens.role === 'veh-r' || lens.role === 'veh-y' || lens.role === 'veh-g') {
          const vState = getVehicleSignalState(signal, lens.phase, clock);
          if (lens.role === 'veh-r') { on = vState === 'red'; onColor = COL_RED_ON; offColor = COL_RED_OFF; }
          else if (lens.role === 'veh-y') { on = vState === 'yellow'; onColor = COL_YEL_ON; offColor = COL_YEL_OFF; }
          else { on = vState === 'green'; onColor = COL_GRN_ON; offColor = COL_GRN_OFF; }
        } else {
          const pState = getPedSignalState(signal, lens.phase, clock);
          if (lens.role === 'ped-r') {
            on = pState === 'stop';
            onColor = COL_PED_RED_ON;
            offColor = COL_RED_OFF;
          } else {
            on = pState === 'walk' || (pState === 'flash' && flashOn);
            onColor = COL_PED_GRN_ON;
            offColor = COL_GRN_OFF;
          }
        }

        lensMesh.setColorAt(i, on ? onColor : offColor);
        if (on) {
          scratchHalo.copy(onColor).multiplyScalar(haloBoost);
          haloMesh.setColorAt(i, scratchHalo);
        } else {
          haloMesh.setColorAt(i, COL_BLACK);
        }
      }
      lensMesh.instanceColor.needsUpdate = true;
      haloMesh.instanceColor.needsUpdate = true;
    }

    // Build enriched traffic loop waypoints with junction/signal/crosswalk metadata
    function buildAnnotatedRoute(nodeIds, reverse) {
      const ids = reverse ? [...nodeIds].reverse() : nodeIds;
      const nodes = ids.map(id => Y.NODES_BY_ID.get(id)).filter(Boolean);
      const rawPts = Y.buildTrafficLoop(nodeIds, reverse, 3.65);
      const n = Math.min(nodes.length, rawPts.length);
      const route = [];
      for (let i = 0; i < n; i++) {
        const prevNode = nodes[(i + n - 1) % n];
        const currNode = nodes[i];
        const nextNode = nodes[(i + 1) % n];
        const inEdge = edgeBetween(prevNode, currNode);
        const outEdge = edgeBetween(currNode, nextNode);
        const approach = inEdge ? layout.approachMap.get(currNode.id + ':' + inEdge.index) || null : null;
        const edgeCrosswalks = inEdge ? layout.crosswalksByEdge.get(inEdge.index) || null : null;
        const hIn = heading2d(prevNode.x, prevNode.z, currNode.x, currNode.z);
        const hOut = heading2d(currNode.x, currNode.z, nextNode.x, nextNode.z);
        route.push({
          x: rawPts[i].x,
          z: rawPts[i].z,
          node: currNode,
          nodeId: currNode.id,
          inEdge,
          outEdge,
          approach,
          crosswalks: edgeCrosswalks,
          turnAngle: angleDiff(hOut, hIn),
          width: inEdge ? inEdge.width : 12.8,
        });
      }
      return route;
    }

    const URBAN_PALETTE = [
      '#e6eaee', '#c85b52', '#5b8fb5', '#dfd0b0', '#6d9b8b', '#aebac4',
      '#394754', '#d4a668', '#52687e', '#8c534c', '#7c8f78', '#ece7da',
      '#4c6d7a', '#b67d5e',
      '#f3f5f7', '#262d36', '#8a95a0', '#2f455c', '#5b433a', '#3c5a52',
      '#c2b8a3', '#6e3b3b', '#415164', '#d8dee4', '#313942', '#7a8a98',
    ];
    const COMPACT_PALETTE = ['#8dd3c7', '#f0e6d2', '#82b6d9', '#e89d84', '#c5d6b8', '#dce4eb', '#f2d388', '#b8c4e0', '#d9a7b0'];
    const BUS_PALETTE = ['#2b8382', '#357996', '#3d8b74', '#2e6f8e'];
    const TAXI_PALETTE = ['#f0c43b', '#e8ba34'];

    function pickTrafficModel(allowBus, slotHash) {
      const models = D.TRAFFIC_MODELS;
      if (!models) {
        const fallback = D.CARS[slotHash % D.CARS.length];
        return { model: fallback, color: URBAN_PALETTE[slotHash % URBAN_PALETTE.length], speedMul: 1 };
      }
      const r = random();
      if (allowBus && r < 0.075) {
        return { model: models.bus, color: BUS_PALETTE[slotHash % BUS_PALETTE.length], speedMul: 0.78 };
      }
      if (r < 0.22) {
        return { model: models.trafficTaxi, color: TAXI_PALETTE[slotHash % TAXI_PALETTE.length], speedMul: 1.04 };
      }
      if (r < 0.44) {
        return { model: models.suv, color: URBAN_PALETTE[slotHash % URBAN_PALETTE.length], speedMul: 0.96 };
      }
      if (r < 0.66) {
        return { model: models.sedan, color: URBAN_PALETTE[(slotHash + 3) % URBAN_PALETTE.length], speedMul: 1.0 };
      }
      if (r < 0.80) {
        return { model: models.compact, color: COMPACT_PALETTE[slotHash % COMPACT_PALETTE.length], speedMul: 0.94 };
      }
      if (r < 0.90) {
        return { model: models.hatch, color: URBAN_PALETTE[(slotHash + 5) % URBAN_PALETTE.length], speedMul: 1.03 };
      }
      if (r < 0.96) {
        return { model: models.van, color: URBAN_PALETTE[(slotHash + 7) % URBAN_PALETTE.length], speedMul: 0.88 };
      }
      return { model: models.coupe, color: URBAN_PALETTE[(slotHash + 2) % URBAN_PALETTE.length], speedMul: 1.08 };
    }

    function* spawnParkedVehicles() {
      if (!Y?.EDGES?.length) return;
      const hub = Y.HUB_SPOT || { x: 285, z: 166 };
      const workshop = Y.WORKSHOP_SPOT || { x: 290.5, z: 136 };
      const loopEdges = new Set();
      for (const nodeIds of (Y.TRAFFIC_LOOPS || [])) {
        for (let k = 0; k < nodeIds.length; k++) {
          const a = Y.NODES_BY_ID.get(nodeIds[k]);
          const b = Y.NODES_BY_ID.get(nodeIds[(k + 1) % nodeIds.length]);
          const ed = a && b ? edgeBetween(a, b) : null;
          if (ed) loopEdges.add(ed.index);
        }
      }
      const hotspots = [
        hub,
        ...(Y.LANDMARKS || []).map(lm => ({ x: lm.x, z: lm.z })),
      ];
      const scoreEdge = e => {
        let best = Infinity;
        for (const h of hotspots) {
          const d = dist2d(e.cx, e.cz, h.x, h.z);
          if (d < best) best = d;
        }
        return best - (e.width >= 15 ? 45 : e.width >= 12.5 ? 25 : 0);
      };
      const candidates = [...Y.EDGES]
        .filter(e => e.length >= 30 && e.width >= 9.0)
        .sort((a, b) => scoreEdge(a) - scoreEdge(b));

      const maxParked = compact ? 36 : 76;
      let parkedCount = 0;
      let slotHash = 13;

      for (let ei = 0; ei < candidates.length && parkedCount < maxParked; ei++) {
        const e = candidates[ei];
        const onLoop = loopEdges.has(e.index);
        // Never block active traffic on narrow streets; arterials and wide mains have generous shoulders
        if (onLoop && e.width < 12.5) continue;
        const curbOffset = e.width >= 15
          ? e.width * 0.5 - 1.18
          : e.width >= 12.5
            ? (onLoop ? e.width * 0.5 - 0.82 : e.width * 0.5 - 1.15)
            : e.width * 0.5 - 1.12;
        const sides = e.width >= 15 || (!onLoop && e.length > 55) ? [-1, 1] : [ei % 2 ? 1 : -1];
        const margin = 14.5;
        const usable = e.length - margin * 2;
        if (usable < 6) continue;

        for (const side of sides) {
          if (parkedCount >= maxParked) break;
          const maxBay = Math.min(3, Math.max(1, Math.floor(usable / 11)));
          const bayCount = random() < 0.65 ? Math.min(maxBay, 2) : maxBay;
          const startT = margin + random() * Math.max(1, usable - (bayCount - 1) * 7.6);

          for (let b = 0; b < bayCount && parkedCount < maxParked; b++) {
            const t = startT + b * (6.9 + random() * 1.6);
            if (t > e.length - margin) break;
            const px = e.a.x + e.ux * t + e.uz * curbOffset * side;
            const pz = e.a.z + e.uz * t - e.ux * curbOffset * side;
            const pyaw = heading2d(e.a.x, e.a.z, e.b.x, e.b.z) + (side > 0 ? 0 : PI);

            if (dist2d(px, pz, hub.x, hub.z) < 10.5) continue;
            if (dist2d(px, pz, workshop.x, workshop.z) < 11.5) continue;
            if (Y.inAnyWater?.(px, pz, 1.5)) continue;
            if (crosswalks.some(cw => dist2d(cw.x, cw.z, px, pz) < 8.5)) continue;
            if (cars.some(other => dist2d(other.x, other.z, px, pz) < 6.4)) continue;

            let spec = pickTrafficModel(false, slotHash++);
            if (onLoop && e.width < 15 && spec.model.kind === 'van') {
              spec = { model: D.TRAFFIC_MODELS?.sedan || D.CARS[2], color: URBAN_PALETTE[slotHash % URBAN_PALETTE.length], speedMul: 1 };
            }
            const probe = { model: spec.model, bodyBounds: spec.model.bodyBounds };
            if (collisionAt(probe, px, pz, pyaw)) continue;

            const car = spawnCar(spec.model, px, pz, pyaw, 'parked', spec.color);
            car.ambientParked = true;
            parkedCount++;
          }
          if ((parkedCount & 7) === 0) yield;
        }
      }
    }

    let nextVehicleId = 1;
    function* spawnTrafficVehicles() {
      if (!Y?.TRAFFIC_LOOPS?.length) return;
      const hub = Y.HUB_SPOT || { x: 285, z: 166 };
      const spacingTarget = compact ? 130 : 78;
      const maxTotal = compact ? 86 : 168;
      let spawned = 0;

      for (const [loopIndex, nodeIds] of Y.TRAFFIC_LOOPS.entries()) {
        // Measure loop perimeter & narrowest road width
        let minW = 99;
        let perimeter = 0;
        for (let k = 0; k < nodeIds.length; k++) {
          const a = Y.NODES_BY_ID.get(nodeIds[k]);
          const b = Y.NODES_BY_ID.get(nodeIds[(k + 1) % nodeIds.length]);
          if (!a || !b) continue;
          perimeter += dist2d(a.x, a.z, b.x, b.z);
          const ed = edgeBetween(a, b);
          if (ed && ed.width < minW) minW = ed.width;
        }
        const allowBus = minW >= 12.8;
        const perLane = clamp(Math.round(perimeter / spacingTarget), 2, compact ? 7 : 12);

        for (let lane = 0; lane < 2; lane++) {
          const route = buildAnnotatedRoute(nodeIds, lane === 1);
          if (route.length < 3) continue;

          // Precompute cumulative distances for uniform spacing
          const segLens = [];
          let totalLen = 0;
          for (let k = 0; k < route.length; k++) {
            const a = route[k];
            const b = route[(k + 1) % route.length];
            const d = dist2d(a.x, a.z, b.x, b.z);
            segLens.push(d);
            totalLen += d;
          }
          if (totalLen < 30) continue;

          // Prefer anchoring one slot near HUB on Loop 0/3/7 so spawn scene immediately looks alive
          let startOffset = ((loopIndex * 37 + lane * 71) % 100) / 100 * totalLen;
          if (loopIndex === 0 || loopIndex === 3 || loopIndex === 7) {
            let acc = 0;
            for (let k = 0; k < route.length; k++) {
              if (route[k].nodeId === 'q19') {
                startOffset = ((acc - (lane === 0 ? 28 : 42)) % totalLen + totalLen) % totalLen;
                break;
              }
              acc += segLens[k];
            }
          }

          for (let slot = 0; slot < perLane; slot++) {
            if (spawned >= maxTotal) break;
            const distAlong = (startOffset + (slot / perLane) * totalLen + (random() - 0.5) * 14 + totalLen) % totalLen;
            let acc = 0;
            let seg = 0;
            for (let k = 0; k < route.length; k++) {
              if (acc + segLens[k] >= distAlong) { seg = k; break; }
              acc += segLens[k];
            }
            const a = route[seg];
            const b = route[(seg + 1) % route.length];
            const segLen = Math.max(0.1, segLens[seg]);
            const frac = clamp((distAlong - acc) / segLen, 0.14, 0.86);
            const sx = mix(a.x, b.x, frac);
            const sz = mix(a.z, b.z, frac);
            const syaw = heading2d(a.x, a.z, b.x, b.z);

            if (dist2d(sx, sz, hub.x, hub.z) < 11) continue;
            if (cars.some(other => dist2d(other.x, other.z, sx, sz) < 10.5)) continue;

            // Put a recognizable city bus near HUB on Loop 0 lane 0 slot 0
            let spec;
            if (loopIndex === 0 && lane === 0 && slot === 0 && D.TRAFFIC_MODELS?.bus) {
              spec = { model: D.TRAFFIC_MODELS.bus, color: BUS_PALETTE[0], speedMul: 0.78 };
            } else {
              spec = pickTrafficModel(allowBus, loopIndex * 11 + lane * 5 + slot);
            }

            const probe = { model: spec.model, bodyBounds: spec.model.bodyBounds };
            if (collisionAt(probe, sx, sz, syaw)) continue;

            const car = spawnCar(spec.model, sx, sz, syaw, 'traffic', spec.color);
            car.trafficId = nextVehicleId++;
            car.route = route;
            car.next = (seg + 1) % route.length;
            car.cruise = (8.2 + random() * 3.4) * spec.speedMul;
            car.pace = car.cruise * 0.65;
            car.turnSignal = 0;
            car.signalDelay = 0;
            car.wasRedStopped = false;
            car.stuckFor = 0;
            car.creepUntil = 0;
            spawned++;
          }
          yield;
        }
      }
    }

    // Curated outfits (40 combinations -> cached geometries in vehicles.js for super fast boot & low VRAM)
    const PED_OUTFITS = [
      ['#e8e2d5', '#44586c', '#d8ab84', 0], ['#6c9bc0', '#3f4956', '#c69370', 1],
      ['#d67e61', '#545b66', '#dfb38b', 2], ['#76a382', '#4c524a', '#bc8562', 3],
      ['#dfb96c', '#455568', '#d5a680', 4], ['#9888b2', '#3c4352', '#e0b792', 5],
      ['#c86d6d', '#47525e', '#c99672', 0], ['#5d9791', '#5c5347', '#b57b58', 1],
      ['#3d5a73', '#6b655c', '#d6a982', 2], ['#e0c8a8', '#3c4b59', '#c28e6b', 3],
      ['#a85d52', '#39414a', '#dcb18a', 4], ['#7c8f68', '#4d4a44', '#c99774', 5],
      ['#566b84', '#635c51', '#e2b994', 0], ['#d49774', '#414f5e', '#b98260', 1],
      ['#8ba8b5', '#4b4d54', '#d8aa83', 2], ['#c9a96e', '#3e4e5c', '#c79471', 3],
      ['#6c7e96', '#564f46', '#dfb58e', 4], ['#b66b78', '#424954', '#c28d6a', 5],
      ['#e5ded0', '#58626e', '#d6a881', 1], ['#4d7c74', '#3b4550', '#c89572', 2],
      ['#cc8859', '#4a5562', '#ddb088', 3], ['#7f93a8', '#524b44', '#b77d5a', 4],
      ['#8d9e76', '#3d4754', '#d9ac86', 5], ['#a67e6b', '#44505c', '#c4916e', 0],
      ['#5c87a3', '#5a564e', '#e1b790', 2], ['#d5b492', '#3f4957', '#c79370', 3],
      ['#7e6f8c', '#48525e', '#d4a47e', 4], ['#629489', '#4b5560', '#be8764', 5],
      ['#f0ece2', '#364352', '#d7aa83', 0], ['#2e4057', '#5a554c', '#c89471', 1],
      ['#b5654d', '#3e4854', '#deb28a', 2], ['#5e7d6c', '#454842', '#bf8864', 3],
      ['#c99a5b', '#394654', '#d9ac85', 4], ['#455468', '#686158', '#e0b690', 5],
      ['#8f4f56', '#3c444f', '#cc9874', 0], ['#d6cbb8', '#4b5c6e', '#c18c69', 1],
      ['#4b6c80', '#384048', '#d5a780', 2], ['#a4b09a', '#4f4a43', '#dfb38c', 3],
      ['#735d78', '#404a56', '#c5926f', 4], ['#d89e78', '#3c4855', '#d6a982', 5],
    ];

    function createPedestrian(outfitIdx, x, z, yaw) {
      const [top, bottom, skin, styleIdx] = PED_OUTFITS[outfitIdx % PED_OUTFITS.length];
      const ped = factory.person(top, bottom, skin, false, styleIdx);
      const heightScale = 0.92 + random() * 0.14;
      ped.root.scale.set(0.96 + random() * 0.08, heightScale, 0.96 + random() * 0.08);
      ped.x = x;
      ped.z = z;
      ped.yaw = yaw;
      ped.walk = 1.15 + random() * 0.56;
      ped.visiblePace = ped.walk;
      ped.crossingState = 'sidewalk';
      ped.activeCrosswalk = null;
      ped.waitingAtCrosswalk = false;
      ped.lookPhase = random() * PI * 2;
      ped.idleUntil = 0;
      ped.idleChance = 0;
      ped.stationary = false;
      pedestrians.push(ped);
      return ped;
    }

    function isSafeSidewalk(x, z, roadMargin = 0.25) {
      if (world.collision(x, z, 0.48)) return false;
      if (Y?.inAnyWater?.(x, z, 1.15)) return false;
      if (Y?.onAnyRoad?.(x, z, roadMargin)) return false;
      return true;
    }

    function isClearOfPeds(x, z, minGap = 1.15) {
      const g2 = minGap * minGap;
      for (let i = 0; i < pedestrians.length; i++) {
        const dx = pedestrians[i].x - x;
        const dz = pedestrians[i].z - z;
        if (dx * dx + dz * dz < g2) return false;
      }
      return true;
    }

    function findClearCurb(baseX, baseZ, outX, outZ, awayX, awayZ) {
      const tries = [
        [0, 0], [0, 0.65], [0, 1.3], [0.8, 0.5], [-0.8, 0.5], [1.4, 1.0], [-1.4, 1.0], [0, 2.0],
      ];
      for (const [along, outward] of tries) {
        const px = baseX + outX * along + awayX * outward;
        const pz = baseZ + outZ * along + awayZ * outward;
        if (isSafeSidewalk(px, pz, 0.22)) return { x: px, z: pz };
      }
      return null;
    }

    function* spawnPedestrians() {
      const hub = Y?.HUB_SPOT || { x: 285, z: 166 };
      let outfitCursor = 0;

      // Group A: Crosswalk-crossing pedestrians (signalized + busy + mid-block crosswalks)
      const rankedCrosswalks = [...crosswalks].sort((a, b) => {
        const scoreA = (a.signal ? 40 : 0) + (a.midBlock ? 15 : 0) + Math.max(0, 120 - dist2d(a.x, a.z, hub.x, hub.z)) * 0.5;
        const scoreB = (b.signal ? 40 : 0) + (b.midBlock ? 15 : 0) + Math.max(0, 120 - dist2d(b.x, b.z, hub.x, hub.z)) * 0.5;
        return scoreB - scoreA;
      });

      const maxCrosswalkPeds = compact ? 68 : 138;
      let crossPedCount = 0;
      for (const cw of rankedCrosswalks) {
        if (crossPedCount >= maxCrosswalkPeds) break;
        const waitA = findClearCurb(cw.curbA.x, cw.curbA.z, cw.ux, cw.uz, cw.rightX, cw.rightZ);
        const waitB = findClearCurb(cw.curbB.x, cw.curbB.z, cw.ux, cw.uz, -cw.rightX, -cw.rightZ);
        if (!waitA || !waitB) continue;

        // Optional sidewalk extensions along the road from each curb
        const extLen = 8 + random() * 8;
        const extA = { x: waitA.x + cw.ux * extLen, z: waitA.z + cw.uz * extLen };
        const extB = { x: waitB.x + cw.ux * extLen, z: waitB.z + cw.uz * extLen };
        const hasExtA = isSafeSidewalk(extA.x, extA.z, 0.25) && isSafeSidewalk(mix(waitA.x, extA.x, 0.5), mix(waitA.z, extA.z, 0.5), 0.15);
        const hasExtB = isSafeSidewalk(extB.x, extB.z, 0.25) && isSafeSidewalk(mix(waitB.x, extB.x, 0.5), mix(waitB.z, extB.z, 0.5), 0.15);

        const nearHub = dist2d(cw.x, cw.z, hub.x, hub.z) < 95;
        const perCw = nearHub ? (compact ? 3 : 4) : (cw.signal ? (compact ? 2 : (random() < 0.55 ? 3 : 2)) : (random() < 0.45 ? 2 : 1));

        for (let k = 0; k < perCw && crossPedCount < maxCrosswalkPeds; k++) {
          // Slight longitudinal stagger across the zebra crossing width so people walk naturally abreast
          const stagger = (k - (perCw - 1) * 0.5) * 0.78;
          const shift = pt => ({ x: pt.x + cw.ux * stagger, z: pt.z + cw.uz * stagger });
          const pWaitA = shift(waitA);
          const pWaitB = shift(waitB);
          const loop = [];
          if (hasExtA) loop.push({ ...shift(extA), cross: null });
          loop.push({ ...pWaitA, cross: cw, role: 'curb' });
          loop.push({ ...pWaitB, cross: cw, role: 'curb' });
          if (hasExtB) loop.push({ ...shift(extB), cross: null });
          // Return trip back across crosswalk
          loop.push({ ...pWaitB, cross: cw, role: 'curb' });
          loop.push({ ...pWaitA, cross: cw, role: 'curb' });

          // Start on a sidewalk or waiting right at the curb (never spawning mid-road on a red light)
          const startIdx = k % 2 === 0 ? 0 : (hasExtB ? 3 : 2) % loop.length;
          const nextIdx = (startIdx + 1) % loop.length;
          const startPt = loop[startIdx];
          const ped = createPedestrian(outfitCursor++, startPt.x, startPt.z, heading2d(startPt.x, startPt.z, loop[nextIdx].x, loop[nextIdx].z));
          ped.loop = loop;
          ped.index = nextIdx;
          ped.isCrosswalker = true;
          crossPedCount++;
        }
        if ((crossPedCount & 7) === 0) yield;
      }

      // Group B: Sidewalk strollers & walking pairs across all city roads
      const maxSidewalkPeds = compact ? 95 : 210;
      let sidewalkCount = 0;
      const walkEdges = Y ? [...Y.EDGES].filter(e => e.length > 22).sort((a, b) => {
        const da = dist2d(a.cx, a.cz, hub.x, hub.z);
        const db = dist2d(b.cx, b.cz, hub.x, hub.z);
        return da - db;
      }) : [];

      for (let i = 0; i < walkEdges.length && sidewalkCount < maxSidewalkPeds; i++) {
        const e = walkEdges[i];
        const sides = e.length > 38 ? [-1, 1] : [i % 2 ? 1 : -1];
        for (const side of sides) {
          if (sidewalkCount >= maxSidewalkPeds) break;
          const nx = e.uz * (e.width * 0.5 + 2.05) * side;
          const nz = -e.ux * (e.width * 0.5 + 2.05) * side;
          const margin = Math.min(11.5, e.length * 0.24);
          const pA = { x: e.a.x + e.ux * margin + nx, z: e.a.z + e.uz * margin + nz };
          const pB = { x: e.b.x - e.ux * margin + nx, z: e.b.z - e.uz * margin + nz };
          if (!isSafeSidewalk(pA.x, pA.z, 0.25) || !isSafeSidewalk(pB.x, pB.z, 0.25)) continue;
          const midX = (pA.x + pB.x) * 0.5;
          const midZ = (pA.z + pB.z) * 0.5;
          if (!isSafeSidewalk(midX, midZ, 0.2)) continue;

          const slots = (!compact && e.length > 82) ? 2 : 1;
          for (let s = 0; s < slots && sidewalkCount < maxSidewalkPeds; s++) {
            const forward = ((i + s + (side > 0 ? 1 : 0)) % 2) === 0;
            const loop = forward ? [pA, pB] : [pB, pA];
            const baseFrac = slots === 2 ? (s === 0 ? 0.18 + random() * 0.24 : 0.56 + random() * 0.26) : (0.16 + random() * 0.68);
            let px = mix(loop[0].x, loop[1].x, baseFrac);
            let pz = mix(loop[0].z, loop[1].z, baseFrac);
            if (!isSafeSidewalk(px, pz, 0.22)) { px = loop[0].x; pz = loop[0].z; }
            const ped = createPedestrian(outfitCursor++, px, pz, heading2d(loop[0].x, loop[0].z, loop[1].x, loop[1].z));
            ped.loop = loop;
            ped.index = 1;
            sidewalkCount++;

            // ~42% chance to spawn a walking companion side-by-side for lively street crowds
            if (sidewalkCount < maxSidewalkPeds && random() < (compact ? 0.24 : 0.42)) {
              const offX = e.uz * 0.72 * side - e.ux * 0.35;
              const offZ = -e.ux * 0.72 * side - e.uz * 0.35;
              const cx = px + offX;
              const cz = pz + offZ;
              if (isSafeSidewalk(cx, cz, 0.22)) {
                const mate = createPedestrian(outfitCursor++, cx, cz, ped.yaw);
                mate.loop = loop.map(pt => ({ x: pt.x + e.uz * 0.72 * side, z: pt.z - e.ux * 0.72 * side }));
                mate.index = 1;
                mate.walk = ped.walk;
                sidewalkCount++;

                // ~16% chance for a 3rd friend trailing slightly behind
                if (!compact && sidewalkCount < maxSidewalkPeds && random() < 0.16) {
                  const dirSign = forward ? 1 : -1;
                  const tx = px - e.ux * 1.15 * dirSign + e.uz * 0.34 * side;
                  const tz = pz - e.uz * 1.15 * dirSign - e.ux * 0.34 * side;
                  if (isSafeSidewalk(tx, tz, 0.22)) {
                    const third = createPedestrian(outfitCursor++, tx, tz, ped.yaw);
                    third.loop = loop.map(pt => ({ x: pt.x + e.uz * 0.34 * side, z: pt.z - e.ux * 0.34 * side }));
                    third.index = 1;
                    third.walk = ped.walk;
                    sidewalkCount++;
                  }
                }
              }
            }
          }
          if ((sidewalkCount & 7) === 0) yield;
        }
      }

      // Group C: Waterfront promenade & Quzhou landmark plaza strollers
      const promenadeZ = compact
        ? [63, 102, 128, 162, 183, -12, -38, -68, -88, 28]
        : [-96, -82, -64, -46, -28, -10, 8, 26, 44, 63, 82, 98, 114, 128, 144, 160, 176, 192, 212, 232, -135, -172, -210, 248];
      for (const z of promenadeZ) {
        const inner = z > -110 && z < 193;
        const px = (inner ? 303.0 : 321.1) + random() * (inner ? 2.4 : 4.0);
        const loop = [{ x: px, z: inner ? -106 : -261 }, { x: px + (inner ? 0.45 : 2.1), z: inner ? 187 : 263 }];
        const idx = Math.abs(Math.round(z)) % 2;
        const ped = createPedestrian(outfitCursor++, px, z, idx ? 0 : PI);
        ped.loop = loop;
        ped.index = idx;
        ped.walk = 1.22 + random() * 0.42;
        ped.idleChance = 0.22;
      }

      // Group D: Rich landmark & plaza crowds (Shuitingmen, Confucius Temple, Bell Tower, Mazhandi, Fushan Park, HUB plaza)
      const plazaSeeds = [
        ...(Y?.LANDMARKS || []).map(lm => ({
          x: lm.x,
          z: lm.z,
          strollers: compact ? 3 : 6,
          pairs: compact ? 1 : 2,
          radius: 26,
        })),
        { x: hub.x + 4, z: hub.z + 10, strollers: compact ? 3 : 5, pairs: compact ? 1 : 2, radius: 22 },
        { x: hub.x - 2, z: hub.z - 12, strollers: compact ? 2 : 4, pairs: 1, radius: 20 },
      ];
      for (const spot of plazaSeeds) {
        // Strolling visitors with occasional pauses to admire historic architecture
        let placed = 0;
        for (let attempt = 0; attempt < 36 && placed < spot.strollers; attempt++) {
          const ang = random() * PI * 2;
          const rad = 6.5 + random() * spot.radius;
          const ax = spot.x + Math.cos(ang) * rad;
          const az = spot.z + Math.sin(ang) * rad;
          const turnAng = ang + (random() < 0.5 ? 1 : -1) * (0.65 + random() * 1.1);
          const stepLen = 8 + random() * 11;
          const bx = ax + Math.cos(turnAng) * stepLen;
          const bz = az + Math.sin(turnAng) * stepLen;
          if (!isSafeSidewalk(ax, az, 0.4) || !isSafeSidewalk(bx, bz, 0.4)) continue;
          if (!isSafeSidewalk((ax + bx) * 0.5, (az + bz) * 0.5, 0.35)) continue;
          if (!isClearOfPeds(ax, az, 1.3)) continue;
          const cx = bx + Math.cos(turnAng + 1.15) * (6 + random() * 7);
          const cz = bz + Math.sin(turnAng + 1.15) * (6 + random() * 7);
          const hasThird = isSafeSidewalk(cx, cz, 0.4) && isSafeSidewalk((bx + cx) * 0.5, (bz + cz) * 0.5, 0.35) && isSafeSidewalk((ax + cx) * 0.5, (az + cz) * 0.5, 0.35);
          const ped = createPedestrian(outfitCursor++, ax, az, heading2d(ax, az, bx, bz));
          ped.loop = hasThird ? [{ x: ax, z: az }, { x: bx, z: bz }, { x: cx, z: cz }] : [{ x: ax, z: az }, { x: bx, z: bz }];
          ped.index = 1;
          ped.walk = 1.05 + random() * 0.42;
          ped.idleChance = 0.45;
          placed++;
        }

        // Conversing pairs & spectators standing near landmarks/plazas
        let pairsPlaced = 0;
        for (let attempt = 0; attempt < 24 && pairsPlaced < spot.pairs; attempt++) {
          const ang = random() * PI * 2;
          const rad = 7 + random() * (spot.radius * 0.78);
          const px = spot.x + Math.cos(ang) * rad;
          const pz = spot.z + Math.sin(ang) * rad;
          if (!isSafeSidewalk(px, pz, 0.55) || !isClearOfPeds(px, pz, 1.8)) continue;
          const pairAng = random() * PI * 2;
          const qx = px + Math.cos(pairAng) * 1.12;
          const qz = pz + Math.sin(pairAng) * 1.12;
          if (!isSafeSidewalk(qx, qz, 0.55) || !isClearOfPeds(qx, qz, 1.2)) continue;

          const yawA = heading2d(px, pz, qx, qz);
          const yawB = heading2d(qx, qz, px, pz);
          const pedA = createPedestrian(outfitCursor++, px, pz, yawA);
          pedA.loop = [{ x: px, z: pz }];
          pedA.index = 0;
          pedA.stationary = true;
          pedA.baseYaw = yawA;
          pedA.visiblePace = 0;

          const pedB = createPedestrian(outfitCursor++, qx, qz, yawB);
          pedB.loop = [{ x: qx, z: qz }];
          pedB.index = 0;
          pedB.stationary = true;
          pedB.baseYaw = yawB;
          pedB.visiblePace = 0;
          pairsPlaced++;
        }
        yield;
      }
    }

    function isCrosswalkOccupied(cw, p) {
      // Check walking player first
      if (!state.vehicle && !state.boat) {
        const dx = p.x - cw.x;
        const dz = p.z - cw.z;
        const along = Math.abs(dx * cw.ux + dz * cw.uz);
        const across = Math.abs(dx * cw.rightX + dz * cw.rightZ);
        if (along < cw.length * 0.5 + 1.35 && across < cw.width * 0.5 + 0.85) return true;
      }
      // Check pedestrians currently crossing or stepping onto this crosswalk
      const checkRadius = cw.width * 0.6 + 3.2;
      let occupied = false;
      const testPed = ped => {
        if (occupied || ped.streetReaction) return;
        if (Math.abs(ped.x - cw.x) > checkRadius || Math.abs(ped.z - cw.z) > checkRadius) return;
        const dx = ped.x - cw.x;
        const dz = ped.z - cw.z;
        const along = Math.abs(dx * cw.ux + dz * cw.uz);
        const across = Math.abs(dx * cw.rightX + dz * cw.rightZ);
        if (along < cw.length * 0.5 + 1.15 && across < cw.width * 0.5 + 0.35) occupied = true;
      };
      if (queryPeds) queryPeds(cw.x, cw.z, checkRadius, testPed);
      else for (let i = 0; i < pedestrians.length; i++) { testPed(pedestrians[i]); if (occupied) break; }
      return occupied;
    }

    function stepVehicle(car, dt) {
      if (!car.route || !car.route.length) return;
      const wp = car.route[car.next];
      const gap = dist2d(car.x, car.z, wp.x, wp.z);
      const turn = angleDiff(heading2d(car.x, car.z, wp.x, wp.z), car.yaw);
      if (gap < 4.75 || (gap < 8.2 && Math.abs(turn) > 1.18)) {
        car.next = (car.next + 1) % car.route.length;
      }

      const targetWp = car.route[car.next];
      const targetGap = dist2d(car.x, car.z, targetWp.x, targetWp.z);
      const targetTurn = angleDiff(heading2d(car.x, car.z, targetWp.x, targetWp.z), car.yaw);
      const steerRate = car.model.kind === 'bus' ? 2.05 : 2.65;
      const nextYaw = car.yaw + clamp(targetTurn, -dt * steerRate, dt * steerRate);
      if (Math.abs(targetTurn) > 0.001 && !collisionAt(car, car.x, car.z, nextYaw)) car.yaw = nextYaw;

      // Automatic blinking turn signals approaching turning junctions
      if (targetGap < 25 && Math.abs(targetWp.turnAngle) > 0.48) {
        car.turnSignal = targetWp.turnAngle > 0 ? 1 : -1;
      } else {
        car.turnSignal = 0;
      }

      const dx = Math.sin(car.yaw);
      const dz = Math.cos(car.yaw);
      const myBounds = bodyBounds(car);
      const myHalfLen = myBounds.halfLength;
      const myHalfWidth = myBounds.halfWidth;

      let desired = Math.abs(targetTurn) > 0.34 ? car.cruise * 0.56 : car.cruise;
      let stoppedForSignal = false;
      let blockedByExternal = false;

      // 1. Traffic light compliance
      const approach = targetWp.approach;
      if (approach && approach.signal) {
        const sigState = getVehicleSignalState(approach.signal, approach.phase, state.clock);
        // Make sure car is actually facing toward this approach
        const align = -(dx * approach.outX + dz * approach.outZ);
        if (align > 0.55) {
          const distFromNode = (car.x - approach.node.x) * approach.outX + (car.z - approach.node.z) * approach.outZ;
          const toStop = distFromNode - approach.stopDist - myHalfLen;
          if (sigState === 'red' && toStop > -1.1 && toStop < 28) {
            stoppedForSignal = true;
            car.wasRedStopped = true;
            const cap = toStop <= 0.55 ? 0 : Math.max(0, (toStop - 0.35) * 0.72);
            desired = Math.min(desired, cap);
          } else if (sigState === 'yellow' && toStop > 3.2 && toStop < 26) {
            stoppedForSignal = true;
            car.wasRedStopped = true;
            const cap = Math.max(0, (toStop - 0.35) * 0.74);
            desired = Math.min(desired, cap);
          } else if (sigState === 'green' && car.wasRedStopped) {
            car.wasRedStopped = false;
            car.signalDelay = 0.22 + random() * 0.34;
          }
        }
      }
      if (car.signalDelay > 0) {
        car.signalDelay = Math.max(0, car.signalDelay - dt);
        desired = 0;
        stoppedForSignal = true;
      }

      // 2. Yield to pedestrians & player on crosswalks ahead (礼让斑马线)
      const p = protagonist();
      if (targetWp.crosswalks && desired > 0) {
        for (const cw of targetWp.crosswalks) {
          const ahead = (cw.x - car.x) * dx + (cw.z - car.z) * dz;
          if (ahead < myHalfLen + 0.2 || ahead > myHalfLen + 14.5) continue;
          const across = Math.abs((cw.x - car.x) * dz - (cw.z - car.z) * dx);
          if (across > cw.width * 0.5 + 1.5) continue;
          if (isCrosswalkOccupied(cw, p)) {
            const toCw = ahead - cw.length * 0.5 - myHalfLen - 1.25;
            const cap = toCw <= 0.5 ? 0 : Math.max(0, toCw * 0.68);
            desired = Math.min(desired, cap);
            blockedByExternal = true;
          }
        }
      }

      // 3. Yield to player (on foot or driving) directly ahead
      const pAhead = (p.x - car.x) * dx + (p.z - car.z) * dz;
      const pAcross = Math.abs((p.x - car.x) * dz - (p.z - car.z) * dx);
      const pRange = (state.vehicle ? 8.8 : 6.4) + myHalfLen;
      const pWidth = (state.vehicle ? 1.85 : 1.15) + myHalfWidth;
      if (pAhead > -0.4 && pAhead < pRange && pAcross < pWidth) {
        desired = 0;
        blockedByExternal = true;
      }

      // 4. Smart car-following & cross-traffic check with anti-deadlock
      const creeping = state.clock < (car.creepUntil ?? 0);
      const safeFollow = 3.0 + car.pace * 0.44;
      const checkCar = other => {
        if (other === car || other === state.vehicle) return;
        const rx = other.x - car.x;
        const rz = other.z - car.z;
        if (Math.abs(rx) > 15 || Math.abs(rz) > 15) return;
        const ahead = rx * dx + rz * dz;
        if (ahead <= 0.2) return;
        const across = Math.abs(rx * dz - rz * dx);
        const ob = bodyBounds(other);
        const headingDot = dx * Math.sin(other.yaw) + dz * Math.cos(other.yaw);

        // Same-direction / parked car in our lane
        if (headingDot > 0.35 || other.type === 'parked') {
          const minGap = myHalfLen + ob.halfLength + safeFollow;
          if (ahead < minGap && across < myHalfWidth + ob.halfWidth + 0.38) {
            const clearance = ahead - myHalfLen - ob.halfLength - 1.65;
            if (clearance <= 0.5) desired = 0;
            else desired = Math.min(desired, Math.max(0, Math.min(other.pace ?? 0, clearance * 0.9)));
          }
        } else if (headingDot > -0.55 && !creeping) {
          // Perpendicular / crossing vehicle inside intersection box
          const crossGap = myHalfLen + ob.halfLength + 3.4;
          if (ahead < crossGap && across < myHalfWidth + ob.halfLength + 0.65) {
            desired = Math.min(desired, 0);
          }
        }
      };
      if (queryCars) queryCars(car.x, car.z, 15.5, checkCar);
      else for (let i = 0; i < cars.length; i++) checkCar(cars[i]);

      // Anti-deadlock safeguard inside intersections
      if (!stoppedForSignal && !blockedByExternal && desired < 0.35 && car.pace < 0.35) {
        car.stuckFor = (car.stuckFor ?? 0) + dt;
        if (car.stuckFor > 3.6) {
          car.creepUntil = state.clock + 2.4;
          car.stuckFor = 0;
        }
      } else {
        car.stuckFor = 0;
      }

      car.brake = desired < 0.45 || car.pace > desired + 0.55;
      car.pace = smooth(car.pace, desired, desired > car.pace ? 1.85 : 5.8, dt);
      const nx = car.x + dx * car.pace * dt;
      const nz = car.z + dz * car.pace * dt;
      if (!collisionAt(car, nx, nz, car.yaw)) {
        car.x = nx;
        car.z = nz;
      } else {
        car.pace = smooth(car.pace, 0, 7.5, dt);
      }
      car.speed = car.pace;
      car.vx = dx * car.pace;
      car.vz = dz * car.pace;
      car.steer = clamp(targetTurn, -0.7, 0.7);
      car.lean = -car.steer * (car.model.kind === 'bus' ? 0.025 : 0.05);
    }

    function hasApproachingCarForCrosswalk(cw) {
      let approaching = false;
      const checkApproach = car => {
        if (approaching || car.speed < 2.2) return;
        const dx = cw.x - car.x;
        const dz = cw.z - car.z;
        if (Math.abs(dx) > 16 || Math.abs(dz) > 16) return;
        const fx = Math.sin(car.yaw);
        const fz = Math.cos(car.yaw);
        const ahead = dx * fx + dz * fz;
        const across = Math.abs(dx * fz - dz * fx);
        if (ahead > 1.2 && ahead < 13.5 && across < cw.width * 0.5 + 1.0) approaching = true;
      };
      if (queryCars) queryCars(cw.x, cw.z, 16.5, checkApproach);
      else for (let i = 0; i < cars.length; i++) { checkApproach(cars[i]); if (approaching) break; }
      return approaching;
    }

    function stepPedestrian(ped, dt) {
      if (ped.streetReaction) { stepStreetReaction(ped, dt); return; }
      if (ped.contactVehicle && !touchesPerson(ped.contactVehicle, ped.x, ped.z, 0.64)) ped.contactVehicle = null;

      const threat = state.vehicle && state.vehicle.speed > 5 && dist2d(state.vehicle.x, state.vehicle.z, ped.x, ped.z) < 6.7;
      const escaping = state.clock < (ped.escapeUntil ?? 0);

      if (!threat && !escaping && state.clock < (ped.bellLookUntil ?? 0)) {
        ped.yaw += angleDiff(ped.bellLookYaw ?? ped.yaw, ped.yaw) * (1 - Math.exp(-6.5 * dt));
        ped.visiblePace = smooth(ped.visiblePace ?? 0, 0, 7.5, dt);
        ped.fleeing = false;
        return;
      }

      // Stationary conversing/sightseeing pedestrians react to danger, otherwise gently look around
      if (ped.stationary && !threat && !escaping) {
        const swayYaw = (ped.baseYaw ?? ped.yaw) + Math.sin(state.clock * 0.65 + ped.lookPhase) * 0.14;
        ped.yaw += angleDiff(swayYaw, ped.yaw) * (1 - Math.exp(-5 * dt));
        ped.visiblePace = smooth(ped.visiblePace ?? 0, 0, 7.5, dt);
        ped.fleeing = false;
        return;
      }

      const target = ped.loop[ped.index];
      const prevIdx = (ped.index + ped.loop.length - 1) % ped.loop.length;
      const prevPt = ped.loop[prevIdx];

      // Detect whether the current leg is crossing a crosswalk
      const crossingCw = (target.cross && prevPt.cross && target.cross === prevPt.cross && target !== prevPt) ? target.cross : null;

      const arrivalDist = crossingCw ? 1.35 : 1.75;
      if (dist2d(ped.x, ped.z, target.x, target.z) < arrivalDist) {
        ped.index = (ped.index + 1) % ped.loop.length;
        ped.crossingState = 'sidewalk';
        ped.activeCrosswalk = null;
        ped.waitingAtCrosswalk = false;
        if (!ped.isCrosswalker && ped.idleChance > 0 && random() < ped.idleChance) {
          ped.idleUntil = state.clock + 2.2 + random() * 3.4;
        }
      }

      if (!threat && !escaping && state.clock < (ped.idleUntil ?? 0)) {
        const lookYaw = ped.yaw + Math.sin(state.clock * 0.8 + ped.lookPhase) * 0.012;
        ped.yaw = lookYaw;
        ped.visiblePace = smooth(ped.visiblePace ?? 0, 0, 6.8, dt);
        ped.fleeing = false;
        return;
      }

      const activeTarget = ped.loop[ped.index];
      const activePrev = ped.loop[(ped.index + ped.loop.length - 1) % ped.loop.length];
      const legCw = (activeTarget.cross && activePrev.cross && activeTarget.cross === activePrev.cross && activeTarget !== activePrev) ? activeTarget.cross : null;

      let waitAtCurb = false;
      let pace = ped.walk;

      if (!threat && !escaping && legCw) {
        const onRoadNow = Boolean(Y?.onAnyRoad?.(ped.x, ped.z, -0.35));
        if (!onRoadNow && ped.crossingState !== 'crossing') {
          // At or approaching the departure curb: check traffic signal & cars before stepping off!
          const distFromCurb = dist2d(ped.x, ped.z, activePrev.x, activePrev.z);
          if (distFromCurb < 2.2) {
            if (legCw.signal) {
              const pSig = getPedSignalState(legCw.signal, legCw.signalPhase, state.clock);
              if (pSig !== 'walk' || hasApproachingCarForCrosswalk(legCw)) {
                waitAtCurb = true;
              } else {
                ped.crossingState = 'crossing';
                ped.activeCrosswalk = legCw;
              }
            } else {
              if (hasApproachingCarForCrosswalk(legCw)) {
                waitAtCurb = true;
              } else {
                ped.crossingState = 'crossing';
                ped.activeCrosswalk = legCw;
              }
            }
          }
        } else if (ped.crossingState === 'crossing' || onRoadNow) {
          ped.crossingState = 'crossing';
          ped.activeCrosswalk = legCw;
          if (legCw.signal) {
            const pSig = getPedSignalState(legCw.signal, legCw.signalPhase, state.clock);
            pace = pSig === 'walk' ? ped.walk * 1.15 : ped.walk * 1.48;
          } else {
            pace = ped.walk * 1.18;
          }
        }
      } else if (!legCw && crossingCw == null) {
        ped.crossingState = 'sidewalk';
        ped.activeCrosswalk = null;
      }

      if (waitAtCurb) {
        const faceAngle = heading2d(ped.x, ped.z, activeTarget.x, activeTarget.z) + Math.sin(state.clock * 0.9 + ped.lookPhase) * 0.16;
        ped.yaw += angleDiff(faceAngle, ped.yaw) * (1 - Math.exp(-7 * dt));
        ped.visiblePace = smooth(ped.visiblePace ?? 0, 0, 7.2, dt);
        ped.waitingAtCrosswalk = true;
        ped.fleeing = false;
        ped.blockedFor = 0;
        return;
      }

      ped.waitingAtCrosswalk = false;
      let goalAngle = threat ? heading2d(state.vehicle.x, state.vehicle.z, ped.x, ped.z)
        : escaping ? ped.escapeYaw
        : heading2d(ped.x, ped.z, activeTarget.x, activeTarget.z);

      // Soft personal-space steering so pedestrians naturally sidestep instead of overlapping
      if (!threat && !escaping) {
        let sepX = 0;
        let sepZ = 0;
        const checkNeighbor = other => {
          if (other === ped || other.streetReaction) return;
          const rx = ped.x - other.x;
          const rz = ped.z - other.z;
          if (Math.abs(rx) > 1.05 || Math.abs(rz) > 1.05) return;
          const d2 = rx * rx + rz * rz;
          if (d2 > 0.001 && d2 < 0.96) {
            const d = Math.sqrt(d2);
            const push = (0.98 - d) / d;
            sepX += rx * push;
            sepZ += rz * push;
          }
        };
        if (queryPeds) queryPeds(ped.x, ped.z, 1.15, checkNeighbor);
        else for (let i = 0; i < pedestrians.length; i++) checkNeighbor(pedestrians[i]);
        if (sepX !== 0 || sepZ !== 0) {
          const dirX = Math.sin(goalAngle) + sepX * 0.55;
          const dirZ = Math.cos(goalAngle) + sepZ * 0.55;
          goalAngle = Math.atan2(dirX, dirZ);
        }
      }

      const turnDelta = angleDiff(goalAngle, ped.yaw);
      const yawRate = threat || escaping ? 11.5 : 6.6;
      ped.yaw += turnDelta * (1 - Math.exp(-yawRate * dt));
      const turnSlow = threat || escaping ? 1 : clamp(1 - Math.abs(turnDelta) * 0.32, 0.58, 1);
      const targetPace = (threat || escaping ? 4.9 : pace) * turnSlow;
      const curPace = smooth(ped.visiblePace ?? targetPace, targetPace, threat || escaping ? 10 : 6.5, dt);
      const nx = ped.x + Math.sin(ped.yaw) * curPace * dt;
      const nz = ped.z + Math.cos(ped.yaw) * curPace * dt;
      if (clearForPerson(nx, nz)) {
        ped.x = nx;
        ped.z = nz;
        ped.blockedFor = 0;
        ped.visiblePace = curPace;
      } else {
        ped.visiblePace = smooth(ped.visiblePace ?? 0, 0, 8.5, dt);
        ped.blockedFor = (ped.blockedFor ?? 0) + dt;
        if (ped.blockedFor > 0.85) {
          if (ped.crossingState === 'crossing') {
            // Step slightly sideways around a stopped car on the crosswalk
            const sideX = ped.x + Math.cos(ped.yaw) * 0.45;
            const sideZ = ped.z - Math.sin(ped.yaw) * 0.45;
            if (clearForPerson(sideX, sideZ)) { ped.x = sideX; ped.z = sideZ; }
            ped.blockedFor = 0.2;
          } else {
            ped.index = (ped.index + 1) % ped.loop.length;
            ped.blockedFor = ped.escapeUntil = 0;
          }
        }
      }
      ped.fleeing = Boolean(threat || escaping);
    }

    function drawMapOverlay(ctx, view, scale, pr, isLarge) {
      if (!ctx) return;
      // Subtle live traffic vehicles & signal phase indicators on the minimap (and zoomed atlas)
      if (!isLarge || scale > 1.45) {
        const carSize = isLarge ? 3.2 * pr : 3.2;
        ctx.save();
        for (let i = 0; i < cars.length; i++) {
          const c = cars[i];
          if (c.type !== 'traffic') continue;
          const [cx, cy] = view(c);
          if (cx < -12 || cy < -12 || cx > ctx.canvas.width + 12 || cy > ctx.canvas.height + 12) continue;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(-c.yaw);
          const isBus = c.model.kind === 'bus';
          const len = isBus ? carSize * 1.9 : carSize * 1.25;
          const wid = isBus ? carSize * 0.82 : carSize * 0.68;
          ctx.fillStyle = isBus ? '#4ecdc4' : c.model.kind === 'taxi' ? '#f2c53d' : '#d5e1e6cc';
          ctx.strokeStyle = '#182429cc';
          ctx.lineWidth = Math.max(0.8, 0.85 * pr);
          ctx.fillRect(-wid, -len, wid * 2, len * 2);
          ctx.strokeRect(-wid, -len, wid * 2, len * 2);
          ctx.restore();
        }
        // Live traffic signal dots at signalized junctions
        const dotR = isLarge ? 2.8 * pr : 3.1;
        for (let i = 0; i < signals.length; i++) {
          const sig = signals[i];
          const [sx, sy] = view(sig);
          if (sx < -8 || sy < -8 || sx > ctx.canvas.width + 8 || sy > ctx.canvas.height + 8) continue;
          const v0 = getVehicleSignalState(sig, 0, state.clock);
          ctx.beginPath();
          ctx.arc(sx, sy, dotR, 0, PI * 2);
          ctx.fillStyle = v0 === 'green' ? '#24f08c' : v0 === 'yellow' ? '#ffc424' : '#ff4032';
          ctx.strokeStyle = '#111c20';
          ctx.lineWidth = Math.max(1, 1.1 * pr);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    function getStats() {
      let trafficVehicles = 0;
      let buses = 0;
      let stoppedVehicles = 0;
      for (const c of cars) {
        if (c.type === 'traffic') {
          trafficVehicles++;
          if (c.model.kind === 'bus') buses++;
          if (c.speed < 0.5) stoppedVehicles++;
        }
      }
      let crossingPeds = 0;
      let waitingPeds = 0;
      for (const ped of pedestrians) {
        if (ped.crossingState === 'crossing') crossingPeds++;
        if (ped.waitingAtCrosswalk) waitingPeds++;
      }
      return {
        signals: signals.length,
        crosswalks: crosswalks.length,
        lenses: lensList.length,
        trafficVehicles,
        buses,
        stoppedVehicles,
        pedestrians: pedestrians.length,
        crossingPeds,
        waitingPeds,
      };
    }

    return {
      layout,
      signals,
      crosswalks,
      updateSignals,
      spawnParkedVehicles,
      spawnTrafficVehicles,
      spawnPedestrians,
      stepVehicle,
      stepPedestrian,
      drawMapOverlay,
      getStats,
      getVehicleSignalState,
      getPedSignalState,
    };
  }

  Object.assign(D, {
    buildTrafficLayout,
    emitTrafficWorldProps,
    createTrafficSystem,
  });
})();
