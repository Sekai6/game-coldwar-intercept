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
  await page.locator("#sbHighQualityEnvironment").check();
  await page.locator("#sbStartPureAir").click();
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.highQualityEnvironment === "true", null, { timeout: 10_000 });
  const result = await page.locator("#scene").evaluate(canvas => ({
    enabled: canvas.dataset.highQualityEnvironment,
    clouds: Number(canvas.dataset.environmentCloudCount ?? 0),
    fogVolumes: Number(canvas.dataset.environmentFogVolumeCount ?? 0),
    aircraft: Number(canvas.dataset.aircraftTotal ?? 0),
    sunIntensity: Number(canvas.dataset.environmentSunIntensity ?? 0),
    exposure: Number(canvas.dataset.environmentExposure ?? 0),
    shadowMode: canvas.dataset.environmentShadowMode ?? "",
    highQualityOcean: canvas.dataset.highQualityOcean ?? "",
    oceanBackend: canvas.dataset.oceanBackend ?? "",
  }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || result.enabled !== "true" || result.clouds !== 16 || result.fogVolumes !== 0 || result.aircraft !== 4 || result.sunIntensity !== 3.45 || result.exposure !== 1.08 || result.shadowMode !== "PCF_SOFT" || result.highQualityOcean !== "true" || result.oceanBackend !== "webgl-hq-gerstner") process.exitCode = 1;
} finally {
  await browser.close();
}
