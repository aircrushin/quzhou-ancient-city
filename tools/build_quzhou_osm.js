'use strict';

const fs = require('fs');
const path = require('path');

const TOOLS_DIR = __dirname;
const ROOT_DIR = path.resolve(__dirname, '..');

// Isotropic WGS-84 projection anchored on Quzhou Old City
const ORIGIN = { lat: 28.96285, lng: 118.86680 };
const SCALE = 0.296;
const M_PER_LAT = 110830.0;
const M_PER_LNG = 111320.0 * Math.cos(ORIGIN.lat * Math.PI / 180);

// Mainland playable bounds (keeping clear of east waterfront promenade x>=298 and south boardwalk z>=304)
const CLIP = { minX: -292, maxX: 286, minZ: -310, maxZ: 294 };

function project(lat, lng) {
  return {
    x: (lng - ORIGIN.lng) * M_PER_LNG * SCALE,
    z: (ORIGIN.lat - lat) * M_PER_LAT * SCALE,
  };
}

// Curated OSM way filter for Quzhou Old City:
// - Removes duplicate one-way dual-carriageway parallel copies so each arterial renders as one clean two-way road
// - Removes external cross-river bridges/tunnels outside the old city play area
const DROP_WAYS = new Set([
  // Dual-carriageway duplicate copies
  528505343, // 西安路 duplicate
  528505349, // 府东街 duplicate
  528505353, // 府东街 north duplicate
  528505335, // 斗潭路 duplicate
  528505333, // 斗潭路 duplicate
  528505332, // 斗潭路 duplicate
  528505336, // 下街 duplicate
  528505337, // 下街 duplicate
  862890562, // 衢江中路 north duplicate
  862890564, // 水亭门隧道 duplicate
  862890565, // 衢江中路 south duplicate
  205923141, // 荷花中路 duplicate
  311853117, // 新元路 duplicate
  1411877913, // 衢江大桥 approach duplicate
  351463090, // 衢化路 duplicate (1473272730 kept)
  205944061, // 衢江大桥 westbound duplicate (we keep inland portion of 205948471)

  // External river bridges, off-map tunnels & far-edge stubs
  205948468, 1004638330, // 九华大道隧道
  1004638332, 1004638333, 1484474942, 311763075, 846292585, 1411118318, // NW across river
  306688819, 410081184, // 西安门大桥 across river
  659944380, 718033186, 1484476253, 1484476254, // 礼贤桥 pedestrian bridge across river
  718033187, 718033188, 659859599, // river bridge approach ramps
  205900400, // 衢江南路 far SW
  1473200282, // 衢江北路 far N
  298959859, // 新安路 far N
  311769159, // 太真路 far N
  311771503, // 紫荆东路 far NE
  717036851, // far NE unnamed stub
  205923126, // 荷花中路 south stub
  311853114, // 新元路 south stub
  683496007, // 清莲里 south stub
  862886703, // 四喜路 SW outside ring
  659944368, // tiny SW dead-end stub
  996021116, // tiny SE residential stub
  206099971, // short floating residential stub north of 新河沿
  659884051, // short dead-end into Fushan park
  206100025, // short stub east of 府东街
  306687228, // 东门街 off-ring east stub (keep clean ring silhouette)
  1417997250, 1417997251, // dual carriageway tiny U-turn links
]);

// Historic/named lanes & critical links tagged as path/service/footway in OSM
const EXTRA_KEEP = new Set([
  250932179,  // 钟楼底
  846292582,  // 钟楼南北通巷 (忠烈庙前 -> 钟楼 -> 北门街/新河沿)
  846292583,  // 钟楼底东延 (钟楼 -> 迎和中路)
  846292584,  // 樟树底 -> 迎和中路 -> 讲舍街连廊
  311769533,  // 县西街北段
  311769534,  // 湖畔路 (斗潭湖畔)
  311852611,  // 化龙巷
  311852617,  // 南湖东路
  311852875,  // 瑞仙巷
  311852876,  // 陆家巷
  311770948,  // 坊门街中段 (道前街-中河沿-小西门街)
  311772603,  // 坊门街北段
  205948471,  // 衢江大桥东接引段 (clipped east of 衢江中路 to connect SW ring seamlessly)
  119080906,  // 通荷路 (clipped north of 劳动路 to connect 南湖二桥 -> 劳动路)
  311853115,  // 南湖南岸路 (connects 礼贤街 -> 南湖二桥 along south bank of 南湖)
  206100024,  // 南湖东南岸路 (connects 南湖桥 -> 体育场路 along south bank of 南湖)
  311852877,  // 体育场南巷 (connects 南湖东南岸路 -> 劳动路)
  311757630,  // 信安湖东引路 (connects 府东街×蝴蝶路 -> 东岸绿道/起点)
]);

const KEEP_HW = new Set([
  'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'pedestrian',
]);

const TIER_SPEC = {
  arterial: { width: 16.0, rank: 4 },
  main:     { width: 12.8, rank: 3 },
  street:   { width: 9.6,  rank: 2 },
  alley:    { width: 7.4,  rank: 1 },
};

const ARTERIAL_NAMES = new Set([
  '西安路', '府东街', '衢化路', '劳动路', '衢江中路', '水亭门隧道', '衢江大桥', '浮石路',
]);

const WAY_NAME_OVERRIDES = {
  846292582: '钟楼北巷',
  846292583: '钟楼底',
  846292584: '迎和西巷',
  659884044: '水亭门沿江路',
  848256502: '水亭南巷',
  1164777183: '天宁北巷',
  311772601: '坊门东巷',
  206099949: '道贯西巷',
  311694453: '雅仕南路',
  205948471: '衢江大桥引路',
  1411877912: '劳动西路',
  311853115: '南湖南岸路',
  206100024: '南湖东南路',
  311852877: '荷花西巷',
  311757630: '信安湖引路',
};

function classifyWay(way) {
  const hw = way.tags.highway;
  const name = WAY_NAME_OVERRIDES[way.id] || way.tags.name || '古城巷';
  let kind;
  if (hw === 'primary' || ARTERIAL_NAMES.has(way.tags.name)) {
    kind = 'arterial';
  } else if (hw === 'secondary' || hw === 'tertiary') {
    kind = 'main';
  } else if (hw === 'residential' || hw === 'unclassified' || way.id === 311757630 || way.id === 311853115 || way.id === 206100024) {
    kind = 'street';
  } else {
    kind = 'alley';
  }
  return { kind, name, width: TIER_SPEC[kind].width, rank: TIER_SPEC[kind].rank };
}

function dist2(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return dx * dx + dz * dz;
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clipSegmentToBox(a, b, box) {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dz = b.z - a.z;
  const checks = [
    [-dx, a.x - box.minX],
    [dx,  box.maxX - a.x],
    [-dz, a.z - box.minZ],
    [dz,  box.maxZ - a.z],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  if (t1 - t0 < 1e-6) return null;
  return [
    { x: a.x + dx * t0, z: a.z + dz * t0 },
    { x: a.x + dx * t1, z: a.z + dz * t1 },
  ];
}

function clipPolylineToBox(pts, box) {
  const chains = [];
  let cur = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = clipSegmentToBox(pts[i], pts[i + 1], box);
    if (!seg) {
      if (cur.length >= 2) chains.push(cur);
      cur = [];
      continue;
    }
    if (cur.length === 0) {
      cur.push(seg[0], seg[1]);
    } else if (dist(cur[cur.length - 1], seg[0]) < 0.05) {
      cur.push(seg[1]);
    } else {
      if (cur.length >= 2) chains.push(cur);
      cur = [seg[0], seg[1]];
    }
  }
  if (cur.length >= 2) chains.push(cur);
  return chains;
}

function projectPointToSeg(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-9) return { x: a.x, z: a.z, t: 0, dist: dist(p, a) };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  const x = a.x + dx * t, z = a.z + dz * t;
  return { x, z, t, dist: Math.hypot(p.x - x, p.z - z) };
}

function segIntersection(a, b, c, d) {
  const rX = b.x - a.x, rZ = b.z - a.z;
  const sX = d.x - c.x, sZ = d.z - c.z;
  const denom = rX * sZ - rZ * sX;
  if (Math.abs(denom) < 1e-9) return null;
  const qpX = c.x - a.x, qpZ = c.z - a.z;
  const t = (qpX * sZ - qpZ * sX) / denom;
  const u = (qpX * rZ - qpZ * rX) / denom;
  if (t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98) {
    return { x: a.x + t * rX, z: a.z + t * rZ, t, u };
  }
  return null;
}

function simplifyDP(pts, eps) {
  if (pts.length <= 2) return pts;
  let maxD = 0, idx = 0;
  const a = pts[0], b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = projectPointToSeg(pts[i], a, b).dist;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    const left = simplifyDP(pts.slice(0, idx + 1), eps);
    const right = simplifyDP(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [a, b];
}

function loadPolygon(filePath, wayId) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const nMap = new Map();
  for (const e of raw.elements) if (e.type === 'node') nMap.set(e.id, e);
  const way = wayId
    ? raw.elements.find(e => e.type === 'way' && e.id === wayId)
    : raw.elements.find(e => e.type === 'way');
  if (!way) return [];
  const pts = way.nodes.map(id => nMap.get(id)).filter(Boolean).map(n => project(n.lat, n.lon));
  return pts;
}

function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a * 0.5;
}

function pointInPoly(px, pz, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, zi = pts[i].z, xj = pts[j].x, zj = pts[j].z;
    if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi + 1e-12) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function distToPolyEdges(px, pz, pts) {
  let best = Infinity;
  const p = { x: px, z: pz };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const d = projectPointToSeg(p, a, b).dist;
    if (d < best) best = d;
  }
  return best;
}

function buildGraph() {
  const raw = JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, 'osm_quzhou_raw.json'), 'utf8'));
  const osmNodes = new Map();
  for (const e of raw.elements) if (e.type === 'node') osmNodes.set(e.id, e);

  // 1. Collect & clip raw polylines
  const rawSegs = [];
  for (const e of raw.elements) {
    if (e.type !== 'way' || !e.tags?.highway) continue;
    if (DROP_WAYS.has(e.id)) continue;
    if (!KEEP_HW.has(e.tags.highway) && !EXTRA_KEEP.has(e.id)) continue;

    const meta = classifyWay(e);
    let pts = e.nodes.map(id => osmNodes.get(id)).filter(Boolean).map(n => project(n.lat, n.lon));
    if (pts.length < 2) continue;

    // Special precise clips for perimeter connector ways
    let box = CLIP;
    if (e.id === 119080906) {
      // 通荷路: keep only between 南湖二桥 (z=220) and 劳动路 (z=268)
      box = { minX: -95, maxX: -60, minZ: 215, maxZ: 270 };
    } else if (e.id === 205948471) {
      // 衢江大桥东引路: keep only east of 衢江中路 (x >= -252)
      box = { minX: -252, maxX: -195, minZ: 258, maxZ: 286 };
    } else if (e.id === 528505355) {
      // 府东街北段: stop at 雅仕路 (z >= -222)
      box = { minX: 225, maxX: 262, minZ: -222, maxZ: -168 };
    } else if (e.id === 311771504) {
      // 浮石路: stop at 雅仕路 (z >= -274)
      box = { minX: 110, maxX: 145, minZ: -274, maxZ: -224 };
    } else if (e.id === 534023458) {
      // 衢江中路南段: stop at 衢江大桥引路 junction (z <= 274)
      box = { minX: -260, maxX: -200, minZ: 110, maxZ: 274 };
    } else if (e.id === 206099940) {
      // 新马路: clip cleanly at 府东街 (x <= 238)
      box = { minX: 130, maxX: 238, minZ: -80, maxZ: 10 };
    } else if (e.id === 311757630) {
      // 信安湖引路: connect 府东街×蝴蝶路 east to waterfront promenade approach (x <= 293)
      box = { minX: 254, maxX: 293, minZ: 162, maxZ: 182 };
    }

    const chains = clipPolylineToBox(pts, box);
    for (const chain of chains) {
      for (let i = 0; i < chain.length - 1; i++) {
        if (dist(chain[i], chain[i + 1]) < 0.2) continue;
        rawSegs.push({
          a: { ...chain[i] },
          b: { ...chain[i + 1] },
          wayId: e.id,
          ...meta,
        });
      }
    }
  }

  // Helper to weld nearby points into unified node list
  function buildNodesAndEdges(segs, snapRadius) {
    const nodes = [];
    function getNode(p) {
      let best = -1, bestD = snapRadius;
      for (let i = 0; i < nodes.length; i++) {
        const d = dist(p, nodes[i]);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) {
        // Weighted running average for tight clusters
        const n = nodes[best];
        n.x = (n.x * n.w + p.x) / (n.w + 1);
        n.z = (n.z * n.w + p.z) / (n.w + 1);
        n.w++;
        return best;
      }
      nodes.push({ x: p.x, z: p.z, w: 1 });
      return nodes.length - 1;
    }
    const edgeMap = new Map();
    for (const s of segs) {
      const u = getNode(s.a);
      const v = getNode(s.b);
      if (u === v) continue;
      const key = u < v ? `${u}:${v}` : `${v}:${u}`;
      const existing = edgeMap.get(key);
      if (!existing || s.rank > existing.rank) {
        edgeMap.set(key, { u: Math.min(u, v), v: Math.max(u, v), name: s.name, kind: s.kind, width: s.width, rank: s.rank, wayId: s.wayId });
      }
    }
    return { nodes, edges: [...edgeMap.values()] };
  }

  // 2. First pass: split segments at true crossings and T-junction near-misses
  // Snap endpoints (degree 1 or dual-carriageway offsets) to nearest non-incident segment within 7.5u
  let g = buildNodesAndEdges(rawSegs, 3.2);

  // Iteratively snap degree-1 endpoints & split edges at crossings
  for (let pass = 0; pass < 3; pass++) {
    const deg = new Array(g.nodes.length).fill(0);
    for (const e of g.edges) { deg[e.u]++; deg[e.v]++; }

    const splits = new Map(); // edgeIdx -> list of {t, x, z}
    const addSplit = (ei, t, x, z) => {
      if (!splits.has(ei)) splits.set(ei, []);
      splits.get(ei).push({ t, x, z });
    };

    // Snap near-miss degree-1 endpoints to any nearby edge
    const moved = new Map();
    for (let ni = 0; ni < g.nodes.length; ni++) {
      if (deg[ni] !== 1) continue;
      const p = g.nodes[ni];
      let best = null;
      for (let ei = 0; ei < g.edges.length; ei++) {
        const e = g.edges[ei];
        if (e.u === ni || e.v === ni) continue;
        const proj = projectPointToSeg(p, g.nodes[e.u], g.nodes[e.v]);
        if (proj.dist < 8.5 && (!best || proj.dist < best.dist)) {
          best = { ei, ...proj };
        }
      }
      if (best) {
        moved.set(ni, { x: best.x, z: best.z });
        if (best.t > 0.03 && best.t < 0.97) {
          addSplit(best.ei, best.t, best.x, best.z);
        }
      }
    }
    for (const [ni, pos] of moved) {
      g.nodes[ni].x = pos.x;
      g.nodes[ni].z = pos.z;
    }

    // Also snap ANY node sitting within 4.2u of an interior point of a non-incident edge
    for (let ni = 0; ni < g.nodes.length; ni++) {
      const p = g.nodes[ni];
      for (let ei = 0; ei < g.edges.length; ei++) {
        const e = g.edges[ei];
        if (e.u === ni || e.v === ni) continue;
        const proj = projectPointToSeg(p, g.nodes[e.u], g.nodes[e.v]);
        if (proj.dist < 4.2 && proj.t > 0.04 && proj.t < 0.96) {
          addSplit(ei, proj.t, p.x, p.z);
        }
      }
    }

    // Split any genuine edge-edge crossings (planarization)
    for (let i = 0; i < g.edges.length; i++) {
      const e1 = g.edges[i];
      for (let j = i + 1; j < g.edges.length; j++) {
        const e2 = g.edges[j];
        if (e1.u === e2.u || e1.u === e2.v || e1.v === e2.u || e1.v === e2.v) continue;
        const hit = segIntersection(g.nodes[e1.u], g.nodes[e1.v], g.nodes[e2.u], g.nodes[e2.v]);
        if (hit) {
          addSplit(i, hit.t, hit.x, hit.z);
          addSplit(j, hit.u, hit.x, hit.z);
        }
      }
    }

    // Rebuild segments from splits
    const nextSegs = [];
    for (let ei = 0; ei < g.edges.length; ei++) {
      const e = g.edges[ei];
      const a = g.nodes[e.u], b = g.nodes[e.v];
      const sp = (splits.get(ei) || []).sort((p, q) => p.t - q.t);
      const pts = [a, ...sp.map(s => ({ x: s.x, z: s.z })), b];
      for (let k = 0; k < pts.length - 1; k++) {
        if (dist(pts[k], pts[k + 1]) < 0.3) continue;
        nextSegs.push({ a: pts[k], b: pts[k + 1], name: e.name, kind: e.kind, width: e.width, rank: e.rank, wayId: e.wayId });
      }
    }
    g = buildNodesAndEdges(nextSegs, 4.2);
  }

  // 3. Simplify degree-2 polyline chains with Douglas-Peucker (preserves curves while cleaning micro-segments)
  function simplifyGraph(graph, eps) {
    const adj = Array.from({ length: graph.nodes.length }, () => []);
    graph.edges.forEach((e, ei) => {
      adj[e.u].push({ to: e.v, ei });
      adj[e.v].push({ to: e.u, ei });
    });
    const visitedEdge = new Uint8Array(graph.edges.length);
    const outSegs = [];

    const isJunction = (u) => {
      if (adj[u].length !== 2) return true;
      const e0 = graph.edges[adj[u][0].ei];
      const e1 = graph.edges[adj[u][1].ei];
      return e0.kind !== e1.kind || e0.name !== e1.name;
    };

    function emitChain(nodeChain, meta) {
      const pts = nodeChain.map(id => graph.nodes[id]);
      const simp = simplifyDP(pts, eps);
      for (let i = 0; i < simp.length - 1; i++) {
        outSegs.push({ a: simp[i], b: simp[i + 1], ...meta });
      }
    }

    for (let u = 0; u < graph.nodes.length; u++) {
      if (!isJunction(u)) continue;
      for (const step of adj[u]) {
        if (visitedEdge[step.ei]) continue;
        const meta = graph.edges[step.ei];
        const chain = [u];
        let cur = u, edgeIdx = step.ei, nxt = step.to;
        while (true) {
          visitedEdge[edgeIdx] = 1;
          chain.push(nxt);
          if (isJunction(nxt)) break;
          const nextStep = adj[nxt].find(s => s.ei !== edgeIdx);
          if (!nextStep || visitedEdge[nextStep.ei]) break;
          cur = nxt;
          edgeIdx = nextStep.ei;
          nxt = nextStep.to;
        }
        emitChain(chain, { name: meta.name, kind: meta.kind, width: meta.width, rank: meta.rank, wayId: meta.wayId });
      }
    }
    // Any pure cycles (rare)
    for (let ei = 0; ei < graph.edges.length; ei++) {
      if (visitedEdge[ei]) continue;
      const e = graph.edges[ei];
      outSegs.push({ a: graph.nodes[e.u], b: graph.nodes[e.v], name: e.name, kind: e.kind, width: e.width, rank: e.rank, wayId: e.wayId });
    }
    return buildNodesAndEdges(outSegs, 3.8);
  }

  g = simplifyGraph(g, 1.5);

  // 4. Keep largest connected component
  function largestComponent(graph) {
    const adj = Array.from({ length: graph.nodes.length }, () => []);
    for (const e of graph.edges) { adj[e.u].push(e.v); adj[e.v].push(e.u); }
    const comp = new Int32Array(graph.nodes.length).fill(-1);
    let cid = 0, bestCid = 0, bestCount = 0;
    for (let i = 0; i < graph.nodes.length; i++) {
      if (comp[i] !== -1) continue;
      const q = [i];
      comp[i] = cid;
      let head = 0;
      while (head < q.length) {
        const u = q[head++];
        for (const v of adj[u]) {
          if (comp[v] === -1) { comp[v] = cid; q.push(v); }
        }
      }
      if (q.length > bestCount) { bestCount = q.length; bestCid = cid; }
      cid++;
    }
    const keptEdges = graph.edges.filter(e => comp[e.u] === bestCid);
    const segs = keptEdges.map(e => ({ a: graph.nodes[e.u], b: graph.nodes[e.v], name: e.name, kind: e.kind, width: e.width, rank: e.rank, wayId: e.wayId }));
    return buildNodesAndEdges(segs, 1.0);
  }

  g = largestComponent(g);

  // 5. Prune short dead-end dangling spurs (optional: keep east-side named spurs like 东门街/新马路)
  const KEEP_SPUR_NAMES = new Set(['信安湖引路']);
  let pruned = true;
  while (pruned) {
    pruned = false;
    const adj = Array.from({ length: g.nodes.length }, () => []);
    g.edges.forEach((e, ei) => { adj[e.u].push(ei); adj[e.v].push(ei); });
    const drop = new Set();
    for (let u = 0; u < g.nodes.length; u++) {
      if (adj[u].length !== 1) continue;
      const ei = adj[u][0];
      const e = g.edges[ei];
      const len = dist(g.nodes[e.u], g.nodes[e.v]);
      if (!KEEP_SPUR_NAMES.has(e.name) && len < 42) {
        drop.add(ei);
        pruned = true;
      }
    }
    if (pruned) {
      const segs = g.edges.filter((_, ei) => !drop.has(ei)).map(e => ({
        a: g.nodes[e.u], b: g.nodes[e.v], name: e.name, kind: e.kind, width: e.width, rank: e.rank, wayId: e.wayId,
      }));
      g = largestComponent(buildNodesAndEdges(segs, 1.0));
    }
  }

  // 6. Extract minimal bounded planar faces (real Quzhou city blocks!)
  // Build 2-core (strip dangling dead-end trees) for clean planar face extraction
  function extractFaces(graph) {
    // Iteratively remove degree-1 edges for face-finding only
    const activeEdge = new Uint8Array(graph.edges.length).fill(1);
    let changed = true;
    while (changed) {
      changed = false;
      const deg = new Int32Array(graph.nodes.length);
      for (let ei = 0; ei < graph.edges.length; ei++) {
        if (!activeEdge[ei]) continue;
        deg[graph.edges[ei].u]++;
        deg[graph.edges[ei].v]++;
      }
      for (let ei = 0; ei < graph.edges.length; ei++) {
        if (!activeEdge[ei]) continue;
        if (deg[graph.edges[ei].u] <= 1 || deg[graph.edges[ei].v] <= 1) {
          activeEdge[ei] = 0;
          changed = true;
        }
      }
    }

    // Build half-edges sorted by outgoing angle at each vertex
    const halfEdges = [];
    const outByNode = Array.from({ length: graph.nodes.length }, () => []);
    for (let ei = 0; ei < graph.edges.length; ei++) {
      if (!activeEdge[ei]) continue;
      const e = graph.edges[ei];
      const a = graph.nodes[e.u], b = graph.nodes[e.v];
      const id0 = halfEdges.length;
      const id1 = id0 + 1;
      halfEdges.push({ id: id0, u: e.u, v: e.v, twin: id1, angle: Math.atan2(b.z - a.z, b.x - a.x) });
      halfEdges.push({ id: id1, u: e.v, v: e.u, twin: id0, angle: Math.atan2(a.z - b.z, a.x - b.x) });
      outByNode[e.u].push(id0);
      outByNode[e.v].push(id1);
    }
    for (const list of outByNode) {
      list.sort((a, b) => halfEdges[a].angle - halfEdges[b].angle);
    }

    const visited = new Uint8Array(halfEdges.length);
    const faces = [];
    for (let h = 0; h < halfEdges.length; h++) {
      if (visited[h]) continue;
      const cycle = [];
      let cur = h;
      let guard = 0;
      while (!visited[cur] && guard++ < 500) {
        visited[cur] = 1;
        const he = halfEdges[cur];
        cycle.push(he.u);
        const list = outByNode[he.v];
        const idx = list.indexOf(he.twin);
        // Next half-edge turning left (CCW in standard Y-up; in X-right Z-down, prev index traces CW interior)
        const nextIdx = (idx - 1 + list.length) % list.length;
        cur = list[nextIdx];
      }
      if (cycle.length < 3) continue;
      const pts = cycle.map(id => graph.nodes[id]);
      const area = polygonArea(pts);
      // Signed area > 0 in (x right, z down) means CW bounded face; outer infinite face has negative area
      if (area > 40) {
        const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minZ = Math.min(...zs), maxZ = Math.max(...zs);
        // Compute pole of inaccessibility via grid sampling
        let bestX = (minX + maxX) * 0.5, bestZ = (minZ + maxZ) * 0.5, bestR = 0;
        const steps = 14;
        for (let ix = 1; ix < steps; ix++) {
          for (let iz = 1; iz < steps; iz++) {
            const px = minX + (maxX - minX) * (ix / steps);
            const pz = minZ + (maxZ - minZ) * (iz / steps);
            if (!pointInPoly(px, pz, pts)) continue;
            const r = distToPolyEdges(px, pz, pts);
            if (r > bestR) { bestR = r; bestX = px; bestZ = pz; }
          }
        }
        faces.push({
          nodeIndices: cycle,
          area: Math.round(area),
          cx: +bestX.toFixed(1),
          cz: +bestZ.toFixed(1),
          inscribedR: +bestR.toFixed(1),
          minX: +minX.toFixed(1), maxX: +maxX.toFixed(1),
          minZ: +minZ.toFixed(1), maxZ: +maxZ.toFixed(1),
        });
      }
    }
    return faces;
  }

  const faces = extractFaces(g);
  return { graph: g, faces };
}

function round1(v) { return Math.round(v * 10) / 10; }
function toWgs84(x, z) {
  return {
    lat: +(ORIGIN.lat - (z / SCALE) / M_PER_LAT).toFixed(6),
    lng: +(ORIGIN.lng + (x / SCALE) / M_PER_LNG).toFixed(6),
  };
}

const { graph, faces } = buildGraph();

// Load real OSM water and park polygons
const nanhuPoly = simplifyDP(loadPolygon(path.join(TOOLS_DIR, 'osm_nanhu.json'), 311853266), 1.4).map(p => ({ x: round1(p.x), z: round1(p.z) }));
const doutanPoly = simplifyDP(loadPolygon(path.join(TOOLS_DIR, 'osm_doutan_pond.json'), 862890567), 1.5).map(p => ({ x: round1(p.x), z: round1(p.z) }));
const fushanPoly = simplifyDP(loadPolygon(path.join(TOOLS_DIR, 'osm_quzhou_raw.json'), 311853267), 1.5).map(p => ({ x: round1(p.x), z: round1(p.z) }));
// Ensure closed rings don't duplicate last==first
function cleanRing(pts) {
  if (pts.length > 2 && dist(pts[0], pts[pts.length - 1]) < 0.5) pts = pts.slice(0, -1);
  return pts;
}
const WATER_POLYGONS = [
  { id: 'nanhu', name: '南湖', pts: cleanRing(nanhuPoly) },
  { id: 'doutan', name: '斗潭河', pts: cleanRing(doutanPoly) },
];
const PARK_POLYGONS = [
  { id: 'fushan', name: '府山公园', pts: cleanRing(fushanPoly) },
];

function inAnyWater(x, z, margin = 0) {
  for (const w of WATER_POLYGONS) {
    if (pointInPoly(x, z, w.pts)) return true;
    if (margin > 0 && distToPolyEdges(x, z, w.pts) < margin) return true;
  }
  return false;
}

function onAnyRoad(x, z, margin = 0) {
  const p = { x, z };
  for (const e of graph.edges) {
    const d = projectPointToSeg(p, graph.nodes[e.u], graph.nodes[e.v]).dist;
    if (d <= e.width * 0.5 + margin) return true;
  }
  return false;
}

function roadClearance(x, z) {
  const p = { x, z };
  let best = Infinity;
  for (const e of graph.edges) {
    const d = projectPointToSeg(p, graph.nodes[e.u], graph.nodes[e.v]).dist - e.width * 0.5;
    if (d < best) best = d;
  }
  return best;
}

function boxRoadClearance(cx, cz, w, d) {
  let best = Infinity;
  for (const sx of [-0.5, 0, 0.5]) {
    for (const sz of [-0.5, 0, 0.5]) {
      const px = cx + sx * w, pz = cz + sz * d;
      best = Math.min(best, roadClearance(px, pz));
      if (inAnyWater(px, pz, 0.5)) return -999;
    }
  }
  return best;
}

// Nearest graph node helper
function nearestNodeIdx(x, z, filterFn = null) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    if (filterFn && !filterFn(i)) continue;
    const d = Math.hypot(graph.nodes[i].x - x, graph.nodes[i].z - z);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function nearestRoadPoint(x, z, allowedKinds = null) {
  const p = { x, z };
  let best = null;
  for (const e of graph.edges) {
    if (allowedKinds && !allowedKinds.has(e.kind)) continue;
    const pr = projectPointToSeg(p, graph.nodes[e.u], graph.nodes[e.v]);
    if (!best || pr.dist < best.dist) best = { ...pr, edge: e };
  }
  return best;
}

// Assign stable node IDs and readable junction names
const nodeAdj = Array.from({ length: graph.nodes.length }, () => []);
graph.edges.forEach((e, ei) => {
  nodeAdj[e.u].push({ to: e.v, edge: e, ei });
  nodeAdj[e.v].push({ to: e.u, edge: e, ei });
});

const NODE_DEFS = graph.nodes.map((n, i) => {
  const x = round1(n.x), z = round1(n.z);
  const ll = toWgs84(x, z);
  const streetNames = [...new Set(nodeAdj[i].map(a => a.edge.name))];
  const label = streetNames.length >= 2
    ? `${streetNames[0]}·${streetNames[1]}口`
    : (streetNames[0] || '衢州古城路口');
  return { id: `q${i}`, x, z, name: label, lat: ll.lat, lng: ll.lng };
});

// Classify the 66 real Quzhou city blocks (FACES)
const HISTORIC_WALL_RING = [
  { x: -145.0, z: -80.6, gate: '水亭门' },
  { x: -135.5, z: -135.0 },
  { x: -121.0, z: -182.0, gate: '西安门' },
  { x: -67.4,  z: -170.5 },
  { x: 12.5,   z: -166.0 },
  { x: 95.1,   z: -172.7, gate: '拱辰门' },
  { x: 175.0,  z: -145.0 },
  { x: 235.8,  z: -107.2 },
  { x: 238.7,  z: -7.0,   gate: '迎和门' },
  { x: 246.0,  z: 80.5 },
  { x: 255.9,  z: 177.4 },
  { x: 190.7,  z: 206.7 },
  { x: 138.0,  z: 192.0 },
  { x: 59.1,   z: 207.7,  gate: '小南门' },
  { x: -18.0,  z: 204.0 },
  { x: -77.8,  z: 190.9,  gate: '礼贤门' },
  { x: -149.6, z: 134.0 },
  { x: -170.8, z: 63.7,   gate: '小西门' },
  { x: -159.1, z: 13.4 },
];

// Pick the exact best landmark sites (100% aligned with real OSM features & verified road/water clear)
function findBestClearSpot(targetX, targetZ, w, d, searchR = 26) {
  let best = null;
  for (let dx = -searchR; dx <= searchR; dx += 2) {
    for (let dz = -searchR; dz <= searchR; dz += 2) {
      const cx = round1(targetX + dx), cz = round1(targetZ + dz);
      const clr = boxRoadClearance(cx, cz, w, d);
      if (clr < 1.2) continue;
      const shift = Math.hypot(dx, dz);
      const score = shift - Math.min(clr, 6) * 0.5;
      if (!best || score < best.score) best = { x: cx, z: cz, clr: +clr.toFixed(2), shift: +shift.toFixed(1), score };
    }
  }
  return best;
}

const lmSites = {
  // Verified road-clear & water-clear historic sites matching real Quzhou Old City OSM geometry
  shuitingmen: { x: -180.0, z: -80.0, clr: +boxRoadClearance(-180.0, -80.0, 26, 40).toFixed(2), shift: 0 },
  tianwang:    { x: -90.0,  z: -104.0, clr: +boxRoadClearance(-90.0, -104.0, 12.6, 16.8).toFixed(2), shift: 0 },
  kongmiao:    { x: 161.4,  z: -22.3, clr: +boxRoadClearance(161.4, -22.3, 26, 26).toFixed(2), shift: 0 },
  fushan:      { x: 184.0,  z: 76.0,  clr: +boxRoadClearance(184.0, 76.0, 68, 68).toFixed(2), shift: 0 },
  belltower:   { x: 33.0,   z: -104.0, clr: +boxRoadClearance(33.0, -104.0, 24, 24).toFixed(2), shift: 0 },
  mazhandi:    { x: 73.3,   z: 123.4, clr: +boxRoadClearance(73.3, 123.4, 28, 26).toFixed(2), shift: 0 },
  dananmen:    { x: -94.0,  z: 140.0, clr: +boxRoadClearance(-94.0, 140.0, 22, 16).toFixed(2), shift: 0 },
};

const navFor = (x, z) => {
  const pr = nearestRoadPoint(x, z, new Set(['arterial', 'main', 'street', 'alley']));
  return { navX: round1(pr.x), navZ: round1(pr.z) };
};

const LANDMARKS = [
  {
    id: 'shuitingmen', name: '水亭门城楼', en: 'Shuitingmen Gate', kind: 'gate',
    x: lmSites.shuitingmen.x, z: lmSites.shuitingmen.z,
    ...navFor(-152.4, -75.4),
    badge: '明代城楼', desc: '衢州古城“大西门”，重檐歇山城楼与明代青砖城墙临衢江而立，三街七巷历史街区起点。',
  },
  {
    id: 'tianwang', name: '天王塔院', en: 'Tianwang Pagoda', kind: 'pagoda7',
    x: lmSites.tianwang.x, z: lmSites.tianwang.z,
    ...navFor(-76.2, -96.0),
    badge: '七层古塔', desc: '始建于梁代的七层六角楼阁式砖塔，耸立于天王巷与县西街之间的水亭门天际线。',
  },
  {
    id: 'kongmiao', name: '孔氏南宗家庙', en: 'Nanzong Confucius Temple', kind: 'temple',
    x: lmSites.kongmiao.x, z: lmSites.kongmiao.z,
    ...navFor(157.6, 1.9),
    badge: '南孔圣地', desc: '全国仅存两座孔氏家庙之一，坐落新桥街与后花园路间，朱红宫墙、棂星门与大成殿古柏森森。',
  },
  {
    id: 'fushan', name: '府山公园 · 钟灵塔', en: 'Fushan Park & Pagoda', kind: 'park',
    x: lmSites.fushan.x, z: lmSites.fushan.z,
    ...navFor(245.5, 78.0),
    badge: '古城绿心', desc: '衢州古城东南山地公园，紧邻府东街与新桥街，古木苍翠、钟灵塔倒映池中。',
  },
  {
    id: 'belltower', name: '衢州钟楼', en: 'Quzhou Bell Tower', kind: 'bell',
    x: lmSites.belltower.x, z: lmSites.belltower.z,
    ...navFor(52.2, -81.4),
    badge: '报时古楼', desc: '坐落钟楼底与北门街古轴交汇处，青砖城台托起双层朱柱铜钟阁，自古晨钟报时。',
  },
  {
    id: 'mazhandi', name: '马站底美食街', en: 'Mazhandi Food Street', kind: 'market',
    x: lmSites.mazhandi.x, z: lmSites.mazhandi.z,
    ...navFor(98.5, 124.0),
    badge: '三头一掌', desc: '位于上街与东武街片区的烟火美食老街，汇聚衢州鸭头、炭炉烤饼与水晶糕。',
  },
  {
    id: 'dananmen', name: '大南门 · 礼贤门', en: 'Dananmen Gate', kind: 'southgate',
    x: lmSites.dananmen.x, z: lmSites.dananmen.z,
    ...navFor(-94.0, 163.0),
    badge: '古城南门', desc: '俯瞰南湖与南湖二桥的礼贤门城楼，连通坊门街、南湖中路与劳动路。',
  },
  {
    id: 'yanjiayu', name: '严家淤岛', en: 'Yanjiayu Island', kind: 'island',
    x: 631, z: 139, navX: 354, navZ: 208,
    badge: '信安湖心', desc: '信安湖江心绿洲，可从东岸游船码头乘艇登岛观湖心灯塔。',
  },
];

// Classify every real city block face
const FACE_DEFS = faces.map((f, idx) => {
  const pts = f.nodeIndices.map(i => graph.nodes[i]);
  let zone = 'oldTown';
  let name = '衢州古城街坊';

  // Check which special landmark falls in this face
  if (pointInPoly(lmSites.fushan.x, lmSites.fushan.z, pts)) {
    zone = 'park'; name = '府山公园 · 钟灵塔';
  } else if (pointInPoly(lmSites.kongmiao.x, lmSites.kongmiao.z, pts)) {
    zone = 'kongmiao'; name = '孔氏南宗家庙';
  } else if (pointInPoly(lmSites.tianwang.x, lmSites.tianwang.z, pts)) {
    zone = 'tianwang'; name = '天王塔院历史片区';
  } else if (pointInPoly(lmSites.belltower.x, lmSites.belltower.z, pts)) {
    zone = 'bellTower'; name = '钟楼底历史片区';
  } else if (pointInPoly(lmSites.mazhandi.x, lmSites.mazhandi.z, pts)) {
    zone = 'mazhandi'; name = '马站底美食街区';
  } else if (pointInPoly(lmSites.dananmen.x, lmSites.dananmen.z, pts)) {
    zone = 'dananmen'; name = '大南门 · 礼贤门片区';
  } else if (pointInPoly(lmSites.shuitingmen.x, lmSites.shuitingmen.z, pts)) {
    zone = 'shuitingmen'; name = '水亭门城楼与滨江古街';
  } else if (f.cx >= -155 && f.cx <= -95 && f.cz >= -85 && f.cz <= 25) {
    zone = 'shuitingAlley'; name = '水亭门三街七巷';
  } else if (!pointInPoly(f.cx, f.cz, HISTORIC_WALL_RING)) {
    zone = 'outerTown';
    if (f.cz < -150) name = '斗潭 · 西安路片区';
    else if (f.cz > 180) name = '南湖 · 劳动路片区';
    else name = '衢州外城街坊';
  } else {
    // Name by bounding street names
    const eNames = new Set();
    for (let k = 0; k < f.nodeIndices.length; k++) {
      const u = f.nodeIndices[k], v = f.nodeIndices[(k + 1) % f.nodeIndices.length];
      const hit = nodeAdj[u].find(a => a.to === v);
      if (hit && hit.edge.name && hit.edge.name !== '古城巷') eNames.add(hit.edge.name);
    }
    const first = [...eNames].slice(0, 2);
    if (first.length) name = first.join('·') + '街坊';
  }
  return {
    nodes: f.nodeIndices.map(i => `q${i}`),
    zone,
    name,
    cx: f.cx,
    cz: f.cz,
    inscribedR: f.inscribedR,
    area: f.area,
  };
});

// Build validated connected TRAFFIC_LOOPS strictly along arterial/main/street edges
function shortestPath(startIdx, endIdx, allowedKinds, bannedEdges = new Set()) {
  const n = graph.nodes.length;
  const d = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const vis = new Uint8Array(n);
  d[startIdx] = 0;
  for (let step = 0; step < n; step++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!vis[i] && d[i] < best) { best = d[i]; u = i; }
    if (u < 0 || u === endIdx) break;
    vis[u] = 1;
    for (const { to, edge, ei } of nodeAdj[u]) {
      if (vis[to] || bannedEdges.has(ei) || !allowedKinds.has(edge.kind)) continue;
      const len = dist(graph.nodes[u], graph.nodes[to]);
      const w = len * (edge.kind === 'arterial' ? 0.85 : edge.kind === 'main' ? 0.96 : 1.12);
      if (best + w < d[to]) { d[to] = best + w; prev[to] = u; }
    }
  }
  if (!isFinite(d[endIdx])) return null;
  const pathNodes = [];
  for (let cur = endIdx; cur !== -1; cur = prev[cur]) pathNodes.push(cur);
  pathNodes.reverse();
  return pathNodes;
}

function buildLoopFromWaypoints(waypoints, allowedKinds) {
  const allowedNode = (i) => nodeAdj[i].some(a => allowedKinds.has(a.edge.kind));
  const anchors = waypoints.map(([x, z]) => nearestNodeIdx(x, z, allowedNode));
  const full = [];
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k], b = anchors[(k + 1) % anchors.length];
    if (a === b) continue;
    const seg = shortestPath(a, b, allowedKinds);
    if (!seg) return null;
    for (let i = 0; i < seg.length - 1; i++) full.push(seg[i]);
  }
  // Validate loop has no backtracks (u -> v -> u) and no zero-length duplicates
  const clean = [];
  for (const id of full) {
    if (clean.length && clean[clean.length - 1] === id) continue;
    clean.push(id);
  }
  if (clean.length < 4) return null;
  // Check every consecutive edge actually exists & no immediate U-turns
  for (let i = 0; i < clean.length; i++) {
    const prev = clean[(i - 1 + clean.length) % clean.length];
    const cur = clean[i];
    const nxt = clean[(i + 1) % clean.length];
    if (prev === nxt) return null;
    if (!nodeAdj[cur].some(a => a.to === nxt)) return null;
  }
  return clean.map(i => `q${i}`);
}

const MAIN_KINDS = new Set(['arterial', 'main']);
const DRIVE_KINDS = new Set(['arterial', 'main', 'street']);

const LOOP_SPECS = [
  // 1. 古城外环主干道大环线 (西安路 -> 府东街 -> 衢化路 -> 劳动路 -> 衢江大桥引路 -> 衢江中路 -> 水亭门隧道)
  { kinds: MAIN_KINDS, pts: [[-58, -304], [115, -227], [235, -171], [246, 80], [248, 288], [64, 249], [-124, 281], [-249, 269], [-202, 85], [-144, -124]] },
  // 2. 西北环线 (西安路 -> 斗潭路 -> 下街 -> 南街 -> 道前街 -> 县西街 -> 新河沿 -> 水亭门隧道 -> 衢江中路)
  { kinds: MAIN_KINDS, pts: [[-58, -304], [14.2, -269.9], [18, -52], [33, 23], [-99, 21], [-71, -150]] },
  // 3. 东北环线 (西安路 -> 府东街 -> 新桥街 -> 下街 -> 斗潭路)
  { kinds: MAIN_KINDS, pts: [[14.2, -269.9], [235, -171], [239, -7], [33, 23], [12, -135]] },
  // 4. 东南府山环线 (新桥街 -> 府东街 -> 蝴蝶路 -> 劳动路 -> 上街)
  { kinds: MAIN_KINDS, pts: [[33, 23], [239, -7], [256, 177], [114, 260], [64, 249], [41, 91]] },
  // 5. 西南大南门环线 (道前街 -> 南街 -> 上街 -> 劳动路 -> 礼贤街 -> 南湖南岸 -> 南湖西路 -> 衢江中路)
  { kinds: MAIN_KINDS, pts: [[-99, 21], [33, 23], [64, 249], [-124, 281], [-249, 269], [-211, 117], [-157, 149]] },
  // 6. 拱辰北门内环 (新河沿 -> 讲舍街 -> 府东街 -> 新桥街 -> 下街 -> 县西街)
  { kinds: MAIN_KINDS, pts: [[-71, -150], [78, -122], [236, -107], [239, -7], [33, 23], [-99, 21]] },
  // 7. 东北雅仕路外环 (西安路 -> 浮石路 -> 雅仕路 -> 府东街)
  { kinds: MAIN_KINDS, pts: [[116, -227], [132, -269], [250, -218], [235, -171]] },
  // 8. 东南衢化蝴蝶三角环 (府东街 -> 衢化路 -> 劳动路 -> 蝴蝶路)
  { kinds: MAIN_KINDS, pts: [[256, 177], [248, 288], [114, 260]] },
  // 9. 南湖西五圣环 (五圣街 -> 南湖西路 -> 南湖中路 -> 上街 -> 南街 -> 道前街)
  { kinds: DRIVE_KINDS, pts: [[-99, 21], [-157, 149], [-78, 191], [59, 208], [33, 23]] },
  // 10. 孔庙马站底环 (新桥街 -> 东武街 -> 狮桥街 -> 上街 -> 下街 -> 樟树底 -> 新马路)
  { kinds: DRIVE_KINDS, pts: [[33, 23], [24, -22], [138, -35], [135, 5]] },
  // 11. 府山体育场环 (新桥街 -> 东武街 -> 体育场路 -> 蝴蝶路 -> 劳动路 -> 上街)
  { kinds: DRIVE_KINDS, pts: [[33, 23], [107, 52], [151, 230], [114, 260], [64, 249], [41, 91]] },
  // 12. 县西斗潭环 (西安路 -> 北门街 -> 新河沿 -> 县西街 -> 五圣街 -> 南湖西路 -> 衢江中路)
  { kinds: MAIN_KINDS, pts: [[-58, -304], [116, -227], [78, -122], [-71, -150], [-157, 149], [-211, 117], [-144, -124]] },
];

const TRAFFIC_LOOPS = [];
for (let idx = 0; idx < LOOP_SPECS.length; idx++) {
  const loop = buildLoopFromWaypoints(LOOP_SPECS[idx].pts, LOOP_SPECS[idx].kinds);
  if (loop) {
    TRAFFIC_LOOPS.push(loop);
  } else {
    console.warn('Skipped traffic loop spec', idx);
  }
}

// Auto-generate verified curbside ROAD_SIGNS for real Quzhou streets
const SIGN_SUBS = {
  '西安路': 'XIAN RD', '府东街': 'FUDONG ST', '衢化路': 'QUHUA RD', '劳动路': 'LAODONG RD',
  '衢江中路': 'QUJIANG MID RD', '水亭门隧道': 'SHUITINGMEN TUNNEL', '斗潭路': 'DOUTAN RD',
  '下街': 'XIAJIE ST', '上街': 'SHANGJIE ST', '新桥街': 'XINQIAO ST', '南街': 'NANJIE ST',
  '道前街': 'DAOQIAN ST', '县西街': 'XIANXI ST', '五圣街': 'WUSHENG ST', '新河沿': 'XINHEYAN RD',
  '讲舍街': 'JIANGSHE ST', '北门街': 'BEIMEN ST', '蝴蝶路': 'HUDIE RD', '南湖西路': 'NANHU WEST RD',
  '水亭街': 'SHUITING ST', '坊门街': 'FANGMEN ST', '东武街': 'DONGWU ST',
};
const ROAD_SIGNS = [];
const usedSignNames = new Set();
const sortedEdges = [...graph.edges].sort((a, b) => {
  const la = dist(graph.nodes[a.u], graph.nodes[a.v]);
  const lb = dist(graph.nodes[b.u], graph.nodes[b.v]);
  return (b.rank * 100 + lb) - (a.rank * 100 + la);
});
for (const e of sortedEdges) {
  if (!SIGN_SUBS[e.name] || usedSignNames.has(e.name)) continue;
  const a = graph.nodes[e.u], b = graph.nodes[e.v];
  const len = dist(a, b);
  if (len < 22) continue;
  const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
  const nx = uz, nz = -ux;
  const mx = (a.x + b.x) * 0.5, mz = (a.z + b.z) * 0.5;
  for (const side of [1, -1]) {
    const sx = round1(mx + nx * (e.width * 0.5 + 2.8) * side);
    const sz = round1(mz + nz * (e.width * 0.5 + 2.8) * side);
    if (onAnyRoad(sx, sz, 2.0) || inAnyWater(sx, sz, 2.5)) continue;
    if (ROAD_SIGNS.some(r => Math.hypot(r.x - sx, r.z - sz) < 35)) continue;
    const yaw = +Math.atan2(ux, uz).toFixed(3);
    ROAD_SIGNS.push({ x: sx, z: sz, title: e.name, sub: SIGN_SUBS[e.name], yaw });
    usedSignNames.add(e.name);
    break;
  }
  if (ROAD_SIGNS.length >= 16) break;
}

// Auto-generate verified curbside PARKED_PLACES around Quzhou Old City (starting with HUB)
const HUB_SPOT = { x: 285.0, z: 166.0, angle: +(-Math.PI * 0.56).toFixed(3) };
const WORKSHOP_SPOT = { x: 290.5, z: 136.0, garageX: 278.0, garageZ: 136.0, label: '府东街改装工坊', workshop: true };
const PARKED_TARGETS = [
  [1, 245, -120], [2, 248, 30], [3, -108, 255],
  [0, -142, -98], [1, 152, 8], [2, -162, 18],
  [3, 185, 215], [1, 46, 55], [3, 180, 276],
  [0, -82, -125], [2, -110, 62], [1, 110, -218],
];
const PARKED_PLACES = [[0, HUB_SPOT.x, HUB_SPOT.z, HUB_SPOT.angle]];
for (const [carIdx, tx, tz] of PARKED_TARGETS) {
  const pr = nearestRoadPoint(tx, tz, new Set(['arterial', 'main', 'street']));
  if (!pr) continue;
  const a = graph.nodes[pr.edge.u], b = graph.nodes[pr.edge.v];
  const len = dist(a, b) || 1;
  const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
  const nx = uz, nz = -ux;
  const yaw = +Math.atan2(ux, uz).toFixed(3);
  // Place parked car cleanly on right shoulder of road
  for (const side of [1, -1]) {
    const off = Math.max(3.4, pr.edge.width * 0.5 - 1.55);
    const px = round1(pr.x + nx * off * side);
    const pz = round1(pr.z + nz * off * side);
    if (inAnyWater(px, pz, 2.0)) continue;
    // Avoid intersections (stay >= 10u from degree>=3 nodes)
    const nearJunc = graph.nodes.some((n, ni) => nodeAdj[ni].length >= 3 && Math.hypot(n.x - px, n.z - pz) < 11);
    if (nearJunc) continue;
    // Avoid workshop forecourt
    if (Math.hypot(px - WORKSHOP_SPOT.garageX, pz - WORKSHOP_SPOT.garageZ) < 20) continue;
    PARKED_PLACES.push([carIdx, px, pz, side > 0 ? yaw : +(yaw + Math.PI).toFixed(3)]);
    break;
  }
}

// Emit D:\gta7\quzhou-roads.js
const EDGE_DEFS_OUT = graph.edges.map(e => [
  `q${e.u}`, `q${e.v}`, e.name, e.width, e.kind,
]);

const jsContent = `(() => {
  'use strict';

  // 浙江省衢州市柯城区 · 衢州古城真实 OpenStreetMap 路网与水系数据
  // 由 tools/build_quzhou_osm.js 从真实 OSM 矢量数据等比例投影生成
  // 西临衢江(衢江中路/水亭门隧道)，北至西安路/斗潭河，东抵府东街/衢化路，南达南湖/劳动路
  const IS_OSM_QUZHOU = true;
  const ORIGIN = { lat: ${ORIGIN.lat}, lng: ${ORIGIN.lng} };
  const SCALE = ${SCALE};
  const M_PER_LAT = ${M_PER_LAT};
  const M_PER_LNG = 111320.0 * Math.cos(ORIGIN.lat * Math.PI / 180);

  // WGS-84 <-> GCJ-02 精确转换（用于腾讯实景底图叠加时与真实衢州街道精准重合）
  const GCJ_A = 6378245.0;
  const GCJ_EE = 0.00669342162296594323;
  function _tLat(x, y) {
    let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
    return r;
  }
  function _tLng(x, y) {
    let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
    return r;
  }
  function wgs84ToGcj02(lat, lng) {
    const dLat = _tLat(lng - 105, lat - 35);
    const dLng = _tLng(lng - 105, lat - 35);
    const radLat = lat / 180 * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - GCJ_EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    return {
      lat: +(lat + (dLat * 180) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * Math.PI)).toFixed(6),
      lng: +(lng + (dLng * 180) / (GCJ_A / sqrtMagic * Math.cos(radLat) * Math.PI)).toFixed(6),
    };
  }
  function gcj02ToWgs84(lat, lng) {
    const g = wgs84ToGcj02(lat, lng);
    return { lat: lat * 2 - g.lat, lng: lng * 2 - g.lng };
  }

  function toWgs84(x, z) {
    return {
      lat: +(ORIGIN.lat - (z / SCALE) / M_PER_LAT).toFixed(6),
      lng: +(ORIGIN.lng + (x / SCALE) / M_PER_LNG).toFixed(6),
    };
  }

  function toLatLng(x, z) {
    const w = toWgs84(x, z);
    return wgs84ToGcj02(w.lat, w.lng);
  }

  function fromLatLng(lat, lng) {
    const w = gcj02ToWgs84(lat, lng);
    return {
      x: (w.lng - ORIGIN.lng) * M_PER_LNG * SCALE,
      z: (ORIGIN.lat - w.lat) * M_PER_LAT * SCALE,
    };
  }

  // ${NODE_DEFS.length} 个衢州古城真实 OSM 路网交叉口与弯道节点
  const NODE_DEFS = ${JSON.stringify(NODE_DEFS, null, 2)};

  // ${EDGE_DEFS_OUT.length} 条衢州古城真实 OSM 道路边（保留真实斜交、弧弯、巷陌拓扑）
  const EDGE_DEFS = ${JSON.stringify(EDGE_DEFS_OUT, null, 2)};

  const NODES_BY_ID = new Map();
  const NODES = NODE_DEFS.map((n, index) => {
    const node = { ...n, index, edges: [] };
    NODES_BY_ID.set(n.id, node);
    return node;
  });

  const EDGES = EDGE_DEFS.map(([uId, vId, name, width, kind], index) => {
    const a = NODES_BY_ID.get(uId);
    const b = NODES_BY_ID.get(vId);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const ux = dx / length;
    const uz = dz / length;
    const yaw = Math.atan2(dx, dz);
    const edge = { index, a, b, name, width, kind, length, ux, uz, yaw, cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2 };
    a.edges.push({ to: b, edge });
    b.edges.push({ to: a, edge });
    return edge;
  });

  // ${FACE_DEFS.length} 个由真实路网平面围合生成的衢州古城不规则街区多边形
  const FACES = ${JSON.stringify(FACE_DEFS, null, 2)};

  // 真实 OSM 水系多边形（南湖、斗潭河）
  const WATER_POLYGONS = ${JSON.stringify(WATER_POLYGONS, null, 2)};

  // 真实 OSM 公园多边形（府山公园）
  const PARK_POLYGONS = ${JSON.stringify(PARK_POLYGONS, null, 2)};

  // 8 个衢州古城核心地标（对齐真实 OSM 坐标与最近真实路网导航点）
  const LANDMARKS = ${JSON.stringify(LANDMARKS, null, 2)};

  // 明代衢州古城墙六门真实轮廓线
  const CITY_WALL = ${JSON.stringify(HISTORIC_WALL_RING, null, 2)};

  // ${TRAFFIC_LOOPS.length} 条严格沿真实 OSM 道路拓扑闭环的车流路线
  const TRAFFIC_LOOPS = ${JSON.stringify(TRAFFIC_LOOPS, null, 2)};

  // ${ROAD_SIGNS.length} 处真实衢州街巷路名牌点位
  const ROAD_SIGNS = ${JSON.stringify(ROAD_SIGNS, null, 2)};

  // 起点、改装工坊与路边停放车辆坐标（全部贴合真实道路并避开水体与建筑）
  const HUB_SPOT = ${JSON.stringify(HUB_SPOT)};
  const WORKSHOP_SPOT = ${JSON.stringify(WORKSHOP_SPOT)};
  const PARKED_PLACES = ${JSON.stringify(PARKED_PLACES)};

  function pointInPolygon(px, pz, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, zi = pts[i].z, xj = pts[j].x, zj = pts[j].z;
      if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi + 1e-12) + xi)) inside = !inside;
    }
    return inside;
  }

  function distToRing(px, pz, pts) {
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2)) : 0;
      const d = Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
      if (d < best) best = d;
    }
    return best;
  }

  function inAnyWater(x, z, margin = 0) {
    for (const water of WATER_POLYGONS) {
      if (pointInPolygon(x, z, water.pts)) return true;
      if (margin > 0 && distToRing(x, z, water.pts) < margin) return true;
    }
    return false;
  }

  function projectOnEdge(x, z, edge) {
    const px = x - edge.a.x;
    const pz = z - edge.a.z;
    const t = Math.max(0, Math.min(edge.length, px * edge.ux + pz * edge.uz));
    const rx = edge.a.x + edge.ux * t;
    const rz = edge.a.z + edge.uz * t;
    const dist = Math.hypot(x - rx, z - rz);
    return { x: rx, z: rz, t, dist, edge };
  }

  function nearestRoad(x, z) {
    let best = null;
    for (const edge of EDGES) {
      const proj = projectOnEdge(x, z, edge);
      if (!best || proj.dist < best.dist) best = proj;
    }
    const axis = Math.abs(best.edge.ux) >= Math.abs(best.edge.uz) ? 'x' : 'z';
    return { x: best.x, z: best.z, axis, edge: best.edge, t: best.t, dist: best.dist };
  }

  function onAnyRoad(x, z, margin = 0) {
    for (const edge of EDGES) {
      const proj = projectOnEdge(x, z, edge);
      if (proj.dist <= edge.width * 0.5 + margin) return true;
    }
    return false;
  }

  function edgeBetween(a, b) {
    for (const item of a.edges) if (item.to === b) return item.edge;
    return null;
  }

  function shortestNodePath(startNode, endNode) {
    if (startNode === endNode) return [startNode];
    const dist = new Float64Array(NODES.length).fill(Infinity);
    const prev = new Int32Array(NODES.length).fill(-1);
    const visited = new Uint8Array(NODES.length);
    dist[startNode.index] = 0;

    for (let step = 0; step < NODES.length; step++) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < NODES.length; i++) {
        if (!visited[i] && dist[i] < best) {
          best = dist[i];
          u = i;
        }
      }
      if (u < 0 || u === endNode.index) break;
      visited[u] = 1;
      const node = NODES[u];
      for (const { to, edge } of node.edges) {
        if (visited[to.index]) continue;
        const weight = edge.length * (edge.kind === 'arterial' ? 0.88 : edge.kind === 'main' ? 0.95 : edge.kind === 'alley' ? 1.24 : 1.04);
        const alt = best + weight;
        if (alt < dist[to.index]) {
          dist[to.index] = alt;
          prev[to.index] = u;
        }
      }
    }

    const out = [];
    for (let cur = endNode.index; cur !== -1; cur = prev[cur]) {
      out.push(NODES[cur]);
    }
    out.reverse();
    return out;
  }

  function routeBetween(a, b) {
    const from = nearestRoad(a.x, a.z);
    const to = nearestRoad(b.x, b.z);
    if (from.edge === to.edge) {
      const pts = [
        { x: from.x, z: from.z, width: from.edge.width },
        { x: to.x, z: to.z, width: to.edge.width },
        b,
      ];
      return pts.filter((p, i, arr) => !i || Math.hypot(p.x - arr[i - 1].x, p.z - arr[i - 1].z) > 0.15);
    }

    const startCandidates = [
      { node: from.edge.a, cost: from.t },
      { node: from.edge.b, cost: from.edge.length - from.t },
    ];
    const endCandidates = [
      { node: to.edge.a, cost: to.t },
      { node: to.edge.b, cost: to.edge.length - to.t },
    ];

    let bestLen = Infinity;
    let bestNodes = null;
    for (const s of startCandidates) {
      for (const e of endCandidates) {
        const chain = shortestNodePath(s.node, e.node);
        if (!chain.length || chain[0] !== s.node) continue;
        let len = s.cost + e.cost;
        for (let i = 1; i < chain.length; i++) {
          const ed = edgeBetween(chain[i - 1], chain[i]);
          const factor = ed ? (ed.kind === 'arterial' ? 0.88 : ed.kind === 'main' ? 0.95 : ed.kind === 'alley' ? 1.24 : 1.04) : 1;
          len += Math.hypot(chain[i].x - chain[i - 1].x, chain[i].z - chain[i - 1].z) * factor;
        }
        if (len < bestLen) {
          bestLen = len;
          bestNodes = chain;
        }
      }
    }

    const nodePts = (bestNodes || []).map((n, i, arr) => {
      const nextEdge = i + 1 < arr.length ? edgeBetween(n, arr[i + 1]) : to.edge;
      const prevEdge = i > 0 ? edgeBetween(arr[i - 1], n) : from.edge;
      const w = Math.min(nextEdge ? nextEdge.width : 12, prevEdge ? prevEdge.width : 12);
      return { x: n.x, z: n.z, width: w };
    });
    const raw = [
      { x: from.x, z: from.z, width: from.edge.width },
      ...nodePts,
      { x: to.x, z: to.z, width: to.edge.width },
      b,
    ];
    return raw.filter((p, i, arr) => !i || Math.hypot(p.x - arr[i - 1].x, p.z - arr[i - 1].z) > 0.15);
  }

  function buildTrafficLoop(nodeIds, reverse = false, laneOffset = 3.6) {
    const ids = reverse ? [...nodeIds].reverse() : nodeIds;
    const pts = ids.map(id => NODES_BY_ID.get(id)).filter(Boolean);
    const n = pts.length;
    return pts.map((curr, i) => {
      const prev = pts[(i + n - 1) % n];
      const next = pts[(i + 1) % n];
      const e1 = edgeBetween(prev, curr);
      const e2 = edgeBetween(curr, next);
      const minW = Math.min(e1 ? e1.width : 14, e2 ? e2.width : 14);
      const off = Math.min(laneOffset, minW * 0.25);
      const l1 = Math.hypot(curr.x - prev.x, curr.z - prev.z) || 1;
      const l2 = Math.hypot(next.x - curr.x, next.z - curr.z) || 1;
      const n1x = (prev.z - curr.z) / l1, n1z = (curr.x - prev.x) / l1;
      const n2x = (curr.z - next.z) / l2, n2z = (next.x - curr.x) / l2;
      const dot = n1x * n2x + n1z * n2z;
      const div = Math.max(0.65, 1 + dot);
      return {
        x: curr.x + off * (n1x + n2x) / div,
        z: curr.z + off * (n1z + n2z) / div,
      };
    });
  }

  // 衢州古城真实片区名称判定
  function districtOf(p) {
    if (window.Tideline?.islandAccess?.(p.x, p.z) && p.type !== 'boat') return '严家淤岛';
    if (p.type === 'boat') return '信安湖水道';
    if (p.x > 294) return '信安湖东岸';
    if (pointInPolygon(p.x, p.z, PARK_POLYGONS[0].pts)) return '府山公园';
    if (pointInPolygon(p.x, p.z, WATER_POLYGONS[0].pts)) return '南湖景区';
    if (pointInPolygon(p.x, p.z, WATER_POLYGONS[1].pts)) return '斗潭河畔';
    if (p.z < -150) return p.x > 60 ? '拱辰门 · 北门街' : '斗潭 · 西安路';
    if (p.x > 130 && p.z >= -62 && p.z <= 12) return '孔氏南宗家庙';
    if (p.x > 190 && p.z < 12) return '迎和门 · 府东街';
    if (p.x > 120 && p.z > 12 && p.z < 185) return '府山公园 · 府东街';
    if (p.x < -105 && p.z >= -165 && p.z <= -60) return '水亭门 · 天王塔院';
    if (p.x < -95 && p.z > -60 && p.z < 85) return '水亭门历史街区';
    if (p.z > 220) return p.x > 110 ? '蝴蝶路 · 劳动路' : '南湖 · 劳动路';
    if (p.z >= 145 && p.x < 10) return '大南门 · 礼贤门';
    if (p.z >= 85 && p.x >= 35 && p.x <= 135) return '马站底 · 上街';
    if (p.x >= 10 && p.x <= 110 && p.z >= -135 && p.z <= -45) return '钟楼底 · 北门街';
    return '县西街 · 上下街';
  }

  const api = {
    IS_OSM_QUZHOU,
    ORIGIN,
    SCALE,
    NODES,
    NODES_BY_ID,
    EDGES,
    FACES,
    WATER_POLYGONS,
    PARK_POLYGONS,
    LANDMARKS,
    CITY_WALL,
    TRAFFIC_LOOPS,
    ROAD_SIGNS,
    HUB_SPOT,
    WORKSHOP_SPOT,
    PARKED_PLACES,
    toWgs84,
    toLatLng,
    fromLatLng,
    wgs84ToGcj02,
    inAnyWater,
    projectOnEdge,
    nearestRoad,
    onAnyRoad,
    routeBetween,
    buildTrafficLoop,
    districtOf,
  };

  window.QuzhouRoadData = api;
  window.YulinRoadData = api;
})();
`;

fs.writeFileSync(path.join(ROOT_DIR, 'quzhou-roads.js'), jsContent, 'utf8');
console.log('=== GENERATED quzhou-roads.js FROM REAL QUZHOU OSM DATA ===');
console.log('Nodes:', NODE_DEFS.length, 'Edges:', EDGE_DEFS_OUT.length, 'Faces:', FACE_DEFS.length);
console.log('Traffic loops:', TRAFFIC_LOOPS.length, 'Road signs:', ROAD_SIGNS.length, 'Parked places:', PARKED_PLACES.length);
console.log('Landmarks (verified sites):');
for (const lm of LANDMARKS) {
  const site = lmSites[lm.id];
  console.log(' ', lm.id.padEnd(12), lm.name.padEnd(12), `pos=(${lm.x},${lm.z})`, `nav=(${lm.navX},${lm.navZ})`, site ? `clr=${site.clr} shift=${site.shift}` : '');
}
console.log('Zone counts:', FACE_DEFS.reduce((acc, f) => { acc[f.zone] = (acc[f.zone] || 0) + 1; return acc; }, {}));

// Write updated SVG preview including landmarks, city wall, HUB & WORKSHOP
const svgLines = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-330 -330 680 670" width="1200" height="1180" style="background:#eadfc5">',
  `<rect x="-326" y="-324" width="665" height="652" fill="#ece3cd" stroke="#7e7157" stroke-width="2"/>`,
  `<rect x="298" y="-324" width="41" height="652" fill="#d6c8a8" opacity="0.7"/>`,
  `<rect x="-326" y="304" width="665" height="24" fill="#d6c8a8" opacity="0.7"/>`,
];
const zFill = { park: '#bdd6a8', kongmiao: '#ebd7b4', tianwang: '#e8dbc2', bellTower: '#e7d9bd', shuitingmen: '#e6d8b9', shuitingAlley: '#e7dac0', mazhandi: '#eedbb7', dananmen: '#e5d6b7', outerTown: '#dbd2bc', oldTown: '#e5dac0' };
for (const f of FACE_DEFS) {
  const pts = f.nodes.map(id => { const n = NODE_DEFS[+id.slice(1)]; return `${n.x},${n.z}`; }).join(' ');
  svgLines.push(`<polygon points="${pts}" fill="${zFill[f.zone] || '#e2d5b7'}" stroke="#b9a886" stroke-width="0.7"/>`);
}
for (const p of PARK_POLYGONS) {
  svgLines.push(`<polygon points="${p.pts.map(q => q.x+','+q.z).join(' ')}" fill="#9ec48a" opacity="0.86" stroke="#4f7d4a" stroke-width="1.2"/>`);
}
for (const w of WATER_POLYGONS) {
  svgLines.push(`<polygon points="${w.pts.map(q => q.x+','+q.z).join(' ')}" fill="#7ea8a7" opacity="0.9" stroke="#4b7a7c" stroke-width="1.2"/>`);
}
const roadCol = { arterial: '#554938', main: '#7b6c54', street: '#9a8c74', alley: '#b8a88b' };
for (const e of graph.edges) {
  const a = graph.nodes[e.u], b = graph.nodes[e.v];
  svgLines.push(`<line x1="${a.x.toFixed(1)}" y1="${a.z.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.z.toFixed(1)}" stroke="${roadCol[e.kind]}" stroke-width="${(e.width*0.65).toFixed(1)}" stroke-linecap="round"/>`);
}
for (const e of graph.edges) {
  const a = graph.nodes[e.u], b = graph.nodes[e.v];
  svgLines.push(`<line x1="${a.x.toFixed(1)}" y1="${a.z.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.z.toFixed(1)}" stroke="#faf4e2" stroke-width="${(e.width*0.42).toFixed(1)}" stroke-linecap="round"/>`);
}
// City wall dashed
svgLines.push(`<polygon points="${HISTORIC_WALL_RING.map(p => p.x+','+p.z).join(' ')}" fill="none" stroke="#a44332" stroke-width="1.8" stroke-dasharray="6,4" opacity="0.85"/>`);
// HUB & WORKSHOP
svgLines.push(`<circle cx="${HUB_SPOT.x}" cy="${HUB_SPOT.z}" r="5" fill="#1f7a61" stroke="#fff" stroke-width="1.5"/>`);
svgLines.push(`<text x="${HUB_SPOT.x-26}" y="${HUB_SPOT.z-7}" font-size="10" font-weight="bold" fill="#1f7a61">HUB</text>`);
svgLines.push(`<rect x="${WORKSHOP_SPOT.x-8}" y="${WORKSHOP_SPOT.z-20}" width="16" height="14" fill="#2a5c55" stroke="#fff" stroke-width="1"/>`);
// Landmarks
for (const lm of LANDMARKS) {
  if (lm.id === 'yanjiayu') continue;
  svgLines.push(`<circle cx="${lm.x}" cy="${lm.z}" r="5" fill="#b83227" stroke="#fff" stroke-width="1.5"/>`);
  svgLines.push(`<text x="${lm.x+7}" y="${lm.z+4}" font-size="11" font-family="Microsoft YaHei" font-weight="bold" fill="#2a1d12">${lm.name}</text>`);
}
svgLines.push('</svg>');
fs.writeFileSync(path.join(TOOLS_DIR, 'quzhou_osm_preview.svg'), svgLines.join('\n'));
