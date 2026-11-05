/* Persistent progress + upgrade definitions */
const KEY = 'mobsurge.save.v1';

export const UPGRADE_DEFS = [
  {
    id: 'squad',
    name: 'Squad Size',
    icon: 'crowd',
    color: '#3ef6ff',
    max: 10,
    baseCost: 24,
    growth: 1.52,
    desc: 'Start every run with +4 more mob units per level.',
    short: 'Start with more units'
  },
  {
    id: 'strength',
    name: 'Battle Strength',
    icon: 'fist',
    color: '#ff6b9d',
    max: 10,
    baseCost: 32,
    growth: 1.55,
    desc: 'Rival mobs lose units 9% faster per level in a clash.',
    short: 'Win clashes faster'
  },
  {
    id: 'magnet',
    name: 'Coin Magnet',
    icon: 'magnet',
    color: '#8c5cff',
    max: 8,
    baseCost: 20,
    growth: 1.48,
    desc: 'Coin pickup radius +0.55 m per level.',
    short: 'Pull in nearby coins'
  },
  {
    id: 'power',
    name: 'Power Cells',
    icon: 'bolt',
    color: '#a7ff4f',
    max: 8,
    baseCost: 28,
    growth: 1.5,
    desc: 'Every power-up lasts +0.8 seconds per level.',
    short: 'Longer power-ups'
  },
  {
    id: 'bounty',
    name: 'Bounty',
    icon: 'coin',
    color: '#ffc857',
    max: 8,
    baseCost: 36,
    growth: 1.57,
    desc: 'Earn +10% more coins from every source per level.',
    short: 'More coins per run'
  }
];

export function defaultSave() {
  return {
    version: 1,
    coins: 0,
    best: 0,
    runs: 0,
    kills: 0,
    bosses: 0,
    upgrades: { squad: 0, strength: 0, magnet: 0, power: 0, bounty: 0 },
    sound: true,
    tutorial: true
  };
}

export function loadSave() {
  const base = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    return {
      ...base,
      ...parsed,
      upgrades: { ...base.upgrades, ...(parsed.upgrades || {}) },
      coins: Math.max(0, Math.floor(Number(parsed.coins) || 0)),
      best: Math.max(0, Math.floor(Number(parsed.best) || 0)),
      runs: Math.max(0, Math.floor(Number(parsed.runs) || 0)),
      kills: Math.max(0, Math.floor(Number(parsed.kills) || 0)),
      bosses: Math.max(0, Math.floor(Number(parsed.bosses) || 0))
    };
  } catch {
    return base;
  }
}

let saveTimer = 0;
export function writeSave(save) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode */ }
  }, 80);
}

export function flushSave(save) {
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export function upgradeCost(def, level) {
  return Math.round(def.baseCost * Math.pow(def.growth, level) / 2) * 2;
}

export function totalUpgradeLevel(save) {
  return Object.values(save.upgrades).reduce((a, b) => a + b, 0);
}
