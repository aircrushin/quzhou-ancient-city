(() => {
  'use strict';

  const T = window.THREE;
  const Y = window.QuzhouRoadData || window.YulinRoadData;
  const X = [-306, -204, -122, -9, 72, 168, 286];
  const Z = [-266, -180, -97, 0, 100, 200, 294];
  const BOUNDS = { minX: -326, maxX: 339, minZ: -324, maxZ: 328 };
  const ROAD = 18;
  const JOBS = [
    { name: '古城夜班', type: '限时送件', place: '新河沿机修铺', x: 279.3, z: 126.2, reward: 420, detail: '沿新河沿、荷花西路与礼贤街赶在交班前把信号盒送到南门站场。' },
    { name: '南门回声', type: '取件 / 追逐', place: '礼贤街南门站场', x: -115, z: 236, reward: 720, detail: '从南门站场取回记录，穿行水亭街与县西街甩开追车再送往通荷路信号站。' },
    { name: '环古城夜跑', type: '环线计时赛', place: '迎和门起跑线', x: 291, z: -97, reward: 560, detail: '沿新河沿、通荷路、北门街、县西街与马站底穿过九道计时门。' },
    { name: '雨夜粮仓', type: '潜入 / 撤离', place: '礼贤街七号粮仓', x: -18, z: 257, reward: 1080, detail: '潜入有人值守的七号粮仓取回母带，穿过雨夜送到马站底街口。' },
    { name: '信安湖夜航', type: '水上回收 / 登岛', place: '信安湖东岸码头', x: 354, z: 208, reward: 1380, detail: '在信安湖回收备用电源，登上严家淤岛恢复航标，再回东岸码头报到。' },
  ];
  const HUB = Y?.HUB_SPOT ? { ...Y.HUB_SPOT } : { x: 294, z: 161, angle: Math.PI };
  const DELIVERY = { x: -115, z: 203, place: '南门站场入口' };
  const STASH = { x: 82, z: -236, place: '通荷路信号站' };
  const RACE = [
    { x: 256.9, z: 175.8, yaw: -0.107, street: '府东街' },
    { x: 148.7, z: 269.9, yaw: -1.861, street: '劳动路' },
    { x: -57.4, z: 262.1, yaw: -1.301, street: '劳动路' },
    { x: -246.7, z: 254.2, yaw: 2.916, street: '衢江中路' },
    { x: -188.0, z: 51.7, yaw: 2.776, street: '水亭门隧道' },
    { x: -136.3, z: -152.5, yaw: 2.868, street: '衢江中路' },
    { x: -22.0, z: -287.8, yaw: 1.212, street: '西安路' },
    { x: 169.0, z: -203.0, yaw: 1.165, street: '西安路' },
    { x: 233.3, z: -34.1, yaw: 0.056, street: '府东街' },
  ];
  const TAPES = [
    { id: 'shuiting_drum', x: -159.1, z: -54.5, name: '水亭门城楼夜鼓', line: '暮鼓穿过水亭门城洞，回荡在衢江水面上。' },
    { id: 'xinan_breeze', x: 368.5, z: 204.0, name: '信安湖晚风', line: '东岸栈桥拂过微凉湖风，远方严家淤灯塔渐亮。' },
    { id: 'kongmiao_chant', x: 143.8, z: -46.3, name: '南孔家庙晨诵', line: '古柏树影下传来琅琅书声，礼乐绵延八百年。' },
    { id: 'fushan_chime', x: 247.0, z: 121.1, name: '府山钟灵塔风铃', line: '府山松风吹响塔檐铜铃，清脆悦耳。' },
    { id: 'lixian_radio', x: -137.9, z: 157.2, name: '礼贤街南门老广播', line: '街角老音箱播着越剧唱段与傍晚天气预报。' },
    { id: 'shuiting_rain', x: -119.3, z: 22.9, name: '水亭街青石板雨声', line: '细雨轻叩青石板巷道，灯笼倒影缓缓摇曳。' },
    { id: 'tianwang_bell', x: -53.4, z: -142.9, name: '天王塔院檐铃', line: '梁代七层古塔风铎轻鸣，映衬着老街晚霞。' },
    { id: 'beimen_clock', x: 42.3, z: -125.7, name: '北门街钟楼报时', line: '铜钟沉稳报时，唤醒钟楼底与北门街的烟火气。' },
    { id: 'dananmen_watch', x: -24.3, z: 209.6, name: '大南门城墙夜巡', line: '南湖微澜伴着石桥脚步声，晚风带起阵阵桂香。' },
    { id: 'mazhandi_oven', x: 71.0, z: 62.4, name: '马站底烤饼炭炉', line: '炭火噼啪作响，梅干菜烤饼与鸭头的香气扑面而来。' },
  ];
  const LAKE_RACE_START = { x: 394, z: 222, yaw: 1.38, street: '信安湖东岸航道' };
  const LAKE_RACE = [
    { x: 476, z: 242, yaw: 1.48, street: '东岸航道' },
    { x: 604, z: 236, yaw: 1.32, street: '严家淤南湾' },
    { x: 734, z: 162, yaw: 0.25, street: '灯塔东岬' },
    { x: 676, z: 54, yaw: -1.18, street: '湖心北水道' },
    { x: 526, z: 32, yaw: -1.68, street: '信安湖心' },
    { x: 432, z: 96, yaw: -2.42, street: '东岸外航标' },
    { x: 398, z: 186, yaw: -2.98, street: '东岸码头终点' },
  ];
  const PHOTO_SPOTS = [
    { id: 'photo_shuiting', landmarkId: 'shuitingmen', x: -180, y: 8.5, z: -80, maxDist: 105,
      name: '水亭门城楼 · 临江古韵', tip: '框住明代重檐城楼，推荐黄昏或夜色拍摄。' },
    { id: 'photo_kongmiao', landmarkId: 'kongmiao', x: 161.4, y: 6.5, z: -22.3, maxDist: 95,
      name: '南孔家庙 · 朱墙古柏', tip: '取景棂星门与大成殿红墙，晴朗白昼尤为出片。' },
    { id: 'photo_belltower', landmarkId: 'belltower', x: 33, y: 9.0, z: -104, maxDist: 95,
      name: '衢州钟楼 · 古轴晨钟', tip: '沿钟楼底与北门街交汇处仰拍双层铜钟阁。' },
    { id: 'photo_fushan', landmarkId: 'fushan', x: 184, y: 14.0, z: 76, maxDist: 125,
      name: '府山钟灵塔 · 松影流云', tip: '近仰或远眺钟灵塔尖，适当缩小焦距更具纵深。' },
    { id: 'photo_yanjiayu', landmarkId: 'yanjiayu', x: 631, y: 12.0, z: 139, maxDist: 240,
      name: '严家淤灯塔 · 信安湖光', tip: '在东岸栈桥、游艇或严家淤岛框住湖心灯塔。' },
  ];
  const STREET_SPOTS = [
    {
      id: 'duck_stall', kind: 'food', x: 324.8, z: 107.04,
      name: '衢州三头一掌', actionLabel: '品尝衢州三头一掌 (¥25)', shortLabel: '品尝', cost: 25,
      buff: { id: 'spicy', name: '热辣加速', icon: '★', duration: 60, walkMult: 1.18, nitroRegenMult: 1.75, driftMult: 1.25, nitroBoost: .45 },
      speaker: '三头一掌摊主',
      line: '现卤鸭头鸭掌刚出锅，衢州辣劲上头，跑街提速、氮气回充更快！',
      toastBody: '60 秒内步行 +18%、氮气回充 ×1.75、漂移 ×1.25',
    },
    {
      id: 'cake_stall', kind: 'food', x: 324.8, z: 122.0,
      name: '炭炉烤饼水晶糕', actionLabel: '来份烤饼水晶糕 (¥20)', shortLabel: '品尝', cost: 20,
      buff: { id: 'steady', name: '烤饼充能', icon: '✦', duration: 60, walkMult: 1.10, nitroRegenMult: 1.25, driftMult: 1.40, driftCashMult: 1.25, fullNitro: true },
      speaker: '炭炉老师傅',
      line: '刚出炉的梅干菜烤饼配冰凉水晶糕，解腻又稳当，座驾氮气已补满！',
      toastBody: '60 秒内漂移积分 ×1.4、甩尾奖金 +25%，并回满氮气',
    },
    {
      id: 'mazhandi_feast', kind: 'food', x: 73.3, z: 138.0,
      name: '马站底老街食坊', actionLabel: '寻味马站底小吃 (¥30)', shortLabel: '寻味', cost: 30,
      buff: { id: 'feast', name: '马站底烟火', icon: '❖', duration: 75, walkMult: 1.15, nitroRegenMult: 1.50, driftMult: 1.30, driftCashMult: 1.15, fullNitro: true },
      speaker: '马站底食坊掌柜',
      line: '搁袋饼、鸭头配一碗热腾腾的衢州粉干，吃透老街烟火气再出发！',
      toastBody: '75 秒内步行 +15%、氮气回充 ×1.5、漂移积分 ×1.3',
    },
    {
      id: 'kongmiao_bow', kind: 'culture', x: 161.4, z: -6.2,
      name: '孔氏南宗家庙 · 棂星门', actionLabel: '棂星门行礼瞻仰', shortLabel: '行礼', cost: 0, firstBonus: 60,
      buff: { id: 'blessing', name: '南孔清韵', icon: '◈', duration: 90, walkMult: 1.12, nitroRegenMult: 1.35, driftMult: 1.15 },
      speaker: '南孔礼乐',
      line: '“有礼衢州，南孔圣地。”古柏清风拂过棂星门，心境澄明安然。',
      toastBody: '90 秒内步行轻快 +12%、氮气回充 ×1.35',
    },
    {
      id: 'belltower_ring', kind: 'bell', x: 33.0, z: -92.4,
      name: '衢州钟楼 · 古铜钟', actionLabel: '登楼鸣响古铜钟', shortLabel: '鸣钟', cost: 0, firstBonus: 60,
      speaker: '衢州钟楼',
      line: '悠扬钟声越过北门街与钟楼底，街巷行人驻足侧耳倾听。',
      toastBody: '古铜钟连鸣三声，周遭街巷行人纷纷驻足聆听',
    },
    {
      id: 'xinan_lantern', kind: 'lantern', x: 330.6, z: 148.5,
      name: '信安湖 · 祈福放灯', actionLabel: '放飞祈福孔明灯', shortLabel: '放灯', cost: 0, firstBonus: 80,
      buff: { id: 'lantern_wish', name: '灯影伴行', icon: '✦', duration: 90, walkMult: 1.12, nitroRegenMult: 1.40, driftMult: 1.25 },
      speaker: '信安湖灯舫',
      line: '一盏祈福孔明灯乘着晚风升入星河，愿南孔古城岁岁长安。',
      toastBody: '90 秒内步行 +12%、氮气回充 ×1.4、漂移积分 ×1.25',
    },
  ];
  const REST_AMBIENTS = [
    { id: 'lake', name: '湖风细浪', desc: '信安湖微风拂水，木栈波声轻漾。' },
    { id: 'tea', name: '茶肆沸香', desc: '老街茶肆铜壶微沸，细浪伴盏轻响。' },
    { id: 'temple', name: '古刹松磬', desc: '古柏松涛舒缓呼吸，远寺铜磬余韵轻传。' },
    { id: 'rain', name: '青瓦檐雨', desc: '细雨轻落青瓦檐阶，滴答绵延涤静心尘。' },
    { id: 'off', name: '氛围静音', desc: '关闭休憩白噪音，静听古城原生街景。' },
  ];
  const REST_SPOTS = [
    {
      id: 'rest_xinan_lake',
      name: '信安湖亲水木椅',
      district: '信安湖亲水步道',
      ambient: 'lake',
      x: 325.8, z: 132.4,
      seatX: 325.88, seatZ: 132.4,
      exitX: 327.08, exitZ: 132.4,
      yaw: Math.PI / 2,
      seatY: 0.50,
      camPitch: 0.04,
      camOrbit: 0.18,
      style: 'wood',
      existingBench: true,
      poem: '临湖微风拂过亲水栈桥，远眺严家淤灯塔与水面流霞。',
    },
    {
      id: 'rest_shuitingmen',
      name: '水亭门临江石凳',
      district: '水亭门古街',
      ambient: 'lake',
      x: -160.0, z: -92.0,
      seatX: -160.07, seatZ: -91.96,
      exitX: -161.05, exitZ: -91.32,
      yaw: -0.993,
      seatY: 0.48,
      camPitch: 0.14,
      camOrbit: -0.18,
      style: 'stone',
      existingBench: false,
      poem: '青石古凳映城楼重檐，静听衢江晚风与三街七巷灯火。',
    },
    {
      id: 'rest_kongmiao',
      name: '南孔家庙古柏石凳',
      district: '孔氏南宗家庙',
      ambient: 'temple',
      x: 150.0, z: -6.0,
      seatX: 150.05, seatZ: -6.07,
      exitX: 150.72, exitZ: -7.02,
      yaw: 2.531,
      seatY: 0.48,
      camPitch: 0.10,
      camOrbit: -0.22,
      style: 'stone',
      existingBench: false,
      poem: '红墙金瓦映古柏疏影，棂星门前清风徐来心境自澄。',
    },
    {
      id: 'rest_fushan',
      name: '府山公园松影长椅',
      district: '府山公园',
      ambient: 'temple',
      x: 169.0, z: 91.0,
      seatX: 169.06, seatZ: 90.94,
      exitX: 169.88, exitZ: 90.12,
      yaw: 2.356,
      seatY: 0.49,
      camPitch: 0.18,
      camOrbit: -0.20,
      style: 'wood',
      existingBench: false,
      poem: '香樟松影斜落石阶，抬头可见五层钟灵塔静立云端。',
    },
    {
      id: 'rest_belltower',
      name: '衢州钟楼听钟长椅',
      district: '县西街 · 钟楼底',
      ambient: 'tea',
      x: 46.0, z: -90.0,
      seatX: 45.95, seatZ: -90.06,
      exitX: 45.15, exitZ: -90.92,
      yaw: -2.393,
      seatY: 0.49,
      camPitch: 0.15,
      camOrbit: -0.22,
      style: 'wood',
      existingBench: false,
      poem: '古轴街口车马川流，坐看双层铜钟阁静候整点钟声。',
    },
    {
      id: 'rest_mazhandi',
      name: '马站底茶肆歇脚椅',
      district: '马站底 · 上下街',
      ambient: 'tea',
      x: 90.0, z: 130.0,
      seatX: 89.93, seatZ: 129.97,
      exitX: 88.84, exitZ: 129.54,
      yaw: -1.947,
      seatY: 0.49,
      camPitch: 0.08,
      camOrbit: -0.24,
      style: 'wood',
      existingBench: false,
      poem: '老街食坊炊烟袅袅，暂歇脚步细品古城满巷烟火气。',
    },
  ];
  const STREET_EVENTS = [
    {
      id: 'ev_duck_express', kind: 'courier', name: '马站底热卤急件',
      speaker: '马站底老摊主', x: 96.5, z: 124.0, destX: -152.4, destZ: -75.4, destName: '水亭门茶肆',
      timeLimit: 72, reward: 180, bonus: 50,
      hailLine: '小伙子帮个忙！这锅刚卤好的三头一掌急着送去水亭门茶肆，趁热给赏钱！',
      acceptLine: '太感谢啦！72 秒内送到水亭门城楼前，保热送到另加 ¥50 急件赏！',
      completeLine: '鸭头还冒着热气呢，真是雪中送炭，这笔跑腿费请收好！',
    },
    {
      id: 'ev_oven_delivery', kind: 'courier', name: '炭炉烤饼加急单',
      speaker: '府东街烤饼师傅', x: 256.0, z: 128.0, destX: 157.6, destZ: 1.7, destName: '南孔家庙牌坊口',
      timeLimit: 60, reward: 160, bonus: 45,
      hailLine: '刚出炉的梅干菜烤饼！有位客人等在孔氏南宗家庙口，能不能顺路帮送一下？',
      acceptLine: '油纸包好啦！60 秒内送去南孔家庙牌坊口，酥脆送达加 ¥45 奖金！',
      completeLine: '烤饼外皮还脆着呢！谢啦，这份加急单酬劳给你！',
    },
    {
      id: 'ev_rain_lift', kind: 'ride', name: '雨夜顺风车', preferRain: true, preferNight: true,
      speaker: '礼贤街赶路市民', x: -94.3, z: 164.0, destX: 52.2, destZ: -81.4, destName: '衢州钟楼 · 北门街',
      timeLimit: 85, reward: 200, bonus: 50,
      hailLine: '师傅顺路吗？急着回衢州钟楼北门街，能不能搭个顺风车？',
      acceptLine: '多谢搭把手！送到衢州钟楼北门街就行，开稳点有额外小费。',
      completeLine: '一路又快又稳，可算赶上回家啦，这点心意请一定收下！',
    },
    {
      id: 'ev_lake_lift', kind: 'ride', name: '信安湖顺风车', preferNight: true,
      speaker: '南孔老茶客', x: 157.6, z: 1.7, destX: 274.0, destZ: 170.0, destName: '信安湖东岸栈道口',
      timeLimit: 75, reward: 190, bonus: 45,
      hailLine: '朋友顺路去信安湖东岸吗？想赶着晚风去湖边看灯，搭一程行不？',
      acceptLine: '真热心！带我到信安湖东岸栈道口就行，路上别颠簸，到了给茶水费。',
      completeLine: '正好赶上湖风最舒服的时候！多谢相送，酬劳请收好！',
    },
    {
      id: 'ev_photo_shuiting', kind: 'photo', name: '旅拍摄影委托 · 水亭门', photoSpotId: 'photo_shuiting',
      speaker: '水亭街旅拍摄影师', x: -75.2, z: -95.9, destX: -152.4, destZ: -75.4, destName: '水亭门城楼取景位',
      timeLimit: 0, reward: 220, bonus: 0,
      hailLine: '嗨！我腿脚有点累，能帮我去水亭门城楼拍一张明信片构图吗？稿费 ¥220！',
      acceptLine: '拜托你啦！到水亭门城楼前按 P 进拍照模式，框住城楼按空格就能交稿！',
      completeLine: '飞檐和城墙构图太绝了！这就是我要的古城味道，稿费 ¥220 已结清！',
    },
    {
      id: 'ev_photo_kongmiao', kind: 'photo', name: '旅拍摄影委托 · 南孔家庙', photoSpotId: 'photo_kongmiao',
      speaker: '钟楼底写生画师', x: 52.2, z: -81.4, destX: 157.6, destZ: 1.7, destName: '孔氏南宗家庙取景位',
      timeLimit: 0, reward: 220, bonus: 0,
      hailLine: '请问方便帮个忙吗？我想画南孔家庙红墙，能帮我拍张实景参考照吗？',
      acceptLine: '太好了！到孔氏南宗家庙按 P 打开拍照模式，框住红墙古柏按空格交稿！',
      completeLine: '红墙古柏的光影抓得太准了，画稿有参考啦！这 ¥220 酬劳请收好！',
    },
  ];

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function rng(seed) {
    return () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  function nearest(values, pos) {
    return values.reduce((best, value) => Math.abs(value - pos) < Math.abs(best - pos) ? value : best);
  }
  function nearestRoad(x, z) {
    if (Y) return Y.nearestRoad(x, z);
    const nx = nearest(X, x);
    const nz = nearest(Z, z);
    return Math.abs(nx - x) < Math.abs(nz - z) ? { x: nx, z, axis: 'z' } : { x, z: nz, axis: 'x' };
  }
  function routeBetween(a, b) {
    if (Y) return Y.routeBetween(a, b);
    return [a, b];
  }
  function district(p) {
    if (Y) return Y.districtOf(p);
    return '衢州古城';
  }

  function finishBuild(steps) {
    let step = steps.next();
    while (!step.done) step = steps.next();
    return step.value;
  }
  function build(scene) {
    return finishBuild(buildSteps(scene));
  }
  function* buildSteps(scene, instancePaint = false) {
    const random = rng(48327);
    const range = (low, high) => low + random() * (high - low);
    const choose = values => values[Math.floor(random() * values.length)];
    const unit = new T.BoxGeometry(1, 1, 1);
    const plane = new T.PlaneGeometry(1, 1);
    const cylinder = new T.CylinderGeometry(.5, .5, 1, 10);
    const tapered = new T.CylinderGeometry(.31, .5, 1, 8);
    const lowSphere = new T.IcosahedronGeometry(.5, 1);
    const batches = new Map();
    const streetBatches = [];
    const closeStreetBatches = [];
    const dummy = new T.Object3D();
    const obstacles = new Map();
    const surfaces = new Map();
    const shelters = [];
    const contactCasters = [];
    const shadeSize = 384, shadeOrigin = -340, shadeSpan = 700;
    const shadePixels = new Uint8Array(shadeSize * shadeSize * 4).fill(255);
    const streetShade = new T.DataTexture(shadePixels, shadeSize, shadeSize, T.RGBAFormat);
    streetShade.name = 'Static street contact shading';
    streetShade.minFilter = streetShade.magFilter = T.LinearFilter;
    const footprints = [];
    const signMaterials = new Map();
    const nightMaterials = [];
    const fixtures = [];
    let trafficLayout = null;
    let boulevard = false;
    const roadReflection = {
      image: { value: null },
      projection: { value: new T.Matrix4() },
      strength: { value: 0 },
      waterStrength: { value: 0 },
    };
    const wet = { value: .02 };
    const raining = { value: 0 };
    const weatherTime = { value: 0 };
    const surfaceDetail = { value: 1 };
    const roadSun = { value: new T.Vector3(.48, .66, -.78).normalize() };
    const roadTint = { value: new T.Color('#fff4df') };
    const roadSky = { value: new T.Color('#3487d6') };
    const roadHorizon = { value: new T.Color('#d0e7f7') };
    const textureLoader = new T.TextureLoader();
    const textures = {};
    const windowPhotoReady = { value: 0 };
    const assetPaths = {
      asphalt: 'assets/pbr/asphalt_albedo.webp', 'asphalt-normal': 'assets/pbr/asphalt_normal.webp',
      pavement: 'assets/pbr/bluestone_albedo.webp', 'pavement-normal': 'assets/pbr/bluestone_normal.webp',
      plaster: 'assets/quzhou-plaster.webp', 'plaster-normal': 'assets/pbr/plaster_normal.webp', metal: 'assets/quzhou-tile-wood.webp',
    };

    function surfaceTexture(name, srgb) {
      if (textures[name]) return textures[name];
      const texture = textureLoader.load(assetPaths[name]);
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
      texture.anisotropy = 16;
      textures[name] = texture;
      return texture;
    }
    function windowPhoto() {
      if (!textures.windows) {
        textures.windows = textureLoader.load('assets/quzhou-windows.webp', () => { windowPhotoReady.value = 1; });
        textures.windows.colorSpace = T.SRGBColorSpace;
        textures.windows.anisotropy = 4;
      }
      return textures.windows;
    }

    const mat = (color, extra) => new T.MeshStandardMaterial({ color, roughness: .86, envMapIntensity: .32, ...extra });
    const palette = (colors, extra) => colors.map(color => mat(color, extra));
    const asphalt = mat('#32373e', { roughness: .84, envMapIntensity: .36 });
    const roadMark = mat('#d8d5c9', { roughness: .90, envMapIntensity: .26 });
    const roadGold = mat('#d6ae52', { roughness: .88, envMapIntensity: .28 });
    const seams = mat('#3f484b');
    const cement = mat('#848078', { roughness: .89, envMapIntensity: .28 });
    const curb = mat('#cec2b4');
    const boardwalk = mat('#b6947c');
    const boardSeam = mat('#8c7263');
    const grass = mat('#4e7b44', { roughness: .94, envMapIntensity: .22 });
    const soil = mat('#876a55');
    const steel = mat('#45515c', { metalness: .36 });
    const steelPale = mat('#94b0ae', { metalness: .16 });
    const trim = mat('#d6c4b2');
    const brick = mat('#aa735e');
    const roof = mat('#676c72');
    const door = mat('#3d5e66');
    const white = mat('#f7eedf');
    const rust = mat('#bd6254');
    const tar = mat('#505763');
    const gold = mat('#e6b368');
    const parkWater = mat('#49b8bf', { metalness: .32, roughness: .24 });
    function weatherSurface(material, pattern, size = 2, normalMap = null) {
      const isAsphalt = pattern === 'asphalt';
      const isWall = pattern === 'plaster' || pattern === 'metal';
      const albedo = pattern === 'timber' ? null : surfaceTexture(pattern, true);
      const detail = normalMap ? surfaceTexture(normalMap, false) : (pattern === 'plaster' ? surfaceTexture('plaster-normal', false) : null);
      material.customProgramCacheKey = () => 'baixi-weather-' + pattern + '-' + size + '-' + (normalMap || '');
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, { baixiWet: wet, baixiRain: raining, baixiTime: weatherTime, baixiSun: roadSun, baixiDetail: surfaceDetail,
          streetShade: { value: streetShade },
          baixiSunColor: roadTint, baixiAlbedo: { value: albedo }, baixiNormalMap: { value: detail } });
        if (isAsphalt) Object.assign(shader.uniforms, { roadMirror: roadReflection.image, mirrorProject: roadReflection.projection,
          mirrorStrength: roadReflection.strength, roadSky, roadHorizon });
        shader.vertexShader = 'varying vec3 vBaixiPosition,vBaixiFacing;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', [
          '#include <worldpos_vertex>',
          'vec4 baixiPosition = vec4(transformed,1.0);',
          '#ifdef USE_INSTANCING',
          '  baixiPosition = instanceMatrix * baixiPosition;',
          '#endif',
          'vBaixiPosition = (modelMatrix * baixiPosition).xyz;',
          'vBaixiFacing = inverseTransformDirection(normalize(transformedNormal),viewMatrix);',
        ].join('\n'));
        shader.fragmentShader = [
          'varying vec3 vBaixiPosition,vBaixiFacing;',
          'uniform float baixiWet,baixiRain,baixiTime,baixiDetail; uniform sampler2D streetShade;',
          'uniform vec3 baixiSun,baixiSunColor;',
          isAsphalt ? 'uniform sampler2D roadMirror; uniform mat4 mirrorProject; uniform float mirrorStrength; uniform vec3 roadSky,roadHorizon;' : '',
          albedo ? 'uniform sampler2D baixiAlbedo;' : '',
          detail ? 'uniform sampler2D baixiNormalMap;' : '',
          'float saltNoise(vec2 v){ vec3 a = fract(vec3(v.xyx) * vec3(.1031,.0973,.1099)); a += dot(a,a.yzx+33.33); return fract((a.x+a.y)*a.z); }',
          'float tideNoise(vec2 p){vec2 f=fract(p),k=f*f*(3.-2.*f),i=floor(p);return mix(mix(saltNoise(i),saltNoise(i+vec2(1,0)),k.x),mix(saltNoise(i+vec2(0,1)),saltNoise(i+1.),k.x),k.y);}',
          shader.fragmentShader.replace('#include <color_fragment>', [
            '#include <color_fragment>',
            'vec2 surface = vBaixiPosition.xz;',
            'vec3 face = abs(normalize(vBaixiFacing));',
            'vec2 surfaceUV = surface/' + size.toFixed(2) + ';',
            'float stain = tideNoise(surface*.24);',
            'float detailFade = 0.0, pores = .12*(stain-.5);',
            'if(baixiDetail>.5){',
            '  detailFade = 1.0-smoothstep(.07,.65,max(length(dFdx(surface)),length(dFdy(surface))));',
            '  float fleck = saltNoise(floor(surface*31.0)), grain = saltNoise(floor(surface*2.6));',
            '  pores += (grain*.11+fleck*.13-.12)*detailFade;',
            '}',
            isWall ? [
              'vec3 p = vBaixiPosition/' + size.toFixed(2) + ';',
              'vec3 detailCol;',
              'if(baixiDetail>.5){',
              '  vec3 planar = pow(face,vec3(6.0)); planar /= dot(planar,vec3(1.));',
              '  detailCol = texture2D(baixiAlbedo,p.yz).rgb*planar.x + texture2D(baixiAlbedo,p.xz).rgb*planar.y + texture2D(baixiAlbedo,p.xy).rgb*planar.z;',
              '}else{',
              '  vec2 uv = face.y>max(face.x,face.z) ? p.xz : face.x>face.z ? p.yz : p.xy;',
              '  detailCol = texture2D(baixiAlbedo,uv).rgb;',
              '}',
              'float wallSeaLevel = .89+.11*smoothstep(.18,2.5,vBaixiPosition.y);',
              'diffuseColor.rgb *= wallSeaLevel * mix(.75,1.23,smoothstep(.10,.65,dot(detailCol,vec3(.21,.72,.07))));',
            ].join('\n') : albedo ? [
              'vec3 detailCol = texture2D(baixiAlbedo,surfaceUV).rgb;',
              'float aggregate = dot(detailCol,vec3(.21,.72,.07));',
              'float macroVar = tideNoise(surface*.055)*.62 + tideNoise(surface*.17)*.38;',
              isAsphalt
                ? 'diffuseColor.rgb = mix(diffuseColor.rgb * mix(.68,1.34,smoothstep(.03,.34,aggregate)), detailCol * 1.18, .42) * (.86 + .28*macroVar);'
                : 'vec2 tileF = abs(fract(surface*.85) - .5); float joint = smoothstep(.465, .495, max(tileF.x, tileF.y)); diffuseColor.rgb = mix(diffuseColor.rgb * mix(.70,1.30,smoothstep(.06,.56,aggregate)), detailCol * .96, .50) * (.86 + .26*macroVar) * (1.0 - joint*.26*detailFade);',
            ].join('\n') : '',
            'float pooled = baixiDetail>.5 ? tideNoise(surface*vec2(.20,.39))*.66+tideNoise(surface*.82)*.26+tideNoise(surface*3.1)*.08 : mix(stain,.52,.10);',
            'float puddle = baixiWet*smoothstep(.43,.76,pooled)*pow(face.y,4.0);',
            'float contact = texture2D(streetShade,(surface-vec2(' + shadeOrigin.toFixed(1) + '))/' + shadeSpan.toFixed(1) + ').r;',
            'diffuseColor.rgb *= mix(contact,1.0,smoothstep(.35,3.2,vBaixiPosition.y));',
            'diffuseColor.rgb *= (1.0 + pores)*(1.0-puddle*' + (isAsphalt ? '.36' : '.20') + ');',
          ].join('\n')).replace('#include <roughnessmap_fragment>', [
            '#include <roughnessmap_fragment>',
            isAsphalt
              ? 'roughnessFactor = clamp(roughnessFactor * (.84 + .30*stain) * (1.0 - puddle*.82), .06, .96);'
              : 'roughnessFactor = clamp(roughnessFactor * (.88 + .24*stain) * (1.0 - puddle*.46), .18, .98);',
          ].join('\n')).replace('#include <normal_fragment_maps>', [
            '#include <normal_fragment_maps>',
            detail ? [
              'if(baixiDetail>.5){',
              isWall ? [
                '  vec2 wuv = face.x>face.z ? vBaixiPosition.yz : vBaixiPosition.xy;',
                '  vec2 grit = texture2D(baixiNormalMap,wuv/' + size.toFixed(2) + ').xy*2.0-1.0;',
                '  vec3 tangX = transformDirection(face.x>face.z ? vec3(0,0,1) : vec3(1,0,0),viewMatrix);',
                '  vec3 tangY = transformDirection(vec3(0,1,0),viewMatrix);',
                '  normal = normalize(normal+(tangX*grit.x+tangY*grit.y)*.32*detailFade);',
              ].join('\n') : [
                '  vec2 grit = texture2D(baixiNormalMap,surfaceUV).xy*2.0-1.0;',
                '  vec3 surfaceX = transformDirection(vec3(1,0,0),viewMatrix);',
                '  vec3 surfaceZ = transformDirection(vec3(0,0,1),viewMatrix);',
                '  normal = normalize(normal+(surfaceX*grit.x+surfaceZ*grit.y)*(' + (isAsphalt ? '.64-.46*puddle' : '.58-.32*puddle') + ')*face.y*(.25+.75*detailFade));',
              ].join('\n'),
              '}',
            ].join('\n') : '',
          ].join('\n')).replace('#include <emissivemap_fragment>', [
            '#include <emissivemap_fragment>',
            isAsphalt ? [
              'vec3 eye = normalize(cameraPosition-vBaixiPosition);',
              'vec3 glintNormal = normalize(vec3((stain-.5)*.13,1.,(pooled-.5)*.10));',
              'float angle = pow(1.0-max(0.,eye.y),3.2);',
              'float shine = pow(max(0.,dot(reflect(-baixiSun,glintNormal),eye)),18.);',
              'float ripple = baixiDetail>.5 ? sin(length(fract(surface*1.77)-.5)*35.0-baixiTime*11.0) : 0.0;',
              'float brine = angle*(.14+stain*.34)+.95*shine;',
              'totalEmissiveRadiance += baixiSunColor*puddle*brine*.26*(1.+ripple*.11*baixiRain*detailFade);',
              'if(mirrorStrength>.01){',
              '  vec4 reflected = mirrorProject*vec4(vBaixiPosition,1.);',
              '  vec2 at = reflected.xy/max(.01,reflected.w);',
              '  float edgeFade = smoothstep(.012,.109,min(min(at.x,at.y),1.0-max(at.x,at.y)))*step(.02,reflected.w);',
              '  float wash = tideNoise(surface*.58+vec2(.8,4.9));',
              '  vec2 perturb = vec2(stain-.5,wash-.5) * (.007+baixiRain*.008) + vec2(ripple,-ripple)*baixiRain*.0014*detailFade;',
              '  float mirrorPuddle = smoothstep(.53,.74,pooled);',
              '  float blurBias = 1.65*(1.-mirrorPuddle)+baixiRain*.58;',
              '  vec3 reflectedLight = texture2D(roadMirror,clamp(at+perturb,.001,.999),blurBias).rgb;',
              '  float glaze = (.26+.74*angle)*baixiWet*mirrorStrength*edgeFade*(.065+.62*mirrorPuddle);',
              '  totalEmissiveRadiance += reflectedLight*glaze*vec3(.92,.98,1.0);',
              '} else {',
              '  vec3 skyGlaze = mix(roadHorizon,roadSky,clamp(.33+eye.y*.48+(1.-pooled)*.12,0.,1.));',
              '  totalEmissiveRadiance += skyGlaze * angle * (.028*baixiWet+.30*puddle);',
              '}',
            ].join('\n') : '',
          ].join('\n')),
        ].join('\n');
      };
    }
    weatherSurface(asphalt, 'asphalt', 2.65, 'asphalt-normal');
    weatherSurface(cement, 'pavement', 1.8, 'pavement-normal');
    weatherSurface(boardwalk, 'timber', 2.4);
    grass.customProgramCacheKey = () => 'baixi-photoreal-grass';
    grass.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { streetShade: { value: streetShade }, grassWet: wet });
      shader.vertexShader = 'varying vec3 vGrassPos;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', [
        '#include <worldpos_vertex>',
        'vec4 gPos = vec4(transformed,1.0);',
        '#ifdef USE_INSTANCING',
        '  gPos = instanceMatrix * gPos;',
        '#endif',
        'vGrassPos = (modelMatrix * gPos).xyz;',
      ].join('\n'));
      shader.fragmentShader = [
        'varying vec3 vGrassPos; uniform sampler2D streetShade; uniform float grassWet;',
        'float gHash(vec2 v){ vec3 a = fract(vec3(v.xyx)*vec3(.1031,.0973,.1099)); a += dot(a,a.yzx+33.33); return fract((a.x+a.y)*a.z); }',
        'float gNoise(vec2 p){ vec2 f=fract(p),k=f*f*(3.-2.*f),i=floor(p); return mix(mix(gHash(i),gHash(i+vec2(1,0)),k.x),mix(gHash(i+vec2(0,1)),gHash(i+1.),k.x),k.y); }',
        shader.fragmentShader.replace('#include <color_fragment>', [
          '#include <color_fragment>',
          'vec2 gp = vGrassPos.xz;',
          'float meadow = gNoise(gp*.065)*.55 + gNoise(gp*.21)*.30 + gNoise(gp*.68)*.15;',
          'float patchDry = smoothstep(.56,.86,gNoise(gp*.09 + vec2(4.1,-2.7)));',
          'float blades = gNoise(gp*4.8)*.55 + gHash(floor(gp*16.0))*.45;',
          'float gFade = 1.0 - smoothstep(.05,.55,max(length(dFdx(gp)),length(dFdy(gp))));',
          'vec3 lush = vec3(.22,.39,.17); vec3 olive = vec3(.36,.47,.21); vec3 dryStraw = vec3(.47,.44,.25);',
          'vec3 turf = mix(lush, olive, smoothstep(.22,.78,meadow));',
          'turf = mix(turf, dryStraw, patchDry * .42);',
          'turf *= .84 + .32 * mix(.5, blades, .35 + .65*gFade);',
          'float gContact = texture2D(streetShade,(gp-vec2(' + shadeOrigin.toFixed(1) + '))/' + shadeSpan.toFixed(1) + ').r;',
          'diffuseColor.rgb = turf * mix(.55, 1.0, gContact) * (1.0 - grassWet*.14);',
        ].join('\n')).replace('#include <normal_fragment_maps>', [
          '#include <normal_fragment_maps>',
          'vec2 gN = vec2(gNoise(vGrassPos.xz*7.5)-.5, gNoise(vGrassPos.xz*7.5+vec2(3.7,8.2))-.5);',
          'vec3 gx = transformDirection(vec3(1,0,0),viewMatrix);',
          'vec3 gz = transformDirection(vec3(0,0,1),viewMatrix);',
          'normal = normalize(normal + (gx*gN.x + gz*gN.y) * .45 * gFade);',
        ].join('\n')),
      ].join('\n');
    };
    const shopColors = palette(['#be6d61', '#779d96', '#a47e65', '#6c779e', '#4b9296', '#c68b72']);
    const cityColors = palette(['#d6c2aa', '#c9aba0', '#bcc8c6', '#cec8be', '#d8d0b6', '#c68f82', '#a8b6c0', '#dfb08f']);
    const towerColors = palette(['#82a2b2', '#879ab4', '#9fa5b4', '#a8bfb9', '#b8b0bd', '#8e9ea9']);
    for (const coating of cityColors) weatherSurface(coating, 'plaster', 2);
    weatherSurface(steelPale, 'metal', 1.8);
    const leafColors = palette(['#4f8e4d', '#609c4e', '#74ad54', '#8ec266']);
    const trunk = mat('#8d7562');
    const bark = mat('#756455');
    const rootGrate = mat('#414c48', { metalness: .43 });
    const glass = palette(['#4f748d', '#628397', '#537b86', '#618ba1'], { metalness: .30, roughness: .32 });
    const lightGlass = palette(['#d0a86d', '#e0bc81', '#a7bcb1'], { roughness: .61 });
    for (const m of lightGlass) {
      m.emissive.copy(m.color);
      nightMaterials.push([m, 2.25]);
    }
    const containerMats = palette(['#bd6955', '#658788', '#565e80', '#a99164', '#a5a491', '#75795c']);
    const lampBulb = mat('#f9dfb5', { emissive: '#ffbb66', emissiveIntensity: .55 });
    nightMaterials.push([lampBulb, 3.6]);
    const tealBulb = mat('#a8f5dd', { emissive: '#52f3cf', emissiveIntensity: .8 });
    nightMaterials.push([tealBulb, 3.8]);
    const softLamp = document.createElement('canvas');
    softLamp.width = softLamp.height = 96;
    const lampContext = softLamp.getContext('2d');
    const poolGradient = lampContext.createRadialGradient(48, 48, 0, 48, 48, 48);
    poolGradient.addColorStop(0, '#ffffffff');
    poolGradient.addColorStop(.42, '#ffffff82');
    poolGradient.addColorStop(1, '#ffffff00');
    lampContext.fillStyle = poolGradient;
    lampContext.fillRect(0, 0, 96, 96);
    const lampPool = new T.MeshBasicMaterial({ color: '#e5ac6f', map: new T.CanvasTexture(softLamp),
      transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
    const reflectedLamp = lampPool.clone();
    reflectedLamp.color.set('#f7c28d');
    const contactShade = new T.MeshBasicMaterial({ color: '#192426', map: lampPool.map,
      transparent: true, opacity: .46, depthWrite: false });

    function queue(geo, material, x, y, z, w, h, d, yaw = 0, pitch = 0, roll = 0) {
      const architecture = geo === unit && h > 2.3 && Math.min(w, d) > 1.25;
      const scenic = boulevard && geo !== plane && (geo !== unit || (Math.min(w, h, d) > .22 && Math.max(w, h, d) > 1.8));
      const casts = material.isMeshStandardMaterial && !material.transparent && material.userData.castShadow !== false && (architecture || scenic || material.userData.castShadow === true);
      const narrowTrim = geo === unit && Math.min(w, h, d) < .145 && Math.max(w, h, d) < 3.8;
      const tinyDecal = geo === plane && pitch === -Math.PI / 2 && w * h < .13;
      const detail = geo.userData.closeStreet === true || (!casts && !material.transparent && (narrowTrim || tinyDecal));
      const id = geo.id + ':' + material.id + (casts ? ':shadow' : '');
      if (!batches.has(id)) batches.set(id, { geo, material, casts, core: [], detail: [] });
      dummy.position.set(x, y, z);
      dummy.scale.set(w, h, d);
      dummy.rotation.set(pitch, yaw, roll, 'YXZ');
      dummy.updateMatrix();
      batches.get(id)[detail ? 'detail' : 'core'].push(dummy.matrix.clone());
    }
    const box = (m, x, y, z, w, h, d, yaw, pitch, roll) => queue(unit, m, x, y, z, w, h, d, yaw, pitch, roll);
    const pole = (m, x, y, z, w, h, d = w) => queue(cylinder, m, x, y, z, w, h, d);
    function ground(m, x, z, w, d, y = .035, yaw = 0) {
      queue(plane, m, x, y, z, w, d, 1, yaw, -Math.PI / 2);
    }
    function bar(m, ax, ay, az, bx, by, bz, width, depth = width) {
      const a = new T.Vector3(ax, ay, az);
      const b = new T.Vector3(bx, by, bz);
      const difference = b.clone().sub(a);
      const orientation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), difference.clone().normalize());
      const angles = new T.Euler().setFromQuaternion(orientation, 'YXZ');
      box(m, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, width, difference.length(), depth, angles.y, angles.x, angles.z);
    }
    function indexBox(grid, item) {
      for (let gx = Math.floor(item.left / 40); gx <= Math.floor(item.right / 40); gx++) {
        if (!grid.has(gx)) grid.set(gx, new Map());
        const column = grid.get(gx);
        for (let gz = Math.floor(item.top / 40); gz <= Math.floor(item.bottom / 40); gz++) {
          if (!column.has(gz)) column.set(gz, []);
          column.get(gz).push(item);
        }
      }
    }
    function solid(x, z, w, d, height = 6, visibleOnMap = true, minY = 0) {
      const item = { x, z, w, d, height, minY, left: x - w / 2, right: x + w / 2, top: z - d / 2, bottom: z + d / 2 };
      indexBox(obstacles, item);
      if (visibleOnMap) footprints.push(item);
      if (minY < .35 && height > 2.4 && w * d > 3) contactCasters.push(item);
    }
    function* bakeStreetShade() {
      // Store broad, soft contact shadows once. Runtime cost stays one filtered ground sample.
      const texels = shadeSize / shadeSpan;
      for (let i = 0; i < contactCasters.length; i++) {
        const box = contactCasters[i];
        const reach = clamp(box.height * .21, 1.9, 5.4);
        const x1 = Math.max(0, Math.floor((box.left - reach - shadeOrigin) * texels));
        const x2 = Math.min(shadeSize - 1, Math.ceil((box.right + reach - shadeOrigin) * texels));
        const z1 = Math.max(0, Math.floor((box.top - reach - shadeOrigin) * texels));
        const z2 = Math.min(shadeSize - 1, Math.ceil((box.bottom + reach - shadeOrigin) * texels));
        for (let z = z1; z <= z2; z++) {
          const wz = shadeOrigin + (z + .5) / texels;
          const dz = Math.max(box.top - wz, 0, wz - box.bottom);
          for (let x = x1; x <= x2; x++) {
            const wx = shadeOrigin + (x + .5) / texels;
            const dx = Math.max(box.left - wx, 0, wx - box.right);
            const weight = Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz) / reach);
            const pixel = (z * shadeSize + x) * 4;
            shadePixels[pixel] = Math.min(shadePixels[pixel], 255 - Math.round(82 * weight * weight));
          }
        }
        if ((i & 31) === 31) yield;
      }
      contactCasters.length = 0;
      streetShade.needsUpdate = true;
    }
    function surface(x, z, w, d, height, slopeX = 0) {
      indexBox(surfaces, { left: x - w / 2, right: x + w / 2, top: z - d / 2, bottom: z + d / 2, x, height, slopeX });
    }
    function surfaceHeight(x, z) {
      const items = surfaces.get(Math.floor(x / 40))?.get(Math.floor(z / 40));
      let height = .023;
      if (items) for (const item of items) {
        if (x >= item.left && x <= item.right && z >= item.top && z <= item.bottom)
          height = Math.max(height, item.height + (x - item.x) * item.slopeX);
      }
      if (x > 331 && window.Tideline.marineWalkable?.(x, z)) height = Math.max(height, .22);
      return height;
    }
    function blockedAt(x, z, radius, height = 0) {
      for (let gx = Math.floor((x - radius) / 40); gx <= Math.floor((x + radius) / 40); gx++) {
        const column = obstacles.get(gx);
        if (!column) continue;
        for (let gz = Math.floor((z - radius) / 40); gz <= Math.floor((z + radius) / 40); gz++) {
          const items = column.get(gz);
          if (!items) continue;
          for (const item of items) {
            if (height < item.minY || height >= item.height) continue;
            const dx = x - clamp(x, item.left, item.right);
            const dz = z - clamp(z, item.top, item.bottom);
            if (dx * dx + dz * dz < radius * radius) return true;
          }
        }
      }
      return false;
    }
    // First contact along a segment, including thin walls and the undersides of raised floors.
    function clearFraction(ax, ay, az, bx, by, bz, radius) {
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const ix = dx ? 1 / dx : 0, iy = dy ? 1 / dy : 0, iz = dz ? 1 / dz : 0;
      const lastX = Math.floor((Math.max(ax, bx) + radius) / 40);
      const lastZ = Math.floor((Math.max(az, bz) + radius) / 40);
      const firstZ = Math.floor((Math.min(az, bz) - radius) / 40);
      let limit = 1;
      for (let gx = Math.floor((Math.min(ax, bx) - radius) / 40); gx <= lastX; gx++) {
        const column = obstacles.get(gx);
        if (!column) continue;
        for (let gz = firstZ; gz <= lastZ; gz++) {
          const items = column.get(gz);
          if (!items) continue;
          for (const box of items) {
            const left = box.left - radius, right = box.right + radius;
            const near = box.top - radius, far = box.bottom + radius;
            const floor = box.minY - radius, roof = box.height + radius;
            if ((!dx && (ax < left || ax > right)) || (!dy && (ay < floor || ay > roof)) ||
                (!dz && (az < near || az > far))) continue;
            const entry = Math.max(0, dx ? ((dx > 0 ? left : right) - ax) * ix : 0,
              dy ? ((dy > 0 ? floor : roof) - ay) * iy : 0, dz ? ((dz > 0 ? near : far) - az) * iz : 0);
            if (entry >= limit) continue;
            const exit = Math.min(1, dx ? ((dx > 0 ? right : left) - ax) * ix : 1,
              dy ? ((dy > 0 ? roof : floor) - ay) * iy : 1, dz ? ((dz > 0 ? far : near) - az) * iz : 1);
            if (entry <= exit) limit = entry;
          }
        }
      }
      return limit;
    }
    function collision(x, z, radius, height = 0) {
      const mainland = x >= BOUNDS.minX + radius && x <= BOUNDS.maxX - radius &&
        z >= BOUNDS.minZ + radius && z <= BOUNDS.maxZ - radius;
      if (!mainland && !window.Tideline.marineWalkable?.(x, z, radius)) return true;
      if (Y?.inAnyWater && Y.inAnyWater(x, z, Math.max(0, radius - .4)) && !Y.onAnyRoad(x, z, 1.5)) return true;
      return blockedAt(x, z, radius, height);
    }
    // Project the actual vehicle footprint onto both sets of box axes.
    function vehicleBlocked(x, z, yaw, width, length, height) {
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const sx = Math.abs(fx), sz = Math.abs(fz);
      const extentX = sz * width + sx * length, extentZ = sx * width + sz * length;
      if (x - extentX < BOUNDS.minX || x + extentX > BOUNDS.maxX || z - extentZ < BOUNDS.minZ || z + extentZ > BOUNDS.maxZ) {
        for (let side = -1; side <= 1; side += 2) {
          for (let end = -1; end <= 1; end += 2) {
            const px = x + side * fz * width + end * fx * length;
            const pz = z - side * fx * width + end * fz * length;
            if ((px < BOUNDS.minX || px > BOUNDS.maxX || pz < BOUNDS.minZ || pz > BOUNDS.maxZ) &&
                !window.Tideline.marineWalkable?.(px, pz)) return true;
          }
        }
      }
      if (Y?.inAnyWater && Y.inAnyWater(x, z, 0) && !Y.onAnyRoad(x, z, 1.6)) return true;
      for (let gx = Math.floor((x - extentX) / 40); gx <= Math.floor((x + extentX) / 40); gx++) {
        const column = obstacles.get(gx);
        if (!column) continue;
        for (let gz = Math.floor((z - extentZ) / 40); gz <= Math.floor((z + extentZ) / 40); gz++) {
          const items = column.get(gz);
          if (!items) continue;
          for (const item of items) {
            if (item.minY >= height) continue;
            const dx = x - item.x, dz = z - item.z, w = item.w * .5, d = item.d * .5;
            if (Math.abs(dx) < extentX + w && Math.abs(dz) < extentZ + d &&
                Math.abs(dx * fz - dz * fx) < width + sz * w + sx * d &&
                Math.abs(dx * fx + dz * fz) < length + sx * w + sz * d) return true;
          }
        }
      }
      return false;
    }
    function occluded(a, b, interval = 4, height = 1.8) {
      const length = distance(a, b);
      for (let t = interval; t < length - Math.min(2, interval); t += interval) {
        if (collision(a.x + (b.x - a.x) * t / length, a.z + (b.z - a.z) * t / length, .19, height)) return true;
      }
      return false;
    }

    function signTexture(label, detail, color) {
      const id = label + ':' + detail + ':' + color;
      if (signMaterials.has(id)) return signMaterials.get(id);
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#162a3a';
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 9, 128);
      ctx.fillRect(510, 0, 2, 128);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 51px "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif';
      ctx.fillText(label, 260, 47, 460);
      ctx.font = 'bold 19px monospace';
      ctx.fillStyle = '#d6e5d9';
      ctx.fillText(detail, 260, 96, 450);
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = 4;
      const material = new T.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#e0e5ff', emissiveIntensity: .38, roughness: .75 });
      nightMaterials.push([material, 1.8]);
      signMaterials.set(id, material);
      return material;
    }
    function sign(label, detail, color, x, y, z, w, h, yaw) {
      queue(plane, signTexture(label, detail, color), x, y, z, w, h, 1, yaw);
    }
    function fixture(x, y, z, color, intensity, range) {
      fixtures.push({ x, y, z, color: new T.Color(color), intensity, range });
    }
    const boulevardAssets = { T, scene, queue, box, ground, solid, surface, shelters, pavement: cement, signPlane: plane, sign, bar, pole, nightMaterials,
      streetLight, planter, deciduous, surfaceTexture, fixture, windowPhoto, windowPhotoReady, lampPool, contactShade };

    function streetLight(x, z, yaw = 0) {
      const dx = Math.sin(yaw);
      const dz = Math.cos(yaw);
      pole(steel, x, 2.6, z, .17, 5.2);
      pole(steelPale, x, .22, z, .34, .44);
      bar(steel, x, 5.02, z, x + dx * 1.26, 5.6, z + dz * 1.26, .14);
      box(steel, x + dx * 1.36, 5.61, z + dz * 1.36, .55, .19, 1.03, yaw);
      box(lampBulb, x + dx * 1.36, 5.48, z + dz * 1.36, .47, .10, .85, yaw);
      ground(lampPool, x + dx * 2.25, z + dz * 2.25, 7.3, 7.3, .22);
      ground(reflectedLamp, x + dx * 4.45, z + dz * 4.45, 5.7, 16.0, .043);
      fixture(x + dx * 1.36, 5.08, z + dz * 1.36, '#ffce97', 90, 19);
      solid(x, z, .26, .26, 5.25, false);
    }
    function bench(x, z, yaw = 0) {
      const dx = Math.sin(yaw);
      const dz = Math.cos(yaw);
      box(boardwalk, x, .55, z, 2.45, .12, .63, yaw);
      box(boardwalk, x + dx * .28, .95, z + dz * .28, 2.45, .34, .11, yaw);
      for (const side of [-1, 1]) box(steel, x + side * dz * .9, .34, z - side * dx * .9, .15, .47, .66, yaw);
      solid(x, z, Math.abs(dz) * 2.45 + Math.abs(dx) * .65, Math.abs(dx) * 2.45 + Math.abs(dz) * .65, 1.12, false);
    }
    function palmMap(width, height, draw) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      draw(canvas.getContext('2d'), width, height);
      const map = new T.CanvasTexture(canvas);
      map.colorSpace = T.SRGBColorSpace;
      map.anisotropy = 4;
      return map;
    }
    const palmInk = rng(751243);
    trunk.color.set('#e2d8bf');
    trunk.map = palmMap(128, 512, (ctx, w, h) => {
      const base = ctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, '#828452');
      base.addColorStop(.16, '#8b8165');
      base.addColorStop(.36, '#a0937f');
      base.addColorStop(.78, '#ac9b86');
      base.addColorStop(1, '#807568');
      ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 660; i++) {
        ctx.fillStyle = i % 3 ? '#493e3624' : '#dacbaf33';
        ctx.fillRect(palmInk() * w, palmInk() * h, .45 + palmInk(), 2 + palmInk() * 13);
      }
      for (let y = 4; y < h; y += 9 + palmInk() * 6) {
        const wave = palmInk() * Math.PI * 2;
        for (const [shift, ink, breadth] of [[0, '#554e419a', 2.0], [2.18, '#d1bea082', 1.35]]) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 4) {
            const at = y + shift + 1.31 * Math.sin(wave + x / w * Math.PI * 4) + .56 * Math.sin(x / w * Math.PI * 6);
            if (x) ctx.lineTo(x, at); else ctx.moveTo(x, at);
          }
          ctx.strokeStyle = ink; ctx.lineWidth = breadth; ctx.stroke();
        }
      }
    });
    const palmTrunk = new T.BufferGeometry();
    {
      const positions = [], uvs = [], indices = [];
      const rings = [[0, .268], [.095, .205], [.81, .141], [.95, .161], [1, .117]];
      for (const [level, [height, radius]] of rings.entries()) {
        for (let j = 0; j <= 8; j++) {
          const a = j * Math.PI / 4;
          const bend = Math.sin(Math.PI * height);
          positions.push(Math.cos(a) * radius + .064 * bend, height, Math.sin(a) * radius - .044 * bend);
          uvs.push(j / 8, height);
          if (level && j) {
            const n = level * 9 + j;
            indices.push(n - 10, n - 1, n, n - 10, n, n - 9);
          }
        }
      }
      const crown = (rings.length - 1) * 9;
      for (let j = 1; j < 7; j++) indices.push(crown, crown + j + 1, crown + j);
      palmTrunk.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      palmTrunk.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      palmTrunk.setIndex(indices);
      palmTrunk.computeVertexNormals();
    }
    const featherMap = palmMap(256, 512, (ctx, w, h) => {
      const green = ['#607e43','#759650','#557743','#8ca454','#718c46','#607c40'];
      for (let pair = 0; pair < 27; pair++) {
        for (const side of [-1, 1]) {
          const t = .012 + (pair + (side > 0 ? .42 : 0)) / 30;
          const y = (1 - t) * h, advance = (.13 - t * .049) * h;
          const span = (.394 + palmInk() * .099) * w;
          const root = w * .5 + side * .6;
          const tip = root + side * span;
          ctx.fillStyle = green[(pair + (side > 0 ? 2 : 0)) % green.length];
          ctx.beginPath(); ctx.moveTo(root, y + 1.9);
          ctx.bezierCurveTo(root + side * span * .22, y - 2, root + side * span * .64, y - advance * .64, tip, y - advance);
          ctx.bezierCurveTo(root + side * span * .70, y - advance * .70 + 9.5, root + side * span * .30, y - advance * .22 + 13.4, root, y + 4.0);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#a7a160'; ctx.beginPath(); ctx.moveTo(w * .479, h); ctx.lineTo(w * .501, 1); ctx.lineTo(w * .522, h); ctx.fill();
    });
    const frondMaterial = mat('#e3e9cd', { map: featherMap, alphaTest: .29, side: T.DoubleSide, roughness: .91 });
    const pinnaMaterial = mat('#dce4bb', { vertexColors: true, side: T.DoubleSide, roughness: .9 });
    const frond = new T.BufferGeometry();
    const pinnae = new T.BufferGeometry();
    const axis = t => [.036 * Math.sin(t * Math.PI), .22 * Math.sin(t * Math.PI) - .28 * t * t, t];
    {
      const positions = [], uvs = [], indices = [];
      for (const [row,t] of [0,.27,.56,.81,1].entries()) {
        const [x,y,z] = axis(t);
        const spread = .207 * Math.sin(t * Math.PI) ** .71;
        for (const side of [-1,0,1]) {
          positions.push(x + side * spread, y - Math.abs(side) * spread * (.27 + .29 * t), z + Math.abs(side) * .029 * Math.sin(t * Math.PI));
          uvs.push((side + 1) / 2, t);
        }
        if (!row) continue;
        for (let col = 0; col < 2; col++) {
          const a = (row - 1) * 3 + col;
          if (row !== 1) indices.push(a, a + 3, a + 1);
          if (row !== 4) indices.push(a + 1, a + 3, a + 4);
        }
      }
      frond.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      frond.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      frond.setIndex(indices);
      frond.computeVertexNormals();

      const points = [], colors = [];
      const dark = new T.Color('#526e3e'), green = new T.Color('#76954c'), straw = new T.Color('#909d58');
      function point(p, color) { points.push(...p); colors.push(color.r, color.g, color.b); }
      for (let pair = 0; pair < 8; pair++) for (const side of [-1,1]) {
        const t = .15 + (pair + (side > 0 ? .39 : 0)) * .092;
        const [x,y,z] = axis(t);
        const reach = (.19 + .048 * Math.cos(pair * 1.81 + side)) * Math.sin(t * Math.PI) ** .63;
        const drop = (.081 + pair * .0065) * Math.sin(t * Math.PI);
        const root = [x,y - .003,z];
        const ridge = [x + side * reach * .53,y - .019,z + .062];
        const edge = [x + side * reach * .50,y - .039,z + .095];
        const tip = [x + side * reach,y - drop,z + .158];
        point(root,dark); point(ridge,green); point(edge,dark);
        point(ridge,green); point(tip,straw); point(edge,dark);
      }
      pinnae.setAttribute('position', new T.Float32BufferAttribute(points,3));
      pinnae.setAttribute('color', new T.Float32BufferAttribute(colors,3));
      pinnae.computeVertexNormals();
      pinnae.userData.closeStreet = true;
    }
    for (const material of leafColors) material.side = T.DoubleSide;
    function palm(x, z, height = range(5.1, 8.7)) {
      const tilt = range(-.15, .15);
      const topX = x - Math.sin(tilt) * height * .46;
      const footX = x + Math.sin(tilt) * height * .38;
      const deck = surfaceHeight(footX, z);
      const dx = topX - footX;
      queue(palmTrunk, trunk, footX, deck, z, 1, Math.hypot(dx, height), 1, 0, 0, Math.atan2(-dx, height));
      solid(footX, z, .53, .53, height * .6, false);
      const start = range(0, Math.PI);
      const crown = deck + height;
      function leaf(span, angle, pitch, roll, y) {
        queue(frond, frondMaterial, topX, y, z, span, span, span, angle, pitch, roll);
        queue(pinnae, pinnaMaterial, topX, y, z, span, span, span, angle, pitch, roll);
      }
      for (let i = 0; i < 7; i++) {
        const spread = range(1.65, 3.27);
        const lift = random();
        const roll = range(-.08, .28);
        const upper = i === 1 || i === 4;
        const span = (.43 * height + spread * .26) * (upper ? .79 : 1);
        leaf(span,start + i * .897 + (lift - .5) * .16,upper ? -.46 - lift * .13 : .12 - lift * .16,roll - .10,crown + (upper ? .01 : -.06));
      }
      leaf(height * .32,start + .45,-.91,.13,crown + .013);
    }
    const treeRandom = rng(155927);
    const leafCard = document.createElement('canvas');
    leafCard.width = leafCard.height = 512;
    const leafInk = leafCard.getContext('2d');
    leafInk.strokeStyle = '#3a2f22';
    leafInk.lineCap = 'round';
    for (let b = 0; b < 7; b++) {
      const a = (b / 7) * Math.PI * 2 + (treeRandom() - .5) * .45;
      leafInk.lineWidth = 3.5 + treeRandom() * 3.5;
      leafInk.beginPath();
      leafInk.moveTo(256, 256);
      leafInk.quadraticCurveTo(256 + Math.cos(a + .25) * 95, 256 + Math.sin(a + .25) * 95, 256 + Math.cos(a) * 195, 256 + Math.sin(a) * 185);
      leafInk.stroke();
    }
    const deepTones = ['#1e3319', '#274020', '#2d4923', '#325127'];
    const midTones = ['#385a2a', '#446831', '#4d7334', '#557b38', '#3e622d'];
    const tipTones = ['#63883d', '#709445', '#7ca04d', '#587d38'];
    for (let layer = 0; layer < 3; layer++) {
      const count = layer === 0 ? 150 : layer === 1 ? 190 : 120;
      const tones = layer === 0 ? deepTones : layer === 1 ? midTones : tipTones;
      for (let i = 0; i < count; i++) {
        const angle = treeRandom() * Math.PI * 2;
        const reach = (layer === 0 ? .76 : layer === 1 ? .92 : .98) * Math.sqrt(treeRandom());
        const x = 256 + Math.cos(angle) * reach * 226;
        const y = 256 + Math.sin(angle) * reach * 214;
        const len = (11 + treeRandom() * 14) * (layer === 2 ? .86 : 1.0);
        const wid = len * (.42 + treeRandom() * .16);
        const rot = angle + (treeRandom() - .5) * 1.15;
        leafInk.save();
        leafInk.translate(x, y);
        leafInk.rotate(rot);
        leafInk.fillStyle = tones[Math.floor(treeRandom() * tones.length)];
        leafInk.beginPath();
        leafInk.moveTo(-len, 0);
        leafInk.quadraticCurveTo(0, -wid * 1.15, len, 0);
        leafInk.quadraticCurveTo(0, wid * 1.15, -len, 0);
        leafInk.closePath();
        leafInk.fill();
        if (layer > 0) {
          leafInk.strokeStyle = 'rgba(180,210,120,0.22)';
          leafInk.lineWidth = .9;
          leafInk.beginPath();
          leafInk.moveTo(-len * .7, 0);
          leafInk.lineTo(len * .75, 0);
          leafInk.stroke();
        }
        leafInk.restore();
      }
    }
    const foliageTexture = new T.CanvasTexture(leafCard);
    foliageTexture.colorSpace = T.SRGBColorSpace;
    foliageTexture.anisotropy = 8;
    const foliage = mat('#d6dbc4', { map: foliageTexture, alphaTest: .36, side: T.DoubleSide, vertexColors: true, roughness: .72, envMapIntensity: .36 });
    foliage.userData.castShadow = true;
    foliage.customProgramCacheKey = () => 'baixi-botanical-foliage';
    foliage.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { windTime: weatherTime, sssSun: roadSun, sssTint: roadTint });
      shader.vertexShader = 'uniform float windTime; varying vec3 vLeafWorld;\n' + shader.vertexShader.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'float sway = smoothstep(-.35, .55, position.y);',
        'float ph = position.x * 4.1 + position.z * 3.8 + windTime * 1.55;',
        'transformed.x += sin(ph) * .022 * sway;',
        'transformed.z += cos(ph * .86) * .018 * sway;',
      ].join('\n')).replace('#include <worldpos_vertex>', [
        '#include <worldpos_vertex>',
        'vec4 leafWp = vec4(transformed, 1.0);',
        '#ifdef USE_INSTANCING',
        '  leafWp = instanceMatrix * leafWp;',
        '#endif',
        'vLeafWorld = (modelMatrix * leafWp).xyz;',
      ].join('\n'));
      shader.fragmentShader = 'uniform vec3 sssSun, sssTint; varying vec3 vLeafWorld;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>', [
        '#include <emissivemap_fragment>',
        'vec3 leafView = normalize(cameraPosition - vLeafWorld);',
        'float backLit = pow(max(0.0, dot(-leafView, sssSun)), 2.8);',
        'float topSun = max(0.0, sssSun.y) * .16;',
        'totalEmissiveRadiance += diffuseColor.rgb * sssTint * (backLit * .42 + topSun);',
      ].join('\n'));
    };
    const crowns = Array.from({ length: 4 }, () => {
      const vertices = [], uvs = [], colors = [], indices = [];
      const up = new T.Vector3();
      const lateral = new T.Vector3();
      const lobes = [
        [0, .14, 0, .54], [-.30, -.04, .18, .38], [.28, .02, -.16, .40],
        [.14, .22, .26, .35], [-.18, .18, -.25, .36], [0, -.12, .05, .42],
      ];
      for (let i = 0; i < 116; i++) {
        const lobe = lobes[i % lobes.length];
        const turn = treeRandom() * Math.PI * 2;
        const level = treeRandom() * 1.85 - .92;
        const r = Math.sqrt(Math.max(0, 1 - level * level)) * (.45 + treeRandom() * .55) * lobe[3];
        const x = lobe[0] + Math.cos(turn) * r * 1.08;
        const z = lobe[2] + Math.sin(turn) * r * 1.02;
        const y = lobe[1] + level * lobe[3] * .76;
        const yaw = turn * 1.41 + treeRandom() * .6;
        const tilt = (treeRandom() - .48) * 1.65;
        lateral.set(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(.165 + treeRandom() * .115);
        up.set(-Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt)).multiplyScalar(.145 + treeRandom() * .115);
        const radialAO = clamp(.44 + Math.hypot(x, y * .85, z) * .88 + y * .34, .34, 1.12);
        const tint = .92 + treeRandom() * .16;
        const start = vertices.length / 3;
        for (const [right, top] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          vertices.push(x + right * lateral.x + top * up.x, y + top * up.y, z + right * lateral.z + top * up.z);
          const vAO = clamp(radialAO + top * .08, .32, 1.15);
          colors.push(vAO * tint, vAO * (.97 + treeRandom() * .06), vAO * .88);
        }
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    });
    const barkMat = mat('#524337', { roughness: .95, envMapIntensity: .24 });
    barkMat.userData.castShadow = true;
    weatherSurface(barkMat, 'timber', 1.2);
    function deciduous(x, z, height) {
      const turn = Math.abs(x * 37 + z * 13);
      const bendX = Math.sin(turn) * .24;
      const bendZ = Math.cos(turn) * .20;
      solid(x + bendX * .35, z + bendZ * .35, height * .078, height * .078, height * .59, false);
      if (!Y?.inAnyWater?.(x, z, 1.5)) {
        box(curb, x, .06, z, 1.72, .12, 1.72);
        box(soil, x, .09, z, 1.42, .08, 1.42);
      }
      queue(tapered, barkMat, x + bendX * .35, height * .28, z + bendZ * .35, height * .086, height * .58, height * .086,
        0, bendZ * .09, -bendX * .12);
      for (let i = 0; i < 6; i++) {
        const yaw = turn + i * 2.12;
        const dx = Math.sin(yaw) * height * (.17 + (i % 3) * .068);
        const dz = Math.cos(yaw) * height * (.19 + (i % 2) * .062);
        bar(barkMat, x + bendX * .48, height * (.31 + i * .032), z + bendZ * .48,
          x + bendX + dx, height * (.68 + i * .026), z + bendZ + dz, height * (.042 - i * .004));
      }
      const spread = height * (1.04 + Math.sin(turn) * .08);
      queue(crowns[Math.floor(turn) % crowns.length], foliage, x + bendX, height * .76, z + bendZ,
        spread, height * .74, spread * .96, turn);
    }
    function planter(x, z, color = leafColors[2]) {
      box(curb, x, .38, z, 2.4, .44, 1.31);
      box(soil, x, .62, z, 2.17, .06, 1.08);
      for (const shift of [-.68, 0, .68]) {
        queue(crowns[Math.abs(Math.round(x + shift * 7)) % crowns.length], foliage, x + shift, .92 + random() * .10, z, 1.05, .74, .98, shift * 2.1);
      }
      solid(x, z, 2.4, 1.31, .71, false);
    }

    function trafficSignal(x, z, yaw, stop) {
      const matLight = stop ? rust : tealBulb;
      const dx = Math.sin(yaw);
      const dz = Math.cos(yaw);
      pole(steel, x, 1.88, z, .19, 3.67);
      solid(x, z, .20, .20, 4.41, false);
      box(steel, x, 3.91, z, .47, .99, .37, yaw);
      for (let row = 0; row < 3; row++) {
        const y = 4.21 - row * .30;
        const material = row === (stop ? 0 : 2) ? matLight : tar;
        queue(cylinder, material, x + dx * .201, y, z + dz * .201, .21, .10, .21, yaw, Math.PI / 2);
        box(steel, x + dx * .24, y + .10, z + dz * .24, .27, .055, .13, yaw);
      }
    }

    const roadCircle = new T.CircleGeometry(.5, 22);
    function flatPolygonMesh(pts, material, y) {
      let area2 = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        area2 += a.x * (-b.z) - b.x * (-a.z);
      }
      const ordered = area2 < 0 ? [...pts].reverse() : pts;
      const shape = new T.Shape();
      ordered.forEach((pt, idx) => {
        if (idx === 0) shape.moveTo(pt.x, -pt.z);
        else shape.lineTo(pt.x, -pt.z);
      });
      shape.closePath();
      const geo = new T.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      geo.computeVertexNormals();
      const mesh = new T.Mesh(geo, material);
      mesh.position.y = y;
      mesh.receiveShadow = true;
      return mesh;
    }
    function roadNetwork() {
      // 城市全域人行道基底与衢州古城真实 OSM 路网沥青路面
      box(cement, 6.5, -.29, 2, 665, .54, 652);
      if (!Y) return;
      // 真实 OSM 城内水系（南湖、斗潭河）与石砌护岸
      if (Y.WATER_POLYGONS?.length) {
        const inlandWaterMat = mat('#1d5d6e', { metalness: .42, roughness: .10, envMapIntensity: 1.85 });
        for (const waterPoly of Y.WATER_POLYGONS) {
          if (!waterPoly.pts || waterPoly.pts.length < 3) continue;
          scene.add(flatPolygonMesh(waterPoly.pts, inlandWaterMat, .006));
          const ring = waterPoly.pts;
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i], b = ring[(i + 1) % ring.length];
            const mx = (a.x + b.x) * .5, mz = (a.z + b.z) * .5;
            if (Y.onAnyRoad(mx, mz, 1.2)) continue;
            const segLen = Math.hypot(b.x - a.x, b.z - a.z);
            if (segLen < 1.2) continue;
            const yaw = Math.atan2(b.x - a.x, b.z - a.z);
            box(curb, mx, .12, mz, .75, .28, segLen + .4, yaw);
          }
        }
      }
      for (const edge of Y.EDGES) {
        const { a, b, width, length, ux, uz, yaw, kind } = edge;
        const cx = (a.x + b.x) * .5;
        const cz = (a.z + b.z) * .5;
        const nx = uz, nz = -ux;
        const isBridge = Boolean(Y.inAnyWater?.(cx, cz, 0));
        const roadY = isBridge ? .042 : .021;
        ground(asphalt, cx, cz, width, length + width * (isBridge ? .25 : .36), roadY, yaw);
        if (isBridge) {
          for (const side of [-1, 1]) {
            const rx = cx + nx * (width * .5 + .42) * side;
            const rz = cz + nz * (width * .5 + .42) * side;
            box(curb, rx, .46, rz, .58, .88, length + 1.2, yaw);
            box(trim, rx, .95, rz, .72, .14, length + 1.4, yaw);
          }
        } else if (length > 18 && kind !== 'alley') {
          const curbLen = length - Math.min(12, length * .32);
          if (curbLen > 6) {
            for (const side of [-1, 1]) {
              const kx = cx + nx * (width * .5 + .20) * side;
              const kz = cz + nz * (width * .5 + .20) * side;
              if (!Y.onAnyRoad(kx, kz, .15)) {
                box(curb, kx, .08, kz, .36, .16, curbLen, yaw);
              }
            }
          }
        }
        const sideOffset = width * .5 - 1.25;
        const trimLen = length - (Y.IS_OSM_QUZHOU ? 12 : 19);
        if (trimLen > 5) {
          for (const side of [-1, 1]) {
            ground(roadMark, cx + nx * sideOffset * side, cz + nz * sideOffset * side, .17, trimLen, roadY + .011, yaw);
          }
        }
        const padT = Y.IS_OSM_QUZHOU ? Math.min(10.5, length * .26) : 12.5;
        const startT = padT, endT = length - padT;
        for (let t = startT; t < endT; t += 6.6) {
          const px = a.x + ux * t;
          const pz = a.z + uz * t;
          if (kind === 'arterial' || kind === 'main') {
            ground(roadGold, px - nx * .24, pz - nz * .24, .16, 3.4, roadY + .012, yaw);
            ground(roadGold, px + nx * .24, pz + nz * .24, .16, 3.4, roadY + .012, yaw);
          } else {
            ground(roadMark, px, pz, .15, 2.9, roadY + .012, yaw);
          }
        }
      }
      // 统一交通设施层：全城斑马线、停止线、导向箭头与悬臂红绿灯杆件
      trafficLayout = window.Tideline.buildTrafficLayout?.(Y) || null;
      if (trafficLayout) {
        window.Tideline.emitTrafficWorldProps?.(trafficLayout, {
          ground, box, pole, bar, solid,
          mats: { roadMark, roadGold, steel, steelPale, tar, curb },
        });
      }
      const signalPoles = trafficLayout?.poleSpots || [];
      // 真实交叉口圆形无缝衔接铺装与信号灯/路灯
      const lampSpots = [];
      for (const node of Y.NODES) {
        let maxW = 0;
        let hasMain = false;
        for (const { edge } of node.edges) {
          if (edge.width > maxW) maxW = edge.width;
          if (edge.kind === 'arterial' || edge.kind === 'main') hasMain = true;
        }
        if (!maxW) maxW = 10;
        const isJunction = node.edges.length >= 3;
        const discPad = Y.IS_OSM_QUZHOU ? (isJunction ? .45 : .02) : 1.1;
        const nodeY = Y.inAnyWater?.(node.x, node.z, 0) ? .0425 : .0215;
        queue(roadCircle, asphalt, node.x, nodeY, node.z, maxW + discPad, maxW + discPad, 1, 0, -Math.PI / 2);
        if (Y.IS_OSM_QUZHOU && !isJunction && lampSpots.some(p => Math.hypot(p.x - node.x, p.z - node.z) < 28)) continue;
        const cornerR = maxW * .5 + 2.35;
        for (const [ang, light, sig] of [[Math.PI * .25, true, hasMain], [-Math.PI * .75, true, false], [Math.PI * .75, false, hasMain]]) {
          const lx = node.x + Math.sin(ang) * cornerR;
          const lz = node.z + Math.cos(ang) * cornerR;
          if (Y.onAnyRoad(lx, lz, .9) || Y.inAnyWater?.(lx, lz, 1.4)) continue;
          if (light) {
            if (Y.IS_OSM_QUZHOU && lampSpots.some(p => Math.hypot(p.x - lx, p.z - lz) < 18)) continue;
            if (signalPoles.some(p => Math.hypot(p.x - lx, p.z - lz) < 4.5)) continue;
            streetLight(lx, lz, ang + Math.PI);
            lampSpots.push({ x: lx, z: lz });
          } else if (sig && isJunction && !trafficLayout) {
            trafficSignal(lx, lz, ang + Math.PI * .5, (node.index & 1) === 0);
          }
        }
      }
      // 路面岁月修补接缝细节
      for (let i = 0; i < 180; i++) {
        const edge = choose(Y.EDGES);
        if (edge.length < 26) continue;
        const t = range(11, edge.length - 11);
        const lat = range(-edge.width * .32, edge.width * .32);
        const px = edge.a.x + edge.ux * t + edge.uz * lat;
        const pz = edge.a.z + edge.uz * t - edge.ux * lat;
        ground(seams, px, pz, range(.12, .28), range(.3, 2.2), .025, edge.yaw);
      }
    }

    function streetEdges() {
      if (!Y) return;
      const art = rng(649812);
      for (const edge of Y.EDGES) {
        if (edge.length < 40) continue;
        const nx = edge.uz, nz = -edge.ux;
        const step = edge.kind === 'arterial' ? 32 : 26;
        for (let t = 19; t < edge.length - 19; t += step) {
          for (const side of [-1, 1]) {
            const offset = edge.width * .5 + 3.15;
            const atX = edge.a.x + edge.ux * (t + (art() - .5) * 5) + nx * offset * side;
            const atZ = edge.a.z + edge.uz * (t + (art() - .5) * 5) + nz * offset * side;
            if (atX < BOUNDS.minX + 6 || atX > 296 || atZ < BOUNDS.minZ + 6 || atZ > BOUNDS.maxZ - 6) continue;
            if (Y.onAnyRoad(atX, atZ, 2.3) || Y.inAnyWater?.(atX, atZ, 2.0) || blockedAt(atX, atZ, 2.6)) continue;
            if (art() > .22) {
              ground(rootGrate, atX, atZ, 1.42, 1.56, .197, edge.yaw);
              ground(soil, atX, atZ, .74, .90, .202, edge.yaw);
              deciduous(atX, atZ, 5.15 + art() * 2.25);
            }
            const bx = atX + edge.ux * 4.5, bz = atZ + edge.uz * 4.5;
            if (art() > .62 && !Y.onAnyRoad(bx, bz, 1.8) && !Y.inAnyWater?.(bx, bz, 1.8) && !blockedAt(bx, bz, 1.5)) {
              bench(bx, bz, edge.yaw - side * Math.PI / 2);
            }
          }
        }
        // 雨水箅子
        for (const t of [14, edge.length - 14]) {
          if (t <= 0 || t >= edge.length) continue;
          const gx = edge.a.x + edge.ux * t + nx * (edge.width * .5 - .82);
          const gz = edge.a.z + edge.uz * t + nz * (edge.width * .5 - .82);
          ground(rootGrate, gx, gz, .48, .78, .027, edge.yaw);
        }
      }
    }

    function facade(x, y, z, w, depth, floors, spacing, deco) {
      const step = deco ? 3.05 : 3.3;
      const gap = deco ? 3.05 : 3.2;
      const columnsWide = Math.max(2, Math.floor(w / gap) - 1);
      const columnsDeep = Math.max(2, Math.floor(depth / gap) - 1);
      for (let level = 0; level < floors; level++) {
        const row = y + level * spacing;
        for (const side of [-1, 1]) {
          for (let i = 0; i < columnsWide; i++) {
            const col = (i - (columnsWide - 1) / 2) * gap;
            const material = random() < .13 ? choose(lightGlass) : choose(glass);
            queue(plane, material, x + col, row, z + side * (depth / 2 + .044), step * (deco ? .58 : .8), deco ? 1.56 : 1.92, 1, side === 1 ? 0 : Math.PI);
          }
          for (let i = 0; i < columnsDeep; i++) {
            const col = (i - (columnsDeep - 1) / 2) * gap;
            const material = random() < .13 ? choose(lightGlass) : choose(glass);
            queue(plane, material, x + side * (w / 2 + .044), row, z + col, step * (deco ? .58 : .8), deco ? 1.56 : 1.92, 1, side * Math.PI / 2);
          }
        }
        if (deco && level % 2 === 0) box(trim, x, row - 1.32, z, w + .28, .22, depth + .28);
      }
    }
    const shopSigns = [
      ['衢州三头一掌', 'QUZHOU SPICY DUCK', '#ffd993'], ['邵永丰麻饼', 'SHAOS SESAME CAKE', '#ffb98e'],
      ['炭炉烤饼老铺', 'QUZHOU FLATBREAD', '#e7e3a5'], ['廿八都豆腐坊', 'TOFU BISTRO', '#ffa8c0'],
      ['水亭门茶社', 'SHUITING TEAHOUSE', '#9ae9de'], ['南孔书屋', 'NANZONG BOOKS', '#aff4d8'],
      ['烂柯棋社', 'LANKE WEIQI CLUB', '#ffd397'],
    ];
    function building(x, z, w, d, height, tower, front = 0, shop = false) {
      const h = height;
      if (window.Tideline.addDistrictArchitecture?.(boulevardAssets, { x, z, w, d, height, tower, front, shop })) {
        // Preserve the established lot layouts. The old facade and shop dressing shared the site's placement seed.
        const drawsForWindows = (wide, deep, floors, gap) => 4 * floors *
          (Math.max(2, Math.floor(wide / gap) - 1) + Math.max(2, Math.floor(deep / gap) - 1));
        let draws = 1 + drawsForWindows(w, d, Math.max(1, Math.floor((h - 3.1) / 3.15)), tower ? 3.2 : 3.05);
        if (tower && h > 39) draws += 1 + drawsForWindows(w * .72, d * .72, Math.max(1, Math.floor(h * .20 / 3.5)), 3.2);
        if (shop) draws += 3;
        for (let i = 0; i < draws; i++) random();
        solid(x, z, w, d, tower && h > 39 ? h * 1.2 : h + .65);
        return;
      }
      const color = choose(tower ? towerColors : cityColors);
      box(tar, x, .33, z, w + .65, .31, d + .6);
      box(color, x, h / 2 + .24, z, w, h, d);
      box(tower ? steelPale : trim, x, h + .37, z, w + .45, .52, d + .45);
      box(roof, x, h + .8, z, w * .95, .22, d * .95);
      box(tower ? color : tar, x - w * .19, h + 1.51, z + d * .23, w * .28, 1.58, d * .26);
      facade(x, tower ? 3.5 : 4.4, z, w, d, Math.max(1, Math.floor((h - 3.1) / 3.15)), 3.15, !tower);
      if (tower && h > 39) {
        const peakH = h * .20;
        box(color, x, h + peakH / 2, z, w * .72, peakH, d * .72);
        facade(x, h + 2.4, z, w * .72, d * .72, Math.max(1, Math.floor(peakH / 3.5)), 3.18, false);
        box(steelPale, x, h + peakH, z, w * .73, .46, d * .74);
        if (random() < .63) {
          pole(steel, x + 2, h + peakH + 5, z, .22, 10);
          box(tealBulb, x + 2, h + peakH + 10.1, z, .37, .37, .37);
        }
      }
      if (tower) {
        const baseHeight = Math.min(8.7, h / 2.7);
        box(steelPale, x, baseHeight - .11, z, w + .8, .32, d + .70);
        for (const side of [-1, 1]) {
          box(steelPale, x + w * .37 * side, h / 2 + .15, z + d / 2 + .18, .55, h, .45);
          box(steelPale, x + w * .37 * side, h / 2 + .15, z - d / 2 - .18, .55, h, .45);
          box(glass[1], x, 2.08, z + side * (d / 2 + .081), w - 4.0, 3.34, .25);
          for (let b = -w / 2 + 2.3; b < w / 2 - 2.0; b += 3.2) {
            box(steelPale, x + b, 2.16, z + side * (d / 2 + .24), .24, 3.54, .28);
          }
        }
      }
      if (shop) {
        const dx = Math.sin(front);
        const dz = Math.cos(front);
        const depth = Math.abs(dx) > .5 ? w : d;
        const width = Math.abs(dx) > .5 ? d : w;
        const facadeX = x + dx * (depth / 2 + .14);
        const facadeZ = z + dz * (depth / 2 + .14);
        const storefrontW = Math.min(width - 2, 10.5);
        box(door, facadeX, 1.8, facadeZ, storefrontW, 3.03, .37, front);
        const warmGlazing = choose(lightGlass);
        for (const section of [-1, 1]) {
          const pw = storefrontW * section * .26;
          const gx = facadeX + dz * pw + dx * .22;
          const gz = facadeZ - dx * pw + dz * .22;
          box(warmGlazing, gx, 1.83, gz, storefrontW * .32, 1.94, .17, front);
          box(steel, gx + dx * .106, 1.83, gz + dz * .106, storefrontW * .335, .096, .054, front);
          box(steel, gx + dx * .107, 1.83, gz + dz * .107, .096, 1.946, .054, front);
        }
        const awningColor = choose(shopColors);
        box(awningColor, facadeX + dx * 1.05, 3.55, facadeZ + dz * 1.05, storefrontW + .65, .27, 2.1, front, .13);
        for (let x = -storefrontW * .5 + .34; x < storefrontW * .52; x += .75) {
          box(trim, facadeX + dz * x + dx * 2.08, 3.41, facadeZ - dx * x + dz * 2.08, .21, .29, .07, front);
        }
        const words = choose(shopSigns);
        sign(...words, facadeX + dx * .32, 4.69, facadeZ + dz * .32, Math.min(storefrontW, 9), 2.13, front);
        ground(lampPool, facadeX + dx * 2.4, facadeZ + dz * 2.4, Math.abs(dx) > .5 ? 5.3 : storefrontW,
          Math.abs(dx) > .5 ? storefrontW : 5.3, .212);
      }
      solid(x, z, w, d, tower && h > 39 ? h * 1.2 : h + .65);
    }

    function lot(x, z, w, d) {
      box(curb, x, .04, z, w + .36, .17, d + .36);
      box(cement, x, .12, z, w, .14, d);
      surface(x, z, w + .36, d + .36, .125);
      surface(x, z, w, d, .19);
    }
    function park(x, z, w, d) {
      box(grass, x, .242, z, w - 9, .18, d - 9);
      surface(x, z, w - 9, d - 9, .342);
      ground(curb, x, z, w - 9, 5, .342);
      ground(curb, x, z, 5, d - 9, .343);
      pole(trim, x, .46, z, 15.2, .48, 15.2);
      pole(parkWater, x, .72, z, 13.4, .09, 13.4);
      pole(steelPale, x, 1.3, z, .82, 1.3);
      pole(parkWater, x, 2.0, z, 3.6, .22);
      solid(x, z, 10, 10, .85, false);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          deciduous(x + sx * 25, z + sz * 25, range(4.7, 6.4));
          deciduous(x + sx * 16, z + sz * 16, range(4.5, 5.4));
          bench(x + sx * 12, z + sz * 4, sz > 0 ? 0 : Math.PI);
        }
      }
      sign('府山公园', 'FUSHAN PARK', '#b6efad', x + 10, 2.22, z + d / 2 - 2, 6.5, 1.85, 0);
    }
    function container(x, z, color, tall = false, yaw = 0) {
      const w = 13.4;
      const d = 4.4;
      const y = tall ? 4.58 : 2.3;
      box(color, x, y - 1.07, z, w, 2.18, d, yaw);
      const dx = Math.cos(yaw);
      const dz = -Math.sin(yaw);
      for (let i = -6; i < 6.6; i += .8) {
        box(color, x + i * dx - dz * 2.22, y - 1.02, z + i * dz + dx * 2.22, .17, 1.97, .18, yaw);
        box(color, x + i * dx + dz * 2.22, y - 1.02, z + i * dz - dx * 2.22, .17, 1.97, .18, yaw);
      }
      if (!tall) solid(x, z, Math.abs(dx) > .5 ? w : d, Math.abs(dx) > .5 ? d : w, 4.6);
    }
    function warehouse(x, z, w, d, color, label) {
      box(color, x, 3.96, z, w, 7.45, d);
      box(roof, x - w * .24, 7.85, z, w * .55, .47, d + .8, 0, 0, .21);
      box(roof, x + w * .24, 7.85, z, w * .55, .47, d + .8, 0, 0, -.21);
      for (const part of [-.29, 0, .29]) {
        box(door, x + w * part, 2, z + d / 2 + .09, w * .23, 3.7, .23);
        for (let y = .5; y < 4; y += .5) box(steelPale, x + w * part, y, z + d / 2 + .24, w * .22, .059, .026);
      }
      for (let wx = x - w / 2 + 1; wx < x + w / 2; wx += 5.7) box(glass[2], wx, 6.15, z + d / 2 + .13, 3.2, .73, .15);
      if (label) sign(label, 'SOUTH TERMINAL', '#ffda95', x, 5.05, z + d / 2 + .29, 11, 2.86, 0);
      solid(x, z, w, d, 9.1);
    }
    function garage(x, z) {
      box(cityColors[0], x, 2.74, z, 19, 5.3, 29);
      box(shopColors[4], x, 5.63, z, 20.6, .43, 30.3);
      box(rust, x + 10.25, 3.86, z, 26, .16, 1.54, Math.PI / 2, .09);
      for (const offset of [-8.4, 0, 8.4]) {
        box(steel, x + 9.55, 1.75, z + offset, .28, 3.2, 6.7);
        box(choose(lightGlass), x + 9.71, 2.85, z + offset, .12, .6, 6.4);
        for (let y = .44; y < 2.45; y += .38) box(steelPale, x + 9.72, y, z + offset, .043, .07, 6.25);
      }
      sign(Y?.IS_OSM_QUZHOU ? '府东街改装工坊' : '新河沿机修铺', 'QUZHOU CUSTOM WORKS', '#96f6db', x + 9.78, 4.70, z, 14.2, 2.3, Math.PI / 2);
      box(tealBulb, x + 10.27, 3.68, z, .15, .13, 20.6);
      solid(x, z, 19, 29, 5.81);
    }
    function pointInPolygon(px, pz, pts) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, zi = pts[i].z, xj = pts[j].x, zj = pts[j].z;
        if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi + 1e-9) + xi)) inside = !inside;
      }
      return inside;
    }
    function fitsInFace(cx, cz, w, d, pts, margin = 11.2) {
      for (const sx of [-.5, 0, .5]) {
        for (const sz of [-.5, 0, .5]) {
          const px = cx + sx * w, pz = cz + sz * d;
          if (!pointInPolygon(px, pz, pts)) return false;
          if (Y && Y.onAnyRoad(px, pz, margin)) return false;
          if (Y?.inAnyWater && Y.inAnyWater(px, pz, 1.8)) return false;
        }
      }
      return true;
    }
    function sichuanGymnasium(x, z) {
      // 四川省体育馆 (人民南路四段8号 标志性彩蝶拱顶综合场馆)
      box(cement, x, .32, z, 82, .38, 68);
      surface(x, z, 82, 68, .51);
      box(cityColors[2], x, 5.8, z, 64, 10.8, 52);
      box(steelPale, x, 11.4, z, 68, .75, 56);
      box(towerColors[0], x - 14, 13.0, z, 35, 2.4, 54, 0, 0, .11);
      box(towerColors[0], x + 14, 13.0, z, 35, 2.4, 54, 0, 0, -.11);
      box(rust, x, 9.6, z + 26.4, 48, .55, 1.4);
      box(rust, x, 9.6, z - 26.4, 48, .55, 1.4);
      for (let col = -24; col <= 24; col += 8) {
        box(trim, x + col, 5.6, z + 26.3, .85, 10.2, .9);
        box(trim, x + col, 5.6, z - 26.3, .85, 10.2, .9);
        box(trim, x + 32.3, 5.6, z + col * .78, .9, 10.2, .85);
      }
      sign('衢州市体育馆', 'QUZHOU GYMNASIUM', '#ffe19c', x, 8.2, z + 27.2, 16.5, 3.1, 0);
      sign('府山片区 · 南街', 'FUSHAN · SOUTH ST', '#a4f3df', x + 32.8, 7.8, z, 15.2, 2.8, Math.PI / 2);
      solid(x, z, 66, 54, 14.8);
    }
    function littleBarStreet(pts) {
      // 水亭门老茶馆 & 南孔书院文化街区
      const barX = -158, barZ = -75.5;
      box(brick, barX, 4.9, barZ, 26, 9.2, 19);
      box(trim, barX, 9.7, barZ, 26.8, .48, 19.8);
      facade(barX, 4.5, barZ, 26, 19, 2, 3.1, true);
      box(tar, barX, 1.85, barZ - 9.7, 18, 3.1, .5);
      box(tealBulb, barX, 3.45, barZ - 10.05, 16.5, .14, .18);
      sign('水亭门老茶馆', 'SHUITINGMEN TEAHOUSE', '#ffbe86', barX - 3.5, 4.35, barZ - 9.95, 11.2, 2.35, Math.PI);
      fixture(barX, 3.6, barZ - 11.2, '#ffb677', 78, 18);
      solid(barX, barZ, 26, 19, 10.2);

      const byX = -182, byZ = -48;
      if (fitsInFace(byX, byZ, 22, 22, pts, 9.5)) {
        building(byX, byZ, 22, 22, 15.5, false, -Math.PI / 2, true);
        sign('南孔书屋 NANKONG', 'BOOKS & TEA NO.85', '#b9f3e4', byX - 11.3, 4.8, byZ, 9.6, 2.1, -Math.PI / 2);
      }
      const southX = -152, southZ = -22;
      if (fitsInFace(southX, southZ, 28, 24, pts, 9.5)) {
        building(southX, southZ, 28, 24, 18.4, false, 0, true);
      }
    }
    function yulinComprehensiveMarket(pts) {
      // 马站底综合市场（老衢州食坊+市集）
      const mx = 42, mz = -14;
      box(cityColors[0], mx, 4.4, mz, 46, 8.2, 26);
      box(shopColors[0], mx, 8.75, mz, 47.6, .55, 27.4);
      facade(mx, 5.4, mz, 46, 26, 1, 3.1, true);
      for (const off of [-14, 0, 14]) {
        box(door, mx + off, 1.95, mz + 13.2, 9.5, 3.4, .35);
        box(shopColors[1], mx + off, 3.7, mz + 14.3, 10.2, .24, 2.2, 0, .12);
      }
      sign('马站底综合市场', 'MAZHANDI OLD MARKET', '#ffd584', mx, 5.3, mz + 13.45, 16.8, 2.8, 0);
      fixture(mx, 4.1, mz + 15.2, '#ffd18b', 82, 20);
      solid(mx, mz, 46, 26, 9.4);

      const eastX = 112, eastZ = -18;
      if (fitsInFace(eastX, eastZ, 34, 24, pts, 9.5)) {
        building(eastX, eastZ, 34, 24, 19.2, false, 0, true);
      }
    }
    function* blocks() {
      if (!Y) return;
      const qz = window.Tideline.createQuzhouBuilder?.({
        T, scene, queue, box, pole, ground, solid, surface, sign, fixture, deciduous, nightMaterials, surfaceTexture,
      });
      let shuitingmenBuilt = false;
      let shuitingAlleyIdx = 0;
      if (Y.IS_OSM_QUZHOU) {
        // 水亭门城楼位于真实 OSM 滨江西侧（主街区多边形外），在此直接构建
        qz?.shuitingmen();
        shuitingmenBuilt = true;
        // 府东街改装工坊与起点前坪（衔接信安湖引路与滨江步栈道）
        if (Y.WORKSHOP_SPOT) {
          const gx = Y.WORKSHOP_SPOT.garageX ?? 278;
          const gz = Y.WORKSHOP_SPOT.garageZ ?? 136;
          lot(gx + 4.5, gz, 27, 36);
          garage(gx, gz);
          for (let k = 0; k < 4; k++) ground(roadMark, gx + 12.2, gz - 8.4 + k * 5.6, 5.2, .14, .206);
          // 衔接信安湖引路东端至起点泊位的沥青引道
          ground(asphalt, 281.5, 169.0, 9.6, 22, .021, Math.atan2(16, -6.6));
          queue(roadCircle, asphalt, 287.5, .0215, 165.5, 14.5, 14.5, 1, 0, -Math.PI / 2);
          deciduous(gx + 14.2, gz + 15.5, 5.6);
        }
      }
      for (let fi = 0; fi < Y.FACES.length; fi++) {
        const face = Y.FACES[fi];
        const pts = face.nodes.map(id => Y.NODES_BY_ID.get(id));
        const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minZ = Math.min(...zs), maxZ = Math.max(...zs);
        const cx = (minX + maxX) * .5, cz = (minZ + maxZ) * .5;
        const spanW = maxX - minX - 21.5, spanD = maxZ - minZ - 21.5;

        if ((face.zone === 'boulevard2' || face.zone === 'boulevard3') && window.Tideline.addBoulevardBlock) {
          const bMinX = 171, bMaxX = 274;
          const bx = (bMinX + bMaxX) * .5, bw = bMaxX - bMinX;
          lot(bx, cz, bw, spanD);
          boulevard = true;
          window.Tideline.addBoulevardBlock(boulevardAssets, { zi: face.zi, x: bx, z: cz, width: bw, depth: spanD });
          boulevard = false;
          yield;
          continue;
        }
        if (face.zone === 'garageBlock') {
          lot(227, 150, 94, 77);
          if (window.Tideline.addBoulevardBlock) {
            boulevard = true;
            window.Tideline.addBoulevardBlock(boulevardAssets, { zi: 4, x: 227, z: 150, width: 94, depth: 77 });
            boulevard = false;
          } else {
            garage(263, 127);
            building(216, 143, 27, 35, 16.9, false, Math.PI, true);
            building(261, 176, 24, 19, 9.1, false, Math.PI / 2, true);
          }
          for (let k = 0; k < 6; k++) ground(roadMark, 274, 146 + k * 6.2, 6.2, .14, .206);
          deciduous(270, 153, 5.8);
          yield;
          continue;
        }
        if (face.zone === 'park') {
          if (Y.IS_OSM_QUZHOU && qz) {
            qz.fushanPark();
          } else {
            const px = 78, pz = 52, pw = 132, pd = 66;
            lot(px, pz, pw, pd);
            if (qz) qz.fushanPark(px, pz, pw, pd);
            else park(px, pz, pw, pd);
          }
          yield;
          continue;
        }
        if (face.zone === 'kongmiao') {
          if (qz) qz.kongmiao();
          else {
            lot(221, -166, 104, 112);
            sichuanGymnasium(222, -165);
          }
          yield;
          continue;
        }
        if (face.zone === 'shuitingmen') {
          if (!shuitingmenBuilt) {
            qz?.shuitingmen();
            shuitingmenBuilt = true;
          }
          yield;
          continue;
        }
        if (face.zone === 'shuitingAlley') {
          qz?.shuitingAlley(face, pts, shuitingAlleyIdx++);
          yield;
          continue;
        }
        if (face.zone === 'tianwang') {
          qz?.tianwang();
          yield;
          continue;
        }
        if (face.zone === 'bellTower') {
          qz?.bellTower();
          yield;
          continue;
        }
        if (face.zone === 'mazhandi') {
          if (qz) qz.mazhandi();
          else yulinComprehensiveMarket(pts);
          yield;
          continue;
        }
        if (face.zone === 'dananmen') {
          qz?.dananmen();
          yield;
          continue;
        }
        if (face.zone === 'gymnasium') {
          lot(221, -166, 104, 112);
          sichuanGymnasium(222, -165);
          yield;
          continue;
        }
        if (face.zone === 'barStreet') {
          littleBarStreet(pts);
          yield;
          continue;
        }
        if (face.zone === 'marketCore') {
          yulinComprehensiveMarket(pts);
          yield;
          continue;
        }
        if (face.zone === 'warehouse7' && window.Tideline.addWarehouseVisuals) {
          window.Tideline.addWarehouseVisuals({ T, box, ground, solid, sign, bar, pole, nightMaterials, streetLight, planter });
          yield;
          continue;
        }
        if (face.zone === 'southYard') {
          const wx = cx, wz = cz - 14;
          const ww = Math.min(62, spanW * .74);
          if (ww > 24 && fitsInFace(wx, wz, ww, 26, pts, 9.5)) {
            warehouse(wx, wz, ww, 26, choose(containerMats), face.xi === 1 ? '南门站场' : '');
          }
          for (let c = 0; c < 4; c++) {
            const contX = cx + (c % 2 ? 13 : -13);
            const contZ = cz + 12 + Math.floor(c / 2) * 10;
            if (face.xi === 1 && c === 2) continue;
            if (!fitsInFace(contX, contZ, 14, 5, pts, 9.2)) continue;
            container(contX, contZ, choose(containerMats));
            if (random() < .58) container(contX, contZ, choose(containerMats), true);
          }
          yield;
          continue;
        }

        // 衢州古城粉墙黛瓦徽派院落与外围现代楼宇自适应排布
        const isTower = face.zone === 'tower';
        const isOldTown = face.zone === 'oldTown';
        if (Y.IS_OSM_QUZHOU) {
          const rawW = maxX - minX, rawD = maxZ - minZ;
          const fcx = Number.isFinite(face.cx) ? face.cx : cx;
          const fcz = Number.isFinite(face.cz) ? face.cz : cz;
          const placedInFace = [];
          const overlapsLocal = (bx, bz, bw, bd) => placedInFace.some(
            b => Math.abs(b.x - bx) < (b.w + bw) * .5 + 2.4 && Math.abs(b.z - bz) < (b.d + bd) * .5 + 2.4
          );
          const nearSpecial = (bx, bz, bw, bd) => {
            const rad = Math.hypot(bw, bd) * .5 + 6;
            if (Y.LANDMARKS?.some(lm => lm.id !== 'yanjiayu' && Math.hypot(bx - lm.x, bz - lm.z) < rad + 12)) return true;
            if (Y.WORKSHOP_SPOT && Math.hypot(bx - (Y.WORKSHOP_SPOT.garageX ?? Y.WORKSHOP_SPOT.x), bz - (Y.WORKSHOP_SPOT.garageZ ?? Y.WORKSHOP_SPOT.z)) < rad + 16) return true;
            return false;
          };
          const candidates = [];
          if (rawW > 74 || rawD > 74) {
            const cxs = rawW > 74 ? [-.24, .24] : [0];
            const czs = rawD > 74 ? [-.24, .24] : [0];
            for (const sx of cxs) {
              for (const sz of czs) {
                candidates.push([cx + sx * (rawW - 14) + range(-1.5, 1.5), cz + sz * (rawD - 14) + range(-1.5, 1.5), sz >= 0 ? 0 : Math.PI]);
              }
            }
          }
          candidates.push([fcx, fcz, random() < .5 ? 0 : Math.PI]);
          for (const [bx, bz, frontYaw] of candidates) {
            if (placedInFace.length >= 4) break;
            if (!pointInPolygon(bx, bz, pts) || Y.inAnyWater?.(bx, bz, 2.2)) continue;
            const multi = candidates.length > 1;
            const baseW = clamp(rawW * (multi ? range(.28, .38) : range(.48, .62)), 10, 34);
            const baseD = clamp(rawD * (multi ? range(.28, .38) : range(.46, .60)), 10, 30);
            let chosen = null;
            for (const [sw, sd] of [[1, 1], [.82, .82], [.68, .68], [.9, .55], [.55, .9], [.52, .52]]) {
              const bw = baseW * sw, bd = baseD * sd;
              if (bw < 8.2 || bd < 8.2) continue;
              if (overlapsLocal(bx, bz, bw, bd) || nearSpecial(bx, bz, bw, bd)) continue;
              if (fitsInFace(bx, bz, bw, bd, pts, 2.2) && !blockedAt(bx, bz, Math.max(bw, bd) * .52)) {
                chosen = { x: bx, z: bz, w: bw, d: bd };
                break;
              }
            }
            if (!chosen) continue;
            if (fitsInFace(chosen.x, chosen.z, chosen.w + 3.2, chosen.d + 3.2, pts, 1.3)) {
              lot(chosen.x, chosen.z, chosen.w + 2.8, chosen.d + 2.8);
            }
            if (isOldTown && qz) {
              qz.huizhouHouse(chosen.x, chosen.z, chosen.w, chosen.d, range(6.4, 9.2), frontYaw);
            } else {
              const bh = range(10.5, 22.0);
              building(chosen.x, chosen.z, chosen.w, chosen.d, bh, false, frontYaw, random() < .62);
            }
            placedInFace.push(chosen);
          }
          if (!placedInFace.length && fitsInFace(fcx, fcz, 3.5, 3.5, pts, 2.4) && !blockedAt(fcx, fcz, 3.2)) {
            deciduous(fcx, fcz, range(5.2, 7.2));
          }
          if ((fi & 3) === 3) yield;
          continue;
        }
        const cols = spanW > 92 ? [-0.26, 0.26] : [0];
        const rows = spanD > 88 ? [-0.25, 0.25] : [0];
        for (const sx of cols) {
          for (const sz of rows) {
            const bx = cx + sx * spanW + range(-1.8, 1.8);
            const bz = cz + sz * spanD + range(-1.8, 1.8);
            let bw = clamp(spanW * (cols.length > 1 ? range(.34, .43) : range(.58, .72)), 16, 44);
            let bd = clamp(spanD * (rows.length > 1 ? range(.34, .43) : range(.56, .70)), 15, 40);
            if (!fitsInFace(bx, bz, bw, bd, pts, 10.2)) {
              bw *= .76;
              bd *= .76;
              if (bw < 13 || bd < 13 || !fitsInFace(bx, bz, bw, bd, pts, 9.6)) continue;
            }
            if (fitsInFace(bx, bz, bw + 6, bd + 6, pts, 8.8)) lot(bx, bz, bw + 5.2, bd + 5.2);
            // 跳过北侧通荷路信号站点位避免遮挡
            if (Math.hypot(bx - STASH.x, bz - (STASH.z + 12)) < 24) continue;
            const frontYaw = sz >= 0 ? 0 : Math.PI;
            if (isOldTown && qz) {
              qz.huizhouHouse(bx, bz, bw, bd, range(6.6, 9.6), frontYaw);
            } else {
              const bh = isTower ? range(28, 62) : range(11.5, 23.5);
              building(bx, bz, bw, bd, bh, isTower, frontYaw, !isTower && random() < .68);
            }
          }
        }
        if (!isTower && fitsInFace(cx, cz, 4, 4, pts, 11) && !blockedAt(cx, cz, 3.5)) {
          deciduous(cx, cz, range(4.8, 6.9));
        }
        if ((fi & 3) === 3) yield;
      }
      // 一环路北侧背景城市天际线
      if (!Y.IS_OSM_QUZHOU) {
        for (let x = -255; x < 265; x += 58) {
          if (!Y.onAnyRoad(x, -314, 9) && !Y.inAnyWater?.(x, -314, 3)) building(x, -314, 26, 12, range(14, 32), false);
        }
      }
    }

    function crane(x, z, yaw = 0, height = 19) {
      const tangent = Math.cos(yaw);
      const normal = Math.sin(yaw);
      const coord = (a, b) => [x + a * tangent + b * normal, z + b * tangent - a * normal];
      const spar = (material, a, ah, b, c, ch, d, width) => {
        const aa = coord(a, b);
        const bb = coord(c, d);
        bar(material, aa[0], ah, aa[1], bb[0], ch, bb[1], width);
      };
      const yellow = choose([gold, rust]);
      for (const a of [-4.4, 4.4]) {
        for (const b of [-3.6, 3.6]) spar(yellow, a, .1, b, a * .48, height, b * .47, .65);
        spar(steel, a, 1.6, -3.6, a * .55, height - 2, 2.05, .22);
        spar(steel, a, 1.6, 3.6, a * .55, height - 2, -2.05, .22);
      }
      const tip = height + 11;
      for (const b of [-.82, .82]) {
        spar(yellow, -6.5, height, b, 22.4, tip, b, .47);
        spar(yellow, -6.5, height - 2, b, 22.4, tip - 1.4, b, .42);
        for (let i = -5; i < 21; i += 3) {
          spar(yellow, i, height - 1.6 + (i + 6) * .38, b, i + 2.9, height + (i + 9) * .38, b, .17);
        }
      }
      spar(steel, 20.8, tip - 1.7, 0, 20.8, height - 6, 0, .08);
      const c = coord(20.8, 0);
      box(steel, c[0], height - 6, c[1], 1, .52, .65);
      box(glass[2], x, height, z, 3.7, 2.8, 3.5, yaw);
    }
    function shoreline() {
      const promenade = window.Tideline.addPromenadeDetail;
      const redesigned = z => promenade && z >= -110 && z <= 192;
      lot(317.3, 2, 40.8, 650);
      ground(boardwalk, 320, 1.5, 27.8, 650, .202);
      surface(320, 1.5, 27.8, 650, .202);
      if (promenade) surface(316.05, 41, 35.16, 302, .218);
      ground(curb, 334, 0, 1.2, 652, .213);
      for (let z = -319; z < 324; z += 2.1) ground(boardSeam, 320, z, 27.4, .05, .211);
      for (let z = -319; z < 326; z += 13.7) {
        if (redesigned(z)) continue;
        deciduous(311.5 + range(-1.6, 1.6), z, range(5.8, 8.2));
        if (Math.round(z) % 2) {
          bench(327.3, z + 4.6, Math.PI / 2);
          planter(326.4, z - 1.8);
        }
      }
      for (const z of [135, 156, 180, 228, 255, -22, -50, -146]) {
        if (!redesigned(z)) planter(304.4, z, leafColors[1]);
      }
      for (const z of [143, 185, 214, 257, -54, -118]) {
        for (let i = 0; i < 3; i++) {
          pole(steelPale, 299.8, .43, z + i * 1.66, .22, .82);
          pole(rust, 299.8, .82, z + i * 1.66, .23, .14);
          solid(299.8, z + i * 1.66, .23, .23, .89, false);
        }
      }
      for (const [z, label] of [[149, '信安湖绿道'], [-82, '严家淤渡口'], [239, '码头入口']]) {
        box(steel, 320.9, 1.20, z, .25, 2.36, 1.07);
        solid(320.9, z, .29, 1.09, 2.39, false);
        sign(label, 'XINAN LAKE GREENWAY', '#ffe3ac', 320.74, 1.57, z, 1.8, .81, -Math.PI / 2);
        sign(label, 'XINAN LAKE GREENWAY', '#ffe3ac', 321.06, 1.57, z, 1.8, .81, Math.PI / 2);
      }
      for (let z = -313; z < 326; z += 28.1) {
        if (!redesigned(z)) streetLight(331, z, -Math.PI / 2);
      }
      let railStart, railEnd;
      for (let z = -320; z < 326; z += 3.65) {
        if (z > 195.3 && z < 219) {
          if (railStart != null) solid(336.5, (railStart + railEnd) / 2, .19, railEnd - railStart, 1.60, false);
          railStart = null;
          continue;
        }
        railStart ??= z - .095;
        railEnd = z + 3.665;
        box(steel, 336.5, .83, z, .19, 1.43, .19);
        box(steelPale, 336.5, 1.52, z + 1.83, .17, .15, 3.67);
        box(steelPale, 336.5, .62, z + 1.83, .078, .085, 3.67);
      }
      solid(336.5, (railStart + railEnd) / 2, .19, railEnd - railStart, 1.60, false);
      ground(boardwalk, 4, 315, 652, 21, .21);
      surface(4, 315, 652, 21, .21);
      let lastRailX;
      for (let x = -317; x < 328; x += 5.6) {
        box(steel, x, .85, 326, .23, 1.4, .24);
        box(steelPale, x + 2.8, 1.54, 326, 5.63, .18, .16);
        lastRailX = x + 5.615;
      }
      solid((lastRailX - 317.115) / 2, 326, lastRailX + 317.115, .24, 1.63, false);
      for (const [x, z] of [[-234, 354], [-143, 352], [-54, 360], [47, 352]]) {
        box(boardwalk, x, -.22, z, 28, 1.1, 55);
        crane(x, z - 5, -Math.PI / 4, range(14.6, 22.2));
      }
      for (const [z, w] of [[-250, 80], [-158, 44], [40, 31]]) {
        box(boardwalk, 336 + w / 2, -.31, z, w, 1.03, 14.8);
        if (w > 35) crane(342 + w / 2, z, -1.2, 17);
        for (let x = 344; x < 336 + w; x += 8) pole(steel, x, -2.1, z - 6.1, .9, 6.4);
      }
      for (const [x, z] of [[385, 34], [410, -171]]) {
        box(tar, x, .15, z, 8.9, 2.9, 24.1);
        box(white, x, 1.81, z, 8.95, .66, 25.5);
        box(rust, x, 1.23, z, 9.03, .25, 25.8);
        box(tar, x, .39, z - 12.7, 7.45, 2.32, 2.0);
        box(white, x, 1.8, z - 12.8, 7.45, .69, 2.5);
        box(white, x, 3.2, z - 3.9, 7.16, 2.19, 11.7);
        box(glass[1], x, 3.56, z - 9.78, 6.7, .76, .23);
        for (const side of [-1, 1]) {
          for (let s = -8.1; s < 1; s += 2.03) box(choose(lightGlass), x + side * 3.62, 3.61, z + s, .17, .66, 1.20);
          box(steelPale, x + side * 4.28, 2.46, z + 4.65, .14, .13, 14.5);
        }
        box(steel, x, 4.27, z - 4.1, 7.45, .21, 12.1);
        pole(steel, x, 5.5, z - 5.6, .24, 2.82);
        box(tealBulb, x, 6.90, z - 5.6, .33, .29, .33);
      }
      pole(trim, 324, .5, 291, 13, .75);
      queue(tapered, white, 324, 4.75, 291, 6.2, 8.2, 6.2);
      pole(rust, 324, 5.00, 291, 5.32, 1.51);
      pole(steelPale, 324, 8.88, 291, 5.05, .35);
      pole(tealBulb, 324, 9.94, 291, 3.27, 1.97);
      queue(tapered, rust, 324, 11.35, 291, 5.0, 1.25, 5.0);
      pole(steel, 324, 12.05, 291, .15, 1.4);
      solid(324, 291, 5.2, 5.2, 11.75);
    }

    roadNetwork();
    yield;
    yield* blocks();
    streetEdges();
    shoreline();
    yield;
    if (window.Tideline.addPromenadeDetail) {
      boulevard = true;
      window.Tideline.addPromenadeDetail(boulevardAssets);
      boulevard = false;
    }
    yield;
    window.Tideline.addMarineCoast?.({ T, scene, box, ground, solid, sign, bar, pole, nightMaterials, streetLight, planter });
    window.Tideline.addPortDetail?.(boulevardAssets);
    yield;
    window.Tideline.addStoryLandmarks?.(boulevardAssets);
    window.Tideline.addNightMarket?.(boulevardAssets);
    const restStoneMat = mat('#8c9290', { roughness: .88, metalness: .04 });
    const restStoneTrim = mat('#aba698', { roughness: .82, metalness: .05 });
    const restWoodMat = mat('#7e593d', { roughness: .72, metalness: .04 });
    const restIronMat = mat('#2a3236', { roughness: .48, metalness: .62 });
    for (const spot of REST_SPOTS) {
      if (spot.existingBench) continue;
      const baseY = surfaceHeight(spot.x, spot.z) - .023;
      const fx = Math.sin(spot.yaw), fz = Math.cos(spot.yaw);
      const rx = Math.cos(spot.yaw), rz = -Math.sin(spot.yaw);
      box(restStoneTrim, spot.x, baseY + .03, spot.z, 2.72, .05, 1.38, spot.yaw);
      if (spot.style === 'stone') {
        box(restStoneMat, spot.x, baseY + .43, spot.z, 2.28, .12, .58, spot.yaw);
        box(restStoneTrim, spot.x, baseY + .495, spot.z, 2.34, .025, .62, spot.yaw);
        for (const side of [-1, 1]) {
          box(restStoneMat, spot.x + side * rx * .84, baseY + .22, spot.z + side * rz * .84, .24, .38, .50, spot.yaw);
        }
      } else {
        box(restWoodMat, spot.x, baseY + .455, spot.z, 2.34, .085, .56, spot.yaw);
        box(restWoodMat, spot.x - fx * .255, baseY + .79, spot.z - fz * .255, 2.34, .32, .075, spot.yaw);
        for (const side of [-1, 1]) {
          const lx = spot.x + side * rx * .92;
          const lz = spot.z + side * rz * .92;
          box(restIronMat, lx, baseY + .24, lz, .10, .44, .58, spot.yaw);
          box(restIronMat, lx - fx * .25, baseY + .68, lz - fz * .25, .08, .54, .08, spot.yaw);
          box(restWoodMat, lx, baseY + .61, lz, .09, .05, .54, spot.yaw);
        }
      }
      solid(spot.x, spot.z, Math.abs(rx) * 2.32 + Math.abs(fx) * .60, Math.abs(rz) * 2.32 + Math.abs(fz) * .60, .86, false);
    }
    yield* bakeStreetShade();
    if (Y) {
      for (const { x, z, title, sub, yaw } of Y.ROAD_SIGNS) {
        if (Y.onAnyRoad(x, z, 1.8) || blockedAt(x, z, 1.2)) continue;
        const dx = Math.cos(yaw), dz = -Math.sin(yaw);
        pole(steel, x - dx * 1.9, 2.14, z - dz * 1.9, .14, 4.15);
        pole(steel, x + dx * 1.9, 2.14, z + dz * 1.9, .14, 4.15);
        sign(title, sub, '#a6efdc', x, 3.82, z, 5.5, 1.32, yaw);
        sign(title, sub, '#a6efdc', x, 3.82, z, 5.5, 1.32, yaw + Math.PI);
      }
    }
    // Opaque, uniformly painted props can share a draw even when their paint,
    // roughness and metalness differ. Keep maps, signs and animated materials separate.
    const animatedMaterials = new Set(nightMaterials.map(([material]) => material));
    const paintKeys = new Map(), drawGroups = new Map();
    function paintKey(material) {
      if (!instancePaint) return material.uuid;
      if (paintKeys.has(material)) return paintKeys.get(material);
      let key = material.uuid;
      if (material.type === 'MeshStandardMaterial' && !material.transparent && !material.emissive.getHex() &&
          !animatedMaterials.has(material) && material.onBeforeCompile === T.Material.prototype.onBeforeCompile &&
          !Object.values(material).some(value => value?.isTexture)) {
        const properties = material.toJSON();
        for (const field of ['uuid', 'name', 'metadata', 'userData', 'color', 'roughness', 'metalness']) delete properties[field];
        key = JSON.stringify(properties);
      }
      paintKeys.set(material, key);
      return key;
    }
    for (const batch of batches.values()) {
      const key = batch.geo.id + ':' + Number(batch.casts) + ':' + paintKey(batch.material);
      if (!drawGroups.has(key)) drawGroups.set(key, []);
      drawGroups.get(key).push(batch);
    }
    function streetPaint(original) {
      const result = original.clone();
      result.color.setRGB(1, 1, 1);
      result.roughness = result.metalness = 1;
      result.onBeforeCompile = shader => {
        const varyings = 'varying vec3 vStreetInk;\nvarying vec2 vStreetFinish;\n';
        shader.vertexShader = 'attribute vec3 streetInk;\nattribute vec2 streetFinish;\n' + varyings +
          shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStreetInk = streetInk; vStreetFinish = streetFinish;');
        shader.fragmentShader = varyings + shader.fragmentShader
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vStreetInk;')
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= vStreetFinish.x;')
          .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= vStreetFinish.y;');
      };
      result.customProgramCacheKey = () => 'baixi-static-instance-paint-v1';
      return result;
    }
    for (const groups of drawGroups.values()) {
      const { geo, material, casts } = groups[0];
      const mainCount = groups.reduce((n, group) => n + group.core.length, 0);
      const count = groups.reduce((n, group) => n + group.detail.length, mainCount);
      const pooled = groups.length > 1;
      const ink = pooled ? new T.InstancedInterleavedBuffer(new Float32Array(count * 5), 5).setUsage(T.DynamicDrawUsage) : null;
      let geometry = geo;
      if (ink) {
        // Geometry attributes and indices are immutable and shared with the source.
        geometry = new T.BufferGeometry();
        geometry.setIndex(geo.index);
        for (const [name, attribute] of Object.entries(geo.attributes)) geometry.setAttribute(name, attribute);
        geometry.setDrawRange(geo.drawRange.start, geo.drawRange.count);
        geometry.setAttribute('streetInk', new T.InterleavedBufferAttribute(ink, 3, 0));
        geometry.setAttribute('streetFinish', new T.InterleavedBufferAttribute(ink, 2, 3));
      }
      const mesh = new T.InstancedMesh(geometry, pooled ? streetPaint(material) : material, count);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      let coreIndex = 0, detailIndex = mainCount;
      for (const group of groups) {
        const m = group.material;
        for (const list of [group.core, group.detail]) {
          for (const matrix of list) {
            const index = list === group.core ? coreIndex++ : detailIndex++;
            mesh.setMatrixAt(index, matrix);
            if (ink) {
              const base = index * 5;
              m.color.toArray(ink.array, base);
              ink.array[base + 3] = m.roughness;
              ink.array[base + 4] = m.metalness;
            }
          }
        }
      }
      mesh.matrixAutoUpdate = false;
        mesh.matrixWorldAutoUpdate = false;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.receiveShadow = material.isMeshStandardMaterial && !material.transparent;
      mesh.castShadow = casts && mesh.receiveShadow;
      scene.add(mesh);
      if (!geo.boundingBox) geo.computeBoundingBox();
      const center = geo.boundingBox.getCenter(new T.Vector3());
      const half = geo.boundingBox.getSize(new T.Vector3()).multiplyScalar(.5);
      const matrices = mesh.instanceMatrix.array.slice();
      const bounds = new Float32Array(mesh.count * 5);
      for (let i = 0; i < mesh.count; i++) {
        const offset = i * 16;
        const xx = matrices[offset];
        const xy = matrices[offset + 4];
        const xz = matrices[offset + 8];
        const zx = matrices[offset + 2];
        const zy = matrices[offset + 6];
        const zz = matrices[offset + 10];
        const yx = matrices[offset + 1], yy = matrices[offset + 5], yz = matrices[offset + 9];
        bounds[i * 5] = xx * center.x + xy * center.y + xz * center.z + matrices[offset + 12];
        bounds[i * 5 + 1] = yx * center.x + yy * center.y + yz * center.z + matrices[offset + 13];
        bounds[i * 5 + 2] = zx * center.x + zy * center.y + zz * center.z + matrices[offset + 14];
        const x = Math.abs(xx) * half.x + Math.abs(xy) * half.y + Math.abs(xz) * half.z;
        const y = Math.abs(yx) * half.x + Math.abs(yy) * half.y + Math.abs(yz) * half.z;
        const z = Math.abs(zx) * half.x + Math.abs(zy) * half.y + Math.abs(zz) * half.z;
        bounds[i * 5 + 3] = Math.hypot(x, z);
        bounds[i * 5 + 4] = Math.hypot(x, y, z);
      }
      const visibleIndices = Int32Array.from({ length: mesh.count }, (_, i) => i);
      const batch = { mesh, matrices, bounds, visibleIndices, mainCount, ink, paints: ink?.array.slice() };
      streetBatches.push(batch);
      if (geo.userData.closeStreet) closeStreetBatches.push(batch);
      if (streetBatches.length % 12 === 0) yield;
    }
    batches.clear();
    drawGroups.clear();
    paintKeys.clear();

    const streetPosition = new T.Vector3(Infinity, 0, 0), streetRotation = new T.Quaternion();
    const streetFrustum = new T.Frustum(), streetProjection = new T.Matrix4();
    let streetFov, streetAspect;
    let streetDistance = 0;

    function uploadSpan(attribute, start, end) {
      // An off-screen batch can still have a previous range awaiting upload.
      const prior = attribute.updateRanges[0];
      if (prior) {
        start = Math.min(start, prior.start);
        end = Math.max(end, prior.start + prior.count);
      }
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(start, end - start);
      attribute.needsUpdate = true;
    }
    function setDetail(full, range = full ? 0 : 244) {
      if (Boolean(surfaceDetail.value) === full && streetDistance === range) return;
      surfaceDetail.value = Number(full);
      const restore = streetDistance && !range;
      streetDistance = range;
      streetPosition.x = Infinity;
      if (!restore) return;
      for (const { mesh, matrices, visibleIndices, ink, paints } of streetBatches) {
        mesh.instanceMatrix.array.set(matrices);
        if (ink) {
          ink.array.set(paints);
          uploadSpan(ink, 0, paints.length);
        }
        for (let i = 0; i < visibleIndices.length; i++) visibleIndices[i] = i;
        mesh.instanceMatrix.clearUpdateRanges();
        mesh.instanceMatrix.addUpdateRange(0, matrices.length);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.count = matrices.length / 16;
        mesh.visible = mesh.count > 0;
      }
    }

    function updateVisibleStreet(camera) {
      if (!streetDistance && !closeStreetBatches.length) return;
      if (streetPosition.distanceToSquared(camera.position) < 16 && streetAspect === camera.aspect &&
          Math.abs(camera.fov - streetFov) < 1 && Math.abs(streetRotation.dot(camera.quaternion)) > .9976) return;
      streetPosition.copy(camera.position);
      streetRotation.copy(camera.quaternion);
      streetAspect = camera.aspect;
      streetFov = camera.fov;
      const { x, y, z } = streetPosition;
      const range = Math.ceil(streetDistance * Math.max(1, camera.aspect / 2.4));
      camera.updateMatrixWorld();
      streetFrustum.setFromProjectionMatrix(streetProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const trimRange = surfaceDetail.value > .5 ? 67 : 37;
      for (const { mesh, matrices, bounds, visibleIndices, mainCount, ink, paints } of streetDistance ? streetBatches : closeStreetBatches) {
        const upload = mesh.instanceMatrix;
        let count = 0, firstDirty = visibleIndices.length, lastDirty = -1;
        for (let i = 0, at = 0; i < visibleIndices.length; i++, at += 5) {
          const px = bounds[at], py = bounds[at + 1], pz = bounds[at + 2];
          const dx = px - x, dz = pz - z, span = dx * dx + dz * dz;
          const reach = (i < mainCount ? range : trimRange) + bounds[at + 3] + 4;
          if (span > reach * reach) continue;
          if (streetDistance) {
            // Allow four metres and the full camera rotation between culls.
            // High quality also draws mirrors and shadows from outside the main view.
            const dy = py - y, margin = bounds[at + 4] + 4.1 + .17 * Math.sqrt(span + dy * dy);
            let outside = false;
            for (let plane = 0; plane < 4; plane++) {
              const { normal, constant } = streetFrustum.planes[plane];
              if (normal.x * px + normal.y * py + normal.z * pz + constant < -margin) { outside = true; break; }
            }
            if (outside) continue;
          }
          if (visibleIndices[count] !== i) {
            const source = i * 16, dest = count * 16;
            for (let part = 0; part < 16; part++) upload.array[dest + part] = matrices[source + part];
            if (ink) for (let part = 0; part < 5; part++) ink.array[count * 5 + part] = paints[i * 5 + part];
            visibleIndices[count] = i;
            firstDirty = Math.min(firstDirty, count);
            lastDirty = count;
          }
          count++;
        }
        mesh.count = count;
        mesh.visible = count > 0;
        if (lastDirty >= firstDirty) {
          uploadSpan(upload, firstDirty * 16, (lastDirty + 1) * 16);
          if (ink) uploadSpan(ink, firstDirty * 5, (lastDirty + 1) * 5);
        }
      }
    }

    const duskImage = { value: 0 };
    const duskPhoto = textureLoader.load('assets/quzhou-dusk.webp', () => { duskImage.value = 1; });
    duskPhoto.colorSpace = T.SRGBColorSpace;
    duskPhoto.wrapS = duskPhoto.wrapT = T.ClampToEdgeWrapping;
    duskPhoto.anisotropy = 4;
    const headlandReady = { value: 0 };
    const headlandArt = textureLoader.load('assets/quzhou-mountains.webp', () => { headlandReady.value = 1; });
    headlandArt.colorSpace = T.SRGBColorSpace;
    headlandArt.wrapS = headlandArt.wrapT = T.ClampToEdgeWrapping;
    const moon = new T.Vector3(-.28, .39, -.86).normalize();
    const skyUniforms = {
      topColor: { value: new T.Color() }, lowColor: { value: new T.Color() },
      sunColor: { value: new T.Color() }, sun: { value: new T.Vector3(.74, .19, -.64).normalize() },
      moonDir: { value: moon },
      daylight: { value: 1 }, stars: { value: 0 }, overcast: { value: 0 }, time: weatherTime,
      duskPhoto: { value: duskPhoto }, duskImage, duskMix: { value: 0 },
      headland: { value: headlandArt }, headlandReady, night: { value: 0 }, mist: { value: 0 },
    };
    const sky = new T.Mesh(new T.SphereGeometry(1250, 32, 20), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, uniforms: skyUniforms, fog: false,
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 topColor, lowColor, sunColor, sun, moonDir;',
        'uniform float daylight, stars, overcast, time, duskMix, duskImage, headlandReady, night, mist;',
        'uniform sampler2D duskPhoto, headland;',
        'float hash(vec2 p) { return fract(sin(dot(p,vec2(15.47,87.83)))*43758.545); }',
        'float vaporHash(vec2 p){ vec3 r=fract(vec3(p.xyx)*.1031); r+=dot(r,r.yzx+33.33); return fract((r.x+r.y)*r.z); }',
        'float vaporNoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);',
        '  return mix(mix(vaporHash(i),vaporHash(i+vec2(1,0)),f.x),mix(vaporHash(i+vec2(0,1)),vaporHash(i+1.),f.x),f.y); }',
        'void main(){',
        '  vec3 d = normalize(vDir); float h = max(0.0,d.y);',
        '  float azimuth = atan(d.x,-d.z);',
        '  float towardSun = max(0.,dot(d,sun));',
        '  float glow = pow(towardSun,6.2);',
        '  float mie = pow(towardSun,26.0);',
        '  float halo = pow(towardSun,135.0);',
        '  float disk = smoothstep(.99988,.99995,towardSun);',
        '  float duskBand = exp(-6.8*max(0.,h-.015));',
        '  float rayleigh = smoothstep(-.015,.72,pow(h,.62));',
        '  vec3 col = mix(lowColor,topColor,rayleigh);',
        '  col = mix(col, lowColor*1.12, exp(-14.0*h)*.35);',
        '  col += daylight * sunColor * (.10*duskBand + glow*.24 + mie*.22 + halo*.68);',
        '  vec2 wind = d.xz/(h+.22);',
        '  vec2 bank = vec2(wind.x*.82+wind.y*.34,wind.y*.78-wind.x*.24) + vec2(time*.0024,-time*.0012);',
        '  vec2 layers = bank*vec2(1.55,2.65);',
        '  float shape = vaporNoise(layers) + .50*vaporNoise(layers*2.08+7.1) + .25*vaporNoise(layers*4.25-3.7) + .125*vaporNoise(layers*8.4+5.2);',
        '  vec2 sunStep = normalize(sun.xz + vec2(.001)) * .16;',
        '  float shadowSample = vaporNoise(layers+sunStep) + .50*vaporNoise((layers+sunStep)*2.08+7.1) + .25*vaporNoise((layers+sunStep)*4.25-3.7);',
        '  float horizonMask = smoothstep(.015,.11,h)*(1.-smoothstep(.64,1.,h));',
        '  float clouds = smoothstep(.78-overcast*.18,1.28-overcast*.18,shape)*horizonMask;',
        '  float selfLit = clamp(.58 + (shape - shadowSample) * 1.45 + glow * .35, .12, 1.0);',
        '  float cloudRim = smoothstep(.68,.95,shape)*(1.-smoothstep(.96,1.26,shape))*horizonMask;',
        '  vec3 litTop = mix(vec3(.96,.98,1.0), vec3(1.0,.97,.90), .35 + glow*.65);',
        '  vec3 shadedBase = mix(topColor*.62 + vec3(.22,.26,.34), vec3(.52,.56,.64), overcast*.65);',
        '  vec3 dayCloud = mix(shadedBase, litTop, selfLit * (1.0 - overcast*.42));',
        '  vec3 nightCloud = topColor*.68 + lowColor*.18;',
        '  vec3 cloudColor = mix(nightCloud, dayCloud, daylight);',
        '  cloudColor = mix(cloudColor, lowColor*.82 + sunColor*.32, duskMix*.68);',
        '  col = mix(col,cloudColor,clouds*(.76+overcast*.20));',
        '  col += sunColor*daylight*cloudRim*(.18 + mie*.48 + duskBand*.10);',
        '  float cirrus = smoothstep(.66,.92,vaporNoise(bank*vec2(4.2,1.1)+vec2(12.,3.))) * smoothstep(.18,.52,h) * (1.-clouds) * (1.-overcast);',
        '  col = mix(col, mix(litTop, sunColor, duskMix*.5), cirrus * .22 * daylight);',
        '  float plate=0.;',
        '  if(duskMix*duskImage>.01){',
        '    float bearing=azimuth-atan(sun.x,-sun.z);',
        '    float offset=atan(sin(bearing),cos(bearing));',
        '    float u=.488+offset/2.714;',
        '    float v=clamp(asin(h)*.63-.011,0.,.998);',
        '    plate=duskMix*duskImage*smoothstep(.004,.055,h)*smoothstep(0.,.19,min(u,1.-u));',
        '    vec3 photo=texture2D(duskPhoto,vec2(clamp(u,.001,.999),v)).rgb;',
        '    photo=mix(photo,vec3(dot(photo,vec3(.2126,.7152,.0722))),.19)*vec3(.83,.88,1.01);',
        '    col=mix(col,photo,plate);',
        '  }',
        '  col += sunColor*daylight*disk*(1.-clouds*.98)*(1.-plate)*2.65;',
        '  float towardMoon = max(0.,dot(d,moonDir));',
        '  float moonDisk = smoothstep(.99935,.99968,towardMoon);',
        '  float moonHalo = pow(towardMoon,26.0)*.16 + pow(towardMoon,150.0)*.42;',
        '  float moonVis = stars * (1.0 - clouds * .86) * smoothstep(.02,.16,h);',
        '  col += vec3(.92,.95,1.0) * (moonDisk * 1.75 + moonHalo * 1.12) * moonVis;',
        '  vec2 starUV = vec2(azimuth*186.0, d.y*311.0);',
        '  vec2 starCell = floor(starUV);',
        '  float starHash = hash(starCell);',
        '  float twinkle = .64 + .36 * sin(time * (1.5 + hash(starCell + 7.3) * 2.9) + starHash * 41.0);',
        '  float star = step(.9938,starHash) * (1.0-smoothstep(.075,.22,length(fract(starUV)-.5)));',
        '  vec3 starTint = mix(vec3(.84,.92,1.0), vec3(1.0,.93,.82), hash(starCell + 19.1));',
        '  col += starTint * (star * twinkle * stars * smoothstep(.04,.34,h) * .56);',
        '  vec3 mistVeil = mix(vec3(.78,.85,.86), vec3(.22,.30,.35), night);',
        '  col = mix(col, mistVeil, mist * exp(-5.6 * h) * .56);',
        '  float coastU = .5 + (azimuth-.66)/1.91;',
        '  float coastV = (d.y+.023)/.229;',
        '  if(headlandReady>.5 && coastU>0. && coastU<1. && coastV>0. && coastV<1.){',
        '    vec4 relief = texture2D(headland,vec2(coastU,coastV));',
        '    vec3 rock = relief.rgb * mix(vec3(1.28,1.32,1.30),vec3(.24,.32,.47),night);',
        '    vec3 air = mix(lowColor,topColor,mix(.42,.72,smoothstep(.05,.75,coastV)));',
        '    rock = mix(rock,air,.18+.14*(1.-coastV)+overcast*.28+mist*.34);',
        '    float shore = smoothstep(.0,.092,coastV)*smoothstep(1.0,.91,coastV)*smoothstep(.025,.133,min(coastU,1.-coastU));',
        '    col = mix(col,rock,relief.a*shore);',
        '  }',
        '  gl_FragColor = vec4(col,1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    }));
    sky.renderOrder = 900;
    sky.frustumCulled = false;
    scene.add(sky);

    // Daytime white egrets gliding gently over Xin'an Lake, Shuitingmen & Fushan Park.
    const birdGroup = new T.Group();
    const birdMat = new T.MeshBasicMaterial({ color: '#fafaf7', side: T.DoubleSide });
    const wingGeo = new T.PlaneGeometry(.72, .26);
    wingGeo.translate(.36, 0, 0);
    const birdBodyGeo = new T.BoxGeometry(.14, .11, .52);
    const birds = [];
    const birdCenters = [
      { x: 350, z: 40, r: 95, y: 34 }, { x: 80, z: 50, r: 72, y: 39 },
      { x: -180, z: -70, r: 82, y: 36 }, { x: 240, z: -130, r: 88, y: 42 },
    ];
    for (let i = 0; i < 16; i++) {
      const home = birdCenters[i % birdCenters.length];
      const bird = new T.Group();
      const body = new T.Mesh(birdBodyGeo, birdMat);
      const leftWing = new T.Mesh(wingGeo, birdMat);
      const rightWing = new T.Mesh(wingGeo, birdMat);
      leftWing.rotation.x = -Math.PI / 2;
      rightWing.rotation.x = -Math.PI / 2;
      rightWing.scale.x = -1;
      bird.add(body, leftWing, rightWing);
      birdGroup.add(bird);
      birds.push({
        mesh: bird, leftWing, rightWing,
        cx: home.x + (i % 3 - 1) * 18, cz: home.z + (i % 2 ? 14 : -14),
        radius: home.r * (.68 + (i % 5) * .11),
        altitude: home.y + (i % 4) * 4.5,
        speed: .11 + (i % 5) * .018,
        phase: i * 1.37,
        flap: 3.8 + (i % 4) * .55,
        dir: i % 2 ? 1 : -1,
      });
    }
    scene.add(birdGroup);

    const atmoRng = rng(20260519);
    const dprVal = () => Math.min(2, window.devicePixelRatio || 1);
    const haloAnchors = fixtures.map(f => ({ x: f.x, y: f.y, z: f.z, color: f.color, scale: clamp(f.range * .16, 1.5, 4.4) }));
    for (const extra of [
      { x: -180, y: 11.2, z: -80, color: '#ffae63', scale: 4.8 },
      { x: -191, y: 11.0, z: -80, color: '#ff9c54', scale: 3.4 },
      { x: -169, y: 11.0, z: -80, color: '#ff9c54', scale: 3.4 },
      { x: -90, y: 13.5, z: -104, color: '#ffc97d', scale: 4.5 },
      { x: -90, y: 24.5, z: -104, color: '#ffd996', scale: 4.2 },
      { x: 33, y: 14.2, z: -104, color: '#ffd287', scale: 4.6 },
      { x: 161.4, y: 5.5, z: -9.8, color: '#ffc275', scale: 4.2 },
      { x: 161.4, y: 7.4, z: -21.0, color: '#ffd186', scale: 4.6 },
      { x: 184, y: 16.5, z: 76, color: '#ffd78d', scale: 4.4 },
      { x: 73.3, y: 3.4, z: 126.2, color: '#ff9a52', scale: 3.6 },
      { x: 66.2, y: 3.3, z: 126.2, color: '#ff8e47', scale: 3.0 },
      { x: 80.4, y: 3.3, z: 126.2, color: '#ff8e47', scale: 3.0 },
      { x: 73.3, y: 3.4, z: 135.8, color: '#ffa85c', scale: 3.6 },
      { x: -94, y: 9.8, z: 140, color: '#ffb56c', scale: 4.4 },
      { x: 327.9, y: 2.75, z: 107.0, color: '#ffad5e', scale: 3.2 },
      { x: 327.9, y: 2.75, z: 114.4, color: '#78e6cf', scale: 2.8 },
      { x: 327.9, y: 2.75, z: 122.0, color: '#ffba6e', scale: 3.2 },
      { x: 356, y: 3.1, z: 204.2, color: '#ffd894', scale: 3.6 },
      { x: 631, y: 14.5, z: 139, color: '#8ff5e0', scale: 5.4 },
    ]) haloAnchors.push({ ...extra, color: new T.Color(extra.color) });
    const haloPos = new Float32Array(haloAnchors.length * 3);
    const haloCol = new Float32Array(haloAnchors.length * 3);
    const haloScale = new Float32Array(haloAnchors.length);
    const haloPhase = new Float32Array(haloAnchors.length);
    for (let i = 0; i < haloAnchors.length; i++) {
      const h = haloAnchors[i];
      haloPos[i * 3] = h.x; haloPos[i * 3 + 1] = h.y; haloPos[i * 3 + 2] = h.z;
      haloCol[i * 3] = h.color.r; haloCol[i * 3 + 1] = h.color.g; haloCol[i * 3 + 2] = h.color.b;
      haloScale[i] = h.scale;
      haloPhase[i] = atmoRng() * Math.PI * 2;
    }
    const haloGeo = new T.BufferGeometry();
    haloGeo.setAttribute('position', new T.BufferAttribute(haloPos, 3));
    haloGeo.setAttribute('aColor', new T.BufferAttribute(haloCol, 3));
    haloGeo.setAttribute('aScale', new T.BufferAttribute(haloScale, 1));
    haloGeo.setAttribute('aPhase', new T.BufferAttribute(haloPhase, 1));
    const lanternHaloUniforms = {
      uTime: weatherTime, uPracticals: { value: 0 }, uMist: { value: 0 }, uPixelRatio: { value: dprVal() },
    };
    const lanternHalos = new T.Points(haloGeo, new T.ShaderMaterial({
      uniforms: lanternHaloUniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
      vertexShader: [
        'attribute vec3 aColor; attribute float aScale, aPhase;',
        'uniform float uTime, uPracticals, uMist, uPixelRatio;',
        'varying vec3 vColor; varying float vAlpha;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  float dist = max(1.5, -mv.z);',
        '  float pulse = .90 + .10 * sin(uTime * 2.4 + aPhase) * cos(uTime * 1.15 + aPhase * .7);',
        '  float fade = smoothstep(2.0, 6.2, dist) * (1.0 - smoothstep(145.0, 320.0, dist));',
        '  vColor = aColor;',
        '  vAlpha = uPracticals * pulse * fade * (.38 + uMist * .26);',
        '  float sz = aScale * (1.0 + uMist * .44) * uPixelRatio * (340.0 / dist);',
        '  gl_PointSize = clamp(sz, 1.5, 84.0);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor; varying float vAlpha;',
        'void main(){',
        '  float d = length(gl_PointCoord - .5) * 2.0;',
        '  if (d > 1.0 || vAlpha < .004) discard;',
        '  float core = exp(-d * d * 5.2);',
        '  float halo = pow(max(0.0, 1.0 - d), 2.35) * .56;',
        '  gl_FragColor = vec4(vColor * (core * .95 + halo), (core + halo) * vAlpha);',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    }));
    lanternHalos.frustumCulled = false;
    lanternHalos.renderOrder = 415;
    lanternHalos.visible = false;
    scene.add(lanternHalos);

    const riverLanternSpecs = [];
    for (let i = 0; i < 36; i++) {
      riverLanternSpecs.push({
        baseX: 345 + atmoRng() * 48, baseZ: 68 + atmoRng() * 158, baseY: -.40,
        driftX: (atmoRng() - .5) * 3.8, driftZ: (atmoRng() - .5) * 4.4,
        speed: .18 + atmoRng() * .22, phase: atmoRng() * Math.PI * 2, spin: (atmoRng() - .5) * .35,
        color: new T.Color(i % 3 === 0 ? '#ffd07a' : i % 3 === 1 ? '#ff9d62' : '#ffbb76'),
      });
    }
    if (Y?.WATER_POLYGONS?.[0]) {
      const nanhuPts = Y.WATER_POLYGONS[0].pts;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const pt of nanhuPts) { minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x); minZ = Math.min(minZ, pt.z); maxZ = Math.max(maxZ, pt.z); }
      let added = 0;
      for (let tries = 0; tries < 240 && added < 14; tries++) {
        const rx = minX + atmoRng() * (maxX - minX);
        const rz = minZ + atmoRng() * (maxZ - minZ);
        if (!Y.inAnyWater(rx, rz, 0) || Y.onAnyRoad(rx, rz, 3.0)) continue;
        riverLanternSpecs.push({
          baseX: rx, baseZ: rz, baseY: .045,
          driftX: (atmoRng() - .5) * 1.8, driftZ: (atmoRng() - .5) * 1.8,
          speed: .15 + atmoRng() * .18, phase: atmoRng() * Math.PI * 2, spin: (atmoRng() - .5) * .3,
          color: new T.Color(added % 2 === 0 ? '#ffcf78' : '#ffa168'),
        });
        added++;
      }
    }
    const riverLanternGroup = new T.Group();
    const rlBodyGeo = new T.CylinderGeometry(.22, .14, .26, 6);
    const rlBodyMat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, toneMapped: false });
    const riverLanternMesh = new T.InstancedMesh(rlBodyGeo, rlBodyMat, riverLanternSpecs.length);
    riverLanternMesh.frustumCulled = false;
    riverLanternMesh.renderOrder = 412;
    const rlGlowPos = new Float32Array(riverLanternSpecs.length * 3);
    const rlGlowCol = new Float32Array(riverLanternSpecs.length * 3);
    const rlGlowPhase = new Float32Array(riverLanternSpecs.length);
    const rlDummy = new T.Object3D();
    for (let i = 0; i < riverLanternSpecs.length; i++) {
      const s = riverLanternSpecs[i];
      rlDummy.position.set(s.baseX, s.baseY, s.baseZ);
      rlDummy.updateMatrix();
      riverLanternMesh.setMatrixAt(i, rlDummy.matrix);
      riverLanternMesh.setColorAt(i, s.color);
      rlGlowPos[i * 3] = s.baseX; rlGlowPos[i * 3 + 1] = s.baseY + .24; rlGlowPos[i * 3 + 2] = s.baseZ;
      rlGlowCol[i * 3] = s.color.r; rlGlowCol[i * 3 + 1] = s.color.g; rlGlowCol[i * 3 + 2] = s.color.b;
      rlGlowPhase[i] = s.phase;
    }
    riverLanternMesh.instanceMatrix.needsUpdate = true;
    if (riverLanternMesh.instanceColor) riverLanternMesh.instanceColor.needsUpdate = true;
    const rlGlowGeo = new T.BufferGeometry();
    rlGlowGeo.setAttribute('position', new T.BufferAttribute(rlGlowPos, 3).setUsage(T.DynamicDrawUsage));
    rlGlowGeo.setAttribute('aColor', new T.BufferAttribute(rlGlowCol, 3));
    rlGlowGeo.setAttribute('aPhase', new T.BufferAttribute(rlGlowPhase, 1));
    const riverLanternUniforms = { uTime: weatherTime, uAlpha: { value: 0 }, uPixelRatio: { value: dprVal() } };
    const riverLanternGlow = new T.Points(rlGlowGeo, new T.ShaderMaterial({
      uniforms: riverLanternUniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
      vertexShader: [
        'attribute vec3 aColor; attribute float aPhase;',
        'uniform float uTime, uAlpha, uPixelRatio;',
        'varying vec3 vColor; varying float vAlpha;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  float dist = max(1.5, -mv.z);',
        '  vColor = aColor;',
        '  vAlpha = uAlpha * (.86 + .14 * sin(uTime * 2.8 + aPhase)) * (1.0 - smoothstep(140.0, 320.0, dist));',
        '  gl_PointSize = clamp(2.4 * uPixelRatio * (320.0 / dist), 2.0, 56.0);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor; varying float vAlpha;',
        'void main(){',
        '  float d = length(gl_PointCoord - .5) * 2.0;',
        '  if (d > 1.0 || vAlpha < .004) discard;',
        '  float g = exp(-d * d * 4.2) * .85 + pow(max(0.0, 1.0 - d), 2.2) * .45;',
        '  gl_FragColor = vec4(vColor * g, g * vAlpha);',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    }));
    riverLanternGlow.frustumCulled = false;
    riverLanternGlow.renderOrder = 416;
    riverLanternGroup.add(riverLanternMesh, riverLanternGlow);
    riverLanternGroup.visible = false;
    scene.add(riverLanternGroup);

    const skyLanternSpecs = [];
    const skyLanternZones = [
      { cx: 392, cz: 148, rx: 68, rz: 108, count: 16 },
      { cx: -175, cz: -72, rx: 46, rz: 44, count: 6 },
      { cx: 180, cz: 76, rx: 52, rz: 48, count: 6 },
    ];
    for (const zc of skyLanternZones) {
      for (let i = 0; i < zc.count; i++) {
        skyLanternSpecs.push({
          baseX: zc.cx + (atmoRng() - .5) * zc.rx * 2,
          baseZ: zc.cz + (atmoRng() - .5) * zc.rz * 2,
          baseY: 4.5 + atmoRng() * 8.0,
          maxRise: 56 + atmoRng() * 34,
          driftX: 8 + atmoRng() * 14,
          driftZ: (atmoRng() - .45) * 18,
          speed: .015 + atmoRng() * .014,
          phase: atmoRng(),
          sway: 1.4 + atmoRng() * 2.2,
          color: new T.Color(i % 3 === 0 ? '#ffd584' : i % 3 === 1 ? '#ffa95c' : '#ffbe6e'),
        });
      }
    }
    const skyLanternGroup = new T.Group();
    const slBodyGeo = new T.CylinderGeometry(.32, .20, .56, 6);
    const slBodyMat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, toneMapped: false });
    const skyLanternMesh = new T.InstancedMesh(slBodyGeo, slBodyMat, skyLanternSpecs.length);
    skyLanternMesh.frustumCulled = false;
    skyLanternMesh.renderOrder = 413;
    const slGlowPos = new Float32Array(skyLanternSpecs.length * 3);
    const slGlowCol = new Float32Array(skyLanternSpecs.length * 3);
    const slGlowPhase = new Float32Array(skyLanternSpecs.length);
    const slDummy = new T.Object3D();
    for (let i = 0; i < skyLanternSpecs.length; i++) {
      const s = skyLanternSpecs[i];
      slDummy.position.set(s.baseX, s.baseY, s.baseZ);
      slDummy.updateMatrix();
      skyLanternMesh.setMatrixAt(i, slDummy.matrix);
      skyLanternMesh.setColorAt(i, s.color);
      slGlowPos[i * 3] = s.baseX; slGlowPos[i * 3 + 1] = s.baseY; slGlowPos[i * 3 + 2] = s.baseZ;
      slGlowCol[i * 3] = s.color.r; slGlowCol[i * 3 + 1] = s.color.g; slGlowCol[i * 3 + 2] = s.color.b;
      slGlowPhase[i] = s.phase * Math.PI * 2;
    }
    skyLanternMesh.instanceMatrix.needsUpdate = true;
    if (skyLanternMesh.instanceColor) skyLanternMesh.instanceColor.needsUpdate = true;
    const slGlowGeo = new T.BufferGeometry();
    slGlowGeo.setAttribute('position', new T.BufferAttribute(slGlowPos, 3).setUsage(T.DynamicDrawUsage));
    slGlowGeo.setAttribute('aColor', new T.BufferAttribute(slGlowCol, 3));
    slGlowGeo.setAttribute('aPhase', new T.BufferAttribute(slGlowPhase, 1));
    const skyLanternUniforms = { uTime: weatherTime, uAlpha: { value: 0 }, uPixelRatio: { value: dprVal() } };
    const skyLanternGlow = new T.Points(slGlowGeo, new T.ShaderMaterial({
      uniforms: skyLanternUniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
      vertexShader: [
        'attribute vec3 aColor; attribute float aPhase;',
        'uniform float uTime, uAlpha, uPixelRatio;',
        'varying vec3 vColor; varying float vAlpha;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  float dist = max(2.0, -mv.z);',
        '  float heightFade = smoothstep(4.5, 11.0, position.y) * (1.0 - smoothstep(66.0, 96.0, position.y));',
        '  vColor = aColor;',
        '  vAlpha = uAlpha * heightFade * (.84 + .16 * sin(uTime * 3.1 + aPhase)) * (1.0 - smoothstep(220.0, 440.0, dist));',
        '  gl_PointSize = clamp(3.4 * uPixelRatio * (340.0 / dist), 2.0, 48.0);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor; varying float vAlpha;',
        'void main(){',
        '  float d = length(gl_PointCoord - .5) * 2.0;',
        '  if (d > 1.0 || vAlpha < .004) discard;',
        '  float g = exp(-d * d * 4.4) * .88 + pow(max(0.0, 1.0 - d), 2.3) * .42;',
        '  gl_FragColor = vec4(vColor * g, g * vAlpha);',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    }));
    skyLanternGlow.frustumCulled = false;
    skyLanternGlow.renderOrder = 417;
    skyLanternGroup.add(skyLanternMesh, skyLanternGlow);
    skyLanternGroup.visible = false;
    scene.add(skyLanternGroup);

    const plumeSources = [
      { x: 329.0, y: 1.80, z: 105.7, count: 22, h: 3.8, size: 1.05, speed: .26, color: '#f4e6d2' },
      { x: 329.0, y: 1.80, z: 106.5, count: 22, h: 3.9, size: 1.12, speed: .24, color: '#f7e3c9' },
      { x: 329.0, y: 1.72, z: 121.6, count: 22, h: 3.5, size: 1.02, speed: .25, color: '#f0e3cf' },
      { x: 329.0, y: 1.72, z: 122.4, count: 18, h: 3.4, size: .98, speed: .27, color: '#f3e5d2' },
      { x: 70.8, y: 2.15, z: 126.4, count: 22, h: 4.1, size: 1.16, speed: .23, color: '#f5e2c6' },
      { x: 75.8, y: 2.15, z: 135.4, count: 22, h: 4.0, size: 1.14, speed: .24, color: '#f4e4cd' },
      { x: 161.4, y: 1.45, z: -15.4, count: 32, h: 5.4, size: .98, speed: .15, color: '#dcece7' },
      { x: 158.8, y: 1.32, z: -8.6, count: 24, h: 4.4, size: .84, speed: .16, color: '#d7eae6' },
      { x: 164.0, y: 1.32, z: -8.6, count: 24, h: 4.4, size: .84, speed: .16, color: '#d7eae6' },
      { x: -152.0, y: 2.35, z: -70.0, count: 18, h: 4.2, size: 1.05, speed: .20, color: '#eae2d4' },
    ];
    const totalPlumes = plumeSources.reduce((acc, s) => acc + s.count, 0);
    const plPos = new Float32Array(totalPlumes * 3);
    const plSeed = new Float32Array(totalPlumes * 4);
    const plStyle = new Float32Array(totalPlumes * 2);
    const plCol = new Float32Array(totalPlumes * 3);
    let plIdx = 0;
    for (const src of plumeSources) {
      const col = new T.Color(src.color);
      for (let i = 0; i < src.count; i++) {
        plPos[plIdx * 3] = src.x + (atmoRng() - .5) * .38;
        plPos[plIdx * 3 + 1] = src.y;
        plPos[plIdx * 3 + 2] = src.z + (atmoRng() - .5) * .38;
        plSeed[plIdx * 4] = i / src.count + atmoRng() * .05;
        plSeed[plIdx * 4 + 1] = (atmoRng() - .32) * .68;
        plSeed[plIdx * 4 + 2] = (atmoRng() - .5) * .58;
        plSeed[plIdx * 4 + 3] = src.speed * (.88 + atmoRng() * .26);
        plStyle[plIdx * 2] = src.h * (.86 + atmoRng() * .28);
        plStyle[plIdx * 2 + 1] = src.size * (.85 + atmoRng() * .35);
        plCol[plIdx * 3] = col.r; plCol[plIdx * 3 + 1] = col.g; plCol[plIdx * 3 + 2] = col.b;
        plIdx++;
      }
    }
    const plumeGeo = new T.BufferGeometry();
    plumeGeo.setAttribute('position', new T.BufferAttribute(plPos, 3));
    plumeGeo.setAttribute('aSeed', new T.BufferAttribute(plSeed, 4));
    plumeGeo.setAttribute('aStyle', new T.BufferAttribute(plStyle, 2));
    plumeGeo.setAttribute('aColor', new T.BufferAttribute(plCol, 3));
    const plumeUniforms = {
      uTime: weatherTime, uPracticals: { value: 0 }, uRain: raining, uMist: { value: 0 }, uPixelRatio: { value: dprVal() },
    };
    const plumeMesh = new T.Points(plumeGeo, new T.ShaderMaterial({
      uniforms: plumeUniforms, transparent: true, depthWrite: false, blending: T.NormalBlending, toneMapped: false,
      vertexShader: [
        'attribute vec4 aSeed; attribute vec2 aStyle; attribute vec3 aColor;',
        'uniform float uTime, uPracticals, uRain, uMist, uPixelRatio;',
        'varying vec3 vColor; varying float vAlpha;',
        'void main(){',
        '  float age = fract(uTime * aSeed.w + aSeed.x);',
        '  float swirl = sin(uTime * 1.45 + aSeed.x * 12.56 + age * 4.5) * (.18 + age * .34);',
        '  vec3 p = position + vec3(aSeed.y * age * 1.35 + swirl, age * aStyle.x, aSeed.z * age * 1.25 + cos(age * 3.8 + aSeed.x * 9.0) * .16);',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  float dist = max(1.2, -mv.z);',
        '  float lifeAlpha = smoothstep(0.0, .18, age) * (1.0 - smoothstep(.52, 1.0, age));',
        '  float distFade = smoothstep(1.2, 3.2, dist) * (1.0 - smoothstep(48.0, 92.0, dist));',
        '  vColor = mix(aColor, aColor * vec3(1.06, .88, .66), uPracticals * .68);',
        '  vAlpha = lifeAlpha * distFade * (.21 + uPracticals * .09 + uMist * .07) * (1.0 - uRain * .74);',
        '  float sz = aStyle.y * (.64 + age * 1.48) * uPixelRatio * (340.0 / dist);',
        '  gl_PointSize = clamp(sz, 2.0, 74.0);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor; varying float vAlpha;',
        'void main(){',
        '  float d = length(gl_PointCoord - .5) * 2.0;',
        '  if (d > 1.0 || vAlpha < .004) discard;',
        '  float soft = pow(max(0.0, 1.0 - d), 1.65);',
        '  gl_FragColor = vec4(vColor, soft * vAlpha);',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    }));
    plumeMesh.frustumCulled = false;
    plumeMesh.renderOrder = 414;
    scene.add(plumeMesh);

    const headland = window.Tideline.MARINE?.island;
    const seaUniforms = {
      time: { value: 0 }, base: { value: new T.Color() }, pale: { value: new T.Color() },
      haze: { value: new T.Color() }, shine: { value: new T.Color() },
      sun: skyUniforms.sun, moonDir: skyUniforms.moonDir, day: { value: 1 }, night: skyUniforms.night, mist: skyUniforms.mist,
      island: { value: headland ? new T.Vector4(headland.x, headland.z, headland.rx, headland.rz) : new T.Vector4(4000, 4000, 1, 1) },
      waterMirror: roadReflection.image, mirrorProject: roadReflection.projection, reflection: roadReflection.waterStrength,
      rain: raining,
    };
    const water = new T.Mesh(new T.PlaneGeometry(3200, 3200), new T.ShaderMaterial({
      uniforms: seaUniforms,
      vertexShader: [
        'varying vec3 vWorld;',
        'void main(){ vec4 world = modelMatrix * vec4(position,1.); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }',
      ].join('\n'),
      fragmentShader: [
        'uniform float time,day,reflection,rain,night,mist;',
        'uniform vec3 base,pale,haze,shine,sun,moonDir;',
        'uniform vec4 island;',
        'uniform sampler2D waterMirror; uniform mat4 mirrorProject;',
        'varying vec3 vWorld;',
        'void main(){',
        '  vec2 p=vWorld.xz; vec3 v = normalize(cameraPosition-vWorld);',
        '  float dist = distance(cameraPosition,vWorld);',
        '  float drift = sin(dot(p,vec2(.044,.057))+time*.48);',
        '  float swell = sin(dot(p,vec2(.086,-.028))+time*.53);',
        '  float a = sin(dot(p,vec2(.31,.44)) + time*.95 + drift*1.47);',
        '  float b = sin(dot(p,vec2(-.88,.29)) - time*1.67 + swell*1.83);',
        '  float c = sin(dot(p,vec2(1.8,.74)) + time*1.96 + a*.51 + drift*2.);',
        '  float d = sin(dot(p,vec2(-2.29,2.27)) - time*2.16 + b*.63);',
        '  float detail = 1.0-smoothstep(.15,1.45,max(length(dFdx(p)),length(dFdy(p))));',
        '  float wave = .50 + .102*swell + .10*a + (.078*b + .051*c + .02*d)*detail;',
        '  vec3 n = normalize(vec3(a*.056-b*.065+(c*.027+d*.014)*detail,1.,a*.089+b*.033+(c*.024-d*.018)*detail));',
        '  float fresnel = .054 + .946*pow(1.0-max(0.,dot(v,n)),4.2);',
        '  vec3 col = mix(base*(.92+.25*wave),pale,clamp(wave*.16+fresnel*.68,0.,1.));',
        '  float fromIsland = max(0.,length((p-island.xy)/island.zw)-1.)*island.w;',
        '  float fromCoast = length(p-clamp(p,vec2(-326.,-324.),vec2(339.,328.)));',
        '  float shore = min(fromIsland,fromCoast);',
        '  float shallows = 1.0-smoothstep(1.3,24.5,shore);',
        '  vec3 shallowWater = mix(base,pale,.52)*vec3(.74,1.24,1.19);',
        '  col = mix(col,shallowWater,shallows*.45);',
        '  float lace = sin(shore*1.64 + drift*1.23 + swell*2.05 - time*.95);',
        '  float brokenEdge = smoothstep(.16,.68,wave+b*.19+c*.081);',
        '  col += pale * pow(shallows,6.) * smoothstep(.78,.99,lace) * brokenEdge * (.29+.71*day) * .75;',
        '  float spec = pow(max(0.,dot(reflect(-sun,n),v)),73.) * smoothstep(.26,.72,wave);',
        '  col += shine * spec * 1.74 * day * (1.-rain*.61) * (1.-mist*.45);',
        '  float moonSpec = pow(max(0.,dot(reflect(-moonDir,n),v)),46.) * smoothstep(.24,.74,wave);',
        '  col += vec3(.78,.89,1.0) * moonSpec * 1.15 * night * (1.-rain*.75) * (1.-mist*.55);',
        '  float shoreRipple = .55 + .45 * sin(p.y * .26 + time * 1.35 + a * .6) * cos(p.x * .19 - time * .85);',
        '  col += vec3(1.0,.66,.32) * pow(shallows,2.1) * shoreRipple * night * (1.-rain*.25) * .30;',
        '  if(reflection>.01){',
        '    vec4 projected = mirrorProject*vec4(vWorld,1.);',
        '    vec2 at = projected.xy/max(.01,projected.w);',
        '    float border = smoothstep(.014,.111,min(min(at.x,at.y),1.-max(at.x,at.y)))*step(.02,projected.w);',
        '    vec2 ripple = vec2(a*.010+b*.007 + c*.002*detail, b*.010-a*.003+d*.0015*detail);',
        '    vec3 sampleColor = texture2D(waterMirror,clamp(at+ripple,.001,.999),1.0+.85*rain).rgb;',
        '    col = mix(col, sampleColor*vec3(.72,.88,.90), fresnel*border*reflection*.66);',
        '  }',
        '  col = mix(col,haze,pow(clamp((dist-38.*(1.-mist*.45))/(965.*(1.-mist*.62)),0.,1.),.83)*.92);',
        '  gl_FragColor=vec4(col,1.);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -.47;
    water.renderOrder = 400;
    scene.add(water);

    const fog = new T.Fog('#cce2f2', 175, 920);
    scene.fog = fog;
    const hemi = new T.HemisphereLight('#d8ecff', '#c6baa4', 1.56);
    const sun = new T.DirectionalLight('#fff3db', 2.82);
    sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -76, right: 76, top: 76, bottom: -76, near: 80, far: 370 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = .034;
    sun.shadow.bias = -.00016;
    sun.shadow.autoUpdate = false;
    const lamps = [new T.PointLight('#fff2ce', 0, 22, 2), new T.PointLight('#b9fffb', 0, 22, 2)];
    const headlights = new T.SpotLight('#ffefcf', 0, 46, Math.PI * .19, .71, 2);
    scene.add(hemi, sun, sun.target, ...lamps, headlights, headlights.target);
    const sampledDirection = new T.Vector3();
    const sampledFocus = new T.Vector3(0, 0, -10000);
    const groundAtDay = new T.Color('#7c7264');
    const groundAtNight = new T.Color('#50515a');
    const mistFogDay = new T.Color('#c8dbd9');
    const mistFogNight = new T.Color('#394c56');
    const mistFogBlend = new T.Color();
    let lastSunSample = -100;

    function localLighting(center, vehicle, night, practicals, elapsed, sunDirection, options) {
      const dynamic = options?.extraLights !== false;
      // Three.js specializes shaders for the number of visible lights. Keep that number fixed within each profile.
      for (const lamp of lamps) {
        lamp.visible = dynamic;
        lamp.intensity = 0;
      }
      headlights.visible = dynamic;
      headlights.intensity = 0;
      const wasCasting = sun.castShadow;
      const shadowSize = options?.shadowSize ?? (options?.shadows ? 1536 : 0);
      sun.castShadow = Boolean(center && shadowSize);
      if (shadowSize && sun.shadow.mapSize.x !== shadowSize) {
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        sun.shadow.mapSize.set(shadowSize, shadowSize);
        const half = shadowSize >= 3072 ? 66 : 76;
        Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
        sun.shadow.camera.updateProjectionMatrix();
        sun.shadow.normalBias = shadowSize >= 3072 ? .026 : .045;
        sun.shadow.needsUpdate = true;
      }
      if (!center) {
        sun.target.position.set(0, 0, 0);
        return;
      }
      const closest = [];
      if (dynamic && practicals > .08) {
        for (const item of fixtures) {
          const span = distance(center, item);
          if (span <= item.range + 7) closest.push({ item, span });
        }
        closest.sort((a, b) => a.span - b.span);
      }
      for (const [index, light] of lamps.entries()) {
        const found = closest[index];
        if (!found) continue;
        const { item, span } = found;
        light.position.set(item.x, item.y, item.z);
        light.color.copy(item.color);
        light.distance = item.range;
        light.intensity = item.intensity * practicals * clamp((item.range + 7 - span) / 7, 0, 1);
      }
      if (vehicle && dynamic) {
        const x = Math.sin(vehicle.yaw);
        const z = Math.cos(vehicle.yaw);
        headlights.position.set(vehicle.x + x * 1.91, .71, vehicle.z + z * 1.91);
        headlights.target.position.set(vehicle.x + x * 16, .04, vehicle.z + z * 16);
        const override = vehicle.showroomLit ? 'on' : (vehicle.photoLit ?? vehicle.manualLights ?? 'auto');
        if (vehicle.customBeamMat?.color) headlights.color.copy(vehicle.customBeamMat.color);
        else headlights.color.set('#ffefcf');
        headlights.intensity = override === 'off' ? 0
          : override === 'on' ? Math.max(115, 12 + practicals * 155)
          : (practicals > .12 ? 12 + practicals * 155 : 0);
      }
      if (!sun.castShadow) return;
      const cx = Math.round(center.x / 21) * 21;
      const cz = Math.round(center.z / 21) * 21;
      const fast = shadowSize >= 1400;
      const refresh = night > .82 ? .46 : fast ? .17 : .32;
      const approach = Math.hypot(sampledFocus.x - center.x, sampledFocus.z - center.z) > (fast ? (vehicle ? 1.65 : .85) : 4.2);
      if (!wasCasting || sun.target.position.x !== cx || sun.target.position.z !== cz ||
          sampledDirection.dot(sunDirection) < .9998 || (approach && elapsed - lastSunSample >= refresh)) {
        sun.target.position.set(cx, 0, cz);
        sampledDirection.copy(sunDirection);
        sampledFocus.set(center.x, 0, center.z);
        lastSunSample = elapsed;
        sun.shadow.needsUpdate = true;
      }
    }
    const colorSets = {
      day: ['#1962b8', '#b8d9f2', '#fff6df', '#185c74', '#6fb6c8', '#b6d2e8', '#fff4d4', '#9bc6f0', '#fff0d0'],
      dusk: ['#2b4b80', '#e89d6c', '#ffc98a', '#1d4a64', '#6e9aa8', '#b89e92', '#f7b978', '#b2c8e2', '#ffc788'],
      night: ['#112136', '#43566a', '#aebdd3', '#132a38', '#2d5264', '#354453', '#7e9dca', '#a8bedb', '#b6c6e1'],
    };
    for (const key of Object.keys(colorSets)) colorSets[key] = colorSets[key].map(c => new T.Color(c));
    const hourBlend = [skyUniforms.topColor.value, skyUniforms.lowColor.value, skyUniforms.sunColor.value, seaUniforms.base.value,
      seaUniforms.pale.value, fog.color, seaUniforms.shine.value, hemi.color, sun.color];
    const wetFog = new T.Color('#7a92a4');
    function light(hour, elapsed, camera, moisture = .02, rain = 0, local = null) {
      const mist = clamp(local?.mist ?? 0, 0, 1);
      const evening = hour > 14 ? clamp((hour - 15.4) / 2.75, 0, 1) : clamp((8.3 - hour) / 2.5, 0, 1);
      const night = hour > 14 ? clamp((hour - 18.53) / 1.98, 0, 1) : clamp((6.52 - hour) / 2.05, 0, 1);
      const practicals = Math.min(1, evening * .32 + night * .67 + rain * .19 + mist * .24);
      for (let i = 0; i < hourBlend.length; i++) {
        hourBlend[i].copy(colorSets.day[i]).lerp(colorSets.dusk[i], evening).lerp(colorSets.night[i], night);
      }
      fog.color.lerp(wetFog, rain * .38);
      if (mist > .005) {
        mistFogBlend.copy(mistFogDay).lerp(mistFogNight, night);
        fog.color.lerp(mistFogBlend, mist * .62);
      }
      const baseNear = streetDistance ? 135 - rain * 35 : 260 - evening * 45 - rain * 95;
      const baseFar = streetDistance ? streetDistance * 1.25 - rain * 55 : 1140 - evening * 160 - rain * 420;
      fog.near = Math.max(18, baseNear * (1 - mist * .68));
      fog.far = Math.max(155, baseFar * (1 - mist * .64));
      wet.value = moisture;
      raining.value = rain;
      weatherTime.value = elapsed;
      seaUniforms.time.value = elapsed;
      seaUniforms.haze.value.copy(fog.color);
      seaUniforms.day.value = 1 - night * .92;
      skyUniforms.daylight.value = (1 - night * .93) * (1 - rain * .54) * (1 - mist * .18);
      skyUniforms.stars.value = night * (1 - rain * .94) * (1 - mist * .48);
      skyUniforms.overcast.value = clamp(rain + mist * .42, 0, 1);
      skyUniforms.night.value = night;
      skyUniforms.mist.value = mist;
      skyUniforms.duskMix.value = Math.pow(evening, 1.7) * Math.pow(1 - night, 2.35) * (1 - rain * .94) * .84;
      const dayProgress = clamp((hour - 5.5) / 13.0, 0, 1);
      const sunAzimuth = (dayProgress - .5) * 1.42;
      const sunElev = .13 + Math.sin(dayProgress * Math.PI) * .58;
      skyUniforms.sun.value.set(Math.sin(sunAzimuth) * .88, sunElev, -Math.cos(sunAzimuth) * .88).normalize().lerp(moon, night * night).normalize();
      localLighting(local?.center, local?.vehicle, night, practicals, elapsed, skyUniforms.sun.value, local);
      sun.position.copy(skyUniforms.sun.value).multiplyScalar(220).add(sun.target.position);
      sun.intensity = (4.65 - evening * .30 - night * 3.85) * (1 - rain * .52) * (1 - mist * .26);
      hemi.intensity = .46 - evening * .08 - night * .24 + rain * .16 + mist * .12;
      hemi.groundColor.copy(groundAtDay).lerp(groundAtNight, Math.min(1, evening * .35 + night));
      roadSun.value.copy(skyUniforms.sun.value);
      roadTint.value.copy(sun.color).lerp(wetFog, .75 * night);
      roadSky.value.copy(skyUniforms.topColor.value);
      roadHorizon.value.copy(skyUniforms.lowColor.value);
      sky.position.copy(camera.position);
      birdGroup.visible = night < .45 && rain < .5 && mist < .85;
      if (birdGroup.visible) {
        for (const b of birds) {
          const angle = b.phase + elapsed * b.speed * b.dir;
          const bx = b.cx + Math.cos(angle) * b.radius;
          const bz = b.cz + Math.sin(angle) * b.radius;
          const by = b.altitude + Math.sin(elapsed * .6 + b.phase) * 2.4;
          b.mesh.position.set(bx, by, bz);
          b.mesh.rotation.y = Math.atan2(-Math.sin(angle) * b.dir, Math.cos(angle) * b.dir);
          const glide = Math.sin(elapsed * b.flap + b.phase) * .42 * (Math.sin(elapsed * .45 + b.phase) > -.25 ? 1 : .12);
          b.leftWing.rotation.z = glide;
          b.rightWing.rotation.z = -glide;
        }
      }
      const curDpr = dprVal();
      lanternHaloUniforms.uPracticals.value = practicals;
      lanternHaloUniforms.uMist.value = mist;
      lanternHaloUniforms.uPixelRatio.value = curDpr;
      lanternHalos.visible = practicals > .06;
      plumeUniforms.uPracticals.value = practicals;
      plumeUniforms.uMist.value = mist;
      plumeUniforms.uPixelRatio.value = curDpr;
      plumeMesh.visible = rain < .96;
      const lanternTime = Math.min(1, evening * .48 + night * .86);
      const rlAlpha = clamp((lanternTime - .18) / .50, 0, 1) * (1 - rain * .35);
      riverLanternGroup.visible = rlAlpha > .02;
      if (riverLanternGroup.visible) {
        rlBodyMat.opacity = .88 * rlAlpha;
        riverLanternUniforms.uAlpha.value = .62 * rlAlpha;
        riverLanternUniforms.uPixelRatio.value = curDpr;
        for (let i = 0; i < riverLanternSpecs.length; i++) {
          const s = riverLanternSpecs[i];
          const lx = s.baseX + Math.sin(elapsed * s.speed + s.phase) * s.driftX;
          const lz = s.baseZ + Math.cos(elapsed * s.speed * .82 + s.phase) * s.driftZ;
          const ly = s.baseY + Math.sin(elapsed * 1.55 + s.phase) * .055;
          rlDummy.position.set(lx, ly, lz);
          rlDummy.rotation.set(Math.sin(elapsed * 1.1 + s.phase) * .08, elapsed * s.spin + s.phase, Math.cos(elapsed * .95 + s.phase) * .08);
          rlDummy.updateMatrix();
          riverLanternMesh.setMatrixAt(i, rlDummy.matrix);
          rlGlowPos[i * 3] = lx; rlGlowPos[i * 3 + 1] = ly + .24; rlGlowPos[i * 3 + 2] = lz;
        }
        riverLanternMesh.instanceMatrix.needsUpdate = true;
        rlGlowGeo.attributes.position.needsUpdate = true;
      }
      const slAlpha = clamp((lanternTime - .22) / .48, 0, 1) * (1 - rain * .82);
      skyLanternGroup.visible = slAlpha > .02;
      if (skyLanternGroup.visible) {
        slBodyMat.opacity = .90 * slAlpha;
        skyLanternUniforms.uAlpha.value = .68 * slAlpha;
        skyLanternUniforms.uPixelRatio.value = curDpr;
        for (let i = 0; i < skyLanternSpecs.length; i++) {
          const s = skyLanternSpecs[i];
          const age = (elapsed * s.speed + s.phase) % 1;
          const lx = s.baseX + age * s.driftX + Math.sin(elapsed * .42 + s.phase * 12) * s.sway;
          const lz = s.baseZ + age * s.driftZ + Math.cos(elapsed * .36 + s.phase * 10) * s.sway;
          const ly = s.baseY + age * s.maxRise;
          const sc = Math.min(1, age * 8) * Math.min(1, (1 - age) * 6);
          slDummy.position.set(lx, ly, lz);
          slDummy.rotation.set(Math.sin(elapsed * .7 + s.phase * 8) * .07, elapsed * .22 + s.phase * 6, Math.cos(elapsed * .65 + s.phase * 7) * .07);
          slDummy.scale.setScalar(Math.max(.01, sc));
          slDummy.updateMatrix();
          skyLanternMesh.setMatrixAt(i, slDummy.matrix);
          slGlowPos[i * 3] = lx; slGlowPos[i * 3 + 1] = ly - .04; slGlowPos[i * 3 + 2] = lz;
        }
        skyLanternMesh.instanceMatrix.needsUpdate = true;
        slGlowGeo.attributes.position.needsUpdate = true;
      }
      lampPool.opacity = practicals * .48;
      reflectedLamp.opacity = practicals * moisture * .52;
      for (const [material, intensity] of nightMaterials) material.emissiveIntensity = .04 + practicals * intensity;
      return night;
    }

    return { collision, blockedAt, clearFraction, vehicleBlocked, surfaceHeight, occluded, footprints, light, sun, water, roadReflection,
      skyUniforms, shelters, trafficLayout, atmosphere: { lanternHalos, riverLanternGroup, riverLanternCount: riverLanternSpecs.length, skyLanternGroup, skyLanternCount: skyLanternSpecs.length, plumeMesh, plumeCount: totalPlumes, haloCount: haloAnchors.length },
      initialTextures: [...Object.values(textures), streetShade], setDetail, updateVisibleStreet };
  }

  window.Tideline = Object.assign(window.Tideline || {}, { build, buildSteps, finishBuild, X, Z, BOUNDS, ROAD, JOBS, HUB, DELIVERY, STASH, RACE, LAKE_RACE, LAKE_RACE_START, TAPES, PHOTO_SPOTS, STREET_SPOTS, REST_SPOTS, REST_AMBIENTS, STREET_EVENTS, clamp, distance, angleDiff, rng, nearest, nearestRoad, routeBetween, district });
})();
