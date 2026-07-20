import * as THREE from "three";

export type OceanBackend = "webgl-cpu-waves" | "webgpu-fft";

export interface OceanSurface {
  readonly object: THREE.Object3D;
  readonly backend: OceanBackend;
  update(time: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

class WebglCpuOcean implements OceanSurface {
  readonly backend = "webgl-cpu-waves" as const;
  readonly object: THREE.Mesh;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly positions: THREE.BufferAttribute;
  private readonly base: Float32Array;
  private frame = 0;

  constructor() {
    this.geometry = new THREE.PlaneGeometry(1800, 1800, 64, 64);
    this.positions = this.geometry.attributes.position as THREE.BufferAttribute;
    this.base = Float32Array.from(
      this.positions.array as ArrayLike<number>,
    );
    this.object = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({
        color: 0x0a3340,
        roughness: 0.68,
        metalness: 0.18,
        flatShading: false,
      }),
    );
    this.object.rotation.x = -Math.PI / 2;
    this.object.receiveShadow = true;
  }

  update(time: number) {
    for (let index = 0; index < this.positions.count; index++) {
      const offset = index * 3;
      const x = this.base[offset];
      const y = this.base[offset + 1];
      this.positions.setZ(
        index,
        Math.sin(x * 0.026 + time * 0.72) * 0.48 +
          Math.sin(y * 0.019 - time * 0.54) * 0.34 +
          Math.sin((x + y) * 0.011 + time * 0.31) * 0.2,
      );
    }
    this.positions.needsUpdate = true;
    if (++this.frame % 8 === 0) this.geometry.computeVertexNormals();
  }

  resize(_width: number, _height: number) {}

  dispose() {
    this.geometry.dispose();
    const material = this.object.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
  }
}

export function createOceanSurface(): OceanSurface {
  return new WebglCpuOcean();
}
