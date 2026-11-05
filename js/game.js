import * as THREE from 'three';
import { Crowd } from './crowd.js';
import {
  Gate, EnemyMob, gateOps, applyOp, opLabel,
  createSaw, createLaser, createCoin, createRecruit, createPowerup
} from './entities.js';
import { Boss } from './boss.js';

export const PERKS = [
  {
    id: 'warlord', name: 'Warlord', icon: 'fist', color: '#ff6b9d', tag: 'COMBAT', max: 5,
    desc: () => '+30% damage dealt in mob clashes.'
  },
  {
    id: 'midas', name: 'Midas Touch', icon: 'coin', color: '#ffc857', tag: 'ECONOMY', max: 5,
    desc: () => '+30% coins from every source.'
  },
  {
    id: 'aegis', name: 'Aegis', icon: 'shield', color: '#3ef6ff', tag: 'DEFENSE', max: 3,
    desc: () => 'Gain a 4s shield after passing any gate.'
  },
  {
    id: 'lucky', name: 'Gate Hacker', icon: 'dice', color: '#a7ff4f', tag: 'GATES', max: 3,
    desc: () => 'Gates are much more likely to offer two good options.'
  },
  {
    id: 'berserk', name: 'Berserker', icon: 'flame', color: '#ff8a3d', tag: 'POWER-UP', max: 3,
    desc: () => 'Frenzy lasts 2s longer and hits 25% harder.'
  },
  {
    id: 'titan', name: 'Titan', icon: 'crowd', color: '#8c5cff', tag: 'INSTANT', max: 6,
    desc: () => 'Instantly add 40 units to your mob.'
  },
  {
    id: 'fleet', name: 'Fleet Foot', icon: 'speed', color: '#3ef6ff', tag: 'SPEED', max: 3,
    desc: () => '+10% run speed and +10% coin value.'
  },
  {
    id: 'magnet', name: 'Polarity', icon: 'magnet', color: '#b06bff', tag: 'UTILITY', max: 3,
    desc: () => 'Permanently pull coins from 5m farther away.'
  }
];

const TRACK_LIMIT = 7.0;
const MILESTONE = 300;
const SPAWN_AHEAD = 195;
const FIRST_BOSS = 700;
const BOSS_INTERVAL = 900;
const BOSS_NAMES = ['THE WARDEN', 'CINDER TITAN', 'VOIDMAW', 'APEX REAPER', 'OMEGA SOVEREIGN'];

const PLAN = [
  { t: 'gate', gap: 58 },
  { t: 'coins', gap: 24 },
  { t: 'hazard', gap: 30 },
  { t: 'gate', gap: 34 },
  { t: 'recruit', gap: 24 },
  { t: 'enemy', gap: 34 },
  { t: 'coins', gap: 22 },
  { t: 'gate', gap: 34 },
  { t: 'hazard', gap: 28 },
  { t: 'powerup', gap: 27 },
  { t: 'gate', gap: 34 },
  { t: 'enemy', gap: 31 },
  { t: 'coins', gap: 22 },
  { t: 'hazard', gap: 28 },
  { t: 'gate', gap: 34 },
  { t: 'recruit', gap: 24 },
  { t: 'gate', gap: 34 },
  { t: 'enemy', gap: 32 },
  { t: 'powerup', gap: 28 },
  { t: 'hazard', gap: 30 }
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

export class Game {
  constructor({ scene, camera, world, fx, shock, floaters, audio, ui, save, persist }) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.fx = fx;
    this.shock = shock;
    this.floaters = floaters;
    this.audio = audio;
    this.ui = ui;
    this.save = save;
    this.persist = persist;

    this.mode = 'menu';
    this.time = 0;
    this.shake = 0;
    this.hurtCooldown = 0;
    this.damageFlashCooldown = 0;
    this.input = { left: false, right: false, dragging: false };
    this.steerTarget = 0;
    this.entities = [];
    this.planIndex = 0;
    this.nextSpawnDistance = 50;
    this.hudTimer = 0;
    this.powerHudTimer = 0;
    this.run = null;
    this.battle = null;
    this.bossFight = null;
    this.perkChoices = null;
    this._camPos = new THREE.Vector3();
    this._look = new THREE.Vector3(0, 1.6, -18);
    this._desired = new THREE.Vector3();
    this._desiredLook = new THREE.Vector3();

    this.player = new Crowd(scene, { team: 'player', max: 340 });
    this.player.setCount(34);
    this.player.setPosition(0, 0);
    this.enemy = new EnemyMob(scene);
    this.boss = new Boss(scene);

    this.menuGate = new Gate(scene, -260, {
      left: { kind: 'mul', value: 2, positive: true },
      right: { kind: 'add', value: 20, positive: true }
    });
    this.menuGate.z = -260;
    this.menuGate.group.position.z = -260;

    this.camera.position.set(0, 8.6, 16.6);
    this.camera.lookAt(0, 1.8, -20);
    this.updateHUD(true);
  }

  /* ------------------------------------------------------------ */
  /* state transitions                                             */
  /* ------------------------------------------------------------ */
  get upgradeLevel() {
    const u = this.save.upgrades;
    return { ...u };
  }

  startRun() {
    this.clearEntities();
    this.enemy.despawn();
    this.boss.despawn();
    this.bossFight = null;
    this.ui.hideBattle();
    this.ui.hideBoss();
    this.ui.hideBossWarning();
    this.menuGate.group.visible = false;

    const up = this.save.upgrades;
    const start = 10 + up.squad * 4;
    this.run = {
      count: start,
      peak: start,
      distance: 0,
      speed: 16,
      coins: 0,
      kills: 0,
      bosses: 0,
      creditedCoins: 0,
      creditedKills: 0,
      creditedBosses: 0,
      powers: { shield: 0, frenzy: 0, magnet: 0 },
      perks: {},
      battle: null,
      bossFight: null,
      nextMilestone: MILESTONE,
      nextBoss: FIRST_BOSS,
      reviveUsed: false,
      counted: false,
      elapsed: 0,
      lastCoinSfx: 0,
      newBest: false,
      lastEarned: 0
    };
    this.battle = null;
    this.planIndex = 0;
    this.nextSpawnDistance = 52;    this.steerTarget = 0;
    this.hurtCooldown = 0;
    this.mode = 'running';
    this.player.x = 0;
    this.player.z = 0;
    this.player.setCount(start);
    this.player.setVisible(true);
    this.player.clearAura();
    this.player.setPosition(0, 0);

    this.scheduleSpawns();
    this.ui.startRun(start);
    this.updateHUD(true);
    this.audio.unlock();
    this.audio.click();
    this.ui.toast('GROW THE MOB', 'good');
  }

  restartRun() {
    if (this.run && !this.run.counted) this.settleRun();
    this.startRun();
  }

  goHome() {
    if (this.run && (this.mode === 'running' || this.mode === 'paused' || this.mode === 'perk')) {
      this.settleRun();
    } else if (this.run && this.mode === 'over') {
      this.settleRun();
    }
    this.clearEntities();
    this.enemy.despawn();
    this.boss.despawn();
    this.bossFight = null;
    this.mode = 'menu';
    this.run = null;
    this.battle = null;
    this.ui.hideBoss();
    this.ui.hideBossWarning();
    this.menuGate.group.visible = true;
    this.menuGate.z = -260;
    this.menuGate.group.position.z = -260;
    this.menuGate.passed = false;
    this.menuGate.passAnim = 0;
    this.menuGate.group.visible = true;
    this.menuGate.group.position.y = 0;
    for (const key of ['left', 'right']) this.menuGate.panels[key].mesh.visible = true;
    this.menuGate.chev.visible = true;
    this.player.setPosition(0, 0);
    this.player.setCount(34 + this.save.upgrades.squad * 2);
    this.player.setVisible(true);
    this.player.clearAura();
    this.ui.showStart();
    this.ui.hidePause();
    this.ui.hidePerks();
    this.ui.hideGameOver();
    this.ui.hideHUD();
    this.ui.hideBattle();
  }

  pause() {
    if (this.mode !== 'running') return;
    this.mode = 'paused';
    this.ui.hideSteerHint();
    this.ui.showPause({ distance: this.run.distance, count: this.run.count });
    this.audio.click();
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'running';
    this.ui.hidePause();
    this.audio.click();
  }

  togglePause() {
    if (this.mode === 'running') this.pause();
    else if (this.mode === 'paused') this.resume();
  }

  /* ------------------------------------------------------------ */
  /* input                                                         */
  /* ------------------------------------------------------------ */
  dragTo(startTarget, deltaPx, width) {
    this.steerTarget = clamp(startTarget + (deltaPx / Math.max(240, width)) * 18, -TRACK_LIMIT, TRACK_LIMIT);
  }

  steerToPointer(px, rect) {
    const norm = ((px - rect.left) / rect.width) * 2 - 1;
    this.steerTarget = clamp(norm * 1.16, -1, 1) * TRACK_LIMIT;
  }

  nudge(dir, dt) {
    this.steerTarget = clamp(this.steerTarget + dir * 13 * dt, -TRACK_LIMIT, TRACK_LIMIT);
  }

  /* ------------------------------------------------------------ */
  /* main update                                                   */
  /* ------------------------------------------------------------ */
  update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);

    if (this.mode === 'menu') {
      this.updateMenu(dt);
    } else if (this.mode === 'running') {
      this.updateRunning(dt);
    } else if (this.mode === 'paused' || this.mode === 'perk') {
      this.player.update(dt * 0.35, this.time, 0);
      this.world.update(dt * 0.15, this.run ? this.run.distance : 0, 0, this.time, this.camera);
      this.updateCamera(dt);
    } else if (this.mode === 'over') {
      this.player.update(dt * 0.3, this.time, 0);
      this.world.update(dt * 0.3, this.run ? this.run.distance : 0, 1.5, this.time, this.camera);
      this.updateCamera(dt);
    }

    this.fx.update(dt);
    this.shock.update(dt);
    this.floaters.update(dt);
  }

  updateMenu(dt) {
    const scroll = 6;
    this.player.x = Math.sin(this.time * 0.42) * 1.1;
    this.player.setPosition(this.player.x, 0);
    this.player.update(dt, this.time, scroll);
    this.player.clearAura();
    this.world.update(dt, this.time * scroll, scroll, this.time, this.camera);

    this.menuGate.z += scroll * dt;
    if (this.menuGate.z > 24) {
      this.menuGate.z = -260;
      this.menuGate.passed = false;
      this.menuGate.passAnim = 0;
      this.menuGate.group.visible = true;
      this.menuGate.group.position.y = 0;
      for (const key of ['left', 'right']) this.menuGate.panels[key].mesh.visible = true;
      this.menuGate.chev.visible = true;
    }
    this.menuGate.group.position.z = this.menuGate.z;
    this.menuGate.update(dt, this.time);

    this._desired.set(Math.sin(this.time * 0.24) * 0.9, 8.5 + Math.sin(this.time * 0.6) * 0.12, 16.8);
    this.camera.position.lerp(this._desired, 1 - Math.exp(-dt * 2.4));
    this._desiredLook.set(Math.sin(this.time * 0.3) * 0.7, 1.9, -22);
    this._look.lerp(this._desiredLook, 1 - Math.exp(-dt * 2));
    this.camera.lookAt(this._look);
    if (Math.abs(this.camera.fov - 56) > 0.1) {
      this.camera.fov += (56 - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }

  get perk() {
    return (id) => {
      const run = this.run;
      if (!run) return 0;
      return run.perks[id] || 0;
    };
  }

  currentSpeed() {
    if (!this.run) return 6;
    let s = 16 + Math.min(12, this.run.distance / 165);
    if (this.run.powers.frenzy > 0) s *= 1.17;
    s *= 1 + this.perk('fleet') * 0.1;
    return s;
  }

  coinMultiplier() {
    if (!this.run) return 1;
    return (1 + this.save.upgrades.bounty * 0.1)
      * (1 + this.perk('midas') * 0.3)
      * (1 + this.perk('fleet') * 0.1);
  }

  magnetRadius() {
    if (!this.run) return 0;
    const base = this.perk('magnet') * 2;
    return this.run.powers.magnet > 0 ? 17 + this.save.upgrades.magnet * 1.1 + base : base;
  }

  pickupRadius() {
    if (!this.run) return 2;
    return 1.7 + this.save.upgrades.magnet * 0.55 + (this.run.powers.magnet > 0 ? 2.2 : 0);
  }

  updateRunning(dt) {
    const run = this.run;
    if (!run) return;
    run.elapsed += dt;

    if (this.input.left) this.nudge(-1, dt);
    if (this.input.right) this.nudge(1, dt);
    this.steerTarget = clamp(this.steerTarget, -TRACK_LIMIT, TRACK_LIMIT);
    const dx = this.steerTarget - this.player.x;
    const maxStep = 13 * dt;
    this.player.x += clamp(dx, -maxStep, maxStep);
    this.player.x = clamp(this.player.x, -TRACK_LIMIT, TRACK_LIMIT);

    // power timers
    for (const k of ['shield', 'frenzy', 'magnet']) {
      if (run.powers[k] > 0) run.powers[k] = Math.max(0, run.powers[k] - dt);
    }
    this.updateAura();

    const inBattle = !!run.battle || !!run.bossFight;
    const scroll = this.currentSpeed() * (inBattle ? 0.07 : 1);
    run.speed = this.currentSpeed();
    run.distance += scroll * dt;
    this.player.setPosition(this.player.x, 0);
    this.player.update(dt, this.time, scroll);

    // powerups
    this.hudTimer -= dt;
    this.powerHudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      this.updateHUD();
    }
    if (this.powerHudTimer <= 0) {
      this.powerHudTimer = 0.1;
      this.updatePowerHUD();
    }

    this.scheduleSpawns();

    // entities
    for (const ent of this.entities) {
      if (ent.removed) continue;
      ent.z += scroll * dt;
      ent.group.position.z = ent.z;
      if (ent.kind === 'coin' || ent.kind === 'recruit' || ent.kind === 'powerup') {
        ent.group.position.x = ent.x;
      }
      ent.update(dt, this.time);

      if (!inBattle) this.handleCollision(ent, dt);
      if (this.mode !== 'running') return;

      if (ent.z > 28) this.removeEntity(ent);
    }

    this.entities = this.entities.filter((e) => !e.removed);

    // enemy & battle
    if (run.battle) {
      this.updateBattle(dt);
      if (this.mode !== 'running') return;
    } else if (this.enemy.active) {
      this.enemy.z += (scroll + 3.4) * dt;
      this.enemy.x += clamp(this.player.x * 0.9 - this.enemy.x, -2.8 * dt, 2.8 * dt);
      this.enemy.update(dt, this.time, scroll);
      if (this.enemy.z >= -8.2) this.startBattle();
    }

    // boss encounter
    if (!run.battle && !run.bossFight && !this.boss.active && !this.enemy.active
      && run.distance >= run.nextBoss - 130) {
      this.spawnBoss();
    }
    if (run.bossFight) {
      this.updateBossFight(dt);
      if (this.mode !== 'running') return;
    } else if (this.boss.active) {
      this.boss.update(dt, this.time, run.speed * 0.7);
      if (this.boss.z >= -10.6) this.startBossFight();
      if (this.mode !== 'running') return;
    }

    // milestone perks
    if (!run.battle && !run.bossFight && !this.boss.active && this.mode === 'running'
      && run.distance >= run.nextMilestone) {
      this.offerPerk();
      return;
    }

    this.updateCamera(dt);
  }

  updateAura() {
    const p = this.run.powers;
    if (p.shield > 0) {
      this.player.setAura(0x3ef6ff, Math.min(1, p.shield / 2));
    } else if (p.frenzy > 0) {
      this.player.setAura(0xff8a3d, Math.min(1, p.frenzy / 2));
    } else if (p.magnet > 0) {
      this.player.setAura(0xb06bff, Math.min(1, p.magnet / 2));
    } else {
      this.player.clearAura();
    }
  }

  updateCamera(dt) {
    const run = this.run;
    const inBattle = !!run?.battle;
    const inBoss = !!run?.bossFight;
    const speed = this.currentSpeed();
    const shake = this.shake;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    const sz = (Math.random() - 0.5) * shake;
    const px = this.player.x;
    const fovTarget = clamp(55 + (speed - 16) * 0.55 + (run?.powers.frenzy > 0 ? 3 : 0) + (inBattle ? -2 : 0) + (inBoss ? 4 : 0), 54, 68);

    const camZ = inBoss ? 19.4 : inBattle ? 12.4 : 16.6;
    const camY = (inBoss ? 9.2 : inBattle ? 7.1 : 8.6) + Math.sin(this.time * 1.4) * 0.07;
    this._desired.set(px * 0.2 + sx, camY + sy, camZ + sz);
    this.camera.position.lerp(this._desired, 1 - Math.exp(-dt * 4.6));
    this._desiredLook.set(px * 0.38, inBoss ? 3.5 : inBattle ? 1.3 : 1.7, inBoss ? -10.5 : inBattle ? -8 : -19);
    this._look.lerp(this._desiredLook, 1 - Math.exp(-dt * 4.2));
    this.camera.lookAt(this._look);

    if (Math.abs(this.camera.fov - fovTarget) > 0.02) {
      this.camera.fov += (fovTarget - this.camera.fov) * Math.min(1, dt * 3.5);
      this.camera.updateProjectionMatrix();
    }
  }

  /* ------------------------------------------------------------ */
  /* spawner                                                       */
  /* ------------------------------------------------------------ */
  scheduleSpawns() {
    const run = this.run;
    if (!run) return;
    if (this.boss.active || run.bossFight) return;
    let guard = 0;
    while (this.nextSpawnDistance < run.distance + SPAWN_AHEAD && guard++ < 20) {
      const plan = PLAN[this.planIndex % PLAN.length];
      const at = this.nextSpawnDistance;
      this.spawnEvent(plan.t, at);
      const speedFactor = run.speed / 16;
      const difficulty = 1 - Math.min(0.16, run.distance / 9000);
      const gap = plan.gap * speedFactor * difficulty * rand(0.92, 1.08);
      this.nextSpawnDistance += gap;
      this.planIndex++;
    }
  }

  spawnEvent(type, atDistance) {
    const run = this.run;
    const z = -(atDistance - run.distance);
    if (type === 'gate') {
      const ops = gateOps(run.distance, this.perk('lucky'), run.count, run.distance < 170);
      this.entities.push(new Gate(this.scene, z, ops));
    } else if (type === 'coins') {
      const phase = Math.random() * 6;
      const baseX = rand(-2.6, 2.6);
      for (let i = 0; i < 6; i++) {
        const x = clamp(baseX + Math.sin(phase + i * 0.8) * 2.1, -6.3, 6.3);
        this.entities.push(createCoin(this.scene, x, z - i * 2.3, 1));
      }
    } else if (type === 'recruit') {
      const x = rand(-4.8, 4.8);
      const amount = Math.max(6, Math.round(run.count * 0.13 + run.distance * 0.012));
      this.entities.push(createRecruit(this.scene, x, z, amount));
    } else if (type === 'powerup') {
      const roll = Math.random();
      const kind = roll < 0.4 ? 'shield' : roll < 0.72 ? 'frenzy' : 'magnet';
      this.entities.push(createPowerup(this.scene, rand(-4.5, 4.5), z, kind));
    } else if (type === 'hazard') {
      if (run.distance > 850 && Math.random() < 0.28) {
        const lane = rand(-4.5, 4.5);
        this.entities.push(createSaw(this.scene, z, { lane, sweep: rand(1.6, 2.8), phase: Math.random() * 6 }));
        this.entities.push(createLaser(this.scene, z - 16, Math.random() < 0.5 ? -1 : 1));
      } else if (Math.random() < 0.58) {
        const lane = rand(-3.4, 3.4);
        this.entities.push(createSaw(this.scene, z, { lane, sweep: rand(1.4, 3.0), phase: Math.random() * 6 }));
      } else {
        this.entities.push(createLaser(this.scene, z, Math.random() < 0.5 ? -1 : 1));
      }
    } else if (type === 'enemy') {
      if (this.enemy.active) return;
      const strength = rand(0.44, 0.74) * (1 + Math.min(0.2, run.distance / 8000));
      const count = Math.max(8, Math.round(run.count * strength));
      const x = rand(-2.8, 2.8);
      this.enemy.spawn(x, z, count);
      this.enemy.z = z;
    }
  }

  /* ------------------------------------------------------------ */
  /* collisions                                                    */
  /* ------------------------------------------------------------ */
  handleCollision(ent, dt) {
    const run = this.run;
    if (ent.removed) return;
    if (ent.kind === 'gate') {
      if (!ent.passed && ent.z >= 0) this.passGate(ent);
      return;
    }
    if (ent.kind === 'coin') {
      if (ent.data.collected) return;
      const magnet = this.magnetRadius();
      if (magnet > 0 && ent.z > -magnet && ent.z < 4) {
        ent.x += (this.player.x - ent.x) * Math.min(1, dt * 10);
        ent.z += (0 - ent.z) * Math.min(1, dt * 7);
        ent.group.position.x = ent.x;
        ent.group.position.z = ent.z;
      }
      if (ent.z > -1.6 && ent.z < 2.2 && Math.abs(ent.x - this.player.x) < this.pickupRadius() + 0.5) {
        this.collectCoin(ent);
      }
      return;
    }
    if (ent.kind === 'recruit' || ent.kind === 'powerup') {
      if (ent.data.collected) return;
      if (ent.z > -1.6 && ent.z < 2.2 && Math.abs(ent.x - this.player.x) < this.pickupRadius() + 0.9) {
        if (ent.kind === 'recruit') this.collectRecruit(ent);
        else this.collectPowerup(ent);
      }
      return;
    }
    if (ent.kind === 'saw') {
      if (this.hurtCooldown > 0 || ent.data.cooldown > 0) return;
      const reach = ent.radius + this.player.radius * 0.55;
      if (ent.z > -1.8 && ent.z < 1.8 && Math.abs(ent.x - this.player.x) < reach) {
        ent.data.cooldown = 0.9;
        this.damagePlayer(Math.max(3, Math.floor(run.count * 0.17)), ent.group.position, 'saw');
        this.steerTarget = clamp(this.player.x + (this.player.x >= ent.x ? 1.6 : -1.6), -TRACK_LIMIT, TRACK_LIMIT);
      }
      return;
    }
    if (ent.kind === 'laser') {
      if (this.hurtCooldown > 0 || ent.data.cooldown > 0) return;
      const half = this.player.radius * 0.55;
      const overlap = this.player.x + half > ent.data.xMin && this.player.x - half < ent.data.xMax;
      if (ent.z > -1.7 && ent.z < 1.7 && overlap) {
        ent.data.cooldown = 0.24;
        this.damagePlayer(Math.max(1, Math.floor(run.count * 0.05)), new THREE.Vector3(this.player.x, 1, 0), 'laser');
      }
    }
  }

  passGate(ent) {
    const run = this.run;
    const panel = ent.panelAt(this.player.x);
    const before = run.count;
    let after = applyOp(before, panel.op);
    if (after < 0) after = 0;
    if (!panel.op.positive && after <= 0) after = 1;
    after = Math.min(99999, after);

    ent.markPassed();
    const worldX = this.player.x < 0 ? -4.7 : 4.7;
    const positive = panel.op.positive;
    const color = positive ? 0xa7ff4f : 0xff4d7a;
    this.shock.ring(worldX, 2.3, 1.2, color, { scale: 2.5, life: 0.7, growth: 15 });
    this.fx.burst(worldX, 2.4, 1.0, color, 28, { speed: 7, spread: 1.4, life: 0.9, gravity: -9 });
    this.floaters.float(opLabel(panel.op), worldX, 3.6, 1.6, positive ? '#d8ff9b' : '#ffb3c5', {
      scale: 3.4, life: 1.2, rise: 2.6, glow: positive ? 'rgba(167,255,79,.9)' : 'rgba(255,77,122,.9)'
    });
    this.audio.gate(positive, panel.op.kind === 'mul' && panel.op.value >= 3);
    if (positive) {
      this.addShake(0.12);
      this.ui.flash('good');
    } else {
      this.addShake(0.34);
      this.ui.flash('hit');
    }

    this.setCount(after, { pop: true });

    if (this.mode === 'running' && this.perk('aegis') > 0) {
      this.activatePower('shield', 4 * this.perk('aegis'), true);
    }
  }

  collectCoin(ent) {
    if (ent.data.collected) return;
    ent.data.collected = true;
    const value = Math.max(1, Math.round(ent.value * this.coinMultiplier()));
    this.run.coins += value;
    this.fx.burst(ent.x, 1.15, ent.z, 0xffc857, 6, { speed: 2.4, spread: 1, life: 0.55, gravity: -5 });
    this.shock.ring(ent.x, 1.15, ent.z, 0xffc857, { scale: 0.6, life: 0.32, growth: 3 });
    if (this.time - this.run.lastCoinSfx > 0.045) {
      this.run.lastCoinSfx = this.time;
      this.audio.coin();
    }
    this.removeEntity(ent);
  }

  collectRecruit(ent) {
    if (ent.data.collected) return;
    ent.data.collected = true;
    const amount = ent.data.amount;
    this.setCount(this.run.count + amount, { pop: true });
    this.floaters.float(`+${amount}`, ent.x, 2.8, ent.z, '#d8ff9b', {
      scale: 2.5, life: 1, rise: 2, glow: 'rgba(167,255,79,.9)'
    });
    this.fx.burst(ent.x, 1.3, ent.z, 0xa7ff4f, 22, { speed: 5, spread: 1.2, life: 0.8, gravity: -6 });
    this.shock.ring(ent.x, 1.2, ent.z, 0xa7ff4f, { scale: 1, life: 0.5, growth: 6 });
    this.audio.recruit();
    this.addShake(0.1);
    this.ui.flash('good');
    this.removeEntity(ent);
  }

  collectPowerup(ent) {
    if (ent.data.collected) return;
    ent.data.collected = true;
    const type = ent.data.type;
    this.activatePower(type);
    this.fx.burst(ent.x, 1.5, ent.z, type === 'shield' ? 0x3ef6ff : type === 'frenzy' ? 0xff8a3d : 0xb06bff, 26, {
      speed: 6, spread: 1.3, life: 0.9, gravity: -4
    });
    this.shock.ring(ent.x, 1.5, ent.z, type === 'shield' ? 0x3ef6ff : type === 'frenzy' ? 0xff8a3d : 0xb06bff, {
      scale: 1, life: 0.6, growth: 8
    });
    this.removeEntity(ent);
  }

  activatePower(type, override = null, silent = false) {
    const run = this.run;
    if (!run) return;
    const base = type === 'magnet' ? 7.5 : 6;
    let duration = override ?? (base + this.save.upgrades.power * 0.8);
    if (type === 'frenzy') duration += this.perk('berserk') * 2;
    run.powers[type] = Math.max(run.powers[type], duration);
    if (!silent) {
      this.floaters.float(type === 'shield' ? 'SHIELD' : type === 'frenzy' ? 'FRENZY' : 'MAGNET',
        this.player.x, 3.4, 1, type === 'shield' ? '#9ffbff' : type === 'frenzy' ? '#ffc49a' : '#dcc1ff', {
          scale: 3, life: 1.1, rise: 2, glow: 'rgba(255,255,255,.7)'
        });
      this.ui.toast(type === 'shield' ? 'SHIELD UP' : type === 'frenzy' ? 'FRENZY! DOUBLE DAMAGE' : 'COIN MAGNET UP',
        type === 'frenzy' ? 'bad' : 'good');
      if (type === 'shield') this.audio.shield();
      else this.audio.powerup();
      this.shock.ring(this.player.x, 1, 0.5, type === 'shield' ? 0x3ef6ff : type === 'frenzy' ? 0xff8a3d : 0xb06bff, {
        scale: 1.2, life: 0.7, growth: 8
      });
    }
    this.updatePowerHUD();
  }

  damagePlayer(amount, position, source = 'hit') {
    if (this.mode !== 'running') return;
    if (!this.run) return;
    if (this.run.powers.shield > 0) {
      this.shock.ring(this.player.x, 1.2, 0.5, 0x3ef6ff, { scale: 1, life: 0.45, growth: 7 });
      this.fx.burst(this.player.x, 1.2, 0.5, 0x3ef6ff, 10, { speed: 4, life: 0.5, gravity: -1 });
      this.hurtCooldown = 0.2;
      this.addShake(0.12);
      return;
    }
    if (this.hurtCooldown > 0) return;
    this.hurtCooldown = 0.22;
    const dmg = Math.max(1, Math.floor(amount));
    this.setCount(this.run.count - dmg, { pop: true });
    this.addShake(source === 'laser' ? 0.2 : 0.42);
    this.ui.flash('hit');
    this.audio.hit();
    const p = position || this.player.randomUnitPosition();
    this.fx.burst(p.x, p.y || 1.1, p.z || 0, 0xff4d6a, 18, { speed: 5, spread: 1.2, life: 0.7, gravity: -8 });
    this.shock.ring(this.player.x, 1.1, 0.5, 0xff4d6a, { scale: 0.8, life: 0.4, growth: 5 });
  }

  /* ------------------------------------------------------------ */
  /* battle                                                        */
  /* ------------------------------------------------------------ */
  startBattle() {
    const run = this.run;
    if (!run || run.battle) return;
    const e = this.enemy;
    e.z = -8;
    e.x = clamp(e.x, -4, 4);
    const strengthMul = 1 + this.save.upgrades.strength * 0.09;
    const frenzyMul = run.powers.frenzy > 0 ? (1.5 + this.perk('berserk') * 0.25) : 1;
    const warlord = 1 + this.perk('warlord') * 0.3;
    const playerDps = Math.max(8, run.count * 0.42) * strengthMul * frenzyMul * warlord;
    const enemyDps = Math.max(6, e.count * 0.34) * (1 + run.distance / 14000);
    run.battle = {
      startEnemy: e.count,
      elapsed: 0,
      playerDps,
      enemyDps,
      playerLoss: 0,
      enemyLoss: 0,
      spark: 0,
      startCount: run.count
    };
    this.battle = run.battle;
    this.ui.showBattle({ player: run.count, enemy: e.count });
    this.ui.hideSteerHint();
    this.audio.clash();
    this.addShake(0.5);
    this.fx.burst(this.player.x, 1.2, -4, 0xffd27d, 24, { speed: 6, spread: 1.4, life: 0.7, gravity: -8 });
    this.shock.ring(0, 1.4, -4, 0xff4d7a, { scale: 1.5, life: 0.7, growth: 10 });
  }

  updateBattle(dt) {
    const run = this.run;
    const b = run.battle;
    const e = this.enemy;
    if (!b) return;
    b.elapsed += dt;
    b.spark -= dt;
    if (b.spark <= 0) {
      b.spark = 0.11;
      const px = this.player.x;
      const ex = e.x;
      const mx = (px + ex) / 2 + rand(-0.7, 0.7);
      this.fx.burst(mx, rand(0.8, 2), -4 + rand(-1.4, 1.4), Math.random() < 0.5 ? 0x3ef6ff : 0xff4d6a, 3, {
        speed: 3.4, spread: 1.4, life: 0.4, gravity: -7
      });
      if (Math.random() < 0.5) this.audio.clash();
      this.addShake(0.05);
    }

    e.x += clamp(this.player.x - e.x, -3.2 * dt, 3.2 * dt);
    e.z = -8 + Math.sin(this.time * 2) * 0.1;
    e.update(dt, this.time, 4);

    const shielded = run.powers.shield > 0;
    b.playerLoss += (shielded ? 0 : b.enemyDps) * dt;
    b.enemyLoss += b.playerDps * dt;

    let changed = false;
    if (b.playerLoss >= 1) {
      const loss = Math.floor(b.playerLoss);
      b.playerLoss -= loss;
      this.setCount(run.count - loss);
      changed = true;
      if (this.mode !== 'running') return;
    }
    if (b.enemyLoss >= 1) {
      const loss = Math.floor(b.enemyLoss);
      b.enemyLoss -= loss;
      e.setCount(Math.max(0, e.count - loss));
      changed = true;
    }
    if (changed) this.ui.updateBattle({ player: run.count, enemy: e.count });
    if (shielded) this.shock.ring(this.player.x, 1.1, 0.2, 0x3ef6ff, { scale: 1.1, life: 0.4, growth: 5 });

    if (e.count <= 0) {
      this.winBattle();
    } else if (run.count <= 0) {
      this.die();
    }
  }

  winBattle() {
    const run = this.run;
    const b = run.battle;
    if (!b) return;
    const startEnemy = b.startEnemy;
    const reward = Math.max(8, Math.round(startEnemy * 0.55 * this.coinMultiplier()));
    const rescued = Math.max(1, Math.round(startEnemy * 0.07));
    run.coins += reward;
    run.kills += 1;

    const ex = this.enemy.x;
    this.fx.burst(ex, 1.4, -7, 0xff4d6a, 44, { speed: 8, spread: 1.4, life: 1.1, gravity: -9 });
    this.fx.burst(ex, 1.4, -7, 0xffc857, 18, { speed: 5, spread: 1.2, life: 1, gravity: -6 });
    this.shock.ring(ex, 1.4, -7, 0xffc857, { scale: 2, life: 0.8, growth: 14 });
    this.floaters.float(`+${reward}`, 0, 3.4, -3, '#ffd35f', { scale: 2.2, life: 1.2, rise: 2.5, glow: 'rgba(255,211,95,.9)' });
    this.floaters.float(`+${rescued} MOB`, this.player.x, 4.2, 1.5, '#9ffbff', { scale: 1.55, life: 1.1, rise: 1.6, glow: 'rgba(62,246,255,.9)' });
    this.enemy.despawn();
    run.battle = null;
    this.battle = null;
    this.setCount(run.count + rescued, { pop: true });
    this.ui.hideBattle();
    this.ui.toast(`MOB CRUSHED  +${reward} COINS`, 'gold');
    this.audio.win();
    this.addShake(0.6);
    this.ui.flash('good');
    this.scheduleSpawns();
  }

  /* ------------------------------------------------------------ */
  /* bosses                                                        */
  /* ------------------------------------------------------------ */
  spawnBoss() {
    const run = this.run;
    if (!run || this.boss.active || run.battle) return;
    const tier = run.bosses;
    const cycle = Math.floor(tier / BOSS_NAMES.length);
    const name = BOSS_NAMES[tier % BOSS_NAMES.length] + (cycle > 0 ? ` MK ${cycle + 1}` : '');
    const maxHp = Math.round((1050 + tier * 750) * (1 + Math.min(0.6, run.distance / 14000)));
    this.boss.spawn(0, -132, { tier, name, maxHp });
    this.boss.name = name;
    run.bossFight = null;
    this.bossFight = null;

    // clear the runway of gates and hazards so the arena reads cleanly
    for (const ent of this.entities) {
      if (ent.z < -24 && (ent.kind === 'gate' || ent.kind === 'saw' || ent.kind === 'laser')) {
        this.removeEntity(ent);
      }
    }
    this.entities = this.entities.filter((e) => !e.removed);
    this.nextSpawnDistance = Math.max(this.nextSpawnDistance, run.nextBoss + 40);

    this.ui.showBossWarning(name);
    this.ui.hideSteerHint();
    this.audio.bossWarn();
    this.addShake(0.3);
  }

  startBossFight() {
    const run = this.run;
    const e = this.boss;
    if (!run || !e.active || run.bossFight) return;
    e.z = -10.6;
    e.targetX = clamp(this.player.x * 0.35, -3, 3);
    e.setPhase(1);
    e.setHpFraction(1);

    const b = {
      name: e.name,
      tier: e.tier,
      maxHp: e.maxHp,
      hp: e.maxHp,
      phase: 1,
      elapsed: 0,
      attackTimer: 1.7,
      telegraph: null,
      spark: 0,
      hudTimer: 0,
      startCount: run.count
    };
    run.bossFight = b;
    this.bossFight = b;
    this.ui.showBoss({ name: e.name, phase: 1, hp: b.hp, maxHp: b.maxHp });
    this.ui.hideSteerHint();
    this.audio.clash();
    this.addShake(0.55);
    this.fx.burst(e.x, 3, e.z + 1, 0xff2f5a, 34, { speed: 7, spread: 1.5, life: 0.8, gravity: -6 });
    this.shock.ring(e.x, 1.4, e.z, 0xff2f5a, { scale: 2, life: 0.8, growth: 13 });
  }

  bossPlayerDps() {
    const run = this.run;
    if (!run) return 0;
    const frenzyMul = run.powers.frenzy > 0 ? (1.5 + this.perk('berserk') * 0.25) : 1;
    const warlord = 1 + this.perk('warlord') * 0.3;
    return Math.max(28, run.count * 1.05) * (1 + this.save.upgrades.strength * 0.1) * frenzyMul * warlord;
  }

  updateBossFight(dt) {
    const run = this.run;
    const b = run?.bossFight;
    const e = this.boss;
    if (!b || !e.active) return;
    b.elapsed += dt;

    // phase transitions
    const frac = b.hp / b.maxHp;
    const phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    if (phase > b.phase) {
      b.phase = phase;
      e.setPhase(phase);
      this.ui.toast(`PHASE ${phase} — ${e.name} ENRAGES`, 'bad', 1700);
      this.audio.bossWarn();
      this.addShake(0.6);
      this.ui.flash('hit');
      this.fx.burst(e.x, 3.2, e.z, phase === 2 ? 0xff9a3e : 0xff2f2f, 40, {
        speed: 9, spread: 1.6, life: 0.9, gravity: -4
      });
      this.shock.ring(e.x, 1.8, e.z, phase === 2 ? 0xff9a3e : 0xff2f2f, { scale: 2, life: 0.7, growth: 14 });
      b.attackTimer = Math.min(b.attackTimer, 0.9);
    }
    e.setHpFraction(frac);
    e.targetX = clamp(this.player.x * 0.35 + Math.sin(b.elapsed * 0.7) * 0.9, -3.4, 3.4);

    // player mob damage
    const dps = this.bossPlayerDps();
    b.hp = Math.max(0, b.hp - dps * dt);

    // boss telegraphed slam
    if (b.telegraph) {
      b.telegraph.t -= dt;
      if (b.telegraph.t <= 0) this.resolveBossSlam(b);
    } else {
      b.attackTimer -= dt;
      if (b.attackTimer <= 0) {
        b.telegraph = {
          x: clamp(this.player.x, -TRACK_LIMIT, TRACK_LIMIT),
          t: 0.92,
          radius: 2.35
        };
        e.attackAt(b.telegraph.x);
        this.audio.slice();
        this.addShake(0.12);
      }
    }

    // impact sparks between the mob and the titan
    b.spark -= dt;
    if (b.spark <= 0 && b.hp > 0) {
      b.spark = 0.1;
      const color = b.phase === 3 ? 0xff2f2f : b.phase === 2 ? 0xff9a3e : 0xff3e6c;
      this.fx.burst(e.x + rand(-1.4, 1.4), rand(2.0, 4.6), e.z + 0.7, color, 3, {
        speed: 4.5, spread: 1.2, life: 0.45, gravity: -3
      });
      e.hit();
      this.addShake(0.035);
    }

    e.update(dt, this.time, 2.4);

    b.hudTimer -= dt;
    if (b.hudTimer <= 0) {
      b.hudTimer = 0.08;
      this.ui.updateBoss({ phase: b.phase, hp: b.hp, maxHp: b.maxHp });
    }

    if (b.hp <= 0) {
      this.winBoss();
      return;
    }
    if (run.count <= 0) this.die();
  }

  resolveBossSlam(b) {
    const run = this.run;
    if (!run || !b.telegraph) return;
    const t = b.telegraph;
    b.telegraph = null;
    this.boss.endAttack();

    const hit = Math.abs(this.player.x - t.x) <= t.radius;
    this.fx.burst(t.x, 0.8, 0.35, 0xff2f4e, 26, { speed: 6.5, spread: 1.5, life: 0.7, gravity: -8 });
    this.shock.ring(t.x, 0.5, 0.4, 0xff2f4e, { scale: 1.2, life: 0.5, growth: 11 });
    this.shock.ring(t.x, 0.5, 0.4, 0xffc07a, { scale: 0.7, life: 0.35, growth: 7 });

    if (hit) {
      if (run.powers.shield > 0) {
        this.floaters.float('BLOCKED', this.player.x, 3.1, 0.7, '#9ffbff', {
          scale: 2, life: 0.9, rise: 1.6, glow: 'rgba(62,246,255,.9)'
        });
        this.audio.shield();
        this.addShake(0.24);
      } else {
        const dmg = Math.max(5, Math.round(run.count * (0.11 + b.tier * 0.012)));
        this.floaters.float(`-${dmg}`, this.player.x, 3.2, 0.7, '#ff9db0', {
          scale: 2.3, life: 0.9, rise: 1.8, glow: 'rgba(255,47,90,.9)'
        });
        this.damagePlayer(dmg, new THREE.Vector3(t.x, 1, 0.4), 'boss');
        this.addShake(0.6);
        this.audio.bossSlam();
      }
    } else {
      this.floaters.float('DODGE', this.player.x, 3.15, 0.7, '#9ffbff', {
        scale: 2.1, life: 0.8, rise: 1.8, glow: 'rgba(62,246,255,.9)'
      });
      this.audio.slice();
      this.shock.ring(this.player.x, 0.55, 0.3, 0x3ef6ff, { scale: 0.7, life: 0.35, growth: 5 });
    }

    if (this.mode !== 'running') return;
    b.attackTimer = Math.max(1.35, 2.9 - (b.phase - 1) * 0.48 - b.tier * 0.05);
  }

  winBoss() {
    const run = this.run;
    const b = run?.bossFight;
    const e = this.boss;
    if (!b) return;
    const reward = Math.max(60, Math.round((130 + b.tier * 110) * this.coinMultiplier()));
    const rescued = Math.max(8, Math.round(run.count * 0.1));
    const bx = e.x;
    const bz = e.z;

    run.bossFight = null;
    this.bossFight = null;
    run.coins += reward;
    run.kills += 1;
    run.bosses += 1;
    e.despawn();
    this.ui.hideBoss();

    this.fx.burst(bx, 3.2, bz, 0xff2f5a, 70, { speed: 10, spread: 1.7, life: 1.2, gravity: -7 });
    this.fx.burst(bx, 3.0, bz, 0xffc857, 36, { speed: 7, spread: 1.4, life: 1, gravity: -6 });
    this.shock.ring(bx, 1.5, bz, 0xffc857, { scale: 2.4, life: 0.9, growth: 18 });
    this.shock.ring(bx, 1.5, bz, 0xff2f5a, { scale: 3, life: 1.1, growth: 22 });
    this.floaters.float(`${b.name} DOWN`, bx, 5.4, bz, '#ffd3dc', {
      scale: 3.6, life: 1.6, rise: 1.8, glow: 'rgba(255,47,90,.9)'
    });
    this.floaters.float(`+${reward}`, bx, 3.6, bz + 0.6, '#ffd35f', {
      scale: 3, life: 1.3, rise: 2.2, glow: 'rgba(255,211,95,.9)'
    });
    this.floaters.float(`+${rescued} MOB`, this.player.x, 4.3, 1.5, '#9ffbff', {
      scale: 1.8, life: 1.2, rise: 1.6, glow: 'rgba(62,246,255,.9)'
    });

    this.setCount(run.count + rescued, { pop: true });
    this.ui.toast(`${b.name} DESTROYED  +${reward} COINS`, 'gold', 2400);
    this.audio.bossDown();
    this.audio.win();
    this.addShake(1.05);
    this.ui.flash('good');

    run.nextBoss += BOSS_INTERVAL;
    this.nextSpawnDistance = Math.max(this.nextSpawnDistance, run.distance + 75);
    this.scheduleSpawns();
  }

  /* ------------------------------------------------------------ */
  /* perks                                                         */
  /* ------------------------------------------------------------ */
  offerPerk() {
    if (this.mode !== 'running') return;
    this.mode = 'perk';
    const available = PERKS.filter((p) => (this.run.perks[p.id] || 0) < p.max);
    const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, 3);
    this.perkChoices = shuffled.map((p) => ({
      ...p,
      stacks: this.run.perks[p.id] || 0,
      desc: p.desc()
    }));
    this.ui.showPerks(this.perkChoices, (id) => this.choosePerk(id));
    this.ui.setSector(Math.floor(this.run.distance / MILESTONE) + 1);
    this.audio.perk();
    this.ui.hideSteerHint();
  }

  choosePerk(id) {
    if (this.mode !== 'perk' || !this.perkChoices) return;
    const perk = this.perkChoices.find((p) => p.id === id);
    if (!perk) return;
    const run = this.run;
    run.perks[id] = (run.perks[id] || 0) + 1;
    if (id === 'titan') {
      this.setCount(run.count + 40, { pop: true });
      this.floaters.float('+40', this.player.x, 3.2, 0.8, '#d8ff9b', { scale: 2.8, life: 1.2, rise: 2.4, glow: 'rgba(167,255,79,.9)' });
    }
    if (id === 'aegis') {
      this.activatePower('shield', 4, true);
    }
    run.nextMilestone += MILESTONE;
    this.perkChoices = null;
    this.mode = 'running';
    this.ui.hidePerks();
    this.ui.toast(`${perk.name.toUpperCase()} ACQUIRED`, 'good');
    this.audio.click();
    this.audio.perk();
    this.updateHUD(true);
  }

  /* ------------------------------------------------------------ */
  /* damage, death, revive                                         */
  /* ------------------------------------------------------------ */
  setCount(n, { pop = false } = {}) {
    if (!this.run) return;
    const prev = this.run.count;
    const next = clamp(Math.floor(n), 0, 99999);
    this.run.count = next;
    if (next > this.run.peak) this.run.peak = next;
    this.player.setCount(next);
    if (pop && next !== prev) {
      this.ui.popCount(next - prev);
      this.ui.pulseCount();
    }
    if (next <= 0 && this.mode === 'running') {
      this.die();
    }
  }

  die() {
    if (this.mode === 'over' || !this.run) return;
    const run = this.run;
    const bossActive = this.boss.active || !!run.bossFight;
    this.mode = 'over';
    run.battle = null;
    this.battle = null;
    run.bossFight = null;
    this.bossFight = null;
    this.enemy.despawn();
    this.boss.despawn();
    this.ui.hideBattle();
    this.ui.hideBoss();
    this.ui.hideBossWarning();
    this.ui.hideSteerHint();
    if (bossActive) {
      run.nextBoss = Math.max(run.nextBoss, Math.floor(run.distance) + 260);
    }
    this.player.clearAura();
    this.player.setVisible(false);
    this.fx.burst(this.player.x, 1.2, 0, 0x3ef6ff, 60, { speed: 9, spread: 1.4, life: 1.2, gravity: -9 });
    this.fx.burst(this.player.x, 1.2, 0, 0xff4d6a, 30, { speed: 7, spread: 1.4, life: 1, gravity: -8 });
    this.shock.ring(this.player.x, 1, 0, 0xff4d6a, { scale: 1.5, life: 0.9, growth: 18 });
    this.addShake(1);
    this.audio.fail();
    const settlement = this.settleRun();
    this.ui.flash('hit');
    this.ui.showGameOver({
      distance: Math.floor(run.distance),
      best: this.save.best,
      peak: run.peak,
      kills: run.kills,
      earned: settlement.earned,
      newBest: settlement.newBest,
      reviveCost: this.reviveCost(),
      canRevive: !run.reviveUsed && this.save.coins >= this.reviveCost(),
      reviveUsed: run.reviveUsed
    });
  }

  settleRun() {
    const run = this.run;
    if (!run) return { earned: 0, newBest: false };
    const bonus = Math.floor((run.distance / 10) * this.coinMultiplier());
    const total = run.coins + bonus;
    const earned = Math.max(0, total - run.creditedCoins);
    run.creditedCoins = total;
    this.save.coins += earned;
    const kills = run.kills - run.creditedKills;
    run.creditedKills = run.kills;
    this.save.kills += kills;
    const bosses = run.bosses - run.creditedBosses;
    run.creditedBosses = run.bosses;
    this.save.bosses = (this.save.bosses || 0) + bosses;
    const newBest = run.distance > this.save.best;
    if (newBest) this.save.best = Math.floor(run.distance);
    if (!run.counted) {
      this.save.runs += 1;
      run.counted = true;
    }
    run.lastEarned = earned;
    this.persist();
    this.ui.updateCoins();
    return { earned, newBest };
  }

  reviveCost() {
    if (!this.run) return 50;
    return Math.min(600, 40 + Math.floor(this.run.distance / 25) * 5);
  }

  revive() {
    const run = this.run;
    if (!run || this.mode !== 'over' || run.reviveUsed) return false;
    const cost = this.reviveCost();
    if (this.save.coins < cost) {
      this.ui.toast(`NEED ${cost} COINS`, 'bad');
      return false;
    }
    this.save.coins -= cost;
    run.reviveUsed = true;
    this.persist();
    this.ui.updateCoins();

    this.clearEntities();
    this.enemy.despawn();
    this.nextSpawnDistance = run.distance + 55;
    this.planIndex = 0;
    run.count = Math.max(12, Math.round(run.peak * 0.35));
    this.player.setCount(run.count);
    this.player.setVisible(true);
    this.player.x = 0;
    this.steerTarget = 0;
    this.player.setPosition(0, 0);
    this.activatePower('shield', 5, true);
    this.mode = 'running';
    this.ui.hideGameOver();
    this.ui.showHUD();
    this.ui.toast('SECOND WIND — GO!', 'good');
    this.audio.powerup();
    this.shock.ring(0, 1.2, 0, 0x3ef6ff, { scale: 1.5, life: 0.8, growth: 15 });
    this.fx.burst(0, 1.2, 0, 0x3ef6ff, 40, { speed: 8, life: 1, gravity: -5 });
    this.addShake(0.4);
    return true;
  }

  /* ------------------------------------------------------------ */
  /* helpers                                                       */
  /* ------------------------------------------------------------ */
  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  clearEntities() {
    for (const ent of this.entities) {
      if (ent.group) this.scene.remove(ent.group);
    }
    this.entities.length = 0;
    this.floaters.clear();
  }

  removeEntity(ent) {
    if (ent.removed) return;
    ent.removed = true;
    if (ent.group) this.scene.remove(ent.group);
  }

  updateHUD(force = false) {
    if (!this.run) return;
    const run = this.run;
    const remaining = Math.max(0, run.nextMilestone - run.distance);
    const progress = clamp(1 - remaining / MILESTONE, 0, 1);
    this.ui.updateHUD({
      count: run.count,
      distance: Math.floor(run.distance),
      sector: Math.floor(run.distance / MILESTONE) + 1,
      progress,
      hint: run.bossFight
        ? 'BOSS FIGHT — DODGE THE SLAM RINGS'
        : this.boss.active
          ? 'WARNING — TITAN APPROACHING'
          : `NEXT UPGRADE IN ${Math.ceil(remaining)} m`,
      coins: run.coins,
      speed: run.speed
    }, force);
  }

  updatePowerHUD() {
    const p = this.run?.powers;
    if (!p) return;
    const list = [];
    for (const type of ['shield', 'frenzy', 'magnet']) {
      if (p[type] > 0) {
        const base = type === 'magnet' ? 7.5 : 6;
        const max = base + this.save.upgrades.power * 0.8 + (type === 'frenzy' ? this.perk('berserk') * 2 : 0);
        list.push({ type, remaining: p[type], max: Math.max(max, p[type]) });
      }
    }
    this.ui.updatePowerups(list);
  }
}
