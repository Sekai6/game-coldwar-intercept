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
const selects = page.locator("select");
for (let index = 0; index < (await selects.count()); index++) {
  const options = await selects.nth(index).locator("option").allTextContents();
  if (options.some((option) => option.includes("CG-57")))
    await selects.nth(index).selectOption("ticonderoga");
}
await page.locator("#sbPlatform").selectOption("slava-moskva");
await page.locator("#sbType").selectOption("P-500");
await page.locator("#sbCount").fill("1");
await page.locator("#sbInterval").fill("10");
await page.locator("#sbZ").fill("-380");
await page.locator("#sbSpread").fill("0");
await page.locator("#sbHarpoon").fill("8");
await page.locator("#sbOpforPointDefenseHealth").fill("0");
await page.locator("#sbOpforEcmHealth").fill("0");
await page.locator("#sbOpforDecoyHealth").fill("0");
await page.locator("#sbStart").click();
await page.getByRole("button", { name: "TIME: 1X" }).click();
await page.getByRole("button", { name: "TIME: 2X" }).click();

const canvas = page.locator("canvas").first();
await page.waitForFunction(
  () => document.querySelector("canvas")?.dataset.surfaceStrikeWave === "1",
  null,
  { timeout: 30_000 },
);
await page.waitForFunction(
  () => Number(document.querySelector("canvas")?.dataset.enemyPlatformFired ?? 0) > 0,
  null,
  { timeout: 20_000 },
);
await page.waitForFunction(
  () =>
    (document.querySelector("canvas")?.dataset.surfaceStrikeArrivalPlans ?? "")
      .split(",")
      .filter(Boolean).length === 4,
  null,
  { timeout: 15_000 },
);
const launchState = await canvas.evaluate((element) => ({
  routeOffsets: element.dataset.surfaceStrikeRouteOffsets ?? "",
  routeVectors: element.dataset.surfaceStrikeRouteVectors ?? "",
  arrivalPlans: element.dataset.surfaceStrikeArrivalPlans ?? "",
}));
await page.waitForFunction(
  () => {
    const times =
      document.querySelector("canvas")?.dataset.surfaceStrikeTerminalTimes ?? "";
    return times.split(",").length === 4 && !times.includes("pending");
  },
  null,
  { timeout: 45_000 },
);
const terminalTimes = (await canvas.getAttribute("data-surface-strike-terminal-times"))
  .split(",")
  .map(Number);
const arrivalPlans = launchState.arrivalPlans.split(",").map(Number);
const routeVectors = launchState.routeVectors.split(",").map((value) =>
  value.split(":").map(Number),
);
const planSpread = Math.max(...arrivalPlans) - Math.min(...arrivalPlans);
const terminalSpread = Math.max(...terminalTimes) - Math.min(...terminalTimes);
const firstPairOpposed =
  routeVectors[0][0] * routeVectors[1][0] +
    routeVectors[0][1] * routeVectors[1][1] <
  0;
const bilateralLaunch = await canvas.evaluate((element) => ({
  ownWave: element.dataset.surfaceStrikeWave ?? "0",
  ownActive: element.dataset.surfaceStrikeActive ?? "0",
  enemyReserved: element.dataset.enemyPlatformReserved ?? "0",
  enemyFired: element.dataset.enemyPlatformFired ?? "0",
  enemyTrackSource: element.dataset.enemyPlatformTargetTrackSource ?? "none",
  enemyTrackQuality: element.dataset.enemyPlatformTargetTrackQuality ?? "0",
}));
await page.reload({ waitUntil: "networkidle" });
await page.locator("#sbPlatform").selectOption("slava-moskva");
await page.locator("#sbType").selectOption("P-500");
await page.locator("#sbCount").fill("1");
await page.locator("#sbZ").fill("-600");
await page.locator("#sbSpread").fill("0");
await page.locator("#sbStart").click();
await page.getByRole("button", { name: "TIME: 1X" }).click();
await page.getByRole("button", { name: "TIME: 2X" }).click();
try {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("canvas");
      return (
        canvas?.dataset.surfaceEsmCue === "valid" &&
        canvas?.dataset.enemyPlatformTargetTrackSource === "esm" &&
        canvas?.dataset.shipManeuverMode === "close" &&
        canvas?.dataset.enemyPlatformManeuverMode === "close"
      );
    },
    null,
    { timeout: 15_000 },
  );
} catch {
  // The final assertions print the individual state that failed to converge.
}
const farRangeCue = await page.locator("canvas").first().evaluate((element) => ({
  ownCue: element.dataset.surfaceEsmCue ?? "none",
  ownCueQuality: element.dataset.surfaceEsmCueQuality ?? "0",
  ownManeuver: element.dataset.shipManeuverMode ?? "unknown",
  ownWave: element.dataset.surfaceStrikeWave ?? "0",
  enemyTrackSource: element.dataset.enemyPlatformTargetTrackSource ?? "none",
  enemyTrackQuality: element.dataset.enemyPlatformTargetTrackQuality ?? "0",
  enemyManeuver: element.dataset.enemyPlatformManeuverMode ?? "unknown",
  enemyFired: element.dataset.enemyPlatformFired ?? "0",
}));
await page.screenshot({ path: "verification-surface-esm.png", fullPage: true });
const result = {
  bilateralLaunch,
  launchState,
  planSpread,
  terminalTimes,
  terminalSpread,
  firstPairOpposed,
  farRangeCue,
  errors,
};
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (
  errors.length > 0 ||
  Number(bilateralLaunch.enemyFired) < 1 ||
  Number(bilateralLaunch.ownWave) < 1 ||
  launchState.routeOffsets.split(",").length !== 4 ||
  !firstPairOpposed ||
  planSpread > 2.05 ||
  terminalSpread > 4 ||
  farRangeCue.ownCue !== "valid" ||
  farRangeCue.enemyTrackSource !== "esm" ||
  farRangeCue.ownManeuver !== "close" ||
  farRangeCue.enemyManeuver !== "close" ||
  farRangeCue.ownWave !== "0" ||
  farRangeCue.enemyFired !== "0"
)
  process.exitCode = 1;
