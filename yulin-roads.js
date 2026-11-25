(() => {
  'use strict';

  // 成都市武侯区玉林片区真实地理路网数据 (GCJ-02 坐标系等比例映射)
  // 东至人民南路四段，南至二环路南三段，西至高新大道永丰路，北至一环路南三段
  const ORIGIN = { lat: 30.627200, lng: 104.058300 };
  const SCALE = 0.355;
  const M_PER_LAT = 110850.0;
  const M_PER_LNG = 111320.0 * Math.cos(ORIGIN.lat * Math.PI / 180);

  function toLatLng(x, z) {
    return {
      lat: +(ORIGIN.lat - (z / SCALE) / M_PER_LAT).toFixed(6),
      lng: +(ORIGIN.lng + (x / SCALE) / M_PER_LNG).toFixed(6),
    };
  }

  function fromLatLng(lat, lng) {
    return {
      x: (lng - ORIGIN.lng) * M_PER_LNG * SCALE,
      z: (ORIGIN.lat - lat) * M_PER_LAT * SCALE,
    };
  }

  // 39 个成都玉林真实交叉口节点
  const NODE_DEFS = [
    // 一环路南三段沿线 (北界)
    { id: 'n_yiguan',    x: -206, z: -288, name: '衣冠庙立交',       lat: 30.63453, lng: 104.05231 },
    { id: 'n_fangcao',   x: -118, z: -266, name: '一环路芳草街口',   lat: 30.63395, lng: 104.05520 },
    { id: 'n_yulin_n',   x:   10, z: -246, name: '一环路玉林北路口', lat: 30.63345, lng: 104.05864 },
    { id: 'n_yulin_st',  x:  156, z: -240, name: '一环路玉林北街口', lat: 30.63330, lng: 104.06218 },
    { id: 'n_gym',       x:  286, z: -234, name: '省体育馆站路口',   lat: 30.63315, lng: 104.06665 },

    // 玉林西路 — 玉林东路沿线
    { id: 'yw_yongfeng', x: -268, z:  -97, name: '永丰路玉林西路口', lat: 30.62955, lng: 104.05045 },
    { id: 'yw_bar',      x: -188, z:  -97, name: '玉林西路小酒馆段', lat: 30.62951, lng: 104.05310 },
    { id: 'yw_fangcao',  x: -122, z:  -97, name: '玉林西路芳草街口', lat: 30.62952, lng: 104.05485 },
    { id: 'yw_yulin_m',  x:    5, z:  -97, name: '玉林北路东路口',   lat: 30.62955, lng: 104.05848 },
    { id: 'ye_yulin_st', x:  156, z:  -97, name: '玉林东路玉林街口', lat: 30.62955, lng: 104.06218 },
    { id: 'ye_renmin',   x:  286, z:  -97, name: '人民南路玉林东路口', lat: 30.62955, lng: 104.06668 },

    // 沙子堰 — 玉林上横巷 — 玉林四巷
    { id: 'sh_fangcao',  x: -125, z:  -44, name: '芳草街沙子堰口',   lat: 30.62805, lng: 104.05475 },
    { id: 'a4_yulin_m',  x:    1.5, z: -44, name: '玉林中路上横巷口', lat: 30.62805, lng: 104.05836 },
    { id: 'a4_yulin_st', x:  156, z:  -44, name: '玉林街玉林四巷口', lat: 30.62815, lng: 104.06218 },

    // 芳草西二街 — 芳草东街 — 玉林西街 — 玉林东街 (玉林综合市场轴线)
    { id: 'fc_yongfeng', x: -292, z:   32, name: '永丰路芳草西路口', lat: 30.62615, lng: 104.04970 },
    { id: 'fc_station',  x: -204, z:   32, name: '芳草街地铁站',     lat: 30.62605, lng: 104.05237 },
    { id: 'fc_east',     x: -128, z:   18, name: '芳草东街口',       lat: 30.62635, lng: 104.05465 },
    { id: 'ym_market',   x:   -2, z:   10, name: '玉林综合市场路口', lat: 30.62650, lng: 104.05825 },
    { id: 'yh_yulin_st', x:  158, z:    0, name: '玉林街玉林横街口', lat: 30.62657, lng: 104.06218 },
    { id: 'yh_renmin',   x:  286, z:    0, name: '人民南路玉林东街口', lat: 30.62660, lng: 104.06672 },

    // 芳华横街 — 倪家桥路沿线
    { id: 'nj_fangcao',  x: -132, z:  100, name: '芳草街芳华横街口', lat: 30.62485, lng: 104.05455 },
    { id: 'nj_yulin_s',  x:   -9, z:  100, name: '玉林南路倪家桥路口', lat: 30.62490, lng: 104.05802 },
    { id: 'nj_yujie',    x:   72, z:  100, name: '倪家桥路玉洁巷口', lat: 30.62490, lng: 104.06010 },
    { id: 'nj_yulin_st', x:  168, z:  100, name: '倪家桥路玉林街口', lat: 30.62490, lng: 104.06245 },
    { id: 'nj_renmin',   x:  286, z:  100, name: '倪家桥地铁站路口', lat: 30.62490, lng: 104.06675 },

    // 紫荆西路 — 芳华街 — 玉洁巷沿线
    { id: 'zj_yongfeng', x: -306, z:  196, name: '永丰路紫荆西路口', lat: 30.62285, lng: 104.04930 },
    { id: 'zj_zijing',   x: -204, z:  196, name: '紫荆北路紫荆西路口', lat: 30.62285, lng: 104.05250 },
    { id: 'fh_south',    x: -115, z:  196, name: '芳华街南口',       lat: 30.62285, lng: 104.05455 },
    { id: 'ys_yujie',    x:  -13, z:  200, name: '玉林南路玉洁西街口', lat: 30.62285, lng: 104.05782 },
    { id: 'yj_alley',    x:   72, z:  200, name: '玉洁巷南口',       lat: 30.62295, lng: 104.06015 },
    { id: 'yj_east',     x:  168, z:  200, name: '玉林南街玉洁东街口', lat: 30.62295, lng: 104.06250 },
    { id: 'yj_renmin',   x:  286, z:  200, name: '人民南路四段南',   lat: 30.62295, lng: 104.06678 },

    // 二环路南三段沿线 (南界)
    { id: 's2_yongfeng', x: -312, z:  288, name: '永丰立交',         lat: 30.62045, lng: 104.04910 },
    { id: 's2_zijing',   x: -204, z:  290, name: '二环路紫荆北路口', lat: 30.62035, lng: 104.05250 },
    { id: 's2_fangcao',  x: -115, z:  292, name: '二环路芳草南口',   lat: 30.62030, lng: 104.05460 },
    { id: 's2_yulin_s',  x:  -13, z:  294, name: '二环路玉林南路口', lat: 30.62025, lng: 104.05760 },
    { id: 's2_nijia',    x:  168, z:  294, name: '二环路南三段东',   lat: 30.62020, lng: 104.06250 },
    { id: 's2_rennan',   x:  286, z:  294, name: '人南立交',         lat: 30.62016, lng: 104.06685 },
  ];

  // 61 条成都玉林真实道路与街巷拓扑边
  const EDGE_DEFS = [
    // 1. 一环路南三段 (城市主干道)
    ['n_yiguan',   'n_fangcao',   '一环路南三段', 19, 'arterial'],
    ['n_fangcao',  'n_yulin_n',   '一环路南三段', 19, 'arterial'],
    ['n_yulin_n',  'n_yulin_st',  '一环路南三段', 19, 'arterial'],
    ['n_yulin_st', 'n_gym',       '一环路南三段', 19, 'arterial'],

    // 2. 二环路南三段 (城市主干道)
    ['s2_yongfeng', 's2_zijing',  '二环路南三段', 19, 'arterial'],
    ['s2_zijing',   's2_fangcao', '二环路南三段', 19, 'arterial'],
    ['s2_fangcao',  's2_yulin_s', '二环路南三段', 19, 'arterial'],
    ['s2_yulin_s',  's2_nijia',   '二环路南三段', 19, 'arterial'],
    ['s2_nijia',    's2_rennan',  '二环路南三段', 19, 'arterial'],

    // 3. 人民南路四段 (成都中轴南延主干道)
    ['n_gym',     'ye_renmin',    '人民南路四段', 19, 'arterial'],
    ['ye_renmin', 'yh_renmin',    '人民南路四段', 19, 'arterial'],
    ['yh_renmin', 'nj_renmin',    '人民南路四段', 19, 'arterial'],
    ['nj_renmin', 'yj_renmin',    '人民南路四段', 19, 'arterial'],
    ['yj_renmin', 's2_rennan',    '人民南路四段', 19, 'arterial'],

    // 4. 高新大道永丰路 (西界斜向主干道)
    ['n_yiguan',    'yw_yongfeng', '永丰路', 19, 'arterial'],
    ['yw_yongfeng', 'fc_yongfeng', '永丰路', 19, 'arterial'],
    ['fc_yongfeng', 'zj_yongfeng', '永丰路', 19, 'arterial'],
    ['zj_yongfeng', 's2_yongfeng', '永丰路', 19, 'arterial'],

    // 5. 玉林北路 — 玉林中路 — 玉林南路 (玉林南北核心脊梁)
    ['n_yulin_n',  'yw_yulin_m', '玉林北路', 16.5, 'main'],
    ['yw_yulin_m', 'a4_yulin_m', '玉林中路', 16.5, 'main'],
    ['a4_yulin_m', 'ym_market',  '玉林中路', 16.5, 'main'],
    ['ym_market',  'nj_yulin_s', '玉林中路', 16.5, 'main'],
    ['nj_yulin_s', 'ys_yujie',   '玉林南路', 16.5, 'main'],
    ['ys_yujie',   's2_yulin_s', '玉林南路', 16.5, 'main'],

    // 6. 芳草街 (文艺慢行主街)
    ['n_fangcao',  'yw_fangcao', '芳草街', 15.5, 'main'],
    ['yw_fangcao', 'sh_fangcao', '芳草街', 15.5, 'main'],
    ['sh_fangcao', 'fc_east',    '芳草街', 15.5, 'main'],
    ['fc_east',    'nj_fangcao', '芳草街', 15.5, 'main'],
    ['nj_fangcao', 'fh_south',   '芳草街', 15.5, 'main'],
    ['fh_south',   's2_fangcao', '芳草街', 15.5, 'main'],

    // 7. 玉林北街 — 玉林街 — 玉林南街 (串串香与市井老街)
    ['n_yulin_st',  'ye_yulin_st', '玉林北街', 14.5, 'street'],
    ['ye_yulin_st', 'a4_yulin_st', '玉林街',   14.5, 'street'],
    ['a4_yulin_st', 'yh_yulin_st', '玉林街',   14.5, 'street'],
    ['yh_yulin_st', 'nj_yulin_st', '玉林街',   14.5, 'street'],
    ['nj_yulin_st', 'yj_east',     '玉林南街', 14.5, 'street'],
    ['yj_east',     's2_nijia',    '玉林南街', 14.5, 'street'],

    // 8. 瑞升南街 — 紫荆北路 (神仙树/紫荆片区纵线)
    ['yw_bar',    'fc_station', '沙子堰西巷', 13,   'alley'],
    ['fc_station','zj_zijing',  '瑞升南街',   14.5, 'street'],
    ['zj_zijing', 's2_zijing',  '紫荆北路',   15.5, 'main'],

    // 9. 玉洁巷 (社区涂鸦文创巷)
    ['nj_yujie',  'yj_alley',   '玉洁巷',     12.5, 'alley'],

    // 10. 玉林西路 — 玉林东路 (小酒馆酒吧街 & 城市更新示范街)
    ['yw_yongfeng', 'yw_bar',      '玉林西路', 16.5, 'main'],
    ['yw_bar',      'yw_fangcao',  '玉林西路', 16.5, 'main'],
    ['yw_fangcao',  'yw_yulin_m',  '玉林西路', 16.5, 'main'],
    ['yw_yulin_m',  'ye_yulin_st', '玉林东路', 16.5, 'main'],
    ['ye_yulin_st', 'ye_renmin',   '玉林东路', 16.5, 'main'],

    // 11. 沙子堰中巷 — 玉林上横巷 (老社区烟火巷)
    ['sh_fangcao',  'a4_yulin_m',  '沙子堰中巷', 12.5, 'alley'],
    ['a4_yulin_m',  'a4_yulin_st', '玉林上横巷', 12.5, 'alley'],

    // 12. 芳草西二街 — 芳草东街 — 玉林西街 — 玉林东街 (菜市与地铁走廊)
    ['fc_yongfeng', 'fc_station',  '芳草西二街', 14.5, 'street'],
    ['fc_station',  'fc_east',     '芳草东街',   14.5, 'street'],
    ['fc_east',     'ym_market',   '芳草东街',   14.5, 'street'],
    ['ym_market',   'yh_yulin_st', '玉林西街',   14.5, 'street'],
    ['yh_yulin_st', 'yh_renmin',   '玉林东街',   14.5, 'street'],

    // 13. 芳华横街 — 倪家桥路 (8号线/1号线走廊)
    ['nj_fangcao',  'nj_yulin_s',  '芳华横街', 13.5, 'street'],
    ['nj_yulin_s',  'nj_yujie',    '倪家桥路', 15.5, 'main'],
    ['nj_yujie',    'nj_yulin_st', '倪家桥路', 15.5, 'main'],
    ['nj_yulin_st', 'nj_renmin',   '倪家桥路', 15.5, 'main'],

    // 14. 紫荆西路 — 芳华街 — 玉洁西街 — 玉洁东街
    ['zj_yongfeng', 'zj_zijing',   '紫荆西路', 14.5, 'street'],
    ['zj_zijing',   'fh_south',    '紫荆西路', 13.5, 'street'],
    ['fh_south',    'ys_yujie',    '芳华街',   13.5, 'alley'],
    ['ys_yujie',    'yj_alley',    '玉洁西街', 13.0, 'alley'],
    ['yj_alley',    'yj_east',     '玉洁东街', 13.0, 'alley'],
    ['yj_east',     'yj_renmin',   '玉洁东街', 13.5, 'street'],
  ];

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

  // 街区多边形面片 (逆时针/顺时针闭合节点序列，用于生成人行道底座与成都玉林建筑院落)
  const FACES = [
    // 第一排: 一环路南三段 — 玉林西路/东路
    { nodes: ['n_yiguan', 'n_fangcao', 'yw_fangcao', 'yw_bar', 'yw_yongfeng'], zone: 'northWest', name: '衣冠庙街坊' },
    { nodes: ['n_fangcao', 'n_yulin_n', 'yw_yulin_m', 'yw_fangcao'], zone: 'yulinWest', name: '玉林北路社区' },
    { nodes: ['n_yulin_n', 'n_yulin_st', 'ye_yulin_st', 'yw_yulin_m'], zone: 'tower', name: '一环科华街坊' },
    { nodes: ['n_yulin_st', 'n_gym', 'ye_renmin', 'ye_yulin_st'], zone: 'gymnasium', name: '省体育馆片区' },

    // 第二排: 玉林西路/东路 — 沙子堰/玉林四巷 — 芳草东街/玉林东街
    { nodes: ['yw_yongfeng', 'yw_bar', 'fc_station', 'fc_yongfeng'], zone: 'west', name: '沙子堰西院' },
    { nodes: ['yw_bar', 'yw_fangcao', 'sh_fangcao', 'fc_east', 'fc_station'], zone: 'barStreet', name: '玉林西路酒馆街' },
    { nodes: ['yw_fangcao', 'yw_yulin_m', 'a4_yulin_m', 'sh_fangcao'], zone: 'oldYulin', name: '沙子堰社区' },
    { nodes: ['yw_yulin_m', 'ye_yulin_st', 'a4_yulin_st', 'a4_yulin_m'], zone: 'oldYulin', name: '玉林四巷社区' },
    { nodes: ['sh_fangcao', 'a4_yulin_m', 'ym_market', 'fc_east'], zone: 'marketWest', name: '芳草东街院落' },
    { nodes: ['a4_yulin_m', 'a4_yulin_st', 'yh_yulin_st', 'ym_market'], zone: 'marketCore', name: '玉林综合市场街坊' },
    { nodes: ['ye_yulin_st', 'ye_renmin', 'yh_renmin', 'yh_yulin_st', 'a4_yulin_st'], zone: 'boulevard2', zi: 2, name: '玉林东路街坊' },

    // 第三排: 芳草东街/玉林西街 — 芳华横街/倪家桥路
    { nodes: ['fc_yongfeng', 'fc_station', 'zj_zijing', 'zj_yongfeng'], zone: 'west', name: '创业路社区' },
    { nodes: ['fc_station', 'fc_east', 'nj_fangcao', 'fh_south', 'zj_zijing'], zone: 'fangcao', name: '芳草街社区' },
    { nodes: ['fc_east', 'ym_market', 'nj_yulin_s', 'nj_fangcao'], zone: 'fanghua', name: '芳华横街院落' },
    { nodes: ['ym_market', 'yh_yulin_st', 'nj_yulin_st', 'nj_yujie', 'nj_yulin_s'], zone: 'park', name: '玉林中心花园' },
    { nodes: ['yh_yulin_st', 'yh_renmin', 'nj_renmin', 'nj_yulin_st'], zone: 'boulevard3', zi: 3, name: '人民南路中段' },

    // 第四排: 倪家桥路 — 紫荆西路/芳华街/玉洁巷
    { nodes: ['nj_fangcao', 'nj_yulin_s', 'ys_yujie', 'fh_south'], zone: 'fanghua', name: '芳华街文创院' },
    { nodes: ['nj_yulin_s', 'nj_yujie', 'yj_alley', 'ys_yujie'], zone: 'oldYulin', name: '玉洁西街小区' },
    { nodes: ['nj_yujie', 'nj_yulin_st', 'yj_east', 'yj_alley'], zone: 'oldYulin', name: '玉洁巷文创街坊' },
    { nodes: ['nj_yulin_st', 'nj_renmin', 'yj_renmin', 'yj_east'], zone: 'garageBlock', zi: 4, name: '倪家桥机修街坊' },

    // 第五排: 紫荆西路/玉洁巷 — 二环路南三段
    { nodes: ['zj_yongfeng', 'zj_zijing', 's2_zijing', 's2_yongfeng'], zone: 'southYard', xi: 0, name: '永丰立交货场' },
    { nodes: ['zj_zijing', 'fh_south', 's2_fangcao', 's2_zijing'], zone: 'southYard', xi: 1, name: '紫荆物流站' },
    { nodes: ['fh_south', 'ys_yujie', 's2_yulin_s', 's2_fangcao'], zone: 'warehouse7', name: '二环七号院仓' },
    { nodes: ['ys_yujie', 'yj_alley', 'yj_east', 's2_nijia', 's2_yulin_s'], zone: 'southYard', xi: 3, name: '玉林南路站场' },
    { nodes: ['yj_east', 'yj_renmin', 's2_rennan', 's2_nijia'], zone: 'tower', name: '人南立交商务区' },
  ];

  // 计算点到路段的投影
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

  // 检查坐标是否处于任意真实道路路面范围内 (margin > 0 表示向外扩宽禁建缓冲)
  function onAnyRoad(x, z, margin = 0) {
    for (const edge of EDGES) {
      const proj = projectOnEdge(x, z, edge);
      if (proj.dist <= edge.width * 0.5 + margin) return true;
    }
    return false;
  }

  // 基于真实玉林路网的 Dijkstra 最短路寻路
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
        // 主干道通行权重略优，模拟真实导航偏好
        const weight = edge.length * (edge.kind === 'arterial' ? 0.92 : edge.kind === 'main' ? 0.97 : edge.kind === 'alley' ? 1.12 : 1.03);
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
      const pts = [{ x: from.x, z: from.z }, { x: to.x, z: to.z }, b];
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
        let len = s.cost + e.cost;
        for (let i = 1; i < chain.length; i++) {
          len += Math.hypot(chain[i].x - chain[i - 1].x, chain[i].z - chain[i - 1].z);
        }
        if (len < bestLen) {
          bestLen = len;
          bestNodes = chain;
        }
      }
    }

    const raw = [
      { x: from.x, z: from.z },
      ...(bestNodes || []).map(n => ({ x: n.x, z: n.z })),
      { x: to.x, z: to.z },
      b,
    ];
    return raw.filter((p, i, arr) => !i || Math.hypot(p.x - arr[i - 1].x, p.z - arr[i - 1].z) > 0.15);
  }

  // 生成闭合多边形上的右侧车道巡航环线 (供 AI 车流沿着真实斜向/网格街道行驶)
  function buildTrafficLoop(nodeIds, reverse = false, laneOffset = 3.9) {
    const ids = reverse ? [...nodeIds].reverse() : nodeIds;
    const pts = ids.map(id => NODES_BY_ID.get(id));
    const n = pts.length;
    return pts.map((curr, i) => {
      const prev = pts[(i + n - 1) % n];
      const next = pts[(i + 1) % n];
      const l1 = Math.hypot(curr.x - prev.x, curr.z - prev.z) || 1;
      const l2 = Math.hypot(next.x - curr.x, next.z - curr.z) || 1;
      // 前后两段道路的右侧法向量 (前進方向顺时针 90 度: (prev.z - curr.z, curr.x - prev.x) / L)
      const n1x = (prev.z - curr.z) / l1, n1z = (curr.x - prev.x) / l1;
      const n2x = (curr.z - next.z) / l2, n2z = (next.x - curr.x) / l2;
      const dot = n1x * n2x + n1z * n2z;
      const div = Math.max(0.55, 1 + dot);
      return {
        x: curr.x + laneOffset * (n1x + n2x) / div,
        z: curr.z + laneOffset * (n1z + n2z) / div,
      };
    });
  }

  // 12 条覆盖成都玉林全域的真实道路车流循环环线
  const TRAFFIC_LOOPS = [
    ['n_yiguan', 'n_fangcao', 'yw_fangcao', 'yw_bar', 'yw_yongfeng'],
    ['n_fangcao', 'n_yulin_n', 'yw_yulin_m', 'yw_fangcao'],
    ['n_yulin_n', 'n_gym', 'ye_renmin', 'yw_yulin_m'],
    ['yw_yulin_m', 'ye_yulin_st', 'yh_yulin_st', 'ym_market'],
    ['ye_yulin_st', 'ye_renmin', 'nj_renmin', 'nj_yulin_st', 'yh_yulin_st'],
    ['yw_fangcao', 'yw_yulin_m', 'ym_market', 'fc_east', 'sh_fangcao'],
    ['fc_yongfeng', 'fc_station', 'zj_zijing', 'zj_yongfeng'],
    ['fc_east', 'ym_market', 'nj_yulin_s', 'nj_fangcao'],
    ['ym_market', 'yh_yulin_st', 'nj_yulin_st', 'nj_yulin_s'],
    ['nj_yulin_s', 'nj_renmin', 's2_rennan', 's2_yulin_s', 'ys_yujie'],
    ['zj_zijing', 'fh_south', 's2_fangcao', 's2_zijing'],
    ['n_yiguan', 'n_gym', 's2_rennan', 's2_yongfeng', 'zj_yongfeng', 'fc_yongfeng', 'yw_yongfeng'],
  ];

  // 真实街巷路名牌点位
  const ROAD_SIGNS = [
    { x: -155, z: -86,  title: '玉林西路',     sub: 'YULIN WEST RD',    yaw: 0 },
    { x:   78, z: -86,  title: '玉林东路',     sub: 'YULIN EAST RD',    yaw: 0 },
    { x:   16, z: -168, title: '玉林北路',     sub: 'YULIN NORTH RD',   yaw: Math.PI / 2 },
    { x:  -12, z:  -12, title: '玉林中路',     sub: 'YULIN MIDDLE RD',  yaw: Math.PI / 2 },
    { x:  -24, z:  148, title: '玉林南路',     sub: 'YULIN SOUTH RD',   yaw: Math.PI / 2 },
    { x: -116, z:   54, title: '芳草街',       sub: 'FANGCAO ST',       yaw: -Math.PI / 2 },
    { x:  222, z:   89, title: '倪家桥路',     sub: 'NIJIAQIAO RD',     yaw: 0 },
    { x:  274, z:  -48, title: '人民南路四段', sub: 'RENMIN SOUTH RD',  yaw: -Math.PI / 2 },
    { x:  -52, z: -244, title: '一环路南三段', sub: '1ST RING RD S3',   yaw: 0 },
    { x:   68, z:  282, title: '二环路南三段', sub: '2ND RING RD S3',   yaw: Math.PI },
  ];

  // 成都玉林真实片区名称判定
  function districtOf(p) {
    if (window.Tideline?.islandAccess?.(p.x, p.z) && p.type !== 'boat') return '锦江江心岛';
    if (p.type === 'boat') return '锦江水道';
    if (p.x > 296) return '锦江河畔';
    if (p.z < -175 && p.x > 110) return '省体育馆';
    if (p.z < -180) return '一环路南三段';
    if (p.z > 215) return '二环路南三段';
    if (p.x < -140 && p.z < 10) return '玉林西路';
    if (p.x < -120 && p.z >= 10) return '芳草街';
    if (p.x > 145 && p.z < 50) return '玉林东路';
    if (p.x > 145 && p.z >= 50) return '倪家桥';
    if (p.z >= 95) return '芳华街 · 玉洁巷';
    return '玉林综合市场';
  }

  window.YulinRoadData = {
    ORIGIN,
    SCALE,
    NODES,
    NODES_BY_ID,
    EDGES,
    FACES,
    TRAFFIC_LOOPS,
    ROAD_SIGNS,
    toLatLng,
    fromLatLng,
    projectOnEdge,
    nearestRoad,
    onAnyRoad,
    routeBetween,
    buildTrafficLoop,
    districtOf,
  };
})();
