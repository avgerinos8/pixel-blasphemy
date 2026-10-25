// UnfakeEngine - High-Performance Intelligent Scale Detection & Processing Engine
// Combines unfake-core (Rust WASM) with zero-dependency Pure JavaScript fallback.

import {
  processImage as unfakeProcessImage,
  runsBasedDetect,
  edgeAwareDetect,
  legacyEdgeAwareDetect,
  downscaleByDominantColor,
  MAX_COLORS,
} from './vendor/unfake/lib/pixel.js';

import {
  tiledEdgeDetect,
  singleRegionEdgeDetect,
} from './vendor/unfake/lib/edge-detect.js';

import {
  findOptimalCropOffset,
  cropImageData,
  snapToGrid,
  morphologicalCleanupCvFree,
  acpeakDetect,
  boundarySignals,
  peakLag,
} from './vendor/unfake/lib/cvfree.js';

import {
  countColors,
  quantizeImage,
  alphaBinarization,
  jaggyCleaner,
  downscaleBlock,
  detectOptimalColorCount,
  getPaletteFromImage,
} from './vendor/unfake/lib/utils.js';

import {
  ensureCoreWorker,
  runCoreOp,
  CORE_DS,
} from './vendor/unfake/lib/core-client.js';

let wasmChecked = false;
let wasmAvailable = false;

// Check WASM Core status asynchronously
async function checkWasmStatus() {
  if (wasmChecked) return wasmAvailable;
  try {
    wasmAvailable = await ensureCoreWorker();
  } catch (e) {
    wasmAvailable = false;
  }
  wasmChecked = true;
  return wasmAvailable;
}

// Kick off check early
checkWasmStatus();

/**
 * Pure JS Fractional Grid Detector for resampled pixel canvases
 * e.g., 200 cells at 2048 px = 10.24 px/cell
 */
function detectFractionalGridJs(imgData) {
  const { data, width: W, height: H } = imgData;
  if (W < 32 || H < 32) return null;

  const { col, row } = boundarySignals(imgData);

  function estimateAxis(sig, len) {
    const n = sig.length;
    if (n < 32) return null;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += sig[i];
    mean /= n;

    // Autocorrelation over fine steps
    const maxPeriod = Math.min(Math.floor(len / 4), 160);
    const minPeriod = 2.1;
    const s = new Float64Array(n);
    let norm = 0;
    for (let i = 0; i < n; i++) {
      s[i] = sig[i] - mean;
      norm += s[i] * s[i];
    }
    norm = norm || 1e-9;

    let bestLag = 0;
    let maxAc = -Infinity;

    // Search with 0.1 sub-pixel resolution between 2 and maxPeriod
    for (let period = 2.5; period <= maxPeriod; period += 0.25) {
      let r = 0;
      let count = 0;
      for (let i = 0; i + period < n; i += Math.max(1, Math.round(period))) {
        const j = Math.round(i + period);
        if (j < n) {
          r += s[i] * s[j];
          count++;
        }
      }
      const ac = count > 0 ? (r / count) : 0;
      if (ac > maxAc) {
        maxAc = ac;
        bestLag = period;
      }
    }

    // Check if cell count is near a round integer of the total dimension
    if (bestLag >= 2.5) {
      const cells = len / bestLag;
      const whole = Math.round(cells);
      if (whole >= 2 && Math.abs(cells - whole) < 0.25) {
        return len / whole;
      }
      return bestLag;
    }
    return null;
  }

  const periodX = estimateAxis(col, W);
  const periodY = estimateAxis(row, H);

  if (periodX && periodY && Math.abs(periodX - periodY) / Math.max(periodX, periodY) <= 0.05) {
    const scale = (periodX + periodY) / 2;
    const cellsX = Math.round(W / scale);
    const cellsY = Math.round(H / scale);
    return {
      periodX,
      periodY,
      offsetX: 0,
      offsetY: 0,
      cellsX,
      cellsY,
      scale,
    };
  }
  return null;
}

/**
 * Intelligent Scale Detection API
 */
async function detectScale(imgData, options = {}) {
  const method = options.method || 'auto';
  const manualScale = options.manualScale;
  const isWasm = await checkWasmStatus();

  if (method === 'manual' && manualScale) {
    const scale = Math.max(1, parseFloat(manualScale) || 1);
    let grid = null;
    if (isWasm && !Number.isInteger(scale)) {
      try {
        grid = await runCoreOp('gridForScale', { image: imgData, scale });
      } catch (e) {
        grid = null;
      }
    }
    return {
      scale,
      detectedScale: scale,
      method: 'manual',
      grid,
      isFractional: !Number.isInteger(scale),
    };
  }

  if (method === 'runs') {
    const scale = runsBasedDetect(imgData);
    return {
      scale: Math.max(1, scale),
      detectedScale: scale,
      method: 'runs',
      grid: null,
      isFractional: false,
    };
  }

  if (method === 'edge_legacy') {
    const scale = await legacyEdgeAwareDetect(imgData);
    return {
      scale: Math.max(1, scale),
      detectedScale: scale,
      method: 'edge_legacy',
      grid: null,
      isFractional: false,
    };
  }

  if (method === 'edge') {
    const scale = await edgeAwareDetect(imgData);
    return {
      scale: Math.max(1, scale),
      detectedScale: scale,
      method: 'edge',
      grid: null,
      isFractional: false,
    };
  }

  // Default: 'auto'
  // 1. Try fractional grid first (covers resampled AI models e.g. 200 cells @ 2048px = 10.24px)
  let grid = null;
  if (isWasm) {
    try {
      grid = await runCoreOp('detectGrid', { image: imgData });
    } catch (e) {
      grid = null;
    }
  }

  if (grid && grid.periodX && grid.periodY) {
    const scale = (grid.periodX + grid.periodY) / 2;
    return {
      scale,
      detectedScale: scale,
      method: 'auto_grid',
      grid,
      isFractional: !Number.isInteger(scale),
    };
  }

  // 2. Try Runs-based detect (fastest, ideal for clean integer pixel art)
  const runsScale = runsBasedDetect(imgData);
  if (runsScale > 1) {
    return {
      scale: runsScale,
      detectedScale: runsScale,
      method: 'auto_runs',
      grid: null,
      isFractional: false,
    };
  }

  // 3. Fallback to Tiled Edge-aware detect
  const edgeScale = await edgeAwareDetect(imgData);
  if (edgeScale > 1) {
    return {
      scale: edgeScale,
      detectedScale: edgeScale,
      method: 'auto_edge',
      grid: null,
      isFractional: false,
    };
  }

  // 4. Pure JS fractional check fallback
  const jsGrid = detectFractionalGridJs(imgData);
  if (jsGrid && jsGrid.scale > 1) {
    return {
      scale: jsGrid.scale,
      detectedScale: jsGrid.scale,
      method: 'auto_grid_js',
      grid: jsGrid,
      isFractional: !Number.isInteger(jsGrid.scale),
    };
  }

  return {
    scale: 1,
    detectedScale: 1,
    method: 'auto_fallback',
    grid: null,
    isFractional: false,
  };
}

/**
 * Pure JS Palette Remapping with Alpha preservation
 */
function applyPaletteRemap(imgData, palette, isHardAlpha = true) {
  if (!palette || palette.length === 0) return imgData;

  const data = imgData.data;
  const numPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a <= 64) {
      if (isHardAlpha) data[i + 3] = 0;
      continue;
    }
    if (isHardAlpha) data[i + 3] = 255;

    const r = data[i], g = data[i + 1], b = data[i + 2];
    let bestDist = Infinity;
    let bestColor = palette[0];

    for (let k = 0; k < palette.length; k++) {
      const pr = palette[k][0], pg = palette[k][1], pb = palette[k][2];
      const d = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
      if (d < bestDist) {
        bestDist = d;
        bestColor = palette[k];
      }
    }

    data[i] = bestColor[0];
    data[i + 1] = bestColor[1];
    data[i + 2] = bestColor[2];
  }
  return imgData;
}

/**
 * Unified Process Pipeline for Unfake.js Mode
 */
async function process(inputImage, options = {}) {
  const t0 = performance.now();
  let imgData;

  if (inputImage instanceof ImageData) {
    imgData = inputImage;
  } else if (inputImage instanceof HTMLCanvasElement || (typeof OffscreenCanvas !== 'undefined' && inputImage instanceof OffscreenCanvas)) {
    imgData = inputImage.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, inputImage.width, inputImage.height);
  } else if (inputImage instanceof HTMLImageElement) {
    const c = document.createElement('canvas');
    c.width = inputImage.naturalWidth || inputImage.width;
    c.height = inputImage.naturalHeight || inputImage.height;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(inputImage, 0, 0);
    imgData = cx.getImageData(0, 0, c.width, c.height);
  } else {
    throw new Error('Unsupported image input type for UnfakeEngine.process');
  }

  const {
    scale = null,
    manualScale = null,
    detectMethod = 'auto',
    edgeDetectMethod = 'tiled',
    snapGrid = true,
    elasticGrid = true,
    downscaleMethod = 'dominant',
    domMeanThreshold = 0.15,
    cleanup = { morph: false, jaggy: false },
    alphaThreshold = 128,
    maxColors = 32,
    autoColorCount = false,
    fixedPalette = null,
  } = options;

  let activeScale = scale;
  let detectedGrid = null;

  // Scale detection if not provided or set to auto
  if (!activeScale || activeScale === 'auto') {
    const detection = await detectScale(imgData, {
      method: detectMethod,
      manualScale,
    });
    activeScale = detection.scale;
    detectedGrid = detection.grid;
  } else {
    activeScale = parseFloat(activeScale) || 1;
  }

  // Convert fixed palette to RGB array if passed in hex
  let paletteRgbList = null;
  if (Array.isArray(fixedPalette) && fixedPalette.length > 0) {
    paletteRgbList = fixedPalette.map(c => {
      if (Array.isArray(c)) return [c[0], c[1], c[2]];
      if (typeof c === 'string') {
        const hex = c.replace('#', '');
        return [
          parseInt(hex.substring(0, 2), 16) || 0,
          parseInt(hex.substring(2, 4), 16) || 0,
          parseInt(hex.substring(4, 6), 16) || 0,
        ];
      }
      return [c.r || 0, c.g || 0, c.b || 0];
    });
  }

  let resultImageData = null;
  let processingManifest = null;
  const isWasm = await checkWasmStatus();

  try {
    const unfakeResult = await unfakeProcessImage({
      file: imgData,
      maxColors: maxColors >= 1024 ? 1024 : Math.max(2, maxColors),
      autoColorCount,
      manualScale: activeScale,
      detectMethod: detectMethod === 'manual' ? 'auto' : detectMethod,
      edgeDetectMethod,
      downscaleMethod,
      domMeanThreshold,
      cleanup,
      fixedPalette: paletteRgbList,
      alphaThreshold,
      snapGrid,
      elasticGrid,
      useCvFreeSnap: true,
    });

    resultImageData = unfakeResult.imageData;
    processingManifest = unfakeResult.manifest;
  } catch (err) {
    console.warn('[UnfakeEngine] WASM pipeline fallback to Pure JS:', err);

    // Pure JS Fallback Pipeline
    let current = imgData;
    if (alphaThreshold !== null) {
      current = alphaBinarization(current, alphaThreshold);
    }

    if (snapGrid && activeScale > 1) {
      current = snapToGrid(current, Math.round(activeScale));
    }

    if (cleanup.morph) {
      current = morphologicalCleanupCvFree(current);
    }

    if (activeScale > 1) {
      if (downscaleMethod === 'dominant') {
        current = downscaleByDominantColor(current, Math.round(activeScale), domMeanThreshold);
      } else {
        const dsMethod = ['median', 'mode', 'mean', 'nearest'].includes(downscaleMethod)
          ? downscaleMethod
          : 'median';
        current = downscaleBlock(current, Math.round(activeScale), Math.round(activeScale), dsMethod, domMeanThreshold);
      }
    }

    if (cleanup.jaggy) {
      current = jaggyCleaner(current);
    }

    resultImageData = current;
  }

  // Ensure fixed palette clamping is exact if specified
  if (paletteRgbList && paletteRgbList.length > 0) {
    applyPaletteRemap(resultImageData, paletteRgbList, alphaThreshold !== null);
  }

  // Build output canvas
  const outCanvas = document.createElement('canvas');
  outCanvas.width = resultImageData.width;
  outCanvas.height = resultImageData.height;
  const outCtx = outCanvas.getContext('2d');
  outCtx.imageSmoothingEnabled = false;
  outCtx.putImageData(resultImageData, 0, 0);

  const finalPalette = getPaletteFromImage(resultImageData);

  return {
    imageData: resultImageData,
    canvas: outCanvas,
    scale: activeScale,
    grid: detectedGrid,
    palette: finalPalette,
    colorsUsed: countColors(resultImageData),
    processingTimeMs: Math.round(performance.now() - t0),
    isWasm,
    manifest: processingManifest,
  };
}

// Expose to window for global access
const UnfakeEngine = {
  detectScale,
  process,
  isWasmActive: () => wasmAvailable,
  checkWasmStatus,
  runsBasedDetect,
  edgeAwareDetect,
  legacyEdgeAwareDetect,
  tiledEdgeDetect,
  singleRegionEdgeDetect,
  findOptimalCropOffset,
  cropImageData,
  snapToGrid,
  downscaleByDominantColor,
  morphologicalCleanupCvFree,
  jaggyCleaner,
  alphaBinarization,
  countColors,
  MAX_COLORS,
};

if (typeof window !== 'undefined') {
  window.UnfakeEngine = UnfakeEngine;
  window.dispatchEvent(new CustomEvent('unfake-engine-ready', { detail: UnfakeEngine }));
}

export default UnfakeEngine;
export {
  UnfakeEngine,
  detectScale,
  process,
  runsBasedDetect,
  edgeAwareDetect,
  legacyEdgeAwareDetect,
  tiledEdgeDetect,
  findOptimalCropOffset,
  downscaleByDominantColor,
  morphologicalCleanupCvFree,
  jaggyCleaner,
};
