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

// 枚举字段定义 - 用于表格下拉选择
export const enumFields = {
  // 全局通用枚举
  common: {
    rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    boolean: [true, false]
  },
  // upgrades 表的枚举字段
  upgrades: {
    category: ['generic', 'route'],
    routeId: ['crit', 'pierce', 'dash'],
    repeatable: [true, false],
    'effects.type': ['stats', 'heal', 'route'],
    'effects.routeId': ['crit', 'pierce', 'dash', 'dominant']
  },
  // battleTemplates 表的枚举字段
  battleTemplates: {
    'winCondition.type': ['kills', 'elite', 'survive'],
    'spawnRule.pattern': ['surround', 'pincers', 'lanes'],
    'winCondition.target': [10, 15, 20, 25, 30, 40, 50]
  },
  // enemyArchetypes 表的枚举字段
  enemyArchetypes: {}
};

// 字段关联关系定义
export const fieldRelations = {
  upgrades: {
    routeId: { relatesTo: '路线 ID', targetTable: 'routes', targetField: 'id' },
    'effects.routeId': { relatesTo: '路线效果', targetTable: 'routes', targetField: 'id' }
  },
  battleTemplates: {
    regularArchetypes: { relatesTo: '敌人原型', targetTable: 'enemyArchetypes', targetField: 'id' },
    'winCondition.type': { relatesTo: '胜利条件类型', targetTable: null, targetField: null },
    'spawnRule.pattern': { relatesTo: '生成模式', targetTable: null, targetField: null }
  },
  enemyArchetypes: {}
};

// 配置类型说明
export const configDescriptions = {
  upgrades: '升级配置表 - 定义游戏中可获取的升级项，包括属性、稀有度和出现权重',
  battleTemplates: '战斗模板表 - 定义战斗波次的敌人配置、持续时间和胜利条件',
  enemyArchetypes: '敌人原型表 - 定义敌人的基础属性倍率，供战斗模板引用'
};

// 验证规则映射
export const schemaMap = {
  upgrades: upgradeSchema,
  battleTemplates: battleTemplateSchema,
  enemyArchetypes: enemyArchetypeSchema
};

// 提取字段描述
export function getFieldDescriptions(configType) {
  const schema = schemaMap[configType];
  if (!schema || !schema.items || !schema.items.properties) return {};

  const descriptions = {};
  const properties = schema.items.properties;

  function extractDescriptions(props, prefix = '') {
    for (const [key, value] of Object.entries(props)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value.description) {
        descriptions[fullKey] = value.description;
      }
      if (value.properties) {
        extractDescriptions(value.properties, fullKey);
      }
      if (value.items && value.items.properties) {
        extractDescriptions(value.items.properties, fullKey);
      }
    }
  }

  extractDescriptions(properties);
  return descriptions;
}

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

// 字段类型映射图标和说明
export const fieldTypeMeta = {
  string: { icon: '🔤', label: '文本', color: '#6366f1', editor: 'input' },
  number: { icon: '🔢', label: '数字', color: '#0ea5e9', editor: 'number' },
  boolean: { icon: '☑️', label: '布尔', color: '#10b981', editor: 'toggle' },
  array: { icon: '📋', label: '数组', color: '#f59e0b', editor: 'json' },
  object: { icon: '📦', label: '对象', color: '#8b5cf6', editor: 'json' },
  enum: { icon: '📋', label: '枚举', color: '#ec4899', editor: 'select' },
  id: { icon: '🆔', label: 'ID', color: '#ef4444', editor: 'input' }
};

// 提取字段类型信息
export function getFieldTypes(configType) {
  const schema = schemaMap[configType];
  if (!schema || !schema.items || !schema.items.properties) return {};

  const types = {};
  const properties = schema.items.properties;

  function extractTypes(props, prefix = '') {
    for (const [key, value] of Object.entries(props)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      let typeInfo = { ...fieldTypeMeta.string }; // 默认文本

      if (key === 'id') {
        typeInfo = { ...fieldTypeMeta.id };
      } else if (value.enum) {
        typeInfo = { ...fieldTypeMeta.enum };
      } else if (value.type === 'number') {
        typeInfo = { ...fieldTypeMeta.number };
        if (value.minimum !== undefined) typeInfo.min = value.minimum;
        if (value.maximum !== undefined) typeInfo.max = value.maximum;
      } else if (value.type === 'boolean') {
        typeInfo = { ...fieldTypeMeta.boolean };
      } else if (value.type === 'array') {
        typeInfo = { ...fieldTypeMeta.array };
      } else if (value.type === 'object') {
        typeInfo = { ...fieldTypeMeta.object };
      }

      // 添加描述
      if (value.description) {
        typeInfo.description = value.description;
      }

      types[fullKey] = typeInfo;

      if (value.properties) {
        extractTypes(value.properties, fullKey);
      }
      if (value.items && value.items.properties) {
        extractTypes(value.items.properties, fullKey);
      }
    }
  }

  extractTypes(properties);
  return types;
}
