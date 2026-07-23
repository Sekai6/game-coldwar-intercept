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
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#scene");
    const events = canvas?.dataset.airCountermeasureEventLog ?? "";
    return events.includes("DEFENDER SRBOC LAUNCH OBSERVED") &&
      /SOFT KILL|ECM CONTESTED|DECOY REJECTED|BURN THROUGH/.test(events) &&
      Number(canvas?.dataset.shipSrbocRounds ?? 12) < 12;
  }, null, { timeout: 30_000 });
  const result = await page.locator("#scene").evaluate(canvas => ({
    events: canvas.dataset.airCountermeasureEventLog ?? "",
    rounds: Number(canvas.dataset.shipSrbocRounds ?? 24),
    roundsInFlight: Number(canvas.dataset.shipSrbocRoundsInFlight ?? 0),
    shipChaff: Number(canvas.dataset.shipChaffClouds ?? 0),
  }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || result.rounds >= 12 || !/KSR-5|AGM-84A/.test(result.events) ||
    !/SOFT KILL|ECM CONTESTED|DECOY REJECTED|BURN THROUGH/.test(result.events)) process.exitCode = 1;
} finally {
  await browser.close();
}
