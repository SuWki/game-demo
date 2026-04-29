import { BATTLE_TEMPLATES } from '../../src/data/battleTemplates.ts';
import { RunEngine } from '../../src/systems/RunEngine.ts';

const trackedEvents = [];
const metrics = new Proxy(
  {},
  {
    get(_target, prop) {
      return (...args) => {
        if (
          prop === 'recordBossPhasePatternSeen' ||
          prop === 'recordBossPhasePatternDuration' ||
          prop === 'recordBossPhaseEntered' ||
          prop === 'recordBossPhaseDuration' ||
          prop === 'recordBossSafeWindowSeen'
        ) {
          trackedEvents.push({ name: String(prop), args });
        }
      };
    },
  },
);

const services = {
  metrics,
  overlay: {},
  meta: {},
  audio: {},
};

const scenarios = [
  {
    id: 'normal',
    mutate(runState) {
      runState.stats.maxHp = 280;
      runState.stats.hp = 280;
    },
  },
  {
    id: 'highBurst',
    mutate(runState) {
      runState.stats.maxHp = 420;
      runState.stats.hp = 420;
      runState.stats.damage = 78;
      runState.stats.fireRate = 5.2;
      runState.stats.multishot = 3;
      runState.stats.projectileSpeed = 430;
    },
  },
  {
    id: 'highMobility',
    mutate(runState) {
      runState.stats.maxHp = 320;
      runState.stats.hp = 320;
      runState.stats.moveSpeed = 430;
      runState.stats.dashPulseDamage = 18;
      runState.stats.dashInterval = 3.4;
    },
  },
];

function createEngine() {
  return new RunEngine(services);
}

function enterBoss(engine, templateId) {
  engine.enterBattle({
    id: `qa-safe-window-${templateId}`,
    type: 'boss',
    title: `QA ${templateId}`,
    description: 'qa',
    templateId,
    phase: 'finalBattle',
  });
}

function createInput(step) {
  const segment = Math.floor(step / 8) % 4;
  return {
    up: segment === 3,
    down: segment === 1,
    left: segment === 2,
    right: segment === 0,
  };
}

function sampleScenario(templateId, scenario) {
  trackedEvents.length = 0;
  const engine = createEngine();
  enterBoss(engine, templateId);
  const runtimeState = engine.getState();
  scenario.mutate(runtimeState);

  const template = BATTLE_TEMPLATES[templateId];
  const phases = template.eliteRule?.pressurePhases ?? [];
  const summary = {
    templateId,
    scenario: scenario.id,
    phaseLabelsSeen: [],
    patternLabel: null,
    safeWindowAxis: null,
    safeWindowCount: 0,
    firstSpan: 0,
    lingerMax: 0,
    firstOffset: null,
    averageOffset: 0,
    maxOffset: 0,
    pulseCount: 0,
    metrics: [],
  };

  let lastPhaseLabel = null;
  let lastPulseCount = 0;
  const safeWindowOffsets = [];
  let finisherApplied = false;

  for (let step = 0; step < 460; step += 1) {
    engine.setInputState(createInput(step));
    engine.tick(100);
    const state = engine.getState();
    const battle = state.battle;
    if (!battle) {
      break;
    }

    if (battle.pressurePhaseLabel && battle.pressurePhaseLabel !== lastPhaseLabel) {
      summary.phaseLabelsSeen.push(battle.pressurePhaseLabel);
      lastPhaseLabel = battle.pressurePhaseLabel;
    }

    const elite = battle.enemies.find((enemy) => enemy.elite);
    if (!elite) {
      continue;
    }

    const nextPhase = phases[battle.pressurePhaseIndex + 1];
    if (nextPhase && battle.pressurePhaseElapsedSec > 0.55 && battle.pressurePhaseIndex < 0) {
      const triggerHpRatio = nextPhase.triggerHpRatio ?? 0.99;
      elite.hp = Math.min(elite.hp, elite.maxHp * Math.max(0.08, triggerHpRatio - 0.03));
    }

    if (battle.pressurePatternLabel && !summary.patternLabel) {
      summary.patternLabel = battle.pressurePatternLabel;
    }

    if (battle.pressurePatternPulseCount > lastPulseCount) {
      summary.pulseCount = battle.pressurePatternPulseCount;
      lastPulseCount = battle.pressurePatternPulseCount;
    }

    if (battle.pressureSafeWindowAxis && battle.pressureSafeWindowSec > 0) {
      const playerCoord = battle.pressureSafeWindowAxis === 'vertical' ? battle.playerX : battle.playerY;
      const offset = Math.abs(battle.pressureSafeWindowCenter - playerCoord);
      safeWindowOffsets.push(offset);
      summary.safeWindowAxis = battle.pressureSafeWindowAxis;
      summary.safeWindowCount = Math.max(summary.safeWindowCount, battle.pressurePatternPulseCount);
      summary.firstSpan = summary.firstSpan || Math.round(battle.pressureSafeWindowSpan);
      summary.lingerMax = Math.max(summary.lingerMax, Number(battle.pressureSafeWindowSec.toFixed(2)));
      summary.firstOffset ??= Number(offset.toFixed(2));
      summary.maxOffset = Math.max(summary.maxOffset, Number(offset.toFixed(2)));
    }

    if (!finisherApplied && battle.pressurePatternPulseCount >= 2 && battle.pressurePhaseElapsedSec >= 2.4) {
      elite.hp = 0;
      finisherApplied = true;
    }
  }

  summary.averageOffset =
    safeWindowOffsets.length > 0
      ? Number((safeWindowOffsets.reduce((sum, value) => sum + value, 0) / safeWindowOffsets.length).toFixed(2))
      : 0;
  summary.metrics = trackedEvents.map((event) => ({ name: event.name, args: event.args }));
  return summary;
}

const results = [
  ...scenarios.map((scenario) => sampleScenario('boss-hunt', scenario)),
  ...scenarios.map((scenario) => sampleScenario('boss-lockdown', scenario)),
  sampleScenario('boss-bastion', scenarios[0]),
];

console.log(JSON.stringify(results, null, 2));
