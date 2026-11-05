import * as THREE from 'three';
import { textTexture, radialTexture } from './fx.js';
import { Crowd, CountBanner } from './crowd.js';

/* ------------ shared resources ------------ */
const geoCache = new Map();
const matCache = new Map();

function boxGeo(w, h, d) {
  const k = `box|${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

function planeGeo(w, h) {
  const k = `plane|${w}|${h}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.PlaneGeometry(w, h));
  return geoCache.get(k);
}

function basicMat(color, { opacity = 1, transparent = false, additive = false, side = THREE.FrontSide } = {}) {
  const k = `basic|${color}|${opacity}|${transparent}|${additive}|${side}`;
  if (!matCache.has(k)) {
    matCache.set(k, new THREE.MeshBasicMaterial({
      color,
      opacity,
      transparent,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !transparent,
      side
    }));
  }
  return matCache.get(k);
}

function standardMat(color, emissive = 0x000000, emissiveIntensity = 0.4, metalness = 0.5, roughness = 0.45) {
  const k = `std|${color}|${emissive}|${emissiveIntensity}|${metalness}|${roughness}`;
  if (!matCache.has(k)) {
    matCache.set(k, new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity, metalness, roughness
    }));
  }
  return matCache.get(k);
}

function glowSprite(color, scale = 4, opacity = 0.6) {
  const rgba = new THREE.Color(color);
  const inner = `rgba(${Math.round(rgba.r * 255)},${Math.round(rgba.g * 255)},${Math.round(rgba.b * 255)},0.55)`;
  const mat = new THREE.SpriteMaterial({
    map: radialTexture(inner, 'rgba(0,0,0,0)', 128),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

const labelMatCache = new Map();
function labelMaterial(text, opts) {
  const key = `${text}|${opts.color}|${opts.sub || ''}|${opts.bg || ''}|${opts.border || ''}|${opts.size || ''}`;
  if (!labelMatCache.has(key)) {
    labelMatCache.set(key, new THREE.MeshBasicMaterial({
      map: textTexture(text, opts),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: opts.opacity ?? 1
    }));
  }
  return labelMatCache.get(key);
}

const spriteLabelCache = new Map();
function spriteLabel(text, opts = {}) {
  const key = `${text}|${opts.color || '#fff'}|${opts.sub || ''}|${opts.size || ''}`;
  if (!spriteLabelCache.has(key)) {
    const mat = new THREE.SpriteMaterial({
      map: textTexture(text, {
        color: opts.color || '#ffffff',
        glow: opts.glow || 'rgba(255,255,255,.75)',
        size: opts.size || 150,
        sub: opts.sub || '',
        width: 512,
        height: opts.sub ? 300 : 256
      }),
      transparent: true,
      depthWrite: false,
      depthTest: false
    });
    spriteLabelCache.set(key, mat);
  }
  const s = new THREE.Sprite(spriteLabelCache.get(key).clone());
  s.material.map = spriteLabelCache.get(key).map;
  return s;
}

/* ---------------- GATES ---------------- */
export function gateOps(distance, luck = 0, count = 10, safe = false) {
  const bothGood = safe || Math.random() < 0.62 + luck * 0.03;
  const addValues = distance < 400 ? [10, 15, 20, 25]
    : distance < 1500 ? [20, 25, 30, 40]
    : [30, 40, 50, 60];
  const subValues = distance < 500 ? [10, 15, 20]
    : distance < 1800 ? [15, 20, 25, 30]
    : [20, 30, 40];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const good = () => {
    if (Math.random() < 0.55) return { kind: 'mul', value: Math.random() < 0.3 ? 3 : 2, positive: true };
    return { kind: 'add', value: pick(addValues), positive: true };
  };
  const bad = () => {
    const roll = Math.random();
    if (roll < 0.35) return { kind: 'div', value: 2, positive: false };
    if (roll < 0.65) return { kind: 'mul', value: 0.5, positive: false };
    return { kind: 'sub', value: pick(subValues), positive: false };
  };

  let left, right;
  if (bothGood) {
    left = good();
    right = good();
    if (left.kind === right.kind && left.value === right.value) {
      if (right.kind === 'mul') right.value = right.value === 2 ? 3 : 2;
      else right.value = pick(addValues.filter((v) => v !== left.value));
    }
  } else if (Math.random() < 0.5) {
    left = good();
    right = bad();
  } else {
    left = bad();
    right = good();
  }
  return { left, right };
}

export function opLabel(op) {
  if (op.kind === 'mul') return `×${op.value}`;
  if (op.kind === 'div') return `÷${op.value}`;
  if (op.kind === 'add') return `+${op.value}`;
  if (op.kind === 'sub') return `−${op.value}`;
  return '?';
}

export function applyOp(count, op) {
  if (op.kind === 'mul') return Math.floor(count * op.value);
  if (op.kind === 'div') return Math.floor(count / op.value);
  if (op.kind === 'add') return count + op.value;
  if (op.kind === 'sub') return count - op.value;
  return count;
}

export class Gate {
  constructor(scene, z, ops) {
    this.scene = scene;
    this.kind = 'gate';
    this.z = z;
    this.x = 0;
    this.ops = ops;
    this.passed = false;
    this.passAnim = 0;
    this.group = new THREE.Group();
    this.group.position.z = z;

    const frameColors = {
      good: { color: 0x8dffcf, emissive: 0x0f3a2a },
      bad: { color: 0xff6b8a, emissive: 0x3a0f1c }
    };

    // structural frame across the track
    const frameMat = standardMat(0x1a1338, 0x24124f, 0.7, 0.7, 0.35);
    const beamTop = new THREE.Mesh(boxGeo(19.4, 0.34, 0.55), frameMat);
    beamTop.position.set(0, 4.5, 0);
    this.group.add(beamTop);
    const beamBottom = new THREE.Mesh(boxGeo(19.4, 0.16, 0.4), frameMat);
    beamBottom.position.set(0, 0.1, 0);
    this.group.add(beamBottom);
    for (const x of [-9.2, 0, 9.2]) {
      const post = new THREE.Mesh(boxGeo(0.34, 4.6, 0.55), frameMat);
      post.position.set(x, 2.3, 0);
      this.group.add(post);
      const light = new THREE.Mesh(boxGeo(0.1, 4.2, 0.1), basicMat(x === 0 ? 0xffffff : 0x9d7dff, { transparent: true, opacity: 0.65 }));
      light.position.set(x, 2.3, 0.31);
      this.group.add(light);
    }

    // two panels
    this.panels = {};
    const sides = [
      { key: 'left', op: ops.left, x: -4.7, sign: -1 },
      { key: 'right', op: ops.right, x: 4.7, sign: 1 }
    ];
    for (const side of sides) {
      const positive = side.op.positive;
      const color = positive ? 0xa7ff4f : 0xff4d7a;
      const bg = positive ? 'rgba(7, 26, 18, 0.78)' : 'rgba(32, 5, 16, 0.8)';
      const border = positive ? 'rgba(167,255,79,0.95)' : 'rgba(255,77,122,0.95)';
      const sub = side.op.kind === 'mul' ? 'MOB MULTIPLY'
        : side.op.kind === 'add' ? 'RECRUITS'
        : side.op.kind === 'div' ? 'MOB LOSS' : 'MOB LOSS';
      const tex = textTexture(opLabel(side.op), {
        color: positive ? '#d8ff9b' : '#ffb3c5',
        glow: positive ? 'rgba(167,255,79,.9)' : 'rgba(255,77,122,.9)',
        size: 195,
        sub,
        subColor: positive ? 'rgba(220,255,190,.8)' : 'rgba(255,190,205,.8)',
        bg,
        border,
        width: 700,
        height: 460
      });
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const panel = new THREE.Mesh(planeGeo(9.0, 4.1), mat);
      panel.position.set(side.x, 2.42, 0.02);
      this.group.add(panel);

      const glow = glowSprite(color, 11, 0.28);
      glow.position.set(side.x, 2.3, -0.3);
      glow.scale.set(10.4, 5.4, 1);
      this.group.add(glow);

      const floorLine = new THREE.Mesh(
        planeGeo(8.4, 0.5),
        basicMat(color, { transparent: true, opacity: 0.7, additive: true })
      );
      floorLine.rotation.x = -Math.PI / 2;
      floorLine.position.set(side.x, 0.035, 0.3);
      this.group.add(floorLine);

      this.panels[side.key] = { mesh: panel, glow, floorLine, op: side.op, color };
    }

    // hovering gate marker
    const marker = spriteLabel('GATE', { color: '#d9cfff', glow: 'rgba(140,92,255,.7)', size: 62 });
    marker.position.set(0, 5.15, 0);
    marker.scale.set(2.4, 1.2, 1);
    marker.material.opacity = 0.5;
    this.group.add(marker);
    this.chev = marker;

    scene.add(this.group);
  }

  panelAt(x) {
    return x < 0 ? this.panels.left : this.panels.right;
  }

  markPassed() {
    this.passed = true;
    this.passAnim = 0.001;
    for (const key of ['left', 'right']) {
      const p = this.panels[key];
      p.mesh.visible = false;
    }
    this.chev.visible = false;
  }

  update(dt, time) {
    for (const key of ['left', 'right']) {
      const p = this.panels[key];
      if (!p.mesh.visible) continue;
      const pulse = 0.86 + Math.sin(time * 3 + (key === 'left' ? 0 : 1.7)) * 0.08;
      p.mesh.material.opacity = pulse;
      p.floorLine.material.opacity = 0.5 + Math.sin(time * 5 + (key === 'left' ? 0 : 2)) * 0.2;
    }
    if (this.passAnim > 0) {
      this.passAnim += dt;
      this.group.position.y = Math.sin(this.passAnim * 14) * 0.04;
      if (this.passAnim > 0.45) {
        this.group.visible = false;
      }
    }
    if (this.chev.visible) {
      this.chev.position.y = 5.15 + Math.sin(time * 2.2) * 0.08;
    }
  }
}

/* ---------------- HAZARDS ---------------- */
export function createSaw(scene, z, { lane = 0, sweep = 2.4, phase = 0 } = {}) {
  const group = new THREE.Group();
  group.position.set(lane, 0, z);

  const metal = standardMat(0x9d1832, 0xff2f4a, 0.55, 0.85, 0.28);
  const hot = basicMat(0xff6a7f, { transparent: true, opacity: 0.9 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.16, 14), metal);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 1.42;
  group.add(disc);

  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 10), hot);
  inner.rotation.x = Math.PI / 2;
  inner.position.y = 1.42;
  group.add(inner);

  const spinner = new THREE.Group();
  spinner.position.y = 1.42;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 4), metal);
    tooth.position.set(Math.cos(a) * 1.36, Math.sin(a) * 1.36, 0);
    tooth.rotation.z = a - Math.PI / 2;
    spinner.add(tooth);
  }
  group.add(spinner);

  // warning column
  const beam = new THREE.Mesh(
    boxGeo(0.16, 3.0, 0.16),
    basicMat(0xff3355, { transparent: true, opacity: 0.35, additive: true })
  );
  beam.position.y = 1.1;
  group.add(beam);

  // ground warning
  const warning = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.75, 24),
    basicMat(0xff3355, { transparent: true, opacity: 0.55, additive: true, side: THREE.DoubleSide })
  );
  warning.rotation.x = -Math.PI / 2;
  warning.position.y = 0.03;
  group.add(warning);

  const glow = glowSprite(0xff2f4a, 6, 0.45);
  glow.position.y = 1.42;
  group.add(glow);

  // floating danger chevrons on the ground ahead
  const decal = new THREE.Mesh(
    planeGeo(3.4, 2.4),
    new THREE.MeshBasicMaterial({
      map: textTexture('!', { color: '#ff9db0', glow: 'rgba(255,47,74,.9)', size: 200, width: 256, height: 256 }),
      transparent: true, depthWrite: false, opacity: 0.55
    })
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.set(0, 0.04, 2.0);
  group.add(decal);

  scene.add(group);

  return {
    kind: 'saw',
    group,
    z,
    x: lane,
    data: { lane, sweep, phase, cooldown: 0, hitFlash: 0 },
    radius: 1.5,
    update(dt, time) {
      this.data.hitFlash = Math.max(0, this.data.hitFlash - dt);
      const wobble = Math.sin(time * 2.1 + phase);
      this.x = lane + wobble * sweep;
      group.position.x = this.x;
      spinner.rotation.z = time * 9;
      disc.rotation.z = time * 9;
      warning.material.opacity = 0.35 + Math.abs(Math.sin(time * 4 + phase)) * 0.35;
      glow.material.opacity = 0.32 + Math.abs(wobble) * 0.25;
      if (this.data.hitFlash > 0) {
        group.position.x += Math.sin(time * 70) * 0.12;
      }
    }
  };
}

export function createLaser(scene, z, side = 1) {
  const group = new THREE.Group();
  const center = side * 5.0;
  const width = 8.6;
  group.position.set(center, 0, z);

  const postMat = standardMat(0x251632, 0x4c0b20, 0.7, 0.8, 0.3);
  for (const dx of [-width / 2, width / 2]) {
    const post = new THREE.Mesh(boxGeo(0.35, 4.2, 0.5), postMat);
    post.position.set(dx, 2.1, 0);
    group.add(post);
    const cap = new THREE.Mesh(boxGeo(0.55, 0.22, 0.6), basicMat(0xff3355, { transparent: true, opacity: 0.9 }));
    cap.position.set(dx, 4.25, 0);
    group.add(cap);
  }
  const top = new THREE.Mesh(boxGeo(width, 0.16, 0.3), basicMat(0xff3355, { transparent: true, opacity: 0.75 }));
  top.position.set(0, 4.15, 0);
  group.add(top);

  const beams = [];
  for (let i = 0; i < 5; i++) {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 3.9, 6),
      basicMat(0xff3355, { transparent: true, opacity: 0.8, additive: true })
    );
    beam.position.set(-width / 2 + 0.55 + i * ((width - 1.1) / 4), 2.08, 0);
    group.add(beam);
    beams.push(beam);
  }

  const wall = new THREE.Mesh(
    planeGeo(width - 0.4, 3.8),
    new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(255,51,85,0.28)', 'rgba(255,51,85,0)', 128),
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  wall.position.set(0, 2.05, 0);
  group.add(wall);

  const floor = new THREE.Mesh(
    planeGeo(width, 2.4),
    new THREE.MeshBasicMaterial({
      map: textTexture('DANGER', { color: '#ff7d95', glow: 'rgba(255,51,85,.85)', size: 90, width: 512, height: 128 }),
      transparent: true, depthWrite: false, opacity: 0.55
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.04, 2.1);
  group.add(floor);

  scene.add(group);
  const xMin = center - width / 2;
  const xMax = center + width / 2;

  return {
    kind: 'laser',
    group,
    z,
    x: center,
    data: { side, xMin, xMax, cooldown: 0, phase: Math.random() * 6 },
    radius: width / 2,
    update(dt, time) {
      this.data.cooldown = Math.max(0, this.data.cooldown - dt);
      const f = 0.6 + Math.abs(Math.sin(time * 11 + this.data.phase)) * 0.35;
      wall.material.opacity = 0.35 + f * 0.35;
      for (let i = 0; i < beams.length; i++) {
        beams[i].material.opacity = 0.55 + Math.abs(Math.sin(time * 16 + i)) * 0.4;
        beams[i].scale.x = 0.8 + Math.abs(Math.sin(time * 9 + i)) * 0.9;
      }
      top.material.opacity = f;
    }
  };
}

/* ---------------- PICKUPS ---------------- */
export function createCoin(scene, x, z, value = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.09, 18),
    standardMat(0xffc857, 0x8a5200, 0.55, 0.8, 0.22)
  );
  coin.rotation.x = Math.PI / 2;
  coin.position.y = 1.1;
  group.add(coin);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.37, 0.045, 5, 20),
    basicMat(0xfff2b0, { transparent: true, opacity: 0.9 })
  );
  rim.position.y = 1.1;
  group.add(rim);
  const glow = glowSprite(0xffc857, 2.2, 0.5);
  glow.position.y = 1.1;
  group.add(glow);
  scene.add(group);
  return {
    kind: 'coin',
    group,
    z, x, value,
    data: { baseY: 1.1, spin: Math.random() * 6, collected: false },
    update(dt, time) {
      group.position.y = Math.sin(time * 2.6 + this.data.spin) * 0.13;
      coin.rotation.z = time * 2.5 + this.data.spin;
      rim.rotation.z = time * 2.5 + this.data.spin;
      glow.material.opacity = 0.38 + Math.sin(time * 4 + this.data.spin) * 0.15;
    }
  };
}

export function createRecruit(scene, x, z, amount) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.52, 0),
    standardMat(0x9dff4f, 0x3a8000, 0.8, 0.4, 0.2)
  );
  core.position.y = 1.25;
  group.add(core);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.74, 0.045, 5, 26),
    basicMat(0xa7ff4f, { transparent: true, opacity: 0.8, additive: true })
  );
  ring.position.y = 1.25;
  ring.rotation.x = Math.PI / 2.4;
  group.add(ring);
  const glow = glowSprite(0xa7ff4f, 3.4, 0.55);
  glow.position.y = 1.25;
  group.add(glow);
  const label = spriteLabel(`+${amount}`, { color: '#d8ff9b', glow: 'rgba(167,255,79,.9)', size: 150 });
  label.position.y = 2.5;
  label.scale.set(1.9, 1.0, 1);
  group.add(label);
  scene.add(group);
  return {
    kind: 'recruit',
    group, z, x,
    data: { amount, phase: Math.random() * 6, collected: false },
    update(dt, time) {
      group.position.y = Math.sin(time * 2.1 + this.data.phase) * 0.15;
      core.rotation.y = time * 1.8;
      core.rotation.x = Math.sin(time * 1.3 + this.data.phase) * 0.4;
      ring.rotation.z = time * 1.4 + this.data.phase;
      ring.rotation.y = time * 0.8;
      label.position.y = 2.5 + Math.sin(time * 2.1 + this.data.phase) * 0.08;
    }
  };
}

const POWER_DEFS = {
  shield: { color: 0x3ef6ff, label: 'SHIELD', aura: 0x3ef6ff },
  frenzy: { color: 0xff8a3d, label: 'FRENZY', aura: 0xff8a3d },
  magnet: { color: 0xb06bff, label: 'MAGNET', aura: 0xb06bff }
};

export function createPowerup(scene, x, z, type) {
  const def = POWER_DEFS[type] || POWER_DEFS.shield;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 0),
    standardMat(def.color, def.color, 0.9, 0.6, 0.2)
  );
  core.position.y = 1.5;
  group.add(core);
  const r1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.04, 5, 30),
    basicMat(def.color, { transparent: true, opacity: 0.85, additive: true })
  );
  r1.position.y = 1.5;
  r1.rotation.x = Math.PI / 3;
  group.add(r1);
  const r2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.025, 5, 30),
    basicMat(def.color, { transparent: true, opacity: 0.5, additive: true })
  );
  r2.position.y = 1.5;
  r2.rotation.x = Math.PI / 2.2;
  group.add(r2);
  const glow = glowSprite(def.color, 4.2, 0.55);
  glow.position.y = 1.5;
  group.add(glow);
  const label = spriteLabel(def.label, { color: '#ffffff', glow: 'rgba(255,255,255,.6)', size: 110 });
  label.position.y = 2.75;
  label.scale.set(2.6, 1.15, 1);
  group.add(label);
  scene.add(group);
  return {
    kind: 'powerup',
    group, z, x,
    data: { type, phase: Math.random() * 6, collected: false },
    update(dt, time) {
      const bob = Math.sin(time * 2.2 + this.data.phase) * 0.16;
      group.position.y = bob;
      core.rotation.y = time * 1.5;
      core.rotation.z = time * 1.2;
      r1.rotation.z = time * 1.1;
      r2.rotation.z = -time * 0.9;
      glow.material.opacity = 0.4 + Math.sin(time * 3 + this.data.phase) * 0.15;
      label.position.y = 2.75 + bob;
    }
  };
}

/* ---------------- ENEMY MOB ---------------- */
export class EnemyMob {
  constructor(scene) {
    this.scene = scene;
    this.kind = 'enemy';
    this.z = -200;
    this.x = 0;
    this.active = false;
    this.crowd = new Crowd(scene, { team: 'enemy', max: 220 });
    this.crowd.setVisible(false);
    this.banner = new CountBanner(scene);
    this.count = 0;
  }

  spawn(x, z, count) {
    this.x = x;
    this.z = z;
    this.count = count;
    this.active = true;
    this.crowd.setCount(count);
    this.crowd.setVisible(true);
    this.crowd.setPosition(x, z);
    this.crowd.aura.visible = false;
    this.banner.set(count);
    this.banner.setVisible(true);
    this.banner.position(x, 4.6, z);
    this.crowd.setAura(0xff3e6c, 0);
    this.crowd.clearAura();
  }

  setCount(n) {
    this.count = Math.max(0, n);
    this.crowd.setCount(this.count);
    this.banner.set(this.count);
  }

  despawn() {
    this.active = false;
    this.crowd.setVisible(false);
    this.banner.setVisible(false);
  }

  update(dt, time, speed) {
    if (!this.active) return;
    this.crowd.setPosition(this.x, this.z);
    this.crowd.update(dt, time, speed);
    this.banner.position(this.x, 4.7 + Math.sin(time * 2) * 0.08, this.z);
  }
}
