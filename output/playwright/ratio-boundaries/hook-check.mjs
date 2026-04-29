import { chromium } from "playwright";
async function launchBrowser() { try { return await chromium.launch({ channel: "msedge", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] }); } catch { return await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] }); } }
const browser = await launchBrowser();
const page = await (await browser.newContext()).newPage();
await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
const hooks = await page.evaluate(() => ({ advanceTime: typeof window.advanceTime, renderText: typeof window.render_game_to_text }));
console.log(JSON.stringify(hooks));
await browser.close();
