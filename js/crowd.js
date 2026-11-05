import * as THREE from 'three';
import { radialTexture, ringTexture } from './fx.js';

const _dummy = new THREE.Object3D();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _col = new THREE.Color();

const GEO = {
  body: new THREE.CapsuleGeometry(0.155, 0.25, 4, 8),
  head: new THREE.SphereGeometry(0.15, 10, 8),
  cap: new THREE.ConeGeometry(0.135, 0.19, 6, 1),
  leg: new THREE.BoxGeometry(0.075, 0.24, 0.075),
  shadow: new THREE.CircleGeometry(0.3, 12).rotateX(-Math.PI / 2)
};

const PLAYER_PALETTE = ['#32f2ff', '#39c9ff', '#6d9cff', '#45f7c3', '#9a7dff', '#4ee6ff'];
const ENEMY_PALETTE = ['#ff3e7a', '#ff5a4a', '#ff7a2f', '#e12bff', '#ff2e5f', '#ff8b3d'];
const SKIN = ['#f7c9a3', '#e8b08a', '#c98d63', '#8d5a3b', '#f2d2b8', '#b97a54'];
const CAPS = ['#9ffbff', '#7de8ff', '#c0b3ff', '#9dffd3'];

function buildOffsets(max) {
  const out = [{ x: 0, z: 0 }];
  let ring = 1;
  while (out.length < max) {
    const n = 6 * ring;
    const radius = ring * 0.54;
    const start = ring * 0.35;
    for (let i = 0; i < n && out.length < max; i++) {
      const a = start + (i / n) * Math.PI * 2;
      out.push({ x: Math.cos(a) * radius, z: Math.sin(a) * radius * 0.92 });
    }
    ring++;
  }
  return out;
}

export class Crowd {
  constructor(scene, { team = 'player', max = 300 } = {}) {
    this.scene = scene;
    this.team = team;
    this.max = max;
    this.offsets = buildOffsets(max);
    this.count = 0;
    this.visual = 0;
    this.targetVisual = 0;
    this.x = 0;
    this.z = 0;
    this.spread = 1;
    this.radius = 1.2;
    this.pop = 1;
    this.time = 0;
    this.hidden = false;
    this.bigEvery = team === 'enemy' ? 9 : 13;

    const palette = team === 'player' ? PLAYER_PALETTE : ENEMY_PALETTE;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.18,
      emissive: new THREE.Color(team === 'player' ? 0x043c44 : 0x3c041c),
      emissiveIntensity: 0.7,
      flatShading: false
    });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.02 });
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.5,
      emissive: new THREE.Color(team === 'player' ? 0x1b8c9c : 0x8c1b3f),
      emissiveIntensity: 0.85
    });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x141428, roughness: 0.7, metalness: 0.1 });
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: team === 'player' ? 0.32 : 0.36,
      depthWrite: false
    });

    const mk = (geo, mat, count) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      m.renderOrder = 2;
      scene.add(m);
      return m;
    };

    this.body = mk(GEO.body, bodyMat, max);
    this.head = mk(GEO.head, headMat, max);
    this.cap = mk(GEO.cap, capMat, max);
    this.legs = mk(GEO.leg, legMat, max * 2);
    this.shadows = mk(GEO.shadow, shadowMat, max);
    this.shadows.renderOrder = 1;

    this.phases = new Float32Array(max);
    this.speeds = new Float32Array(max);
    this.sizes = new Float32Array(max);
    for (let i = 0; i < max; i++) {
      this.phases[i] = Math.random() * Math.PI * 2;
      this.speeds[i] = 0.85 + Math.random() * 0.45;
      this.sizes[i] = i % this.bigEvery === this.bigEvery - 1 ? (team === 'enemy' ? 1.3 : 1.16) : 1;
    }

    // instance colors
    for (let i = 0; i < max; i++) {
      _col.set(palette[i % palette.length]);
      this.body.setColorAt(i, _col);
      _col.set(palette[(i + 2) % palette.length]).multiplyScalar(1.12);
      this.cap.setColorAt(i, _col);
      _col.set(SKIN[i % SKIN.length]);
      this.head.setColorAt(i, _col);
    }
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    if (this.cap.instanceColor) this.cap.instanceColor.needsUpdate = true;
    if (this.head.instanceColor) this.head.instanceColor.needsUpdate = true;

    // aura
    this.aura = new THREE.Group();
    this.aura.visible = false;
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x3ef6ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.auraRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.1, 64), ringMat);
    this.auraRing.rotation.x = -Math.PI / 2;
    this.auraRing.position.y = 0.05;
    this.aura.add(this.auraRing);

    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x3ef6ff,
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.auraDome = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), domeMat);
    this.auraDome.scale.set(2.1, 1.15, 2.1);
    this.aura.add(this.auraDome);
    this.auraGroup = this.aura;
    scene.add(this.aura);

    // soft ground glow for player squad
    if (team === 'player') {
      const glowMat = new THREE.SpriteMaterial({
        map: radialTexture('rgba(62,246,255,0.5)', 'rgba(62,246,255,0)', 128),
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.glow = new THREE.Sprite(glowMat);
      this.glow.scale.set(7, 3.2, 1);
      scene.add(this.glow);
    }
  }

  setCount(n) {
    const prev = this.count;
    this.count = Math.max(0, Math.floor(n));
    this.targetVisual = Math.min(this.count, this.max);
    if (this.targetVisual > prev) this.pop = Math.min(1.35, this.pop + 0.09);
    if (this.count === 0) this.visual = 0;
  }

  setPosition(x, z) {
    this.x = x;
    this.z = z;
  }

  setVisible(v) {
    this.hidden = !v;
    this.body.visible = v;
    this.head.visible = v;
    this.cap.visible = v;
    this.legs.visible = v;
    this.shadows.visible = v;
    this.aura.visible = v && this._auraOn;
    if (this.glow) this.glow.visible = v;
  }

  setAura(color, strength = 1) {
    this._auraOn = strength > 0;
    this.aura.visible = this._auraOn && !this.hidden;
    if (!this._auraOn) return;
    this.auraRing.material.color.set(color);
    this.auraDome.material.color.set(color);
    this.auraRing.material.opacity = 0.35 + 0.28 * strength;
    this.auraDome.material.opacity = 0.035 + 0.04 * strength;
  }

  clearAura() {
    this._auraOn = false;
    this.aura.visible = false;
  }

  update(dt, time, speed = 18) {
    this.time = time;
    const target = this.targetVisual;
    const lerp = 1 - Math.pow(0.0001, dt);
    this.visual += (target - this.visual) * Math.min(1, lerp * 1.6);
    if (this.visual < 0.05) this.visual = 0;
    const n = Math.min(this.max, Math.round(this.visual));
    this.pop += (1 - this.pop) * Math.min(1, dt * 8);

    if (!this.hidden && n > 0) {
      this.body.count = n;
      this.head.count = n;
      this.cap.count = n;
      this.legs.count = n * 2;
      this.shadows.count = n;

      const spread = 0.82 + Math.min(0.45, this.visual * 0.0019) + (this.pop - 1) * 0.6;
      this.spread = spread;
      let maxR = 0.6;
      const runSpeed = 10 + Math.min(8, speed * 0.2);

      for (let i = 0; i < n; i++) {
        const off = this.offsets[i];
        const phase = this.phases[i];
        const size = this.sizes[i];
        const wob = Math.sin(time * 2.1 + phase) * 0.035;
        const ox = off.x * spread + wob;
        const oz = off.z * spread + Math.cos(time * 1.7 + phase) * 0.035;
        const r = Math.hypot(ox, oz);
        if (r > maxR) maxR = r;

        const bob = Math.abs(Math.sin(time * runSpeed * 0.7 + phase)) * 0.075 * (0.8 + speed * 0.006);
        const sway = Math.sin(time * 4.4 + phase) * 0.035;
        const x = this.x + ox;
        const z = this.z + oz;
        const yBase = 0;

        // body
        _dummy.position.set(x + sway, yBase + 0.46 + bob, z);
        _e.set(Math.sin(time * runSpeed + phase) * 0.055, 0, Math.sin(time * 2.3 + phase) * 0.045);
        _q.setFromEuler(_e);
        _dummy.quaternion.copy(_q);
        _dummy.scale.set(size, size, size);
        _dummy.updateMatrix();
        this.body.setMatrixAt(i, _dummy.matrix);

        // head
        _dummy.position.set(x + sway * 1.3, yBase + 0.83 + bob, z);
        _e.set(0, Math.sin(time * 1.5 + phase) * 0.3, 0);
        _dummy.quaternion.setFromEuler(_e);
        _dummy.scale.set(size, size, size);
        _dummy.updateMatrix();
        this.head.setMatrixAt(i, _dummy.matrix);

        // cap
        _dummy.position.set(x + sway * 1.3, yBase + 0.99 + bob, z);
        _e.set(Math.sin(time * runSpeed + phase) * 0.08, 0, 0);
        _dummy.quaternion.setFromEuler(_e);
        _dummy.scale.set(size, size, size);
        _dummy.updateMatrix();
        this.cap.setMatrixAt(i, _dummy.matrix);

        // legs
        const swing = Math.sin(time * runSpeed + phase) * 0.85;
        for (let l = 0; l < 2; l++) {
          _dummy.position.set(x + (l === 0 ? -0.085 : 0.085) * size, yBase + 0.16 + bob * 0.35, z);
          _e.set(swing * (l === 0 ? 1 : -1), 0, 0);
          _dummy.quaternion.setFromEuler(_e);
          _dummy.scale.set(size, size, size);
          _dummy.updateMatrix();
          this.legs.setMatrixAt(i * 2 + l, _dummy.matrix);
        }

        // shadow
        _dummy.position.set(x + 0.03, 0.022, z + 0.04);
        _dummy.quaternion.identity();
        _dummy.scale.setScalar(size * (1 + bob * 0.45));
        _dummy.updateMatrix();
        this.shadows.setMatrixAt(i, _dummy.matrix);
      }

      this.body.instanceMatrix.needsUpdate = true;
      this.head.instanceMatrix.needsUpdate = true;
      this.cap.instanceMatrix.needsUpdate = true;
      this.legs.instanceMatrix.needsUpdate = true;
      this.shadows.instanceMatrix.needsUpdate = true;
      this.radius = maxR + 0.35;
    } else if (this.hidden || n === 0) {
      this.body.count = 0;
      this.head.count = 0;
      this.cap.count = 0;
      this.legs.count = 0;
      this.shadows.count = 0;
      this.radius = 0.6;
    }

    if (this.glow) {
      const s = Math.max(2.2, this.radius * 2.6);
      this.glow.position.set(this.x, 0.06, this.z);
      this.glow.scale.set(s, s * 0.42, 1);
      this.glow.material.opacity = this.hidden ? 0 : 0.38;
    }

    if (this._auraOn) {
      const pulse = 1 + Math.sin(time * 5) * 0.07;
      this.aura.position.set(this.x, 0, this.z);
      const s = Math.max(1.3, this.radius * 1.15);
      this.auraRing.scale.set(s, s, s);
      this.auraDome.scale.set(s * 1.5, Math.max(1, s * 0.72), s * 1.5);
      this.auraRing.material.opacity = (0.32 + Math.sin(time * 7) * 0.08) * pulse;
    }
  }

  randomUnitPosition() {
    if (this.count === 0) return new THREE.Vector3(this.x, 0.6, this.z);
    const i = Math.floor(Math.random() * Math.min(this.count, this.max));
    const off = this.offsets[i];
    return new THREE.Vector3(this.x + off.x * this.spread, 0.5 + Math.random() * 0.5, this.z + off.z * this.spread);
  }

  dispose() {
    for (const m of [this.body, this.head, this.cap, this.legs, this.shadows]) {
      this.scene.remove(m);
      m.dispose();
    }
    this.scene.remove(this.aura);
    if (this.glow) this.scene.remove(this.glow);
  }
}

/* A floating count banner for enemy mobs */
export class CountBanner {
  constructor(scene) {
    this.scene = scene;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      depthTest: false
    }));
    this.sprite.scale.set(3.4, 1.7, 1);
    this.sprite.visible = false;
    this.sprite.renderOrder = 6;
    scene.add(this.sprite);
    this.value = -1;
    this.color = '#ff6b8a';
  }

  set(count, color = '#ff6b8a') {
    if (count === this.value && color === this.color) return;
    this.value = count;
    this.color = color;
    const ctx = this.ctx;
    const w = 256, h = 128;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(20,4,14,0.82)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    roundRect(ctx, 10, 26, w - 20, 76, 26);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = '900 54px "Arial Black", Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(String(count), w / 2, 65);
    ctx.font = '800 17px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.fillText('RIVAL MOB', w / 2, 100);
    this.texture.needsUpdate = true;
  }

  position(x, y, z) {
    this.sprite.position.set(x, y, z);
  }

  setVisible(v) { this.sprite.visible = v; }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
