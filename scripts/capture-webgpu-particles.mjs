import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";
const separator = baseUrl.includes("?") ? "&" : "?";
async function capture(kind, enabled) {
  await page.goto(`${baseUrl}${separator}shortAirValidation=1&particleValidation=${kind}&gpuParticles=${enabled ? "on" : "off"}&oceanWake=off`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbWebGpuUltra").check();
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 15_000 });
  await page.locator("#sbStart").click();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.simulationElapsed ?? 0) >= 4.7, null, { timeout: 25_000 });
  await page.keyboard.press("Space");
  await page.waitForTimeout(160);
  const suffix = enabled ? "on" : "off";
  await page.locator("#scene").screenshot({ path: `verification-ultra-particles-${kind}-${suffix}.png` });
  return page.locator("#scene").evaluate(canvas => ({
    mode: canvas.dataset.particleValidation,
    backend: canvas.dataset.webGpuParticles,
    active: Number(canvas.dataset.webGpuParticleActive ?? 0),
    emitted: Number(canvas.dataset.webGpuParticleEmitted ?? 0),
  }));
}
try {
  const result = {};
  for (const kind of ["spray", "debris", "chaff"]) {
    result[`${kind}On`] = await capture(kind, true);
    result[`${kind}Off`] = await capture(kind, false);
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
