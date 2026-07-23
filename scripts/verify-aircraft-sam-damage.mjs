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
  await page.locator("#sbAirPreset").selectOption("intercept");
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.airDamageEventLog ?? "").includes("Tu-16K"), null, { timeout: 45_000 });
  const result = await page.locator("#scene").evaluate(c => ({
    damageLog: c.dataset.airDamageEventLog ?? "",
    missions: c.dataset.airMissionStates ?? "",
    states: c.dataset.aircraftStates ?? "",
    launchers: c.dataset.airDefenseLaunchers ?? "",
    categories: c.dataset.airDefenseTargetCategories ?? "",
  }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || !result.damageLog.includes("Tu-16K") || !result.categories.includes("aircraft") || !/MK 10|MK 41/.test(result.launchers)) process.exitCode = 1;
} finally { await browser.close(); }
