/**
 * WeaponSystem
 * ─────────────
 * All weapon configuration and weapon-related constants.
 * Extracted from MainScene for modularity.
 */

import { WeaponConfig } from './types';

export const WEAPONS_CONFIG: Record<string, WeaponConfig> = {
  pistol: {
    name: 'M9 SIDEARM', fireRate: 350, damage: 15, recoil: 150, bullets: 1,
    spread: 0.02, projectileScale: 0.8, projectileTint: 0xffcc00, maxAmmo: 999,
    isInfinite: true, key: 'pistol', icon: '🔫', type: 'kinetic', category: 'pistol', speed: 2000,
  },
  smg: {
    name: 'MP5 TACTICAL', fireRate: 100, damage: 10, recoil: 80, bullets: 1,
    spread: 0.12, projectileScale: 0.6, projectileTint: 0xffaa00, maxAmmo: 45,
    key: 'smg', icon: '⚔️', type: 'kinetic', category: 'rifle', speed: 2200,
  },
  shotgun: {
    name: '870 BREACHER', fireRate: 900, damage: 20, recoil: 2200, bullets: 8,
    spread: 0.9, projectileScale: 0.9, projectileTint: 0xff4444, maxAmmo: 8,
    key: 'shotgun', icon: '🔥', type: 'kinetic', category: 'heavy', speed: 1800,
  },
  launcher: {
    name: 'M32 GL', fireRate: 1500, damage: 80, recoil: 1200, bullets: 1,
    spread: 0, projectileScale: 2.5, projectileTint: 0xf97316, maxAmmo: 6,
    key: 'launcher', icon: '🚀', type: 'explosive', category: 'heavy', speed: 1200,
  },
  railgun: {
    name: 'XM-25 RAIL', fireRate: 2000, damage: 100, recoil: 1500, bullets: 1,
    spread: 0, projectileScale: 4.0, projectileTint: 0x00ffff, maxAmmo: 3,
    key: 'railgun', icon: '⚡', type: 'energy', category: 'heavy', speed: 4000,
  },
  plasma: {
    name: 'X-ION REPEATER', fireRate: 200, damage: 30, recoil: 200, bullets: 1,
    spread: 0.05, projectileScale: 1.8, projectileTint: 0xff00ff, maxAmmo: 20,
    key: 'plasma', icon: '🔮', type: 'energy', category: 'rifle', speed: 1600,
  },
};

export const TEAM_COLORS = { alpha: '#f97316', bravo: '#22d3ee' } as const;
export const TEAM_TINTS = { alpha: 0xf97316, bravo: 0x22d3ee } as const;

export function getWeapon(key: string): WeaponConfig {
  return WEAPONS_CONFIG[key] ?? WEAPONS_CONFIG.pistol;
}
