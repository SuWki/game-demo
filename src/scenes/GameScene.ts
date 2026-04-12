import Phaser from 'phaser';
import { ARENA_HEIGHT, ARENA_WIDTH, clamp } from '../data/balance';
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
    this.renderBattleTerrain(camera, accentColor);
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
    const left = clamp(battle.playerX - width * 0.5, 0, Math.max(0, ARENA_WIDTH - width));
    const top = clamp(battle.playerY - height * 0.5, 0, Math.max(0, ARENA_HEIGHT - height));

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
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
    accentColor: number,
  ): void {
    this.graphics.fillGradientStyle(0x3a332c, 0x322c26, 0x241f1a, 0x1b1713, 1);
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
        this.graphics.fillStyle(noise > 0.54 ? 0x443b31 : 0x2a241e, noise > 0.54 ? 0.2 : 0.15);
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
        const tileColor = noise > 0.62 ? 0x4b4339 : noise > 0.3 ? 0x40392f : 0x362f27;
        this.graphics.fillStyle(tileColor, 0.18 + noise * 0.08);
        this.graphics.fillRoundedRect(screen.x, screen.y, TERRAIN_TILE_SIZE - 8, TERRAIN_TILE_SIZE - 8, 20);

        const detailNoise = this.getTerrainNoise(tileX, tileY, 4);
        this.graphics.fillStyle(0x685f52, 0.08 + detailNoise * 0.07);
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
            this.graphics.fillStyle(0x1f1a16, 0.2);
            this.graphics.fillCircle(px, py, 2 + this.getTerrainNoise(tileX, tileY, 40 + pebble) * 3);
            this.graphics.lineStyle(1, 0x746b5d, 0.16);
            this.graphics.strokeCircle(px, py, 4 + this.getTerrainNoise(tileX, tileY, 50 + pebble) * 3);
          }
        }
      }
    }

    this.graphics.fillStyle(accentColor, 0.05);
    this.graphics.fillEllipse(camera.width * 0.5, camera.height * 0.56, camera.width * 0.58, camera.height * 0.28);
    this.graphics.fillStyle(accentColor, 0.025);
    this.graphics.fillEllipse(camera.width * 0.5, camera.height * 0.56, camera.width * 0.82, camera.height * 0.5);

    if (camera.left <= 0) {
      this.graphics.fillGradientStyle(0x090806, 0x000000, 0x000000, 0x090806, 0.95);
      this.graphics.fillRect(0, 0, 34, camera.height);
    }
    if (camera.right >= ARENA_WIDTH) {
      this.graphics.fillGradientStyle(0x000000, 0x090806, 0x090806, 0x000000, 0.95);
      this.graphics.fillRect(camera.width - 34, 0, 34, camera.height);
    }
    if (camera.top <= 0) {
      this.graphics.fillGradientStyle(0x090806, 0x090806, 0x000000, 0x000000, 0.9);
      this.graphics.fillRect(0, 0, camera.width, 26);
    }
    if (camera.bottom >= ARENA_HEIGHT) {
      this.graphics.fillGradientStyle(0x000000, 0x000000, 0x090806, 0x090806, 0.9);
      this.graphics.fillRect(0, camera.height - 26, camera.width, 26);
    }

    this.graphics.lineStyle(2, 0x140f0b, 0.3);
    this.graphics.strokeRoundedRect(10, 10, camera.width - 20, camera.height - 20, 18);
  }

  private renderBattleEntities(
    battle: BattleState,
    camera: { left: number; right: number; top: number; bottom: number; width: number; height: number },
    accentColor: number,
  ): void {
    this.renderPressurePatternOverlay(battle, camera, accentColor);

    for (const orb of battle.experienceOrbs) {
      if (!this.isVisibleInCamera(camera, orb.x, orb.y, 20)) {
        continue;
      }

      const screen = this.worldToScreen(camera, orb.x, orb.y);
      this.graphics.fillStyle(XP_ORB_FILL, 0.92);
      this.graphics.fillCircle(screen.x, screen.y, 5);
      this.graphics.lineStyle(1, XP_ORB_STROKE, 0.34);
      this.graphics.strokeCircle(screen.x, screen.y, 8);
    }

    for (const pulse of battle.pulses) {
      if (!this.isVisibleInCamera(camera, pulse.x, pulse.y, pulse.radius + 12)) {
        continue;
      }

      const screen = this.worldToScreen(camera, pulse.x, pulse.y);
      this.graphics.lineStyle(2, 0x9cff97, pulse.lifeSec * 2.2);
      this.graphics.strokeCircle(screen.x, screen.y, pulse.radius);
      this.graphics.lineStyle(1, accentColor, pulse.lifeSec * 1.2);
      this.graphics.strokeCircle(screen.x, screen.y, pulse.radius * 0.62);
    }

    for (const bullet of battle.bullets) {
      if (!this.isVisibleInCamera(camera, bullet.x, bullet.y, 18)) {
        continue;
      }

      const screen = this.worldToScreen(camera, bullet.x, bullet.y);
      this.graphics.fillStyle(0xf8fbff, 0.92);
      this.graphics.fillCircle(screen.x, screen.y, 3);
    }

    for (const projectile of battle.enemyProjectiles) {
      if (!this.isVisibleInCamera(camera, projectile.x, projectile.y, 24)) {
        continue;
      }

      const screen = this.worldToScreen(camera, projectile.x, projectile.y);
      const tail = this.worldToScreen(
        camera,
        projectile.x - projectile.vx * 0.045,
        projectile.y - projectile.vy * 0.045,
      );
      this.graphics.lineStyle(2, ENEMY_PROJECTILE_TRAIL, 0.22);
      this.graphics.lineBetween(tail.x, tail.y, screen.x, screen.y);
      this.graphics.fillStyle(ENEMY_PROJECTILE_FILL, 0.96);
      this.graphics.fillCircle(screen.x, screen.y, projectile.radius);
      this.graphics.lineStyle(1, ENEMY_PROJECTILE_STROKE, 0.38);
      this.graphics.strokeCircle(screen.x, screen.y, projectile.radius + 2);
    }

    const playerScreen = this.worldToScreen(camera, battle.playerX, battle.playerY);

    for (const enemy of battle.enemies) {
      const enemyFill = this.getEnemyFillColor(enemy);
      const enemyStroke = this.getEnemyStrokeColor(enemy);
      const onScreen = this.isVisibleInCamera(camera, enemy.x, enemy.y, enemy.radius + 30);
      const screen = this.worldToScreen(camera, enemy.x, enemy.y);

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
      }

      if (!enemy.elite && enemy.archetype === 'brute') {
        this.graphics.lineStyle(3, enemyStroke, 0.24);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 7);
        this.graphics.fillStyle(enemyStroke, 0.12);
        this.graphics.fillCircle(screen.x, screen.y, Math.max(4, enemy.radius - 4));
      }

      if (!enemy.elite && enemy.archetype === 'ranged') {
        this.graphics.lineStyle(2, enemyStroke, 0.36);
        this.graphics.lineBetween(screen.x, screen.y - enemy.radius - 4, screen.x, screen.y + enemy.radius + 4);
        this.graphics.lineStyle(1, enemyStroke, enemy.rangedCooldownSec <= 0.65 ? 0.24 : 0.12);
        this.graphics.strokeCircle(screen.x, screen.y, enemy.radius + 10);
        if (enemy.rangedCooldownSec <= 0.65) {
          this.graphics.lineStyle(1, enemyStroke, 0.18);
          this.graphics.lineBetween(screen.x, screen.y, playerScreen.x, playerScreen.y);
        }
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
    }

    this.graphics.fillStyle(0x000000, 0.22);
    this.graphics.fillEllipse(playerScreen.x, playerScreen.y + 18, 34, 14);
    this.graphics.fillStyle(accentColor, battle.invulnerableSec > 0 ? 0.18 : 0.1);
    this.graphics.fillCircle(playerScreen.x, playerScreen.y, 58);
    this.graphics.lineStyle(2, accentColor, battle.invulnerableSec > 0 ? 0.55 : 0.24);
    this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 26);
    this.graphics.lineStyle(1, 0xffffff, battle.invulnerableSec > 0 ? 0.48 : 0.18);
    this.graphics.strokeCircle(playerScreen.x, playerScreen.y, 15);
    this.graphics.fillStyle(battle.invulnerableSec > 0 ? 0x9cff97 : 0xf8fbff, 1);
    this.graphics.fillCircle(playerScreen.x, playerScreen.y, 10);

    this.graphics.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.08);
    this.graphics.fillRect(0, 0, camera.width, camera.height);
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
}
