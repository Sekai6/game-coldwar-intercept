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
  await page.goto("http://127.0.0.1:5173/?airCountermeasures=off", { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.airSeekerEventLog ?? "").includes("AIM-54A Phoenix SEEKER ACQUIRED"), null, { timeout: 25_000 });
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.airWeaponHitLog ?? "").includes("AIM-54A Phoenix HIT"), null, { timeout: 20_000 });
  const result = await page.locator("#scene").evaluate(c => ({ seekerLog:c.dataset.airSeekerEventLog??"", hitLog:c.dataset.airWeaponHitLog??"", countermeasureEvents:c.dataset.airCountermeasureEventLog??"" }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  if (!result.seekerLog.includes("AIM-54A Phoenix SEEKER ACQUIRED") || !result.hitLog.includes("AIM-54A Phoenix HIT") || result.countermeasureEvents.length || result.errors.length) process.exitCode = 1;
} finally { await browser.close(); }
