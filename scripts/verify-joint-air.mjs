import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => {
    const launches = document.querySelector("#scene")?.dataset.airWeaponLaunchLog ?? "";
    const scene=document.querySelector("#scene"),launchers=scene?.dataset.airDefenseLaunchers??"",categories=scene?.dataset.airDefenseTargetCategories??"";
    return launches.includes("AIM-54A") && launches.includes("KSR-5") && launches.includes("AGM-84A") && /MK 10|MK 41/.test(launchers) && categories.includes("aircraft") && categories.includes("missile");
  }, null, { timeout: 25_000 });
  await page.keyboard.press("6");
  await page.waitForTimeout(500);
  const result = await page.locator("#scene").evaluate(c => ({ enabled:c.dataset.airCombatEnabled,total:Number(c.dataset.aircraftTotal??0),live:Number(c.dataset.aircraftLive??0),blueLive:Number(c.dataset.aircraftBlueLive??0),redLive:Number(c.dataset.aircraftRedLive??0),launches:Number(c.dataset.airWeaponsLaunched??0),launchLog:c.dataset.airWeaponLaunchLog,seekerLog:c.dataset.airSeekerEventLog,hitLog:c.dataset.airWeaponHitLog,activeWeapons:Number(c.dataset.airWeaponsActive??0),shipSamShots:Number(c.dataset.shipSamShots??0),legacyAirRegistrations:Number(c.dataset.airDefenseLegacyRegistrations??-1),legacyAirFields:Number(c.dataset.airDefenseLegacyFields??-1),missingEntityRefs:Number(c.dataset.airDefenseMissingEntityRefs??-1),nonTargetableEntities:Number(c.dataset.airDefenseNonTargetableEntities??-1),ambiguousKindFields:Number(c.dataset.airDefenseAmbiguousKindFields??-1),airDefenseLaunchers:c.dataset.airDefenseLaunchers??"",airDefenseCategories:c.dataset.airDefenseTargetCategories??"",airDefenseNames:c.dataset.airDefenseTargetNames??"",aircraftTracks:Number(c.dataset.shipAirAircraftTracks??0),weaponTracks:Number(c.dataset.shipAirWeaponTracks??0),chaff:Number(c.dataset.airChaff??0),flares:Number(c.dataset.airFlares??0),hits:Number(c.dataset.airCombatHits??0),states:c.dataset.aircraftStates,formations:c.dataset.airFormationStates,missions:c.dataset.airMissionStates,escortAssignments:c.dataset.airEscortAssignments??"",phases:c.dataset.airWeaponPhases,aarAircraft:Number(c.dataset.aarAircraftCount??0),aarWeapons:Number(c.dataset.aarAirWeaponCount??0),aarDecoys:Number(c.dataset.aarAirDecoyCount??0) }));
  result.errors = errors;
  await page.screenshot({ path:"verification-joint-air.png", fullPage:true });
  console.log(JSON.stringify(result,null,2));
  if(errors.length||result.enabled!=="true"||result.total!==6||result.blueLive<1||result.launches<5||result.shipSamShots<2||result.legacyAirRegistrations!==0||result.legacyAirFields!==0||result.missingEntityRefs!==0||result.nonTargetableEntities!==0||result.ambiguousKindFields!==0||!/MK 10|MK 41/.test(result.airDefenseLaunchers)||!result.airDefenseCategories.includes("aircraft")||!result.airDefenseCategories.includes("missile")||result.aircraftTracks<1||result.weaponTracks<1||!result.launchLog?.includes("AIM-54A")||!result.seekerLog?.includes("AIM-54A Phoenix SEEKER ACQUIRED")||!result.launchLog.includes("KSR-5")||!result.launchLog.includes("AGM-84A")||!result.missions?.includes("egress")||!result.missions.includes("escort")||!result.escortAssignments.includes("blue-A-6E")||result.aarAircraft!==6||result.aarWeapons<5||!result.states||!result.formations||!result.phases)process.exitCode=1;
} finally { await browser.close(); }
