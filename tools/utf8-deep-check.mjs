/**
 * 深度编码检查：扫描所有源文件中的非标准字符
 * 检测 U+FFFD（替换字符）、双重编码痕迹、C1 控制字符等
 */
import fs from 'node:fs';
import path from 'node:path';

const rootDir = 'd:/codex/codex/auto-shooter-demo';
const scanDirs = ['src', 'doc'];
const skipDirs = new Set(['node_modules', 'dist', '.git', 'output', 'playwright-report']);
const issues = [];

function checkFile(filePath) {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.js') && !filePath.endsWith('.mjs') && !filePath.endsWith('.md') && !filePath.endsWith('.json')) return;

  const buf = fs.readFileSync(filePath);
  const text = buf.toString('utf-8');
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for U+FFFD (replacement character)
    if (line.includes('\uFFFD')) {
      issues.push({ file: path.relative(rootDir, filePath), line: i + 1, issue: 'U+FFFD replacement character', snippet: line.trim().substring(0, 80) });
    }

    // Check for C1 control characters (U+0080-U+009F) - sign of Latin-1 misinterpretation
    for (let j = 0; j < line.length; j++) {
      const code = line.charCodeAt(j);
      if (code >= 0x80 && code <= 0x9f) {
        issues.push({ file: path.relative(rootDir, filePath), line: i + 1, issue: `C1 control char U+${code.toString(16).toUpperCase()}`, snippet: line.trim().substring(0, 80) });
        break;
      }
    }

    // Check for zero-width characters that might cause issues
    if (line.includes('\u200B') || line.includes('\u200C') || line.includes('\u200D') || line.includes('\uFEFF')) {
      const chars = [];
      if (line.includes('\u200B')) chars.push('U+200B');
      if (line.includes('\u200C')) chars.push('U+200C');
      if (line.includes('\u200D')) chars.push('U+200D');
      if (line.includes('\uFEFF')) chars.push('U+FEFF (BOM)');
      issues.push({ file: path.relative(rootDir, filePath), line: i + 1, issue: `Zero-width/hidden chars: ${chars.join(', ')}`, snippet: line.trim().substring(0, 80) });
    }
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
      checkFile(fullPath);
    }
  }
}

for (const d of scanDirs) {
  scanDir(path.join(rootDir, d));
}

console.log('=== Deep encoding check (src/ only) ===');
console.log('Issues found:', issues.length);
for (const issue of issues) {
  console.log(`  ${issue.file}:${issue.line} - ${issue.issue}`);
  if (issue.snippet) console.log(`    "${issue.snippet}"`);
}
if (issues.length === 0) {
  console.log('  All source files are clean UTF-8 with no hidden characters.');
}
