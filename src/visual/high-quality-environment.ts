import * as THREE from "three";

export interface HighQualityEnvironment {
  readonly object: THREE.Group;
  readonly cloudCount: number;
  readonly fogVolumeCount: number;
  setEnabled(enabled: boolean): void;
  update(time: number, cameraPosition: THREE.Vector3): void;
  dispose(): void;
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 91.731 + salt * 17.137) * 43758.5453;
  return value - Math.floor(value);
}

export function createHighQualityEnvironment(): HighQualityEnvironment {
  const object = new THREE.Group();
  object.name = "high-quality-environment";

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x173c68) },
      horizonColor: { value: new THREE.Color(0x7899ac) },
      sunColor: { value: new THREE.Color(0xffd6a0) },
      sunDirection: { value: new THREE.Vector3(-0.45, 0.72, 0.32).normalize() },
    },
    vertexShader: `varying vec3 vDirection; void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec3 vDirection;uniform vec3 topColor;uniform vec3 horizonColor;uniform vec3 sunColor;uniform vec3 sunDirection;void main(){float h=smoothstep(-.12,.72,vDirection.y);float sun=pow(max(dot(vDirection,sunDirection),0.0),180.0);vec3 color=mix(horizonColor,topColor,h)+sunColor*sun*1.8;gl_FragColor=vec4(color,1.0);}`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1450, 32, 20), skyMaterial);
  sky.frustumCulled = false;
  object.add(sky);

  const cloudGeometry = new THREE.IcosahedronGeometry(1, 1);
  const cloudMaterial = new THREE.MeshLambertMaterial({
    color: 0xe9eef0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const cloudCount = 52;
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, cloudCount);
  const transform = new THREE.Object3D();
  for (let index = 0; index < cloudCount; index++) {
    const layer = index % 3;
    transform.position.set(
      (seeded(index, 1) - 0.5) * 1500,
      105 + layer * 52 + seeded(index, 2) * 28,
      (seeded(index, 3) - 0.5) * 1500,
    );
    transform.scale.set(28 + seeded(index, 4) * 52, 7 + seeded(index, 5) * 12, 18 + seeded(index, 6) * 42);
    transform.rotation.y = seeded(index, 7) * Math.PI;
    transform.updateMatrix();
    clouds.setMatrixAt(index, transform.matrix);
  }
  clouds.instanceMatrix.needsUpdate = true;
  object.add(clouds);

  const fogGeometry = new THREE.SphereGeometry(1, 12, 8);
  const fogMaterial = new THREE.MeshBasicMaterial({
    color: 0x9eb4bd,
    transparent: true,
    opacity: 0.045,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const fogVolumeCount = 18;
  const fogVolumes = new THREE.InstancedMesh(fogGeometry, fogMaterial, fogVolumeCount);
  for (let index = 0; index < fogVolumeCount; index++) {
    transform.position.set((seeded(index, 11) - 0.5) * 900, 12 + seeded(index, 12) * 58, (seeded(index, 13) - 0.5) * 900);
    transform.scale.set(65 + seeded(index, 14) * 90, 18 + seeded(index, 15) * 30, 65 + seeded(index, 16) * 90);
    transform.rotation.y = seeded(index, 17) * Math.PI;
    transform.updateMatrix();
    fogVolumes.setMatrixAt(index, transform.matrix);
  }
  fogVolumes.instanceMatrix.needsUpdate = true;
  object.add(fogVolumes);
  object.visible = false;

  return {
    object,
    cloudCount,
    fogVolumeCount,
    setEnabled: (enabled) => { object.visible = enabled; },
    update: (time, cameraPosition) => {
      if (!object.visible) return;
      sky.position.copy(cameraPosition);
      clouds.position.x = (time * 1.6) % 1500 - 750;
      fogVolumes.rotation.y = time * 0.002;
    },
    dispose: () => {
      sky.geometry.dispose(); skyMaterial.dispose();
      cloudGeometry.dispose(); cloudMaterial.dispose();
      fogGeometry.dispose(); fogMaterial.dispose();
    },
  };
}
