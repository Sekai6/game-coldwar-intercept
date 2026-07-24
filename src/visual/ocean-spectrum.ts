import * as THREE from "three";

export interface OceanSpectrumAtlas {
  texture: THREE.DataTexture;
  frames: number;
  resolution: number;
}

interface ComplexField {
  re: Float64Array;
  im: Float64Array;
}

const TAU = Math.PI * 2;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianPair(random: () => number): [number, number] {
  const radius = Math.sqrt(-2 * Math.log(Math.max(1e-8, random())));
  const angle = TAU * random();
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

function fft1d(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const angle = (inverse ? TAU : -TAU) / length;
    const stepRe = Math.cos(angle), stepIm = Math.sin(angle);
    for (let start = 0; start < n; start += length) {
      let twiddleRe = 1, twiddleIm = 0;
      for (let offset = 0; offset < length / 2; offset++) {
        const even = start + offset, odd = even + length / 2;
        const oddRe = re[odd] * twiddleRe - im[odd] * twiddleIm;
        const oddIm = re[odd] * twiddleIm + im[odd] * twiddleRe;
        re[odd] = re[even] - oddRe; im[odd] = im[even] - oddIm;
        re[even] += oddRe; im[even] += oddIm;
        const nextRe = twiddleRe * stepRe - twiddleIm * stepIm;
        twiddleIm = twiddleRe * stepIm + twiddleIm * stepRe;
        twiddleRe = nextRe;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

function ifft2(field: ComplexField, size: number) {
  const re = new Float64Array(size), im = new Float64Array(size);
  for (let y = 0; y < size; y++) {
    const row = y * size;
    for (let x = 0; x < size; x++) { re[x] = field.re[row + x]; im[x] = field.im[row + x]; }
    fft1d(re, im, true);
    for (let x = 0; x < size; x++) { field.re[row + x] = re[x]; field.im[row + x] = im[x]; }
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) { re[y] = field.re[y * size + x]; im[y] = field.im[y * size + x]; }
    fft1d(re, im, true);
    for (let y = 0; y < size; y++) { field.re[y * size + x] = re[y]; field.im[y * size + x] = im[y]; }
  }
}

export function createTessendorfOceanSpectrum(size = 64, frames = 16): OceanSpectrumAtlas {
  if ((size & (size - 1)) !== 0) throw new Error("Ocean FFT resolution must be a power of two");
  const count = size * size, patchLength = 420, gravity = 9.81;
  const windX = 0.91, windZ = 0.414, windSpeed = 18;
  const largestWave = windSpeed * windSpeed / gravity;
  const h0Re = new Float64Array(count), h0Im = new Float64Array(count);
  const waveX = new Float64Array(count), waveZ = new Float64Array(count), omega = new Float64Array(count);
  const random = seededRandom(0x4f434541);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x;
    const kx = TAU * (x - size / 2) / patchLength, kz = TAU * (y - size / 2) / patchLength;
    const k2 = kx * kx + kz * kz, k = Math.sqrt(k2);
    waveX[index] = kx; waveZ[index] = kz; omega[index] = Math.sqrt(gravity * k);
    if (k < 1e-5) continue;
    const alignment = (kx * windX + kz * windZ) / k;
    const damping = largestWave * 0.025;
    const phillips = 0.00042 * Math.exp(-1 / (k2 * largestWave * largestWave)) * alignment * alignment
      * Math.exp(-k2 * damping * damping) / (k2 * k2);
    const [gRe, gIm] = gaussianPair(random), scale = Math.sqrt(Math.max(0, phillips) * 0.5);
    h0Re[index] = gRe * scale; h0Im[index] = gIm * scale;
  }

  const pixels = new Uint8Array(size * size * frames * 4), loopSeconds = 18;
  for (let frame = 0; frame < frames; frame++) {
    const height: ComplexField = { re: new Float64Array(count), im: new Float64Array(count) };
    const dispX: ComplexField = { re: new Float64Array(count), im: new Float64Array(count) };
    const dispZ: ComplexField = { re: new Float64Array(count), im: new Float64Array(count) };
    const time = loopSeconds * frame / frames;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x, mirror = ((size - y) % size) * size + ((size - x) % size);
      const quantizedOmega = Math.floor(omega[i] * loopSeconds / TAU) * TAU / loopSeconds;
      const c = Math.cos(quantizedOmega * time), s = Math.sin(quantizedOmega * time);
      const aRe = h0Re[i] * c - h0Im[i] * s, aIm = h0Re[i] * s + h0Im[i] * c;
      const bRe = h0Re[mirror] * c + h0Im[mirror] * s, bIm = h0Re[mirror] * s - h0Im[mirror] * c;
      const hRe = aRe + bRe, hIm = aIm + bIm, k = Math.hypot(waveX[i], waveZ[i]);
      height.re[i] = hRe; height.im[i] = hIm;
      if (k > 1e-5) {
        const sx = -waveX[i] / k * 1.28, sz = -waveZ[i] / k * 1.28;
        dispX.re[i] = -hIm * sx; dispX.im[i] = hRe * sx;
        dispZ.re[i] = -hIm * sz; dispZ.im[i] = hRe * sz;
      }
    }
    ifft2(height, size); ifft2(dispX, size); ifft2(dispZ, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x, left = y * size + (x + size - 1) % size, right = y * size + (x + 1) % size;
      const down = ((y + size - 1) % size) * size + x, up = ((y + 1) % size) * size + x;
      const physicalDisplacementScale = 32;
      const cellScale = physicalDisplacementScale * size / (2 * patchLength);
      const jxx = 1 + (dispX.re[right] - dispX.re[left]) * cellScale;
      const jzz = 1 + (dispZ.re[up] - dispZ.re[down]) * cellScale;
      const jxz = (dispX.re[up] - dispX.re[down]) * cellScale;
      const jzx = (dispZ.re[right] - dispZ.re[left]) * cellScale;
      const jacobian = jxx * jzz - jxz * jzx;
      const target = ((frame * size + y) * size + x) * 4;
      pixels[target] = THREE.MathUtils.clamp(Math.round(128 + dispX.re[i] * 4000), 0, 255);
      pixels[target + 1] = THREE.MathUtils.clamp(Math.round(128 + dispZ.re[i] * 4000), 0, 255);
      pixels[target + 2] = THREE.MathUtils.clamp(Math.round(128 + height.re[i] * 4600), 0, 255);
      pixels[target + 3] = THREE.MathUtils.clamp(Math.round((1 - jacobian) * 420), 0, 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size * frames, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
  texture.name = "Tessendorf FFT ocean spectrum atlas";
  return { texture, frames, resolution: size };
}
