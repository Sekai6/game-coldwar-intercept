import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  const results = {};
  for (const preset of ["fighter", "joint"]) {
    await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.locator("#sbPlatform").selectOption("AIRBORNE");
    await page.locator("#sbAirPreset").selectOption(preset);
    await page.locator("#sbAirCombat").check();
    await page.locator("#sbStart").click();
    await page.getByRole("button", { name: "TIME: 1X" }).click();
    await page.getByRole("button", { name: "TIME: 2X" }).click();
    await page.waitForTimeout(2500);
    await page.keyboard.press("6");
    await page.waitForTimeout(500);
    results[preset] = await page.locator("#scene").evaluate((scene) => ({
      aircraft: Number(scene.dataset.aircraftTotal ?? 0),
      hardpoints: scene.dataset.airHardpointStates ?? "",
      errors: [],
    }));
    await page.screenshot({ path: `verification-air-models-${preset}.png`, fullPage: true });
  }
  console.log(JSON.stringify({ results, errors }, null, 2));
  if (errors.length || results.fighter.aircraft !== 4 || results.joint.aircraft !== 6 || !results.fighter.hardpoints.includes("red-MIG-29A") || !results.joint.hardpoints.includes("red-TU-16K")) process.exitCode = 1;
} finally {
  await browser.close();
}
