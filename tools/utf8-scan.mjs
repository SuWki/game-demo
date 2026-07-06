/**
 * UTF-8 编码清洗扫描脚本
 * 扫描项目中所有 .ts / .js / .mjs / .json / .md / .css / .html 文件，
 * 检测 BOM、非 UTF-8 编码、乱码字符（替换字符 U+FFFD、双重编码痕迹等）。
 */
import fs from 'node:fs';
import path from 'node:path';

const rootDir = 'd:/codex/codex/auto-shooter-demo';
const exts = new Set(['.ts', '.js', '.mjs', '.json', '.md', '.css', '.html']);
const skipDirs = new Set(['node_modules', 'dist', '.git', 'output', 'playwright-report']);

const issues = [];

function scanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!exts.has(ext)) return;

  const buf = fs.readFileSync(filePath);

  // Check for BOM
  const hasBOM = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;

  // Try to decode as UTF-8
  let text;
  try {
    text = buf.toString('utf-8');
  } catch (e) {
    issues.push({ file: filePath, issue: 'Cannot decode as UTF-8', detail: e.message });
    return;
  }

  // Check for replacement character (U+FFFD) - sign of encoding issues
  const replacementChar = '\uFFFD';
  if (text.includes(replacementChar)) {
    const count = (text.match(/\uFFFD/g) || []).length;
    // Find line numbers
    const lines = text.split('\n');
    const lineNumbers = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(replacementChar)) {
        lineNumbers.push(i + 1);
      }
    }
    issues.push({
      file: filePath,
      issue: `Contains ${count} replacement character(s) (U+FFFD)`,
      detail: `Lines: ${lineNumbers.slice(0, 10).join(', ')}${lineNumbers.length > 10 ? '...' : ''}`
    });
  }

  // Check for common mojibake patterns (UTF-8 interpreted as Latin-1/GBK)
  // Common Chinese mojibake: 锛 (instead of 、), 鈥 (instead of —), 鈩 etc.
  const mojibakePatterns = [
    { pattern: /锛/g, desc: 'Possible mojibake 锛 (should be 、)' },
    { pattern: /鈥/g, desc: 'Possible mojibake 鈥 (should be — or "")' },
    { pattern: /鈩/g, desc: 'Possible mojibake 鈩' },
    { pattern: /锛/g, desc: 'Possible mojibake 锛' },
    { pattern: /銆/g, desc: 'Possible mojibake 銆' },
    { pattern: /闂/g, desc: 'Possible mojibake 闂' },
    { pattern: /鐢/g, desc: 'Possible mojibake 鐢' },
    { pattern: /鐨/g, desc: 'Possible mojibake 鐨' },
    { pattern: /鐎/g, desc: 'Possible mojibake 鐎' },
    { pattern: /鐤/g, desc: 'Possible mojibake 鐤' },
  ];

  for (const { pattern, desc } of mojibakePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 2) {
      // Only flag if there are multiple occurrences (to avoid false positives)
      issues.push({
        file: filePath,
        issue: `${desc} (${matches.length} occurrences)`,
        detail: ''
      });
    }
  }

  // Check for non-UTF-8 bytes (high bytes that don't form valid UTF-8 sequences)
  let invalidBytes = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] > 0x7f) {
      // Check if it's a valid UTF-8 sequence
      if ((buf[i] & 0xe0) === 0xc0) {
        // 2-byte sequence
        if (i + 1 < buf.length && (buf[i + 1] & 0xc0) === 0x80) {
          i += 1;
        } else {
          invalidBytes++;
        }
      } else if ((buf[i] & 0xf0) === 0xe0) {
        // 3-byte sequence
        if (i + 2 < buf.length && (buf[i + 1] & 0xc0) === 0x80 && (buf[i + 2] & 0xc0) === 0x80) {
          i += 2;
        } else {
          invalidBytes++;
        }
      } else if ((buf[i] & 0xf8) === 0xf0) {
        // 4-byte sequence
        if (i + 3 < buf.length && (buf[i + 1] & 0xc0) === 0x80 && (buf[i + 2] & 0xc0) === 0x80 && (buf[i + 3] & 0xc0) === 0x80) {
          i += 3;
        } else {
          invalidBytes++;
        }
      } else {
        invalidBytes++;
      }
    }
  }

  if (invalidBytes > 0) {
    issues.push({
      file: filePath,
      issue: `${invalidBytes} invalid UTF-8 byte(s)`,
      detail: 'File may have mixed encoding'
    });
  }

  if (hasBOM) {
    issues.push({
      file: filePath,
      issue: 'Has UTF-8 BOM',
      detail: 'BOM can cause issues with some tools'
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
      scanFile(fullPath);
    }
  }
}

console.log('Scanning for encoding issues...');
scanDir(rootDir);

console.log('\n=== Scan Results ===');
console.log('Total issues found:', issues.length);

// Group by issue type
const byType = {};
for (const issue of issues) {
  const type = issue.issue.split('(')[0].trim();
  if (!byType[type]) byType[type] = [];
  byType[type].push(issue);
}

for (const [type, files] of Object.entries(byType)) {
  console.log(`\n--- ${type} (${files.length} files) ---`);
  for (const f of files.slice(0, 20)) {
    const relPath = path.relative(rootDir, f.file);
    console.log(`  ${relPath}`);
    if (f.detail) console.log(`    ${f.detail}`);
  }
  if (files.length > 20) {
    console.log(`  ... and ${files.length - 20} more`);
  }
}
