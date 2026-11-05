import * as THREE from 'three';
import { World } from './world.js';
import { Particles, Shockwaves, Floaters } from './fx.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { loadSave, writeSave, flushSave, UPGRADE_DEFS, upgradeCost } from './save.js';

const canvas = document.getElementById('game-canvas');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x080416, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x2a1245, 85, 330);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 7.8, 16.2);
camera.lookAt(0, 1.55, -21);

const world = new World(scene);
const fx = new Particles(scene);
const shock = new Shockwaves(scene);
const floaters = new Floaters(scene, camera);
const audio = new AudioEngine();
const save = loadSave();
const ui = new UI();

audio.setMuted(!save.sound);
ui.setSave(save);
ui.setSound(!save.sound);

function persist() {
  writeSave(save);
}

const game = new Game({
  scene, camera, world, fx, shock, floaters, audio, ui, save, persist
});

ui.bind({
  play: () => {
    audio.unlock();
    game.startRun();
  },
  pause: () => game.togglePause(),
  resume: () => game.resume(),
  restart: () => {
    audio.unlock();
    ui.hidePause();
    ui.hideGameOver();
    game.restartRun();
  },
  home: () => {
    game.goHome();
    ui.updateStartStats();
    ui.updateCoins();
  },
  revive: () => game.revive(),
  sound: () => {
    save.sound = !save.sound;
    audio.unlock();
    audio.setMuted(!save.sound);
    ui.setSound(!save.sound);
    persist();
    if (save.sound) audio.click();
  },
  choosePerk: (id) => game.choosePerk(id),
  buyUpgrade: (id) => {
    const def = UPGRADE_DEFS.find((d) => d.id === id);
    if (!def) return;
    const level = save.upgrades[id] || 0;
    if (level >= def.max) return;
    const cost = upgradeCost(def, level);
    if (save.coins < cost) {
      ui.toast('NOT ENOUGH COINS', 'bad');
      return;
    }
    save.coins -= cost;
    save.upgrades[id] = level + 1;
    persist();
    ui.updateCoins();
    ui.updateStartStats();
    ui.renderUpgrades();
    audio.unlock();
    audio.click();
    ui.toast(`${def.name.toUpperCase()} UPGRADED`, 'good', 1500);
  }
});

ui.showStart();

/* ---------- input ---------- */
let dragging = false;
let dragStartX = 0;
let dragStartTarget = 0;
let activePointer = null;

function startDrag(e) {
  if (game.mode !== 'running') return;
  dragging = true;
  activePointer = e.pointerId;
  dragStartX = e.clientX;
  dragStartTarget = game.steerTarget;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  ui.hideSteerHint();
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  startDrag(e);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging || e.pointerId !== activePointer) return;
  game.dragTo(dragStartTarget, e.clientX - dragStartX, window.innerWidth);
});
function endDrag(e) {
  if (e.pointerId !== activePointer) return;
  dragging = false;
  activePointer = null;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerId === activePointer && e.pointerType === 'mouse') endDrag(e);
});

const keys = { left: false, right: false };
function setKey(e, down) {
  const key = e.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') {
    keys.left = down;
    game.input.left = down;
    e.preventDefault();
  } else if (key === 'arrowright' || key === 'd') {
    keys.right = down;
    game.input.right = down;
    e.preventDefault();
  } else if (down && (key === 'p' || key === ' ')) {
    if (key === 'p') game.togglePause();
    if (key === ' ' && game.mode === 'running') game.pause();
    e.preventDefault();
  } else if (down && key === 'escape') {
    if (game.mode === 'running') game.pause();
    else if (game.mode === 'paused') game.resume();
  }
}
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (!e.repeat) audio.unlock();
  setKey(e, true);
});
window.addEventListener('keyup', (e) => setKey(e, false));
window.addEventListener('blur', () => {
  keys.left = keys.right = false;
  game.input.left = game.input.right = false;
  dragging = false;
});

/* ---------- resize ---------- */
let resizeTimer = 0;
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 80);
});
window.addEventListener('orientationchange', () => setTimeout(resize, 180));

/* ---------- pause when hidden ---------- */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    dragging = false;
    game.input.left = game.input.right = false;
    if (game.mode === 'running') game.pause();
  }
});
window.addEventListener('pagehide', () => flushSave(save));

/* ---------- game loop ---------- */
let last = performance.now();
let frames = 0;
let fpsTime = 0;
function frame(now) {
  const dt = Math.min(0.06, (now - last) / 1000);
  last = now;
  game.update(dt);
  renderer.render(scene, camera);
  frames++;
  fpsTime += dt;
  if (fpsTime > 1) {
    fpsTime = 0;
    frames = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- debug hooks (used by automated visual checks) ---------- */
window.__mobSurge = {
  game, ui, scene, camera, renderer, save, world,
  start: () => { audio.unlock(); game.startRun(); },
  setCount: (n) => game.setCount(n),
  addCoins: (n) => { save.coins += n; persist(); ui.updateCoins(); ui.updateStartStats(); },
  choosePerk: (id) => game.choosePerk(id),
  revive: () => game.revive(),
  upgrade: (id) => {
    const def = UPGRADE_DEFS.find((d) => d.id === id);
    if (!def) return;
    save.upgrades[id] = Math.min(def.max, (save.upgrades[id] || 0) + 1);
    persist();
  },
  spawnGate: () => {
    if (!game.run) return;
    game.spawnEvent('gate', game.run.distance + 35);
  },
  spawnEnemy: () => {
    if (!game.run) return;
    game.spawnEvent('enemy', game.run.distance + 60);
  },
  spawnBoss: () => {
    if (!game.run) return;
    game.boss.despawn();
    game.run.bossFight = null;
    game.bossFight = null;
    game.spawnBoss();
  },
  hurtBoss: (n) => {
    const b = game.run?.bossFight;
    if (!b) return;
    b.hp = Math.max(0, b.hp - n);
  },
  info: () => ({
    mode: game.mode,
    count: game.run?.count,
    distance: game.run?.distance,
    entities: game.entities.length,
    battle: !!game.run?.battle,
    boss: game.boss.active,
    bossFight: !!game.run?.bossFight,
    bossHp: game.run?.bossFight ? Math.round(game.run.bossFight.hp) : null,
    bossSize: game.boss.group.scale.x,
    enemy: game.enemy.active ? game.enemy.count : 0,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    frames
  })
};
