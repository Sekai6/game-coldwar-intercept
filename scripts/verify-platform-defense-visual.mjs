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
await page.locator("#sbOpforPointDefenseHealth").fill("100");
await page.locator("#sbOpforEcmHealth").fill("0");
await page.locator("#sbOpforDecoyHealth").fill("0");
await page.locator("#sbStart").click();
await page.getByRole("button", { name: "TIME: 1X" }).click();
await page.getByRole("button", { name: "TIME: 2X" }).click();

const canvas = page.locator("canvas").first();
await page.waitForFunction(
  () => Number(document.querySelector("canvas")?.dataset.platformPointDefenseShots ?? 0) >= 2,
  null,
  { timeout: 100_000 },
);
const state = await canvas.evaluate((element) => ({
  mounts: Number(element.dataset.platformPointDefenseMounts ?? 0),
  shots: Number(element.dataset.platformPointDefenseShots ?? 0),
  lastMount: element.dataset.platformPointDefenseLastMount ?? "none",
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
await page.keyboard.press("5");
await page.waitForTimeout(800);
await page.screenshot({
  path: "verification-platform-defense-visual.png",
  fullPage: true,
});
console.log(JSON.stringify({ state, errors }, null, 2));
await browser.close();

if (
  errors.length > 0 ||
  state.mounts !== 6 ||
  state.shots < 2 ||
  state.mountHistory.length !== state.shots ||
  state.mountHistory.some((mount) => !mount.startsWith("ak-630-")) ||
  uniqueMounts.size < 2 ||
  !state.lastMount.startsWith("ak-630-") ||
  state.originOffset < 5 ||
  state.effectiveChannels !== 2 ||
  state.engagementsRemaining > 4 ||
  state.incomingTracks < 1
)
  process.exitCode = 1;
