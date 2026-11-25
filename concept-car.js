(() => {
  'use strict';
  const D = window.Tideline;
  const T = window.THREE;
  let geometryPromise;
  const colorLUT = Uint8Array.from({ length: 256 }, (_, n) =>
    Math.round(T.ColorManagement.toWorkingColorSpace(new T.Color().setRGB(n / 255, 0, 0), T.SRGBColorSpace).r * 255));

  function readGeometry(buffer) {
    const bytes = new DataView(buffer);
    if (bytes.getUint32(0) !== 0x42584331) throw Error('Car model header');
    const headerLength = bytes.getUint32(4, true);
    let offset = 8 + headerLength;
    const parts = Object.create(null);
    const groups = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headerLength)));
    for (const [name, count, indexCount] of groups) {
      if (count > 65535 || offset + count * 12 + indexCount * 2 > bytes.byteLength) throw Error('Car model size');
      const pos = new Float32Array(count * 3);
      const normal = new Int8Array(count * 3);
      const color = new Uint8Array(count * 3);
      for (let i = 0; i < count; i++, offset += 12) for (let a = 0; a < 3; a++) {
        pos[i * 3 + a] = bytes.getInt16(offset + 2 * a, true) * .0001;
        normal[i * 3 + a] = bytes.getInt8(offset + 6 + a);
        color[i * 3 + a] = colorLUT[bytes.getUint8(offset + 9 + a)];
      }
      const indices = new Uint16Array(indexCount);
      for (let i = 0; i < indexCount; i++, offset += 2) indices[i] = bytes.getUint16(offset, true);
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.BufferAttribute(normal, 3, true));
      g.setAttribute('color', new T.BufferAttribute(color, 3, true));
      g.setIndex(new T.BufferAttribute(indices, 1));
      g.computeBoundingSphere();
      parts[name] = g;
    }
    const required = ['paint','trim','steering','glass','head','rear','left','right','leftCaliper','rightCaliper','far',
      'cruisePaint','cruiseTrim','cruiseGlass','cruiseLeft','cruiseRight'];
    if (offset !== buffer.byteLength || !required.every(key => parts[key])) {
      throw Error('Incomplete car model');
    }
    return parts;
  }
  function requestModel() {
    if (!geometryPromise) geometryPromise = fetch('assets/baixi-rs.bin').then(response => {
      if (!response.ok) throw Error('Car model download');
      return response.arrayBuffer();
    }).then(readGeometry).catch(() => null);
    return geometryPromise;
  }
  const mechanical = new T.MeshStandardMaterial({ vertexColors:true, roughness:.48, metalness:.36 });
  const rubberAndAlloy = new T.MeshStandardMaterial({ vertexColors:true, roughness:.42, metalness:.40 });
  const glass = new T.MeshPhysicalMaterial({
    color:'#abc6cd', roughness:.13, metalness:.12, clearcoat:.70, clearcoatRoughness:.14,
    transparent:true, opacity:.40, depthWrite:false, envMapIntensity:1.12, side:T.DoubleSide,
  });
  glass.forceSinglePass = true;
  const tintedGlass = new T.MeshStandardMaterial({color:'#4d6471', roughness:.21, metalness:.32});
  const plateGeometry = new T.PlaneGeometry(.365, .109);
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 256; plateCanvas.height = 76;
  const ink = plateCanvas.getContext('2d');
  ink.fillStyle = '#e8edf2'; ink.fillRect(0, 0, 256, 76);
  ink.fillStyle = '#18479c'; ink.fillRect(4, 4, 248, 68);
  ink.strokeStyle = '#d9e5f5'; ink.lineWidth = 2; ink.strokeRect(8, 8, 240, 60);
  ink.fillStyle = '#f2f6fb'; ink.textAlign = 'center';
  ink.font = 'bold 42px "Microsoft YaHei UI", sans-serif'; ink.fillText('浙H·8836', 128, 54);
  for (const x of [18,238]) { ink.beginPath(); ink.arc(x, 38, 2.5, 0, 2*Math.PI); ink.fill(); }
  const plateTexture = new T.CanvasTexture(plateCanvas);
  plateTexture.colorSpace = T.SRGBColorSpace;
  const plateMaterial = new T.MeshStandardMaterial({map:plateTexture, roughness:.52, metalness:.12});
  D.fitConceptCar = function (car, paint, headlight, runningLight, brakeLight) {
    return requestModel().then(parts => {
      if (!parts || car.concept) return;
      const finish = paint.clone();
      finish.vertexColors = false;
      finish.onBeforeCompile = paint.onBeforeCompile;
      finish.customProgramCacheKey = paint.customProgramCacheKey;
      const shell = new T.Mesh(parts.paint, finish);
      const trim = new T.Mesh(parts.trim, mechanical);
      const windows = new T.Mesh(parts.glass, glass);
      const heads = new T.Mesh(parts.head, headlight);
      const rear = new T.Mesh(parts.rear, runningLight);
      const plate = new T.Mesh(plateGeometry, plateMaterial);
      plate.position.set(0,.298,-2.09);
      plate.rotation.set(-.22,Math.PI,0,'YXZ');
      const steering = new T.Group();
      steering.position.set(0, .621, .885);
      const rim = new T.Mesh(parts.steering, mechanical);
      rim.position.copy(steering.position).multiplyScalar(-1);
      steering.add(rim);
      shell.castShadow = true;
      shell.receiveShadow = trim.receiveShadow = windows.receiveShadow = true;
      car.sprungBody.clear();
      car.sprungBody.add(shell, trim, steering, heads, rear, plate, windows);
      const wheelMeshes = [];
      for (const wheel of car.wheels) {
        const side = wheel.hub.position.x < 0 ? 'left' : 'right';
        const tire = new T.Mesh(parts[side], rubberAndAlloy);
        const caliper = new T.Mesh(parts[side + 'Caliper'], mechanical);
        tire.rotation.x = wheel.tire.rotation.x;
        tire.receiveShadow = caliper.receiveShadow = true;
        wheel.hub.clear();
        wheel.hub.add(tire, caliper);
        wheel.tire = tire;
        wheelMeshes.push({ side, tire, caliper });
      }
      car.distant.geometry = parts.far;
      car.distant.material = mechanical;
      const lod = car.distant.parent;
      const farLevel = lod.levels.find(level => level.object === car.distant);
      farLevel.distance = matchMedia('(pointer:coarse)').matches ? 21 : 30;
      function useDetail(full) {
        shell.geometry = full ? parts.paint : parts.cruisePaint;
        trim.geometry = full ? parts.trim : parts.cruiseTrim;
        windows.geometry = full ? parts.glass : parts.cruiseGlass;
        windows.material = full ? glass : tintedGlass;
        shell.castShadow = full;
        steering.visible = plate.visible = full;
        for (const {side, tire, caliper} of wheelMeshes) {
          tire.geometry = full ? parts[side] : side === 'left' ? parts.cruiseLeft : parts.cruiseRight;
          caliper.visible = full;
        }
        car.concept.full = full;
      }
      const original = parts.far.getAttribute('color');
      const pigment = [188,57,44].map(value => colorLUT[value]);
      function repaint(color) {
        finish.color.set(color);
        car.color = color;
        if (car.distant.geometry === parts.far) {
          if (color.toLowerCase() === '#bc392c') return true;
          const g = new T.BufferGeometry();
          g.setIndex(parts.far.index);
          g.setAttribute('position', parts.far.getAttribute('position'));
          g.setAttribute('normal', parts.far.getAttribute('normal'));
          g.setAttribute('color', original.clone());
          g.boundingSphere = parts.far.boundingSphere;
          car.distant.geometry = g;
        }
        const colors = car.distant.geometry.getAttribute('color');
        for (let i = 0; i < original.count; i++) {
          if (original.array[3*i] !== pigment[0] || original.array[3*i+1] !== pigment[1] || original.array[3*i+2] !== pigment[2]) continue;
          colors.setXYZ(i, finish.color.r, finish.color.g, finish.color.b);
        }
        colors.needsUpdate = true;
        return true;
      }
      Object.assign(car, { shell, trim, windows, tail:[], bodyBounds:{ offset:.16, halfLength:2.28, halfWidth:1.125, height:1.10 },
        concept:{ rear, runningLight, brakeLight, steering, repaint, useDetail, finish } });
      useDetail(car.type !== 'traffic');
      repaint(car.color);
      if (car.onConceptReady) car.onConceptReady();
    });
  };
  const wheelAxis = new T.Vector3(0, -.42, .91).normalize();
  const down = new T.Vector3(0, -1, 0);
  const target = new T.Vector3(), direction = new T.Vector3(), bend = new T.Vector3(), joint = new T.Vector3();
  const toChest = new T.Matrix4(), inverseArm = new T.Quaternion();
  function gripWheel(limb, steering) {
    const {arm, elbow, side} = limb;
    target.set(side * .126, .056, .026).applyQuaternion(steering.quaternion).add(steering.position).applyMatrix4(toChest);
    direction.subVectors(target, arm.position);
    const reach = Math.min(.568, Math.max(.08, direction.length()));
    direction.normalize();
    const upper = -elbow.position.y, lower = .295;
    const along = (upper*upper - lower*lower + reach*reach) / (2*reach);
    bend.set(side * .62, -.90, -.18);
    bend.addScaledVector(direction, -bend.dot(direction)).normalize();
    joint.copy(arm.position).addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper*upper - along*along)));
    arm.quaternion.setFromUnitVectors(down, bend.subVectors(joint, arm.position).normalize());
    inverseArm.copy(arm.quaternion).invert();
    elbow.quaternion.setFromUnitVectors(down, bend.subVectors(target, joint).normalize().applyQuaternion(inverseArm));
  }
  D.poseConceptDriver = function (person, car) {
    if (!car.concept.full) car.concept.useDetail(true);
    const root = person.root;
    if (root.parent !== car.sprungBody) car.sprungBody.add(root);
    root.visible = true;
    person.shadow.visible = false;
    root.position.set(0, .030, .67);
    root.rotation.set(0, 0, 0);
    root.scale.setScalar(.92);
    person.upper.position.set(0, .185, 0);
    person.chest.rotation.set(-.50, 0, 0);
    person.head.rotation.set(.37, car.steer * .18, 0);
    const turn = car.steer * .80;
    car.concept.steering.quaternion.setFromAxisAngle(wheelAxis, turn);
    root.updateMatrix(); person.upper.updateMatrix(); person.chest.updateMatrix();
    toChest.copy(root.matrix).multiply(person.upper.matrix).multiply(person.chest.matrix).invert();
    for (const limb of person.limbs) {
      const { hip, knee, boot } = limb;
      hip.position.y = .185;
      hip.position.z = 0;
      hip.rotation.x = -2.00;
      knee.rotation.x = .71;
      boot.rotation.x = 1.02;
      gripWheel(limb, car.concept.steering);
    }
  };
  D.leaveConceptSeat = function (person, scene) {
    scene.add(person.root);
    person.root.visible = false;
    person.root.scale.setScalar(1);
    person.shadow.visible = true;
    for (const {arm, elbow} of person.limbs) { arm.rotation.set(0,0,0); elbow.rotation.set(0,0,0); }
  };
})();
