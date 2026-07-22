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
const configuredRangeKm = Math.hypot(
  Number(await page.locator("#sbX").inputValue()) -
    Number(await page.locator("#sbShipX").inputValue()),
  Number(await page.locator("#sbZ").inputValue()) -
    Number(await page.locator("#sbShipZ").inputValue()),
) / 10;
await page.locator("#sbCount").fill("4");
await page.locator("#sbStart").click();
await page.getByRole("button", { name: "TIME: 1X" }).click();
await page.getByRole("button", { name: "TIME: 2X" }).click();

await page.waitForFunction(
  () => {
    const canvas = document.querySelector("canvas");
    return (
      Number(canvas?.dataset.surfaceStrikeWave ?? 0) >= 1 &&
      Number(canvas?.dataset.surfaceStrikeActive ?? 0) >= 1 &&
      Number(canvas?.dataset.enemyPlatformFired ?? 0) >= 1
    );
  },
  null,
  { timeout: 20_000 },
);

const canvas = page.locator("canvas").first();
const result = await canvas.evaluate((element) => {
  return {
    actualRangeKm: Number(element.dataset.surfaceRangeKm ?? 0),
    ownWave: Number(element.dataset.surfaceStrikeWave ?? 0),
    ownActive: Number(element.dataset.surfaceStrikeActive ?? 0),
    enemyFired: Number(element.dataset.enemyPlatformFired ?? 0),
    ownManeuver: element.dataset.shipManeuverMode ?? "unknown",
    enemyManeuver: element.dataset.enemyPlatformManeuverMode ?? "unknown",
    enemyTrackSource: element.dataset.enemyPlatformTargetTrackSource ?? "none",
    enemyTrackQuality: Number(
      element.dataset.enemyPlatformTargetTrackQuality ?? 0,
    ),
    ownEsmCue: element.dataset.surfaceEsmCue ?? "none",
    ownEsmCueQuality: Number(element.dataset.surfaceEsmCueQuality ?? 0),
    ownTargetingSource: element.dataset.surfaceTargetingSource ?? "none",
    ownFireControl: element.dataset.surfaceFireControlState ?? "unknown",
  };
});
result.configuredRangeKm = configuredRangeKm;
result.errors = errors;

await page.screenshot({
  path: "verification-default-engagement.png",
  fullPage: true,
});
await browser.close();

console.log(JSON.stringify(result, null, 2));
if (
  errors.length ||
  configuredRangeKm !== 65 ||
  result.actualRangeKm < 63 ||
  result.ownWave < 1 ||
  result.ownActive < 1 ||
  result.enemyFired < 1 ||
  result.ownEsmCue !== "valid" ||
  result.ownEsmCueQuality < 0.18 ||
  result.ownTargetingSource !== "passive" ||
  result.ownFireControl !== "passive-ready" ||
  result.enemyTrackSource !== "esm" ||
  result.enemyTrackQuality < 0.18
)
  process.exitCode = 1;
