/**
 * HUD 快照构建器
 *
 * 从 GameScene 抽离的职责：把 RunEngine 的当前状态转成 OverlayController
 * 需要的 `OverlayHudSnapshot` 结构。包含阶段标签、目标说明、路线进度等。
 *
 * 设计要点：
 * - 纯数据计算，不接触 Phaser 的 Graphics / add / cameras。
 * - 通过构造函数注入 `RunEngine` 和 `ConfigLoader`。
 * - PHASE_TRACK 常量随之一并迁移，避免 GameScene 持有仅此处使用的常量。
 */

import { getPhaseLabel } from '../data/nodes';
import { getBattleEncounterLabel } from '../data/battleTemplates';
import {
  CRIT_BURST_CHAIN_MAX_HITS,
  CRIT_BURST_CHAIN_WINDOW_SEC,
  CRIT_COMBO_MAX_STACKS,
} from '../data/balance';
import { ROUTES, ROUTE_NAME_MAP, ROUTE_VISUAL_MAP } from '../data/routes';
import { createPanelStatSummary } from './renderHelpers';
import type { ConfigLoader } from '../systems/ConfigLoader';
import type { RunEngine } from '../systems/RunEngine';
import type {
  BattleState,
  OverlayHudSnapshot,
  PhaseId,
  RouteBuildStage,
  RouteId,
  ToastTone,
} from '../game/types';

const PHASE_TRACK: ReadonlyArray<{ phase: PhaseId; label: string }> = [
  { phase: 'opening', label: '开局' },
  { phase: 'mid', label: '中盘' },
  { phase: 'late', label: '收尾' },
  { phase: 'finalPrep', label: '强化' },
  { phase: 'finalBattle', label: 'Boss' },
];

export class HudComposer {
  constructor(
    private readonly engine: RunEngine,
    private readonly configLoader: ConfigLoader,
  ) {}

  /** 组装完整的 HUD 快照，每帧调用一次。 */
  createHudSnapshot(): OverlayHudSnapshot {
    const state = this.engine.getState();
    const routeStatusText = this.getRouteStatusText();
    const progressSnapshot = this.getRunProgressSnapshot();
    const objectiveSnapshot = this.getObjectiveSnapshot();
    const statusText = this.getHudModeText(state);

    return {
      phaseLabel: getPhaseLabel(state.phase),
      nodeLabel: state.currentNode?.title ?? '节点选择',
      hpText: `${Math.round(state.stats.hp)} / ${Math.round(state.stats.maxHp)}`,
      hpRatio: state.stats.hp / Math.max(1, state.stats.maxHp),
      levelText: `Lv.${state.level}`,
      experienceText: `${Math.round(state.experience)} / ${Math.round(state.experienceToNext)}`,
      experienceRatio: state.experience / Math.max(1, state.experienceToNext),
      routeStatusText,
      routeMomentText: undefined,
      routeMomentRouteId: undefined,
      routeProgress: ROUTES.map((route) => {
        const progressInfo = this.engine.getRouteBuildProgressInfo(route.id);
        const progressText = `${progressInfo.count}/${progressInfo.nextThreshold ?? progressInfo.count}`;
        const nextUnlockTooltip = progressInfo.nextStageId
          ? this.engine.getRouteStageUnlockDescription(route.id, progressInfo.nextStageId)
          : undefined;
        return {
          routeId: route.id,
          label: route.name,
          value: progressInfo.count,
          color: route.color,
          active: this.engine.getDominantRoute() === route.id,
          progressText,
          nextUnlockTooltip,
        };
      }).filter((route) => route.value > 0 || route.active),
      routeResources: this.getRouteResources(state),
      statSummary: createPanelStatSummary(state.stats),
      statusText,
      statusSubtext:
        state.status === 'battle' && state.battle ? this.getBattleStatusSubtext(state.battle) : progressSnapshot.progressDetail,
      progressLabel: progressSnapshot.progressLabel,
      progressDetail: progressSnapshot.progressDetail,
      phaseTrack: progressSnapshot.phaseTrack,
      objectiveLabel: objectiveSnapshot.objectiveLabel,
      objectiveText: objectiveSnapshot.objectiveText,
      objectiveDetail: objectiveSnapshot.objectiveDetail,
      objectiveProgressText: objectiveSnapshot.objectiveProgressText,
      objectiveTone: objectiveSnapshot.objectiveTone,
    };
  }

  // ============================================================
  // 流派核心资源条 — 让玩家能"看着资源条打爆发"
  // ============================================================

  /**
   * 返回当前需显示的流派资源条列表。
   *
   * 设计原则（保持 HUD 简洁）：
   * - 只显示**当前主导流派**的资源条，避免 hybrid 时 3 条堆叠成视觉噪音。
   * - 衰减倒计时不进 HUD（每帧抖动），只有**特殊事件窗口**才显示进度条。
   * - stacks=0 且无终结就绪且无事件窗口时返回空数组，HUD 整块隐藏。
   */
  getRouteResources(state: ReturnType<RunEngine['getState']>): Array<{
    routeId: RouteId;
    stacks: number;
    maxStacks: number;
    finisherReady: boolean;
    windowSec: number;
    windowMaxSec: number;
    windowLabel: string;
  }> {
    const battle = state.battle;
    if (!battle) {
      return [];
    }

    // 只显示主导流派 — 避免 hybrid 时 3 条堆叠
    const dominantRoute = state.maturedRoute ?? state.committedRoute ?? this.engine.getDominantRoute();
    if (!dominantRoute) {
      return [];
    }

    const stage = this.engine.getRouteBuildStage(dominantRoute);
    if (stage === 'unformed') {
      return [];
    }

    const resource = this.buildRouteResource(battle, dominantRoute);
    // stacks=0 且无终结就绪且无事件窗口 → 完全隐藏，避免 HUD 一直挂个空卡
    if (!resource) {
      return [];
    }
    if (resource.stacks === 0 && !resource.finisherReady && resource.windowSec <= 0) {
      return [];
    }
    return [resource];
  }

  /** 构造单条流派资源快照。返回 undefined 表示该流派当前不该出现在 HUD。 */
  private buildRouteResource(
    battle: BattleState,
    routeId: RouteId,
  ): {
    routeId: RouteId;
    stacks: number;
    maxStacks: number;
    finisherReady: boolean;
    windowSec: number;
    windowMaxSec: number;
    windowLabel: string;
  } | undefined {
    switch (routeId) {
      case 'crit': {
        // Crit：爆发连锁是特殊事件窗口，值得显示进度条
        const isBurstWindow = battle.critBurstChainSec > 0;
        return {
          routeId: 'crit',
          stacks: battle.critComboStacks,
          maxStacks: CRIT_COMBO_MAX_STACKS,
          finisherReady: battle.critFinisherReady,
          windowSec: isBurstWindow ? battle.critBurstChainSec : 0,
          windowMaxSec: CRIT_BURST_CHAIN_WINDOW_SEC,
          windowLabel: isBurstWindow
            ? `爆发 ${battle.critBurstChainCount}/${CRIT_BURST_CHAIN_MAX_HITS}`
            : battle.critFinisherReady
              ? '终结就绪'
              : '破绽累积',
        };
      }
      case 'pierce': {
        const markedCount = battle.pierceFractureMark.size;
        // 衰减倒计时（pierceChainDecaySec）每帧抖动，不进 HUD；只有标记数有意义
        return {
          routeId: 'pierce',
          stacks: battle.pierceChainStacks,
          maxStacks: 3,
          finisherReady: battle.pierceChainStacks >= 3,
          windowSec: 0,
          windowMaxSec: 0,
          windowLabel: markedCount > 0 ? `裂纹 ×${markedCount}` : '连锁累积',
        };
      }
      case 'dash': {
        // 衰减倒计时（dashMomentumDecaySec）每帧抖动，不进 HUD
        return {
          routeId: 'dash',
          stacks: battle.dashMomentumStacks,
          maxStacks: 5,
          finisherReady: battle.dashGhostStrikeReady,
          windowSec: 0,
          windowMaxSec: 0,
          windowLabel: battle.dashGhostStrikeReady ? '幽灵就绪' : '动量累积',
        };
      }
      default:
        return undefined;
    }
  }

  // ============================================================
  // 状态文本
  // ============================================================

  getBattleStatusText(battle: BattleState): string {
    if (battle.encounterType === 'boss' && (battle.elapsedSec < 0.95 || battle.pressureTransitionSec > 0 || battle.pressureSignatureSec > 0)) {
      return `Boss 进场 · ${this.getBattleIdentityLabel(battle)}`;
    }
    return `${getBattleEncounterLabel(battle.templateId, battle.encounterType)} · ${this.getBattleIdentityLabel(battle)}`;
  }

  getHudModeText(state: ReturnType<RunEngine['getState']>): string {
    if (state.status === 'battle' && state.battle) {
      return this.getBattleStatusText(state.battle);
    }
    if (state.status === 'upgradeChoice') {
      return state.currentNode?.isFinalPrep ? '最终强化' : '选择强化';
    }
    if (state.status === 'eventChoice') {
      return state.currentEvent?.contentKind === 'anomaly' ? '异常节点' : '选事件';
    }
    if (state.status === 'nodeChoice') {
      return '路线选择';
    }
    if (state.status === 'result') {
      return '战斗结算';
    }
    return this.getRouteStatusText();
  }

  getBattleIdentityLabel(battle: BattleState): string {
    const nodeTitle = this.engine.getState().currentNode?.title;
    if (battle.encounterType === 'boss') {
      return nodeTitle ?? this.configLoader.getBattleTemplate(battle.templateId).name;
    }
    return battle.label || nodeTitle || this.configLoader.getBattleTemplate(battle.templateId).name;
  }

  getBattleStatusSubtext(battle: BattleState): string {
    if (battle.encounterType === 'boss') {
      if (battle.elapsedSec < 0.95) {
        return '最终战入口';
      }
      if (battle.pressureSafeWindowSec > 0) {
        return 'Boss · 安全窗口';
      }
      if (battle.bossSafeWindowGraceSec > 0) {
        return `Boss · 倒计时 ${Math.ceil(battle.bossSafeWindowGraceSec)}秒`;
      }
      if (battle.pressureSignatureLabel || battle.pressurePatternLabel || battle.pressurePhaseLabel) {
        return `Boss · 出招：${battle.pressureSignatureLabel ?? battle.pressurePatternLabel ?? battle.pressurePhaseLabel}`;
      }
      return '';
    }

    if (this.configLoader.getBattleTemplate(battle.templateId).winCondition.type === 'survive') {
      return `生存倒计时：${Math.max(0, Math.ceil(battle.remainingSec))}秒`;
    }

    if (battle.remainingSec > 0) {
      return `奖励倒计时：${Math.ceil(battle.remainingSec)}秒`;
    }

    return '奖励倒计时结束';
  }

  // ============================================================
  // 面板 / 进度快照
  // ============================================================

  getPanelProgressSnapshot(): Pick<
    OverlayHudSnapshot,
    'progressLabel' | 'progressDetail' | 'phaseTrack' | 'levelText' | 'routeStatusText' | 'statSummary' | 'upgradeRewardLabel' | 'routeProgress'
  > {
    const state = this.engine.getState();
    const progress = this.getRunProgressSnapshot();
    return {
      progressLabel: progress.progressLabel,
      progressDetail: progress.progressDetail,
      phaseTrack: progress.phaseTrack,
      levelText: `Lv.${state.level}`,
      routeStatusText: this.getRouteStatusText(),
      statSummary: createPanelStatSummary(state.stats),
      upgradeRewardLabel: state.currentUpgradeIsReward ? '通关奖励' : undefined,
      routeProgress: this.createHudSnapshot().routeProgress,
    };
  }

  getBossDistanceText(currentStep: number, totalRounds: number): string {
    const remainingStops = Math.max(0, totalRounds - currentStep);
    if (remainingStops <= 0) {
      return 'Boss 已在眼前';
    }
    if (remainingStops === 1) {
      return '再过 1 站进 Boss';
    }
    return `距 Boss 还剩 ${remainingStops} 站`;
  }

  getUpgradePanelDescription(): string {
    const state = this.engine.getState();
    if (state.currentUpgradeIsReward) {
      return '奖励倒计时内完成关卡获得的额外强化。';
    }
    if (state.upgradeSource === 'levelUp') {
      return '战斗里立刻补一项强化。';
    }
    if (state.currentNode?.isFinalPrep) {
      return '最终强化，选完就进 Boss。';
    }
    return '补充当前需要的属性。';
  }

  getRunProgressSnapshot(): Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'> {
    const state = this.engine.getState();
    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const currentPhaseIndex = PHASE_TRACK.findIndex((entry) => entry.phase === state.phase);

    let progressDetail = '';
    if (state.phase === 'finalPrep') {
      progressDetail = '下一站是 Boss';
    } else if (state.phase === 'finalBattle') {
      progressDetail = 'Boss 战';
    }

    return {
      progressLabel: `${currentStep} / ${state.totalRounds}`,
      progressDetail,
      phaseTrack: PHASE_TRACK.map((entry, index) => {
        const step = index + 1;
        if (step < currentStep) {
          return { label: entry.label, state: 'done' as const };
        }
        if (step === currentStep) {
          return {
            label: entry.label,
            state: entry.phase === 'finalBattle' ? ('boss-active' as const) : ('active' as const),
          };
        }
        return {
          label: entry.label,
          state: entry.phase === 'finalBattle' ? ('boss-upcoming' as const) : ('upcoming' as const),
        };
      }),
    };
  }

  getObjectiveSnapshot(): Pick<
    OverlayHudSnapshot,
    'objectiveLabel' | 'objectiveText' | 'objectiveDetail' | 'objectiveProgressText' | 'objectiveTone'
  > {
    const state = this.engine.getState();
    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const bossDistanceText = this.getBossDistanceText(currentStep, state.totalRounds);

    if (state.status === 'battle' && state.battle) {
      const battle = state.battle;
      if (battle.encounterType === 'boss') {
        return {
          objectiveLabel: '先盯 Boss',
          objectiveText: '击败 Boss 本体',
          objectiveDetail: '先把金色血条打下来，旁边的小怪会跟着散。',
          objectiveProgressText: battle.eliteAlive ? '击败 Boss' : 'Boss 即将进场',
          objectiveTone: 'boss',
        };
      }

      const winCondition = this.configLoader.getBattleTemplate(battle.templateId).winCondition.type;
      if (winCondition === 'elite') {
        return this.getEliteObjectiveSnapshot(battle);
      }

      if (winCondition === 'survive') {
        return {
          objectiveLabel: '先活下来',
          objectiveText: '撑到倒计时结束',
          objectiveDetail: '只要活到计时归零就能过关。',
          objectiveProgressText: `生存 ${Math.max(0, Math.ceil(battle.remainingSec))} 秒`,
          objectiveTone: 'survive',
        };
      }

      return {
        objectiveLabel: '清理当前波次',
        objectiveText: '消灭当前波次敌人',
        objectiveDetail: `消灭 ${battle.targetKills} 个敌人后即可推进。奖励倒计时内完成可额外获得 1 张强化卡牌。`,
        objectiveProgressText: `${battle.kills} / ${battle.targetKills} 击杀`,
        objectiveTone: 'battle',
      };
    }

    if (state.status === 'nodeChoice') {
      const hasBossNode = state.nodeOptions.some((node) => node.type === 'boss');
      const hasFinalPrepNode = state.nodeOptions.some((node) => node.isFinalPrep);

      if (state.phase === 'finalBattle' || hasBossNode) {
        return {
          objectiveLabel: '眼下先做',
          objectiveText: '选定最终战',
          objectiveDetail: '选定后马上进 Boss。',
          objectiveProgressText: 'Boss 战入口',
          objectiveTone: 'flow',
        };
      }

      if (state.phase === 'finalPrep' || hasFinalPrepNode) {
        return {
          objectiveLabel: '眼下先做',
          objectiveText: '先进最终强化',
          objectiveDetail: '完成选择后进入首领战。',
          objectiveProgressText: '强化完就进 Boss',
          objectiveTone: 'flow',
        };
      }

      return {
        objectiveLabel: '眼下先做',
        objectiveText: '选择下一站',
        objectiveDetail: `现在打到第 ${currentStep} / ${state.totalRounds} 站。`,
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'upgradeChoice') {
      return {
        objectiveLabel: '眼下先做',
        objectiveText: state.currentNode?.isFinalPrep ? '完成最终强化' : '完成强化选择',
        objectiveDetail: state.upgradeSource === 'levelUp' ? '选择后立即返回战场。' : '选择后继续推进。',
        objectiveProgressText: state.currentNode?.isFinalPrep ? '选完直接进 Boss' : bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'eventChoice') {
      return {
        objectiveLabel: '眼下先做',
        objectiveText: state.currentEvent?.contentKind === 'anomaly' ? '接住这个转折' : '把这步选完',
        objectiveDetail: '选完就接着往前打。',
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    return {
      objectiveLabel: '眼下先做',
      objectiveText: '准备进入下一局',
      objectiveDetail: '换个流派，再试一次。',
      objectiveProgressText: bossDistanceText,
      objectiveTone: 'flow',
    };
  }

  getEliteObjectiveSnapshot(
    battle: BattleState,
  ): Pick<OverlayHudSnapshot, 'objectiveLabel' | 'objectiveText' | 'objectiveDetail' | 'objectiveProgressText' | 'objectiveTone'> {
    const escortCount = battle.enemies.filter((enemy) => !enemy.elite && enemy.role === 'escort' && enemy.hp > 0).length;
    const crackRatio = battle.eliteCrackWindowSec > 0 ? Math.min(1, battle.eliteCrackWindowSec / 0.82) : 0;
    const breachFlashRatio = battle.eliteBreachFlashSec > 0 ? Math.min(1, battle.eliteBreachFlashSec / 0.48) : 0;
    const displayedCrackRatio = Math.max(crackRatio, breachFlashRatio * 0.92);

    if (!battle.eliteAlive) {
      return {
        objectiveLabel: '精英目标',
        objectiveText: '坚持到精英进场',
        objectiveDetail: '先保住站位和血量，别急着抢节奏。',
        objectiveProgressText: '精英即将进场',
        objectiveTone: 'elite',
      };
    }

    if (displayedCrackRatio > 0.1) {
      return {
        objectiveLabel: '精英目标',
        objectiveText: '裂口已开，集中攻击本体',
        objectiveDetail: '趁护卫散开，集中打精英。',
        objectiveProgressText: `暴露 ${battle.eliteCrackWindowSec.toFixed(1)}s · 破口 ${Math.max(1, battle.eliteCrackEscortCount)}`,
        objectiveTone: 'elite',
      };
    }

    if (escortCount > 0) {
      return {
        objectiveLabel: '精英目标',
        objectiveText: '先拆护卫，等裂口',
        objectiveDetail: '先清掉护卫，再集中打精英。',
        objectiveProgressText: `护卫剩余 ${escortCount}`,
        objectiveTone: 'elite',
      };
    }

    return {
      objectiveLabel: '精英目标',
      objectiveText: '盯住精英本体',
      objectiveDetail: '护卫压力降低，集中打精英。',
      objectiveProgressText: `${this.configLoader.getBattleTemplate(battle.templateId).name} · 本体收尾`,
      objectiveTone: 'elite',
    };
  }

  // ============================================================
  // 路线状态文本
  // ============================================================

  getRouteStatusText(): string {
    const state = this.engine.getState();
    const routeId = state.maturedRoute ?? state.committedRoute ?? this.engine.getDominantRoute();
    if (!routeId) {
      return '';
    }

    const stage = this.engine.getRouteBuildStage(routeId);
    const stageText = this.getRouteStageStatusText(routeId, stage);
    const icon = ROUTE_VISUAL_MAP[routeId].icon;
    const progressInfo = this.engine.getRouteBuildProgressInfo(routeId);
    const progressSuffix = progressInfo.nextThreshold
      ? ` (${progressInfo.count}/${progressInfo.nextThreshold})`
      : '';
    const base = stageText ? `${icon} ${ROUTE_NAME_MAP[routeId]} · ${stageText}` : `${icon} ${ROUTE_NAME_MAP[routeId]}`;
    return base + progressSuffix;
  }

  getRouteStageStatusText(routeId: RouteId, stage: RouteBuildStage): string {
    switch (routeId) {
      case 'crit':
        if (stage === 'matured') return '越打越重';
        if (stage === 'committed') return '连着出重击';
        if (stage === 'hinted') return '开始成型';
        return '尚未成型';
      case 'pierce':
        if (stage === 'matured') return '一路打穿';
        if (stage === 'committed') return '前后连上';
        if (stage === 'hinted') return '开始成线';
        return '尚未成型';
      case 'dash':
        if (stage === 'matured') return '越打越顺';
        if (stage === 'committed') return '反击接上';
        if (stage === 'hinted') return '贴身就位';
        return '尚未成型';
      default:
        return '';
    }
  }

  /** 从一段提示文本推断 toast 语气。 */
  getToastTone(text: string): ToastTone {
    if (text.includes('绿色安全区') || text.includes('安全区')) {
      return 'route';
    }
    if (text.includes('精英') || text.includes('高压') || text.includes('压力') || text.includes('Boss')) {
      return 'danger';
    }
    if (text.includes('成型') || text.includes('连击') || text.includes('暴击') || text.includes('穿透') || text.includes('穿梭')) {
      return 'route';
    }
    if (text.includes('完成') || text.includes('接入') || text.includes('收住')) {
      return 'success';
    }
    if (text.includes('进入') || text.includes('开局') || text.includes('中盘') || text.includes('收尾') || text.includes('强化')) {
      return 'accent';
    }
    return 'neutral';
  }
}
