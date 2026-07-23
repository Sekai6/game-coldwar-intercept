import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const outputDirectory = path.resolve(
  process.env.ACMI_OUTPUT ?? "参考文件/验证/tacview-fixed",
);
await mkdir(outputDirectory, { recursive: true });

const allScenarios = [
  { name: "p500-ship-defense", threat: "P-500", count: 2, air: false },
  { name: "p15-ship-defense", threat: "P-15 Termit", count: 2, air: false },
  { name: "joint-air-combat", threat: "P-500", count: 1, air: true },
];
const requestedScenarios = new Set(
  (process.env.ACMI_SCENARIOS ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
);
const scenarios = requestedScenarios.size
  ? allScenarios.filter((scenario) => requestedScenarios.has(scenario.name))
  : allScenarios;
if (!scenarios.length) throw new Error("No matching ACMI sample scenarios");

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  for (const scenario of scenarios) {
    const errors = [];
    const onPageError = (error) => errors.push(error.message);
    const onConsole = (message) => {
      if (message.type() === "error") errors.push(message.text());
    };
    page.on("pageerror", onPageError);
    page.on("console", onConsole);
    await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.locator("#sbPlatform").selectOption("AIRBORNE");
    await page.locator("#sbType").selectOption(scenario.threat);
    await page.locator("#sbCount").fill(String(scenario.count));
    await page.locator("#sbInterval").fill("1");
    await page.locator("#sbZ").fill("-250");
    await page.locator("#sbSpread").fill("0");
    await page.locator("#sbAirCombat").setChecked(scenario.air);
    await page.locator("#sbStart").click();
    await page.getByRole("button", { name: "TIME: 1X" }).click();
    await page.getByRole("button", { name: "TIME: 2X" }).click();
    await page.waitForTimeout(scenario.air ? 18_000 : 16_000);
    const endExercise = page.getByRole("button", { name: "END EXERCISE / AAR" });
    if (!(await page.locator("#aarExportTacview").isVisible()))
      await endExercise.click();
    await page.locator("#aarExportTacview").waitFor({
      state: "visible",
      timeout: 5_000,
    });
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#aarExportTacview").click();
    const download = await downloadPromise;
    const destination = path.join(outputDirectory, `${scenario.name}.acmi`);
    await download.saveAs(destination);
    const telemetry = await page.locator("#scene").evaluate((scene) => ({
      samShots: Number(scene.dataset.shipSamShots ?? 0),
      airWeapons: Number(scene.dataset.airWeaponsLaunched ?? 0),
      aircraft: Number(scene.dataset.aircraftTotal ?? 0),
    }));
    if (errors.length) throw new Error(`${scenario.name}: ${errors.join("; ")}`);
    console.log(JSON.stringify({ scenario: scenario.name, destination, ...telemetry }));
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
  }
} finally {
  await browser.close();
}
