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

const NODE_TYPE_LABELS = {
  battle: '战斗',
  upgrade: '强化',
  event: '事件',
} as const;

const NODE_TYPE_ACCENTS = {
  battle: '#ff8f70',
  upgrade: '#68d4ff',
  event: '#ffd58a',
} as const;

const NODE_TYPE_LABEL_MAP: Record<NodeOption['type'], string> = {
  battle: '\u6218\u6597',
  upgrade: '\u5f3a\u5316',
  anomaly: '\u5f02\u5e38',
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
            <p class="eyebrow">短局试飞版</p>
            <h1>节点式自动射击 Demo</h1>
            <p class="lead">用 WASD 走位、收经验、三选一补强，在短局节点推进里把一条路线扶到成型。</p>
            <div class="hero-routes">
              <span class="route-badge route-badge-crit">暴击</span>
              <span class="route-badge route-badge-pierce">穿透</span>
              <span class="route-badge route-badge-dash">穿梭</span>
            </div>
            <div class="menu-pills">
              <span class="menu-pill">WASD 走位</span>
              <span class="menu-pill">自动射击</span>
              <span class="menu-pill">战斗收经验</span>
              <span class="menu-pill">节点分路推进</span>
            </div>
          </div>
          <div class="hero-aside">
            <div class="hero-support">
              <span>操控</span>
              <strong>靠走位读压力</strong>
              <small>自动开火，重点在拉扯、贴身和收经验节奏。</small>
            </div>
            <div class="hero-support">
              <span>单局</span>
              <strong>战斗内成长</strong>
              <small>击落敌人拿经验，升级三选一，节点继续把方向扶稳。</small>
            </div>
            <div class="hero-support">
              <span>目标</span>
              <strong>让一路成型</strong>
              <small>暴击、穿透、穿梭各有闭环，收尾前尽量把一条路线站稳。</small>
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
      <div class="hud-shell">
        <div class="hud-rail">
          <div class="hud-kicker">
            <span class="hud-kicker-label">战况</span>
            <strong>${snapshot.battleText}</strong>
            ${snapshot.battleSubtext ? `<small>${snapshot.battleSubtext}</small>` : ''}
          </div>
          <div class="hud-bar">
            <div class="hud-block hud-block-stack">
              <span>等级 / 经验</span>
              <strong>${snapshot.levelText}</strong>
              <small>${snapshot.experienceText}</small>
            </div>
            <div class="hud-block">
              <span>耐久</span>
              <strong>${snapshot.hpText}</strong>
            </div>
            <div class="hud-block hud-block-wide">
              <span>阶段 / 节点</span>
              <strong>${snapshot.phaseLabel} · ${snapshot.nodeLabel}</strong>
            </div>
          </div>
          <div class="route-strip hud-route-strip">
            ${snapshot.routeProgress
              .map(
                (route) => `
                  <div class="route-chip ${route.active ? 'active' : ''}" style="--route-accent: ${route.color}">
                    <span>${route.label}</span>
                    <strong>${route.value}</strong>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  public showNodePanel(phaseLabel: string, options: NodeOption[], onChoose: (nodeId: string) => void): void {
    this.showPanel(
      `${phaseLabel}节点选择`,
      this.getNodePanelDescription(options),
      options.map(
        (node) => `
          <button class="choice-card map-choice" style="--choice-accent: ${NODE_TYPE_ACCENT_MAP[node.type]}" data-choice="${node.id}">
            <span class="choice-type">${NODE_TYPE_LABEL_MAP[node.type]}</span>
            <strong>${node.title}</strong>
            <small>${this.getNodeCardDescription(node)}</small>
          </button>
        `,
      ),
    );
    for (const node of options) {
      this.bindClick(`[data-choice="${node.id}"]`, () => onChoose(node.id));
    }
  }

  public showUpgradePanel(title: string, choices: UpgradeDefinition[], onChoose: (upgradeId: string) => void): void {
    this.showPanel(
      title,
      '选择 1 项强化，立即生效。',
      choices.map(
        (upgrade) => `
          <button class="choice-card" style="--choice-accent: ${this.getRouteAccent(upgrade.routeId)}" data-choice="${upgrade.id}">
            <span class="choice-type">${upgrade.routeId ? ROUTE_NAME_MAP[upgrade.routeId] : '通用'}</span>
            <span class="choice-rarity" style="--rarity-accent: ${RARITY_COLOR_MAP[upgrade.rarity]}">${upgrade.rarityLabel}</span>
            <strong>${upgrade.name}</strong>
            <small>${upgrade.description}</small>
          </button>
        `,
      ),
    );
    for (const upgrade of choices) {
      this.bindClick(`[data-choice="${upgrade.id}"]`, () => onChoose(upgrade.id));
    }
  }

  public showEventPanel(eventDef: EventDefinition, onChoose: (optionId: string) => void): void {
    const contentLabel = eventDef.contentKind === 'anomaly' ? '异常' : '事件';
    this.showPanel(
      `${contentLabel} · ${eventDef.name}`,
      this.getEventPanelDescription(eventDef),
      eventDef.options.map(
        (option) => `
          <button class="choice-card" style="--choice-accent: ${this.getRouteAccent(option.routeId)}" data-choice="${option.id}">
            <span class="choice-type">${this.getOptionTypeLabel(option.routeId, eventDef.contentKind)}</span>
            <strong>${option.label}</strong>
            <small>${this.getEventOptionDescription(option)}</small>
          </button>
        `,
      ),
    );
    for (const option of eventDef.options) {
      this.bindClick(`[data-choice="${option.id}"]`, () => onChoose(option.id));
    }
  }

  public showResult(result: RunResult, actions: ResultActions): void {
    this.hideHud();
    this.hidePanel();
    this.clearToasts();
    this.screenLayer.classList.remove('hidden');
    this.screenLayer.innerHTML = `
      <section class="menu-card result-card">
        <div class="surface-mark">
          <span class="surface-dot"></span>
          <span class="surface-dot"></span>
          <span class="surface-dot"></span>
        </div>
        <p class="eyebrow">${result.outcome === 'victory' ? '试飞完成' : '试飞中止'}</p>
        <h1>${result.outcome === 'victory' ? '本局已完成收束' : '这局还差一口气就能收稳'}</h1>
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
            <strong>${result.routeId ? ROUTE_NAME_MAP[result.routeId] : '未站稳'}</strong>
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
          <p class="panel-description">本局从 ${result.routeId ? ROUTE_NAME_MAP[result.routeId] : '未站稳'} 起势，最终以 ${result.endingLabel} 收尾。</p>
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

  private showPanel(title: string, description: string, items: string[]): void {
    this.screenLayer.classList.add('hidden');
    this.panelLayer.classList.remove('hidden');
    this.panelLayer.innerHTML = `
      <section class="floating-panel">
        <div class="surface-mark">
          <span class="surface-dot"></span>
          <span class="surface-dot"></span>
          <span class="surface-dot"></span>
        </div>
        <p class="eyebrow">${title}</p>
        <p class="panel-description">${description}</p>
        <div class="choice-grid">${items.join('')}</div>
      </section>
    `;
  }

  private bindClick(selector: string, handler: () => void): void {
    const target = this.root.querySelector<HTMLElement>(selector);
    if (target) {
      target.onclick = handler;
    }
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

  private getNodeCardDescription(node: NodeOption): string {
    switch (node.type) {
      case 'battle':
        return `${getBattleEncounterLabel(node.templateId ?? 'elimination')} · ${node.description}`;
      case 'upgrade':
        return node.isFinalPrep ? '最后一次整备。' : node.description;
      case 'anomaly':
        return node.description;
      case 'boss':
        return node.description;
      default:
        return node.description;
    }
  }

  private getNodePanelDescription(options: NodeOption[]): string {
    const phase = options[0]?.phase;
    switch (phase) {
      case 'opening':
        return '前段先把节奏立住，尽快读清战斗、强化和异常窗口。';
      case 'mid':
        return '中段开始收束构筑，补短板的同时保留异常转向机会。';
      case 'late':
        return '后段准备收尾，优先稳住生存、输出和下一站节奏。';
      case 'finalPrep':
        return '最后一次整备，补完这一手后会直接进入 Boss 收尾。';
      case 'finalBattle':
        return '最终收尾入口已锁定，这一战会决定本局结算。';
      default:
        return '选择下一站。';
    }
  }

  private getEventPanelDescription(eventDef: EventDefinition): string {
    if (eventDef.contentKind !== 'anomaly') {
      return '选择一项处理方案。';
    }

    switch (eventDef.anomalyClass) {
      case 'routeWindow':
        return '异常改道窗口已打开，选一条更偏航的处理方案。';
      case 'distortion':
        return '异常扭曲已压到面前，选一段代价或收益。';
      case 'hybrid':
        return '异常并轨样本已出现，选一段混搭处理方案。';
      case 'bossEcho':
        return 'Boss 阴影样本已外泄，先决定一段收尾准备。';
      default:
        return '异常窗口已打开，选择一项处理方案。';
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
}
