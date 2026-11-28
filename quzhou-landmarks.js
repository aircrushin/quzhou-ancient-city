(() => {
  'use strict';

  const PI = Math.PI;

  function landmarkPos(id, fx, fz) {
    const lm = window.QuzhouRoadData?.LANDMARKS?.find(item => item.id === id);
    return lm ? [lm.x, lm.z] : [fx, fz];
  }

  function pointInPoly(px, pz, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, zi = pts[i].z, xj = pts[j].x, zj = pts[j].z;
      if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi + 1e-9) + xi)) inside = !inside;
    }
    return inside;
  }

  function flatPolygonGeometry(T, pts) {
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
    geo.rotateX(-PI / 2);
    geo.computeVertexNormals();
    return geo;
  }

  function wireMasonry(material, surfaceTexture, albedoName, normalName, size, amount) {
    if (!material || material.userData.masonryWired) return material;
    material.userData.masonryWired = true;
    const albedo = surfaceTexture(albedoName, true);
    const normal = surfaceTexture(normalName, false);
    const scale = size.toFixed(2);
    const mixAmt = amount.toFixed(2);
    material.customProgramCacheKey = () => 'qz-masonry-' + albedoName + scale + mixAmt;
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { qzAlbedo: { value: albedo }, qzNormal: { value: normal } });
      shader.vertexShader = 'varying vec3 vQzPos,vQzNrm;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', [
        '#include <worldpos_vertex>',
        'vec4 qzP = vec4(transformed,1.0);',
        '#ifdef USE_INSTANCING',
        '  qzP = instanceMatrix * qzP;',
        '#endif',
        'vQzPos = (modelMatrix * qzP).xyz;',
        'vQzNrm = inverseTransformDirection(normalize(transformedNormal), viewMatrix);',
      ].join('\n'));
      shader.fragmentShader = 'varying vec3 vQzPos,vQzNrm; uniform sampler2D qzAlbedo,qzNormal;\n' + shader.fragmentShader
        .replace('#include <color_fragment>', [
          '#include <color_fragment>',
          'vec3 qzFace = abs(normalize(vQzNrm));',
          'vec3 qzP = vQzPos / ' + scale + ';',
          'vec3 qzPlanar = pow(qzFace, vec3(8.0)); qzPlanar /= max(.001, dot(qzPlanar, vec3(1.0)));',
          'vec3 qzCol = texture2D(qzAlbedo,qzP.yz).rgb*qzPlanar.x + texture2D(qzAlbedo,qzP.xz).rgb*qzPlanar.y + texture2D(qzAlbedo,qzP.xy).rgb*qzPlanar.z;',
          'diffuseColor.rgb = mix(diffuseColor.rgb, qzCol, ' + mixAmt + ');',
        ].join('\n'))
        .replace('#include <normal_fragment_maps>', [
          '#include <normal_fragment_maps>',
          'vec2 qzUV = qzFace.y>max(qzFace.x,qzFace.z) ? qzP.xz : qzFace.x>qzFace.z ? qzP.yz : qzP.xy;',
          'vec2 qzGrit = texture2D(qzNormal, qzUV).xy*2.0-1.0;',
          'vec3 qzX = transformDirection(qzFace.y>max(qzFace.x,qzFace.z) ? vec3(1,0,0) : qzFace.x>qzFace.z ? vec3(0,0,1) : vec3(1,0,0), viewMatrix);',
          'vec3 qzY = transformDirection(qzFace.y>max(qzFace.x,qzFace.z) ? vec3(0,0,1) : vec3(0,1,0), viewMatrix);',
          'normal = normalize(normal + (qzX*qzGrit.x + qzY*qzGrit.y) * .5);',
        ].join('\n'));
    };
    material.needsUpdate = true;
    return material;
  }

  function stampWindowUv(T, geometry) {
    if (!geometry || geometry.userData.windowUv) return geometry;
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();
    if (!position) return geometry;
    const triCount = (index ? index.count : position.count) / 3;
    const at = i => {
      const k = index ? index.getX(i) : i;
      return [position.getX(k), position.getY(k), position.getZ(k), k];
    };
    const tris = new Array(triCount);
    for (let t = 0; t < triCount; t++) {
      const A = at(t * 3), B = at(t * 3 + 1), C = at(t * 3 + 2);
      const e1x = B[0] - A[0], e1y = B[1] - A[1], e1z = B[2] - A[2];
      const e2x = C[0] - A[0], e2y = C[1] - A[1], e2z = C[2] - A[2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      tris[t] = { A, B, C, nx, ny, nz };
    }
    const parent = new Int32Array(triCount);
    for (let i = 0; i < triCount; i++) parent[i] = i;
    const find = i => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    const edgeOwner = new Map();
    for (let t = 0; t < triCount; t++) {
      const ids = [tris[t].A[3], tris[t].B[3], tris[t].C[3]];
      for (let e = 0; e < 3; e++) {
        const a = ids[e], b = ids[(e + 1) % 3];
        const key = a < b ? a + ':' + b : b + ':' + a;
        const other = edgeOwner.get(key);
        if (other === undefined) edgeOwner.set(key, t);
        else if (tris[other].nx * tris[t].nx + tris[other].ny * tris[t].ny + tris[other].nz * tris[t].nz > .92) {
          parent[find(t)] = find(other);
        }
      }
    }
    const groups = new Map();
    for (let t = 0; t < triCount; t++) {
      const g = find(t);
      let list = groups.get(g);
      if (!list) groups.set(g, list = []);
      list.push(tris[t]);
    }
    const pos = new Float32Array(triCount * 9);
    const nrm = new Float32Array(triCount * 9);
    const uv = new Float32Array(triCount * 6);
    let w = 0;
    for (const list of groups.values()) {
      let nx = 0, ny = 0, nz = 0;
      for (const tri of list) { nx += tri.nx; ny += tri.ny; nz += tri.nz; }
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const helper = Math.abs(ny) < .9 ? [0, 1, 0] : [1, 0, 0];
      let ux = helper[1] * nz - helper[2] * ny;
      let uy = helper[2] * nx - helper[0] * nz;
      let uz = helper[0] * ny - helper[1] * nx;
      const ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
      let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
      const projected = [];
      for (const tri of list) {
        for (const p of [tri.A, tri.B, tri.C]) {
          const u = p[0] * ux + p[1] * uy + p[2] * uz;
          const v = p[0] * vx + p[1] * vy + p[2] * vz;
          projected.push(u, v);
          if (u < minU) minU = u;
          if (v < minV) minV = v;
          if (u > maxU) maxU = u;
          if (v > maxV) maxV = v;
        }
      }
      const du = Math.max(1e-5, maxU - minU), dv = Math.max(1e-5, maxV - minV);
      let k = 0;
      for (const tri of list) {
        for (const p of [tri.A, tri.B, tri.C]) {
          const u = projected[k++], v = projected[k++];
          const o3 = w * 3, o2 = w * 2;
          pos[o3] = p[0]; pos[o3 + 1] = p[1]; pos[o3 + 2] = p[2];
          nrm[o3] = nx; nrm[o3 + 1] = ny; nrm[o3 + 2] = nz;
          uv[o2] = (u - minU) / du;
          uv[o2 + 1] = (v - minV) / dv;
          w++;
        }
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nrm, 3));
    geo.setAttribute('windowUv', new T.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    geo.userData.windowUv = true;
    return geo;
  }

  function wireWindowRecess(material) {
    if (!material || material.userData.windowRecess) return;
    material.userData.windowRecess = true;
    const previous = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
    material.customProgramCacheKey = () => previous + 'winrecess';
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute vec2 windowUv;\nvarying vec2 vWinUv;\nvarying vec3 vWinW;\nvarying vec3 vWinN;\n'
        + shader.vertexShader.replace('#include <project_vertex>', [
          '#include <project_vertex>',
          'vWinUv = windowUv;',
          'vec4 winLocal = vec4(transformed, 1.0);',
          '#ifdef USE_INSTANCING',
          '  winLocal = instanceMatrix * winLocal;',
          '#endif',
          'vWinW = (modelMatrix * winLocal).xyz;',
          '#ifdef USE_INSTANCING',
          '  vWinN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);',
          '#else',
          '  vWinN = normalize(mat3(modelMatrix) * objectNormal);',
          '#endif',
        ].join('\n'));
      shader.fragmentShader = 'varying vec2 vWinUv;\nvarying vec3 vWinW;\nvarying vec3 vWinN;\n'
        + shader.fragmentShader.replace('#include <emissivemap_fragment>', [
          '#include <emissivemap_fragment>',
          'vec3 winN = normalize(vWinN);',
          'vec3 winV = normalize(cameraPosition - vWinW);',
          'float winFace = max(dot(winN, winV), 0.0);',
          'vec3 winDp1 = dFdx(vWinW); vec3 winDp2 = dFdy(vWinW);',
          'vec2 winDu1 = dFdx(vWinUv); vec2 winDu2 = dFdy(vWinUv);',
          'vec3 winT = winDp1 * winDu2.y - winDp2 * winDu1.y;',
          'vec3 winB = winDp2 * winDu1.x - winDp1 * winDu2.x;',
          'float winTl = length(winT), winBl = length(winB);',
          'winT = winTl > 1e-5 ? winT / winTl : vec3(1.0, 0.0, 0.0);',
          'winB = winBl > 1e-5 ? winB / winBl : vec3(0.0, 1.0, 0.0);',
          'vec2 winView = vec2(dot(winV, winT), dot(winV, winB));',
          'vec2 paneUv = vWinUv - winView * (0.11 / max(winFace, 0.2));',
          'float edge = min(min(vWinUv.x, 1.0 - vWinUv.x), min(vWinUv.y, 1.0 - vWinUv.y));',
          'float frame = smoothstep(0.0, 0.09, edge);',
          'float paneEdge = min(min(paneUv.x, 1.0 - paneUv.x), min(paneUv.y, 1.0 - paneUv.y));',
          'float pane = smoothstep(-0.02, 0.04, paneEdge);',
          'float mullion = min(smoothstep(0.012, 0.038, abs(paneUv.x - 0.5)), smoothstep(0.012, 0.038, abs(paneUv.y - 0.5)));',
          'diffuseColor.rgb *= mix(0.32, 1.0, frame);',
          'totalEmissiveRadiance *= mix(0.07, 1.0, frame * pane * mix(0.38, 1.0, mullion));',
        ].join('\n'));
    };
    material.needsUpdate = true;
  }

  function createPalette(T, nightMaterials, surfaceTexture) {
    const pavementMap = surfaceTexture('pavement', true);
    const mat = (color, roughness = .84, extra = {}) => new T.MeshStandardMaterial({ color, roughness, ...extra });
    const masonry = (color, roughness, albedoName, normalName, size, amount, extra) => wireMasonry(
      mat(color, roughness, extra), surfaceTexture, albedoName, normalName, size, amount);

    const cityBrick = masonry('#8a5a48', .9, 'brick', 'brick-normal', 1.35, .86);
    const darkBrick = masonry('#5a4038', .92, 'brick', 'brick-normal', 1.2, .82);
    const whiteWall = masonry('#f2ede3', .84, 'plaster', 'plaster-normal', 2.6, .62);
    const warmWall = masonry('#e9dfcc', .86, 'plaster', 'plaster-normal', 2.6, .58);
    const slateTile = masonry('#3b4550', .74, 'roof', 'roof-normal', 1.2, .9, { metalness: .08 });
    const goldTile = masonry('#cca042', .46, 'roof', 'roof-normal', 1.15, .26, { metalness: .28 });
    const vermilion = masonry('#aa3a31', .72, 'plaster', 'plaster-normal', 2.2, .22);
    const darkTimber = mat('#5c4134', .80);
    const stone = mat('#b9b6aa', .86, { map: pavementMap });
    const water = mat('#3c8a9e', .20, { metalness: .22 });
    const gold = mat('#d4a74f', .44, { metalness: .45 });
    const bronze = mat('#5d6c5f', .52, { metalness: .48 });
    const lantern = mat('#ff8357', .45, { emissive: '#ff6c36', emissiveIntensity: .65 });
    const warmGlow = mat('#ffdfb0', .48, { emissive: '#ffb964', emissiveIntensity: .42 });
    const jadeGlow = mat('#9fe6cf', .48, { emissive: '#5dd8b6', emissiveIntensity: .38 });
    nightMaterials.push([lantern, 2.1], [warmGlow, 1.85], [jadeGlow, 1.6]);

    return {
      cityBrick, darkBrick, whiteWall, warmWall, slateTile, goldTile,
      vermilion, darkTimber, stone, water, gold, bronze, lantern, warmGlow, jadeGlow,
    };
  }

  function wireArchPBR(material, surfaceTexture) {
    if (!material || !material.isMeshStandardMaterial || material.userData.archPbrWired) return;
    const name = material.name || '';
    let kind = '';
    if (name.endsWith('_brick')) kind = 'brick';
    else if (name.endsWith('_stone') || name.endsWith('_marble')) kind = 'stone';
    else if (name.endsWith('_white')) kind = 'plaster';
    else if (name.endsWith('_tile') || name.endsWith('_gold_tile')) kind = 'tile';
    if (!kind || !surfaceTexture) return;
    material.userData.archPbrWired = true;
    const albedoTex = kind === 'plaster' ? surfaceTexture('plaster', true) : surfaceTexture('pavement', true);
    const normTex = kind === 'plaster' ? surfaceTexture('plaster-normal', false) : surfaceTexture('pavement-normal', false);
    material.customProgramCacheKey = () => 'quzhou-arch-pbr-' + kind;
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { archAlbedo: { value: albedoTex }, archNormal: { value: normTex } });
      shader.vertexShader = 'varying vec3 vArchPos, vArchNrm;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', [
        '#include <worldpos_vertex>',
        'vec4 ap = vec4(transformed, 1.0);',
        '#ifdef USE_INSTANCING',
        '  ap = instanceMatrix * ap;',
        '#endif',
        'vArchPos = (modelMatrix * ap).xyz;',
        'vArchNrm = inverseTransformDirection(normalize(transformedNormal), viewMatrix);',
      ].join('\n'));
      const scale = kind === 'brick' ? '1.35' : kind === 'stone' ? '1.90' : kind === 'plaster' ? '2.80' : '1.60';
      const colorPatch = kind === 'brick' ? [
        'vec2 buv = face.y > max(face.x, face.z) ? vArchPos.xz : (face.x > face.z ? vArchPos.zy : vArchPos.xy);',
        'float row = floor(buv.y * 5.2);',
        'vec2 bCell = vec2(fract(buv.x * 2.1 + mod(row, 2.0) * .5), fract(buv.y * 5.2));',
        'float mortar = 1.0 - smoothstep(.04, .09, min(min(bCell.x, 1.0 - bCell.x), min(bCell.y, 1.0 - bCell.y)));',
        'float bTone = fract(sin(dot(vec2(floor(buv.x * 2.1 + mod(row, 2.0) * .5), row), vec2(12.9898, 78.233))) * 43758.5453);',
        'float damp = .74 + .26 * smoothstep(.2, 2.4, vArchPos.y);',
        'diffuseColor.rgb = mix(diffuseColor.rgb * (.80 + .34 * bTone) * mix(.78, 1.18, lum), diffuseColor.rgb * .56, mortar * .75) * damp;',
      ].join('\n') : kind === 'plaster' ? [
        'float streak = smoothstep(.25, .85, lum);',
        'float dampBase = .82 + .18 * smoothstep(.3, 2.8, vArchPos.y);',
        'diffuseColor.rgb *= mix(.84, 1.08, streak) * dampBase;',
      ].join('\n') : kind === 'stone' ? [
        'diffuseColor.rgb *= mix(.76, 1.16, lum) * (.88 + .12 * smoothstep(.1, 1.6, vArchPos.y));',
      ].join('\n') : [
        'diffuseColor.rgb *= mix(.86, 1.14, lum);',
      ].join('\n');
      const normStr = kind === 'brick' ? '.42' : kind === 'stone' ? '.34' : kind === 'plaster' ? '.22' : '.16';
      shader.fragmentShader = 'varying vec3 vArchPos, vArchNrm; uniform sampler2D archAlbedo, archNormal;\n' + shader.fragmentShader
        .replace('#include <color_fragment>', [
          '#include <color_fragment>',
          'vec3 face = abs(normalize(vArchNrm));',
          'vec2 aUV = (face.y > max(face.x, face.z) ? vArchPos.xz : (face.x > face.z ? vArchPos.zy : vArchPos.xy)) / ' + scale + ';',
          'vec3 texC = texture2D(archAlbedo, aUV).rgb;',
          'float lum = dot(texC, vec3(.2126, .7152, .0722));',
          colorPatch,
        ].join('\n'))
        .replace('#include <normal_fragment_maps>', [
          '#include <normal_fragment_maps>',
          'vec2 aGrit = texture2D(archNormal, aUV).xy * 2.0 - 1.0;',
          'vec3 aTx = transformDirection(face.x > face.z ? vec3(0,0,1) : vec3(1,0,0), viewMatrix);',
          'vec3 aTy = transformDirection(face.y > max(face.x, face.z) ? vec3(0,0,1) : vec3(0,1,0), viewMatrix);',
          'normal = normalize(normal + (aTx * aGrit.x + aTy * aGrit.y) * ' + normStr + ');',
        ].join('\n'));
    };
  }

  function shouldCastShadow(material) {
    const matName = material?.name || '';
    return !(material?.transparent || matName.endsWith('_glow') || matName.endsWith('_glass') || matName === 'lamp_iron' || matName === 'trim');
  }

  function placeGLB(api, key, x, y, z, sx, sy, sz, yaw = 0, glowPower = 3.2) {
    const asset = window.Tideline?.getAAAModel?.(key);
    if (!asset || !api.queue) return false;
    for (const m of asset.materials) {
      m.userData.castShadow = shouldCastShadow(m);
      wireArchPBR(m, api.surfaceTexture);
      if (m.name && m.name.endsWith('_glow') && !m.userData.nightWired) {
        m.userData.nightWired = true;
        api.nightMaterials?.push([m, glowPower]);
      }
    }
    for (const rec of asset.meshes) {
      for (const prim of rec.primitives) {
        let geo = prim.geometry;
        const glowName = prim.material?.name || '';
        if (glowName === 'pav_glow' || glowName === 'km_glow' || glowName === 'hz_glow') {
          geo = stampWindowUv(api.T, geo);
          prim.geometry = geo;
          wireWindowRecess(prim.material);
        }
        api.queue(geo, prim.material, x, y, z, sx, sy, sz, yaw);
      }
    }
    return true;
  }

  // 传统重檐歇山/庑殿屋顶（两层飞檐 + 脊饰）
  function addDoubleRoof(box, P, x, baseY, z, w, d, tileMat, ridgeMat = P.gold) {
    // 下檐
    box(tileMat, x, baseY + .35, z, w + 2.8, .55, d + 2.8);
    box(tileMat, x, baseY + .95, z, w + 1.2, .75, d + 1.2);
    box(P.darkTimber, x, baseY - .08, z, w + 1.8, .3, d + 1.8);
    // 上檐腰墙
    box(P.vermilion, x, baseY + 2.1, z, w * .76, 1.7, d * .76);
    box(P.warmGlow, x, baseY + 2.1, z, w * .78, .75, d * .62);
    // 上檐屋盖
    box(tileMat, x, baseY + 3.25, z, w * .92 + 2.2, .52, d * .92 + 2.2);
    box(tileMat, x, baseY + 3.9, z, w * .76, .88, d * .76);
    box(tileMat, x, baseY + 4.65, z, w * .56, .82, d * .56);
    // 正脊与吻兽
    const ridgeW = w >= d ? w * .54 : .52;
    const ridgeD = w >= d ? .52 : d * .54;
    box(ridgeMat, x, baseY + 5.2, z, ridgeW, .45, ridgeD);
    if (w >= d) {
      box(ridgeMat, x - w * .26, baseY + 5.65, z, .7, .75, .6);
      box(ridgeMat, x + w * .26, baseY + 5.65, z, .7, .75, .6);
    } else {
      box(ridgeMat, x, baseY + 5.65, z - d * .26, .6, .75, .7);
      box(ridgeMat, x, baseY + 5.65, z + d * .26, .6, .75, .7);
    }
  }

  // 江南徽派粉墙黛瓦马头墙院落单栋
  function addHuizhouHouse(api, P, x, z, w, d, h = 7.4, facing = 0, lanternCount = 3) {
    const { box, solid, pole } = api;
    if (placeGLB(api, 'huizhouHouse', x, .18, z, w / 12.0, h / 7.4, d / 8.0, facing, 2.8)) {
      solid(x, z, w + .6, d + .6, h + 2.5);
      return;
    }
    box(P.stone, x, .32, z, w + .8, .55, d + .8);
    box(P.whiteWall, x, h * .5 + .35, z, w, h, d);
    // 底部青砖裙墙
    box(P.cityBrick, x, 1.25, z, w + .18, 1.85, d + .18);
    // 二层木构花窗与暗色门坊
    box(P.darkTimber, x, 1.9, z, w + .22, .26, d + .22);
    box(P.warmGlow, x, h * .65, z, w + .16, 1.25, d * .58);
    box(P.warmGlow, x, h * .65, z, w * .58, 1.25, d + .16);
    // 黛瓦人字坡顶
    box(P.slateTile, x, h + .55, z - d * .22, w + 1.2, .45, d * .58, 0, .22, 0);
    box(P.slateTile, x, h + .55, z + d * .22, w + 1.2, .45, d * .58, 0, -.22, 0);
    box(P.slateTile, x, h + 1.25, z, w + 1.0, .42, .85);
    // 东西两侧阶梯式马头墙
    for (const side of [-1, 1]) {
      const gx = x + side * (w * .5 + .22);
      box(P.whiteWall, gx, h * .55 + .5, z, .52, h + 1.2, d + .4);
      box(P.whiteWall, gx, h + 1.35, z, .52, 1.45, d * .64);
      box(P.whiteWall, gx, h + 2.25, z, .52, 1.15, d * .32);
      box(P.slateTile, gx, h + .75, z, .86, .22, d + .65);
      box(P.slateTile, gx, h + 2.15, z, .86, .22, d * .68);
      box(P.slateTile, gx, h + 2.9, z, .86, .22, d * .36);
    }
    // 檐下红灯笼
    const cos = Math.cos(facing), sin = Math.sin(facing);
    for (let i = 0; i < lanternCount; i++) {
      const t = lanternCount === 1 ? 0 : (i / (lanternCount - 1) - .5) * (w * .68);
      const lx = x + t * cos + sin * (d * .5 + .65);
      const lz = z - t * sin + cos * (d * .5 + .65);
      pole(P.lantern, lx, 3.55, lz, .42, .56);
    }
    solid(x, z, w + .6, d + .6, h + 2.5);
  }

  // 1. 水亭门城楼与明代古城墙 (衢州古城核心地标 · 大西门)
  function buildShuitingmen(api, P, ox, oz) {
    const { box, pole, queue, solid, surface, sign, fixture, deciduous, nightMaterials } = api;
    const Q = window.QuzhouRoadData;
    const isOsm = Boolean(Q?.IS_OSM_QUZHOU);
    const [gx, gz] = Number.isFinite(ox) && Number.isFinite(oz) ? [ox, oz] : landmarkPos('shuitingmen', -244, -36);
    if (isOsm) {
      // 适配真实 OSM 滨江地块 (26×40m，西临衢江中路、东接水亭街)
      box(P.stone, gx, .24, gz, 26, .34, 40);
      surface(gx, gz, 26, 40, .41);
      const wallX = gx - 9.4;
      for (const [wz, wd] of [[gz - 13.8, 11.2], [gz + 13.8, 11.2]]) {
        box(P.cityBrick, wallX, 3.2, wz, 4.2, 6.0, wd);
        box(P.darkBrick, wallX, 6.35, wz, 4.7, .32, wd + .35);
        for (let dz = -wd * .4; dz <= wd * .4 + .01; dz += 2.4) {
          box(P.cityBrick, wallX - 1.95, 7.0, wz + dz, .52, 1.0, 1.15);
          box(P.cityBrick, wallX + 1.95, 7.0, wz + dz, .52, 1.0, 1.15);
        }
        solid(wallX, wz, 4.6, wd, 7.6);
      }
      const px = gx + 1.6;
      if (!placeGLB(api, 'cityGateArch', px, .28, gz, 1.08, 1.0, 1.20, PI / 2)) {
        box(P.cityBrick, px, 3.35, gz, 16.8, 6.3, 19.6);
        box(P.darkBrick, px, 6.68, gz, 17.8, .38, 20.6);
      }
      const pavAsset = window.Tideline?.getAAAModel?.('shuitingmenPavilion');
      if (pavAsset && queue) {
        for (const m of pavAsset.materials) {
          m.userData.castShadow = shouldCastShadow(m);
          if (m.name === 'pav_glow' && !m.userData.nightWired) {
            m.userData.nightWired = true;
            nightMaterials?.push([m, 3.6]);
          }
        }
        for (const rec of pavAsset.meshes) {
          for (const prim of rec.primitives) {
            let geo = prim.geometry;
            if (prim.material?.name === 'pav_glow') {
              geo = stampWindowUv(api.T, geo);
              prim.geometry = geo;
              wireWindowRecess(prim.material);
            }
            queue(geo, prim.material, px, 6.88, gz, .74, .86, .80, PI / 2);
          }
        }
      } else {
        box(P.vermilion, px, 8.9, gz, 12.6, 4.0, 14.2);
        box(P.warmGlow, px, 8.95, gz, 12.9, 1.9, 9.6);
        addDoubleRoof(box, P, px, 10.95, gz, 14.8, 16.4, P.slateTile, P.gold);
      }
      sign('水亭门城楼', 'SHUITINGMEN GATE', '#ffe19c', px - 8.75, 5.75, gz, 9.2, 2.05, -PI / 2);
      sign('水亭门 · 三街七巷', 'QUZHOU ANCIENT CITY', '#ffe19c', px + 8.75, 5.75, gz, 9.6, 2.05, PI / 2);
      sign('水亭门', 'MING DYNASTY GATE', '#ffd07a', px, 10.8, gz - 9.2, 6.8, 1.65, PI);
      fixture(px - 10.5, 7.2, gz, '#ffb46e', 98, 26);
      fixture(px + 10.5, 7.2, gz, '#ffbe78', 98, 26);
      solid(px, gz, 17.6, 20.4, 16.5);
      addHuizhouHouse(api, P, gx + 4.8, gz - 14.4, 11.2, 8.6, 6.2, PI / 2, 2);
      addHuizhouHouse(api, P, gx + 4.8, gz + 14.4, 11.2, 8.6, 6.2, PI / 2, 2);
      if (!Q?.onAnyRoad?.(gx + 11.4, gz, 1.8)) deciduous(gx + 11.4, gz, 5.4);
      return;
    }
    // 城门广场青石基台
    box(P.stone, gx, .24, gz, 46, .34, 78);
    surface(gx, gz, 46, 78, .41);
    // 南北延伸的明代青砖城墙（临水亭门西侧）
    const wallX = -258;
    for (const [wz, wd] of [[-62, 24], [-10, 24]]) {
      box(P.cityBrick, wallX, 3.5, wz, 6.2, 6.6, wd);
      box(P.darkBrick, wallX, 6.95, wz, 6.8, .35, wd + .4);
      for (let dz = -wd * .44; dz <= wd * .44; dz += 2.6) {
        box(P.cityBrick, wallX - 2.95, 7.65, wz + dz, .65, 1.15, 1.4);
        box(P.cityBrick, wallX + 2.95, 7.65, wz + dz, .65, 1.15, 1.4);
      }
      solid(wallX, wz, 6.6, wd, 8.2);
    }
    // 城楼石砌城台（带拱门造型凹龛）
    box(P.cityBrick, gx, 3.6, gz, 26, 6.8, 22);
    box(P.darkBrick, gx, 7.2, gz, 27.2, .42, 23.2);
    // 东西城门洞暗影拱框
    box(P.darkTimber, gx - 13.08, 2.5, gz, .36, 4.6, 5.4);
    box(P.darkTimber, gx + 13.08, 2.5, gz, .36, 4.6, 5.4);
    box(P.stone, gx - 13.15, 5.1, gz, .5, .75, 6.4);
    box(P.stone, gx + 13.15, 5.1, gz, .5, .75, 6.4);
    // 城台女儿墙垛口
    for (let i = -10; i <= 10; i += 3.3) {
      box(P.cityBrick, gx + i, 7.85, gz - 11.2, 1.8, .95, .6);
      box(P.cityBrick, gx + i, 7.85, gz + 11.2, 1.8, .95, .6);
    }
    const pavAsset = window.Tideline?.getAAAModel?.('shuitingmenPavilion');
    if (pavAsset && queue) {
      for (const m of pavAsset.materials) {
        m.userData.castShadow = shouldCastShadow(m);
        if (m.name === 'pav_glow' && !m.userData.nightWired) {
          m.userData.nightWired = true;
          nightMaterials?.push([m, 3.6]);
        }
      }
      for (const rec of pavAsset.meshes) {
        for (const prim of rec.primitives) {
          let geo = prim.geometry;
          if (prim.material?.name === 'pav_glow') {
            geo = stampWindowUv(api.T, geo);
            prim.geometry = geo;
            wireWindowRecess(prim.material);
          }
          queue(geo, prim.material, gx, 7.42, gz, 1.08, 1.05, 1.15, PI / 2);
        }
      }
    } else {
      box(P.vermilion, gx, 9.75, gz, 18.6, 4.6, 14.2);
      box(P.warmGlow, gx, 9.8, gz, 19.0, 2.1, 9.6);
      for (let px = -9.4; px <= 9.4; px += 4.7) {
        for (const pz of [-7.4, 7.4]) {
          pole(P.vermilion, gx + px, 9.6, gz + pz, .48, 4.5);
        }
      }
      addDoubleRoof(box, P, gx, 12.1, gz, 21.5, 16.5, P.slateTile, P.gold);
      for (const lz of [-8.2, -3.2, 3.2, 8.2]) {
        pole(P.lantern, gx - 11.2, 11.4, gz + lz, .54, .78);
        pole(P.lantern, gx + 11.2, 11.4, gz + lz, .54, .78);
      }
    }
    sign('水亭门城楼', 'SHUITINGMEN GATE', '#ffe19c', gx - 13.35, 6.2, gz, 10.6, 2.35, -PI / 2);
    sign('水亭门 · 三街七巷', 'QUZHOU ANCIENT CITY', '#ffe19c', gx + 13.35, 6.2, gz, 11.4, 2.35, PI / 2);
    sign('水亭门', 'MING DYNASTY GATE', '#ffd07a', gx, 11.85, gz - 9.8, 7.6, 1.85, PI);
    fixture(gx - 15, 7.5, gz, '#ffb46e', 105, 28);
    fixture(gx + 15, 7.5, gz, '#ffbe78', 105, 28);
    fixture(gx, 14.5, gz - 12, '#ffcf88', 90, 24);
    solid(gx, gz, 26.8, 22.8, 17.5);

    // 城楼南北两侧水亭街徽派老铺
    addHuizhouHouse(api, P, -234, -67, 17, 13, 6.8, PI / 2, 3);
    addHuizhouHouse(api, P, -234, -5, 17, 13, 6.8, PI / 2, 3);
    deciduous(-224, -36, 5.8);
  }

  // 2. 水亭门三街七巷历史街坊
  function buildShuitingAlley(api, P, face, pts, alleyIdx = 0) {
    const { box, solid, sign, fixture, deciduous } = api;
    const Q = window.QuzhouRoadData;
    if (Q?.IS_OSM_QUZHOU && face && pts?.length >= 3) {
      const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const spanW = maxX - minX, spanD = maxZ - minZ;
      const fits = (cx, cz, w, d, margin = 2.0) => {
        for (const sx of [-.5, 0, .5]) {
          for (const sz of [-.5, 0, .5]) {
            const px = cx + sx * w, pz = cz + sz * d;
            if (!pointInPoly(px, pz, pts)) return false;
            if (Q.onAnyRoad(px, pz, margin) || Q.inAnyWater?.(px, pz, 1.5)) return false;
          }
        }
        return true;
      };
      const slots = spanD > spanW * 1.25
        ? [[face.cx, face.cz - spanD * .2], [face.cx, face.cz + spanD * .2]]
        : spanW > spanD * 1.25
          ? [[face.cx - spanW * .2, face.cz], [face.cx + spanW * .2, face.cz]]
          : [[face.cx, face.cz]];
      const placed = [];
      for (let i = 0; i < slots.length; i++) {
        const [sx, sz] = slots[i];
        const baseW = Math.min(20, Math.max(9.5, spanW * (slots.length > 1 && spanW > spanD ? .34 : .46)));
        const baseD = Math.min(18, Math.max(9.5, spanD * (slots.length > 1 && spanD >= spanW ? .34 : .46)));
        let chosen = null;
        for (const sc of [1, .82, .68, .54]) {
          const w = baseW * sc, d = baseD * sc;
          if (w >= 8 && d >= 8 && fits(sx, sz, w, d, 2.0) &&
              !placed.some(b => Math.abs(b.x - sx) < (b.w + w) * .5 + 2.2 && Math.abs(b.z - sz) < (b.d + d) * .5 + 2.2)) {
            chosen = { x: sx, z: sz, w, d };
            break;
          }
        }
        if (!chosen) continue;
        box(P.stone, chosen.x, .18, chosen.z, chosen.w + 2.6, .22, chosen.d + 2.6);
        addHuizhouHouse(api, P, chosen.x, chosen.z, chosen.w, chosen.d, 6.8 + (i % 2) * .6, i % 2 ? 0 : PI, 3);
        placed.push(chosen);
      }
      if (!placed.length) {
        for (const [w, d] of [[14, 12], [11, 10], [9, 9]]) {
          if (fits(face.cx, face.cz, w, d, 1.8)) {
            box(P.stone, face.cx, .18, face.cz, w + 2.2, .22, d + 2.2);
            addHuizhouHouse(api, P, face.cx, face.cz, w, d, 6.8, 0, 2);
            placed.push({ x: face.cx, z: face.cz, w, d });
            break;
          }
        }
      }
      if (placed.length) {
        const main = placed[0];
        if (alleyIdx === 0) {
          sign('水亭街历史文化街区', 'SHUITING HISTORIC BLOCK', '#ffd58c', main.x, 4.9, main.z + main.d * .5 + .55, Math.min(10.5, main.w * .85), 1.9, 0);
          fixture(main.x, 4.2, main.z + main.d * .5 + 2.4, '#ffbc73', 68, 18);
        } else if (alleyIdx === 1) {
          sign('周宣灵王庙 · 柴家巷', 'CHAIJIA ALLEY HERITAGE', '#b8f0dc', main.x, 4.9, main.z - main.d * .5 - .55, Math.min(10.0, main.w * .85), 1.9, PI);
          fixture(main.x, 4.2, main.z - main.d * .5 - 2.4, '#ffc680', 64, 18);
        }
        const tx = main.x + main.w * .5 + 2.6, tz = main.z;
        if (pointInPoly(tx, tz, pts) && !Q.onAnyRoad(tx, tz, 2.2) && !Q.inAnyWater?.(tx, tz, 1.8)) {
          deciduous(tx, tz, 5.5);
        }
      }
      return;
    }
    // 青石板商业巷地面
    box(P.stone, -160, .18, -36, 48, .22, 92);
    // 三组粉墙黛瓦徽派合院 + 牌坊
    addHuizhouHouse(api, P, -162, -72, 26, 16, 7.2, PI, 4);
    addHuizhouHouse(api, P, -164, -36, 24, 18, 7.6, -PI / 2, 4);
    addHuizhouHouse(api, P, -160, 0, 26, 16, 7.0, 0, 4);
    sign('水亭街历史文化街区', 'SHUITING HISTORIC BLOCK', '#ffd58c', -162, 5.2, -80.4, 12.2, 2.2, PI);
    sign('周宣灵王庙 · 柴家巷', 'CHAIJIA ALLEY HERITAGE', '#b8f0dc', -149.2, 4.9, -36, 10.6, 2.1, PI / 2);
    fixture(-162, 4.4, -82, '#ffbc73', 72, 18);
    fixture(-147, 4.2, -36, '#ffc680', 68, 18);
    deciduous(-142, -62, 5.6);
    deciduous(-142, -12, 5.9);
    solid(-162, -72, 26, 16, 9);
  }

  // 3. 天王塔院 (七层楼阁式砖塔 + 古刹山门庭院)
  function buildTianwangPagoda(api, P, ox, oz) {
    const { box, pole, queue, solid, surface, sign, fixture, deciduous, nightMaterials } = api;
    const Q = window.QuzhouRoadData;
    const isOsm = Boolean(Q?.IS_OSM_QUZHOU);
    const [tx, tz] = Number.isFinite(ox) && Number.isFinite(oz) ? [ox, oz] : landmarkPos('tianwang', -182, -184);
    if (isOsm) {
      // 适配天王巷与县西街间的紧凑古刹院落 (12.6×16.8m，严格避让真实街巷)
      box(P.stone, tx, .24, tz, 12.6, .34, 16.8);
      surface(tx, tz, 12.6, 16.8, .41);
      box(P.warmWall, tx - 5.9, 1.85, tz, .65, 3.2, 16.0);
      box(P.warmWall, tx + 5.9, 1.85, tz, .65, 3.2, 16.0);
      box(P.warmWall, tx, 1.85, tz - 8.0, 12.2, 3.2, .65);
      box(P.slateTile, tx - 5.9, 3.58, tz, 1.0, .26, 16.3);
      box(P.slateTile, tx + 5.9, 3.58, tz, 1.0, .26, 16.3);
      box(P.slateTile, tx, 3.58, tz - 8.0, 12.5, .26, 1.0);
      // 南向山门
      box(P.vermilion, tx, 2.75, tz + 7.55, 7.8, 4.9, 1.5);
      box(P.slateTile, tx, 5.45, tz + 7.55, 9.2, .52, 2.7);
      box(P.gold, tx, 5.95, tz + 7.55, 6.2, .26, .32);
      sign('天王塔院', 'TIANWANG PAGODA', '#ffe3a2', tx, 4.35, tz + 8.42, 6.8, 1.55, 0);
      fixture(tx, 4.5, tz + 9.2, '#ffbe74', 76, 18);
      solid(tx, tz + 7.55, 8.2, 1.8, 6.2);

      const px = tx, pz = tz - 1.0;
      const pagAsset = window.Tideline?.getAAAModel?.('tianwangPagoda');
      let curY = 28;
      if (pagAsset && queue) {
        for (const m of pagAsset.materials) {
          m.userData.castShadow = shouldCastShadow(m);
          if (m.name === 'pag_glow' && !m.userData.nightWired) {
            m.userData.nightWired = true;
            nightMaterials?.push([m, 3.8]);
          }
        }
        for (const rec of pagAsset.meshes) {
          for (const prim of rec.primitives) {
            queue(prim.geometry, prim.material, px, .41, pz, .68, .78, .68, 0);
          }
        }
      } else {
        box(P.stone, px, .85, pz, 10.6, 1.25, 10.6);
        box(P.stone, px, 1.7, pz, 9.2, .65, 9.2);
        curY = 2.05;
        for (let floor = 0; floor < 7; floor++) {
          const span = 8.0 - floor * .72;
          const fh = 3.2 - floor * .19;
          box(P.warmWall, px, curY + fh * .5, pz, span, fh, span, 0);
          box(P.warmWall, px, curY + fh * .5, pz, span, fh, span, PI / 4);
          box(P.warmGlow, px, curY + fh * .52, pz, span + .14, fh * .36, span * .28, 0);
          const eave = span + 1.95 - floor * .12;
          box(P.slateTile, px, curY + fh + .2, pz, eave, .38, eave, 0);
          box(P.slateTile, px, curY + fh + .2, pz, eave, .38, eave, PI / 4);
          curY += fh + .42;
        }
        pole(P.gold, px, curY + 2.6, pz, .42, 4.2);
      }
      fixture(px, 12, pz + 6, '#ffc984', 96, 26);
      fixture(px, 22, pz - 5, '#ffd496', 84, 24);
      solid(px, pz, 11.0, 11.0, curY + 4);
      for (const [dx, dz] of [[0, -24], [0, -34]]) {
        const ax = tx + dx, az = tz + dz;
        if (!Q.onAnyRoad(ax, az, 3.2) && !Q.inAnyWater?.(ax, az, 2.0)) deciduous(ax, az, 6.2);
      }
      return;
    }
    // 塔院青石台基与院墙
    box(P.stone, tx, .28, tz, 64, .38, 76);
    surface(tx, tz, 64, 76, .47);
    // 围墙（南面留出山门）
    box(P.warmWall, tx - 31, 2.2, tz, 1.4, 4.0, 74);
    box(P.warmWall, tx + 31, 2.2, tz, 1.4, 4.0, 74);
    box(P.warmWall, tx, 2.2, tz - 37, 63, 4.0, 1.4);
    box(P.slateTile, tx - 31, 4.35, tz, 2.0, .35, 74.6);
    box(P.slateTile, tx + 31, 4.35, tz, 2.0, .35, 74.6);
    box(P.slateTile, tx, 4.35, tz - 37, 63.6, .35, 2.0);
    // 东西配殿
    addHuizhouHouse(api, P, tx - 21, tz + 8, 12, 24, 6.2, PI / 2, 3);
    addHuizhouHouse(api, P, tx + 21, tz + 8, 12, 24, 6.2, -PI / 2, 3);
    // 南向山门牌楼
    box(P.vermilion, tx, 3.6, tz + 36, 18, 6.6, 5.4);
    box(P.slateTile, tx, 7.2, tz + 36, 21, .75, 7.8);
    box(P.slateTile, tx, 8.1, tz + 36, 17, .9, 5.6);
    box(P.gold, tx, 8.75, tz + 36, 14, .36, .45);
    sign('天王塔院', 'TIANWANG PAGODA', '#ffe3a2', tx, 5.6, tz + 38.9, 10.2, 2.2, 0);
    fixture(tx, 5.2, tz + 40.5, '#ffbe74', 82, 20);
    solid(tx, tz + 36, 18.5, 6.2, 9.2);

    // 七层古砖塔主体（逐层收分 + 飞檐翘角 + 夜间环灯 + 鎏金塔刹）
    const px = tx, pz = tz - 4;
    const pagAsset = window.Tideline?.getAAAModel?.('tianwangPagoda');
    let curY = 34;
    if (pagAsset && queue) {
      for (const m of pagAsset.materials) {
        m.userData.castShadow = shouldCastShadow(m);
        if (m.name === 'pag_glow' && !m.userData.nightWired) {
          m.userData.nightWired = true;
          nightMaterials?.push([m, 3.8]);
        }
      }
      for (const rec of pagAsset.meshes) {
        for (const prim of rec.primitives) {
          queue(prim.geometry, prim.material, px, .46, pz, 1.18, 1.05, 1.18, 0);
        }
      }
    } else {
      box(P.stone, px, .95, pz, 19.5, 1.6, 19.5);
      box(P.stone, px, 2.1, pz, 16.5, .9, 16.5);
      curY = 2.55;
      for (let floor = 0; floor < 7; floor++) {
        const radius = 6.9 - floor * .66;
        const fh = 3.9 - floor * .24;
        const span = radius * 2;
        box(P.warmWall, px, curY + fh * .5, pz, span, fh, span, 0);
        box(P.warmWall, px, curY + fh * .5, pz, span, fh, span, PI / 4);
        box(P.warmGlow, px, curY + fh * .52, pz, span + .18, fh * .38, span * .28, 0);
        box(P.warmGlow, px, curY + fh * .52, pz, span * .28, fh * .38, span + .18, 0);
        const eave = span + 3.1 - floor * .18;
        box(P.darkTimber, px, curY + fh - .06, pz, eave - .5, .28, eave - .5, 0);
        box(P.slateTile, px, curY + fh + .28, pz, eave, .46, eave, 0);
        box(P.slateTile, px, curY + fh + .28, pz, eave, .46, eave, PI / 4);
        if (floor % 2 === 0) {
          pole(P.lantern, px - eave * .46, curY + fh - .1, pz + eave * .46, .34, .46);
          pole(P.lantern, px + eave * .46, curY + fh - .1, pz - eave * .46, .34, .46);
        }
        curY += fh + .52;
      }
      box(P.slateTile, px, curY + .6, pz, 5.4, 1.2, 5.4, 0);
      box(P.slateTile, px, curY + .6, pz, 5.4, 1.2, 5.4, PI / 4);
      pole(P.gold, px, curY + 3.6, pz, .58, 5.4);
      pole(P.warmGlow, px, curY + 6.4, pz, .76, .76);
    }
    fixture(px, 14, pz + 10, '#ffc984', 110, 32);
    fixture(px, 26, pz - 8, '#ffd496', 95, 30);
    solid(px, pz, 18.5, 18.5, curY + 6);

    for (const [dx, dz] of [[-24, -24], [24, -24], [-22, 26], [22, 26]]) {
      deciduous(tx + dx, tz + dz, 6.8);
    }
  }

  // 4. 孔氏南宗家庙 (朱红宫墙 · 棂星门 · 大成殿重檐黄琉璃顶 · 古柏森森)
  function buildKongmiao(api, P, ox, oz) {
    const { box, pole, solid, surface, sign, fixture, deciduous } = api;
    const Q = window.QuzhouRoadData;
    const [kx, kz] = Number.isFinite(ox) && Number.isFinite(oz) ? [ox, oz] : landmarkPos('kongmiao', 222, -168);
    if (Q?.IS_OSM_QUZHOU) {
      // 适配新桥街与后花园路间真实宗庙街区 (26×26m)
      box(P.stone, kx, .24, kz, 26, .34, 26);
      surface(kx, kz, 26, 26, .41);
      for (const [wx, wz, ww, wd] of [
        [kx - 12.5, kz, .95, 25.4],
        [kx + 12.5, kz, .95, 25.4],
        [kx, kz - 12.5, 25.6, .95],
        [kx - 8.4, kz + 12.5, 8.6, .95],
        [kx + 8.4, kz + 12.5, 8.6, .95],
      ]) {
        box(P.vermilion, wx, 2.0, wz, ww, 3.4, wd);
        box(P.goldTile, wx, 3.85, wz, ww + .36, .32, wd + .36);
      }
      // 棂星门牌坊
      const gateZ = kz + 12.35;
      if (!placeGLB(api, 'kongmiaoPaifang', kx, .36, gateZ, 1.02, 1.0, 1.0, 0)) {
        for (const gx of [-4.2, -1.6, 1.6, 4.2]) {
          pole(P.stone, kx + gx, 3.4, gateZ, .48, 6.2);
          box(P.gold, kx + gx, 6.7, gateZ, .62, .48, .62);
        }
        box(P.vermilion, kx, 4.95, gateZ, 9.4, .82, .75);
        box(P.goldTile, kx, 5.75, gateZ, 10.6, .48, 1.65);
        box(P.goldTile, kx, 6.45, gateZ, 5.2, .52, 1.8);
      }
      sign('孔氏南宗家庙', 'NANZONG CONFUCIUS TEMPLE', '#ffe6a3', kx, 5.05, gateZ + .85, 9.6, 1.85, 0);
      fixture(kx, 5.2, gateZ + 2.4, '#ffc87d', 88, 22);
      // 中轴神道 + 大成殿
      box(P.stone, kx, .44, kz + 4.2, 4.2, .12, 14.5);
      const hx = kx, hz = kz - 3.6;
      if (!placeGLB(api, 'kongmiaoHall', hx, .36, hz, .96, .96, .92, 0, 3.0)) {
        box(P.stone, hx, .95, hz, 18.4, 1.45, 11.4);
        box(P.vermilion, hx, 4.15, hz, 15.2, 5.2, 8.6);
        box(P.warmGlow, hx, 4.15, hz, 15.45, 2.2, 5.6);
        for (let px = -6.4; px <= 6.4 + .01; px += 3.2) {
          pole(P.vermilion, hx + px, 4.1, hz + 4.65, .38, 5.0);
          pole(P.vermilion, hx + px, 4.1, hz - 4.65, .38, 5.0);
        }
        addDoubleRoof(box, P, hx, 6.8, hz, 16.4, 9.6, P.goldTile, P.gold);
      }
      sign('大成殿', 'HALL OF CONFUCIUS', '#ffe9aa', hx, 6.65, hz + 5.2, 6.6, 1.55, 0);
      fixture(hx, 7.2, hz + 6.8, '#ffcf86', 96, 26);
      // 东西配庑与庭院古柏
      for (const side of [-1, 1]) {
        box(P.vermilion, kx + side * 9.8, 2.4, kz + 3.2, 3.0, 3.9, 10.6);
        box(P.slateTile, kx + side * 9.8, 4.65, kz + 3.2, 4.0, .65, 11.6);
        deciduous(kx + side * 6.4, kz + 7.2, 5.6);
      }
      solid(kx, kz - 1.2, 24.4, 21.8, 12.8);
      return;
    }
    // 家庙台基
    box(P.stone, kx, .28, kz, 98, .38, 102);
    surface(kx, kz, 98, 102, .47);
    // 朱红宫墙（南孔家庙标志性红墙黄瓦）
    for (const [wx, wz, ww, wd] of [
      [kx - 47.5, kz, 1.6, 98],
      [kx + 47.5, kz, 1.6, 98],
      [kx, kz - 48.5, 96.5, 1.6],
      [kx - 31, kz + 48.5, 34, 1.6],
      [kx + 31, kz + 48.5, 34, 1.6],
    ]) {
      box(P.vermilion, wx, 2.35, wz, ww, 4.2, wd);
      box(P.goldTile, wx, 4.65, wz, ww + .55, .42, wd + .55);
    }
    // 南门棂星门牌坊（三间四柱）
    const gateZ = kz + 48.2;
    for (const ox of [-10, -3.8, 3.8, 10]) {
      pole(P.stone, kx + ox, 4.4, gateZ, .72, 8.2);
      box(P.gold, kx + ox, 8.8, gateZ, .92, .7, .92);
    }
    box(P.vermilion, kx, 6.4, gateZ, 21.5, 1.15, 1.05);
    box(P.goldTile, kx, 7.45, gateZ, 23.2, .65, 2.4);
    box(P.goldTile, kx, 8.35, gateZ, 10.6, .7, 2.6);
    sign('孔氏南宗家庙', 'NANZONG CONFUCIUS TEMPLE', '#ffe6a3', kx, 6.5, gateZ + 1.1, 15.2, 2.6, 0);
    fixture(kx, 6.2, gateZ + 3.6, '#ffc87d', 98, 26);
    // 东侧沿新河沿提示牌匾
    sign('南孔圣地 · 衢州有礼', 'CONFUCIUS HERITAGE QUZHOU', '#ffe29c', kx + 48.8, 4.1, kz + 4, 15.8, 2.6, PI / 2);

    // 中轴神道与思鲁阁前亭
    box(P.stone, kx, .52, kz + 14, 9.5, .14, 58);
    box(P.vermilion, kx, 3.4, kz + 24, 16, 5.4, 9.5);
    box(P.goldTile, kx, 6.6, kz + 24, 19.5, .75, 12.6);
    box(P.goldTile, kx, 7.55, kz + 24, 15.5, .95, 9.4);
    solid(kx, kz + 24, 17, 10.5, 8.6);

    // 核心建筑：大成殿（白石月台 + 朱漆大柱 + 重檐庑殿黄琉璃瓦）
    const hx = kx, hz = kz - 14;
    box(P.stone, hx, 1.25, hz, 54, 2.1, 34);
    box(P.stone, hx, .95, hz + 19, 26, 1.4, 8);
    box(P.vermilion, hx, 5.8, hz, 44, 7.4, 24);
    box(P.warmGlow, hx, 5.7, hz, 44.3, 3.2, 16);
    for (let px = -20; px <= 20; px += 5) {
      pole(P.vermilion, hx + px, 5.8, hz + 12.8, .58, 7.2);
      pole(P.vermilion, hx + px, 5.8, hz - 12.8, .58, 7.2);
    }
    addDoubleRoof(box, P, hx, 9.55, hz, 47, 27, P.goldTile, P.gold);
    sign('大成殿', 'HALL OF CONFUCIUS', '#ffe9aa', hx, 9.4, hz + 14.3, 8.8, 2.1, 0);
    fixture(hx, 9.5, hz + 17, '#ffcf86', 115, 32);
    // 东西庑配殿
    for (const side of [-1, 1]) {
      const cx = kx + side * 35;
      box(P.vermilion, cx, 3.1, kz + 4, 9.5, 5.2, 46);
      box(P.slateTile, cx, 6.2, kz + 4, 12.2, .9, 48.5);
      solid(cx, kz + 4, 10.5, 47, 7.2);
    }
    // 庭院古柏
    for (const [bx, bz] of [[-18, 34], [18, 34], [-18, 10], [18, 10], [-36, -34], [36, -34]]) {
      deciduous(kx + bx, kz + bz, 7.2);
    }
    solid(hx, hz, 54, 35, 16.5);
    solid(kx - 47.5, kz, 2.4, 98, 5);
    solid(kx + 47.5, kz, 2.4, 98, 5);
    solid(kx, kz - 48.5, 96, 2.4, 5);
  }

  // 5. 衢州钟楼 (北门街与县西街交汇处古报时楼)
  function buildBellTower(api, P, ox, oz) {
    const { box, pole, solid, surface, sign, fixture, deciduous } = api;
    const Q = window.QuzhouRoadData;
    const [bx, bz] = Number.isFinite(ox) && Number.isFinite(oz) ? [ox, oz] : landmarkPos('belltower', -60, -176);
    if (Q?.IS_OSM_QUZHOU) {
      // 适配钟楼底真实街区 (24×24m)
      box(P.stone, bx, .24, bz, 24, .34, 24);
      surface(bx, bz, 24, 24, .41);
      if (!placeGLB(api, 'bellTower', bx, .36, bz, 1.0, .96, 1.0, 0, 3.2)) {
        box(P.cityBrick, bx, 2.85, bz, 16.4, 5.2, 16.4);
        box(P.darkBrick, bx, 5.65, bz, 17.4, .4, 17.4);
        box(P.vermilion, bx, 8.0, bz, 11.8, 4.4, 11.8);
        box(P.slateTile, bx, 10.55, bz, 15.2, .54, 15.2);
        for (const sx of [-4.1, 4.1]) {
          for (const sz of [-4.1, 4.1]) {
            pole(P.vermilion, bx + sx, 12.95, bz + sz, .44, 4.4);
          }
        }
        pole(P.bronze, bx, 12.95, bz, 2.1, 2.8);
        box(P.slateTile, bx, 15.45, bz, 13.6, .52, 13.6);
        pole(P.gold, bx, 18.8, bz, .52, 2.3);
      }
      sign('衢州钟楼', 'QUZHOU BELL TOWER', '#ffe3a2', bx, 5.45, bz + 8.95, 9.2, 1.95, 0);
      sign('北门街 · 钟楼底', 'BEIMEN HISTORIC AXIS', '#9eead6', bx + 8.95, 5.45, bz, 9.6, 1.95, PI / 2);
      fixture(bx, 10.2, bz + 10.5, '#ffc47c', 90, 24);
      fixture(bx, 13.8, bz, '#ffdb99', 76, 20);
      solid(bx, bz, 17.2, 17.2, 19.5);
      for (const [dx, dz] of [[-9.6, -9.6], [9.6, -9.6], [-9.6, 9.6], [9.6, 9.6]]) {
        deciduous(bx + dx, bz + dz, 5.4);
      }
      return;
    }
    box(P.stone, bx, .24, bz, 74, .34, 114);
    surface(bx, bz, 74, 114, .41);
    // 钟楼青砖基台
    box(P.cityBrick, bx, 3.2, bz, 26, 6.0, 26);
    box(P.darkBrick, bx, 6.45, bz, 27.4, .48, 27.4);
    box(P.darkTimber, bx, 2.4, bz + 13.08, 5.2, 4.4, .36);
    box(P.darkTimber, bx, 2.4, bz - 13.08, 5.2, 4.4, .36);
    // 一层朱红方阁
    box(P.vermilion, bx, 9.2, bz, 17.5, 5.0, 17.5);
    box(P.warmGlow, bx, 9.2, bz, 17.8, 2.4, 10.4);
    box(P.warmGlow, bx, 9.2, bz, 10.4, 2.4, 17.8);
    box(P.slateTile, bx, 12.1, bz, 22.4, .62, 22.4);
    // 二层透空悬钟阁与古铜大钟
    for (const sx of [-5.8, 5.8]) {
      for (const sz of [-5.8, 5.8]) {
        pole(P.vermilion, bx + sx, 14.9, bz + sz, .56, 5.2);
      }
    }
    pole(P.bronze, bx, 14.9, bz, 2.8, 3.4);
    box(P.gold, bx, 17.0, bz, 12.6, .42, .45);
    // 攒尖重檐阁顶
    box(P.slateTile, bx, 17.9, bz, 19.6, .62, 19.6);
    box(P.slateTile, bx, 18.85, bz, 14.2, 1.1, 14.2);
    box(P.slateTile, bx, 19.95, bz, 8.6, 1.15, 8.6);
    pole(P.gold, bx, 21.8, bz, .62, 2.8);
    sign('衢州钟楼', 'QUZHOU BELL TOWER', '#ffe3a2', bx, 6.3, bz + 13.85, 10.8, 2.3, 0);
    sign('北门街 · 钟楼底', 'BEIMEN HISTORIC AXIS', '#9eead6', bx + 13.85, 6.3, bz, 11.4, 2.2, PI / 2);
    fixture(bx, 11.5, bz + 15, '#ffc47c', 96, 26);
    fixture(bx, 15.8, bz, '#ffdb99', 80, 22);
    solid(bx, bz, 26.8, 26.8, 22.5);

    // 钟楼南北广场配楼（徽派书局与老茶坊）
    addHuizhouHouse(api, P, bx, bz - 40, 38, 16, 7.4, PI, 5);
    addHuizhouHouse(api, P, bx, bz + 40, 38, 16, 7.2, 0, 5);
    for (const [dx, dz] of [[-24, -18], [24, -18], [-24, 18], [24, 18]]) {
      deciduous(bx + dx, bz + dz, 6.2);
    }
  }

  // 6. 府山公园 · 钟灵塔 (古城中央山地绿心 + 五层八角古塔 + 映月池)
  function buildFushanPark(api, P, x, z, w, d) {
    const { box, pole, ground, solid, surface, sign, fixture, deciduous, scene } = api;
    const Q = window.QuzhouRoadData;
    const wireTurf = (material, shade) => {
      material.customProgramCacheKey = () => 'fushan-photoreal-turf-' + shade;
      material.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 vTurfPos;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', [
          '#include <worldpos_vertex>',
          'vec4 tp = vec4(transformed,1.0);',
          '#ifdef USE_INSTANCING',
          '  tp = instanceMatrix * tp;',
          '#endif',
          'vTurfPos = (modelMatrix * tp).xyz;',
        ].join('\n'));
        shader.fragmentShader = [
          'varying vec3 vTurfPos;',
          'float tHash(vec2 v){ vec3 a = fract(vec3(v.xyx)*vec3(.1031,.0973,.1099)); a += dot(a,a.yzx+33.33); return fract((a.x+a.y)*a.z); }',
          'float tNoise(vec2 p){ vec2 f=fract(p),k=f*f*(3.-2.*f),i=floor(p); return mix(mix(tHash(i),tHash(i+vec2(1,0)),k.x),mix(tHash(i+vec2(0,1)),tHash(i+1.),k.x),k.y); }',
          shader.fragmentShader.replace('#include <color_fragment>', [
            '#include <color_fragment>',
            'vec2 tp = vTurfPos.xz;',
            'float macro = tNoise(tp*.055)*.52 + tNoise(tp*.18)*.32 + tNoise(tp*.58)*.16;',
            'float dry = smoothstep(.58,.88,tNoise(tp*.085 + vec2(3.4,-5.1)));',
            'float blade = tNoise(tp*4.4)*.55 + tHash(floor(tp*15.0))*.45;',
            'float tFade = 1.0 - smoothstep(.05,.55,max(length(dFdx(tp)),length(dFdy(tp))));',
            'vec3 deepG = vec3(.16,.31,.13); vec3 midG = vec3(.28,.41,.17); vec3 warmG = vec3(.41,.39,.21);',
            'vec3 col = mix(deepG, midG, smoothstep(.20,.80,macro));',
            'col = mix(col, warmG, dry * .38);',
            'col *= (' + shade + ') * (.82 + .36 * mix(.5, blade, .30 + .70*tFade));',
            'diffuseColor.rgb = col;',
          ].join('\n')).replace('#include <normal_fragment_maps>', [
            '#include <normal_fragment_maps>',
            'vec2 tN = vec2(tNoise(vTurfPos.xz*7.2)-.5, tNoise(vTurfPos.xz*7.2+vec2(4.1,7.9))-.5);',
            'vec3 tx = transformDirection(vec3(1,0,0),viewMatrix);',
            'vec3 tz = transformDirection(vec3(0,0,1),viewMatrix);',
            'normal = normalize(normal + (tx*tN.x + tz*tN.y) * .48 * tFade);',
          ].join('\n')),
        ].join('\n');
      };
      return material;
    };
    const grass = wireTurf(new api.T.MeshStandardMaterial({ color: '#4e7c44', roughness: .94, envMapIntensity: .22 }), '1.0');
    const hill = wireTurf(new api.T.MeshStandardMaterial({ color: '#426d3a', roughness: .94, envMapIntensity: .22 }), '0.88');
    if (Q?.IS_OSM_QUZHOU && Q.PARK_POLYGONS?.[0]?.pts?.length >= 3) {
      const parkPts = Q.PARK_POLYGONS[0].pts;
      const [ox, oz] = Number.isFinite(x) && Number.isFinite(z) ? [x, z] : landmarkPos('fushan', 184, 76);
      if (scene) {
        const polyGeo = flatPolygonGeometry(api.T, parkPts);
        const polyMesh = new api.T.Mesh(polyGeo, grass);
        polyMesh.position.y = .14;
        polyMesh.receiveShadow = true;
        scene.add(polyMesh);
      }
      // 府山微地形台坡与钟灵塔基座 (位于真实公园多边形核心)
      box(hill, ox, .72, oz, 36, 1.05, 28);
      box(P.stone, ox, 1.32, oz, 16, .42, 16);
      surface(ox, oz, 36, 28, 1.25);
      // 公园林荫步道
      ground(P.stone, ox + 18, oz + 2, 42, 4.2, .19);
      ground(P.stone, ox, oz + 26, 4.2, 56, .19);
      // 西侧映月莲池与湖心亭
      const lx = ox - 26, lz = oz + 8;
      box(P.stone, lx, .34, lz, 22, .26, 18);
      box(P.water, lx, .47, lz, 19.2, .12, 15.2);
      box(P.vermilion, lx, 2.0, lz, 5.4, 2.9, 5.4);
      box(P.slateTile, lx, 3.8, lz, 7.8, .64, 7.8);
      box(P.gold, lx, 4.6, lz, .95, .8, .95);
      solid(lx, lz, 7.2, 7.2, 5.2);

      // 五层钟灵塔
      const px = ox + 2, pz = oz - 2;
      let curY = 1.56;
      if (placeGLB(api, 'tianwangPagoda', px, 1.48, pz, .78, .66, .78, PI / 8, 3.4)) {
        curY = 23.0;
      } else {
        for (let floor = 0; floor < 5; floor++) {
          const span = 9.4 - floor * .95;
          const fh = 3.35 - floor * .2;
          box(P.whiteWall, px, curY + fh * .5, pz, span, fh, span, 0);
          box(P.whiteWall, px, curY + fh * .5, pz, span, fh, span, PI / 4);
          box(P.warmGlow, px, curY + fh * .5, pz, span + .15, fh * .36, span * .3, 0);
          box(P.slateTile, px, curY + fh + .2, pz, span + 2.3, .4, span + 2.3, 0);
          box(P.slateTile, px, curY + fh + .2, pz, span + 2.3, .4, span + 2.3, PI / 4);
          curY += fh + .45;
        }
        pole(P.gold, px, curY + 2.1, pz, .44, 3.5);
      }
      fixture(px, 12.0, pz + 7, '#ffd58e', 95, 28);
      solid(px, pz, 12.6, 12.6, curY + 3.8);

      // 东门牌楼 (朝府东街入口)
      const gx = ox + 40, gz = oz + 2;
      if (pointInPoly(gx, gz, parkPts) && !Q.onAnyRoad(gx, gz, 3.0)) {
        box(P.vermilion, gx, 2.8, gz, 2.0, 4.8, 11.5);
        box(P.slateTile, gx, 5.6, gz, 3.8, .6, 13.8);
        sign('府山公园 · 钟灵塔', 'FUSHAN PARK & PAGODA', '#bdf5dc', gx + 1.25, 4.4, gz, 10.6, 1.95, PI / 2);
        solid(gx, gz, 3.0, 12.2, 6.2);
      }

      // 在真实 OSM 公园多边形内部排布香樟林荫
      const minX = Math.min(...parkPts.map(p => p.x));
      const maxX = Math.max(...parkPts.map(p => p.x));
      const minZ = Math.min(...parkPts.map(p => p.z));
      const maxZ = Math.max(...parkPts.map(p => p.z));
      for (let tx = minX + 10; tx <= maxX - 8; tx += 17) {
        for (let tz = minZ + 10; tz <= maxZ - 8; tz += 17) {
          const jx = tx + (((tx * 13 + tz * 7) % 7) - 3) * 1.1;
          const jz = tz + (((tx * 5 + tz * 11) % 7) - 3) * 1.1;
          if (!pointInPoly(jx, jz, parkPts)) continue;
          if (Q.onAnyRoad(jx, jz, 4.2) || Q.inAnyWater?.(jx, jz, 2.5)) continue;
          if (Math.hypot(jx - ox, jz - oz) < 22) continue;
          if (Math.hypot(jx - lx, jz - lz) < 16) continue;
          if (Math.hypot(jx - gx, jz - gz) < 10) continue;
          deciduous(jx, jz, 5.8 + (Math.abs(Math.round(jx + jz)) % 5) * .45);
        }
      }
      return;
    }
    box(grass, x, .24, z, w - 7, .22, d - 7);
    surface(x, z, w - 7, d - 7, .36);
    // 府山微地形台坡
    box(hill, x, .82, z - 2, 54, 1.0, 34);
    box(P.stone, x, 1.38, z - 2, 22, .45, 22);
    // 十字青石园道
    ground(P.stone, x, z, w - 8, 4.8, .37);
    ground(P.stone, x, z, 4.8, d - 8, .37);
    // 西侧映月莲池与湖心亭
    box(P.stone, x - 40, .42, z + 4, 28, .28, 24);
    box(P.water, x - 40, .54, z + 4, 24.5, .14, 20.5);
    box(P.vermilion, x - 40, 2.2, z + 4, 6.4, 3.2, 6.4);
    box(P.slateTile, x - 40, 4.2, z + 4, 9.2, .72, 9.2);
    box(P.gold, x - 40, 5.1, z + 4, 1.1, .9, 1.1);
    solid(x - 40, z + 4, 8.2, 8.2, 5.6);

    // 五层钟灵塔（位于府山高台）
    const px = x + 4, pz = z - 3;
    let curY = 1.65;
    for (let floor = 0; floor < 5; floor++) {
      const span = 10.6 - floor * 1.1;
      const fh = 3.55 - floor * .22;
      box(P.whiteWall, px, curY + fh * .5, pz, span, fh, span, 0);
      box(P.whiteWall, px, curY + fh * .5, pz, span, fh, span, PI / 4);
      box(P.warmGlow, px, curY + fh * .5, pz, span + .16, fh * .36, span * .3, 0);
      box(P.slateTile, px, curY + fh + .22, pz, span + 2.6, .42, span + 2.6, 0);
      box(P.slateTile, px, curY + fh + .22, pz, span + 2.6, .42, span + 2.6, PI / 4);
      curY += fh + .48;
    }
    pole(P.gold, px, curY + 2.3, pz, .48, 3.8);
    fixture(px, 12.5, pz + 7, '#ffd58e', 95, 28);
    solid(px, pz, 14, 14, curY + 4);

    // 南门牌楼（朝府山南路）
    box(P.vermilion, x - 6, 3.0, z + d * .5 - 5.5, 13.5, 5.2, 2.2);
    box(P.slateTile, x - 6, 6.0, z + d * .5 - 5.5, 16.2, .65, 4.2);
    sign('府山公园 · 钟灵塔', 'FUSHAN PARK & PAGODA', '#bdf5dc', x - 6, 4.7, z + d * .5 - 4.1, 12.4, 2.15, 0);
    solid(x - 6, z + d * .5 - 5.5, 14, 3.2, 6.6);

    // 古树林荫
    for (const [dx, dz] of [
      [-54, -22], [-34, -24], [34, -22], [54, -20],
      [-54, 20], [32, 20], [54, 18], [44, -2],
    ]) {
      deciduous(x + dx, z + dz, 6.2 + ((Math.abs(dx + dz) % 5) * .35));
    }
  }

  // 7. 马站底美食街 (三头一掌 · 衢州烤饼 · 水晶糕老街坊)
  function buildMazhandi(api, P, ox, oz) {
    const { box, pole, solid, sign, fixture } = api;
    const Q = window.QuzhouRoadData;
    const [mx, mz] = Number.isFinite(ox) && Number.isFinite(oz) ? [ox, oz] : landmarkPos('mazhandi', 48, -20);
    if (Q?.IS_OSM_QUZHOU) {
      // 适配上街与东武街片区真实美食街坊 (28×26m)
      box(P.stone, mx, .18, mz, 28, .22, 26);
      addHuizhouHouse(api, P, mx, mz - 4.4, 23.5, 11.8, 7.2, 0, 4);
      for (const off of [-7.2, 0, 7.2]) {
        box(P.darkTimber, mx + off, 1.8, mz + 1.65, 5.8, 3.1, .32);
        box(P.vermilion, mx + off, 3.5, mz + 2.55, 6.4, .24, 1.8, 0, .14);
        pole(P.lantern, mx + off - 2.6, 3.05, mz + 3.15, .38, .54);
        pole(P.lantern, mx + off + 2.6, 3.05, mz + 3.15, .38, .54);
      }
      sign('马站底美食街', 'MAZHANDI FOOD STREET', '#ffd684', mx, 4.9, mz + 2.1, 13.6, 2.25, 0);
      fixture(mx, 4.4, mz + 4.8, '#ffc67c', 88, 22);
      addHuizhouHouse(api, P, mx - 6.6, mz + 8.6, 10.6, 6.8, 5.6, PI, 2);
      addHuizhouHouse(api, P, mx + 6.6, mz + 8.6, 10.6, 6.8, 5.6, PI, 2);
      sign('三头一掌 · 衢州烤饼', 'QUZHOU SIGNATURE SNACKS', '#ffbe82', mx, 4.4, mz + 12.2, 12.2, 1.95, 0);
      fixture(mx, 4.0, mz + 13.2, '#ffbf76', 74, 18);
      return;
    }
    box(P.stone, 78, .18, -20, 124, .22, 26);
    // 主食坊：粉墙黛瓦两层连廊街市
    addHuizhouHouse(api, P, mx, mz, 48, 17, 7.6, 0, 6);
    // 门头红灯笼与暖光铺面
    for (const off of [-16, 0, 16]) {
      box(P.darkTimber, mx + off, 1.9, mz + 8.7, 9.6, 3.3, .36);
      box(P.vermilion, mx + off, 3.7, mz + 9.7, 10.6, .26, 2.1, 0, .14);
      pole(P.lantern, mx + off - 4.2, 3.2, mz + 10.4, .45, .62);
      pole(P.lantern, mx + off + 4.2, 3.2, mz + 10.4, .45, .62);
    }
    sign('马站底美食街', 'MAZHANDI FOOD STREET', '#ffd684', mx, 5.2, mz + 9.1, 15.8, 2.55, 0);
    fixture(mx, 4.4, mz + 11.4, '#ffc67c', 92, 22);
    solid(mx, mz, 48.6, 17.6, 9.6);

    // 东侧老字号糕点铺
    addHuizhouHouse(api, P, 114, -21, 34, 16, 7.2, 0, 4);
    sign('三头一掌 · 衢州烤饼', 'QUZHOU SIGNATURE SNACKS', '#ffbe82', 114, 5.1, -12.6, 13.8, 2.25, 0);
    fixture(114, 4.2, -10.5, '#ffbf76', 78, 19);
  }

  // 8. 大南门 · 礼贤门城楼 (古城南入口地标)
  function buildDananmen(api, P, ox, oz) {
    const { box, pole, queue, solid, surface, sign, fixture, deciduous, nightMaterials } = api;
    const Q = window.QuzhouRoadData;
    const [dx, dz] = Number.isFinite(ox) && Number.isFinite(oz) ? [ox, oz] : landmarkPos('dananmen', 30, 154);
    if (Q?.IS_OSM_QUZHOU) {
      // 适配俯瞰南湖与南湖二桥的礼贤门城楼地块 (22×16m)
      box(P.stone, dx, .24, dz, 22, .34, 16);
      surface(dx, dz, 22, 16, .41);
      if (!placeGLB(api, 'cityGateArch', dx, .28, dz, 1.08, .92, .92, 0)) {
        box(P.cityBrick, dx, 2.95, dz, 19.6, 5.5, 12.4);
        box(P.darkBrick, dx, 5.85, dz, 20.4, .38, 13.2);
      }
      const pavAsset = window.Tideline?.getAAAModel?.('shuitingmenPavilion');
      if (pavAsset && queue) {
        for (const m of pavAsset.materials) {
          m.userData.castShadow = shouldCastShadow(m);
          if (m.name === 'pav_glow' && !m.userData.nightWired) {
            m.userData.nightWired = true;
            nightMaterials?.push([m, 3.6]);
          }
        }
        for (const rec of pavAsset.meshes) {
          for (const prim of rec.primitives) {
            let geo = prim.geometry;
            if (prim.material?.name === 'pav_glow') {
              geo = stampWindowUv(api.T, geo);
              prim.geometry = geo;
              wireWindowRecess(prim.material);
            }
            queue(geo, prim.material, dx, 6.04, dz, .76, .82, .72, 0);
          }
        }
      } else {
        box(P.vermilion, dx, 8.1, dz, 15.2, 3.8, 9.0);
        box(P.warmGlow, dx, 8.1, dz, 15.45, 1.7, 6.0);
        addDoubleRoof(box, P, dx, 10.05, dz, 17.2, 10.6, P.slateTile, P.gold);
      }
      sign('礼贤门 · 大南门', 'DANANMEN SOUTH GATE', '#ffe19c', dx, 5.5, dz + 6.68, 11.4, 2.1, 0);
      fixture(dx, 6.8, dz + 9.2, '#ffbe74', 90, 24);
      solid(dx, dz, 20.4, 13.2, 15.2);
      return;
    }
    box(P.stone, dx, .24, dz, 52, .34, 68);
    surface(dx, dz, 52, 68, .41);
    // 砖石城台
    box(P.cityBrick, dx, 3.1, dz + 8, 34, 5.8, 18);
    box(P.darkBrick, dx, 6.2, dz + 8, 35.2, .42, 19.2);
    box(P.darkTimber, dx, 2.3, dz + 17.1, 6.0, 4.2, .36);
    const pavAsset = window.Tideline?.getAAAModel?.('shuitingmenPavilion');
    if (pavAsset && queue) {
      for (const m of pavAsset.materials) {
        m.userData.castShadow = shouldCastShadow(m);
        if (m.name === 'pav_glow' && !m.userData.nightWired) {
          m.userData.nightWired = true;
          nightMaterials?.push([m, 3.6]);
        }
      }
      for (const rec of pavAsset.meshes) {
        for (const prim of rec.primitives) {
          let geo = prim.geometry;
          if (prim.material?.name === 'pav_glow') {
            geo = stampWindowUv(api.T, geo);
            prim.geometry = geo;
            wireWindowRecess(prim.material);
          }
          queue(geo, prim.material, dx, 6.42, dz + 8, 1.18, 1.0, 1.02, 0);
        }
      }
    } else {
      box(P.vermilion, dx, 8.6, dz + 8, 22, 4.2, 12);
      box(P.warmGlow, dx, 8.6, dz + 8, 22.3, 1.9, 8);
      addDoubleRoof(box, P, dx, 10.75, dz + 8, 25, 14.5, P.slateTile, P.gold);
      for (const ox of [-10, -4, 4, 10]) {
        pole(P.lantern, dx + ox, 10.2, dz + 15.8, .48, .66);
      }
    }
    sign('礼贤门 · 大南门', 'DANANMEN SOUTH GATE', '#ffe19c', dx, 5.9, dz + 17.45, 13.4, 2.4, 0);
    fixture(dx, 7.2, dz + 20.5, '#ffbe74', 96, 26);
    solid(dx, dz + 8, 35, 19, 16.5);

    // 城门北侧礼贤老街铺
    addHuizhouHouse(api, P, dx, dz - 20, 32, 15, 7.2, PI, 4);
    deciduous(dx - 21, dz - 4, 5.8);
    deciduous(dx + 21, dz - 4, 5.8);
  }

  function createQuzhouBuilder(api) {
    const P = createPalette(api.T, api.nightMaterials, api.surfaceTexture);
    return {
      shuitingmen: (ox, oz) => buildShuitingmen(api, P, ox, oz),
      shuitingAlley: (face, pts, idx) => buildShuitingAlley(api, P, face, pts, idx),
      tianwang: (ox, oz) => buildTianwangPagoda(api, P, ox, oz),
      kongmiao: (ox, oz) => buildKongmiao(api, P, ox, oz),
      bellTower: (ox, oz) => buildBellTower(api, P, ox, oz),
      fushanPark: (x, z, w, d) => buildFushanPark(api, P, x, z, w, d),
      mazhandi: (ox, oz) => buildMazhandi(api, P, ox, oz),
      dananmen: (ox, oz) => buildDananmen(api, P, ox, oz),
      huizhouHouse: (x, z, w, d, h, facing) => addHuizhouHouse(api, P, x, z, w, d, h, facing, 2),
    };
  }

  window.Tideline = window.Tideline || {};
  window.Tideline.createQuzhouBuilder = createQuzhouBuilder;
})();
