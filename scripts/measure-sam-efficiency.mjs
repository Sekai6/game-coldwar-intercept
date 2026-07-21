import { chromium } from "playwright-core";
import {
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const lockPath = join(tmpdir(), "codewar-intercept-sam-efficiency.lock");
if (existsSync(lockPath)) {
  const lockPid = Number(readFileSync(lockPath, "utf8"));
  try {
    process.kill(lockPid, 0);
    throw new Error(
      `SAM efficiency test ${lockPid} is already running; concurrent browser matrices are disabled.`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("already running"))
      throw error;
    unlinkSync(lockPath);
  }
}
writeFileSync(lockPath, String(process.pid), { flag: "wx" });
const releaseLock = () => {
  try {
    if (readFileSync(lockPath, "utf8") === String(process.pid))
      unlinkSync(lockPath);
  } catch {
    // The lock may already have been cleaned up after normal completion.
  }
};
process.on("exit", releaseLock);

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: [
    "--use-angle=swiftshader",
    "--renderer-process-limit=2",
    "--disable-background-networking",
    "--disable-extensions",
  ],
});
const weapons = ["RIM-67", "SM-2MR", "SM-2ER"].filter(
  (weapon) => !process.env.SAM_WEAPON || weapon === process.env.SAM_WEAPON,
);
const threats = ["P-15 Termit", "P-500", "P-700", "Kh-22"].filter(
  (threat) => !process.env.SAM_THREAT || threat === process.env.SAM_THREAT,
);
const minimumResolvedPk = {
  "RIM-67": {
    "P-15 Termit": 0.4,
    "P-500": 0.45,
    "P-700": 0.35,
    "Kh-22": 0.3,
  },
  "SM-2MR": {
    "P-15 Termit": 0.4,
    "P-500": 0.5,
    "P-700": 0.5,
    "Kh-22": 0.35,
  },
  "SM-2ER": {
    "P-15 Termit": 0.35,
    "P-500": 0.5,
    "P-700": 0.4,
    "Kh-22": 0.45,
  },
};
const results = [];

for (const weapon of weapons) {
  for (const threat of threats) {
    const label = `${weapon} vs ${threat}`;
    console.error(`[SAM matrix] starting ${label}`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.locator("#sbStart").waitFor({ state: "visible", timeout: 15_000 });
    console.error(`[SAM matrix] loaded ${label}`);
    await page.locator("#sbShip").selectOption("long-beach");
    await page.locator("#sbPlatform").selectOption("AIRBORNE");
    await page.locator("#sbType").selectOption(threat);
    await page.locator("#sbCount").fill("6");
    await page.locator("#sbInterval").fill("2");
    await page.locator("#sbX").fill(process.env.SAM_CENTER_X ?? "0");
    await page.locator("#sbZ").fill("-360");
    await page.locator("#sbSpread").fill("80");
    await page.locator("#sbRim").fill(weapon === "RIM-67" ? "24" : "0");
    await page.locator("#sbSm2").fill(weapon === "SM-2MR" ? "24" : "0");
    await page.locator("#sbSm2er").fill(weapon === "SM-2ER" ? "24" : "0");
    await page.locator("#sbCiws").fill("0");
    await page.locator("#sbChannels").fill("3");
    await page.locator("#sbIlluminators").fill("2");
    await page.locator("#sbStart").click();
    console.error(`[SAM matrix] launched ${label}`);
    await page.waitForTimeout(250);
    const shipEcm = page.getByRole("button", { name: "SHIP ECM: AUTO" });
    if (await shipEcm.isVisible()) await shipEcm.click();
    const srboc = page.getByRole("button", { name: "SRBOC: AUTO" });
    if (await srboc.isVisible()) await srboc.click();
    const threatChaff = page.getByRole("button", { name: "THREAT CHAFF: ON" });
    if (await threatChaff.isVisible()) await threatChaff.click();
    await page.getByRole("button", { name: "TIME: 1X" }).click();
    await page.getByRole("button", { name: "TIME: 2X" }).click();
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector(".result-panel")).display !==
        "none",
      null,
      { timeout: Number(process.env.SAM_SCENARIO_TIMEOUT_MS ?? 180_000) },
    );
    const events = await page.locator("#aarEvents .aar-event span").allTextContents();
    const launches = events.filter(
      (event) => event.includes(weapon) && event.includes(" LAUNCH "),
    ).length;
    const kills = events.filter(
      (event) => event.includes(`${weapon} INTERCEPT`),
    ).length;
    const misses = events.filter(
      (event) => event.includes(`${weapon} MISS`),
    ).length;
    const missReasons = events.filter((event) => event.includes(`${weapon} MISS`));
    const impacts = events.filter((event) => event.includes(" IMPACT ")).length;
    const resolvedShots = kills + misses;
    const resolvedPk = resolvedShots
      ? Number((kills / resolvedShots).toFixed(3))
      : 0;
    const requiredResolvedPk = minimumResolvedPk[weapon][threat];
    results.push({
      weapon,
      threat,
      launches,
      kills,
      misses,
      impacts,
      missReasons,
      unresolvedShots: Math.max(0, launches - resolvedShots),
      launchEfficiency: launches ? Number((kills / launches).toFixed(3)) : 0,
      resolvedPk,
      requiredResolvedPk,
      expectationMet: resolvedShots > 0 && resolvedPk >= requiredResolvedPk,
      errors,
    });
    console.error(
      `[SAM matrix] completed ${label}: ${kills}/${launches} kills, ${impacts} impacts`,
    );
    await page.close();
  }
}

console.log(JSON.stringify(results, null, 2));
if (process.env.SAM_OUTPUT)
  writeFileSync(process.env.SAM_OUTPUT, `${JSON.stringify(results, null, 2)}\n`);
await browser.close();
if (
  results.some(
    (result) =>
      result.errors.length || result.launches === 0 || !result.expectationMet,
  )
)
  process.exitCode = 1;
