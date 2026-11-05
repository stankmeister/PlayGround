import * as THREE from 'three';

/* ---------- procedural textures ---------- */
const texCache = new Map();

export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const key = `radial|${inner}|${outer}|${size}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

export function ringTexture(color = '255,255,255') {
  const key = `ring|${color}`;
  if (texCache.has(key)) return texCache.get(key);
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = `rgba(${color},1)`;
  ctx.lineWidth = 8;
  ctx.shadowColor = `rgba(${color},1)`;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 26, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

export function textTexture(text, {
  color = '#ffffff',
  glow = 'rgba(255,255,255,0.8)',
  font = '900',
  width = 512,
  height = 256,
  size = 150,
  sub = '',
  subColor = 'rgba(255,255,255,0.7)',
  bg = null,
  border = null
} = {}) {
  const key = `text|${text}|${color}|${glow}|${width}|${height}|${size}|${sub}|${subColor}|${bg}|${border}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');

  if (bg) {
    ctx.fillStyle = bg;
    roundRect(ctx, 6, 6, width - 12, height - 12, 34);
    ctx.fill();
  }
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 7;
    ctx.shadowColor = border;
    ctx.shadowBlur = 22;
    roundRect(ctx, 10, 10, width - 20, height - 20, 30);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const family = '"Arial Black", "Inter", system-ui, sans-serif';
  const maxTextWidth = width - 72;
  let mainSize = size;
  ctx.font = `${font} ${mainSize}px ${family}`;
  let measured = ctx.measureText(text).width;
  if (measured > maxTextWidth) {
    mainSize = Math.max(18, Math.floor(mainSize * (maxTextWidth / measured)));
    ctx.font = `${font} ${mainSize}px ${family}`;
  }
  ctx.shadowColor = glow;
  ctx.shadowBlur = 28;
  ctx.fillStyle = color;
  const mainY = sub ? height * 0.43 : height * 0.5;
  ctx.fillText(text, width / 2, mainY);

  if (sub) {
    let subSize = Math.round(mainSize * 0.17);
    const subFamily = '"Inter", system-ui, sans-serif';
    ctx.font = `800 ${subSize}px ${subFamily}`;
    const subWidth = ctx.measureText(sub).width;
    if (subWidth > maxTextWidth * 0.86) {
      subSize = Math.max(8, Math.floor(subSize * ((maxTextWidth * 0.86) / subWidth)));
      ctx.font = `800 ${subSize}px ${subFamily}`;
    }
    ctx.shadowBlur = 10;
    ctx.fillStyle = subColor;
    ctx.fillText(sub, width / 2, height * 0.75);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(key, tex);
  return tex;
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

/* ---------- particles ---------- */
const MAX_PARTICLES = 700;
const _color = new THREE.Color();

export class Particles {
  constructor(scene) {
    this.count = 0;
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.col = new Float32Array(MAX_PARTICLES * 3);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.grav = new Float32Array(MAX_PARTICLES);
    this.drag = new Float32Array(MAX_PARTICLES);
    this.baseCol = new Float32Array(MAX_PARTICLES * 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({
      size: 0.35,
      map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64),
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.geo = geo;
  }

  spawn(x, y, z, color, {
    speed = 4, spread = 1, life = 0.8, gravity = -8, drag = 1.6, size = 1
  } = {}) {
    if (this.count >= MAX_PARTICLES) return;
    const i = this.count++;
    const theta = Math.random() * Math.PI * 2;
    const up = Math.random() * 2 - 1;
    const mag = speed * (0.35 + Math.random() * 0.9);
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = Math.cos(theta) * mag * spread;
    this.vel[i * 3 + 1] = up * mag * 0.8 + speed * 0.35;
    this.vel[i * 3 + 2] = Math.sin(theta) * mag * spread;
    this.life[i] = life * (0.7 + Math.random() * 0.6);
    this.maxLife[i] = this.life[i];
    this.grav[i] = gravity;
    this.drag[i] = drag;
    _color.set(color);
    this.baseCol[i * 3] = _color.r;
    this.baseCol[i * 3 + 1] = _color.g;
    this.baseCol[i * 3 + 2] = _color.b;
  }

  burst(x, y, z, color, count = 14, opts = {}) {
    for (let i = 0; i < count; i++) this.spawn(x, y, z, color, opts);
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.count;
        if (i !== last) {
          for (let k = 0; k < 3; k++) {
            this.pos[i * 3 + k] = this.pos[last * 3 + k];
            this.vel[i * 3 + k] = this.vel[last * 3 + k];
            this.baseCol[i * 3 + k] = this.baseCol[last * 3 + k];
          }
          this.life[i] = this.life[last];
          this.maxLife[i] = this.maxLife[last];
          this.grav[i] = this.grav[last];
          this.drag[i] = this.drag[last];
        }
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d + this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.03) {
        this.pos[i * 3 + 1] = 0.03;
        this.vel[i * 3 + 1] *= -0.28;
      }
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i * 3] = this.baseCol[i * 3] * t;
      this.col[i * 3 + 1] = this.baseCol[i * 3 + 1] * t;
      this.col[i * 3 + 2] = this.baseCol[i * 3 + 2] * t;
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

/* ---------- shockwave rings ---------- */
export class Shockwaves {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.pool = [];
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.SpriteMaterial({
        map: ringTexture('255,255,255'),
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 6;
      scene.add(sprite);
      this.pool.push(sprite);
    }
  }

  ring(x, y, z, color = 0x3ef6ff, { scale = 1, life = 0.6, growth = 12 } = {}) {
    const s = this.pool.pop();
    if (!s) return;
    s.visible = true;
    s.position.set(x, y, z);
    s.scale.setScalar(scale);
    s.material.color.set(color);
    s.material.opacity = 0.95;
    this.items.push({ sprite: s, life, max: life, growth, base: scale });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const t = 1 - it.life / it.max;
      if (it.life <= 0) {
        it.sprite.visible = false;
        it.sprite.material.opacity = 0;
        this.pool.push(it.sprite);
        this.items.splice(i, 1);
        continue;
      }
      it.sprite.scale.setScalar(it.base + it.growth * t);
      it.sprite.material.opacity = (1 - t) * 0.85;
    }
  }
}

/* ---------- floating 3D text ---------- */
export class Floaters {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.items = [];
    this.pool = [];
    this.matCache = new Map();
  }

  float(text, x, y, z, color = '#ffffff', { scale = 2.6, life = 1.1, rise = 2.2, glow = 'rgba(255,255,255,.7)', sub = '' } = {}) {
    const tex = textTexture(text, { color, glow, size: 170, sub, width: 512, height: sub ? 300 : 256 });
    let sprite = this.pool.pop();
    if (!sprite) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 1
      });
      sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 7;
      this.scene.add(sprite);
    } else {
      sprite.material.map = tex;
      sprite.material.needsUpdate = true;
    }
    sprite.visible = true;
    sprite.position.set(x, y, z);
    sprite.scale.set(scale, scale * (sub ? 0.6 : 0.5), 1);
    sprite.material.opacity = 1;
    sprite.material.color.set(0xffffff);
    this.items.push({ sprite, life, max: life, rise, baseY: y });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const t = 1 - it.life / it.max;
      it.sprite.position.y = it.baseY + it.rise * Math.min(1, t * 1.6);
      const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      it.sprite.material.opacity = Math.max(0, fade);
      if (it.life <= 0) {
        it.sprite.visible = false;
        this.pool.push(it.sprite);
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) {
      it.sprite.visible = false;
      this.pool.push(it.sprite);
    }
    this.items.length = 0;
  }
}
