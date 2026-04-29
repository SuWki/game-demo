import { chromium } from "playwright";
try {
  const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  console.log('msedge-ok');
  await browser.close();
} catch (error) {
  console.error(String(error));
  process.exit(1);
}
