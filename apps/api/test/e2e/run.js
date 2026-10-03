#!/usr/bin/env node
// Runs the end-to-end suites against a throwaway API process.
//
//   pnpm --filter @hrms/api test:e2e                 # all suites
//   pnpm --filter @hrms/api test:e2e -- timesheets   # suites whose name matches
//
// Needs a built API (dist/) and the dev database. The API under test listens on
// E2E_PORT (default 4001) with console email and reminders off, so no real
// emails go out. Each suite creates its own company and removes it afterwards.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const port = process.env.E2E_PORT ?? '4001';
const main = path.join(root, 'dist', 'apps', 'api', 'src', 'main.js');
const filters = process.argv.slice(2).filter((a) => a !== '--');

const suites = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith('.e2e.js'))
  .filter((f) => !filters.length || filters.some((x) => f.includes(x)))
  .sort();

async function healthy(timeoutMs) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(`http://localhost:${port}/health`);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function run(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, NODE_PATH: path.join(root, 'node_modules'), E2E_API: `http://localhost:${port}/api/v1` },
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

(async () => {
  if (!suites.length) {
    console.error(`No suites match: ${filters.join(', ')}`);
    process.exit(1);
  }
  if (!fs.existsSync(main)) {
    console.error('No build found — run `pnpm --filter @hrms/api build` first.');
    process.exit(1);
  }
  const api = spawn(process.execPath, [main], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, API_PORT: port, PORT: port, EMAIL_PROVIDER: 'console', REMINDERS_ENABLED: 'false' },
  });
  let stderr = '';
  api.stderr.on('data', (d) => (stderr += d));
  const stop = () => api.exitCode === null && api.kill();
  process.on('SIGINT', () => {
    stop();
    process.exit(130);
  });

  if (!(await healthy(60_000))) {
    stop();
    console.error(`The test API didn’t start on :${port}.\n${stderr.slice(-2000)}`);
    process.exit(1);
  }

  // Emails the console provider writes during the run are removed afterwards
  const mailDir = path.join(root, '.mail');
  const mailBefore = new Set(fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []);

  const failed = [];
  for (const s of suites) {
    console.log(`\n━━━ ${s} ━━━`);
    if ((await run(s)) !== 0) failed.push(s);
  }
  stop();
  for (const f of fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []) if (!mailBefore.has(f)) fs.rmSync(path.join(mailDir, f));
  console.log(`\n${suites.length - failed.length}/${suites.length} suites passed${failed.length ? ` — failed: ${failed.join(', ')}` : ''}`);
  process.exit(failed.length ? 1 : 0);
})();
