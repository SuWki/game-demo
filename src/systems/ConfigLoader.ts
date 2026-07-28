/**
 * 配置加载器
 *
 * 设计原则：`src/data/*.ts` 是唯一事实源（single source of truth）。
 * `public/data/*.json` 仅为 Excel 工作流提供的导出产物，运行时不再 fetch。
 *
 * 所有数据通过静态 import 引入，无需异步加载。
 */

import type {
  BattleTemplateDefinition,
  EnemyArchetypeDefinition,
  UpgradeArchetype,
} from '../game/types';
import { BATTLE_TEMPLATES } from '../data/battleTemplates';
import { ENEMY_ARCHETYPES } from '../data/enemyArchetypes';
import { UPGRADE_ARCHETYPES } from '../data/upgrades';

export class ConfigLoader {
  private readonly upgrades: UpgradeArchetype[] = UPGRADE_ARCHETYPES;
  private readonly battleTemplates: BattleTemplateDefinition[] = Object.values(BATTLE_TEMPLATES);
  private readonly enemyArchetypes: EnemyArchetypeDefinition[] = Object.values(ENEMY_ARCHETYPES);
  /** 获取升级配置。 */
  getUpgrades(): UpgradeArchetype[] {
    return this.upgrades;
  }

  /** 获取所有战斗模板。 */
  getBattleTemplates(): BattleTemplateDefinition[] {
    return this.battleTemplates;
  }

  /** 获取所有敌人原型定义。 */
  getEnemyArchetypes(): EnemyArchetypeDefinition[] {
    return this.enemyArchetypes;
  }

  /**
   * 按 ID 查找战斗模板，找不到则 fail-fast。
   */
  getBattleTemplate(id: BattleTemplateDefinition['id']): BattleTemplateDefinition {
    const template = this.battleTemplates.find(t => t.id === id);
    if (!template) {
      throw new Error(`[ConfigLoader] 战斗模板未找到: ${id}`);
    }
    return template;
  }

  /**
   * 按 ID 查找敌人原型，找不到则 fail-fast。
   */
  getEnemyArchetype(id: EnemyArchetypeDefinition['id']): EnemyArchetypeDefinition {
    const archetype = this.enemyArchetypes.find(a => a.id === id);
    if (!archetype) {
      throw new Error(`[ConfigLoader] 敌人原型未找到: ${id}`);
    }
    return archetype;
  }

  /**
   * 按 ID 查找升级原型，找不到则 fail-fast。
   */
  getUpgrade(id: UpgradeArchetype['id']): UpgradeArchetype {
    const upgrade = this.upgrades.find(u => u.id === id);
    if (!upgrade) {
      throw new Error(`[ConfigLoader] 升级原型未找到: ${id}`);
    }
    return upgrade;
  }
}
