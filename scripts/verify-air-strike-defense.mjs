import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe", args:["--use-angle=swiftshader","--renderer-process-limit=2"] });
const page = await browser.newPage({ viewport:{ width:1440,height:900 } });
const errors=[];
page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
page.on("pageerror",e=>errors.push(e.message));
const url=process.env.APP_URL??"http://127.0.0.1:5173/";
async function start(){await page.goto(url,{waitUntil:"domcontentloaded",timeout:15_000});await page.locator("#sbAirCombat").check();await page.locator("#sbStart").click();await page.getByRole("button",{name:"TIME: 1X"}).click();await page.getByRole("button",{name:"TIME: 2X"}).click();}
try{
  await start();
  await page.waitForFunction(()=>Number(document.querySelector("#scene")?.dataset.shipAirMissileKills??0)>=1,null,{timeout:30_000});
  const defense=await page.locator("#scene").evaluate(c=>({tracks:Number(c.dataset.shipAirMissileTracks??0),kills:Number(c.dataset.shipAirMissileKills??0),samShots:Number(c.dataset.shipSamShots??0),ksrSpeed:Number(c.dataset.ksrMaximumSpeed??0),launchers:c.dataset.airDefenseLaunchers??""}));
  await page.screenshot({path:"verification-air-missile-defense.png",fullPage:true});
  await start();
  await page.getByRole("button",{name:"AUTO FIRE: ON"}).click();
  try {
    await page.waitForFunction(()=>Number(document.querySelector("#scene")?.dataset.airShipHits??0)>=1,null,{timeout:45_000});
  } catch (error) {
    const diagnostic=await page.locator("#scene").evaluate(c=>({hits:c.dataset.airShipHits,activeMissiles:c.dataset.airActiveMissiles,phases:c.dataset.airWeaponPhases,launchLog:c.dataset.airWeaponLaunchLog,shipHull:c.dataset.shipHull}));
    console.error("Air-strike impact timeout",JSON.stringify({...diagnostic,errors},null,2));
    throw error;
  }
  const damage=await page.locator("#scene").evaluate(c=>({hits:Number(c.dataset.airShipHits??0),damage:Number(c.dataset.airShipDamage??0),hull:Number(c.dataset.shipHull??100),damagedSystems:document.querySelectorAll(".subsystem-row.damaged,.subsystem-row.degraded,.subsystem-row.failed").length,phase:document.querySelector("#phase")?.textContent??""}));
  await page.screenshot({path:"verification-air-missile-impact.png",fullPage:true});
  console.log(JSON.stringify({defense,damage,errors},null,2));
  if(errors.length||defense.tracks<1||defense.kills<1||defense.samShots<1||defense.ksrSpeed>10.5||!/MK 10|MK 41/.test(defense.launchers)||damage.hits<1||damage.damage<40||damage.hull>=100||damage.damagedSystems<1)process.exitCode=1;
}finally{await browser.close();}
