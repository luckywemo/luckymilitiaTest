import * as THREE from 'three';
import {
  box, blob, latheZ, tubeZ, rodZ, dome, extrude, roundRect, ring,
  screw, knurlBand, picatinny, mlokSlot, mergeAll,
  Assembly, type TransformOpts,
} from './WeaponGeometry';

/**
 * Reusable firearm components — direct port from Claude-of-Duty src/weapons/parts.js.
 *
 * Weapon-local space: +X right, +Y up, -Z toward the muzzle.
 * Origin at the shooting hand's anchor (top-rear of the pistol grip).
 */

const TAU = Math.PI * 2;

/** Overall length of each muzzle device. */
export const MUZZLE_LEN: Record<string, number> = {
  brake: 0.062, a2: 0.0483, comp: 0.058, trilug: 0.042,
};

/* -------------------------------------------------------------------------- */
/*  small hardware                                                            */
/* -------------------------------------------------------------------------- */

/** Cross pin with a domed head (takedown pins, trigger/hammer pins). */
export function addPin(asm: Assembly, mat: string, x: number, y: number, z: number, r = 0.0022, len = 0.02): void {
  const rod = rodZ(r, r, len, 12, 0.0004);
  asm.add(rod, mat, { x, y, z, ry: Math.PI / 2 });
  rod.dispose();
  const d1 = dome(r * 1.25, 10, 0.5);
  asm.add(d1, mat, { x: x + len / 2, y, z, ry: -Math.PI / 2 });
  d1.dispose();
  const d2 = dome(r * 1.25, 10, 0.5);
  asm.add(d2, mat, { x: x - len / 2, y, z, ry: Math.PI / 2 });
  d2.dispose();
}

/** Hex-socket screw, head facing +axis. */
export function addScrew(asm: Assembly, mat: string, x: number, y: number, z: number, rHead = 0.0022, axis: 'x' | 'y' | 'z' = 'y', len = 0.008): void {
  const g = screw(rHead, rHead * 0.55, rHead * 0.5, len, 10);
  const rot: TransformOpts = axis === 'y' ? { rx: Math.PI / 2 } : axis === 'x' ? { ry: -Math.PI / 2 } : {};
  asm.add(g, mat, { x, y, z, ...rot });
  g.dispose();
}

/** QD sling swivel socket. */
export function addQdSocket(asm: Assembly, matBody: string, matSteel: string, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'x', r = 0.0055): void {
  const cup = latheZ([
    [0, r * 0.55], [0, r * 1.5], [0.0012, r * 1.62],
    [0.006, r * 1.62], [0.006, r * 0.9],
  ], 14);
  const inner = latheZ([
    [0.004, 0], [0.004, r * 0.55], [0, r * 0.55],
  ], 12);
  const rot: TransformOpts = axis === 'x' ? { ry: Math.PI / 2 } : axis === 'y' ? { rx: -Math.PI / 2 } : {};
  asm.add(cup, matBody, { x, y, z, ...rot });
  asm.add(inner, matSteel, { x, y, z, ...rot });
  cup.dispose();
  inner.dispose();
}

/** Fixed sling loop. */
export function addSlingLoop(asm: Assembly, mat: string, x: number, y: number, z: number, radius = 0.008, rot: TransformOpts = {}): void {
  const g = ring(radius, 0.0016, 14, 6);
  asm.add(g, mat, { x, y, z, ...rot });
  g.dispose();
}

/** A live cartridge: brass case, shoulder, neck, copper FMJ tip. */
export function cartridge(caseLen = 0.0446, rimR = 0.00495, bulletLen = 0.019) {
  const neckR = rimR * 0.72;
  const brass = latheZ([
    [0, 0], [0, rimR], [0.0012, rimR * 0.97],
    [caseLen * 0.62, rimR * 0.965], [caseLen * 0.78, neckR], [caseLen, neckR],
  ], 16);
  const bullet = latheZ([
    [caseLen - 0.004, neckR * 0.98],
    [caseLen + bulletLen * 0.45, neckR * 0.98],
    [caseLen + bulletLen * 0.8, neckR * 0.62],
    [caseLen + bulletLen, neckR * 0.16],
    [caseLen + bulletLen + 0.0004, 0],
  ], 16);
  return { brass, bullet, length: caseLen + bulletLen };
}

/** Fired case — no bullet, slightly belled mouth. */
export function emptyCase(caseLen = 0.0446, rimR = 0.00495): THREE.BufferGeometry {
  const neckR = rimR * 0.72;
  return latheZ([
    [0, 0], [0, rimR], [0.0012, rimR * 0.97],
    [caseLen * 0.62, rimR * 0.965], [caseLen * 0.78, neckR],
    [caseLen, neckR * 1.02], [caseLen, neckR * 0.86], [caseLen * 0.8, neckR * 0.86],
  ], 16);
}

/* -------------------------------------------------------------------------- */
/*  rails                                                                     */
/* -------------------------------------------------------------------------- */

/** Picatinny run along Z, top face at `y`. */
export function addRail(asm: Assembly, mat: string, z0: number, z1: number, y: number, x = 0, opts: { baseH?: number; topH?: number; waist?: number; width?: number; pitch?: number; slot?: number; crownChamfer?: number; slotFloor?: boolean } = {}): void {
  const len = Math.abs(z1 - z0);
  const baseH = opts.baseH ?? 0.0042;
  const topH = opts.topH ?? 0.0032;
  const waist = opts.waist ?? 0.0157;
  const cz = (z0 + z1) / 2;
  const yb = y - baseH - topH;
  const g = picatinny(len, opts);
  asm.add(g, mat, { x, y: yb, z: cz });
  g.dispose();

  if (opts.slotFloor !== false) {
    const floor = box(waist * 0.99, 0.0014, len - 0.0004, 0.0002, 1);
    asm.add(floor, 'cavity', { x, y: yb + baseH - 0.0003, z: cz });
    floor.dispose();
  }
}

/* -------------------------------------------------------------------------- */
/*  barrel + muzzle devices                                                   */
/* -------------------------------------------------------------------------- */

export function addBarrel(asm: Assembly, matSteel: string, matCavity: string, o: {
  y?: number; zBreech: number; zMuzzle: number; rChamber?: number; rBarrel?: number;
  rGas?: number; gasAt?: number; seg?: number; knurl?: boolean;
}): { gasAt: number; rBore: number } {
  const y = o.y ?? 0;
  const zBreech = o.zBreech;
  const zMuzzle = o.zMuzzle;
  const rChamber = o.rChamber ?? 0.0112;
  const rBore = o.rBarrel ?? 0.0072;
  const rGas = o.rGas ?? 0.0092;
  const len = zBreech - zMuzzle;
  const gasAt = o.gasAt ?? zMuzzle + len * 0.34;

  const profile = [
    [0, 0], [0, rChamber + 0.0018], [0.004, rChamber + 0.0022],
    [0.02, rChamber + 0.0022], [0.022, rChamber], [len * 0.24, rChamber],
    [len * 0.26, rBore + 0.0012], [zBreech - gasAt - 0.012, rBore + 0.0012],
    [zBreech - gasAt - 0.01, rGas], [zBreech - gasAt + 0.012, rGas],
    [zBreech - gasAt + 0.014, rBore], [len - 0.014, rBore],
    [len - 0.012, rBore + 0.0009], [len - 0.001, rBore + 0.0009],
    [len, rBore * 0.72],
  ];
  const g = latheZ(profile, o.seg ?? 22);
  asm.add(g, matSteel, { y, z: zBreech, ry: Math.PI });
  g.dispose();

  const bore = tubeZ(rBore * 0.7, rBore * 0.42, len * 0.5, 14, 0.0002);
  asm.add(bore, matCavity, { y, z: zMuzzle + len * 0.25 });
  bore.dispose();

  if (o.knurl !== false) {
    const k = knurlBand(rBore + 0.0006, 0.012, 26, 0.00035, 3);
    asm.add(k, matSteel, { y, z: zMuzzle + 0.026 });
    k.dispose();
  }
  return { gasAt, rBore };
}

export function addGasBlock(asm: Assembly, matSteel: string, o: {
  y?: number; z: number; rBarrel?: number; w?: number; h?: number; len?: number; tubeTo: number;
}): void {
  const y = o.y ?? 0;
  const z = o.z;
  const r = o.rBarrel ?? 0.0072;
  const w = o.w ?? 0.021;
  const h = o.h ?? 0.019;
  const bodyG = box(w, h, o.len ?? 0.026, 0.0008, 2);
  asm.add(bodyG, matSteel, { y: y - 0.0015, z });
  bodyG.dispose();
  addScrew(asm, matSteel, 0, y - h / 2 + 0.0015, z - 0.007, 0.0022, 'y', 0.006);
  addScrew(asm, matSteel, 0, y - h / 2 + 0.0015, z + 0.007, 0.0022, 'y', 0.006);
  const tubeLen = o.tubeTo - z;
  const t = tubeZ(0.0026, 0.0014, Math.abs(tubeLen), 10, 0.0002);
  asm.add(t, matSteel, { y: y + r + 0.0052, z: z + tubeLen / 2 });
  t.dispose();
}

export function addMuzzleDevice(asm: Assembly, matSteel: string, matCavity: string, kind: string, zBarrelEnd: number, rBarrel: number, y = 0): { len: number; crownZ: number } {
  const parts: THREE.BufferGeometry[] = [];
  const len = MUZZLE_LEN[kind] ?? 0.05;
  const rOut = rBarrel + 0.0038;
  const zCrown = zBarrelEnd - len;

  if (kind === 'brake') {
    parts.push(latheZ([
      [0, rBarrel + 0.0012], [0.006, rBarrel + 0.0022], [0.008, rOut],
      [len - 0.01, rOut], [len - 0.008, rOut * 0.96], [len - 0.002, rOut * 0.96],
      [len, rOut * 0.8], [len, rBarrel * 0.66], [len - 0.006, rBarrel * 0.62],
    ], 20));
    for (let i = 0; i < 3; i++) {
      const z = 0.016 + i * 0.013;
      const port = box(rOut * 2.4, 0.0055, 0.0072, 0.0006, 1);
      const g1 = port.clone();
      g1.translate(0, 0, z);
      parts.push(g1);
      port.dispose();
    }
  } else if (kind === 'a2') {
    parts.push(latheZ([
      [0, rBarrel + 0.001], [0.005, rBarrel + 0.002], [0.007, rOut * 0.92],
      [0.012, rOut], [len - 0.004, rOut], [len, rOut * 0.86],
      [len, rBarrel * 0.6], [len - 0.005, rBarrel * 0.58],
    ], 20));
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.44 + (i / 4) * Math.PI * 0.88;
      const slot = box(0.0032, 0.0075, 0.021, 0.0005, 1);
      slot.translate(0, rOut * 0.82, 0);
      slot.rotateZ(a);
      slot.translate(0, 0, 0.03);
      parts.push(slot);
    }
  } else if (kind === 'comp') {
    parts.push(latheZ([
      [0, rBarrel + 0.0012], [0.005, rBarrel + 0.003], [0.008, rOut + 0.0016],
      [0.03, rOut + 0.0016], [0.031, rOut + 0.0022], [len - 0.003, rOut + 0.0022],
      [len, rOut + 0.0006], [len, rBarrel * 0.7], [len - 0.007, rBarrel * 0.66],
    ], 20));
    const k = knurlBand(rOut + 0.0018, 0.018, 30, 0.0003, 4);
    k.translate(0, 0, 0.018);
    parts.push(k);
  } else {
    parts.push(latheZ([
      [0, rBarrel + 0.0014], [0.004, rBarrel + 0.0026], [0.006, rOut],
      [0.024, rOut], [0.026, rOut - 0.0012], [len - 0.002, rOut - 0.0012],
      [len, rOut - 0.003], [len, rBarrel * 0.62], [len - 0.005, rBarrel * 0.6],
    ], 18));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const lug = box(0.0042, 0.0038, 0.012, 0.0005, 1);
      lug.translate(0, rOut + 0.0012, 0);
      lug.rotateZ(a);
      lug.translate(0, 0, 0.008);
      parts.push(lug);
    }
  }

  const g = mergeAll(parts);
  asm.add(g, matSteel, { y, z: zCrown + len, ry: Math.PI });
  g.dispose();

  const washer = latheZ([
    [0, rBarrel + 0.0012], [0, rBarrel + 0.0032],
    [0.0018, rBarrel + 0.0032], [0.0018, rBarrel + 0.0012],
  ], 16);
  asm.add(washer, matSteel, { y, z: zCrown + len });
  washer.dispose();

  const bore = tubeZ(rBarrel * 0.66, rBarrel * 0.4, len * 0.9, 14, 0.0002);
  asm.add(bore, matCavity, { y, z: zCrown + len * 0.5 });
  bore.dispose();
  return { len, crownZ: zCrown };
}

/* -------------------------------------------------------------------------- */
/*  handguard                                                                 */
/* -------------------------------------------------------------------------- */

export function addHandguard(asm: Assembly, matAlu: string, o: {
  matPanel?: string; y?: number; z0: number; z1: number; r?: number;
  sides?: number; slatW?: number; slatT?: number; slots?: number;
  braces?: number; topFrom?: number | null; topTo?: number | null;
}): void {
  const matPanel = o.matPanel ?? matAlu;
  const yb = o.y ?? 0;
  const z0 = o.z0;
  const z1 = o.z1;
  const len = z0 - z1;
  const rOut = o.r ?? 0.0235;
  const sides = o.sides ?? 8;
  const slatW = o.slatW ?? 0.0135;
  const slatT = o.slatT ?? 0.0032;
  const cz = (z0 + z1) / 2;

  const collar = latheZ([
    [0, rOut * 0.72], [0, rOut + 0.0018], [0.0025, rOut + 0.0026],
    [0.014, rOut + 0.0026], [0.0165, rOut + 0.0012], [0.0165, rOut * 0.72],
  ], 18);
  asm.add(collar, matAlu, { y: yb, z: z0 - 0.0165 });
  collar.dispose();
  const nutKnurl = knurlBand(rOut + 0.0028, 0.011, 34, 0.00035, 3);
  asm.add(nutKnurl, matAlu, { y: yb, z: z0 - 0.0085 });
  nutKnurl.dispose();

  const slat = box(slatW, slatT, len - 0.019, 0.0006, 1);
  const slotGeo = mlokSlot(0.026, 0.0072, 0.0018);
  slotGeo.rotateY(Math.PI / 2);
  const topFrom = o.topFrom ?? null;
  const topTo = o.topTo ?? null;

  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU + Math.PI / sides;
    const isTop = Math.abs(Math.sin(a) - 1) < 0.35;
    const yy = Math.sin(a) * (rOut - slatT * 0.5);
    const xx = Math.cos(a) * (rOut - slatT * 0.5);
    if (isTop) {
      if (topFrom === null) continue;
      const tLen = Math.abs(topFrom - topTo!);
      const top = box(slatW, slatT, tLen, 0.0006, 1);
      asm.add(top, matPanel, { x: xx, y: yb + yy, z: (topFrom + topTo!) / 2, rz: a - Math.PI / 2 });
      top.dispose();
      continue;
    }
    asm.add(slat, matPanel, { x: xx, y: yb + yy, z: cz - 0.0095, rz: a - Math.PI / 2 });
    const cardinal = Math.abs(Math.cos(a)) > 0.85 || Math.sin(a) < -0.85;
    if (cardinal) {
      for (let s = 0; s < (o.slots ?? 3); s++) {
        const sz = cz + len * 0.5 - 0.045 - s * 0.038;
        if (sz < z1 + 0.02) break;
        asm.add(slotGeo, matPanel, { x: xx * 1.005, y: yb + yy * 1.005, z: sz, rz: a });
        const pocket = box(0.0012, 0.0052, 0.0232, 0.0002, 1);
        asm.add(pocket, 'cavity', { x: xx * 0.955, y: yb + yy * 0.955, z: sz, rz: a });
        pocket.dispose();
      }
    }
  }
  slat.dispose();
  slotGeo.dispose();

  const braceCount = o.braces ?? 3;
  for (let i = 0; i < braceCount; i++) {
    const z = z0 - 0.03 - (i / Math.max(1, braceCount - 1)) * (len - 0.07);
    const brace = latheZ([
      [0, rOut - slatT], [0, rOut + 0.0006], [0.0035, rOut + 0.0006], [0.0035, rOut - slatT],
    ], Math.max(10, sides * 2));
    asm.add(brace, matAlu, { y: yb, z });
    brace.dispose();
  }

  const cap = latheZ([
    [0, rOut - slatT - 0.0008], [0, rOut - 0.0002],
    [0.0022, rOut - 0.0012], [0.0022, rOut - slatT - 0.0008],
  ], Math.max(10, sides * 2));
  asm.add(cap, matAlu, { y: yb, z: z1 + 0.001 });
  cap.dispose();
}

/* -------------------------------------------------------------------------- */
/*  receiver                                                                  */
/* -------------------------------------------------------------------------- */

export function addUpperReceiver(asm: Assembly, mat: string, matSteel: string, matCavity: string, o: {
  zRear: number; zFront: number; bore: number; r?: number; portZ: number; railTop: number;
}): { railTop: number } {
  const zRear = o.zRear;
  const zFront = o.zFront;
  const bore = o.bore;
  const r = o.r ?? 0.0192;
  const len = zRear - zFront;
  const cz = (zRear + zFront) / 2;

  const body = latheZ([
    [0, 0], [0, r * 0.98], [0.0022, r], [len * 0.52, r],
    [len * 0.54, r * 0.985], [len - 0.004, r * 0.985],
    [len, r * 0.93], [len, 0],
  ], 22);
  asm.add(body, mat, { y: bore, z: zRear, ry: Math.PI });
  body.dispose();

  const deck = box(0.0235, 0.008, len - 0.002, 0.0008, 1);
  asm.add(deck, mat, { y: bore + r - 0.0025, z: cz });
  deck.dispose();

  const hump = box(0.0245, 0.011, 0.05, 0.0012, 2);
  asm.add(hump, mat, { y: bore + r - 0.0075, z: zRear - 0.024 });
  hump.dispose();

  const fa = latheZ([
    [0, 0], [0, 0.0055], [0.0015, 0.0062], [0.006, 0.0062],
    [0.007, 0.0048], [0.019, 0.0048], [0.019, 0],
  ], 14);
  asm.add(fa, mat, { x: 0.0115, y: bore - 0.004, z: zRear - 0.006, rx: 0.35 });
  fa.dispose();
  const faPad = box(0.0085, 0.0085, 0.0035, 0.0008, 2);
  asm.add(faPad, matSteel, { x: 0.0132, y: bore - 0.0025, z: zRear + 0.0025, rx: 0.35 });
  faPad.dispose();

  const defl = extrude([
    [0, 0], [0.013, 0.004], [0.013, 0.019], [0, 0.017],
  ], 0.016, { bevel: 0.0009 });
  asm.add(defl, mat, { x: r - 0.001, y: bore - 0.006, z: zRear - 0.045, ry: Math.PI / 2 });
  defl.dispose();

  const portW = 0.032;
  const portH = 0.019;
  const cav = box(portH, 0.012, portW, 0.0008, 1);
  asm.add(cav, matCavity, { x: r - 0.0075, y: bore + 0.001, z: o.portZ, ry: Math.PI / 2 });
  cav.dispose();
  const lip = extrude(roundRect(portW + 0.005, portH + 0.005, 0.0022, 3), 0.0022, { bevel: 0.0006 });
  const lipInner = extrude(roundRect(portW, portH, 0.0018, 3), 0.003, { bevel: 0.0005 });
  asm.add(lip, mat, { x: r - 0.0022, y: bore + 0.001, z: o.portZ, ry: Math.PI / 2 });
  asm.add(lipInner, matCavity, { x: r - 0.0042, y: bore + 0.001, z: o.portZ, ry: Math.PI / 2 });
  lip.dispose();
  lipInner.dispose();

  // Dust cover hung open
  const hingeY = bore - 0.0092;
  const hingeX = r - 0.0035;
  const rod = rodZ(0.0016, 0.0016, portW + 0.014, 10, 0.0003);
  asm.add(rod, matSteel, { x: hingeX, y: hingeY, z: o.portZ });
  rod.dispose();
  const coverOpen = 1.35;
  const coverParts: THREE.BufferGeometry[] = [];
  const panel = box(portH + 0.004, 0.0014, portW + 0.006, 0.0005, 1);
  coverParts.push(panel);
  for (const sz of [-1, 1]) {
    const f = box(portH + 0.004, 0.0032, 0.0016, 0.0004, 1);
    f.translate(0, 0.0009, sz * (portW * 0.5 + 0.0022));
    coverParts.push(f);
  }
  const freeEdge = box(0.0018, 0.0034, portW + 0.006, 0.0004, 1);
  freeEdge.translate((portH + 0.004) * 0.5 - 0.0009, 0.001, 0);
  coverParts.push(freeEdge);
  const cover = mergeAll(coverParts);
  cover.translate((portH + 0.004) * 0.5, 0, 0);
  cover.rotateZ(-coverOpen);
  asm.add(cover, mat, { x: hingeX, y: hingeY, z: o.portZ });
  cover.dispose();

  addRail(asm, mat, zFront + 0.002, zRear - 0.002, o.railTop);
  addPin(asm, matSteel, 0, bore - r + 0.004, zFront + 0.014, 0.0024, r * 2 - 0.004);
  return { railTop: o.railTop };
}

export function addBoltCarrier(asm: Assembly, matSteel: string, o: {
  y?: number; r?: number; len?: number; z: number;
}): void {
  const y = o.y ?? 0;
  const r = o.r ?? 0.0155;
  const len = o.len ?? 0.09;
  const body = latheZ([
    [0, r * 0.6], [0, r], [0.002, r + 0.0004], [len * 0.45, r + 0.0004],
    [len * 0.47, r], [len, r], [len, r * 0.5],
  ], 18);
  asm.add(body, matSteel, { y, z: o.z, ry: Math.PI });
  body.dispose();
  const key = box(0.011, 0.0075, 0.016, 0.0006, 1);
  asm.add(key, matSteel, { y: y + r + 0.0026, z: o.z + len * 0.25 });
  key.dispose();
  const lug = box(0.006, 0.005, 0.03, 0.0005, 1);
  asm.add(lug, matSteel, { x: r * 0.78, y: y + r * 0.42, z: o.z + len * 0.1, rz: 0.5 });
  lug.dispose();
}

export function addLowerReceiver(asm: Assembly, mat: string, matSteel: string, o: {
  bore: number; zRear: number; zFront: number; w?: number;
  magW?: number; magD?: number; magTop?: number; magBottom?: number;
  magZ: number; magTilt?: number; triggerZ: number; gripAngle: number;
}): { magTop: number; magBottom: number; magZ: number; magTilt: number; wellH: number; magW: number; magD: number } {
  const bore = o.bore;
  const zRear = o.zRear;
  const zFront = o.zFront;
  const w = o.w ?? 0.0245;
  const magW = o.magW ?? 0.0295;
  const magD = o.magD ?? 0.0685;
  const magTop = o.magTop ?? bore - 0.014;
  const magBottom = o.magBottom ?? bore - 0.062;
  const magZ = o.magZ;
  const magTilt = o.magTilt ?? 0.09;

  const bodyH = 0.026;
  const bodyG = box(w, bodyH, zRear - zFront, 0.0016, 2);
  asm.add(bodyG, mat, { y: bore - 0.014, z: (zRear + zFront) / 2 });
  bodyG.dispose();

  const wellH = magTop - magBottom;
  const well = extrude(roundRect(magW, magD, 0.0075, 5), wellH, {
    bevel: 0.0012, holes: [roundRect(magW - 0.005, magD - 0.005, 0.006, 5)],
  });
  asm.add(well, mat, { y: (magTop + magBottom) / 2, z: magZ, rx: Math.PI / 2 + magTilt });
  well.dispose();
  const liner = extrude(roundRect(magW - 0.0052, magD - 0.0052, 0.006, 5), wellH - 0.004, {
    bevel: 0.0006, holes: [roundRect(magW - 0.0082, magD - 0.0082, 0.005, 5)],
  });
  asm.add(liner, 'cavity', { y: (magTop + magBottom) / 2, z: magZ, rx: Math.PI / 2 + magTilt });
  liner.dispose();
  const mouth = extrude(roundRect(magW + 0.004, magD + 0.005, 0.008, 5), 0.006, {
    bevel: 0.0012, holes: [roundRect(magW - 0.003, magD - 0.003, 0.006, 5)],
  });
  asm.add(mouth, mat, {
    y: magBottom + 0.002, z: magZ + Math.sin(magTilt) * wellH * 0.5, rx: Math.PI / 2 + magTilt,
  });
  mouth.dispose();

  const tower = box(w - 0.001, 0.03, 0.026, 0.0014, 2);
  asm.add(tower, mat, { y: bore - 0.0155, z: zRear - 0.012 });
  tower.dispose();

  const guardOuter = [
    [-0.028, 0], [0.03, 0], [0.032, -0.006], [0.028, -0.0225],
    [0.018, -0.0275], [-0.02, -0.0275], [-0.028, -0.021],
  ];
  const guardInner = [
    [-0.0225, -0.003], [0.0245, -0.003], [0.0255, -0.008],
    [0.022, -0.0205], [0.015, -0.0235], [-0.0165, -0.0235], [-0.0225, -0.019],
  ];
  const guard = extrude(guardOuter, 0.0172, { bevel: 0.0011, bevelSegments: 2, holes: [guardInner] });
  guard.rotateY(Math.PI / 2);
  asm.add(guard, mat, { y: bore - 0.026, z: o.triggerZ });
  guard.dispose();

  const bossG = box(0.028, 0.012, 0.03, 0.0012, 2);
  asm.add(bossG, mat, { y: bore - 0.0255, z: zRear - 0.028, rx: -o.gripAngle * 0.5 });
  bossG.dispose();

  return { magTop, magBottom, magZ, magTilt, wellH, magW, magD };
}

/** Ambidextrous safety selector. */
export function selectorPart(matAlu: string, matSteel: string, r = 0.006): { geo: THREE.BufferGeometry; mat: string } {
  const parts: THREE.BufferGeometry[] = [];
  const shaft = rodZ(r * 0.62, r * 0.62, 0.03, 12, 0.0004);
  shaft.rotateY(Math.PI / 2);
  parts.push(shaft);
  const boss = latheZ([
    [0, 0], [0, r], [0.0012, r * 1.1], [0.005, r * 1.1], [0.005, 0],
  ], 12);
  boss.rotateY(-Math.PI / 2);
  boss.translate(0.0135, 0, 0);
  parts.push(boss);
  const paddle = extrude([
    [0, -0.0035], [0.021, -0.006], [0.024, 0.0], [0.02, 0.005], [0, 0.0045],
  ], 0.0042, { bevel: 0.0008 });
  paddle.rotateY(Math.PI / 2);
  paddle.translate(0.0185, 0, 0);
  parts.push(paddle);
  return { geo: mergeAll(parts), mat: matAlu };
}

/** Curved trigger blade with serrated face. */
export function triggerPart(matSteel: string): { geo: THREE.BufferGeometry; mat: string } {
  const blade = extrude([
    [-0.0045, 0.0045], [0.0048, 0.0045], [0.0056, -0.008], [0.0044, -0.0158],
    [0.0016, -0.0202], [-0.0032, -0.0192], [-0.0055, -0.011], [-0.006, -0.002],
  ], 0.0072, { bevel: 0.0007, bevelSegments: 2 });
  const parts: THREE.BufferGeometry[] = [blade];
  for (let i = 0; i < 6; i++) {
    const g = box(0.0015, 0.0011, 0.0066, 0.0003, 1);
    g.rotateZ(-0.2 - i * 0.05);
    g.translate(0.0049 - i * 0.0004, -0.0045 - i * 0.0026, 0);
    parts.push(g);
  }
  const geo = mergeAll(parts);
  geo.rotateY(-Math.PI / 2);
  return { geo, mat: matSteel };
}

/* -------------------------------------------------------------------------- */
/*  grip / stock                                                              */
/* -------------------------------------------------------------------------- */

export function addPistolGrip(asm: Assembly, matPoly: string, matRubber: string, o: {
  len?: number; w?: number; angle?: number; y?: number; z?: number;
}): void {
  const len = o.len ?? 0.108;
  const w = o.w ?? 0.031;
  const angle = o.angle ?? 0.38;
  const oy = o.y ?? 0;
  const oz = o.z ?? 0;

  const zf = -0.0155;
  const zb = 0.0155;
  const profile = [
    [zb + 0.004, 0.008], [zf - 0.002, 0.007], [zf - 0.0035, -0.006],
    [zf - 0.0015, -0.02], [zf - 0.003, -0.034], [zf - 0.0005, -0.05],
    [zf - 0.002, -0.064], [zf + 0.001, -0.08], [zf + 0.0035, -len + 0.004],
    [zf + 0.008, -len], [zb - 0.006, -len], [zb - 0.001, -len + 0.006],
    [zb + 0.001, -0.06], [zb + 0.0025, -0.03], [zb + 0.006, -0.012],
  ];
  const core = extrude(profile, w, { bevel: 0.0035, bevelSegments: 3, curveSegments: 4 });
  core.rotateY(Math.PI / 2);
  asm.add(core, matPoly, { y: oy, z: oz, rx: -angle });
  core.dispose();

  const swell = blob(0.008, len * 0.62, 0.03, 0.006, 3);
  for (const sx of [-1, 1]) {
    asm.add(swell, matPoly, {
      x: sx * (w * 0.5 - 0.0015), y: oy - len * 0.42, z: oz + 0.0035, rx: -angle,
    });
  }
  swell.dispose();

  const beaver = blob(w * 0.96, 0.02, 0.024, 0.006, 3);
  asm.add(beaver, matPoly, { y: oy + 0.005, z: oz + 0.012, rx: -angle * 0.6 });
  beaver.dispose();

  const panel = blob(w * 1.03, len * 0.58, 0.019, 0.005, 3);
  asm.add(panel, matRubber, { y: oy - len * 0.44, z: oz + 0.0025, rx: -angle });
  panel.dispose();

  for (let i = 0; i < 4; i++) {
    const t = 0.15 + i * 0.2;
    const ridge = blob(w * 0.9, 0.011, 0.007, 0.003, 3);
    const yy = oy - t * len;
    const zz = oz + zf + 0.001 + Math.sin(t * Math.PI) * 0.001;
    const cs = Math.cos(-angle);
    const sn = Math.sin(-angle);
    asm.add(ridge, matRubber, {
      y: oy + (yy - oy) * cs - (zz - oz) * sn,
      z: oz + (yy - oy) * sn + (zz - oz) * cs,
      rx: -angle,
    });
    ridge.dispose();
  }

  const capY = oy - Math.cos(angle) * len;
  const capZ = oz + Math.sin(angle) * len;
  const cap = blob(w * 0.92, 0.007, 0.031, 0.0025, 2);
  asm.add(cap, matPoly, { y: capY + 0.001, z: capZ, rx: -angle });
  cap.dispose();
  addScrew(asm, matRubber, 0, capY - 0.0015, capZ, 0.0026, 'y', 0.006);
}

export function addCarbineStock(asm: Assembly, matAlu: string, matPoly: string, matRubber: string, o: {
  bore: number; zRear: number; zFront: number; y?: number;
}): void {
  const bore = o.bore;
  const zRear = o.zRear;
  const zFront = o.zFront;
  const yAxis = o.y ?? bore - 0.012;
  const tubeR = 0.0146;
  const len = zRear - zFront;

  const ext = tubeZ(tubeR, tubeR - 0.0022, len - 0.004, 18, 0.0004);
  asm.add(ext, matAlu, { y: yAxis, z: (zRear + zFront) / 2 });
  ext.dispose();

  const nut = latheZ([
    [0, tubeR], [0, tubeR + 0.0034], [0.0016, tubeR + 0.0038],
    [0.0085, tubeR + 0.0038], [0.01, tubeR + 0.003], [0.01, tubeR],
  ], 18);
  asm.add(nut, matAlu, { y: yAxis, z: zFront });
  nut.dispose();

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const notch = box(0.0022, 0.0034, 0.006, 0.0004, 1);
    notch.translate(0, tubeR + 0.0032, 0);
    notch.rotateZ(a);
    notch.translate(0, yAxis, zFront + 0.005);
    asm.add(notch, matAlu, {});
    notch.dispose();
  }

  for (let i = 0; i < 6; i++) {
    const z = zFront + 0.026 + i * 0.018;
    if (z > zRear - 0.02) break;
    const n = box(0.0075, 0.0032, 0.0075, 0.0006, 1);
    asm.add(n, matAlu, { y: yAxis - tubeR + 0.0008, z });
    n.dispose();
  }

  const bodyLen = 0.104;
  const bz = zRear - bodyLen / 2;
  const combY = yAxis + 0.026;
  const toeY = yAxis - 0.042;
  const outline = [
    [-bodyLen * 0.5, yAxis + 0.004], [-bodyLen * 0.5 + 0.012, yAxis + 0.017],
    [-bodyLen * 0.5 + 0.03, combY - 0.002], [bodyLen * 0.5 - 0.012, combY],
    [bodyLen * 0.5, combY - 0.006], [bodyLen * 0.5, toeY + 0.008],
    [bodyLen * 0.5 - 0.008, toeY], [-bodyLen * 0.5 + 0.028, toeY + 0.006],
    [-bodyLen * 0.5 + 0.008, yAxis - 0.02], [-bodyLen * 0.5, yAxis - 0.009],
  ];
  const shellParts: THREE.BufferGeometry[] = [];
  const shell = extrude(outline, 0.043, { bevel: 0.0035, bevelSegments: 2 });
  shell.rotateY(Math.PI / 2);
  shellParts.push(shell);
  const cheek = blob(0.047, 0.012, bodyLen * 0.66, 0.005, 3);
  cheek.translate(0, combY - 0.002, -0.006);
  shellParts.push(cheek);
  for (const sx of [-1, 1]) {
    const sc = blob(0.005, 0.024, 0.052, 0.005, 3);
    sc.translate(sx * 0.0205, yAxis - 0.012, 0.004);
    shellParts.push(sc);
  }
  const body = mergeAll(shellParts);
  asm.add(body, matPoly, { z: bz });
  body.dispose();

  const lever = extrude([
    [-0.014, 0], [0.016, 0], [0.018, -0.007], [0.012, -0.011],
    [-0.012, -0.011], [-0.016, -0.005],
  ], 0.014, { bevel: 0.0008 });
  asm.add(lever, matPoly, { y: yAxis - 0.036, z: bz + 0.012 });
  lever.dispose();

  const pad = blob(0.045, 0.072, 0.013, 0.0045, 3);
  asm.add(pad, matRubber, { y: yAxis - 0.008, z: zRear - 0.004, rx: 0.06 });
  pad.dispose();
  for (let i = 0; i < 5; i++) {
    const g = box(0.043, 0.0035, 0.005, 0.0012, 2);
    asm.add(g, matRubber, { y: yAxis + 0.02 - i * 0.0125, z: zRear + 0.0026, rx: 0.06 });
    g.dispose();
  }

  addSlingLoop(asm, matAlu, 0.0225, yAxis - 0.026, bz - 0.03, 0.0075, { ry: Math.PI / 2 });
  addQdSocket(asm, matPoly, matAlu, -0.0215, yAxis - 0.014, bz - 0.026, 'x', 0.005);
}

/* -------------------------------------------------------------------------- */
/*  magazine                                                                  */
/* -------------------------------------------------------------------------- */

export function buildMagazine(asm: Assembly, _mats: null, o: {
  w?: number; d?: number; len?: number; curve?: number; segs?: number;
  witness?: number; poly?: string; caseLen?: number; bulletLen?: number; rimR?: number;
}): { len: number; w: number; d: number } {
  const w = o.w ?? 0.0255;
  const d = o.d ?? 0.0655;
  const len = o.len ?? 0.215;
  const curve = o.curve ?? 0.028;
  const segs = o.segs ?? 8;
  const poly = o.poly ?? 'polymer';

  const at = (t: number) => ({
    y: -t * len, z: -curve * t * t, tilt: Math.atan2(2 * curve * t, len),
  });

  const bodyParts: THREE.BufferGeometry[] = [];
  const ribParts: THREE.BufferGeometry[] = [];
  const step = len / segs;
  for (let i = 0; i < segs; i++) {
    const t = (i + 0.5) / segs;
    const p = at(t);
    const taper = 1 - t * 0.04;
    const seg = extrude(roundRect(w * taper, d * taper, 0.0055, 5), step * 1.06, { bevel: 0.0008 });
    seg.rotateX(Math.PI / 2 + p.tilt);
    seg.translate(0, p.y, p.z);
    bodyParts.push(seg);

    if (i > 0 && i < segs - 1) {
      for (const sx of [-1, 1]) {
        const rib = box(0.0018, step * 0.62, d * 0.66, 0.0005, 1);
        rib.rotateX(p.tilt);
        rib.translate(sx * (w * taper * 0.5), p.y, p.z);
        ribParts.push(rib);
      }
    }
  }

  const lip = extrude([
    [-0.0032, 0], [0.0032, 0], [0.0026, 0.009], [-0.0026, 0.009],
  ], d * 0.9, { bevel: 0.0005 });
  lip.rotateY(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const g = lip.clone();
    g.translate(sx * (w * 0.5 - 0.0032), -0.0015, 0);
    bodyParts.push(g);
  }
  lip.dispose();
  const notch = box(0.008, 0.0075, 0.0055, 0.0009, 1);
  notch.translate(0, -0.03, d * 0.5 + 0.0015);
  bodyParts.push(notch);

  const end = at(1);
  const plate = extrude(roundRect(w + 0.0026, d * 0.97, 0.004, 4), 0.01, { bevel: 0.001 });
  plate.rotateX(Math.PI / 2 + end.tilt);
  plate.translate(0, end.y - 0.0035, end.z);
  bodyParts.push(plate);
  const ledge = box(w + 0.0034, 0.007, 0.013, 0.0016, 2);
  ledge.rotateX(end.tilt);
  ledge.translate(0, end.y - 0.007, end.z - d * 0.4);
  bodyParts.push(ledge);
  const pad = extrude(roundRect(w + 0.003, d * 0.9, 0.004, 4), 0.005, { bevel: 0.0009 });
  pad.rotateX(Math.PI / 2 + end.tilt);
  pad.translate(0, end.y - 0.0105, end.z);

  const body = mergeAll(bodyParts);
  asm.add(body, poly, {});
  body.dispose();
  const ribs = mergeAll(ribParts);
  if (ribs) { asm.add(ribs, poly, {}); ribs.dispose(); }
  asm.add(pad, 'rubber', {});
  pad.dispose();

  const holes = o.witness ?? 4;
  for (let i = 0; i < holes; i++) {
    const t = 0.26 + (i / Math.max(1, holes - 1)) * 0.56;
    const p = at(t);
    for (const sx of [-1, 1]) {
      const h = extrude(roundRect(0.0085, 0.0044, 0.0018, 3), 0.004, { bevel: 0.0004 });
      h.rotateY(Math.PI / 2);
      h.rotateX(p.tilt);
      h.translate(sx * (w * 0.5 - 0.0006), p.y, p.z);
      asm.add(h, 'cavity', {});
      h.dispose();
    }
  }

  const caseLen = o.caseLen ?? 0.0446;
  const bulletLen = o.bulletLen ?? 0.019;
  const c = cartridge(caseLen, o.rimR ?? 0.00495, bulletLen);
  const cz = Math.min(d * 0.5 - 0.0025, caseLen + bulletLen - d * 0.5 + 0.0015);
  asm.add(c.brass, 'brass', { y: -0.0085, z: cz, ry: Math.PI });
  asm.add(c.bullet, 'copper', { y: -0.0085, z: cz, ry: Math.PI });
  c.brass.dispose();
  c.bullet.dispose();

  return { len, w, d };
}

/* -------------------------------------------------------------------------- */
/*  optics + sights                                                           */
/* -------------------------------------------------------------------------- */

export function buildOptic(asm: Assembly, o: {
  rTube?: number; len?: number; matBody?: string; matSteel?: string;
  y?: number; z?: number; railTop: number; hood?: number;
}): { center: [number, number, number]; lensZ: number; apertureR: number; tubeR: number; len: number } {
  const rTube = o.rTube ?? 0.0155;
  const len = o.len ?? 0.068;
  const matBody = o.matBody ?? 'alu';
  const matSteel = o.matSteel ?? 'steel';
  const y = o.y ?? 0;
  const z = o.z ?? 0;
  const railTop = o.railTop;

  const SEG = 72;
  const SEG_IN = 80;

  const rBoreOc = rTube * 0.787;
  const rBoreOb = rTube * 1.065;
  const rBellOb = rTube * 1.226;
  const zOc = len / 2;
  const zOb = -len / 2;

  const tube = latheZ([
    [zOb, rBoreOb * 0.995], [zOb + 0.0004, rBellOb * 0.99], [zOb, rBellOb * 1.008],
    [zOb + 0.0022, rBellOb], [zOb + 0.008, rBellOb * 0.995], [zOb + 0.014, rTube * 1.1],
    [zOb + 0.022, rTube * 1.01], [zOb + 0.03, rTube], [zOc - 0.012, rTube],
    [zOc - 0.01, rTube * 1.05], [zOc - 0.002, rTube * 1.05],
    [zOc - 0.0003, rTube * 1.02], [zOc, rTube * 0.995], [zOc, rBoreOc * 1.02],
  ], SEG);
  asm.add(tube, matBody, { y, z });
  tube.dispose();

  const baffle = latheZ([
    [zOb + 0.001, rBoreOb], [zOb + 0.001, rBoreOb * 0.985],
    [zOc - 0.009, rBoreOc * 0.985], [zOc - 0.009, rBoreOc],
  ], SEG_IN);
  asm.add(baffle, 'optic_tube', { y, z });
  baffle.dispose();

  const lensR = rBoreOc * 0.99;

  const relief = latheZ([
    [0, lensR * 0.998], [0.0012, lensR * 1.012], [0.0034, rBoreOc * 1.01],
    [0.0038, rTube * 1.0], [0.0038, rBoreOc], [0, rBoreOc],
  ], SEG_IN);
  asm.add(relief, 'optic_tube', { y, z: z + zOc - 0.0045 });
  relief.dispose();

  const lensOc = latheZ([[0, 0], [-0.0009, lensR * 0.6], [-0.0014, lensR]], SEG_IN);
  const lensOb = latheZ([[0, 0], [-0.0012, rBoreOb * 0.58], [-0.0019, rBoreOb * 0.985]], SEG_IN);
  asm.add(lensOb, 'glass', { y, z: z + zOb + 0.0055 });
  asm.add(lensOc, 'glass', { y, z: z + zOc - 0.007, ry: Math.PI });
  lensOc.dispose();
  lensOb.dispose();

  {
    const edge = new THREE.RingGeometry(lensR * 0.965, lensR * 0.99, SEG_IN, 1);
    asm.add(edge, 'lens_ring', { y, z: z + zOc - 0.0066 });
    edge.dispose();
  }

  const vig = new THREE.CircleGeometry(lensR * 0.995, SEG_IN);
  asm.add(vig, 'lens_vig', { y, z: z + zOc - 0.0085 });
  vig.dispose();

  // Turrets
  const turret = (() => {
    const parts: THREE.BufferGeometry[] = [];
    parts.push(latheZ([
      [0, 0.0062], [0.004, 0.0075], [0.0075, 0.0075], [0.0085, 0.0068],
      [0.0125, 0.0068], [0.0128, 0.006], [0.0128, 0],
    ], 32));
    const k = knurlBand(0.0072, 0.0052, 26, 0.00032, 3);
    k.translate(0, 0, 0.0102);
    parts.push(k);
    return mergeAll(parts);
  })();
  const marks = (() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const long = i === 0;
      const h = long ? 0.0026 : 0.0014;
      const t = box(0.00035, h, 0.0006, 0.00008, 1);
      t.rotateZ(a);
      t.translate(Math.cos(a) * (0.0075 - h * 0.42), Math.sin(a) * (0.0075 - h * 0.42), 0);
      parts.push(t);
    }
    return mergeAll(parts);
  })();
  const elev: TransformOpts = { y: y + rTube * 0.9, z: z + 0.004, rx: -Math.PI / 2 };
  const wind: TransformOpts = { x: rTube * 0.9, y, z: z + 0.004, ry: Math.PI / 2 };
  asm.add(turret, matBody, elev);
  asm.add(turret, matBody, wind);
  asm.add(marks, 'cavity', { ...elev, y: elev.y! + 0.0055 });
  asm.add(marks, 'cavity', { ...wind, x: wind.x! + 0.0055 });
  turret.dispose();
  marks.dispose();

  // Battery cap / brightness dial
  const dial = latheZ([
    [0, 0.008], [0.005, 0.0092], [0.0125, 0.0092], [0.0128, 0.008], [0.0128, 0],
  ], 32);
  asm.add(dial, matBody, { x: -rTube * 0.9, y, z: z - 0.006, ry: -Math.PI / 2 });
  dial.dispose();
  const dialKnurl = knurlBand(0.0094, 0.006, 26, 0.00028, 3);
  asm.add(dialKnurl, matBody, { x: -rTube * 0.9 - 0.008, y, z: z - 0.006, ry: -Math.PI / 2 });
  dialKnurl.dispose();

  // Mount
  const mountTop = y - rTube;
  const mountH = mountTop - railTop;
  const base = extrude([
    [-0.0092, 0], [0.0092, 0], [0.0105, -0.0025], [0.0072, -mountH * 0.45],
    [0.0072, -mountH + 0.005], [0.013, -mountH + 0.0018], [0.013, -mountH],
    [-0.013, -mountH], [-0.013, -mountH + 0.0018], [-0.0072, -mountH + 0.005],
    [-0.0072, -mountH * 0.45], [-0.0105, -0.0025],
  ], 0.03, { bevel: 0.0008 });
  asm.add(base, matBody, { y: mountTop, z: z + 0.002 });
  base.dispose();

  const clamp = latheZ([
    [0, rTube], [0, rTube + 0.0035], [0.0055, rTube + 0.0035], [0.0055, rTube],
  ], SEG);
  asm.add(clamp, matBody, { y, z: z - 0.014 });
  asm.add(clamp, matBody, { y, z: z + 0.012 });
  clamp.dispose();
  for (const cz of [z - 0.0115, z + 0.0145]) {
    addScrew(asm, matSteel, 0.0135, mountTop - 0.004, cz, 0.0028, 'x', 0.01);
  }
  const clampBar = box(0.032, 0.006, 0.03, 0.0008, 1);
  asm.add(clampBar, matBody, { y: railTop + 0.001, z: z + 0.002 });
  clampBar.dispose();
  addScrew(asm, matSteel, 0.0165, railTop + 0.001, z - 0.008, 0.003, 'x', 0.012);
  addScrew(asm, matSteel, 0.0165, railTop + 0.001, z + 0.012, 0.003, 'x', 0.012);

  // Rubber eyepiece bezel
  const cup = latheZ([
    [0, rBoreOc * 0.995], [0.0004, rBoreOc * 1.03], [0.0009, rTube * 1.02],
    [0.0018, rTube * 1.075], [0.0055, rTube * 1.1], [0.0072, rTube * 1.09],
    [-0.0042, rTube * 1.085], [-0.0048, rTube * 1.03],
  ], SEG);
  asm.add(cup, 'rubber', { y, z: z + zOc - 0.0012 });
  cup.dispose();

  // Objective shade
  const hoodLen = o.hood ?? 0.009;
  const hood = latheZ([
    [0, rBellOb * 1.0], [0, rBellOb * 1.05], [hoodLen - 0.0003, rBellOb * 1.05],
    [hoodLen, rBellOb * 1.035], [hoodLen, rBellOb * 0.99],
  ], SEG);
  asm.add(hood, matBody, { y, z: z + zOb - hoodLen + 0.0015 });
  hood.dispose();
  const hoodLiner = tubeZ(rBellOb * 1.035, rBellOb * 0.998, hoodLen - 0.0008, SEG, 0.0002);
  asm.add(hoodLiner, 'optic_tube', { y, z: z + zOb - hoodLen * 0.5 + 0.0015 });
  hoodLiner.dispose();

  const obBumper = latheZ([
    [0, rBellOb * 1.01], [0.0006, rBellOb * 1.075], [0.0038, rBellOb * 1.08],
    [0.005, rBellOb * 1.03],
  ], SEG);
  asm.add(obBumper, 'rubber', { y, z: z + zOb - hoodLen - 0.0035 });
  obBumper.dispose();

  return {
    center: [0, y, z],
    lensZ: z + zOc - 0.007,
    apertureR: lensR * 0.94,
    tubeR: rTube,
    len,
  };
}

export function addRollmark(asm: Assembly, mat: string, o: {
  h?: number; stroke?: number; depth?: number; pitch?: number;
  pattern?: number[]; count?: number; sx?: number; x?: number; y?: number; z?: number;
}): void {
  const h = o.h ?? 0.0036;
  const stroke = o.stroke ?? 0.0006;
  const depth = o.depth ?? 0.0008;
  const pitch = o.pitch ?? 0.0017;
  const pat = o.pattern ?? [3, 2, 3, 3, 1, 0, 2, 3, 2, 3, 0, 3, 1, 2, 3, 2, 0, 3, 3, 2];
  const n = o.count ?? pat.length;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const p = pat[i % pat.length];
    if (p === 0) continue;
    const bh = h * (0.52 + p * 0.16);
    const b = box(depth, bh, stroke, 0.00008, 1);
    b.translate(0, (h - bh) * 0.5, -i * pitch);
    parts.push(b);
    if (p === 3) {
      const c = box(depth, stroke * 0.85, pitch * 0.72, 0.00008, 1);
      c.translate(0, (h - bh) * 0.5 + bh * 0.16, -i * pitch - pitch * 0.3);
      parts.push(c);
    }
  }
  const line = box(depth, stroke * 0.9, (n - 1) * pitch, 0.00008, 1);
  line.translate(0, -h * 0.55, -(n - 1) * pitch * 0.5);
  parts.push(line);
  const g = mergeAll(parts);
  if (o.sx) g.scale(o.sx, 1, 1);
  asm.add(g, mat, { x: o.x, y: o.y, z: o.z });
  g.dispose();
}

export function addFrontSight(asm: Assembly, matSteel: string, matAlu: string, x: number, railTop: number, z: number, up = true): void {
  const baseG = box(0.024, 0.008, 0.019, 0.0008, 1);
  asm.add(baseG, matAlu, { x, y: railTop + 0.004, z });
  baseG.dispose();
  const hinge = rodZ(0.0026, 0.0026, 0.026, 10, 0.0003);
  asm.add(hinge, matSteel, { x, y: railTop + 0.008, z: z + 0.006, ry: Math.PI / 2 });
  hinge.dispose();

  const h = up ? 0.03 : 0.006;
  const tilt = up ? 0 : -1.35;
  const earL = extrude([
    [-0.0022, 0], [0.0022, 0], [0.0022, h], [0, h + 0.002], [-0.0022, h],
  ], 0.0075, { bevel: 0.0005 });
  const ears: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const g = earL.clone();
    g.translate(sx * 0.0088, 0, 0);
    ears.push(g);
  }
  earL.dispose();
  const post = rodZ(0.0011, 0.0009, h * 0.72, 8, 0.0002);
  post.rotateX(Math.PI / 2);
  post.translate(0, h * 0.36 + 0.002, 0);
  ears.push(post);
  const cross = box(0.019, 0.0022, 0.0055, 0.0004, 1);
  cross.translate(0, h - 0.0012, 0);
  ears.push(cross);
  const g = mergeAll(ears);
  asm.add(g, matSteel, { x, y: railTop + 0.008, z, rx: tilt });
  g.dispose();
}

export function addRearSight(asm: Assembly, matSteel: string, matAlu: string, x: number, railTop: number, z: number, up = true): void {
  const baseG = box(0.024, 0.0085, 0.022, 0.0008, 1);
  asm.add(baseG, matAlu, { x, y: railTop + 0.0042, z });
  baseG.dispose();
  const h = up ? 0.027 : 0.005;
  const tilt = up ? 0 : 1.35;
  const parts: THREE.BufferGeometry[] = [];
  const leaf = extrude([
    [-0.011, 0], [0.011, 0], [0.011, h * 0.55], [0.006, h],
    [-0.006, h], [-0.011, h * 0.55],
  ], 0.006, { bevel: 0.0006 });
  parts.push(leaf);
  const ap = ring(0.0032, 0.0011, 14, 6);
  ap.translate(0, h * 0.66, 0);
  parts.push(ap);
  const drum = latheZ([
    [0, 0], [0, 0.0048], [0.0035, 0.0052], [0.008, 0.0052], [0.008, 0],
  ], 20);
  const drumKnurl = knurlBand(0.0053, 0.0042, 22, 0.00028, 3);
  drumKnurl.translate(0, 0, 0.0055);
  const drumG = mergeAll([drum, drumKnurl]);
  drumG.rotateY(Math.PI / 2);
  drumG.translate(0.012, h * 0.3, 0);
  parts.push(drumG);
  const g = mergeAll(parts);
  asm.add(g, matSteel, { x, y: railTop + 0.0085, z, rx: tilt });
  g.dispose();
}

export function chargingHandlePart(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bar = box(0.028, 0.0055, 0.052, 0.0008, 1);
  bar.translate(0, 0, 0.012);
  parts.push(bar);
  const shaftG = rodZ(0.0055, 0.0055, 0.07, 12, 0.0005);
  shaftG.translate(0, -0.0022, -0.02);
  parts.push(shaftG);
  const wing = extrude([
    [0, -0.005], [0.02, -0.0075], [0.024, -0.002], [0.024, 0.004], [0.0, 0.004],
  ], 0.0055, { bevel: 0.0007 });
  const wR = wing.clone();
  wR.rotateY(Math.PI / 2);
  wR.translate(0.012, 0.0, 0.034);
  parts.push(wR);
  const wL = wing.clone();
  wL.rotateY(-Math.PI / 2);
  wL.translate(-0.012, 0.0, 0.034);
  parts.push(wL);
  wing.dispose();
  for (let i = 0; i < 3; i++) {
    for (const sx of [-1, 1]) {
      const r = box(0.0022, 0.0075, 0.0016, 0.0003, 1);
      r.translate(sx * (0.017 + i * 0.003), 0.0, 0.031 + i * 0.0022);
      parts.push(r);
    }
  }
  const latchBody = extrude([
    [0, -0.0032], [0.0165, -0.0042], [0.0205, -0.0018], [0.0205, 0.0026],
    [0.0155, 0.0042], [0, 0.0034],
  ], 0.0042, { bevel: 0.0006 });
  latchBody.rotateY(-Math.PI / 2);
  latchBody.translate(-0.0125, 0.0012, 0.0335);
  parts.push(latchBody);
  const hook = box(0.0038, 0.0052, 0.0032, 0.0005, 1);
  hook.translate(-0.0295, 0.0006, 0.0292);
  parts.push(hook);
  const pin = rodZ(0.0011, 0.0011, 0.0072, 8, 0.0002);
  pin.rotateY(Math.PI / 2);
  pin.translate(-0.0135, 0.0012, 0.0356);
  parts.push(pin);
  const pad = box(0.0028, 0.0062, 0.0075, 0.0004, 1);
  pad.translate(-0.0316, 0.0014, 0.0345);
  parts.push(pad);
  return mergeAll(parts);
}

export function addForeGrip(asm: Assembly, matPoly: string, matRubber: string, o: {
  len?: number; y?: number; z?: number; angle?: number;
}): void {
  const len = o.len ?? 0.062;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const g = blob(0.026 - t * 0.003, len / 5 + 0.003, 0.03 - t * 0.004, 0.005, 3);
    g.translate(0, -t * len, t * 0.008);
    parts.push(g);
  }
  const core = mergeAll(parts);
  asm.add(core, matPoly, { y: o.y, z: o.z, rx: o.angle ?? 0.25 });
  core.dispose();
  const gripParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const t = 0.15 + i * 0.23;
    const gr = box(0.024, 0.006, 0.0055, 0.002, 2);
    gr.translate(0, -t * len, -0.013);
    gripParts.push(gr);
  }
  const grips = mergeAll(gripParts);
  asm.add(grips, matRubber, { y: o.y, z: o.z, rx: o.angle ?? 0.25 });
  grips.dispose();
}

export function buildMiniReflex(asm: Assembly, o: {
  w?: number; h?: number; len?: number; y?: number; z?: number;
  matBody?: string; tilt?: number;
}): { center: [number, number, number]; lensZ: number; apertureR: number; windowW: number; windowH: number; tilt: number } {
  const w = o.w ?? 0.0246;
  const h = o.h ?? 0.021;
  const len = o.len ?? 0.0455;
  const y = o.y ?? 0;
  const z = o.z ?? 0;
  const matBody = o.matBody ?? 'alu';
  const glassTilt = o.tilt ?? 0.16;

  const base = extrude(roundRect(w, len, 0.003, 3), 0.0042, { bevel: 0.0007 });
  asm.add(base, matBody, { y: y + 0.002, z, rx: Math.PI / 2 });
  base.dispose();

  const wall = extrude([
    [-len * 0.5, 0], [len * 0.42, 0], [len * 0.46, h * 0.52],
    [len * 0.3, h * 0.86], [-len * 0.42, h], [-len * 0.5, h * 0.92],
  ], 0.0036, { bevel: 0.0007 });
  for (const sx of [-1, 1]) {
    asm.add(wall, matBody, { x: sx * (w * 0.5 - 0.0018), y: y + 0.004, z, ry: Math.PI / 2 });
  }
  wall.dispose();

  const hood = box(w, 0.0035, 0.011, 0.0008, 1);
  asm.add(hood, matBody, { y: y + h * 0.98, z: z - len * 0.36 });
  hood.dispose();
  const emitter = blob(w - 0.007, 0.0075, 0.012, 0.0016, 2);
  asm.add(emitter, matBody, { y: y + 0.0075, z: z - len * 0.3 });
  emitter.dispose();
  const led = latheZ([[0, 0], [0, 0.0016], [0.0012, 0.0018], [0.0012, 0]], 10);
  asm.add(led, 'steel_bright', { y: y + 0.0105, z: z - len * 0.28, rx: -0.5 });
  led.dispose();

  addScrew(asm, 'steel', 0, y + 0.004, z + len * 0.4, 0.0026, 'y', 0.008);
  addScrew(asm, 'steel', w * 0.5 - 0.002, y + h * 0.5, z + len * 0.28, 0.0022, 'x', 0.006);
  addScrew(asm, 'steel', 0, y + h * 0.86, z + len * 0.1, 0.0022, 'y', 0.006);

  const glassW = w - 0.007;
  const glassH = h * 0.72;
  const pane = extrude(roundRect(glassW, glassH, 0.0015, 3), 0.0012, { bevel: 0.0003 });
  asm.add(pane, 'glass', { y: y + h * 0.56, z: z + len * 0.14, rx: glassTilt });
  pane.dispose();
  const frame = extrude(roundRect(glassW + 0.0028, glassH + 0.0028, 0.0018, 3), 0.0022, {
    bevel: 0.0005, holes: [roundRect(glassW - 0.0002, glassH - 0.0002, 0.0014, 3)],
  });
  asm.add(frame, matBody, { y: y + h * 0.56, z: z + len * 0.14, rx: glassTilt });
  frame.dispose();

  return {
    center: [0, y + h * 0.56, z + len * 0.14],
    lensZ: z + len * 0.14,
    apertureR: Math.min(glassW, glassH) * 0.46,
    windowW: glassW * 0.46,
    windowH: glassH * 0.46,
    tilt: glassTilt,
  };
}

export function buildSlide(asm: Assembly, o: {
  w?: number; h?: number; len?: number; mat?: string; zRear?: number;
}): { zRear: number; zFront: number; w: number; h: number; len: number; sightY: number } {
  const w = o.w ?? 0.0262;
  const h = o.h ?? 0.0248;
  const len = o.len ?? 0.183;
  const mat = o.mat ?? 'steel';
  const zRear = o.zRear ?? 0.052;
  const zFront = zRear - len;
  const cz = (zRear + zFront) / 2;
  const bore = 0;

  const bodyG = box(w, h, len, 0.0016, 2);
  asm.add(bodyG, mat, { y: bore + 0.0015, z: cz });
  bodyG.dispose();
  const rib = box(w - 0.008, 0.004, len - 0.02, 0.0012, 2);
  asm.add(rib, mat, { y: bore + h * 0.5 + 0.0025, z: cz - 0.004 });
  rib.dispose();
  const nose = extrude([
    [-w * 0.5, -h * 0.5], [w * 0.5, -h * 0.5], [w * 0.5, h * 0.34],
    [w * 0.36, h * 0.5], [-w * 0.36, h * 0.5], [-w * 0.5, h * 0.34],
  ], 0.016, { bevel: 0.0012 });
  asm.add(nose, mat, { y: bore + 0.0015, z: zFront + 0.008 });
  nose.dispose();

  for (const [z0, count] of [[zRear - 0.006, 7], [zFront + 0.03, 5]] as [number, number][]) {
    for (let i = 0; i < count; i++) {
      const z = z0 - i * 0.0052;
      const g = box(w + 0.0006, h * 0.62, 0.0026, 0.0006, 1);
      asm.add(g, mat, { y: bore + 0.0015, z });
      g.dispose();
    }
  }

  for (const sx of [-1, 1]) {
    const cut = extrude(roundRect(0.042, h * 0.4, 0.004, 3), 0.0016, { bevel: 0.0005 });
    asm.add(cut, mat, { x: sx * (w * 0.5 - 0.0004), y: bore + 0.001, z: cz - 0.012, ry: Math.PI / 2 });
    cut.dispose();
  }

  const portW = 0.036;
  const portH = 0.0135;
  const cav = box(0.01, portH, portW, 0.0008, 1);
  asm.add(cav, 'cavity', { x: w * 0.5 - 0.006, y: bore + 0.004, z: zRear - 0.05, ry: Math.PI / 2 });
  cav.dispose();
  const lip = extrude(roundRect(portW + 0.004, portH + 0.004, 0.002, 3), 0.002, {
    bevel: 0.0005, holes: [roundRect(portW, portH, 0.0016, 3)],
  });
  asm.add(lip, mat, { x: w * 0.5 - 0.0009, y: bore + 0.004, z: zRear - 0.05, ry: Math.PI / 2 });
  lip.dispose();

  const breech = box(w - 0.006, h - 0.008, 0.004, 0.0008, 1);
  asm.add(breech, 'steel_bright', { y: bore + 0.001, z: zRear - 0.032 });
  breech.dispose();

  const rear = extrude([
    [-0.009, 0], [0.009, 0], [0.009, 0.0055], [0.0022, 0.0055],
    [0.0022, 0.0022], [-0.0022, 0.0022], [-0.0022, 0.0055], [-0.009, 0.0055],
  ], 0.0055, { bevel: 0.0004 });
  asm.add(rear, 'steel_bright', { y: bore + h * 0.5 + 0.0045, z: zRear - 0.012 });
  rear.dispose();
  for (const sx of [-1, 1]) {
    const dot = dome(0.0011, 8, 0.5);
    asm.add(dot, 'steel_bright', { x: sx * 0.0055, y: bore + h * 0.5 + 0.0075, z: zRear - 0.0148, ry: Math.PI });
    dot.dispose();
  }
  const front = box(0.0035, 0.0062, 0.0042, 0.0004, 1);
  asm.add(front, 'steel_bright', { y: bore + h * 0.5 + 0.0055, z: zFront + 0.014 });
  front.dispose();
  const fdot = dome(0.0013, 8, 0.5);
  asm.add(fdot, 'steel_bright', { y: bore + h * 0.5 + 0.0058, z: zFront + 0.0118, ry: Math.PI });
  fdot.dispose();

  return { zRear, zFront, w, h, len, sightY: bore + h * 0.5 + 0.0065 };
}
