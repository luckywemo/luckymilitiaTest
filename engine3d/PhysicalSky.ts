import * as THREE from 'three';

const SKY_VERT = /* glsl */`
varying vec3 vWorldDir;
void main() {
  vWorldDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Atmospheric scattering approximation (Preetham-style simplified)
const SKY_FRAG = /* glsl */`
uniform vec3 uSunDir;
uniform float uSunIntensity;
uniform float uRayleigh;
uniform float uMie;
uniform float uTurbidity;
uniform vec3 uGroundColor;
varying vec3 vWorldDir;

const float PI = 3.14159265359;

// Rayleigh scattering coefficients (wavelength-dependent)
vec3 rayleighCoeff(float turbidity) {
  float k = 0.04 / (1.0 + turbidity * 0.1);
  return vec3(5.595e-6, 1.377e-5, 2.278e-5) * (1.0 + turbidity * k);
}

// Mie scattering coefficient
float mieCoeff(float turbidity) {
  return 0.0434 * (1.0 + turbidity * 0.05);
}

// Phase function for Mie scattering
float miePhase(float cosTheta, float g) {
  float g2 = g * g;
  return (3.0 * (1.0 - g2)) / (8.0 * PI * (2.0 + g2)) *
    ((1.0 + cosTheta * cosTheta) / pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
}

// Phase function for Rayleigh scattering
float rayleighPhase(float cosTheta) {
  return (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
}

void main() {
  vec3 dir = normalize(vWorldDir);
  float sunCos = dot(dir, normalize(uSunDir));
  float sunCos2 = sunCos * sunCos;

  // Sun elevation (0 = horizon, 1 = directly overhead)
  float elevation = max(0.0, normalize(uSunDir).y);

  // Rayleigh
  vec3 rCoeff = rayleighCoeff(uTurbidity);
  float rPhase = rayleighPhase(sunCos);

  // Mie
  float mCoeff = mieCoeff(uTurbidity);
  float mPhase = miePhase(sunCos, 0.76);

  // Optical depth — simplified path length through atmosphere
  float upDot = max(0.01, dir.y);
  float opticalDepth = 1.0 / upDot;
  float sunUpDot = max(0.01, normalize(uSunDir).y);
  float sunOpticalDepth = 1.0 / sunUpDot;
  float combinedDepth = opticalDepth + sunOpticalDepth;

  // Scattered light
  vec3 scattered = vec3(0.0);
  // Rayleigh contribution (blue sky)
  vec3 rScatter = rCoeff * rPhase * opticalDepth;
  // Mie contribution (sun glow / haze)
  float mScatter = mCoeff * mPhase * opticalDepth;

  // Transmittance
  vec3 transmittance = exp(-(rCoeff + vec3(mCoeff)) * combinedDepth);

  // Sun color shifts redder near horizon
  vec3 sunColor = mix(vec3(1.0, 0.4, 0.15), vec3(1.0, 0.95, 0.85), smoothstep(0.0, 0.3, elevation));

  // Sky color
  vec3 sky = vec3(0.0);
  sky += rScatter * uSunIntensity * 8.0;
  sky += vec3(mScatter) * sunColor * uSunIntensity * 6.0;
  sky *= transmittance;

  // Ground bounce — warm ambient from below
  float groundFactor = max(0.0, -dir.y) * 0.5;
  sky += uGroundColor * groundFactor * (0.3 + elevation * 0.4);

  // Sun disk — tight bright spot
  float sunDisk = smoothstep(0.9995, 0.99985, sunCos);
  sky += sunColor * sunDisk * uSunIntensity * 80.0;

  // Sun glow halo
  float glow = pow(max(0.0, sunCos), 8.0) * 0.3;
  sky += sunColor * glow * uSunIntensity;

  // Night sky when sun is below horizon
  float nightFactor = smoothstep(0.0, -0.1, normalize(uSunDir).y);
  vec3 nightColor = vec3(0.02, 0.03, 0.06) + vec3(0.01, 0.01, 0.02) * max(0.0, dir.y);
  sky = mix(sky, nightColor, nightFactor);

  // Stars at night (deterministic hash)
  if (normalize(uSunDir).y < -0.05) {
    vec3 starDir = dir * 100.0;
    vec3 starHash = fract(sin(starDir * vec3(12.9898, 78.233, 37.719)) * 43758.5453);
    float star = step(0.998, starHash.x * starHash.y * starHash.z);
    sky += vec3(star) * (1.0 - nightFactor * 0.5) * 2.0;
  }

  gl_FragColor = vec4(sky, 1.0);
}
`;

export interface SkySettings {
  sunAzimuth: number;    // 0-360 degrees
  sunElevation: number;  // -90 to 90 degrees
  sunIntensity: number;  // 1-10
  turbidity: number;     // 1-10 (atmospheric haze)
  rayleigh: number;      // 0.5-3
  mie: number;           // 0.01-0.5
  groundColor: THREE.Color;
  timeOfDay: number;     // 0-24 hours
  autoCycle: boolean;
  cycleSpeed: number;    // hours per second
}

export const DEFAULT_SKY_SETTINGS: SkySettings = {
  sunAzimuth: 135,
  sunElevation: 35,
  sunIntensity: 4.0,
  turbidity: 3.5,
  rayleigh: 1.0,
  mie: 0.1,
  groundColor: new THREE.Color(0x3a3020),
  timeOfDay: 14,
  autoCycle: false,
  cycleSpeed: 0.02,
};

export class PhysicalSky {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer | null;
  private skyMesh: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private settings: SkySettings;
  private sunDir = new THREE.Vector3();
  private pmrem: THREE.PMREMGenerator | null = null;
  private envMap: THREE.Texture | null = null;
  private envUpdateTimer = 0;

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer | null, settings?: Partial<SkySettings>) {
    this.scene = scene;
    this.renderer = renderer ?? null;
    this.settings = { ...DEFAULT_SKY_SETTINGS, ...settings };

    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunIntensity: { value: this.settings.sunIntensity },
        uRayleigh: { value: this.settings.rayleigh },
        uMie: { value: this.settings.mie },
        uTurbidity: { value: this.settings.turbidity },
        uGroundColor: { value: this.settings.groundColor },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.skyMesh.renderOrder = -1;
    scene.add(this.skyMesh);

    // Sun directional light
    this.sunLight = new THREE.DirectionalLight(0xfff4e5, 3.0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.camera.left = -60;
    this.sunLight.shadow.camera.right = 60;
    this.sunLight.shadow.camera.top = 60;
    this.sunLight.shadow.camera.bottom = -60;
    this.sunLight.shadow.bias = -0.0002;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Hemisphere light for ambient sky/ground bounce
    this.hemiLight = new THREE.HemisphereLight(0x8fb6ff, 0x3a3020, 0.4);
    scene.add(this.hemiLight);

    this.updateSunPosition();
  }

  private updateSunPosition() {
    const az = (this.settings.sunAzimuth * Math.PI) / 180;
    const el = (this.settings.sunElevation * Math.PI) / 180;
    this.sunDir.set(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az)
    );

    // Update sky shader
    this.skyMat.uniforms.uSunDir.value.copy(this.sunDir);
    this.skyMat.uniforms.uSunIntensity.value = this.settings.sunIntensity;

    // Position sun light far away in sun direction
    const lightPos = this.sunDir.clone().multiplyScalar(100);
    this.sunLight.position.copy(lightPos);
    this.sunLight.target.position.set(0, 0, 0);

    // Adjust light color and intensity based on sun elevation
    const elevation = this.settings.sunElevation / 90; // -1 to 1
    if (elevation > 0.1) {
      // Day
      const warmth = 1.0 - Math.min(1, elevation * 2);
      const r = 1.0;
      const g = 0.95 - warmth * 0.15;
      const b = 0.85 - warmth * 0.35;
      this.sunLight.color.setRGB(r, g, b);
      this.sunLight.intensity = this.settings.sunIntensity * (0.5 + elevation * 0.5);
      this.hemiLight.intensity = 0.3 + elevation * 0.3;
      this.hemiLight.color.setHex(0x8fb6ff);
      this.hemiLight.groundColor.setHex(0x3a3020);
    } else if (elevation > -0.1) {
      // Sunrise/sunset
      this.sunLight.color.setRGB(1.0, 0.6, 0.3);
      this.sunLight.intensity = this.settings.sunIntensity * 0.5;
      this.hemiLight.intensity = 0.2;
      this.hemiLight.color.setHex(0xff8855);
      this.hemiLight.groundColor.setHex(0x2a1a10);
    } else {
      // Night
      this.sunLight.color.setHex(0x4a5a8a);
      this.sunLight.intensity = 0.3;
      this.hemiLight.intensity = 0.15;
      this.hemiLight.color.setHex(0x2a3a5a);
      this.hemiLight.groundColor.setHex(0x1a1a20);
    }
  }

  update(dt: number) {
    if (this.settings.autoCycle) {
      this.settings.timeOfDay += this.settings.cycleSpeed * dt;
      if (this.settings.timeOfDay >= 24) this.settings.timeOfDay -= 24;

      // Map time of day to sun elevation/azimuth
      // 6am = sunrise (elevation 0), 12pm = noon (elevation 90), 6pm = sunset (elevation 0)
      const hourAngle = ((this.settings.timeOfDay - 6) / 12) * Math.PI; // 0 at 6am, PI at 6pm
      this.settings.sunElevation = Math.sin(hourAngle) * 60; // max 60 degrees at noon
      this.settings.sunAzimuth = (this.settings.timeOfDay / 24) * 360;
      this.updateSunPosition();
    }

    // Regenerate environment map periodically (every ~2s) so IBL matches sky
    this.envUpdateTimer += dt;
    if (this.envUpdateTimer > 2.0) {
      this.envUpdateTimer = 0;
      this.updateEnvironmentMap();
    }
  }

  /** Generate a PMREM environment map from the sky dome for image-based lighting. */
  private updateEnvironmentMap(): void {
    if (!this.renderer) return;
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer);
    // Render the sky dome into a temporary scene for PMREM
    const tempScene = new THREE.Scene();
    const skyClone = new THREE.Mesh(this.skyMesh.geometry, this.skyMat);
    tempScene.add(skyClone);
    const newEnv = this.pmrem.fromScene(tempScene, 0.04).texture;
    if (this.envMap) this.envMap.dispose();
    this.envMap = newEnv;
    this.scene.environment = newEnv;
  }

  getEnvironmentMap(): THREE.Texture | null {
    return this.envMap;
  }

  setTimeOfDay(hour: number) {
    this.settings.timeOfDay = hour;
    const hourAngle = ((hour - 6) / 12) * Math.PI;
    this.settings.sunElevation = Math.sin(hourAngle) * 60;
    this.settings.sunAzimuth = (hour / 24) * 360;
    this.updateSunPosition();
  }

  getSunDirection(): THREE.Vector3 {
    return this.sunDir.clone();
  }

  getSunLight(): THREE.DirectionalLight {
    return this.sunLight;
  }

  updateSettings(settings: Partial<SkySettings>) {
    Object.assign(this.settings, settings);
    this.updateSunPosition();
  }

  dispose() {
    this.scene.remove(this.skyMesh);
    this.scene.remove(this.sunLight);
    this.scene.remove(this.sunLight.target);
    this.scene.remove(this.hemiLight);
    this.skyMesh.geometry.dispose();
    this.skyMat.dispose();
    if (this.envMap) { this.envMap.dispose(); this.envMap = null; }
    if (this.pmrem) { this.pmrem.dispose(); this.pmrem = null; }
  }
}
