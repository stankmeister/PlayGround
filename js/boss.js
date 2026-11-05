import * as THREE from 'three';
import { textTexture, radialTexture } from './fx.js';

const GEO = {
  torso: new THREE.BoxGeometry(2.9, 2.1, 1.8),
  chest: new THREE.IcosahedronGeometry(0.86, 0),
  pelvis: new THREE.BoxGeometry(1.7, 1.1, 1.4),
  shoulder: new THREE.BoxGeometry(1.35, 0.85, 1.45),
  upperArm: new THREE.BoxGeometry(0.72, 1.8, 0.72),
  forearm: new THREE.BoxGeometry(0.9, 1.6, 0.9),
  fist: new THREE.DodecahedronGeometry(0.62, 0),
  head: new THREE.BoxGeometry(1.65, 1.15, 1.35),
  visor: new THREE.BoxGeometry(1.28, 0.2, 0.1),
  horn: new THREE.ConeGeometry(0.2, 0.95, 5),
  spike: new THREE.ConeGeometry(0.16, 0.8, 4),
  halo: new THREE.TorusGeometry(2.75, 0.055, 6, 56),
  hover: new THREE.TorusGeometry(2.55, 0.075, 6, 56),
  telegraphRing: new THREE.RingGeometry(1.72, 2.32, 48),
  telegraphDisc: new THREE.CircleGeometry(1.72, 40),
  beam: new THREE.CylinderGeometry(0.1, 0.1, 9, 8, 1, true)
};

const nameCache = new Map();
function bossNameTexture(name) {
  if (!nameCache.has(name)) {
    nameCache.set(name, new THREE.SpriteMaterial({
      map: textTexture(name, {
        color: '#ffd3dc',
        glow: 'rgba(255,47,90,.95)',
        size: 86,
        sub: 'BOSS',
        subColor: 'rgba(255,170,190,.75)',
        width: 640,
        height: 256
      }),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0.92
    }));
  }
  return nameCache.get(name);
}

const COLORS = {
  1: { main: 0xff3e6c, emissive: 0xff1f4e },
  2: { main: 0xff9a3e, emissive: 0xff6a1f },
  3: { main: 0xff2f2f, emissive: 0xff0f0f }
};

export class Boss {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.z = -180;
    this.x = 0;
    this.targetX = 0;
    this.phase = 1;
    this.tier = 0;
    this.maxHp = 1;
    this.hp = 1;
    this.hitPulse = 0;
    this.attackT = 0;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    scene.add(this.group);

    this.metal = new THREE.MeshStandardMaterial({
      color: 0x2d1838, metalness: 0.88, roughness: 0.32,
      emissive: 0x3a0a18, emissiveIntensity: 0.55, flatShading: true
    });
    this.dark = new THREE.MeshStandardMaterial({
      color: 0x120a1e, metalness: 0.7, roughness: 0.5,
      emissive: 0x14030c, emissiveIntensity: 0.5, flatShading: true
    });
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0x350711, emissive: 0xff1f4e, emissiveIntensity: 2.4,
      metalness: 0.5, roughness: 0.25, flatShading: true
    });
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0xff3e6c, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.haloMat = new THREE.MeshBasicMaterial({
      color: 0xff3e6c, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.hoverMat = new THREE.MeshBasicMaterial({
      color: 0xff3e6c, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });

    /* --- torso --- */
    const torso = new THREE.Mesh(GEO.torso, this.metal);
    torso.position.y = 3.15;
    this.inner.add(torso);

    const pelvis = new THREE.Mesh(GEO.pelvis, this.dark);
    pelvis.position.y = 1.95;
    this.inner.add(pelvis);

    // chest core
    this.core = new THREE.Mesh(GEO.chest, this.coreMat);
    this.core.position.set(0, 3.22, 0.96);
    this.inner.add(this.core);

    // waist halo
    this.waist = new THREE.Mesh(GEO.halo, this.haloMat);
    this.waist.position.set(0, 2.3, 0);
    this.waist.rotation.x = Math.PI / 2;
    this.waist.scale.setScalar(0.52);
    this.inner.add(this.waist);

    // chest glow strips
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.25, 0.08), this.glowMat);
      strip.position.set(side * 1.05, 3.15, 0.88);
      this.inner.add(strip);
    }

    // chest cage veins
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(GEO.spike, this.metal);
      rib.position.set(side * 0.82, 3.32, 0.86);
      rib.rotation.z = side * -1.15;
      rib.rotation.x = 0.2;
      this.inner.add(rib);
    }

    /* --- head --- */
    const head = new THREE.Mesh(GEO.head, this.metal);
    head.position.set(0, 4.62, 0.06);
    this.inner.add(head);

    const visor = new THREE.Mesh(GEO.visor, this.glowMat);
    visor.position.set(0, 4.68, 0.75);
    this.inner.add(visor);
    this.visor = visor;

    this.eyes = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.1), this.coreMat);
      eye.position.set(side * 0.36, 4.68, 0.83);
      this.inner.add(eye);
      this.eyes.push(eye);
    }

    // crown horns
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(GEO.horn, this.dark);
      horn.position.set(side * 0.62, 5.45, 0.0);
      horn.rotation.z = side * 0.36;
      this.inner.add(horn);
    }

    /* --- shoulders + arms --- */
    this.armGroups = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(GEO.shoulder, this.metal);
      shoulder.position.set(side * 1.92, 3.9, 0);
      shoulder.rotation.z = side * -0.18;
      this.inner.add(shoulder);

      const shoulderGlow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.09, 0.1), this.glowMat);
      shoulderGlow.position.set(side * 1.92, 4.18, 0.7);
      shoulderGlow.rotation.z = side * -0.18;
      this.inner.add(shoulderGlow);

      const armPivot = new THREE.Group();
      armPivot.position.set(side * 2.05, 3.7, 0);
      this.inner.add(armPivot);

      const upper = new THREE.Mesh(GEO.upperArm, this.dark);
      upper.position.y = -0.92;
      armPivot.add(upper);

      const forearm = new THREE.Mesh(GEO.forearm, this.metal);
      forearm.position.set(side * 0.13, -2.35, 0.12);
      forearm.rotation.z = side * -0.14;
      armPivot.add(forearm);

      const armGlow = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.12), this.glowMat);
      armGlow.position.set(side * 0.13, -1.8, 0.61);
      armPivot.add(armGlow);

      const fist = new THREE.Mesh(GEO.fist, this.dark);
      fist.position.set(side * 0.24, -3.18, 0.18);
      armPivot.add(fist);

      const knuckle = new THREE.Mesh(GEO.chest, this.coreMat);
      knuckle.scale.setScalar(0.26);
      knuckle.position.set(side * 0.24, -3.18, 0.62);
      armPivot.add(knuckle);

      this.armGroups.push(armPivot);
    }

    // back spikes
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(GEO.spike, this.metal);
      spike.position.set((i - 1) * 0.72, 3.55 - i * 0.05, -0.92);
      spike.rotation.x = -1.2;
      spike.scale.setScalar(0.8 + i * 0.16);
      this.inner.add(spike);
    }

    /* --- rings --- */
    this.halo = new THREE.Mesh(GEO.halo, this.haloMat);
    this.halo.position.set(0, 3.15, -1.05);
    this.inner.add(this.halo);

    this.halo2 = new THREE.Mesh(GEO.halo, this.haloMat);
    this.halo2.position.set(0, 3.15, -1.05);
    this.halo2.rotation.x = 1.25;
    this.halo2.scale.setScalar(0.84);
    this.inner.add(this.halo2);

    this.hoverRing = new THREE.Mesh(GEO.hover, this.hoverMat);
    this.hoverRing.rotation.x = Math.PI / 2;
    this.hoverRing.position.y = 0.18;
    this.inner.add(this.hoverRing);

    this.hoverRing2 = new THREE.Mesh(GEO.hover, this.hoverMat);
    this.hoverRing2.rotation.x = Math.PI / 2;
    this.hoverRing2.position.y = 0.34;
    this.hoverRing2.scale.setScalar(0.72);
    this.inner.add(this.hoverRing2);

    // aura
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture('rgba(255,62,108,.55)', 'rgba(255,62,108,0)', 192),
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0.55
    }));
    this.aura.scale.set(12, 12, 1);
    this.aura.position.set(0, 3.1, -0.7);
    this.inner.add(this.aura);

    // name plate
    this.plate = new THREE.Sprite(bossNameTexture('BOSS'));
    this.plate.position.set(0, 6.75, 0);
    this.plate.scale.set(4.3, 1.72, 1);
    this.inner.add(this.plate);

    // menacing under-light
    this.light = new THREE.PointLight(0xff2f5a, 34, 28, 2);
    this.light.position.set(0, 3.0, 1.2);
    this.inner.add(this.light);

    /* --- telegraph (scene space, on the track) --- */
    this.telegraph = new THREE.Group();
    this.telegraph.visible = false;
    scene.add(this.telegraph);

    const tRing = new THREE.Mesh(GEO.telegraphRing, new THREE.MeshBasicMaterial({
      color: 0xff2f4e, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide
    }));
    tRing.rotation.x = -Math.PI / 2;
    tRing.renderOrder = 6;
    this.telegraph.add(tRing);

    const tDisc = new THREE.Mesh(GEO.telegraphDisc, new THREE.MeshBasicMaterial({
      color: 0xff1236, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide
    }));
    tDisc.rotation.x = -Math.PI / 2;
    tDisc.position.y = 0.01;
    tDisc.renderOrder = 5;
    this.telegraph.add(tDisc);

    const tBeam = new THREE.Mesh(GEO.beam, new THREE.MeshBasicMaterial({
      color: 0xff2f4e, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    tBeam.position.y = 4.5;
    this.telegraph.add(tBeam);

    const tTop = new THREE.Mesh(GEO.telegraphRing, new THREE.MeshBasicMaterial({
      color: 0xff4d6a, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    tTop.rotation.x = -Math.PI / 2;
    tTop.position.y = 3.05;
    tTop.scale.setScalar(0.78);
    this.telegraph.add(tTop);

    this.tRing = tRing;
    this.tDisc = tDisc;
    this.tBeam = tBeam;
    this.tTop = tTop;
    this.telegraph.position.y = 0.06;
  }

  spawn(x, z, { tier = 0, name = 'THE WARDEN', maxHp = 900 } = {}) {
    this.active = true;
    this.x = x;
    this.targetX = x;
    this.z = z;
    this.tier = tier;
    this.phase = 1;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.hitPulse = 0;
    this.attackT = 0;
    this.baseScale = Math.min(1.6, 1.3 + tier * 0.03);
    this.group.scale.setScalar(this.baseScale);
    this.group.position.set(x, 0, z);
    this.group.visible = true;
    this.inner.position.set(0, 0, 0);
    this.inner.rotation.set(0, 0, 0);
    this.telegraph.visible = false;
    this.plate.material = bossNameTexture(name);
    this.setPhase(1);
    this.setHpFraction(1);
  }

  despawn() {
    this.active = false;
    this.group.visible = false;
    this.telegraph.visible = false;
  }

  setPhase(phase) {
    this.phase = phase;
    const c = COLORS[phase] || COLORS[1];
    this.coreMat.emissive.setHex(c.emissive);
    this.glowMat.color.setHex(c.main);
    this.haloMat.color.setHex(c.main);
    this.hoverMat.color.setHex(c.main);
    this.aura.material.color.setHex(c.main);
    if (this.light) this.light.color.setHex(c.main);
    this.visor.material = this.glowMat;
  }

  setHpFraction(f) {
    this.hpFrac = Math.max(0, Math.min(1, f));
    this.coreMat.emissiveIntensity = 1.8 + (1 - this.hpFrac) * 2.8;
  }

  attackAt(x) {
    this.attackT = 0.0001;
    this.telegraph.position.x = x;
    this.telegraph.visible = true;
    this.telegraph.scale.setScalar(1);
  }

  endAttack() {
    this.telegraph.visible = false;
  }

  hit() {
    this.hitPulse = 0.12;
  }

  update(dt, time, speed = 0) {
    if (!this.active) return;

    if (this.z < -10.6) {
      this.z += (speed + 14) * dt;
      if (this.z > -10.6) this.z = -10.6;
    }
    this.x += (this.targetX - this.x) * Math.min(1, dt * 2.2);

    const hover = Math.sin(time * 1.35) * 0.22;
    this.group.position.set(this.x, 0, this.z);

    // slam animation
    this.attackT = Math.max(0, this.attackT - dt);
    let lunge = 0;
    let dip = 0;
    let tilt = 0;
    if (this.attackT > 0) {
      const t = 1 - this.attackT / 0.55;
      const punch = Math.sin(Math.min(1, t) * Math.PI);
      lunge = punch * 1.15;
      dip = punch * 0.55;
      tilt = punch * 0.22;
    }

    this.inner.position.set(0, hover - dip, lunge);
    this.inner.rotation.x = tilt;
    this.inner.rotation.y = Math.sin(time * 0.45) * 0.07;

    this.core.rotation.y = time * 1.7;
    this.core.rotation.x = Math.sin(time * 1.1) * 0.3;
    this.core.scale.setScalar(1 + Math.sin(time * 4.2) * 0.06 + this.hitPulse * 1.8);

    this.halo.rotation.z = time * 0.55;
    this.halo2.rotation.z = -time * 0.8;
    this.halo2.rotation.y = time * 0.4;
    this.hoverRing.rotation.z = time * 0.5;
    this.hoverRing2.rotation.z = -time * 0.7;
    this.waist.rotation.z = time * 0.9;

    this.plate.position.y = 6.75 + Math.sin(time * 1.8) * 0.07;

    for (let i = 0; i < this.armGroups.length; i++) {
      const arm = this.armGroups[i];
      arm.rotation.x = Math.sin(time * 1.1 + i * 2.4) * 0.09 + (this.attackT > 0 ? -0.55 : 0);
      arm.rotation.z = (i === 0 ? -1 : 1) * (0.08 + Math.sin(time * 0.9 + i) * 0.04);
    }

    this.hitPulse = Math.max(0, this.hitPulse - dt);
    this.aura.material.opacity = 0.4 + Math.sin(time * 2.4) * 0.12 + (1 - (this.hpFrac ?? 1)) * 0.2;

    if (this.telegraph.visible) {
      const pulse = 1 + Math.sin(time * 22) * 0.045;
      this.telegraph.scale.setScalar(pulse);
      this.tRing.material.opacity = 0.65 + Math.abs(Math.sin(time * 12)) * 0.35;
      this.tDisc.material.opacity = 0.12 + Math.abs(Math.sin(time * 9)) * 0.12;
      this.tBeam.material.opacity = 0.16 + Math.abs(Math.sin(time * 6)) * 0.16;
      this.tTop.material.opacity = 0.45 + Math.abs(Math.sin(time * 11)) * 0.4;
      this.tTop.rotation.z = time * 0.8;
      this.tTop.scale.setScalar(0.78 + Math.sin(time * 13) * 0.04);
    }
  }
}
