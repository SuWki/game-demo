/**
 * JSON Schema 验证规则定义
 * 用于验证游戏配置数据的完整性和格式
 */

// 升级配置验证规则
export const upgradeSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["id", "name", "category", "effects"],
    properties: {
      id: { 
        type: "string", 
        pattern: "^[a-z0-9-]+$",
        description: "升级唯一标识符，只能包含小写字母、数字和横线"
      },
      name: { 
        type: "string", 
        minLength: 1,
        description: "升级显示名称"
      },
      description: { 
        type: "string",
        description: "升级描述文本"
      },
      category: { 
        enum: ["generic", "route"],
        description: "升级类别：generic=通用，route=路线专属"
      },
      routeId: { 
        enum: ["crit", "pierce", "dash"],
        description: "路线 ID（仅 route 类别需要）"
      },
      rarity: { 
        enum: ["common", "uncommon", "rare", "epic", "legendary"],
        description: "稀有度"
      },
      repeatable: { 
        type: "boolean",
        description: "是否可重复获取"
      },
      effects: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["type"],
          properties: {
            type: { enum: ["stats", "heal", "route"] },
            modifiers: { type: "object" },
            amount: { type: "number" },
            routeId: { enum: ["crit", "pierce", "dash", "dominant"] }
          }
        }
      },
      selection: {
        type: "object",
        properties: {
          baseWeight: { type: "number", minimum: 0, maximum: 20 },
          minRound: { type: "number", minimum: 0 },
          maxRound: { type: "number", minimum: 0 },
          offRouteMultiplier: { type: "number", minimum: 0, maximum: 5 }
        }
      }
    }
  }
};

// 战斗模板验证规则
export const battleTemplateSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["id", "name", "durationSec", "enemyHp", "winCondition"],
    properties: {
      id: { 
        type: "string",
        pattern: "^[a-z0-9-]+$",
        description: "战斗模板唯一标识符"
      },
      name: { 
        type: "string", 
        minLength: 1,
        description: "战斗模板显示名称"
      },
      description: { 
        type: "string",
        description: "战斗描述"
      },
      durationSec: { 
        type: "number", 
        minimum: 1, 
        maximum: 300,
        description: "战斗持续时间（秒）"
      },
      spawnIntervalSec: { 
        type: "number", 
        minimum: 0.1,
        description: "敌人生成间隔（秒）"
      },
      enemyHp: { 
        type: "number", 
        minimum: 1,
        description: "敌人基础生命值"
      },
      enemySpeed: { 
        type: "number", 
        minimum: 0,
        description: "敌人移动速度"
      },
      enemyDamage: { 
        type: "number", 
        minimum: 0,
        description: "敌人伤害"
      },
      regularEnemyCap: { 
        type: "number", 
        minimum: 1,
        description: "普通敌人上限"
      },
      pressureMultiplier: { 
        type: "number", 
        minimum: 0.5,
        description: "压力倍率"
      },
      winCondition: {
        type: "object",
        required: ["type"],
        properties: {
          type: { enum: ["kills", "elite", "survive"] },
          target: { type: "number", minimum: 1 }
        }
      },
      spawnRule: {
        type: "object",
        properties: {
          pattern: { enum: ["surround", "pincers", "lanes"] },
          burstCount: { type: "number", minimum: 1 }
        }
      },
      regularArchetypes: {
        type: "object",
        additionalProperties: { type: "number", minimum: 0 }
      },
      eliteRule: {
        type: "object",
        properties: {
          spawnAtSec: { type: "number", minimum: 0 },
          hpMultiplier: { type: "number", minimum: 1 },
          speedMultiplier: { type: "number", minimum: 0.1 },
          damageMultiplier: { type: "number", minimum: 1 }
        }
      }
    }
  }
};

// 敌人原型验证规则
export const enemyArchetypeSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["id", "name", "hpMultiplier", "speedMultiplier"],
    properties: {
      id: { 
        type: "string",
        pattern: "^[a-z0-9-]+$",
        description: "敌人原型唯一标识符"
      },
      name: { 
        type: "string", 
        minLength: 1,
        description: "敌人显示名称"
      },
      hpMultiplier: { 
        type: "number", 
        minimum: 0.1, 
        maximum: 10,
        description: "生命值倍率"
      },
      speedMultiplier: { 
        type: "number", 
        minimum: 0.1, 
        maximum: 5,
        description: "速度倍率"
      },
      radiusMultiplier: { 
        type: "number", 
        minimum: 0.5, 
        maximum: 3,
        description: "半径倍率"
      },
      contactDamageMultiplier: { 
        type: "number", 
        minimum: 0.1, 
        maximum: 5,
        description: "接触伤害倍率"
      },
      experienceMultiplier: { 
        type: "number", 
        minimum: 0.1,
        description: "经验倍率"
      },
      preferredDistance: { 
        type: "number",
        description: "远程敌人偏好距离"
      },
      shotIntervalSec: { 
        type: "number",
        description: "远程敌人射击间隔"
      },
      projectileSpeed: { 
        type: "number",
        description: "远程敌人弹道速度"
      }
    }
  }
};

// 验证规则映射
export const schemaMap = {
  upgrades: upgradeSchema,
  battleTemplates: battleTemplateSchema,
  enemyArchetypes: enemyArchetypeSchema
};

// 自动识别配置类型
export function detectConfigType(data, fileName) {
  if (data.length === 0) return null;
  
  const firstRow = data[0];
  
  // 根据字段特征识别
  if (firstRow.effects || firstRow.rarity || firstRow.category) {
    return 'upgrades';
  }
  if (firstRow.winCondition || firstRow.durationSec || firstRow.enemyHp) {
    return 'battleTemplates';
  }
  if (firstRow.hpMultiplier && firstRow.speedMultiplier) {
    return 'enemyArchetypes';
  }
  
  // 根据文件名识别
  if (fileName) {
    if (fileName.includes('upgrade')) return 'upgrades';
    if (fileName.includes('battle') || fileName.includes('template')) return 'battleTemplates';
    if (fileName.includes('enemy') || fileName.includes('archetype')) return 'enemyArchetypes';
  }
  
  return null;
}
