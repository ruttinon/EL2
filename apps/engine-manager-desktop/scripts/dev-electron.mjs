import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = 5175;
const devUrl = `http://${host}:${port}`;
const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tscCli = path.join(appRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const viteCli = path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const electronBin = process.platform === 'win32'
  ? path.join(appRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(appRoot, 'node_modules', '.bin', 'electron');

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function spawnLongRunning(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...options
  });
  child.on('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  return child;
}

async function waitForDevServer(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await new Promise((resolve) => {
      const req = http.get(devUrl, (res) => {
        res.resume();
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Vite dev server did not become ready at ${devUrl}`);
}

await run(process.execPath, [tscCli, '-p', 'tsconfig.electron.json']);

const vite = spawnLongRunning(process.execPath, [viteCli, '--host', host, '--port', String(port)]);

const stopVite = () => {
  if (!vite.killed) vite.kill();
};
process.on('SIGINT', () => {
  stopVite();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stopVite();
  process.exit(143);
});

try {
  await waitForDevServer();
  const electronEnv = { ...process.env };
  delete electronEnv.ELECTRON_RUN_AS_NODE;
  await run(electronBin, ['.'], {
    env: {
      ...electronEnv,
      ENERGYLINK_NODE_BINARY: process.execPath,
      VITE_DEV_SERVER_URL: devUrl,
      NODE_ENV: 'development'
    }
  });
} finally {
  stopVite();
}
