import { chromium } from "playwright-core";

const executablePath =
  process.env.CHROME_PATH ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--use-angle=swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(process.env.APP_URL ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle",
});
const selects = page.locator("select");
let selected = false;
for (let index = 0; index < (await selects.count()); index++) {
  const options = await selects.nth(index).locator("option").allTextContents();
  if (!options.some((option) => option.includes("CG-57"))) continue;
  await selects.nth(index).selectOption("ticonderoga");
  selected = true;
  break;
}
if (!selected) throw new Error("CG-57 ship selector option was not found");

await page.waitForTimeout(1200);
await page.locator("#sbCount").fill("1");
await page.locator("#sbStart").click();
await page.waitForTimeout(600);
await page.keyboard.press("Space");
await page.waitForTimeout(250);
await page.keyboard.press("1");
await page.mouse.wheel(0, -1000);
await page.waitForTimeout(500);
await page.screenshot({ path: "verification-cg57-upgrade.png", fullPage: true });
const canvas = page.locator("canvas").first();
const box = await canvas.boundingBox();
if (!box) throw new Error("Three.js canvas was not rendered");
await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.633, box.y + box.height * 0.5, {
  steps: 12,
});
await page.mouse.up();
await page.waitForTimeout(500);
await page.screenshot({ path: "verification-cg57-side.png", fullPage: true });

const body = await page.locator("body").innerText();
const result = {
  cg57Selected: body.includes("CG-57"),
  screenshots: ["verification-cg57-upgrade.png", "verification-cg57-side.png"],
  errors,
};
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (!result.cg57Selected || errors.length > 0) process.exitCode = 1;
