/**
 * Excel 公式引擎
 * 支持策划常用的公式计算
 */

// 公式解析器
export class FormulaEngine {
  constructor(data, columns) {
    this.data = data;
    this.columns = columns;
    this.variables = {};
    this.initVariables();
  }

  // 初始化变量（列名 -> 列索引映射）
  initVariables() {
    this.columns.forEach((col, index) => {
      this.variables[col] = index;
    });
  }

  // 解析并计算公式
  evaluate(formula, rowIndex) {
    if (!formula || typeof formula !== 'string') return null;
    if (!formula.startsWith('=')) return formula;

    const expression = formula.substring(1).trim();

    try {
      // 替换单元格引用为实际值
      const processedExpr = this.replaceCellReferences(expression, rowIndex);
      // 处理函数调用
      const result = this.evaluateExpression(processedExpr, rowIndex);
      return result;
    } catch (error) {
      console.error('公式计算错误:', error);
      return `#ERROR: ${error.message}`;
    }
  }

  // 替换单元格引用 (A1, B2 等)
  replaceCellReferences(expression, currentRow) {
    // 匹配列字母+行号 (如 A1, B2, AA10)
    const cellRefRegex = /([A-Za-z]+)(\d+)/g;

    return expression.replace(cellRefRegex, (match, colLetters, rowNum) => {
      const colIndex = this.columnLettersToIndex(colLetters);
      const rowIndex = parseInt(rowNum) - 1;

      if (colIndex >= 0 && colIndex < this.columns.length) {
        const colName = this.columns[colIndex];
        const value = this.getCellValue(rowIndex, colName);
        return this.formatValueForExpression(value);
      }
      return '0';
    });
  }

  // 列字母转索引 (A=0, B=1, AA=26)
  columnLettersToIndex(letters) {
    let index = 0;
    for (let i = 0; i < letters.length; i++) {
      index = index * 26 + (letters.toUpperCase().charCodeAt(i) - 65);
    }
    return index;
  }

  // 获取单元格值
  getCellValue(rowIndex, colName) {
    if (rowIndex < 0 || rowIndex >= this.data.length) return 0;
    const value = this.data[rowIndex][colName];
    if (value === null || value === undefined || value === '') return 0;
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }

  // 格式化值用于表达式
  formatValueForExpression(value) {
    if (typeof value === 'string') {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return String(value);
  }

  // 评估表达式（支持函数）
  evaluateExpression(expression, rowIndex) {
    // 先处理所有函数调用
    let result = expression;

    // 递归处理嵌套函数
    while (this.hasFunctionCall(result)) {
      result = this.processFunctionCalls(result, rowIndex);
    }

    // 最后计算数学表达式
    return this.safeEval(result);
  }

  // 检查是否有函数调用
  hasFunctionCall(expr) {
    return /[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(expr);
  }

  // 处理函数调用
  processFunctionCalls(expression, rowIndex) {
    // 匹配最内层的函数调用
    const funcRegex = /([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)/;

    return expression.replace(funcRegex, (match, funcName, args) => {
      const func = this.getFunction(funcName.toUpperCase());
      if (!func) return match;

      const parsedArgs = this.parseArguments(args, rowIndex);
      return this.formatValueForExpression(func(...parsedArgs));
    });
  }

  // 解析参数
  parseArguments(argsStr, rowIndex) {
    if (!argsStr.trim()) return [];

    const args = [];
    let current = '';
    let depth = 0;
    let inString = false;

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];

      if (char === '"' && (i === 0 || argsStr[i-1] !== '\\')) {
        inString = !inString;
        current += char;
      } else if (!inString) {
        if (char === '(') {
          depth++;
          current += char;
        } else if (char === ')') {
          depth--;
          current += char;
        } else if (char === ',' && depth === 0) {
          args.push(this.processArgument(current.trim(), rowIndex));
          current = '';
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(this.processArgument(current.trim(), rowIndex));
    }

    return args;
  }

  // 处理单个参数
  processArgument(arg, rowIndex) {
    arg = arg.trim();

    // 字符串
    if (arg.startsWith('"') && arg.endsWith('"')) {
      return arg.slice(1, -1);
    }

    // 范围引用 (A1:A10)
    if (/[A-Za-z]+\d+:[A-Za-z]+\d+/.test(arg)) {
      return this.getRangeValues(arg);
    }

    // 列引用 (A:A)
    if (/[A-Za-z]+:[A-Za-z]+/.test(arg)) {
      return this.getColumnRangeValues(arg);
    }

    // 单个单元格
    if (/[A-Za-z]+\d+/.test(arg)) {
      const match = arg.match(/([A-Za-z]+)(\d+)/);
      if (match) {
        const colIdx = this.columnLettersToIndex(match[1]);
        const rowIdx = parseInt(match[2]) - 1;
        if (colIdx >= 0 && colIdx < this.columns.length) {
          return this.getCellValue(rowIdx, this.columns[colIdx]);
        }
      }
    }

    // 尝试作为数字
    const num = parseFloat(arg);
    if (!isNaN(num)) return num;

    return arg;
  }

  // 获取范围值
  getRangeValues(rangeStr) {
    const [start, end] = rangeStr.split(':');
    const startMatch = start.match(/([A-Za-z]+)(\d+)/);
    const endMatch = end.match(/([A-Za-z]+)(\d+)/);

    if (!startMatch || !endMatch) return [];

    const startCol = this.columnLettersToIndex(startMatch[1]);
    const startRow = parseInt(startMatch[2]) - 1;
    const endCol = this.columnLettersToIndex(endMatch[1]);
    const endRow = parseInt(endMatch[2]) - 1;

    const values = [];
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (c >= 0 && c < this.columns.length) {
          values.push(this.getCellValue(r, this.columns[c]));
        }
      }
    }
    return values;
  }

  // 获取整列范围值
  getColumnRangeValues(rangeStr) {
    const [startCol, endCol] = rangeStr.split(':');
    const startIdx = this.columnLettersToIndex(startCol);
    const endIdx = this.columnLettersToIndex(endCol);

    const values = [];
    for (let r = 0; r < this.data.length; r++) {
      for (let c = startIdx; c <= endIdx; c++) {
        if (c >= 0 && c < this.columns.length) {
          values.push(this.getCellValue(r, this.columns[c]));
        }
      }
    }
    return values;
  }

  // 安全求值数学表达式
  safeEval(expression) {
    try {
      // 只允许安全字符
      const safeExpr = expression
        .replace(/[^\d+\-*/().\s<>!=&|]/g, '')
        .replace(/\/\//g, '/'); // 替换除法

      // eslint-disable-next-line no-new-func
      const result = Function('"use strict"; return (' + safeExpr + ')')();
      return result;
    } catch (e) {
      return expression;
    }
  }

  // 获取函数
  getFunction(name) {
    const functions = {
      // 数学函数
      'SUM': (...args) => {
        const flat = args.flat();
        return flat.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
      },
      'AVERAGE': (...args) => {
        const flat = args.flat().filter(v => v !== null && v !== undefined);
        if (flat.length === 0) return 0;
        const sum = flat.reduce((s, v) => s + (parseFloat(v) || 0), 0);
        return sum / flat.length;
      },
      'MAX': (...args) => {
        const flat = args.flat().map(v => parseFloat(v) || 0);
        return flat.length > 0 ? Math.max(...flat) : 0;
      },
      'MIN': (...args) => {
        const flat = args.flat().map(v => parseFloat(v) || 0);
        return flat.length > 0 ? Math.min(...flat) : 0;
      },
      'COUNT': (...args) => args.flat().length,
      'COUNTA': (...args) => args.flat().filter(v => v !== null && v !== undefined && v !== '').length,
      'ROUND': (num, digits = 0) => {
        const factor = Math.pow(10, digits);
        return Math.round((parseFloat(num) || 0) * factor) / factor;
      },
      'CEILING': (num, significance = 1) => {
        const n = parseFloat(num) || 0;
        const s = parseFloat(significance) || 1;
        return Math.ceil(n / s) * s;
      },
      'FLOOR': (num, significance = 1) => {
        const n = parseFloat(num) || 0;
        const s = parseFloat(significance) || 1;
        return Math.floor(n / s) * s;
      },
      'ABS': (num) => Math.abs(parseFloat(num) || 0),
      'POWER': (base, exp) => Math.pow(parseFloat(base) || 0, parseFloat(exp) || 0),
      'SQRT': (num) => Math.sqrt(parseFloat(num) || 0),
      'MOD': (num, divisor) => {
        const n = parseFloat(num) || 0;
        const d = parseFloat(divisor) || 1;
        return d === 0 ? '#DIV/0!' : n % d;
      },

      // 逻辑函数
      'IF': (condition, trueVal, falseVal = '') => {
        return this.evaluateCondition(condition) ? trueVal : falseVal;
      },
      'AND': (...args) => args.every(arg => this.toBoolean(arg)),
      'OR': (...args) => args.some(arg => this.toBoolean(arg)),
      'NOT': (arg) => !this.toBoolean(arg),

      // 文本函数
      'CONCAT': (...args) => args.flat().join(''),
      'CONCATENATE': (...args) => args.flat().join(''),
      'LEFT': (text, numChars = 1) => String(text).substring(0, numChars),
      'RIGHT': (text, numChars = 1) => String(text).slice(-numChars),
      'MID': (text, start, numChars) => String(text).substring(start - 1, start - 1 + numChars),
      'LEN': (text) => String(text).length,
      'UPPER': (text) => String(text).toUpperCase(),
      'LOWER': (text) => String(text).toLowerCase(),
      'TRIM': (text) => String(text).trim(),

      // 查找函数
      'VLOOKUP': (lookupValue, tableArray, colIndex, exactMatch = true) => {
        return this.vlookup(lookupValue, tableArray, colIndex, exactMatch);
      },
      'HLOOKUP': (lookupValue, tableArray, rowIndex, exactMatch = true) => {
        return this.hlookup(lookupValue, tableArray, rowIndex, exactMatch);
      },
      'INDEX': (array, rowNum, colNum = 1) => {
        const flat = Array.isArray(array) ? array.flat() : [array];
        const idx = (parseInt(rowNum) || 1) - 1;
        return flat[idx] !== undefined ? flat[idx] : '#REF!';
      },
      'MATCH': (lookupValue, lookupArray, matchType = 0) => {
        return this.match(lookupValue, lookupArray, matchType);
      },

      // 条件统计
      'COUNTIF': (range, criteria) => {
        return this.countif(range, criteria);
      },
      'SUMIF': (range, criteria, sumRange) => {
        return this.sumif(range, criteria, sumRange);
      },
      'AVERAGEIF': (range, criteria) => {
        return this.averageif(range, criteria);
      },

      // 游戏配置专用函数
      'WEIGHTED_RANDOM': (...weights) => {
        // 加权随机选择
        const flat = weights.flat().map(v => parseFloat(v) || 0);
        const total = flat.reduce((a, b) => a + b, 0);
        if (total === 0) return 0;
        let random = Math.random() * total;
        for (let i = 0; i < flat.length; i++) {
          random -= flat[i];
          if (random <= 0) return i + 1;
        }
        return flat.length;
      },
      'CLAMP': (value, min, max) => {
        const v = parseFloat(value) || 0;
        const mn = parseFloat(min) || 0;
        const mx = parseFloat(max) || 0;
        return Math.max(mn, Math.min(v, mx));
      },
      'LERP': (start, end, t) => {
        const s = parseFloat(start) || 0;
        const e = parseFloat(end) || 0;
        const factor = Math.max(0, Math.min(1, parseFloat(t) || 0));
        return s + (e - s) * factor;
      },
      'RANDOM_RANGE': (min, max) => {
        const mn = parseFloat(min) || 0;
        const mx = parseFloat(max) || 0;
        return mn + Math.random() * (mx - mn);
      },
      'RANDOM_INT': (min, max) => {
        const mn = Math.ceil(parseFloat(min) || 0);
        const mx = Math.floor(parseFloat(max) || 0);
        return Math.floor(Math.random() * (mx - mn + 1)) + mn;
      },
    };

    return functions[name];
  }

  // 评估条件
  evaluateCondition(condition) {
    if (typeof condition === 'boolean') return condition;
    if (typeof condition === 'number') return condition !== 0;
    if (typeof condition === 'string') {
      // 处理比较表达式
      if (condition.includes('>=')) {
        const [left, right] = condition.split('>=').map(s => s.trim());
        return (parseFloat(left) || 0) >= (parseFloat(right) || 0);
      }
      if (condition.includes('<=')) {
        const [left, right] = condition.split('<=').map(s => s.trim());
        return (parseFloat(left) || 0) <= (parseFloat(right) || 0);
      }
      if (condition.includes('>')) {
        const [left, right] = condition.split('>').map(s => s.trim());
        return (parseFloat(left) || 0) > (parseFloat(right) || 0);
      }
      if (condition.includes('<')) {
        const [left, right] = condition.split('<').map(s => s.trim());
        return (parseFloat(left) || 0) < (parseFloat(right) || 0);
      }
      if (condition.includes('==') || condition.includes('=')) {
        const sep = condition.includes('==') ? '==' : '=';
        const [left, right] = condition.split(sep).map(s => s.trim());
        return left === right;
      }
      if (condition.includes('!=')) {
        const [left, right] = condition.split('!=').map(s => s.trim());
        return left !== right;
      }
      return condition.length > 0;
    }
    return false;
  }

  // 转布尔值
  toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0 && value !== '0' && value.toLowerCase() !== 'false';
    return !!value;
  }

  // VLOOKUP 实现
  vlookup(lookupValue, tableArray, colIndex, exactMatch) {
    if (!Array.isArray(tableArray) || tableArray.length === 0) return '#N/A';

    const colIdx = (parseInt(colIndex) || 1) - 1;
    const exact = exactMatch !== false && exactMatch !== 0;

    for (let i = 0; i < tableArray.length; i++) {
      const row = tableArray[i];
      if (Array.isArray(row)) {
        if (exact && row[0] === lookupValue) return row[colIdx] !== undefined ? row[colIdx] : '#REF!';
        if (!exact && String(row[0]) >= String(lookupValue)) return row[colIdx] !== undefined ? row[colIdx] : '#REF!';
      }
    }
    return '#N/A';
  }

  // HLOOKUP 实现
  hlookup(lookupValue, tableArray, rowIndex, exactMatch) {
    if (!Array.isArray(tableArray) || tableArray.length === 0) return '#N/A';

    const rowIdx = (parseInt(rowIndex) || 1) - 1;
    const exact = exactMatch !== false && exactMatch !== 0;

    const firstRow = tableArray[0];
    if (!Array.isArray(firstRow)) return '#N/A';

    for (let i = 0; i < firstRow.length; i++) {
      if (exact && firstRow[i] === lookupValue) {
        return tableArray[rowIdx] && tableArray[rowIdx][i] !== undefined ? tableArray[rowIdx][i] : '#REF!';
      }
      if (!exact && String(firstRow[i]) >= String(lookupValue)) {
        return tableArray[rowIdx] && tableArray[rowIdx][i] !== undefined ? tableArray[rowIdx][i] : '#REF!';
      }
    }
    return '#N/A';
  }

  // MATCH 实现
  match(lookupValue, lookupArray, matchType) {
    const type = parseInt(matchType) || 0;
    const arr = Array.isArray(lookupArray) ? lookupArray : [lookupArray];

    if (type === 0) {
      // 精确匹配
      const idx = arr.findIndex(v => v === lookupValue);
      return idx >= 0 ? idx + 1 : '#N/A';
    } else if (type === 1) {
      // 小于等于的最大值
      let result = -1;
      for (let i = 0; i < arr.length; i++) {
        const v = parseFloat(arr[i]) || 0;
        const lv = parseFloat(lookupValue) || 0;
        if (v <= lv) result = i;
        else break;
      }
      return result >= 0 ? result + 1 : '#N/A';
    } else if (type === -1) {
      // 大于等于的最小值
      let result = -1;
      for (let i = arr.length - 1; i >= 0; i--) {
        const v = parseFloat(arr[i]) || 0;
        const lv = parseFloat(lookupValue) || 0;
        if (v >= lv) result = i;
        else break;
      }
      return result >= 0 ? result + 1 : '#N/A';
    }
    return '#N/A';
  }

  // COUNTIF 实现
  countif(range, criteria) {
    const arr = Array.isArray(range) ? range : [range];
    const crit = String(criteria);

    return arr.filter(v => {
      const sv = String(v);
      // 支持通配符
      if (crit.includes('*')) {
        const regex = new RegExp('^' + crit.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        return regex.test(sv);
      }
      return sv === crit;
    }).length;
  }

  // SUMIF 实现
  sumif(range, criteria, sumRange) {
    const checkArr = Array.isArray(range) ? range : [range];
    const sumArr = sumRange ? (Array.isArray(sumRange) ? sumRange : [sumRange]) : checkArr;
    const crit = String(criteria);

    let total = 0;
    for (let i = 0; i < checkArr.length; i++) {
      const sv = String(checkArr[i]);
      let match = false;

      if (crit.includes('*')) {
        const regex = new RegExp('^' + crit.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        match = regex.test(sv);
      } else {
        match = sv === crit;
      }

      if (match && sumArr[i] !== undefined) {
        total += parseFloat(sumArr[i]) || 0;
      }
    }
    return total;
  }

  // AVERAGEIF 实现
  averageif(range, criteria) {
    const arr = Array.isArray(range) ? range : [range];
    const crit = String(criteria);

    let sum = 0;
    let count = 0;

    for (const v of arr) {
      const sv = String(v);
      let match = false;

      if (crit.includes('*')) {
        const regex = new RegExp('^' + crit.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        match = regex.test(sv);
      } else {
        match = sv === crit;
      }

      if (match) {
        sum += parseFloat(v) || 0;
        count++;
      }
    }

        return count > 0 ? sum / count : 0;
  }
}

// 支持的公式列表（用于提示）
export const SUPPORTED_FORMULAS = {
  '数学函数': [
    { name: 'SUM', syntax: 'SUM(值1, 值2, ...)', desc: '求和' },
    { name: 'AVERAGE', syntax: 'AVERAGE(值1, 值2, ...)', desc: '平均值' },
    { name: 'MAX', syntax: 'MAX(值1, 值2, ...)', desc: '最大值' },
    { name: 'MIN', syntax: 'MIN(值1, 值2, ...)', desc: '最小值' },
    { name: 'COUNT', syntax: 'COUNT(值1, 值2, ...)', desc: '计数' },
    { name: 'ROUND', syntax: 'ROUND(数值, 小数位)', desc: '四舍五入' },
    { name: 'CEILING', syntax: 'CEILING(数值, 基数)', desc: '向上取整' },
    { name: 'FLOOR', syntax: 'FLOOR(数值, 基数)', desc: '向下取整' },
    { name: 'ABS', syntax: 'ABS(数值)', desc: '绝对值' },
    { name: 'POWER', syntax: 'POWER(底数, 指数)', desc: '幂运算' },
    { name: 'SQRT', syntax: 'SQRT(数值)', desc: '平方根' },
    { name: 'MOD', syntax: 'MOD(被除数, 除数)', desc: '取余' },
  ],
  '逻辑函数': [
    { name: 'IF', syntax: 'IF(条件, 真值, 假值)', desc: '条件判断' },
    { name: 'AND', syntax: 'AND(条件1, 条件2, ...)', desc: '逻辑与' },
    { name: 'OR', syntax: 'OR(条件1, 条件2, ...)', desc: '逻辑或' },
    { name: 'NOT', syntax: 'NOT(条件)', desc: '逻辑非' },
  ],
  '文本函数': [
    { name: 'CONCAT', syntax: 'CONCAT(文本1, 文本2, ...)', desc: '连接文本' },
    { name: 'LEFT', syntax: 'LEFT(文本, 字符数)', desc: '从左取字符' },
    { name: 'RIGHT', syntax: 'RIGHT(文本, 字符数)', desc: '从右取字符' },
    { name: 'MID', syntax: 'MID(文本, 起始位置, 字符数)', desc: '取中间字符' },
    { name: 'LEN', syntax: 'LEN(文本)', desc: '文本长度' },
    { name: 'UPPER', syntax: 'UPPER(文本)', desc: '转大写' },
    { name: 'LOWER', syntax: 'LOWER(文本)', desc: '转小写' },
  ],
  '查找函数': [
    { name: 'VLOOKUP', syntax: 'VLOOKUP(查找值, 区域, 列序数, 精确匹配)', desc: '垂直查找' },
    { name: 'HLOOKUP', syntax: 'HLOOKUP(查找值, 区域, 行序数, 精确匹配)', desc: '水平查找' },
    { name: 'INDEX', syntax: 'INDEX(区域, 行序数, 列序数)', desc: '索引取值' },
    { name: 'MATCH', syntax: 'MATCH(查找值, 区域, 匹配类型)', desc: '查找位置' },
  ],
  '条件统计': [
    { name: 'COUNTIF', syntax: 'COUNTIF(区域, 条件)', desc: '条件计数' },
    { name: 'SUMIF', syntax: 'SUMIF(区域, 条件, 求和区域)', desc: '条件求和' },
    { name: 'AVERAGEIF', syntax: 'AVERAGEIF(区域, 条件)', desc: '条件平均' },
  ],
  '游戏专用': [
    { name: 'CLAMP', syntax: 'CLAMP(值, 最小值, 最大值)', desc: '限制范围' },
    { name: 'LERP', syntax: 'LERP(起始值, 结束值, 插值系数)', desc: '线性插值' },
    { name: 'RANDOM_RANGE', syntax: 'RANDOM_RANGE(最小值, 最大值)', desc: '随机小数' },
    { name: 'RANDOM_INT', syntax: 'RANDOM_INT(最小值, 最大值)', desc: '随机整数' },
  ],
};

// 公式自动完成提示
export function getFormulaSuggestions(partial) {
  if (!partial || partial.length < 1) return [];

  const suggestions = [];
  const upper = partial.toUpperCase();

  Object.values(SUPPORTED_FORMULAS).flat().forEach(formula => {
    if (formula.name.startsWith(upper)) {
      suggestions.push(formula);
    }
  });

  return suggestions.slice(0, 10);
}
