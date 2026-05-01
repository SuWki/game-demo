/**
 * SVG 透明化处理脚本
 * 移除黑色背景层和文本标签
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SVG_FILES = [
  'boss-bastion-main.svg',
  'elite-core-main.svg',
  'elite-core-crack.svg',
  'elite-escort-unit.svg',
  'player-projectile-core.svg',
  'enemy-projectile-core.svg',
  'fx-boss-bastion-fireline.svg',
];

const SOURCE_DIR = 'output/asset-preview/visual';
const TARGET_DIR = 'public/assets/preview-runtime/visual';

function processSVG(content, filename) {
  // 移除黑色背景 rect 标签（在 defs 之后，主体内容之前的全画布 rect）
  // 匹配 <rect width="100%" height="100%" ... />
  let processed = content.replace(/<rect\s+width="100%"\s+height="100%"[^>]*\/>\s*/g, '');

  // 移除文本标签（通常是标签说明，不是素材本身）
  processed = processed.replace(/<text[^>]*>[^<]*<\/text>\s*/g, '');

  // 移除空行
  processed = processed.replace(/\n\s*\n/g, '\n');

  console.log(`[${filename}] Removed background rects and text labels`);

  return processed;
}

console.log('Processing SVG files for transparent background...\n');

for (const filename of SVG_FILES) {
  try {
    const sourcePath = join(SOURCE_DIR, filename);
    const targetPath = join(TARGET_DIR, filename);

    const content = readFileSync(sourcePath, 'utf-8');
    const processed = processSVG(content, filename);

    writeFileSync(targetPath, processed);
    console.log(`✓ ${filename} -> ${targetPath}`);
  } catch (error) {
    console.error(`✗ ${filename}: ${error.message}`);
  }
}

console.log('\nSVG processing complete.');
