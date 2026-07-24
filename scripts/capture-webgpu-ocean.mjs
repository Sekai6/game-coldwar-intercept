import { chromium } from "playwright-core";

const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";

async function capture(path, fft, wake, validation = "") {
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const separator = baseUrl.includes("?") ? "&" : "?";
    await page.goto(`${baseUrl}${separator}shortAirValidation=1&oceanFFT=${fft ? "on" : "off"}&oceanWake=${wake ? "on" : "off"}&oceanValidation=${validation}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.locator("#sbHighQualityEnvironment").check();
    await page.locator("#sbWebGpuUltra").check();
    await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 15_000 });
    await page.locator("#sbStart").click();
    if (!validation) {
      await page.keyboard.press("1");
      await page.mouse.wheel(0, 500);
    }
    const targetElapsed = validation === "stern" ? 6 : validation === "splash" ? 5.15 : 10;
    await page.waitForFunction(target => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= target, targetElapsed, { timeout: 25_000 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(180);
    const canvas = page.locator("#scene");
    await canvas.screenshot({ path });
    return await canvas.evaluate(element => ({
      elapsed: Number(element.dataset.simulationElapsed ?? 0),
      ultra: element.dataset.webGpuUltraStatus,
      ocean: element.dataset.webGpuUltraOcean,
      speed: Number(element.dataset.shipSpeedKnots ?? 0),
      wakeStrength: Number(element.dataset.oceanWakeStrength ?? 0),
      splash: element.dataset.oceanValidationSplash ?? "off",
    }));
  } finally {
    await browser.close();
  }
}

const detailOnly = process.argv.includes("--detail-only");
const computeCheck = process.argv.includes("--compute-check");
const overview = detailOnly ? {} : {
  fftWake: await capture("verification-ultra-ocean-fft-wake.png", true, true),
  ...(computeCheck ? {} : {
    gerstnerWake: await capture("verification-ultra-ocean-gerstner-wake.png", false, true),
    fftNoWake: await capture("verification-ultra-ocean-fft-no-wake.png", true, false),
  }),
};
const sternWake = await capture("verification-ultra-ocean-stern-wake.png", true, true, "stern");
const sternNoWake = await capture("verification-ultra-ocean-stern-no-wake.png", true, false, "stern");
const splash = await capture("verification-ultra-ocean-splash.png", true, false, "splash");
console.log(JSON.stringify({ ...overview, sternWake, sternNoWake, splash }, null, 2));
