import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const urls = [];
page.on('requestfailed', r => urls.push({ url: r.url(), err: r.failure()?.errorText || 'unknown' }));
page.on('response', r => { if (r.status() === 404) urls.push({ url: r.url(), err: '404' }); });

await page.goto('http://localhost:5174/game-demo/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(5000);

const counts = {};
urls.forEach(u => {
  const key = u.url.replace(/\?.*/, '').replace(/\/+/g, '/');
  counts[key] = (counts[key] || 0) + 1;
});

const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
console.log('=== 404/失败请求统计 ===');
sorted.slice(0, 30).forEach(([k, v]) => console.log(`  ${v}x  ${k}`));
console.log(`\n总失败请求: ${urls.length}`);
console.log(`唯一资源: ${Object.keys(counts).length}`);

await browser.close();
