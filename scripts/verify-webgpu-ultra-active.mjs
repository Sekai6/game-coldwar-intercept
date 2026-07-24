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
    internalScale: canvas.dataset.webGpuUltraInternalScale,
    cloudShadows: canvas.dataset.webGpuUltraCloudShadows,
    froxel: canvas.dataset.webGpuUltraFroxel,
    ocean: canvas.dataset.webGpuUltraOcean,
    oceanCompute: canvas.dataset.webGpuUltraOceanCompute,
    oceanRanges: canvas.dataset.webGpuUltraOceanRanges,
    oceanError: canvas.dataset.webGpuUltraOceanError,
    froxelUpdates: Number(canvas.dataset.webGpuUltraFroxelUpdates ?? 0),
    froxelLights: Number(canvas.dataset.webGpuUltraFroxelLights ?? 0),
    reprojection: canvas.dataset.webGpuUltraReprojection,
    velocity: canvas.dataset.webGpuUltraVelocity,
    temporalObjects: Number(canvas.dataset.webGpuUltraTemporalObjects ?? 0),
    hiz: canvas.dataset.webGpuUltraHiZ,
    hizLevels: Number(canvas.dataset.webGpuUltraHiZLevels ?? 0),
    hizConsumers: Number(canvas.dataset.webGpuUltraHiZConsumers ?? 0),
    historyValid: canvas.dataset.webGpuUltraHistoryValid,
    historyFrames: Number(canvas.dataset.webGpuUltraHistoryFrames ?? 0),
    adapter: canvas.dataset.webGpuUltraAdapter,
    highQuality: canvas.dataset.highQualityEnvironment,
    clouds: Number(canvas.dataset.environmentCloudCount ?? 0),
  }));
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  const oceanRanges = result.oceanRanges?.split("/").map(range => range.split("-").map(Number)) ?? [];
  const oceanDynamic = oceanRanges.length === 4 && oceanRanges.slice(0, 3).every(([minimum, maximum]) => maximum - minimum > 80) && oceanRanges[3][1] > 4;
  if (errors.length || result.backend !== "WEBGL2_WEBGPU_COMPUTE" || result.detail !== "COMPUTE_FBM_128" || result.scatter !== "COMPUTE_SCATTER_ATLAS_128" || result.depth !== "GTAO_DEPTH_RECONSTRUCTED" || result.volume !== "COMPUTE_VOLUME_64X32X64" || result.temporal !== "TAAU_FULL_SCENE_0.85X" || result.internalScale !== "0.85" || result.cloudShadows !== "VOLUME_PROJECTED_3_LAYER" || result.froxel !== "FROXEL_80X45X32_DYNAMIC_8" || result.ocean !== "FFT_16X64" || result.oceanCompute !== "COMPUTE_RADIX2" || result.oceanError || !oceanDynamic || result.froxelUpdates < 1 || result.reprojection !== "TAA_VELOCITY_DEPTH_CLAMP" || result.velocity !== "OBJECT_PREVIOUS_MVP_RG16F" || result.temporalObjects < 1 || result.hiz !== "MIN_DEPTH_6_LEVEL" || result.hizLevels !== 6 || result.hizConsumers !== 2 || result.historyValid !== "true" || result.historyFrames < 2 || !result.adapter || result.highQuality !== "true" || result.clouds !== 16) process.exitCode = 1;
} finally {
  await browser.close();
}
