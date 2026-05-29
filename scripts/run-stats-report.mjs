import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('scripts/_run-data.json', 'utf8'));

function avg(arr) { return arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '0'; }
function med(arr) {
  if (!arr.length) return '0';
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  const v = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  return typeof v === 'number' ? v.toFixed(1) : String(v);
}

const total = data.length;
const completed = data.filter(d => !d.timeout);
const wins = data.filter(d => d.isVictory);
const losses = data.filter(d => !d.isVictory && !d.timeout);
const timeouts = data.filter(d => d.timeout);

console.log('\n' + '='.repeat(80));
console.log(`                    ${total} 局 详 细 报 告`);
console.log('='.repeat(80));

console.log(`\n【总览】`);
console.log(`  完成: ${completed.length}/${total} | 超时: ${timeouts.length}`);
console.log(`  胜利: ${wins.length} | 失败: ${losses.length}`);
console.log(`  通关率: ${(wins.length / total * 100).toFixed(1)}%`);

const gameDurations = completed.map(d => d.rich?.durationSec || 0).filter(v => v > 0);
const winDur = wins.map(d => d.rich?.durationSec || 0).filter(v => v > 0);
const lossDur = losses.map(d => d.rich?.durationSec || 0).filter(v => v > 0);
console.log(`\n【游戏时长】`);
if (gameDurations.length) {
  console.log(`  全部: 平均 ${avg(gameDurations)}s | 中位 ${med(gameDurations)}s | 范围 ${Math.min(...gameDurations).toFixed(0)}-${Math.max(...gameDurations).toFixed(0)}s`);
  if (winDur.length) console.log(`  胜利局: 平均 ${avg(winDur)}s | 中位 ${med(winDur)}s`);
  if (lossDur.length) console.log(`  失败局: 平均 ${avg(lossDur)}s | 中位 ${med(lossDur)}s`);
}

const wallTimes = data.map(d => d.wallSec);
console.log(`\n【墙钟耗时】(含2x加速)`);
console.log(`  平均 ${avg(wallTimes)}s | 中位 ${med(wallTimes)}s | 范围 ${Math.min(...wallTimes).toFixed(1)}-${Math.max(...wallTimes).toFixed(1)}s`);

console.log(`\n【流派分布】`);
const routes = {};
data.forEach(d => { if (d.route !== '超时') routes[d.route] = (routes[d.route] || 0) + 1; });
Object.entries(routes).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => {
  const rw = wins.filter(d => d.route === r).length;
  console.log(`  ${r}: ${c}局 (${(c / total * 100).toFixed(0)}%) | 胜率 ${(rw / c * 100).toFixed(0)}%`);
});

console.log(`\n【Build阶段分布】`);
const stages = {};
completed.forEach(d => { const s = d.rich?.buildStage || d.buildStage || '?'; stages[s] = (stages[s] || 0) + 1; });
Object.entries(stages).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => console.log(`  ${s}: ${c}局`));

console.log(`\n【结局类型】`);
const endings = {};
completed.forEach(d => { const e = d.rich?.endingKind || '?'; endings[e] = (endings[e] || 0) + 1; });
Object.entries(endings).sort((a, b) => b[1] - a[1]).forEach(([e, c]) => console.log(`  ${e}: ${c}局`));

console.log(`\n【最终关卡分布】`);
const finals = {};
completed.forEach(d => { const fn = d.rich?.finalNodeTitle || '?'; finals[fn] = (finals[fn] || 0) + 1; });
Object.entries(finals).sort((a, b) => b[1] - a[1]).forEach(([f, c]) => console.log(`  ${f}: ${c}局`));

console.log(`\n【节点通关数】`);
const nodes = completed.map(d => d.rich?.nodesCleared || 0);
if (nodes.length) {
  console.log(`  平均: ${avg(nodes)} | 中位: ${med(nodes)} | 范围: ${Math.min(...nodes)}-${Math.max(...nodes)}`);
  const nw = wins.map(d => d.rich?.nodesCleared || 0);
  const nl = losses.map(d => d.rich?.nodesCleared || 0);
  if (nw.length) console.log(`  胜利局: 平均 ${avg(nw)} 节点`);
  if (nl.length) console.log(`  失败局: 平均 ${avg(nl)} 节点`);
}

console.log(`\n【战斗胜利次数(battleWins)】`);
const bw = completed.map(d => d.rich?.battleWins || 0);
if (bw.length) {
  console.log(`  平均: ${avg(bw)} | 中位: ${med(bw)} | 范围: ${Math.min(...bw)}-${Math.max(...bw)}`);
  const bww = wins.map(d => d.rich?.battleWins || 0);
  const bwl = losses.map(d => d.rich?.battleWins || 0);
  if (bww.length) console.log(`  胜利局: 平均 ${avg(bww)}`);
  if (bwl.length) console.log(`  失败局: 平均 ${avg(bwl)}`);
}

console.log(`\n【强化选择数】`);
const ups = completed.map(d => d.upgradeCount);
if (ups.length) {
  console.log(`  平均: ${avg(ups)} | 中位: ${med(ups)} | 范围: ${Math.min(...ups)}-${Math.max(...ups)}`);
  const uw = wins.map(d => d.upgradeCount);
  const ul = losses.map(d => d.upgradeCount);
  if (uw.length) console.log(`  胜利局: 平均 ${avg(uw)} 个强化`);
  if (ul.length) console.log(`  失败局: 平均 ${avg(ul)} 个强化`);
}

console.log(`\n【路线升级(Route Upgrades)】`);
const rp = completed.map(d => d.rich?.routeUpgradePickCount || 0);
if (rp.length) console.log(`  平均: ${avg(rp)} | 范围: ${Math.min(...rp)}-${Math.max(...rp)}`);

console.log(`\n【稀有升级出现次数】`);
const rs = completed.map(d => d.rich?.rareSeenCount || 0);
if (rs.length) console.log(`  平均: ${avg(rs)} | 范围: ${Math.min(...rs)}-${Math.max(...rs)}`);

console.log(`\n【混合升级(Hybrid Picks)】`);
const hp = completed.map(d => d.rich?.hybridPickCount || 0);
if (hp.length) console.log(`  平均: ${avg(hp)} | 范围: ${Math.min(...hp)}-${Math.max(...hp)}`);

console.log(`\n【分支切换次数】`);
const bs = completed.map(d => d.rich?.branchSwitchCount || 0);
if (bs.length) console.log(`  平均: ${avg(bs)} | 范围: ${Math.min(...bs)}-${Math.max(...bs)}`);

console.log(`\n【异常事件出现次数】`);
const as2 = completed.map(d => d.rich?.anomalySeenCount || 0);
if (as2.length) console.log(`  平均: ${avg(as2)} | 范围: ${Math.min(...as2)}-${Math.max(...as2)}`);

console.log(`\n【节点类型分布】`);
const ntTotal = {};
completed.forEach(d => {
  const ntc = d.rich?.nodeTypeCounts;
  if (ntc) Object.entries(ntc).forEach(([k, v]) => { ntTotal[k] = (ntTotal[k] || 0) + v; });
});
if (Object.keys(ntTotal).length) {
  Object.entries(ntTotal).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => console.log(`  ${t}: ${c}次`));
} else console.log(`  (数据不可用)`);

console.log(`\n【升级稀有度分布(offer)】`);
const rarTotal = {};
completed.forEach(d => {
  const rc = d.rich?.upgradeOfferRarityCounts;
  if (rc) Object.entries(rc).forEach(([k, v]) => { rarTotal[k] = (rarTotal[k] || 0) + v; });
});
if (Object.keys(rarTotal).length) {
  const totalOff = Object.values(rarTotal).reduce((a, b) => a + b, 0);
  Object.entries(rarTotal).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => console.log(`  ${r}: ${c}次 (${(c / totalOff * 100).toFixed(1)}%)`));
} else console.log(`  (数据不可用)`);

console.log(`\n【高频强化选择 TOP10】`);
const upFreq = {};
completed.forEach(d => {
  if (d.upgrades) d.upgrades.forEach(u => { upFreq[u.name] = (upFreq[u.name] || 0) + 1; });
});
const topUp = Object.entries(upFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);
if (topUp.length) topUp.forEach(([n, c]) => console.log(`  ${n}: ${c}次`));
else console.log(`  (数据不可用)`);

console.log(`\n【每局明细】`);
data.forEach((d, i) => {
  const tag = d.timeout ? '⚠超时' : (d.isVictory ? '✓胜' : '✗败');
  const dur = d.rich?.durationSec ? `${d.rich.durationSec.toFixed(0)}s` : '?';
  const kills = d.rich?.battleWins ?? d.killsText ?? '?';
  const nd = d.rich?.nodesCleared ?? 0;
  console.log(`  #${String(i + 1).padStart(2)} ${tag} | 游戏${dur} | ${d.route} ${d.buildStage || ''} | ${kills}击杀 | ${nd}节点 [${d.rich?.finalNodeTitle || '?'}] | ${d.upgradeCount}强化 | ${d.rich?.endingKind || ''}`);
});

console.log('\n' + '='.repeat(80));
console.log(`完成 ${completed.length}/${total} | 通关率 ${(wins.length / total * 100).toFixed(1)}%`);
console.log('='.repeat(80) + '\n');
