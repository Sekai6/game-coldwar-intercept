import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbStartPureAir").click();
  await page.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.aircraftTotal ?? 0) === 4, null, { timeout: 10_000 });
  const read = () => page.locator("#scene").evaluate(canvas => ({ mode: canvas.dataset.cameraViewMode, aircraft: canvas.dataset.cameraAircraftId }));
  await page.keyboard.press("6");
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.cameraViewMode === "6", null, { timeout: 2_000 });
  const allFirst = await read();
  await page.keyboard.press("6");
  await page.waitForFunction(id => {
    const canvas = document.querySelector("#scene");
    return canvas?.dataset.cameraViewMode === "6" && canvas.dataset.cameraAircraftId !== id;
  }, allFirst.aircraft, { timeout: 2_000 });
  const allSecond = await read();
  await page.keyboard.press("7");
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.cameraViewMode === "7", null, { timeout: 2_000 });
  const blue = await read();
  await page.keyboard.press("8");
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.cameraViewMode === "8", null, { timeout: 2_000 });
  const red = await read();
  await page.keyboard.press("Digit9");
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.cameraViewMode === "9", null, { timeout: 2_000 });
  const overview = await read();
  console.log(JSON.stringify({ allFirst, allSecond, blue, red, overview, errors }, null, 2));
  if (errors.length || allFirst.mode !== "6" || !allFirst.aircraft || allFirst.aircraft === allSecond.aircraft ||
    blue.mode !== "7" || !blue.aircraft.includes("blue-") || red.mode !== "8" || !red.aircraft.includes("red-") ||
    overview.mode !== "9" || overview.aircraft !== "") process.exitCode = 1;
} finally {
  await browser.close();
}
