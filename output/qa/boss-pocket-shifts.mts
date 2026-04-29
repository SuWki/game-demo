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
      runState.stats.maxHp = 300;
      runState.stats.hp = 300;
    },
  },
  {
    id: 'highBurst',
    mutate(runState) {
      runState.stats.maxHp = 420;
      runState.stats.hp = 420;
      runState.stats.damage = 82;
      runState.stats.fireRate = 5.4;
      runState.stats.multishot = 3;
      runState.stats.projectileSpeed = 430;
    },
  },
  {
    id: 'highMobility',
    mutate(runState) {
      runState.stats.maxHp = 330;
      runState.stats.hp = 330;
      runState.stats.moveSpeed = 430;
      runState.stats.dashPulseDamage = 18;
      runState.stats.dashInterval = 3.2;
    },
  },
];

function createEngine() {
  return new RunEngine(services);
}

function enterBoss(engine) {
  engine.enterBattle({
    id: 'qa-pocket-bastion',
    type: 'boss',
    title: 'QA boss-bastion',
    description: 'qa',
    templateId: 'boss-bastion',
    phase: 'finalBattle',
  });
}

function createInput(step, scenarioId) {
  if (scenarioId === 'highMobility') {
    const segment = Math.floor(step / 5) % 6;
    return {
      up: segment === 4 || segment === 5,
      down: segment === 1,
      left: segment === 2 || segment === 3,
      right: segment === 0,
    };
  }

  const segment = Math.floor(step / 8) % 4;
  return {
    up: segment === 3,
    down: segment === 1,
    left: segment === 2,
    right: segment === 0,
  };
}

function ensurePhaseSummary(container, phaseLabel, patternLabel) {
  if (!container[phaseLabel]) {
    container[phaseLabel] = {
      phaseLabel,
      patternLabel,
      shiftTypesSeen: [],
      pocketCount: 0,
      centers: [],
      xRange: [9999, -9999],
      yRange: [9999, -9999],
      lingerMax: 0,
      averagePlayerOffset: 0,
      maxPlayerOffset: 0,
    };
  }

  return container[phaseLabel];
}

function sampleScenario(scenario) {
  trackedEvents.length = 0;
  const engine = createEngine();
  enterBoss(engine);
  const runtimeState = engine.getState();
  scenario.mutate(runtimeState);

  const summary = {
    templateId: 'boss-bastion',
    scenario: scenario.id,
    phaseSummaries: {},
    metrics: [],
  };

  const playerOffsets = {};
  const pulseCounts = {};

  let bossFinished = false;
  for (let step = 0; step < 760; step += 1) {
    engine.setInputState(createInput(step, scenario.id));
    engine.tick(100);
    const state = engine.getState();
    const battle = state.battle;
    if (!battle) {
      break;
    }

    const elite = battle.enemies.find((enemy) => enemy.elite);
    if (!elite) {
      continue;
    }

    elite.maxHp = Math.max(elite.maxHp, 6000);

    if (battle.pressurePhaseIndex < 0 && battle.pressurePhaseElapsedSec > 0.65) {
      battle.remainingSec = Math.min(battle.remainingSec, 24.8);
      elite.hp = Math.max(elite.hp, 4200);
    }

    if (battle.pressurePhaseIndex === 0) {
      elite.hp = Math.max(elite.hp, 3200);
      if (battle.pressurePatternPulseCount >= 2 && battle.pressurePhaseElapsedSec > 2.5) {
        battle.remainingSec = Math.min(battle.remainingSec, 9.6);
      }
    }

    if (battle.pressurePhaseIndex === 1) {
      elite.hp = Math.max(elite.hp, 1800);
      if (!bossFinished && battle.pressurePatternPulseCount >= 4 && battle.pressurePhaseElapsedSec > 4.1) {
        elite.hp = 0;
        bossFinished = true;
      }
    }

    if (
      battle.pressureSafeWindowAxis === 'pocket' &&
      battle.pressureSafeWindowSec > 0 &&
      battle.pressurePhaseLabel &&
      battle.pressurePatternLabel
    ) {
      const phaseSummary = ensurePhaseSummary(summary.phaseSummaries, battle.pressurePhaseLabel, battle.pressurePatternLabel);
      const shiftType = battle.pressureSafeWindowShiftType ?? 'unknown';
      const pulseKey = `${battle.pressurePhaseLabel}:${battle.pressurePatternPulseCount}`;
      if (!pulseCounts[pulseKey]) {
        pulseCounts[pulseKey] = true;
        if (!phaseSummary.shiftTypesSeen.includes(shiftType)) {
          phaseSummary.shiftTypesSeen.push(shiftType);
        }
        phaseSummary.pocketCount += 1;
        phaseSummary.centers.push([
          Math.round(battle.pressureSafeWindowCenter),
          Math.round(battle.pressureSafeWindowSecondaryCenter),
        ]);
        phaseSummary.xRange[0] = Math.min(phaseSummary.xRange[0], Math.round(battle.pressureSafeWindowCenter));
        phaseSummary.xRange[1] = Math.max(phaseSummary.xRange[1], Math.round(battle.pressureSafeWindowCenter));
        phaseSummary.yRange[0] = Math.min(phaseSummary.yRange[0], Math.round(battle.pressureSafeWindowSecondaryCenter));
        phaseSummary.yRange[1] = Math.max(phaseSummary.yRange[1], Math.round(battle.pressureSafeWindowSecondaryCenter));
        phaseSummary.lingerMax = Math.max(phaseSummary.lingerMax, Number(battle.pressureSafeWindowSec.toFixed(2)));

        const offset = Math.hypot(
          battle.pressureSafeWindowCenter - battle.playerX,
          battle.pressureSafeWindowSecondaryCenter - battle.playerY,
        );
        const offsetBucket = (playerOffsets[battle.pressurePhaseLabel] ??= []);
        offsetBucket.push(offset);
        phaseSummary.maxPlayerOffset = Math.max(phaseSummary.maxPlayerOffset, Number(offset.toFixed(2)));
      }
    }
  }

  Object.values(summary.phaseSummaries).forEach((phaseSummary) => {
    const offsets = playerOffsets[phaseSummary.phaseLabel] ?? [];
    phaseSummary.averagePlayerOffset =
      offsets.length > 0
        ? Number((offsets.reduce((sum, value) => sum + value, 0) / offsets.length).toFixed(2))
        : 0;
    phaseSummary.centers = phaseSummary.centers.slice(0, 8);
  });

  summary.metrics = trackedEvents
    .filter((event) => event.name === 'recordBossSafeWindowSeen')
    .map((event) => ({ name: event.name, args: event.args }));
  return summary;
}

const results = scenarios.map((scenario) => sampleScenario(scenario));
console.log(JSON.stringify(results, null, 2));
