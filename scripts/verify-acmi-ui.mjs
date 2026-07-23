import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--use-angle=swiftshader", "--renderer-process-limit=1"],
});
try {
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
  const toggle = page.locator("#sbTacviewAutoExport");
  const state = {
    count: await toggle.count(),
    checked: await toggle.isChecked(),
    label: await toggle.locator("xpath=..").textContent(),
    errors,
  };
  console.log(JSON.stringify(state, null, 2));
  if (
    state.count !== 1 ||
    state.checked ||
    !state.label?.includes("AUTO-EXPORT TACVIEW ACMI") ||
    errors.length
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
