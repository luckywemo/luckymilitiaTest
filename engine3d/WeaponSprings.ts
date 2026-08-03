/**
 * Damped harmonic oscillators and maths for viewmodel animation.
 * Ported from Claude-of-Duty's springs.js — framerate independent,
 * allocation-free after construction.
 */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smootherstep(t: number): number {
  t = clamp01(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function approach(current: number, target: number, tau: number, dt: number): number {
  if (tau <= 1e-6) return target;
  return target + (current - target) * Math.exp(-dt / tau);
}

export function wrapPi(a: number): number {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

/** Deterministic value noise in 1D — camera/viewmodel sway without RNG. */
export function hashNoise(x: number, seed = 0): number {
  const xi = Math.floor(x);
  const f = x - xi;
  const h = (i: number) => {
    let n = (i | 0) ^ (seed * 374761393);
    n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d);
    n = Math.imul(n ^ (n >>> 12), 0x297a2d39);
    n ^= n >>> 15;
    return ((n >>> 0) / 4294967296) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return h(xi) * (1 - u) + h(xi + 1) * u;
}

const MAX_SUB_DT = 1 / 360;

/**
 * Damped harmonic oscillator driven by frequency (Hz) and damping ratio.
 * zeta < 1: under-damped (overshoots), zeta = 1: critically damped.
 */
export class Spring {
  value: number;
  velocity: number;
  target: number;
  freq: number;
  damping: number;

  constructor(freq = 8, damping = 0.7, value = 0) {
    this.freq = freq;
    this.damping = damping;
    this.value = value;
    this.velocity = 0;
    this.target = 0;
  }

  reset(value = 0): this {
    this.value = value;
    this.velocity = 0;
    return this;
  }

  impulse(v: number): this {
    this.velocity += v;
    return this;
  }

  set(v: number): this {
    this.value = v;
    return this;
  }

  step(dt: number): number {
    if (dt <= 0) return this.value;
    const w = TAU * this.freq;
    const k = w * w;
    const c = 2 * this.damping * w;
    let remaining = dt;
    let guard = 0;
    while (remaining > 1e-7 && guard++ < 24) {
      const h = remaining > MAX_SUB_DT ? MAX_SUB_DT : remaining;
      remaining -= h;
      const a = -k * (this.value - this.target) - c * this.velocity;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
    if (Math.abs(this.value - this.target) < 1e-7 && Math.abs(this.velocity) < 1e-6) {
      this.value = this.target;
      this.velocity = 0;
    }
    return this.value;
  }
}

/** 3-component spring. */
export class Spring3 {
  x = 0; y = 0; z = 0;
  vx = 0; vy = 0; vz = 0;
  freq: number;
  damping: number;

  constructor(freq = 8, damping = 0.7) {
    this.freq = freq;
    this.damping = damping;
  }

  reset(): this { this.x = this.y = this.z = 0; this.vx = this.vy = this.vz = 0; return this; }

  kick(x: number, y: number, z: number): this {
    this.vx += x; this.vy += y; this.vz += z;
    return this;
  }

  step(dt: number, tx = 0, ty = 0, tz = 0): void {
    if (dt <= 0) return;
    const w = TAU * this.freq;
    const k = w * w;
    const c = 2 * this.damping * w;
    let remaining = dt;
    let guard = 0;
    while (remaining > 1e-7 && guard++ < 24) {
      const h = remaining > MAX_SUB_DT ? MAX_SUB_DT : remaining;
      remaining -= h;
      const ax = -k * (this.x - tx) - c * this.vx;
      const ay = -k * (this.y - ty) - c * this.vy;
      const az = -k * (this.z - tz) - c * this.vz;
      this.vx += ax * h; this.vy += ay * h; this.vz += az * h;
      this.x += this.vx * h; this.y += this.vy * h; this.z += this.vz * h;
    }
  }
}

/**
 * Two-layer response: fast under-damped spring + slow exponential residual.
 * Real weapon/camera recoil rises instantly, snaps most of the way back,
 * then settles — a single spring can only do two of those three.
 */
export class RecoilAxis {
  spring: Spring;
  residual = 0;
  residualTau: number;
  residualShare: number;
  value = 0;

  constructor(freq = 9.5, damping = 0.52, residualTau = 0.3, residualShare = 0.34) {
    this.spring = new Spring(freq, damping, 0);
    this.residualTau = residualTau;
    this.residualShare = residualShare;
  }

  reset(): this { this.spring.reset(0); this.residual = 0; this.value = 0; return this; }

  kick(amount: number): void {
    this.spring.value += amount * (1 - this.residualShare);
    this.residual += amount * this.residualShare;
  }

  step(dt: number): number {
    this.spring.step(dt);
    this.residual = approach(this.residual, 0, this.residualTau, dt);
    this.value = this.spring.value + this.residual;
    return this.value;
  }
}

/** 1D fractal Brownian motion for procedural sway. */
export class Noise1 {
  private seed: number;
  constructor(seed: number, _unused: number) {
    this.seed = seed;
  }

  fbm(x: number, octaves = 3): number {
    let v = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      v += amp * hashNoise(x * freq, this.seed + i * 17);
      freq *= 2.1;
      amp *= 0.5;
    }
    return v;
  }

  fbm01(x: number, octaves = 3): number {
    return (this.fbm(x, octaves) + 1) * 0.5;
  }
}
