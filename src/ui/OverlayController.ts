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
  battle: '#ff8f70',
  upgrade: '#68d4ff',
  anomaly: '#c98eff',
  boss: '#ff6d6d',
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
        <div class="surface-mark">
          <span class="surface-dot"></span>
          <span class="surface-dot"></span>
          <span class="surface-dot"></span>
        </div>
        <div class="hero-layout">
          <div class="hero-copy">
            <p class="eyebrow">短局自动射击</p>
            <h1>节点推进 Demo</h1>
            <p class="lead">用 WASD 走位、自动开火和节点抉择，把一条流派在短局内扶到成型。</p>
            <div class="hero-routes">
              <span class="route-badge route-badge-crit">暴击</span>
              <span class="route-badge route-badge-pierce">穿透</span>
              <span class="route-badge route-badge-dash">穿梭</span>
            </div>
            <div class="menu-pills">
              <span class="menu-pill">WASD 走位</span>
              <span class="menu-pill">自动射击</span>
              <span class="menu-pill">战斗内升级</span>
              <span class="menu-pill">节点路线推进</span>
            </div>
          </div>
          <div class="hero-aside">
            <div class="hero-support">
              <span>操作</span>
              <strong>靠走位读压力</strong>
              <small>自动开火，重点在拉扯、贴身、回摆和收经验节奏。</small>
            </div>
            <div class="hero-support">
              <span>成长</span>
              <strong>战斗内成型</strong>
              <small>击落敌人拿经验，升级三选一，再靠节点把路线慢慢站稳。</small>
            </div>
            <div class="hero-support">
              <span>目标</span>
              <strong>把一条线收住</strong>
              <small>暴击、穿透、穿梭各有读法，尽量在 Boss 前把收束能力补齐。</small>
            </div>
          </div>
        </div>
        <div class="menu-stats">
          <div>
            <span>累计试飞</span>
            <strong>${summary.totalRuns}</strong>
          </div>
          <div>
            <span>完成试飞</span>
            <strong>${summary.wins}</strong>
          </div>
          <div>
            <span>最近路线</span>
            <strong>${summary.lastRouteName}</strong>
          </div>
        </div>
        <div class="menu-actions">
          <button class="primary-action" data-action="start">开始试飞</button>
          <button class="secondary-action" data-action="export">导出埋点</button>
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
      <div class="hud-shell hud-shell-compact">
        <div class="hud-compact-row">
          <section class="hud-compact-card hud-compact-player">
            <div class="hud-compact-head">
              <span class="hud-panel-label">状态</span>
              <span class="hud-status-pill">${snapshot.levelText}</span>
            </div>
            <div class="hud-meter">
              <div class="hud-meter-head">
                <span>耐久</span>
                <strong>${snapshot.hpText}</strong>
              </div>
              <div class="hud-meter-bar hud-meter-hp ${this.getMeterStateClass(snapshot.hpRatio)}">
                <span style="width: ${Math.max(0, Math.min(100, snapshot.hpRatio * 100)).toFixed(1)}%"></span>
              </div>
            </div>
            <div class="hud-meter">
              <div class="hud-meter-head">
                <span>经验</span>
                <strong>${snapshot.experienceText}</strong>
              </div>
              <div class="hud-meter-bar hud-meter-xp">
                <span style="width: ${Math.max(0, Math.min(100, snapshot.experienceRatio * 100)).toFixed(1)}%"></span>
              </div>
            </div>
          </section>
          <section class="hud-compact-card hud-compact-stage">
            <div class="hud-compact-head">
              <span class="hud-panel-label">${snapshot.progressLabel}</span>
              <span class="hud-compact-inline">${snapshot.routeStatusText}</span>
            </div>
            <strong>${snapshot.statusText}</strong>
            <small>${snapshot.progressDetail}</small>
            ${this.renderPhaseTrack(snapshot.phaseTrack, 'hud')}
          </section>
          <section class="hud-compact-card hud-compact-objective hud-objective-${snapshot.objectiveTone}">
            <div class="hud-compact-head">
              <span class="hud-panel-label">${snapshot.objectiveLabel}</span>
              <span class="hud-compact-inline">${snapshot.nodeLabel}</span>
            </div>
            <strong>${snapshot.objectiveText}</strong>
            <small>${snapshot.objectiveDetail}</small>
            <div class="hud-objective-progress">${snapshot.objectiveProgressText}</div>
            <div class="route-strip hud-route-strip hud-route-strip-compact">
              ${this.renderRouteStrip(snapshot.routeProgress)}
            </div>
          </section>
        </div>
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
      modeHint: '决定下一站去哪里',
      title: `${phaseLabel}节点选择`,
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
      ? '战斗升级'
      : title.includes('最终整备')
        ? 'Boss 前整备'
        : '强化选择';
    const modeHint = title.includes('等级提升')
      ? '选完立即回到当前战斗'
      : title.includes('最终整备')
        ? '选完后直接进入 Boss'
        : '补强当前构筑';

    this.showPanel({
      panelClassName: 'panel-upgrade-choice',
      modeLabel,
      modeHint,
      title,
      description,
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
    const contentLabel = eventDef.contentKind === 'anomaly' ? '异常' : '事件';
    this.showPanel({
      panelClassName: 'panel-event-choice',
      modeLabel: eventDef.contentKind === 'anomaly' ? '异常抉择' : '事件处理',
      modeHint: eventDef.contentKind === 'anomaly' ? '选一种处理方式' : '选一种结果',
      title: `${contentLabel} · ${eventDef.name}`,
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
        <div class="surface-mark">
          <span class="surface-dot"></span>
          <span class="surface-dot"></span>
          <span class="surface-dot"></span>
        </div>
        <p class="eyebrow">${result.outcome === 'victory' ? '试飞完成' : '试飞中止'}</p>
        <h1>${result.outcome === 'victory' ? '这局已经顺利收住' : '这局还差最后一口气'}</h1>
        <p class="lead">${result.summary}</p>
        <div class="menu-pills result-pills">
          <span class="menu-pill">收尾节点 ${result.finalNodeType ? `${NODE_TYPE_LABEL_MAP[result.finalNodeType]} · ` : ''}${result.finalNodeTitle}</span>
          <span class="menu-pill">战斗胜场 ${result.battleWins}</span>
          <span class="menu-pill">推进节点 ${result.nodesCleared}</span>
          <span class="menu-pill">时长 ${result.runDurationSec.toFixed(1)}s</span>
        </div>
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
            <span>结束</span>
            <strong>${result.endingLabel}</strong>
          </div>
          <div>
            <span>等级</span>
            <strong>Lv.${result.levelReached}</strong>
          </div>
        </div>
        <div class="result-callout">
          <p class="panel-description">${result.buildSummary}，${result.endingReason}。</p>
          <p class="panel-description">本局从 ${routeLabel} 起势，最终以 ${result.endingLabel} 收尾。</p>
          <div class="result-route-block">
            <span class="result-route-label">本局路线</span>
            ${this.renderResultRouteTrace(result.routeTrace)}
          </div>
          <p class="result-replay-prompt">${result.replayPrompt}</p>
        </div>
        <div class="menu-actions">
          <button class="primary-action" data-action="restart">再来一局</button>
          <button class="secondary-action" data-action="menu">返回开始页</button>
          <button class="secondary-action" data-action="export">导出埋点</button>
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
    }, 2800);
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
      <section class="floating-panel ${config.panelClassName}">
        <div class="surface-mark">
          <span class="surface-dot"></span>
          <span class="surface-dot"></span>
          <span class="surface-dot"></span>
        </div>
        <div class="panel-heading">
          <div class="panel-mode-row">
            <span class="panel-mode-badge">${config.modeLabel}</span>
            ${config.modeHint ? `<span class="panel-mode-hint">${config.modeHint}</span>` : ''}
          </div>
          <h2 class="panel-title">${config.title}</h2>
          <p class="panel-description">${config.description}</p>
        </div>
        ${config.progress ? this.renderPanelProgress(config.progress) : ''}
        <div class="choice-grid">${config.items.join('')}</div>
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
        <div class="route-chip route-chip-compact route-chip-muted">
          <span>路线</span>
          <strong>未站稳</strong>
        </div>
      `;
    }

    return routeProgress
      .map(
        (route) => `
          <div class="route-chip route-chip-compact ${route.active ? 'active' : ''}" style="--route-accent: ${route.color}">
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
      return contentKind === 'anomaly' ? '异常' : '事件';
    }
    return ROUTE_NAME_MAP[routeId];
  }

  private renderNodeChoiceCard(node: NodeOption): string {
    return `
      <button class="choice-card choice-card-node map-choice" style="--choice-accent: ${NODE_TYPE_ACCENT_MAP[node.type]}" data-choice="${node.id}">
        <div class="choice-card-top">
          <span class="choice-kind-badge">路线站点</span>
          <span class="choice-node-pill choice-node-pill-${node.type}">${NODE_TYPE_LABEL_MAP[node.type]}</span>
        </div>
        <strong>${node.title}</strong>
        <small>${this.getNodeCardDescription(node)}</small>
        <span class="choice-card-foot">选择这一站的推进路线</span>
      </button>
    `;
  }

  private renderUpgradeChoiceCard(upgrade: UpgradeDefinition): string {
    const routeAccent = this.getRouteAccent(upgrade.routeId);
    const routeLabel = upgrade.routeId ? `${ROUTE_NAME_MAP[upgrade.routeId]}加成` : '无路线限制';
    const categoryLabel = upgrade.routeId ? '流派强化' : '通用强化';
    return `
      <button class="choice-card choice-card-upgrade" style="--choice-accent: ${routeAccent}; --rarity-accent: ${RARITY_COLOR_MAP[upgrade.rarity]}" data-choice="${upgrade.id}">
        <div class="choice-card-top">
          <span class="choice-kind-badge">${categoryLabel}</span>
          <span class="choice-rarity" style="--rarity-accent: ${RARITY_COLOR_MAP[upgrade.rarity]}">${upgrade.rarityLabel}</span>
        </div>
        <div class="choice-card-tags">
          <span class="choice-route-pill ${upgrade.routeId ? 'active' : ''}" style="--route-pill: ${routeAccent}">${routeLabel}</span>
        </div>
        <strong>${upgrade.name}</strong>
        <small>${upgrade.description}</small>
      </button>
    `;
  }

  private renderEventChoiceCard(
    eventDef: EventDefinition,
    option: EventDefinition['options'][number],
  ): string {
    const routeAccent = this.getRouteAccent(option.routeId);
    const routeLabel = option.routeId ? this.getOptionTypeLabel(option.routeId, eventDef.contentKind) : null;
    return `
      <button class="choice-card choice-card-event" style="--choice-accent: ${routeAccent}" data-choice="${option.id}">
        <div class="choice-card-top">
          <span class="choice-kind-badge">${eventDef.contentKind === 'anomaly' ? '异常处理' : '事件处理'}</span>
          ${routeLabel ? `<span class="choice-route-pill active" style="--route-pill: ${routeAccent}">${routeLabel}</span>` : ''}
        </div>
        <strong>${option.label}</strong>
        <small>${this.getEventOptionDescription(option)}</small>
      </button>
    `;
  }

  private getNodeCardDescription(node: NodeOption): string {
    switch (node.type) {
      case 'battle':
        return `${getBattleEncounterLabel(node.templateId ?? 'elimination')} · ${node.description}`;
      case 'upgrade':
        return node.isFinalPrep ? '最后一次整备，选完后直接进入 Boss。' : node.description;
      case 'anomaly':
      case 'boss':
      default:
        return node.description;
    }
  }

  private getNodePanelDescription(options: NodeOption[]): string {
    const phase = options[0]?.phase;
    switch (phase) {
      case 'opening':
        return '这一拍先决定往哪一类站点走，让开局路线更快站出来。';
      case 'mid':
        return '中段开始要补桥接与承接，路线、强化、异常的选择会直接影响成线速度。';
      case 'late':
        return '后段优先补短板和收束能力，让最终站点更容易读成同一条线。';
      case 'finalPrep':
        return '这是 Boss 前的最后一次整备，选完这一站就会进入最终战。';
      case 'finalBattle':
        return '最终收束入口已经锁定，这一战会决定本局结算。';
      default:
        return '选择下一站。';
    }
  }

  private getEventPanelDescription(eventDef: EventDefinition): string {
    if (eventDef.contentKind !== 'anomaly') {
      return '选择一项处理结果。';
    }

    switch (eventDef.anomalyClass) {
      case 'routeWindow':
        return '当前出现了改道窗口，选一条更偏航或更稳住的处理方式。';
      case 'distortion':
        return '当前出现了扭曲窗口，选一段代价与收益的交换。';
      case 'hybrid':
        return '当前出现了并线样本，选一段混搭处理方式。';
      case 'bossEcho':
        return '当前泄露了 Boss 的后段样本，先决定这次收束怎么补。';
      default:
        return '当前出现了异常窗口，选一项处理方式。';
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
      return '#68d4ff';
    }
    return ROUTE_COLOR_MAP[routeId];
  }

  private getRouteDisplayLabel(routeId: RunResult['routeId']): string {
    return routeId ? ROUTE_NAME_MAP[routeId] : '未站稳';
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

  private renderPhaseTrack(
    phaseTrack: OverlayHudSnapshot['phaseTrack'],
    tone: 'hud' | 'panel',
  ): string {
    return `
      <div class="phase-track phase-track-${tone}">
        ${phaseTrack
          .map(
            (step) => `
              <span class="phase-step phase-step-${step.state}">
                ${step.label}
              </span>
            `,
          )
          .join('')}
      </div>
    `;
  }

  private renderPanelProgress(
    progress: Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'>,
  ): string {
    return `
      <div class="panel-progress">
        <div class="panel-progress-copy">
          <span>${progress.progressLabel}</span>
          <strong>${progress.progressDetail}</strong>
        </div>
        ${this.renderPhaseTrack(progress.phaseTrack, 'panel')}
      </div>
    `;
  }

  private renderResultRouteTrace(routeTrace: RunResult['routeTrace']): string {
    if (routeTrace.length === 0) {
      return '<p class="result-trace-empty">这一局结束得很快，路线还没来得及完整展开。</p>';
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
