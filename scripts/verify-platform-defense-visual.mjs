import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
    waitUntil: "networkidle",
  });
  const sectorChecks = await page.evaluate(async () => {
  const { pointDefenseBearingInSector } = await import(
    "/src/platforms/defense.ts"
  );
  const degrees = (value) => (value * Math.PI) / 180;
  return {
    bowCoveredStarboard: pointDefenseBearingInSector(
      degrees(0),
      degrees(75),
      degrees(100),
    ),
    bowCoveredPort: pointDefenseBearingInSector(
      degrees(0),
      degrees(-75),
      degrees(100),
    ),
    aftBlockedStarboard: pointDefenseBearingInSector(
      degrees(180),
      degrees(75),
      degrees(100),
    ),
    aftBlockedPort: pointDefenseBearingInSector(
      degrees(180),
      degrees(-75),
      degrees(100),
    ),
  };
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
await page.locator("#sbOpforPointDefenseHealth").fill("100");
await page.locator("#sbOpforEcmHealth").fill("0");
await page.locator("#sbOpforDecoyHealth").fill("0");
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();

  const canvas = page.locator("canvas").first();
  await page.waitForFunction(
  () => Number(document.querySelector("canvas")?.dataset.platformPointDefenseShots ?? 0) >= 1,
  null,
    { timeout: 40_000 },
  );
  const state = await canvas.evaluate((element) => ({
  mounts: Number(element.dataset.platformPointDefenseMounts ?? 0),
  shots: Number(element.dataset.platformPointDefenseShots ?? 0),
  lastMount: element.dataset.platformPointDefenseLastMount ?? "none",
  lastBearing: Number(element.dataset.platformPointDefenseLastBearing ?? 0),
  lastTraverseError: Number(
    element.dataset.platformPointDefenseLastTraverseError ?? 0,
  ),
  lastSectorCenter: Number(
    element.dataset.platformPointDefenseLastSectorCenter ?? 0,
  ),
  lastSectorHalfAngle: Number(
    element.dataset.platformPointDefenseLastSectorHalfAngle ?? 0,
  ),
  lastAlignmentTolerance: Number(
    element.dataset.platformPointDefenseLastAlignmentTolerance ?? 0,
  ),
  mountHistory: (element.dataset.platformPointDefenseMountHistory ?? "")
    .split(",")
    .filter(Boolean),
  originOffset: Number(element.dataset.platformPointDefenseOriginOffset ?? 0),
  effectiveChannels: Number(element.dataset.platformDefenseEffectiveChannels ?? 0),
  engagementsRemaining: Number(
    element.dataset.platformDefenseEngagementsRemaining ?? 0,
  ),
  incomingTracks: Number(element.dataset.platformIncomingTrackCount ?? 0),
  }));
  const uniqueMounts = new Set(state.mountHistory);
  const lastSectorError = Math.abs(
  Math.atan2(
    Math.sin(state.lastBearing - state.lastSectorCenter),
    Math.cos(state.lastBearing - state.lastSectorCenter),
  ),
  );
  await page.keyboard.press("5");
  await page.waitForTimeout(800);
  await page.screenshot({
  path: "verification-platform-defense-visual.png",
  fullPage: true,
  });
  console.log(JSON.stringify({ state, sectorChecks, errors }, null, 2));

  if (
  errors.length > 0 ||
  state.mounts !== 6 ||
  state.shots < 1 ||
  state.mountHistory.length !== state.shots ||
  state.mountHistory.some((mount) => !mount.startsWith("ak-630-")) ||
  uniqueMounts.size < 1 ||
  !state.lastMount.startsWith("ak-630-") ||
  state.originOffset < 5 ||
  lastSectorError > state.lastSectorHalfAngle + 0.001 ||
  state.lastSectorHalfAngle < 1 ||
  Math.abs(state.lastTraverseError) > state.lastAlignmentTolerance + 0.001 ||
  state.lastAlignmentTolerance <= 0 ||
  state.effectiveChannels !== 2 ||
  state.engagementsRemaining > 4 ||
  state.incomingTracks < 1 ||
  !sectorChecks.bowCoveredStarboard ||
  !sectorChecks.bowCoveredPort ||
  sectorChecks.aftBlockedStarboard ||
  sectorChecks.aftBlockedPort
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
