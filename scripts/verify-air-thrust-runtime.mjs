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
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => (document.querySelector("#scene")?.dataset.airThrustEventLog ?? "").includes("AFTERBURNER"), null, { timeout: 20_000 });
  const result = await page.locator("#scene").evaluate(canvas => ({
    states: canvas.dataset.airThrustStates ?? "",
    events: canvas.dataset.airThrustEventLog ?? "",
  }));
  result.errors = errors;
  const records = result.states.split("|").map(record => record.split(":"));
  const f14 = records.filter(([id]) => id.includes("F-14A"));
  const nonAfterburning = records.filter(([id]) => id.includes("TU-16K") || id.includes("A-6E"));
  const fighterUsedAfterburner = result.events.includes("F-14A THRUST") && result.events.includes("AFTERBURNER");
  const fighterReserveConsumed = f14.some(([, , reserve]) => Number(reserve) < 150);
  const fighterIrRaised = f14.some(([, mode, , ir]) => mode !== "cruise" && Number(ir) > 1.1);
  const restrictedPlatformViolation = nonAfterburning.some(([, mode]) => mode === "afterburner") ||
    result.events.split("|").some(event => /(?:TU-16K|A-6E) THRUST [^|]*AFTERBURNER/.test(event));
  console.log(JSON.stringify({ ...result, fighterUsedAfterburner, fighterReserveConsumed, fighterIrRaised, restrictedPlatformViolation }, null, 2));
  if (errors.length || !fighterUsedAfterburner || !fighterReserveConsumed || !fighterIrRaised || restrictedPlatformViolation) process.exitCode = 1;
} finally {
  await browser.close();
}
