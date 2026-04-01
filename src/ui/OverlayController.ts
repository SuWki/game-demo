import { ROUTE_NAME_MAP } from '../data/routes';
import type {
  EventDefinition,
  NodeOption,
  OverlayHudSnapshot,
  OverlayMetaSummary,
  RunResult,
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
      <section class="menu-card">
        <p class="eyebrow">短局试玩版</p>
        <h1>节点式自动射击 Demo</h1>
        <p class="lead">在短局节点推进里读懂节奏，围绕暴击、穿透、穿梭逐步成型。</p>
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
      <div class="hud-bar">
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
        <div class="hud-block wide">
          <span>战斗读数</span>
          <strong>${snapshot.battleText}</strong>
        </div>
      </div>
      <div class="route-strip">
        ${snapshot.routeProgress
          .map(
            (route) => `
              <div class="route-chip ${route.active ? 'active' : ''}">
                <span>${route.label}</span>
                <strong>${route.value}</strong>
              </div>
            `,
          )
          .join('')}
      </div>
    `;
  }

  public showNodePanel(phaseLabel: string, options: NodeOption[], onChoose: (nodeId: string) => void): void {
    this.showPanel(
      `${phaseLabel}节点选择`,
      '战斗是抢成长，强化是稳修正，事件是拐方向。',
      options.map(
        (node) => `
          <button class="choice-card" data-choice="${node.id}">
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
      '从三项中选一项，继续把当前方向扶起来。',
      choices.map(
        (upgrade) => `
          <button class="choice-card" data-choice="${upgrade.id}">
            <span class="choice-type">${upgrade.routeId ? ROUTE_NAME_MAP[upgrade.routeId] : '通用'}</span>
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
          <button class="choice-card" data-choice="${option.id}">
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
        <p class="eyebrow">${result.outcome === 'victory' ? '试飞完成' : '试飞中止'}</p>
        <h1>${result.outcome === 'victory' ? '本局已完成收束' : '这局还差一点就能收稳'}</h1>
        <p class="lead">${result.summary}</p>
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
        </div>
        <p class="panel-description">${result.buildSummary}，${result.endingReason}。</p>
        <p class="panel-description">收尾节点：${result.finalNodeTitle} · 战斗胜场 ${result.battleWins} · 推进节点 ${result.nodesCleared} · 时长 ${result.runDurationSec.toFixed(1)}s</p>
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

  public pushToast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
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

  private showPanel(title: string, description: string, items: string[]): void {
    this.screenLayer.classList.add('hidden');
    this.panelLayer.classList.remove('hidden');
    this.panelLayer.innerHTML = `
      <section class="floating-panel">
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
}
