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
for (const select of await page.locator("select").all()) {
  const options = await select.locator("option").allTextContents();
  if (options.some((option) => option.includes("CG-57")))
    await select.selectOption("ticonderoga");
}
const platform = await page.locator("#sbPlatform").inputValue();
if (platform === "AIRBORNE") throw new Error("platform sandbox defaulted to AIRBORNE");
await page.locator("#sbType").selectOption("P-500");
await page.locator("#sbCount").fill("4");
await page.locator("#sbInterval").fill("1");
await page.locator("#sbOpforPointDefenseHealth").fill("0");
await page.locator("#sbOpforEcmHealth").fill("0");
await page.locator("#sbOpforDecoyHealth").fill("0");
await page.locator("#sbStart").click();
await page.getByRole("button", { name: "TIME: 1X" }).click();
await page.getByRole("button", { name: "TIME: 2X" }).click();
const canvas = page.locator("canvas").first();
await page.waitForFunction(
  () => Number(document.querySelector("canvas")?.dataset.enemyPlatformFired ?? 0) >= 4,
  null,
  { timeout: 45_000 },
);
const result = await canvas.evaluate((element) => ({
  platform: document.querySelector("#sbPlatform")?.value ?? "",
  centerZ: Number(document.querySelector("#sbZ")?.value ?? 0),
  fired: Number(element.dataset.enemyPlatformFired ?? 0),
  wave: Number(element.dataset.enemyPlatformFirePlanWave ?? 0),
  trackQuality: element.dataset.enemyPlatformTargetTrackQuality ?? "",
  trackSource: element.dataset.enemyPlatformTargetTrackSource ?? "",
  trackAge: element.dataset.enemyPlatformTrackAge ?? "",
  reserved: Number(element.dataset.enemyPlatformReserved ?? 0),
  committed: Number(element.dataset.enemyPlatformCommitted ?? 0),
  authorized: Number(element.dataset.enemyPlatformAuthorized ?? 0),
  sensorQuality: element.dataset.enemyPlatformSensorQuality ?? "",
  maneuver: element.dataset.enemyPlatformManeuverMode ?? "",
}));
await page.screenshot({ path: "verification-default-platform.png", fullPage: true });
result.errors = errors;
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (
  errors.length ||
  result.platform === "AIRBORNE" ||
  result.centerZ !== -380 ||
  result.fired < 4 ||
  result.wave < 1
)
  process.exitCode = 1;
