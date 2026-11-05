import { UPGRADE_DEFS, upgradeCost } from './save.js';

const SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICONS = {
  crowd: `${SVG_OPEN}<circle cx="9" cy="8" r="2.6"/><path d="M4.5 19c0-3 2-4.6 4.5-4.6s4.5 1.6 4.5 4.6"/><circle cx="17" cy="9" r="2"/><path d="M15.6 14.7c2.2-.4 3.9 1 3.9 3.5"/></svg>`,
  arrow: `${SVG_OPEN}<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></svg>`,
  upgrade: `${SVG_OPEN}<path d="M12 20V5"/><path d="m6 11 6-6 6 6"/><path d="M5 20h14"/></svg>`,
  help: `${SVG_OPEN}<circle cx="12" cy="12" r="9"/><path d="M9.3 9a2.8 2.8 0 1 1 4.2 2.5c-.9.5-1.5 1.1-1.5 2.2"/><circle cx="12" cy="17.2" r=".6" fill="currentColor" stroke="none"/></svg>`,
  sound: `${SVG_OPEN}<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>`,
  muted: `${SVG_OPEN}<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/></svg>`,
  pause: `${SVG_OPEN}<rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>`,
  heart: `${SVG_OPEN}<path d="M20.8 5.9a5.2 5.2 0 0 0-7.4 0L12 7.3l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 22l8.8-8.7a5.2 5.2 0 0 0 0-7.4Z"/></svg>`,
  coin: `${SVG_OPEN}<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.7 0-2.9.9-2.9 2.2 0 1.3 1.1 1.9 2.9 2.2 1.8.3 2.9.9 2.9 2.2 0 1.3-1.2 2.2-2.9 2.2-1.3 0-2.3-.4-2.8-1.2"/><path d="M12 6.5v11"/></svg>`,
  fist: `${SVG_OPEN}<path d="M7.5 11V6.7a1.5 1.5 0 0 1 3 0V10"/><path d="M10.5 10V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M13.5 10V6.2a1.5 1.5 0 0 1 3 0V12"/><path d="M16.5 12V9.4a1.5 1.5 0 0 1 3 0V14c0 3.3-2.6 6-6 6h-1.2a6 6 0 0 1-4.6-2.2L4 13.4a1.6 1.6 0 0 1 2.4-2.1L8.7 13"/></svg>`,
  magnet: `${SVG_OPEN}<path d="M6 4v7a6 6 0 0 0 12 0V4"/><path d="M6 4h4v7a2 2 0 0 0 4 0V4h4"/><path d="M6 8h4M14 8h4"/></svg>`,
  bolt: `${SVG_OPEN}<path d="M13 2 4.5 13H11l-1 9 8.5-11H12l1-9Z" fill="currentColor" stroke="none"/></svg>`,
  shield: `${SVG_OPEN}<path d="M12 2.5 4.5 5.6v6.1c0 4.6 3.1 8.3 7.5 9.8 4.4-1.5 7.5-5.2 7.5-9.8V5.6L12 2.5Z"/><path d="m9 12 2 2 4-4"/></svg>`,
  dice: `${SVG_OPEN}<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r=".8" fill="currentColor"/><circle cx="15.5" cy="15.5" r=".8" fill="currentColor"/><circle cx="12" cy="12" r=".8" fill="currentColor"/><circle cx="15.5" cy="8.5" r=".8" fill="currentColor"/><circle cx="8.5" cy="15.5" r=".8" fill="currentColor"/></svg>`,
  flame: `${SVG_OPEN}<path d="M12 22c4.2 0 7-2.8 7-6.7 0-3-1.5-5-4.2-7.6-.7 1.8-1.7 2.8-2.6 3.4.2-3.8-1.5-6.7-3.6-8.6.2 3.2-3.6 5.5-3.6 9.8C5 19.2 7.8 22 12 22Z"/><path d="M9.7 17.5c0-1.7 1-2.6 2.3-4.3.3 1.7 2.3 2.6 2.3 4.4a2.3 2.3 0 0 1-4.6-.1Z"/></svg>`,
  speed: `${SVG_OPEN}<path d="M3 12h5l2-5 4 10 2-5h5"/></svg>`
};

function svg(name) {
  return ICONS[name] || ICONS.bolt;
}

function fmt(n) {
  return Math.floor(n).toLocaleString('en-US');
}

export class UI {
  constructor() {
    this.handlers = {};
    this.save = null;
    this._lastHud = {};
    this._lastPowerKey = '';
    this._startHidden = false;
    this._hintTimer = 0;
    this._upgradeOpenFrom = 'start';
    this._bossWarnTimer = 0;
    this.el = {
      hud: document.getElementById('hud'),
      start: document.getElementById('screen-start'),
      over: document.getElementById('screen-over'),
      pause: document.getElementById('screen-pause'),
      perk: document.getElementById('screen-perk'),
      upgrades: document.getElementById('modal-upgrades'),
      howto: document.getElementById('modal-howto'),
      crowdCount: document.getElementById('crowd-count'),
      countPop: document.getElementById('count-pop'),
      crowdPill: document.querySelector('.crowd-pill'),
      coinCount: document.getElementById('coin-count'),
      distance: document.getElementById('distance'),
      sector: document.getElementById('sector'),
      progressFill: document.getElementById('progress-fill'),
      progressMarker: document.getElementById('progress-marker'),
      runHint: document.getElementById('run-hint'),
      powerBar: document.getElementById('powerup-bar'),
      battle: document.getElementById('battle-hud'),
      battleP: document.getElementById('battle-p'),
      battleE: document.getElementById('battle-e'),
      battlePlayer: document.getElementById('battle-player'),
      battleEnemy: document.getElementById('battle-enemy'),
      boss: document.getElementById('boss-hud'),
      bossName: document.getElementById('boss-name'),
      bossPhase: document.getElementById('boss-phase'),
      bossFill: document.getElementById('boss-fill'),
      bossHp: document.getElementById('boss-hp'),
      bossWarning: document.getElementById('boss-warning'),
      bossWarningName: document.getElementById('boss-warning-name'),
      steerHint: document.getElementById('steer-hint'),
      flash: document.getElementById('flash'),
      toast: document.getElementById('toast-layer'),
      startBest: document.getElementById('start-best'),
      startRuns: document.getElementById('start-runs'),
      startBosses: document.getElementById('start-bosses'),
      overDistance: document.getElementById('over-distance'),
      overBest: document.getElementById('over-best'),
      overPeak: document.getElementById('over-peak'),
      overKills: document.getElementById('over-kills'),
      overCoins: document.getElementById('over-coins'),
      overTitle: document.getElementById('over-title'),
      overEyebrow: document.getElementById('over-eyebrow'),
      newBest: document.getElementById('new-best'),
      revive: document.getElementById('btn-revive'),
      reviveCost: document.getElementById('revive-cost'),
      reviveNote: document.getElementById('revive-note'),
      pauseDistance: document.getElementById('pause-distance'),
      pauseMob: document.getElementById('pause-mob'),
      perkGrid: document.getElementById('perk-grid'),
      perkSector: document.getElementById('perk-sector'),
      upgradeList: document.getElementById('upgrade-list'),
      sound: document.getElementById('btn-sound')
    };
    this.injectIcons();
  }

  injectIcons() {
    for (const node of document.querySelectorAll('[data-icon]')) {
      node.innerHTML = svg(node.getAttribute('data-icon'));
    }
  }

  bind(handlers) {
    this.handlers = handlers;
    document.getElementById('btn-play').addEventListener('click', () => this.call('play'));
    document.getElementById('btn-upgrades-start').addEventListener('click', () => this.openUpgrades('start'));
    document.getElementById('btn-upgrades-over').addEventListener('click', () => this.openUpgrades('over'));
    document.getElementById('btn-howto').addEventListener('click', () => this.openHowto());
    document.getElementById('btn-howto-close').addEventListener('click', () => this.closeHowto());
    document.getElementById('btn-resume').addEventListener('click', () => this.call('resume'));
    document.getElementById('btn-restart-pause').addEventListener('click', () => this.call('restart'));
    document.getElementById('btn-home-pause').addEventListener('click', () => this.call('home'));
    document.getElementById('btn-again').addEventListener('click', () => this.call('restart'));
    document.getElementById('btn-home').addEventListener('click', () => this.call('home'));
    document.getElementById('btn-upgrades-close').addEventListener('click', () => this.closeUpgrades());
    document.getElementById('btn-revive').addEventListener('click', () => this.call('revive'));
    document.getElementById('btn-pause').addEventListener('click', () => this.call('pause'));
    document.getElementById('btn-sound').addEventListener('click', () => this.call('sound'));

    for (const btn of document.querySelectorAll('[data-close]')) {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-close');
        document.getElementById(id).classList.add('is-hidden');
      });
    }
    this.el.upgrades.addEventListener('click', (e) => {
      if (e.target === this.el.upgrades) this.closeUpgrades();
    });
    this.el.howto.addEventListener('click', (e) => {
      if (e.target === this.el.howto) this.closeHowto();
    });
    this.el.upgradeList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-buy]');
      if (!btn || btn.disabled) return;
      this.call('buyUpgrade', btn.getAttribute('data-buy'));
    });
    this.el.perkGrid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-perk]');
      if (!card) return;
      const id = card.getAttribute('data-perk');
      this.hidePerks();
      this.call('choosePerk', id);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.el.upgrades.classList.contains('is-hidden')) this.closeUpgrades();
        else if (!this.el.howto.classList.contains('is-hidden')) this.closeHowto();
      }
    });
  }

  call(name, arg) {
    const fn = this.handlers[name];
    if (typeof fn === 'function') fn(arg);
  }

  setSave(save) {
    this.save = save;
    this.updateCoins();
    this.updateStartStats();
  }

  updateCoins() {
    if (!this.save) return;
    for (const node of document.querySelectorAll('[data-coins]')) node.textContent = fmt(this.save.coins);
  }

  updateStartStats() {
    if (!this.save) return;
    this.el.startBest.textContent = fmt(this.save.best);
    this.el.startRuns.textContent = fmt(this.save.runs);
    this.el.startBosses.textContent = fmt(this.save.bosses || 0);
    this.updateCoins();
  }

  /* ----- screens ----- */
  hideAllOverlays() {
    this.el.over.classList.add('is-hidden');
    this.el.pause.classList.add('is-hidden');
    this.el.perk.classList.add('is-hidden');
    this.el.upgrades.classList.add('is-hidden');
    this.el.howto.classList.add('is-hidden');
  }

  showStart() {
    this.hideAllOverlays();
    this.el.start.classList.remove('is-hidden');
    this.el.hud.classList.add('is-hidden');
    this.el.hud.setAttribute('aria-hidden', 'true');
    this.updateStartStats();
  }

  hideStart() {
    this.el.start.classList.add('is-hidden');
  }

  startRun(startCount) {
    this.hideAllOverlays();
    this.hideStart();
    this.el.hud.classList.remove('is-hidden');
    this.el.hud.setAttribute('aria-hidden', 'false');
    this.el.battle.classList.add('is-hidden');
    this.el.boss.classList.add('is-hidden');
    this.el.bossWarning.classList.add('is-hidden');
    this.el.powerBar.innerHTML = '';
    this._lastPowerKey = '';
    this._lastHud = {};
    this.updateHUD({
      count: startCount, distance: 0, sector: 1, progress: 0,
      hint: 'NEXT UPGRADE IN 300 m', coins: 0, speed: 16
    }, true);
    this.showSteerHint();
  }

  showHUD() {
    this.el.hud.classList.remove('is-hidden');
    this.el.hud.setAttribute('aria-hidden', 'false');
  }

  hideHUD() {
    this.el.hud.classList.add('is-hidden');
    this.el.hud.setAttribute('aria-hidden', 'true');
  }

  showPause({ distance, count }) {
    this.el.pauseDistance.textContent = `${fmt(distance)} m`;
    this.el.pauseMob.textContent = fmt(count);
    this.el.pause.classList.remove('is-hidden');
    this.hideSteerHint();
  }

  hidePause() {
    this.el.pause.classList.add('is-hidden');
  }

  showGameOver(data) {
    this.el.overDistance.textContent = fmt(data.distance);
    this.el.overBest.textContent = fmt(data.best);
    this.el.overPeak.textContent = fmt(data.peak);
    this.el.overKills.textContent = fmt(data.kills);
    this.el.overCoins.textContent = fmt(data.earned);
    this.el.newBest.classList.toggle('is-hidden', !data.newBest);
    this.el.overTitle.textContent = data.distance >= 500 ? 'MASSACRE' : 'SQUAD WIPED';
    this.el.overEyebrow.textContent = data.newBest ? 'NEW RECORD' : 'RUN COMPLETE';
    this.el.reviveCost.textContent = fmt(data.reviveCost);
    if (data.reviveUsed) {
      this.el.revive.disabled = true;
      this.el.reviveNote.textContent = 'Second Wind already used this run.';
    } else if (!data.canRevive) {
      this.el.revive.disabled = true;
      this.el.reviveNote.textContent = `Need ${fmt(data.reviveCost)} coins. Keep running to earn more.`;
    } else {
      this.el.revive.disabled = false;
      this.el.reviveNote.textContent = 'Continue with 35% of your peak mob and a 5s shield.';
    }
    this.el.over.classList.remove('is-hidden');
    this.hideBattle();
    this.hideBoss();
    this.hideBossWarning();
    this.updateCoins();
  }

  hideGameOver() {
    this.el.over.classList.add('is-hidden');
  }

  showPerks(list, cb) {
    this._perkCallback = cb;
    this.el.perkGrid.innerHTML = '';
    for (const perk of list) {
      const card = document.createElement('button');
      card.className = 'perk-card';
      card.setAttribute('data-perk', perk.id);
      card.style.setProperty('--perk', perk.color);
      card.innerHTML = `
        <span class="perk-icon">${svg(perk.icon)}</span>
        <span class="perk-name">${perk.name}</span>
        <span class="perk-desc">${perk.desc}</span>
        <span class="perk-tag">${perk.stacks > 0 ? `LV ${perk.stacks} → ${perk.stacks + 1}` : perk.tag}</span>
      `;
      this.el.perkGrid.appendChild(card);
    }
    this.el.perkSector.textContent = Math.floor((this._sector || 1));
    this.el.perk.classList.remove('is-hidden');
    this.hideSteerHint();
  }

  hidePerks() {
    this.el.perk.classList.add('is-hidden');
  }

  setSector(n) { this._sector = n; }

  /* ----- HUD values ----- */
  updateHUD(data, force = false) {
    const last = this._lastHud;
    const countText = fmt(data.count);
    if (force || last.count !== data.count) {
      this.el.crowdCount.textContent = countText;
      last.count = data.count;
    }
    if (force || last.distance !== data.distance) {
      this.el.distance.textContent = fmt(data.distance);
      last.distance = data.distance;
    }
    if (force || last.sector !== data.sector) {
      this.el.sector.textContent = data.sector;
      last.sector = data.sector;
    }
    if (force || last.progress !== data.progress) {
      this.el.progressFill.style.width = `${(data.progress * 100).toFixed(2)}%`;
      last.progress = data.progress;
    }
    if (force || last.hint !== data.hint) {
      this.el.runHint.textContent = data.hint;
      last.hint = data.hint;
    }
    if (force || last.coins !== data.coins) {
      this.el.coinCount.textContent = fmt(data.coins);
      last.coins = data.coins;
    }
  }

  pulseCount() {
    this.el.crowdPill.classList.remove('flash');
    void this.el.crowdPill.offsetWidth;
    this.el.crowdPill.classList.add('flash');
  }

  popCount(diff) {
    if (!diff) return;
    const el = this.el.countPop;
    el.textContent = `${diff > 0 ? '+' : ''}${fmt(diff)}`;
    el.classList.toggle('bad', diff < 0);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  updatePowerups(list) {
    const key = list.map((p) => p.type).join('|');
    if (key !== this._lastPowerKey) {
      this.el.powerBar.innerHTML = '';
      this._powerNodes = {};
      for (const item of list) {
        const chip = document.createElement('div');
        chip.className = 'power-chip';
        const color = item.type === 'shield' ? '#3ef6ff' : item.type === 'frenzy' ? '#ff8a3d' : '#b06bff';
        chip.style.color = color;
        chip.innerHTML = `<span>${svg(item.type === 'shield' ? 'shield' : item.type === 'frenzy' ? 'flame' : 'magnet')}</span>
          <span class="chip-label">${item.type}</span>
          <span class="chip-track"><i></i></span>
          <span class="chip-time"></span>`;
        this.el.powerBar.appendChild(chip);
        this._powerNodes[item.type] = {
          time: chip.querySelector('.chip-time'),
          bar: chip.querySelector('.chip-track i')
        };
      }
      this._lastPowerKey = key;
    }
    for (const item of list) {
      const node = this._powerNodes?.[item.type];
      if (!node) continue;
      node.time.textContent = `${Math.ceil(item.remaining)}s`;
      node.bar.style.width = `${Math.max(0, Math.min(1, item.remaining / item.max)) * 100}%`;
    }
  }

  showBattle({ player, enemy }) {
    this.el.battle.classList.remove('is-hidden');
    this.updateBattle({ player, enemy });
  }

  updateBattle({ player, enemy }) {
    const total = Math.max(1, player + enemy);
    const pct = (player / total) * 100;
    this.el.battlePlayer.style.width = `${pct}%`;
    this.el.battleEnemy.style.width = `${100 - pct}%`;
    this.el.battleP.textContent = fmt(player);
    this.el.battleE.textContent = fmt(enemy);
  }

  hideBattle() {
    this.el.battle.classList.add('is-hidden');
  }

  /* ----- boss ----- */
  showBoss({ name, phase = 1, hp = 1, maxHp = 1 }) {
    this.el.bossName.textContent = name;
    this.el.boss.classList.remove('is-hidden');
    this.el.toast.classList.add('boss-mode');
    this.updateBoss({ phase, hp, maxHp });
  }

  updateBoss({ phase = 1, hp = 1, maxHp = 1 }) {
    const pct = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
    this.el.bossFill.style.width = `${(pct * 100).toFixed(1)}%`;
    this.el.bossHp.textContent = `${Math.ceil(pct * 100)}%`;
    this.el.bossPhase.textContent = `PHASE ${phase}`;
    this.el.boss.dataset.phase = String(phase);
  }

  hideBoss() {
    this.el.boss.classList.add('is-hidden');
    this.el.toast.classList.remove('boss-mode');
  }

  showBossWarning(name) {
    this.el.bossWarningName.textContent = name;
    this.el.bossWarning.classList.remove('is-hidden');
    void this.el.bossWarning.offsetWidth;
    clearTimeout(this._bossWarnTimer);
    this._bossWarnTimer = setTimeout(() => this.hideBossWarning(), 2450);
  }

  hideBossWarning() {
    clearTimeout(this._bossWarnTimer);
    this.el.bossWarning.classList.add('is-hidden');
  }

  showSteerHint() {
    this.el.steerHint.classList.remove('is-hidden');
    this.el.steerHint.style.opacity = '1';
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.hideSteerHint(), 7000);
  }

  hideSteerHint() {
    clearTimeout(this._hintTimer);
    this.el.steerHint.style.opacity = '0';
    setTimeout(() => {
      if (this.el.steerHint.style.opacity === '0') this.el.steerHint.classList.add('is-hidden');
    }, 500);
  }

  flash(kind) {
    const el = this.el.flash;
    el.classList.remove('hit', 'good');
    void el.offsetWidth;
    el.classList.add(kind === 'good' ? 'good' : 'hit');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => el.classList.remove('hit', 'good'), 650);
  }

  toast(message, kind = '', ttl = 2300) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = message;
    this.el.toast.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, ttl);
  }

  setSound(muted) {
    const span = this.el.sound.querySelector('[data-icon]');
    if (span) span.innerHTML = svg(muted ? 'muted' : 'sound');
    this.el.sound.classList.toggle('muted', muted);
    this.el.sound.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  /* ----- upgrades ----- */
  openUpgrades(from = 'start') {
    this._upgradeOpenFrom = from;
    this.renderUpgrades();
    this.el.upgrades.classList.remove('is-hidden');
  }

  closeUpgrades() {
    this.el.upgrades.classList.add('is-hidden');
    if (this._upgradeOpenFrom === 'start' && this.el.start.classList.contains('is-hidden')) {
      this.el.start.classList.remove('is-hidden');
    }
  }

  renderUpgrades() {
    const save = this.save;
    if (!save) return;
    this.el.upgradeList.innerHTML = '';
    for (const def of UPGRADE_DEFS) {
      const level = save.upgrades[def.id] || 0;
      const maxed = level >= def.max;
      const cost = upgradeCost(def, level);
      const can = save.coins >= cost && !maxed;
      const row = document.createElement('div');
      row.className = `upgrade-row${maxed ? ' maxed' : ''}`;
      row.style.setProperty('--up', def.color);
      let pips = '';
      for (let i = 0; i < def.max; i++) pips += `<span class="up-pip${i < level ? ' on' : ''}"></span>`;
      row.innerHTML = `
        <span class="up-icon">${svg(def.icon)}</span>
        <div class="up-body">
          <div class="up-name-line"><span class="up-name">${def.name}</span><span class="up-level">LV ${level}/${def.max}</span></div>
          <div class="up-desc">${def.desc}</div>
          <div class="up-pips">${pips}</div>
        </div>
        <button class="up-buy${maxed ? ' max' : ''}" data-buy="${def.id}" ${can ? '' : 'disabled'}>
          ${maxed ? 'MAX' : `<span class="coin-glyph"></span>${fmt(cost)}`}
        </button>
      `;
      this.el.upgradeList.appendChild(row);
    }
    this.updateCoins();
  }
}
