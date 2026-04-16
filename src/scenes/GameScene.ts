import Phaser from 'phaser';
import { ARENA_HEIGHT, ARENA_WIDTH, clamp, getPlayerMoveSpeed } from '../data/balance';
import { BATTLE_TEMPLATES, getBattleEncounterLabel } from '../data/battleTemplates';
import { getPhaseLabel } from '../data/nodes';
import { ROUTES, ROUTE_COLOR_MAP, ROUTE_NAME_MAP } from '../data/routes';
import type { BattleState, OverlayHudSnapshot, Services, ToastTone } from '../game/types';
import { RunEngine } from '../systems/RunEngine';

const XP_ORB_FILL = 0x67f08b;
const XP_ORB_STROKE = 0xcfffd7;
const ENEMY_PROJECTILE_FILL = 0xff5b63;
const ENEMY_PROJECTILE_TRAIL = 0xff8e95;
const ENEMY_PROJECTILE_STROKE = 0xffd0d4;
const TERRAIN_TILE_SIZE = 112;
const TERRAIN_BLOT_SIZE = 280;
/*
const PHASE_TRACK = [
  { phase: 'opening', label: '前段' },
  { phase: 'mid', label: '中段' },
  { phase: 'late', label: '后段' },
  { phase: 'finalPrep', label: '整备' },
  { phase: 'finalBattle', label: 'Boss' },
] as const;
*/
const PHASE_TRACK = [
  { phase: 'opening', label: '前段' },
  { phase: 'mid', label: '中段' },
  { phase: 'late', label: '后段' },
  { phase: 'finalPrep', label: '整备' },
  { phase: 'finalBattle', label: 'Boss' },
] as const;

export class GameScene extends Phaser.Scene {
  private services!: Services;

  private engine!: RunEngine;

  private graphics!: Phaser.GameObjects.Graphics;

  private moveKeys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private arrowKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  private resultHandled = false;

  private lastHudKey = '';

  private lastPanelKey = '';

  public constructor() {
    super('GameScene');
  }

  public create(): void {
    this.services = this.game.registry.get('services') as Services;
    this.services.audio.unlock();
    this.services.audio.setMusic('battle');
    this.engine = new RunEngine(this.services);
    this.graphics = this.add.graphics();
    this.moveKeys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as GameScene['moveKeys'];
    this.arrowKeys = this.input.keyboard!.createCursorKeys();
    this.resultHandled = false;
    this.lastHudKey = '';
    this.lastPanelKey = '';
    this.syncOverlay();
    this.processAnnouncements();
  }

  public update(_: number, delta: number): void {
    this.engine.setInputState({
      up: this.moveKeys.up.isDown || this.arrowKeys.up.isDown,
      down: this.moveKeys.down.isDown || this.arrowKeys.down.isDown,
      left: this.moveKeys.left.isDown || this.arrowKeys.left.isDown,
      right: this.moveKeys.right.isDown || this.arrowKeys.right.isDown,
    });
    this.engine.tick(delta);
    const state = this.engine.getState();
    this.syncAudioState(state);
    this.processAnnouncements();
    this.syncOverlay();
    this.renderBattle();
    if (!this.resultHandled && state.status === 'result' && state.result) {
      this.resultHandled = true;
      this.services.meta.recordRun(state.result);
      this.scene.start('ResultScene', {
        result: state.result,
      });
    }
  }

  public getBattleDebugSnapshot():
    | {
        status: string;
        phase: string;
        templateId: string | null;
        encounterType: string | null;
        eliteAlive: boolean;
        eliteRecoverySec: number;
        elitePressureSec: number;
        escortCount: number;
        escortRecoveryCount: number;
      }
    | null {
    const state = this.engine.getState();
    const battle = state.battle;
    if (!battle) {
      return {
        status: state.status,
        phase: state.phase,
        templateId: null,
        encounterType: null,
        eliteAlive: false,
        eliteRecoverySec: 0,
        elitePressureSec: 0,
        escortCount: 0,
        escortRecoveryCount: 0,
      };
    }

    const elite = battle.enemies.find((enemy) => enemy.elite && enemy.hp > 0) ?? null;
    const escorts = battle.enemies.filter((enemy) => !enemy.elite && enemy.role === 'escort' && enemy.hp > 0);
    return {
      status: state.status,
      phase: state.phase,
      templateId: battle.templateId,
      encounterType: battle.encounterType,
      eliteAlive: battle.eliteAlive,
      eliteRecoverySec: elite?.recoverySec ?? 0,
      elitePressureSec: elite?.pressurePulseSec ?? 0,
      escortCount: escorts.length,
      escortRecoveryCount: escorts.filter((enemy) => enemy.recoverySec > 0.08).length,
    };
  }

  /*
  private syncOverlay(): void {
    const state = this.engine.getState();
    const hudSnapshot = this.createHudSnapshot();
    const hudKey = JSON.stringify(hudSnapshot);
    if (hudKey !== this.lastHudKey) {
      this.services.overlay.showHud(hudSnapshot);
      this.lastHudKey = hudKey;
    }

    if (state.status === 'battle') {
      this.services.overlay.clearToasts();
      if (this.lastPanelKey) {
        this.services.overlay.hidePanel();
        this.lastPanelKey = '';
      }
      return;
    }

    if (state.status === 'nodeChoice') {
      const panelKey = `node:${state.phase}:${state.nodeOptions.map((node) => node.id).join('|')}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.audio.play('click');
        this.services.overlay.showNodePanel(
          getPhaseLabel(state.phase),
          state.nodeOptions,
          this.getPanelProgressSnapshot(),
          (nodeId) => {
            this.services.audio.play('confirm');
            this.engine.chooseNode(nodeId);
            this.processAnnouncements();
            this.syncOverlay();
          },
        );
        this.lastPanelKey = panelKey;
      }
      return;
    }

    if (state.status === 'upgradeChoice') {
      const panelKey = `upgrade:${state.phase}:${state.upgradeChoices.map((upgrade) => upgrade.id).join('|')}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.audio.play(state.upgradeSource === 'levelUp' ? 'upgrade' : 'confirm');
        const panelTitle =
          state.upgradeSource === 'levelUp'
            ? `等级提升 Lv.${state.level}`
            : state.currentNode?.isFinalPrep
              ? '最终整备'
              : `${getPhaseLabel(state.phase)}强化`;
        this.services.overlay.showUpgradePanel(
          panelTitle,
          this.getUpgradePanelDescription(),
          this.getPanelProgressSnapshot(),
          state.upgradeChoices,
          (upgradeId) => {
            this.engine.chooseUpgrade(upgradeId);
            this.processAnnouncements();
            this.syncOverlay();
          },
        );
        this.lastPanelKey = panelKey;
      }
      return;
    }

    if (state.status === 'eventChoice' && state.currentEvent) {
      const panelKey = `event:${state.currentEvent.id}:${state.currentEvent.options.map((option) => option.id).join('|')}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.audio.play(state.currentEvent.contentKind === 'anomaly' ? 'anomaly' : 'confirm');
        this.services.overlay.showEventPanel(state.currentEvent, this.getPanelProgressSnapshot(), (optionId) => {
          this.engine.chooseEventOption(optionId);
          this.processAnnouncements();
          this.syncOverlay();
        });
        this.lastPanelKey = panelKey;
      }
      return;
    }

    if (this.lastPanelKey) {
      this.services.overlay.hidePanel();
      this.lastPanelKey = '';
    }
  }

  private processAnnouncements(): void {
    for (const item of this.engine.drainAnnouncements()) {
      if (item.kind === 'tip' && item.text) {
        const tone = this.getToastTone(item.text);
        const forceBattleToast = item.text.includes('Boss 已进场') || item.text.includes('首领已进场');
        if (this.shouldDisplayToast(tone) || forceBattleToast) {
          this.services.overlay.pushToast(item.text, tone);
        }
      }

      if (item.kind === 'audio' && item.cue) {
        this.services.audio.play(item.cue);
      }
    }
  }

  private syncAudioState(state: ReturnType<RunEngine['getState']>): void {
    if (state.phase === 'finalBattle' || (state.status === 'battle' && state.battle?.encounterType === 'boss')) {
      this.services.audio.setMusic('boss');
      return;
    }

    if (state.status === 'result') {
      this.services.audio.setMusic('result');
      return;
    }

    this.services.audio.setMusic('battle');
  }

  private createHudSnapshot(): OverlayHudSnapshot {
    const state = this.engine.getState();
    const routeStatusText = this.getRouteStatusText();
    const progressSnapshot = this.getRunProgressSnapshot();
    const objectiveSnapshot = this.getObjectiveSnapshot();
    const statusText =
      state.status === 'battle' && state.battle ? this.getBattleStatusText(state.battle) : routeStatusText;

    return {
      phaseLabel: getPhaseLabel(state.phase),
      nodeLabel: state.currentNode?.title ?? '节点选择',
      hpText: `${Math.ceil(state.stats.hp)} / ${state.stats.maxHp}`,
      hpRatio: state.stats.hp / Math.max(1, state.stats.maxHp),
      levelText: `Lv.${state.level}`,
      experienceText: `${Math.floor(state.experience)} / ${state.experienceToNext}`,
      experienceRatio: state.experience / Math.max(1, state.experienceToNext),
      routeStatusText,
      routeProgress: ROUTES.map((route) => ({
        routeId: route.id,
        label: route.name,
        value: state.routeCounts[route.id],
        color: route.color,
        active: this.engine.getDominantRoute() === route.id,
      })).filter((route) => route.value > 0 || route.active),
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

  private getBattleStatusText(battle: BattleState): string {
    return `${getBattleEncounterLabel(battle.templateId, battle.encounterType)} · ${this.getBattleIdentityLabel(battle)}`;
  }

  private getBattleIdentityLabel(battle: BattleState): string {
    const nodeTitle = this.engine.getState().currentNode?.title;
    if (battle.encounterType === 'boss') {
      return nodeTitle ?? BATTLE_TEMPLATES[battle.templateId].name;
    }

    return battle.label || nodeTitle || BATTLE_TEMPLATES[battle.templateId].name;
  }

  private getBattleStatusSubtext(battle: BattleState): string {
    const summaryParts: string[] = [];
    if (battle.encounterType === 'boss') {
      summaryParts.push(battle.eliteAlive ? 'Boss 已进场' : 'Boss 即将进场');
    }
    if (battle.pressurePhaseLabel) {
      summaryParts.push(`阶段 ${battle.pressurePhaseLabel}`);
    }
    if (battle.pressureSignatureLabel) {
      summaryParts.push(`招式 ${battle.pressureSignatureLabel}`);
    } else if (battle.pressurePatternLabel) {
      summaryParts.push(`区域 ${battle.pressurePatternLabel}`);
    }
    return summaryParts.join(' / ') || BATTLE_TEMPLATES[battle.templateId].description;

    const parts: string[] = [];

    if (battle.encounterType === 'boss') {
      parts.push(battle.eliteAlive ? '首领已进场' : '首领即将进场');
      parts.push(battle.eliteAlive ? '金色血条与箭头标记就是 Boss' : '金色血条出现后优先锁定首领');
    }

    if (battle.pressurePhaseLabel) {
      parts.push(`阶段 ${battle.pressurePhaseLabel}`);
    }

    if (battle.pressureSignatureLabel) {
      parts.push(`招式 ${battle.pressureSignatureLabel}`);
    } else if (battle.pressurePatternLabel) {
      parts.push(`空间 ${battle.pressurePatternLabel}`);
    }

    return parts.join(' · ') || BATTLE_TEMPLATES[battle.templateId].description;
  }

  private getPanelProgressSnapshot(): Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'> {
    const progress = this.getRunProgressSnapshot();
    return {
      progressLabel: progress.progressLabel,
      progressDetail: progress.progressDetail,
      phaseTrack: progress.phaseTrack,
    };
  }

  private getBossDistanceText(currentStep: number, totalRounds: number): string {
    const remainingStops = Math.max(0, totalRounds - currentStep);
    if (remainingStops <= 0) {
      return 'Boss 已在眼前';
    }
    if (remainingStops === 1) {
      return '再过 1 站进 Boss';
    }
    return `距 Boss 还剩 ${remainingStops} 站`;

    const remainingStops = Math.max(0, totalRounds - currentStep);
    if (remainingStops <= 0) {
      return 'Boss 已登场';
    }
    if (remainingStops === 1) {
      return '再推进 1 站就进 Boss';
    }
    return `离 Boss 还剩 ${remainingStops} 站`;
  }

  private getUpgradePanelDescription(): string {
    const state = this.engine.getState();
    if (state.upgradeSource === 'levelUp') {
      return '战斗里立刻补一项强化。';
    }
    if (state.currentNode?.isFinalPrep) {
      return '最后一手补强，选完直接进 Boss。';
    }
    return '补当前打法最缺的一拍。';

    if (state.upgradeSource === 'levelUp') {
      return '这是战斗内升级，选完 1 项强化后会立刻回到当前战斗。';
    }
    if (state.currentNode?.isFinalPrep) {
      return '这是 Boss 前最后一次整备，选完后会直接进入最终战。';
    }
    return '选择 1 项强化，补完这一手后继续推进。';
  }

  private getRunProgressSnapshot(): Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'> {
    const state = this.engine.getState();
    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const currentPhaseLabel = getPhaseLabel(state.phase);
    const currentPhaseIndex = PHASE_TRACK.findIndex((entry) => entry.phase === state.phase);
    const bossDistanceText = this.getBossDistanceText(currentStep, state.totalRounds);
    const nextPhaseLabel =
      currentPhaseIndex >= 0 && currentPhaseIndex < PHASE_TRACK.length - 1 ? PHASE_TRACK[currentPhaseIndex + 1].label : null;
    let compactDetail = `${currentPhaseLabel}推进中，${bossDistanceText}。`;
    if (state.phase === 'finalPrep') {
      compactDetail = '最后整备，选完直接进 Boss。';
    } else if (state.phase === 'finalBattle') {
      compactDetail = '最终战已开始，这一战决定本局收束。';
    } else if (nextPhaseLabel) {
      compactDetail = `过完这一站进入${nextPhaseLabel}。`;
    }

    return {
      progressLabel: `推进 ${currentStep} / ${state.totalRounds} / ${bossDistanceText}`,
      progressDetail: compactDetail,
      phaseTrack: PHASE_TRACK.map((entry, index) => {
        const step = index + 1;
        if (step < currentStep) {
          return {
            label: entry.label,
            state: 'done' as const,
          };
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

    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const currentPhaseLabel = getPhaseLabel(state.phase);
    const currentPhaseIndex = PHASE_TRACK.findIndex((entry) => entry.phase === state.phase);
    const bossDistanceText = this.getBossDistanceText(currentStep, state.totalRounds);
    const nextPhaseLabel =
      currentPhaseIndex >= 0 && currentPhaseIndex < PHASE_TRACK.length - 1 ? PHASE_TRACK[currentPhaseIndex + 1].label : null;

    let detail = `当前是${currentPhaseLabel}，${bossDistanceText}。`;
    if (state.phase === 'finalPrep') {
      detail = '这是 Boss 前最后一次整备，选完这一手就会进入最终战。';
    } else if (state.phase === 'finalBattle') {
      detail = '最终 Boss 已登场，本局结果就看这一战能不能收住。';
    } else if (nextPhaseLabel) {
      detail = `当前是${currentPhaseLabel}，完成这一站后进入${nextPhaseLabel}。${bossDistanceText}。`;
    }

    return {
      progressLabel: `推进 ${currentStep} / ${state.totalRounds} · ${bossDistanceText}`,
      progressDetail: detail,
      phaseTrack: PHASE_TRACK.map((entry, index) => {
        const step = index + 1;
        if (step < currentStep) {
          return {
            label: entry.label,
            state: 'done' as const,
          };
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

  private getObjectiveSnapshot(): Pick<
    OverlayHudSnapshot,
    'objectiveLabel' | 'objectiveText' | 'objectiveDetail' | 'objectiveProgressText' | 'objectiveTone'
  > {
    const state = this.engine.getState();
    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const bossDistanceText = this.getBossDistanceText(currentStep, state.totalRounds);
    if (state.status === 'battle' && state.battle) {
      const battle = state.battle;
      const targetTitle = this.getBattleIdentityLabel(battle);
      if (battle.encounterType === 'boss') {
        return {
          objectiveLabel: 'Boss 目标',
          objectiveText: '击败场上首领',
          objectiveDetail: '盯住金色血条首领。',
          objectiveProgressText: battle.eliteAlive ? `${targetTitle} / 终结首领` : '首领即将进场',
          objectiveTone: 'boss',
        };
      }

      const winCondition = BATTLE_TEMPLATES[battle.templateId].winCondition.type;
      if (winCondition === 'elite') {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '击败精英',
          objectiveDetail: '先拆护卫，再打本体。',
          objectiveProgressText: battle.eliteAlive ? '精英已进场' : '精英即将进场',
          objectiveTone: 'elite',
        };
      }

      if (winCondition === 'survive') {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '撑到倒计时结束',
          objectiveDetail: '先稳住站位和血量。',
          objectiveProgressText: `剩余 ${Math.ceil(battle.remainingSec)}s`,
          objectiveTone: 'survive',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '击破敌群',
        objectiveDetail: '清够数量就能推进。',
        objectiveProgressText: `${battle.kills} / ${battle.targetKills}`,
        objectiveTone: 'battle',
      };
    }

    if (state.status === 'nodeChoice') {
      const hasBossNode = state.nodeOptions.some((node) => node.type === 'boss');
      const hasFinalPrepNode = state.nodeOptions.some((node) => node.isFinalPrep);

      if (state.phase === 'finalBattle' || hasBossNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '确认最终战',
          objectiveDetail: '选定后立刻进 Boss。',
          objectiveProgressText: '最终收束入口',
          objectiveTone: 'flow',
        };
      }

      if (state.phase === 'finalPrep' || hasFinalPrepNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '进入最终整备',
          objectiveDetail: '最后补一手再进 Boss。',
          objectiveProgressText: '整备后进入 Boss',
          objectiveTone: 'flow',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '选择下一站',
        objectiveDetail: `第 ${currentStep} / ${state.totalRounds} 站`,
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'upgradeChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentNode?.isFinalPrep ? '完成最终整备' : '完成强化选择',
        objectiveDetail: state.upgradeSource === 'levelUp' ? '选完立刻回战斗。' : '补完这一手继续推进。',
        objectiveProgressText: state.currentNode?.isFinalPrep ? '选完直接进 Boss' : bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'eventChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentEvent?.contentKind === 'anomaly' ? '完成异常处理' : '完成事件选择',
        objectiveDetail: '处理完继续推进。',
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    return {
      objectiveLabel: '当前目标',
      objectiveText: '准备进入下一局',
      objectiveDetail: '把一条路线收成型。',
      objectiveProgressText: bossDistanceText,
      objectiveTone: 'flow',
    };

    if (state.status === 'battle' && state.battle) {
      const battle = state.battle;
      const targetTitle = this.getBattleIdentityLabel(battle);
      if (battle.encounterType === 'boss') {
        return {
          objectiveLabel: 'Boss 目标',
          objectiveText: '击败场上首领',
          objectiveDetail: `${targetTitle} 就是本局 Boss。盯住场上的大体型首领与金色血条，击破即可过关。`,
          objectiveProgressText: battle.eliteAlive ? `${targetTitle} 已进场 · 击败首领就能完成本局` : '首领即将进场 · 先稳住第一轮压力',
          objectiveTone: 'boss',
        };
      }

      const winCondition = BATTLE_TEMPLATES[battle.templateId].winCondition.type;
      if (winCondition === 'elite') {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '击败精英',
          objectiveDetail: '精英进场后，拆护卫并击破本体即可过关。',
          objectiveProgressText: battle.eliteAlive ? '精英已进场 · 击破本体即可过关' : '精英即将进场 · 先稳住战场节奏',
          objectiveTone: 'elite',
        };
      }

      if (winCondition === 'survive') {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '撑到倒计时结束',
          objectiveDetail: '这是生存战，稳住走位和血量，倒计时归零就能过关。',
          objectiveProgressText: `剩余 ${Math.ceil(battle.remainingSec)}s`,
          objectiveTone: 'survive',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '击破敌群',
        objectiveDetail: `这是普通战，击破 ${battle.targetKills} 个敌人即可推进。`,
        objectiveProgressText: `已击破 ${battle.kills} / ${battle.targetKills}`,
        objectiveTone: 'battle',
      };
    }

    if (state.status === 'nodeChoice') {
      const hasBossNode = state.nodeOptions.some((node) => node.type === 'boss');
      const hasFinalPrepNode = state.nodeOptions.some((node) => node.isFinalPrep);

      if (state.phase === 'finalBattle' || hasBossNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '确认最终战',
          objectiveDetail: '这是最后一站，确认后会立刻进入本局首领收尾。',
          objectiveProgressText: '选定后立即进入 Boss',
          objectiveTone: 'flow',
        };
      }

      if (state.phase === 'finalPrep' || hasFinalPrepNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '进入最终整备',
          objectiveDetail: '这是首领战前最后一次整备，确认后先补最后一手。',
          objectiveProgressText: '整备完成后进入 Boss',
          objectiveTone: 'flow',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '选择下一站',
        objectiveDetail: `当前第 ${currentStep} / ${state.totalRounds} 段，选完这一站后再继续推进。`,
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'upgradeChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentNode?.isFinalPrep ? '完成最终整备' : '完成强化选择',
        objectiveDetail: state.upgradeSource === 'levelUp' ? '这是战斗内升级，选完后会立刻回到当前战斗。' : '补完这一手后，流程会继续向下一段推进。',
        objectiveProgressText: state.currentNode?.isFinalPrep ? '选完这一手就进入 Boss' : bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'eventChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentEvent?.contentKind === 'anomaly' ? '完成异常抉择' : '完成事件选择',
        objectiveDetail: '选完这一项后会继续推进，不会额外插入隐藏流程。',
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    return {
      objectiveLabel: '当前目标',
      objectiveText: '准备进入下一局',
      objectiveDetail: '把一条路线扶到成型，并在 Boss 战前尽量补齐收尾能力。',
      objectiveProgressText: bossDistanceText,
      objectiveTone: 'flow',
    };
  }

  private getRouteStatusText(): string {
    const state = this.engine.getState();
    if (state.maturedRoute) {
      return `${ROUTE_NAME_MAP[state.maturedRoute]}路线已经成型`;
    }
    if (state.committedRoute) {
      return `${ROUTE_NAME_MAP[state.committedRoute]}路线开始站稳`;
    }

    const dominantRoute = this.engine.getDominantRoute();
    return dominantRoute ? `${ROUTE_NAME_MAP[dominantRoute]}倾向已出现` : '尚未站稳路线';
  }

  private getToastTone(text: string): ToastTone {
    if (text.includes('精英') || text.includes('高压') || text.includes('压力')) {
      return 'danger';
    }
    if (text.includes('开始站稳') || text.includes('已经成型') || text.includes('暴击') || text.includes('穿透') || text.includes('穿梭')) {
      return 'route';
    }
    if (text.includes('完成') || text.includes('已接入') || text.includes('已完成收束')) {
      return 'success';
    }
    if (text.includes('进入') || text.includes('前段') || text.includes('中段') || text.includes('后段') || text.includes('最终')) {
      return 'accent';
    }
    return 'neutral';
  }

  private shouldDisplayToast(tone: ToastTone): boolean {
    const status = this.engine.getState().status;
    if (status === 'battle' || status === 'upgradeChoice' || status === 'eventChoice' || status === 'nodeChoice') {
      return false;
    }

    return tone === 'danger' || tone === 'success';
  }

  }
  */

  private syncOverlay(): void {
    const state = this.engine.getState();
    const hudSnapshot = this.createHudSnapshot();
    const hudKey = JSON.stringify(hudSnapshot);
    if (hudKey !== this.lastHudKey) {
      this.services.overlay.showHud(hudSnapshot);
      this.lastHudKey = hudKey;
    }

    if (state.status === 'battle') {
      this.services.overlay.clearToasts();
      if (this.lastPanelKey) {
        this.services.overlay.hidePanel();
        this.lastPanelKey = '';
      }
      return;
    }

    if (state.status === 'nodeChoice') {
      const panelKey = `node:${state.phase}:${state.nodeOptions.map((node) => node.id).join('|')}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.audio.play('click');
        this.services.overlay.showNodePanel(
          getPhaseLabel(state.phase),
          state.nodeOptions,
          this.getPanelProgressSnapshot(),
          (nodeId) => {
            this.services.audio.play('confirm');
            this.engine.chooseNode(nodeId);
            this.processAnnouncements();
            this.syncOverlay();
          },
        );
        this.lastPanelKey = panelKey;
      }
      return;
    }

    if (state.status === 'upgradeChoice') {
      const panelKey = `upgrade:${state.phase}:${state.upgradeChoices.map((upgrade) => upgrade.id).join('|')}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.audio.play(state.upgradeSource === 'levelUp' ? 'upgrade' : 'confirm');
        const panelTitle =
          state.upgradeSource === 'levelUp'
            ? `等级提升 Lv.${state.level}`
            : state.currentNode?.isFinalPrep
              ? '最终整备'
              : `${getPhaseLabel(state.phase)}强化`;
        this.services.overlay.showUpgradePanel(
          panelTitle,
          this.getUpgradePanelDescription(),
          this.getPanelProgressSnapshot(),
          state.upgradeChoices,
          (upgradeId) => {
            this.engine.chooseUpgrade(upgradeId);
            this.processAnnouncements();
            this.syncOverlay();
          },
        );
        this.lastPanelKey = panelKey;
      }
      return;
    }

    if (state.status === 'eventChoice' && state.currentEvent) {
      const panelKey = `event:${state.currentEvent.id}:${state.currentEvent.options.map((option) => option.id).join('|')}`;
      if (panelKey !== this.lastPanelKey) {
        this.services.audio.play(state.currentEvent.contentKind === 'anomaly' ? 'anomaly' : 'confirm');
        this.services.overlay.showEventPanel(state.currentEvent, this.getPanelProgressSnapshot(), (optionId) => {
          this.engine.chooseEventOption(optionId);
          this.processAnnouncements();
          this.syncOverlay();
        });
        this.lastPanelKey = panelKey;
      }
      return;
    }

    if (this.lastPanelKey) {
      this.services.overlay.hidePanel();
      this.lastPanelKey = '';
    }
  }

  private processAnnouncements(): void {
    for (const item of this.engine.drainAnnouncements()) {
      if (item.kind === 'tip' && item.text) {
        const tone = this.getToastTone(item.text);
        const forceBattleToast = item.text.includes('Boss 已进场') || item.text.includes('首领已进场');
        if (this.shouldDisplayToast(tone) || forceBattleToast) {
          this.services.overlay.pushToast(item.text, tone);
        }
      }

      if (item.kind === 'audio' && item.cue) {
        this.services.audio.play(item.cue);
      }
    }
  }

  private syncAudioState(state: ReturnType<RunEngine['getState']>): void {
    if (state.phase === 'finalBattle' || (state.status === 'battle' && state.battle?.encounterType === 'boss')) {
      this.services.audio.setMusic('boss');
      return;
    }

    if (state.status === 'result') {
      this.services.audio.setMusic('result');
      return;
    }

    this.services.audio.setMusic('battle');
  }

  private createHudSnapshot(): OverlayHudSnapshot {
    const state = this.engine.getState();
    const routeStatusText = this.getRouteStatusText();
    const progressSnapshot = this.getRunProgressSnapshot();
    const objectiveSnapshot = this.getObjectiveSnapshot();
    const statusText =
      state.status === 'battle' && state.battle ? this.getBattleStatusText(state.battle) : routeStatusText;

    return {
      phaseLabel: getPhaseLabel(state.phase),
      nodeLabel: state.currentNode?.title ?? '节点选择',
      hpText: `${Math.ceil(state.stats.hp)} / ${state.stats.maxHp}`,
      hpRatio: state.stats.hp / Math.max(1, state.stats.maxHp),
      levelText: `Lv.${state.level}`,
      experienceText: `${Math.floor(state.experience)} / ${state.experienceToNext}`,
      experienceRatio: state.experience / Math.max(1, state.experienceToNext),
      routeStatusText,
      routeProgress: ROUTES.map((route) => ({
        routeId: route.id,
        label: route.name,
        value: state.routeCounts[route.id],
        color: route.color,
        active: this.engine.getDominantRoute() === route.id,
      })).filter((route) => route.value > 0 || route.active),
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

  private getBattleStatusText(battle: BattleState): string {
    return `${getBattleEncounterLabel(battle.templateId, battle.encounterType)} · ${this.getBattleIdentityLabel(battle)}`;
  }

  private getBattleIdentityLabel(battle: BattleState): string {
    const nodeTitle = this.engine.getState().currentNode?.title;
    if (battle.encounterType === 'boss') {
      return nodeTitle ?? BATTLE_TEMPLATES[battle.templateId].name;
    }

    return battle.label || nodeTitle || BATTLE_TEMPLATES[battle.templateId].name;
  }

  private getBattleStatusSubtext(battle: BattleState): string {
    const summaryParts: string[] = [];
    if (battle.encounterType === 'boss') {
      summaryParts.push(battle.eliteAlive ? 'Boss 已进场' : 'Boss 即将进场');
    }
    if (battle.pressurePhaseLabel) {
      summaryParts.push(`阶段 ${battle.pressurePhaseLabel}`);
    }
    if (battle.pressureSignatureLabel) {
      summaryParts.push(`招式 ${battle.pressureSignatureLabel}`);
    } else if (battle.pressurePatternLabel) {
      summaryParts.push(`区域 ${battle.pressurePatternLabel}`);
    }
    return summaryParts.join(' / ') || BATTLE_TEMPLATES[battle.templateId].description;
  }

  private getPanelProgressSnapshot(): Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'> {
    const progress = this.getRunProgressSnapshot();
    return {
      progressLabel: progress.progressLabel,
      progressDetail: progress.progressDetail,
      phaseTrack: progress.phaseTrack,
    };
  }

  private getBossDistanceText(currentStep: number, totalRounds: number): string {
    const remainingStops = Math.max(0, totalRounds - currentStep);
    if (remainingStops <= 0) {
      return 'Boss 已在眼前';
    }
    if (remainingStops === 1) {
      return '再过 1 站进 Boss';
    }
    return `距 Boss 还剩 ${remainingStops} 站`;
  }

  private getUpgradePanelDescription(): string {
    const state = this.engine.getState();
    if (state.upgradeSource === 'levelUp') {
      return '战斗里立刻补一项强化。';
    }
    if (state.currentNode?.isFinalPrep) {
      return '最后一手补强，选完直接进 Boss。';
    }
    return '补当前打法最缺的一拍。';
  }

  private getRunProgressSnapshot(): Pick<OverlayHudSnapshot, 'progressLabel' | 'progressDetail' | 'phaseTrack'> {
    const state = this.engine.getState();
    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const currentPhaseLabel = getPhaseLabel(state.phase);
    const currentPhaseIndex = PHASE_TRACK.findIndex((entry) => entry.phase === state.phase);
    const bossDistanceText = this.getBossDistanceText(currentStep, state.totalRounds);
    const nextPhaseLabel =
      currentPhaseIndex >= 0 && currentPhaseIndex < PHASE_TRACK.length - 1 ? PHASE_TRACK[currentPhaseIndex + 1].label : null;

    let progressDetail = `${currentPhaseLabel}推进中，${bossDistanceText}。`;
    if (state.phase === 'finalPrep') {
      progressDetail = '最后整备，选完直接进 Boss。';
    } else if (state.phase === 'finalBattle') {
      progressDetail = '最终战已开始，这一战决定整局收束。';
    } else if (nextPhaseLabel) {
      progressDetail = `过完这一站进入${nextPhaseLabel}。`;
    }

    return {
      progressLabel: `推进 ${currentStep} / ${state.totalRounds}`,
      progressDetail,
      phaseTrack: PHASE_TRACK.map((entry, index) => {
        const step = index + 1;
        if (step < currentStep) {
          return {
            label: entry.label,
            state: 'done' as const,
          };
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

  private getObjectiveSnapshot(): Pick<
    OverlayHudSnapshot,
    'objectiveLabel' | 'objectiveText' | 'objectiveDetail' | 'objectiveProgressText' | 'objectiveTone'
  > {
    const state = this.engine.getState();
    const currentStep = Math.min(state.totalRounds, Math.max(1, state.round));
    const bossDistanceText = this.getBossDistanceText(currentStep, state.totalRounds);

    if (state.status === 'battle' && state.battle) {
      const battle = state.battle;
      const targetTitle = this.getBattleIdentityLabel(battle);
      if (battle.encounterType === 'boss') {
        return {
          objectiveLabel: 'Boss 目标',
          objectiveText: '击败场上首领',
          objectiveDetail: '盯住金色血条，把最后一段收掉。',
          objectiveProgressText: battle.eliteAlive ? `${targetTitle} / 终结首领` : '首领即将进场',
          objectiveTone: 'boss',
        };
      }

      const winCondition = BATTLE_TEMPLATES[battle.templateId].winCondition.type;
      if (winCondition === 'elite') {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '拆掉精英本体',
          objectiveDetail: '先稳住身位，再清护卫。',
          objectiveProgressText: battle.eliteAlive ? '精英已进场' : '精英即将进场',
          objectiveTone: 'elite',
        };
      }

      if (winCondition === 'survive') {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '撑到倒计时结束',
          objectiveDetail: '优先活下来，别贪线。',
          objectiveProgressText: `剩余 ${Math.ceil(battle.remainingSec)}s`,
          objectiveTone: 'survive',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '清掉这一波敌群',
        objectiveDetail: '击破数量够了就能继续推进。',
        objectiveProgressText: `${battle.kills} / ${battle.targetKills}`,
        objectiveTone: 'battle',
      };
    }

    if (state.status === 'nodeChoice') {
      const hasBossNode = state.nodeOptions.some((node) => node.type === 'boss');
      const hasFinalPrepNode = state.nodeOptions.some((node) => node.isFinalPrep);

      if (state.phase === 'finalBattle' || hasBossNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '确认最终战',
          objectiveDetail: '选定后立刻进入 Boss。',
          objectiveProgressText: '最终收束入口',
          objectiveTone: 'flow',
        };
      }

      if (state.phase === 'finalPrep' || hasFinalPrepNode) {
        return {
          objectiveLabel: '当前目标',
          objectiveText: '进入最终整备',
          objectiveDetail: '补最后一手，再进 Boss。',
          objectiveProgressText: '整备后进入 Boss',
          objectiveTone: 'flow',
        };
      }

      return {
        objectiveLabel: '当前目标',
        objectiveText: '选下一站路线',
        objectiveDetail: `当前第 ${currentStep} / ${state.totalRounds} 站。`,
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'upgradeChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentNode?.isFinalPrep ? '完成最终整备' : '完成强化选择',
        objectiveDetail: state.upgradeSource === 'levelUp' ? '选完立刻回战斗。' : '补完这一手继续推进。',
        objectiveProgressText: state.currentNode?.isFinalPrep ? '选完直接进 Boss' : bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    if (state.status === 'eventChoice') {
      return {
        objectiveLabel: '当前目标',
        objectiveText: state.currentEvent?.contentKind === 'anomaly' ? '完成异常处理' : '完成事件选择',
        objectiveDetail: '处理完就继续往下走。',
        objectiveProgressText: bossDistanceText,
        objectiveTone: 'flow',
      };
    }

    return {
      objectiveLabel: '当前目标',
      objectiveText: '准备进入下一局',
      objectiveDetail: '把一条路线收成型。',
      objectiveProgressText: bossDistanceText,
      objectiveTone: 'flow',
    };
  }

  private getRouteStatusText(): string {
    const state = this.engine.getState();
    if (state.maturedRoute) {
      return `${ROUTE_NAME_MAP[state.maturedRoute]}已成型`;
    }
    if (state.committedRoute) {
      return `${ROUTE_NAME_MAP[state.committedRoute]}正在成线`;
    }

    const dominantRoute = this.engine.getDominantRoute();
    return dominantRoute ? `${ROUTE_NAME_MAP[dominantRoute]}开始冒头` : '还没站稳主路线';
  }

  private getToastTone(text: string): ToastTone {
    if (text.includes('精英') || text.includes('高压') || text.includes('压力') || text.includes('Boss')) {
      return 'danger';
    }
    if (text.includes('成型') || text.includes('成线') || text.includes('暴击') || text.includes('穿透') || text.includes('穿梭')) {
      return 'route';
    }
    if (text.includes('完成') || text.includes('接入') || text.includes('收住')) {
      return 'success';
    }
    if (text.includes('进入') || text.includes('前段') || text.includes('中段') || text.includes('后段') || text.includes('整备')) {
      return 'accent';
    }
    return 'neutral';
  }

  private shouldDisplayToast(tone: ToastTone): boolean {
    const status = this.engine.getState().status;
    if (status === 'battle' || status === 'upgradeChoice' || status === 'eventChoice' || status === 'nodeChoice') {
      return false;
    }

    return tone === 'danger' || tone === 'success' || tone === 'route';
  }

  private renderBattle(): void {
    const dominantRoute = this.engine.getDominantRoute();
    const accentColor = dominantRoute ? parseInt(ROUTE_COLOR_MAP[dominantRoute].slice(1), 16) : 0x61d7ff;
    const battle = this.engine.getState().battle;

    this.graphics.clear();
    if (!battle) {
      this.graphics.fillGradientStyle(0x13100d, 0x13100d, 0x070706, 0x050505, 1);
      this.graphics.fillRect(0, 0, this.scale.width, this.scale.height);
      return;
    }

    const camera = this.getBattleCameraRect(battle);
    this.renderBattleTerrain(battle, camera, accentColor);
    this.renderBattleEntities(battle, camera, accentColor);
  }

  private getBattleCameraRect(battle: BattleState): {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  } {
    const width = this.scale.width;
    const height = this.scale.height;
    const maxLeft = Math.max(0, ARENA_WIDTH - width);
    const maxTop = Math.max(0, ARENA_HEIGHT - height);
    const baseLeft = clamp(battle.playerX - width * 0.5, 0, maxLeft);
    const baseTop = clamp(battle.playerY - height * 0.5, 0, maxTop);
    const shakeStrength = Math.min(1.2, battle.cameraShakeStrength);
    const shakeX =
      battle.cameraShakeSec > 0
        ? Math.sin(battle.elapsedSec * 58 + battle.kills * 0.41) * 12 * shakeStrength
        : 0;
    const shakeY =
      battle.cameraShakeSec > 0
        ? Math.cos(battle.elapsedSec * 73 + battle.kills * 0.29) * 8 * shakeStrength
        : 0;
    const left = clamp(baseLeft + shakeX, 0, maxLeft);
    const top = clamp(baseTop + shakeY, 0, maxTop);

    return {
      left,
      right: left + width,
      top,
      bottom: top + height,
      width,
      height,
    };
  }

  private worldToScreen(
    camera: { left: number; top: number },
    x: number,
    y: number,
  ): { x: number; y: number } {
    return {
      x: x - camera.left,
      y: y - camera.top,
    };
  }

  private isVisibleInCamera(
    camera: { left: number; right: number; top: number; bottom: number },
    x: number,
    y: number,
    padding = 40,
  ): boolean {
    return x >= camera.left - padding && x <= camera.right + padding && y >= camera.top - padding && y <= camera.bottom + padding;
  }

  private getTerrainNoise(x: number, y: number, salt = 0): number {
    const value = Math.sin(x * 12.9898 + y * 78.233 + salt * 43.129) * 43758.5453123;
    return value - Math.floor(value);
  }

  private renderBattleTerrain(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
    accentColor: number,
  ): void {
    this.graphics.fillGradientStyle(0x252b33, 0x1d2630, 0x0f1319, 0x090b10, 1);
    this.graphics.fillRect(0, 0, camera.width, camera.height);

    const blotStartX = Math.floor(camera.left / TERRAIN_BLOT_SIZE) - 1;
    const blotEndX = Math.ceil(camera.right / TERRAIN_BLOT_SIZE) + 1;
    const blotStartY = Math.floor(camera.top / TERRAIN_BLOT_SIZE) - 1;
    const blotEndY = Math.ceil(camera.bottom / TERRAIN_BLOT_SIZE) + 1;
    for (let blotY = blotStartY; blotY <= blotEndY; blotY += 1) {
      for (let blotX = blotStartX; blotX <= blotEndX; blotX += 1) {
        const noise = this.getTerrainNoise(blotX, blotY, 7);
        const worldX = blotX * TERRAIN_BLOT_SIZE + TERRAIN_BLOT_SIZE * 0.5;
        const worldY = blotY * TERRAIN_BLOT_SIZE + TERRAIN_BLOT_SIZE * 0.5;
        const screen = this.worldToScreen(camera, worldX, worldY);
        const width = 190 + noise * 140;
        const height = 88 + this.getTerrainNoise(blotX, blotY, 9) * 90;
        this.graphics.fillStyle(noise > 0.54 ? 0x33404b : 0x1a232c, noise > 0.54 ? 0.16 : 0.1);
        this.graphics.fillEllipse(screen.x, screen.y, width, height);
      }
    }

    const tileStartX = Math.floor(camera.left / TERRAIN_TILE_SIZE) - 1;
    const tileEndX = Math.ceil(camera.right / TERRAIN_TILE_SIZE) + 1;
    const tileStartY = Math.floor(camera.top / TERRAIN_TILE_SIZE) - 1;
    const tileEndY = Math.ceil(camera.bottom / TERRAIN_TILE_SIZE) + 1;
    for (let tileY = tileStartY; tileY <= tileEndY; tileY += 1) {
      for (let tileX = tileStartX; tileX <= tileEndX; tileX += 1) {
        const noise = this.getTerrainNoise(tileX, tileY, 1);
        const worldX = tileX * TERRAIN_TILE_SIZE;
        const worldY = tileY * TERRAIN_TILE_SIZE;
        const screen = this.worldToScreen(camera, worldX, worldY);
        const tileColor = noise > 0.62 ? 0x39434c : noise > 0.3 ? 0x2c353e : 0x1d252d;
        this.graphics.fillStyle(tileColor, 0.18 + noise * 0.08);
        this.graphics.fillRoundedRect(screen.x, screen.y, TERRAIN_TILE_SIZE - 8, TERRAIN_TILE_SIZE - 8, 20);

        const detailNoise = this.getTerrainNoise(tileX, tileY, 4);
        this.graphics.fillStyle(0x71869a, 0.07 + detailNoise * 0.06);
        this.graphics.fillEllipse(
          screen.x + 24 + detailNoise * 44,
          screen.y + 20 + this.getTerrainNoise(tileX, tileY, 5) * 52,
          20 + detailNoise * 26,
          8 + detailNoise * 16,
        );

        if (detailNoise > 0.36) {
          const pebbleCount = 1 + Math.floor(detailNoise * 3);
          for (let pebble = 0; pebble < pebbleCount; pebble += 1) {
            const px = screen.x + 18 + this.getTerrainNoise(tileX, tileY, 20 + pebble) * (TERRAIN_TILE_SIZE - 36);
            const py = screen.y + 18 + this.getTerrainNoise(tileX, tileY, 30 + pebble) * (TERRAIN_TILE_SIZE - 36);
            this.graphics.fillStyle(0x0d1116, 0.18);
            this.graphics.fillCircle(px, py, 2 + this.getTerrainNoise(tileX, tileY, 40 + pebble) * 3);
            this.graphics.lineStyle(1, 0x7c93a9, 0.14);
            this.graphics.strokeCircle(px, py, 4 + this.getTerrainNoise(tileX, tileY, 50 + pebble) * 3);
          }
        }
      }
    }

    this.graphics.lineStyle(1, 0x87a9c3, 0.035);
    for (let tileX = tileStartX; tileX <= tileEndX; tileX += 1) {
      const screenX = tileX * TERRAIN_TILE_SIZE - camera.left;
      this.graphics.lineBetween(screenX, 0, screenX, camera.height);
    }
    for (let tileY = tileStartY; tileY <= tileEndY; tileY += 1) {
      const screenY = tileY * TERRAIN_TILE_SIZE - camera.top;
      this.graphics.lineBetween(0, screenY, camera.width, screenY);
    }
    this.renderEncounterBackdrop(battle, camera, accentColor);

    const liveFocusRoute = this.getLiveCombatFocusRoute(battle);
    const playerScreen = this.worldToScreen(camera, battle.playerX, battle.playerY);
    const aimMagnitude = Math.hypot(battle.playerAimDirX, battle.playerAimDirY);
    const aimDirX = aimMagnitude > 0.01 ? battle.playerAimDirX / aimMagnitude : 0;
    const aimDirY = aimMagnitude > 0.01 ? battle.playerAimDirY / aimMagnitude : -1;
    const aimOrthoX = -aimDirY;
    const aimOrthoY = aimDirX;
    const moveMagnitude = Math.hypot(battle.playerMoveDirX, battle.playerMoveDirY);
    const moveDirX = moveMagnitude > 0.01 ? battle.playerMoveDirX / moveMagnitude : -aimDirX;
    const moveDirY = moveMagnitude > 0.01 ? battle.playerMoveDirY / moveMagnitude : -aimDirY;
    const tempoGlow = Math.min(1, battle.tempoPulseSec / 0.3);
    const routeCharge = Math.min(
      1,
      Math.max(
        tempoGlow,
        battle.playerShotFlashSec > 0 ? battle.playerShotFlashSec / 0.08 : 0,
        battle.critOverdriveSec > 0 ? 0.56 : 0,
        battle.dashDriveSec > 0 ? 0.52 : 0,
        battle.playerNearMissSec > 0 ? 0.44 : 0,
      ),
    );

    if (liveFocusRoute === 'crit' && routeCharge > 0.08) {
      const critFieldColor = this.mixColor(accentColor, 0xffde86, 0.34);
      this.graphics.fillStyle(critFieldColor, 0.04 + routeCharge * 0.08);
      this.graphics.fillTriangle(
        playerScreen.x + aimDirX * (camera.width * 0.4),
        playerScreen.y + aimDirY * (camera.height * 0.34),
        playerScreen.x - aimOrthoX * (58 + routeCharge * 44),
        playerScreen.y - aimOrthoY * (58 + routeCharge * 44),
        playerScreen.x + aimOrthoX * (58 + routeCharge * 44),
        playerScreen.y + aimOrthoY * (58 + routeCharge * 44),
      );
      this.graphics.lineStyle(2, critFieldColor, 0.08 + routeCharge * 0.16);
      this.graphics.lineBetween(
        playerScreen.x - aimOrthoX * 20,
        playerScreen.y - aimOrthoY * 20,
        playerScreen.x + aimDirX * (camera.width * 0.42) + aimOrthoX * 26,
        playerScreen.y + aimDirY * (camera.height * 0.3) + aimOrthoY * 26,
      );
      this.graphics.lineBetween(
        playerScreen.x + aimOrthoX * 20,
        playerScreen.y + aimOrthoY * 20,
        playerScreen.x + aimDirX * (camera.width * 0.42) - aimOrthoX * 26,
        playerScreen.y + aimDirY * (camera.height * 0.3) - aimOrthoY * 26,
      );
    } else if (liveFocusRoute === 'pierce' && routeCharge > 0.08) {
      const pierceFieldColor = this.mixColor(accentColor, 0xd9f5ff, 0.3);
      for (let lane = -1; lane <= 1; lane += 1) {
        const laneOffset = lane * (28 + routeCharge * 8);
        this.graphics.lineStyle(lane === 0 ? 2.4 : 1.5, pierceFieldColor, 0.06 + routeCharge * (lane === 0 ? 0.18 : 0.1));
        this.graphics.lineBetween(
          playerScreen.x - aimDirX * 180 + aimOrthoX * laneOffset,
          playerScreen.y - aimDirY * 180 + aimOrthoY * laneOffset,
          playerScreen.x + aimDirX * (camera.width * 0.72) + aimOrthoX * laneOffset,
          playerScreen.y + aimDirY * (camera.height * 0.52) + aimOrthoY * laneOffset,
        );
      }
    } else if (liveFocusRoute === 'dash' && routeCharge > 0.08) {
      const dashFieldColor = this.mixColor(accentColor, 0xbfffea, 0.32);
      this.graphics.fillStyle(dashFieldColor, 0.04 + routeCharge * 0.07);
      this.graphics.fillEllipse(
        playerScreen.x - moveDirX * (68 + routeCharge * 44),
        playerScreen.y - moveDirY * (68 + routeCharge * 44),
        180 + routeCharge * 120,
        90 + routeCharge * 50,
      );
      this.graphics.lineStyle(2, dashFieldColor, 0.08 + routeCharge * 0.16);
      this.graphics.lineBetween(
        playerScreen.x - moveDirX * (148 + routeCharge * 64),
        playerScreen.y - moveDirY * (148 + routeCharge * 64),
        playerScreen.x - moveDirX * 18,
        playerScreen.y - moveDirY * 18,
      );
      this.graphics.lineBetween(
        playerScreen.x - moveDirX * (112 + routeCharge * 52) + aimOrthoX * 22,
        playerScreen.y - moveDirY * (112 + routeCharge * 52) + aimOrthoY * 22,
        playerScreen.x + aimOrthoX * 10,
        playerScreen.y + aimOrthoY * 10,
      );
      this.graphics.lineBetween(
        playerScreen.x - moveDirX * (112 + routeCharge * 52) - aimOrthoX * 22,
        playerScreen.y - moveDirY * (112 + routeCharge * 52) - aimOrthoY * 22,
        playerScreen.x - aimOrthoX * 10,
        playerScreen.y - aimOrthoY * 10,
      );
    }

    const focusFieldColor =
      liveFocusRoute === 'crit'
        ? this.mixColor(accentColor, 0xffde86, 0.28)
        : liveFocusRoute === 'pierce'
          ? this.mixColor(accentColor, 0xdff6ff, 0.28)
          : liveFocusRoute === 'dash'
            ? this.mixColor(accentColor, 0xbfffea, 0.28)
            : this.mixColor(accentColor, 0xffffff, 0.14);
    const focusFieldAlpha = 0.02 + Math.max(tempoGlow * 0.05, routeCharge * 0.07);
    this.graphics.lineStyle(2, focusFieldColor, focusFieldAlpha);
    this.graphics.strokeEllipse(
      playerScreen.x,
      playerScreen.y,
      210 + routeCharge * 120 + Math.sin(battle.elapsedSec * 1.8) * 18,
      180 + routeCharge * 92 + Math.cos(battle.elapsedSec * 1.4) * 10,
    );
    this.graphics.lineStyle(1, focusFieldColor, focusFieldAlpha * 0.82);
    this.graphics.strokeEllipse(
      playerScreen.x,
      playerScreen.y,
      320 + routeCharge * 180,
      300 + routeCharge * 120,
    );

    this.graphics.fillStyle(accentColor, 0.08 + tempoGlow * 0.12);
    this.graphics.fillEllipse(camera.width * 0.5, camera.height * 0.56, camera.width * 0.58, camera.height * 0.28);
    this.graphics.fillStyle(this.mixColor(accentColor, 0xffffff, 0.18), 0.032 + tempoGlow * 0.04);
    this.graphics.fillEllipse(
      camera.width * 0.5 + Math.sin(battle.elapsedSec * 1.1) * 18,
      camera.height * 0.56 + Math.cos(battle.elapsedSec * 0.8) * 12,
      camera.width * 0.82,
      camera.height * 0.5,
    );
  }

  private renderEncounterBackdrop(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
    accentColor: number,
  ): void {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const pulse = 0.5 + Math.sin(battle.elapsedSec * 1.7 + battle.kills * 0.08) * 0.5;
    const encounterGlow =
      template.winCondition.type === 'survive'
        ? this.mixColor(accentColor, 0xff8677, 0.22)
        : template.winCondition.type === 'elite'
          ? this.mixColor(accentColor, 0xffd8a8, 0.22)
          : this.mixColor(accentColor, 0xc2e0ff, 0.2);

    if (template.winCondition.type === 'survive') {
      const edgeAlpha = 0.032 + pulse * 0.03;
      this.graphics.fillStyle(encounterGlow, edgeAlpha);
      this.graphics.fillRect(0, 0, camera.width, 26);
      this.graphics.fillRect(0, camera.height - 26, camera.width, 26);
      this.graphics.lineStyle(2, encounterGlow, 0.08 + pulse * 0.12);
      this.graphics.lineBetween(0, 34, camera.width, 34);
      this.graphics.lineBetween(0, camera.height - 34, camera.width, camera.height - 34);
    } else if (template.winCondition.type === 'elite') {
      const topBeaconY = this.worldToScreen(camera, ARENA_WIDTH * 0.5, 116).y;
      const centerBeacon = this.worldToScreen(camera, ARENA_WIDTH * 0.5, ARENA_HEIGHT * 0.5);
      this.graphics.lineStyle(2, encounterGlow, 0.08 + pulse * 0.12);
      this.graphics.lineBetween(camera.width * 0.5, topBeaconY, centerBeacon.x, centerBeacon.y - 64);
      this.graphics.lineStyle(1.5, encounterGlow, 0.06 + pulse * 0.1);
      this.graphics.strokeCircle(centerBeacon.x, centerBeacon.y, 84 + pulse * 14);
      this.graphics.strokeCircle(centerBeacon.x, centerBeacon.y, 132 + pulse * 20);
    } else {
      const center = this.worldToScreen(camera, ARENA_WIDTH * 0.5, ARENA_HEIGHT * 0.5);
      this.graphics.lineStyle(1.5, encounterGlow, 0.06 + pulse * 0.08);
      this.graphics.strokeCircle(center.x, center.y, 116 + pulse * 16);
      this.graphics.lineBetween(center.x - 92, center.y, center.x - 44, center.y);
      this.graphics.lineBetween(center.x + 44, center.y, center.x + 92, center.y);
    }

    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    if (pattern === 'lanes' && laneBias === 'vertical') {
      for (const worldX of [ARENA_WIDTH * 0.24, ARENA_WIDTH * 0.5, ARENA_WIDTH * 0.76]) {
        const screenX = worldX - camera.left;
        if (screenX < -40 || screenX > camera.width + 40) {
          continue;
        }
        this.graphics.fillStyle(encounterGlow, 0.032 + pulse * 0.026);
        this.graphics.fillRect(screenX - 18, 0, 36, camera.height);
        this.graphics.lineStyle(1.5, encounterGlow, 0.08 + pulse * 0.1);
        this.graphics.lineBetween(screenX, 0, screenX, camera.height);
      }
      return;
    }

    if (pattern === 'lanes' && laneBias === 'horizontal') {
      for (const worldY of [ARENA_HEIGHT * 0.24, ARENA_HEIGHT * 0.5, ARENA_HEIGHT * 0.76]) {
        const screenY = worldY - camera.top;
        if (screenY < -40 || screenY > camera.height + 40) {
          continue;
        }
        this.graphics.fillStyle(encounterGlow, 0.03 + pulse * 0.024);
        this.graphics.fillRect(0, screenY - 16, camera.width, 32);
        this.graphics.lineStyle(1.5, encounterGlow, 0.08 + pulse * 0.1);
        this.graphics.lineBetween(0, screenY, camera.width, screenY);
      }
      return;
    }

    if (pattern === 'pincers') {
      const sideYBase = (battle.elapsedSec * 88) % Math.max(180, ARENA_HEIGHT - 120);
      for (let index = 0; index < 3; index += 1) {
        const worldY = 72 + ((sideYBase + index * 180) % Math.max(220, ARENA_HEIGHT - 120));
        const left = this.worldToScreen(camera, 52, worldY);
        const right = this.worldToScreen(camera, ARENA_WIDTH - 52, worldY);
        if (left.y >= -48 && left.y <= camera.height + 48) {
          this.graphics.fillStyle(encounterGlow, 0.08 + pulse * 0.06);
          this.graphics.fillTriangle(left.x, left.y, left.x + 24, left.y - 16, left.x + 24, left.y + 16);
        }
        if (right.y >= -48 && right.y <= camera.height + 48) {
          this.graphics.fillStyle(encounterGlow, 0.08 + pulse * 0.06);
          this.graphics.fillTriangle(right.x, right.y, right.x - 24, right.y - 16, right.x - 24, right.y + 16);
        }
      }
      return;
    }

    const center = this.worldToScreen(camera, ARENA_WIDTH * 0.5, ARENA_HEIGHT * 0.5);
    this.graphics.lineStyle(1.5, encounterGlow, 0.06 + pulse * 0.08);
    this.graphics.strokeCircle(center.x, center.y, 170 + pulse * 24);
  }

  private renderBattleEntities(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
    accentColor: number,
  ): void {
    this.renderEncounterFlowOverlay(battle, camera, accentColor);
    this.renderPressurePatternOverlay(battle, camera, accentColor);
    const tempoRatio = Math.min(1, battle.tempoPulseSec / 0.3);
    const dominantRoute = this.engine.getDominantRoute();
    const state = this.engine.getState();
    const liveFocusRoute = this.getLiveCombatFocusRoute(battle);
    const flowChainRatio =
      battle.killFlowSec > 0
        ? Math.min(1, battle.killFlowSec / (battle.killFlowCount >= 3 ? 1 : battle.killFlowCount >= 2 ? 0.86 : 0.72))
        : 0;
    const flowGuideColor =
      liveFocusRoute === 'crit'
        ? this.mixColor(accentColor, 0xffd882, 0.24)
        : liveFocusRoute === 'pierce'
          ? this.mixColor(accentColor, 0xdff6ff, 0.22)
          : liveFocusRoute === 'dash'
            ? this.mixColor(accentColor, 0xbfffea, 0.22)
            : this.mixColor(accentColor, 0xfff2c3, 0.18);
    const pierceReadRatio = liveFocusRoute === 'pierce' ? Math.min(1, state.routeCounts.pierce / 5) : 0;
    const playerScreen = this.worldToScreen(camera, battle.playerX, battle.playerY);
    let targetingIntensity = 0;

    for (const orb of battle.experienceOrbs) {
      if (!this.isVisibleInCamera(camera, orb.x, orb.y, 20)) {
        continue;
      }

      const screen = this.worldToScreen(camera, orb.x, orb.y);
      const orbSpeed = Math.hypot(orb.velocityX, orb.velocityY);
      const orbSpeedRatio = Phaser.Math.Clamp(orbSpeed / 320, 0, 1);
      const distanceToPlayer = Math.hypot(orb.x - battle.playerX, orb.y - battle.playerY);
      const pulse = 0.5 + Math.sin(battle.elapsedSec * 5.6 + orb.id * 0.77) * 0.5;
      if (orbSpeedRatio > 0.06) {
        const tail = this.worldToScreen(camera, orb.x - orb.velocityX * 0.05, orb.y - orb.velocityY * 0.05);
        this.graphics.lineStyle(2.4, XP_ORB_FILL, 0.12 + orbSpeedRatio * 0.18);
        this.graphics.lineBetween(tail.x, tail.y, screen.x, screen.y);
        this.graphics.lineStyle(1.2, XP_ORB_STROKE, 0.1 + orbSpeedRatio * 0.16);
        this.graphics.lineBetween(
          tail.x - (screen.y - tail.y) * 0.12,
          tail.y + (screen.x - tail.x) * 0.12,
          screen.x - (screen.y - tail.y) * 0.08,
          screen.y + (screen.x - tail.x) * 0.08,
        );
        this.graphics.lineBetween(
          tail.x + (screen.y - tail.y) * 0.12,
          tail.y - (screen.x - tail.x) * 0.12,
          screen.x + (screen.y - tail.y) * 0.08,
          screen.y - (screen.x - tail.x) * 0.08,
        );
      }
      if (distanceToPlayer <= 180) {
        const linkAlpha = 0.04 + (1 - distanceToPlayer / 180) * 0.14;
        this.graphics.lineStyle(1.2, XP_ORB_STROKE, linkAlpha);
        this.graphics.lineBetween(screen.x, screen.y, playerScreen.x, playerScreen.y);
      }
      if (flowChainRatio > 0.12 && distanceToPlayer <= 210 + battle.killFlowCount * 16) {
        const flowLinkAlpha =
          0.03 + flowChainRatio * (0.08 + Math.max(0, 1 - distanceToPlayer / (210 + battle.killFlowCount * 16)) * 0.08);
        this.graphics.lineStyle(1.5, flowGuideColor, flowLinkAlpha);
        this.graphics.lineBetween(screen.x, screen.y, playerScreen.x, playerScreen.y);
      }
      this.graphics.fillStyle(XP_ORB_FILL, 0.12 + pulse * 0.14 + orbSpeedRatio * 0.08);
      this.graphics.fillCircle(screen.x, screen.y, 9 + pulse * 2);
      this.graphics.fillStyle(XP_ORB_FILL, 0.92);
      this.graphics.fillCircle(screen.x, screen.y, 5);
      this.graphics.lineStyle(1.5, XP_ORB_STROKE, 0.3 + pulse * 0.2 + orbSpeedRatio * 0.12);
      this.graphics.strokeCircle(screen.x, screen.y, 8 + pulse * 2 + orbSpeedRatio * 2);
    }

    for (const pulse of battle.pulses) {
      if (!this.isVisibleInCamera(camera, pulse.x, pulse.y, pulse.radius + 12)) {
        continue;
      }

      const screen = this.worldToScreen(camera, pulse.x, pulse.y);
      const lifeRatio = pulse.maxLifeSec > 0 ? pulse.lifeSec / pulse.maxLifeSec : 0;
      if (pulse.fillAlpha > 0) {
        this.graphics.fillStyle(pulse.color, pulse.fillAlpha * lifeRatio);
        this.graphics.fillCircle(screen.x, screen.y, Math.max(8, pulse.radius * 0.78));
      }
      this.graphics.lineStyle(pulse.strokeWidth, pulse.color, pulse.strokeAlpha * lifeRatio);
      this.graphics.strokeCircle(screen.x, screen.y, pulse.radius);
      this.graphics.lineStyle(
        Math.max(1, pulse.strokeWidth - 1),
        pulse.secondaryColor,
        Math.min(1, pulse.strokeAlpha * 0.78) * lifeRatio,
      );
      this.graphics.strokeCircle(screen.x, screen.y, Math.max(6, pulse.radius * pulse.innerRadiusRatio));
    }

    for (const bullet of battle.bullets) {
      if (!this.isVisibleInCamera(camera, bullet.x, bullet.y, 18)) {
        continue;
      }

      const screen = this.worldToScreen(camera, bullet.x, bullet.y);
      const tailDistance =
        bullet.routeFocus === 'dash' ? 0.042 : bullet.routeFocus === 'crit' ? 0.04 : bullet.routeFocus === 'pierce' ? 0.05 : 0.035;
      const tail = this.worldToScreen(camera, bullet.x - bullet.vx * tailDistance, bullet.y - bullet.vy * tailDistance);
      const bulletSpeedRatio = Phaser.Math.Clamp(Math.hypot(bullet.vx, bullet.vy) / 520, 0.35, 1);
      const bulletHitRatio = Phaser.Math.Clamp(bullet.hitCount / 3, 0, 1);
      const bulletDirX = bulletSpeedRatio > 0 ? bullet.vx / Math.max(1, Math.hypot(bullet.vx, bullet.vy)) : 0;
      const bulletDirY = bulletSpeedRatio > 0 ? bullet.vy / Math.max(1, Math.hypot(bullet.vx, bullet.vy)) : 0;
      const bulletOrthoX = -bulletDirY;
      const bulletOrthoY = bulletDirX;
      let bulletTint = bullet.pierceRemaining > 0 || bullet.canEcho ? accentColor : 0xf8fbff;
      if (bullet.routeFocus === 'crit') {
        bulletTint = this.mixColor(0xffcb74, accentColor, 0.22);
      } else if (bullet.routeFocus === 'pierce') {
        bulletTint = this.mixColor(0x8fd8ff, accentColor, 0.28);
      } else if (bullet.routeFocus === 'dash') {
        bulletTint = this.mixColor(0x8cffdf, accentColor, 0.26);
      }
      this.graphics.lineStyle(
        (bullet.pierceRemaining > 0 ? 4 : 3) + bulletHitRatio * 1.2,
        bulletTint,
        (bullet.canEcho ? 0.22 : 0.14) + bulletHitRatio * 0.08,
      );
      this.graphics.lineBetween(
        tail.x - bulletDirX * (14 + bulletSpeedRatio * 8),
        tail.y - bulletDirY * (14 + bulletSpeedRatio * 8),
        screen.x,
        screen.y,
      );
      this.graphics.lineStyle(
        (bullet.pierceRemaining > 0 ? 3 : 2) + bulletHitRatio,
        bulletTint,
        (bullet.canEcho ? 0.44 : 0.32) + bulletHitRatio * 0.12,
      );
      this.graphics.lineBetween(tail.x, tail.y, screen.x, screen.y);
      this.graphics.fillStyle(bulletTint, (bullet.canEcho ? 0.28 : 0.18) + bulletHitRatio * 0.08);
      this.graphics.fillCircle(screen.x, screen.y, (bullet.canEcho ? 8 : 6) + bulletHitRatio * 1.6);
      if (bullet.routeFocus === 'crit') {
        this.graphics.lineStyle(2, bulletTint, 0.2 + bulletSpeedRatio * 0.14);
        this.graphics.lineBetween(
          screen.x - bulletDirX * 12 + bulletOrthoX * 5,
          screen.y - bulletDirY * 12 + bulletOrthoY * 5,
          screen.x + bulletDirX * 10,
          screen.y + bulletDirY * 10,
        );
        this.graphics.lineBetween(
          screen.x - bulletDirX * 12 - bulletOrthoX * 5,
          screen.y - bulletDirY * 12 - bulletOrthoY * 5,
          screen.x + bulletDirX * 10,
          screen.y + bulletDirY * 10,
        );
      } else if (bullet.routeFocus === 'pierce') {
        this.graphics.lineStyle(1.5 + bulletHitRatio * 0.8, bulletTint, 0.18 + bulletSpeedRatio * 0.14 + bulletHitRatio * 0.08);
        this.graphics.lineBetween(
          tail.x + bulletOrthoX * 5,
          tail.y + bulletOrthoY * 5,
          screen.x + bulletOrthoX * 5,
          screen.y + bulletOrthoY * 5,
        );
        this.graphics.lineBetween(
          tail.x - bulletOrthoX * 5,
          tail.y - bulletOrthoY * 5,
          screen.x - bulletOrthoX * 5,
          screen.y - bulletOrthoY * 5,
        );
        if (bulletHitRatio > 0) {
          this.graphics.lineStyle(1.4, this.mixColor(bulletTint, 0xffffff, 0.24), 0.14 + bulletHitRatio * 0.16);
          this.graphics.lineBetween(
            tail.x + bulletDirX * 4,
            tail.y + bulletDirY * 4,
            screen.x + bulletDirX * 10,
            screen.y + bulletDirY * 10,
          );
        }
      } else if (bullet.routeFocus === 'dash') {
        this.graphics.fillStyle(bulletTint, 0.18 + bulletSpeedRatio * 0.12);
        this.graphics.fillTriangle(
          screen.x - bulletDirX * 18,
          screen.y - bulletDirY * 18,
          screen.x - bulletDirX * 6 + bulletOrthoX * 6,
          screen.y - bulletDirY * 6 + bulletOrthoY * 6,
          screen.x - bulletDirX * 6 - bulletOrthoX * 6,
          screen.y - bulletDirY * 6 - bulletOrthoY * 6,
        );
      }
      this.graphics.fillStyle(0xf8fbff, 0.98);
      this.graphics.fillCircle(screen.x, screen.y, (bullet.canEcho ? 3.4 : 2.8) + bulletHitRatio * 0.5);
      if (bullet.pierceRemaining > 0) {
        this.graphics.lineStyle(1 + bulletHitRatio * 0.4, this.mixColor(accentColor, 0xffffff, 0.35), 0.4 + bulletHitRatio * 0.1);
        this.graphics.strokeCircle(screen.x, screen.y, 6 + bulletHitRatio * 1.5);
      }
    }

    for (const projectile of battle.enemyProjectiles) {
      if (!this.isVisibleInCamera(camera, projectile.x, projectile.y, 24)) {
        continue;
      }

      const screen = this.worldToScreen(camera, projectile.x, projectile.y);
      const tail = this.worldToScreen(
        camera,
        projectile.x - projectile.vx * 0.075,
        projectile.y - projectile.vy * 0.075,
      );
      const projectilePulse = 0.5 + Math.sin(battle.elapsedSec * 9 + projectile.id * 0.43) * 0.5;
      this.graphics.lineStyle(projectile.radius > 5 ? 3 : 2, ENEMY_PROJECTILE_TRAIL, 0.22 + projectilePulse * 0.08);
      this.graphics.lineBetween(tail.x, tail.y, screen.x, screen.y);
      this.graphics.fillStyle(ENEMY_PROJECTILE_FILL, 0.14 + projectilePulse * 0.08);
      this.graphics.fillCircle(screen.x, screen.y, projectile.radius + 4 + projectilePulse * 2);
      this.graphics.fillStyle(ENEMY_PROJECTILE_FILL, 0.96);
      this.graphics.fillCircle(screen.x, screen.y, projectile.radius);
      this.graphics.lineStyle(1, ENEMY_PROJECTILE_STROKE, 0.42 + projectilePulse * 0.06);
      this.graphics.strokeCircle(screen.x, screen.y, projectile.radius + 2);
    }

    this.renderEliteEscortField(battle, camera);

    for (const enemy of battle.enemies) {
      const flashRatio = Math.min(1, enemy.hitFlashSec / 0.22);
      const spawnRatio = Math.min(1, enemy.spawnFlashSec / (enemy.elite ? 0.46 : 0.28));
      const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
      const pressureRatio = this.getEnemyPressureRatio(enemy);
      const enemyFill = this.mixColor(this.getEnemyFillColor(enemy), 0xffffff, flashRatio * 0.55 + recoveryRatio * 0.1);
      const enemyStroke = this.mixColor(this.getEnemyStrokeColor(enemy), 0xffffff, flashRatio * 0.4 + recoveryRatio * 0.16);
      const onScreen = this.isVisibleInCamera(camera, enemy.x, enemy.y, enemy.radius + 30);
      const screen = this.worldToScreen(camera, enemy.x + enemy.hitOffsetX, enemy.y + enemy.hitOffsetY);

      if (enemy.elite && !onScreen) {
        const hpRatio = enemy.hp / Math.max(1, enemy.maxHp);
        const clampedX = Phaser.Math.Clamp(screen.x, 48, camera.width - 48);
        const clampedY = Phaser.Math.Clamp(screen.y, 54, camera.height - 54);
        const angle = Math.atan2(screen.y - clampedY, screen.x - clampedX);

        this.graphics.fillStyle(0x1b1410, 0.88);
        this.graphics.fillCircle(clampedX, clampedY, 18);
        this.graphics.lineStyle(2, 0xffd774, 0.9);
        this.graphics.strokeCircle(clampedX, clampedY, 18);
        this.graphics.fillStyle(0xffd774, 0.96);
        this.graphics.fillTriangle(
          clampedX + Math.cos(angle) * 18,
          clampedY + Math.sin(angle) * 18,
          clampedX + Math.cos(angle + 2.45) * 10,
          clampedY + Math.sin(angle + 2.45) * 10,
          clampedX + Math.cos(angle - 2.45) * 10,
          clampedY + Math.sin(angle - 2.45) * 10,
        );
        this.graphics.fillStyle(0x241a12, 0.96);
        this.graphics.fillRoundedRect(clampedX - 24, clampedY + 22, 48, 5, 3);
        this.graphics.fillStyle(0xffd774, 1);
        this.graphics.fillRoundedRect(clampedX - 24, clampedY + 22, 48 * hpRatio, 5, 3);
        continue;
      }

      if (!onScreen) {
        continue;
      }

      this.graphics.fillStyle(0x000000, enemy.elite ? 0.24 : 0.18);
      this.graphics.fillEllipse(screen.x, screen.y + enemy.radius + 7, enemy.radius * 1.8, enemy.radius * 0.72);
      if (recoveryRatio > 0) {
        const recoveryColor =
          enemy.archetype === 'ranged'
            ? this.mixColor(enemyStroke, 0xa8f6ff, 0.44)
            : enemy.archetype === 'brute'
              ? this.mixColor(enemyStroke, 0xffd7af, 0.34)
              : enemy.archetype === 'skirmisher'
                ? this.mixColor(enemyStroke, 0xb8ffef, 0.34)
                : this.mixColor(enemyStroke, 0xffefc4, 0.28);
        const recoveryRadius = enemy.radius + 10 + (1 - recoveryRatio) * 8;
        this.graphics.lineStyle(2.4, recoveryColor, 0.12 + recoveryRatio * 0.26);
        this.graphics.strokeCircle(screen.x, screen.y, recoveryRadius);
        this.graphics.fillStyle(recoveryColor, 0.03 + recoveryRatio * 0.08);
        this.graphics.fillCircle(screen.x, screen.y, enemy.radius + 4 + recoveryRatio * 2);
        this.graphics.lineStyle(2, recoveryColor, 0.14 + recoveryRatio * 0.24);
        this.graphics.lineBetween(screen.x - recoveryRadius, screen.y, screen.x - enemy.radius - 4, screen.y);
        this.graphics.lineBetween(screen.x + enemy.radius + 4, screen.y, screen.x + recoveryRadius, screen.y);
      }
      if (spawnRatio > 0) {
        this.graphics.lineStyle(2, enemyStroke, 0.36 * spawnRatio);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 10 + (1 - spawnRatio) * 18);
      }
      if (flashRatio > 0) {
        this.graphics.fillStyle(0xffffff, 0.06 + flashRatio * 0.16);
        this.graphics.fillCircle(screen.x, screen.y, enemy.radius + 5 + flashRatio * 4);
        const hitDirLength = Math.max(1, Math.hypot(enemy.hitOffsetX, enemy.hitOffsetY));
        const hitDirX = enemy.hitOffsetX / hitDirLength;
        const hitDirY = enemy.hitOffsetY / hitDirLength;
        const hitOrthoX = -hitDirY;
        const hitOrthoY = hitDirX;
        const sparkColor = this.mixColor(enemyStroke, 0xffffff, 0.34);
        this.graphics.lineStyle(2, sparkColor, 0.16 + flashRatio * 0.34);
        this.graphics.lineBetween(
          screen.x + hitDirX * (enemy.radius * 0.2),
          screen.y + hitDirY * (enemy.radius * 0.2),
          screen.x + hitDirX * (enemy.radius + 10 + flashRatio * 10),
          screen.y + hitDirY * (enemy.radius + 10 + flashRatio * 10),
        );
        this.graphics.lineBetween(
          screen.x + hitDirX * 5 + hitOrthoX * 6,
          screen.y + hitDirY * 5 + hitOrthoY * 6,
          screen.x + hitDirX * (enemy.radius + 2) + hitOrthoX * (10 + flashRatio * 6),
          screen.y + hitDirY * (enemy.radius + 2) + hitOrthoY * (10 + flashRatio * 6),
        );
        this.graphics.lineBetween(
          screen.x + hitDirX * 5 - hitOrthoX * 6,
          screen.y + hitDirY * 5 - hitOrthoY * 6,
          screen.x + hitDirX * (enemy.radius + 2) - hitOrthoX * (10 + flashRatio * 6),
          screen.y + hitDirY * (enemy.radius + 2) - hitOrthoY * (10 + flashRatio * 6),
        );
      }
      if (pressureRatio > 0) {
        const pressureColor =
          enemy.elite
            ? this.mixColor(BATTLE_TEMPLATES[battle.templateId].accent, 0xfff0bf, 0.3)
            : enemy.archetype === 'brute'
              ? this.mixColor(enemyStroke, 0xffe1b2, 0.28)
              : enemy.archetype === 'skirmisher'
                ? this.mixColor(enemyStroke, 0xcaffef, 0.28)
                : enemy.archetype === 'ranged'
                  ? this.mixColor(enemyStroke, 0xdff7ff, 0.32)
                  : this.mixColor(enemyStroke, 0xfff1c9, 0.24);
        this.graphics.lineStyle(
          enemy.elite ? 3 : 2,
          pressureColor,
          enemy.elite ? 0.16 + pressureRatio * 0.3 : 0.08 + pressureRatio * 0.2,
        );
        this.graphics.strokeCircle(
          screen.x,
          screen.y,
          enemy.radius + (enemy.elite ? 14 : 9) + (1 - pressureRatio) * (enemy.elite ? 10 : 6),
        );
        if (enemy.elite) {
          const nearbyEscorts = battle.enemies
            .filter((candidate) => !candidate.elite)
            .sort(
              (left, right) =>
                Math.hypot(left.x - enemy.x, left.y - enemy.y) - Math.hypot(right.x - enemy.x, right.y - enemy.y),
            )
            .slice(0, 2);
          if (nearbyEscorts.length > 0) {
            this.graphics.lineStyle(2, pressureColor, 0.08 + pressureRatio * 0.18);
            for (const escort of nearbyEscorts) {
              const escortScreen = this.worldToScreen(camera, escort.x, escort.y);
              this.graphics.lineBetween(screen.x, screen.y, escortScreen.x, escortScreen.y);
            }
          } else {
            const faceAngle = Math.atan2(playerScreen.y - screen.y, playerScreen.x - screen.x);
            this.graphics.lineStyle(2, pressureColor, 0.12 + pressureRatio * 0.18);
            this.graphics.lineBetween(
              screen.x + Math.cos(faceAngle - 0.22) * (enemy.radius + 2),
              screen.y + Math.sin(faceAngle - 0.22) * (enemy.radius + 2),
              screen.x + Math.cos(faceAngle) * (enemy.radius + 22 + pressureRatio * 12),
              screen.y + Math.sin(faceAngle) * (enemy.radius + 22 + pressureRatio * 12),
            );
            this.graphics.lineBetween(
              screen.x + Math.cos(faceAngle + 0.22) * (enemy.radius + 2),
              screen.y + Math.sin(faceAngle + 0.22) * (enemy.radius + 2),
              screen.x + Math.cos(faceAngle) * (enemy.radius + 22 + pressureRatio * 12),
              screen.y + Math.sin(faceAngle) * (enemy.radius + 22 + pressureRatio * 12),
            );
          }
        }
      }
      this.graphics.fillStyle(enemyFill, enemy.elite ? 0.98 : 0.95);

      if (enemy.elite) {
        this.graphics.fillCircle(screen.x, screen.y, enemy.radius);
        this.graphics.lineStyle(2, enemyStroke, 0.32);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 5);
        if (battle.pressureTransitionSec > 0) {
          const pulseAlpha = Math.min(0.44, 0.14 + battle.pressureTransitionSec * 0.2);
          const pulseRadius = enemy.radius + 12 + (1.15 - battle.pressureTransitionSec) * 7;
          this.graphics.lineStyle(4, BATTLE_TEMPLATES[battle.templateId].accent, pulseAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, pulseRadius);
        }
        if (battle.pressureSignatureSec > 0) {
          const signatureAlpha = Math.min(0.28, 0.12 + battle.pressureSignatureSec * 0.04);
          const signatureRadius = enemy.radius + 15 + Math.sin(battle.elapsedSec * 7.5) * 2;
          this.graphics.lineStyle(3, BATTLE_TEMPLATES[battle.templateId].accent, signatureAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, signatureRadius);
        }
        if (battle.pressurePatternFlashSec > 0) {
          const patternAlpha = Math.min(0.26, 0.08 + battle.pressurePatternFlashSec * 0.28);
          this.graphics.lineStyle(2, BATTLE_TEMPLATES[battle.templateId].accent, patternAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 20 + battle.pressurePatternFlashSec * 12);
        }
        if (enemy.guardSec > 0) {
          const guardAlpha = Math.min(0.45, 0.16 + enemy.guardSec * 0.04);
          this.graphics.lineStyle(3, 0xfff2b0, guardAlpha);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 10);
        }
      } else if (enemy.archetype === 'ranged') {
        this.graphics.fillRoundedRect(screen.x - enemy.radius, screen.y - enemy.radius, enemy.radius * 2, enemy.radius * 2, 8);
        this.graphics.lineStyle(2, enemyStroke, 0.32);
        this.graphics.strokeRoundedRect(
          screen.x - enemy.radius - 2,
          screen.y - enemy.radius - 2,
          enemy.radius * 2 + 4,
          enemy.radius * 2 + 4,
          10,
        );
      } else {
        this.graphics.fillCircle(screen.x, screen.y, enemy.radius);
        this.graphics.lineStyle(2, enemyStroke, 0.26);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 4);
      }

      if (!enemy.elite && enemy.archetype === 'skirmisher') {
        this.graphics.lineStyle(2, enemyStroke, 0.36);
        this.graphics.lineBetween(screen.x - enemy.radius - 3, screen.y, screen.x + enemy.radius + 3, screen.y);
        this.graphics.lineBetween(
          screen.x - enemy.radius + 1,
          screen.y - enemy.radius + 2,
          screen.x + enemy.radius - 1,
          screen.y + enemy.radius - 2,
        );
        const orbitAngle = battle.elapsedSec * 4.4 + enemy.id * 0.7;
        const orbitRadius = enemy.radius + 9;
        this.graphics.fillStyle(enemyStroke, 0.18);
        this.graphics.fillCircle(
          screen.x + Math.cos(orbitAngle) * orbitRadius,
          screen.y + Math.sin(orbitAngle) * orbitRadius,
          2.4,
        );
        this.graphics.fillCircle(
          screen.x + Math.cos(orbitAngle + Math.PI) * orbitRadius,
          screen.y + Math.sin(orbitAngle + Math.PI) * orbitRadius,
          2,
        );
        if (pressureRatio > 0) {
          this.graphics.lineStyle(2, enemyStroke, 0.12 + pressureRatio * 0.18);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 13 + pressureRatio * 4);
        }
      }

      if (!enemy.elite && enemy.archetype === 'brute') {
        const faceAngle = Math.atan2(playerScreen.y - screen.y, playerScreen.x - screen.x);
        this.graphics.lineStyle(3, enemyStroke, 0.24);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 7);
        this.graphics.fillStyle(enemyStroke, 0.12);
        this.graphics.fillCircle(screen.x, screen.y, Math.max(4, enemy.radius - 4));
        this.graphics.lineStyle(2, enemyStroke, 0.24);
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle) * (enemy.radius - 2),
          screen.y + Math.sin(faceAngle) * (enemy.radius - 2),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 12),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 12),
        );
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle + 0.34) * (enemy.radius + 1),
          screen.y + Math.sin(faceAngle + 0.34) * (enemy.radius + 1),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 10),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 10),
        );
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle - 0.34) * (enemy.radius + 1),
          screen.y + Math.sin(faceAngle - 0.34) * (enemy.radius + 1),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 10),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 10),
        );
        if (pressureRatio > 0) {
          this.graphics.lineStyle(3, enemyStroke, 0.1 + pressureRatio * 0.18);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 11 + pressureRatio * 4);
        }
      }

      if (!enemy.elite && enemy.archetype === 'ranged') {
        this.graphics.lineStyle(2, enemyStroke, 0.36);
        this.graphics.lineBetween(screen.x, screen.y - enemy.radius - 4, screen.x, screen.y + enemy.radius + 4);
        const lockRatio = Phaser.Math.Clamp(1 - enemy.rangedCooldownSec / 0.85, 0, 1);
        this.graphics.lineStyle(1, enemyStroke, enemy.rangedCooldownSec <= 0.65 ? 0.24 + lockRatio * 0.14 : 0.12);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 10);
        if (enemy.rangedCooldownSec <= 0.65) {
          targetingIntensity = Math.max(targetingIntensity, lockRatio);
          const predictedTarget = this.getProjectedEnemyAimScreenPoint(enemy, battle, camera);
          this.graphics.lineStyle(1 + lockRatio, this.mixColor(enemyStroke, 0xffffff, 0.22), 0.2 + lockRatio * 0.18);
          this.graphics.lineBetween(screen.x, screen.y, predictedTarget.x, predictedTarget.y);
          this.graphics.lineStyle(1, this.mixColor(enemyStroke, 0xffffff, 0.3), 0.14 + lockRatio * 0.2);
          this.graphics.strokeCircle(predictedTarget.x, predictedTarget.y, 10 + lockRatio * 8);
          this.graphics.lineBetween(predictedTarget.x - 14, predictedTarget.y, predictedTarget.x - 5, predictedTarget.y);
          this.graphics.lineBetween(predictedTarget.x + 5, predictedTarget.y, predictedTarget.x + 14, predictedTarget.y);
          this.graphics.lineBetween(predictedTarget.x, predictedTarget.y - 14, predictedTarget.x, predictedTarget.y - 5);
          this.graphics.lineBetween(predictedTarget.x, predictedTarget.y + 5, predictedTarget.x, predictedTarget.y + 14);
          this.graphics.lineStyle(1, enemyStroke, 0.14 + lockRatio * 0.16);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 14 + lockRatio * 5);
        }
        if (recoveryRatio > 0) {
          const recoverColor = this.mixColor(enemyStroke, 0xb4ffff, 0.28);
          this.graphics.lineStyle(2, recoverColor, 0.16 + recoveryRatio * 0.22);
          this.graphics.lineBetween(screen.x - enemy.radius - 10, screen.y - enemy.radius - 8, screen.x - enemy.radius - 3, screen.y - 2);
          this.graphics.lineBetween(screen.x + enemy.radius + 10, screen.y - enemy.radius - 8, screen.x + enemy.radius + 3, screen.y - 2);
        }
        if (pressureRatio > 0) {
          this.graphics.lineStyle(1.5, enemyStroke, 0.12 + pressureRatio * 0.18);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 16 + pressureRatio * 5);
        }
      }

      if (!enemy.elite && enemy.archetype === 'standard' && pressureRatio > 0) {
        const faceAngle = Math.atan2(playerScreen.y - screen.y, playerScreen.x - screen.x);
        this.graphics.lineStyle(2, enemyStroke, 0.1 + pressureRatio * 0.18);
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle - 0.24) * (enemy.radius + 1),
          screen.y + Math.sin(faceAngle - 0.24) * (enemy.radius + 1),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 12 + pressureRatio * 6),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 12 + pressureRatio * 6),
        );
        this.graphics.lineBetween(
          screen.x + Math.cos(faceAngle + 0.24) * (enemy.radius + 1),
          screen.y + Math.sin(faceAngle + 0.24) * (enemy.radius + 1),
          screen.x + Math.cos(faceAngle) * (enemy.radius + 12 + pressureRatio * 6),
          screen.y + Math.sin(faceAngle) * (enemy.radius + 12 + pressureRatio * 6),
        );
      }

      const hpRatio = enemy.hp / enemy.maxHp;
      if (enemy.elite && battle.encounterType === 'boss') {
        const barWidth = 92;
        const barX = screen.x - barWidth * 0.5;
        const barY = screen.y - enemy.radius - 24;
        this.graphics.fillStyle(0x231b14, 0.92);
        this.graphics.fillRoundedRect(barX, barY, barWidth, 6, 3);
        this.graphics.fillStyle(0xffd774, 1);
        this.graphics.fillRoundedRect(barX, barY, barWidth * hpRatio, 6, 3);
        this.graphics.lineStyle(2, 0xffd774, 0.5);
        this.graphics.strokeRoundedRect(barX, barY, barWidth, 6, 3);
        this.graphics.fillStyle(0xffd774, 0.96);
        this.graphics.fillTriangle(screen.x, barY - 10, screen.x - 7, barY - 1, screen.x + 7, barY - 1);
      } else {
        this.graphics.fillStyle(0x1b1612, 0.84);
        this.graphics.fillRect(screen.x - 16, screen.y - enemy.radius - 10, 32, 4);
        this.graphics.fillStyle(enemy.elite ? 0xffdd7d : enemyStroke, 1);
        this.graphics.fillRect(screen.x - 16, screen.y - enemy.radius - 10, 32 * hpRatio, 4);
      }

      if (liveFocusRoute === 'crit' && !enemy.elite && hpRatio <= 0.4) {
        const executeColor = this.mixColor(0xffd66f, accentColor, 0.28);
        const bracketAlpha = 0.18 + (1 - hpRatio) * 0.34;
        this.graphics.lineStyle(2, executeColor, bracketAlpha);
        this.graphics.lineBetween(screen.x - enemy.radius - 12, screen.y - enemy.radius - 8, screen.x - enemy.radius - 4, screen.y - enemy.radius - 8);
        this.graphics.lineBetween(screen.x - enemy.radius - 12, screen.y - enemy.radius - 8, screen.x - enemy.radius - 12, screen.y - enemy.radius);
        this.graphics.lineBetween(screen.x + enemy.radius + 12, screen.y - enemy.radius - 8, screen.x + enemy.radius + 4, screen.y - enemy.radius - 8);
        this.graphics.lineBetween(screen.x + enemy.radius + 12, screen.y - enemy.radius - 8, screen.x + enemy.radius + 12, screen.y - enemy.radius);
        this.graphics.lineBetween(screen.x - enemy.radius - 12, screen.y + enemy.radius + 8, screen.x - enemy.radius - 4, screen.y + enemy.radius + 8);
        this.graphics.lineBetween(screen.x - enemy.radius - 12, screen.y + enemy.radius + 8, screen.x - enemy.radius - 12, screen.y + enemy.radius);
        this.graphics.lineBetween(screen.x + enemy.radius + 12, screen.y + enemy.radius + 8, screen.x + enemy.radius + 4, screen.y + enemy.radius + 8);
        this.graphics.lineBetween(screen.x + enemy.radius + 12, screen.y + enemy.radius + 8, screen.x + enemy.radius + 12, screen.y + enemy.radius);
      }

      if (liveFocusRoute === 'dash') {
        const dx = enemy.x - battle.playerX;
        const dy = enemy.y - battle.playerY;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const dashMoveMagnitude = Math.hypot(battle.playerMoveDirX, battle.playerMoveDirY);
        const dashMoveDirX = dashMoveMagnitude > 0.01 ? battle.playerMoveDirX / dashMoveMagnitude : 0;
        const dashMoveDirY = dashMoveMagnitude > 0.01 ? battle.playerMoveDirY / dashMoveMagnitude : 0;
        const alignment =
          dashMoveMagnitude > 0.05 ? ((dx / distance) * battle.playerMoveDirX) + ((dy / distance) * battle.playerMoveDirY) : 0;
        if (alignment > 0.7 && distance <= 180) {
          const pursuitColor = this.mixColor(0x8effdc, accentColor, 0.26);
          const pursuitAlpha = 0.16 + alignment * 0.18 + (battle.dashDriveSec > 0 ? 0.1 : 0);
          this.graphics.lineStyle(2, pursuitColor, pursuitAlpha);
          this.graphics.lineBetween(
            playerScreen.x + dashMoveDirX * 18,
            playerScreen.y + dashMoveDirY * 18,
            screen.x - (dx / distance) * (enemy.radius + 8),
            screen.y - (dy / distance) * (enemy.radius + 8),
          );
          this.graphics.lineStyle(1.5, pursuitColor, pursuitAlpha * 0.9);
          this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 12);
        }
      }
    }

    const impactRatio = Math.min(1, battle.playerImpactSec / 0.34);
    const recoveryRatio = Math.min(1, battle.playerRecoverySec / 0.26);
    const critAuraRatio = battle.critOverdriveSec > 0 ? Math.min(1, battle.critOverdriveSec / 4.2) : 0;
    const dashDriveRatio = battle.dashDriveSec > 0 ? Math.min(1, battle.dashDriveSec / 1.15) : 0;
    const freezeRatio = battle.impactFreezeSec > 0 ? Math.min(1, battle.impactFreezeSec / 0.09) : 0;
    const shotFlashRatio = battle.playerShotFlashSec > 0 ? Math.min(1, battle.playerShotFlashSec / 0.08) : 0;
    const shotRecoilRatio = battle.playerShotRecoilSec > 0 ? Math.min(1, battle.playerShotRecoilSec / 0.11) : 0;
    const moveBoostRatio = battle.playerMoveBoostSec > 0 ? Math.min(1, battle.playerMoveBoostSec / 0.16) : 0;
    const turnBurstRatio = battle.playerTurnBurstSec > 0 ? Math.min(1, battle.playerTurnBurstSec / 0.12) : 0;
    const nearMissRatio = battle.playerNearMissSec > 0 ? Math.min(1, battle.playerNearMissSec / 0.14) : 0;
    const killFlowRatio =
      battle.killFlowSec > 0
        ? Math.min(1, battle.killFlowSec / (battle.killFlowCount >= 3 ? 1 : battle.killFlowCount >= 2 ? 0.86 : 0.72))
        : 0;
    const damageFlashRatio = battle.playerDamageFlashSec > 0 ? Math.min(1, battle.playerDamageFlashSec / 0.34) : 0;
    const hpRatio = state.stats.hp / Math.max(1, state.stats.maxHp);
    const lowHpRatio = Phaser.Math.Clamp((0.46 - hpRatio) / 0.46, 0, 1);
    const criticalHpRatio = Phaser.Math.Clamp((0.24 - hpRatio) / 0.24, 0, 1);
    const dangerPulse = 0.5 + Math.sin(battle.elapsedSec * 6.3 + battle.kills * 0.12) * 0.5;
    const moveMagnitude = Math.hypot(battle.playerMoveDirX, battle.playerMoveDirY);
    const moveDirX = moveMagnitude > 0.01 ? battle.playerMoveDirX / moveMagnitude : 0;
    const moveDirY = moveMagnitude > 0.01 ? battle.playerMoveDirY / moveMagnitude : 0;
    const velocityMagnitude = Math.hypot(battle.playerVelocityX, battle.playerVelocityY);
    const velocityRatio = Phaser.Math.Clamp(velocityMagnitude / Math.max(1, getPlayerMoveSpeed(state.stats) * 1.16), 0, 1);
    const aimMagnitude = Math.hypot(battle.playerAimDirX, battle.playerAimDirY);
    const aimDirX = aimMagnitude > 0.01 ? battle.playerAimDirX / aimMagnitude : 0;
    const aimDirY = aimMagnitude > 0.01 ? battle.playerAimDirY / aimMagnitude : -1;
    const aimOrthoX = -aimDirY;
    const aimOrthoY = aimDirX;
    const damageDirX = Math.cos(battle.playerDamageAngle);
    const damageDirY = Math.sin(battle.playerDamageAngle);
    const nearMissDirX = Math.cos(battle.playerNearMissAngle);
    const nearMissDirY = Math.sin(battle.playerNearMissAngle);
    const knockbackSpeed = Math.hypot(battle.playerKnockbackVX, battle.playerKnockbackVY);
    const knockbackRatio = Math.min(1, knockbackSpeed / 240);
    const hurtDirX = knockbackSpeed > 0.01 ? battle.playerKnockbackVX / knockbackSpeed : -aimDirX;
    const hurtDirY = knockbackSpeed > 0.01 ? battle.playerKnockbackVY / knockbackSpeed : -aimDirY;
    const hurtOrthoX = -hurtDirY;
    const hurtOrthoY = hurtDirX;
    const recoilOffset = shotRecoilRatio * battle.playerShotRecoilStrength;
    const bodyX = playerScreen.x - aimDirX * recoilOffset;
    const bodyY = playerScreen.y - aimDirY * recoilOffset;
    const muzzleX = bodyX + aimDirX * (16 + shotFlashRatio * 10);
    const muzzleY = bodyY + aimDirY * (16 + shotFlashRatio * 10);
    const combatReadRatio = Math.max(
      tempoRatio,
      shotFlashRatio,
      critAuraRatio,
      dashDriveRatio,
      nearMissRatio,
      killFlowRatio,
      damageFlashRatio * 0.9,
      pierceReadRatio,
      moveBoostRatio,
      turnBurstRatio,
      velocityRatio * 0.8,
    );
    const liveFocusColor =
      liveFocusRoute === 'crit'
        ? this.mixColor(accentColor, 0xffd882, 0.34)
        : liveFocusRoute === 'pierce'
          ? this.mixColor(accentColor, 0xdff6ff, 0.3)
          : liveFocusRoute === 'dash'
            ? this.mixColor(accentColor, 0xbfffea, 0.3)
            : accentColor;

    this.graphics.fillStyle(0x000000, 0.22);
    this.graphics.fillEllipse(bodyX, bodyY + 18, 34, 14);
    this.graphics.fillStyle(liveFocusColor, 0.08 + combatReadRatio * 0.16);
    this.graphics.fillCircle(playerScreen.x, playerScreen.y, 72 + combatReadRatio * 18);
    if (impactRatio > 0) {
      this.graphics.fillStyle(0xff6964, 0.12 + impactRatio * 0.16);
      this.graphics.fillCircle(playerScreen.x, playerScreen.y, 66 + impactRatio * 10);
      this.graphics.fillStyle(0xff8d84, 0.08 + impactRatio * 0.12 + knockbackRatio * 0.06);
      this.graphics.fillTriangle(
        playerScreen.x - hurtDirX * (32 + knockbackRatio * 26),
        playerScreen.y - hurtDirY * (32 + knockbackRatio * 26),
        playerScreen.x - hurtDirX * 8 + hurtOrthoX * (10 + knockbackRatio * 10),
        playerScreen.y - hurtDirY * 8 + hurtOrthoY * (10 + knockbackRatio * 10),
        playerScreen.x - hurtDirX * 8 - hurtOrthoX * (10 + knockbackRatio * 10),
        playerScreen.y - hurtDirY * 8 - hurtOrthoY * (10 + knockbackRatio * 10),
      );
      this.graphics.lineStyle(2, 0xffdad3, 0.16 + impactRatio * 0.2);
      this.graphics.lineBetween(
        playerScreen.x + hurtOrthoX * 14,
        playerScreen.y + hurtOrthoY * 14,
        playerScreen.x + hurtDirX * (18 + freezeRatio * 10),
        playerScreen.y + hurtDirY * (18 + freezeRatio * 10),
      );
      this.graphics.lineBetween(
        playerScreen.x - hurtOrthoX * 14,
        playerScreen.y - hurtOrthoY * 14,
        playerScreen.x + hurtDirX * (18 + freezeRatio * 10),
        playerScreen.y + hurtDirY * (18 + freezeRatio * 10),
      );
    }
    if (damageFlashRatio > 0) {
      const damageColor = this.mixColor(0xff6a63, 0xfff0cb, 0.22);
      const damageRadius = 42 + damageFlashRatio * 10;
      this.graphics.lineStyle(2.2, damageColor, 0.12 + damageFlashRatio * 0.24);
      this.graphics.lineBetween(
        playerScreen.x + damageDirX * 20,
        playerScreen.y + damageDirY * 20,
        playerScreen.x + damageDirX * (damageRadius - 6),
        playerScreen.y + damageDirY * (damageRadius - 6),
      );
      this.renderDirectionalChevron(
        playerScreen.x,
        playerScreen.y,
        battle.playerDamageAngle,
        damageRadius,
        18 + damageFlashRatio * 16,
        9 + damageFlashRatio * 5,
        damageColor,
        0.16 + damageFlashRatio * 0.34,
        0.05 + damageFlashRatio * 0.12,
      );
      this.renderDirectionalChevron(
        playerScreen.x,
        playerScreen.y,
        battle.playerDamageAngle + 0.17,
        damageRadius + 8,
        10 + damageFlashRatio * 8,
        5 + damageFlashRatio * 3,
        damageColor,
        0.08 + damageFlashRatio * 0.16,
        0,
      );
      this.renderDirectionalChevron(
        playerScreen.x,
        playerScreen.y,
        battle.playerDamageAngle - 0.17,
        damageRadius + 8,
        10 + damageFlashRatio * 8,
        5 + damageFlashRatio * 3,
        damageColor,
        0.08 + damageFlashRatio * 0.16,
        0,
      );
    }
    if (recoveryRatio > 0) {
      this.graphics.lineStyle(3, 0x8cffc7, 0.3 + recoveryRatio * 0.34);
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 30 + (1 - recoveryRatio) * 16);
    }
    if (tempoRatio > 0) {
      this.graphics.lineStyle(2, accentColor, 0.16 + tempoRatio * 0.22);
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 40 + tempoRatio * 10);
      const surgeDirX = moveMagnitude > 0.08 ? moveDirX : aimDirX;
      const surgeDirY = moveMagnitude > 0.08 ? moveDirY : aimDirY;
      const surgeOrthoX = -surgeDirY;
      const surgeOrthoY = surgeDirX;
      const surgeColor = this.mixColor(liveFocusColor, 0xffffff, 0.18);
      for (let streak = 0; streak < 3; streak += 1) {
        const offset = 18 + streak * 12 + tempoRatio * 10;
        const width = 8 + streak * 2;
        this.graphics.fillStyle(surgeColor, 0.06 + tempoRatio * (0.06 - streak * 0.01));
        this.graphics.fillTriangle(
          bodyX - surgeDirX * (offset + 12) + surgeOrthoX * width,
          bodyY - surgeDirY * (offset + 12) + surgeOrthoY * width,
          bodyX - surgeDirX * offset,
          bodyY - surgeDirY * offset,
          bodyX - surgeDirX * (offset + 12) - surgeOrthoX * width,
          bodyY - surgeDirY * (offset + 12) - surgeOrthoY * width,
        );
      }
    }
    if (killFlowRatio > 0) {
      const flowDirX = moveMagnitude > 0.08 ? moveDirX : aimDirX;
      const flowDirY = moveMagnitude > 0.08 ? moveDirY : aimDirY;
      const flowOrthoX = -flowDirY;
      const flowOrthoY = flowDirX;
      const flowAngle = Math.atan2(flowDirY, flowDirX);
      const flowColor = this.mixColor(liveFocusColor, 0xfff2c3, 0.26 + killFlowRatio * 0.16);
      const chainCount = Math.max(1, battle.killFlowCount);
      this.graphics.lineStyle(2.2, flowColor, 0.12 + killFlowRatio * 0.22);
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 46 + killFlowRatio * 8 + chainCount * 2);
      for (let streak = 0; streak < Math.min(4, chainCount + 1); streak += 1) {
        const offset = 14 + streak * 10 + killFlowRatio * 8;
        const width = 8 + streak * 2 + killFlowRatio * 4;
        this.graphics.fillStyle(flowColor, 0.05 + killFlowRatio * 0.05 - streak * 0.008);
        this.graphics.fillTriangle(
          bodyX - flowDirX * (offset + 14) + flowOrthoX * width,
          bodyY - flowDirY * (offset + 14) + flowOrthoY * width,
          bodyX - flowDirX * offset,
          bodyY - flowDirY * offset,
          bodyX - flowDirX * (offset + 14) - flowOrthoX * width,
          bodyY - flowDirY * (offset + 14) - flowOrthoY * width,
        );
      }
      for (let pip = 0; pip < chainCount; pip += 1) {
        const spreadAngle = flowAngle + (pip - (chainCount - 1) / 2) * 0.24;
        const pipRadius = 34 + killFlowRatio * 8;
        this.graphics.fillStyle(flowColor, 0.46 + killFlowRatio * 0.18);
        this.graphics.fillCircle(
          playerScreen.x + Math.cos(spreadAngle) * pipRadius,
          playerScreen.y + Math.sin(spreadAngle) * pipRadius,
          2.4 + killFlowRatio * 1.2,
        );
      }
    }
    if (velocityRatio > 0.08 || moveBoostRatio > 0.08) {
      const trailDirX = moveMagnitude > 0.08 ? moveDirX : -aimDirX;
      const trailDirY = moveMagnitude > 0.08 ? moveDirY : -aimDirY;
      const trailOrthoX = -trailDirY;
      const trailOrthoY = trailDirX;
      const trailColor = this.mixColor(liveFocusColor, 0xe9ffff, 0.22 + moveBoostRatio * 0.16);
      for (let streak = 0; streak < 3; streak += 1) {
        const offset = 14 + streak * (10 + velocityRatio * 8);
        const width = 7 + streak * 2 + moveBoostRatio * 4;
        this.graphics.fillStyle(trailColor, 0.04 + velocityRatio * 0.04 + moveBoostRatio * 0.05 - streak * 0.01);
        this.graphics.fillTriangle(
          bodyX - trailDirX * (offset + 14) + trailOrthoX * width,
          bodyY - trailDirY * (offset + 14) + trailOrthoY * width,
          bodyX - trailDirX * offset,
          bodyY - trailDirY * offset,
          bodyX - trailDirX * (offset + 14) - trailOrthoX * width,
          bodyY - trailDirY * (offset + 14) - trailOrthoY * width,
        );
      }
    }
    if (turnBurstRatio > 0.08) {
      const skidColor = this.mixColor(0xbef7ff, liveFocusColor, 0.28);
      this.graphics.lineStyle(2, skidColor, 0.12 + turnBurstRatio * 0.24);
      this.graphics.lineBetween(
        bodyX + moveDirY * 16,
        bodyY - moveDirX * 16,
        bodyX + moveDirY * (30 + turnBurstRatio * 18),
        bodyY - moveDirX * (30 + turnBurstRatio * 18),
      );
      this.graphics.lineBetween(
        bodyX - moveDirY * 16,
        bodyY + moveDirX * 16,
        bodyX - moveDirY * (30 + turnBurstRatio * 18),
        bodyY + moveDirX * (30 + turnBurstRatio * 18),
      );
    }
    if (nearMissRatio > 0) {
      const nearMissColor = this.mixColor(0xffa289, 0xffffff, 0.22);
      this.graphics.lineStyle(2, nearMissColor, 0.08 + nearMissRatio * 0.22);
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 36 + (1 - nearMissRatio) * 12);
      this.graphics.lineStyle(1.5, nearMissColor, 0.06 + nearMissRatio * 0.16);
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 54 + (1 - nearMissRatio) * 18);
      this.graphics.lineStyle(1.5, nearMissColor, 0.08 + nearMissRatio * 0.18);
      this.graphics.lineBetween(
        playerScreen.x + nearMissDirX * 28,
        playerScreen.y + nearMissDirY * 28,
        playerScreen.x + nearMissDirX * (44 + nearMissRatio * 10),
        playerScreen.y + nearMissDirY * (44 + nearMissRatio * 10),
      );
      this.renderDirectionalChevron(
        playerScreen.x,
        playerScreen.y,
        battle.playerNearMissAngle,
        48 + (1 - nearMissRatio) * 8,
        12 + nearMissRatio * 8,
        7 + nearMissRatio * 4,
        nearMissColor,
        0.1 + nearMissRatio * 0.18,
        0.03 + nearMissRatio * 0.06,
      );
    }
    if (critAuraRatio > 0) {
      const spokeColor = this.mixColor(accentColor, 0xfff0ad, 0.38);
      this.graphics.lineStyle(2, spokeColor, 0.18 + critAuraRatio * 0.3);
      for (let spoke = 0; spoke < 4; spoke += 1) {
        const angle = battle.elapsedSec * 4.8 + spoke * (Math.PI / 2);
        this.graphics.lineBetween(
          playerScreen.x + Math.cos(angle) * 22,
          playerScreen.y + Math.sin(angle) * 22,
          playerScreen.x + Math.cos(angle) * 34,
          playerScreen.y + Math.sin(angle) * 34,
        );
      }
      this.graphics.lineStyle(3, spokeColor, 0.16 + critAuraRatio * 0.26);
      this.graphics.lineBetween(
        playerScreen.x + aimDirX * 18,
        playerScreen.y + aimDirY * 18,
        playerScreen.x + aimDirX * (48 + critAuraRatio * 18),
        playerScreen.y + aimDirY * (48 + critAuraRatio * 18),
      );
      this.graphics.lineStyle(1.5, 0xfff8d0, 0.16 + critAuraRatio * 0.22);
      this.graphics.lineBetween(
        playerScreen.x + aimDirX * 18 + aimOrthoX * 8,
        playerScreen.y + aimDirY * 18 + aimOrthoY * 8,
        playerScreen.x + aimDirX * (40 + critAuraRatio * 12),
        playerScreen.y + aimDirY * (40 + critAuraRatio * 12),
      );
      this.graphics.lineBetween(
        playerScreen.x + aimDirX * 18 - aimOrthoX * 8,
        playerScreen.y + aimDirY * 18 - aimOrthoY * 8,
        playerScreen.x + aimDirX * (40 + critAuraRatio * 12),
        playerScreen.y + aimDirY * (40 + critAuraRatio * 12),
      );
    }
    if (liveFocusRoute === 'crit' && combatReadRatio > 0.08) {
      const critSlashColor = this.mixColor(accentColor, 0xfff0b0, 0.32);
      this.graphics.lineStyle(2.4, critSlashColor, 0.16 + combatReadRatio * 0.28);
      this.graphics.lineBetween(
        bodyX - aimOrthoX * 16 - aimDirX * 6,
        bodyY - aimOrthoY * 16 - aimDirY * 6,
        bodyX + aimDirX * (42 + combatReadRatio * 22),
        bodyY + aimDirY * (42 + combatReadRatio * 22),
      );
      this.graphics.lineBetween(
        bodyX + aimOrthoX * 16 - aimDirX * 6,
        bodyY + aimOrthoY * 16 - aimDirY * 6,
        bodyX + aimDirX * (42 + combatReadRatio * 22),
        bodyY + aimDirY * (42 + combatReadRatio * 22),
      );
      this.graphics.fillStyle(critSlashColor, 0.08 + combatReadRatio * 0.12);
      this.graphics.fillTriangle(
        bodyX + aimDirX * (26 + combatReadRatio * 14),
        bodyY + aimDirY * (26 + combatReadRatio * 14),
        bodyX + aimOrthoX * 12,
        bodyY + aimOrthoY * 12,
        bodyX - aimOrthoX * 12,
        bodyY - aimOrthoY * 12,
      );
    }
    if (battle.dashCharge > 0) {
      const pipColor = this.mixColor(accentColor, 0xbffff3, 0.44);
      for (let pip = 0; pip < battle.dashCharge; pip += 1) {
        const angle = -Math.PI / 2 + (pip / 6) * Math.PI * 2;
        this.graphics.fillStyle(pipColor, 0.56 + dashDriveRatio * 0.18);
        this.graphics.fillCircle(
          playerScreen.x + Math.cos(angle) * 34,
          playerScreen.y + Math.sin(angle) * 34,
          2.6,
        );
      }
    }
    if (pierceReadRatio > 0) {
      const laneColor = this.mixColor(accentColor, 0xe7f7ff, 0.34);
      this.graphics.lineStyle(2, laneColor, 0.08 + pierceReadRatio * 0.14);
      this.graphics.lineBetween(
        playerScreen.x - aimDirX * 32 - aimOrthoX * 14,
        playerScreen.y - aimDirY * 32 - aimOrthoY * 14,
        playerScreen.x + aimDirX * 86 - aimOrthoX * 14,
        playerScreen.y + aimDirY * 86 - aimOrthoY * 14,
      );
      this.graphics.lineBetween(
        playerScreen.x - aimDirX * 28 + aimOrthoX * 14,
        playerScreen.y - aimDirY * 28 + aimOrthoY * 14,
        playerScreen.x + aimDirX * 82 + aimOrthoX * 14,
        playerScreen.y + aimDirY * 82 + aimOrthoY * 14,
      );
      this.graphics.lineStyle(1, laneColor, 0.08 + pierceReadRatio * 0.12);
      this.graphics.lineBetween(
        playerScreen.x - aimDirX * 22,
        playerScreen.y - aimDirY * 22,
        playerScreen.x + aimDirX * 92,
        playerScreen.y + aimDirY * 92,
      );
    }
    if (liveFocusRoute === 'pierce' && combatReadRatio > 0.08) {
      const latticeColor = this.mixColor(accentColor, 0xe7f7ff, 0.34);
      for (let lane = -1; lane <= 1; lane += 1) {
        const offset = lane * 18;
        this.graphics.lineStyle(lane === 0 ? 2.4 : 1.6, latticeColor, 0.12 + combatReadRatio * (lane === 0 ? 0.2 : 0.12));
        this.graphics.lineBetween(
          bodyX - aimDirX * 20 + aimOrthoX * offset,
          bodyY - aimDirY * 20 + aimOrthoY * offset,
          bodyX + aimDirX * (118 + combatReadRatio * 34) + aimOrthoX * offset,
          bodyY + aimDirY * (118 + combatReadRatio * 34) + aimOrthoY * offset,
        );
      }
    }
    if (dominantRoute === 'dash' && (dashDriveRatio > 0 || moveMagnitude > 0.08)) {
      const trailDirX = moveMagnitude > 0.08 ? moveDirX : -aimDirX;
      const trailDirY = moveMagnitude > 0.08 ? moveDirY : -aimDirY;
      const trailOrthoX = -trailDirY;
      const trailOrthoY = trailDirX;
      const trailLength = 22 + dashDriveRatio * 24;
      this.graphics.fillStyle(this.mixColor(accentColor, 0xc9fff1, 0.3), 0.08 + dashDriveRatio * 0.12);
      this.graphics.fillTriangle(
        playerScreen.x - trailDirX * trailLength,
        playerScreen.y - trailDirY * trailLength,
        playerScreen.x - trailDirX * 6 + trailOrthoX * 12,
        playerScreen.y - trailDirY * 6 + trailOrthoY * 12,
        playerScreen.x - trailDirX * 6 - trailOrthoX * 12,
        playerScreen.y - trailDirY * 6 - trailOrthoY * 12,
      );
      this.graphics.lineStyle(2, this.mixColor(accentColor, 0xffffff, 0.2), 0.16 + dashDriveRatio * 0.18);
      this.graphics.lineBetween(
        playerScreen.x - trailDirX * (trailLength + 8),
        playerScreen.y - trailDirY * (trailLength + 8),
        playerScreen.x - trailDirX * 8,
        playerScreen.y - trailDirY * 8,
      );
    }
    if (liveFocusRoute === 'dash' && (combatReadRatio > 0.08 || moveMagnitude > 0.08)) {
      const dashDirX = moveMagnitude > 0.08 ? moveDirX : -aimDirX;
      const dashDirY = moveMagnitude > 0.08 ? moveDirY : -aimDirY;
      const dashAfterColor = this.mixColor(accentColor, 0xd8fff5, 0.34);
      for (let afterimage = 1; afterimage <= 2; afterimage += 1) {
        const offset = 18 + afterimage * (12 + combatReadRatio * 10);
        this.graphics.fillStyle(dashAfterColor, 0.08 + combatReadRatio * 0.06 - afterimage * 0.02);
        this.graphics.fillCircle(
          bodyX - dashDirX * offset,
          bodyY - dashDirY * offset,
          Math.max(8, 12 - afterimage * 2 + combatReadRatio * 3),
        );
      }
    }
    if (targetingIntensity > 0) {
      const warningColor = this.mixColor(0xff8d84, 0xffffff, 0.24);
      this.graphics.lineStyle(2, warningColor, 0.14 + targetingIntensity * 0.24);
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 34 + targetingIntensity * 10);
      this.graphics.lineBetween(playerScreen.x - 26, playerScreen.y, playerScreen.x - 12, playerScreen.y);
      this.graphics.lineBetween(playerScreen.x + 12, playerScreen.y, playerScreen.x + 26, playerScreen.y);
      this.graphics.lineBetween(playerScreen.x, playerScreen.y - 26, playerScreen.x, playerScreen.y - 12);
      this.graphics.lineBetween(playerScreen.x, playerScreen.y + 12, playerScreen.x, playerScreen.y + 26);
    }
    if (lowHpRatio > 0) {
      const dangerColor = this.mixColor(0xff5d58, accentColor, 0.16);
      const dangerHighlight = this.mixColor(dangerColor, 0xffffff, 0.16);
      const edgeAlpha = 0.025 + lowHpRatio * 0.05 + dangerPulse * lowHpRatio * 0.035;
      const edgeDepth = 18 + lowHpRatio * 28;
      const cornerInset = 18;
      const cornerLength = 20 + lowHpRatio * 20 + dangerPulse * 8;
      this.graphics.fillStyle(dangerColor, edgeAlpha);
      this.graphics.fillRect(0, 0, camera.width, edgeDepth);
      this.graphics.fillRect(0, camera.height - edgeDepth, camera.width, edgeDepth);
      this.graphics.fillRect(0, edgeDepth, edgeDepth, camera.height - edgeDepth * 2);
      this.graphics.fillRect(camera.width - edgeDepth, edgeDepth, edgeDepth, camera.height - edgeDepth * 2);
      this.graphics.lineStyle(2 + criticalHpRatio * 1.4, dangerHighlight, 0.12 + lowHpRatio * 0.22 + dangerPulse * 0.06);
      this.graphics.lineBetween(cornerInset, cornerInset, cornerInset + cornerLength, cornerInset);
      this.graphics.lineBetween(cornerInset, cornerInset, cornerInset, cornerInset + cornerLength);
      this.graphics.lineBetween(camera.width - cornerInset, cornerInset, camera.width - cornerInset - cornerLength, cornerInset);
      this.graphics.lineBetween(camera.width - cornerInset, cornerInset, camera.width - cornerInset, cornerInset + cornerLength);
      this.graphics.lineBetween(cornerInset, camera.height - cornerInset, cornerInset + cornerLength, camera.height - cornerInset);
      this.graphics.lineBetween(cornerInset, camera.height - cornerInset, cornerInset, camera.height - cornerInset - cornerLength);
      this.graphics.lineBetween(
        camera.width - cornerInset,
        camera.height - cornerInset,
        camera.width - cornerInset - cornerLength,
        camera.height - cornerInset,
      );
      this.graphics.lineBetween(
        camera.width - cornerInset,
        camera.height - cornerInset,
        camera.width - cornerInset,
        camera.height - cornerInset - cornerLength,
      );
      this.graphics.lineStyle(2.2, dangerHighlight, 0.12 + lowHpRatio * 0.24);
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 44 + dangerPulse * 9 + lowHpRatio * 10);
      if (criticalHpRatio > 0) {
        this.graphics.lineStyle(2.2, this.mixColor(0xffc29c, 0xffffff, 0.22), 0.1 + criticalHpRatio * 0.22 + dangerPulse * 0.08);
        this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 68 + dangerPulse * 12 + criticalHpRatio * 12);
      }
    }

    const auraColor = this.mixColor(liveFocusColor, 0xffffff, recoveryRatio * 0.26 + critAuraRatio * 0.14);
    this.graphics.fillStyle(auraColor, battle.invulnerableSec > 0 ? 0.22 : 0.11 + dashDriveRatio * 0.04);
    this.graphics.fillCircle(playerScreen.x, playerScreen.y, 58 + dashDriveRatio * 6);
    if (freezeRatio > 0) {
      this.graphics.lineStyle(2 + freezeRatio, 0xffffff, 0.12 + freezeRatio * 0.22);
      this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 22 + freezeRatio * 12);
    }
    this.graphics.lineStyle(2, auraColor, battle.invulnerableSec > 0 ? 0.62 : 0.26 + critAuraRatio * 0.08);
    this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 26 + dashDriveRatio * 2);
    this.graphics.lineStyle(1, 0xffffff, battle.invulnerableSec > 0 ? 0.48 : 0.18 + recoveryRatio * 0.08);
    this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 15 + dashDriveRatio);
    this.graphics.fillStyle(
      impactRatio > 0 ? this.mixColor(0xf8fbff, 0xff8c86, impactRatio * 0.8) : battle.invulnerableSec > 0 ? 0x9cff97 : 0xf8fbff,
      1,
    );
    if (shotFlashRatio > 0) {
      const flashColor =
        liveFocusRoute === 'crit'
          ? this.mixColor(0xffcf76, 0xffffff, 0.24)
          : liveFocusRoute === 'pierce'
            ? this.mixColor(0x98dcff, 0xffffff, 0.26)
            : liveFocusRoute === 'dash'
              ? this.mixColor(0x8effde, 0xffffff, 0.24)
              : 0xf8fbff;
      this.graphics.fillStyle(flashColor, 0.18 + shotFlashRatio * 0.3);
      this.graphics.fillTriangle(
        muzzleX + aimDirX * (14 + shotFlashRatio * 16),
        muzzleY + aimDirY * (14 + shotFlashRatio * 16),
        bodyX + aimOrthoX * (5 + shotFlashRatio * 8),
        bodyY + aimOrthoY * (5 + shotFlashRatio * 8),
        bodyX - aimOrthoX * (5 + shotFlashRatio * 8),
        bodyY - aimOrthoY * (5 + shotFlashRatio * 8),
      );
      this.graphics.lineStyle(2, flashColor, 0.14 + shotFlashRatio * 0.24);
      this.graphics.lineBetween(
        bodyX + aimOrthoX * 7,
        bodyY + aimOrthoY * 7,
        muzzleX + aimDirX * (20 + shotFlashRatio * 18),
        muzzleY + aimDirY * (20 + shotFlashRatio * 18),
      );
      this.graphics.lineBetween(
        bodyX - aimOrthoX * 7,
        bodyY - aimOrthoY * 7,
        muzzleX + aimDirX * (20 + shotFlashRatio * 18),
        muzzleY + aimDirY * (20 + shotFlashRatio * 18),
      );
    }
    this.graphics.fillCircle(bodyX, bodyY, 10 + velocityRatio * 0.8);

    this.graphics.fillGradientStyle(
      0x000000,
      0x000000,
      0x000000,
      0x000000,
      0.034 + impactRatio * 0.04 + lowHpRatio * 0.025,
    );
    this.graphics.fillRect(0, 0, camera.width, camera.height);
    if (impactRatio > 0) {
      this.graphics.fillStyle(0xff5f59, 0.03 + impactRatio * 0.05);
      this.graphics.fillRect(0, 0, camera.width, camera.height);
    }
  }

  private getLiveCombatFocusRoute(battle: BattleState): 'crit' | 'pierce' | 'dash' | null {
    const state = this.engine.getState();
    if (battle.dashDriveSec > 0 && state.routeCounts.dash > 0) {
      return 'dash';
    }
    if (battle.critOverdriveSec > 0 && state.routeCounts.crit > 0) {
      return 'crit';
    }
    return state.maturedRoute ?? state.committedRoute ?? this.engine.getDominantRoute();
  }

  private getProjectedEnemyAimScreenPoint(
    enemy: BattleState['enemies'][number],
    battle: BattleState,
    camera: { left: number; top: number },
  ): { x: number; y: number } {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const leadSec = pattern === 'lanes' ? 0.24 : 0.18;
    const predictedX = battle.playerX + battle.playerMoveDirX * getPlayerMoveSpeed(this.engine.getState().stats) * leadSec;
    const predictedY = battle.playerY + battle.playerMoveDirY * getPlayerMoveSpeed(this.engine.getState().stats) * leadSec;
    return this.worldToScreen(camera, predictedX, predictedY);
  }

  private renderDirectionalChevron(
    centerX: number,
    centerY: number,
    angle: number,
    innerRadius: number,
    length: number,
    halfWidth: number,
    color: number,
    lineAlpha: number,
    fillAlpha: number,
  ): void {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const orthoX = -dirY;
    const orthoY = dirX;
    const baseX = centerX + dirX * innerRadius;
    const baseY = centerY + dirY * innerRadius;
    const tipX = centerX + dirX * (innerRadius + length);
    const tipY = centerY + dirY * (innerRadius + length);
    const leftX = baseX - dirX * (length * 0.28) + orthoX * halfWidth;
    const leftY = baseY - dirY * (length * 0.28) + orthoY * halfWidth;
    const rightX = baseX - dirX * (length * 0.28) - orthoX * halfWidth;
    const rightY = baseY - dirY * (length * 0.28) - orthoY * halfWidth;

    if (fillAlpha > 0) {
      this.graphics.fillStyle(color, fillAlpha);
      this.graphics.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
    }

    this.graphics.lineStyle(2, color, lineAlpha);
    this.graphics.lineBetween(leftX, leftY, tipX, tipY);
    this.graphics.lineBetween(rightX, rightY, tipX, tipY);
    this.graphics.lineStyle(1.4, color, lineAlpha * 0.8);
    this.graphics.lineBetween(baseX + orthoX * (halfWidth * 0.42), baseY + orthoY * (halfWidth * 0.42), leftX, leftY);
    this.graphics.lineBetween(baseX - orthoX * (halfWidth * 0.42), baseY - orthoY * (halfWidth * 0.42), rightX, rightY);
  }

  private renderEliteEscortField(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
  ): void {
    const elite = battle.enemies.find((enemy) => enemy.elite && enemy.hp > 0);
    if (!elite || !this.isVisibleInCamera(camera, elite.x, elite.y, elite.radius + 96)) {
      return;
    }

    const elitePressure = this.getEnemyPressureRatio(elite);
    const eliteRecovery = this.getEnemyRecoveryRatio(elite);
    const escorts = battle.enemies
      .filter((enemy) => !enemy.elite && enemy.role === 'escort' && enemy.hp > 0)
      .map((enemy) => ({
        enemy,
        distance: Math.hypot(enemy.x - elite.x, enemy.y - elite.y),
      }))
      .filter(
        (entry) =>
          entry.distance <= 228 &&
          this.isVisibleInCamera(camera, entry.enemy.x, entry.enemy.y, entry.enemy.radius + 28),
      )
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 4);

    if (escorts.length === 0 && elitePressure <= 0.05 && eliteRecovery <= 0.08) {
      return;
    }

    const eliteScreen = this.worldToScreen(camera, elite.x, elite.y);
    const playerScreen = this.worldToScreen(camera, battle.playerX, battle.playerY);
    const pulseColor = this.mixColor(BATTLE_TEMPLATES[battle.templateId].accent, 0xffefbf, 0.34);
    const crackColor = this.mixColor(0xfff0c4, 0xf5fbff, 0.42);

    if (escorts.length > 0 && elitePressure > 0.04) {
      this.graphics.lineStyle(1.8, pulseColor, 0.06 + elitePressure * 0.18);
      for (const entry of escorts) {
        const escortScreen = this.worldToScreen(camera, entry.enemy.x, entry.enemy.y);
        this.graphics.lineBetween(eliteScreen.x, eliteScreen.y, escortScreen.x, escortScreen.y);
        this.graphics.strokeCircle(escortScreen.x, escortScreen.y, entry.enemy.radius + 10 + elitePressure * 6);
      }
      if (escorts.length >= 2) {
        this.graphics.lineStyle(1.3, pulseColor, 0.04 + elitePressure * 0.14);
        for (let index = 0; index < escorts.length - 1; index += 1) {
          const from = this.worldToScreen(camera, escorts[index].enemy.x, escorts[index].enemy.y);
          const to = this.worldToScreen(camera, escorts[index + 1].enemy.x, escorts[index + 1].enemy.y);
          this.graphics.lineBetween(from.x, from.y, to.x, to.y);
        }
      }
    }

    if (eliteRecovery > 0.08) {
      const chaseDx = playerScreen.x - eliteScreen.x;
      const chaseDy = playerScreen.y - eliteScreen.y;
      const chaseDistance = Math.max(1, Math.hypot(chaseDx, chaseDy));
      const chaseDirX = chaseDx / chaseDistance;
      const chaseDirY = chaseDy / chaseDistance;
      const chaseOrthoX = -chaseDirY;
      const chaseOrthoY = chaseDirX;
      const breachLength = Math.max(28, Math.min(chaseDistance - 12, elite.radius + 86 + eliteRecovery * 42));
      const breachWidth = elite.radius + 8 + eliteRecovery * 14;
      const breachLeftX = eliteScreen.x + chaseOrthoX * breachWidth;
      const breachLeftY = eliteScreen.y + chaseOrthoY * breachWidth;
      const breachRightX = eliteScreen.x - chaseOrthoX * breachWidth;
      const breachRightY = eliteScreen.y - chaseOrthoY * breachWidth;
      const breachTipX = eliteScreen.x + chaseDirX * breachLength;
      const breachTipY = eliteScreen.y + chaseDirY * breachLength;
      this.graphics.fillStyle(crackColor, 0.03 + eliteRecovery * 0.06);
      this.graphics.fillTriangle(breachLeftX, breachLeftY, breachTipX, breachTipY, breachRightX, breachRightY);
      this.graphics.lineStyle(1.6, crackColor, 0.08 + eliteRecovery * 0.18);
      this.graphics.lineBetween(breachLeftX, breachLeftY, breachTipX, breachTipY);
      this.graphics.lineBetween(breachRightX, breachRightY, breachTipX, breachTipY);
      this.graphics.lineStyle(2.2, crackColor, 0.08 + eliteRecovery * 0.22);
      this.graphics.strokeCircle(eliteScreen.x, eliteScreen.y, elite.radius + 26 + (1 - eliteRecovery) * 10);
      this.graphics.lineStyle(1.8, crackColor, 0.08 + eliteRecovery * 0.2);
      this.graphics.lineBetween(
        eliteScreen.x - (elite.radius + 8),
        eliteScreen.y,
        eliteScreen.x - (elite.radius + 24 + eliteRecovery * 10),
        eliteScreen.y,
      );
      this.graphics.lineBetween(
        eliteScreen.x + elite.radius + 8,
        eliteScreen.y,
        eliteScreen.x + elite.radius + 24 + eliteRecovery * 10,
        eliteScreen.y,
      );
      const chaseGuideColor = this.mixColor(crackColor, 0xffffff, 0.18);
      const chaseGuideAlpha = 0.04 + eliteRecovery * 0.14;
      this.graphics.lineStyle(1.6, chaseGuideColor, chaseGuideAlpha);
      this.graphics.lineBetween(playerScreen.x, playerScreen.y, breachTipX, breachTipY);
      for (let marker = 0; marker < 3; marker += 1) {
        const markerDistance = breachLength * (0.32 + marker * 0.18);
        const markerX = eliteScreen.x + chaseDirX * markerDistance;
        const markerY = eliteScreen.y + chaseDirY * markerDistance;
        const markerSize = 6 + eliteRecovery * 4 + marker * 1.5;
        this.graphics.lineStyle(1.4, chaseGuideColor, chaseGuideAlpha + 0.04 - marker * 0.01);
        this.graphics.lineBetween(
          markerX - chaseDirX * markerSize + chaseOrthoX * markerSize * 0.8,
          markerY - chaseDirY * markerSize + chaseOrthoY * markerSize * 0.8,
          markerX,
          markerY,
        );
        this.graphics.lineBetween(
          markerX - chaseDirX * markerSize - chaseOrthoX * markerSize * 0.8,
          markerY - chaseDirY * markerSize - chaseOrthoY * markerSize * 0.8,
          markerX,
          markerY,
        );
      }
      for (const entry of escorts) {
        const escortRecovery = this.getEnemyRecoveryRatio(entry.enemy);
        if (escortRecovery <= 0.05) {
          continue;
        }
        const escortScreen = this.worldToScreen(camera, entry.enemy.x, entry.enemy.y);
        const dx = escortScreen.x - eliteScreen.x;
        const dy = escortScreen.y - eliteScreen.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const dirX = dx / distance;
        const dirY = dy / distance;
        const linkAlpha = 0.06 + Math.max(eliteRecovery, escortRecovery) * 0.18;
        this.graphics.lineStyle(1.8, crackColor, linkAlpha);
        this.graphics.lineBetween(
          eliteScreen.x + dirX * (elite.radius + 6),
          eliteScreen.y + dirY * (elite.radius + 6),
          escortScreen.x - dirX * (entry.enemy.radius + 6),
          escortScreen.y - dirY * (entry.enemy.radius + 6),
        );
        this.graphics.strokeCircle(
          escortScreen.x,
          escortScreen.y,
          entry.enemy.radius + 12 + escortRecovery * 8,
        );
      }
    }
  }

  private renderEncounterFlowOverlay(
    battle: BattleState,
    camera: { left: number; top: number; width: number; height: number },
    accentColor: number,
  ): void {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    const alpha = 0.026 + Math.min(0.04, battle.tempoPulseSec * 0.1 + (battle.elapsedSec / Math.max(1, template.durationSec)) * 0.028);
    const flowPulse = 0.5 + Math.sin(battle.elapsedSec * 2.2) * 0.5;

    if (pattern === 'pincers') {
      const slide = ((battle.elapsedSec * 84) % 64) - 18;
      this.graphics.fillStyle(accentColor, alpha * (0.34 + flowPulse * 0.22));
      this.graphics.fillRect(0, 68, 22, camera.height - 136);
      this.graphics.fillRect(camera.width - 22, 68, 22, camera.height - 136);
      this.graphics.lineStyle(2, accentColor, alpha * 1.25);
      for (let lane = 0; lane < 3; lane += 1) {
        const y = 132 + lane * ((camera.height - 264) / 2);
        this.graphics.lineBetween(36, y, 78, y - 20);
        this.graphics.lineBetween(36, y, 78, y + 20);
        this.graphics.lineBetween(camera.width - 36, y, camera.width - 78, y - 20);
        this.graphics.lineBetween(camera.width - 36, y, camera.width - 78, y + 20);
        this.graphics.fillStyle(accentColor, alpha * (0.48 + flowPulse * 0.16));
        this.graphics.fillRoundedRect(22 + slide, y - 7, 24, 14, 5);
        this.graphics.fillRoundedRect(camera.width - 46 - slide, y - 7, 24, 14, 5);
      }
      return;
    }

    if (pattern === 'lanes' && laneBias === 'vertical') {
      const laneWidth = camera.width / 4;
      const sweep = (battle.elapsedSec * 98) % Math.max(80, camera.height - 104);
      for (let lane = 1; lane <= 3; lane += 1) {
        const x = laneWidth * lane;
        this.graphics.fillStyle(accentColor, alpha * 0.45);
        this.graphics.fillRect(x - 14, 22, 28, camera.height - 44);
        this.graphics.lineStyle(1, accentColor, alpha * 1.1);
        this.graphics.lineBetween(x, 18, x, camera.height - 18);
        this.graphics.fillStyle(accentColor, alpha * (0.54 + flowPulse * 0.14));
        this.graphics.fillRoundedRect(x - 12, 24 + sweep * 0.52, 24, 18, 6);
        this.graphics.fillRoundedRect(x - 12, camera.height - 42 - sweep * 0.52, 24, 18, 6);
      }
      return;
    }

    if (pattern === 'lanes' && laneBias === 'horizontal') {
      const laneHeight = camera.height / 4;
      const sweep = (battle.elapsedSec * 104) % Math.max(96, camera.width - 156);
      for (let lane = 1; lane <= 3; lane += 1) {
        const y = laneHeight * lane;
        this.graphics.fillStyle(accentColor, alpha * 0.42);
        this.graphics.fillRect(18, y - 14, camera.width - 36, 28);
        this.graphics.lineStyle(1, accentColor, alpha * 1.05);
        this.graphics.lineBetween(18, y, camera.width - 18, y);
        this.graphics.fillStyle(accentColor, alpha * (0.52 + flowPulse * 0.14));
        this.graphics.fillRoundedRect(24 + sweep * 0.48, y - 12, 18, 24, 6);
        this.graphics.fillRoundedRect(camera.width - 42 - sweep * 0.48, y - 12, 18, 24, 6);
      }
      return;
    }

    this.graphics.lineStyle(2, accentColor, alpha * 1.1);
    this.graphics.strokeCircle(camera.width * 0.5, camera.height * 0.5, Math.min(camera.width, camera.height) * 0.42);
    this.graphics.lineStyle(1, accentColor, alpha * 0.8);
    this.graphics.strokeCircle(camera.width * 0.5, camera.height * 0.5, Math.min(camera.width, camera.height) * 0.3);
  }

  private renderPressurePatternOverlay(
    battle: BattleState,
    camera: { left: number; top: number; width: number; height: number },
    accentColor: number,
  ): void {
    if (!battle.pressurePatternMode || !battle.pressurePatternLabel) {
      return;
    }

    const flashAlpha = Math.min(0.16, 0.04 + battle.pressurePatternFlashSec * 0.2);
    const renderedSafeWindow = this.renderPressureSafeWindowOverlay(battle, camera, accentColor, flashAlpha);
    if (renderedSafeWindow && battle.pressureSafeWindowAxis !== 'pocket') {
      return;
    }

    switch (battle.pressurePatternMode) {
      case 'sideClamp':
        this.graphics.fillStyle(accentColor, flashAlpha);
        this.graphics.fillRect(28, 92, 30, this.scale.height - 184);
        this.graphics.fillRect(this.scale.width - 58, 92, 30, this.scale.height - 184);
        this.graphics.lineStyle(2, accentColor, flashAlpha * 1.4);
        this.graphics.lineBetween(58, 120, 58, this.scale.height - 120);
        this.graphics.lineBetween(this.scale.width - 58, 120, this.scale.width - 58, this.scale.height - 120);
        return;
      case 'laneCrush':
        this.graphics.fillStyle(accentColor, flashAlpha);
        this.graphics.fillRect(84, 28, this.scale.width - 168, 28);
        this.graphics.fillRect(84, this.scale.height - 56, this.scale.width - 168, 28);
        this.graphics.lineStyle(2, accentColor, flashAlpha * 1.35);
        this.graphics.lineBetween(112, 56, this.scale.width - 112, 56);
        this.graphics.lineBetween(112, this.scale.height - 56, this.scale.width - 112, this.scale.height - 56);
        return;
      case 'crossfireWave':
        this.graphics.lineStyle(2, accentColor, flashAlpha * 1.5);
        this.graphics.lineBetween(82, 112, this.scale.width - 82, this.scale.height - 112);
        this.graphics.lineBetween(82, this.scale.height - 112, this.scale.width - 82, 112);
        this.graphics.lineStyle(1, accentColor, flashAlpha * 1.1);
        this.graphics.lineBetween(132, 112, this.scale.width - 132, this.scale.height - 112);
        this.graphics.lineBetween(132, this.scale.height - 112, this.scale.width - 132, 112);
        if (battle.pressureSafeWindowShiftType === 'centerReset') {
          this.graphics.lineStyle(2, accentColor, flashAlpha * 1.3);
          this.graphics.strokeCircle(this.scale.width * 0.5, this.scale.height * 0.5, 66);
          this.graphics.strokeCircle(this.scale.width * 0.5, this.scale.height * 0.5, 102);
        }
        if (battle.pressureSafeWindowShiftType === 'edgeBounce') {
          this.graphics.lineStyle(2, accentColor, flashAlpha * 1.25);
          this.graphics.lineBetween(72, 138, 120, 138);
          this.graphics.lineBetween(72, this.scale.height - 138, 120, this.scale.height - 138);
          this.graphics.lineBetween(this.scale.width - 72, 138, this.scale.width - 120, 138);
          this.graphics.lineBetween(this.scale.width - 72, this.scale.height - 138, this.scale.width - 120, this.scale.height - 138);
        }
        return;
      default:
        return;
    }
  }

  private renderPressureSafeWindowOverlay(
    battle: BattleState,
    camera: { left: number; top: number; width: number; height: number },
    accentColor: number,
    flashAlpha: number,
  ): boolean {
    if (
      !battle.pressureSafeWindowAxis ||
      battle.pressureSafeWindowSec <= 0 ||
      battle.pressureSafeWindowSpan <= 0
    ) {
      return false;
    }

    const topInset = 22;
    const bottomInset = 20;
    const leftInset = 20;
    const rightInset = 20;
    const contentWidth = camera.width - leftInset - rightInset;
    const contentHeight = camera.height - topInset - bottomInset;
    const safeWindowAlpha = Math.min(0.18, 0.05 + battle.pressureSafeWindowSec * 0.08 + flashAlpha * 0.7);
    const dangerAlpha = Math.min(0.16, 0.05 + battle.pressureSafeWindowSec * 0.06 + flashAlpha * 0.95);
    const safeTint = 0x82ffca;
    const dangerTint = 0xff6d62;

    if (battle.pressureSafeWindowAxis === 'pocket') {
      if (battle.pressureSafeWindowSecondarySpan <= 0) {
        return false;
      }

      const safeStartX = Phaser.Math.Clamp(
        battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5 - camera.left,
        leftInset,
        camera.width - rightInset,
      );
      const safeEndX = Phaser.Math.Clamp(
        battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5 - camera.left,
        leftInset,
        camera.width - rightInset,
      );
      const safeStartY = Phaser.Math.Clamp(
        battle.pressureSafeWindowSecondaryCenter - battle.pressureSafeWindowSecondarySpan * 0.5 - camera.top,
        topInset,
        camera.height - bottomInset,
      );
      const safeEndY = Phaser.Math.Clamp(
        battle.pressureSafeWindowSecondaryCenter + battle.pressureSafeWindowSecondarySpan * 0.5 - camera.top,
        topInset,
        camera.height - bottomInset,
      );
      const safeWidth = Math.max(28, safeEndX - safeStartX);
      const safeHeight = Math.max(24, safeEndY - safeStartY);

      if (safeStartY > topInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha);
        this.graphics.fillRect(leftInset, topInset, contentWidth, safeStartY - topInset);
      }
      if (safeEndY < camera.height - bottomInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha);
        this.graphics.fillRect(leftInset, safeEndY, contentWidth, camera.height - bottomInset - safeEndY);
      }
      if (safeStartX > leftInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha * 0.92);
        this.graphics.fillRect(leftInset, safeStartY, safeStartX - leftInset, safeHeight);
      }
      if (safeEndX < camera.width - rightInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha * 0.92);
        this.graphics.fillRect(safeEndX, safeStartY, camera.width - rightInset - safeEndX, safeHeight);
      }

      this.graphics.fillStyle(safeTint, safeWindowAlpha * 0.58);
      this.graphics.fillRect(safeStartX, safeStartY, safeWidth, safeHeight);
      this.graphics.lineStyle(2, safeTint, safeWindowAlpha * 1.36);
      this.graphics.strokeRect(safeStartX, safeStartY, safeWidth, safeHeight);
      this.graphics.lineStyle(2, accentColor, flashAlpha * 1.3);
      this.graphics.lineBetween(safeStartX, safeStartY, safeStartX, safeEndY);
      this.graphics.lineBetween(safeEndX, safeStartY, safeEndX, safeEndY);
      this.graphics.lineBetween(safeStartX, safeStartY, safeEndX, safeStartY);
      this.graphics.lineBetween(safeStartX, safeEndY, safeEndX, safeEndY);
      return true;
    }

    if (battle.pressureSafeWindowAxis === 'vertical') {
      const safeStart = Phaser.Math.Clamp(
        battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5 - camera.left,
        leftInset,
        camera.width - rightInset,
      );
      const safeEnd = Phaser.Math.Clamp(
        battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5 - camera.left,
        leftInset,
        camera.width - rightInset,
      );
      const safeWidth = Math.max(18, safeEnd - safeStart);

      if (safeStart > leftInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha);
        this.graphics.fillRect(leftInset, topInset, safeStart - leftInset, contentHeight);
      }
      if (safeEnd < camera.width - rightInset) {
        this.graphics.fillStyle(dangerTint, dangerAlpha);
        this.graphics.fillRect(safeEnd, topInset, camera.width - rightInset - safeEnd, contentHeight);
      }

      this.graphics.fillStyle(safeTint, safeWindowAlpha * 0.55);
      this.graphics.fillRect(safeStart, topInset - 4, safeWidth, contentHeight + 8);
      this.graphics.lineStyle(2, safeTint, safeWindowAlpha * 1.3);
      this.graphics.strokeRect(safeStart, topInset - 4, safeWidth, contentHeight + 8);
      this.graphics.lineStyle(2, accentColor, flashAlpha * 1.35);
      this.graphics.lineBetween(safeStart, topInset - 8, safeStart, camera.height - bottomInset + 8);
      this.graphics.lineBetween(safeEnd, topInset - 8, safeEnd, camera.height - bottomInset + 8);
      return true;
    }

    const safeStart = Phaser.Math.Clamp(
      battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5 - camera.top,
      topInset,
      camera.height - bottomInset,
    );
    const safeEnd = Phaser.Math.Clamp(
      battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5 - camera.top,
      topInset,
      camera.height - bottomInset,
    );
    const safeHeight = Math.max(18, safeEnd - safeStart);

    if (safeStart > topInset) {
      this.graphics.fillStyle(dangerTint, dangerAlpha);
      this.graphics.fillRect(leftInset, topInset, contentWidth, safeStart - topInset);
    }
    if (safeEnd < camera.height - bottomInset) {
      this.graphics.fillStyle(dangerTint, dangerAlpha);
      this.graphics.fillRect(leftInset, safeEnd, contentWidth, camera.height - bottomInset - safeEnd);
    }

    this.graphics.fillStyle(safeTint, safeWindowAlpha * 0.55);
    this.graphics.fillRect(leftInset - 4, safeStart, contentWidth + 8, safeHeight);
    this.graphics.lineStyle(2, safeTint, safeWindowAlpha * 1.3);
    this.graphics.strokeRect(leftInset - 4, safeStart, contentWidth + 8, safeHeight);
    this.graphics.lineStyle(2, accentColor, flashAlpha * 1.35);
    this.graphics.lineBetween(leftInset - 8, safeStart, camera.width - rightInset + 8, safeStart);
    this.graphics.lineBetween(leftInset - 8, safeEnd, camera.width - rightInset + 8, safeEnd);
    return true;
  }

  private getEnemyRecoveryRatio(enemy: BattleState['enemies'][number]): number {
    const recoveryWindow =
      enemy.elite
        ? 0.32
        : enemy.archetype === 'brute'
          ? 0.44
          : enemy.archetype === 'ranged'
            ? 0.42
            : enemy.archetype === 'skirmisher'
              ? 0.34
              : 0.24;
    return clamp(enemy.recoverySec / recoveryWindow, 0, 1);
  }

  private getEnemyPressureRatio(enemy: BattleState['enemies'][number]): number {
    const pressureWindow =
      enemy.elite
        ? 0.72
        : enemy.archetype === 'brute'
          ? 0.22
          : enemy.archetype === 'ranged'
            ? 0.2
            : enemy.archetype === 'skirmisher'
              ? 0.18
              : 0.16;
    return clamp(enemy.pressurePulseSec / pressureWindow, 0, 1);
  }

  private getEnemyFillColor(enemy: BattleState['enemies'][number]): number {
    if (enemy.elite) {
      return 0xffb347;
    }

    switch (enemy.archetype) {
      case 'brute':
        return 0xff7b63;
      case 'skirmisher':
        return 0xff4f86;
      case 'ranged':
        return 0xc98eff;
      case 'standard':
      default:
        return 0xff6578;
    }
  }

  private getEnemyStrokeColor(enemy: BattleState['enemies'][number]): number {
    if (enemy.elite) {
      return 0xffe2a8;
    }

    switch (enemy.archetype) {
      case 'brute':
        return 0xffcfb8;
      case 'skirmisher':
        return 0xffb4d1;
      case 'ranged':
        return 0xe2ccff;
      case 'standard':
      default:
        return 0xff9eb0;
    }
  }

  private mixColor(base: number, target: number, amount: number): number {
    const ratio = clamp(amount, 0, 1);
    const baseR = (base >> 16) & 0xff;
    const baseG = (base >> 8) & 0xff;
    const baseB = base & 0xff;
    const targetR = (target >> 16) & 0xff;
    const targetG = (target >> 8) & 0xff;
    const targetB = target & 0xff;

    const mixedR = Math.round(baseR + (targetR - baseR) * ratio);
    const mixedG = Math.round(baseG + (targetG - baseG) * ratio);
    const mixedB = Math.round(baseB + (targetB - baseB) * ratio);

    return (mixedR << 16) | (mixedG << 8) | mixedB;
  }
}
