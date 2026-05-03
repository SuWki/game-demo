import { getBattleEncounterLabel } from '../data/battleTemplates';
import { RARITY_COLOR_MAP } from '../data/balance';
import { ROUTE_COLOR_MAP, ROUTE_NAME_MAP } from '../data/routes';
import { describeContentEffects } from '../data/upgrades';
import type {
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
  'progressLabel' | 'progressDetail' | 'phaseTrack' | 'levelText' | 'routeStatusText' | 'statSummary'
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
  accent: '阶段',
  route: '路线',
  danger: '危险',
  success: '完成',
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
      <section class="screen-minimal menu-screen commercial-start-screen">
        <div class="screen-gridline" aria-hidden="true"></div>
        <div class="commercial-corner-label">01 START SCREEN</div>
        <div class="commercial-screen-layout">
          <div class="commercial-screen-copy">
            <p class="screen-kicker">AUTONOMOUS COMBAT DRONE PROGRAM</p>
            <h1 class="screen-title">PROJECT<br />ORBITAL</h1>
            <p class="screen-subtitle">节点推进 / 自动射击 / 模组构筑</p>
            <p class="screen-brief">移动躲弹，自动开火。<br />打倒敌人，拾取能量，撑到 Boss。</p>
            <div class="screen-meta-strip">
              <span>RUNS ${summary.totalRuns}</span>
              <span>WINS ${summary.wins}</span>
              <span>${summary.lastDurationSec > 0 ? `LAST ${this.formatDuration(summary.lastDurationSec)}` : 'NO RUN'}</span>
              <span>${summary.lastRouteName || 'NO ROUTE'}</span>
            </div>
            <div class="screen-actions commercial-screen-actions">
              <button class="text-action text-action-primary" data-action="start">
                <span>开始作战</span>
                <small>移动躲弹，自动开火</small>
              </button>
              <button class="text-action" data-action="export">
                <span>战斗记录</span>
                <small>查看本地记录</small>
              </button>
              <button class="text-action" data-action="volume">
                <span>音量</span>
                <small>调整背景与音效</small>
              </button>
            </div>
          </div>
          <div class="commercial-visual-anchor" aria-hidden="true">
            <span class="screen-ring ring-a"></span>
            <span class="screen-ring ring-b"></span>
            <span class="screen-ring ring-c"></span>
            <span class="commercial-core"></span>
            <span class="commercial-core-wing commercial-core-wing-a"></span>
            <span class="commercial-core-wing commercial-core-wing-b"></span>
            <span class="commercial-core-wing commercial-core-wing-c"></span>
            <span class="commercial-core-wing commercial-core-wing-d"></span>
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
            <span class="panel-eyebrow">RUN PAUSED</span>
            <h2 class="panel-title">暂停中</h2>
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
                <span class="screen-summary-label">路线</span>
                <strong>${snapshot.routeStatusText}</strong>
              </article>
              <article class="screen-summary-card">
                <span class="screen-summary-label">阶段</span>
                <strong>${snapshot.progressLabel}</strong>
              </article>
              <article class="screen-summary-card">
                <span class="screen-summary-label">目标</span>
                <strong>${snapshot.objectiveLabel}</strong>
              </article>
              <article class="screen-summary-card">
                <span class="screen-summary-label">进度</span>
                <strong>${snapshot.objectiveProgressText}</strong>
              </article>
            </div>
          </aside>
          <div class="pause-panel-actions">
            <button class="text-action text-action-primary" data-action="resume">
              <span>继续作战</span>
              <small>回到刚才那一拍</small>
            </button>
            <button class="text-action" data-action="restart">
              <span>重新开始</span>
              <small>重开当前流程</small>
            </button>
            <button class="text-action" data-action="menu">
              <span>返回主页面</span>
              <small>回到开始页</small>
            </button>
            <button class="text-action" data-action="volume">
              <span>音量</span>
              <small>打开音量调节</small>
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
    this.hudLayer.classList.remove('hidden');
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
        </section>
        <section class="game-hud-fixed__center">
          <span class="game-hud-fixed__wave">${this.getHudWaveLabel(snapshot.progressLabel)}</span>
          <span class="game-hud-fixed__mode">${snapshot.statusText}</span>
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
    this.showPanel({
      panelClassName: 'panel-node-choice panel-route-choice',
      panelLayerClassName: 'panel-layer-center',
      modeLabel: '路线选择',
      eyebrow: '下一站',
      title: '选择下一站',
      contextHtml: this.renderRouteChoiceContext(phaseLabel, options.length, progress),
      items: options.map((node) => this.renderNodeChoiceCard(node)),
      progress,
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
    const isFinalPrep = title.includes('最终整备');
    this.showPanel({
      panelClassName: 'panel-upgrade-choice',
      panelLayerClassName: 'panel-layer-center',
      modeLabel: isFinalPrep ? '最终整备' : '强化选择',
      eyebrow: isFinalPrep ? '最后补强' : '选择强化',
      title: isFinalPrep ? '最终整备' : '机体强化',
      contextHtml: this.renderUpgradeChoiceContext(progress),
      items: choices.map((upgrade) => this.renderUpgradeChoiceCard(upgrade)),
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
      modeLabel: isAnomaly ? '异常处理' : '事件选择',
      eyebrow: isAnomaly ? 'ANOMALY EVENT' : 'FIELD EVENT',
      title: isAnomaly ? '异常接入' : eventDef.name,
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
    const routeTrace = result.routeTrace.slice(-4);
    const buildStageLabel =
      result.buildStage === 'unformed'
        ? '未站稳'
        : result.buildStage === 'hinted'
          ? '已出倾向'
          : result.buildStage === 'committed'
            ? '开始站稳'
            : '已经成型';
    this.screenLayer.innerHTML = `
      <section class="screen-minimal result-screen commercial-result-screen ${result.outcome === 'victory' ? 'is-victory' : 'is-defeat'}">
        <div class="screen-gridline" aria-hidden="true"></div>
        <div class="commercial-corner-label">04 RESULT SCREEN</div>
        <div class="commercial-screen-layout">
          <div class="commercial-screen-copy commercial-result-copy">
            <p class="screen-kicker">${result.outcome === 'victory' ? '本局完成' : '本局失败'}</p>
            <h1 class="screen-title">${result.outcome === 'victory' ? '任务完成' : '任务失败'}</h1>
            <p class="screen-subtitle">看看这局怎么收场</p>
            <div class="screen-summary-grid commercial-result-report">
              <article class="screen-summary-card">
                <span class="screen-summary-label">路线</span>
                <strong>${routeLabel}</strong>
              </article>
              <article class="screen-summary-card">
                <span class="screen-summary-label">生存时间</span>
                <strong>${this.formatDuration(result.runDurationSec)}</strong>
              </article>
              <article class="screen-summary-card">
                <span class="screen-summary-label">等级</span>
                <strong>Lv.${result.levelReached}</strong>
              </article>
              <article class="screen-summary-card">
                <span class="screen-summary-label">节点</span>
                <strong>${result.nodesCleared}</strong>
              </article>
            </div>
            <p class="screen-meta-line">${result.summary}</p>
            <div class="screen-actions commercial-screen-actions commercial-result-actions">
              <button class="text-action text-action-primary" data-action="restart">
                <span>再来一局</span>
                <small>立刻重开</small>
              </button>
              <button class="text-action" data-action="menu">
                <span>返回机库</span>
                <small>回到开始页</small>
              </button>
            </div>
          </div>
          <aside class="commercial-result-aside" aria-label="对局数据">
            <div class="commercial-visual-anchor commercial-result-anchor" aria-hidden="true">
              <span class="screen-ring ring-a"></span>
              <span class="screen-ring ring-b"></span>
              <span class="screen-ring ring-c"></span>
              <span class="commercial-core"></span>
              <div class="commercial-debrief-panel">
                <span>本局小结</span>
                <strong>${result.outcome === 'victory' ? '可以收工' : '调整再来'}</strong>
                <small>${result.buildLabel}</small>
              </div>
            </div>
            <div class="commercial-result-stack">
              <article class="commercial-result-card">
                <span>构筑摘要</span>
                <strong>${result.buildSummary}</strong>
              </article>
              <article class="commercial-result-card">
                <span>结束原因</span>
                <strong>${result.endingReason}</strong>
              </article>
              <article class="commercial-result-card">
                <span>终点节点</span>
                <strong>${result.finalNodeTitle}</strong>
              </article>
              <article class="commercial-result-card is-row">
                <span>战斗胜场</span>
                <strong>${result.battleWins}</strong>
                <span>推进节点</span>
                <strong>${result.nodesCleared}</strong>
              </article>
              <article class="commercial-result-card is-row">
                <span>路线阶段</span>
                <strong>${buildStageLabel}</strong>
                <span>结局类型</span>
                <strong>${result.endingLabel}</strong>
              </article>
              <article class="commercial-result-card">
                <span>最近轨迹</span>
                <strong>${routeTrace.length > 0 ? routeTrace.map((node) => node.title).join(' / ') : '暂无轨迹'}</strong>
              </article>
            </div>
          </aside>
        </div>
      </section>
    `;
    this.bindClick('[data-action="restart"]', actions.onRestart);
    this.bindClick('[data-action="menu"]', actions.onBackToMenu);
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
    return `
      <aside class="choice-context choice-context-route" aria-label="路线推进信息">
        <div class="route-context-node is-origin"></div>
        <div class="route-context-lines" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="route-context-copy">
          <span>当前段位</span>
          <strong>${phaseLabel || progress.progressLabel}</strong>
          <small>${optionCount} 条候选路线 · 选择 1 条作战路线</small>
        </div>
      </aside>
    `;
  }

  private renderUpgradeChoiceContext(progress: PanelProgress): string {
    const stats = progress.statSummary.slice(0, 10);
    const statItems = stats
      .map((stat) => `<span class="upgrade-stat-item tone-${stat.tone}"><small>${stat.label}</small><strong>${stat.value}</strong></span>`)
      .join('');
    return `
      <aside class="choice-context choice-context-upgrade" aria-label="当前机体属性">
        <div class="upgrade-context-head">
          <span>当前机体</span>
          <strong>${progress.levelText}</strong>
        </div>
        <div class="upgrade-context-route">${progress.routeStatusText}</div>
        <div class="upgrade-stat-grid">${statItems}</div>
      </aside>
    `;
  }

  private renderAnomalyChoiceContext(eventDef: EventDefinition, progress: PanelProgress): string {
    return `
      <aside class="choice-context choice-context-anomaly" aria-label="异常风险摘要">
        <span class="anomaly-warning-label">RISK AUTHORIZATION</span>
        <strong>${eventDef.name}</strong>
        <p>${eventDef.description}</p>
        <div class="anomaly-risk-grid">
          <span><small>风险类型</small><b>${this.getEventClassLabel(eventDef)}</b></span>
          <span><small>当前进度</small><b>${progress.progressLabel}</b></span>
        </div>
        <div class="anomaly-warning-strip">收益与代价同级显示，确认前请看清处理结果</div>
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
          <span class="choice-node-step">下一步</span>
        </div>
        <div class="choice-strip-body choice-strip-body-node">
          <strong>${node.title}</strong>
          <small>${this.getNodeCardDescription(node)}</small>
        </div>
        <div class="choice-strip-foot choice-strip-foot-node">
          <span class="choice-node-detail">${detail}</span>
          <span class="choice-node-enter">进入</span>
        </div>
      </button>
    `;
  }

  private renderUpgradeChoiceCard(upgrade: UpgradeDefinition): string {
    const routeAccent = this.getRouteAccent(upgrade.routeId);
    const effectText = this.getChoiceEffectSummary(upgrade.effects, { maxSegments: 3 }) || upgrade.description;
    const routeLabel = upgrade.routeId ? `${ROUTE_NAME_MAP[upgrade.routeId]}加成` : '通用';
    const focusLabel = this.getEffectFocusLabel(upgrade.effects);
    const routeLabelHtml = this.renderTooltipTerm(routeLabel, this.getRouteTooltip(upgrade.routeId));
    const focusLabelHtml = this.renderTooltipTerm(focusLabel, this.getFocusTooltip(focusLabel));
    const nameHtml = this.decorateTooltipTerms(upgrade.name);
    const effectTextHtml = this.decorateTooltipTerms(effectText);
    return `
      <button
        class="choice-strip choice-strip-upgrade ${upgrade.routeId ? 'is-route-upgrade' : 'is-generic-upgrade'}"
        style="--choice-accent: ${routeAccent}; --rarity-accent: ${RARITY_COLOR_MAP[upgrade.rarity]}"
        data-choice="${upgrade.id}"
      >
        <div class="choice-strip-head">
          <span class="choice-type">强化</span>
          <span class="choice-rarity">${upgrade.rarityLabel}</span>
        </div>
        <div class="choice-strip-body choice-strip-body-upgrade">
          <strong>${nameHtml}</strong>
          <small>${effectTextHtml}</small>
        </div>
        <div class="choice-strip-foot">
          <span class="choice-route-boost ${upgrade.routeId ? 'active' : ''}" style="--route-pill: ${routeAccent}">${routeLabelHtml}</span>
          <div class="choice-foot-trail">
            <span class="choice-effect-tag">${focusLabelHtml}</span>
            <span class="choice-prompt">${upgrade.routeId ? '偏流派' : '补属性'}</span>
          </div>
        </div>
      </button>
    `;
  }

  private renderEventChoiceCard(
    eventDef: EventDefinition,
    option: EventDefinition['options'][number],
  ): string {
    const isAnomaly = eventDef.contentKind === 'anomaly';
    const routeAccent = this.getEventChoiceAccent(eventDef, option);
    const routeRef = this.getEventRouteReference(eventDef, option);
    const routeLabel = this.getEventRouteLabel(routeRef, eventDef);
    const prompt = isAnomaly ? '处理' : '执行';
    const anomalyClass = eventDef.contentKind === 'anomaly' ? ' is-anomaly-event' : '';
    const effectText = this.getEventOptionDescription(eventDef, option);
    const actionLabel = this.getEventChoiceActionLabel(eventDef, option);
    const detailTags = this.getEventChoiceTags(eventDef, option);
    const anomalyGain = isAnomaly ? this.getAnomalyGainLabel(option) : '';
    const anomalyCost = isAnomaly ? this.getAnomalyCostLabel(option) : '';
    return `
      <button class="choice-strip choice-strip-event${anomalyClass}" style="--choice-accent: ${routeAccent}" data-choice="${option.id}">
        <div class="choice-strip-head">
          <span class="choice-type">${isAnomaly ? '处理方案' : '事件'}</span>
          ${isAnomaly ? `<span class="choice-mode-badge choice-event-class">${this.getEventClassLabel(eventDef)}</span>` : ''}
          <span class="choice-mode-badge choice-event-route ${routeRef ? 'active' : ''}" style="--route-pill: ${routeAccent}">${routeLabel}</span>
        </div>
        <div class="choice-strip-body choice-strip-body-event">
          <strong>${option.label}</strong>
          <small>${effectText}</small>
        </div>
        ${
          isAnomaly
            ? `<div class="choice-anomaly-breakdown">
                <span><small>获得</small><strong>${anomalyGain}</strong></span>
                <span class="${anomalyCost.includes('-') || anomalyCost.includes('损失') ? 'is-cost' : ''}"><small>代价</small><strong>${anomalyCost}</strong></span>
              </div>`
            : ''
        }
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
            <span class="choice-prompt">确认</span>
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
      return node.description;
    }
    if (node.type === 'upgrade') {
      return node.isFinalPrep ? '拿完直接进 Boss。' : '补 1 项强化再继续推进。';
    }
    if (node.type === 'anomaly') {
      return '做一次异常处理，拿当前这拍的变化。';
    }
    if (node.type === 'boss') {
      return '直接进入首领战。';
    }
    return '继续推进。';
  }

  private getNodeCardEntryLabel(node: NodeOption): string {
    if (node.type === 'battle') {
      return getBattleEncounterLabel(node.templateId ?? 'elimination');
    }
    if (node.type === 'upgrade') {
      return node.isFinalPrep ? '最终整备' : '补 1 项强化';
    }
    if (node.type === 'anomaly') {
      return '处理异常';
    }
    return '首领战';
  }

  private getEventRouteLabel(routeId: RouteReference | undefined, eventDef: EventDefinition): string {
    if (!routeId || routeId === 'dominant') {
      if (eventDef.contentKind !== 'anomaly') {
        return '当前处理';
      }
      switch (eventDef.anomalyClass) {
        case 'hybrid':
          return '并线样本';
        case 'bossEcho':
          return 'Boss 预读';
        case 'distortion':
          return '异常读数';
        default:
          return '当前路线';
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
      .map(([routeId, count]) => `${routeId === 'dominant' ? '当前路线' : ROUTE_NAME_MAP[routeId]}推进 +${count}`)
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

    return '承接';
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
    return `<span class="choice-tooltip-term" tabindex="0" data-tooltip="${safeTooltip}" title="${safeTooltip}">${safeLabel}</span>`;
  }

  private decorateTooltipTerms(text: string): string {
    const tooltipTerms: Array<[string, string]> = [
      ['穿梭冷却', this.getFocusTooltip('穿梭')],
      ['无伤窗口', this.getFocusTooltip('无伤')],
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
        return '暴击路线：提高爆发和击杀收割。';
      case 'pierce':
        return '穿透路线：子弹穿过敌人，适合清线回收。';
      case 'dash':
        return '穿梭路线：换位、借窗、回切反打。';
      default:
        return '';
    }
  }

  private getFocusTooltip(label: string): string {
    const tooltipMap: Record<string, string> = {
      暴击: '每次子弹命中都会独立判定。判定成功时伤害变高，并会在敌人身上留下橙色破绽标记；再次打中破绽才是暴击路线的承接收益。',
      爆伤: '只影响已经触发暴击的那次命中，不提高触发概率。',
      穿透: '子弹命中敌人后不会立刻消失，会继续打到后方目标。敌人越站成一线，穿透收益越高；蓝色裂纹表示它刚被穿透命中过。',
      穿梭: '穿梭是自动触发的相位脉冲，不需要按键。冷却归零时角色会短暂闪动并释放一次近身脉冲；冷却越短，触发越频繁。',
      脉冲: '穿梭触发时在角色附近释放的短促范围伤害。绿色脉冲标记表示敌人被这次穿梭脉冲擦到。',
      无伤: '穿梭触发后的极短保护时间，只在自动脉冲刚发生后生效，用来穿过危险窗或回切反打。',
      扩面: '增加弹幕覆盖，适合清小怪。',
      射速: '更快开火，回报链更连续。',
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
        return '改道窗';
      case 'hybrid':
        return '并线';
      case 'bossEcho':
        return '预读';
      case 'distortion':
        return '失真';
      default:
        return '异常';
    }
  }

  private getEventChoiceActionLabel(eventDef: EventDefinition, option: EventDefinition['options'][number]): string {
    if (eventDef.contentKind !== 'anomaly') {
      return '补一拍';
    }

    const routeRef = this.getEventRouteReference(eventDef, option);
    const routeSummary = this.getRouteEffectSummary(option.effects);
    if (eventDef.anomalyClass === 'routeWindow') {
      if (routeRef && eventDef.routeAffinity && routeRef !== eventDef.routeAffinity) {
        return '真改道';
      }
      return routeSummary ? '续当前线' : '保留窗口';
    }

    if (eventDef.anomalyClass === 'hybrid') {
      return '并线承接';
    }

    if (eventDef.anomalyClass === 'bossEcho') {
      return 'Boss 承接';
    }

    const hasPressure = option.effects?.some((effect) => effect.type === 'heal' && effect.amount < 0);
    return hasPressure ? '冒压换读法' : '失真补一拍';
  }

  private getEventChoiceTags(eventDef: EventDefinition, option: EventDefinition['options'][number]): string[] {
    const tags: string[] = [];
    const focusLabel = this.getEffectFocusLabel(option.effects);
    if (focusLabel) {
      tags.push(focusLabel);
    }

    const routeSummary = this.getRouteEffectSummary(option.effects);
    if (routeSummary) {
      tags.push(routeSummary);
    } else if (eventDef.contentKind === 'anomaly' && eventDef.anomalyClass === 'hybrid') {
      tags.push('当前路线承接');
    }

    const healEffect = option.effects?.find((effect): effect is Extract<ContentEffect, { type: 'heal' }> => effect.type === 'heal');
    if (healEffect) {
      tags.push(healEffect.amount < 0 ? '承压' : '留余量');
    }

    return tags.slice(0, 2);
  }

  private getRouteDisplayLabel(routeId: RunResult['routeId']): string {
    return routeId ? ROUTE_NAME_MAP[routeId] : '未成线';
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
    return match ? `推进 ${match[1]}` : progressLabel;
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
