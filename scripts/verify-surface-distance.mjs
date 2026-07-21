import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=2"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
  waitUntil: "domcontentloaded",
  timeout: 15_000,
});
const shipX = Number(await page.locator("#sbShipX").inputValue());
const shipZ = Number(await page.locator("#sbShipZ").inputValue());
const enemyX = Number(await page.locator("#sbX").inputValue());
const enemyZ = Number(await page.locator("#sbZ").inputValue());
const configuredRangeKm = Math.hypot(enemyX - shipX, enemyZ - shipZ) / 10;
await page.locator("#sbStart").click();
await page.waitForFunction(
  () => Number.isFinite(Number(document.querySelector("canvas")?.dataset.surfaceRangeKm)),
  null,
  { timeout: 15_000 },
);
await page.waitForTimeout(1_000);
const actualRangeKm = Number(
  await page.locator("canvas").first().getAttribute("data-surface-range-km"),
);
await page.screenshot({
  path: "verification-surface-distance.png",
  fullPage: true,
});
await browser.close();

const result = { configuredRangeKm, actualRangeKm, errors };
console.log(JSON.stringify(result, null, 2));
if (
  errors.length ||
  configuredRangeKm !== 65 ||
  Math.abs(actualRangeKm - configuredRangeKm) > 0.15
)
  process.exitCode = 1;
