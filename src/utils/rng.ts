export class SeededRNG {
  private seed: number;
  private originalSeed: number;

  constructor(seed?: number) {
    this.originalSeed = seed ?? Date.now() + performance.now();
    this.seed = this.originalSeed;
  }

  getSeed(): number {
    return this.originalSeed;
  }

  reset(): void {
    this.seed = this.originalSeed;
  }

  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  weightedPick<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

const defaultRNG = new SeededRNG();
let restartCounter = 0;

export interface RunSeedResolution {
  seed: number;
  fixed: boolean;
}

export function resolveRunSeed(fallbackSeed = Date.now() + Math.floor(performance.now() * 1000)): RunSeedResolution {
  if (typeof window !== 'undefined') {
    try {
      const searchParams = new URL(window.location.href).searchParams;
      const seedParam = searchParams.get('seed') ?? searchParams.get('qaSeed') ?? searchParams.get('pilotSeed');
      if (seedParam !== null) {
        const parsed = Number(seedParam);
        if (Number.isFinite(parsed)) {
          return {
            seed: Math.trunc(parsed),
            fixed: true,
          };
        }
      }
    } catch {
      // Ignore malformed URLs and fall back to a time-based seed.
    }
  }

  return {
    seed: Math.trunc(fallbackSeed),
    fixed: false,
  };
}

export function setRNGSeed(seed: number, options?: { stable?: boolean }): void {
  if (options?.stable) {
    restartCounter = 0;
    defaultRNG['seed'] = seed;
    defaultRNG['originalSeed'] = seed;
    return;
  }

  restartCounter++;
  // 混合种子与重启计数器，确保即使快速重启也有不同种子
  const mixedSeed = seed ^ (restartCounter * 0x9e3779b9);
  defaultRNG['seed'] = mixedSeed;
  defaultRNG['originalSeed'] = mixedSeed;
}

export function getRNGSeed(): number {
  return defaultRNG.getSeed();
}

export function rng(): SeededRNG {
  return defaultRNG;
}
