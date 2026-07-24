import { chromium } from "playwright-core";

const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";

async function capture(path, ultra, targetElapsed = null) {
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}shortAirValidation=1`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.locator("#sbHighQualityEnvironment").check();
    if (ultra) {
      await page.locator("#sbWebGpuUltra").check();
      await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 15_000 });
    }
    await page.locator("#sbStartPureAir").click();
    await page.keyboard.press("6");
    const target = targetElapsed ?? 8;
    await page.waitForFunction(value => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= value, target, { timeout: 20_000 });
    if (ultra) await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.webGpuUltraHistoryFrames ?? 0) >= 12 && Number(document.querySelector("#scene")?.dataset.webGpuUltraTemporalObjects ?? 0) >= 1, null, { timeout: 5_000 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
    const canvas = page.locator("#scene");
    await canvas.screenshot({ path });
    const diagnostics = await canvas.evaluate(element => ({
      elapsed: Number(element.dataset.simulationElapsed ?? 0),
      historyFrames: Number(element.dataset.webGpuUltraHistoryFrames ?? 0),
      trackedObjects: Number(element.dataset.webGpuUltraTemporalObjects ?? 0),
      jitter: Number(element.dataset.webGpuUltraTemporalJitter ?? 0),
      velocity: element.dataset.webGpuUltraVelocity ?? "OFF",
      aircraft: element.dataset.cameraAircraftId ?? "",
    }));
    if (ultra) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(180);
      await canvas.screenshot({ path: "verification-ultra-taa-motion.png" });
      await page.keyboard.press("Space");
    }
    return diagnostics;
  } finally {
    await browser.close();
  }
}

const ultra = await capture("verification-ultra-taa.png", true);
const high = await capture("verification-high-no-taa.png", false, ultra.elapsed);
console.log(JSON.stringify({ high, ultra }, null, 2));
