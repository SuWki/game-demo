import { BATTLE_TEMPLATES } from '../../src/data/battleTemplates.ts';
import { RunEngine } from '../../src/systems/RunEngine.ts';

const trackedEvents = [];
const metrics = new Proxy(
  {},
  {
    get(_target, prop) {
      return (...args) => {
        if (
          prop === 'recordBossPhaseEntered' ||
          prop === 'recordBossPhaseDuration' ||
          prop === 'recordBossSignatureSeen'
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

function createEngine() {
  return new RunEngine(services);
}

function enterBoss(engine, templateId) {
  engine.enterBattle({
    id: `qa-${templateId}`,
    type: 'boss',
    title: `QA ${templateId}`,
    description: 'qa',
    templateId,
    phase: 'finalBattle',
  });
}

function sampleTemplate(templateId) {
  trackedEvents.length = 0;
  const template = BATTLE_TEMPLATES[templateId];
  const phases = template.eliteRule?.pressurePhases ?? [];
  const engine = createEngine();
  enterBoss(engine, templateId);
  const summary = {
    templateId,
    phaseLabel: null,
    signatureLabel: null,
    escortGain: 0,
    projectileGain: 0,
    metrics: [],
  };

  let signatureStarted = false;
  let finisherApplied = false;
  let baseEscortCount = 0;
  let baseProjectileCount = 0;

  for (let step = 0; step < 260; step += 1) {
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

    const nextPhase = phases[battle.pressurePhaseIndex + 1];
    if (nextPhase && battle.pressurePhaseElapsedSec > 0.45) {
      const triggerHpRatio = nextPhase.triggerHpRatio ?? 0.99;
      elite.hp = Math.min(elite.hp, elite.maxHp * Math.max(0.08, triggerHpRatio - 0.03));
    }

    if (!signatureStarted && battle.pressureSignatureLabel) {
      signatureStarted = true;
      summary.phaseLabel = battle.pressurePhaseLabel ?? null;
      summary.signatureLabel = battle.pressureSignatureLabel;
      baseEscortCount = battle.enemies.filter((enemy) => !enemy.elite).length;
      baseProjectileCount = battle.enemyProjectiles.length;
    }

    if (signatureStarted) {
      const escortCount = battle.enemies.filter((enemy) => !enemy.elite).length;
      summary.escortGain = Math.max(summary.escortGain, escortCount - baseEscortCount);
      summary.projectileGain = Math.max(summary.projectileGain, battle.enemyProjectiles.length - baseProjectileCount);
      if (!finisherApplied && battle.pressureSignatureSec <= 0) {
        elite.hp = 0;
        finisherApplied = true;
      }
    }
  }

  summary.metrics = trackedEvents.map((event) => ({
    name: event.name,
    args: event.args,
  }));
  return summary;
}

const results = [sampleTemplate('boss-hunt'), sampleTemplate('boss-lockdown'), sampleTemplate('boss-bastion')];
console.log(JSON.stringify(results, null, 2));
