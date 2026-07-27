/**
 * 粒子与特效系统
 *
 * 从 GameScene 抽离的职责：管理战斗中所有粒子发射器与暴击闪光环。
 *
 * 设计要点：
 * - 通过构造函数注入 Phaser Scene，访问 `add.particles` 与 `time.delayedCall`。
 * - 暴击闪光环需要绘制到共享的 Graphics 对象上，因此也接受 graphics 引用。
 * - 所有 emitter 自动在 lifespan 后销毁，避免泄漏。
 */

import Phaser from 'phaser';

interface ParticleConfig {
  color: number;
  count: number;
  speed: number;
  lifespan: number;
  scale: number;
  alpha?: number;
  blendMode?: Phaser.BlendModes;
}

interface CritFlashRing {
  x: number;
  y: number;
  lifeSec: number;
  maxLifeSec: number;
  color: number;
}

export class ParticleDirector {
  private readonly scene: Phaser.Scene;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private critFlashRings: CritFlashRing[] = [];

  constructor(scene: Phaser.Scene, graphics: Phaser.GameObjects.Graphics) {
    this.scene = scene;
    this.graphics = graphics;
  }

  /** 创建一个粒子发射器（不立即发射）。 */
  createEmitter(x: number, y: number, config: ParticleConfig): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.scene.add.particles(x, y, 'white-pixel', {
      lifespan: config.lifespan * 1000,
      speed: { min: config.speed * 0.6, max: config.speed * 1.4 },
      angle: { min: 0, max: 360 },
      scale: { start: config.scale * 1.2, end: config.scale * 0.3 },
      quantity: config.count,
      tint: config.color,
      alpha: { start: config.alpha ?? 1, end: 0 },
      blendMode: config.blendMode ?? Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(50);
    this.emitters.push(emitter);
    return emitter;
  }

  /** 发射一次粒子并自动销毁。 */
  emitParticles(x: number, y: number, config: ParticleConfig): void {
    const emitter = this.createEmitter(x, y, config);
    emitter.explode(config.count, x, y);
    this.scene.time.delayedCall(config.lifespan * 1000 + 100, () => {
      emitter.destroy();
      const idx = this.emitters.indexOf(emitter);
      if (idx >= 0) this.emitters.splice(idx, 1);
    });
  }

  /** 销毁所有粒子发射器，清空闪光环。在场景 teardown 时调用。 */
  cleanupAll(): void {
    for (const emitter of this.emitters) {
      emitter.destroy();
    }
    this.emitters.length = 0;
    this.critFlashRings.length = 0;
  }

  // ========== Specialized Particle Effects ==========

  /** 子弹命中火花。暴击命中会额外触发金色闪光环。 */
  emitHitSpark(x: number, y: number, isCrit: boolean): void {
    const color = isCrit ? 0xffd700 : 0xffffff;
    const count = isCrit ? 10 : 6;
    const speed = isCrit ? 140 : 90;
    const lifespan = isCrit ? 0.35 : 0.22;
    const scale = isCrit ? 3.5 : 2;

    this.emitParticles(x, y, {
      color,
      count,
      speed,
      lifespan,
      scale,
      alpha: 0.9,
      blendMode: Phaser.BlendModes.ADD,
    });

    if (isCrit) {
      this.emitCritFlashRing(x, y);
    }
  }

  /** 暴击爆发：金色主簇 + 白色火花 + 橙色冲击环。 */
  emitCritBurst(x: number, y: number): void {
    this.emitParticles(x, y, {
      color: 0xffd700,
      count: 20,
      speed: 170,
      lifespan: 0.45,
      scale: 4.5,
      alpha: 1,
      blendMode: Phaser.BlendModes.ADD,
    });

    this.emitParticles(x, y, {
      color: 0xffffff,
      count: 10,
      speed: 110,
      lifespan: 0.32,
      scale: 2.5,
      alpha: 0.85,
      blendMode: Phaser.BlendModes.ADD,
    });

    this.emitCritFlashRing(x, y);
  }

  /** 暴击径向闪光环。在 hit 位置画一个扩散的金色环。 */
  emitCritFlashRing(x: number, y: number, maxLifeSec: number = 0.3): void {
    this.emitFlashRing(x, y, 0xffd700, maxLifeSec);
  }

  /** 通用径向闪光环：任意路线颜色都可调用，与 crit 视觉强度对齐。 */
  emitFlashRing(x: number, y: number, color: number, maxLifeSec: number = 0.3): void {
    this.critFlashRings.push({ x, y, lifeSec: maxLifeSec, maxLifeSec, color });
  }

  /** 每帧渲染所有活跃的暴击闪光环。 */
  renderCritFlashRings(): void {
    const dt = 1 / 60;
    for (const ring of this.critFlashRings) {
      const ratio = 1 - ring.lifeSec / ring.maxLifeSec; // 0 -> 1
      const radius = 6 + ratio * 28;
      const alpha = (1 - ratio) * 0.7;
      this.graphics.lineStyle(2.5, ring.color, alpha);
      this.graphics.strokeCircle(ring.x, ring.y, radius);
      this.graphics.fillStyle(ring.color, alpha * 0.12);
      this.graphics.fillCircle(ring.x, ring.y, radius * 0.7);
      ring.lifeSec -= dt;
    }
    this.critFlashRings = this.critFlashRings.filter((r) => r.lifeSec > 0);
  }

  /** 穿透爆发：青蓝主簇 + 白色火花 + 扩散波纹 + 青色闪光环（强度对齐 crit burst）。 */
  emitPierceRipple(x: number, y: number): void {
    this.emitParticles(x, y, {
      color: 0x68d4ff,
      count: 18,
      speed: 150,
      lifespan: 0.4,
      scale: 4,
      alpha: 0.95,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.emitParticles(x, y, {
      color: 0xffffff,
      count: 10,
      speed: 100,
      lifespan: 0.3,
      scale: 2.4,
      alpha: 0.85,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.emitParticles(x, y, {
      color: 0xa8d8ff,
      count: 6,
      speed: 50,
      lifespan: 0.22,
      scale: 1.8,
      alpha: 0.7,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.emitFlashRing(x, y, 0x68d4ff, 0.3);
  }

  /** Dash 爆发：绿色主簇 + 浅绿火花 + 绿色闪光环（强度对齐 crit burst）。 */
  emitDashTrail(x: number, y: number): void {
    this.emitParticles(x, y, {
      color: 0x7aff7a,
      count: 16,
      speed: 140,
      lifespan: 0.38,
      scale: 3.8,
      alpha: 0.95,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.emitParticles(x, y, {
      color: 0xc8ffc8,
      count: 8,
      speed: 90,
      lifespan: 0.28,
      scale: 2.2,
      alpha: 0.85,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.emitParticles(x, y, {
      color: 0xffffff,
      count: 4,
      speed: 40,
      lifespan: 0.2,
      scale: 1.6,
      alpha: 0.7,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.emitFlashRing(x, y, 0x7aff7a, 0.3);
  }
}
