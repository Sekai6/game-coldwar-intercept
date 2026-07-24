import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-webgpu", "--disable-gpu-sandbox", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
try {
  const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:5173/";
  const separator = baseUrl.includes("?") ? "&" : "?";
  await page.goto(`${baseUrl}${separator}shortAirValidation=1&particleValidation=chaff`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbWebGpuUltra").check();
  try {
    await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 15_000 });
  } catch (error) {
    console.error(JSON.stringify(await page.locator("#scene").evaluate(canvas => ({ status: canvas.dataset.webGpuUltraStatus, error: canvas.dataset.webGpuUltraError })), null, 2));
    console.error(JSON.stringify(errors, null, 2));
    throw error;
  }
  await page.locator("#sbStart").click();
  try {
    await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.webGpuParticleActive ?? 0) > 500, null, { timeout: 20_000 });
  } catch (error) {
    console.error(JSON.stringify(await page.locator("#scene").evaluate(canvas => ({ ...canvas.dataset })), null, 2));
    console.error(JSON.stringify(errors, null, 2));
    throw error;
  }
  const result = await page.locator("#scene").evaluate(canvas => ({
    backend: canvas.dataset.webGpuUltraBackend,
    particles: canvas.dataset.webGpuParticles,
    active: Number(canvas.dataset.webGpuParticleActive ?? 0),
    emitted: Number(canvas.dataset.webGpuParticleEmitted ?? 0),
    updates: Number(canvas.dataset.webGpuParticleUpdates ?? 0),
    bridgeHz: Number(canvas.dataset.webGpuParticleBridgeHz ?? 0),
    validation: canvas.dataset.particleValidation,
  }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || result.backend !== "WEBGL2_WEBGPU_COMPUTE" || result.particles !== "COMPUTE_STORAGE_131072" || result.active < 500 || result.emitted !== 1600 || result.updates < 2 || result.bridgeHz !== 12 || result.validation !== "chaff") process.exitCode = 1;
} finally {
  await browser.close();
}
