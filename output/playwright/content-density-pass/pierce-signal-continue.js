async (page) => {
  const outputDir = 'E:/codex/unity-learning/output/playwright/content-density-pass';
  const routeTarget = '穿透';
  const summary = { routeTarget, panels: [], choices: [], consoleErrors: [] };
  page.on('console', (msg) => { if (msg.type() === 'error') summary.consoleErrors.push(msg.text()); });
  const wait = (ms) => page.waitForTimeout(ms);
  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const snapshotPanel = async (name) => {
    const title = await page.locator('.floating-panel .eyebrow').textContent().catch(() => null);
    const choices = await page.locator('[data-choice]').evaluateAll((elements) => elements.map((element) => ({
      id: element.getAttribute('data-choice') || '',
      text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
      type: ((element.querySelector('.choice-type') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    })));
    await page.screenshot({ path: `${outputDir}/${name}.png`, fullPage: true });
    summary.panels.push({ title: normalize(title), choices });
    return { title: normalize(title), choices };
  };
  const movePattern = async () => {
    for (const [key, duration] of [['KeyD', 850], ['KeyS', 650], ['KeyA', 850], ['KeyW', 650]]) {
      await page.keyboard.down(key);
      await wait(duration);
      await page.keyboard.up(key);
      if (await page.locator('[data-choice]').count()) break;
    }
  };
  const choose = async (panel) => {
    const choice = panel.choices.find((item) => item.type.includes(routeTarget)) || panel.choices.find((item) => !item.type.includes('通用')) || panel.choices[0];
    summary.choices.push(choice.text);
    await page.locator(`[data-choice="${choice.id}"]`).click();
    await wait(250);
  };
  for (let step = 0; step < 10; step += 1) {
    if (await page.locator('[data-choice]').count()) {
      const panel = await snapshotPanel(`pierce-panel-extra-${step + 1}`);
      await choose(panel);
      break;
    }
    await movePattern();
  }
  return summary;
}
