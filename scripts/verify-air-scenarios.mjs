import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=2"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
const results = {};
try {
  for (const [preset, expected] of [["joint", 6], ["intercept", 4], ["strike", 2]]) {
    await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.locator("#sbAirPreset").selectOption(preset);
    await page.locator("#sbAirCombat").check();
    await page.locator("#sbStart").click();
    await page.waitForFunction(total => Number(document.querySelector("#scene")?.dataset.aircraftTotal ?? 0) === total, expected, { timeout: 10_000 });
    results[preset] = await page.locator("#scene").evaluate(c => ({
      total: Number(c.dataset.aircraftTotal ?? 0),
      missions: c.dataset.airMissionStates ?? "",
      escorts: c.dataset.airEscortAssignments ?? "",
    }));
  }
  console.log(JSON.stringify({ results, errors }, null, 2));
  if (errors.length || results.joint.total !== 6 || !results.joint.missions.includes("escort") || !results.joint.escorts.includes("blue-A-6E") || results.intercept.total !== 4 || !results.intercept.missions.includes("intercept") || results.strike.total !== 2 || !results.strike.missions.includes("anti-ship")) process.exitCode = 1;
} finally { await browser.close(); }
