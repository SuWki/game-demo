/**
 * 渲染辅助 — 纯函数模块
 *
 * 从 GameScene.ts 中提取的颜色混合、坐标转换和 HUD 快照构建等纯辅助函数。
 * 这些函数不依赖 Phaser 场景实例。
 */

import { ARENA_WIDTH, ARENA_HEIGHT, clamp } from '../data/balance';
import type { BattleState, OverlayHudSnapshot, PlayerStats } from '../game/types';

/**
 * 线性混合两个 RGB 颜色。
 * @param base - 基础色 (0xRRGGBB)
 * @param target - 目标色 (0xRRGGBB)
 * @param amount - 混合比例 [0, 1]
 */
export function mixColor(base: number, target: number, amount: number): number {
  const ratio = clamp(amount, 0, 1);
  const baseR = (base >> 16) & 0xff;
  const baseG = (base >> 8) & 0xff;
  const baseB = base & 0xff;
  const targetR = (target >> 16) & 0xff;
  const targetG = (target >> 8) & 0xff;
  const targetB = target & 0xff;

  const mixedR = Math.round(baseR + (targetR - baseR) * ratio);
  const mixedG = Math.round(baseG + (targetG - baseG) * ratio);
  const mixedB = Math.round(baseB + (targetB - baseB) * ratio);

  return (mixedR << 16) | (mixedG << 8) | mixedB;
}

/**
 * 世界坐标转屏幕坐标。
 */
export function worldToScreen(
  camera: { left: number; top: number; right?: number; bottom?: number; width?: number; height?: number },
  x: number,
  y: number,
  fallbackScreenWidth: number,
  fallbackScreenHeight: number,
): { x: number; y: number } {
  const worldWidth =
    typeof camera.right === 'number' ? Math.max(1, camera.right - camera.left) : (camera.width ?? fallbackScreenWidth);
  const worldHeight =
    typeof camera.bottom === 'number' ? Math.max(1, camera.bottom - camera.top) : (camera.height ?? fallbackScreenHeight);
  const screenWidth = camera.width ?? fallbackScreenWidth;
  const screenHeight = camera.height ?? fallbackScreenHeight;
  return {
    x: (x - camera.left) * (screenWidth / worldWidth),
    y: (y - camera.top) * (screenHeight / worldHeight),
  };
}

/**
 * 判断一个点是否在摄像机可视范围内。
 */
export function isVisibleInCamera(
  camera: { left: number; right: number; top: number; bottom: number },
  x: number,
  y: number,
  padding = 40,
): boolean {
  return (
    x >= camera.left - padding &&
    x <= camera.right + padding &&
    y >= camera.top - padding &&
    y <= camera.bottom + padding
  );
}

/**
 * 简单的确定性伪随机噪声，用于地形贴片。
 */
export function getTerrainNoise(x: number, y: number, salt = 0): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + salt * 43.129) * 43758.5453123;
  return value - Math.floor(value);
}

/**
 * 构建面板属性摘要。
 */
export function createPanelStatSummary(stats: PlayerStats): OverlayHudSnapshot['statSummary'] {
  return [
    { label: '伤害', value: stats.damage.toFixed(0), tone: 'offense' },
    { label: '射速', value: `${Math.round(stats.fireRate * 60)}/分`, tone: 'offense' },
    { label: '弹速', value: stats.projectileSpeed.toFixed(0), tone: 'offense' },
    { label: '暴击率', value: `${Math.round(stats.critChance * 100)}%`, tone: 'offense' },
    { label: '暴伤', value: `${Math.round(stats.critMultiplier * 100)}%`, tone: 'offense' },
    { label: '穿透', value: stats.pierce.toFixed(0), tone: 'utility' },
    { label: '多重', value: stats.multishot.toFixed(0), tone: 'utility' },
    { label: '生命', value: `${Math.ceil(stats.hp)} / ${Math.round(stats.maxHp)}`, tone: 'survival' },
    { label: '移速', value: stats.moveSpeed.toFixed(0), tone: 'mobility' },
    { label: '再生', value: `${Math.round(stats.regeneration * 10)}/10秒`, tone: 'survival' },
  ];
}
