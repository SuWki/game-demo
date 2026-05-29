/**
 * 配置加载器
 * 支持从 JSON 文件加载游戏配置，开发环境支持热重载
 * 
 * 使用方式:
 *   const configLoader = new ConfigLoader();
 *   await configLoader.preloadCore();
 *   const upgrades = configLoader.getUpgrades();
 */

import type {
  UpgradeArchetype,
  BattleTemplateDefinition,
  EnemyArchetypeDefinition,
} from '../game/types';

// 配置名称类型
export type ConfigName = 'upgrades' | 'battleTemplates' | 'enemyArchetypes' | 'balance';

// 配置数据类型映射
export interface ConfigMap {
  upgrades: UpgradeArchetype[];
  battleTemplates: BattleTemplateDefinition[];
  enemyArchetypes: EnemyArchetypeDefinition[];
  balance: Record<string, unknown>;
}

export class ConfigLoader {
  private configs: Partial<ConfigMap> = {};
  private isDev: boolean;
  private loaded: boolean = false;

  constructor(isDev?: boolean) {
    this.isDev = isDev ?? (import.meta as any).env?.DEV ?? false;
  }

  /**
   * 预加载所有核心配置
   */
  async preloadCore(): Promise<void> {
    if (this.loaded) return;

    const configNames: ConfigName[] = ['upgrades', 'battleTemplates', 'enemyArchetypes', 'balance'];
    
    for (const name of configNames) {
      try {
        await this.load(name);
      } catch (error) {
        console.warn(`[ConfigLoader] 预加载 ${name} 失败，将使用内置数据`);
      }
    }
    
    this.loaded = true;
    console.log('[ConfigLoader] 核心配置预加载完成');
  }

  /**
   * 加载指定配置
   */
  async load<T extends ConfigName>(name: T): Promise<ConfigMap[T]> {
    if (this.configs[name]) {
      return this.configs[name] as ConfigMap[T];
    }

    try {
      const base = (import.meta as any).env?.BASE_URL ?? '/';
      const response = await fetch(`${base}data/${name}.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      this.configs[name] = data;
      
      if (this.isDev) {
        console.log(`[ConfigLoader] 已从 JSON 加载 ${name}`);
      }
      
      return data as ConfigMap[T];
    } catch (error) {
      console.warn(`[ConfigLoader] 加载 ${name}.json 失败: ${error}`);
      
      // 回退到内置数据
      const fallback = await this.getFallback(name);
      this.configs[name] = fallback;
      return fallback as ConfigMap[T];
    }
  }

  /**
   * 开发环境热重载
   */
  async reload<T extends ConfigName>(name: T): Promise<ConfigMap[T]> {
    if (!this.isDev) {
      console.warn('[ConfigLoader] 热重载仅在开发环境可用');
      return this.get<T>(name);
    }

    this.configs[name] = undefined;
    return this.load(name);
  }

  /**
   * 获取已加载的配置（同步）
   */
  get<T extends ConfigName>(name: T): ConfigMap[T] {
    if (!this.configs[name]) {
      throw new Error(`[ConfigLoader] 配置 ${name} 未加载，请先调用 preloadCore()`);
    }
    return this.configs[name] as ConfigMap[T];
  }

  /**
   * 获取升级配置
   */
  getUpgrades(): UpgradeArchetype[] {
    return this.get('upgrades');
  }

  /**
   * 获取战斗模板配置
   */
  getBattleTemplates(): BattleTemplateDefinition[] {
    return this.get('battleTemplates');
  }

  /**
   * 获取敌人原型配置
   */
  getEnemyArchetypes(): EnemyArchetypeDefinition[] {
    return this.get('enemyArchetypes');
  }

  /**
   * 获取平衡性配置
   */
  getBalance(): Record<string, unknown> {
    return this.get('balance');
  }

  /**
   * 检查配置是否已加载
   */
  isLoaded(name: ConfigName): boolean {
    return this.configs[name] !== undefined;
  }

  /**
   * 获取内置数据（回退）
   */
  private async getFallback<T extends ConfigName>(name: T): Promise<ConfigMap[T]> {
    switch (name) {
      case 'upgrades': {
        const { UPGRADE_ARCHETYPES } = await import('../data/upgrades');
        return UPGRADE_ARCHETYPES as unknown as ConfigMap[T];
      }
      case 'battleTemplates': {
        const { BATTLE_TEMPLATES } = await import('../data/battleTemplates');
        return Object.values(BATTLE_TEMPLATES) as unknown as ConfigMap[T];
      }
      case 'enemyArchetypes': {
        const { ENEMY_ARCHETYPES } = await import('../data/enemyArchetypes');
        return Object.values(ENEMY_ARCHETYPES) as unknown as ConfigMap[T];
      }
      case 'balance': {
        const balanceModule = await import('../data/balance');
        return {
          VIEWPORT_WIDTH: balanceModule.VIEWPORT_WIDTH,
          VIEWPORT_HEIGHT: balanceModule.VIEWPORT_HEIGHT,
          ARENA_WIDTH: balanceModule.ARENA_WIDTH,
          ARENA_HEIGHT: balanceModule.ARENA_HEIGHT,
          PLAYER_BODY_RADIUS: balanceModule.PLAYER_BODY_RADIUS,
          PLAYER_COLLISION_RADIUS: balanceModule.PLAYER_COLLISION_RADIUS,
          UPGRADE_VALUE_BUCKET_THRESHOLDS: balanceModule.UPGRADE_VALUE_BUCKET_THRESHOLDS,
          RARITY_LABEL_MAP: balanceModule.RARITY_LABEL_MAP,
          RARITY_COLOR_MAP: balanceModule.RARITY_COLOR_MAP,
        } as unknown as ConfigMap[T];
      }
      default:
        throw new Error(`[ConfigLoader] 未知的配置名称: ${name}`);
    }
  }
}
