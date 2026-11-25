(() => {
  'use strict';

  const D = window.Tideline;
  const atlases = new WeakMap();
  const floor = .216;
  const cell = 128;
  const atlasSize = 4;
  const turn = Math.PI / 2;
  const axes = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const skins = {
    lime: { profile: 'stucco', body: '#ebe6dc', light: '#f6f2ea', dark: '#c7c0b2', trim: '#ddd6c7', frame: '#4c4b47', glass: '#5c8299', spacing: [3.56, 3.08] },
    coral: { profile: 'stucco', body: '#d2b29d', light: '#e4c8b6', dark: '#a98977', trim: '#e0cab6', frame: '#5e4d42', glass: '#5d7c8f', spacing: [3.56, 3.08] },
    jade: { profile: 'tile', body: '#9ab6ad', light: '#b6ccc4', dark: '#77948b', trim: '#c2d3c8', frame: '#445c58', glass: '#5c8391', spacing: [3.63, 3.14] },
    sand: { profile: 'deco', body: '#dcd3c3', light: '#eee7da', dark: '#b3a998', trim: '#e4dccb', frame: '#54514c', glass: '#5c7e91', spacing: [3.35, 3.47] },
    pearl: { profile: 'deco', body: '#aec0c4', light: '#cad8da', dark: '#85989e', trim: '#c4d0d0', frame: '#4d616b', glass: '#5e8599', spacing: [3.35, 3.47] },
    harbor: { profile: 'curtain', body: '#7e9aa8', light: '#a2bbc7', dark: '#5c7685', trim: '#b0c5ca', frame: '#445e6e', glass: '#6893ab', spacing: [3.17, 3.38] },
    yard: { profile: 'metal', body: '#8a989c', light: '#aab6b8', dark: '#6a7a7e', trim: '#b0bcbc', frame: '#495c60', glass: '#5f7f8c', spacing: [4.03, 3.18] },
  };
  const boardNames = [
    ['衢州三头一掌', 'QUZHOU SPICY DUCK', '#6a342c', '#f5dca8'],
    ['余记炭炉烤饼', 'QUZHOU KAOBING', '#6c4832', '#f0d4b0'],
    ['马站底水晶糕', 'CRYSTAL JELLY', '#32524c', '#e8dcba'],
    ['水亭门老茶社', 'SHUITINGMEN TEA', '#2d4c46', '#f1d6a5'],
    ['柯城邮电支局', 'KECHENG POST', '#3f5648', '#eedec2'],
    ['老衢州搁袋饼', 'GEDAI FLATBREAD', '#554135', '#f3d8b2'],
    ['南孔古城书屋', 'NANKONG BOOKS', '#344752', '#f2ddc0'],
    ['新河沿五金行', 'XINHEYAN HARDWARE', '#3a4952', '#dcdac8'],
    ['龙游发糕糖铺', 'LONGYOU FAGAO', '#5a3f38', '#f2d9ae'],
  ];

  function rect(ctx, ink, x, y, w, h) {
    ctx.fillStyle = ink;
    ctx.fillRect(x, y, w, h);
  }

  function canvas(sizeX, sizeY) {
    const surface = document.createElement('canvas');
    surface.width = sizeX;
    surface.height = sizeY;
    return surface;
  }

  function texture(T, surface, tiled = false) {
    const map = new T.CanvasTexture(surface);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 4;
    if (tiled) map.wrapS = map.wrapT = T.RepeatWrapping;
    return map;
  }

  function atlas(T, draw) {
    const size = cell * atlasSize;
    const hiRes = 2;
    const daylight = canvas(size * hiRes, size * hiRes);
    const night = canvas(size * hiRes, size * hiRes);
    const day = daylight.getContext('2d');
    const glow = night.getContext('2d');
    rect(glow, '#000000', 0, 0, size * hiRes, size * hiRes);
    for (let id = 0; id < atlasSize * atlasSize; id++) {
      for (const ctx of [day, glow]) {
        ctx.save();
        ctx.scale(hiRes, hiRes);
        ctx.translate((id % atlasSize) * cell, Math.floor(id / atlasSize) * cell);
        ctx.beginPath();
        ctx.rect(0, 0, cell, cell);
        ctx.clip();
      }
      draw(day, glow, id, D.rng(42461 + id * 7229));
      day.restore();
      glow.restore();
    }
    return { map: texture(T, daylight, true), emissiveMap: texture(T, night, true) };
  }

  function wallTile(ctx, skin, random) {
    const shading = ctx.createLinearGradient(19, 0, 110, 127);
    shading.addColorStop(0, skin.dark);
    shading.addColorStop(.26, skin.body);
    shading.addColorStop(.67, skin.light);
    shading.addColorStop(1, skin.body);
    rect(ctx, shading, 0, 0, cell, cell);
    for (let i = 0; i < 260; i++) {
      const tone = random() < .53 ? '#242c3022' : '#faf2da29';
      rect(ctx, tone, random() * cell, random() * cell, .4 + random() * 2.4, .4 + random() * 1.9);
    }
    if (skin.profile === 'tile') {
      for (let y = 4; y < 128; y += 10) {
        rect(ctx, '#1e36393b', 0, y, 128, 1.1);
        rect(ctx, '#e1e7d833', 0, y + 1, 128, 1);
        for (let x = 0; x < 128; x += 16) rect(ctx, '#25363537', x + y % 4 * 4, y, 1.15, 10);
      }
    } else if (skin.profile === 'curtain' || skin.profile === 'metal') {
      const spacing = skin.profile === 'metal' ? 7 : 32;
      for (let x = 3; x < 128; x += spacing) {
        rect(ctx, '#0b202639', x, 0, 2, 128);
        rect(ctx, '#dae5d72c', x + 2, 0, 1.5, 128);
      }
    } else {
      for (let y = 26; y < 117; y += skin.profile === 'deco' ? 19 : 49) {
        rect(ctx, '#37424326', 0, y, cell, .9);
        rect(ctx, '#e2dbce38', 0, y + 1, cell, .65);
      }
    }
    for (let i = 0; i < 7; i++) {
      const h = 9 + random() * 46;
      const top = random() * 41;
      const trail = ctx.createLinearGradient(0, top, 0, top + h);
      trail.addColorStop(0, '#1f302124');
      trail.addColorStop(1, '#27261d00');
      rect(ctx, trail, random() * cell, top, 2 + random() * 7, h);
    }
    rect(ctx, '#252b3b3b', 0, 0, cell, 3);
    rect(ctx, '#ede1c841', 0, 3, cell, 1.7);
    rect(ctx, '#25313b28', 0, 121, cell, 4);
    rect(ctx, '#e9dfcb45', 0, 125, cell, 3);
  }

  function room(ctx, x, y, w, h, skin, variant, isLit, emissive) {
    const lighting = ctx.createLinearGradient(x, y, x + w * .2, y + h);
    const amber = variant % 5 !== 0;
    if (isLit && emissive) {
      lighting.addColorStop(0, amber ? '#f4b66e' : '#9fd4cb');
      lighting.addColorStop(.43, amber ? '#c78651' : '#649592');
      lighting.addColorStop(1, amber ? '#402921' : '#182c33');
    } else if (emissive) {
      return;
    } else if (isLit) {
      lighting.addColorStop(0, amber ? '#8f7f67' : '#75898b');
      lighting.addColorStop(.54, amber ? '#645745' : '#425d61');
      lighting.addColorStop(1, '#263239');
    } else {
      lighting.addColorStop(0, '#253c50');
      lighting.addColorStop(.43, skin.glass);
      lighting.addColorStop(.49, '#314753');
      lighting.addColorStop(1, '#162c37');
    }
    rect(ctx, lighting, x, y, w, h);
    if (variant % 4 <= 1) {
      const edges = variant % 4 === 0 ? [0, w * .79] : [w * .76];
      for (const side of edges) {
        const width = w * .24;
        const curtain = ctx.createLinearGradient(x + side, 0, x + side + width, 0);
        curtain.addColorStop(0, emissive ? '#75604c' : '#aaa292');
        curtain.addColorStop(.56, emissive ? '#ad7855' : '#878175');
        curtain.addColorStop(1, emissive ? '#38271f' : '#48483f');
        rect(ctx, curtain, x + side, y, width, h);
        for (let fold = 2; fold < width - 1; fold += 4) rect(ctx, '#332d3644', x + side + fold, y, 1, h);
      }
    } else if (variant % 4 === 2) {
      rect(ctx, emissive ? '#9f6f4e63' : '#adb4ae4a', x, y + 3, w, h * .58);
      for (let slat = 6; slat < h * .58; slat += 4) rect(ctx, '#1f2c3852', x, y + slat, w, 1.2);
    }
    if (isLit && variant % 3 === 0) {
      const offset = w * .24;
      rect(ctx, emissive ? '#392b24' : '#352c28', x + offset, y + h * .66, w * .20, h * .34);
      rect(ctx, emissive ? '#edb876' : '#9a805c', x + offset + 2, y + h * .67, w * .17, 1.9);
      rect(ctx, '#3d382d9c', x + w * .63, y + h * .73, w * .27, h * .27);
    }
    if (!emissive && !isLit) {
      ctx.fillStyle = '#c3dde11b';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * .14, y);
      ctx.lineTo(x + w * .72, y + h);
      ctx.lineTo(x + w * .54, y + h);
      ctx.closePath();
      ctx.fill();
    }
  }

  function windowOpening(profile) {
    if (profile === 'deco') return [24, 13, 80, 91];
    if (profile === 'curtain') return [5, 6, 118, 99];
    if (profile === 'metal') return [15, 26, 98, 47];
    return [21, 22, 86, 76];
  }
  function upperTile(day, glow, id, rng, skin) {
    wallTile(day, skin, rng);
    const [x, y, w, h] = windowOpening(skin.profile);
    const active = [1, 6, 11, 14].includes(id) || (id === 4 && skin.profile === 'curtain');
    if (skin.profile === 'deco') {
      rect(day, '#242e3a49', 8, 0, 7, 128);
      rect(day, '#ffffff42', 8, 0, 2, 128);
      rect(day, '#242e3a43', 114, 0, 7, 128);
      rect(day, '#ffffff3f', 119, 0, 2, 128);
    }
    if (skin.profile !== 'curtain') {
      rect(day, '#20252541', x - 5, y - 4, w + 11, h + 15);
      rect(day, skin.trim, x - 4, y - 3, w + 8, h + 9);
      rect(day, '#30333162', x - 4, y - 3, w + 7, 5);
    }
    rect(day, skin.frame, x, y, w, h + 4);
    room(day, x + 3, y + 4, w - 6, h - 3, skin, id, active, false);
    room(glow, x + 3, y + 4, w - 6, h - 3, skin, id, active, true);
    const uprights = skin.profile === 'curtain' ? [w * .33, w * .66] : [w * .5];
    for (const mid of uprights) {
      rect(day, skin.frame, x + mid - 1, y, 2.8, h);
      rect(day, '#c8d4c74b', x + mid + 1.8, y + 1, .8, h - 1);
      rect(glow, '#000000', x + mid - 1, y, 2.8, h);
    }
    const crossbar = skin.profile === 'curtain' ? y + h * .81 : y + h * .29;
    rect(day, skin.frame, x + 2, crossbar, w - 4, 2.6);
    rect(glow, '#000000', x + 2, crossbar, w - 4, 2.6);
    rect(day, skin.trim, x - 4, y + h + 3, w + 8, 2.3);
    if (id % 5 === 0 && skin.profile === 'stucco') {
      rect(day, '#202c3059', x + w - 23, y + h + 8, 25, 12);
      rect(day, '#7c827a', x + w - 25, y + h + 6, 25, 11);
      for (let row = 9; row <= 15; row += 3) rect(day, '#303b3b9d', x + w - 23, y + h + row, 14, 1);
    }
  }

  function baseTile(day, glow, id, rng, mode) {
    const storefront = mode === 'trade';
    const lobby = mode === 'lobby';
    const service = mode === 'service';
    const skin = storefront ? skins.jade : lobby ? skins.pearl : service ? skins.yard : skins.lime;
    wallTile(day, skin, rng);
    const shadow = day.createLinearGradient(0, 0, 0, 32);
    shadow.addColorStop(0, '#0b141a9c');
    shadow.addColorStop(1, '#151f2400');
    rect(day, shadow, 0, 0, 128, 34);
    rect(day, '#1e2c3181', 0, 105, 128, 23);
    rect(day, '#f6ede544', 0, 105, 128, 1.5);
    const [x, y, w, h] = lobby ? [11, 17, 106, 96] : storefront ? [10, 28, 108, 84] : [19, 27, 90, 83];
    rect(day, '#18272e92', x - 5, y - 4, w + 10, h + 10);
    rect(day, skin.trim, x - 3, y - 3, w + 6, h + 6);
    rect(day, skin.frame, x, y, w, h);
    const shutter = service || (storefront && id % 7 === 2) || (mode === 'entry' && id % 4 !== 3);
    if (shutter) {
      const metal = day.createLinearGradient(x, y, x, y + h);
      metal.addColorStop(0, '#3c4d50');
      metal.addColorStop(.68, service ? '#6d7872' : '#5e706c');
      metal.addColorStop(1, '#3f4b4e');
      rect(day, metal, x + 3, y + 4, w - 6, h - 8);
      for (let line = 5; line < h - 5; line += 4) {
        rect(day, '#17252c81', x + 3, y + line, w - 6, 1.1);
        rect(day, '#d2d6cf45', x + 3, y + line + 1, w - 6, 1);
      }
      rect(day, '#92988a', x + w * .46, y + h - 14, w * .08, 2.4);
      if (id % 3 === 0) {
        rect(day, '#cadac288', x + w * .17, y + h * .24, w * .24, h * .13);
        rect(day, '#303b2d82', x + w * .19, y + h * .276, w * .20, 1.6);
      }
    } else {
      const active = storefront || id % 3 === 1;
      room(day, x + 4, y + 3, w - 8, h - 6, skin, id, active, false);
      room(glow, x + 4, y + 3, w - 8, h - 6, skin, id, active, true);
      for (const ctx of [day, glow]) {
        const ink = ctx === day ? skin.frame : '#000000';
        rect(ctx, ink, x + w * .39, y, 3, h);
        rect(ctx, ink, x + w * .72, y, 3, h);
        rect(ctx, ink, x, y + h * .21, w, 3);
        rect(ctx, ink, x, y + h * .85, w, 4);
      }
      rect(day, '#c1c5ac', x + w * .43, y + h * .63, 2.1, 7.5);
    }
    rect(day, '#1c2a2e', x - 3, y + h + 2, w + 6, 4);
    rect(day, '#cebea18b', x - 4, y + h + 6, w + 8, 2);
  }

  function panelMaterial(T, maps, spacing, nightMaterials, brightness, photo = null) {
    const material = new T.MeshStandardMaterial({ ...maps, emissive: '#ffffff', emissiveIntensity: .22, roughness: .88, metalness: .04, envMapIntensity: .48 });
    const [stepX, stepY] = spacing;
    const districtStep = { value: new T.Vector2(stepX, stepY) };
    material.customProgramCacheKey = () => photo ? 'district-panels-windows' : 'district-panels';
    material.onBeforeCompile = (shader, renderer) => {
      const varied = renderer.capabilities.isWebGL2;
      shader.uniforms.districtStep = districtStep;
      shader.vertexShader = 'uniform vec2 districtStep;\n' + shader.vertexShader.replace('#include <uv_vertex>', `
        #include <uv_vertex>
        #ifdef USE_INSTANCING
          vec2 panelSize = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          vec3 panelCenter = (modelMatrix * instanceMatrix[3]).xyz;
          vec2 panelCount = max(vec2(1.), floor(panelSize / districtStep + .5));
          vec2 key = vec2(dot(panelCenter, vec3(.312, .317, -.143)), dot(panelCenter, vec3(-.188, .214, .323)));
          ${varied ? 'vMapUv = uv * panelCount + floor(key * 61.0);' : 'vMapUv = (uv * panelCount + floor(fract(key) * 4.0)) * .25;'}
          vEmissiveMapUv = vMapUv;
        #endif
      `);
      if (varied) {
        // Keep the mip footprint continuous while each window picks its own weather, curtains and lighting.
        shader.fragmentShader = `
          vec2 districtTile(vec2 at) {
            vec3 hash = fract(floor(at.xyx) * vec3(.1031,.1030,.0973));
            hash += dot(hash, hash.yzx + 33.33);
            return floor(fract((hash.xx + hash.yz) * hash.zy) * 4.);
          }
          vec4 districtSample(sampler2D atlasImage, vec2 at) {
            vec2 lookup = (districtTile(at) + clamp(fract(at), .01, .99)) * .25;
            return texture2DGradEXT(atlasImage, lookup, dFdx(at) * .25, dFdy(at) * .25);
          }
        ` + shader.fragmentShader.replace('#include <map_fragment>', 'diffuseColor *= districtSample(map, vMapUv);')
          .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= districtSample(emissiveMap, vEmissiveMapUv).rgb;');
        if (photo) {
          Object.assign(shader.uniforms, { districtWindows: { value: photo.image },
            districtWindowReady: photo.ready, districtOpening: { value: photo.opening } });
          shader.fragmentShader = `
            uniform sampler2D districtWindows;
            uniform float districtWindowReady;
            uniform vec4 districtOpening;
          ` + shader.fragmentShader.replace('diffuseColor *= districtSample(map, vMapUv);', `
            vec4 wall = districtSample(map, vMapUv);
            vec2 photoLocal = (fract(vMapUv) - districtOpening.xy) / districtOpening.zw;
            vec2 dx = dFdx(vMapUv);
            vec2 dy = dFdy(vMapUv);
            float footprint = max(length(dx),length(dy));
            float paneEdge = min(min(photoLocal.x,photoLocal.y),1.-max(photoLocal.x,photoLocal.y));
            float isGlassPane = smoothstep(.008, .035, paneEdge);
            if (districtWindowReady > .5 && paneEdge > 0. && footprint < .08) {
              vec2 portion = .397 / districtOpening.zw;
              vec2 coordinates = mod(districtTile(vMapUv),2.)*.5 + vec2(.052,.077) + photoLocal*.397;
              vec3 pane = texture2DGradEXT(districtWindows,coordinates,dx*portion,dy*portion).rgb;
              float blend = .79 * smoothstep(.005,.065,paneEdge) * (1.-smoothstep(.026,.08,footprint));
              wall.rgb = mix(wall.rgb,pane*.92+vec3(.007,.009,.012),blend);
            }
            wall.rgb *= mix(1.0, .58, isGlassPane);
            diffuseColor *= wall;
          `).replace('#include <roughnessmap_fragment>', `
            #include <roughnessmap_fragment>
            roughnessFactor = mix(roughnessFactor, .06, isGlassPane);
          `).replace('#include <metalnessmap_fragment>', `
            #include <metalnessmap_fragment>
            metalnessFactor = mix(metalnessFactor, .38, isGlassPane);
          `);
        }
      }
    };
    nightMaterials.push([material, brightness]);
    return material;
  }

  function boardMaterial(T, [name, latin, background, ink], nightMaterials) {
    const surface = canvas(512, 128);
    const ctx = surface.getContext('2d');
    rect(ctx, '#223234', 0, 0, 512, 128);
    rect(ctx, background, 5, 5, 502, 118);
    rect(ctx, ink + '62', 17, 15, 478, 1.75);
    rect(ctx, ink + '62', 17, 110, 478, 1.75);
    rect(ctx, ink, 21, 35, 2, 53);
    rect(ctx, ink, 489, 35, 2, 53);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = ink;
    ctx.font = '700 47px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
    ctx.fillText(name, 256, 51, 411);
    ctx.font = '600 13px Arial, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText(latin, 256, 94, 410);
    const map = texture(T, surface);
    const material = new T.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#fff0d6', roughness: .73 });
    nightMaterials.push([material, .55]);
    return material;
  }

  function makeKit({ T, nightMaterials, windowPhoto, windowPhotoReady }) {
    const plane = new T.PlaneGeometry(1, 1);
    const material = (color, options) => new T.MeshStandardMaterial({ color, roughness: .88, ...options });
    const coat = Object.fromEntries(Object.entries(skins).map(([name, skin]) => {
      const maps = atlas(T, (day, night, tile, rng) => upperTile(day, night, tile, rng, skin));
      let photo = null;
      if (skin.profile !== 'curtain' && skin.profile !== 'metal') {
        const [x, y, w, h] = windowOpening(skin.profile);
        const opening = new T.Vector4((x + 3) / cell, 1 - (y + h) / cell, (w - 6) / cell, (h - 4) / cell);
        photo = { image: windowPhoto(), ready: windowPhotoReady, opening };
      }
      return [name, { ...skin, body: material(skin.body), trim: material(skin.trim),
        facade: panelMaterial(T, maps, skin.spacing, nightMaterials, 1.08, photo) }];
    }));
    const base = Object.fromEntries(['trade', 'lobby', 'service', 'entry'].map(mode => {
      const maps = atlas(T, (day, night, tile, rng) => baseTile(day, night, tile, rng, mode));
      return [mode, panelMaterial(T, maps, [mode === 'lobby' ? 4.8 : 4.45, 16], nightMaterials, mode === 'trade' ? 1.37 : 1.02)];
    }));
    return {
      plane, coat, base,
      signs: boardNames.map(board => boardMaterial(T, board, nightMaterials)),
      plinth: material('#49534f'), iron: material('#384a50', { metalness: .28, roughness: .52 }),
      zinc: material('#748482', { metalness: .43, roughness: .54 }),
      cap: material('#515a58'), gutter: material('#24353b'),
      cloth: ['#764c3f', '#626b52', '#385d60'].map(color => material(color, { roughness: .98 })),
    };
  }

  function skinAt(kit, building, rng) {
    const choice = rng();
    if (building.tower) return choice < .38 ? kit.coat.sand : choice < .59 ? kit.coat.pearl : kit.coat.harbor;
    if (building.z > 153 && building.x < 160 && choice < .63) return kit.coat.yard;
    if (building.x > 138 && choice < .45) return kit.coat.jade;
    if (choice < .26) return kit.coat.coral;
    if (choice < .55) return kit.coat.lime;
    return choice < .81 ? kit.coat.jade : kit.coat.sand;
  }

  function elevation(x, z, w, d, index) {
    const [nx, nz] = axes[index];
    const radius = nx ? w / 2 : d / 2;
    return { x: x + nx * radius, z: z + nz * radius, width: nx ? d : w, nx, nz, yaw: index * turn };
  }

  function place(surface, along, out = 0) {
    return [surface.x + surface.nz * along + surface.nx * out,
      surface.z - surface.nx * along + surface.nz * out];
  }

  function face(api, kit, material, surface, y, h) {
    const [x, z] = place(surface, 0, .011);
    api.queue(kit.plane, material, x, y, z, surface.width, h, 1, surface.yaw);
  }

  function alongFace(api, material, surface, along, out, y, w, h, d, pitch = 0) {
    const [x, z] = place(surface, along, out);
    api.box(material, x, y, z, w, h, d, surface.yaw, pitch);
  }

  function groundFloor(api, kit, skin, building, h, rng) {
    const { x, z, w, d, tower, shop } = building;
    const front = (Math.round((building.front || 0) / turn) + 4) % 4;
    api.box(kit.plinth, x, floor + h * .5, z, w, h, d);
    api.box(kit.plinth, x, floor + .12, z, w + .21, .24, d + .21);
    api.box(skin.trim, x, floor + h - .075, z, w + .14, .21, d + .14);
    for (let side = 0; side < 4; side++) {
      const surface = elevation(x, z, w, d, side);
      const retail = !tower && shop && side === front;
      const mode = retail ? 'trade' : tower ? 'lobby' : skin.profile === 'metal' ? 'service' : 'entry';
      face(api, kit, kit.base[mode], surface, floor + h * .5, h);
      const edge = surface.width * .5 - .16;
      for (const pos of [-edge, edge]) alongFace(api, skin.trim, surface, pos, .055, floor + h * .52, .31, h * .91, .24);
      if (retail) {
        const middle = (rng() < .5 ? -1 : 1) * surface.width * .20;
        const wide = Math.min(surface.width * .42, 7.4);
        const bannerHeight = floor + h * .86;
        const sign = kit.signs[Math.floor(rng() * kit.signs.length)];
        alongFace(api, kit.iron, surface, middle, .074, bannerHeight, wide + .11, .67, .23);
        const [sx, sz] = place(surface, middle, .20);
        api.queue(kit.plane, sign, sx, bannerHeight, sz, wide, .595, 1, surface.yaw);
        const awning = kit.cloth[Math.floor(rng() * kit.cloth.length)];
        const at = floor + h * .70;
        alongFace(api, awning, surface, middle, .52, at, wide + .42, .095, 1.15, .17);
        alongFace(api, awning, surface, middle, 1.07, at - .134, wide + .42, .185, .073);
        for (const end of [-1, 1]) alongFace(api, kit.iron, surface, middle + end * wide * .48, .49, at - .27, .043, .055, .94, .25);
        if (rng() < .64) {
          const [lx, lz] = place(surface, middle, .96);
          api.fixture?.(lx, at - .22, lz, '#f5c495', 22, 13);
        }
      } else if (tower && side === front) {
        alongFace(api, kit.iron, surface, 0, .85, floor + h * .76, surface.width * .47, .16, 1.81);
        alongFace(api, skin.trim, surface, 0, 1.73, floor + h * .76, surface.width * .47, .10, .073);
      }
    }
  }

  function roofHardware(api, kit, skin, x, z, w, d, y, tower, rng) {
    const offsetX = x + w * (rng() - .5) * .43;
    const offsetZ = z + d * (rng() - .5) * .49;
    const hutHeight = tower ? 1.6 : 1.13;
    const hutW = w * (.20 + rng() * .11);
    const hutD = d * (.23 + rng() * .09);
    api.box(skin.body, offsetX, y + hutHeight * .5, offsetZ, hutW, hutHeight, hutD);
    api.box(kit.cap, offsetX, y + hutHeight + .07, offsetZ, hutW + .34, .16, hutD + .34);
    api.box(kit.gutter, offsetX, y + hutHeight * .43, offsetZ + hutD * .5, hutW * .23, hutHeight * .75, .07);
    if (rng() < .54) {
      const px = x - w * .27;
      const pz = z + d * .31;
      api.box(kit.iron, px, y + .13, pz, 1.72, .26, 1.43);
      api.pole(kit.zinc, px, y + .81, pz, 1.24, 1.15);
      api.pole(kit.cap, px, y + 1.41, pz, 1.29, .16);
    } else {
      for (const k of [-1, 1]) {
        const px = x + k * w * .29;
        const pz = z - d * .24;
        api.box(kit.zinc, px, y + .29, pz, w * .12, .54, d * .21);
        api.box(kit.gutter, px, y + .568, pz, w * .107, .055, d * .16);
      }
    }
    if (rng() < (tower ? .79 : .30)) {
      const length = tower ? 2.1 + rng() * 3.2 : 1.65 + rng() * .66;
      api.pole(kit.iron, offsetX, y + hutHeight + length * .5, offsetZ, .055, length);
      api.box(kit.iron, offsetX, y + hutHeight + length * .84, offsetZ, tower ? 1.72 : 1.13, .042, .04);
    }
  }

  function utilityRoof(api, kit, skin, x, z, w, d, y) {
    const pitch = Math.atan(4.2 / w);
    const span = Math.hypot(w * .51, 2.1);
    for (const side of [-1, 1]) {
      api.box(kit.cap, x + side * w * .25, y + 1.05, z, span, .16, d, 0, 0, -side * pitch);
      for (const offset of [-.33, -.16, 0, .16, .33]) {
        api.box(skin.trim, x + side * w * .25, y + 1.153, z + d * offset, span, .06, .046, 0, 0, -side * pitch);
      }
    }
    api.box(kit.iron, x, y + 2.13, z, .22, .14, d + .07);
    for (const side of [-1, 1]) {
      const capZ = z + d * .493 * side;
      api.box(skin.body, x, y + .36, capZ, w * .74, .72, .16);
      api.box(skin.body, x, y + 1.06, capZ, w * .45, .68, .16);
      api.box(skin.body, x, y + 1.66, capZ, w * .23, .51, .16);
    }
  }

  function parapet(api, kit, skin, x, z, w, d, y, h) {
    api.box(kit.cap, x, y + .036, z, w - .08, .13, d - .08);
    for (let side = 0; side < 4; side++) {
      const surface = elevation(x, z, w, d, side);
      alongFace(api, skin.body, surface, 0, -.115, y + h * .51, surface.width, h, .22);
      alongFace(api, skin.trim, surface, 0, -.081, y + h + .035, surface.width + .10, .09, .35);
    }
  }

  function balcony(api, kit, skin, surface, x, y, w) {
    alongFace(api, skin.trim, surface, x, .33, y - .04, w, .155, .75);
    alongFace(api, kit.iron, surface, x, .697, y + .61, w, .055, .056);
    alongFace(api, kit.iron, surface, x, .697, y + .20, w, .04, .043);
    for (let rail = -2; rail <= 2; rail++) alongFace(api, kit.iron, surface, x + rail * w * .226, .698, y + .355, .046, .50, .047);
  }

  function cornerBay(api, kit, skin, surface, y, h, slot, width, rng) {
    const [x, z] = place(surface, slot, .22);
    const bay = { ...surface, x, z, width };
    alongFace(api, skin.body, bay, 0, -.12, y, width, h, .245);
    face(api, kit, skin.facade, bay, y, h);
    for (const side of [-1, 1]) {
      alongFace(api, skin.trim, bay, side * width * .50, -.068, y, .11, h + .17, .245);
    }
    alongFace(api, skin.trim, bay, 0, -.06, y - h * .50 + .065, width + .12, .18, .34);
    alongFace(api, skin.trim, bay, 0, -.052, y + h * .50, width + .21, .23, .36);
    if (rng() < .6) {
      const side = Math.sign(slot);
      alongFace(api, kit.iron, bay, side * (width * .52 + .055), -.13, y - 1.10, .059, h + 2, .058);
    }
  }

  function stories(api, kit, skin, x, z, w, d, bottom, h, detail, front, rng) {
    const top = bottom + h;
    api.box(skin.body, x, bottom + h * .5, z, w, h, d);
    const ornamented = detail && skin.profile !== 'deco';
    const cross = front % 2 ? D.nearest(D.Z, z) - z : D.nearest(D.X, x) - x;
    const sideStreet = front % 2 ? (cross > 0 ? 0 : 2) : (cross > 0 ? 1 : 3);
    const baySide = ornamented && rng() < .64 ? sideStreet : -1;
    for (let side = 0; side < 4; side++) {
      const surface = elevation(x, z, w, d, side);
      face(api, kit, skin.facade, surface, bottom + h * .50, h);
      const edge = surface.width * .5 - .20;
      const deco = skin.profile === 'deco';
      for (const pos of [-edge, edge]) {
        alongFace(api, skin.trim, surface, pos, .092, bottom + h * .50, deco ? .37 : .22, h, deco ? .42 : .25);
      }
      if (deco && h > 19) {
        for (const pos of [-surface.width * .265, surface.width * .265]) {
          alongFace(api, skin.trim, surface, pos, .038, bottom + h * .5, .13, h, .118);
        }
      }
      if (detail && (side === front || side === sideStreet)) {
        const levels = Math.max(1, Math.round(h / skin.spacing[1]));
        const bays = Math.max(1, Math.round(surface.width / skin.spacing[0]));
        const width = surface.width / bays;
        const oriel = baySide === side ? (rng() < .5 ? 1 : bays - 2) : -1;
        if (oriel >= 0) {
          const slot = surface.width * ((oriel + .5) / bays - .5);
          cornerBay(api, kit, skin, surface, bottom + h * .5, h - .23, slot, width + .04, rng);
        }
        for (let level = 0; level < levels; level++) {
          const y = bottom + h * (level + .203) / levels;
          if (skin.profile === 'stucco' && level % 2 === 0) {
            alongFace(api, skin.trim, surface, 0, .064, y, surface.width, .112, .24);
          }
          if ((side === front || level % 2 === 1) && (skin.profile === 'tile' || (skin.profile === 'stucco' && level % 2 === 1))) {
            const first = Math.floor(rng() * Math.max(1, bays - 2)) + 1;
            if (first === oriel) continue;
            const center = surface.width * ((first + .5) / bays - .5);
            balcony(api, kit, skin, surface, center, y, width * .76);
          }
        }
      }
    }
    api.box(skin.trim, x, top - .055, z, w + .27, .19, d + .27);
    return top;
  }

  function addDistrictArchitecture(api, building) {
    let kit = atlases.get(api.scene);
    if (!kit) {
      kit = makeKit(api);
      atlases.set(api.scene, kit);
    }
    const { x, z, w, d, tower, height } = building;
    const seed = Math.imul(Math.round(x * 47) + 10397, 0x4c73c43) ^ Math.imul(Math.round(z * 49) + 23117, 0x1b713c1);
    const rng = D.rng(seed >>> 0);
    const skin = skinAt(kit, building, rng);
    const lobbyHeight = tower ? 5.85 : Math.min(4.31, height * .43);
    groundFloor(api, kit, skin, building, lobbyHeight, rng);
    const front = (Math.round((building.front || 0) / turn) + 4) % 4;
    const setback = tower && height > 39;
    const taper = setback ? .77 + rng() * .11 : 1;
    const baseW = tower && skin.profile === 'curtain' ? w * .94 : w;
    const baseD = tower && skin.profile === 'curtain' ? d * .94 : d;
    const detailed = !tower && skin.profile !== 'metal' && rng() < (building.shop ? .87 : .42);
    let top = stories(api, kit, skin, x, z, baseW, baseD, floor + lobbyHeight, height * taper - lobbyHeight, detailed, front, rng);
    if (setback) {
      api.box(kit.cap, x, top + .04, z, baseW - .10, .13, baseD - .10);
      const narrow = .65 + rng() * .16;
      const upperW = w * narrow;
      const upperD = d * narrow;
      const crown = skin.profile === 'deco' ? 2.4 + rng() * 1.4 : 1.42;
      const shoulder = top + height * (1.18 - taper) - crown;
      top = stories(api, kit, skin, x, z, upperW, upperD, top + .11, shoulder - top, false, front, rng);
      parapet(api, kit, skin, x, z, upperW, upperD, top, .47);
      const crownW = upperW * (skin.profile === 'deco' ? .62 : .76);
      const crownD = upperD * (skin.profile === 'deco' ? .56 : .72);
      api.box(skin.body, x, top + crown * .5, z, crownW, crown, crownD);
      api.box(skin.trim, x, top + crown + .11, z, crownW + .35, .22, crownD + .35);
      if (skin.profile === 'deco') {
        for (let side = 0; side < 4; side++) {
          const surface = elevation(x, z, crownW, crownD, side);
          for (const pos of [-1, 0, 1]) alongFace(api, kit.iron, surface, pos * surface.width * .20, .023, top + crown * .54, .19, crown * .70, .07);
        }
      }
      roofHardware(api, kit, skin, x, z, crownW, crownD, top + crown, tower, rng);
    } else {
      if (skin.profile === 'metal' && rng() < .74) {
        utilityRoof(api, kit, skin, x, z, baseW, baseD, top);
      } else {
        parapet(api, kit, skin, x, z, baseW, baseD, top, tower ? .64 : .49);
        roofHardware(api, kit, skin, x, z, baseW, baseD, top, tower, rng);
      }
    }
    return true;
  }

  D.addDistrictArchitecture = addDistrictArchitecture;
})();
