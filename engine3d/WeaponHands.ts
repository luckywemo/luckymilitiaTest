import * as THREE from 'three';
import { box, blob, latheZ, rodZ, dome, extrude, roundRect, ring, mergeAll } from './WeaponGeometry';

const L_UPPER = 0.33;
const L_FORE = 0.3;

const THUMB = { l0: 0.05, l1: 0.032, r0: 0.0115, r1: 0.0102, r2: 0.0078 };

export interface HandMaterials {
  glove: THREE.Material;
  pad: THREE.Material;
  seam?: THREE.Material;
  sleeve: THREE.Material;
}

export interface ArmOpts {
  scale?: number;
  upper?: number;
  fore?: number;
  shoulderX?: number;
  shoulderY?: number;
  shoulderZ?: number;
  pose?: string;
}

interface FingerSpec {
  x: number;
  len: number[];
  r: number[];
}

interface FingerBuild {
  root: THREE.Object3D;
  joints: THREE.Object3D[];
}

interface ThumbBuild {
  root: THREE.Object3D;
  joints: THREE.Object3D[];
}

interface HandPose {
  fingers: number[][];
  thumb: number[];
  thumbBase?: number[];
}

export const HAND_POSES: Record<string, HandPose> = {
  grip: {
    fingers: [
      [0.55, 0.72, 0.34],
      [1.15, 1.2, 0.62],
      [1.2, 1.25, 0.65],
      [1.22, 1.28, 0.66],
    ],
    thumb: [0.5, 0.34],
    thumbBase: [0.15, -1.02, -0.62],
  },
  wrap: {
    fingers: [
      [1.18, 1.05, 0.45],
      [1.26, 1.12, 0.5],
      [1.3, 1.16, 0.55],
      [1.34, 1.2, 0.6],
    ],
    thumb: [0.42, 0.3],
    thumbBase: [0.1, -1.15, -0.35],
  },
  clamp: {
    fingers: [
      [0.612, 1.059, 0.797],
      [0.731, 1.286, 0.863],
      [0.73, 1.268, 0.808],
      [0.601, 1.105, 0.684],
    ],
    thumb: [0.3, 0.24],
    thumbBase: [0.04, 0.76, -0.05],
  },
  cup: {
    fingers: [
      [1.05, 0.95, 0.4],
      [1.12, 1.0, 0.44],
      [1.16, 1.04, 0.48],
      [1.2, 1.08, 0.52],
    ],
    thumb: [0.28, 0.2],
    thumbBase: [0.0, -1.25, -0.2],
  },
  open: {
    fingers: [
      [0.35, 0.28, 0.14],
      [0.32, 0.26, 0.12],
      [0.34, 0.28, 0.14],
      [0.4, 0.32, 0.16],
    ],
    thumb: [0.12, 0.1],
    thumbBase: [0.1, -0.8, -0.35],
  },
  pinch: {
    fingers: [
      [0.95, 0.85, 0.55],
      [1.0, 0.9, 0.6],
      [0.7, 0.6, 0.35],
      [0.6, 0.5, 0.3],
    ],
    thumb: [0.62, 0.55],
    thumbBase: [0.25, -0.75, -0.7],
  },
};

/* -------------------------------------------------------------------------- */
/*  geometry helpers                                                          */
/* -------------------------------------------------------------------------- */

function segment(len: number, r0: number, r1: number): THREE.BufferGeometry {
  const g = latheZ([
    [0, 0],
    [0, r0 * 0.86],
    [r0 * 0.5, r0],
    [len * 0.42, r0 * 0.99],
    [len * 0.55, r1 * 1.04],
    [len - r1 * 0.7, r1],
    [len - r1 * 0.2, r1 * 0.8],
    [len, r1 * 0.35],
    [len, 0],
  ], 12);
  g.scale(1, 0.88, 1);
  g.rotateY(Math.PI);
  return g;
}

function segmentPad(len: number, r: number): THREE.BufferGeometry {
  const g = blob(r * 1.55, r * 0.55, len * 0.78, r * 0.25, 2);
  g.translate(0, r * 0.78, -len * 0.46);
  return g;
}

function segmentSeam(len: number, r0: number, r1: number, sx: number): THREE.BufferGeometry {
  const g = box(0.0015, (r0 + r1) * 0.34, len * 0.86, 0.0003, 1);
  g.translate(sx * (r0 + r1) * 0.49, r0 * 0.1, -len * 0.47);
  return g;
}

function buildFinger(materials: HandMaterials, spec: {
  lengths: number[]; radii: number[]; curl: number[]; seamSide?: number;
}): FingerBuild {
  const { lengths, radii, curl, seamSide } = spec;
  const root = new THREE.Object3D();
  const joints: THREE.Object3D[] = [];
  let parent = root;
  for (let i = 0; i < 3; i++) {
    const j = new THREE.Object3D();
    j.rotation.x = -curl[i];
    parent.add(j);
    const geo = mergeAll([segment(lengths[i], radii[i], radii[i + 1])]);
    const mesh = new THREE.Mesh(geo, materials.glove);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    j.add(mesh);
    if (i < 2) {
      const seams = mergeAll(
        (seamSide ?? 0) === 0
          ? [
              segmentSeam(lengths[i], radii[i], radii[i + 1], 1),
              segmentSeam(lengths[i], radii[i], radii[i + 1], -1),
            ]
          : [segmentSeam(lengths[i], radii[i], radii[i + 1], seamSide)]
      );
      j.add(new THREE.Mesh(seams, materials.seam ?? materials.glove));
    }
    if (i < 2) {
      const pad = new THREE.Mesh(segmentPad(lengths[i], radii[i]), materials.pad);
      j.add(pad);
    } else {
      const tip = blob(radii[i] * 1.5, radii[i] * 0.5, lengths[i] * 0.7, radii[i] * 0.2, 2);
      tip.translate(0, -radii[i] * 0.72, -lengths[i] * 0.45);
      j.add(new THREE.Mesh(tip, materials.pad));
    }
    const next = new THREE.Object3D();
    next.position.z = -lengths[i];
    j.add(next);
    parent = next;
    joints.push(j);
  }
  return { root, joints };
}

function buildGlove(materials: HandMaterials, opts: { scale?: number } = {}): THREE.Object3D {
  const scale = opts.scale ?? 1;
  const w = 0.088 * scale;
  const h = 0.032 * scale;
  const palmLen = 0.098 * scale;
  const root = new THREE.Object3D();

  const shell: THREE.BufferGeometry[] = [];
  const palm = blob(w, h, palmLen * 0.62, 0.012 * scale, 3);
  palm.translate(0, 0, -palmLen * 0.66);
  shell.push(palm);
  const palmRear = blob(w * 0.83, h * 0.96, palmLen * 0.52, 0.012 * scale, 3);
  palmRear.translate(0, -h * 0.01, -palmLen * 0.26);
  shell.push(palmRear);
  const thenar = blob(w * 0.42, h * 0.92, palmLen * 0.6, 0.014 * scale, 3);
  thenar.translate(w * 0.3, -h * 0.06, -palmLen * 0.3);
  shell.push(thenar);
  const heel = blob(w * 0.92, h * 0.86, 0.03 * scale, 0.012 * scale, 3);
  heel.translate(0, -h * 0.04, -0.012 * scale);
  shell.push(heel);
  for (let i = 0; i < 4; i++) {
    const x = w * (0.34 - i * 0.225);
    const k = dome(0.0072 * scale, 10, 0.62);
    k.rotateX(-Math.PI / 2);
    k.translate(x, h * 0.42, -palmLen * 0.94);
    shell.push(k);
  }
  const glove = new THREE.Mesh(mergeAll(shell), materials.glove);
  root.add(glove);

  const pads: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const x = w * (0.335 - i * 0.223);
    const cap = blob(w * 0.17, h * 0.3, palmLen * 0.3, 0.005 * scale, 3);
    const drop = Math.abs(i - 1.5) > 1 ? h * 0.055 : 0;
    cap.translate(x, h * 0.46 - drop, -palmLen * 0.82);
    pads.push(cap);
  }
  const backPanel = blob(w * 0.44, h * 0.17, palmLen * 0.22, 0.005 * scale, 3);
  backPanel.translate(0, h * 0.44, -palmLen * 0.4);
  pads.push(backPanel);
  const patch = blob(w * 0.82, h * 0.18, palmLen * 0.66, 0.006 * scale, 3);
  patch.translate(0, -h * 0.52, -palmLen * 0.48);
  pads.push(patch);
  root.add(new THREE.Mesh(mergeAll(pads), materials.pad));

  const seams: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const s = box(0.0016 * scale, h * 0.5, palmLen * 0.8, 0.0004, 1);
    s.translate(sx * w * 0.5, 0, -palmLen * 0.5);
    seams.push(s);
  }
  root.add(new THREE.Mesh(mergeAll(seams), materials.pad));

  const cuff = latheZ([
    [0, w * 0.44],
    [0.004 * scale, w * 0.47],
    [0.03 * scale, w * 0.46],
    [0.034 * scale, w * 0.42],
  ], 16);
  cuff.scale(1, 0.82, 1);
  const cuffMesh = new THREE.Mesh(cuff, materials.glove);
  cuffMesh.position.z = 0.004 * scale;
  root.add(cuffMesh);
  const strap = latheZ([
    [0, w * 0.47],
    [0.0022, w * 0.5],
    [0.009 * scale, w * 0.5],
    [0.0112 * scale, w * 0.47],
  ], 16);
  strap.scale(1, 0.82, 1);
  const strapMesh = new THREE.Mesh(strap, materials.pad);
  strapMesh.position.z = 0.02 * scale;
  root.add(strapMesh);

  return root;
}

function buildThumb(materials: HandMaterials, scale = 1, spec = THUMB): ThumbBuild {
  const root = new THREE.Object3D();
  const j1 = new THREE.Object3D();
  root.add(j1);
  const s1 = new THREE.Mesh(segment(spec.l0 * scale, spec.r0 * scale, spec.r1 * scale), materials.glove);
  j1.add(s1);
  j1.add(new THREE.Mesh(segmentPad(spec.l0 * scale, spec.r0 * scale), materials.pad));
  j1.add(
    new THREE.Mesh(
      mergeAll([
        segmentSeam(spec.l0 * scale, spec.r0 * scale, spec.r1 * scale, 1),
        segmentSeam(spec.l0 * scale, spec.r0 * scale, spec.r1 * scale, -1),
      ]),
      materials.seam ?? materials.glove
    )
  );
  const j2 = new THREE.Object3D();
  j2.position.z = -spec.l0 * scale;
  j1.add(j2);
  const s2 = new THREE.Mesh(segment(spec.l1 * scale, spec.r1 * scale, spec.r2 * scale), materials.glove);
  j2.add(s2);
  const pad = blob(spec.r2 * 1.6 * scale, spec.r2 * 0.55 * scale, spec.l1 * 0.66 * scale, 0.0012, 2);
  pad.translate(0, -spec.r2 * 0.78 * scale, -spec.l1 * 0.45 * scale);
  j2.add(new THREE.Mesh(pad, materials.pad));
  const nail = blob(0.011 * scale, 0.0035 * scale, 0.016 * scale, 0.0012, 2);
  nail.translate(0, spec.r2 * scale, -0.016 * scale);
  j2.add(new THREE.Mesh(nail, materials.pad));
  return { root, joints: [j1, j2] };
}

function buildSleeve(material: THREE.Material, len: number, r0: number, r1: number, opts: {
  folds?: number; elbowPad?: boolean; cuff?: boolean;
} = {}): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const SEG = 32;
  const shell = latheZ([
    [0, 0],
    [0, r0 * 0.55],
    [-0.004, r0 * 0.82],
    [-0.006, r0 * 0.98],
    [0.004, r0],
    [len * 0.16, r0 * 1.03],
    [len * 0.34, r0 * 0.9],
    [len * 0.52, (r0 + r1) * 0.5],
    [len * 0.72, r1 * 1.1],
    [len - 0.016, r1 * 1.0],
    [len - 0.005, r1 * 1.07],
    [len, r1 * 0.98],
    [len + 0.003, r1 * 0.8],
    [len + 0.004, 0],
  ], SEG);
  parts.push(shell);
  const joint = latheZ([
    [len - r1 * 1.1, 0],
    [len - r1 * 0.9, r1 * 0.75],
    [len - r1 * 0.2, r1 * 1.04],
    [len + r1 * 0.5, r1 * 0.9],
    [len + r1 * 0.8, r1 * 0.4],
    [len + r1 * 0.85, 0],
  ], 20);
  joint.scale(1, 0.94, 1);
  parts.push(joint);
  const folds = opts.folds ?? 3;
  for (let i = 0; i < folds; i++) {
    const t = 0.14 + (i / Math.max(1, folds - 1)) * 0.7;
    const j = Math.sin(i * 2.399 + 0.7) * 0.5 + Math.sin(i * 5.13) * 0.25;
    const r = (r0 + (r1 - r0) * t) * (1 + j * 0.06);
    const f = ring(r * 0.985, r * (0.085 + j * 0.03), 24, 6);
    f.rotateX(Math.PI / 2);
    f.rotateY(j * 0.12);
    f.scale(1, 0.93, 1);
    f.translate(0, 0, len * t + j * 0.004);
    parts.push(f);
  }
  for (const sx of [-1, 1]) {
    const w = latheZ([
      [len * 0.2, 0],
      [len * 0.3, r0 * 0.16],
      [len * 0.55, r0 * 0.2],
      [len * 0.78, r0 * 0.13],
      [len * 0.86, 0],
    ], 10);
    w.scale(1, 0.5, 1);
    w.rotateZ(sx * 0.4);
    w.translate(sx * (r0 + r1) * 0.46, -(r0 + r1) * 0.1, 0);
    parts.push(w);
  }
  if (opts.elbowPad) {
    const pad = blob(r0 * 1.5, r0 * 0.6, len * 0.3, r0 * 0.3, 3);
    pad.translate(0, r0 * 0.75, len * 0.12);
    parts.push(pad);
  }
  if (opts.cuff) {
    const cuff = latheZ([
      [len - 0.032, r1 * 1.02],
      [len - 0.029, r1 * 1.17],
      [len - 0.019, r1 * 1.16],
      [len - 0.016, r1 * 1.08],
      [len - 0.012, r1 * 1.08],
      [len - 0.009, r1 * 1.18],
      [len - 0.003, r1 * 1.17],
      [len, r1 * 1.02],
    ], SEG);
    parts.push(cuff);
  }
  const g = mergeAll(parts);
  g.rotateY(Math.PI);
  return new THREE.Mesh(g, material);
}

/* -------------------------------------------------------------------------- */
/*  arm rig                                                                   */
/* -------------------------------------------------------------------------- */

const _t = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _elbow = new THREE.Vector3();
const _up = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _hp = new THREE.Vector3();
const _bx = new THREE.Vector3();
const _by = new THREE.Vector3();
const _bz = new THREE.Vector3();
const _bm = new THREE.Matrix4();
const _fitInv = new THREE.Matrix4();
const _fitP = new THREE.Vector3();
const _fitD = new THREE.Vector3();
const _fitAxis = new THREE.Vector3();
const _fitAx0 = new THREE.Vector3();
const _fitM = new THREE.Matrix4();

function aimBone(quat: THREE.Quaternion, dir: THREE.Vector3, up: THREE.Vector3): THREE.Quaternion {
  _bz.copy(dir).multiplyScalar(-1).normalize();
  _by.copy(up);
  _by.addScaledVector(_bz, -_by.dot(_bz));
  if (_by.lengthSq() < 1e-9) {
    _by.set(0, 1, 0).addScaledVector(_bz, -_bz.y);
    if (_by.lengthSq() < 1e-9) _by.set(1, 0, 0).addScaledVector(_bz, -_bz.x);
  }
  _by.normalize();
  _bx.crossVectors(_by, _bz).normalize();
  _bm.makeBasis(_bx, _by, _bz);
  return quat.setFromRotationMatrix(_bm);
}

export class Arm {
  side: number;
  scale: number;
  l1: number;
  l2: number;
  root: THREE.Object3D;
  shoulder: THREE.Vector3;
  pole: THREE.Vector3;
  upper: THREE.Mesh;
  fore: THREE.Mesh;
  upperPivot: THREE.Object3D;
  forePivot: THREE.Object3D;
  hand: THREE.Object3D;
  handInner: THREE.Object3D;
  glove: THREE.Object3D;
  fingers: FingerBuild[];
  thumb: ThumbBuild;
  _mats: HandMaterials;
  _segRadius: number[][];
  _segLength: number[][];
  poses: Record<string, HandPose> = {};
  pose: string = 'wrap';

  constructor(side: number, materials: HandMaterials, opts: ArmOpts = {}) {
    this.side = side;
    this.scale = opts.scale ?? 1;
    this.l1 = (opts.upper ?? L_UPPER) * this.scale;
    this.l2 = (opts.fore ?? L_FORE) * this.scale;

    this.root = new THREE.Object3D();
    this.root.name = side < 0 ? 'arm-left' : 'arm-right';
    this._mats = materials;

    this.shoulder = new THREE.Vector3(
      side * (opts.shoulderX ?? 0.19),
      opts.shoulderY ?? -0.19,
      opts.shoulderZ ?? 0.12
    );
    this.pole = new THREE.Vector3(side * 0.46, -0.86, 0.22).normalize();

    this.upper = buildSleeve(materials.sleeve, this.l1, 0.044 * this.scale, 0.036 * this.scale, {
      folds: 5, elbowPad: true,
    });
    this.fore = buildSleeve(materials.sleeve, this.l2, 0.034 * this.scale, 0.024 * this.scale, {
      folds: 7, cuff: true,
    });
    this.upperPivot = new THREE.Object3D();
    this.forePivot = new THREE.Object3D();
    this.upperPivot.add(this.upper);
    this.forePivot.add(this.fore);
    this.root.add(this.upperPivot);
    this.root.add(this.forePivot);

    this.hand = new THREE.Object3D();
    this.hand.name = side < 0 ? 'hand-left' : 'hand-right';
    this.handInner = new THREE.Object3D();
    this.handInner.scale.x = side < 0 ? 1 : -1;
    this.hand.add(this.handInner);
    this.glove = buildGlove(materials, { scale: this.scale });
    this.handInner.add(this.glove);
    this.root.add(this.hand);

    const fingerSpecs: FingerSpec[] = [
      { x: 0.0298, len: [0.045, 0.028, 0.022], r: [0.0102, 0.0096, 0.0086, 0.0062] },
      { x: 0.0102, len: [0.049, 0.031, 0.023], r: [0.0104, 0.0098, 0.0088, 0.0064] },
      { x: -0.0104, len: [0.046, 0.029, 0.022], r: [0.01, 0.0094, 0.0084, 0.006] },
      { x: -0.0298, len: [0.038, 0.024, 0.02], r: [0.0092, 0.0086, 0.0078, 0.0056] },
    ];
    this.fingers = [];
    this._segRadius = fingerSpecs.map((s) => s.r.map((v) => v * this.scale));
    this._segLength = fingerSpecs.map((s) => s.len.map((v) => v * this.scale));
    for (let i = 0; i < 4; i++) {
      const sp = fingerSpecs[i];
      const f = buildFinger(materials, {
        lengths: sp.len.map((v) => v * this.scale),
        radii: sp.r.map((v) => v * this.scale),
        curl: [0, 0, 0],
      });
      f.root.position.set(sp.x * this.scale, -0.006 * this.scale, -0.096 * this.scale);
      f.root.rotation.y = -sp.x * 2.2;
      this.glove.add(f.root);
      this.fingers.push(f);
    }
    this.thumb = buildThumb(materials, this.scale, THUMB);
    this.thumb.root.position.set(0.037 * this.scale, -0.009 * this.scale, -0.04 * this.scale);
    this.thumb.root.rotation.set(0.2, -0.95, -0.5);
    this.glove.add(this.thumb.root);

    this.root.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });

    this.setPose(opts.pose ?? 'wrap');
  }

  fitToCylinder(
    handPos: THREE.Vector3,
    handQuat: THREE.Quaternion,
    axisPoint: number[],
    axisDir: number[],
    radius: number,
    opts: { clearance?: number; poseName?: string } = {}
  ): THREE.Vector3[] {
    const clearance = opts.clearance ?? 0.001;
    const poseName = opts.poseName ?? this.pose;
    const base = this.poses[poseName] ?? HAND_POSES[poseName] ?? HAND_POSES.clamp;

    this.hand.position.copy(handPos);
    this.hand.quaternion.copy(handQuat);
    this.root.updateMatrixWorld(true);
    _fitInv.copy(this.root.matrixWorld).invert();
    _fitAxis.set(axisDir[0], axisDir[1], axisDir[2]).normalize();
    const ax0 = _fitAx0.set(axisPoint[0], axisPoint[1], axisPoint[2]);

    const gapAt = (joint: THREE.Object3D, lx: number, ly: number, lz: number, out?: THREE.Vector3): number => {
      joint.updateWorldMatrix(true, true);
      _fitP.set(lx, ly, lz).applyMatrix4(joint.matrixWorld).applyMatrix4(_fitInv);
      if (out) out.copy(_fitP);
      _fitD.copy(_fitP).sub(ax0);
      _fitD.addScaledVector(_fitAxis, -_fitD.dot(_fitAxis));
      return _fitD.length() - radius;
    };

    const fitJoint = (joint: THREE.Object3D, local: number[], lo: number, hi: number, standoff = 0): number => {
      let best = joint.rotation.x;
      let bestCost = Infinity;
      for (let i = 0; i <= 48; i++) {
        const a = lo + ((hi - lo) * i) / 48;
        joint.rotation.x = a;
        const g = gapAt(joint, local[0], local[1], local[2]) - standoff;
        const cost = Math.abs(g - clearance * 0.5) + (g < -0.0015 ? (-g - 0.0015) * 8 : 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = a;
        }
      }
      joint.rotation.x = best;
      return best;
    };

    const fingers: number[][] = [];
    const contacts: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) {
      const f = this.fingers[i];
      const curl = base.fingers[i].slice();
      for (let j = 0; j < 3; j++) f.joints[j].rotation.x = -curl[j];
      const rr = this._segRadius?.[i] ?? [0.01, 0.0094, 0.0084, 0.006];
      const ll = this._segLength?.[i] ?? [0.046, 0.029, 0.022];
      for (let j = 0; j < 2; j++) {
        const a = fitJoint(f.joints[j], [0, 0, -ll[j]], -1.75, -0.05, rr[j + 1] * 0.92);
        curl[j] = -a;
      }
      const local = [0, -rr[3] * 1.05, -ll[2] * 0.5];
      const a2 = fitJoint(f.joints[2], local, -1.95, -0.1, 0);
      curl[2] = -a2;
      fingers.push(curl);
      const p = new THREE.Vector3();
      gapAt(f.joints[2], local[0], local[1], local[2], p);
      contacts.push(p);
    }

    const thumbBase = (base.thumbBase ?? [0, 0, 0]).slice();
    const thumb = (base.thumb ?? [0.3, 0.24]).slice();
    this.thumb.root.rotation.set(thumbBase[0] ?? 0, thumbBase[1] ?? 0, thumbBase[2] ?? 0);
    this.thumb.joints[0].rotation.x = -thumb[0];
    this.thumb.joints[1].rotation.x = -thumb[1];
    const tr = THUMB.r2 * this.scale;
    const tlen = THUMB.l1 * this.scale;
    const tLocal = [0, -tr * 1.05, -tlen * 0.55];
    {
      this.thumb.joints[0].rotation.x = -0.55;
      this.thumb.joints[1].rotation.x = -0.45;
      const y0 = thumbBase[1];
      const z0 = thumbBase[2];
      let bestY = y0;
      let bestZ = z0;
      let bestCost = Infinity;
      for (let i = 0; i <= 20; i++) {
        const yy = y0 - 1.3 + (2.6 * i) / 20;
        for (let k = 0; k <= 14; k++) {
          const zz = z0 - 0.9 + (1.8 * k) / 14;
          this.thumb.root.rotation.y = yy;
          this.thumb.root.rotation.z = zz;
          const g = gapAt(this.thumb.joints[1], tLocal[0], tLocal[1], tLocal[2]);
          const cost =
            Math.abs(g - clearance) +
            (g < -0.002 ? (-g - 0.002) * 10 : 0) +
            (Math.abs(yy - y0) + Math.abs(zz - z0)) * 0.0009;
          if (cost < bestCost) {
            bestCost = cost;
            bestY = yy;
            bestZ = zz;
          }
        }
      }
      this.thumb.root.rotation.y = bestY;
      this.thumb.root.rotation.z = bestZ;
      thumbBase[1] = bestY;
      thumbBase[2] = bestZ;
    }
    const a0 = fitJoint(
      this.thumb.joints[0],
      [0, 0, -THUMB.l0 * this.scale],
      -1.45, -0.02, THUMB.r1 * this.scale
    );
    thumb[0] = -a0;
    const a1 = fitJoint(this.thumb.joints[1], tLocal, -1.6, -0.05, 0);
    thumb[1] = -a1;
    const tp = new THREE.Vector3();
    gapAt(this.thumb.joints[1], tLocal[0], tLocal[1], tLocal[2], tp);
    contacts.push(tp);

    this.poses[poseName] = { fingers, thumb, thumbBase };
    this.pose = poseName;
    return contacts;
  }

  bakeSurfaceMasks(
    bake: ((geo: THREE.BufferGeometry, o: any) => void) | null,
    shape: (geo: THREE.BufferGeometry, o: any) => void,
    rng: any = null
  ): this {
    if (!bake) return this;
    const m = this._mats ?? ({} as HandMaterials);
    const CLOTH = { wearAmp: 0.5, wearExp: 1.6, grimeAmp: 1.0, grimeExp: 1.15, aoAmp: 0.9, aoExp: 1.1 };
    const SLEEVE = { wearAmp: 0.62, wearExp: 1.5, grimeAmp: 1.0, grimeExp: 1.0, aoAmp: 0.95, aoExp: 1.0 };
    const PAD = { wearAmp: 0.85, wearExp: 2.2, grimeAmp: 0.95, grimeExp: 1.4, aoAmp: 1.0, aoExp: 1.2 };
    const SEAM = { wearAmp: 1.0, wearExp: 2.6, grimeAmp: 0.7, grimeExp: 1.6, aoAmp: 0.8, aoExp: 1.2 };
    const done = new Set<THREE.BufferGeometry>();
    this.root.traverse((o: any) => {
      if (!o.isMesh || done.has(o.geometry)) return;
      done.add(o.geometry);
      const prof =
        o.material === m.sleeve ? SLEEVE
          : o.material === m.pad ? PAD
            : o.material === m.seam ? SEAM
              : CLOTH;
      bake(o.geometry, { wear: 1, grime: 1, ao: 1, edgeThreshold: 0.09, rng });
      shape(o.geometry, prof);
    });
    return this;
  }

  bakeContactAO(contacts: THREE.Vector3[] | null, radius = 0.012, peak = 0.9): this {
    if (!contacts?.length) return this;
    this.root.updateMatrixWorld(true);
    _fitInv.copy(this.root.matrixWorld).invert();
    const r2 = radius * radius;
    this.glove.traverse((o: any) => {
      if (!o.isMesh) return;
      const geo = o.geometry;
      const pos = geo.getAttribute('position');
      if (!pos) return;
      let col = geo.getAttribute('color');
      if (!col || col.itemSize !== 3) {
        col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
        geo.setAttribute('color', col);
      }
      _fitM.multiplyMatrices(_fitInv, o.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        _fitP.fromBufferAttribute(pos, i).applyMatrix4(_fitM);
        let closest = Infinity;
        for (const c of contacts) {
          const d2 = _fitP.distanceToSquared(c);
          if (d2 < closest) closest = d2;
        }
        if (closest > r2) continue;
        const t = 1 - Math.sqrt(closest) / radius;
        const s = t * t * t * (t * (t * 6 - 15) + 10);
        col.array[i * 3 + 2] = Math.max(col.array[i * 3 + 2], peak * s);
      }
      col.needsUpdate = true;
    });
    return this;
  }

  setPose(name: string): this {
    const P = this.poses?.[name] ?? HAND_POSES[name] ?? HAND_POSES.wrap;
    for (let i = 0; i < 4; i++) {
      const curl = P.fingers[i];
      for (let j = 0; j < 3; j++) this.fingers[i].joints[j].rotation.x = -curl[j];
    }
    this.thumb.joints[0].rotation.x = -P.thumb[0];
    this.thumb.joints[1].rotation.x = -P.thumb[1];
    if (P.thumbBase) this.thumb.root.rotation.set(P.thumbBase[0], P.thumbBase[1], P.thumbBase[2]);
    this.pose = name;
    return this;
  }

  setTrigger(t: number): void {
    const f = this.fingers[0];
    f.joints[0].rotation.x = -(0.55 + t * 0.3);
    f.joints[1].rotation.x = -(0.72 + t * 0.42);
    f.joints[2].rotation.x = -(0.34 + t * 0.3);
  }

  solve(targetPos: THREE.Vector3, targetQuat: THREE.Quaternion): this {
    this.hand.position.copy(targetPos);
    this.hand.quaternion.copy(targetQuat);

    _t.copy(targetPos).sub(this.shoulder);
    let d = _t.length();
    const maxD = (this.l1 + this.l2) * 0.995;
    const minD = Math.abs(this.l1 - this.l2) * 1.05 + 1e-4;
    if (d > maxD) {
      _t.multiplyScalar(maxD / d);
      d = maxD;
    } else if (d < minD) {
      if (d < 1e-5) _t.set(0, 0, -minD);
      else _t.multiplyScalar(minD / d);
      d = minD;
    }
    _dir.copy(_t).divideScalar(d);

    const a = (this.l1 * this.l1 - this.l2 * this.l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, this.l1 * this.l1 - a * a));
    _pole.copy(this.pole);
    _perp.copy(_pole).addScaledVector(_dir, -_pole.dot(_dir));
    if (_perp.lengthSq() < 1e-8) {
      _perp.set(this.side, -1, 0).addScaledVector(_dir, 0);
      _perp.addScaledVector(_dir, -_perp.dot(_dir));
    }
    _perp.normalize();
    _elbow.copy(this.shoulder).addScaledVector(_dir, a).addScaledVector(_perp, h);

    this.upperPivot.position.copy(this.shoulder);
    _hp.copy(_elbow).sub(this.shoulder);
    if (_hp.lengthSq() > 1e-12) aimBone(this.upperPivot.quaternion, _hp, _perp);

    this.forePivot.position.copy(_elbow);
    _up.set(0, 1, 0).applyQuaternion(targetQuat);
    _hp.copy(targetPos).sub(_elbow);
    if (_hp.lengthSq() > 1e-12) aimBone(this.forePivot.quaternion, _hp, _up);
    return this;
  }

  dispose(): void {
    this.root.traverse((o: any) => {
      if (o.isMesh) o.geometry.dispose();
    });
  }
}
