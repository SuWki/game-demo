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
  ToastTone,
  UpgradeDefinition,
} from '../game/types';

interface ResultActions {
  onRestart: () => void;
  onBackToMenu: () => void;
  onExport: () => void;
}

type PanelProgress = Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'>;

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
  route: '流派',
  danger: '危险',
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
      <section class="screen-minimal menu-screen">
        <div class="screen-gridline" aria-hidden="true"></div>
        <div class="screen-center-glyph" aria-hidden="true">
          <span class="screen-ring ring-a"></span>
          <span class="screen-ring ring-b"></span>
          <span class="screen-ring ring-c"></span>
        </div>
        <div class="screen-anchor screen-anchor-bottom">
          <p class="screen-kicker">NODE RUN</p>
          <h1 class="screen-title">节点作战</h1>
          <p class="screen-subtitle">移动 / 清场 / 成线</p>
          <div class="screen-meta-strip">
            <span>${summary.totalRuns} 局</span>
            <span>${summary.wins} 胜</span>
            <span>${summary.lastRouteName}</span>
          </div>
          <div class="screen-actions">
            <button class="text-action text-action-primary" data-action="start">
              <span>开始</span>
              <small>ENTER</small>
            </button>
            <button class="text-action" data-action="export">
              <span>记录</span>
              <small>LOG</small>
            </button>
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
      <div class="hud-shell-minimal">
        <section class="hud-block hud-block-left">
          <div class="hud-stat-stack">
            <span class="hud-stat-value">${snapshot.hpText}</span>
            <div class="hud-bar hud-bar-hp ${this.getMeterStateClass(snapshot.hpRatio)}">
              <span style="width: ${Math.max(0, Math.min(100, snapshot.hpRatio * 100)).toFixed(1)}%"></span>
            </div>
          </div>
          <div class="hud-stat-stack">
            <span class="hud-stat-value">${snapshot.experienceText}</span>
            <div class="hud-bar hud-bar-xp">
              <span style="width: ${Math.max(0, Math.min(100, snapshot.experienceRatio * 100)).toFixed(1)}%"></span>
            </div>
          </div>
        </section>
        <section class="hud-block hud-block-center">
          <span class="hud-wave-text">${this.getHudWaveLabel(snapshot.progressLabel)}</span>
        </section>
        <section class="hud-block hud-block-right">
          <span class="hud-goal-text">${this.getHudObjectiveText(snapshot)}</span>
        </section>
      </div>
    `;
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
      modeHint: '下一站',
      title: `${phaseLabel}路线`,
      items: options.map((node) => this.renderNodeChoiceCard(node)),
      progress,
      alertText: '选择 1 条路线',
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
    const isLevelUp = title.includes('等级提升');
    const isFinalPrep = title.includes('最终整备');
    this.showPanel({
      panelClassName: 'panel-upgrade-choice',
      panelLayerClassName: 'panel-layer-center',
      modeLabel: isFinalPrep ? '最终整备' : '强化选择',
      modeHint: isLevelUp ? '拿一项' : isFinalPrep ? 'Boss 前' : '补一拍',
      title,
      items: choices.map((upgrade) => this.renderUpgradeChoiceCard(upgrade)),
      progress,
      alertText: isFinalPrep ? '选择 1 项最终强化' : '请选择 1 项强化',
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
      modeHint: isAnomaly ? '处理方式' : '执行',
      title: eventDef.name,
      items: eventDef.options.map((option) => this.renderEventChoiceCard(eventDef, option)),
      progress,
      alertText: isAnomaly ? '异常节点：选择 1 项处理' : '选择 1 项事件处理',
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
      <section class="screen-minimal result-screen ${result.outcome === 'victory' ? 'is-victory' : 'is-defeat'}">
        <div class="screen-gridline" aria-hidden="true"></div>
        <div class="screen-center-glyph" aria-hidden="true">
          <span class="screen-ring ring-a"></span>
          <span class="screen-ring ring-b"></span>
        </div>
        <div class="screen-anchor screen-anchor-center">
          <p class="screen-kicker">${result.outcome === 'victory' ? 'RUN CLEAR' : 'RUN END'}</p>
          <h1 class="screen-title">${result.outcome === 'victory' ? '完成' : '失败'}</h1>
          <div class="screen-meta-strip">
            <span>${routeLabel}</span>
            <span>${result.buildLabel}</span>
            <span>${result.endingLabel}</span>
          </div>
          <p class="screen-meta-line">Lv.${result.levelReached} / ${result.battleWins} 战 / ${result.nodesCleared} 节点</p>
          <div class="screen-actions">
            <button class="text-action text-action-primary" data-action="restart">
              <span>再来一局</span>
              <small>RERUN</small>
            </button>
            <button class="text-action" data-action="menu">
              <span>开始页</span>
              <small>MENU</small>
            </button>
            <button class="text-action" data-action="export">
              <span>记录</span>
              <small>LOG</small>
            </button>
          </div>
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
    }, 2200);
  }

  public hidePanel(): void {
    this.panelLayer.className = 'panel-layer hidden';
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
    panelLayerClassName?: string;
    modeLabel: string;
    modeHint?: string;
    title: string;
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
      <section class="floating-panel dock-panel ${config.panelClassName}">
        ${config.alertText ? `<div class="panel-alert">${config.alertText}</div>` : ''}
        <div class="tray-header">
          <div class="tray-title-group">
            <p class="eyebrow">${config.modeLabel}</p>
            <h2 class="panel-title">${config.title}</h2>
          </div>
          <div class="tray-header-side">
            ${config.progress ? `<span class="tray-progress">${this.getCompactProgressLabel(config.progress.progressLabel)}</span>` : ''}
            ${config.modeHint ? `<span class="tray-mode-hint">${config.modeHint}</span>` : ''}
          </div>
        </div>
        <div class="choice-grid choice-grid-tray ${itemCountClass}">${config.items.join('')}</div>
      </section>
    `;
  }

  private bindClick(selector: string, handler: () => void): void {
    const target = this.root.querySelector<HTMLElement>(selector);
    if (target) {
      target.onclick = handler;
    }
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
    const effectText = this.getChoiceEffectSummary(upgrade.effects, { maxSegments: 2 }) || upgrade.description;
    const routeLabel = upgrade.routeId ? `${ROUTE_NAME_MAP[upgrade.routeId]}加成` : '通用';
    const focusLabel = this.getEffectFocusLabel(upgrade.effects);
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
          <strong>${upgrade.name}</strong>
          <small>${effectText}</small>
        </div>
        <div class="choice-strip-foot">
          <span class="choice-route-boost ${upgrade.routeId ? 'active' : ''}" style="--route-pill: ${routeAccent}">${routeLabel}</span>
          <div class="choice-foot-trail">
            <span class="choice-effect-tag">${focusLabel}</span>
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
    return `
      <button class="choice-strip choice-strip-event${anomalyClass}" style="--choice-accent: ${routeAccent}" data-choice="${option.id}">
        <div class="choice-strip-head">
          <span class="choice-type">${isAnomaly ? '异常' : '事件'}</span>
          ${isAnomaly ? `<span class="choice-mode-badge choice-event-class">${this.getEventClassLabel(eventDef)}</span>` : ''}
          <span class="choice-mode-badge choice-event-route ${routeRef ? 'active' : ''}" style="--route-pill: ${routeAccent}">${routeLabel}</span>
        </div>
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
            <span class="choice-prompt">确认</span>
          </div>
        </div>
      </button>
    `;
  }

  private getNodeCardDescription(node: NodeOption): string {
    if (node.type === 'battle') {
      return `打一场${getBattleEncounterLabel(node.templateId ?? 'elimination')}，继续推进。`;
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
    const summary = this.getChoiceEffectSummary(option.effects, {
      includeRoute: eventDef.contentKind === 'anomaly',
      maxSegments: eventDef.contentKind === 'anomaly' ? 3 : 2,
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
      return 'danger';
    }
    if (ratio <= 0.68) {
      return 'warn';
    }
    return 'stable';
  }

  private getCompactProgressLabel(progressLabel: string): string {
    const match = progressLabel.match(/(\d+\s*\/\s*\d+)/);
    return match ? `推进 ${match[1]}` : progressLabel;
  }

  private getHudWaveLabel(progressLabel: string): string {
    const compactWave = progressLabel.match(/(\d+\s*\/\s*\d+)/);
    return compactWave ? `波次 ${compactWave[1]}` : progressLabel;
  }

  private getHudObjectiveText(snapshot: OverlayHudSnapshot): string {
    if (snapshot.objectiveTone === 'survive') {
      const surviveValue = snapshot.objectiveProgressText.match(/(\d+\s*s?)/);
      return surviveValue ? `生存: ${surviveValue[1]}` : '生存';
    }

    if (snapshot.objectiveTone === 'battle') {
      const killValue = snapshot.objectiveProgressText.match(/(\d+\s*\/\s*\d+)/);
      return killValue ? `歼灭: ${killValue[1]}` : '歼灭';
    }

    if (snapshot.objectiveTone === 'elite') {
      return snapshot.objectiveProgressText.includes('已') ? '精英: 已出现' : '精英: 即将出现';
    }

    if (snapshot.objectiveTone === 'boss') {
      return snapshot.objectiveProgressText.includes('即将') ? '首领: 即将出现' : '首领: 终结';
    }

    if (snapshot.objectiveText.includes('强化选择')) {
      return '目标: 强化';
    }

    if (snapshot.objectiveText.includes('最终整备')) {
      return '目标: 整备';
    }

    if (snapshot.objectiveText.includes('路线')) {
      return '目标: 选路';
    }

    if (snapshot.objectiveText.includes('异常')) {
      return '目标: 处理';
    }

    return `目标: ${snapshot.objectiveText}`;
  }
}
