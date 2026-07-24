import { chromium } from "playwright-core";

const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";

async function capture(path, ultra, targetElapsed = null, effects = true, debug = "off", consumers = "both") {
  const browser = await chromium.launch({ headless: true, executablePath, args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}shortAirValidation=1&hizEffects=${effects ? "on" : "off"}&hizDebug=${debug}&hizConsumers=${consumers}`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.locator("#sbHighQualityEnvironment").check();
    if (ultra) {
      await page.locator("#sbWebGpuUltra").check();
      await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 15_000 });
    }
    await page.locator("#sbStart").click();
    await page.keyboard.press("1");
    await page.mouse.wheel(0, -650);
    const target = targetElapsed ?? 6;
    await page.waitForFunction(value => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= value, target, { timeout: 20_000 });
    if (ultra) await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.webGpuUltraHiZLevels ?? 0) === 6 && Number(document.querySelector("#scene")?.dataset.webGpuUltraHistoryFrames ?? 0) >= 12, null, { timeout: 5_000 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
    const canvas = page.locator("#scene");
    await canvas.screenshot({ path });
    const box = await canvas.boundingBox();
    if (box) {
      await page.screenshot({
        path: path.replace(/\.png$/, "-detail.png"),
        clip: { x: box.x + box.width * 0.29, y: box.y + box.height * 0.25, width: box.width * 0.43, height: box.height * 0.46 },
      });
    }
    return await canvas.evaluate(element => ({ elapsed: Number(element.dataset.simulationElapsed ?? 0), hiz: element.dataset.webGpuUltraHiZ ?? "OFF", levels: Number(element.dataset.webGpuUltraHiZLevels ?? 0), consumers: Number(element.dataset.webGpuUltraHiZConsumers ?? 0) }));
  } finally {
    await browser.close();
  }
}

const combined = await capture("verification-ultra-hiz.png", true, null, true, "off", "ssr");
const noSsr = await capture("verification-ultra-hiz-no-ssr.png", true);
const baseline = await capture("verification-ultra-hiz-baseline.png", true, null, false);
const occlusion = await capture("verification-ultra-hiz-occlusion-debug.png", true, null, true, "occlusion");
const reflection = await capture("verification-ultra-hiz-reflection-debug.png", true, null, true, "reflection");
console.log(JSON.stringify({ combined, noSsr, baseline, occlusion, reflection }, null, 2));
