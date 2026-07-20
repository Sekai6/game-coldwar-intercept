import * as THREE from "three";

export interface ThreatParticleOptions {
  nozzleZ: number;
  trailLength: number;
  radius: number;
  color: number;
  count?: number;
}

export type ThreatParticleTrail = THREE.Points<
  THREE.BufferGeometry,
  THREE.ShaderMaterial
>;

const vertexShader = /* glsl */ `
  attribute float aPhase;
  attribute vec2 aSeed;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uPixelRatio;
  uniform float uNozzleZ;
  uniform float uTrailLength;
  uniform float uRadius;
  varying float vLife;
  varying float vHeat;
  varying float vSeed;

  void main() {
    float life = fract(aPhase + uTime * mix(0.58, 0.92, aSeed.x));
    float spread = uRadius * (0.12 + life * life * 1.2);
    float angle = aSeed.y * 6.2831853 + life * 5.0;
    vec3 transformed = vec3(
      cos(angle) * spread * (0.45 + aSeed.x),
      sin(angle) * spread * 0.7 + life * life * uRadius * 0.5,
      uNozzleZ + life * uTrailLength
    );
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    float perspective = clamp(115.0 / max(1.0, -mvPosition.z), 0.25, 4.0);
    float sizeCurve = mix(8.0, 22.0, smoothstep(0.08, 0.9, life));
    gl_PointSize = sizeCurve * perspective * uPixelRatio * uIntensity;
    gl_Position = projectionMatrix * mvPosition;
    vLife = life;
    vHeat = 1.0 - smoothstep(0.0, 0.38, life);
    vSeed = aSeed.x;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uFlameColor;
  uniform float uSeaMist;
  varying float vLife;
  varying float vHeat;
  varying float vSeed;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float distanceToCenter = length(centered) * 2.0;
    if (distanceToCenter > 1.0) discard;
    float softDisc = pow(1.0 - distanceToCenter, 1.7);
    vec3 hot = mix(uFlameColor, vec3(1.0, 0.94, 0.68), vHeat);
    vec3 smoke = mix(vec3(0.20, 0.24, 0.25), vec3(0.52, 0.57, 0.57), vSeed);
    vec3 mist = vec3(0.58, 0.80, 0.82);
    float smokeMix = smoothstep(0.22, 0.68, vLife);
    vec3 color = mix(hot, smoke, smokeMix);
    color = mix(color, mist, uSeaMist * smoothstep(0.35, 0.9, vLife));
    float fadeIn = smoothstep(0.0, 0.06, vLife);
    float fadeOut = 1.0 - smoothstep(0.68, 1.0, vLife);
    float alpha = softDisc * fadeIn * fadeOut * mix(0.82, 0.28, smokeMix);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function createThreatParticleTrail(options: ThreatParticleOptions) {
  const count = options.count ?? 72,
    positions = new Float32Array(count * 3),
    phases = new Float32Array(count),
    seeds = new Float32Array(count * 2);
  for (let index = 0; index < count; index++) {
    phases[index] = index / count;
    seeds[index * 2] =
      (Math.sin((index + 1) * 12.9898) * 43758.5453) % 1;
    seeds[index * 2] = Math.abs(seeds[index * 2]);
    seeds[index * 2 + 1] =
      Math.abs((Math.sin((index + 1) * 78.233) * 12345.6789) % 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 2));
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, 0, options.nozzleZ + options.trailLength * 0.5),
    options.trailLength,
  );
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uNozzleZ: { value: options.nozzleZ },
      uTrailLength: { value: options.trailLength },
      uRadius: { value: options.radius },
      uFlameColor: { value: new THREE.Color(options.color) },
      uSeaMist: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const trail = new THREE.Points(geometry, material) as ThreatParticleTrail;
  trail.name = "threat-particle-trail";
  trail.frustumCulled = false;
  return trail;
}

export function updateThreatParticleTrail(
  trail: ThreatParticleTrail,
  time: number,
  intensity: number,
  seaMist: boolean,
) {
  trail.material.uniforms.uTime.value = time;
  trail.material.uniforms.uIntensity.value = intensity;
  trail.material.uniforms.uSeaMist.value = seaMist ? 1 : 0;
}
