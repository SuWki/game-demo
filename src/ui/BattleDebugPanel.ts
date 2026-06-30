import type {
  AudioCue,
  BattleDebugConfig,
  BattleDebugSnapshot,
  BattleTemplateId,
  DebugBattlePhaseId,
} from '../game/types';

export interface BattleDebugTemplateOption {
  id: BattleTemplateId;
  label: string;
  group: string;
}

export interface BattleDebugPanelLike {
  bind: (templateOptions: BattleDebugTemplateOption[], bindings: BattleDebugPanelBindings) => void;
  unbind: () => void;
  show: () => void;
  hide: () => void;
  setVisible: (visible: boolean) => void;
  isVisible: () => boolean;
  sync: (config: BattleDebugConfig, snapshot: BattleDebugSnapshot | null) => void;
}

interface BattleDebugPanelBindings {
  onConfigChange: (patch: Partial<BattleDebugConfig>) => void;
  onRestartBattle: (templateId: BattleTemplateId, phase: DebugBattlePhaseId) => void;
  onUiSound?: (cue: AudioCue) => void;
}

export class BattleDebugPanel {
  private readonly root: HTMLElement;

  private readonly layer: HTMLDivElement;

  private bindings: BattleDebugPanelBindings | null = null;

  private templateOptions: BattleDebugTemplateOption[] = [];

  private rendered = false;

  private currentConfig: BattleDebugConfig | null = null;

  private currentSnapshot: BattleDebugSnapshot | null = null;

  private lastUiSoundAt = 0;

  public constructor(root: HTMLElement) {
    this.root = root;
    this.layer = document.createElement('div');
    this.layer.className = 'debug-panel-layer hidden';
    this.root.appendChild(this.layer);
  }

  public bind(templateOptions: BattleDebugTemplateOption[], bindings: BattleDebugPanelBindings): void {
    this.templateOptions = templateOptions;
    this.bindings = bindings;
    this.ensureRendered();
  }

  public unbind(): void {
    this.bindings = null;
    this.hide();
  }

  public show(): void {
    this.layer.classList.remove('hidden');
  }

  public hide(): void {
    this.layer.classList.add('hidden');
  }

  public setVisible(visible: boolean): void {
    if (visible) {
      this.show();
      return;
    }
    this.hide();
  }

  public isVisible(): boolean {
    return !this.layer.classList.contains('hidden');
  }

  public sync(config: BattleDebugConfig, snapshot: BattleDebugSnapshot | null): void {
    this.currentConfig = config;
    this.currentSnapshot = snapshot;
    this.ensureRendered();
    this.syncControls();
    this.syncSnapshot();
  }

  private ensureRendered(): void {
    if (this.rendered) {
      return;
    }

    this.layer.innerHTML = `
      <section class="debug-panel-shell">
        <header class="debug-panel-header">
          <div>
            <p class="debug-panel-kicker">DEBUG MODE</p>
            <h2>Combat sandbox</h2>
          </div>
          <p class="debug-panel-hotkeys">F3 toggle panel / F4 pause</p>
        </header>
        <div class="debug-panel-grid">
          <section class="debug-panel-section">
            <h3>Runtime</h3>
            <label class="debug-field">
              <span>Time scale</span>
              <input data-debug-input="timeScale" type="range" min="0.1" max="2" step="0.1" value="1" />
              <strong data-debug-value="timeScale">1.0x</strong>
            </label>
            <label class="debug-check">
              <input data-debug-check="paused" type="checkbox" />
              <span>Pause simulation</span>
            </label>
            <label class="debug-check">
              <input data-debug-check="invulnerablePlayer" type="checkbox" />
              <span>Player invulnerable</span>
            </label>
            <label class="debug-check">
              <input data-debug-check="freezePlayerAutoFire" type="checkbox" />
              <span>Freeze player auto fire</span>
            </label>
          </section>
          <section class="debug-panel-section">
            <h3>Systems</h3>
            <label class="debug-check">
              <input data-debug-check="freezeEnemyMovement" type="checkbox" />
              <span>Freeze enemy movement</span>
            </label>
            <label class="debug-check">
              <input data-debug-check="freezeEnemyProjectiles" type="checkbox" />
              <span>Freeze enemy projectiles</span>
            </label>
            <label class="debug-check">
              <input data-debug-check="freezeEnemySpawning" type="checkbox" />
              <span>Freeze enemy spawning</span>
            </label>
          </section>
          <section class="debug-panel-section">
            <h3>Visuals</h3>
            <label class="debug-check">
              <input data-debug-check="showEnemyVectors" type="checkbox" />
              <span>Show enemy move vectors</span>
            </label>
            <label class="debug-check">
              <input data-debug-check="showProjectileVectors" type="checkbox" />
              <span>Show projectile vectors</span>
            </label>
            <label class="debug-check">
              <input data-debug-check="showCollisionRadii" type="checkbox" />
              <span>Show collision radii</span>
            </label>
            <label class="debug-check">
              <input data-debug-check="hideBossPressureOverlay" type="checkbox" />
              <span>Hide boss pressure overlay</span>
            </label>
          </section>
          <section class="debug-panel-section">
            <h3>Battle reset</h3>
            <label class="debug-field">
              <span>Template</span>
              <select data-debug-select="templateId"></select>
            </label>
            <label class="debug-field">
              <span>Phase</span>
              <select data-debug-select="phase">
                <option value="opening">opening</option>
                <option value="mid">mid</option>
                <option value="late">late</option>
                <option value="finalBattle">finalBattle</option>
              </select>
            </label>
            <button data-debug-action="restart" class="debug-action-button" type="button">Restart selected battle</button>
          </section>
        </div>
        <section class="debug-panel-section debug-panel-section-wide">
          <h3>Live snapshot</h3>
          <pre class="debug-readout" data-debug-output="summary"></pre>
        </section>
        <section class="debug-panel-section debug-panel-section-wide">
          <h3>Enemies</h3>
          <pre class="debug-readout" data-debug-output="enemies"></pre>
        </section>
        <section class="debug-panel-section debug-panel-section-wide">
          <h3>Enemy projectiles</h3>
          <pre class="debug-readout" data-debug-output="projectiles"></pre>
        </section>
      </section>
    `;

    this.populateTemplateSelect();
    this.attachEvents();
    this.rendered = true;
  }

  private populateTemplateSelect(): void {
    const select = this.layer.querySelector<HTMLSelectElement>('[data-debug-select="templateId"]');
    if (!select) {
      return;
    }

    const groups = new Map<string, BattleDebugTemplateOption[]>();
    for (const option of this.templateOptions) {
      const group = groups.get(option.group) ?? [];
      group.push(option);
      groups.set(option.group, group);
    }

    select.innerHTML = '';
    groups.forEach((options, label) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = label;
      for (const option of options) {
        const item = document.createElement('option');
        item.value = option.id;
        item.textContent = option.label;
        optgroup.appendChild(item);
      }
      select.appendChild(optgroup);
    });
  }

  private attachEvents(): void {
    const timeScaleInput = this.layer.querySelector<HTMLInputElement>('[data-debug-input="timeScale"]');
    timeScaleInput?.addEventListener('input', () => {
      this.playUiSound('click', 120);
      const value = Number(timeScaleInput.value);
      this.bindings?.onConfigChange({
        timeScale: Number.isFinite(value) ? value : 1,
      });
    });

    const checkboxKeys: Array<keyof BattleDebugConfig> = [
      'paused',
      'invulnerablePlayer',
      'freezePlayerAutoFire',
      'freezeEnemyMovement',
      'freezeEnemyProjectiles',
      'freezeEnemySpawning',
      'showEnemyVectors',
      'showProjectileVectors',
      'showCollisionRadii',
      'hideBossPressureOverlay',
    ];
    checkboxKeys.forEach((key) => {
      const checkbox = this.layer.querySelector<HTMLInputElement>(`[data-debug-check="${key}"]`);
      checkbox?.addEventListener('change', () => {
        this.playUiSound('click');
        this.bindings?.onConfigChange({
          [key]: checkbox.checked,
        } as Partial<BattleDebugConfig>);
      });
    });

    const templateSelect = this.layer.querySelector<HTMLSelectElement>('[data-debug-select="templateId"]');
    templateSelect?.addEventListener('change', () => {
      this.playUiSound('click');
      this.bindings?.onConfigChange({
        templateId: templateSelect.value as BattleTemplateId,
      });
    });

    const phaseSelect = this.layer.querySelector<HTMLSelectElement>('[data-debug-select="phase"]');
    phaseSelect?.addEventListener('change', () => {
      this.playUiSound('click');
      this.bindings?.onConfigChange({
        phase: phaseSelect.value as DebugBattlePhaseId,
      });
    });

    const restartButton = this.layer.querySelector<HTMLButtonElement>('[data-debug-action="restart"]');
    restartButton?.addEventListener('click', () => {
      this.playUiSound('confirm');
      const config = this.currentConfig;
      if (!config) {
        return;
      }
      this.bindings?.onRestartBattle(config.templateId, config.phase);
    });
  }

  private playUiSound(cue: AudioCue, cooldownMs = 80): void {
    const now = performance.now();
    if (now - this.lastUiSoundAt < cooldownMs) {
      return;
    }
    this.lastUiSoundAt = now;
    this.bindings?.onUiSound?.(cue);
  }

  private syncControls(): void {
    if (!this.currentConfig) {
      return;
    }

    const config = this.currentConfig;
    const timeScaleInput = this.layer.querySelector<HTMLInputElement>('[data-debug-input="timeScale"]');
    const timeScaleValue = this.layer.querySelector<HTMLElement>('[data-debug-value="timeScale"]');
    if (timeScaleInput) {
      timeScaleInput.value = config.timeScale.toFixed(1);
    }
    if (timeScaleValue) {
      timeScaleValue.textContent = `${config.timeScale.toFixed(1)}x`;
    }

    const checkboxKeys: Array<keyof BattleDebugConfig> = [
      'paused',
      'invulnerablePlayer',
      'freezePlayerAutoFire',
      'freezeEnemyMovement',
      'freezeEnemyProjectiles',
      'freezeEnemySpawning',
      'showEnemyVectors',
      'showProjectileVectors',
      'showCollisionRadii',
      'hideBossPressureOverlay',
    ];
    checkboxKeys.forEach((key) => {
      const checkbox = this.layer.querySelector<HTMLInputElement>(`[data-debug-check="${key}"]`);
      if (checkbox) {
        checkbox.checked = Boolean(config[key]);
      }
    });

    const templateSelect = this.layer.querySelector<HTMLSelectElement>('[data-debug-select="templateId"]');
    if (templateSelect) {
      templateSelect.value = config.templateId;
    }

    const phaseSelect = this.layer.querySelector<HTMLSelectElement>('[data-debug-select="phase"]');
    if (phaseSelect) {
      phaseSelect.value = config.phase;
    }
  }

  private syncSnapshot(): void {
    const summaryOutput = this.layer.querySelector<HTMLElement>('[data-debug-output="summary"]');
    const enemiesOutput = this.layer.querySelector<HTMLElement>('[data-debug-output="enemies"]');
    const projectilesOutput = this.layer.querySelector<HTMLElement>('[data-debug-output="projectiles"]');
    if (!summaryOutput || !enemiesOutput || !projectilesOutput) {
      return;
    }

    const snapshot = this.currentSnapshot;
    if (!snapshot) {
      summaryOutput.textContent = 'No battle snapshot yet.';
      enemiesOutput.textContent = 'No enemies.';
      projectilesOutput.textContent = 'No enemy projectiles.';
      return;
    }

    summaryOutput.textContent = [
      `status=${snapshot.status} phase=${snapshot.phase} template=${snapshot.templateId ?? 'none'} encounter=${snapshot.encounterType ?? 'none'}`,
      `player=(${snapshot.playerX.toFixed(1)}, ${snapshot.playerY.toFixed(1)}) hp=${snapshot.playerHp.toFixed(1)}/${snapshot.playerMaxHp.toFixed(1)}`,
      `enemies=${snapshot.enemyCount} projectiles=${snapshot.projectileCount} bullets=${snapshot.bulletCount} orbs=${snapshot.orbCount}`,
      `eliteAlive=${snapshot.eliteAlive} eliteRecovery=${snapshot.eliteRecoverySec.toFixed(2)} elitePressure=${snapshot.elitePressureSec.toFixed(2)} crack=${snapshot.eliteCrackWindowSec.toFixed(2)}`,
      `escorts=${snapshot.escortCount} escortRecovery=${snapshot.escortRecoveryCount} escortCrack=${snapshot.escortCrackCount}`,
      `enemyShots=${snapshot.enemyProjectileCount} breachShots=${snapshot.breachProjectileCount} breachSuppression=${snapshot.breachSuppressionRatio.toFixed(2)}`,
    ].join('\n');

    enemiesOutput.textContent =
      snapshot.enemies.length > 0
        ? snapshot.enemies
            .map(
              (enemy) =>
                `#${enemy.id} ${enemy.elite ? 'ELITE' : enemy.archetype} ${enemy.role} hp=${enemy.hp.toFixed(1)}/${enemy.maxHp.toFixed(1)} ` +
                `pos=(${enemy.x.toFixed(1)}, ${enemy.y.toFixed(1)}) move=(${enemy.moveVX.toFixed(1)}, ${enemy.moveVY.toFixed(1)}) ` +
                `rec=${enemy.recoverySec.toFixed(2)} pressure=${enemy.pressurePulseSec.toFixed(2)} ranged=${enemy.rangedCooldownSec.toFixed(2)}`,
            )
            .join('\n')
        : 'No active enemies.';

    projectilesOutput.textContent =
      snapshot.enemyProjectiles.length > 0
        ? snapshot.enemyProjectiles
            .map(
              (projectile) =>
                `#${projectile.id} pos=(${projectile.x.toFixed(1)}, ${projectile.y.toFixed(1)}) ` +
                `vel=(${projectile.vx.toFixed(1)}, ${projectile.vy.toFixed(1)}) ` +
                `life=${projectile.lifeSec.toFixed(2)} dmg=${projectile.damage.toFixed(1)} r=${projectile.radius.toFixed(1)}`,
            )
            .join('\n')
        : 'No enemy projectiles.';
  }
}
