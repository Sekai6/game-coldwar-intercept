import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=2"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", error => errors.push(error.message));

try {
  await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.locator("#sbAirCombat").check();
  await page.locator("#sbStart").click();
  await page.getByRole("button", { name: "TIME: 1X" }).click();
  await page.getByRole("button", { name: "TIME: 2X" }).click();
  await page.waitForFunction(() => {
    const scene = document.querySelector("#scene");
    return (scene?.dataset.airReleaseAuthorizationLog ?? "").split("|").filter(Boolean).length >= 6 && (scene?.dataset.airWeaponLaunchLog ?? "").split("|").filter(Boolean).length >= 6;
  }, null, { timeout: 30_000 });
  const result = await page.locator("#scene").evaluate(scene => ({
    authorizations:(scene.dataset.airReleaseAuthorizationLog ?? "").split("|").filter(Boolean),
    launches:(scene.dataset.airWeaponLaunchLog ?? "").split("|").filter(Boolean),
    hardpoints:(scene.dataset.airHardpointStates ?? "").split("|").filter(Boolean),
    releaseAges:(scene.dataset.airWeaponReleaseAges ?? "").split("|").filter(Boolean),
  }));
  const releasedHardpoints = result.launches.map(launch => launch.split(" / ")[1]);
  const emptyReleasedHardpoints = releasedHardpoints.every(hardpoint => result.hardpoints.some(state => state.includes(`:${hardpoint.toLowerCase()}:empty:none`)));
  const separationCompleted = result.releaseAges.every(entry => { const [,age,ignitionDelay]=entry.split(":"); return Number(age)>=Number(ignitionDelay); });
  const output={authorizationCount:result.authorizations.length,launchCount:result.launches.length,releasedHardpoints,emptyReleasedHardpoints,separationCompleted,errors};
  console.log(JSON.stringify(output,null,2));
  if(errors.length||output.authorizationCount<6||output.launchCount<6||releasedHardpoints.some(hardpoint=>!hardpoint)||!emptyReleasedHardpoints||!separationCompleted)process.exitCode=1;
} finally { await browser.close(); }
