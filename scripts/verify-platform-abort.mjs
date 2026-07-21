import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle",
});
await page.locator("#sbPlatform").selectOption("slava-moskva");
await page.locator("#sbType").selectOption("P-500");
await page.locator("#sbCount").fill("16");
await page.locator("#sbInterval").fill("10");
await page.locator("#sbZ").fill("-250");
await page.locator("#sbSpread").fill("0");
await page.locator("#sbRim").fill("0");
await page.locator("#sbSm2").fill("0");
await page.locator("#sbSm2er").fill("0");
await page.locator("#sbCiws").fill("0");
await page.locator("#sbHarpoon").fill("0");
await page.locator("#sbStart").click();
await page.getByRole("button", { name: "SHIP ECM: AUTO" }).click();
await page.getByRole("button", { name: "SRBOC: AUTO" }).click();
await page.getByRole("button", { name: "TIME: 1X" }).click();
await page.getByRole("button", { name: "TIME: 2X" }).click();

const canvas = page.locator("canvas").first();
await page.waitForFunction(
  () => Number(document.querySelector("canvas")?.dataset.enemyPlatformFired ?? 0) >= 4,
  null,
  { timeout: 45_000 },
);
await page.waitForFunction(
  () => Number(document.querySelector("canvas")?.dataset.enemyPlatformCanceled ?? 0) > 0,
  null,
  { timeout: 100_000 },
);
const state = await canvas.evaluate((element) => ({
  ready: Number(element.dataset.enemyPlatformReady ?? 0),
  reserved: Number(element.dataset.enemyPlatformReserved ?? 0),
  fired: Number(element.dataset.enemyPlatformFired ?? 0),
  canceled: Number(element.dataset.enemyPlatformCanceled ?? 0),
  hardpoints: Number(element.dataset.enemyPlatformHardpoints ?? 0),
  coversVisible: Number(element.dataset.enemyPlatformCoversVisible ?? 0),
  releasedInFlight: Number(element.dataset.enemyPlatformReleasedInFlight ?? 0),
  hull: Number(element.dataset.shipHull ?? 0),
}));
const abortEvents = await page
  .locator("#aarEvents .aar-event span")
  .allTextContents();
const targetAbortEvents = abortEvents.filter((event) =>
  event.includes("TARGET DISABLED"),
);
await page.screenshot({
  path: "verification-platform-abort.png",
  fullPage: true,
});
const result = {
  state,
  stateTotal: state.ready + state.reserved + state.fired + state.canceled,
  targetAbortEvents: targetAbortEvents.length,
  errors,
};
console.log(JSON.stringify(result, null, 2));
await browser.close();

if (
  errors.length > 0 ||
  state.hull !== 0 ||
  state.fired < 4 ||
  state.canceled < 1 ||
  state.reserved !== 0 ||
  state.releasedInFlight < 1 ||
  state.ready + state.reserved + state.fired + state.canceled !== state.hardpoints ||
  state.coversVisible !== state.ready + state.canceled ||
  targetAbortEvents.length !== state.canceled
)
  process.exitCode = 1;
