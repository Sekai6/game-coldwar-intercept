import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1120, height: 700 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));

try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbWebGpuUltra").check();
  await page.locator("#sbStartPureAir").click();
  await page.waitForFunction(() => {
    const status = document.querySelector("#scene")?.dataset.webGpuUltraStatus;
    return status === "active" || status === "unsupported" || status === "failed";
  }, null, { timeout: 15_000 });
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.highQualityEnvironment === "true", null, { timeout: 15_000 });
  const result = await page.locator("#scene").evaluate(canvas => ({
    requested: canvas.dataset.webGpuUltraRequested,
    status: canvas.dataset.webGpuUltraStatus,
    backend: canvas.dataset.webGpuUltraBackend,
    detail: canvas.dataset.webGpuUltraCloudDetail,
    scatter: canvas.dataset.webGpuUltraScatter,
    depth: canvas.dataset.webGpuUltraDepth,
    volume: canvas.dataset.webGpuUltraCloudVolume,
    adapter: canvas.dataset.webGpuUltraAdapter,
    error: canvas.dataset.webGpuUltraError,
    highQuality: canvas.dataset.highQualityEnvironment,
  }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  const validActive = result.status === "active" && result.backend === "WEBGL2_WEBGPU_COMPUTE" && result.detail === "COMPUTE_FBM_128" && result.scatter === "COMPUTE_SCATTER_ATLAS_128" && result.depth === "GTAO_DEPTH_RECONSTRUCTED" && result.volume === "COMPUTE_VOLUME_64X32X64";
  const validFallback = ["unsupported", "failed"].includes(result.status) && result.backend === "WEBGL2" && result.detail === "OFF" && result.scatter === "OFF" && result.depth === "OFF" && result.volume === "OFF" && Boolean(result.error);
  if (errors.length || result.requested !== "true" || result.highQuality !== "true" || (!validActive && !validFallback)) process.exitCode = 1;
} finally {
  await browser.close();
}
