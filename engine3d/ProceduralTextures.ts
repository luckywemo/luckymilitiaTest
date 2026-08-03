import * as THREE from 'three';

/**
 * Procedural PBR texture generation — all textures are canvas-generated at load time.
 * No external image files. Produces albedo, normal, and roughness maps per surface type.
 */

export type SurfaceType =
  | 'concrete' | 'plaster_cream' | 'plaster_sand' | 'plaster_blue' | 'plaster_pink'
  | 'metal' | 'metal_rust' | 'wood' | 'dirt' | 'sand' | 'gravel'
  | 'asphalt' | 'fabric' | 'rubber' | 'glass';

interface TextureSet {
  albedo: THREE.Texture;
  normal: THREE.Texture;
  roughness: THREE.Texture;
}

const cache = new Map<SurfaceType, TextureSet>();
const TEX_SIZE = 512;

// ─── Noise helpers ───

function valueNoise(width: number, height: number, scale: number, octaves: number, persistence = 0.5): Float32Array {
  const data = new Float32Array(width * height);
  let amplitude = 1;
  let totalAmp = 0;
  for (let o = 0; o < octaves; o++) {
    const freq = scale * Math.pow(2, o);
    const offsetX = Math.random() * 1000;
    const offsetY = Math.random() * 1000;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = (x / width) * freq + offsetX;
        const py = (y / height) * freq + offsetY;
        const ix = Math.floor(px);
        const iy = Math.floor(py);
        const fx = px - ix;
        const fy = py - iy;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const v00 = hash2D(ix, iy);
        const v10 = hash2D(ix + 1, iy);
        const v01 = hash2D(ix, iy + 1);
        const v11 = hash2D(ix + 1, iy + 1);
        const v = v00 * (1 - sx) * (1 - sy) + v10 * sx * (1 - sy) + v01 * (1 - sx) * sy + v11 * sx * sy;
        data[y * width + x] += v * amplitude;
      }
    }
    totalAmp += amplitude;
    amplitude *= persistence;
  }
  for (let i = 0; i < data.length; i++) data[i] /= totalAmp;
  return data;
}

function hash2D(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── Normal map generation from height field ───

function heightToNormal(height: Float32Array, width: number, height_dim: number, strength: number): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height_dim;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height_dim);
  const dx = 1 / width;
  const dy = 1 / height_dim;

  for (let y = 0; y < height_dim; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const hx = height[idx] - height[y * width + ((x + 1) % width)];
      const hy = height[idx] - height[((y + 1) % height_dim) * width + x];
      const nx = -hx * strength / dx;
      const ny = -hy * strength / dy;
      const nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const p = idx * 4;
      imgData.data[p] = clamp((nx / len * 0.5 + 0.5) * 255, 0, 255);
      imgData.data[p + 1] = clamp((ny / len * 0.5 + 0.5) * 255, 0, 255);
      imgData.data[p + 2] = clamp((nz / len * 0.5 + 0.5) * 255, 0, 255);
      imgData.data[p + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ─── Per-surface generators ───

function makeConcrete(): TextureSet {
  const S = TEX_SIZE;
  const noise = valueNoise(S, S, 8, 5, 0.55);
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = S; albedoCanvas.height = S;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);

  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const grime = Math.pow(n, 1.5);
    const base = 0.45 + grime * 0.25;
    const r = clamp(base * 0.62 + (Math.random() - 0.5) * 0.04, 0, 1);
    const g = clamp(base * 0.60 + (Math.random() - 0.5) * 0.04, 0, 1);
    const b = clamp(base * 0.56 + (Math.random() - 0.5) * 0.04, 0, 1);
    const p = i * 4;
    imgData.data[p] = r * 255;
    imgData.data[p + 1] = g * 255;
    imgData.data[p + 2] = b * 255;
    imgData.data[p + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Cracks
  ctx.strokeStyle = 'rgba(20,18,16,0.7)';
  ctx.lineWidth = 1.5;
  for (let c = 0; c < 8; c++) {
    let x = Math.random() * S;
    let y = Math.random() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 20 + Math.random() * 30; s++) {
      x += (Math.random() - 0.5) * 30;
      y += (Math.random() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Stains
  for (let s = 0; s < 15; s++) {
    const sx = Math.random() * S;
    const sy = Math.random() * S;
    const sr = 10 + Math.random() * 40;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grad.addColorStop(0, 'rgba(30,25,20,0.15)');
    grad.addColorStop(1, 'rgba(30,25,20,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;

  // Roughness — mostly rough with some smooth patches
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = S; roughCanvas.height = S;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const r = clamp(0.7 + n * 0.25 + (Math.random() - 0.5) * 0.05, 0.3, 0.95);
    const p = i * 4;
    rImg.data[p] = r * 255;
    rImg.data[p + 1] = r * 255;
    rImg.data[p + 2] = r * 255;
    rImg.data[p + 3] = 255;
  }
  rCtx.putImageData(rImg, 0, 0);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  const normal = heightToNormal(noise, S, S, 2.0);

  return { albedo, normal, roughness };
}

function makePlaster(baseColor: [number, number, number]): TextureSet {
  const S = TEX_SIZE;
  const noise = valueNoise(S, S, 12, 4, 0.5);
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = S; albedoCanvas.height = S;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);

  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const variation = 0.85 + n * 0.3;
    const p = i * 4;
    imgData.data[p] = clamp(baseColor[0] * variation + (Math.random() - 0.5) * 0.02, 0, 1) * 255;
    imgData.data[p + 1] = clamp(baseColor[1] * variation + (Math.random() - 0.5) * 0.02, 0, 1) * 255;
    imgData.data[p + 2] = clamp(baseColor[2] * variation + (Math.random() - 0.5) * 0.02, 0, 1) * 255;
    imgData.data[p + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Peeling / damage patches
  for (let s = 0; s < 20; s++) {
    const sx = Math.random() * S;
    const sy = Math.random() * S;
    const sr = 8 + Math.random() * 25;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grad.addColorStop(0, `rgba(${Math.floor(baseColor[0] * 0.5 * 255)},${Math.floor(baseColor[1] * 0.5 * 255)},${Math.floor(baseColor[2] * 0.5 * 255)},0.4)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }
  // Water stains
  for (let s = 0; s < 8; s++) {
    const sx = Math.random() * S;
    const sy = Math.random() * S;
    const sr = 15 + Math.random() * 50;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grad.addColorStop(0, 'rgba(40,35,25,0.12)');
    grad.addColorStop(0.7, 'rgba(40,35,25,0.06)');
    grad.addColorStop(1, 'rgba(40,35,25,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = S; roughCanvas.height = S;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const r = clamp(0.75 + n * 0.2, 0.5, 0.95);
    const p = i * 4;
    rImg.data[p] = r * 255;
    rImg.data[p + 1] = r * 255;
    rImg.data[p + 2] = r * 255;
    rImg.data[p + 3] = 255;
  }
  rCtx.putImageData(rImg, 0, 0);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  const normal = heightToNormal(noise, S, S, 1.2);

  return { albedo, normal, roughness };
}

function makeMetal(rusty = false): TextureSet {
  const S = TEX_SIZE;
  const noise = valueNoise(S, S, 20, 5, 0.5);
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = S; albedoCanvas.height = S;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);

  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const p = i * 4;
    if (rusty) {
      const rust = Math.pow(n, 2);
      const r = clamp(0.35 + rust * 0.4 + (Math.random() - 0.5) * 0.05, 0, 1);
      const g = clamp(0.18 + rust * 0.2 + (Math.random() - 0.5) * 0.03, 0, 1);
      const b = clamp(0.08 + rust * 0.08 + (Math.random() - 0.5) * 0.02, 0, 1);
      imgData.data[p] = r * 255;
      imgData.data[p + 1] = g * 255;
      imgData.data[p + 2] = b * 255;
    } else {
      const v = clamp(0.12 + n * 0.15 + (Math.random() - 0.5) * 0.02, 0.05, 0.35);
      imgData.data[p] = v * 255;
      imgData.data[p + 1] = v * 255;
      imgData.data[p + 2] = v * 255;
    }
    imgData.data[p + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Scratches
  if (!rusty) {
    ctx.strokeStyle = 'rgba(80,80,85,0.3)';
    ctx.lineWidth = 0.8;
    for (let s = 0; s < 30; s++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      const len = 20 + Math.random() * 60;
      const ang = Math.random() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = S; roughCanvas.height = S;
  const rCtx = roughCanvas.getContext('2d')!;
  const rImg = rCtx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const r = rusty ? clamp(0.65 + n * 0.3, 0.4, 0.95) : clamp(0.15 + n * 0.35, 0.05, 0.6);
    const p = i * 4;
    rImg.data[p] = r * 255;
    rImg.data[p + 1] = r * 255;
    rImg.data[p + 2] = r * 255;
    rImg.data[p + 3] = 255;
  }
  rCtx.putImageData(rImg, 0, 0);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  const normal = heightToNormal(noise, S, S, rusty ? 2.5 : 1.0);

  return { albedo, normal, roughness };
}

function makeWood(): TextureSet {
  const S = TEX_SIZE;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = S; albedoCanvas.height = S;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);

  // Wood grain — vertical lines with variation
  for (let x = 0; x < S; x++) {
    const grainOffset = Math.sin(x * 0.05) * 10 + Math.sin(x * 0.13) * 5;
    for (let y = 0; y < S; y++) {
      const grain = Math.sin((y + grainOffset) * 0.15) * 0.5 + 0.5;
      const fine = Math.sin(y * 1.2) * 0.1;
      const v = clamp(0.35 + grain * 0.25 + fine + (Math.random() - 0.5) * 0.03, 0.2, 0.7);
      const r = v * 0.55;
      const g = v * 0.38;
      const b = v * 0.20;
      const p = (y * S + x) * 4;
      imgData.data[p] = r * 255;
      imgData.data[p + 1] = g * 255;
      imgData.data[p + 2] = b * 255;
      imgData.data[p + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Knots
  for (let k = 0; k < 3; k++) {
    const kx = Math.random() * S;
    const ky = Math.random() * S;
    const kr = 5 + Math.random() * 12;
    const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
    grad.addColorStop(0, 'rgba(30,20,10,0.6)');
    grad.addColorStop(1, 'rgba(30,20,10,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(kx - kr, ky - kr, kr * 2, kr * 2);
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;

  // Height for normal
  const heightData = new Float32Array(S * S);
  for (let x = 0; x < S; x++) {
    const grainOffset = Math.sin(x * 0.05) * 10;
    for (let y = 0; y < S; y++) {
      heightData[y * S + x] = Math.sin((y + grainOffset) * 0.15) * 0.5 + 0.5;
    }
  }

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = S; roughCanvas.height = S;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = 'rgb(180,180,180)';
  rCtx.fillRect(0, 0, S, S);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  const normal = heightToNormal(heightData, S, S, 1.5);

  return { albedo, normal, roughness };
}

function makeSand(): TextureSet {
  const S = TEX_SIZE;
  const noise = valueNoise(S, S, 6, 5, 0.5);
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = S; albedoCanvas.height = S;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);

  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const v = 0.65 + n * 0.2 + (Math.random() - 0.5) * 0.03;
    const p = i * 4;
    imgData.data[p] = clamp(v * 0.78, 0, 1) * 255;
    imgData.data[p + 1] = clamp(v * 0.68, 0, 1) * 255;
    imgData.data[p + 2] = clamp(v * 0.48, 0, 1) * 255;
    imgData.data[p + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Ripple lines
  ctx.strokeStyle = 'rgba(120,100,60,0.15)';
  ctx.lineWidth = 1;
  for (let r = 0; r < 30; r++) {
    const y = Math.random() * S;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < S; x += 10) {
      ctx.lineTo(x, y + Math.sin(x * 0.1 + r) * 3);
    }
    ctx.stroke();
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = S; roughCanvas.height = S;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = 'rgb(230,230,230)';
  rCtx.fillRect(0, 0, S, S);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  const normal = heightToNormal(noise, S, S, 0.8);

  return { albedo, normal, roughness };
}

function makeDirt(): TextureSet {
  const S = TEX_SIZE;
  const noise = valueNoise(S, S, 10, 5, 0.55);
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = S; albedoCanvas.height = S;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);

  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const v = 0.25 + n * 0.2 + (Math.random() - 0.5) * 0.04;
    const p = i * 4;
    imgData.data[p] = clamp(v * 0.50, 0, 1) * 255;
    imgData.data[p + 1] = clamp(v * 0.38, 0, 1) * 255;
    imgData.data[p + 2] = clamp(v * 0.25, 0, 1) * 255;
    imgData.data[p + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Small rocks
  for (let r = 0; r < 80; r++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const s = 1 + Math.random() * 3;
    ctx.fillStyle = `rgba(${60 + Math.random() * 30},${55 + Math.random() * 25},${50 + Math.random() * 20},0.6)`;
    ctx.fillRect(x, y, s, s);
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = S; roughCanvas.height = S;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = 'rgb(235,235,235)';
  rCtx.fillRect(0, 0, S, S);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  const normal = heightToNormal(noise, S, S, 1.5);

  return { albedo, normal, roughness };
}

function makeAsphalt(): TextureSet {
  const S = TEX_SIZE;
  const noise = valueNoise(S, S, 30, 4, 0.5);
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = S; albedoCanvas.height = S;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);

  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const v = 0.08 + n * 0.08 + (Math.random() - 0.5) * 0.02;
    const p = i * 4;
    imgData.data[p] = clamp(v, 0, 1) * 255;
    imgData.data[p + 1] = clamp(v, 0, 1) * 255;
    imgData.data[p + 2] = clamp(v * 1.02, 0, 1) * 255;
    imgData.data[p + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Road markings — faded
  ctx.fillStyle = 'rgba(180,170,140,0.15)';
  ctx.fillRect(S * 0.45, 0, S * 0.04, S);

  // Potholes
  for (let p = 0; p < 5; p++) {
    const px = Math.random() * S;
    const py = Math.random() * S;
    const pr = 4 + Math.random() * 10;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    grad.addColorStop(0, 'rgba(10,10,10,0.5)');
    grad.addColorStop(1, 'rgba(10,10,10,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = S; roughCanvas.height = S;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = 'rgb(210,210,210)';
  rCtx.fillRect(0, 0, S, S);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  const normal = heightToNormal(noise, S, S, 0.6);

  return { albedo, normal, roughness };
}

function makeGravel(): TextureSet {
  const S = TEX_SIZE;
  const noise = valueNoise(S, S, 15, 4, 0.5);
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = S; albedoCanvas.height = S;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);

  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const v = 0.30 + n * 0.25 + (Math.random() - 0.5) * 0.05;
    const p = i * 4;
    imgData.data[p] = clamp(v * 0.55, 0, 1) * 255;
    imgData.data[p + 1] = clamp(v * 0.50, 0, 1) * 255;
    imgData.data[p + 2] = clamp(v * 0.45, 0, 1) * 255;
    imgData.data[p + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Stones
  for (let s = 0; s < 120; s++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const sz = 2 + Math.random() * 5;
    const shade = 0.3 + Math.random() * 0.3;
    ctx.fillStyle = `rgba(${shade * 200},${shade * 190},${shade * 180},0.5)`;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = S; roughCanvas.height = S;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = 'rgb(225,225,225)';
  rCtx.fillRect(0, 0, S, S);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  const normal = heightToNormal(noise, S, S, 2.0);

  return { albedo, normal, roughness };
}

function makeFabric(): TextureSet {
  const S = TEX_SIZE;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = S; albedoCanvas.height = S;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);

  // Woven pattern
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const weave = (Math.sin(x * 1.5) * Math.sin(y * 1.5)) * 0.5 + 0.5;
      const v = 0.4 + weave * 0.15 + (Math.random() - 0.5) * 0.03;
      const p = (y * S + x) * 4;
      imgData.data[p] = clamp(v * 0.5, 0, 1) * 255;
      imgData.data[p + 1] = clamp(v * 0.45, 0, 1) * 255;
      imgData.data[p + 2] = clamp(v * 0.35, 0, 1) * 255;
      imgData.data[p + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = S; roughCanvas.height = S;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = 'rgb(240,240,240)';
  rCtx.fillRect(0, 0, S, S);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  const heightData = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    const x = i % S;
    const y = Math.floor(i / S);
    heightData[i] = (Math.sin(x * 1.5) * Math.sin(y * 1.5)) * 0.5 + 0.5;
  }
  const normal = heightToNormal(heightData, S, S, 1.0);

  return { albedo, normal, roughness };
}

function makeRubber(): TextureSet {
  const S = TEX_SIZE;
  const noise = valueNoise(S, S, 25, 4, 0.5);
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = S; albedoCanvas.height = S;
  const ctx = albedoCanvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);

  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const v = 0.05 + n * 0.05;
    const p = i * 4;
    imgData.data[p] = v * 255;
    imgData.data[p + 1] = v * 255;
    imgData.data[p + 2] = v * 255;
    imgData.data[p + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Tread pattern
  ctx.fillStyle = 'rgba(20,20,20,0.8)';
  for (let x = 0; x < S; x += 16) {
    ctx.fillRect(x, 0, 8, S);
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = S; roughCanvas.height = S;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = 'rgb(245,245,245)';
  rCtx.fillRect(0, 0, S, S);
  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  const normal = heightToNormal(noise, S, S, 0.8);

  return { albedo, normal, roughness };
}

// ─── Public API ───

const generators: Record<SurfaceType, () => TextureSet> = {
  concrete: makeConcrete,
  plaster_cream: () => makePlaster([0.82, 0.76, 0.58]),
  plaster_sand: () => makePlaster([0.78, 0.68, 0.48]),
  plaster_blue: () => makePlaster([0.45, 0.55, 0.68]),
  plaster_pink: () => makePlaster([0.72, 0.55, 0.52]),
  metal: () => makeMetal(false),
  metal_rust: () => makeMetal(true),
  wood: makeWood,
  dirt: makeDirt,
  sand: makeSand,
  gravel: makeGravel,
  asphalt: makeAsphalt,
  fabric: makeFabric,
  rubber: makeRubber,
  glass: () => makeMetal(false), // placeholder
};

export function getSurfaceTextures(type: SurfaceType): TextureSet {
  let set = cache.get(type);
  if (!set) {
    set = generators[type]();
    cache.set(type, set);
  }
  return set;
}

export function makeSurfaceMaterial(
  type: SurfaceType,
  opts: { repeat?: number; metalness?: number; envMapIntensity?: number } = {}
): THREE.MeshStandardMaterial {
  const tex = getSurfaceTextures(type);
  const repeat = opts.repeat ?? 1;
  tex.albedo.repeat.set(repeat, repeat);
  tex.normal.repeat.set(repeat, repeat);
  tex.roughness.repeat.set(repeat, repeat);

  const isMetal = type === 'metal' || type === 'metal_rust';
  const metalness = opts.metalness ?? (isMetal ? 0.9 : 0.0);
  const envIntensity = opts.envMapIntensity ?? (isMetal ? 0.8 : 0.35);

  return new THREE.MeshStandardMaterial({
    map: tex.albedo,
    normalMap: tex.normal,
    roughnessMap: tex.roughness,
    roughness: 1.0,
    metalness,
    envMapIntensity: envIntensity,
  });
}

export function disposeAllTextures(): void {
  cache.forEach((set) => {
    set.albedo.dispose();
    set.normal.dispose();
    set.roughness.dispose();
  });
  cache.clear();
}
