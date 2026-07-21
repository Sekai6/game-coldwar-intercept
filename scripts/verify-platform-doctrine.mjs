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
await page.locator("#sbCount").fill("16");
await page.locator("#sbInterval").fill("1.5");
await page.locator("#sbZ").fill("-300");
await page.locator("#sbSpread").fill("0");
await page.locator("#sbHarpoon").fill("0");
await page.locator("#sbStart").click();
await page.getByRole("button", { name: "TIME: 1X" }).click();
await page.getByRole("button", { name: "TIME: 2X" }).click();

const canvas = page.locator("canvas").first();
await page.waitForFunction(
  () => Number(document.querySelector("canvas")?.dataset.enemyPlatformCommitted ?? 0) === 8,
  null,
  { timeout: 10_000 },
);
const initialPlan = await canvas.evaluate((element) => ({
  wave: Number(element.dataset.enemyPlatformFirePlanWave ?? 0),
  authorized: Number(element.dataset.enemyPlatformAuthorized ?? 0),
  committed: Number(element.dataset.enemyPlatformCommitted ?? 0),
  ready: Number(element.dataset.enemyPlatformReady ?? 0),
  reserved: Number(element.dataset.enemyPlatformReserved ?? 0),
  fired: Number(element.dataset.enemyPlatformFired ?? 0),
}));

await page.waitForFunction(
  () =>
    Number(document.querySelector("canvas")?.dataset.enemyPlatformResolvedWeapons ?? 0) === 8 &&
    Number(document.querySelector("canvas")?.dataset.enemyPlatformAssessmentPending ?? 0) > 0,
  null,
  { timeout: 100_000 },
);
const bdaFireState =
  (await page.locator("[data-opfor-fire-state]").getAttribute("data-opfor-fire-state")) ?? "";

try {
  await page.waitForFunction(
    () => Number(document.querySelector("canvas")?.dataset.enemyPlatformFirePlanWave ?? 0) >= 2,
    null,
    { timeout: 110_000 },
  );
} catch {
  // Preserve the terminal planner state below for deterministic diagnosis.
}
const reattack = await canvas.evaluate((element) => ({
  wave: Number(element.dataset.enemyPlatformFirePlanWave ?? 0),
  authorized: Number(element.dataset.enemyPlatformAuthorized ?? 0),
  committed: Number(element.dataset.enemyPlatformCommitted ?? 0),
  resolved: Number(element.dataset.enemyPlatformResolvedWeapons ?? 0),
  assessedHits: Number(element.dataset.enemyPlatformAssessedHits ?? 0),
  actualHits: Number(element.dataset.enemyPlatformActualHits ?? 0),
  bdaTrackQuality: Number(element.dataset.enemyPlatformBdaTrackQuality ?? 0),
  hitCreditFactor: Number(element.dataset.enemyPlatformHitCreditFactor ?? 0),
  fired: Number(element.dataset.enemyPlatformFired ?? 0),
  reserved: Number(element.dataset.enemyPlatformReserved ?? 0),
  assessmentPending: Number(element.dataset.enemyPlatformAssessmentPending ?? 0),
  hull: Number(element.dataset.shipHull ?? 0),
}));
const displayedFireState =
  (await page.locator("[data-opfor-fire-state]").getAttribute("data-opfor-fire-state")) ?? "";
await page.screenshot({ path: "verification-platform-doctrine.png", fullPage: true });

const result = {
  initialPlan,
  reattack,
  secondWaveSize: reattack.committed - initialPlan.committed,
  bdaFireState,
  displayedFireState,
  errors,
};
const expectedHitCreditFactor =
  0.82 * (0.55 + 0.45 * reattack.bdaTrackQuality);
console.log(JSON.stringify(result, null, 2));
await browser.close();

if (
  errors.length > 0 ||
  initialPlan.wave !== 1 ||
  initialPlan.authorized !== 16 ||
  initialPlan.committed !== 8 ||
  initialPlan.ready + initialPlan.reserved + initialPlan.fired !== 16 ||
  reattack.wave < 2 ||
  reattack.resolved < initialPlan.committed ||
  reattack.actualHits < 1 ||
  reattack.assessedHits <= 0 ||
  reattack.assessedHits >= reattack.actualHits ||
  reattack.hitCreditFactor <= 0 ||
  reattack.hitCreditFactor >= 1 ||
  reattack.bdaTrackQuality <= 0 ||
  Math.abs(reattack.hitCreditFactor - expectedHitCreditFactor) > 0.003 ||
  reattack.hull <= 0 ||
  reattack.committed <= initialPlan.committed ||
  reattack.committed > reattack.authorized ||
  reattack.committed - initialPlan.committed > 8 ||
  !bdaFireState.startsWith("OPFOR BDA") ||
  !displayedFireState.includes("WAVE 2")
)
  process.exitCode = 1;
