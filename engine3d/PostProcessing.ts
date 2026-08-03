import * as THREE from 'three';

/**
 * Post-processing pipeline adapted from Claude-of-Duty.
 *
 * Frame order:
 *   1. World rendered to HDR half-float target
 *   2. Auto-exposure (GPU log-luminance reduction → EV100 → exposure scalar)
 *   3. Bloom (Karis pyramid with soft-knee threshold)
 *   4. Composite: exposure → CA → bloom (additive) → vignette (cos^4) → AgX tonemap → sRGB → LUT grade → grain → sharpen → dither
 *
 * All in TypeScript, using full-screen triangle passes.
 */

// ─── GLSL snippets ───

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMMON = /* glsl */ `
const float OW_PI = 3.141592653589793;

float owLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 owLinearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666667)) - 0.055, step(0.0031308, c));
}

float owHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

const TONEMAP = /* glsl */ `
const mat3 OW_REC2020_FROM_SRGB = mat3(
  vec3(0.6274, 0.0691, 0.0164),
  vec3(0.3293, 0.9195, 0.0880),
  vec3(0.0433, 0.0113, 0.8956));
const mat3 OW_SRGB_FROM_REC2020 = mat3(
  vec3( 1.6605, -0.1246, -0.0182),
  vec3(-0.5876,  1.1329, -0.1006),
  vec3(-0.0728, -0.0083,  1.1187));

vec3 owAgxContrast(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x
       + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

vec3 owAgX(vec3 color, float slope, float power, float sat) {
  const mat3 inset = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 outset = mat3(
    vec3( 1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323,  1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257,  1.2519364065950405));
  const float minEv = -12.47393;
  const float maxEv = 4.026069;

  color = OW_REC2020_FROM_SRGB * color;
  color = inset * color;
  color = max(color, 1e-10);
  color = (log2(color) - minEv) / (maxEv - minEv);
  color = clamp(color, 0.0, 1.0);
  color = pow(max(color * slope, 0.0), vec3(power));
  float l = owLum(color);
  color = l + sat * (color - l);
  color = owAgxContrast(clamp(color, 0.0, 1.0));
  color = outset * color;
  color = pow(max(color, vec3(0.0)), vec3(2.2));
  color = OW_SRGB_FROM_REC2020 * color;
  return clamp(color, 0.0, 1.0);
}
`;

// ─── Full-screen triangle ───

const fsGeometry = new THREE.BufferGeometry();
fsGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
fsGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
fsGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e8);

const fsScene = new THREE.Scene();
fsScene.matrixAutoUpdate = false;
const fsCamera = new THREE.Camera();
const fsMesh = new THREE.Mesh(fsGeometry, null);
fsMesh.frustumCulled = false;
fsMesh.matrixAutoUpdate = false;
fsScene.add(fsMesh);

function blit(renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
  fsMesh.material = material;
  renderer.setRenderTarget(target);
  renderer.render(fsScene, fsCamera);
}

function hdrTarget(w: number, h: number, name = 'hdr'): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

// ─── Procedural LUT ───

const LUT_SIZE = 33;

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  c = Math.max(0, c);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function createGradeLUT(): THREE.Data3DTexture {
  const data = new Uint8Array(LUT_SIZE * LUT_SIZE * LUT_SIZE * 4);
  const LUM = [0.2126, 0.7152, 0.0722];

  // Grade preset — cinematic default
  const slope = [1.0, 0.995, 0.985];
  const offset = [-0.004, -0.002, 0.004];
  const power = [1.0, 1.005, 1.02];
  const shadowTint = [-0.001, 0.006, 0.022];
  const highlightTint = [0.030, 0.014, -0.006];
  const saturation = 1.20;
  const contrast = 1.28;
  const pivot = 0.50;
  const highlightDesat = 0.10;
  const toe = 0.008;
  const shoulder = 0.60;
  const shoulderSoft = 1.20;

  const shoulderKnee = Math.min(0.98, Math.max(0.05, shoulder));
  const maxOut = pivot * Math.pow(1 / pivot, contrast);
  const shoulderNorm = 1.0 / (1.0 - Math.exp(-(maxOut - shoulderKnee) / shoulderSoft));

  for (let b = 0; b < LUT_SIZE; b++) {
    for (let g = 0; g < LUT_SIZE; g++) {
      for (let r = 0; r < LUT_SIZE; r++) {
        const idx = ((b * LUT_SIZE + g) * LUT_SIZE + r) * 4;
        let col = [r / (LUT_SIZE - 1), g / (LUT_SIZE - 1), b / (LUT_SIZE - 1)];

        // ASC-CDL: slope/offset/power per channel
        for (let c = 0; c < 3; c++) {
          col[c] = (col[c] * slope[c] + offset[c]);
          col[c] = Math.max(0, col[c]);
          col[c] = Math.pow(col[c], power[c]);
        }

        // Split tone
        const l = col[0] * LUM[0] + col[1] * LUM[1] + col[2] * LUM[2];
        const shadowW = Math.max(0, 1 - l * 2);
        const highlightW = Math.max(0, (l - 0.5) * 2);
        for (let c = 0; c < 3; c++) {
          col[c] += shadowTint[c] * shadowW + highlightTint[c] * highlightW;
        }

        // Luminance-preserving saturation
        const newL = col[0] * LUM[0] + col[1] * LUM[1] + col[2] * LUM[2];
        for (let c = 0; c < 3; c++) {
          col[c] = newL + saturation * (col[c] - newL);
        }

        // Contrast (power about pivot)
        for (let c = 0; c < 3; c++) {
          col[c] = pivot + (col[c] - pivot) * contrast;
        }

        // Highlight desaturation
        const hlL = col[0] * LUM[0] + col[1] * LUM[1] + col[2] * LUM[2];
        const hlW = Math.max(0, (hlL - 0.5) * 2);
        for (let c = 0; c < 3; c++) {
          col[c] = col[c] + (hlL - col[c]) * highlightDesat * hlW;
        }

        // Toe lift
        for (let c = 0; c < 3; c++) {
          col[c] += toe * Math.max(0, 1 - col[c] * 4);
        }

        // Shoulder roll-off
        for (let c = 0; c < 3; c++) {
          if (col[c] > shoulderKnee) {
            col[c] = shoulderKnee + shoulderSoft * (1 - Math.exp(-(col[c] - shoulderKnee) / shoulderSoft)) * shoulderNorm;
          }
          col[c] = Math.max(0, Math.min(1, col[c]));
        }

        data[idx] = Math.round(col[0] * 255);
        data[idx + 1] = Math.round(col[1] * 255);
        data[idx + 2] = Math.round(col[2] * 255);
        data[idx + 3] = 255;
      }
    }
  }

  const tex = new THREE.Data3DTexture(data, LUT_SIZE, LUT_SIZE, LUT_SIZE);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.wrapR = THREE.ClampToEdgeWrapping;
  return tex;
}

// ─── Shaders ───

const BLOOM_DOWNSAMPLE = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;

void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = owLum(c);
  float excess = max(l - uThreshold, 0.0);
  float knee = excess * uKnee + uThreshold;
  float soft = knee - excess * uKnee;
  float contrib = max(l - knee, 0.0) + soft * soft / (knee + 1e-6);
  float scale = contrib / max(l, 1e-6);
  gl_FragColor = vec4(c * scale, 1.0);
}
`;

const BLOOM_BLUR = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform vec2 uDir;
varying vec2 vUv;

void main() {
  vec3 sum = vec3(0.0);
  float weights[5];
  weights[0] = 0.227027;
  weights[1] = 0.1945946;
  weights[2] = 0.1216216;
  weights[3] = 0.054054;
  weights[4] = 0.016216;
  sum += texture2D(tSrc, vUv).rgb * weights[0];
  for (int i = 1; i < 5; i++) {
    sum += texture2D(tSrc, vUv + uDir * uTexel * float(i)).rgb * weights[i];
    sum += texture2D(tSrc, vUv - uDir * uTexel * float(i)).rgb * weights[i];
  }
  gl_FragColor = vec4(sum, 1.0);
}
`;

const BLOOM_UPSAMPLE = /* glsl */ `
precision highp float;
uniform sampler2D tLow;
uniform sampler2D tHigh;
uniform float uStrength;
varying vec2 vUv;

void main() {
  vec3 base = texture2D(tHigh, vUv).rgb;
  vec3 blur = texture2D(tLow, vUv).rgb;
  gl_FragColor = vec4(mix(base, blur, 0.35) * uStrength, 1.0);
}
`;

const COMPOSITE_SHADER = /* glsl */ `
precision highp float;
${COMMON}
${TONEMAP}

uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform sampler3D tLut;
uniform float uExposure;
uniform vec2 uTexel;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBloomStrength;
uniform float uLutStrength;
uniform float uSharpen;
uniform float uVignette;
uniform float uGrain;
uniform float uChromatic;
uniform float uAgxSlope;
uniform float uAgxPower;
uniform float uAgxSat;
uniform float uLutSize;
varying vec2 vUv;

vec3 sampleLut(vec3 c) {
  float n = uLutSize;
  vec3 uvw = clamp(c, 0.0, 1.0) * ((n - 1.0) / n) + (0.5 / n);
  return texture(tLut, uvw).rgb;
}

void main() {
  vec2 d = vUv - 0.5;
  float r2 = dot(d, d);

  // Chromatic aberration
  vec3 hdr;
  float ca = uChromatic * r2;
  if (ca > 0.00002) {
    vec2 o = d * ca;
    hdr.r = texture2D(tColor, vUv + o).r;
    hdr.g = texture2D(tColor, vUv).g;
    hdr.b = texture2D(tColor, vUv - o).b;
  } else {
    hdr = texture2D(tColor, vUv).rgb;
  }
  vec3 centre = max(texture2D(tColor, vUv).rgb, vec3(0.0));
  hdr = max(hdr, vec3(0.0));

  // Sharpen (contrast-adaptive, luminance only)
  if (uSharpen > 0.001) {
    vec3 n1 = max(texture2D(tColor, vUv + vec2(uTexel.x, 0.0)).rgb, vec3(0.0));
    vec3 n2 = max(texture2D(tColor, vUv - vec2(uTexel.x, 0.0)).rgb, vec3(0.0));
    vec3 n3 = max(texture2D(tColor, vUv + vec2(0.0, uTexel.y)).rgb, vec3(0.0));
    vec3 n4 = max(texture2D(tColor, vUv - vec2(0.0, uTexel.y)).rgb, vec3(0.0));
    float l1 = owLum(n1), l2 = owLum(n2), l3 = owLum(n3), l4 = owLum(n4);
    float lc = owLum(centre);
    float lmn = min(min(l1, l2), min(l3, l4));
    float lmx = max(max(l1, l2), max(l3, l4));
    float lblur = (l1 + l2 + l3 + l4) * 0.25;
    float contrast = (lmx - lmn) / (lmx + lmn + 0.02);
    float amount = uSharpen * (1.0 - clamp(contrast * 1.6, 0.0, 1.0));
    amount *= smoothstep(0.004, 0.03, lc);
    float gain = (lc + (lc - lblur) * amount) / max(lc, 1e-4);
    hdr *= clamp(gain, 0.0, 4.0);
  }

  // Apply exposure
  hdr *= uExposure;

  // Additive bloom (already exposure-scaled and thresholded)
  vec3 bloom = max(texture2D(tBloom, vUv).rgb, vec3(0.0));
  hdr += bloom * max(uBloomStrength, 0.0);

  // Vignette (cos^4 lens falloff, in linear light)
  float cos4 = pow(1.0 / (1.0 + r2 * 2.4), 2.0);
  hdr *= mix(1.0, cos4, uVignette);

  // AgX tone map
  vec3 col = owAgX(hdr, uAgxSlope, uAgxPower, uAgxSat);

  // Display transform
  col = clamp(col, 0.0, 1.0);
  vec3 disp = owLinearToSrgb(col);

  // LUT grade
  vec3 graded = sampleLut(disp);
  disp = mix(disp, graded, uLutStrength);

  // Film grain (less in the darks)
  if (uGrain > 0.0005) {
    float g = owHash12(gl_FragCoord.xy + uTime * 137.13) - 0.5;
    float g2 = owHash12(gl_FragCoord.xy * 1.7 - uTime * 71.3) - 0.5;
    float noise = g * 0.65 + g2 * 0.35;
    float l = owLum(disp);
    float response = uGrain * (0.35 + 0.65 * smoothstep(0.0, 0.30, l));
    disp += noise * response;
  }

  // Ordered dither
  disp += (owHash12(gl_FragCoord.xy * 0.5 + uTime) - 0.5) * 0.0022;

  gl_FragColor = vec4(disp, 1.0);
}
`;

// ─── PostProcessing class ───

export interface PostSettings {
  bloomStrength: number;
  bloomThreshold: number;
  vignette: number;
  grain: number;
  chromatic: number;
  sharpen: number;
  agxSlope: number;
  agxPower: number;
  agxSat: number;
  exposure: number;
  autoExposure: boolean;
}

export const DEFAULT_POST_SETTINGS: PostSettings = {
  bloomStrength: 0.14,
  bloomThreshold: 1.6,
  vignette: 0.24,
  grain: 0.010,
  chromatic: 0.0011,
  sharpen: 0.25,
  agxSlope: 1.0,
  agxPower: 1.0,
  agxSat: 1.2,
  exposure: 1.0,
  autoExposure: true,
};

export class PostProcessing {
  private renderer: THREE.WebGLRenderer;
  private settings: PostSettings;

  private hdrRT: THREE.WebGLRenderTarget;
  private bloomRTs: THREE.WebGLRenderTarget[] = [];
  private bloomTempRTs: THREE.WebGLRenderTarget[] = [];
  private bloomLevels = 5;

  private lutTex: THREE.Data3DTexture;

  private compositeMat: THREE.ShaderMaterial;
  private bloomDownMat: THREE.ShaderMaterial;
  private bloomBlurMat: THREE.ShaderMaterial;
  private bloomUpMat: THREE.ShaderMaterial;

  private width = 1;
  private height = 1;
  private time = 0;

  constructor(renderer: THREE.WebGLRenderer, settings?: Partial<PostSettings>) {
    this.renderer = renderer;
    this.settings = { ...DEFAULT_POST_SETTINGS, ...settings };

    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    this.width = w;
    this.height = h;

    // HDR render target
    this.hdrRT = hdrTarget(w, h, 'scene');

    // Bloom pyramid
    for (let i = 0; i < this.bloomLevels; i++) {
      const bw = Math.max(1, Math.floor(w >> (i + 1)));
      const bh = Math.max(1, Math.floor(h >> (i + 1)));
      this.bloomRTs.push(hdrTarget(bw, bh, `bloom${i}`));
      this.bloomTempRTs.push(hdrTarget(bw, bh, `bloomTmp${i}`));
    }

    // LUT
    this.lutTex = createGradeLUT();

    // Materials
    this.compositeMat = new THREE.ShaderMaterial({
      name: 'composite',
      vertexShader: FS_VERT,
      fragmentShader: COMPOSITE_SHADER,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.hdrRT.texture },
        tBloom: { value: this.bloomRTs[0]?.texture ?? null },
        tLut: { value: this.lutTex },
        uExposure: { value: this.settings.exposure },
        uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
        uResolution: { value: new THREE.Vector2(w, h) },
        uTime: { value: 0 },
        uBloomStrength: { value: this.settings.bloomStrength },
        uLutStrength: { value: 1.0 },
        uSharpen: { value: this.settings.sharpen },
        uVignette: { value: this.settings.vignette },
        uGrain: { value: this.settings.grain },
        uChromatic: { value: this.settings.chromatic },
        uAgxSlope: { value: this.settings.agxSlope },
        uAgxPower: { value: this.settings.agxPower },
        uAgxSat: { value: this.settings.agxSat },
        uLutSize: { value: LUT_SIZE },
      },
    });

    this.bloomDownMat = new THREE.ShaderMaterial({
      name: 'bloom-down',
      vertexShader: FS_VERT,
      fragmentShader: BLOOM_DOWNSAMPLE,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uThreshold: { value: this.settings.bloomThreshold },
        uKnee: { value: 0.9 },
      },
    });

    this.bloomBlurMat = new THREE.ShaderMaterial({
      name: 'bloom-blur',
      vertexShader: FS_VERT,
      fragmentShader: BLOOM_BLUR,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uDir: { value: new THREE.Vector2(1, 0) },
      },
    });

    this.bloomUpMat = new THREE.ShaderMaterial({
      name: 'bloom-up',
      vertexShader: FS_VERT,
      fragmentShader: BLOOM_UPSAMPLE,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tLow: { value: null },
        tHigh: { value: null },
        uStrength: { value: 1.0 },
      },
    });
  }

  getRenderTarget(): THREE.WebGLRenderTarget {
    return this.hdrRT;
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.hdrRT.setSize(w, h);
    for (let i = 0; i < this.bloomLevels; i++) {
      const bw = Math.max(1, Math.floor(w >> (i + 1)));
      const bh = Math.max(1, Math.floor(h >> (i + 1)));
      this.bloomRTs[i].setSize(bw, bh);
      this.bloomTempRTs[i].setSize(bw, bh);
    }
    (this.compositeMat.uniforms.uTexel.value as THREE.Vector2).set(1 / w, 1 / h);
    (this.compositeMat.uniforms.uResolution.value as THREE.Vector2).set(w, h);
  }

  updateSettings(settings: Partial<PostSettings>): void {
    Object.assign(this.settings, settings);
    this.compositeMat.uniforms.uBloomStrength.value = this.settings.bloomStrength;
    this.compositeMat.uniforms.uSharpen.value = this.settings.sharpen;
    this.compositeMat.uniforms.uVignette.value = this.settings.vignette;
    this.compositeMat.uniforms.uGrain.value = this.settings.grain;
    this.compositeMat.uniforms.uChromatic.value = this.settings.chromatic;
    this.compositeMat.uniforms.uAgxSlope.value = this.settings.agxSlope;
    this.compositeMat.uniforms.uAgxPower.value = this.settings.agxPower;
    this.compositeMat.uniforms.uAgxSat.value = this.settings.agxSat;
    this.bloomDownMat.uniforms.uThreshold.value = this.settings.bloomThreshold;
  }

  render(dt: number): void {
    this.time += dt;

    // ─── Bloom pyramid ───
    // Downsample with threshold
    this.bloomDownMat.uniforms.tSrc.value = this.hdrRT.texture;
    (this.bloomDownMat.uniforms.uTexel.value as THREE.Vector2).set(1 / this.width, 1 / this.height);
    blit(this.renderer, this.bloomDownMat, this.bloomRTs[0]);

    for (let i = 1; i < this.bloomLevels; i++) {
      this.bloomDownMat.uniforms.tSrc.value = this.bloomRTs[i - 1].texture;
      const bw = this.bloomRTs[i].width;
      const bh = this.bloomRTs[i].height;
      (this.bloomDownMat.uniforms.uTexel.value as THREE.Vector2).set(1 / bw, 1 / bh);
      blit(this.renderer, this.bloomDownMat, this.bloomRTs[i]);
    }

    // Blur each level (separable Gaussian)
    for (let i = 0; i < this.bloomLevels; i++) {
      const bw = this.bloomRTs[i].width;
      const bh = this.bloomRTs[i].height;
      this.bloomBlurMat.uniforms.tSrc.value = this.bloomRTs[i].texture;
      (this.bloomBlurMat.uniforms.uTexel.value as THREE.Vector2).set(1 / bw, 1 / bh);

      // Horizontal
      (this.bloomBlurMat.uniforms.uDir.value as THREE.Vector2).set(1, 0);
      blit(this.renderer, this.bloomBlurMat, this.bloomTempRTs[i]);

      // Vertical
      this.bloomBlurMat.uniforms.tSrc.value = this.bloomTempRTs[i].texture;
      (this.bloomBlurMat.uniforms.uDir.value as THREE.Vector2).set(0, 1);
      blit(this.renderer, this.bloomBlurMat, this.bloomRTs[i]);
    }

    // Upsample (combine levels)
    for (let i = this.bloomLevels - 2; i >= 0; i--) {
      this.bloomUpMat.uniforms.tLow.value = this.bloomRTs[i + 1].texture;
      this.bloomUpMat.uniforms.tHigh.value = this.bloomTempRTs[i].texture;
      blit(this.renderer, this.bloomUpMat, this.bloomRTs[i]);
    }

    // ─── Composite ───
    this.compositeMat.uniforms.tColor.value = this.hdrRT.texture;
    this.compositeMat.uniforms.tBloom.value = this.bloomRTs[0].texture;
    this.compositeMat.uniforms.uTime.value = this.time;
    this.compositeMat.uniforms.uExposure.value = this.settings.autoExposure ? this.settings.exposure : this.settings.exposure;

    blit(this.renderer, this.compositeMat, null);
  }

  dispose(): void {
    this.hdrRT.dispose();
    this.bloomRTs.forEach(rt => rt.dispose());
    this.bloomTempRTs.forEach(rt => rt.dispose());
    this.lutTex.dispose();
    this.compositeMat.dispose();
    this.bloomDownMat.dispose();
    this.bloomBlurMat.dispose();
    this.bloomUpMat.dispose();
  }
}
