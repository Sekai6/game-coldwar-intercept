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
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbWebGpuUltra").check();
  await page.locator("#sbStartPureAir").click();
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.webGpuUltraStatus === "active", null, { timeout: 15_000 });
  const result = await page.locator("#scene").evaluate(canvas => ({
    backend: canvas.dataset.webGpuUltraBackend,
    detail: canvas.dataset.webGpuUltraCloudDetail,
    scatter: canvas.dataset.webGpuUltraScatter,
    depth: canvas.dataset.webGpuUltraDepth,
    volume: canvas.dataset.webGpuUltraCloudVolume,
    temporal: canvas.dataset.webGpuUltraTemporal,
    cloudShadows: canvas.dataset.webGpuUltraCloudShadows,
    reprojection: canvas.dataset.webGpuUltraReprojection,
    historyValid: canvas.dataset.webGpuUltraHistoryValid,
    historyFrames: Number(canvas.dataset.webGpuUltraHistoryFrames ?? 0),
    adapter: canvas.dataset.webGpuUltraAdapter,
    highQuality: canvas.dataset.highQualityEnvironment,
    clouds: Number(canvas.dataset.environmentCloudCount ?? 0),
  }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || result.backend !== "WEBGL2_WEBGPU_COMPUTE" || result.detail !== "COMPUTE_FBM_128" || result.scatter !== "COMPUTE_SCATTER_ATLAS_128" || result.depth !== "GTAO_DEPTH_RECONSTRUCTED" || result.volume !== "COMPUTE_VOLUME_64X32X64" || result.temporal !== "STABLE_JITTER_ABSOLUTE_WIND" || result.cloudShadows !== "VOLUME_PROJECTED_3_LAYER" || result.reprojection !== "HISTORY_MATRIX_SKY_ONLY" || result.historyValid !== "true" || result.historyFrames < 2 || !result.adapter || result.highQuality !== "true" || result.clouds !== 16) process.exitCode = 1;
} finally {
  await browser.close();
}
