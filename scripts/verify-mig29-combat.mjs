import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.locator("#sbPlatform").selectOption("AIRBORNE");
  await page.locator("#sbAirPreset").selectOption("fighter");
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(
    () => (document.querySelector("#scene")?.dataset.airWeaponLaunchLog ?? "").includes("R-27R"),
    null,
    { timeout: 25_000 },
  );
  const result = await page.locator("#scene").evaluate((scene) => ({
    missions: scene.dataset.airMissionStates ?? "",
    launches: scene.dataset.airWeaponLaunchLog ?? "",
    hardpoints: scene.dataset.airHardpointStates ?? "",
    categories: scene.dataset.airDefenseTargetCategories ?? "",
    targetNames: scene.dataset.airDefenseTargetNames ?? "",
    legacyRegistrations: Number(scene.dataset.airDefenseLegacyRegistrations ?? -1),
    legacyFields: Number(scene.dataset.airDefenseLegacyFields ?? -1),
  }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  if (
    errors.length ||
    !result.missions.includes("red-MIG-29A") ||
    !result.launches.includes("MiG-29A Fulcrum-A") ||
    !result.launches.includes("R-27R Alamo-A") ||
    !result.hardpoints.includes("red-MIG-29A") ||
    result.legacyRegistrations !== 0 ||
    result.legacyFields !== 0
  ) process.exitCode = 1;
} finally {
  await browser.close();
}
