import { BATTLE_TEMPLATES, getBattleEncounterLabel } from '../data/battleTemplates';
import { RARITY_COLOR_MAP } from '../data/balance';
import { ROUTE_COLOR_MAP, ROUTE_NAME_MAP } from '../data/routes';
import { describeContentEffects } from '../data/upgrades';
import type {
  AnomalyRoleId,
  ContentEffect,
  EventDefinition,
  NodeOption,
  OverlayHudSnapshot,
  OverlayMetaSummary,
  RouteReference,
  RunResult,
  RunState,
  ToastTone,
  UpgradeDefinition,
} from '../game/types';

interface ResultActions {
  onRestart: () => void;
  onBackToMenu: () => void;
}

interface PauseActions {
  onResume: () => void;
  onRestart: () => void;
  onBackToMenu: () => void;
  onVolume: () => void;
}

type PanelProgress = Pick<
  OverlayHudSnapshot,
  'progressLabel' | 'progressDetail' | 'phaseTrack' | 'levelText' | 'routeStatusText' | 'statSummary' | 'upgradeRewardLabel'
>;

const NODE_TYPE_LABEL_MAP: Record<NodeOption['type'], string> = {
  battle: '战斗',
  upgrade: '强化',
  anomaly: '异常',
  boss: 'Boss',
};

const NODE_TYPE_ACCENT_MAP: Record<NodeOption['type'], string> = {
  battle: '#f09a54',
  upgrade: '#59baf3',
  anomaly: '#a773ff',
  boss: '#f06d56',
};

const TOAST_BADGES: Record<ToastTone, string> = {
  neutral: '信息',
  accent: '提示',
  route: '路子',
  danger: '危险',
  success: '搞定',
};

export class OverlayController {
  private readonly root: HTMLElement;

  private readonly screenLayer: HTMLDivElement;

  private readonly hudLayer: HTMLDivElement;

  private readonly panelLayer: HTMLDivElement;

  private readonly toastLayer: HTMLDivElement;

  private readonly tooltipLayer: HTMLDivElement;

  private activeTooltipTarget: HTMLElement | null = null;

  public constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = '';
    this.root.className = 'ui-root';

    this.screenLayer = document.createElement('div');
    this.screenLayer.className = 'screen-layer';

    this.hudLayer = document.createElement('div');
    this.hudLayer.className = 'hud-layer hidden';

    this.panelLayer = document.createElement('div');
    this.panelLayer.className = 'panel-layer hidden';

    this.toastLayer = document.createElement('div');
    this.toastLayer.className = 'toast-layer';

    this.tooltipLayer = document.createElement('div');
    this.tooltipLayer.className = 'choice-tooltip-floating';

    this.root.append(this.screenLayer, this.hudLayer, this.panelLayer, this.toastLayer, this.tooltipLayer);
    this.root.addEventListener('mouseover', (event) => this.handleTooltipEnter(event));
    this.root.addEventListener('focusin', (event) => this.handleTooltipEnter(event));
    this.root.addEventListener('mouseout', (event) => this.handleTooltipLeave(event));
    this.root.addEventListener('focusout', (event) => this.handleTooltipLeave(event));
    window.addEventListener('resize', () => this.hideTooltip());
  }

  public showMenu(summary: OverlayMetaSummary, onStart: () => void, onExport: () => void, onVolume: () => void): void {
    this.hideHud();
    this.hidePanel();
    this.clearToasts();
    this.screenLayer.classList.remove('hidden');
    this.screenLayer.innerHTML = `
      <section class="screen-minimal menu-screen space-combat-start-screen">
        <div class="space-scanlines" aria-hidden="true"></div>
        <div class="space-particles" aria-hidden="true"></div>

        <div class="start-screen-container">
          <div class="start-screen-header">
            <div class="title-glitch-wrapper">
              <h1 class="space-title">PROJECT ORBITAL</h1>
              <div class="title-subtitle">轨道计划 - 自动出击编队</div>
            </div>
          </div>

          <div class="start-screen-visual">
            <div class="hologram-ship">
              <div class="ship-core"></div>
              <div class="orbit-ring orbit-ring-1"></div>
              <div class="orbit-ring orbit-ring-2"></div>
              <div class="orbit-ring orbit-ring-3"></div>
            </div>
          </div>

          <div class="start-screen-actions">
            <div class="start-screen-primary">
              <button class="combat-action combat-action-primary" data-action="start">
                <span class="action-icon">▶</span>
                <div class="action-content">
                  <strong>开始作战</strong>
                  <small>直接开一把</small>
                </div>
              </button>
              <p class="start-screen-callout">先开战，战报和设置往后放。</p>
            </div>

            <div class="start-screen-meta">
              <div class="start-screen-stats">
                <div class="stat-item">
                  <span class="stat-label">出击</span>
                  <strong class="stat-value">${summary.totalRuns}</strong>
                </div>
                <div class="stat-item">
                  <span class="stat-label">胜利</span>
                  <strong class="stat-value">${summary.wins}</strong>
                </div>
                <div class="stat-item">
                  <span class="stat-label">上次</span>
                  <strong class="stat-value">${summary.lastDurationSec > 0 ? this.formatDuration(summary.lastDurationSec) : '--:--'}</strong>
                </div>
                <div class="stat-item">
                  <span class="stat-label">上把路子</span>
                  <strong class="stat-value">${summary.lastRouteName || '无'}</strong>
                </div>
              </div>

              <div class="start-screen-secondary">
                <button class="combat-action-small" data-action="export">
                  <span>旧战报</span>
                </button>
                <button class="combat-action-small" data-action="volume">
                  <span>调音量</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
    this.bindClick('[data-action="start"]', onStart);
    this.bindClick('[data-action="export"]', onExport);
    this.bindClick('[data-action="volume"]', onVolume);
  }

  public showPausePanel(snapshot: OverlayHudSnapshot, actions: PauseActions): void {
    this.hideHud();
    this.hidePanel();
    this.clearToasts();
    this.screenLayer.classList.add('hidden');
    this.panelLayer.className = 'panel-layer panel-layer-center';
    this.panelLayer.classList.remove('hidden');
    this.panelLayer.innerHTML = `
      <section class="floating-panel dock-panel commercial-choice-panel commercial-pause-panel">
        <div class="tray-header">
          <div class="tray-title-group">
            <span class="panel-eyebrow">先停一下</span>
            <h2 class="panel-title">缓一口气</h2>
          </div>
        </div>
        <div class="pause-panel-layout">
          <aside class="pause-panel-summary" aria-label="当前局面">
            <div class="pause-panel-status">
              <span>${snapshot.phaseLabel}</span>
              <strong>${snapshot.statusText}</strong>
              <small>${snapshot.statusSubtext ?? snapshot.progressDetail}</small>
            </div>
            <div class="screen-summary-grid pause-panel-grid">
              <article class="screen-summary-card">
                <span class="screen-summary-label">这把路子</span>
                <strong>${snapshot.routeStatusText}</strong>
              </article>
              <article class="screen-summary-card">
                <span class="screen-summary-label">打到哪了</span>
                <strong>${snapshot.progressLabel}</strong>
              </article>
              <article class="screen-summary-card">
                <span class="screen-summary-label">眼下先做</span>
                <strong>${snapshot.objectiveLabel}</strong>
              </article>
              <article class="screen-summary-card">
                <span class="screen-summary-label">还差多少</span>
                <strong>${snapshot.objectiveProgressText}</strong>
              </article>
            </div>
          </aside>
          <div class="pause-panel-actions">
            <div class="pause-panel-action-lead">
              <strong>先看左边，再决定停多久。</strong>
              <small>继续是主操作，其他都往后退。</small>
            </div>
            <button class="text-action text-action-primary" data-action="resume">
              <span>接着打</span>
              <small>回到刚才那一下</small>
            </button>
            <button class="text-action" data-action="restart">
              <span>重开这一局</span>
              <small>从头再来</small>
            </button>
            <button class="text-action" data-action="menu">
              <span>回到首页</span>
              <small>先回机库</small>
            </button>
            <button class="text-action" data-action="volume">
              <span>调音量</span>
              <small>把声音调一下</small>
            </button>
          </div>
        </div>
      </section>
    `;
    this.bindClick('[data-action="resume"]', actions.onResume);
    this.bindClick('[data-action="restart"]', actions.onRestart);
    this.bindClick('[data-action="menu"]', actions.onBackToMenu);
    this.bindClick('[data-action="volume"]', actions.onVolume);
  }

  public showVolumePanel(
    title: string,
    subtitle: string,
    volume: number,
    onChange: (volume: number) => void,
    onClose: () => void,
  ): void {
    this.hideHud();
    this.hidePanel();
    this.hideScreen();
    this.hideTooltip();
    this.panelLayer.className = 'panel-layer panel-layer-center';
    this.panelLayer.classList.remove('hidden');
    const volumePercent = Math.round(volume * 100);
    this.panelLayer.innerHTML = `
      <section class="floating-panel dock-panel commercial-choice-panel commercial-volume-panel">
        <div class="tray-header">
          <div class="tray-title-group">
            <span class="panel-eyebrow">AUDIO</span>
            <h2 class="panel-title">${title}</h2>
          </div>
        </div>
        <div class="volume-panel-copy">
          <p>${subtitle}</p>
          <strong data-volume-readout>${volumePercent}%</strong>
        </div>
        <div class="volume-panel-slider">
          <input data-volume-slider type="range" min="0" max="150" step="1" value="${volumePercent}" />
        </div>
        <div class="volume-panel-actions">
          <button class="text-action text-action-primary" data-action="close">
            <span>完成</span>
            <small>返回上一层</small>
          </button>
        </div>
      </section>
    `;
    const slider = this.panelLayer.querySelector<HTMLInputElement>('[data-volume-slider]');
    const readout = this.panelLayer.querySelector<HTMLElement>('[data-volume-readout]');
    if (slider && readout) {
      slider.addEventListener('input', () => {
        const nextVolume = Number(slider.value) / 100;
        readout.textContent = `${Math.round(nextVolume * 100)}%`;
        onChange(nextVolume);
      });
    }
    this.bindClick('[data-action="close"]', onClose);
  }

  public showHud(snapshot: OverlayHudSnapshot, onPause?: () => void): void {
    this.screenLayer.classList.add('hidden');
    this.hidePanel();
    this.hideTooltip();
    this.hudLayer.classList.remove('hidden');
    const routeMomentColor = snapshot.routeMomentRouteId ? ROUTE_COLOR_MAP[snapshot.routeMomentRouteId] : undefined;
    this.hudLayer.innerHTML = `
      <div class="game-hud-fixed">
        <section class="game-hud-fixed__left">
          <div class="hud-meter-card is-hp">
            <div class="hud-meter-card__head">
              <span>HP</span>
              <strong>${snapshot.hpText}</strong>
            </div>
            <div class="hud-meter-card__bar ${this.getMeterStateClass(snapshot.hpRatio)}">
              <span style="width: ${Math.max(0, Math.min(100, snapshot.hpRatio * 100)).toFixed(1)}%"></span>
            </div>
          </div>
          <div class="hud-meter-card is-exp">
            <div class="hud-meter-card__head">
              <span>EXP</span>
              <strong>${snapshot.experienceText}</strong>
            </div>
            <div class="hud-meter-card__bar is-exp">
              <span style="width: ${Math.max(0, Math.min(100, snapshot.experienceRatio * 100)).toFixed(1)}%"></span>
            </div>
            <span class="hud-meter-card__level">${snapshot.levelText}</span>
          </div>
          <div class="game-hud-fixed__route-stack"${routeMomentColor ? ` style="--route-pill: ${routeMomentColor}"` : ''}>
            <span class="game-hud-fixed__route">${snapshot.routeStatusText}</span>
            ${snapshot.routeMomentText ? `<span class="game-hud-fixed__route-moment">${snapshot.routeMomentText}</span>` : ''}
          </div>
        </section>
        <section class="game-hud-fixed__center">
          <span class="game-hud-fixed__wave">${this.getHudWaveLabel(snapshot.progressLabel)}</span>
          <span class="game-hud-fixed__mode">${snapshot.statusText}</span>
          ${snapshot.statusSubtext ? `<span class="game-hud-fixed__reward">${snapshot.statusSubtext}</span>` : ''}
        </section>
        <section class="game-hud-fixed__right">
          <button class="hud-pause-button" data-action="pause">暂停</button>
        </section>
      </div>
    `;
    if (onPause) {
      this.bindClick('[data-action="pause"]', onPause);
    }
  }

  public showNodePanel(
    phaseLabel: string,
    options: NodeOption[],
    progress: PanelProgress,
    onChoose: (nodeId: string) => void,
  ): void {
    // 检测是否有Boss节点
    const hasBossNode = options.some((node) => node.type === 'boss');
    const alertText = hasBossNode
      ? '<span class="is-boss-warning">⚠️ 警告：下一站是 Boss 战</span>'
      : undefined;

    this.showPanel({
      panelClassName: 'panel-node-choice panel-route-choice',
      panelLayerClassName: 'panel-layer-center',
      modeLabel: '下一站',
      eyebrow: '接下来',
      title: '下一站走哪条',
      contextHtml: this.renderRouteChoiceContext(phaseLabel, options.length, progress),
      items: options.map((node) => this.renderNodeChoiceCard(node)),
      progress,
      alertText,
    });
    for (const node of options) {
      this.bindClick(`[data-choice="${node.id}"]`, () => onChoose(node.id));
    }
  }

  public showUpgradePanel(
    title: string,
    _description: string,
    progress: PanelProgress,
    choices: UpgradeDefinition[],
    onChoose: (upgradeId: string) => void,
  ): void {
    const isFinalPrep = title.includes('最后整备');
    this.showPanel({
      panelClassName: 'panel-upgrade-choice',
      panelLayerClassName: 'panel-layer-center',
      modeLabel: isFinalPrep ? '最后整备' : '挑强化',
      eyebrow: isFinalPrep ? '最后补一手' : '挑一张',
      title: isFinalPrep ? '最后整备' : '挑一张强化',
      contextHtml: this.renderUpgradeChoiceContext(progress),
      items: choices.map((upgrade) => this.renderUpgradeChoiceCard(upgrade, progress)),
      progress,
    });
    for (const upgrade of choices) {
      this.bindClick(`[data-choice="${upgrade.id}"]`, () => onChoose(upgrade.id));
    }
  }

  public showEventPanel(
    eventDef: EventDefinition,
    progress: PanelProgress,
    onChoose: (optionId: string) => void,
  ): void {
    const isAnomaly = eventDef.contentKind === 'anomaly';
    this.showPanel({
      panelClassName: `panel-event-choice${isAnomaly ? ' panel-event-choice-anomaly' : ''}`,
      panelLayerClassName: isAnomaly ? 'panel-layer-center' : undefined,
      modeLabel: isAnomaly ? '异常机会' : '事件',
      eyebrow: isAnomaly ? '局面要变了' : '事件',
      title: isAnomaly ? '异常机会' : eventDef.name,
      contextHtml: isAnomaly ? this.renderAnomalyChoiceContext(eventDef, progress) : undefined,
      items: eventDef.options.map((option) => this.renderEventChoiceCard(eventDef, option)),
      progress,
    });
    for (const option of eventDef.options) {
      this.bindClick(`[data-choice="${option.id}"]`, () => onChoose(option.id));
    }
  }

  public showBossEnding(bossEnding: NonNullable<RunState['bossEnding']>): void {
    const { outcome, label } = bossEnding;
    const labelLines = label.split(' / ');
    const mainText = labelLines[0] ?? '';
    const subText = labelLines[1] ?? '';
    const isVictory = outcome === 'victory';

    this.hideHud();
    this.screenLayer.classList.remove('hidden');
    this.screenLayer.innerHTML = `
      <section class="screen-minimal boss-ending-screen ${isVictory ? 'is-victory' : 'is-defeat'}">
        <div class="screen-gridline" aria-hidden="true"></div>
        <div class="commercial-screen-layout">
          <div class="commercial-screen-copy boss-ending-copy">
            <div class="boss-ending-icon">
              <span class="screen-ring ring-a"></span>
              <span class="screen-ring ring-b"></span>
            </div>
            <h1 class="screen-title boss-ending-title">${mainText}</h1>
            <p class="screen-subtitle boss-ending-subtitle">${subText}</p>
          </div>
        </div>
      </section>
    `;
  }

  public showResult(result: RunResult, actions: ResultActions): void {
    this.hideHud();
    this.hidePanel();
    this.clearToasts();
    this.screenLayer.classList.remove('hidden');
    const routeLabel = this.getRouteDisplayLabel(result.routeId);
    const isVictory = result.outcome === 'victory';
    const buildStageLabel = this.getRouteResultStageLabel(result.routeId, result.buildStage);
    this.screenLayer.innerHTML = `
      <section class="screen-minimal result-screen space-combat-result-screen ${isVictory ? 'is-victory' : 'is-defeat'}">
        <div class="space-scanlines" aria-hidden="true"></div>
        <div class="result-particles" aria-hidden="true"></div>

        <div class="result-screen-container">
          <div class="result-screen-header">
            <div class="result-status-icon ${isVictory ? 'status-victory' : 'status-defeat'}">
              ${isVictory ? '✓' : '✗'}
            </div>
            <h1 class="result-title">${isVictory ? '这局收住了' : '这局断在这了'}</h1>
            <p class="result-subtitle">${isVictory ? '一路打到了最后' : '这次停在了这里'}</p>
            ${!isVictory ? `<p class="result-reason">${result.endingReason}</p>` : ''}
          </div>

          <div class="result-story">
            <p class="result-story__summary">${result.summary}</p>
            <p class="result-story__route">${this.getResultRouteRecap(result)}</p>
            <p class="result-story__build">${result.buildSummary}</p>
          </div>

          <div class="result-screen-actions">
            <button class="combat-action combat-action-primary" data-action="restart">
              <span class="action-icon">▶</span>
              <div class="action-content">
                <strong>再来一局</strong>
                <small>立刻重开</small>
              </div>
            </button>
            <div class="result-secondary-actions">
              <button class="combat-action-small" data-action="details">
                <span>看这局怎么断的</span>
              </button>
              <button class="combat-action-small" data-action="menu">
                <span>回到机库</span>
              </button>
            </div>
          </div>

          <div class="result-core-stats">
            <div class="core-stat-item" style="opacity: 0;" data-animate="stat" data-delay="0">
              <span class="core-stat-label">存活时间</span>
              <strong class="core-stat-value" data-target="${result.runDurationSec}" data-format="duration">${this.formatDuration(result.runDurationSec)}</strong>
            </div>
            <div class="core-stat-item" style="opacity: 0;" data-animate="stat" data-delay="80">
              <span class="core-stat-label">击杀数</span>
              <strong class="core-stat-value" data-target="${result.battleWins}" data-format="number">0</strong>
            </div>
            <div class="core-stat-item" style="opacity: 0;" data-animate="stat" data-delay="160">
              <span class="core-stat-label">路子</span>
              <strong class="core-stat-value">${routeLabel}</strong>
              <small class="core-stat-sub">${buildStageLabel}</small>
            </div>
          </div>

          ${
            result.selectedUpgrades && result.selectedUpgrades.length > 0
              ? `
          <div class="result-upgrade-timeline">
            <div class="timeline-header">
              <span>这局一路拿了什么</span>
              <small>${result.selectedUpgrades.length} 张牌</small>
            </div>
            <div class="timeline-scroll">
              ${result.selectedUpgrades
                .map(
                  (upgrade) => `
                <div class="timeline-item" style="border-color: ${RARITY_COLOR_MAP[upgrade.rarity]};">
                  <div class="timeline-item-icon" style="background: ${RARITY_COLOR_MAP[upgrade.rarity]};">
                    ${(upgrade.rarityLabel ?? upgrade.rarity ?? '强化').charAt(0)}
                  </div>
                  <div class="timeline-item-content">
                    <strong>${upgrade.name}</strong>
                    ${upgrade.routeId ? `<small style="color: ${ROUTE_COLOR_MAP[upgrade.routeId]};">${ROUTE_NAME_MAP[upgrade.routeId]}</small>` : ''}
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
          `
              : ''
          }

          <div class="result-detail-stats">
            <div class="detail-stat" style="opacity: 0;" data-animate="stat" data-delay="240">
              <span>等级</span>
              <strong data-target="${result.levelReached}" data-format="level">Lv.1</strong>
            </div>
            <div class="detail-stat" style="opacity: 0;" data-animate="stat" data-delay="320">
              <span>节点</span>
              <strong data-target="${result.nodesCleared}" data-format="number">0</strong>
            </div>
            <div class="detail-stat" style="opacity: 0;" data-animate="stat" data-delay="400">
              <span>停在哪</span>
              <strong>${result.endingLabel}</strong>
            </div>
          </div>
        </div>
      </section>
    `;
    this.bindClick('[data-action="restart"]', actions.onRestart);
    this.bindClick('[data-action="menu"]', actions.onBackToMenu);
    this.bindClick('[data-action="details"]', () => this.showResultDetails(result));

    // Animate stats appearing and counting up
    this.animateResultStats();
  }

  private animateResultStats(): void {
    const statItems = this.screenLayer.querySelectorAll('[data-animate="stat"]');

    statItems.forEach((item) => {
      const delay = parseInt((item as HTMLElement).dataset.delay || '0', 10);

      setTimeout(() => {
        // Fade in the stat item
        (item as HTMLElement).style.transition = 'opacity 0.3s ease-out';
        (item as HTMLElement).style.opacity = '1';

        // Animate number counting
        const valueElement = item.querySelector('[data-target]') as HTMLElement;
        if (valueElement) {
          const target = parseInt(valueElement.dataset.target || '0', 10);
          const format = valueElement.dataset.format || 'number';

          if (format === 'number') {
            this.animateCounter(valueElement, 0, target, 400);
          } else if (format === 'level') {
            this.animateCounter(valueElement, 1, target, 400, (val) => `Lv.${val}`);
          } else if (format === 'duration') {
            // Duration already set, just highlight it
            valueElement.style.transition = 'color 0.2s ease-out';
            valueElement.style.color = '#4af';
            setTimeout(() => {
              valueElement.style.color = '';
            }, 300);
          }
        }
      }, delay);
    });
  }

  private animateCounter(
    element: HTMLElement,
    start: number,
    end: number,
    duration: number,
    formatter?: (val: number) => string
  ): void {
    const startTime = performance.now();
    const range = end - start;

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + range * eased);

      element.textContent = formatter ? formatter(current) : String(current);

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = formatter ? formatter(end) : String(end);
      }
    };

    requestAnimationFrame(updateCounter);
  }

  private showResultDetails(result: RunResult): void {
    this.hideScreen();
    this.panelLayer.className = 'panel-layer panel-layer-center';
    this.panelLayer.classList.remove('hidden');

    const routeLabel = this.getRouteDisplayLabel(result.routeId);
    const eventHistory = result.eventHistory ?? [];
    const anomalyHistory = eventHistory.filter((record) => record.anomalyClass);
    const anomalyRoleCounts = this.getAnomalyRoleCounts(eventHistory);
    const turnRecord = this.getResultAnomalyTurnRecord(result);

    // 本局选择记录
    const upgradeTimeline = result.selectedUpgrades && result.selectedUpgrades.length > 0
      ? result.selectedUpgrades.map((upgrade, index) => `
          <div class="detail-timeline-item">
            <div class="detail-timeline-marker" style="background: ${RARITY_COLOR_MAP[upgrade.rarity]};">
              ${index + 1}
            </div>
            <div class="detail-timeline-content">
              <strong>${upgrade.name}</strong>
              ${upgrade.routeId ? `<small style="color: ${ROUTE_COLOR_MAP[upgrade.routeId]};">${ROUTE_NAME_MAP[upgrade.routeId]}</small>` : '<small>通用</small>'}
            </div>
          </div>
        `).join('')
      : '<p style="text-align: center; color: rgba(255,255,255,0.5);">这局没拿到强化</p>';

    const anomalyTimeline = anomalyHistory.length > 0
      ? anomalyHistory.map((record, index) => `
          <div class="detail-timeline-item is-anomaly">
            <div class="detail-timeline-marker" style="background: ${this.getAnomalyRoleColor(record.anomalyRole)};">
              ${record.nodeIndex ?? index + 1}
            </div>
            <div class="detail-timeline-content">
              <strong>${record.eventName ?? record.eventId}</strong>
              <small>${record.optionLabel ?? record.optionId}${record.nodeIndex ? ` · 第 ${record.nodeIndex} 节点` : ''}</small>
              <div class="detail-timeline-tags">
                ${record === turnRecord ? '<span class="choice-effect-tag is-route-turn">转折点</span>' : ''}
                ${record.anomalyRole ? `<span class="choice-effect-tag is-anomaly-role">${this.getAnomalyRoleLabel(record.anomalyRole)}</span>` : ''}
                ${record.routeId ? `<span class="choice-effect-tag">${ROUTE_NAME_MAP[record.routeId]}</span>` : ''}
                ${record.anomalyClass ? `<span class="choice-effect-tag">${this.getEventClassLabel({ anomalyClass: record.anomalyClass } as EventDefinition)}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('')
      : '<p style="text-align: center; color: rgba(255,255,255,0.5);">这局没有特别明显的转折</p>';

    this.panelLayer.innerHTML = `
      <section class="floating-panel dock-panel commercial-choice-panel panel-result-details">
        <div class="tray-header">
          <div class="tray-title-group">
            <span class="panel-eyebrow">这一局</span>
            <h2 class="panel-title">怎么打到这里的</h2>
          </div>
        </div>

        <div class="result-details-content">
          <div class="result-details-section">
            <h3 class="detail-section-title">${result.outcome === 'victory' ? '最后收在哪' : '最后断在哪'}</h3>
            <div class="detail-summary-stack">
              <div class="detail-summary-card detail-summary-card-focus">
                <strong>${result.summary}</strong>
                <small>${this.getResultRouteRecap(result)}</small>
              </div>
              <div class="detail-summary-card is-muted">
                <strong>${result.buildSummary}</strong>
                <small>${result.replayPrompt}</small>
              </div>
            </div>
          </div>

          <div class="result-details-section">
            <h3 class="detail-section-title">转折点</h3>
            <div class="detail-anomaly-strip">
              <span><small>先打顺</small><strong>${anomalyRoleCounts.direction}</strong></span>
              <span><small>火力更重</small><strong>${anomalyRoleCounts.core}</strong></span>
              <span><small>直接压上</small><strong>${anomalyRoleCounts.transform}</strong></span>
              <span><small>补最后一下</small><strong>${anomalyRoleCounts.finisher}</strong></span>
            </div>
            <div class="detail-timeline-scroll">
              ${anomalyTimeline}
            </div>
          </div>

          <div class="result-details-section">
            <h3 class="detail-section-title">一路拿过什么</h3>
            <div class="detail-timeline-scroll">
              ${upgradeTimeline}
            </div>
          </div>

          <div class="result-details-section">
            <h3 class="detail-section-title">📈 这局最后长什么样</h3>
            <div class="detail-stats-grid">
              <div class="detail-stat-card">
                <span>存活时间</span>
                <strong>${this.formatDuration(result.runDurationSec)}</strong>
              </div>
              <div class="detail-stat-card">
                <span>击杀数</span>
                <strong>${result.battleWins}</strong>
              </div>
              <div class="detail-stat-card">
                <span>等级</span>
                <strong>Lv.${result.levelReached}</strong>
              </div>
              <div class="detail-stat-card">
                <span>路子</span>
                <strong>${routeLabel}</strong>
              </div>
              <div class="detail-stat-card">
                <span>节点</span>
                <strong>${result.nodesCleared}</strong>
              </div>
              <div class="detail-stat-card">
                <span>拿牌数</span>
                <strong>${result.selectedUpgrades?.length ?? 0}</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="result-details-actions">
          <button class="text-action text-action-primary" data-action="close">
            <span>先看到这</span>
            <small>回到上一屏</small>
          </button>
        </div>
      </section>
    `;

    this.bindClick('[data-action="close"]', () => {
      this.hidePanel();
      this.screenLayer.classList.remove('hidden');
    });
  }

  public pushToast(message: string, tone: ToastTone = 'neutral'): void {
    const toast = document.createElement('div');
    toast.className = `toast tone-${tone}`;
    toast.innerHTML = `
      <span class="toast-badge">${TOAST_BADGES[tone]}</span>
      <span class="toast-text">${message}</span>
    `;
    this.toastLayer.appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
    }, 2200);
  }

  public hidePanel(): void {
    this.panelLayer.className = 'panel-layer';
    this.panelLayer.classList.add('hidden');
    this.panelLayer.innerHTML = '';
    this.hideTooltip();
  }

  public hideHud(): void {
    this.hudLayer.classList.add('hidden');
    this.hudLayer.innerHTML = '';
  }

  public hideScreen(): void {
    this.screenLayer.classList.add('hidden');
  }

  public clearToasts(): void {
    this.toastLayer.innerHTML = '';
  }

  private showPanel(config: {
    panelClassName: string;
    panelLayerClassName?: string;
    modeLabel: string;
    modeHint?: string;
    eyebrow?: string;
    title: string;
    contextHtml?: string;
    items: string[];
    progress?: PanelProgress;
    alertText?: string;
  }): void {
    this.screenLayer.classList.add('hidden');
    this.panelLayer.className = `panel-layer ${config.panelLayerClassName ?? ''}`.trim();
    this.panelLayer.classList.remove('hidden');
    const itemCountClass =
      config.items.length === 1 ? 'is-single-choice' : config.items.length === 2 ? 'is-two-choice' : '';
    this.panelLayer.innerHTML = `
      <section class="floating-panel dock-panel commercial-choice-panel ${config.panelClassName}">
        ${config.alertText ? `<div class="panel-alert">${config.alertText}</div>` : ''}
        <div class="tray-header">
          <div class="tray-title-group">
            ${config.eyebrow ? `<span class="panel-eyebrow">${config.eyebrow}</span>` : ''}
            <h2 class="panel-title">${config.title}</h2>
          </div>
        </div>
        ${config.contextHtml ?? ''}
        <div class="choice-grid choice-grid-tray ${itemCountClass}">${config.items.join('')}</div>
      </section>
    `;
  }

  private renderRouteChoiceContext(phaseLabel: string, optionCount: number, progress: PanelProgress): string {
    const stageLabel = this.getCompactProgressLabel(progress.progressLabel);

    return `
      <aside class="choice-context choice-context-route" aria-label="下一站怎么选">
        <div class="route-context-copy">
          <span>先看这段</span>
          <strong>${stageLabel}</strong>
          <small>${phaseLabel || '下一站走哪条'}</small>
        </div>
        <div class="route-context-copy route-context-rule">
          <span>这一轮怎么选</span>
          <strong>${optionCount} 条路里挑 1 条</strong>
          <small>先看节点名，再看进去会碰上什么。</small>
        </div>
      </aside>
    `;
  }

  private renderProgressBar(phaseTrack: Array<{ label: string; state: string }>): string {
    const nodeIcons: Record<string, string> = {
      'done': '●',
      'active': '◉',
      'upcoming': '○',
      'boss-upcoming': '◈',
      'boss-active': '◆',
    };

    const nodeColors: Record<string, string> = {
      'done': '#4a5568',
      'active': '#4af',
      'upcoming': '#2d3748',
      'boss-upcoming': '#ff6b6b',
      'boss-active': '#ff4444',
    };

    const modernNodes = phaseTrack
      .map((phase) => {
        const iconMap: Record<string, string> = {
          done: '●',
          active: '●',
          upcoming: '○',
          'boss-upcoming': '◇',
          'boss-active': '◆',
        };
        const icon = iconMap[phase.state] ?? '●';
        const color = nodeColors[phase.state] || '#2d3748';
        const isBoss = phase.state.includes('boss');
        const isActive = phase.state === 'active' || phase.state === 'boss-active';
        const isDone = phase.state === 'done';

        return `
          <div class="progress-node ${phase.state} ${isActive ? 'is-active' : ''}" style="color: ${color};">
            <span class="progress-node-icon ${isBoss ? 'is-boss' : ''}">${icon}</span>
            <span class="progress-node-label ${isDone ? 'is-done' : ''}">${phase.label}</span>
          </div>
        `;
      })
      .join('');

    return `
      <div class="route-progress-bar" aria-label="关卡进度">
        <div class="progress-track">
          ${modernNodes}
        </div>
      </div>
    `;

    const nodes = phaseTrack.map((phase, index) => {
      const icon = nodeIcons[phase.state] || '○';
      const color = nodeColors[phase.state] || '#2d3748';
      const isBoss = phase.state.includes('boss');
      const isActive = phase.state === 'active' || phase.state === 'boss-active';

      return `
        <div class="progress-node ${phase.state} ${isActive ? 'is-active' : ''}"
             style="color: ${color};"
             title="${phase.label}">
          <span class="progress-node-icon ${isBoss ? 'is-boss' : ''}">${icon}</span>
          ${isActive ? `<span class="progress-node-label">${phase.label}</span>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="route-progress-bar" aria-label="关卡进度">
        <div class="progress-track">
          ${nodes}
        </div>
      </div>
    `;
  }

  private renderUpgradeChoiceContext(progress: PanelProgress): string {
    const stats = progress.statSummary.slice(0, 6);
    const statItems = stats
      .map((stat) => `<span class="upgrade-stat-item tone-${stat.tone}"><small>${stat.label}</small><strong>${stat.value}</strong></span>`)
      .join('');
    return `
      <aside class="choice-context choice-context-upgrade" aria-label="机体现在这样">
        <div class="upgrade-context-head">
          <span>机体现在这样</span>
          <strong>${progress.levelText}</strong>
        </div>
        <div class="upgrade-context-route">
          <small>这把现在</small>
          <strong>${progress.routeStatusText}</strong>
        </div>
        <div class="upgrade-stat-grid">${statItems}</div>
      </aside>
    `;
  }

  private renderAnomalyChoiceContext(eventDef: EventDefinition, progress: PanelProgress): string {
    const roleSummary = this.getAnomalyRoleSummary(eventDef);
    return `
      <aside class="choice-context choice-context-anomaly" aria-label="异常风险摘要">
        <span class="anomaly-warning-label">局面要变了</span>
        <strong>${eventDef.name}</strong>
        <p>${eventDef.description}</p>
        <div class="anomaly-risk-grid">
          <span><small>拿了会变成</small><b>${this.getEventClassLabel(eventDef)}</b></span>
          <span><small>现在打到</small><b>${progress.progressLabel}</b></span>
        </div>
        <div class="anomaly-warning-strip">拿了就别回头，这把会换走法。</div>
        ${roleSummary ? `<div class="choice-strip-event-meta">${roleSummary}</div>` : ''}
      </aside>
    `;
  }

  private renderNodeChoiceCard(node: NodeOption): string {
    const accent = NODE_TYPE_ACCENT_MAP[node.type];
    const detail = this.getNodeCardEntryLabel(node);

    return `
      <button class="choice-strip choice-strip-node" style="--choice-accent: ${accent}" data-choice="${node.id}">
        <div class="choice-node-top">
          <span class="choice-mode-badge choice-node-mode">${NODE_TYPE_LABEL_MAP[node.type]}</span>
          <span class="choice-node-step">这一站</span>
        </div>
        <div class="choice-strip-body choice-strip-body-node">
          <span class="choice-node-kicker">${detail}</span>
          <strong>${node.title}</strong>
          <small>${this.getNodeCardDescription(node)}</small>
        </div>
        <div class="choice-strip-foot choice-strip-foot-node">
          <span class="choice-node-enter">走这条</span>
        </div>
      </button>
    `;
  }

  private renderUpgradeChoiceCard(upgrade: UpgradeDefinition, progress: PanelProgress): string {
    const routeAccent = this.getRouteAccent(upgrade.routeId);
    const cardAccent = upgrade.routeId ? routeAccent : RARITY_COLOR_MAP[upgrade.rarity];
    const effectText = upgrade.routeId
      ? this.getRouteUpgradeReadableText(upgrade)
      : this.getChoiceEffectSummary(upgrade.effects, { maxSegments: 3 }) || upgrade.description;
    const cardTypeLabel = upgrade.routeId ? `${ROUTE_NAME_MAP[upgrade.routeId]}强化` : '强化';
    const cardBadgeLabel = upgrade.routeId ? `${ROUTE_NAME_MAP[upgrade.routeId]}路子` : upgrade.rarityLabel;
    const nameHtml = this.decorateTooltipTerms(upgrade.name);
    const effectTextHtml = this.decorateTooltipTerms(effectText);

    // 获取路线图标
    const routeIcon = upgrade.routeId
      ? (upgrade.routeId === 'crit' ? '🔴' : upgrade.routeId === 'pierce' ? '🔵' : '🟢')
      : '⚪';

    const rewardBadgeHtml = progress.upgradeRewardLabel
      ? `<span class="choice-reward-badge">${progress.upgradeRewardLabel}</span>`
      : '';

    return `
      <button
        class="choice-strip choice-strip-upgrade ${upgrade.routeId ? 'is-route-upgrade' : 'is-generic-upgrade'}"
        style="--choice-accent: ${routeAccent}; --rarity-accent: ${cardAccent}"
        data-choice="${upgrade.id}"
      >
        <div class="choice-strip-head">
          <span class="choice-type"><span class="choice-route-icon">${routeIcon}</span> ${cardTypeLabel}</span>
          <span class="choice-head-badges">${rewardBadgeHtml}<span class="choice-rarity">${cardBadgeLabel}</span></span>
        </div>
        <div class="choice-strip-body choice-strip-body-upgrade">
          <strong>${nameHtml}</strong>
          <p class="choice-main-copy">${effectTextHtml}</p>
        </div>
      </button>
    `;
  }

  private getRouteUpgradeReadableText(upgrade: UpgradeDefinition): string {
    // 路线牌在 buildUpgradeChoice 中已经通过 ROUTE_DESCRIPTION_OVERRIDES 设置了描述
    // 直接使用该描述，避免所有无 stats 的路线牌 fallback 到重复的默认描述
    if (upgrade.description) {
      return upgrade.description;
    }

    const modifiers = upgrade.effects
      ?.filter((effect): effect is Extract<ContentEffect, { type: 'stats' }> => effect.type === 'stats')
      .reduce<NonNullable<Extract<ContentEffect, { type: 'stats' }>['modifiers']>>(
        (merged, effect) => ({ ...merged, ...effect.modifiers }),
        {},
      );

    switch (upgrade.routeId) {
      case 'crit':
        if ((modifiers?.critChance ?? 0) > 0 && (modifiers?.critMultiplier ?? 0) > 0) {
          return '更容易打出暴击，暴击伤害也更高。';
        }
        if ((modifiers?.critChance ?? 0) > 0) {
          return '更容易打出暴击。';
        }
        if ((modifiers?.critMultiplier ?? 0) > 0) {
          return '暴击伤害更高。';
        }
        return '暴击命中造成更高伤害。';
      case 'pierce':
        {
          const pierceValue = modifiers?.pierce ?? 0;
          if (pierceValue > 0) {
            return `子弹多穿过 ${Math.round(pierceValue)} 个敌人。`;
          }
        }
        if ((modifiers?.projectileSpeed ?? 0) > 0) {
          return '子弹飞得更快。';
        }
        return '子弹可穿过敌人命中后排。';
      case 'dash':
        if ((modifiers?.dashInterval ?? 0) < 0) {
          return '自动脉冲间隔更短。';
        }
        if ((modifiers?.dashPulseDamage ?? 0) > 0) {
          return '自动脉冲伤害更高。';
        }
        if ((modifiers?.dashInvulnerability ?? 0) > 0) {
          return '自动脉冲后无敌时间更长。';
        }
        return '靠近敌人时自动释放近身脉冲。';
      default:
        return upgrade.description;
    }
  }

  private renderEventChoiceCard(
    eventDef: EventDefinition,
    option: EventDefinition['options'][number],
  ): string {
    const isAnomaly = eventDef.contentKind === 'anomaly';
    const routeAccent = this.getEventChoiceAccent(eventDef, option);
    const routeRef = this.getEventRouteReference(eventDef, option);
    const routeLabel = this.getEventRouteLabel(routeRef, eventDef);
    const prompt = isAnomaly ? '接' : '选';
    const anomalyClass = eventDef.contentKind === 'anomaly' ? ' is-anomaly-event' : '';
    const effectText = this.getEventOptionDescription(eventDef, option);
    const actionLabel = this.getEventChoiceActionLabel(eventDef, option);
    const detailTags = this.getEventChoiceTags(eventDef, option);
    const anomalyGain = isAnomaly ? this.getAnomalyGainLabel(option) : '';
    const anomalyCost = isAnomaly ? this.getAnomalyCostLabel(option) : '';
    const anomalyRoleLabel = isAnomaly ? this.getAnomalyRoleLabel(option.anomalyRole) : '';
    return `
      <button class="choice-strip choice-strip-event${anomalyClass}" style="--choice-accent: ${routeAccent}" data-choice="${option.id}">
        <div class="choice-strip-head">
          <span class="choice-type">${isAnomaly ? '异常机会' : '事件'}</span>
          ${isAnomaly ? `<span class="choice-mode-badge choice-event-class">${this.getEventClassLabel(eventDef)}</span>` : ''}
          ${anomalyRoleLabel ? `<span class="choice-mode-badge choice-event-role role-${option.anomalyRole}" style="--route-pill: ${routeAccent}">${anomalyRoleLabel}</span>` : ''}
          <span class="choice-mode-badge choice-event-route ${routeRef ? 'active' : ''}" style="--route-pill: ${routeAccent}">${routeLabel}</span>
        </div>
        ${
          isAnomaly
            ? `<div class="choice-anomaly-breakdown">
                <span><small>获得</small><strong>${anomalyGain}</strong></span>
                <span class="${anomalyCost.includes('-') || anomalyCost.includes('损失') ? 'is-cost' : ''}"><small>代价</small><strong>${anomalyCost}</strong></span>
              </div>`
            : ''
        }
        <div class="choice-strip-body choice-strip-body-event">
          <strong>${option.label}</strong>
          <small>${effectText}</small>
        </div>
        ${
          detailTags.length > 0
            ? `<div class="choice-strip-event-meta">${detailTags
                .map((tag) => `<span class="choice-effect-tag">${tag}</span>`)
                .join('')}</div>`
            : ''
        }
        <div class="choice-strip-foot">
          <span class="choice-route-boost ${routeRef ? 'active' : ''}" style="--route-pill: ${routeAccent}">${actionLabel}</span>
          <div class="choice-foot-trail">
            <span class="choice-side-label">${prompt}</span>
            <span class="choice-prompt">就这个</span>
          </div>
        </div>
      </button>
    `;
  }

  private getAnomalyGainLabel(option: EventDefinition['options'][number]): string {
    if (option.gainLabel) {
      return option.gainLabel;
    }
    const positiveEffects = option.effects?.filter((effect) => effect.type !== 'heal' || effect.amount > 0) ?? [];
    return this.getChoiceEffectSummary(positiveEffects, { maxSegments: 2 }) || option.description;
  }

  private getAnomalyCostLabel(option: EventDefinition['options'][number]): string {
    if (option.costLabel) {
      return option.costLabel;
    }
    const costs: string[] = [];
    for (const effect of option.effects ?? []) {
      if (effect.type === 'heal' && effect.amount < 0) {
        costs.push(`耐久 ${effect.amount}`);
      }
      if (effect.type === 'stats') {
        for (const [key, value] of Object.entries(effect.modifiers)) {
          if (typeof value === 'number' && value < 0) {
            costs.push(`${this.getStatLabel(key)} ${this.formatStatModifierValue(key, value)}`);
          }
        }
      }
    }
    return costs.slice(0, 2).join(' / ') || '无直接损失';
  }

  private getStatLabel(statKey: string): string {
    const labelMap: Record<string, string> = {
      damage: '伤害',
      fireRate: '射速',
      projectileSpeed: '弹速',
      critChance: '暴击率',
      critMultiplier: '暴伤',
      pierce: '穿透',
      multishot: '多重',
      maxHp: '生命上限',
      moveSpeed: '移速',
      dashInterval: '穿梭冷却',
      dashPulseDamage: '穿梭脉冲',
      dashInvulnerability: '无敌窗',
      regeneration: '再生',
    };
    return labelMap[statKey] ?? statKey;
  }

  private formatStatModifierValue(statKey: string, value: number): string {
    const sign = value > 0 ? '+' : '';
    switch (statKey) {
      case 'critChance':
      case 'critMultiplier':
        return `${sign}${Math.round(value * 100)}%`;
      case 'dashInterval':
        return `${sign}${value.toFixed(2)}秒`;
      case 'dashInvulnerability':
        return `${sign}${value.toFixed(2)}秒`;
      case 'regeneration':
        return `${sign}${value.toFixed(1)}/秒`;
      case 'fireRate':
        return `${sign}${value.toFixed(1)}/秒`;
      default:
        return `${sign}${Math.round(value)}`;
    }
  }

  private getNodeCardDescription(node: NodeOption): string {
    if (node.type === 'battle') {
      const template = node.templateId ? BATTLE_TEMPLATES[node.templateId] : null;
      const winType = template?.winCondition.type;
      if (winType === 'elite') {
        return node.description || '击败精英本体过关';
      }
      if (winType === 'survive') {
        return node.description || '坚持到结束';
      }
      if (winType === 'kills') {
        return node.description || `击败 ${template?.winCondition.target ?? '目标'} 个敌人`;
      }
      return node.description;
    }
    if (node.type === 'upgrade') {
      return node.isFinalPrep ? '拿完直接进 Boss' : '先补一项强化再继续';
    }
    if (node.type === 'anomaly') {
      return '接一次突然变招';
    }
    if (node.type === 'boss') {
      return '马上进入首领战';
    }
    return '继续前进';
  }

  private getNodeCardEntryLabel(node: NodeOption): string {
    if (node.type === 'battle') {
      return getBattleEncounterLabel(node.templateId ?? 'elimination');
    }
    if (node.type === 'upgrade') {
      return node.isFinalPrep ? '最后整备' : '补一手强化';
    }
    if (node.type === 'anomaly') {
      return '异常机会';
    }
    return '首领战';
  }

  private getAnomalyRoleLabel(role?: AnomalyRoleId): string {
    switch (role) {
      case 'direction':
        return '先打顺';
      case 'core':
        return '火力更重';
      case 'transform':
        return '直接压上';
      case 'finisher':
        return '补最后一下';
      default:
        return '';
    }
  }

  private getAnomalyRoleActionLabel(role?: AnomalyRoleId): string {
    switch (role) {
      case 'direction':
        return '先打顺';
      case 'core':
        return '把火力提上来';
      case 'transform':
        return '直接压上';
      case 'finisher':
        return '补最后一下';
      default:
        return '';
    }
  }

  private getAnomalyRoleColor(role?: AnomalyRoleId): string {
    switch (role) {
      case 'direction':
        return '#7fd9ff';
      case 'core':
        return '#ffcc74';
      case 'transform':
        return '#ff8f70';
      case 'finisher':
        return '#9cff97';
      default:
        return '#a773ff';
    }
  }

  private getEventRouteLabel(routeId: RouteReference | undefined, eventDef: EventDefinition): string {
    if (!routeId || routeId === 'dominant') {
      if (eventDef.contentKind !== 'anomaly') {
        return '当前这步';
      }
      switch (eventDef.anomalyClass) {
        case 'hybrid':
          return '两边都沾上';
        case 'bossEcho':
          return '先摸最后那下';
        case 'distortion':
          return '场面会变';
        default:
          return '这把路子';
      }
    }
    return ROUTE_NAME_MAP[routeId];
  }

  private getEventOptionDescription(eventDef: EventDefinition, option: EventDefinition['options'][number]): string {
    if (eventDef.contentKind === 'anomaly') {
      return option.gameplayLabel ? `${option.gameplayLabel}：${option.description}` : option.description;
    }

    const summary = this.getChoiceEffectSummary(option.effects, {
      maxSegments: 2,
    });
    return summary || option.description;
  }

  private getChoiceEffectSummary(
    effects?: UpgradeDefinition['effects'] | EventDefinition['options'][number]['effects'],
    options?: {
      includeRoute?: boolean;
      maxSegments?: number;
    },
  ): string {
    if (!effects || effects.length === 0) {
      return '';
    }

    const segments: string[] = [];
    const maxSegments = options?.maxSegments ?? 2;
    const statsEffect = effects.find((effect): effect is Extract<ContentEffect, { type: 'stats' }> => effect.type === 'stats');
    if (statsEffect) {
      segments.push(
        ...describeContentEffects([
          {
            type: 'stats',
            modifiers: {
              ...statsEffect.modifiers,
            },
          },
        ]).split('，'),
      );
    }

    const healEffect = effects.find((effect): effect is Extract<ContentEffect, { type: 'heal' }> => effect.type === 'heal');
    if (healEffect) {
      segments.push(
        describeContentEffects([
          {
            type: 'heal',
            amount: healEffect.amount,
          },
        ]),
      );
    }

    if (options?.includeRoute) {
      const routeSummary = this.getRouteEffectSummary(effects);
      if (routeSummary) {
        segments.push(routeSummary);
      }
    }

    return segments.filter(Boolean).slice(0, maxSegments).join('，');
  }

  private getRouteAccent(routeId?: UpgradeDefinition['routeId'] | EventDefinition['options'][number]['routeId']): string {
    if (!routeId || routeId === 'dominant') {
      return '#76bfe7';
    }
    return ROUTE_COLOR_MAP[routeId];
  }

  private getEventChoiceAccent(eventDef: EventDefinition, option: EventDefinition['options'][number]): string {
    const routeRef = this.getEventRouteReference(eventDef, option);
    if (routeRef && routeRef !== 'dominant') {
      return this.getRouteAccent(routeRef);
    }

    if (eventDef.contentKind !== 'anomaly') {
      return '#76bfe7';
    }

    switch (eventDef.anomalyClass) {
      case 'hybrid':
        return '#ffbd72';
      case 'bossEcho':
        return '#ff8f69';
      case 'distortion':
        return '#bb8aff';
      default:
        return '#76bfe7';
    }
  }

  private getEventRouteReference(
    eventDef: EventDefinition,
    option: EventDefinition['options'][number],
  ): RouteReference | undefined {
    if (option.routeId) {
      return option.routeId;
    }

    const firstRouteEffect = option.effects?.find(
      (effect): effect is Extract<ContentEffect, { type: 'route' }> => effect.type === 'route',
    );
    if (firstRouteEffect) {
      return firstRouteEffect.routeId;
    }

    if (eventDef.contentKind !== 'anomaly') {
      return undefined;
    }

    if (eventDef.routeAffinity) {
      return eventDef.routeAffinity;
    }

    if (eventDef.anomalyClass === 'hybrid' || eventDef.anomalyClass === 'bossEcho') {
      return 'dominant';
    }

    return undefined;
  }

  private getRouteEffectSummary(
    effects: UpgradeDefinition['effects'] | EventDefinition['options'][number]['effects'],
  ): string {
    const routeCounts = new Map<RouteReference, number>();
    for (const effect of effects ?? []) {
      if (effect.type !== 'route') {
        continue;
      }
      routeCounts.set(effect.routeId, (routeCounts.get(effect.routeId) ?? 0) + 1);
    }

    const entries = Array.from(routeCounts.entries());
    if (entries.length === 0) {
      return '';
    }

    return entries
      .map(([routeId, count]) => `${routeId === 'dominant' ? '这把路子' : `${ROUTE_NAME_MAP[routeId]}`} +${count}`)
      .join(' / ');
  }

  private getEffectFocusLabel(effects?: UpgradeDefinition['effects'] | EventDefinition['options'][number]['effects']): string {
    const statsEffect = effects?.find((effect): effect is Extract<ContentEffect, { type: 'stats' }> => effect.type === 'stats');
    if (statsEffect) {
      const [primaryKey] = Object.keys(statsEffect.modifiers);
      if (primaryKey) {
        return this.getStatFocusLabel(primaryKey);
      }
    }

    const healEffect = effects?.find((effect): effect is Extract<ContentEffect, { type: 'heal' }> => effect.type === 'heal');
    if (healEffect) {
      return healEffect.amount >= 0 ? '续航' : '承压';
    }

    return '效果';
  }

  private getStatFocusLabel(statKey: string): string {
    const labelMap: Record<string, string> = {
      maxHp: '耐久',
      damage: '伤害',
      fireRate: '射速',
      projectileSpeed: '弹速',
      critChance: '暴击',
      critMultiplier: '爆伤',
      pierce: '穿透',
      multishot: '扩面',
      moveSpeed: '移速',
      dashInterval: '穿梭',
      dashPulseDamage: '脉冲',
      dashInvulnerability: '无伤',
      regeneration: '回复',
    };
    return labelMap[statKey] ?? '强化';
  }

  private renderTooltipTerm(label: string, tooltip: string): string {
    if (!tooltip) {
      return this.escapeHtml(label);
    }
    const safeTooltip = this.escapeHtml(tooltip);
    const safeLabel = this.escapeHtml(label);
    return `<span class="choice-tooltip-term" tabindex="0" data-tooltip="${safeTooltip}">${safeLabel}</span>`;
  }

  private decorateTooltipTerms(text: string): string {
    const tooltipTerms: Array<[string, string]> = [
      ['穿梭冷却', this.getFocusTooltip('穿梭')],
      ['无敌时间', this.getFocusTooltip('无伤')],
      ['脉冲伤害', this.getFocusTooltip('脉冲')],
      ['暴击率', this.getFocusTooltip('暴击')],
      ['暴击伤害', this.getFocusTooltip('爆伤')],
      ['暴击', this.getFocusTooltip('暴击')],
      ['爆伤', this.getFocusTooltip('爆伤')],
      ['穿透', this.getFocusTooltip('穿透')],
      ['穿梭', this.getFocusTooltip('穿梭')],
      ['脉冲', this.getFocusTooltip('脉冲')],
      ['无伤', this.getFocusTooltip('无伤')],
      ['射速', this.getFocusTooltip('射速')],
    ];
    const pieces: string[] = [];
    let cursor = 0;

    while (cursor < text.length) {
      const match = tooltipTerms.find(([term]) => text.startsWith(term, cursor));
      if (match) {
        pieces.push(this.renderTooltipTerm(match[0], match[1]));
        cursor += match[0].length;
      } else {
        pieces.push(this.escapeHtml(text[cursor]));
        cursor += 1;
      }
    }

    return pieces.join('');
  }

  private getRouteTooltip(routeId?: RouteReference): string {
    switch (routeId) {
      case 'crit':
        return '暴击：更容易连续打出重击。';
      case 'pierce':
        return '穿透：子弹穿过去后还能继续带到后排。';
      case 'dash':
        return '穿梭：贴身一闪，顺手扫一圈。';
      default:
        return '';
    }
  }

  private getFocusTooltip(label: string): string {
    const tooltipMap: Record<string, string> = {
      暴击: '命中时更容易打出高伤。',
      爆伤: '暴击时打得更狠。',
      穿透: '子弹穿过去后还能继续飞。',
      穿梭: '自动闪一下，顺手打一圈。',
      脉冲: '穿梭触发的范围伤害。',
      无伤: '穿梭后的短暂无敌。',
      扩面: '同时发射更多子弹。',
      射速: '开火更快。',
    };
    return tooltipMap[label] ?? '';
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
  }

  private getEventClassLabel(eventDef: EventDefinition): string {
    switch (eventDef.anomalyClass) {
      case 'routeWindow':
        return '走法会变';
      case 'hybrid':
        return '两边都能接上';
      case 'bossEcho':
        return '先摸最后那下';
      case 'distortion':
        return '场面会变';
      default:
        return '异常';
    }
  }

  private getEventChoiceActionLabel(eventDef: EventDefinition, option: EventDefinition['options'][number]): string {
    if (eventDef.contentKind !== 'anomaly') {
      return '选这个';
    }

    const anomalyRoleLabel = this.getAnomalyRoleActionLabel(option.anomalyRole);
    const routeRef = this.getEventRouteReference(eventDef, option);
    const routeSummary = this.getRouteEffectSummary(option.effects);
    if (eventDef.anomalyClass === 'routeWindow') {
      if (anomalyRoleLabel) {
        return anomalyRoleLabel;
      }
      if (routeRef && eventDef.routeAffinity && routeRef !== eventDef.routeAffinity) {
        return '改走这边';
      }
      return routeSummary ? '顺着打下去' : '先稳一下';
    }

    if (eventDef.anomalyClass === 'hybrid') {
      return '两边一起拿';
    }

    if (eventDef.anomalyClass === 'bossEcho') {
        return '先摸那一下';
    }

    const hasPressure = option.effects?.some((effect) => effect.type === 'heal' && effect.amount < 0);
    return hasPressure ? '顶着拿' : '就接这个';
  }

  private getEventChoiceTags(eventDef: EventDefinition, option: EventDefinition['options'][number]): string[] {
    const tags: string[] = [];
    const focusLabel = this.getEffectFocusLabel(option.effects);
    if (focusLabel) {
      tags.push(focusLabel);
    }

    const anomalyRoleLabel = this.getAnomalyRoleLabel(option.anomalyRole);
    if (anomalyRoleLabel) {
      tags.push(anomalyRoleLabel);
    }

    const routeSummary = this.getRouteEffectSummary(option.effects);
    if (routeSummary) {
      tags.push(routeSummary);
    } else if (eventDef.contentKind === 'anomaly' && eventDef.anomalyClass === 'hybrid') {
      tags.push('这把路子');
    }

    const healEffect = option.effects?.find((effect): effect is Extract<ContentEffect, { type: 'heal' }> => effect.type === 'heal');
    if (healEffect) {
      tags.push(healEffect.amount < 0 ? '承压' : '留余量');
    }

    return tags.slice(0, 2);
  }

  private getAnomalyRoleSummary(eventDef: EventDefinition): string {
    if (eventDef.contentKind !== 'anomaly') {
      return '';
    }

    const order: AnomalyRoleId[] = ['direction', 'core', 'transform', 'finisher'];
    return order
      .filter((role) => eventDef.options.some((option) => option.anomalyRole === role))
      .map((role) => `<span class="choice-effect-tag is-anomaly-role">${this.getAnomalyRoleLabel(role)}</span>`)
      .join('');
  }

  private getAnomalyRoleCounts(records: RunResult['eventHistory']): Record<AnomalyRoleId, number> {
    const counts: Record<AnomalyRoleId, number> = {
      direction: 0,
      core: 0,
      transform: 0,
      finisher: 0,
    };

    for (const record of records) {
      if (record.anomalyRole) {
        counts[record.anomalyRole] += 1;
      }
    }

    return counts;
  }

  private getResultRouteRecap(result: RunResult): string {
    if (!result.routeId) {
      return '这把一直没能把路数接顺。';
    }

    const turnRecord = this.getResultAnomalyTurnRecord(result);
    const chronology = this.getResultAnomalyChronology(result, turnRecord);
    return chronology || '这局没有特别明显的转折点。';
  }

  private getResultAnomalyChronology(
    result: RunResult,
    turnRecord?: NonNullable<RunResult['eventHistory']>[number] | null,
  ): string {
    const routeId = result.routeId;
    if (!routeId) {
      return '';
    }

    const anomalyHistory = (result.eventHistory ?? []).filter((record) => {
      if (!record.anomalyClass) {
        return false;
      }
      const activeRouteId = record.routeId ?? routeId;
      return activeRouteId === routeId;
    });
    if (anomalyHistory.length === 0) {
      return '';
    }

    const primaryRecord = turnRecord ?? this.getResultAnomalyTurnRecord(result);
    const keyRecords: NonNullable<RunResult['eventHistory']>[number][] = [];
    const addRecord = (record?: NonNullable<RunResult['eventHistory']>[number] | null) => {
      if (record && !keyRecords.includes(record)) {
        keyRecords.push(record);
      }
    };

    addRecord(anomalyHistory[0]);
    addRecord(primaryRecord);
    addRecord(anomalyHistory[anomalyHistory.length - 1]);

    return keyRecords
      .map((record, index) => {
        const nodeIndex = record.nodeIndex ?? index + 1;
        const turnPointLabel = record === primaryRecord ? '（转折点）' : '';
        return `第 ${nodeIndex} 节点${turnPointLabel}${this.describeResultAnomalyPush(routeId, record, result.buildStage, result.outcome)}`;
      })
      .join('；');
  }

  private getResultAnomalyTurnRecord(
    result: RunResult,
  ): NonNullable<RunResult['eventHistory']>[number] | null {
    if (!result.routeId) {
      return null;
    }

    const anomalyHistory = (result.eventHistory ?? []).filter((record) => {
      if (!record.anomalyClass) {
        return false;
      }
      const activeRouteId = record.routeId ?? result.routeId;
      return activeRouteId === result.routeId;
    });
    if (anomalyHistory.length === 0) {
      return null;
    }

    const roleRank = (record: NonNullable<RunResult['eventHistory']>[number]): number => {
      if (record.anomalyClass === 'bossEcho') {
        return 5;
      }
      if (record.anomalyClass === 'hybrid') {
        return 4;
      }

      switch (record.anomalyRole) {
        case 'finisher':
          return 4;
        case 'transform':
          return 3;
        case 'core':
          return 2;
        case 'direction':
          return 1;
        default:
          return 0;
      }
    };

    return [...anomalyHistory].sort((left, right) => {
      const roleDiff = roleRank(right) - roleRank(left);
      if (roleDiff !== 0) {
        return roleDiff;
      }
      const leftIndex = left.nodeIndex ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = right.nodeIndex ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    })[0] ?? null;
  }

  private describeResultAnomalyPush(
    routeId: NonNullable<RunResult['routeId']>,
    record: NonNullable<RunResult['eventHistory']>[number],
    buildStage: RunResult['buildStage'],
    outcome: RunResult['outcome'],
  ): string {
    const routeName = ROUTE_NAME_MAP[routeId];
    if (record.anomalyClass === 'bossEcho') {
      return `${routeName}提前摸到补最后一下，但还没完全接住`;
    }

    if (record.anomalyClass === 'hybrid') {
      return `${routeName}在这里拐顺了，整条线顺了不少`;
    }

    switch (record.anomalyRole ?? 'direction') {
      case 'direction':
        return routeId === 'pierce'
          ? `这一手先把${routeName}的前排打穿了`
          : routeId === 'dash'
            ? `这一手先把${routeName}的贴身节奏拉起来了`
            : `这一手先把${routeName}打顺了`;
      case 'core':
        return routeId === 'pierce'
          ? `这一手让${routeName}穿前排更稳，后排也开始掉血`
          : routeId === 'dash'
            ? `这一手让${routeName}贴身后更容易补回打`
            : `这一手让${routeName}连打更疼了`;
      case 'transform':
        return routeId === 'crit'
          ? `这一手把${routeName}直接打成连爆`
          : routeId === 'pierce'
            ? `这一手让${routeName}直接打到后排`
            : `这一手让${routeName}直接变成贴身收人`;
      case 'finisher':
        return `这一手把${routeName}最后那下补上了`;
      default:
        break;
    }

    if (outcome !== 'victory') {
      if (routeId === 'pierce') {
        if (buildStage === 'matured') {
          return `${routeName}已经打到后排了，但最后那波没收住`;
        }
        if (buildStage === 'committed') {
          return `${routeName}已经打散前排了，但还没把后排带走`;
        }
        if (buildStage === 'hinted') {
          return `${routeName}已经往这条路上靠了，但前排还没打开`;
        }
      }
      if (buildStage === 'matured' || buildStage === 'committed') {
        return `${routeName}已经拿到关键火力了，但最后那波没打出来`;
      }
    }

    return `${routeName}又往前走了一步`;
  }

  private getResultFailureReason(
    result: RunResult,
    turnRecord?: NonNullable<RunResult['eventHistory']>[number] | null,
  ): string {
    if (!result.routeId || result.outcome === 'victory') {
      return '';
    }

    const anomalyCounts = this.getAnomalyRoleCounts(result.eventHistory ?? []);
    const primaryRecord = turnRecord ?? this.getResultAnomalyTurnRecord(result);
    const turnNodeIndex = primaryRecord?.nodeIndex ?? (result.eventHistory ?? []).find((record) => record.anomalyClass)?.nodeIndex ?? 0;
    const isLateTurn = turnNodeIndex >= 5;
    const hasFinisherSupport =
      anomalyCounts.finisher > 0 ||
      (result.selectedUpgrades ?? []).some((upgrade) => upgrade.tags?.includes('finisher') || upgrade.tags?.includes('payoff'));

    if (result.routeId === 'pierce') {
      if (isLateTurn) {
        return '异常来得偏晚，前面那一下没把局面推开';
      }
      if (result.buildStage === 'matured') {
        return hasFinisherSupport ? '已经能穿到后排了，但还清不干净' : '已经能穿到后排了，但最后那下不够';
      }
      if (result.buildStage === 'committed') {
        return hasFinisherSupport ? '前排已经打散了，但火力还差一点' : '前排已经打散了，但还没穿到后排';
      }
      if (result.buildStage === 'hinted') {
        return '有方向了，但还没拆开前排';
      }
      return '这局还差最后一手';
    }

    if (isLateTurn) {
      return '异常来得偏晚，局面没来得及推起来';
    }
    if (result.buildStage === 'matured') {
      return '已经打顺了，但最后那波没扛住';
    }
    if (result.buildStage === 'committed') {
      return '已经连起来了，但伤害还差一点';
    }
    if (result.buildStage === 'hinted') {
      return '已经往这条路上靠了，但火力还没跟上';
    }
    return '这局还差最后一手';
  }

  private getRouteLayerLabel(routeId: NonNullable<RunResult['routeId']>, role?: AnomalyRoleId): string {
    if (!role) {
      return '';
    }

    const layerMap: Record<NonNullable<RunResult['routeId']>, Record<AnomalyRoleId, string>> = {
      crit: {
        direction: '先打顺',
        core: '火力更重',
        transform: '直接压上',
        finisher: '补最后一下',
      },
      pierce: {
        direction: '先打开路',
        core: '火力更重',
        transform: '直接压上',
        finisher: '补最后一下',
      },
      dash: {
        direction: '先贴上去',
        core: '火力更重',
        transform: '直接压上',
        finisher: '补最后一下',
      },
    };

    return layerMap[routeId][role];
  }

  private getRouteDisplayLabel(routeId: RunResult['routeId']): string {
    return routeId ? ROUTE_NAME_MAP[routeId] : '未成线';
  }

  private getRouteResultStageLabel(routeId: RunResult['routeId'], buildStage: RunResult['buildStage']): string {
    const genericStageMap: Record<RunResult['buildStage'], string> = {
      unformed: '还没打顺',
      hinted: '刚摸到感觉',
      committed: '开始压住了',
      matured: '已经打出来了',
    };
    if (!routeId) {
      return genericStageMap[buildStage];
    }

    const stageMap: Record<NonNullable<RunResult['routeId']>, Record<RunResult['buildStage'], string>> = {
      crit: {
        unformed: '还没打顺',
        hinted: '开始连上',
        committed: '火力压住了',
        matured: '一串串炸开',
      },
      pierce: {
        unformed: '还没打顺',
        hinted: '前排开始松动',
        committed: '火力压到后排',
        matured: '一路穿过去了',
      },
      dash: {
        unformed: '还没打顺',
        hinted: '开始贴上去',
        committed: '贴身能回打',
        matured: '贴身就能收人',
      },
    };

    return stageMap[routeId][buildStage];
  }

  private getMeterStateClass(ratio: number): string {
    if (ratio <= 0.35) {
      return 'is-danger';
    }
    if (ratio <= 0.68) {
      return 'is-warn';
    }
    return 'is-stable';
  }

  private getCompactProgressLabel(progressLabel: string): string {
    const match = progressLabel.match(/(\d+\s*\/\s*\d+)/);
    return match ? match[1].replace(/\s+/g, ' ') : progressLabel.replace(/^推进\s*/, '');
  }

  private getHudWaveLabel(progressLabel: string): string {
    const match = progressLabel.match(/(\d+)/);
    if (!match) {
      return progressLabel;
    }
    return `第${match[1]}波`;
  }

  private formatDuration(durationSec: number): string {
    const minutes = Math.floor(durationSec / 60);
    const seconds = Math.max(0, Math.floor(durationSec % 60));
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private bindClick(selector: string, handler: () => void): void {
    const targets = this.root.querySelectorAll<HTMLElement>(selector);
    const target = targets.length > 0 ? targets[targets.length - 1] : null;
    if (target) {
      target.onclick = handler;
    }
  }

  private handleTooltipEnter(event: Event): void {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('.choice-tooltip-term') : null;
    if (!target || !this.root.contains(target)) {
      return;
    }
    const tooltip = target.dataset.tooltip;
    if (!tooltip) {
      return;
    }
    this.activeTooltipTarget = target;
    this.tooltipLayer.textContent = tooltip;
    this.tooltipLayer.classList.add('visible');
    this.positionTooltip(target);
  }

  private handleTooltipLeave(event: Event): void {
    if (!this.activeTooltipTarget) {
      return;
    }
    const relatedTarget = event instanceof MouseEvent ? event.relatedTarget : null;
    if (relatedTarget instanceof Node && this.activeTooltipTarget.contains(relatedTarget)) {
      return;
    }
    this.hideTooltip();
  }

  private hideTooltip(): void {
    this.activeTooltipTarget = null;
    this.tooltipLayer.classList.remove('visible');
    this.tooltipLayer.textContent = '';
  }

  private positionTooltip(target: HTMLElement): void {
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = this.tooltipLayer.getBoundingClientRect();
    const viewportPadding = 14;
    const targetCenter = targetRect.left + targetRect.width * 0.5;
    const left = Math.min(
      window.innerWidth - tooltipRect.width - viewportPadding,
      Math.max(viewportPadding, targetCenter - tooltipRect.width * 0.5),
    );
    const belowTop = targetRect.bottom + 10;
    const top =
      belowTop + tooltipRect.height + viewportPadding <= window.innerHeight
        ? belowTop
        : Math.max(viewportPadding, targetRect.top - tooltipRect.height - 10);

    this.tooltipLayer.style.left = `${left}px`;
    this.tooltipLayer.style.top = `${top}px`;
  }
}
