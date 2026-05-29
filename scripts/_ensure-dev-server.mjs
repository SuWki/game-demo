import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';

const PORT = 5174;
const BASE = '/game-demo/';
const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const IS_WIN = process.platform === 'win32';

function isServerReady() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}${BASE}`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForReady(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerReady()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function killProcessTree(pid) {
  try {
    if (IS_WIN) {
      execSync(`taskkill /T /F /PID ${pid}`, { stdio: 'ignore' });
      const portPids = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const line of portPids.split('\n')) {
        const m = line.trim().match(/(\d+)\s*$/);
        if (m) execSync(`taskkill /F /PID ${m[1]}`, { stdio: 'ignore' });
      }
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {}
}

export async function ensureDevServer() {
  if (await isServerReady()) {
    console.log(`[dev-server] 已在 localhost:${PORT} 运行`);
    return () => {};
  }

  console.log(`[dev-server] 正在启动 Vite (port ${PORT})...`);
  const child = spawn('npx', ['vite', '--port', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    detached: !IS_WIN,
  });

  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});

  const ready = await waitForReady();
  if (!ready) {
    killProcessTree(child.pid);
    throw new Error(`Vite dev server 启动超时 (30s)`);
  }

  console.log(`[dev-server] 已启动`);
  return () => {
    console.log(`[dev-server] 正在关闭...`);
    killProcessTree(child.pid);
  };
}
