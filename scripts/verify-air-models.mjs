import {
  createA6Model,
  createF14Model,
  createMig29Model,
  createTu16Model,
} from "../dist-test/air/models.js";

const definitions = [
  ["F-14A", createF14Model, ["tandem-canopy", "variable-sweep-wings", "twin-tails"]],
  ["Tu-16K", createTu16Model, ["glazed-nose", "wing-engine-pods", "ventral-radar"]],
  ["A-6E", createA6Model, ["side-by-side-canopy", "blunt-radome", "dorsal-speed-brake"]],
  ["MiG-29A", createMig29Model, ["lerx", "separate-intakes", "canted-twin-tails"]],
];
const result = definitions.map(([name, factory, required]) => {
  const model = factory();
  let meshes = 0;
  model.traverse((object) => { if (object.isMesh) meshes++; });
  return {
    name,
    meshes,
    tags: model.userData.detailTags,
    exhausts: model.userData.exhausts?.length ?? 0,
    contrails: model.userData.contrails?.length ?? 0,
    validTags: required.every((tag) => model.userData.detailTags?.includes(tag)),
  };
});
console.log(JSON.stringify(result, null, 2));
if (result.some((model) => !model.validTags || model.meshes < 18 || model.meshes > 48 || model.contrails !== 2 || model.exhausts < 2))
  process.exitCode = 1;
