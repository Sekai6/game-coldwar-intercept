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
const disabledSystem = process.env.OPFOR_DISABLED_SYSTEM ?? "launcher";
page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle",
});
await page.locator("#sbPlatform").selectOption("slava-moskva");
await page.locator("#sbType").selectOption("P-500");
await page.locator("#sbCount").fill("4");
await page.locator("#sbInterval").fill("1");
await page
  .locator("#sbOpforStrikeLauncherHealth")
  .fill(disabledSystem === "launcher" ? "0" : "100");
await page
  .locator("#sbOpforFireControlHealth")
  .fill(disabledSystem === "fire-control" ? "0" : "100");
await page.locator("#sbOpforPointDefenseHealth").fill("0");
await page.locator("#sbOpforEcmHealth").fill("0");
await page.locator("#sbOpforDecoyHealth").fill("0");
await page.locator("#sbStart").click();
await page.waitForTimeout(250);
const sandboxDisplay = await page.locator(".sandbox-panel").evaluate(
  (element) => getComputedStyle(element).display,
);
if (sandboxDisplay !== "none") {
  console.log(JSON.stringify({ disabledSystem, sandboxDisplay, errors }, null, 2));
  await browser.close();
  process.exit(1);
}
await page.getByRole("button", { name: "TIME: 1X" }).click();
await page.getByRole("button", { name: "TIME: 2X" }).click();
await page.waitForTimeout(12_000);
const state = await page.locator("canvas").first().evaluate((element) => ({
  fired: Number(element.dataset.enemyPlatformFired ?? 0),
  reserved: Number(element.dataset.enemyPlatformReserved ?? 0),
  canceled: Number(element.dataset.enemyPlatformCanceled ?? 0),
  effects: Number(element.dataset.enemyPlatformLaunchEffects ?? 0),
}));
console.log(JSON.stringify({ disabledSystem, state, errors }, null, 2));
await browser.close();
const expectedCanceled = disabledSystem === "fire-control" ? 4 : 0;
if (
  errors.length ||
  state.fired !== 0 ||
  state.effects !== 0 ||
  state.canceled !== expectedCanceled ||
  state.reserved !== 0
)
  process.exitCode = 1;
