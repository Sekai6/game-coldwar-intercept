import { chromium } from "playwright-core";

const executablePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";

async function capture(mode) {
  const browser = await chromium.launch({ headless: true, executablePath, args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}shortAirValidation=1&ultraAtmosphere=${mode}`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.locator("#sbHighQualityEnvironment").check();
    await page.locator("#sbWebGpuUltra").check();
    await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 15_000 });
    await page.locator("#sbStart").click();
    await page.keyboard.press("1");
    await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= 6, null, { timeout: 20_000 });
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
    await page.locator("#scene").screenshot({ path: `verification-ultra-atmosphere-${mode}.png` });
  } finally { await browser.close(); }
}

for (const mode of ["both", "scatter", "froxel", "none"]) await capture(mode);
