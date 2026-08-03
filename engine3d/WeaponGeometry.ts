import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural hard-surface geometry kit for weapons.
 * Direct port from Claude-of-Duty's geometry.js.
 *
 * Weapon-local space: +X right, +Y up, -Z toward the muzzle.
 * Origin at the shooting hand's anchor (top-rear of the pistol grip).
 */

const KEEP_ATTRS = ['position', 'normal', 'uv'];

function normalizeAttributes(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(geo.attributes)) {
    if (!KEEP_ATTRS.includes(name)) geo.deleteAttribute(name);
  }
  if (!geo.getAttribute('uv')) {
    const n = geo.getAttribute('position').count;
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  geo.morphAttributes = {};
  geo.clearGroups();
  return geo;
}

function flipWinding(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = geo.getIndex();
  if (idx) {
    const a = idx.array as any;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t;
    }
    idx.needsUpdate = true;
  }
  const n = geo.getAttribute('normal');
  if (n) {
    const a = n.array as any;
    for (let i = 0; i < a.length; i++) a[i] = -a[i];
    n.needsUpdate = true;
  }
  return geo;
}

/** Chamfered box. chamfer = bevel radius in metres; seg 1 = hard 45° chamfer. */
export function box(w: number, h: number, d: number, chamfer = 0.0012, seg = 1): THREE.BufferGeometry {
  const r = Math.min(chamfer, Math.min(w, Math.min(h, d)) * 0.49);
  if (r <= 1e-5) return normalizeAttributes(new THREE.BoxGeometry(w, h, d));
  return normalizeAttributes(new RoundedBoxGeometry(w, h, d, seg, r));
}

/** A softly rounded block — grips, palm swells, butt pads. */
export function blob(w: number, h: number, d: number, radius = 0.006, seg = 3): THREE.BufferGeometry {
  return box(w, h, d, radius, seg);
}

/** Lathe around the Z axis. profile = [axialZ, radius] pairs. */
export function latheZ(profile: number[][], seg = 24, phiStart = 0, phiLength = Math.PI * 2): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < profile.length; i++) {
    pts.push(new THREE.Vector2(Math.max(1e-5, profile[i][1]), profile[i][0]));
  }
  const g = new THREE.LatheGeometry(pts, seg, phiStart, phiLength);
  g.rotateX(Math.PI / 2);
  return normalizeAttributes(g);
}

/** Tube along Z with a real wall: outer surface, inner bore, crowned ends. */
export function tubeZ(rOuter: number, rInner: number, len: number, seg = 24, crown = 0.0006): THREE.BufferGeometry {
  const z0 = -len / 2;
  const z1 = len / 2;
  const c = Math.min(crown, (rOuter - rInner) * 0.4);
  return latheZ([
    [z0 + c, rInner], [z0, rInner + c], [z0, rOuter - c], [z0 + c, rOuter],
    [z1 - c, rOuter], [z1, rOuter - c], [z1, rInner + c], [z1 - c, rInner],
  ], seg);
}

/** Solid cylinder along Z with chamfered rims. */
export function rodZ(r0: number, r1: number, len: number, seg = 20, chamfer = 0.0008): THREE.BufferGeometry {
  const z0 = -len / 2;
  const z1 = len / 2;
  const c = Math.min(chamfer, len * 0.4, Math.min(r0, r1) * 0.5);
  return latheZ([
    [z0, 0], [z0, r0 - c], [z0 + c, r0], [z1 - c, r1], [z1, r1 - c], [z1, 0],
  ], seg);
}

/** Sphere-ish detail blob (buttons, bosses, knuckle pads). */
export function dome(r: number, seg = 16, cut = 0.6): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.5)), 0, Math.PI * 2, 0, Math.PI * cut);
  g.rotateX(Math.PI / 2);
  return normalizeAttributes(g);
}

/** Extrude a 2-D outline (in XY) along Z with a real bevel. */
export function extrude(pts: number[][], depth: number, opts: { bevel?: number; bevelSegments?: number; curveSegments?: number; holes?: number[][][] } = {}): THREE.BufferGeometry {
  const bevel = opts.bevel ?? 0.0008;
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  if (opts.holes) {
    for (const hole of opts.holes) {
      const p = new THREE.Path();
      p.moveTo(hole[0][0], hole[0][1]);
      for (let i = 1; i < hole.length; i++) p.lineTo(hole[i][0], hole[i][1]);
      p.closePath();
      shape.holes.push(p);
    }
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, depth - bevel * 2),
    bevelEnabled: bevel > 1e-6,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: opts.bevelSegments ?? 1,
    curveSegments: opts.curveSegments ?? 6,
    steps: 1,
  });
  g.translate(0, 0, -depth / 2 + bevel);
  const merged = mergeVertices(normalizeAttributes(g), 1e-6);
  if (merged !== g) g.dispose();
  return normalizeAttributes(merged);
}

/** A rounded rectangle outline for extruded plates. */
export function roundRect(w: number, h: number, r: number, seg = 3): number[][] {
  const pts: number[][] = [];
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  const corners: [number, number, number][] = [
    [hw, hh, 0], [-hw, hh, Math.PI / 2], [-hw, -hh, Math.PI], [hw, -hh, -Math.PI / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}

/** Torus in the XY plane (sling loops, trigger guard bows). */
export function ring(radius: number, thickness: number, seg = 20, rings = 8, arc = Math.PI * 2): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(radius, thickness, rings, seg, arc);
  return normalizeAttributes(g);
}

/** Hex-socket cap screw, axis +Z, head at z=0 facing -Z. */
export function screw(rHead: number, rShank: number, headH: number, shankL: number, seg = 12): THREE.BufferGeometry {
  const rSocket = rHead * 0.52;
  const g: THREE.BufferGeometry[] = [];
  g.push(latheZ([
    [0, rSocket], [0, rHead - 0.0002], [0.0002, rHead],
    [headH, rHead], [headH, rShank], [headH + shankL, rShank], [headH + shankL, 0],
  ], seg));
  const bore = latheZ([
    [headH * 0.62, 0], [headH * 0.62, rSocket], [0, rSocket],
  ], 6);
  g.push(bore);
  return mergeAll(g);
}

/** Knurling / checkering: a band of tiny pyramids around a cylinder. */
export function knurlBand(radius: number, len: number, count = 28, depth = 0.0004, rows = 3): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const cell = new THREE.OctahedronGeometry(depth * 2.2, 0);
  cell.scale(1, 1, 0.55);
  for (let r = 0; r < rows; r++) {
    const z = -len / 2 + ((r + 0.5) / rows) * len;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (r % 2) * (Math.PI / count);
      const g = cell.clone();
      g.rotateZ(a);
      g.translate(Math.cos(a) * radius, Math.sin(a) * radius, z);
      parts.push(normalizeAttributes(g));
    }
  }
  cell.dispose();
  return mergeAll(parts);
}

/** Fine longitudinal serrations (slide grip, handguard panels, mag ribs). */
export function serrations(w: number, h: number, len: number, count: number, depth = 0.0006, axis: 'x' | 'y' = 'x'): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const step = (axis === 'x' ? w : h) / count;
  const rib = box(axis === 'x' ? step * 0.55 : w, axis === 'x' ? h : step * 0.55, len, depth * 0.9, 1);
  for (let i = 0; i < count; i++) {
    const t = -0.5 + (i + 0.5) / count;
    const g = rib.clone();
    if (axis === 'x') g.translate(t * w, 0, 0);
    else g.translate(0, t * h, 0);
    parts.push(g);
  }
  rib.dispose();
  return mergeAll(parts);
}

/**
 * MIL-STD-1913 Picatinny rail running along Z.
 * Real dimensions: 21.2 mm across, 45-degree flanks, 5.35 mm slots on 10.55 mm pitch.
 * 45-degree chamfer on both top edges — the fix for the bright comb problem.
 */
export function picatinny(len: number, opts: { width?: number; waist?: number; baseH?: number; topH?: number; pitch?: number; slot?: number; crownChamfer?: number } = {}): THREE.BufferGeometry {
  const width = opts.width ?? 0.0212;
  const waist = opts.waist ?? 0.0157;
  const baseH = opts.baseH ?? 0.0042;
  const topH = opts.topH ?? 0.0032;
  const pitch = opts.pitch ?? 0.01055;
  const slot = opts.slot ?? 0.00535;
  const chamfer = 0.00035;
  const ch = opts.crownChamfer ?? 0.0015;

  const teeth = Math.max(1, Math.floor((len + slot) / pitch));
  const toothLen = pitch - slot;
  const parts: THREE.BufferGeometry[] = [];

  const base = box(width, baseH, len, chamfer, 1);
  base.translate(0, baseH / 2, 0);
  parts.push(base);

  const profile = [
    [-waist / 2, 0],
    [-width / 2, topH - ch],
    [-width / 2 + ch, topH],
    [width / 2 - ch, topH],
    [width / 2, topH - ch],
    [waist / 2, 0],
  ];
  const tooth = extrude(profile, toothLen, { bevel: 0.00025, bevelSegments: 1 });
  for (let i = 0; i < teeth; i++) {
    const z = len / 2 - toothLen / 2 - i * pitch;
    if (z - toothLen / 2 < -len / 2) break;
    const g = tooth.clone();
    g.translate(0, baseH, z);
    parts.push(g);
  }
  tooth.dispose();
  return mergeAll(parts);
}

/** M-LOK style slot: a recessed pocket with a raised lip, for handguard slats. */
export function mlokSlot(len = 0.032, wide = 0.0075, depth = 0.0022): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const outer = extrude(roundRect(len, wide + 0.0028, 0.0014, 3), 0.0016, { bevel: 0.0004 });
  const inner = extrude(roundRect(len - 0.0016, wide, 0.0012, 3), depth, { bevel: 0.0003 });
  inner.translate(0, 0, -depth * 0.35);
  parts.push(outer, inner);
  return mergeAll(parts);
}

/** Merge a list of geometries, tolerating mixed indexed/non-indexed input. */
export function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = list.filter(Boolean) as THREE.BufferGeometry[];
  if (!clean.length) return new THREE.BufferGeometry();
  if (clean.length === 1) return clean[0];
  const nonIndexed = clean.map((g) => (g.getIndex() ? g.toNonIndexed() : g));
  for (const g of nonIndexed) normalizeAttributes(g);
  const merged = mergeGeometries(nonIndexed, false);
  for (let i = 0; i < clean.length; i++) {
    if (nonIndexed[i] !== clean[i]) nonIndexed[i].dispose();
    clean[i].dispose();
  }
  if (!merged) return new THREE.BufferGeometry();
  const welded = mergeVertices(merged, 1e-6);
  if (welded !== merged) merged.dispose();
  return normalizeAttributes(welded);
}


const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

export interface TransformOpts {
  x?: number; y?: number; z?: number;
  rx?: number; ry?: number; rz?: number;
  sx?: number; sy?: number; sz?: number;
}

/**
 * Assembly — collects transformed geometry per material, then merges each
 * bucket into one mesh. A whole rifle lands in 6-8 draw calls.
 */
export class Assembly {
  name: string;
  buckets = new Map<string, THREE.BufferGeometry[]>();
  nodes = new Map<string, { pos: number[]; rot: number[] }>();

  constructor(name: string) {
    this.name = name;
  }

  add(geo: THREE.BufferGeometry, matKey: string, t: TransformOpts | null = null): this {
    const g = geo.clone();
    if (t) {
      _v.set(t.x ?? 0, t.y ?? 0, t.z ?? 0);
      _e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0, 'XYZ');
      _q.setFromEuler(_e);
      _s.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
      _m4.compose(_v, _q, _s);
      g.applyMatrix4(_m4);
      if ((t.sx ?? 1) * (t.sy ?? 1) * (t.sz ?? 1) < 0) flipWinding(g);
    }
    normalizeAttributes(g);
    let list = this.buckets.get(matKey);
    if (!list) this.buckets.set(matKey, (list = []));
    list.push(g);
    return this;
  }

  addMirrored(geo: THREE.BufferGeometry, matKey: string, t: TransformOpts): this {
    this.add(geo, matKey, t);
    this.add(geo, matKey, { ...t, x: -(t.x ?? 0), sx: -(t.sx ?? 1) });
    return this;
  }

  node(name: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): this {
    this.nodes.set(name, { pos: [x, y, z], rot: [rx, ry, rz] });
    return this;
  }

  build(): Map<string, THREE.BufferGeometry> {
    const out = new Map<string, THREE.BufferGeometry>();
    for (const [mat, list] of this.buckets) {
      const merged = mergeAll(list);
      if (merged) out.set(mat, merged);
    }
    this.buckets.clear();
    return out;
  }
}
