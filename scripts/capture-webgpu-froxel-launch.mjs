import { chromium } from "playwright-core";

const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";

async function capture(path, ultra, targetElapsed = null) {
  const browser = await chromium.launch({ headless: true, executablePath, args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}shortAirValidation=1`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.locator("#sbHighQualityEnvironment").check();
    if (ultra) {
      await page.locator("#sbWebGpuUltra").check();
      await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 15_000 });
    }
    await page.locator("#sbAirCombat").check();
    await page.locator("#sbStart").click();
    await page.keyboard.press("1");
    const updatesBeforeLaunch = ultra ? await page.locator("#scene").evaluate(canvas => Number(canvas.dataset.webGpuUltraFroxelUpdates ?? 0)) : 0;
    if (targetElapsed === null) {
      await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.shipSamShots ?? 0) >= 1, null, { timeout: 30_000 });
    } else await page.waitForFunction(target => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= target, targetElapsed, { timeout: 30_000 });
    if (ultra) {
      try {
        await page.waitForFunction(previous => {
          const canvas = document.querySelector("#scene");
          const dominant = canvas?.dataset.webGpuUltraFroxelDominant?.split(":") ?? [];
          return Number(canvas?.dataset.webGpuUltraFroxelLights ?? 0) >= 1 && Number(canvas?.dataset.webGpuUltraFroxelUpdates ?? 0) > previous && Number(dominant[1] ?? 0) >= 0.4;
        }, updatesBeforeLaunch, { timeout: 5_000 });
      } catch (error) {
        console.error("Froxel launch diagnostic:", await page.locator("#scene").evaluate(canvas => ({ lights: canvas.dataset.webGpuUltraFroxelLights, dominant: canvas.dataset.webGpuUltraFroxelDominant, updates: canvas.dataset.webGpuUltraFroxelUpdates, shipSamShots: canvas.dataset.shipSamShots })));
        throw error;
      }
      console.log(await page.locator("#scene").evaluate(canvas => ({ lights: canvas.dataset.webGpuUltraFroxelLights, dominant: canvas.dataset.webGpuUltraFroxelDominant, updates: canvas.dataset.webGpuUltraFroxelUpdates })));
    }
    await page.waitForTimeout(100);
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
    await page.locator("#scene").screenshot({ path });
    return await page.locator("#scene").evaluate(canvas => Number(canvas.dataset.simulationElapsed ?? 0));
  } finally {
    await browser.close();
  }
}

const launchElapsed = await capture("verification-froxel-launch-ultra.png", true);
await capture("verification-froxel-launch-high.png", false, launchElapsed);
