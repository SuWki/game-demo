import { RARITY_COLOR_MAP } from '../data/balance';
import { ROUTE_COLOR_MAP, ROUTE_NAME_MAP } from '../data/routes';
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
        <div class="hud-kicker">
          <span class="hud-kicker-label">当前读数</span>
          <strong>${snapshot.battleText}</strong>
        </div>
        <div class="hud-layout">
          <div class="hud-bar">
            <div class="hud-block">
              <span>等级</span>
              <strong>${snapshot.levelText}</strong>
            </div>
            <div class="hud-block">
              <span>经验</span>
              <strong>${snapshot.experienceText}</strong>
            </div>
            <div class="hud-block">
              <span>阶段</span>
              <strong>${snapshot.phaseLabel}</strong>
            </div>
            <div class="hud-block">
              <span>节点</span>
              <strong>${snapshot.nodeLabel}</strong>
            </div>
            <div class="hud-block">
              <span>耐久</span>
              <strong>${snapshot.hpText}</strong>
            </div>
          </div>
          <div class="route-panel">
            <div class="route-panel-head">
              <span>路线读数</span>
              <strong>倾向 / 站稳 / 成型</strong>
            </div>
            <div class="route-strip">
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
      </div>
    `;
  }

  public showNodePanel(phaseLabel: string, options: NodeOption[], onChoose: (nodeId: string) => void): void {
    this.showPanel(
      `${phaseLabel}节点选择`,
      '选一条分支继续推进。战斗抢经验，强化补节奏，事件改走向。',
      options.map(
        (node) => `
          <button class="choice-card map-choice" style="--choice-accent: ${NODE_TYPE_ACCENTS[node.type]}" data-choice="${node.id}">
            <span class="choice-type">${NODE_TYPE_LABELS[node.type]}</span>
            <strong>${node.title}</strong>
            <small>${node.description}</small>
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
      '三选一补强当前节奏，优先把已经站稳的方向继续推高。',
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
    this.showPanel(
      eventDef.name,
      eventDef.description,
      eventDef.options.map(
        (option) => `
          <button class="choice-card" style="--choice-accent: ${this.getRouteAccent(option.routeId)}" data-choice="${option.id}">
            <span class="choice-type">${this.getOptionTypeLabel(option.routeId)}</span>
            <strong>${option.label}</strong>
            <small>${option.description}</small>
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
          <span class="menu-pill">收尾节点 ${result.finalNodeTitle}</span>
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

  private getOptionTypeLabel(routeId: EventDefinition['options'][number]['routeId']): string {
    if (!routeId || routeId === 'dominant') {
      return '事件';
    }
    return ROUTE_NAME_MAP[routeId];
  }

  private getRouteAccent(routeId?: UpgradeDefinition['routeId'] | EventDefinition['options'][number]['routeId']): string {
    if (!routeId || routeId === 'dominant') {
      return '#68d4ff';
    }
    return ROUTE_COLOR_MAP[routeId];
  }
}
