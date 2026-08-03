import * as THREE from 'three';
import { Assembly, box, blob, extrude, roundRect, latheZ, rodZ, tubeZ, dome, mergeAll } from './WeaponGeometry';
import {
  addBarrel, addGasBlock, addMuzzleDevice, addHandguard, addUpperReceiver,
  addLowerReceiver, addBoltCarrier, addRail, addPistolGrip, addCarbineStock,
  addFrontSight, addRearSight, addRollmark, addQdSocket, addSlingLoop,
  addPin, addScrew, addForeGrip, buildMagazine, buildOptic, buildMiniReflex,
  buildSlide, chargingHandlePart, selectorPart, triggerPart, cartridge,
} from './WeaponParts';

/** Shared node / return types for weapon models. */

export interface OpticInfo {
  center: [number, number, number];
  lensZ: number;
  apertureR: number;
  tubeR?: number;
  len?: number;
  windowW?: number;
  windowH?: number;
  tilt?: number;
}

export interface HandTarget {
  pos: [number, number, number];
  finger: [number, number, number];
  back: [number, number, number];
}

export interface NodeMap {
  muzzle: [number, number, number];
  chamber: [number, number, number];
  eject: [number, number, number];
  ejectDir: [number, number, number];
  sight: [number, number, number];
  sightAxis: [number, number, number];
  ironSight: [number, number, number];
  gripR: HandTarget;
  gripL: HandTarget;
  magSeat: { pos: [number, number, number]; rot: [number, number, number] };
  magDrop: [number, number, number];
  triggerPivot: { pos: [number, number, number]; rot: [number, number, number] };
  triggerPull: number;
  selectorPivot?: { pos: [number, number, number]; rot: [number, number, number] };
  opticGlass: OpticInfo;
  [key: string]: any;
}

export interface WeaponModel {
  id: string;
  label: string;
  fxClass: string;
  body: Assembly;
  moving: Record<string, Assembly>;
  nodes: NodeMap;
  shell: { caseLen: number; rimR: number };
  magSize: { len: number; w: number; d: number };
}

/* -------------------------------------------------------------------------- */
/*  rifle                                                                     */
/* -------------------------------------------------------------------------- */

export function buildRifle(): WeaponModel {
  const bore = 0.075;
  const rUpper = 0.0192;
  const railTop = bore + 0.0286;
  const zUpperRear = 0.055;
  const zUpperFront = -0.143;
  const portZ = -0.052;
  const magZ = -0.058;
  const magTilt = 0.08;
  const hgZ0 = -0.145;
  const hgZ1 = -0.385;
  const hgR = 0.0235;
  const zBreech = -0.1;
  const zBarrelEnd = -0.44;
  const opticY = bore + 0.067;
  const opticZ = -0.022;

  const body = new Assembly('rifle-body');

  addUpperReceiver(body, 'alu', 'steel', 'cavity', {
    zRear: zUpperRear, zFront: zUpperFront, bore, r: rUpper, portZ, railTop,
  });

  addLowerReceiver(body, 'alu', 'steel', {
    bore, zRear: zUpperRear + 0.004, zFront: -0.088, w: 0.0245,
    magW: 0.0292, magD: 0.0672, magTop: 0.049, magBottom: 0.008,
    magZ, magTilt, triggerZ: -0.012, gripAngle: 0.38,
  });

  // Bolt catch
  const catchPaddle = extrude([
    [-0.012, -0.0035], [0.012, -0.0045], [0.014, 0.0035], [-0.012, 0.0045],
  ], 0.0042, { bevel: 0.0007 });
  body.add(catchPaddle, 'steel', { x: -0.0135, y: 0.0545, z: -0.018, ry: Math.PI / 2 });
  catchPaddle.dispose();
  const catchBoss = blob(0.006, 0.011, 0.014, 0.0018, 2);
  body.add(catchBoss, 'alu', { x: -0.0128, y: 0.0555, z: -0.0085 });
  catchBoss.dispose();

  // Mag release
  const relFence = blob(0.0075, 0.016, 0.019, 0.0022, 2);
  body.add(relFence, 'alu', { x: 0.0132, y: 0.0505, z: -0.0295 });
  relFence.dispose();
  const relButton = latheZ([
    [0, 0], [0, 0.0048], [0.0016, 0.0052], [0.0042, 0.0052], [0.0042, 0],
  ], 14);
  body.add(relButton, 'steel', { x: 0.0158, y: 0.0505, z: -0.0295, ry: Math.PI / 2 });
  relButton.dispose();
  addPin(body, 'steel', 0, 0.0555, -0.083, 0.0028, 0.0252);
  addPin(body, 'steel', 0, 0.0555, 0.0455, 0.0028, 0.0252);

  addRollmark(body, 'cavity', { x: -0.0149, y: 0.0355, z: -0.031, h: 0.0036 });
  addRollmark(body, 'cavity', {
    x: -0.0149, y: 0.0272, z: -0.033, h: 0.0024, pitch: 0.0014,
    pattern: [2, 3, 1, 0, 2, 2, 3, 0, 3, 2],
  });

  // Barrel, gas, muzzle
  addBarrel(body, 'steel', 'cavity', {
    y: bore, zBreech, zMuzzle: zBarrelEnd, rChamber: 0.0112, rBarrel: 0.0077, rGas: 0.0098, gasAt: -0.3,
  });
  addGasBlock(body, 'steel_soot', {
    y: bore, z: -0.3, rBarrel: 0.0077, tubeTo: -0.15, w: 0.021, h: 0.0195,
  });
  const muzzle = addMuzzleDevice(body, 'steel_soot', 'cavity', 'brake', zBarrelEnd, 0.0077, bore);

  // Handguard
  const handZ = -0.235;
  addHandguard(body, 'alu', {
    matPanel: 'polymer', y: bore, z0: hgZ0, z1: hgZ1, r: hgR,
    sides: 8, slatW: 0.0166, slatT: 0.0036, slots: 4, braces: 3,
    topFrom: handZ + 0.048, topTo: hgZ1 + 0.056,
  });
  addRail(body, 'alu', hgZ1 + 0.004, hgZ0 - 0.002, railTop);
  addQdSocket(body, 'alu', 'steel', -hgR + 0.001, bore - 0.008, hgZ0 - 0.035, 'x', 0.005);
  addSlingLoop(body, 'steel', 0, bore - hgR - 0.0015, hgZ1 + 0.03, 0.0075, { rx: Math.PI / 2, ry: Math.PI / 2 });

  // Furniture
  addPistolGrip(body, 'polymer', 'rubber', { y: 0.035, z: 0.015, angle: 0.38, len: 0.108, w: 0.031 });
  addCarbineStock(body, 'alu', 'polymer', 'rubber', { bore, zFront: zUpperRear + 0.003, zRear: 0.245, y: bore - 0.012 });

  // Optic
  const optic = buildOptic(body, {
    rTube: 0.0155, len: 0.052, hood: 0.007, y: opticY, z: opticZ, railTop, matBody: 'alu_fine', matSteel: 'steel',
  });

  // BUIS
  addFrontSight(body, 'polymer', 'alu', 0, railTop, -0.358, false);
  addRearSight(body, 'polymer', 'alu', 0, railTop, -0.112, false);

  // Moving parts
  const magazine = new Assembly('rifle-mag');
  const mag = buildMagazine(magazine, null, {
    w: 0.0255, d: 0.0655, len: 0.212, curve: 0.03, segs: 8, witness: 4, poly: 'polymer',
  });

  const charging = new Assembly('rifle-charging');
  const chG = chargingHandlePart();
  charging.add(chG, 'alu', {});
  chG.dispose();

  const bolt = new Assembly('rifle-bolt');
  addBoltCarrier(bolt, 'steel_bright', { r: 0.0152, len: 0.092, z: 0 });
  const chamberRound = cartridge(0.0446, 0.00495, 0.019);
  bolt.add(chamberRound.brass, 'brass', { z: -0.09, ry: Math.PI, y: 0 });
  chamberRound.brass.dispose();
  chamberRound.bullet.dispose();

  const trigger = new Assembly('rifle-trigger');
  const trg = triggerPart('steel_bright');
  trigger.add(trg.geo, 'steel_bright', {});
  trg.geo.dispose();

  const selector = new Assembly('rifle-selector');
  const sel = selectorPart('alu', 'steel');
  selector.add(sel.geo, 'alu', {});
  sel.geo.dispose();
  const selR = selectorPart('alu', 'steel');
  selector.add(selR.geo, 'alu', { sx: -1 });
  selR.geo.dispose();

  return {
    id: 'rifle',
    label: 'M4A1',
    fxClass: 'carbine',
    body,
    moving: { magazine, charging, bolt, trigger, selector },
    nodes: {
      muzzle: [0, bore, muzzle.crownZ],
      chamber: [0, bore, portZ],
      eject: [rUpper + 0.008, bore + 0.003, portZ],
      ejectDir: [0.86, 0.44, 0.26],
      sight: [0, opticY, optic.lensZ],
      sightAxis: [0, 0, -1],
      ironSight: [0, railTop + 0.026, 0.038],
      gripR: { pos: [0.0251, 0.06, 0.1223], finger: [0.05, -0.55, -0.833], back: [1, 0.03, 0.04] },
      gripL: { pos: [-0.1, 0.0734, handZ + 0.0252], finger: [0.8977, -0.3267, -0.2955], back: [-0.2784, -0.7648, 0.581] },
      handguard: { axis: [0, bore, 0], dir: [0, 0, 1], r: hgR + 0.0036, z0: hgZ0, z1: hgZ1 },
      magSeat: { pos: [0, 0.061, magZ], rot: [magTilt, 0, 0] },
      magDrop: [0, -0.4, 0.02],
      chargeRest: { pos: [0, bore + rUpper - 0.0075, zUpperRear - 0.024], rot: [0, 0, 0] },
      chargePull: [0, 0, 0.082],
      boltRest: { pos: [0, bore, 0.021], rot: [0, 0, 0] },
      boltTravel: [0, 0, 0.062],
      triggerPivot: { pos: [0, 0.0455, -0.0055], rot: [0, 0, 0] },
      triggerPull: -0.34,
      selectorPivot: { pos: [0, 0.0525, 0.0205], rot: [0, 0, 0] },
      opticGlass: optic,
    },
    shell: { caseLen: 0.0446, rimR: 0.00495 },
    magSize: { len: mag.len, w: mag.w, d: mag.d },
  };
}

/* -------------------------------------------------------------------------- */
/*  pistol                                                                    */
/* -------------------------------------------------------------------------- */

export function buildPistol(): WeaponModel {
  const bore = 0.036;
  const slideH = 0.0248;
  const slideW = 0.0262;
  const slideLen = 0.183;
  const zSlideRear = 0.052;
  const zSlideFront = zSlideRear - slideLen;
  const gripAngle = 0.32;

  const body = new Assembly('pistol-frame');

  // Dust cover / frame rails
  const dust = extrude([
    [-slideW * 0.5 + 0.001, 0], [slideW * 0.5 - 0.001, 0],
    [slideW * 0.5 - 0.001, -0.0125], [slideW * 0.5 - 0.004, -0.016],
    [-slideW * 0.5 + 0.004, -0.016], [-slideW * 0.5 + 0.001, -0.0125],
  ], 0.108, { bevel: 0.001 });
  body.add(dust, 'polymer', { y: bore - 0.0075, z: -0.062 });
  dust.dispose();

  const frameCore = blob(slideW - 0.001, 0.05, 0.062, 0.004, 3);
  body.add(frameCore, 'polymer', { y: bore - 0.032, z: 0.012 });
  frameCore.dispose();

  const tang = extrude([
    [-0.008, 0], [0.03, -0.004], [0.032, -0.012], [-0.008, -0.014],
  ], slideW - 0.003, { bevel: 0.0012 });
  body.add(tang, 'polymer', { y: bore - 0.014, z: 0.034, ry: Math.PI / 2 });
  tang.dispose();

  addRail(body, 'polymer', -0.112, -0.058, bore - 0.0175, 0, {
    baseH: 0.0026, topH: 0.0024,
  });

  // Trigger guard
  const guardOuter = [
    [-0.024, 0], [0.026, 0], [0.028, -0.007], [0.024, -0.022],
    [0.013, -0.027], [-0.016, -0.027], [-0.024, -0.021],
  ];
  const guardInner = [
    [-0.019, -0.003], [0.021, -0.003], [0.0225, -0.009], [0.0185, -0.0205],
    [0.01, -0.0235], [-0.013, -0.0235], [-0.019, -0.0185],
  ];
  const guard = extrude(guardOuter, slideW - 0.004, { bevel: 0.001, holes: [guardInner] });
  body.add(guard, 'polymer', { y: bore - 0.0245, z: -0.03 });
  guard.dispose();

  // Grip
  addPistolGrip(body, 'polymer', 'rubber', { y: bore - 0.014, z: 0.016, angle: gripAngle, len: 0.113, w: 0.0305 });

  // Stippling
  const stipple: THREE.BufferGeometry[] = [];
  for (let r = 0; r < 9; r++) {
    for (let cIdx = 0; cIdx < 5; cIdx++) {
      const g = box(0.0024, 0.0024, 0.0009, 0.0003, 1);
      g.translate(-0.005 + cIdx * 0.0026 + (r % 2) * 0.0013, -0.012 - r * 0.0072, 0);
      stipple.push(g);
    }
  }
  const stippleG = mergeAll(stipple);
  for (const sx of [-1, 1]) {
    body.add(stippleG, 'polymer', {
      x: sx * 0.0152, y: bore - 0.016, z: 0.017,
      ry: sx * Math.PI * 0.5, rx: 0, rz: sx > 0 ? -gripAngle : gripAngle,
    });
  }
  stippleG.dispose();

  // Controls
  const relButton = latheZ([
    [0, 0], [0, 0.0042], [0.0015, 0.0048], [0.0038, 0.0048], [0.0038, 0],
  ], 12);
  body.add(relButton, 'polymer', { x: 0.0138, y: bore - 0.032, z: -0.014, ry: Math.PI / 2 });
  relButton.dispose();
  const stopLever = extrude([
    [-0.014, -0.0028], [0.012, -0.0035], [0.014, 0.0028], [-0.014, 0.0035],
  ], 0.0032, { bevel: 0.0005 });
  body.add(stopLever, 'steel', { x: -0.0132, y: bore - 0.0135, z: -0.022, ry: Math.PI / 2 });
  body.add(stopLever, 'steel', { x: 0.0132, y: bore - 0.0135, z: -0.022, ry: Math.PI / 2 });
  stopLever.dispose();
  const takedown = latheZ([
    [0, 0], [0, 0.0035], [0.0022, 0.004], [0.0022, 0],
  ], 12);
  body.add(takedown, 'steel', { x: -0.0138, y: bore - 0.0175, z: -0.046, ry: -Math.PI / 2 });
  takedown.dispose();

  // Barrel + recoil spring
  const barrel = latheZ([
    [0, 0], [0, 0.0082], [0.0016, 0.0088], [0.006, 0.0088],
    [0.0072, 0.0078], [0.0072, 0.0048],
  ], 18);
  body.add(barrel, 'steel_bright', { y: bore, z: zSlideFront + 0.0012, ry: Math.PI });
  barrel.dispose();
  const boreHole = tubeZ(0.0048, 0.0034, 0.03, 12, 0.0002);
  body.add(boreHole, 'cavity', { y: bore, z: zSlideFront + 0.012 });
  boreHole.dispose();
  const spring = latheZ([
    [0, 0.0032], [0, 0.0048], [0.004, 0.0048], [0.004, 0.0032],
  ], 12);
  body.add(spring, 'steel_bright', { y: bore - 0.0125, z: zSlideFront + 0.0025 });
  spring.dispose();

  // Moving parts
  const slideAsm = new Assembly('pistol-slide');
  const slide = buildSlide(slideAsm, { w: slideW, h: slideH, len: slideLen, mat: 'steel_black', zRear: zSlideRear });
  const reflex = buildMiniReflex(slideAsm, {
    w: 0.0246, h: 0.021, len: 0.0455, y: slideH * 0.5 + 0.0018, z: zSlideRear - 0.038, matBody: 'alu_fine',
  });
  const opticY = bore + slideH * 0.5 + 0.0018 + 0.021 * 0.56;
  const opticZ = zSlideRear - 0.038 + 0.0455 * 0.14;

  const magazine = new Assembly('pistol-mag');
  const mag = buildMagazine(magazine, null, {
    w: 0.0212, d: 0.0295, len: 0.108, curve: 0.004, segs: 5, witness: 3,
    caseLen: 0.0192, rimR: 0.00478, bulletLen: 0.0132, poly: 'polymer',
  });

  const trigger = new Assembly('pistol-trigger');
  const trg = triggerPart('polymer');
  trigger.add(trg.geo, 'polymer', {});
  trg.geo.dispose();
  const blade = extrude([
    [-0.0022, 0.003], [0.0022, 0.003], [0.0022, -0.016], [-0.0022, -0.017],
  ], 0.0028, { bevel: 0.0004 });
  trigger.add(blade, 'steel', { x: 0, y: -0.001, z: 0.0022 });
  blade.dispose();

  return {
    id: 'pistol',
    label: 'P-19',
    fxClass: 'pistol',
    body,
    moving: { magazine, trigger, slide: slideAsm },
    nodes: {
      muzzle: [0, bore, zSlideFront - 0.004],
      chamber: [0, bore, zSlideRear - 0.05],
      eject: [slideW * 0.5 + 0.004, bore + 0.005, zSlideRear - 0.05],
      ejectDir: [0.82, 0.52, 0.24],
      sight: [0, opticY, opticZ],
      sightAxis: [0, 0, -1],
      ironSight: [0, bore + slideH * 0.5 + 0.0065, zSlideRear - 0.012],
      gripR: { pos: [0.028, 0.003, 0.07], finger: [0, -0.315, -0.949], back: [0.98, 0, -0.2] },
      gripL: { pos: [-0.03, -0.012, 0.076], finger: [0.34, -0.28, -0.9], back: [0.15, 0.93, -0.33] },
      magSeat: { pos: [0, bore - 0.03, 0.019], rot: [-gripAngle, 0, 0] },
      magDrop: [0, -0.42, 0.05],
      slideRest: { pos: [0, bore, 0], rot: [0, 0, 0] },
      slideTravel: [0, 0, 0.0225],
      triggerPivot: { pos: [0, bore - 0.0135, -0.0165], rot: [0, 0, 0] },
      triggerPull: -0.3,
      opticGlass: reflex,
      slideGeom: slide,
    },
    shell: { caseLen: 0.0192, rimR: 0.00478 },
    magSize: { len: mag.len, w: mag.w, d: mag.d },
  };
}

/* -------------------------------------------------------------------------- */
/*  smg                                                                       */
/* -------------------------------------------------------------------------- */

export function buildSmg(): WeaponModel {
  const bore = 0.068;
  const rRec = 0.0158;
  const railTop = bore + 0.0245;
  const zRecRear = 0.062;
  const zRecFront = -0.112;
  const portZ = -0.042;
  const magZ = -0.052;
  const magTilt = 0.05;
  const hgZ0 = -0.114;
  const hgZ1 = -0.268;
  const hgR = 0.019;
  const zBarrelEnd = -0.3;
  const opticY = bore + 0.055;
  const opticZ = -0.008;

  const body = new Assembly('smg-body');

  // Receiver tube
  const rec = latheZ([
    [0, rRec * 0.55], [0, rRec * 0.99], [0.002, rRec],
    [zRecRear - zRecFront - 0.004, rRec], [zRecRear - zRecFront - 0.002, rRec * 0.96],
    [zRecRear - zRecFront, rRec * 0.6],
  ], 22);
  body.add(rec, 'alu', { y: bore, z: zRecRear, ry: Math.PI });
  rec.dispose();
  const deck = box(0.0225, 0.009, zRecRear - zRecFront - 0.004, 0.0009, 1);
  body.add(deck, 'alu', { y: bore + rRec - 0.003, z: (zRecRear + zRecFront) / 2 });
  deck.dispose();
  addRail(body, 'alu', zRecFront + 0.004, zRecRear - 0.004, railTop);

  // Cocking tube
  const cockTube = tubeZ(0.0072, 0.0052, 0.14, 14, 0.0004);
  body.add(cockTube, 'alu', { x: -rRec + 0.0028, y: bore + rRec - 0.007, z: -0.06 });
  cockTube.dispose();

  // Ejection port
  const portW = 0.03;
  const portH = 0.017;
  const cav = box(0.01, portH, portW, 0.0008, 1);
  body.add(cav, 'cavity', { x: rRec - 0.006, y: bore + 0.002, z: portZ, ry: Math.PI / 2 });
  cav.dispose();
  const lip = extrude(roundRect(portW + 0.004, portH + 0.004, 0.002, 3), 0.002, {
    bevel: 0.0005, holes: [roundRect(portW, portH, 0.0016, 3)],
  });
  body.add(lip, 'alu', { x: rRec - 0.0012, y: bore + 0.002, z: portZ, ry: Math.PI / 2 });
  lip.dispose();
  const carrier = latheZ([
    [0, rRec * 0.5], [0, rRec * 0.82], [0.07, rRec * 0.82], [0.07, rRec * 0.5],
  ], 16);
  body.add(carrier, 'steel_bright', { y: bore, z: portZ - 0.02 });
  carrier.dispose();

  // Lower
  const magW = 0.0242;
  const magD = 0.0345;
  const lowerBody = box(0.0245, 0.028, 0.13, 0.0016, 2);
  body.add(lowerBody, 'polymer', { y: bore - 0.0195, z: -0.02 });
  lowerBody.dispose();

  const wellH = 0.036;
  const well = extrude(roundRect(magW + 0.003, magD + 0.003, 0.005, 4), wellH, {
    bevel: 0.0011, holes: [roundRect(magW - 0.002, magD - 0.002, 0.004, 4)],
  });
  body.add(well, 'polymer', { y: bore - 0.038, z: magZ, rx: Math.PI / 2 + magTilt });
  well.dispose();
  const liner = extrude(roundRect(magW - 0.0022, magD - 0.0022, 0.004, 4), wellH - 0.004, {
    bevel: 0.0005, holes: [roundRect(magW - 0.005, magD - 0.005, 0.003, 4)],
  });
  body.add(liner, 'cavity', { y: bore - 0.038, z: magZ, rx: Math.PI / 2 + magTilt });
  liner.dispose();
  const flare = extrude(roundRect(magW + 0.007, magD + 0.008, 0.006, 4), 0.007, {
    bevel: 0.0012, holes: [roundRect(magW + 0.001, magD + 0.001, 0.004, 4)],
  });
  body.add(flare, 'polymer', { y: bore - 0.055, z: magZ + 0.0016, rx: Math.PI / 2 + magTilt });
  flare.dispose();

  // Trigger guard
  const guardOuter = [
    [-0.026, 0], [0.028, 0], [0.03, -0.006], [0.026, -0.021],
    [0.016, -0.026], [-0.018, -0.026], [-0.026, -0.02],
  ];
  const guardInner = [
    [-0.021, -0.003], [0.0225, -0.003], [0.0235, -0.008], [0.02, -0.0195],
    [0.013, -0.0225], [-0.015, -0.0225], [-0.0205, -0.018],
  ];
  const guard = extrude(guardOuter, 0.0155, { bevel: 0.0009, holes: [guardInner] });
  body.add(guard, 'polymer', { y: bore - 0.03, z: -0.008 });
  guard.dispose();

  // Ambi mag release
  for (const sx of [-1, 1]) {
    const paddle = extrude([
      [-0.008, -0.004], [0.009, -0.005], [0.01, 0.004], [-0.008, 0.005],
    ], 0.004, { bevel: 0.0006 });
    body.add(paddle, 'alu', { x: sx * 0.0132, y: bore - 0.026, z: -0.03, ry: Math.PI / 2 });
    paddle.dispose();
  }

  addPistolGrip(body, 'polymer', 'rubber', { y: 0.033, z: 0.018, angle: 0.36, len: 0.102, w: 0.03 });

  // Barrel + handguard
  addBarrel(body, 'steel', 'cavity', {
    y: bore, zBreech: -0.09, zMuzzle: zBarrelEnd, rChamber: 0.0092, rBarrel: 0.0062, rGas: 0.0072, gasAt: -0.2, knurl: false,
  });
  const muzzle = addMuzzleDevice(body, 'steel_soot', 'cavity', 'trilug', zBarrelEnd, 0.0062, bore);
  addHandguard(body, 'alu', {
    y: bore, z0: hgZ0, z1: hgZ1, r: hgR, sides: 8, slatW: 0.0132, slatT: 0.0032, slots: 3, braces: 2,
  });
  addRail(body, 'alu', hgZ1 + 0.004, hgZ0 - 0.002, railTop);
  addForeGrip(body, 'polymer', 'rubber', { y: bore - hgR - 0.004, z: -0.208, angle: 0.2, len: 0.058 });
  addQdSocket(body, 'alu', 'steel', -hgR + 0.001, bore - 0.006, hgZ0 - 0.022, 'x', 0.0045);

  // Folding skeleton stock
  const hingeBlock = blob(0.026, 0.03, 0.024, 0.003, 3);
  body.add(hingeBlock, 'alu', { y: bore - 0.008, z: zRecRear + 0.008 });
  hingeBlock.dispose();
  addPin(body, 'steel', 0, bore - 0.008, zRecRear + 0.014, 0.003, 0.028);
  for (const sx of [-1, 1]) {
    const strut = box(0.0075, 0.011, 0.145, 0.0018, 2);
    body.add(strut, 'alu', { x: sx * 0.0125, y: bore - 0.014, z: zRecRear + 0.085, rx: -0.045 });
    strut.dispose();
  }
  const crossbar = box(0.032, 0.009, 0.0095, 0.0016, 2);
  body.add(crossbar, 'alu', { y: bore - 0.019, z: zRecRear + 0.12 });
  crossbar.dispose();
  const buttPlate = extrude(roundRect(0.042, 0.058, 0.006, 4), 0.009, { bevel: 0.0012 });
  body.add(buttPlate, 'polymer', { y: bore - 0.026, z: zRecRear + 0.155, rx: 0.06 });
  buttPlate.dispose();
  const pad = blob(0.04, 0.05, 0.0085, 0.0035, 3);
  body.add(pad, 'rubber', { y: bore - 0.026, z: zRecRear + 0.162, rx: 0.06 });
  pad.dispose();
  const cheek = blob(0.019, 0.013, 0.09, 0.005, 3);
  body.add(cheek, 'polymer', { y: bore + 0.012, z: zRecRear + 0.08, rx: -0.05 });
  cheek.dispose();
  addSlingLoop(body, 'steel', 0.0165, bore - 0.022, zRecRear + 0.026, 0.007, { ry: Math.PI / 2 });

  // Sights
  const optic = buildOptic(body, {
    rTube: 0.0138, len: 0.044, hood: 0.006, y: opticY, z: opticZ, railTop, matBody: 'alu_fine', matSteel: 'steel',
  });
  addFrontSight(body, 'polymer', 'alu', 0, railTop, -0.248, false);
  addRearSight(body, 'polymer', 'alu', 0, railTop, -0.09, false);

  // Moving parts
  const magazine = new Assembly('smg-mag');
  const mag = buildMagazine(magazine, null, {
    w: 0.0235, d: 0.0335, len: 0.192, curve: 0.026, segs: 7, witness: 5,
    caseLen: 0.0192, rimR: 0.00478, bulletLen: 0.0132, poly: 'polymer',
  });

  const charging = new Assembly('smg-charging');
  const chParts: THREE.BufferGeometry[] = [];
  const chShaft = rodZ(0.0048, 0.0048, 0.12, 12, 0.0004);
  chParts.push(chShaft);
  const chPaddle = extrude([
    [0, -0.0075], [0.017, -0.009], [0.019, 0], [0.017, 0.008], [0, 0.007],
  ], 0.0055, { bevel: 0.0008 });
  chPaddle.rotateY(-Math.PI / 2);
  chPaddle.translate(-0.0075, 0, -0.05);
  chParts.push(chPaddle);
  const chKnob = dome(0.0055, 12, 0.6);
  chKnob.rotateY(-Math.PI / 2);
  chKnob.translate(-0.024, 0, -0.05);
  chParts.push(chKnob);
  const chG = mergeAll(chParts);
  charging.add(chG, 'steel_bright', {});
  chG.dispose();

  const bolt = new Assembly('smg-bolt');
  const boltBody = latheZ([
    [0, rRec * 0.45], [0, rRec * 0.8], [0.078, rRec * 0.8], [0.078, rRec * 0.45],
  ], 16);
  bolt.add(boltBody, 'steel_bright', { z: -0.078 });
  boltBody.dispose();
  const bface = box(0.014, 0.014, 0.003, 0.0006, 1);
  bolt.add(bface, 'steel', { z: -0.0005 });
  bface.dispose();
  const chamberRound = cartridge(0.0192, 0.00478, 0.0132);
  bolt.add(chamberRound.brass, 'brass', { z: -0.0215, ry: Math.PI });
  chamberRound.brass.dispose();
  chamberRound.bullet.dispose();

  const trigger = new Assembly('smg-trigger');
  const trg = triggerPart('steel_bright');
  trigger.add(trg.geo, 'steel_bright', {});
  trg.geo.dispose();

  const selector = new Assembly('smg-selector');
  const sel = selectorPart('alu', 'steel');
  selector.add(sel.geo, 'alu', {});
  sel.geo.dispose();
  const selR = selectorPart('alu', 'steel');
  selector.add(selR.geo, 'alu', { sx: -1 });
  selR.geo.dispose();

  return {
    id: 'smg',
    label: 'MPX-9',
    fxClass: 'smg',
    body,
    moving: { magazine, charging, bolt, trigger, selector },
    nodes: {
      muzzle: [0, bore, muzzle.crownZ],
      chamber: [0, bore, portZ],
      eject: [rRec + 0.006, bore + 0.002, portZ],
      ejectDir: [0.9, 0.4, 0.18],
      sight: [0, opticY, optic.lensZ],
      sightAxis: [0, 0, -1],
      ironSight: [0, railTop + 0.024, 0.042],
      gripR: { pos: [0.024, 0.028, 0.064], finger: [-0.05, -0.4, -0.915], back: [0.97, -0.05, -0.22] },
      gripL: { pos: [-0.056, 0.015, -0.153], finger: [0.45, 0.05, -0.89], back: [-0.88, -0.05, -0.45] },
      magSeat: { pos: [0, bore - 0.02, magZ], rot: [magTilt, 0, 0] },
      magDrop: [0, -0.4, 0.02],
      chargeRest: { pos: [-rRec + 0.0028, bore + rRec - 0.007, -0.06], rot: [0, 0, 0] },
      chargePull: [0, 0, 0.062],
      boltRest: { pos: [0, bore, portZ + 0.032], rot: [0, 0, 0] },
      boltTravel: [0, 0, 0.05],
      triggerPivot: { pos: [0, bore - 0.026, -0.001], rot: [0, 0, 0] },
      triggerPull: -0.36,
      selectorPivot: { pos: [0, bore - 0.019, 0.022], rot: [0, 0, 0] },
      opticGlass: optic,
    },
    shell: { caseLen: 0.0192, rimR: 0.00478 },
    magSize: { len: mag.len, w: mag.w, d: mag.d },
  };
}
