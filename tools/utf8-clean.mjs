/**
 * UTF-8 编码清洗脚本
 * 1. 移除所有源文件中的 UTF-8 BOM
 * 2. 确保所有文件以 UTF-8 无 BOM 编码保存
 * 3. 检测并报告任何编码异常
 */
import fs from 'node:fs';
import path from 'node:path';

const rootDir = 'd:/codex/codex/auto-shooter-demo';
const exts = new Set(['.ts', '.js', '.mjs', '.json', '.md', '.css', '.html']);
const skipDirs = new Set(['node_modules', 'dist', '.git', 'output', 'playwright-report']);

const cleaned = [];
const errors = [];

function cleanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!exts.has(ext)) return;

  const buf = fs.readFileSync(filePath);

  // Check for BOM (EF BB BF)
  const hasBOM = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;

  if (hasBOM) {
    // Remove BOM by writing from byte 3 onwards
    const content = buf.slice(3);
    fs.writeFileSync(filePath, content);
    cleaned.push(path.relative(rootDir, filePath));
  }

  // Also verify the file is valid UTF-8 by trying to decode it
  try {
    const text = (hasBOM ? buf.slice(3) : buf).toString('utf-8');
    // Check for replacement character
    if (text.includes('\uFFFD')) {
      errors.push({
        file: path.relative(rootDir, filePath),
        issue: 'Contains U+FFFD replacement character after BOM removal'
      });
    }
  } catch (e) {
    errors.push({
      file: path.relative(rootDir, filePath),
      issue: 'Cannot decode as UTF-8: ' + e.message
    });
  }
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else {
      cleanFile(fullPath);
    }
  }
}

console.log('Starting UTF-8 encoding cleanup...');
scanDir(rootDir);

console.log('\n=== Cleanup Results ===');
console.log('BOM removed from', cleaned.length, 'file(s):');
for (const f of cleaned) {
  console.log('  ✓', f);
}

if (errors.length > 0) {
  console.log('\n=== Errors ===');
  for (const e of errors) {
    console.log('  ✗', e.file, '-', e.issue);
  }
} else {
  console.log('\nNo encoding errors detected.');
}
console.log('\nDone.');
