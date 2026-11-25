(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;

  const VEHICLE_ORDER = ['taxi', 'hatch', 'coupe', 'sedan', 'van'];

  const VEHICLE_META = {
    taxi:  { name: '衢州出租 · TAXI', tag: '营运专车', defaultPaint: 'taxi_yellow', desc: '衢州古城主力营运轿车，均衡灵活，改装座舱与计价系统可大幅提高车费与小费。' },
    hatch: { name: '信安 GT', tag: '钢炮掀背', defaultPaint: 'xinan_teal', desc: '短轴高转两厢性能车，古城窄巷转向极佳，适合街头探索与连续漂移。' },
    coupe: { name: '烂柯 RS', tag: '旗舰超跑', defaultPaint: 'nankong_red', desc: '低趴流线概念跑车，极速与抓地潜力最高，全阶改装可达 S+ 级赛道表现。' },
    sedan: { name: '南孔 S', tag: '行政轿车', defaultPaint: 'lanke_silver', desc: '稳重大气的城市四门轿车，底盘沉稳舒适，适合环城巡航与观光。' },
    van:   { name: '衢江货车', tag: '城配厢车', defaultPaint: 'bamboo_jade', desc: '高坐姿宽视野厢式车，改装涡轮与宽体尾翼后也能变身街头反差猛兽。' },
  };

  const UPGRADE_TREE = [
    {
      id: 'engine',
      name: '动力总成',
      subtitle: '引擎 · 进排气 · 涡轮增压',
      icon: '⚡',
      levels: [
        { name: '原厂自然吸气', price: 0, desc: '原厂出厂标定，日常城市代步输出平顺。', power: 0, top: 0 },
        { name: '高流量进气 + 铱金火花塞', price: 180, desc: '进气效率提升，中低扭响应更轻快，极速小幅提高。', power: 0.9, top: 2.0 },
        { name: '一阶 ECU 刷写 + 运动排气', price: 380, desc: '优化点火与供油曲线，实装运动双出尾喉，中段加速凌厉。', power: 1.9, top: 4.5 },
        { name: '轻量化涡轮增压套件', price: 680, desc: '加装高响应滚珠轴承涡轮与镀铬双出排气，推背感显著增强。', power: 3.1, top: 7.2 },
        { name: '锻造腹内 + 双涡轮赛用调校', price: 1150, desc: '全锻造活塞连杆配钛合金烤蓝四出排气，声浪浑厚、极速暴涨。', power: 4.4, top: 10.5 },
      ],
    },
    {
      id: 'transmission',
      name: '传动与氮气',
      subtitle: '变速箱齿比 · NOS 增压系统',
      icon: '🔥',
      levels: [
        { name: '原厂 5AT 变速箱', price: 0, desc: '标准城市齿比与基础氮气瓶配置。', nitroForce: 0, nitroTop: 0, drainMult: 1.0, regenBonus: 0 },
        { name: '运动型密齿比套件', price: 160, desc: '缩短换挡间隙，氮气充能速率 +25%，出弯提速更连贯。', nitroForce: 2.4, nitroTop: 2.0, drainMult: 0.92, regenBonus: 0.032 },
        { name: '双离合快换 + 扩容氮气瓶', price: 340, desc: '毫秒级换挡配大容量 NOS 气瓶，氮气推力更强且消耗降低 18%。', nitroForce: 5.0, nitroTop: 4.2, drainMult: 0.82, regenBonus: 0.068 },
        { name: '序列式竞技变速箱 + 双瓶 NOS', price: 620, desc: '直通式动力传递配双瓶氮气喷射，极速冲刺潜力大幅释放。', nitroForce: 7.8, nitroTop: 6.8, drainMult: 0.70, regenBonus: 0.105 },
        { name: '碳纤直齿传动 + 液态氮增压', price: 1020, desc: '顶级赛用直齿箱与超冷液氮喷射，喷口呈现炽金蓝焰，持久爆发。', nitroForce: 11.2, nitroTop: 9.8, drainMult: 0.58, regenBonus: 0.145 },
      ],
    },
    {
      id: 'tires',
      name: '轮胎与制动',
      subtitle: '抓地力 · 雨地排水 · 刹车卡钳',
      icon: '🛞',
      levels: [
        { name: '原厂四季街胎', price: 0, desc: '基础耐磨胶料与单活塞制动，雨天路面较易打滑。', grip: 0, rainSave: 0, brake: 0 },
        { name: '雨地排水运动胎', price: 150, desc: 'V 型导水沟槽与升级刹车皮，雨后古城青石与湿滑柏油抓地提升。', grip: 1.1, rainSave: 0.28, brake: 5.0 },
        { name: '高性能半热熔 + 划线刹车盘', price: 320, desc: '高抓地软胶胎面配通风划线盘，实装运动红卡钳，刹停干脆。', grip: 2.3, rainSave: 0.52, brake: 10.5 },
        { name: '赛道半热熔 + 六活塞卡钳', price: 580, desc: '前六后四锻造卡钳与宽胎配方，高速重刹与急弯咬地极稳。', grip: 3.7, rainSave: 0.74, brake: 16.5 },
        { name: '竞技热熔胎 + 碳陶制动系统', price: 960, desc: '无热衰减碳陶刹车盘配鎏金卡钳，全天候轨道级抓地与极致制动。', grip: 5.2, rainSave: 0.92, brake: 23.0 },
      ],
    },
    {
      id: 'suspension',
      name: '底盘与悬挂',
      subtitle: '绞牙避震 · 车身姿态 · 舒适滤震',
      icon: '⚙',
      levels: [
        { name: '原厂舒适悬挂', price: 0, desc: '常规离地间隙与软质弹簧，急弯时存在明显侧倾。', drop: 0, rollMult: 1.0, steerBonus: 0, impactDamp: 0, comfort: 0 },
        { name: '加强防倾杆 + 聚氨酯衬套', price: 160, desc: '抑制弯道侧倾 20%，指向更清晰，底盘更紧致。', drop: 0.015, rollMult: 0.80, steerBonus: 0.14, impactDamp: 0.18, comfort: 10 },
        { name: '街道可调绞牙避震', price: 350, desc: '车身姿态低趴 3.2cm，过弯支撑扎实，同时滤震回弹利落。', drop: 0.032, rollMult: 0.62, steerBonus: 0.28, impactDamp: 0.34, comfort: 22 },
        { name: '自适应电磁减震系统', price: 640, desc: '毫秒级实时调节阻尼，车身低趴 5cm，兼顾赛道支撑与出租车丝滑滤震。', drop: 0.050, rollMult: 0.44, steerBonus: 0.42, impactDamp: 0.52, comfort: 38 },
        { name: '主动空气悬架 + 碳纤顶吧', price: 1050, desc: '极致低趴姿态与零多余晃动，乘客乘坐如履平地，小费评分大幅飙升。', drop: 0.068, rollMult: 0.28, steerBonus: 0.58, impactDamp: 0.70, comfort: 55 },
      ],
    },
    {
      id: 'aero',
      name: '空气动力学',
      subtitle: '3D 实装包围 · 尾翼下压力 · 扩散器',
      icon: '🪽',
      levels: [
        { name: '原厂素车外观', price: 0, desc: '未加装外挂空力套件，保留原厂纯净线条。', downforce: 0, topBonus: 0 },
        { name: '运动前铲 + 车尾鸭尾', price: 190, desc: '3D 实装低风阻前唇与贴合式鸭尾扰流，高速车头更沉稳。', downforce: 1.1, topBonus: 0.9 },
        { name: '侧裙包围 + 双支架街跑尾翼', price: 400, desc: '3D 实装环车侧裙、车尾扩散器与中低位运动尾翼，高速稳定性跃升。', downforce: 2.3, topBonus: 1.9 },
        { name: '宽体导风套件 + 碳纤 GT 尾翼', price: 720, desc: '3D 实装高架碳纤维 GT 大尾翼与前杠风刀，高速过弯牢牢贴地。', downforce: 3.8, topBonus: 3.2 },
        { name: '赛道全碳空力 + 鹅颈双层尾翼', price: 1180, desc: '3D 实装旗舰鹅颈碳纤双层尾翼、四片式扩散器与全套导流风刀。', downforce: 5.5, topBonus: 4.8 },
      ],
    },
    {
      id: 'taxiTech',
      name: '营运与座舱',
      subtitle: '智能计价 · 尊享内饰 · VIP 专线',
      icon: '🚖',
      levels: [
        { name: '基础机械计价器', price: 0, desc: '标准出租车起步与里程计价，基础绒布座椅。', fareMult: 1.0, tipMult: 1.0, pickupBonus: 0, vipChance: 0, tolerance: 0 },
        { name: '北斗双频导航 + 车载香氛', price: 140, desc: '车费收益 +18%、小费 +18%，上下客停靠判定更宽容。', fareMult: 1.18, tipMult: 1.18, pickupBonus: 2.0, vipChance: 0.12, tolerance: 0.15 },
        { name: '智能调度大屏 + 真皮座舱', price: 300, desc: '车费 +38%、小费 +35%，解锁「古城景区优选单」，3D 升级 LED 智能顶灯。', fareMult: 1.38, tipMult: 1.35, pickupBonus: 3.8, vipChance: 0.30, tolerance: 0.30 },
        { name: '礼宾级隔音座舱 + 优先派单', price: 560, desc: '车费 +62%、小费 +58%，大幅提升平稳驾驶小费与准时送达奖金。', fareMult: 1.62, tipMult: 1.58, pickupBonus: 5.4, vipChance: 0.52, tolerance: 0.50 },
        { name: '南孔尊享旗舰专车套件', price: 940, desc: '车费 +90%、小费 +85%，高频触发 VIP 尊享专线，3D 实装鎏金旗舰顶灯。', fareMult: 1.90, tipMult: 1.85, pickupBonus: 7.0, vipChance: 0.78, tolerance: 0.72 },
      ],
    },
  ];

  const PAINTS = [
    { id: 'taxi_yellow',  name: '衢州出租黄', color: '#f2c53d', price: 0 },
    { id: 'xinan_teal',   name: '信安湖青',   color: '#2c6972', price: 0 },
    { id: 'nankong_red',  name: '南孔宫墙红', color: '#af4540', price: 100 },
    { id: 'shuiting_purp',name: '水亭暮紫',   color: '#625576', price: 100 },
    { id: 'lanke_silver', name: '烂柯石灰',   color: '#b8c8be', price: 100 },
    { id: 'obsidian',     name: '黑曜石',     color: '#222933', price: 120 },
    { id: 'bamboo_jade',  name: '翡翠竹韵',   color: '#2f7d57', price: 140 },
    { id: 'amber_gold',   name: '琥珀流金',   color: '#d98a2b', price: 160 },
    { id: 'glacier_blue', name: '冰川钛银',   color: '#88adc4', price: 180 },
    { id: 'porcelain',    name: '瓷白珍珠',   color: '#e6ebe5', price: 180 },
  ];

  const FINISHES = [
    { id: 'gloss',    name: '原厂亮面', price: 0,   roughness: 0.30, metalness: 0.24, clearcoat: 0.72, clearcoatRoughness: 0.18, env: 0.92 },
    { id: 'metallic', name: '金属珠光', price: 140, roughness: 0.22, metalness: 0.58, clearcoat: 0.92, clearcoatRoughness: 0.10, env: 1.18 },
    { id: 'matte',    name: '缎面哑光', price: 160, roughness: 0.76, metalness: 0.14, clearcoat: 0.04, clearcoatRoughness: 0.85, env: 0.42 },
    { id: 'chrome',   name: '镜面电镀', price: 280, roughness: 0.09, metalness: 0.92, clearcoat: 1.00, clearcoatRoughness: 0.05, env: 1.55 },
  ];

  const WHEELS = [
    { id: 'stock',  name: '原厂轮毂',     price: 0,   rimColor: '#98a3a6', spokeColor: '#b0b9bc', style: 'stock' },
    { id: 'black',  name: '熏黑多幅运动', price: 140, rimColor: '#242930', spokeColor: '#3a414a', style: 'sport' },
    { id: 'gold',   name: '香槟金锻造',   price: 220, rimColor: '#c9a152', spokeColor: '#e4c375', style: 'forged' },
    { id: 'bronze', name: '古铜竞技五辐', price: 240, rimColor: '#8d6242', spokeColor: '#b3815b', style: 'racing' },
    { id: 'cyan',   name: '冰蓝电镀轮圈', price: 300, rimColor: '#56c7d9', spokeColor: '#c4eef5', style: 'chrome' },
  ];

  const UNDERGLOW = [
    { id: 'none',   name: '关闭',     color: null,      price: 0 },
    { id: 'teal',   name: '信安青光', color: '#45f0d6', price: 160 },
    { id: 'gold',   name: '水亭暖金', color: '#ffbf49', price: 160 },
    { id: 'coral',  name: '南孔绯红', color: '#ff4963', price: 180 },
    { id: 'blue',   name: '幽蓝脉冲', color: '#4794ff', price: 180 },
    { id: 'violet', name: '暮紫霓虹', color: '#be6aff', price: 200 },
  ];

  const HEADLIGHTS = [
    { id: 'warm',  name: '原厂卤素暖白', color: '#fff0c8', beam: '#fff3d6', intensity: 1.0,  price: 0 },
    { id: 'xenon', name: '6000K 氙气冷白', color: '#e6f5ff', beam: '#dff2ff', intensity: 1.22, price: 120 },
    { id: 'jdm',   name: '复古黄金雾灯', color: '#ffd54f', beam: '#ffdc6b', intensity: 1.18, price: 140 },
    { id: 'laser', name: '激光冰蓝大灯', color: '#8ee6ff', beam: '#9ae9ff', intensity: 1.38, price: 220 },
  ];

  const PLATES = [
    { id: '8836',  text: '浙H·8836',  bg: '#18479c', fg: '#f2f6fb', price: 0 },
    { id: 't8888', text: '浙H·T8888', bg: '#18479c', fg: '#f2f6fb', price: 120 },
    { id: '66666', text: '浙H·66666', bg: '#164d36', fg: '#f6f5e6', price: 180 },
    { id: 'qz999', text: '浙H·QZ999', bg: '#1c2330', fg: '#ffd86b', price: 220 },
    { id: '00001', text: '浙H·00001', bg: '#7d1e1e', fg: '#fff1cc', price: 260 },
    { id: '520qz', text: '浙H·520QZ', bg: '#18479c', fg: '#ffe79e', price: 200 },
  ];

  const VISUAL_CATALOG = { paint: PAINTS, finish: FINISHES, wheels: WHEELS, underglow: UNDERGLOW, headlight: HEADLIGHTS, plate: PLATES };

  function findItem(list, id) {
    return list.find(item => item.id === id) ?? list[0];
  }

  function defaultVehicleConfig(kind) {
    const defaultPaint = VEHICLE_META[kind]?.defaultPaint ?? 'xinan_teal';
    return {
      levels: { engine: 0, transmission: 0, tires: 0, suspension: 0, aero: 0, taxiTech: 0 },
      paint: defaultPaint,
      finish: 'gloss',
      wheels: 'stock',
      underglow: 'none',
      headlight: 'warm',
      plate: kind === 'taxi' ? 't8888' : '8836',
      owned: {
        paint: ['taxi_yellow', 'xinan_teal', defaultPaint],
        finish: ['gloss'],
        wheels: ['stock'],
        underglow: ['none'],
        headlight: ['warm'],
        plate: kind === 'taxi' ? ['8836', 't8888'] : ['8836'],
      },
    };
  }

  const LEGACY_PAINTS = ['xinan_teal', 'nankong_red', 'shuiting_purp', 'lanke_silver', 'obsidian'];

  function normalizeGarage(rawGarage, legacyPaint = 0, legacyTune = 0) {
    const garage = {};
    const source = rawGarage && typeof rawGarage === 'object' ? rawGarage : {};
    for (const kind of VEHICLE_ORDER) {
      const base = defaultVehicleConfig(kind);
      const entry = source[kind] && typeof source[kind] === 'object' ? source[kind] : null;
      if (entry) {
        for (const cat of UPGRADE_TREE) {
          const lv = entry.levels?.[cat.id];
          base.levels[cat.id] = Number.isInteger(lv) ? D.clamp(lv, 0, cat.levels.length - 1) : 0;
        }
        for (const [slot, list] of Object.entries(VISUAL_CATALOG)) {
          if (list.some(item => item.id === entry[slot])) base[slot] = entry[slot];
          const rawOwned = Array.isArray(entry.owned?.[slot]) ? entry.owned[slot] : [];
          const valid = rawOwned.filter(id => list.some(item => item.id === id));
          const merged = new Set([...base.owned[slot], ...valid, base[slot]]);
          base.owned[slot] = [...merged];
        }
      } else if (kind === 'hatch') {
        if (Number.isInteger(legacyPaint) && LEGACY_PAINTS[legacyPaint]) {
          base.paint = LEGACY_PAINTS[legacyPaint];
          if (!base.owned.paint.includes(base.paint)) base.owned.paint.push(base.paint);
        }
        if (Number.isInteger(legacyTune) && legacyTune > 0) {
          base.levels.engine = D.clamp(legacyTune, 0, 4);
          base.levels.transmission = D.clamp(Math.max(0, legacyTune - 1), 0, 4);
        }
      }
      garage[kind] = base;
    }
    return garage;
  }

  function computeCarStats(model, config) {
    const cfg = config ?? defaultVehicleConfig(model?.kind ?? 'hatch');
    const lv = cfg.levels ?? {};
    const eng = UPGRADE_TREE[0].levels[lv.engine ?? 0] ?? UPGRADE_TREE[0].levels[0];
    const trn = UPGRADE_TREE[1].levels[lv.transmission ?? 0] ?? UPGRADE_TREE[1].levels[0];
    const tir = UPGRADE_TREE[2].levels[lv.tires ?? 0] ?? UPGRADE_TREE[2].levels[0];
    const sus = UPGRADE_TREE[3].levels[lv.suspension ?? 0] ?? UPGRADE_TREE[3].levels[0];
    const aer = UPGRADE_TREE[4].levels[lv.aero ?? 0] ?? UPGRADE_TREE[4].levels[0];
    const tax = UPGRADE_TREE[5].levels[lv.taxiTech ?? 0] ?? UPGRADE_TREE[5].levels[0];

    const baseTop = model?.top ?? 25;
    const basePower = model?.power ?? 8.2;
    const baseGrip = model?.grip ?? 9.0;

    const top = baseTop + eng.top + aer.topBonus;
    const power = basePower + eng.power;
    const grip = baseGrip + tir.grip;
    const downforce = aer.downforce;
    const rainGripFactor = 0.18 * (1 - tir.rainSave);
    const brakePower = 29 + tir.brake;
    const steerBonus = sus.steerBonus;
    const nitroForce = 9.5 + trn.nitroForce * 0.7;
    const nitroTopBonus = 7.0 + trn.nitroTop * 0.7;
    const nitroDrain = 0.42 * trn.drainMult;
    const nitroRegen = 0.115 + trn.regenBonus;
    const rideDrop = sus.drop;
    const rollFactor = sus.rollMult;
    const impactDamp = sus.impactDamp;
    const comfort = Math.min(100, 62 + Math.round(sus.comfort * 0.52 + (lv.taxiTech ?? 0) * 6.5));
    const fareMult = tax.fareMult;
    const tipMult = tax.tipMult * (1 + sus.comfort * 0.0045);
    const pickupRadius = 10.5 + tax.pickupBonus;
    const vipChance = tax.vipChance;
    const collisionTolerance = tax.tolerance;

    const topKmh = Math.round((top + nitroTopBonus * 0.32) * 3.6);
    const zeroToHundred = Number(D.clamp(30.5 / Math.max(5.5, power + trn.nitroForce * 0.08), 2.8, 12.5).toFixed(1));
    const speedScore = Math.round(D.clamp((top - 16) / 30 * 100, 12, 100));
    const accelScore = Math.round(D.clamp((power - 4.8) / 10.5 * 100, 12, 100));
    const gripScore = Math.round(D.clamp((grip + downforce * 0.6 - 5) / 13.5 * 100, 12, 100));
    const brakeScore = Math.round(D.clamp(((brakePower - 24) / 30 * 60 + (1 - rollFactor) * 40 + 18), 16, 100));
    const nitroScore = Math.round(D.clamp(((nitroForce - 11) / 15 * 55 + (nitroRegen - 0.09) / 0.18 * 45), 16, 100));
    const taxiScore = Math.round(D.clamp((fareMult - 0.85) / 1.15 * 62 + comfort * 0.38, 18, 100));

    const totalLevels = (lv.engine ?? 0) + (lv.transmission ?? 0) + (lv.tires ?? 0) + (lv.suspension ?? 0) + (lv.aero ?? 0) + (lv.taxiTech ?? 0);
    const pi = Math.round(D.clamp(180 + speedScore * 2.5 + accelScore * 2.4 + gripScore * 1.9 + brakeScore * 1.1 + nitroScore * 0.8, 220, 999));
    const grade = pi >= 910 ? 'S+' : pi >= 800 ? 'S' : pi >= 680 ? 'A' : pi >= 540 ? 'B' : pi >= 410 ? 'C' : 'D';

    return {
      top, power, grip, downforce, rainGripFactor, brakePower, steerBonus,
      nitroForce, nitroTopBonus, nitroDrain, nitroRegen,
      rideDrop, rollFactor, impactDamp, comfort,
      fareMult, tipMult, pickupRadius, vipChance, collisionTolerance,
      topKmh, zeroToHundred, speedScore, accelScore, gripScore, brakeScore, nitroScore, taxiScore,
      pi, grade, totalLevels, maxLevels: UPGRADE_TREE.length * 4,
      engineLevel: lv.engine ?? 0, transmissionLevel: lv.transmission ?? 0,
      tiresLevel: lv.tires ?? 0, suspensionLevel: lv.suspension ?? 0,
      aeroLevel: lv.aero ?? 0, taxiTechLevel: lv.taxiTech ?? 0,
    };
  }

  // ─── 3D Visual Upgrade Rig Builder ─────────────────────────────────────────
  const boxGeo = new T.BoxGeometry(1, 1, 1);
  const cylGeo = new T.CylinderGeometry(0.5, 0.5, 1, 12).rotateX(Math.PI / 2);
  const rimRingGeo = new T.TorusGeometry(0.245, 0.022, 8, 22).rotateY(Math.PI / 2);
  const rimHubGeo = new T.CylinderGeometry(0.085, 0.085, 0.04, 12).rotateZ(Math.PI / 2);
  const caliperBoxGeo = new T.BoxGeometry(0.055, 0.135, 0.095);
  const platePlaneGeo = new T.PlaneGeometry(1, 1);
  const underglowGeo = new T.PlaneGeometry(3.2, 5.4).rotateX(-Math.PI / 2);

  const carbonMat = new T.MeshStandardMaterial({ color: '#1a1e24', roughness: 0.32, metalness: 0.42 });
  const chromeMat = new T.MeshStandardMaterial({ color: '#dde5ea', roughness: 0.14, metalness: 0.92 });
  const titaniumTipMat = new T.MeshStandardMaterial({ color: '#5b82d6', emissive: '#1c2b59', emissiveIntensity: 0.35, roughness: 0.18, metalness: 0.94 });

  const plateTexCache = new Map();
  function getPlateMaterial(plateItem) {
    if (plateTexCache.has(plateItem.id)) return plateTexCache.get(plateItem.id);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e7edf3';
    ctx.fillRect(0, 0, 256, 72);
    ctx.fillStyle = plateItem.bg;
    ctx.fillRect(4, 4, 248, 64);
    ctx.strokeStyle = plateItem.fg;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 2;
    ctx.strokeRect(7, 7, 242, 58);
    ctx.globalAlpha = 1;
    ctx.fillStyle = plateItem.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 38px "Microsoft YaHei UI", monospace, sans-serif';
    ctx.fillText(plateItem.text, 128, 38, 228);
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    const mat = new T.MeshStandardMaterial({ map: tex, roughness: 0.48, metalness: 0.14 });
    plateTexCache.set(plateItem.id, mat);
    return mat;
  }

  let glowTex = null;
  function getGlowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.92)');
    g.addColorStop(0.52, 'rgba(255,255,255,0.44)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    glowTex = new T.CanvasTexture(c);
    return glowTex;
  }

  function addPart(parent, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  }

  function chassisMetrics(car) {
    const kind = car.model?.kind ?? 'sedan';
    if (kind === 'coupe' && car.concept) {
      return {
        frontZ: 2.34, rearZ: -2.14, halfW: 1.07, sillY: 0.19, deckY: 0.88, deckZ: -1.86,
        exhaustY: 0.25, rearPlateY: 0.31, rearPlateZ: -2.11, frontPlateY: 0.27, frontPlateZ: 2.37, highRoof: false,
      };
    }
    if (kind === 'hatch') {
      return {
        frontZ: 2.24, rearZ: -2.18, halfW: 0.99, sillY: 0.22, deckY: 1.44, deckZ: -1.48,
        exhaustY: 0.26, rearPlateY: 0.66, rearPlateZ: -2.19, frontPlateY: 0.46, frontPlateZ: 2.30, highRoof: true,
      };
    }
    if (kind === 'van') {
      return {
        frontZ: 2.26, rearZ: -2.24, halfW: 1.04, sillY: 0.26, deckY: 2.02, deckZ: -1.86,
        exhaustY: 0.28, rearPlateY: 0.64, rearPlateZ: -2.27, frontPlateY: 0.48, frontPlateZ: 2.29, highRoof: true,
      };
    }
    return {
      frontZ: 2.26, rearZ: -2.24, halfW: 1.00, sillY: 0.23, deckY: 1.06, deckZ: -1.90,
      exhaustY: 0.26, rearPlateY: 0.62, rearPlateZ: -2.27, frontPlateY: 0.45, frontPlateZ: 2.29, highRoof: false,
    };
  }

  function applyCarUpgrades3D(car, config, factory) {
    if (!car || !config) return;
    const stats = computeCarStats(car.model, config);
    car.upgradeConfig = config;
    car.upgradeStats = stats;
    car.rideDrop = stats.rideDrop;

    const paintItem = findItem(PAINTS, config.paint);
    const finishItem = findItem(FINISHES, config.finish);
    const wheelItem = findItem(WHEELS, config.wheels);
    const glowItem = findItem(UNDERGLOW, config.underglow);
    const lampItem = findItem(HEADLIGHTS, config.headlight);
    const plateItem = findItem(PLATES, config.plate);

    if (factory?.paint && paintItem) {
      factory.paint(car, paintItem.color);
    }
    if (car.shell?.material) {
      if (!car.concept && !car.customShellMat) {
        car.customShellMat = car.shell.material.clone();
        car.shell.material = car.customShellMat;
      }
      const mat = car.concept ? car.shell.material : car.customShellMat;
      if (mat) {
        mat.roughness = finishItem.roughness;
        mat.metalness = finishItem.metalness;
        if ('clearcoat' in mat) {
          mat.clearcoat = finishItem.clearcoat;
          mat.clearcoatRoughness = finishItem.clearcoatRoughness;
        }
        if ('envMapIntensity' in mat) mat.envMapIntensity = finishItem.env;
        mat.needsUpdate = true;
      }
    }
    if (car.onPaintSync) car.onPaintSync(paintItem.color, finishItem);

    if (car.beam?.material) {
      if (!car.customBeamMat) {
        car.customBeamMat = car.beam.material.clone();
        car.beam.material = car.customBeamMat;
      }
      car.customBeamMat.color.set(lampItem.beam);
      car.beamIntensity = lampItem.intensity;
    }

    if (car.upgradeRig) {
      car.upgradeRig.parent?.remove(car.upgradeRig);
      car.upgradeRig = null;
    }
    if (car.underglowRig) {
      car.underglowRig.parent?.remove(car.underglowRig);
      car.underglowRig = null;
    }

    const m = chassisMetrics(car);
    const rig = new T.Group();
    rig.name = 'UpgradeRig';
    const accentPaintMat = new T.MeshStandardMaterial({
      color: paintItem.color,
      roughness: finishItem.roughness,
      metalness: finishItem.metalness,
    });

    const pMat = getPlateMaterial(plateItem);
    addPart(rig, platePlaneGeo, pMat, 0, m.rearPlateY, m.rearPlateZ - 0.014, 0.41, 0.115, 1, 0, Math.PI, 0);
    addPart(rig, platePlaneGeo, pMat, 0, m.frontPlateY, m.frontPlateZ + 0.012, 0.36, 0.102, 1, 0, 0, 0);

    const aeroLv = stats.aeroLevel;
    if (aeroLv >= 1) {
      addPart(rig, boxGeo, carbonMat, 0, m.sillY, m.frontZ + 0.06, m.halfW * 2.02, 0.042, 0.24);
      if (aeroLv === 1) {
        addPart(rig, boxGeo, accentPaintMat, 0, m.deckY + 0.055, m.deckZ - 0.10, m.halfW * 1.48, 0.055, 0.16, 0.26, 0, 0);
      }
    }
    if (aeroLv >= 2) {
      for (const side of [-1, 1]) {
        addPart(rig, boxGeo, carbonMat, side * (m.halfW + 0.02), m.sillY + 0.015, 0.02, 0.09, 0.055, 2.38);
      }
      addPart(rig, boxGeo, carbonMat, 0, m.sillY + 0.04, m.rearZ - 0.03, m.halfW * 1.78, 0.11, 0.18);
      for (const fx of [-0.36, 0.36]) {
        addPart(rig, boxGeo, carbonMat, fx, m.sillY + 0.035, m.rearZ - 0.09, 0.03, 0.11, 0.14);
      }
      if (aeroLv === 2) {
        const wingY = m.deckY + 0.17;
        addPart(rig, boxGeo, accentPaintMat, 0, wingY, m.deckZ - 0.14, m.halfW * 1.72, 0.038, 0.22, -0.09, 0, 0);
        for (const side of [-1, 1]) {
          addPart(rig, boxGeo, carbonMat, side * 0.54, m.deckY + 0.085, m.deckZ - 0.13, 0.04, 0.17, 0.12);
          addPart(rig, boxGeo, carbonMat, side * (m.halfW * 0.86), wingY, m.deckZ - 0.14, 0.028, 0.12, 0.24);
        }
      }
    }
    if (aeroLv >= 3) {
      for (const side of [-1, 1]) {
        addPart(rig, boxGeo, chromeMat, side * 0.42, m.sillY + 0.085, m.frontZ + 0.10, 0.016, 0.16, 0.016, 0.24, 0, 0);
        addPart(rig, boxGeo, carbonMat, side * (m.halfW + 0.03), m.sillY + 0.17, m.frontZ - 0.16, 0.09, 0.024, 0.28, 0, side * 0.25, side * -0.18);
      }
      if (aeroLv === 3) {
        const wingY = m.deckY + (m.highRoof ? 0.22 : 0.31);
        addPart(rig, boxGeo, carbonMat, 0, wingY, m.deckZ - 0.18, m.halfW * 1.94, 0.034, 0.26, -0.11, 0, 0);
        for (const side of [-1, 1]) {
          addPart(rig, boxGeo, carbonMat, side * 0.48, m.deckY + (m.highRoof ? 0.11 : 0.155), m.deckZ - 0.15, 0.032, m.highRoof ? 0.22 : 0.31, 0.14, -0.15, 0, 0);
          addPart(rig, boxGeo, accentPaintMat, side * (m.halfW * 0.97), wingY + 0.01, m.deckZ - 0.18, 0.026, 0.19, 0.31);
        }
      }
    }
    if (aeroLv >= 4) {
      const wingY = m.deckY + (m.highRoof ? 0.26 : 0.38);
      addPart(rig, boxGeo, carbonMat, 0, wingY, m.deckZ - 0.20, m.halfW * 2.08, 0.032, 0.28, -0.10, 0, 0);
      addPart(rig, boxGeo, accentPaintMat, 0, wingY + 0.068, m.deckZ - 0.29, m.halfW * 2.04, 0.022, 0.13, -0.26, 0, 0);
      for (const side of [-1, 1]) {
        addPart(rig, boxGeo, carbonMat, side * 0.42, m.deckY + (m.highRoof ? 0.15 : 0.22), m.deckZ - 0.14, 0.028, m.highRoof ? 0.30 : 0.42, 0.14, -0.22, 0, 0);
        addPart(rig, boxGeo, carbonMat, side * 0.42, wingY + 0.04, m.deckZ - 0.19, 0.028, 0.05, 0.16);
        addPart(rig, boxGeo, carbonMat, side * (m.halfW * 1.04), wingY + 0.03, m.deckZ - 0.22, 0.028, 0.26, 0.38);
        addPart(rig, boxGeo, accentPaintMat, side * (m.halfW * 1.055), wingY + 0.03, m.deckZ - 0.22, 0.008, 0.06, 0.32);
        addPart(rig, boxGeo, carbonMat, side * (m.halfW + 0.03), m.sillY + 0.30, m.frontZ - 0.20, 0.08, 0.022, 0.22, 0, side * 0.28, side * -0.22);
      }
      for (const fx of [-0.62, -0.14, 0.14, 0.62]) {
        addPart(rig, boxGeo, carbonMat, fx, m.sillY + 0.032, m.rearZ - 0.11, 0.025, 0.115, 0.18);
      }
    }

    const engLv = stats.engineLevel;
    if (engLv >= 2) {
      const tipMat = engLv >= 4 ? titaniumTipMat : chromeMat;
      const xs = engLv >= 4 ? [-0.68, -0.53, 0.53, 0.68] : engLv >= 3 ? [-0.62, 0.62] : [0.54, 0.68];
      for (const ex of xs) {
        addPart(rig, cylGeo, tipMat, ex, m.exhaustY, m.rearZ - 0.07, 0.115, 0.115, 0.20);
      }
    }

    const tireLv = stats.tiresLevel;
    const caliperColor = tireLv >= 4 ? '#e0a938' : tireLv >= 3 ? '#d93829' : tireLv >= 2 ? '#b8422a' : null;
    const rimMat = new T.MeshStandardMaterial({
      color: wheelItem.rimColor,
      roughness: wheelItem.style === 'chrome' ? 0.12 : wheelItem.style === 'sport' ? 0.56 : 0.26,
      metalness: wheelItem.style === 'chrome' ? 0.94 : wheelItem.style === 'forged' ? 0.78 : 0.52,
    });
    const spokeMat = new T.MeshStandardMaterial({
      color: wheelItem.spokeColor,
      roughness: wheelItem.style === 'sport' ? 0.52 : 0.24,
      metalness: wheelItem.style === 'chrome' ? 0.90 : 0.64,
    });
    const caliperMat = caliperColor ? new T.MeshStandardMaterial({ color: caliperColor, roughness: 0.34, metalness: 0.42 }) : null;
    for (const wheel of car.wheels ?? []) {
      if (wheel.upgradeRim) {
        wheel.tire.remove(wheel.upgradeRim);
        wheel.upgradeRim = null;
      }
      if (wheel.upgradeCaliper) {
        wheel.hub.remove(wheel.upgradeCaliper);
        wheel.upgradeCaliper = null;
      }
      const side = wheel.hub.position.x < 0 ? -1 : 1;
      if (wheelItem.id !== 'stock') {
        const rimGroup = new T.Group();
        const lip = new T.Mesh(rimRingGeo, rimMat);
        lip.position.x = side * 0.132;
        rimGroup.add(lip);
        const centerCap = new T.Mesh(rimHubGeo, spokeMat);
        centerCap.position.x = side * 0.138;
        rimGroup.add(centerCap);
        const spokeCount = wheelItem.style === 'racing' ? 5 : wheelItem.style === 'forged' ? 8 : 6;
        for (let i = 0; i < spokeCount; i++) {
          const ang = (i * Math.PI * 2) / spokeCount;
          const spoke = new T.Mesh(boxGeo, spokeMat);
          spoke.scale.set(0.022, 0.22, 0.028);
          spoke.position.set(side * 0.136, Math.cos(ang) * 0.12, Math.sin(ang) * 0.12);
          spoke.rotation.x = ang;
          rimGroup.add(spoke);
        }
        wheel.tire.add(rimGroup);
        wheel.upgradeRim = rimGroup;
      }
      if (caliperMat) {
        const cal = new T.Mesh(caliperBoxGeo, caliperMat);
        cal.position.set(side * 0.095, 0.08, -0.12);
        cal.rotation.x = 0.55;
        wheel.hub.add(cal);
        wheel.upgradeCaliper = cal;
      }
    }

    car.sprungBody.add(rig);
    car.upgradeRig = rig;

    if (glowItem.color && car.sprungBody.parent) {
      const near = car.sprungBody.parent;
      const glowGroup = new T.Group();
      const floorMat = new T.MeshBasicMaterial({
        color: glowItem.color,
        map: getGlowTexture(),
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        blending: T.AdditiveBlending,
      });
      const floorGlow = new T.Mesh(underglowGeo, floorMat);
      floorGlow.position.set(0, 0.042, 0);
      glowGroup.add(floorGlow);
      const tubeMat = new T.MeshBasicMaterial({ color: glowItem.color, toneMapped: false });
      for (const side of [-1, 1]) {
        addPart(glowGroup, boxGeo, tubeMat, side * (m.halfW - 0.04), m.sillY - 0.02, 0, 0.024, 0.018, 2.24);
      }
      addPart(glowGroup, boxGeo, tubeMat, 0, m.sillY - 0.02, m.frontZ - 0.08, m.halfW * 1.35, 0.018, 0.024);
      addPart(glowGroup, boxGeo, tubeMat, 0, m.sillY - 0.02, m.rearZ + 0.08, m.halfW * 1.35, 0.018, 0.024);
      near.add(glowGroup);
      car.underglowRig = glowGroup;
      car.underglowMat = floorMat;
    } else {
      car.underglowMat = null;
    }

    if (car.onTaxiUpgradeSync) car.onTaxiUpgradeSync(stats, config);
  }

  Object.assign(D, {
    VEHICLE_ORDER, VEHICLE_META, UPGRADE_TREE,
    PAINTS, FINISHES, WHEELS, UNDERGLOW, HEADLIGHTS, PLATES, VISUAL_CATALOG,
    defaultVehicleConfig, normalizeGarage, computeCarStats, applyCarUpgrades3D,
  });
})();
