import * as THREE from 'three';

/**
 * Weapon material system — ported from Claude-of-Duty src/weapons/materials.js.
 *
 * The reference uses a procedural PBR pipeline (TextureForge, custom shaders)
 * that we don't have here. Instead we use MeshStandardMaterial / MeshPhysicalMaterial
 * with the exact tint, roughness, metalness and specularIntensity values from the
 * reference WEAPON_MATERIALS definitions. The custom materials (cavity, optic_tube,
 * glass, lens_ring, lens_vignette, reticle) are ported verbatim.
 */

/** How much of the sky hemisphere a shouldered weapon actually sees. */
export const ENV_OCCLUSION = 0.24;

interface MatDef {
  color: number;
  roughness: number;
  metalness: number;
  physical?: boolean;
  specularIntensity?: number;
  anisotropy?: number;
  sheen?: number;
  sheenRoughness?: number;
  sheenColor?: number;
  envMapIntensity?: number;
  side?: THREE.Side;
}

/**
 * Key → material definition.
 * Colors are sRGB hex approximating the linear albedo (tint × baked_surface)
 * or the F0 for metals. Roughness/metalness/specularIntensity are the exact
 * midpoint values from the reference roughness ranges and material parameters.
 */
const DEFS: Record<string, MatDef> = {
  /** Hard-anodised aluminium — receiver, rails, handguard chassis. */
  alu: {
    color: 0x282b30,
    roughness: 0.38,
    metalness: 0,
    physical: true,
    specularIntensity: 0.11,
  },
  /** Fine-grain anodising for optic bodies (bead-blasted, closer to eye). */
  alu_fine: {
    color: 0x1e2024,
    roughness: 0.33,
    metalness: 0,
    physical: true,
    specularIntensity: 0.08,
  },
  /** Parkerised / phosphated steel — barrel, gas block, pins. */
  steel: {
    color: 0x2b2926,
    roughness: 0.49,
    metalness: 1,
    anisotropy: 0.1,
  },
  /** Sooted steel — muzzle device, gas block front. */
  steel_soot: {
    color: 0x080807,
    roughness: 0.9,
    metalness: 0.12,
    physical: true,
    specularIntensity: 0.1,
    anisotropy: 0.06,
  },
  /** Bare oiled steel — bolt carrier, charging handle, trigger. */
  steel_bright: {
    color: 0x4a4d52,
    roughness: 0.51,
    metalness: 1,
    anisotropy: 0.12,
  },
  /** Black nitrided steel — pistol slides, bolt bodies. */
  steel_black: {
    color: 0x282a2e,
    roughness: 0.43,
    metalness: 1,
    anisotropy: 0.14,
  },
  /** Glass-filled polymer — magazine, stock, grip, handguard panels. */
  polymer: {
    color: 0x1c1b19,
    roughness: 0.68,
    metalness: 0,
    physical: true,
    specularIntensity: 0.13,
  },
  /** Coyote / FDE polymer. */
  polymer_tan: {
    color: 0x6b5a3a,
    roughness: 0.62,
    metalness: 0,
    physical: true,
    specularIntensity: 0.14,
  },
  /** Soft rubber — grip overmould, butt pad, optic bezel. */
  rubber: {
    color: 0x1a1816,
    roughness: 0.59,
    metalness: 0,
    physical: true,
    specularIntensity: 0.12,
  },
  /** Cartridge brass. */
  brass: {
    color: 0xb08d3a,
    roughness: 0.41,
    metalness: 1,
    anisotropy: 0.05,
  },
  /** Copper FMJ tip. */
  copper: {
    color: 0xb87333,
    roughness: 0.45,
    metalness: 1,
    anisotropy: 0.05,
  },
  /** Glove shell — warm dark nomex / goat-leather. */
  glove: {
    color: 0x2a2420,
    roughness: 0.85,
    metalness: 0,
    physical: true,
    specularIntensity: 0.16,
    sheen: 0.07,
    sheenRoughness: 0.96,
    sheenColor: 0x201812,
  },
  /** Reinforced palm / knuckle pads. */
  glove_pad: {
    color: 0x1e1814,
    roughness: 0.78,
    metalness: 0,
    physical: true,
    specularIntensity: 0.15,
  },
  /** Stitched seam down the outboard side of each finger. */
  glove_seam: {
    color: 0x3a2e24,
    roughness: 0.83,
    metalness: 0,
    physical: true,
    specularIntensity: 0.16,
    sheen: 0.08,
    sheenRoughness: 0.94,
    sheenColor: 0x2a2018,
  },
  /** Combat-shirt sleeve — coyote ripstop. */
  sleeve: {
    color: 0x28241f,
    roughness: 0.83,
    metalness: 0,
    physical: true,
    specularIntensity: 0.14,
    sheen: 0.09,
    sheenRoughness: 0.96,
    sheenColor: 0x38301f,
  },
};

export class WeaponMaterials {
  private cache = new Map<string, THREE.Material>();
  private owned: THREE.Material[] = [];
  private ownedTex: THREE.Texture[] = [];
  private _rimTex: THREE.DataTexture | null = null;

  /** Get a material by key. Returns cached instance if available. */
  get(key: string): THREE.Material {
    if (key === 'cavity') return this.cavity();
    if (key === 'optic_tube') return this.opticTube();
    if (key === 'glass') return this.glass();
    if (key === 'lens_ring') return this.lensRing();
    if (key === 'lens_vig') return this.lensVignette();

    let m = this.cache.get(key);
    if (m) return m;

    const def = DEFS[key];
    if (def) {
      m = this.createPBR(def);
      (m as THREE.MeshStandardMaterial).envMapIntensity = ENV_OCCLUSION;
      m.needsUpdate = true;
    } else {
      m = this._fallback(key);
    }

    this.cache.set(key, m);
    return m;
  }

  private createPBR(def: MatDef): THREE.Material {
    const opts: THREE.MeshPhysicalMaterialParameters = {
      color: def.color,
      roughness: def.roughness,
      metalness: def.metalness,
      envMapIntensity: def.envMapIntensity ?? ENV_OCCLUSION,
      side: def.side ?? THREE.FrontSide,
    };

    if (def.physical) {
      const mat = new THREE.MeshPhysicalMaterial(opts);
      if (def.specularIntensity !== undefined) mat.specularIntensity = def.specularIntensity;
      if (def.sheen !== undefined) {
        mat.sheen = def.sheen;
        mat.sheenRoughness = def.sheenRoughness ?? 1;
        if (def.sheenColor !== undefined) mat.sheenColor = new THREE.Color(def.sheenColor);
      }
      return mat;
    }

    const mat = new THREE.MeshStandardMaterial(opts);
    if (def.anisotropy !== undefined) {
      // anisotropy is only on MeshPhysicalMaterial in three r164+
      // For MeshStandardMaterial we skip it
    }
    return mat;
  }

  /** Fallback for unknown keys. */
  private _fallback(key: string): THREE.Material {
    const metal = key.startsWith('steel') || key === 'brass' || key === 'copper';
    const m = new THREE.MeshStandardMaterial({
      color: key === 'brass' ? 0xb08d3a : metal ? 0x3a3d42 : 0x2a2b2e,
      roughness: metal ? 0.38 : 0.72,
      metalness: metal ? 1 : 0,
      envMapIntensity: ENV_OCCLUSION,
    });
    this.owned.push(m);
    return m;
  }

  /** Matte black interior — bores, lens housings, ejection port cavity. */
  cavity(): THREE.Material {
    const key = 'cavity';
    let m = this.cache.get(key);
    if (m) return m;
    m = new THREE.MeshPhysicalMaterial({
      color: 0x0a0c0e,
      roughness: 1,
      metalness: 0,
      specularIntensity: 0.04,
      envMapIntensity: 0.18,
      side: THREE.DoubleSide,
    });
    (m as any).name = 'ow-cavity';
    this.cache.set(key, m);
    this.owned.push(m);
    return m;
  }

  /** Inside of optic tube — a light trap, not a black hole. */
  opticTube(): THREE.Material {
    const key = 'optic_tube';
    let m = this.cache.get(key);
    if (m) return m;
    m = new THREE.MeshPhysicalMaterial({
      color: 0x1d2023,
      roughness: 0.9,
      metalness: 0,
      specularIntensity: 0.12,
      envMapIntensity: 0.3,
      side: THREE.DoubleSide,
    });
    (m as any).name = 'ow-optic-tube';
    this.cache.set(key, m);
    this.owned.push(m);
    return m;
  }

  /** Bright inner-edge reflection ring inside objective rim. */
  lensRing(intensity = 0.14): THREE.Material {
    const key = `lensRing:${intensity}`;
    let m = this.cache.get(key);
    if (m) return m;
    m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x9fc4d8).multiplyScalar(intensity),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
      fog: false,
    });
    (m as any).name = 'ow-lens-ring';
    this.cache.set(key, m);
    this.owned.push(m);
    return m;
  }

  /** AR-coated optic glass — iridescent dielectric. */
  glass(tint = 0x3b6e8c): THREE.Material {
    const key = `glass:${tint}`;
    let m = this.cache.get(key);
    if (m) return m;
    m = new THREE.MeshPhysicalMaterial({
      color: 0x121c22,
      transparent: true,
      opacity: 0.1,
      roughness: 0.03,
      metalness: 0,
      ior: 1.52,
      reflectivity: 0.55,
      specularIntensity: 1,
      specularColor: new THREE.Color(0x59c489),
      iridescence: 1,
      iridescenceIOR: 1.4,
      iridescenceThicknessRange: [220, 560],
      sheen: 0.42,
      sheenColor: new THREE.Color(0xa856b8),
      sheenRoughness: 0.3,
      envMapIntensity: 2.4,
      side: THREE.DoubleSide,
      depthWrite: false,
      premultipliedAlpha: true,
    });
    (m as any).name = 'ow-optic-glass';
    this.cache.set(key, m);
    this.owned.push(m);
    return m;
  }

  /** Radial alpha ramp texture for vignette. */
  private _rimRamp(): THREE.DataTexture {
    if (this._rimTex) return this._rimTex;
    const N = 64;
    const data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = (x + 0.5) / N - 0.5;
        const v = (y + 0.5) / N - 0.5;
        const r = Math.min(1, Math.hypot(u, v) * 2);
        const t = Math.max(0, (r - 0.8) / 0.2);
        const a = t * t * (3 - 2 * t);
        const i = (y * N + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.round(a * 255);
      }
    }
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    t.needsUpdate = true;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false;
    this._rimTex = t;
    this.ownedTex.push(t);
    return t;
  }

  /** Tube vignette — dark disc transparent in centre, opaque at rim. */
  lensVignette(strength = 0.34): THREE.Material {
    const key = `vignette:${strength}`;
    let m = this.cache.get(key);
    if (m) return m;
    m = new THREE.MeshBasicMaterial({
      color: 0x05070a,
      transparent: true,
      opacity: strength,
      alphaMap: this._rimRamp(),
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
      fog: false,
    });
    (m as any).name = 'ow-lens-vignette';
    this.cache.set(key, m);
    this.owned.push(m);
    return m;
  }

  /** Reticle dark outline. */
  reticleOutline(opacity = 0.8): THREE.Material {
    const key = `reticleOutline:${opacity}`;
    let m = this.cache.get(key);
    if (m) return m;
    m = new THREE.MeshBasicMaterial({
      color: 0x14060a,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });
    (m as any).name = 'ow-reticle-outline';
    this.cache.set(key, m);
    this.owned.push(m);
    return m;
  }

  /** Additive, unlit, depth-tested reticle. */
  reticle(color = 0xff2a12, intensity = 6.5): THREE.Material {
    const key = `reticle:${color}:${intensity}`;
    let m = this.cache.get(key);
    if (m) return m;
    m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: true,
      fog: false,
    });
    (m as any).name = 'ow-reticle';
    this.cache.set(key, m);
    this.owned.push(m);
    return m;
  }

  dispose(): void {
    for (const m of this.owned) m.dispose();
    this.owned.length = 0;
    for (const t of this.ownedTex) t.dispose();
    this.ownedTex.length = 0;
    this._rimTex = null;
    this.cache.clear();
  }
}

export const MATERIAL_KEYS = Object.keys(DEFS);
