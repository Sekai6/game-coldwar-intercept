import { chromium } from "playwright-core";

const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const appUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";

async function capture(path, ultra, temporalPath) {
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.locator("#sbHighQualityEnvironment").check();
    if (ultra) await page.locator("#sbWebGpuUltra").check();
    await page.locator("#sbStartPureAir").click();
    await page.waitForFunction(() => document.querySelector("#scene")?.dataset.highQualityEnvironment === "true", null, { timeout: 10_000 });
    if (ultra) {
      await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 15_000 });
    }
    await page.keyboard.press("1");
    const canvas = page.locator("#scene");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Scene canvas is unavailable");
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.46, { steps: 8 });
    await page.mouse.up();
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(2_000);
    await canvas.screenshot({ path });
    if (temporalPath) {
      await page.keyboard.press("9");
      await page.waitForTimeout(1_000);
      await canvas.screenshot({ path: "verification-ultra-cloud-shadows-overview.png" });
      await page.keyboard.press("1");
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.46, { steps: 8 });
      await page.mouse.up();
      await page.mouse.wheel(0, 420);
      await page.waitForTimeout(4_000);
      await canvas.screenshot({ path: temporalPath });
    }
  } finally {
    await browser.close();
  }
}

await capture("verification-ultra-clouds-high.png", false);
await capture("verification-ultra-clouds-volume.png", true, "verification-ultra-clouds-temporal.png");
