import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle",
});
await page.locator("#sbPlatform").selectOption("slava-moskva");
await page.locator("#sbType").selectOption("P-500");
await page.locator("#sbCount").fill("3");
await page.locator("#sbInterval").fill("1.5");
await page.locator("#sbZ").fill("-380");
await page.locator("#sbSpread").fill("0");
await page.locator("#sbRim").fill("0");
await page.locator("#sbSm2").fill("0");
await page.locator("#sbSm2er").fill("0");
await page.locator("#sbCiws").fill("0");
await page.locator("#sbHarpoon").fill("0");
await page.locator("#sbStart").click();
await page.getByRole("button", { name: "SHIP ECM: AUTO" }).click();
await page.getByRole("button", { name: "SRBOC: AUTO" }).click();
await page.getByRole("button", { name: "TIME: 1X" }).click();
await page.getByRole("button", { name: "TIME: 2X" }).click();

const canvas = page.locator("canvas").first();
await page.waitForFunction(
  () => Number(document.querySelector("canvas")?.dataset.enemyPlatformResolvedWeapons ?? 0) === 3,
  null,
  { timeout: 100_000 },
);
const state = await canvas.evaluate((element) => ({
  wave: Number(element.dataset.enemyPlatformFirePlanWave ?? 0),
  fired: Number(element.dataset.enemyPlatformFired ?? 0),
  actualHits: Number(element.dataset.enemyPlatformActualHits ?? 0),
  hull: Number(element.dataset.shipHull ?? 0),
  releaseTimes: (element.dataset.enemyPlatformReleaseTimes ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number),
  arrivalPlans: (element.dataset.enemyPlatformArrivalPlans ?? "")
    .split(",")
    .filter((value) => value && value !== "pending")
    .map(Number),
  terminalTimes: (element.dataset.enemyPlatformTerminalTimes ?? "")
    .split(",")
    .filter((value) => value && value !== "pending")
    .map(Number),
  speedDeviations: (element.dataset.enemyPlatformSpeedDeviations ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number),
}));
const spread = (values) => Math.max(...values) - Math.min(...values);
const releaseSpread = spread(state.releaseTimes);
const plannedSpread = spread(state.arrivalPlans);
const terminalSpread = spread(state.terminalTimes);
const maximumSpeedDeviation = Math.max(...state.speedDeviations);
await page.screenshot({ path: "verification-platform-arrival.png", fullPage: true });
const result = {
  state,
  releaseSpread,
  plannedSpread,
  terminalSpread,
  maximumSpeedDeviation,
  errors,
};
console.log(JSON.stringify(result, null, 2));
await browser.close();

if (
  errors.length > 0 ||
  state.wave !== 1 ||
  state.fired !== 3 ||
  state.actualHits !== 3 ||
  state.hull !== 16 ||
  state.releaseTimes.length !== 3 ||
  state.arrivalPlans.length !== 3 ||
  state.terminalTimes.length !== 3 ||
  state.speedDeviations.length !== 3 ||
  plannedSpread > 1.51 ||
  terminalSpread >= releaseSpread ||
  maximumSpeedDeviation <= 0.01 ||
  maximumSpeedDeviation > 0.161
)
  process.exitCode = 1;
