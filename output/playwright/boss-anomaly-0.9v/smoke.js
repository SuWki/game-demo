async (page) => {
  const outputDir = 'E:/codex/unity-learning/output/playwright/boss-anomaly-0.9v';
  const summary = {
    panels: [],
    choices: [],
    anomalyPanelSeen: false,
    bossNodeSeen: false,
    bossBattleSeen: false,
    replayStarted: false,
    result: null,
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
    const panel = {
      tag,
      title: normalize(title),
      description: normalize(description),
      choices,
    };
    summary.panels.push(panel);
    if (panel.title.includes('异常')) {
      summary.anomalyPanelSeen = true;
    }
    if (panel.choices.some((choice) => choice.type.includes('Boss'))) {
      summary.bossNodeSeen = true;
    }
    return panel;
  };

  const movePattern = async () => {
    const sequence = [
      ['KeyD', 700],
      ['KeyS', 560],
      ['KeyA', 700],
      ['KeyW', 560],
      ['KeyD', 420],
      ['KeyW', 420],
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

    if (isNodePanel) {
      target =
        panel.choices.find((choice) => choice.type.includes('异常')) ||
        panel.choices.find((choice) => choice.type.includes('Boss')) ||
        panel.choices.find((choice) => choice.type.includes('强化')) ||
        panel.choices[0];
    } else if (isUpgradePanel) {
      target =
        panel.choices.find((choice) => !choice.type.includes('通用')) ||
        panel.choices.find((choice) => choice.text.includes('稀有') || choice.text.includes('紫') || choice.text.includes('金')) ||
        panel.choices[0];
    } else {
      if (panel.title.includes('Boss 阴影扫描')) {
        target = panel.choices.find((choice) => choice.text.includes('承压')) || panel.choices[0];
      } else if (panel.title.includes('载体失真')) {
        target = panel.choices.find((choice) => choice.text.includes('并轨')) || panel.choices[0];
      } else {
        target =
          panel.choices.find((choice) => choice.text.includes('并轨') || choice.text.includes('窗口') || choice.text.includes('样本')) ||
          panel.choices.find((choice) => !choice.type.includes('事件') && !choice.type.includes('异常')) ||
          panel.choices[0];
      }
    }

    summary.choices.push({ panel: panel.title, choice: target.text });
    await page.locator(`[data-choice="${target.id}"]`).click();
    await wait(250);
  };

  await page.screenshot({ path: `${outputDir}/menu.png`, fullPage: true });
  await page.locator('[data-action="start"]').click();
  await wait(500);
  await page.locator('canvas').click({ position: { x: 40, y: 40 } }).catch(() => undefined);

  for (let step = 0; step < 50; step += 1) {
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
    const session = exported.sessions[exported.sessions.length - 1];
    const bossEvents = session.events.filter(
      (event) => event.name === 'battle_template_entered' && event.payload?.encounterType === 'boss',
    );
    const anomalyEvents = session.events.filter(
      (event) => event.name === 'event_selected' && event.payload?.contentKind === 'anomaly',
    );
    return {
      runCount: session.runs.length,
      bossEvents: bossEvents.slice(-3),
      anomalyEvents: anomalyEvents.slice(-3),
      finalRun: session.runs[session.runs.length - 1],
      lastEvents: session.events.slice(-12),
    };
  });

  summary.bossBattleSeen = Boolean(summary.metrics?.bossEvents?.length);
  return summary;
}
