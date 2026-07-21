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
page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle",
});
await page.locator("#sbPlatform").selectOption("slava-moskva");
await page.locator("#sbType").selectOption("P-500");
await page.locator("#sbCount").fill("4");
await page.locator("#sbInterval").fill("1");
await page.locator("#sbOpforStrikeLauncherHealth").fill("0");
await page.locator("#sbOpforPointDefenseHealth").fill("0");
await page.locator("#sbOpforEcmHealth").fill("0");
await page.locator("#sbOpforDecoyHealth").fill("0");
await page.locator("#sbStart").click();
await page.getByRole("button", { name: "TIME: 1X" }).click();
await page.getByRole("button", { name: "TIME: 2X" }).click();
await page.waitForTimeout(12_000);
const state = await page.locator("canvas").first().evaluate((element) => ({
  fired: Number(element.dataset.enemyPlatformFired ?? 0),
  reserved: Number(element.dataset.enemyPlatformReserved ?? 0),
  canceled: Number(element.dataset.enemyPlatformCanceled ?? 0),
  effects: Number(element.dataset.enemyPlatformLaunchEffects ?? 0),
}));
console.log(JSON.stringify({ state, errors }, null, 2));
await browser.close();
if (errors.length || state.fired !== 0 || state.effects !== 0 || state.canceled < 4)
  process.exitCode = 1;
