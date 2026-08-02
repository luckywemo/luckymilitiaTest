import * as THREE from 'three';
import { makeSurfaceMaterial, type SurfaceType } from './ProceduralTextures';

/**
 * BattlefieldBuilder — constructs a Middle-Eastern urban combat map
 * inspired by CoD's Crash/Backlot: a main street with buildings on both sides,
 * flanking alleys, an arched gate at the far end, and dense set dressing.
 *
 * All geometry is merged into a small number of meshes for performance.
 * All materials use procedurally generated PBR textures.
 */

export interface ColliderMesh {
  mesh: THREE.Mesh;
  box: THREE.Box3;
}

export class BattlefieldBuilder {
  private scene: THREE.Scene;
  private collidables: THREE.Mesh[] = [];
  private spawnPoints: THREE.Vector3[] = [];
  private staticMeshes: THREE.Group = new THREE.Group();
  private dressingGroup: THREE.Group = new THREE.Group();

  // Material cache
  private mats: Map<SurfaceType, THREE.MeshStandardMaterial> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  getCollidables(): THREE.Mesh[] { return this.collidables; }
  getSpawnPoints(): THREE.Vector3[] { return this.spawnPoints; }

  private mat(type: SurfaceType, repeat = 1, metalness = 0, envIntensity = 0.5): THREE.MeshStandardMaterial {
    const key = `${type}_${repeat}_${metalness}`;
    let m = this.mats.get(key as any);
    if (!m) {
      m = makeSurfaceMaterial(type, { repeat, metalness, envMapIntensity: envIntensity });
      this.mats.set(key as any, m);
    }
    return m;
  }

  build(): void {
    this.buildGround();
    this.buildStreet();
    this.buildBuildings();
    this.buildGate();
    this.buildSetDressing();
    this.buildSkyDome();

    this.scene.add(this.staticMeshes);
    this.scene.add(this.dressingGroup);
  }

  // ─── GROUND ───

  private buildGround(): void {
    // Asphalt street
    const streetMat = this.mat('asphalt', 4, 0, 0.3);
    const street = new THREE.Mesh(new THREE.PlaneGeometry(13, 110), streetMat);
    street.rotation.x = -Math.PI / 2;
    street.position.set(0, 0, -6);
    street.receiveShadow = true;
    this.staticMeshes.add(street);

    // Dirt/sand ground on west side
    const westGroundMat = this.mat('sand', 6, 0, 0.3);
    const westGround = new THREE.Mesh(new THREE.PlaneGeometry(50, 110), westGroundMat);
    westGround.rotation.x = -Math.PI / 2;
    westGround.position.set(-31, -0.01, -6);
    westGround.receiveShadow = true;
    this.staticMeshes.add(westGround);

    // Dirt/gravel on east side
    const eastGroundMat = this.mat('gravel', 6, 0, 0.3);
    const eastGround = new THREE.Mesh(new THREE.PlaneGeometry(50, 110), eastGroundMat);
    eastGround.rotation.x = -Math.PI / 2;
    eastGround.position.set(31, -0.01, -6);
    eastGround.receiveShadow = true;
    this.staticMeshes.add(eastGround);

    // Sidewalks along the street
    const sidewalkMat = this.mat('concrete', 3, 0, 0.4);
    const swWest = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 110), sidewalkMat);
    swWest.position.set(-7.5, 0.075, -6);
    swWest.receiveShadow = true;
    swWest.castShadow = true;
    this.staticMeshes.add(swWest);
    this.addCollider(swWest);

    const swEast = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 110), sidewalkMat);
    swEast.position.set(7.5, 0.075, -6);
    swEast.receiveShadow = true;
    swEast.castShadow = true;
    this.staticMeshes.add(swEast);
    this.addCollider(swEast);
  }

  // ─── STREET FEATURES ───

  private buildStreet(): void {
    // Road markings — dashed center line
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xb0a070, transparent: true, opacity: 0.3 });
    for (let z = 50; z > -60; z -= 6) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 2), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, z);
      this.staticMeshes.add(dash);
    }
  }

  // ─── BUILDINGS ───

  private buildBuildings(): void {
    // West row
    this.buildBuilding({ id: 'W1', x: -14, z: 20, w: 14, d: 12, floors: 2, wallType: 'plaster_cream', damage: 0.25 });
    this.buildBuilding({ id: 'W2', x: -15, z: 2, w: 15, d: 13, floors: 2, wallType: 'plaster_sand', damage: 0.3, enterable: true });
    this.buildBuilding({ id: 'W3', x: -14, z: -16, w: 13, d: 14, floors: 2, wallType: 'plaster_blue', damage: 0.55, ruin: true });
    this.buildBuilding({ id: 'W4', x: -15, z: -36, w: 16, d: 15, floors: 2, wallType: 'plaster_pink', damage: 0.3 });

    // East row
    this.buildBuilding({ id: 'E1', x: 14, z: 18, w: 15, d: 16, floors: 3, wallType: 'plaster_cream', damage: 0.3, enterable: true });
    this.buildBuilding({ id: 'E2', x: 14, z: -5, w: 14, d: 14, floors: 3, wallType: 'plaster_blue', damage: 0.3 });
    this.buildBuilding({ id: 'E3', x: 15, z: -24, w: 15, d: 16, floors: 2, wallType: 'plaster_sand', damage: 0.75, ruin: true });
    this.buildBuilding({ id: 'E4', x: 14, z: -42, w: 14, d: 14, floors: 3, wallType: 'plaster_pink', damage: 0.35 });

    // Background / infill buildings (visible over rooftops)
    this.buildBuilding({ id: 'BS1', x: -20, z: -58, w: 20, d: 14, floors: 3, wallType: 'plaster_sand', damage: 0.2, background: true });
    this.buildBuilding({ id: 'BS2', x: 16, z: -60, w: 24, d: 16, floors: 2, wallType: 'plaster_blue', damage: 0.2, background: true });
    this.buildBuilding({ id: 'BN1', x: -16, z: 52, w: 20, d: 14, floors: 2, wallType: 'plaster_cream', damage: 0.15, background: true });
    this.buildBuilding({ id: 'BN2', x: 16, z: 54, w: 22, d: 16, floors: 3, wallType: 'plaster_pink', damage: 0.15, background: true });
  }

  private buildBuilding(cfg: {
    id: string; x: number; z: number; w: number; d: number; floors: number;
    wallType: SurfaceType; damage: number; ruin?: boolean; enterable?: boolean; background?: boolean;
  }): void {
    const floorH = 3.2;
    const totalH = cfg.floors * floorH;
    const wallMat = this.mat(cfg.wallType, 2, 0, 0.5);
    const concreteMat = this.mat('concrete', 1, 0, 0.4);
    const woodMat = this.mat('wood', 1, 0, 0.3);

    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);

    // Main walls (4 sides)
    const wallThickness = 0.3;
    const halfW = cfg.w / 2;
    const halfD = cfg.d / 2;

    // Front wall (facing street — +X side for east buildings, -X for west)
    const streetSide = cfg.x > 0 ? 1 : -1;

    // Four walls
    const walls = [
      { x: 0, z: -halfD, w: cfg.w, d: wallThickness }, // north
      { x: 0, z: halfD, w: cfg.w, d: wallThickness },  // south
      { x: -halfW, z: 0, w: wallThickness, d: cfg.d },  // west
      { x: halfW, z: 0, w: wallThickness, d: cfg.d },   // east
    ];

    walls.forEach((wl, idx) => {
      if (cfg.ruin && Math.random() < cfg.damage) return; // missing wall section

      const wallGeo = new THREE.BoxGeometry(wl.w, totalH, wl.d);
      const wall = new THREE.Mesh(wallGeo, idx % 2 === 0 ? wallMat : wallMat);
      wall.position.set(wl.x, totalH / 2, wl.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);

      // Door opening on street-facing wall
      if (wl.x === streetSide * halfW && cfg.enterable) {
        const doorCutout = new THREE.Mesh(
          new THREE.BoxGeometry(wallThickness + 0.05, 2.2, 1.5),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        doorCutout.position.copy(wall.position);
        doorCutout.position.y = 1.1;
        group.add(doorCutout);
      }

      this.addCollider(wall);
    });

    // Window openings — cut into street-facing wall
    if (!cfg.background && !cfg.ruin) {
      const windowMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a2a, roughness: 0.3, metalness: 0.5,
        transparent: true, opacity: 0.6, envMapIntensity: 0.8,
      });
      for (let f = 0; f < cfg.floors; f++) {
        const wy = f * floorH + floorH / 2;
        for (let wIdx = 0; wIdx < 2; wIdx++) {
          const wx = streetSide * halfW;
          const wz = (wIdx - 0.5) * (cfg.d * 0.4);
          const window = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness + 0.1, 1.2, 1.0),
            windowMat
          );
          window.position.set(wx, wy, wz);
          group.add(window);
        }
      }
    }

    // Floor slabs
    for (let f = 0; f <= cfg.floors; f++) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w, 0.2, cfg.d),
        concreteMat
      );
      slab.position.set(0, f * floorH, 0);
      slab.castShadow = true;
      slab.receiveShadow = true;
      group.add(slab);
      if (f === 0) this.addCollider(slab);
    }

    // Roof — flat with parapet
    if (!cfg.ruin) {
      const parapetH = 0.6;
      const parapetMat = wallMat;
      const parapets = [
        { x: 0, z: -halfD, w: cfg.w, d: 0.2 },
        { x: 0, z: halfD, w: cfg.w, d: 0.2 },
        { x: -halfW, z: 0, w: 0.2, d: cfg.d },
        { x: halfW, z: 0, w: 0.2, d: cfg.d },
      ];
      parapets.forEach((p) => {
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(p.w, parapetH, p.d), parapetMat);
        parapet.position.set(p.x, totalH + parapetH / 2, p.z);
        parapet.castShadow = true;
        group.add(parapet);
      });

      // Roof props — AC units, water tanks
      if (!cfg.background) {
        const propCount = Math.floor(cfg.w * cfg.d / 30);
        for (let i = 0; i < propCount; i++) {
          const propType = Math.random() > 0.5 ? 'ac' : 'tank';
          if (propType === 'ac') {
            const ac = new THREE.Mesh(
              new THREE.BoxGeometry(1.2, 0.8, 1.0),
              this.mat('metal', 1, 0.8, 0.6)
            );
            ac.position.set(
              (Math.random() - 0.5) * (cfg.w - 3),
              totalH + 0.4,
              (Math.random() - 0.5) * (cfg.d - 3)
            );
            ac.castShadow = true;
            group.add(ac);
          } else {
            const tank = new THREE.Mesh(
              new THREE.CylinderGeometry(0.6, 0.6, 1.2, 8),
              this.mat('metal_rust', 1, 0.7, 0.5)
            );
            tank.position.set(
              (Math.random() - 0.5) * (cfg.w - 3),
              totalH + 0.6,
              (Math.random() - 0.5) * (cfg.d - 3)
            );
            tank.castShadow = true;
            group.add(tank);
          }
        }
      }
    }

    // Damage — missing chunks from walls
    if (cfg.damage > 0.3 && !cfg.background) {
      const damageCount = Math.floor(cfg.damage * 6);
      for (let i = 0; i < damageCount; i++) {
        const dx = (Math.random() - 0.5) * cfg.w;
        const dz = (Math.random() - 0.5) * cfg.d;
        const dy = Math.random() * totalH * 0.7;
        const debris = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.4, 0),
          wallMat
        );
        debris.position.set(dx, dy, dz);
        debris.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        debris.castShadow = true;
        debris.receiveShadow = true;
        group.add(debris);
      }
    }

    // Balconies on upper floors
    if (!cfg.background && !cfg.ruin && cfg.floors > 1) {
      for (let f = 1; f < cfg.floors; f++) {
        if (Math.random() > 0.5) continue;
        const balconyY = f * floorH;
        const balconyDepth = 1.0;
        const balconyMat = this.mat('metal_rust', 1, 0.6, 0.4);
        const balcony = new THREE.Mesh(
          new THREE.BoxGeometry(3, 0.15, balconyDepth),
          balconyMat
        );
        balcony.position.set(streetSide * (halfW + balconyDepth / 2), balconyY, (Math.random() - 0.5) * (cfg.d - 4));
        balcony.castShadow = true;
        balcony.receiveShadow = true;
        group.add(balcony);
        this.addCollider(balcony);

        // Railing
        const railH = 1.0;
        const railing = new THREE.Mesh(
          new THREE.BoxGeometry(3, railH, 0.05),
          this.mat('metal', 1, 0.8, 0.5)
        );
        railing.position.set(streetSide * (halfW + balconyDepth), balconyY + railH / 2, balcony.position.z);
        group.add(railing);
      }
    }

    // Ruin — collapsed roof, rubble
    if (cfg.ruin) {
      // Partial wall stubs
      const stubH = totalH * 0.4;
      for (let i = 0; i < 15; i++) {
        const rubble = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.5, 0),
          wallMat
        );
        rubble.position.set(
          (Math.random() - 0.5) * cfg.w,
          Math.random() * stubH,
          (Math.random() - 0.5) * cfg.d
        );
        rubble.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        rubble.castShadow = true;
        rubble.receiveShadow = true;
        group.add(rubble);
      }
    }

    this.staticMeshes.add(group);
  }

  // ─── GATE / STREET TERMINATOR ───

  private buildGate(): void {
    const gateMat = this.mat('plaster_sand', 2, 0, 0.5);
    const stoneMat = this.mat('concrete', 1, 0, 0.4);
    const group = new THREE.Group();
    group.position.set(0, 0, -50);

    // Left block
    const leftBlock = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 3), gateMat);
    leftBlock.position.set(-5.7, 4, 0);
    leftBlock.castShadow = true;
    leftBlock.receiveShadow = true;
    group.add(leftBlock);
    this.addCollider(leftBlock);

    // Right block
    const rightBlock = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 3), gateMat);
    rightBlock.position.set(4.5, 5, 0.5);
    rightBlock.castShadow = true;
    rightBlock.receiveShadow = true;
    group.add(rightBlock);
    this.addCollider(rightBlock);

    // Tower (tallest, proud)
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 13, 3), gateMat);
    tower.position.set(8, 6.5, 1.5);
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);
    this.addCollider(tower);

    // Arch over the gateway
    const archMat = stoneMat;
    const archL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 3), archMat);
    archL.position.set(-3, 2.5, 0);
    archL.castShadow = true;
    group.add(archL);
    this.addCollider(archL);

    const archR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 3), archMat);
    archR.position.set(3, 2.5, 0);
    archR.castShadow = true;
    group.add(archR);
    this.addCollider(archR);

    // Arch top
    const archTop = new THREE.Mesh(new THREE.TorusGeometry(3, 0.4, 8, 16, Math.PI), archMat);
    archTop.position.set(0, 5, 0);
    archTop.rotation.z = 0;
    archTop.castShadow = true;
    group.add(archTop);

    this.staticMeshes.add(group);
  }

  // ─── SET DRESSING ───

  private buildSetDressing(): void {
    this.buildMarketStalls();
    this.buildJerseyBarriers();
    this.buildSandbagWalls();
    this.buildWrecks();
    this.buildPalms();
    this.buildStreetLamps();
    this.buildCables();
    this.buildRubble();
    this.buildTyreStacks();
    this.buildSpawnPoints();
  }

  private buildMarketStalls(): void {
    const stallMat = this.mat('fabric', 2, 0, 0.3);
    const woodMat = this.mat('wood', 1, 0, 0.3);
    const stalls = [
      [-3.2, 6.4, 0.08], [-3.0, 2.2, -0.05], [3.1, 9.5, 3.2],
      [3.4, 4.0, 3.05], [-0.4, 2.6, 1.62], [3.0, -9.0, 3.25],
      [-3.3, -14.5, 0.12], [2.9, -20.0, 3.0],
    ];
    stalls.forEach(([x, z, ry]) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      // Canopy
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.8), stallMat);
      canopy.position.set(0, 2.2, 0);
      canopy.castShadow = true;
      g.add(canopy);
      // Posts
      for (let i = 0; i < 4; i++) {
        const px = (i < 2 ? -1 : 1) * 1.1;
        const pz = (i % 2 === 0 ? -1 : 1) * 0.8;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), woodMat);
        post.position.set(px, 1.1, pz);
        post.castShadow = true;
        g.add(post);
      }
      // Table
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 1.4), woodMat);
      table.position.set(0, 0.9, 0);
      table.castShadow = true;
      table.receiveShadow = true;
      g.add(table);
      this.dressingGroup.add(g);
      // Collider for the table
      const coll = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.4), new THREE.MeshBasicMaterial({ visible: false }));
      coll.position.set(x, 0.45, z);
      coll.rotation.y = ry;
      this.addCollider(coll);
    });
  }

  private buildJerseyBarriers(): void {
    const barrierMat = this.mat('concrete', 1, 0, 0.4);
    const jerseys = [
      [-2.6, 17.5, 0.12], [-0.4, 16.2, 1.5], [2.9, 12.0, -0.1],
      [1.6, -2.5, 1.62], [-2.4, -6.0, 0.05], [3.2, -16.0, 0.1],
      [-1.0, -24.0, 1.55], [1.2, -30.0, 0.2], [-3.0, -34.0, 0.0],
    ];
    jerseys.forEach(([x, z, ry]) => {
      const barrier = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.1, 2.2),
        barrierMat
      );
      barrier.position.set(x, 0.55, z);
      barrier.rotation.y = ry;
      barrier.castShadow = true;
      barrier.receiveShadow = true;
      this.dressingGroup.add(barrier);
      this.addCollider(barrier);
    });
  }

  private buildSandbagWalls(): void {
    const bagMat = this.mat('fabric', 1, 0, 0.3);
    const walls = [
      [-3.6, 11.0, 0.0, 3.0], [3.6, -2.0, 0.0, 2.6],
      [-1.6, -18.5, 1.57, 2.4], [3.4, -27.0, 0.0, 3.2],
    ];
    walls.forEach(([x, z, ry, len]) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      const bagsAcross = Math.ceil(len / 0.5);
      const bagsHigh = 3;
      for (let row = 0; row < bagsHigh; row++) {
        for (let i = 0; i < bagsAcross; i++) {
          const bag = new THREE.Mesh(
            new THREE.BoxGeometry(0.45, 0.3, 0.4),
            bagMat
          );
          bag.position.set(
            (i - bagsAcross / 2 + 0.5) * 0.48,
            0.15 + row * 0.3,
            (row % 2) * 0.1
          );
          bag.rotation.z = (Math.random() - 0.5) * 0.05;
          bag.castShadow = true;
          bag.receiveShadow = true;
          g.add(bag);
        }
      }
      this.dressingGroup.add(g);
      // Collider
      const coll = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.9, 0.5),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      coll.position.set(x, 0.45, z);
      coll.rotation.y = ry;
      this.addCollider(coll);
    });
  }

  private buildWrecks(): void {
    const wreckMat = this.mat('metal_rust', 2, 0.8, 0.4);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0.5 });
    const wrecks = [
      [2.5, 0.5, 0.42, 0], [-2.8, -28.5, -2.6, 4], [4.9, 24.0, 1.5, 0],
    ];
    wrecks.forEach(([x, z, ry, rollDeg]) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      g.rotation.z = (rollDeg * Math.PI) / 180;
      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 4.0), wreckMat);
      body.position.set(0, 0.6, 0);
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      // Cabin
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.8), wreckMat);
      cabin.position.set(0, 1.4, -0.3);
      cabin.castShadow = true;
      g.add(cabin);
      // Windows
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.05), glassMat);
      windshield.position.set(0, 1.4, 0.6);
      g.add(windshield);
      // Wheels
      const wheelMat = this.mat('rubber', 1, 0, 0.3);
      const wheelPositions = [
        [-0.9, 0.4, 1.3], [0.9, 0.4, 1.3], [-0.9, 0.4, -1.3], [0.9, 0.4, -1.3],
      ];
      wheelPositions.forEach(([wx, wy, wz]) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, wy, wz);
        wheel.castShadow = true;
        g.add(wheel);
      });
      this.dressingGroup.add(g);
      // Collider
      const coll = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 4.2), new THREE.MeshBasicMaterial({ visible: false }));
      coll.position.set(x, 0.75, z);
      coll.rotation.y = ry;
      this.addCollider(coll);
    });
  }

  private buildPalms(): void {
    const trunkMat = this.mat('wood', 1, 0, 0.3);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: 0.8, side: THREE.DoubleSide });
    const palms = [
      [-5.4, 20.0, 1.0], [5.5, 6.5, 1.1], [-5.5, -4.5, 0.92],
      [5.6, -20.5, 1.05], [-5.5, -32.0, 1.0], [8.5, 5.0, 0.85], [-9.0, -10.2, 0.9],
    ];
    palms.forEach(([x, z, s]) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.scale.setScalar(s);
      // Curved trunk
      const trunkH = 5 + Math.random() * 2;
      const trunkSegs = 5;
      for (let i = 0; i < trunkSegs; i++) {
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12 - i * 0.015, 0.15 - i * 0.015, trunkH / trunkSegs, 6),
          trunkMat
        );
        seg.position.set(
          Math.sin(i / trunkSegs * Math.PI * 0.3) * 0.3,
          (i + 0.5) * (trunkH / trunkSegs),
          0
        );
        seg.rotation.z = Math.sin(i / trunkSegs * Math.PI * 0.3) * 0.1;
        seg.castShadow = true;
        g.add(seg);
      }
      // Fronds
      const frondCount = 8;
      for (let i = 0; i < frondCount; i++) {
        const ang = (i / frondCount) * Math.PI * 2;
        const frond = new THREE.Mesh(
          new THREE.PlaneGeometry(2.5, 0.4),
          leafMat
        );
        frond.position.set(Math.cos(ang) * 0.8, trunkH, Math.sin(ang) * 0.8);
        frond.rotation.y = ang;
        frond.rotation.x = -0.3 + Math.random() * 0.2;
        frond.castShadow = true;
        g.add(frond);
      }
      this.dressingGroup.add(g);
      // Trunk collider
      const coll = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, trunkH, 4), new THREE.MeshBasicMaterial({ visible: false }));
      coll.position.set(x, trunkH / 2, z);
      this.addCollider(coll);
    });
  }

  private buildStreetLamps(): void {
    const poleMat = this.mat('metal', 1, 0.8, 0.5);
    const lamps = [
      [-5.9, 15.0], [5.9, 3.0], [-5.9, -11.0], [5.9, -24.0], [-5.9, -36.0],
    ];
    lamps.forEach(([x, z]) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 8), poleMat);
      pole.position.set(0, 2.5, 0);
      pole.castShadow = true;
      g.add(pole);
      // Arm
      const armDir = x < 0 ? 1 : -1;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), poleMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(armDir * 0.6, 5, 0);
      g.add(arm);
      // Lamp head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.2), poleMat);
      head.position.set(armDir * 1.2, 4.95, 0);
      g.add(head);
      // Light
      const light = new THREE.PointLight(0xffd0a0, 0.8, 15, 2);
      light.position.set(armDir * 1.2, 4.8, 0);
      g.add(light);
      this.dressingGroup.add(g);
      // Collider
      const coll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 4), new THREE.MeshBasicMaterial({ visible: false }));
      coll.position.set(x, 2.5, z);
      this.addCollider(coll);
    });
  }

  private buildCables(): void {
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    const cables = [
      [-6.4, 7.2, 10.0, 6.4, 6.6, 12.5],
      [-6.4, 8.4, -2.0, 6.4, 7.9, -0.5],
      [-6.4, 6.2, -16.0, 6.4, 6.6, -14.5],
      [-6.4, 7.6, -30.0, 6.4, 7.2, -28.0],
    ];
    cables.forEach(([x0, y0, z0, x1, y1, z1]) => {
      const start = new THREE.Vector3(x0, y0, z0);
      const end = new THREE.Vector3(x1, y1, z1);
      const dist = start.distanceTo(end);
      const sag = 0.8;
      const curve = new THREE.QuadraticBezierCurve3(
        start,
        new THREE.Vector3((x0 + x1) / 2, Math.max(y0, y1) - sag, (z0 + z1) / 2),
        end
      );
      const points = curve.getPoints(16);
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const cable = new THREE.Line(geo, cableMat);
      this.dressingGroup.add(cable);
    });
  }

  private buildRubble(): void {
    const rubbleMat = this.mat('concrete', 1, 0, 0.4);
    const rubbleSites = [
      [-4.2, -20.5, 2.4, 34], [5.0, -14.5, 2.8, 40],
      [-1.5, -40.0, 2.0, 26], [7.6, -30.5, 2.2, 28], [-5.0, 26.0, 1.6, 18],
    ];
    rubbleSites.forEach(([x, z, radius, count]) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        const chunk = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.2, 0),
          rubbleMat
        );
        chunk.position.set(
          x + Math.cos(a) * r,
          Math.random() * 0.3,
          z + Math.sin(a) * r
        );
        chunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        chunk.scale.setScalar(0.6 + Math.random() * 0.8);
        chunk.castShadow = true;
        chunk.receiveShadow = true;
        this.dressingGroup.add(chunk);
      }
    });
  }

  private buildTyreStacks(): void {
    const tyreMat = this.mat('rubber', 1, 0, 0.3);
    const stacks = [
      [-5.2, 12.5, 4], [5.3, -6.0, 3], [6.2, 3.0, 5], [-5.4, -28.0, 3],
    ];
    stacks.forEach(([x, z, n]) => {
      for (let i = 0; i < n; i++) {
        const tyre = new THREE.Mesh(
          new THREE.TorusGeometry(0.35, 0.15, 8, 16),
          tyreMat
        );
        tyre.position.set(x, 0.15 + i * 0.28, z);
        tyre.rotation.x = Math.PI / 2;
        tyre.castShadow = true;
        tyre.receiveShadow = true;
        this.dressingGroup.add(tyre);
      }
      const coll = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, n * 0.28, 6), new THREE.MeshBasicMaterial({ visible: false }));
      coll.position.set(x, (n * 0.28) / 2, z);
      this.addCollider(coll);
    });
  }

  private buildSpawnPoints(): void {
    // Spawn points along the street and alleys
    const spawns = [
      [0, 0, 40], [-3, 0, 25], [3, 0, 15], [-3, 0, 5],
      [3, 0, -5], [-3, 0, -15], [3, 0, -25], [0, 0, -35],
      [-10, 0, 10], [10, 0, -10], [-10, 0, -20], [10, 0, 20],
    ];
    spawns.forEach(([x, y, z]) => {
      this.spawnPoints.push(new THREE.Vector3(x, y, z));
    });
  }

  // ─── SKY DOME ───

  private buildSkyDome(): void {
    const skyGeo = new THREE.SphereGeometry(250, 32, 16);
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 512;
    const ctx = skyCanvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#5a7a9a');
    grad.addColorStop(0.4, '#8aa0b8');
    grad.addColorStop(0.7, '#c4b898');
    grad.addColorStop(1, '#d4c8a8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 20; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 200;
      const cr = 20 + Math.random() * 60;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.y = 50;
    this.scene.add(sky);
  }

  // ─── COLLISION ───

  private addCollider(mesh: THREE.Mesh): void {
    this.collidables.push(mesh);
  }

  dispose(): void {
    this.staticMeshes.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    this.dressingGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    this.mats.forEach((m) => m.dispose());
    this.mats.clear();
  }
}
