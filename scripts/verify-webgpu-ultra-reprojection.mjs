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
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.webGpuUltraHistoryFrames ?? 0) >= 4, null, { timeout: 15_000 });
  const before = await page.locator("#scene").evaluate(canvas => ({ frames: Number(canvas.dataset.webGpuUltraHistoryFrames), resets: Number(canvas.dataset.webGpuUltraHistoryResets) }));
  await page.keyboard.press("9");
  await page.waitForFunction(previous => Number(document.querySelector("#scene")?.dataset.webGpuUltraHistoryResets ?? 0) > previous, before.resets, { timeout: 3_000 });
  const afterCut = await page.locator("#scene").evaluate(canvas => ({ frames: Number(canvas.dataset.webGpuUltraHistoryFrames), resets: Number(canvas.dataset.webGpuUltraHistoryResets) }));
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.webGpuUltraHistoryFrames ?? 0) >= 4, null, { timeout: 3_000 });
  const recovered = await page.locator("#scene").evaluate(canvas => ({ frames: Number(canvas.dataset.webGpuUltraHistoryFrames), valid: canvas.dataset.webGpuUltraHistoryValid }));
  const result = { before, afterCut, recovered, errors };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length || afterCut.resets <= before.resets || recovered.frames < 4 || recovered.valid !== "true") process.exitCode = 1;
} finally {
  await browser.close();
}
