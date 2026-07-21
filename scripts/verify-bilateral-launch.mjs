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

async function runShip(shipId) {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
    waitUntil: "networkidle",
  });
  const selects = page.locator("select");
  for (let index = 0; index < (await selects.count()); index++) {
    const values = await selects.nth(index).locator("option").evaluateAll(
      (options) => options.map((option) => option.value),
    );
    if (values.includes(shipId)) {
      await selects.nth(index).selectOption(shipId);
      break;
    }
  }
  await page.locator("#sbPlatform").selectOption("slava-moskva");
  await page.locator("#sbType").selectOption("P-500");
  await page.locator("#sbCount").fill("4");
  await page.locator("#sbInterval").fill("1.5");
  await page.locator("#sbZ").fill("-380");
  await page.locator("#sbSpread").fill("0");
  await page.locator("#sbHarpoon").fill("8");
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("canvas");
      return (
        Number(canvas?.dataset.surfaceStrikeActive ?? 0) > 0 &&
        Number(canvas?.dataset.enemyPlatformFired ?? 0) >= 4
      );
    },
    null,
    { timeout: 30_000 },
  );
  await page.screenshot({ path: `verification-${shipId}-bilateral.png`, fullPage: true });
  return page.locator("canvas").first().evaluate((element) => ({
    ship: document.querySelector("#shipBadge")?.textContent ?? "unknown",
    ownWave: Number(element.dataset.surfaceStrikeWave ?? 0),
    ownActive: Number(element.dataset.surfaceStrikeActive ?? 0),
    ownTrackQuality: Number(element.dataset.surfaceTrackQuality ?? 0),
    ownFireControl: element.dataset.surfaceFireControlState ?? "unknown",
    enemyFired: Number(element.dataset.enemyPlatformFired ?? 0),
    enemyFiredOrder: (element.dataset.enemyPlatformFiredOrder ?? "")
      .split(",")
      .filter(Boolean),
    enemyReleaseTimes: (element.dataset.enemyPlatformReleaseTimes ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number),
    enemyCoversVisible: Number(
      element.dataset.enemyPlatformCoversVisible ?? 0,
    ),
    enemyTrackQuality: Number(
      element.dataset.enemyPlatformTargetTrackQuality ?? 0,
    ),
    enemyTrackSource:
      element.dataset.enemyPlatformTargetTrackSource ?? "none",
    enemyTrackAge: Number(element.dataset.enemyPlatformTrackAge ?? 0),
    displayedFireState:
      document.querySelector("#targetState")?.getAttribute("data-opfor-fire-state") ??
      "missing",
  }));
}

const results = [];
for (const shipId of ["long-beach", "ticonderoga"])
  results.push(await runShip(shipId));
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "verification-bilateral-mobile.png", fullPage: true });

console.log(JSON.stringify({ results, errors }, null, 2));
await browser.close();
if (
  errors.length > 0 ||
  results.some(
    (result) =>
      result.ownWave < 1 ||
      result.ownActive < 1 ||
      result.ownTrackQuality <= 0 ||
      result.enemyFired < 4 ||
      result.enemyFiredOrder.join(",") !==
        "bazalt-01,bazalt-09,bazalt-02,bazalt-10" ||
      result.enemyReleaseTimes.some(
        (time, index, times) => index > 0 && time - times[index - 1] < 1.49,
      ) ||
      result.enemyCoversVisible !== 12 ||
      !result.displayedFireState.startsWith("OPFOR LAUNCHED") ||
      result.enemyTrackSource !== "radar" ||
      result.enemyTrackQuality <= 0,
  )
)
  process.exitCode = 1;
