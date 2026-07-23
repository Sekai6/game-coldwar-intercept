import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbStartPureAir").click();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.aircraftTotal ?? 0) === 4, null, { timeout: 10_000 });
  const initial = await page.locator("#scene").evaluate(canvas => ({
    pure: canvas.dataset.pureAirCombat,
    total: Number(canvas.dataset.aircraftTotal ?? 0),
    missions: canvas.dataset.airMissionStates ?? "",
    ranges: canvas.dataset.aircraftShipRangesKm ?? "",
    surfaceThreats: Number(canvas.dataset.missilesActive ?? canvas.dataset.activeThreats ?? 0),
    samShots: Number(canvas.dataset.shipSamShots ?? 0),
  }));
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.airWeaponLaunchLog ?? "").includes("AIM-54A"), null, { timeout: 30_000 });
  const combat = await page.locator("#scene").evaluate(canvas => ({
    launches: canvas.dataset.airWeaponLaunchLog ?? "",
    samShots: Number(canvas.dataset.shipSamShots ?? 0),
    platform: canvas.dataset.enemyPlatform ?? "",
  }));
  console.log(JSON.stringify({ initial, combat, errors }, null, 2));
  if (errors.length || initial.pure !== "true" || initial.total !== 4 ||
    !initial.missions.includes("F-14A") || !initial.missions.includes("MIG-29A") ||
    initial.missions.includes("TU-16K") || initial.missions.includes("A-6E") ||
    combat.samShots !== 0 || !combat.launches.includes("AIM-54A")) process.exitCode = 1;
} finally {
  await browser.close();
}
