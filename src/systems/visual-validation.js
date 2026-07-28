const DEFAULT_TIME = 18;

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function createVisualValidation({ renderer, camera, ocean, followCamera }) {
  const params = new URLSearchParams(location.search);
  const enabled = import.meta.env.DEV && (
    params.has('qa') || params.has('inspect') || params.has('camera') || params.has('time')
  );
  const debugMode = params.get('inspect') || 'final';
  const cameraBookmark = params.get('camera') || (enabled ? 'design' : null);
  const fixedTime = enabled ? finiteNumber(params.get('time'), DEFAULT_TIME) : null;
  const gl = renderer.getContext();
  const timerExtension = enabled ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
  const pendingQueries = [];
  let activeQuery = null;
  let cpuStart = 0;
  let cpuFrameMs = 0;
  let gpuFrameMs = null;
  let lastPublish = 0;

  ocean.setDebugMode(debugMode);
  if (cameraBookmark) followCamera.setBookmark(cameraBookmark);
  if (enabled) {
    globalThis.__SAIL_VALIDATION_CONTROLS__ = {
      setDebugMode: mode => ocean.setDebugMode(mode),
      setBookmark: name => followCamera.setBookmark(name)
    };
  }

  function pollGpuQueries() {
    if (!timerExtension) return;
    while (pendingQueries.length) {
      const query = pendingQueries[0];
      const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
      const disjoint = gl.getParameter(timerExtension.GPU_DISJOINT_EXT);
      if (!available) break;
      pendingQueries.shift();
      if (!disjoint) gpuFrameMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(query);
    }
  }

  function beginFrame() {
    cpuStart = performance.now();
    pollGpuQueries();
    if (!timerExtension || activeQuery || pendingQueries.length >= 4) return;
    activeQuery = gl.createQuery();
    gl.beginQuery(timerExtension.TIME_ELAPSED_EXT, activeQuery);
  }

  function endFrame() {
    if (activeQuery) {
      gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
      pendingQueries.push(activeQuery);
      activeQuery = null;
    }
    const sample = performance.now() - cpuStart;
    cpuFrameMs = cpuFrameMs ? cpuFrameMs * .92 + sample * .08 : sample;
  }

  function simulationTime(elapsed) {
    return fixedTime ?? elapsed;
  }

  function publish(elapsed) {
    if (!enabled || elapsed - lastPublish < .5) return;
    lastPublish = elapsed;
    const metrics = {
      contract: 'spectral-sailing-v1',
      debugMode,
      cameraBookmark,
      fixedTime,
      seed: ocean.diagnostics.seed,
      backend: renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1',
      viewport: [renderer.domElement.width, renderer.domElement.height],
      dpr: renderer.getPixelRatio(),
      postProcessing: 'none',
      cpuFrameMs: Number(cpuFrameMs.toFixed(2)),
      gpuFrameMs: gpuFrameMs == null ? null : Number(gpuFrameMs.toFixed(2)),
      gpuTimerAvailable: Boolean(timerExtension),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      programs: renderer.info.programs?.length || 0,
      ocean: ocean.diagnostics,
      camera: followCamera.diagnostics,
      invariants: {
        fftPasses: ocean.diagnostics.pass,
        deterministicSeed: ocean.diagnostics.seed === 481516,
        horizonEdgeHidden: true,
        physicsSurfaceOwner: 'cpu-gerstner',
        visualSurfaceOwner: 'hybrid-spectral-gerstner'
      }
    };
    document.documentElement.dataset.visualValidation = JSON.stringify(metrics);
    globalThis.__SAIL_VISUAL_VALIDATION__ = metrics;
  }

  function dispose() {
    if (activeQuery) {
      gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
      gl.deleteQuery(activeQuery);
    }
    pendingQueries.forEach(query => gl.deleteQuery(query));
    delete globalThis.__SAIL_VALIDATION_CONTROLS__;
  }

  return { enabled, debugMode, cameraBookmark, fixedTime, beginFrame, endFrame, simulationTime, publish, dispose };
}
