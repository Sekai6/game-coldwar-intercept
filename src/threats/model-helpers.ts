import * as THREE from "three";

interface EffectOptions {
  length: number;
  radius: number;
  exhaustLength: number;
  exhaustColor?: number;
  exhaustOpacity?: number;
  mistRadius: number;
  mistLength: number;
  mistOpacity?: number;
  seekerRadius: number;
  seekerLength: number;
  shockCone?: boolean;
  glow?: { intensity: number; distance: number };
}

export function attachThreatEffects(group: THREE.Group, options: EffectOptions) {
  const exhaust = new THREE.Mesh(
    new THREE.ConeGeometry(
      options.radius * 0.5,
      options.exhaustLength,
      12,
      1,
      true,
    ),
    new THREE.MeshBasicMaterial({
      color: options.exhaustColor ?? 0xff7138,
      transparent: true,
      opacity: options.exhaustOpacity ?? 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  exhaust.rotation.x = -Math.PI / 2;
  exhaust.position.z = options.length * 0.5 + options.exhaustLength * 0.68;
  group.add(exhaust);

  const hotCore = new THREE.Mesh(
    new THREE.ConeGeometry(
      options.radius * 0.18,
      options.exhaustLength * 0.64,
      10,
      1,
      true,
    ),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  hotCore.rotation.x = -Math.PI / 2;
  hotCore.position.z = options.length * 0.5 + options.exhaustLength * 0.48;
  group.add(hotCore);

  if (options.glow) {
    const glow = new THREE.PointLight(
      options.exhaustColor ?? 0xff642d,
      options.glow.intensity,
      options.glow.distance,
    );
    glow.position.z = options.length * 0.5 + options.exhaustLength * 0.4;
    group.add(glow);
  }

  const seaMist = new THREE.Mesh(
    new THREE.ConeGeometry(
      options.mistRadius,
      options.mistLength,
      12,
      1,
      true,
    ),
    new THREE.MeshBasicMaterial({
      color: 0xbce8ec,
      transparent: true,
      opacity: options.mistOpacity ?? 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  seaMist.rotation.x = -Math.PI / 2;
  seaMist.position.z = options.length * 0.5 + options.mistLength * 0.64;
  seaMist.visible = false;
  group.add(seaMist);

  let shockCone: THREE.Mesh | undefined;
  if (options.shockCone) {
    shockCone = new THREE.Mesh(
      new THREE.ConeGeometry(2.1, 7, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xe7f4f2,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    shockCone.rotation.x = -Math.PI / 2;
    shockCone.position.z = -options.length * 0.16;
    shockCone.visible = false;
    group.add(shockCone);
  }

  const seekerFov = new THREE.Mesh(
    new THREE.ConeGeometry(
      options.seekerRadius,
      options.seekerLength,
      24,
      1,
      true,
    ),
    new THREE.MeshBasicMaterial({
      color: 0xff6554,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  seekerFov.rotation.x = -Math.PI / 2;
  seekerFov.position.z =
    -options.length * 0.5 - options.seekerLength * 0.52;
  seekerFov.visible = false;
  group.add(seekerFov);

  group.userData.exhaust = exhaust;
  group.userData.hotCore = hotCore;
  group.userData.seaMist = seaMist;
  group.userData.shockCone = shockCone;
  group.userData.seekerFov = seekerFov;
  group.userData.modelLength = options.length;
}

export interface SovietThreatModelOptions {
  length: number;
  radius: number;
  skinColor: number;
  bandColor: number;
  noseLength: number;
  wingSpan: number;
  wingChord: number;
  finThickness: number;
  finHeight: number;
  intake?: "side-lips" | "ventral";
  dorsalDetails?: boolean;
  exhaustLength: number;
  exhaustColor?: number;
  mistRadius: number;
  mistLength: number;
  seekerRadius: number;
  seekerLength: number;
  shockCone?: boolean;
}

export function createSovietThreatModel(options: SovietThreatModelOptions) {
  const group = new THREE.Group(),
    skin = new THREE.MeshStandardMaterial({
      color: options.skinColor,
      metalness: 0.58,
      roughness: 0.4,
    }),
    dark = new THREE.MeshStandardMaterial({
      color: 0x242b2c,
      metalness: 0.55,
      roughness: 0.5,
    });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(
      options.radius * 0.9,
      options.radius,
      options.length,
      14,
    ),
    skin,
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const forwardBand = new THREE.Mesh(
    new THREE.CylinderGeometry(
      options.radius * 0.94,
      options.radius * 0.94,
      0.42,
      14,
    ),
    new THREE.MeshStandardMaterial({
      color: options.bandColor,
      metalness: 0.65,
      roughness: 0.35,
    }),
  );
  forwardBand.rotation.x = Math.PI / 2;
  forwardBand.position.z = -options.length * 0.28;
  group.add(forwardBand);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(options.radius * 0.9, options.noseLength, 14),
    skin,
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -options.length * 0.5 - options.noseLength * 0.48;
  group.add(nose);
  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(
      options.radius * 0.72,
      options.radius,
      1.6,
      14,
    ),
    dark,
  );
  tail.rotation.x = Math.PI / 2;
  tail.position.z = options.length * 0.5 + 0.6;
  group.add(tail);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(options.wingSpan, options.wingChord * 0.7);
  wingShape.lineTo(options.wingSpan * 0.78, -options.wingChord * 0.45);
  wingShape.lineTo(0, -options.wingChord * 0.7);
  wingShape.closePath();
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), skin);
    wing.rotation.x = Math.PI / 2;
    wing.rotation.z = side < 0 ? Math.PI : 0;
    wing.position.set(
      side * options.radius * 0.45,
      0,
      options.dorsalDetails ? 0.5 : 1,
    );
    group.add(wing);
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(
        options.finThickness,
        options.finHeight,
        2.5,
      ),
      dark,
    );
    fin.position.set(
      side * (options.radius + 0.35),
      0,
      options.length * 0.35,
    );
    fin.rotation.z = side * 0.18;
    group.add(fin);
  }

  if (options.intake === "ventral") {
    const intake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.58, 3, 10),
      dark,
    );
    intake.rotation.x = Math.PI / 2;
    intake.position.set(0, -options.radius * 0.85, 1);
    group.add(intake);
  } else if (options.intake === "side-lips") {
    for (const side of [-1, 1]) {
      const intakeLip = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.55, 2.6),
        dark,
      );
      intakeLip.position.set(side * 0.78, -0.68, 0.9);
      intakeLip.rotation.z = side * 0.16;
      group.add(intakeLip);
    }
  }

  if (options.dorsalDetails) {
    const dorsal = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 2.8, 4.5),
      skin,
    );
    dorsal.position.set(0, 1.15, 1.5);
    dorsal.rotation.x = 0.08;
    group.add(dorsal);
    const belly = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.35, 3.8),
      dark,
    );
    belly.position.set(0, -0.78, 1.1);
    group.add(belly);
  }

  attachThreatEffects(group, {
    length: options.length,
    radius: options.radius,
    exhaustLength: options.exhaustLength,
    exhaustColor: options.exhaustColor,
    mistRadius: options.mistRadius,
    mistLength: options.mistLength,
    seekerRadius: options.seekerRadius,
    seekerLength: options.seekerLength,
    shockCone: options.shockCone,
    glow: {
      intensity: options.shockCone ? 7 : 5,
      distance: options.shockCone ? 35 : 28,
    },
  });
  return group;
}
