import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=2"],
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
    const launchers=document.querySelector("#scene")?.dataset.airDefenseLaunchers??"";
    return launches.includes("AIM-54A") && launches.includes("KSR-5") && launches.includes("AGM-84A") && /MK 10|MK 41/.test(launchers);
  }, null, { timeout: 25_000 });
  await page.keyboard.press("6");
  await page.waitForTimeout(500);
  const result = await page.locator("#scene").evaluate(c => ({ enabled:c.dataset.airCombatEnabled,total:Number(c.dataset.aircraftTotal??0),live:Number(c.dataset.aircraftLive??0),blueLive:Number(c.dataset.aircraftBlueLive??0),redLive:Number(c.dataset.aircraftRedLive??0),launches:Number(c.dataset.airWeaponsLaunched??0),launchLog:c.dataset.airWeaponLaunchLog,activeWeapons:Number(c.dataset.airWeaponsActive??0),shipSamShots:Number(c.dataset.shipSamShots??0),airDefenseLaunchers:c.dataset.airDefenseLaunchers??"",chaff:Number(c.dataset.airChaff??0),flares:Number(c.dataset.airFlares??0),hits:Number(c.dataset.airCombatHits??0),states:c.dataset.aircraftStates,phases:c.dataset.airWeaponPhases }));
  result.errors = errors;
  await page.screenshot({ path:"verification-joint-air.png", fullPage:true });
  console.log(JSON.stringify(result,null,2));
  if(errors.length||result.enabled!=="true"||result.total!==6||result.blueLive<1||result.redLive<1||result.launches<5||result.shipSamShots<1||!/MK 10|MK 41/.test(result.airDefenseLaunchers)||!result.launchLog?.includes("AIM-54A")||!result.launchLog.includes("KSR-5")||!result.launchLog.includes("AGM-84A")||!result.states||!result.phases)process.exitCode=1;
} finally { await browser.close(); }
