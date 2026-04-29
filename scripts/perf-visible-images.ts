import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import process from 'node:process'

type DeviceProfile = {
  name: string
  setup: string[]
}

type ScenarioResult = {
  device: string
  scenario: string
  durationMs: number
  imageCount: number
  pendingCount: number
}

const PREVIEW_PORT = 4173
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}/`
const SESSION_PREFIX = `visible-images-${Date.now()}`
const SCENARIO_TIMEOUT_MS = 45_000

const devices: DeviceProfile[] = [
  {
    name: 'desktop-chrome',
    setup: ['set viewport 1440 1000 2'],
  },
  {
    name: 'iphone-safari-emulated',
    setup: ['set device "iPhone 14"'],
  },
  {
    name: 'ipad-safari-emulated',
    setup: ['set device "iPad Pro"'],
  },
]

function run(command: string, args: string[], options: { timeoutMs?: number } = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutMs,
  })

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(' ')} failed with status ${result.status}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }

  return result.stdout.trim()
}

function runAgentBrowser(session: string, commandLine: string, options: { timeoutMs?: number } = {}) {
  return run(
    'agent-browser',
    ['--session', session, ...commandLine.match(/(?:[^\s"]+|"[^"]*")+/g)!.map((part) => part.replace(/^"|"$/g, ''))],
    options,
  )
}

function evalInBrowser<T>(session: string, script: string): T {
  const result = spawnSync('agent-browser', ['--session', session, 'eval', '--stdin'], {
    encoding: 'utf8',
    input: script,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: SCENARIO_TIMEOUT_MS,
  })

  if (result.status !== 0) {
    throw new Error(
      [`agent-browser eval failed with status ${result.status}`, result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n'),
    )
  }

  return JSON.parse(result.stdout) as T
}

async function startPreviewServer() {
  const server = spawn('bun', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const chunks: string[] = []
  server.stdout.on('data', (chunk) => chunks.push(String(chunk)))
  server.stderr.on('data', (chunk) => chunks.push(String(chunk)))

  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (chunks.join('').includes(PREVIEW_URL)) {
      return server
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  server.kill()
  await once(server, 'exit').catch(() => undefined)
  throw new Error(`Preview server did not start:\n${chunks.join('')}`)
}

const settleScript = String.raw`
async (scenario) => {
  const timeoutMs = 30000;
  const startedAt = performance.now();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForStableFrame = async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };

  const visibleImageRecords = () => {
    const records = [];
    const seen = new Set();
    for (const gridCell of document.querySelectorAll('[data-grid-id]')) {
      const img = gridCell.querySelector('img');
      if (!img) continue;
      const rect = img.getBoundingClientRect();
      const style = getComputedStyle(img);
      const visible =
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < innerHeight &&
        rect.left < innerWidth &&
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
      if (!visible) continue;
      const key = String(gridCell.getAttribute('data-grid-id')) + ':' + (img.currentSrc || img.src);
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({ img, key });
    }
    return records;
  };

  const waitForVisibleImages = async () => {
    let lastSignature = '';
    let stableRounds = 0;

    while (performance.now() - startedAt < timeoutMs) {
      await waitForStableFrame();
      const records = visibleImageRecords();
      const pending = records.filter(({ img }) => !img.complete || img.naturalWidth === 0);
      const signature = records.map(({ key }) => key).sort().join('|');

      if (records.length > 0 && pending.length === 0 && signature === lastSignature) {
        stableRounds += 1;
      } else {
        stableRounds = 0;
      }

      if (stableRounds >= 2) {
        return {
          durationMs: performance.now() - startedAt,
          imageCount: records.length,
          pendingCount: pending.length,
        };
      }

      lastSignature = signature;
      await sleep(50);
    }

    const records = visibleImageRecords();
    return {
      durationMs: timeoutMs,
      imageCount: records.length,
      pendingCount: records.filter(({ img }) => !img.complete || img.naturalWidth === 0).length,
    };
  };

  if (scenario === 'scroll') {
    scrollTo({ top: Math.round(innerHeight * 2.5), behavior: 'instant' });
  }

  if (scenario === 'sort-posted') {
    history.replaceState(null, '', '/?sort=posted');
    dispatchEvent(new PopStateEvent('popstate'));
  }

  if (scenario === 'similar-filter') {
    const firstGridCell = document.querySelector('[data-grid-id]');
    const gridId = firstGridCell?.getAttribute('data-grid-id');
    if (gridId) {
      history.replaceState(null, '', '/?similar=' + encodeURIComponent(gridId));
      dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  if (scenario === 'mode-one') {
    history.replaceState(null, '', '/?mode=one');
    dispatchEvent(new PopStateEvent('popstate'));
  }

  return waitForVisibleImages();
}
`

async function measureScenario(device: DeviceProfile, session: string, scenario: string) {
  runAgentBrowser(session, `open ${PREVIEW_URL}`, { timeoutMs: SCENARIO_TIMEOUT_MS })
  runAgentBrowser(session, 'wait --load networkidle', { timeoutMs: SCENARIO_TIMEOUT_MS })

  const result = evalInBrowser<Omit<ScenarioResult, 'device' | 'scenario'>>(
    session,
    `(${settleScript})(${JSON.stringify(scenario)})`,
  )

  return {
    device: device.name,
    scenario,
    ...result,
  }
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))
  return sorted[index] ?? 0
}

async function main() {
  run('bun', ['run', 'build'], { timeoutMs: 120_000 })
  const server = await startPreviewServer()
  const results: ScenarioResult[] = []

  try {
    for (const device of devices) {
      const session = `${SESSION_PREFIX}-${device.name}`
      try {
        runAgentBrowser(session, 'close', { timeoutMs: 10_000 })
      } catch {
        // The session usually does not exist before the first run.
      }

      for (const setupCommand of device.setup) {
        runAgentBrowser(session, setupCommand, { timeoutMs: 20_000 })
      }

      for (const scenario of ['page-load', 'scroll', 'sort-posted', 'similar-filter', 'mode-one']) {
        const result = await measureScenario(device, session, scenario)
        results.push(result)
        console.log(
          `PERF_SCENARIO device=${result.device} scenario=${result.scenario} durationMs=${result.durationMs.toFixed(1)} imageCount=${result.imageCount} pendingCount=${result.pendingCount}`,
        )
      }

      runAgentBrowser(session, 'close', { timeoutMs: 10_000 })
    }
  } finally {
    server.kill()
    await once(server, 'exit').catch(() => undefined)
    run('agent-browser', ['close', '--all'], { timeoutMs: 20_000 })
  }

  const durations = results.map((result) => result.durationMs)
  const failures = results.filter((result) => result.pendingCount > 0 || result.imageCount === 0)
  const score = durations.reduce((total, duration) => total + duration, 0) / Math.max(1, durations.length)
  const penalizedScore = score + failures.length * SCENARIO_TIMEOUT_MS

  console.log(
    `PERF_RESULT scoreMs=${penalizedScore.toFixed(1)} meanMs=${score.toFixed(1)} p95Ms=${percentile(durations, 0.95).toFixed(1)} scenarios=${results.length} failures=${failures.length}`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exit(1)
})
