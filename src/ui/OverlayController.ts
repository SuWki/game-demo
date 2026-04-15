import { getBattleEncounterLabel } from '../data/battleTemplates';
import { RARITY_COLOR_MAP } from '../data/balance';
import { ROUTE_COLOR_MAP, ROUTE_NAME_MAP } from '../data/routes';
import { describeContentEffects } from '../data/upgrades';
import type {
  EventDefinition,
  NodeOption,
  OverlayHudSnapshot,
  OverlayMetaSummary,
  RunResult,
  ToastTone,
  UpgradeDefinition,
} from '../game/types';

interface ResultActions {
  onRestart: () => void;
  onBackToMenu: () => void;
  onExport: () => void;
}

const NODE_TYPE_LABEL_MAP: Record<NodeOption['type'], string> = {
  battle: '战斗',
  upgrade: '强化',
  anomaly: '异常',
  boss: 'Boss',
};

const NODE_TYPE_ACCENT_MAP: Record<NodeOption['type'], string> = {
  battle: '#f09a54',
  upgrade: '#58b3e6',
  anomaly: '#9f73e8',
  boss: '#f06d56',
};

const TOAST_BADGES: Record<ToastTone, string> = {
  neutral: '提示',
  accent: '阶段',
  route: '路线',
  danger: '高压',
  success: '完成',
};

export class OverlayController {
  private readonly root: HTMLElement;

  private readonly screenLayer: HTMLDivElement;

  private readonly hudLayer: HTMLDivElement;

  private readonly panelLayer: HTMLDivElement;

  private readonly toastLayer: HTMLDivElement;

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

    this.root.append(this.screenLayer, this.hudLayer, this.panelLayer, this.toastLayer);
  }

  public showMenu(summary: OverlayMetaSummary, onStart: () => void, onExport: () => void): void {
    this.hideHud();
    this.hidePanel();
    this.clearToasts();
    this.screenLayer.classList.remove('hidden');
    this.screenLayer.innerHTML = `
      <section class="menu-card hero-card">
        <div class="screen-topline">
          <span class="screen-chip">短局生存</span>
          <span class="screen-chip">节点推进</span>
        </div>
        <div class="hero-layout">
          <div class="hero-copy">
            <p class="eyebrow">Node Run</p>
            <h1>节点作战</h1>
            <p class="lead">移动，清场，成线。</p>
            <div class="hero-routes">
              <span class="route-badge route-badge-crit">暴击</span>
              <span class="route-badge route-badge-pierce">穿透</span>
              <span class="route-badge route-badge-dash">穿梭</span>
            </div>
            <div class="menu-pills">
              <span class="menu-pill">WASD</span>
              <span class="menu-pill">自动开火</span>
              <span class="menu-pill">战斗升级</span>
              <span class="menu-pill">节点推进</span>
            </div>
            <div class="menu-actions">
              <button class="primary-action" data-action="start">开始</button>
              <button class="secondary-action" data-action="export">导出记录</button>
            </div>
          </div>
          <div class="hero-aside">
            <div class="menu-stats">
              <div>
                <span>总局数</span>
                <strong>${summary.totalRuns}</strong>
              </div>
              <div>
                <span>完成</span>
                <strong>${summary.wins}</strong>
              </div>
              <div>
                <span>上局路线</span>
                <strong>${summary.lastRouteName}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
    this.bindClick('[data-action="start"]', onStart);
    this.bindClick('[data-action="export"]', onExport);
  }

  public showHud(snapshot: OverlayHudSnapshot): void {
    this.screenLayer.classList.add('hidden');
    this.hudLayer.classList.remove('hidden');
    this.hudLayer.innerHTML = `
      <div class="hud-shell hud-shell-game">
        <section class="hud-ribbon hud-ribbon-left">
          <div class="hud-chip-row">
            <span class="hud-level-badge">${snapshot.levelText}</span>
            <span class="hud-phase-badge">${snapshot.phaseLabel}</span>
          </div>
          <div class="hud-meter hud-meter-tight">
            <div class="hud-meter-head">
              <span>生命</span>
              <strong>${snapshot.hpText}</strong>
            </div>
            <div class="hud-meter-bar hud-meter-hp ${this.getMeterStateClass(snapshot.hpRatio)}">
              <span style="width: ${Math.max(0, Math.min(100, snapshot.hpRatio * 100)).toFixed(1)}%"></span>
            </div>
          </div>
          <div class="hud-meter hud-meter-tight">
            <div class="hud-meter-head">
              <span>经验</span>
              <strong>${snapshot.experienceText}</strong>
            </div>
            <div class="hud-meter-bar hud-meter-xp">
              <span style="width: ${Math.max(0, Math.min(100, snapshot.experienceRatio * 100)).toFixed(1)}%"></span>
            </div>
          </div>
        </section>
        <section class="hud-ribbon hud-ribbon-center hud-stage-card">
          <div class="hud-compact-head">
            <span class="hud-panel-label">${snapshot.progressLabel}</span>
            <span class="hud-status-pill">${snapshot.routeStatusText}</span>
          </div>
          <strong>${snapshot.statusText}</strong>
          <div class="route-strip hud-route-strip hud-route-strip-inline">
            ${this.renderRouteStrip(snapshot.routeProgress)}
          </div>
        </section>
        <section class="hud-ribbon hud-ribbon-right hud-objective-card hud-objective-${snapshot.objectiveTone}">
          <div class="hud-compact-head">
            <span class="hud-panel-label">${snapshot.objectiveLabel}</span>
            <span class="hud-stage-counter">${snapshot.nodeLabel}</span>
          </div>
          <strong>${snapshot.objectiveText}</strong>
          <div class="hud-objective-progress">${snapshot.objectiveProgressText}</div>
        </section>
      </div>
    `;
  }

  public showNodePanel(
    phaseLabel: string,
    options: NodeOption[],
    progress: Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'>,
    onChoose: (nodeId: string) => void,
  ): void {
    this.showPanel({
      panelClassName: 'panel-node-choice',
      modeLabel: '路线选择',
      modeHint: '下一站',
      title: `${phaseLabel}路线`,
      description: this.getNodePanelDescription(options),
      items: options.map((node) => this.renderNodeChoiceCard(node)),
      progress,
    });
    for (const node of options) {
      this.bindClick(`[data-choice="${node.id}"]`, () => onChoose(node.id));
    }
  }

  public showUpgradePanel(
    title: string,
    description: string,
    progress: Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'>,
    choices: UpgradeDefinition[],
    onChoose: (upgradeId: string) => void,
  ): void {
    const modeLabel = title.includes('等级提升')
      ? '强化选择'
      : title.includes('最终整备')
        ? '最终整备'
        : '强化选择';
    const modeHint = title.includes('等级提升')
      ? '战斗内强化'
      : title.includes('最终整备')
        ? 'Boss 前补一手'
        : '补当前打法';

    this.showPanel({
      panelClassName: 'panel-upgrade-choice',
      modeLabel,
      modeHint,
      title,
      description: description || '补这一局最缺的一拍。',
      items: choices.map((upgrade) => this.renderUpgradeChoiceCard(upgrade)),
      progress,
    });
    for (const upgrade of choices) {
      this.bindClick(`[data-choice="${upgrade.id}"]`, () => onChoose(upgrade.id));
    }
  }

  public showEventPanel(
    eventDef: EventDefinition,
    progress: Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'>,
    onChoose: (optionId: string) => void,
  ): void {
    const contentLabel = eventDef.contentKind === 'anomaly' ? '异常处理' : '事件选择';
    this.showPanel({
      panelClassName: 'panel-event-choice',
      modeLabel: contentLabel,
      modeHint: eventDef.contentKind === 'anomaly' ? '选一种处理方式' : '选一个结果',
      title: eventDef.name,
      description: this.getEventPanelDescription(eventDef),
      items: eventDef.options.map((option) => this.renderEventChoiceCard(eventDef, option)),
      progress,
    });
    for (const option of eventDef.options) {
      this.bindClick(`[data-choice="${option.id}"]`, () => onChoose(option.id));
    }
  }

  public showResult(result: RunResult, actions: ResultActions): void {
    this.hideHud();
    this.hidePanel();
    this.clearToasts();
    this.screenLayer.classList.remove('hidden');
    const routeLabel = this.getRouteDisplayLabel(result.routeId);
    this.screenLayer.innerHTML = `
      <section class="menu-card result-card">
        <div class="screen-topline">
          <span class="screen-chip">${result.outcome === 'victory' ? '本局完成' : '本局结束'}</span>
          <span class="screen-chip">${routeLabel}</span>
        </div>
        <p class="eyebrow">${result.outcome === 'victory' ? 'Run Closed' : 'Run Ended'}</p>
        <h1>${result.outcome === 'victory' ? '收束完成' : '差最后一拍'}</h1>
        <p class="lead">${result.summary}</p>
        <div class="menu-stats">
          <div>
            <span>路线</span>
            <strong>${routeLabel}</strong>
          </div>
          <div>
            <span>成型</span>
            <strong>${result.buildLabel}</strong>
          </div>
          <div>
            <span>结局</span>
            <strong>${result.endingLabel}</strong>
          </div>
          <div>
            <span>等级</span>
            <strong>Lv.${result.levelReached}</strong>
          </div>
        </div>
        <div class="result-callout">
          <p class="panel-description">${result.buildSummary}，${result.endingReason}。</p>
          <div class="menu-pills result-pills">
            <span class="menu-pill">收尾节点 ${result.finalNodeType ? NODE_TYPE_LABEL_MAP[result.finalNodeType] : '阶段'} / ${result.finalNodeTitle}</span>
            <span class="menu-pill">胜场 ${result.battleWins}</span>
            <span class="menu-pill">推进 ${result.nodesCleared}</span>
            <span class="menu-pill">时长 ${result.runDurationSec.toFixed(1)}s</span>
          </div>
          <div class="result-route-block">
            <span class="result-route-label">本局路径</span>
            ${this.renderResultRouteTrace(result.routeTrace)}
          </div>
          <p class="result-replay-prompt">${result.replayPrompt}</p>
        </div>
        <div class="menu-actions">
          <button class="primary-action" data-action="restart">再来一局</button>
          <button class="secondary-action" data-action="menu">返回开始</button>
          <button class="secondary-action" data-action="export">导出记录</button>
        </div>
      </section>
    `;
    this.bindClick('[data-action="restart"]', actions.onRestart);
    this.bindClick('[data-action="menu"]', actions.onBackToMenu);
    this.bindClick('[data-action="export"]', actions.onExport);
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
    }, 2600);
  }

  public hidePanel(): void {
    this.panelLayer.classList.add('hidden');
    this.panelLayer.innerHTML = '';
  }

  public hideHud(): void {
    this.hudLayer.classList.add('hidden');
    this.hudLayer.innerHTML = '';
  }

  public clearToasts(): void {
    this.toastLayer.innerHTML = '';
  }

  private showPanel(config: {
    panelClassName: string;
    modeLabel: string;
    modeHint?: string;
    title: string;
    description: string;
    items: string[];
    progress?: Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'>;
  }): void {
    this.screenLayer.classList.add('hidden');
    this.panelLayer.classList.remove('hidden');
    this.panelLayer.innerHTML = `
      <section class="floating-panel dock-panel ${config.panelClassName}">
        <div class="tray-header">
          <div class="tray-title-group">
            <p class="eyebrow">${config.modeLabel}</p>
            <h2 class="panel-title">${config.title}</h2>
          </div>
          <div class="tray-header-side">
            ${config.modeHint ? `<span class="tray-mode-hint">${config.modeHint}</span>` : ''}
            ${config.progress ? `<span class="tray-progress">${config.progress.progressLabel}</span>` : ''}
          </div>
        </div>
        <div class="choice-grid choice-grid-tray">${config.items.join('')}</div>
      </section>
    `;
  }

  private bindClick(selector: string, handler: () => void): void {
    const target = this.root.querySelector<HTMLElement>(selector);
    if (target) {
      target.onclick = handler;
    }
  }

  private renderRouteStrip(routeProgress: OverlayHudSnapshot['routeProgress']): string {
    if (routeProgress.length === 0) {
      return `
        <div class="route-chip route-chip-muted">
          <span>路线</span>
          <strong>未成线</strong>
        </div>
      `;
    }

    return routeProgress
      .map(
        (route) => `
          <div class="route-chip ${route.active ? 'active' : ''}" style="--route-accent: ${route.color}">
            <span>${route.label}</span>
            <strong>${route.value}</strong>
          </div>
        `,
      )
      .join('');
  }

  private getOptionTypeLabel(
    routeId: EventDefinition['options'][number]['routeId'],
    contentKind: EventDefinition['contentKind'],
  ): string {
    if (!routeId || routeId === 'dominant') {
      return contentKind === 'anomaly' ? '当前路线' : '当前处理';
    }
    return ROUTE_NAME_MAP[routeId];
  }

  private renderNodeChoiceCard(node: NodeOption): string {
    const detail =
      node.type === 'battle'
        ? getBattleEncounterLabel(node.templateId ?? 'elimination')
        : node.type === 'upgrade'
          ? node.isFinalPrep
            ? 'Boss 前补强'
            : '补一张强化'
          : node.type === 'anomaly'
            ? '处理异常'
            : '进入首领战';

    return `
      <button class="choice-card choice-card-node map-choice" style="--choice-accent: ${NODE_TYPE_ACCENT_MAP[node.type]}" data-choice="${node.id}">
        <div class="choice-card-top">
          <span class="choice-type">路线</span>
          <span class="choice-node-pill choice-node-pill-${node.type}">${NODE_TYPE_LABEL_MAP[node.type]}</span>
        </div>
        <div class="choice-card-tags">
          <span class="choice-focus-pill choice-focus-pill-node">关卡分支</span>
          <span class="choice-route-pill active" style="--route-pill: ${NODE_TYPE_ACCENT_MAP[node.type]}">${detail}</span>
        </div>
        <strong>${node.title}</strong>
        <small>${this.getNodeCardDescription(node)}</small>
      </button>
    `;
  }

  private renderUpgradeChoiceCard(upgrade: UpgradeDefinition): string {
    const routeAccent = this.getRouteAccent(upgrade.routeId);
    const routeLabel = upgrade.routeId ? `${ROUTE_NAME_MAP[upgrade.routeId]}加成` : '通用强化';
    const kindLabel = upgrade.routeId ? '流派强化' : '属性强化';
    const effectText = describeContentEffects(upgrade.effects, upgrade.routeId);

    return `
      <button class="choice-card choice-card-upgrade ${upgrade.routeId ? 'choice-card-route-boost' : ''}" style="--choice-accent: ${routeAccent}; --rarity-accent: ${RARITY_COLOR_MAP[upgrade.rarity]}" data-choice="${upgrade.id}">
        <div class="choice-card-top">
          <span class="choice-type">强化</span>
          <span class="choice-rarity" style="--rarity-accent: ${RARITY_COLOR_MAP[upgrade.rarity]}">${upgrade.rarityLabel}</span>
        </div>
        <div class="choice-card-tags">
          <span class="choice-focus-pill ${upgrade.routeId ? 'active' : ''}" style="--route-pill: ${routeAccent}">${routeLabel}</span>
          <span class="choice-kind-badge">${kindLabel}</span>
        </div>
        <strong>${upgrade.name}</strong>
        <small>${effectText || upgrade.description}</small>
      </button>
    `;
  }

  private renderEventChoiceCard(
    eventDef: EventDefinition,
    option: EventDefinition['options'][number],
  ): string {
    const routeAccent = this.getRouteAccent(option.routeId);
    const routeLabel = this.getOptionTypeLabel(option.routeId, eventDef.contentKind);

    return `
      <button class="choice-card choice-card-event" style="--choice-accent: ${routeAccent}" data-choice="${option.id}">
        <div class="choice-card-top">
          <span class="choice-type">${eventDef.contentKind === 'anomaly' ? '异常' : '事件'}</span>
          <span class="choice-route-pill ${option.routeId ? 'active' : ''}" style="--route-pill: ${routeAccent}">${routeLabel}</span>
        </div>
        <div class="choice-card-tags">
          <span class="choice-focus-pill ${option.routeId ? 'active' : ''}" style="--route-pill: ${routeAccent}">
            ${eventDef.contentKind === 'anomaly' ? '处理方式' : '结果'}
          </span>
        </div>
        <strong>${option.label}</strong>
        <small>${this.getEventOptionDescription(option)}</small>
      </button>
    `;
  }

  private getNodeCardDescription(node: NodeOption): string {
    if (node.type === 'battle') {
      return node.description;
    }
    if (node.type === 'upgrade') {
      return node.isFinalPrep ? '补完直接进 Boss。' : '补强当前打法，再继续推进。';
    }
    return node.description;
  }

  private getNodePanelDescription(options: NodeOption[]): string {
    const phase = options[0]?.phase;
    switch (phase) {
      case 'opening':
        return '先让这局的第一条线站出来。';
      case 'mid':
        return '决定继续收线，还是借异常改道。';
      case 'late':
        return '后段优先补短板和收尾。';
      case 'finalPrep':
        return '最后整备，选完直接进 Boss。';
      case 'finalBattle':
        return '这一站就是本局收束。';
      default:
        return '选一条推进路线。';
    }
  }

  private getEventPanelDescription(eventDef: EventDefinition): string {
    if (eventDef.contentKind !== 'anomaly') {
      return '选一个处理结果。';
    }

    switch (eventDef.anomalyClass) {
      case 'routeWindow':
        return '出现改道窗口，选继续承接还是切线。';
      case 'distortion':
        return '拿收益，也要接住代价。';
      case 'hybrid':
        return '这一拍会把两条线临时并起来。';
      case 'bossEcho':
        return '提前读到一段 Boss 后程。';
      default:
        return '选一种异常处理方式。';
    }
  }

  private getEventOptionDescription(option: EventDefinition['options'][number]): string {
    if (option.effects && option.effects.length > 0) {
      return describeContentEffects(option.effects, option.routeId === 'dominant' ? undefined : option.routeId);
    }
    return option.description;
  }

  private getRouteAccent(routeId?: UpgradeDefinition['routeId'] | EventDefinition['options'][number]['routeId']): string {
    if (!routeId || routeId === 'dominant') {
      return '#76bfe7';
    }
    return ROUTE_COLOR_MAP[routeId];
  }

  private getRouteDisplayLabel(routeId: RunResult['routeId']): string {
    return routeId ? ROUTE_NAME_MAP[routeId] : '未成线';
  }

  private getMeterStateClass(ratio: number): string {
    if (ratio <= 0.35) {
      return 'danger';
    }
    if (ratio <= 0.68) {
      return 'warn';
    }
    return 'stable';
  }

  private renderResultRouteTrace(routeTrace: RunResult['routeTrace']): string {
    if (routeTrace.length === 0) {
      return '<p class="result-trace-empty">这局结束得太快，路线还没来得及完全展开。</p>';
    }

    return `
      <div class="result-trace">
        ${routeTrace
          .map(
            (node, index) => `
              <span class="result-trace-item">
                <em>${NODE_TYPE_LABEL_MAP[node.type]}</em>
                <strong>${node.title}</strong>
              </span>
              ${index < routeTrace.length - 1 ? '<span class="result-trace-arrow">&rarr;</span>' : ''}
            `,
          )
          .join('')}
      </div>
    `;
  }
}
