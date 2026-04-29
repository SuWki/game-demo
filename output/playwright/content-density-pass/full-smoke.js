async (page) => {
  const outputDir = 'E:/codex/unity-learning/output/playwright/content-density-pass';
  const routeTarget = '暴击';
  const summary = {
    routeTarget,
    panels: [],
    choices: [],
    result: null,
    replayStarted: false,
    metrics: null,
    consoleErrors: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      summary.consoleErrors.push(msg.text());
    }
  });

  const wait = (ms) => page.waitForTimeout(ms);
  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();

  const snapshotPanel = async (tag) => {
    const title = await page.locator('.floating-panel .eyebrow').textContent().catch(() => null);
    const description = await page.locator('.floating-panel .panel-description').textContent().catch(() => null);
    const choices = await page.locator('[data-choice]').evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.getAttribute('data-choice') || '',
        text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
        type: ((element.querySelector('.choice-type') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      })),
    );
    await page.screenshot({ path: `${outputDir}/${tag}.png`, fullPage: true });
    summary.panels.push({ tag, title: normalize(title), description: normalize(description), choices });
    return { title: normalize(title), description: normalize(description), choices };
  };

  const movePattern = async () => {
    const sequence = [
      ['KeyD', 700],
      ['KeyS', 550],
      ['KeyA', 700],
      ['KeyW', 550],
    ];
    for (const [key, duration] of sequence) {
      await page.keyboard.down(key);
      await wait(duration);
      await page.keyboard.up(key);
      const panelCount = await page.locator('[data-choice]').count();
      const resultCount = await page.locator('[data-action="restart"]').count();
      if (panelCount > 0 || resultCount > 0) {
        break;
      }
    }
  };

  const chooseFromPanel = async (panel) => {
    if (!panel.choices.length) {
      return;
    }

    let target = panel.choices[0];
    const isNodePanel = panel.title.includes('节点选择');
    const isUpgradePanel = panel.title.includes('强化') || panel.title.includes('整备') || panel.title.includes('等级提升');
    const isEventPanel = !isNodePanel && !isUpgradePanel;

    if (isNodePanel) {
      target = panel.choices.find((choice) => choice.type.includes('事件'))
        || panel.choices.find((choice) => choice.type.includes('强化'))
        || panel.choices[0];
    } else if (isUpgradePanel) {
      target = panel.choices.find((choice) => choice.type.includes(routeTarget))
        || panel.choices.find((choice) => !choice.type.includes('通用'))
        || panel.choices[0];
    } else if (isEventPanel) {
      target = panel.choices.find((choice) => choice.type.includes(routeTarget))
        || panel.choices[0];
    }

    summary.choices.push({ panel: panel.title, choice: target.text });
    await page.locator(`[data-choice="${target.id}"]`).click();
    await wait(250);
  };

  await page.screenshot({ path: `${outputDir}/menu.png`, fullPage: true });
  await page.locator('[data-action="start"]').click();
  await wait(500);
  await page.locator('canvas').click({ position: { x: 40, y: 40 } }).catch(() => undefined);

  for (let step = 0; step < 12; step += 1) {
    const restartVisible = await page.locator('[data-action="restart"]').count();
    if (restartVisible > 0) {
      break;
    }

    const panelCount = await page.locator('[data-choice]').count();
    if (panelCount > 0) {
      const panel = await snapshotPanel(`panel-${step + 1}`);
      await chooseFromPanel(panel);
      continue;
    }

    await movePattern();
  }

  await wait(1200);
  const resultVisible = await page.locator('[data-action="restart"]').count();
  if (resultVisible > 0) {
    await page.screenshot({ path: `${outputDir}/result.png`, fullPage: true });
    summary.result = normalize(await page.locator('.result-card').textContent().catch(() => ''));
    await page.locator('[data-action="restart"]').click();
    await wait(1200);
    summary.replayStarted = (await page.locator('.hud-shell').count()) > 0 || (await page.locator('[data-choice]').count()) > 0;
    await page.screenshot({ path: `${outputDir}/replay.png`, fullPage: true });
  }

  summary.metrics = await page.evaluate(() => {
    const exported = JSON.parse(window.__exportPilotMetrics());
    const currentSession = exported.sessions[exported.sessions.length - 1];
    return {
      sessionCount: exported.sessions.length,
      eventCount: currentSession.events.length,
      runCount: currentSession.runs.length,
      lastEvents: currentSession.events.slice(-8),
    };
  });

  return summary;
}
