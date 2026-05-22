/**
 * 验证模块 - 数据验证功能
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schemaMap, enumFields, fieldRelations } from '../schemas.js';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

export function validateData(data, configType, loadedConfigs = {}) {
  const results = {
    errors: [],
    warnings: [],
    success: true
  };

  // 1. JSON Schema 验证
  if (configType && schemaMap[configType]) {
    const schema = schemaMap[configType];
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
      validate.errors.forEach(err => {
        const rowMatch = err.instancePath.match(/\/(\d+)/);
        const rowIndex = rowMatch ? parseInt(rowMatch[1]) + 1 : '?';

        if (err.keyword === 'required' || err.keyword === 'type') {
          results.errors.push(`第 ${rowIndex} 行: ${err.message} (${err.instancePath})`);
          results.success = false;
        } else {
          results.warnings.push(`第 ${rowIndex} 行: ${err.message} (${err.instancePath})`);
        }
      });
    }
  }

  // 2. 跨表引用验证
  if (configType === 'battleTemplates' && loadedConfigs.enemyArchetypes) {
    const validArchetypes = new Set(loadedConfigs.enemyArchetypes.map(e => e.id));

    data.forEach((row, index) => {
      if (row.regularArchetypes) {
        for (const archetype of Object.keys(row.regularArchetypes)) {
          if (!validArchetypes.has(archetype)) {
            results.errors.push(`第 ${index + 1} 行: regularArchetypes 引用了不存在的敌人类型 "${archetype}"`);
            results.success = false;
          }
        }
      }
    });
  }

  // 3. 数值平衡性分析
  if (configType === 'upgrades') {
    data.forEach((row, index) => {
      if (row['selection.baseWeight'] !== undefined) {
        const weight = parseFloat(row['selection.baseWeight']);
        if (weight > 15) {
          results.warnings.push(`第 ${index + 1} 行: baseWeight 为 ${weight}，过高可能导致该升级频繁出现`);
        }
        if (weight < 0.5 && row.rarity !== 'legendary') {
          results.warnings.push(`第 ${index + 1} 行: baseWeight 为 ${weight}，过低可能导致该升级极少出现`);
        }
      }

      if (row.rarity === 'rare' && row['selection.baseWeight'] > 5) {
        results.warnings.push(`第 ${index + 1} 行: rare 稀有度的 baseWeight 为 ${row['selection.baseWeight']}，建议 ≤ 5`);
      }
    });
  }

  // 4. 战斗模板难度曲线检查
  if (configType === 'battleTemplates') {
    const battleTemplates = data.filter(t => !t.id?.startsWith('boss'));
    if (battleTemplates.length > 1) {
      const avgHp = battleTemplates.reduce((sum, t) => sum + (parseFloat(t.enemyHp) || 0), 0) / battleTemplates.length;
      const avgDuration = battleTemplates.reduce((sum, t) => sum + (parseFloat(t.durationSec) || 0), 0) / battleTemplates.length;

      if (avgHp > 100) {
        results.warnings.push(`战斗模板平均敌人血量较高: ${avgHp.toFixed(1)}`);
      }
      if (avgDuration > 60) {
        results.warnings.push(`战斗模板平均持续时间较长: ${avgDuration.toFixed(1)}秒`);
      }

      for (let i = 1; i < battleTemplates.length; i++) {
        const prevHp = parseFloat(battleTemplates[i-1].enemyHp) || 0;
        const currHp = parseFloat(battleTemplates[i].enemyHp) || 0;

        if (currHp < prevHp * 0.8) {
          results.warnings.push(`第 ${i + 1} 个战斗模板的 enemyHp (${currHp}) 比前一个 (${prevHp}) 低很多，难度曲线可能不平滑`);
        }
      }
    }
  }

  return results;
}

// 实时单元格验证
export function validateCell(cell, configType, loadedConfigs) {
  const field = cell.getField();
  const value = cell.getValue();

  let errors = [];
  let warnings = [];

  // 1. 必填字段检查
  if (field === 'id' && (value === '' || value === null || value === undefined)) {
    errors.push('ID 不能为空');
  }

  // 2. 数值字段检查
  if ((field.includes('damage') || field.includes('hp') || field.includes('speed') ||
       field.includes('Multiplier') || field.includes('Weight') ||
       field.includes('Sec') || field.includes('Interval')) &&
      value !== '' && value !== null && value !== undefined) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      errors.push('必须是数字');
    } else if (numValue < 0) {
      errors.push('不能为负数');
    }
  }

  // 3. 枚举字段检查
  if (configType && enumFields[configType]) {
    const enumValues = enumFields[configType][field];
    if (enumValues && value !== '' && value !== null && value !== undefined) {
      if (!enumValues.includes(value)) {
        warnings.push(`建议值: ${enumValues.join(', ')}`);
      }
    }
  }

  // 4. 关联字段检查
  if (configType && fieldRelations[configType]) {
    const relation = fieldRelations[configType][field];
    if (relation && relation.targetTable && value) {
      const targetData = loadedConfigs[relation.targetTable];
      if (targetData) {
        const validIds = new Set(targetData.map(item => item.id));
        if (!validIds.has(value)) {
          warnings.push(`关联的 ${relation.relatesTo} 中不存在此值`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
