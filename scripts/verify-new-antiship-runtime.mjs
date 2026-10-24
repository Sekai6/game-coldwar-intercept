import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args:["--use-angle=swiftshader", "--renderer-process-limit=1", "--disable-background-networking"],
});
const page = await browser.newPage({ viewport:{ width:1280, height:720 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
const url = new URL(process.env.APP_URL ?? "http://127.0.0.1:5173/");
url.searchParams.set("validationTimeScale", "16");
const additions = [
  { id:"R-360 Neptune", preset:"NEPTUNE RAID", damage:18 },
  { id:"3M24 Uran", preset:"URAN RAID", damage:17 },
  { id:"ASM-1", preset:"ASM-1 RAID", damage:18 },
  { id:"RBS-15 Mk. II", preset:"RBS-15 RAID", damage:24 },
  { id:"MM38 Exocet", preset:"EXOCET RAID", damage:20 },
];
const scenario = JSON.parse(await readFile(new URL("../src/scenarios/full-spectrum-blackout/scenario.json", import.meta.url), "utf8"));

async function events() { return page.evaluate(() => window.threatTestEvents); }
async function start(weapon, mode) {
  await page.goto(url.href, { waitUntil:"domcontentloaded", timeout:15000 });
  await page.locator("#sbAirCombat").uncheck();
  await page.locator("#sbFleetMode").uncheck();
  await page.locator("#sbShip").selectOption("ticonderoga");
  await page.locator("#sbPlatform").selectOption("slava-moskva");
  assert.equal(await page.locator(`#sbType option[value="${weapon.id}"]`).count(), 0, "Moskva must not offer an unsupported weapon");
  await page.getByRole("button", { name:weapon.preset, exact:true }).click();
  assert.equal(await page.locator("#sbPlatform").inputValue(), "AIRBORNE");
  assert.equal(await page.locator("#sbType").inputValue(), weapon.id);
  await page.locator("#sbCount").fill(mode === "defense" || mode === "ciws" ? "4" : "1");
  // Separate CIWS arrivals allow physical mounts to traverse between targets;
  // this checks interception rather than a saturated, short firing window.
  await page.locator("#sbInterval").fill(mode === "ciws" ? "3" : "0.3");
  await page.locator("#sbSpread").fill(mode === "defense" ? "60" : "0");
  await page.locator("#sbZ").fill(mode === "defense" ? "-220" : "-110");
  if (mode !== "defense") {
    for (const id of ["sbRim", "sbSm2", "sbSm2er"]) await page.locator(`#${id}`).fill("0");
  }
  // Isolate SAM and CIWS before starting, with no live control-toggle race.
  if (mode !== "ciws") await page.locator("#sbCiws").fill("0");
  await page.evaluate(() => {
    window.threatTestEvents = [];
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes)
        if (node.textContent) window.threatTestEvents.push(node.textContent);
    }).observe(document.querySelector("#feed"), { childList:true });
  });
  await page.locator("#sbStart").click();
  if (mode !== "ew") {
    // One browser task applies all controls before the next simulation frame.
    await page.evaluate(() => {
      for (const text of ["SHIP ECM: AUTO", "SRBOC: AUTO", "THREAT CHAFF: ON"]) {
        const button = [...document.querySelectorAll("button")].find(candidate => candidate.textContent === text);
        if (!button) throw new Error(`Missing control ${text}`);
        button.click();
      }
    });
  }
}

try {
  const results = [];
  for (const weapon of additions) {
    // Import a wave alongside the existing red surface force: its filtered
    // launcher options must be rebuilt before selecting an in-flight weapon.
    await page.goto(url.href, { waitUntil:"domcontentloaded", timeout:15000 });
    await page.locator('.scenario-io-controls input[type="file"]').setInputFiles({
      name:"new-antiship.json", mimeType:"application/json",
      buffer:Buffer.from(JSON.stringify({ ...scenario, threatWaves:[{
        id:"new-threat", threatId:weapon.id, source:"in-flight", side:"red", count:1,
        firstLaunchAt:0, intervalSeconds:1, origin:[0,.3,-420], altitude:.3, spread:0,
      }] })),
    });
    await page.locator(".scenario-import-preview [data-confirm]").click();
    assert.equal(await page.locator("#sbType").inputValue(), weapon.id);
    assert.equal(await page.locator("#sbPlatform").inputValue(), "AIRBORNE");

    await start(weapon, "impact");
    await page.waitForFunction(id => {
      const data = document.querySelector("#scene")?.dataset;
      return data?.selectedThreatKind === id && data.selectedThreatPhase === "terminal" && data.terminalSeekerAcquired === "true";
    }, weapon.id, { timeout:15000 });
    const terminal = await page.locator("#scene").evaluate(canvas => ({ altitude:Number(canvas.dataset.selectedThreatAltitude), range:Number(canvas.dataset.selectedThreatRange) }));
    assert(terminal.altitude > 0 && terminal.altitude < .5 && terminal.range < 130);
    const terminalEvents = await events();
    assert(terminalEvents.some(text => text.startsWith(`${weapon.id} ACTIVE SEEKER SEARCH`)), "terminal guidance must be active radar");
    await page.waitForFunction(id => window.threatTestEvents.some(text => text.includes(`${id} IMPACT`)), weapon.id, { timeout:30000 });
    console.log(`${weapon.id}: terminal and impact passed`);
    assert((await events()).some(text => text.startsWith(`${weapon.id} IMPACT / ${weapon.damage}% DAMAGE / `)), "impact damage must match this weapon exactly");
    assert(Number(await page.locator("#scene").getAttribute("data-ship-hull")) < 100);

    await start(weapon, "ew");
    await page.waitForFunction(() => window.threatTestEvents.some(text => /CHAFF|SRBOC/.test(text)) && window.threatTestEvents.some(text => /SEEKER SEARCH/.test(text)), null, { timeout:20000 });
    const ew = await events();
    console.log(`${weapon.id}: countermeasure activation passed`);
    assert(!ew.some(text => /HOME-ON-JAM|POP-UP/.test(text)));

    await start(weapon, "defense");
    await page.waitForFunction(() => window.threatTestEvents.some(text => /^(?:RIM-67|SM-2MR|SM-2ER) INTERCEPT \//.test(text)), null, { timeout:45000 });
    const defense = await events();
    console.log(`${weapon.id}: defensive kill passed`);
    assert(defense.some(text => /LAUNCH|PHYSICAL RELEASE/.test(text)), "physical SAM defense must execute");
    await start(weapon, "ciws");
    await page.waitForFunction(() => window.threatTestEvents.some(text => /^CIWS KILL/.test(text)), null, { timeout:45000 });
    const ciws = (await events()).filter(text => /^CIWS KILL/.test(text));
    console.log(`${weapon.id}: CIWS kill passed`);
    results.push({ id:weapon.id, terminal, impact:true, countermeasures:ew.filter(text => /CHAFF|SRBOC|ECM/.test(text)), defense:defense.filter(text => /^(?:RIM-67|SM-2MR|SM-2ER) INTERCEPT \//.test(text)), ciws });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ events:await events(), diagnostics:await page.locator("#scene").evaluate(canvas => ({ time:canvas.dataset.simulationElapsed, kind:canvas.dataset.selectedThreatKind, phase:canvas.dataset.selectedThreatPhase, range:canvas.dataset.selectedThreatRange, hull:canvas.dataset.shipHull })), errors }, null, 2));
  throw error;
} finally { await browser.close(); }
