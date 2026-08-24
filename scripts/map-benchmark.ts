import { mkdirSync, rmSync } from 'node:fs';

type CdpResult = Record<string, unknown>;

type BenchmarkResult = {
  viewport: { width: number; height: number };
  zoomSquares: number;
  overlays: boolean;
  base: string;
  fallback: boolean;
  returnedBytes: number;
  featureCount: number;
  labelCount: number;
  svgNodeCount: number;
  tileCount: number;
  settleMs: number;
  frameIntervals: number[];
  frameP95Ms: number;
  frameP95WithinBudget: boolean;
  longFramesOver33Ms: number;
  longFramesOver100Ms: number;
  longTasksOver100Ms: number[];
  budgetFailures: string[];
  fogEnabled: boolean;
  annotationCount: number;
  vehicleVisible: boolean;
  routeVisible: boolean;
  destinationVisible: boolean;
  interactions: {
    anchorPreserved: boolean;
    panApplied: boolean;
    recentered: boolean;
  };
  screenshotPath?: string;
};

const FRAME_CLOCK_TOLERANCE_MS = 0.2;

class CdpClient {
  private readonly socket: WebSocket;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: CdpResult) => void; reject: (reason: unknown) => void }>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: CdpResult; error?: unknown };
      if (message.id === undefined) return;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(message.error);
      else request.resolve(message.result ?? {});
    });
  }

  static connect(url: string): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener('open', () => resolve(new CdpClient(socket)), { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
  }

  send<T extends CdpResult = CdpResult>(method: string, params: CdpResult = {}, sessionId?: string): Promise<T> {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise<T>((resolve, reject) => this.pending.set(id, { resolve: resolve as (value: CdpResult) => void, reject }));
  }

  close(): void {
    this.socket.close();
  }
}

async function waitFor<T>(get: () => Promise<T | null>, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await get();
    if (value !== null) return value;
    await Bun.sleep(100);
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function cdpJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`CDP endpoint returned ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]!;
}

async function evaluate<T>(client: CdpClient, sessionId: string, expression: string, awaitPromise = false): Promise<T> {
  const result = await client.send<{ result: { value?: T; description?: string } }>('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  }, sessionId);
  const value = result.result.value;
  if (value === undefined && result.result.description) throw new Error(result.result.description);
  return value as T;
}

async function waitForPage(client: CdpClient, sessionId: string): Promise<void> {
  await waitFor(async () => {
    const ready = await evaluate<string>(client, sessionId, 'document.readyState');
    return ready === 'complete' ? true : null;
  }, 15000);
  await Bun.sleep(1000);
}

async function setViewport(client: CdpClient, sessionId: string, width: number, height: number): Promise<void> {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
}

async function navigate(client: CdpClient, sessionId: string, url: string): Promise<void> {
  await client.send('Page.navigate', { url }, sessionId);
  await waitForPage(client, sessionId);
}

async function setOverlays(client: CdpClient, sessionId: string, enabled: boolean): Promise<void> {
  await evaluate(client, sessionId, `localStorage.setItem('pz-dashboard.fogOfWar', '${enabled ? 'true' : 'false'}'); location.reload()`);
  await waitForPage(client, sessionId);
}

async function driveZoom(client: CdpClient, sessionId: string, target: number): Promise<void> {
  await evaluate(client, sessionId, `(() => {
    const root = document.querySelector('[data-map-root]');
    if (!root) return false;
    const current = Number(root.getAttribute('data-map-zoom-squares'));
    const deltaY = Math.log(${target} / current) / 0.0015;
    root.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: innerWidth / 2,
      clientY: innerHeight / 2,
      deltaY,
    }));
    return true;
  })()`);
  await waitFor(async () => {
    const state = await evaluate<{ zoom: number; loading: string } | null>(client, sessionId, `(() => {
      const root = document.querySelector('[data-map-root]');
      if (!root) return null;
      return {
        zoom: Number(root.getAttribute('data-map-zoom-squares')),
        loading: root.getAttribute('data-map-loading') ?? 'true',
      };
    })()`);
    return state && Math.abs(Math.log(state.zoom / target)) < 0.01 && state.loading === 'false' ? state : null;
  }, 10000);
}

async function frameSample(client: CdpClient, sessionId: string): Promise<number[]> {
  return evaluate<number[]>(client, sessionId, `new Promise((resolve) => {
    const intervals = [];
    let previous = 0;
    const end = performance.now() + 2000;
    function frame(now) {
      if (previous) intervals.push(now - previous);
      previous = now;
      if (now >= end) resolve(intervals);
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })`, true);
}

async function pageMetrics(client: CdpClient, sessionId: string, longTaskBaseline: number): Promise<{
  base: string;
  fallback: boolean;
  returnedBytes: number;
  featureCount: number;
  labelCount: number;
  svgNodeCount: number;
  tileCount: number;
  fogEnabled: boolean;
  annotationCount: number;
  vehicleVisible: boolean;
  routeVisible: boolean;
  destinationVisible: boolean;
  longTasksOver100Ms: number[];
}> {
  return evaluate(client, sessionId, `(() => {
    const root = document.querySelector('[data-map-root]');
    const resources = performance.getEntriesByType('resource');
    const returnedBytes = resources
      .filter((entry) => entry.name.includes('/api/map/'))
      .reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0), 0);
    return {
      base: root?.getAttribute('data-map-base') ?? 'unknown',
      fallback: root?.getAttribute('data-map-fallback') === 'true',
      returnedBytes,
      featureCount: Number(root?.getAttribute('data-map-feature-count') ?? 0),
      labelCount: Number(root?.getAttribute('data-map-label-count') ?? 0),
      svgNodeCount: root?.querySelector('svg')?.querySelectorAll('*').length ?? 0,
      tileCount: Number(root?.getAttribute('data-map-tile-count') ?? 0),
      fogEnabled: root?.getAttribute('data-map-fog') === 'true',
      annotationCount: Number(root?.getAttribute('data-map-annotation-count') ?? 0),
      vehicleVisible: root?.getAttribute('data-map-vehicle') === 'true',
      routeVisible: root?.getAttribute('data-map-route') === 'true',
      destinationVisible: root?.getAttribute('data-map-destination') === 'true',
      longTasksOver100Ms: performance.getEntriesByType('longtask').slice(${longTaskBaseline}).map((entry) => entry.duration).filter((duration) => duration > 100),
    };
  })()`);
}

async function captureScreenshot(client: CdpClient, sessionId: string, viewport: { width: number; height: number }, zoomSquares: number, overlays: boolean): Promise<string | undefined> {
  const directory = process.env.MAP_BENCHMARK_SCREENSHOT_DIR;
  if (!directory) return undefined;
  mkdirSync(directory, { recursive: true });
  const path = `${directory}/${viewport.width}x${viewport.height}-${zoomSquares}-${overlays ? 'overlays' : 'base'}.png`;
  const capture = await client.send<{ data: string }>('Page.captureScreenshot', { format: 'png' }, sessionId);
  await Bun.write(path, Buffer.from(capture.data, 'base64'));
  return path;
}

async function interactionCheck(client: CdpClient, sessionId: string): Promise<{ anchorPreserved: boolean; panApplied: boolean; recentered: boolean }> {
  return evaluate(client, sessionId, `new Promise((resolve) => {
    const root = document.querySelector('[data-map-root]');
    const svg = root?.querySelector('svg');
    if (!root || !svg) {
      resolve({ anchorPreserved: false, panApplied: false, recentered: false });
      return;
    }
    const rect = root.getBoundingClientRect();
    const anchorX = rect.left + rect.width * 0.23;
    const anchorY = rect.top + rect.height * 0.67;
    const worldAt = () => {
      const viewBox = svg.viewBox.baseVal;
      const span = Math.max(rect.width, rect.height);
      return {
        x: viewBox.x + viewBox.width / 2 + (anchorX - rect.left - rect.width / 2) * (viewBox.width / span),
        y: viewBox.y + viewBox.height / 2 + (anchorY - rect.top - rect.height / 2) * (viewBox.height / span),
      };
    };
    const before = worldAt();
    const currentZoom = Number(root.getAttribute('data-map-zoom-squares'));
    const factor = currentZoom > 40 ? 0.8 : 1.25;
    root.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: anchorX, clientY: anchorY, deltaY: Math.log(factor) / 0.0015 }));
    setTimeout(() => {
      const after = worldAt();
      const anchorPreserved = Math.hypot(before.x - after.x, before.y - after.y) < 5;
      const startX = rect.left + rect.width * 0.5;
      const startY = rect.top + rect.height * 0.5;
      root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 101, pointerType: 'mouse', clientX: startX, clientY: startY }));
      root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 101, pointerType: 'mouse', clientX: startX + 40, clientY: startY + 20 }));
      root.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 101, pointerType: 'mouse', clientX: startX + 40, clientY: startY + 20 }));
      setTimeout(() => {
        const panApplied = Boolean(root.querySelector('button[aria-label="Recenter on player"]'));
        root.querySelector('button[aria-label="Recenter on player"]')?.click();
        setTimeout(() => resolve({ anchorPreserved, panApplied, recentered: !root.querySelector('button[aria-label="Recenter on player"]') }), 50);
      }, 50);
    }, 50);
  })`, true);
}

async function runCase(client: CdpClient, sessionId: string, viewport: { width: number; height: number }, zoomSquares: number, overlays: boolean, url: string): Promise<BenchmarkResult> {
  await setViewport(client, sessionId, viewport.width, viewport.height);
  await navigate(client, sessionId, url);
  await setOverlays(client, sessionId, overlays);
  await evaluate(client, sessionId, 'performance.clearResourceTimings()');
  const longTaskBaseline = await evaluate<number>(client, sessionId, 'performance.getEntriesByType("longtask").length');
  const started = Date.now();
  await driveZoom(client, sessionId, zoomSquares);
  const settleMs = Date.now() - started;
  const frameIntervals = await frameSample(client, sessionId);
  const metrics = await pageMetrics(client, sessionId, longTaskBaseline);
  const screenshotPath = await captureScreenshot(client, sessionId, viewport, zoomSquares, overlays);
  const interactions = await interactionCheck(client, sessionId);
  const budgetFailures: string[] = [];
  const frameP95Ms = percentile(frameIntervals, 0.95);
  const frameP95WithinBudget = frameP95Ms <= 16.7 + FRAME_CLOCK_TOLERANCE_MS;
  if (zoomSquares >= 5120 && settleMs > 1000) budgetFailures.push('settle time > 1000ms');
  if (zoomSquares === 12000 && settleMs > 1500) budgetFailures.push('maximum settle time > 1500ms');
  if (zoomSquares === 12000 && !frameP95WithinBudget) budgetFailures.push('frame p95 > 16.7ms');
  if (frameIntervals.some((interval) => interval > 33)) budgetFailures.push('frame interval > 33ms');
  if (zoomSquares >= 5120 && metrics.longTasksOver100Ms.length) budgetFailures.push('long task > 100ms');
  return {
    viewport,
    zoomSquares,
    overlays,
    ...metrics,
    settleMs,
    frameIntervals,
    frameP95Ms,
    frameP95WithinBudget,
    longFramesOver33Ms: frameIntervals.filter((interval) => interval > 33).length,
    longFramesOver100Ms: frameIntervals.filter((interval) => interval > 100).length,
    budgetFailures,
    interactions,
    ...(screenshotPath ? { screenshotPath } : {}),
  };
}

async function main(): Promise<void> {
  const url = process.env.MAP_BENCHMARK_URL ?? 'http://localhost:3000/';
  const port = Number(process.env.MAP_BENCHMARK_CDP_PORT ?? 9229);
  const executable = process.env.CHROMIUM ?? 'chromium';
  const userDataDir = `/tmp/pz-dashboard-map-benchmark-${Date.now()}`;
  mkdirSync(userDataDir, { recursive: true });
  let browser: ReturnType<typeof Bun.spawn> | undefined;
  let browserClient: CdpClient | undefined;
  let targetClient: CdpClient | undefined;

  try {
    if (!process.env.MAP_BENCHMARK_CDP_URL) {
      browser = Bun.spawn([executable, '--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, 'about:blank'], { stdout: 'ignore', stderr: 'ignore' });
    }
    const version = await waitFor(async () => {
      try {
        return await cdpJson(process.env.MAP_BENCHMARK_CDP_URL ?? `http://127.0.0.1:${port}/json/version`);
      } catch {
        return null;
      }
    }, 15000);
    browserClient = await CdpClient.connect(String(version.webSocketDebuggerUrl));
    const target = await browserClient.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
    const attached = await browserClient.send<{ sessionId: string }>('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    targetClient = browserClient;
    const sessionId = attached.sessionId;
    await targetClient.send('Page.enable', {}, sessionId);
    await targetClient.send('Runtime.enable', {}, sessionId);
    await targetClient.send('Network.enable', {}, sessionId);
    if (process.env.MAP_BENCHMARK_BLOCK_TILES === '1') {
      await targetClient.send('Network.setBlockedURLs', { urls: ['*/api/map/*/*/*/*'] }, sessionId);
    }

    const results: BenchmarkResult[] = [];
    for (const viewport of [{ width: 1620, height: 1080 }, { width: 390, height: 844 }]) {
      for (const overlays of [true, false]) {
        for (const zoomSquares of [1280, 2560, 5120, 12000]) {
          results.push(await runCase(targetClient, sessionId, viewport, zoomSquares, overlays, url));
        }
      }
    }

    const output = JSON.stringify({ generatedAt: new Date().toISOString(), url, results }, null, 2);
    const outputPath = process.env.MAP_BENCHMARK_OUTPUT;
    if (outputPath) await Bun.write(outputPath, output);
    if (process.env.MAP_BENCHMARK_QUIET !== '1') console.log(output);
  } finally {
    targetClient?.close();
    if (browserClient && targetClient !== browserClient) browserClient.close();
    browser?.kill();
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

await main();
