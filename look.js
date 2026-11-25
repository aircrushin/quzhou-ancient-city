(() => {
  'use strict';
  const T = window.THREE;
  const D = window.Tideline;

  function rainField(scene, compact, shelters) {
    const streaks = compact ? 470 : 1060;
    const coordinates = new Float32Array(streaks * 6);
    const endpoints = new Float32Array(streaks * 2);
    const rng = D.rng(781159);
    for (let i = 0; i < streaks; i++) {
      const index = i * 6;
      for (let n = 0; n < 3; n++) coordinates[index + n] = coordinates[index + n + 3] = rng();
      endpoints[i * 2 + 1] = 1;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(coordinates, 3));
    geometry.setAttribute('tail', new T.BufferAttribute(endpoints, 1));
    const roofs = [{ ...D.WAREHOUSE.bounds, ceiling: 8.2 }, ...shelters];
    const uniforms = {
      clock: { value: 0 }, amount: { value: 0 }, center: { value: new T.Vector3() },
      tint: { value: new T.Color('#c3d5f3') },
      roofBounds: { value: roofs.map(r => new T.Vector4(r.minX, r.maxX, r.minZ, r.maxZ)) },
      roofHeights: { value: roofs.map(r => r.ceiling) },
    };
    const material = new T.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      toneMapped: false,
      vertexShader: [
        'attribute float tail;',
        'uniform float clock, amount;',
        'uniform vec3 center;',
        'uniform vec4 roofBounds[' + roofs.length + ']; uniform float roofHeights[' + roofs.length + '];',
        'varying float opacity;',
        'void main(){',
        '  float pace = 13.0 + position.x * 6.0;',
        '  vec3 drop = fract(position + vec3(-clock*.074, -clock*pace/22.0, clock*.032));',
        '  vec3 p = center + vec3((drop.x-.5)*48.,drop.y*22.-2.,(drop.z-.5)*48.);',
        '  float length = mix(.29,.88,position.z);',
        '  p += tail * vec3(.16, length, -.07);',
        '  float distanceToEye = distance(cameraPosition,p);',
        '  opacity = amount * (1.0-tail*.76) * smoothstep(.8,3.6,distanceToEye) * (1.0-smoothstep(8.0,27.0,distanceToEye));',
        '  opacity *= smoothstep(.12,1.3,p.y) * (1.0-smoothstep(16.0,20.0,p.y));',
        '  for (int i=0; i<' + roofs.length + '; i++) {',
        '    vec4 r = roofBounds[i];',
        '    opacity *= 1.0-step(r.x,p.x)*step(p.x,r.y)*step(r.z,p.z)*step(p.z,r.w)*step(p.y,roofHeights[i]);',
        '  }',
        '  gl_Position = projectionMatrix * viewMatrix * vec4(p,1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 tint; varying float opacity;',
        'void main(){ gl_FragColor = vec4(tint,opacity*.40);',
        ' #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    });
    const lines = new T.LineSegments(geometry, material);
    lines.frustumCulled = false;
    lines.renderOrder = 3;
    scene.add(lines);
    return (camera, time, amount) => {
      lines.visible = amount > .02;
      if (lines.visible) {
        uniforms.clock.value = time;
        uniforms.amount.value = amount;
        uniforms.center.value.set(camera.position.x, 0, camera.position.z);
      }
    };
  }

  function atmosphereField(scene, compact, shelters) {
    const count = compact ? 150 : 320;
    const seeds = new Float32Array(count * 3);
    const phase = new Float32Array(count * 3);
    const rng = D.rng(915427);
    for (let i = 0; i < count; i++) {
      seeds[i * 3] = rng();
      seeds[i * 3 + 1] = rng();
      seeds[i * 3 + 2] = rng();
      phase[i * 3] = rng() * Math.PI * 2;
      phase[i * 3 + 1] = .65 + rng() * .85;
      phase[i * 3 + 2] = rng();
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(seeds, 3));
    geometry.setAttribute('aPhase', new T.BufferAttribute(phase, 3));
    const roofs = [{ ...D.WAREHOUSE.bounds, ceiling: 8.2 }, ...shelters];
    const uniforms = {
      uTime: { value: 0 }, uNight: { value: 0 }, uRain: { value: 0 }, uMist: { value: 0 },
      uPark: { value: 0 }, uPixelRatio: { value: 1 }, uCenter: { value: new T.Vector3() },
      roofBounds: { value: roofs.map(r => new T.Vector4(r.minX, r.maxX, r.minZ, r.maxZ)) },
      roofHeights: { value: roofs.map(r => r.ceiling) },
    };
    const material = new T.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false,
      vertexShader: [
        'attribute vec3 aPhase;',
        'uniform float uTime, uNight, uRain, uMist, uPark, uPixelRatio;',
        'uniform vec3 uCenter;',
        'uniform vec4 roofBounds[' + roofs.length + ']; uniform float roofHeights[' + roofs.length + '];',
        'varying vec3 vColor; varying float vAlpha; varying float vSoft;',
        'void main(){',
        '  float dayAmt = max(0.0, 1.0 - uNight * 1.45) * max(0.0, 1.0 - uRain * 1.35);',
        '  float fireflyAmt = smoothstep(.16, .68, uNight) * max(0.0, 1.0 - uRain * 1.5);',
        '  float mistAmt = uMist * (1.0 - uRain * .35);',
        '  float rainAmt = smoothstep(.18, .85, uRain);',
        '  float kind = aPhase.z;',
        '  vec3 drift = position;',
        '  vec3 p;',
        '  float sz = 4.0;',
        '  float alpha = 0.0;',
        '  float soft = 1.6;',
        '  vec3 col = vec3(1.0);',
        '  if (mistAmt > .04 && kind > .62) {',
        '    vec3 wrap = fract(drift + vec3(uTime * .014 * aPhase.y, sin(uTime * .18 + aPhase.x) * .02, -uTime * .011));',
        '    p = uCenter + vec3((wrap.x - .5) * 44.0, .45 + wrap.y * 3.8, (wrap.z - .5) * 44.0);',
        '    col = mix(vec3(.78, .88, .87), vec3(.44, .58, .66), uNight);',
        '    sz = (24.0 + aPhase.y * 18.0) * uPixelRatio;',
        '    alpha = mistAmt * .082;',
        '    soft = 1.25;',
        '  } else if (rainAmt > .05 && kind < .36) {',
        '    float tick = fract(uTime * (2.6 + aPhase.y * 1.8) + aPhase.x);',
        '    vec3 wrap = fract(drift + vec3(floor(uTime * 2.2) * .17, 0.0, floor(uTime * 1.9) * .23));',
        '    p = uCenter + vec3((wrap.x - .5) * 32.0, .10 + tick * .32, (wrap.z - .5) * 32.0);',
        '    col = vec3(.78, .88, 1.0);',
        '    sz = (2.8 + tick * 2.2) * uPixelRatio;',
        '    alpha = rainAmt * (1.0 - tick) * .34;',
        '    soft = 2.0;',
        '  } else if (fireflyAmt > .02) {',
        '    vec3 wrap = fract(drift + vec3(sin(uTime * .15 * aPhase.y + aPhase.x) * .045, cos(uTime * .22 + aPhase.x) * .035, cos(uTime * .14 * aPhase.y + aPhase.x) * .045));',
        '    p = uCenter + vec3((wrap.x - .5) * 36.0, .65 + wrap.y * 4.4, (wrap.z - .5) * 36.0);',
        '    float blink = pow(.5 + .5 * sin(uTime * (1.6 + aPhase.y * 1.9) + aPhase.x * 3.0), 2.3);',
        '    col = mix(vec3(.82, 1.0, .44), vec3(1.0, .86, .40), fract(kind * 3.7));',
        '    sz = (4.6 + blink * 4.2 + uPark * 1.4) * uPixelRatio;',
        '    alpha = fireflyAmt * (.18 + blink * .78) * (.56 + uPark * .44) * step(.18 - uPark * .16, kind);',
        '    soft = 2.6;',
        '  } else if (dayAmt > .02) {',
        '    vec3 wrap = fract(drift + vec3(uTime * .018 * aPhase.y + sin(uTime * .45 + aPhase.x) * .016, -uTime * (.020 + aPhase.y * .016), uTime * .012));',
        '    p = uCenter + vec3((wrap.x - .5) * 38.0, .45 + wrap.y * 10.2, (wrap.z - .5) * 38.0);',
        '    vec3 blossom = mix(vec3(1.0, .93, .76), vec3(1.0, .86, .62), fract(kind * 5.3));',
        '    vec3 osmanthus = mix(vec3(1.0, .88, .44), vec3(.96, .95, .74), fract(kind * 4.1));',
        '    col = mix(blossom, osmanthus, uPark);',
        '    sz = (3.4 + aPhase.y * 2.5 + uPark * 1.1) * uPixelRatio;',
        '    alpha = dayAmt * (.24 + uPark * .18) * step(.36 - uPark * .26, kind);',
        '    soft = 1.9;',
        '  }',
        '  float dist = distance(cameraPosition, p);',
        '  float rangeFade = smoothstep(1.8, 5.2, dist) * (1.0 - smoothstep(16.0, 26.0, dist));',
        '  float roofMask = 1.0;',
        '  for (int i=0; i<' + roofs.length + '; i++) {',
        '    vec4 r = roofBounds[i];',
        '    roofMask *= 1.0 - step(r.x, p.x) * step(p.x, r.y) * step(r.z, p.z) * step(p.z, r.w) * step(p.y, roofHeights[i]);',
        '  }',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  vColor = col;',
        '  vAlpha = alpha * rangeFade * roofMask;',
        '  vSoft = soft;',
        '  gl_PointSize = clamp(sz * (16.0 / max(2.2, -mv.z)), 1.5, 72.0);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor; varying float vAlpha; varying float vSoft;',
        'void main(){',
        '  float d = length(gl_PointCoord - .5) * 2.0;',
        '  if (d > 1.0 || vAlpha < .003) discard;',
        '  float g = pow(max(0.0, 1.0 - d), vSoft);',
        '  gl_FragColor = vec4(vColor, g * vAlpha);',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
    });
    const points = new T.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 4;
    scene.add(points);
    return (camera, state, pixelRatio) => {
      const cx = camera.position.x, cz = camera.position.z;
      const inFushan = cx > 105 && cx < 258 && cz > 2 && cz < 172;
      const inKongmiao = cx > 130 && cx < 195 && cz > -55 && cz < 12;
      const inShuiting = cx < -92 && cz > -135 && cz < 75;
      const atWater = cx > 305 || (cz > 125 && cz < 240 && cx > -205 && cx < 140);
      const parkFactor = (inFushan || inKongmiao) ? 1.0 : (inShuiting || atWater) ? .68 : .22;
      uniforms.uTime.value = state.clock;
      uniforms.uNight.value = state.night ?? 0;
      uniforms.uRain.value = state.rain ?? 0;
      uniforms.uMist.value = state.mist ?? 0;
      uniforms.uPark.value = parkFactor;
      uniforms.uPixelRatio.value = Math.min(2, pixelRatio || 1);
      uniforms.uCenter.value.set(cx, 0, cz);
      points.visible = true;
    };
  }

  function makeLook(renderer, scene, options) {
    const rain = rainField(scene, options.compact, options.shelters ?? []);
    const atmo = atmosphereField(scene, options.compact, options.shelters ?? []);
    const canBloom = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
    if (!canBloom) {
      const fallback = (camera, state) => {
        rain(camera, state.clock, state.rain);
        atmo(camera, state, renderer.getPixelRatio());
        renderer.render(scene, camera);
      };
      fallback.warmup = () => {};
      return fallback;
    }

    const linearTarget = (depth = false) => new T.WebGLRenderTarget(2, 2, {
      type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter,
      depthBuffer: depth, stencilBuffer: false,
    });
    const color = linearTarget(true);
    color.depthTexture = new T.DepthTexture(2, 2, T.UnsignedIntType);
    color.depthTexture.name = 'Baixi scene depth';
    const glow = linearTarget();
    const scratch = linearTarget();
    const wideGlow = linearTarget();
    const wideScratch = linearTarget();
    const shafts = linearTarget();
    const aoTarget = () => new T.WebGLRenderTarget(2, 2, { depthBuffer: false, stencilBuffer: false });
    const contact = aoTarget();
    const softContact = aoTarget();
    const size = new T.Vector2();
    const sunProj = new T.Vector3();
    const camForward = new T.Vector3();
    const screen = new T.Scene();
    const screenCamera = new T.Camera();
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    screen.add(quad);
    const vertexShader = [
      'varying vec2 uvScreen;',
      'void main(){ uvScreen = uv; gl_Position = vec4(position.xy,0.,1.); }',
    ].join('\n');
    const pass = (uniforms, lines, toneMapped = false) => new T.ShaderMaterial({
      vertexShader, fragmentShader: ['varying vec2 uvScreen;', ...lines].join('\n'),
      uniforms, toneMapped, depthTest: false, depthWrite: false,
    });
    const threshold = pass({ image: { value: color.texture }, pixel: { value: new T.Vector2() } }, [
      'uniform sampler2D image; uniform vec2 pixel;',
      'vec3 softThreshold(vec3 c){',
      '  float peak = max(max(c.r,c.g),c.b);',
      '  float knee = smoothstep(.78, 2.35, peak);',
      '  return min(c, vec3(6.5)) * knee / (1.0 + peak * .14);',
      '}',
      'void main(){',
      '  vec2 o = pixel * 1.15;',
      '  vec3 c = softThreshold(texture2D(image,uvScreen).rgb) * .40;',
      '  c += softThreshold(texture2D(image,uvScreen+vec2(o.x,o.y)).rgb) * .15;',
      '  c += softThreshold(texture2D(image,uvScreen+vec2(-o.x,o.y)).rgb) * .15;',
      '  c += softThreshold(texture2D(image,uvScreen+vec2(o.x,-o.y)).rgb) * .15;',
      '  c += softThreshold(texture2D(image,uvScreen+vec2(-o.x,-o.y)).rgb) * .15;',
      '  gl_FragColor = vec4(c,1.0);',
      '}',
    ]);
    const blur = pass({ image: { value: glow.texture }, direction: { value: new T.Vector2() } }, [
      'uniform sampler2D image; uniform vec2 direction;',
      'void main(){',
      '  vec3 c = texture2D(image,uvScreen).rgb*.227027;',
      '  c += (texture2D(image,uvScreen-direction*1.384615).rgb + texture2D(image,uvScreen+direction*1.384615).rgb)*.316216;',
      '  c += (texture2D(image,uvScreen-direction*3.230769).rgb + texture2D(image,uvScreen+direction*3.230769).rgb)*.070270;',
      '  gl_FragColor = vec4(c,1.0);',
      '}',
    ]);
    const depthUniforms = {
      depthMap: { value: color.depthTexture }, depthRange: { value: new T.Vector2() },
      pixelStep: { value: new T.Vector2() },
    };
    const depthCode = [
      'uniform sampler2D depthMap; uniform vec2 depthRange,pixelStep;',
      'float eyeDepth(vec2 at) {',
      '  float d=texture2D(depthMap,at).x;',
      '  return depthRange.x*depthRange.y/(depthRange.y-d*(depthRange.y-depthRange.x));',
      '}',
    ];
    const sunShaftPass = pass({
      ...depthUniforms, image: { value: color.texture },
      sunUV: { value: new T.Vector2(.5, .7) }, sunColor: { value: new T.Color('#ffd39a') },
      strength: { value: 0 },
    }, [
      ...depthCode,
      'uniform sampler2D image; uniform vec2 sunUV; uniform vec3 sunColor; uniform float strength;',
      'void main(){',
      '  vec2 delta = (sunUV - uvScreen) / 14.0;',
      '  float jitter = fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));',
      '  vec2 cur = uvScreen + delta * jitter;',
      '  vec3 acc = vec3(0.0); float decay = 1.0;',
      '  for(int i=0; i<14; i++){',
      '    cur += delta;',
      '    vec2 clamped = clamp(cur, vec2(.002), vec2(.998));',
      '    float d = eyeDepth(clamped);',
      '    float isSky = smoothstep(320.0, 900.0, d);',
      '    vec3 sc = texture2D(image, clamped).rgb;',
      '    acc += sc * isSky * decay;',
      '    decay *= .88;',
      '  }',
      '  float radial = exp(-2.1 * length((uvScreen - sunUV) * vec2(1.5, 1.0)));',
      '  float rayGate = step(.005, strength);',
      '  gl_FragColor = vec4(acc * (1.0 / 14.0) * sunColor * strength * rayGate * (.35 + .65 * radial), 1.0);',
      '}',
    ]);
    const occlusion = pass({ ...depthUniforms, rayScale: { value: new T.Vector2() } }, [
      ...depthCode,
      'uniform vec2 rayScale;',
      'vec3 pointAt(vec2 at, float depth) { return vec3((2.*at-1.)*rayScale,-1.)*depth; }',
      'float nearby(vec2 at, vec3 point, vec3 normal, float radius) {',
      '  vec3 delta=pointAt(at,eyeDepth(at))-point;',
      '  float distanceToPoint=length(delta);',
      '  float horizon=dot(delta,normal)/max(.0001,distanceToPoint);',
      '  return smoothstep(.06,.46,horizon)*(1.-smoothstep(radius*.14,radius,distanceToPoint));',
      '}',
      'void main(){',
      '  vec2 at=uvScreen;',
      '  float depth=eyeDepth(at);',
      '  float valid=1.-step(148.,depth);',
      '  float safeDepth=min(depth,148.);',
      '  vec3 point=pointAt(at,safeDepth);',
      '  vec2 sx=vec2(pixelStep.x,0.), sy=vec2(0.,pixelStep.y);',
      '  float left=eyeDepth(at-sx), right=eyeDepth(at+sx), bottom=eyeDepth(at-sy), top=eyeDepth(at+sy);',
      '  vec3 dx=(abs(left-safeDepth)<abs(right-safeDepth)) ? point-pointAt(at-sx,left) : pointAt(at+sx,right)-point;',
      '  vec3 dy=(abs(bottom-safeDepth)<abs(top-safeDepth)) ? point-pointAt(at-sy,bottom) : pointAt(at+sy,top)-point;',
      '  vec3 crossN=cross(dx,dy);',
      '  vec3 normal=crossN*inversesqrt(max(dot(crossN,crossN),1e-8));',
      '  float radius=1.05+smoothstep(4.,42.,safeDepth)*.55;',
      '  vec2 reach=min(vec2(radius)/(max(safeDepth,.1)*rayScale*2.),pixelStep*28.)*valid;',
      '  float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));',
      '  float baseAng=jitter*3.14159265;',
      '  float occ=0.0;',
      '  for(int i=0;i<6;i++){',
      '    float ang=baseAng+float(i)*1.04719755;',
      '    vec2 dir=vec2(cos(ang),sin(ang))*reach;',
      '    float r1=.38+.24*fract(jitter*3.7+float(i)*.41);',
      '    float r2=.76+.22*fract(jitter*5.3+float(i)*.29);',
      '    occ+=nearby(at+dir*r1,point,normal,radius)+nearby(at-dir*r2,point,normal,radius);',
      '  }',
      '  float mask=mix(1.0, clamp(1.0-occ*(.96/12.)*(1.-smoothstep(86.,148.,safeDepth)), .16, 1.0), valid);',
      '  gl_FragColor=vec4(vec3(mask),1.);',
      '}',
    ]);
    const spread = pass({ ...depthUniforms, image: { value: contact.texture } }, [
      ...depthCode,
      'uniform sampler2D image;',
      'vec2 tap(vec2 at,float depth){',
      '  float weight=1.-smoothstep(.03,.14+depth*.017,abs(eyeDepth(at)-depth));',
      '  return vec2(texture2D(image,at).r*weight,weight);',
      '}',
      'void main(){',
      '  float depth=eyeDepth(uvScreen);',
      '  vec2 sx=vec2(pixelStep.x,0.), sy=vec2(0.,pixelStep.y);',
      '  vec2 result=vec2(texture2D(image,uvScreen).r,1.)*2.;',
      '  result+=tap(uvScreen+sx,depth)+tap(uvScreen-sx,depth)+tap(uvScreen+sy,depth)+tap(uvScreen-sy,depth);',
      '  result+=tap(uvScreen+sx+sy,depth)*.7+tap(uvScreen-sx+sy,depth)*.7+tap(uvScreen+sx-sy,depth)*.7+tap(uvScreen-sx-sy,depth)*.7;',
      '  gl_FragColor=vec4(vec3(result.x/result.y),1.);',
      '}',
    ]);
    const final = pass({
      image: { value: color.texture }, lights: { value: glow.texture }, wideLights: { value: wideGlow.texture },
      shafts: { value: shafts.texture }, shadows: { value: softContact.texture },
      wet: { value: 0 }, night: { value: 0 }, dusk: { value: 0 }, mist: { value: 0 }, ultra: { value: 1 }, shaftGain: { value: 0 }, pixel: { value: new T.Vector2() },
    }, [
      'uniform sampler2D image,lights,wideLights,shafts,shadows;',
      'uniform float wet,night,dusk,mist,ultra,shaftGain;',
      'uniform vec2 pixel;',
      'float brightness(vec3 shade){ return dot(shade/(1.+shade),vec3(.27,.60,.13)); }',
      'vec3 edgeSample(vec2 at){',
      '  vec3 c=texture2D(image,at).rgb;',
      '  float center=brightness(c);',
      '  vec3 cn=texture2D(image,at+vec2(0.,pixel.y)).rgb;',
      '  vec3 cs=texture2D(image,at-vec2(0.,pixel.y)).rgb;',
      '  vec3 ce=texture2D(image,at+vec2(pixel.x,0.)).rgb;',
      '  vec3 cw=texture2D(image,at-vec2(pixel.x,0.)).rgb;',
      '  float nw=brightness(texture2D(image,at+pixel*vec2(-1.,1.)).rgb);',
      '  float ne=brightness(texture2D(image,at+pixel*vec2(1.,1.)).rgb);',
      '  float sw=brightness(texture2D(image,at+pixel*vec2(-1.,-1.)).rgb);',
      '  float se=brightness(texture2D(image,at+pixel*vec2(1.,-1.)).rgb);',
      '  float low=min(center,min(min(nw,ne),min(sw,se)));',
      '  float high=max(center,max(max(nw,ne),max(sw,se)));',
      '  float contrast = high-low;',
      '  vec3 aa = c;',
      '  if(contrast>=max(.024,high*.105)){',
      '    vec2 along=vec2(sw+se-nw-ne,nw+sw-ne-se);',
      '    float reduce=max(.008,(nw+ne+sw+se)*.032);',
      '    along=clamp(along/(min(abs(along.x),abs(along.y))+reduce),-8.,8.)*pixel;',
      '    vec3 tapA=(texture2D(image,at-along*.18).rgb+texture2D(image,at+along*.18).rgb)*.5;',
      '    vec3 tapB=tapA*.5+(texture2D(image,at-along*.48).rgb+texture2D(image,at+along*.48).rgb)*.25;',
      '    float lumB=brightness(tapB);',
      '    aa = (lumB<low || lumB>high) ? tapA : tapB;',
      '  }',
      '  vec3 minC = min(aa, min(min(cn,cs), min(ce,cw)));',
      '  vec3 maxC = max(aa, max(max(cn,cs), max(ce,cw)));',
      '  vec3 sharp = aa + (aa - (cn+cs+ce+cw)*.25) * (.22 * ultra);',
      '  return clamp(sharp, minC*.92, maxC*1.08);',
      '}',
      'void main(){',
      '  vec3 c = edgeSample(uvScreen);',
      '  float exposure = brightness(c);',
      '  float contact=texture2D(shadows,uvScreen).r;',
      '  c *= mix(contact,1.0,.38*smoothstep(.35,.92,exposure));',
      '  vec3 nearBloom = texture2D(lights,uvScreen).rgb;',
      '  vec3 farBloom = texture2D(wideLights,uvScreen).rgb;',
      '  float bloomGain = .13 + .20 * night + .075 * wet + .095 * mist + .055 * dusk;',
      '  vec3 bloomTint = mix(vec3(1.0), vec3(1.06, .97, .88), dusk * .65);',
      '  c += (nearBloom * .62 + farBloom * .88) * bloomGain * bloomTint;',
      '  c += texture2D(shafts,uvScreen).rgb * shaftGain;',
      '  vec3 shadowTint = mix(vec3(.945,.990,1.068),vec3(.875,.975,1.145),night);',
      '  shadowTint = mix(shadowTint, vec3(.93, .98, 1.03), mist * .42);',
      '  vec3 brightTint = mix(vec3(1.055,1.020,.962),vec3(1.095,1.024,.935),night);',
      '  brightTint = mix(brightTint, vec3(1.11, 1.01, .90), dusk * .55);',
      '  c *= mix(shadowTint,brightTint,smoothstep(.10,.58,exposure));',
      '  float luminance = dot(c,vec3(.2126,.7152,.0722));',
      '  c = max(vec3(0.),mix(vec3(luminance),c,mix(1.16,1.10,night) * (1.0 - mist * .12)));',
      '  c = mix(c, c * c * (3.0 - 2.0 * clamp(c, 0.0, 1.0)) * 1.12, .14);',
      '  vec2 edges = (uvScreen-.5)*vec2(1.18,.94);',
      '  c *= 1.0-smoothstep(.32,.88,length(edges))*mix(.065,.15,night);',
      '  gl_FragColor = vec4(c,1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '  gl_FragColor.rgb += (fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255.0;',
      '}',
    ], true);

    function draw(material, destination) {
      quad.material = material;
      renderer.setRenderTarget(destination);
      renderer.render(screen, screenCamera);
    }
    function renderPass(camera, state) {
      rain(camera, state.clock, state.rain);
      atmo(camera, state, renderer.getPixelRatio());
      const mode = options.mode();
      const isUltra = mode === 'ultra';
      if (mode !== 'high' && !isUltra) {
        renderer.render(scene, camera);
        return;
      }
      renderer.getDrawingBufferSize(size);
      if (size.x !== color.width || size.y !== color.height) {
        color.setSize(size.x, size.y);
      }
      renderer.setRenderTarget(color);
      renderer.render(scene, camera);
      const w = Math.max(2, Math.floor(size.x / 4));
      const h = Math.max(2, Math.floor(size.y / 4));
      const w2 = Math.max(2, Math.floor(size.x / 8));
      const h2 = Math.max(2, Math.floor(size.y / 8));
      const contactWidth = Math.max(2, Math.floor(size.x / 2));
      const contactHeight = Math.max(2, Math.floor(size.y / 2));
      if (w !== glow.width || h !== glow.height || contactWidth !== contact.width || contactHeight !== contact.height) {
        glow.setSize(w, h);
        scratch.setSize(w, h);
        contact.setSize(contactWidth, contactHeight);
        softContact.setSize(contact.width, contact.height);
      }
      if (isUltra && (w2 !== wideGlow.width || h2 !== wideGlow.height || w !== shafts.width || h !== shafts.height)) {
        wideGlow.setSize(w2, h2);
        wideScratch.setSize(w2, h2);
        shafts.setSize(w, h);
      }
      depthUniforms.depthRange.value.set(camera.near, camera.far);
      depthUniforms.pixelStep.value.set(1 / contact.width, 1 / contact.height);
      occlusion.uniforms.rayScale.value.set(1 / camera.projectionMatrix.elements[0], 1 / camera.projectionMatrix.elements[5]);
      draw(occlusion, contact);
      draw(spread, softContact);
      threshold.uniforms.pixel.value.set(1 / color.width, 1 / color.height);
      draw(threshold, glow);
      blur.uniforms.image.value = glow.texture;
      blur.uniforms.direction.value.set(1.45 / glow.width, 0);
      draw(blur, scratch);
      blur.uniforms.image.value = scratch.texture;
      blur.uniforms.direction.value.set(0, 1.45 / glow.height);
      draw(blur, glow);
      let shaftGain = 0;
      if (isUltra) {
        blur.uniforms.image.value = glow.texture;
        blur.uniforms.direction.value.set(1.85 / wideGlow.width, 0);
        draw(blur, wideScratch);
        blur.uniforms.image.value = wideScratch.texture;
        blur.uniforms.direction.value.set(0, 1.85 / wideGlow.height);
        draw(blur, wideGlow);
        const skyU = options.skyUniforms;
        let shaftStrength = 0;
        if (skyU?.sun?.value) {
          camera.getWorldDirection(camForward);
          const align = camForward.dot(skyU.sun.value);
          if (align > .12 && state.night < .65 && state.rain < .75) {
            sunProj.copy(skyU.sun.value).multiplyScalar(900).add(camera.position).project(camera);
            sunShaftPass.uniforms.sunUV.value.set(sunProj.x * .5 + .5, sunProj.y * .5 + .5);
            sunShaftPass.uniforms.sunColor.value.copy(skyU.sunColor.value);
            const mistShaft = 1 + (state.mist ?? 0) * .28;
            shaftStrength = Math.pow((align - .12) / .88, 1.35) * (1 - state.night * 1.4) * (1 - state.rain * .8) * .48 * mistShaft;
          }
        }
        if (shaftStrength > .005) {
          sunShaftPass.uniforms.strength.value = shaftStrength;
          draw(sunShaftPass, shafts);
          shaftGain = .52;
        }
      }
      final.uniforms.wet.value = state.wetness;
      final.uniforms.night.value = state.night;
      final.uniforms.dusk.value = options.skyUniforms?.duskMix?.value ?? 0;
      final.uniforms.mist.value = state.mist ?? 0;
      final.uniforms.ultra.value = isUltra ? 1 : 0;
      final.uniforms.shaftGain.value = shaftGain;
      final.uniforms.wideLights.value = isUltra ? wideGlow.texture : glow.texture;
      final.uniforms.pixel.value.set(1 / color.width, 1 / color.height);
      draw(final, null);
    }
    renderPass.warmup = () => {
      for (const m of [threshold, blur, occlusion, spread, sunShaftPass, final]) {
        quad.material = m;
        renderer.compile(screen, screenCamera);
      }
    };
    return renderPass;
  }

  function makeRainAudio() {
    let audio, rain, road, breeze, market, rainVolume, roadVolume, breezeVolume, marketVolume, gate, noiseBuffer;
    let nextChirp = 3.5, nextCricket = 2.4, nextChime = 6.5, nextSizzle = 2.2, nextThunder = 9.0;
    const Context = window.AudioContext ?? window.webkitAudioContext;
    function start() {
      if (!Context) return;
      if (audio) {
        if (audio.state === 'suspended') audio.resume().catch(() => {});
        return;
      }
      try {
        audio = new Context();
        const count = audio.sampleRate * 3;
        noiseBuffer = audio.createBuffer(1, count, audio.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        const rng = D.rng(23811);
        for (let i = 0; i < count; i++) data[i] = rng() * 2 - 1;
        const noise = audio.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        rain = audio.createBiquadFilter();
        rain.type = 'bandpass';
        rain.frequency.value = 1650;
        rain.Q.value = .39;
        road = audio.createBiquadFilter();
        road.type = 'lowpass';
        road.frequency.value = 480;
        breeze = audio.createBiquadFilter();
        breeze.type = 'bandpass';
        breeze.frequency.value = 540;
        breeze.Q.value = .65;
        market = audio.createBiquadFilter();
        market.type = 'bandpass';
        market.frequency.value = 680;
        market.Q.value = 1.15;
        rainVolume = audio.createGain();
        roadVolume = audio.createGain();
        breezeVolume = audio.createGain();
        marketVolume = audio.createGain();
        gate = audio.createGain();
        rainVolume.gain.value = roadVolume.gain.value = breezeVolume.gain.value = marketVolume.gain.value = 0;
        noise.connect(rain).connect(rainVolume).connect(gate);
        noise.connect(road).connect(roadVolume).connect(gate);
        noise.connect(breeze).connect(breezeVolume).connect(gate);
        noise.connect(market).connect(marketVolume).connect(gate);
        gate.connect(audio.destination);
        noise.start();
        if (audio.state === 'suspended') audio.resume().catch(() => {});
      } catch {
        audio = undefined;
      }
    }
    function playChirp(at) {
      if (!audio || !gate) return;
      const base = 2350 + Math.random() * 1050;
      const notes = Math.random() < .5 ? [0, .11] : [0, .09, .21];
      for (const offset of notes) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const t = at + offset;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, t);
        osc.frequency.exponentialRampToValueAtTime(base * (1.18 + Math.random() * .16), t + .045);
        osc.frequency.exponentialRampToValueAtTime(base * .94, t + .095);
        gain.gain.setValueAtTime(.0001, t);
        gain.gain.exponentialRampToValueAtTime(.014, t + .018);
        gain.gain.exponentialRampToValueAtTime(.0001, t + .105);
        osc.connect(gain).connect(gate);
        osc.start(t);
        osc.stop(t + .12);
      }
    }
    function playCricket(at, level = 1) {
      if (!audio || !gate) return;
      const base = 4150 + Math.random() * 520;
      const pulses = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pulses; i++) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const t = at + i * .068;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, t);
        osc.frequency.exponentialRampToValueAtTime(base * 1.03, t + .042);
        gain.gain.setValueAtTime(.0001, t);
        gain.gain.exponentialRampToValueAtTime(.0085 * level, t + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, t + .052);
        osc.connect(gain).connect(gate);
        osc.start(t);
        osc.stop(t + .06);
      }
    }
    function playWindChime(at, level = 1) {
      if (!audio || !gate) return;
      const scale = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0];
      const notes = Math.random() < .5 ? 2 : 3;
      for (let i = 0; i < notes; i++) {
        const f = scale[Math.floor(Math.random() * scale.length)];
        const t = at + i * (.14 + Math.random() * .08);
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(.0001, t);
        gain.gain.exponentialRampToValueAtTime(.014 * level, t + .018);
        gain.gain.exponentialRampToValueAtTime(.0001, t + 1.15);
        osc.connect(gain).connect(gate);
        osc.start(t);
        osc.stop(t + 1.2);
      }
    }
    function playMarketSizzle(at, level = 1) {
      if (!audio || !gate || !noiseBuffer) return;
      const src = audio.createBufferSource();
      const flt = audio.createBiquadFilter();
      const gain = audio.createGain();
      src.buffer = noiseBuffer;
      src.loop = true;
      flt.type = 'highpass';
      flt.frequency.setValueAtTime(2400 + Math.random() * 1100, at);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(.014 * level, at + .035);
      gain.gain.exponentialRampToValueAtTime(.0001, at + .22);
      src.connect(flt).connect(gain).connect(gate);
      src.start(at, Math.random() * 1.6);
      src.stop(at + .26);
    }
    function playThunder(at) {
      if (!audio || !gate || !noiseBuffer) return;
      const src = audio.createBufferSource();
      const flt = audio.createBiquadFilter();
      const gain = audio.createGain();
      src.buffer = noiseBuffer;
      src.loop = true;
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(115, at);
      flt.frequency.exponentialRampToValueAtTime(48, at + 2.4);
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(.068, at + .32);
      gain.gain.exponentialRampToValueAtTime(.0001, at + 2.6);
      src.connect(flt).connect(gain).connect(gate);
      src.start(at, Math.random() * 1.2);
      src.stop(at + 2.75);
    }
    function tick(state, running, enabled, sheltered) {
      const actor = state.boat ?? state.vehicle ?? state.player;
      const ax = actor?.x ?? 0, az = actor?.z ?? 0;
      const speed = (state.boat ?? state.vehicle)?.speed ?? 0;
      const atSea = Boolean(state.boat) || D.marineWalkable(ax, az) || ax > 308;
      const nearMarket = (ax > 296 && az > 88 && az < 145) || (ax > 44 && ax < 118 && az > 56 && az < 156);
      const nearSacred = (ax > 128 && ax < 196 && az > -56 && az < 14) || (ax > 110 && ax < 252 && az > 10 && az < 168) || (ax < -72 && ax > -205 && az > -140 && az < 40);
      const mist = state.mist ?? 0;
      const duck = (state.playingTape || state.station) ? .25 : 1;
      const marketLevel = nearMarket ? (.011 + state.night * .018) * (1 - state.rain * .65) * (state.vehicle ? .42 : 1) * duck : 0;
      const cricketFactor = Math.max(0, (state.night - .28) / .72) * Math.max(0, 1 - state.rain * 1.6) * (nearSacred || atSea ? 1 : .45);
      const zone = nearMarket ? 'market' : nearSacred ? 'heritage' : atSea ? 'lake' : 'street';
      state.ambience = { zone, market: Number(marketLevel.toFixed(4)), crickets: Number(cricketFactor.toFixed(2)), mist: Number(mist.toFixed(2)), windChimes: Boolean(nearSacred && state.rain < .55) };
      if (!gate) return;
      const at = audio.currentTime;
      gate.gain.setTargetAtTime(running && enabled ? 1 : 0, at, .13);
      rain.frequency.setTargetAtTime(sheltered ? 435 : state.vehicle ? 1070 : 1710, at, .22);
      rainVolume.gain.setTargetAtTime(state.rain * (sheltered ? .083 : .135), at, .27);
      const clearDay = Math.max(0, 1 - state.night * 1.4) * Math.max(0, 1 - state.rain * 1.6) * (sheltered ? .22 : 1);
      const mistBreeze = mist * .012 * (1 - state.rain * .5);
      breeze.frequency.setTargetAtTime(460 + 160 * Math.sin(state.clock * .37) + (atSea ? 140 : 0) - mist * 110, at, .35);
      breezeVolume.gain.setTargetAtTime((clearDay * (state.vehicle ? .010 : .022) + mistBreeze) * duck, at, .35);
      market.frequency.setTargetAtTime(640 + 120 * Math.sin(state.clock * .73), at, .4);
      marketVolume.gain.setTargetAtTime(marketLevel, at, .38);
      if (running && enabled && clearDay > .55 && speed < 14 && state.clock >= nextChirp) {
        playChirp(at);
        nextChirp = state.clock + 5.5 + Math.random() * 7.5;
      }
      if (running && enabled && cricketFactor > .22 && speed < 15 && !sheltered && state.clock >= nextCricket) {
        playCricket(at, cricketFactor * duck);
        nextCricket = state.clock + 2.8 + Math.random() * 4.4;
      }
      if (running && enabled && nearSacred && state.rain < .55 && speed < 12 && state.clock >= nextChime) {
        playWindChime(at, (state.vehicle ? .4 : 1) * duck);
        nextChime = state.clock + 9.5 + Math.random() * 11.5;
      }
      if (running && enabled && nearMarket && !state.vehicle && state.rain < .45 && state.clock >= nextSizzle) {
        playMarketSizzle(at, (.65 + state.night * .55) * duck);
        nextSizzle = state.clock + 3.2 + Math.random() * 4.8;
      }
      if (running && enabled && state.rain > .78 && state.clock >= nextThunder) {
        playThunder(at);
        nextThunder = state.clock + 14.0 + Math.random() * 16.0;
      }
      const surf = atSea ? (.031 + mist * .011) + .007 * Math.sin(state.clock * 1.19) : 0;
      const motion = speed > 2 ? Math.min(.105, speed * (state.boat ? .0042 : .00175)) * (1 + state.wetness * .45) : 0;
      roadVolume.gain.setTargetAtTime(surf + motion, at, .12);
      road.frequency.setTargetAtTime(180 + speed * 22 + (atSea ? 160 : state.vehicle?.brake ? 355 : 0), at, .12);
    }
    return { start, tick };
  }

  Object.assign(D, { makeLook, makeRainAudio });
})();
