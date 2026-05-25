/**
 * 图表引擎
 * 支持多种数据可视化图表
 */
import { Chart, registerables } from 'chart.js';

// 注册所有图表类型
Chart.register(...registerables);

// 图表配色方案
const CHART_COLORS = {
  primary: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#f59e0b', '#10b981', '#0ea5e9'],
  pastel: ['#a5b4fc', '#c4b5fd', '#f9a8d4', '#fda4af', '#fdba74', '#fcd34d', '#6ee7b7', '#7dd3fc'],
  dark: ['#4338ca', '#6d28d9', '#be185d', '#be123c', '#c2410c', '#b45309', '#047857', '#0369a1'],
};

// 图表管理器
export class ChartManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.charts = new Map();
    this.currentChart = null;
  }

  // 创建图表
  createChart(config) {
    const { type, data, options = {}, id } = config;

    // 销毁旧图表
    if (this.charts.has(id)) {
      this.charts.get(id).destroy();
    }

    // 创建 canvas
    const canvas = document.createElement('canvas');
    canvas.id = `chart-${id}`;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type,
      data: this.processData(data, type),
      options: this.getDefaultOptions(type, options),
    });

    this.charts.set(id, chart);
    this.currentChart = chart;

    return { canvas, chart };
  }

  // 处理数据
  processData(data, type) {
    const colors = CHART_COLORS.primary;

    return {
      labels: data.labels || [],
      datasets: data.datasets.map((dataset, index) => ({
        ...dataset,
        backgroundColor: type === 'pie' || type === 'doughnut' || type === 'polarArea'
          ? colors
          : colors[index % colors.length] + (type === 'bar' ? '80' : '20'),
        borderColor: colors[index % colors.length],
        borderWidth: 2,
        pointBackgroundColor: colors[index % colors.length],
        pointBorderColor: '#fff',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: type === 'area',
      })),
    };
  }

  // 获取默认选项
  getDefaultOptions(type, customOptions = {}) {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 16,
            font: { size: 12 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
        },
      },
    };

    // 针对不同图表类型的特殊配置
    const typeOptions = {
      bar: {
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          x: {
            grid: { display: false },
          },
        },
      },
      line: {
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          x: {
            grid: { display: false },
          },
        },
        elements: {
          line: { tension: 0.4 },
        },
      },
      pie: {
        cutout: 0,
      },
      doughnut: {
        cutout: '60%',
      },
      radar: {
        scales: {
          r: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.1)' },
          },
        },
      },
      polarArea: {
        scales: {
          r: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.1)' },
          },
        },
      },
      scatter: {
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      },
    };

    return {
      ...baseOptions,
      ...(typeOptions[type] || {}),
      ...customOptions,
    };
  }

  // 从表格数据生成图表
  generateFromTable(tableData, config) {
    const { chartType, xField, yFields, aggregation = 'none' } = config;

    const labels = [];
    const datasets = [];

    // 处理 X 轴数据
    tableData.forEach((row, index) => {
      const label = xField ? row[xField] : `第${index + 1}行`;
      labels.push(label);
    });

    // 处理 Y 轴数据
    yFields.forEach(field => {
      const data = tableData.map(row => {
        const value = row[field];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return parseFloat(value) || 0;
        return 0;
      });

      datasets.push({
        label: field,
        data,
      });
    });

    // 应用聚合
    if (aggregation !== 'none') {
      return this.applyAggregation(labels, datasets, aggregation);
    }

    return { labels, datasets };
  }

  // 应用数据聚合
  applyAggregation(labels, datasets, aggregation) {
    switch (aggregation) {
      case 'sum': {
        const sums = datasets.map(ds => ({
          label: ds.label,
          data: [ds.data.reduce((a, b) => a + b, 0)],
        }));
        return { labels: ['总计'], datasets: sums };
      }
      case 'average': {
        const avgs = datasets.map(ds => ({
          label: ds.label,
          data: [ds.data.reduce((a, b) => a + b, 0) / ds.data.length],
        }));
        return { labels: ['平均值'], datasets: avgs };
      }
      case 'max': {
        const maxs = datasets.map(ds => ({
          label: ds.label,
          data: [Math.max(...ds.data)],
        }));
        return { labels: ['最大值'], datasets: maxs };
      }
      case 'min': {
        const mins = datasets.map(ds => ({
          label: ds.label,
          data: [Math.min(...ds.data)],
        }));
        return { labels: ['最小值'], datasets: mins };
      }
      default:
        return { labels, datasets };
    }
  }

  // 生成统计摘要
  generateSummary(tableData, fields) {
    const summary = {};

    fields.forEach(field => {
      const values = tableData
        .map(row => row[field])
        .filter(v => v !== null && v !== undefined && v !== '')
        .map(v => typeof v === 'number' ? v : parseFloat(v) || 0);

      if (values.length === 0) {
        summary[field] = { sum: 0, avg: 0, min: 0, max: 0, count: 0 };
        return;
      }

      const sum = values.reduce((a, b) => a + b, 0);
      summary[field] = {
        sum: sum.toFixed(2),
        avg: (sum / values.length).toFixed(2),
        min: Math.min(...values).toFixed(2),
        max: Math.max(...values).toFixed(2),
        count: values.length,
      };
    });

    return summary;
  }

  // 生成数据分布图数据
  generateDistribution(tableData, field, bins = 10) {
    const values = tableData
      .map(row => row[field])
      .filter(v => v !== null && v !== undefined && v !== '')
      .map(v => typeof v === 'number' ? v : parseFloat(v) || 0);

    if (values.length === 0) return { labels: [], datasets: [] };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const binSize = range / bins || 1;

    const labels = [];
    const data = new Array(bins).fill(0);

    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binSize;
      const binEnd = min + (i + 1) * binSize;
      labels.push(`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`);
    }

    values.forEach(v => {
      const binIndex = Math.min(Math.floor((v - min) / binSize), bins - 1);
      data[binIndex]++;
    });

    return {
      labels,
      datasets: [{
        label: `${field} 分布`,
        data,
      }],
    };
  }

  // 生成相关性矩阵数据
  generateCorrelationMatrix(tableData, fields) {
    const matrix = [];

    fields.forEach(rowField => {
      const row = [];
      fields.forEach(colField => {
        const correlation = this.calculateCorrelation(
          this.getNumericValues(tableData, rowField),
          this.getNumericValues(tableData, colField)
        );
        row.push(correlation);
      });
      matrix.push(row);
    });

    return { fields, matrix };
  }

  // 获取数值数组
  getNumericValues(tableData, field) {
    return tableData
      .map(row => row[field])
      .filter(v => v !== null && v !== undefined && v !== '')
      .map(v => typeof v === 'number' ? v : parseFloat(v) || 0);
  }

  // 计算相关系数
  calculateCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0);
    const sumX2 = x.reduce((s, xi) => s + xi * xi, 0);
    const sumY2 = y.reduce((s, yi) => s + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  // 销毁图表
  destroyChart(id) {
    if (this.charts.has(id)) {
      this.charts.get(id).destroy();
      this.charts.delete(id);
    }
  }

  // 销毁所有图表
  destroyAll() {
    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();
  }

  // 更新图表数据
  updateChart(id, newData) {
    if (this.charts.has(id)) {
      const chart = this.charts.get(id);
      chart.data = this.processData(newData, chart.config.type);
      chart.update('active');
    }
  }

  // 导出图表为图片
  exportToImage(id, format = 'png') {
    if (this.charts.has(id)) {
      const chart = this.charts.get(id);
      return chart.toBase64Image(`image/${format}`);
    }
    return null;
  }
}

// 支持的图表类型
export const CHART_TYPES = [
  { id: 'bar', name: '柱状图', icon: '📊', desc: '比较不同类别的数值' },
  { id: 'line', name: '折线图', icon: '📈', desc: '展示数据随时间的变化趋势' },
  { id: 'pie', name: '饼图', icon: '🥧', desc: '展示各部分占总体的比例' },
  { id: 'doughnut', name: '环形图', icon: '🍩', desc: '饼图的变体，中间空心' },
  { id: 'radar', name: '雷达图', icon: '🕸️', desc: '多维度数据对比' },
  { id: 'polarArea', name: '极地图', icon: '🎯', desc: '极坐标下的面积图' },
  { id: 'scatter', name: '散点图', icon: '🔵', desc: '展示两个变量之间的关系' },
  { id: 'bubble', name: '气泡图', icon: '⚪', desc: '三维数据的散点图' },
];

// 聚合选项
export const AGGREGATION_OPTIONS = [
  { id: 'none', name: '不聚合', desc: '显示原始数据' },
  { id: 'sum', name: '求和', desc: '计算总和' },
  { id: 'average', name: '平均值', desc: '计算平均数' },
  { id: 'max', name: '最大值', desc: '找出最大值' },
  { id: 'min', name: '最小值', desc: '找出最小值' },
  { id: 'count', name: '计数', desc: '统计数量' },
];

// 图表预设模板
export const CHART_PRESETS = {
  // 升级配置分析
  upgrades: {
    rarity: {
      name: '稀有度分布',
      type: 'pie',
      xField: 'rarity',
      yFields: ['selection.baseWeight'],
      aggregation: 'sum',
    },
    weight: {
      name: '权重趋势',
      type: 'line',
      xField: 'id',
      yFields: ['selection.baseWeight', 'selection.offRouteMultiplier'],
    },
    category: {
      name: '类别对比',
      type: 'bar',
      xField: 'category',
      yFields: ['selection.baseWeight'],
      aggregation: 'average',
    },
  },
  // 战斗模板分析
  battleTemplates: {
    difficulty: {
      name: '难度曲线',
      type: 'line',
      xField: 'id',
      yFields: ['enemyHp', 'enemyDamage', 'enemySpeed'],
    },
    duration: {
      name: '时长分布',
      type: 'bar',
      xField: 'name',
      yFields: ['durationSec'],
    },
    spawn: {
      name: '生成间隔分析',
      type: 'scatter',
      xField: 'spawnIntervalSec',
      yFields: ['enemyHp'],
    },
  },
  // 敌人原型分析
  enemyArchetypes: {
    multipliers: {
      name: '属性倍率对比',
      type: 'radar',
      xField: 'name',
      yFields: ['hpMultiplier', 'speedMultiplier', 'radiusMultiplier', 'contactDamageMultiplier'],
    },
    experience: {
      name: '经验倍率分布',
      type: 'bar',
      xField: 'name',
      yFields: ['experienceMultiplier'],
    },
  },
};

export default ChartManager;
