(() => {
  'use strict';
  const T = window.THREE;
  const D = (window.Tideline = window.Tideline || {});

  const COMP_TYPES = {
    5120: Int8Array,
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
  };
  const TYPE_SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

  const cache = new Map();
  const loadedModels = Object.create(null);

  function readAccessor(gltf, bin, accessorIndex) {
    const acc = gltf.accessors[accessorIndex];
    const view = gltf.bufferViews[acc.bufferView];
    const Ctor = COMP_TYPES[acc.componentType];
    const itemSize = TYPE_SIZES[acc.type];
    const byteOffset = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = view.byteStride || 0;
    const count = acc.count;
    const elemBytes = Ctor.BYTES_PER_ELEMENT;

    if (!stride || stride === itemSize * elemBytes) {
      const raw = new Ctor(bin.buffer, bin.byteOffset + byteOffset, count * itemSize);
      return { array: new Ctor(raw), itemSize, normalized: Boolean(acc.normalized) };
    }
    const out = new Ctor(count * itemSize);
    const dv = new DataView(bin.buffer, bin.byteOffset + byteOffset);
    for (let i = 0; i < count; i++) {
      const base = i * stride;
      for (let k = 0; k < itemSize; k++) {
        const pos = base + k * elemBytes;
        if (acc.componentType === 5126) out[i * itemSize + k] = dv.getFloat32(pos, true);
        else if (acc.componentType === 5123) out[i * itemSize + k] = dv.getUint16(pos, true);
        else if (acc.componentType === 5125) out[i * itemSize + k] = dv.getUint32(pos, true);
        else if (acc.componentType === 5121) out[i * itemSize + k] = dv.getUint8(pos);
        else if (acc.componentType === 5120) out[i * itemSize + k] = dv.getInt8(pos);
        else if (acc.componentType === 5122) out[i * itemSize + k] = dv.getInt16(pos, true);
      }
    }
    return { array: out, itemSize, normalized: Boolean(acc.normalized) };
  }

  function buildMaterial(matDef) {
    const pbr = matDef?.pbrMetallicRoughness || {};
    const base = pbr.baseColorFactor || [1, 1, 1, 1];
    const emissive = matDef?.emissiveFactor || [0, 0, 0];
    const emissiveStrength = matDef?.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1.0;
    const clearcoatExt = matDef?.extensions?.KHR_materials_clearcoat;
    const transparent = matDef?.alphaMode === 'BLEND' || base[3] < 0.99;
    const baseColor = new T.Color().setRGB(base[0], base[1], base[2], T.SRGBColorSpace);
    const emissiveColor = new T.Color().setRGB(emissive[0], emissive[1], emissive[2], T.SRGBColorSpace);
    const roughness = pbr.roughnessFactor ?? 0.5;
    const metalness = pbr.metallicFactor ?? 0.0;
    const isMatteArch = roughness >= 0.65 && metalness < 0.2;
    const common = {
      name: matDef?.name || '',
      color: baseColor,
      metalness,
      roughness,
      emissive: emissiveColor,
      emissiveIntensity: emissiveStrength,
      transparent,
      opacity: base[3] ?? 1.0,
      depthWrite: !transparent,
      side: matDef?.doubleSided ? T.DoubleSide : T.FrontSide,
      envMapIntensity: isMatteArch ? 0.36 : 1.35,
    };
    if (clearcoatExt && T.MeshPhysicalMaterial) {
      return new T.MeshPhysicalMaterial({
        ...common,
        clearcoat: clearcoatExt.clearcoatFactor ?? 0.0,
        clearcoatRoughness: clearcoatExt.clearcoatRoughnessFactor ?? 0.1,
        envMapIntensity: 1.75,
      });
    }
    return new T.MeshStandardMaterial(common);
  }

  function parseGLB(buffer) {
    const dv = new DataView(buffer);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid GLB magic');
    const totalLength = dv.getUint32(8, true);
    let offset = 12;
    let gltf = null;
    let bin = null;
    while (offset < totalLength) {
      const chunkLen = dv.getUint32(offset, true);
      const chunkType = dv.getUint32(offset + 4, true);
      offset += 8;
      if (chunkType === 0x4e4f534a) {
        gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset, chunkLen)));
      } else if (chunkType === 0x004e4942) {
        bin = new Uint8Array(buffer, offset, chunkLen);
      }
      offset += chunkLen;
    }
    if (!gltf || !bin) throw new Error('Incomplete GLB chunks');

    const materials = (gltf.materials || []).map(buildMaterial);
    const meshRecords = (gltf.meshes || []).map(meshDef => {
      const primitives = (meshDef.primitives || []).map(prim => {
        const geo = new T.BufferGeometry();
        const attrs = prim.attributes || {};
        if (attrs.POSITION !== undefined) {
          const p = readAccessor(gltf, bin, attrs.POSITION);
          geo.setAttribute('position', new T.BufferAttribute(p.array, p.itemSize));
        }
        if (attrs.NORMAL !== undefined) {
          const n = readAccessor(gltf, bin, attrs.NORMAL);
          geo.setAttribute('normal', new T.BufferAttribute(n.array, n.itemSize));
        }
        if (attrs.TEXCOORD_0 !== undefined) {
          const uv = readAccessor(gltf, bin, attrs.TEXCOORD_0);
          geo.setAttribute('uv', new T.BufferAttribute(uv.array, uv.itemSize));
        }
        if (attrs.TEXCOORD_1 !== undefined) {
          const uv2 = readAccessor(gltf, bin, attrs.TEXCOORD_1);
          geo.setAttribute('uv2', new T.BufferAttribute(uv2.array, uv2.itemSize));
        }
        if (attrs.JOINTS_0 !== undefined) {
          const j = readAccessor(gltf, bin, attrs.JOINTS_0);
          const arr = j.array instanceof Uint16Array ? j.array : Uint16Array.from(j.array);
          geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(arr, j.itemSize));
        }
        if (attrs.WEIGHTS_0 !== undefined) {
          const w = readAccessor(gltf, bin, attrs.WEIGHTS_0);
          const scale = w.array instanceof Uint16Array ? 1 / 65535 : w.array instanceof Uint8Array ? 1 / 255 : 1;
          const arr = scale === 1 && w.array instanceof Float32Array ? w.array : Float32Array.from(w.array, v => v * scale);
          geo.setAttribute('skinWeight', new T.BufferAttribute(arr, w.itemSize));
        }
        let hasColor = false;
        if (attrs.COLOR_0 !== undefined) {
          const c = readAccessor(gltf, bin, attrs.COLOR_0);
          const count = c.array.length / c.itemSize;
          const rgb = new Float32Array(count * 3);
          const rawLinear = new Float32Array(count * 3);
          const scale = c.array instanceof Uint16Array ? 1 / 65535 : c.array instanceof Uint8Array ? 1 / 255 : 1;
          const tmp = new T.Color();
          for (let i = 0; i < count; i++) {
            const r0 = c.array[i * c.itemSize] * scale;
            const g0 = c.array[i * c.itemSize + 1] * scale;
            const b0 = c.array[i * c.itemSize + 2] * scale;
            rawLinear[i * 3] = r0;
            rawLinear[i * 3 + 1] = g0;
            rawLinear[i * 3 + 2] = b0;
            tmp.setRGB(
              r0, g0, b0,
              T.SRGBColorSpace
            );
            rgb[i * 3] = tmp.r;
            rgb[i * 3 + 1] = tmp.g;
            rgb[i * 3 + 2] = tmp.b;
          }
          geo.setAttribute('color', new T.BufferAttribute(rgb, 3));
          geo.userData.linearColor = rawLinear;
          hasColor = true;
        }
        if (prim.indices !== undefined) {
          const idx = readAccessor(gltf, bin, prim.indices);
          geo.setIndex(new T.BufferAttribute(idx.array, 1));
        }
        if (!attrs.NORMAL) geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mat = prim.material !== undefined ? materials[prim.material] : new T.MeshStandardMaterial({ color: '#cccccc' });
        if (hasColor && !mat.vertexColors) {
          mat.vertexColors = true;
          mat.color.set('#ffffff');
          mat.needsUpdate = true;
        }
        return { geometry: geo, material: mat, materialName: mat.name || '' };
      });
      return { name: meshDef.name || '', primitives };
    });

    const byName = Object.create(null);
    const root = new T.Group();
    const nodes = gltf.nodes || [];

    function buildNode(idx) {
      const def = nodes[idx];
      const group = new T.Group();
      group.name = def.name || '';
      if (def.matrix) {
        const m = new T.Matrix4().fromArray(def.matrix);
        m.decompose(group.position, group.quaternion, group.scale);
      } else {
        if (def.translation) group.position.fromArray(def.translation);
        if (def.rotation) group.quaternion.fromArray(def.rotation);
        if (def.scale) group.scale.fromArray(def.scale);
      }
      if (def.mesh !== undefined) {
        const rec = meshRecords[def.mesh];
        const key = def.name || rec.name;
        if (key) byName[key] = rec;
        for (const prim of rec.primitives) {
          const mesh = new T.Mesh(prim.geometry, prim.material);
          mesh.name = key || prim.materialName;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
      }
      if (def.children) {
        for (const childIdx of def.children) group.add(buildNode(childIdx));
      }
      return group;
    }

    const sceneDef = (gltf.scenes && gltf.scenes[gltf.scene || 0]) || { nodes: nodes.map((_, i) => i) };
    for (const rootIdx of sceneDef.nodes || []) root.add(buildNode(rootIdx));

    let skinJoints = null;
    if (gltf.skins && gltf.skins.length > 0) {
      const parentOf = new Int32Array(nodes.length).fill(-1);
      for (let i = 0; i < nodes.length; i++) {
        for (const cIdx of nodes[i].children || []) parentOf[cIdx] = i;
      }
      const worldMats = new Array(nodes.length);
      const getWorldMat = idx => {
        if (worldMats[idx]) return worldMats[idx];
        const def = nodes[idx];
        const local = new T.Matrix4();
        if (def.matrix) {
          local.fromArray(def.matrix);
        } else {
          const pos = def.translation ? new T.Vector3().fromArray(def.translation) : new T.Vector3();
          const quat = def.rotation ? new T.Quaternion().fromArray(def.rotation) : new T.Quaternion();
          const scl = def.scale ? new T.Vector3().fromArray(def.scale) : new T.Vector3(1, 1, 1);
          local.compose(pos, quat, scl);
        }
        if (parentOf[idx] >= 0) local.premultiply(getWorldMat(parentOf[idx]));
        worldMats[idx] = local;
        return local;
      };
      const posTmp = new T.Vector3();
      skinJoints = (gltf.skins[0].joints || []).map(nodeIdx => {
        posTmp.setFromMatrixPosition(getWorldMat(nodeIdx));
        return { name: nodes[nodeIdx]?.name || '', position: [posTmp.x, posTmp.y, posTmp.z] };
      });
    }

    return { root, byName, meshes: meshRecords, materials, skinJoints };
  }

  function loadGLB(url) {
    if (!cache.has(url)) {
      cache.set(url, fetch(url).then(res => {
        if (!res.ok) throw new Error('GLB fetch failed: ' + url);
        return res.arrayBuffer();
      }).then(parseGLB).catch(err => {
        console.warn('GLB load fallback:', url, err);
        return null;
      }));
    }
    return cache.get(url);
  }

  const AAA_MANIFEST = {
    heroGT: 'assets/models/hero-gt.glb',
    streetLamp: 'assets/models/street-lamp.glb',
    camphorTree: 'assets/models/tree-camphor.glb',
    promenadeBench: 'assets/models/bench-promenade.glb',
    shuitingmenPavilion: 'assets/models/shuitingmen-pavilion.glb',
    tianwangPagoda: 'assets/models/tianwang-pagoda.glb',
    cityGateArch: 'assets/models/city-gate-arch.glb',
    kongmiaoHall: 'assets/models/kongmiao-hall.glb',
    kongmiaoPaifang: 'assets/models/kongmiao-paifang.glb',
    bellTower: 'assets/models/bell-tower.glb',
    huizhouHouse: 'assets/models/huizhou-house.glb',
    charPlayer: 'assets/models/char-player.glb?v=6',
    charManCasual: 'assets/models/char-man-casual.glb?v=6',
    charManCoat: 'assets/models/char-man-coat.glb?v=6',
    charWomanCasual: 'assets/models/char-woman-casual.glb?v=6',
    charWomanCoat: 'assets/models/char-woman-coat.glb?v=6',
  };

  async function preloadAAAModels(onProgress) {
    const entries = Object.entries(AAA_MANIFEST);
    let done = 0;
    await Promise.all(entries.map(async ([key, url]) => {
      const asset = await loadGLB(url);
      if (asset) loadedModels[key] = asset;
      done++;
      onProgress?.(done, entries.length, key);
    }));
    return loadedModels;
  }

  function getAAAModel(key) {
    return loadedModels[key] || null;
  }

  Object.assign(D, { loadGLB, preloadAAAModels, getAAAModel, AAA_MANIFEST });
})();
