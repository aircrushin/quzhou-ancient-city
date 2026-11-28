(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;

  const hdrProbes = Object.create(null);

  let floatLinearSupported = null;
  function createHDRSkyTexture(kind, renderer, cache = false) {
    if (renderer && floatLinearSupported === null) {
      floatLinearSupported = Boolean(renderer.capabilities.isWebGL2 && renderer.extensions.get('OES_texture_float_linear'));
    }
    const useFloat = Boolean(floatLinearSupported && typeof Float32Array !== 'undefined');
    const cacheKey = kind + (useFloat ? ':hdr' : ':ldr');
    if (cache && hdrProbes[cacheKey]) return hdrProbes[cacheKey];
    const width = 512;
    const height = 256;
    const pixels = useFloat ? new Float32Array(width * height * 4) : new Uint8Array(width * height * 4);
    const random = D.rng(428113);
    const roofs = Array.from({ length: 84 }, () => .012 + random() * .098);
    const roofStyles = roofs.map(() => random());

    const presets = {
      day: {
        zenith: [.14, .44, 1.08], horizon: [1.05, 1.24, 1.42], ground: [.20, .23, .25],
        sunColor: [12.5, 10.6, 8.2], sunLon: .68, sunLat: .24, sunSharp: 165,
        cloudTop: [2.35, 2.28, 2.15], cloudBase: [.58, .70, .86], cloudGain: 1.0,
        facade: [.72, .68, .62], windowCol: [.45, .74, 1.08], windowBoost: 1.15,
      },
      dusk: {
        zenith: [.14, .26, .64], horizon: [1.95, .92, .44], ground: [.14, .16, .20],
        sunColor: [15.5, 6.4, 2.2], sunLon: .68, sunLat: .08, sunSharp: 110,
        cloudTop: [2.45, 1.35, .72], cloudBase: [.34, .30, .44], cloudGain: .95,
        facade: [.44, .37, .35], windowCol: [3.4, 2.05, .82], windowBoost: 2.1,
      },
      night: {
        zenith: [.025, .065, .18], horizon: [.12, .21, .36], ground: [.045, .065, .10],
        sunColor: [1.25, 1.55, 2.25], sunLon: .25, sunLat: .28, sunSharp: 150,
        cloudTop: [.16, .24, .38], cloudBase: [.04, .07, .13], cloudGain: .42,
        facade: [.11, .14, .20], windowCol: [3.8, 2.25, .92], windowBoost: 2.5,
      },
    };
    const P = presets[kind] || presets.day;

    function cloudFbm(u, v) {
      const a = Math.sin(u * 12.566 + 1.1) * Math.cos(v * 9.42 + .5);
      const b = Math.sin(u * 25.132 - v * 18.85 + 2.3) * .5;
      const c = Math.cos(u * 50.265 + v * 31.41 - .7) * .25;
      const d = Math.sin(u * 87.96 - v * 56.5 + 1.7) * .12;
      return (a + b + c + d) * .5 + .5;
    }

    for (let y = 0; y < height; y++) {
      const latitude = (y + .5) / height - .5;
      const skyFade = Math.pow(D.clamp(latitude * 2.35, 0, 1), .66);
      const cloudBand = latitude > .035 && latitude < .44
        ? Math.sin(D.clamp((latitude - .035) / .405, 0, 1) * Math.PI)
        : 0;
      const dLat = latitude - P.sunLat;
      const dLat2 = dLat * dLat * 4.0;
      const horizonGlow = Math.exp(-20.0 * Math.abs(latitude - .008)) * (kind === 'dusk' ? .76 : .28);
      const groundFactor = latitude < -.046 ? (.68 + .92 * Math.exp(11 * (latitude + .046))) : 0;
      for (let x = 0; x < width; x++) {
        const longitude = (x + .5) / width;
        const dLon = Math.min(Math.abs(longitude - P.sunLon), 1 - Math.abs(longitude - P.sunLon));
        const sunDist2 = dLon * dLon * 9.0 + dLat2;
        const sunDisk = Math.exp(-P.sunSharp * sunDist2);
        const sunHalo = Math.exp(-14.0 * sunDist2) * .36;
        const block = Math.floor(longitude * roofs.length);
        const lot = longitude * roofs.length - block;
        const terrace = .049 * Math.sin(longitude * Math.PI * 6 + 1.2);
        const landward = .5 - .5 * Math.cos((longitude - .5) * Math.PI * 2);
        const roof = (roofs[block] + Math.max(0, terrace)) * (.18 + landward * 1.65);
        const street = latitude > -.065 && latitude < roof && lot > .07 && lot < .94;
        const windows = street && latitude > -.022 && Math.floor((latitude + .022) * 360) % 5 < 2
          && Math.floor(longitude * 540) % 4 < 2 && roofStyles[block] > .42;
        let cloudCov = 0;
        let cloudLit = .5;
        if (!street && cloudBand > .01) {
          const n = cloudFbm(longitude, latitude * 2.2);
          cloudCov = D.clamp((n - .54) * 3.1, 0, 1) * cloudBand * P.cloudGain;
          if (cloudCov > .005) {
            cloudLit = D.clamp(.35 + Math.exp(-5.0 * sunDist2) * .65 + (latitude - .08) * 1.4, 0, 1);
          }
        }
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          let value = latitude < -.046
            ? P.ground[channel] * groundFactor
            : P.horizon[channel] + (P.zenith[channel] - P.horizon[channel]) * skyFade;
          if (!street) {
            if (cloudCov > .005) {
              const cCol = P.cloudBase[channel] + (P.cloudTop[channel] - P.cloudBase[channel]) * cloudLit;
              value = value * (1 - cloudCov * .78) + cCol * cloudCov * .78;
            }
            value += (sunDisk + sunHalo) * P.sunColor[channel] + horizonGlow * P.horizon[channel] * .45;
          } else if (windows) {
            value = P.windowCol[channel] * (.68 + .55 * roofStyles[block]) * P.windowBoost;
          } else {
            value = P.facade[channel] * (.76 + roofStyles[block] * .32);
          }
          pixels[offset + channel] = useFloat ? Math.max(0, value) : Math.round(D.clamp(value, 0, 1) * 255);
        }
        pixels[offset + 3] = useFloat ? 1.0 : 255;
      }
    }
    const sky = new T.DataTexture(pixels, width, height, T.RGBAFormat, useFloat ? T.FloatType : T.UnsignedByteType);
    sky.colorSpace = useFloat ? T.LinearSRGBColorSpace : T.SRGBColorSpace;
    sky.mapping = T.EquirectangularReflectionMapping;
    sky.wrapS = T.RepeatWrapping;
    sky.generateMipmaps = !useFloat;
    sky.magFilter = T.LinearFilter;
    sky.minFilter = useFloat ? T.LinearFilter : T.LinearMipmapLinearFilter;
    sky.needsUpdate = true;
    if (cache) hdrProbes[cacheKey] = sky;
    return sky;
  }
  function harborReflectionTexture() {
    return createHDRSkyTexture('dusk', null, true);
  }
  function bakeEnvironmentPreset(renderer, kind) {
    if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has('EXT_color_buffer_float')) return null;
    const generator = new T.PMREMGenerator(renderer);
    generator.compileEquirectangularShader();
    const source = createHDRSkyTexture(kind, renderer, false);
    try {
      return generator.fromEquirectangular(source);
    } finally {
      source.dispose();
      generator.dispose();
    }
  }

  function makeStreetEffects(renderer, scene, world, mode, compact = false) {
    const resetShadows = () => {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = false;
    };
    resetShadows();

    const reflection = world.roadReflection;
    const target = new T.WebGLRenderTarget(2, 2, {
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: renderer.capabilities.isWebGL2 ? T.LinearMipmapLinearFilter : T.LinearFilter,
      magFilter: T.LinearFilter,
    });
    target.texture.generateMipmaps = renderer.capabilities.isWebGL2;
    target.texture.name = 'Baixi planar reflection';
    const blankReflection = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, T.RGBAFormat);
    blankReflection.name = 'Baixi blank reflection';
    blankReflection.minFilter = T.LinearFilter;
    blankReflection.magFilter = T.LinearFilter;
    blankReflection.generateMipmaps = false;
    blankReflection.needsUpdate = true;
    reflection.image.value = target.texture;
    const mirror = new T.PerspectiveCamera();
    const vertical = new T.Vector3(0, 1, 0);
    const surface = new T.Plane(vertical, 0);
    const tilted = new T.Plane();
    const forward = new T.Vector3();
    const reflectedDirection = new T.Vector3();
    const worldUp = new T.Vector3();
    const clip = new T.Vector4();
    const farCorner = new T.Vector4();
    const bias = new T.Matrix4().set(
      .5, 0, 0, .5,
      0, .5, 0, .5,
      0, 0, .5, .5,
      0, 0, 0, 1,
    );
    const lastPosition = new T.Vector3();
    const lastDirection = new T.Vector3();
    let sampledAt = -100;
    let lastMode = '';
    let lastSurface = '';
    let lastAspect = 0;
    const canEnv = Boolean(renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float'));
    let envSuite = Object.create(null);

    function getEnvironment(key) {
      if (!canEnv) return null;
      if (!envSuite[key]) envSuite[key] = bakeEnvironmentPreset(renderer, key);
      return envSuite[key]?.texture ?? null;
    }

    function reflect(camera, kind) {
      const floor = kind === 'water' ? -.47 : .020;
      surface.constant = -floor - (kind === 'water' ? .09 : .032);
      mirror.position.copy(camera.position);
      mirror.position.y = 2 * floor - camera.position.y;
      worldUp.set(0, 1, 0).transformDirection(camera.matrixWorld).reflect(vertical);
      mirror.up.copy(worldUp);
      reflectedDirection.copy(forward).reflect(vertical).add(mirror.position);
      mirror.lookAt(reflectedDirection);
      mirror.far = camera.far;
      mirror.updateMatrixWorld();
      mirror.projectionMatrix.copy(camera.projectionMatrix);
      reflection.projection.value.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);

      // Clip the mirror at the road plane with an oblique near plane.
      tilted.copy(surface).applyMatrix4(mirror.matrixWorldInverse);
      clip.set(tilted.normal.x, tilted.normal.y, tilted.normal.z, tilted.constant);
      const matrix = mirror.projectionMatrix.elements;
      farCorner.set((Math.sign(clip.x) + matrix[8]) / matrix[0], (Math.sign(clip.y) + matrix[9]) / matrix[5],
        -1, (1 + matrix[10]) / matrix[14]);
      clip.multiplyScalar(2 / clip.dot(farCorner));
      matrix[2] = clip.x;
      matrix[6] = clip.y;
      matrix[10] = clip.z + 1 - .001;
      matrix[14] = clip.w;
      mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();

      const isUltra = mode() === 'ultra';
      const pixelWidth = compact ? 380 : isUltra ? 768 : 640;
      const h = Math.min(compact ? 220 : isUltra ? 460 : 420, Math.max(110, Math.round(pixelWidth / camera.aspect)));
      const w = Math.max(200, Math.round(h * camera.aspect));
      if (w !== target.width || h !== target.height) target.setSize(w, h);
      const previousTarget = renderer.getRenderTarget();
      const recalculateShadows = renderer.shadowMap.needsUpdate;
      const waterMesh = world.water;
      const wasWaterVisible = waterMesh ? waterMesh.visible : false;
      renderer.shadowMap.needsUpdate = false;
      reflection.strength.value = 0;
      reflection.waterStrength.value = 0;
      reflection.image.value = blankReflection;
      if (waterMesh) waterMesh.visible = false;
      try {
        renderer.setRenderTarget(target);
        renderer.render(scene, mirror);
      } finally {
        renderer.setRenderTarget(previousTarget);
        reflection.image.value = target.texture;
        if (waterMesh) waterMesh.visible = wasWaterVisible;
        renderer.shadowMap.needsUpdate = recalculateShadows;
      }
    }

    function prepare(camera, state, surfaceKind, changingView = false) {
      const display = mode();
      const isUltra = display === 'ultra';
      const high = isUltra || display === 'high';
      if (high && canEnv) {
        const duskMix = world.skyUniforms?.duskMix?.value ?? 0;
        const key = state.night > .52 ? 'night' : (duskMix > .16 || state.night > .18) ? 'dusk' : 'day';
        scene.environment = getEnvironment(key);
      } else {
        scene.environment = null;
      }
      const roadSsr = surfaceKind === 'road' && D.roadScreenReflect(display, state, compact);
      const eligible = high && surfaceKind && !state.sheltered && camera.position.y > .1 &&
        (surfaceKind === 'water' || (state.wetness > .17 && !roadSsr));
      reflection.strength.value = 0;
      reflection.waterStrength.value = 0;
      if (!eligible) {
        lastSurface = '';
        return;
      }
      camera.updateMatrixWorld();
      camera.getWorldDirection(forward);
      const moved = lastPosition.distanceToSquared(camera.position) > (isUltra ? .16 : .35) || lastDirection.dot(forward) < (isUltra ? .9994 : .9987);
      const age = state.clock - sampledAt;
      const due = age >= (compact ? .60 : isUltra ? .22 : .34) || (moved && age >= (compact ? .24 : isUltra ? .10 : .15));
      // Keep the previous world-projected image while the lens moves to its new mount.
      if (surfaceKind !== lastSurface || display !== lastMode || lastAspect !== camera.aspect || age < 0 ||
        age >= .90 || (!changingView && due)) {
        reflect(camera, surfaceKind);
        sampledAt = state.clock;
        lastPosition.copy(camera.position);
        lastDirection.copy(forward);
      }
      lastMode = display;
      lastSurface = surfaceKind;
      lastAspect = camera.aspect;
      const strength = surfaceKind === 'water' ? reflection.waterStrength : reflection.strength;
      strength.value = 1;
    }
    prepare.warmup = () => {
      if (canEnv) getEnvironment('day');
      return envSuite;
    };
    prepare.reset = () => {
      if (envSuite) {
        for (const key of Object.keys(envSuite)) envSuite[key]?.dispose();
      }
      envSuite = Object.create(null);
      scene.environment = null;
      reflection.image.value = target.texture;
      reflection.strength.value = 0;
      reflection.waterStrength.value = 0;
      sampledAt = -100;
      lastSurface = '';
      resetShadows();
    };
    return prepare;
  }

  Object.assign(D, { makeStreetEffects, harborReflectionTexture });
})();
