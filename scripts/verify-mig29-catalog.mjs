import { readFileSync } from "node:fs";
import { createMig29Model } from "../dist-test/air/models.js";

const catalog = readFileSync(new URL("../src/air/catalog.ts", import.meta.url), "utf8");
const model = createMig29Model();
const result = {
  modelLength: model.userData.modelLength,
  exhausts: model.userData.exhausts?.length ?? 0,
  platform: catalog.includes('id:"MIG-29A", name:"MiG-29A Fulcrum-A"'),
  loadout: catalog.includes('"R-27R":4,"R-73":2'),
  r27: catalog.includes('"R-27R": { id:"R-27R"') && catalog.includes('name:"R-27R Alamo-A"'),
  r73: catalog.includes('"R-73": { id:"R-73"') && catalog.includes('name:"R-73 Archer"'),
  semiActive: /"R-27R": \{[^\n]+guidance:"semi-active-radar"/.test(catalog),
  infrared: /"R-73": \{[^\n]+guidance:"infrared"/.test(catalog),
  hardpointSet: catalog.includes("const fulcrumHardpoints = [-1, 1].flatMap") &&
    catalog.includes("hardpoints:fulcrumHardpoints"),
};
console.log(JSON.stringify(result, null, 2));
if (
  !result.platform || !result.loadout || !result.r27 || !result.r73 ||
  !result.semiActive || !result.infrared || !result.hardpointSet ||
  model.userData.modelLength !== 8.65 ||
  model.userData.exhausts?.length !== 2
) process.exitCode = 1;
