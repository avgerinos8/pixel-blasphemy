// PixelForge Studio v1.3 - Tezumie Dither Engine + Outlines & Bi-directional Synced Controls

const PALETTES = {
  auto: null,
  cyberpunk16: [
    [11,14,20], [24,33,46], [38,52,69], [59,79,99], [90,115,142], [148,173,199], [255,255,255],
    [255,168,0], [255,208,0], [0,229,255], [0,136,204], [0,255,255], [255,0,85], [168,0,56],
    [34,197,94], [20,83,45]
  ],
  endesga32: [
    [190,74,47], [215,118,67], [234,212,170], [228,166,114], [184,111,80], [115,62,57], [62,39,49],
    [162,38,51], [228,59,68], [247,118,34], [254,174,52], [254,231,97], [99,199,77], [62,137,72],
    [38,92,66], [25,60,62], [18,78,137], [0,153,219], [44,232,245], [255,255,255], [192,203,220],
    [139,155,180], [90,105,136], [58,68,102], [38,43,68], [24,20,37], [255,0,68], [104,56,108],
    [181,80,136], [246,117,122], [232,183,150], [194,133,105]
  ],
  db32: [
    [0,0,0], [34,32,52], [69,40,60], [102,57,49], [143,86,59], [223,113,38], [217,160,102],
    [238,195,154], [251,242,54], [153,229,80], [106,190,48], [55,148,110], [75,105,47], [82,75,36],
    [50,60,57], [63,63,116], [48,96,130], [91,110,225], [99,155,255], [95,205,228], [203,219,252],
    [255,255,255], [155,173,183], [132,126,135], [105,106,106], [89,86,82], [118,66,138],
    [172,50,50], [217,87,99], [215,123,186], [143,151,74], [138,111,48]
  ],
  pico8: [
    [0,0,0], [29,43,83], [126,37,83], [0,135,81], [171,82,54], [95,87,79], [194,195,199], [255,241,232],
    [255,0,77], [255,163,0], [255,236,39], [0,228,54], [41,173,255], [131,118,156], [255,119,168], [255,204,170]
  ],
  gameboy: [
    [15,56,15], [48,98,48], [139,172,15], [155,188,15]
  ]
};

// State
let loadedFilename = "image.png";
let rawImageElement = null;
let currentSnappedCanvas = null;
let currentDivisor = 8;
let splitPosition = 0.5;
let zoomPercent = 100;
let showGrid = true;
let isUpdatingPreview = false;
let batchFiles = [];

// DOM Elements
const dropZone = document.getElementById('dropZone');
const dropPrompt = document.getElementById('dropPrompt');
const fileInput = document.getElementById('fileInput');
const canvasWrapper = document.getElementById('canvasWrapper');
const canvasScaler = document.getElementById('canvasScaler');
const mainCanvas = document.getElementById('mainCanvas');
const splitBar = document.getElementById('splitBar');
const ctx = mainCanvas.getContext('2d');

const viewerToolbar = document.getElementById('viewerToolbar');
const loadedFilenameEl = document.getElementById('loadedFilename');
const origDimBadge = document.getElementById('origDimBadge');
const btnCloseImage = document.getElementById('btnCloseImage');
const btnBrowseNew = document.getElementById('btnBrowseNew');
const quickLoadGroup = document.getElementById('quickLoadGroup');

// Zoom & Grid controls
const zoomSlider = document.getElementById('zoomSlider');
const zoomNumInput = document.getElementById('zoomNumInput');
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnResetZoom = document.getElementById('btnResetZoom');
const btnToggleGrid = document.getElementById('btnToggleGrid');

// Scale & Synced Fields
const scaleGroup = document.getElementById('scaleGroup');
const targetDimText = document.getElementById('targetDimText');
const outlineWeight = document.getElementById('outlineWeight');
const outlineWeightNum = document.getElementById('outlineWeightNum');
const edgeSensitivity = document.getElementById('edgeSensitivity');
const edgeSensitivityNum = document.getElementById('edgeSensitivityNum');
const colorCount = document.getElementById('colorCount');
const colorCountNum = document.getElementById('colorCountNum');
const kmeansIter = document.getElementById('kmeansIter');
const kmeansIterNum = document.getElementById('kmeansIterNum');

const autoOutlineToggle = document.getElementById('autoOutlineToggle');
const autoOutlineColor = document.getElementById('autoOutlineColor');

// Tezumie Integration DOM
const tezumieToggle = document.getElementById('tezumieToggle');
const tezumieOptions = document.getElementById('tezumieOptions');
const tezumieMethod = document.getElementById('tezumieMethod');
const tezumieStrength = document.getElementById('tezumieStrength');
const tezumieStrengthNum = document.getElementById('tezumieStrengthNum');

const paletteSelect = document.getElementById('paletteSelect');
const palettePreview = document.getElementById('palettePreview');

// Download & Stats
const btnDownload = document.getElementById('btnDownload');
const downloadNameLabel = document.getElementById('downloadNameLabel');
const origRes = document.getElementById('origRes');
const snappedRes = document.getElementById('snappedRes');
const activeColors = document.getElementById('activeColors');
const pipelineTag = document.getElementById('pipelineTag');
const statsZoom = document.getElementById('statsZoom');
const splitPercent = document.getElementById('splitPercent');

// TABS
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// BI-DIRECTIONAL SYNC HELPER (SLIDER <-> NUMBER BOX)
function syncSliderAndNum(slider, numBox, callback) {
  slider.addEventListener('input', () => {
    numBox.value = slider.value;
    callback(parseFloat(slider.value));
  });
  numBox.addEventListener('input', () => {
    let val = parseFloat(numBox.value);
    if (!isNaN(val)) {
      slider.value = val;
      callback(val);
    }
  });
  numBox.addEventListener('change', () => {
    let val = parseFloat(numBox.value);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    if (val < min) val = min;
    if (val > max) val = max;
    numBox.value = val;
    slider.value = val;
    callback(val);
  });
}

// SETUP SYNCED FIELDS
syncSliderAndNum(outlineWeight, outlineWeightNum, () => triggerPreviewDebounced());
syncSliderAndNum(edgeSensitivity, edgeSensitivityNum, () => triggerPreviewDebounced());
syncSliderAndNum(colorCount, colorCountNum, () => triggerPreviewDebounced());
syncSliderAndNum(kmeansIter, kmeansIterNum, () => triggerPreviewDebounced());
syncSliderAndNum(tezumieStrength, tezumieStrengthNum, () => triggerPreviewDebounced());

// TEZUMIE TOGGLE & METHOD
tezumieToggle.addEventListener('change', () => {
  tezumieOptions.style.display = tezumieToggle.checked ? 'block' : 'none';
  triggerPreviewDebounced();
});
tezumieMethod.addEventListener('change', () => triggerPreviewDebounced());

autoOutlineToggle.addEventListener('change', () => triggerPreviewDebounced());
autoOutlineColor.addEventListener('input', () => triggerPreviewDebounced());

// SCALE BUTTONS (/2, /4, /8, /16, 1x)
scaleGroup.querySelectorAll('.scale-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    scaleGroup.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDivisor = parseInt(btn.dataset.divisor) || 1;
    updateDimensionsUI();
    triggerPreviewDebounced();
  });
});

// PALETTE
function updatePalettePreview() {
  const p = PALETTES[paletteSelect.value];
  palettePreview.innerHTML = '';
  if (!p) {
    palettePreview.innerHTML = '<span style="color:#64748b;font-size:0.75rem;padding:2px;">Auto Dynamic K-Means</span>';
    return;
  }
  p.forEach(c => {
    const d = document.createElement('div');
    d.style.backgroundColor = `rgb(${c[0]},${c[1]},${c[2]})`;
    palettePreview.appendChild(d);
  });
}
paletteSelect.addEventListener('change', () => {
  updatePalettePreview();
  triggerPreviewDebounced();
});
updatePalettePreview();

document.getElementById('snapAlpha').addEventListener('change', () => triggerPreviewDebounced());

// ZOOM CONTROLS (SLIDER + NUM BOX SYNC)
function setZoom(val) {
  zoomPercent = Math.max(25, Math.min(800, val));
  zoomSlider.value = zoomPercent;
  zoomNumInput.value = zoomPercent;
  statsZoom.textContent = `${zoomPercent}%`;
  applyZoomToCanvas();
}

zoomSlider.addEventListener('input', () => setZoom(parseInt(zoomSlider.value) || 100));
zoomNumInput.addEventListener('input', () => setZoom(parseInt(zoomNumInput.value) || 100));
btnZoomIn.addEventListener('click', () => setZoom(zoomPercent + 25));
btnZoomOut.addEventListener('click', () => setZoom(zoomPercent - 25));
btnResetZoom.addEventListener('click', () => setZoom(100)); // 1:1 Native Scale

function applyZoomToCanvas() {
  if (!rawImageElement) return;
  const baseW = rawImageElement.naturalWidth || rawImageElement.width;
  const baseH = rawImageElement.naturalHeight || rawImageElement.height;

  const currentW = Math.round(baseW * (zoomPercent / 100));
  const currentH = Math.round(baseH * (zoomPercent / 100));

  mainCanvas.style.width = `${currentW}px`;
  mainCanvas.style.height = `${currentH}px`;

  const splitPx = Math.round(currentW * splitPosition);
  splitBar.style.left = `${splitPx}px`;
  splitBar.style.height = `${currentH}px`;
}

// GRID TOGGLE
btnToggleGrid.addEventListener('click', () => {
  showGrid = !showGrid;
  if (showGrid) {
    btnToggleGrid.classList.add('btn-grid-active');
    btnToggleGrid.innerHTML = '&#9638; GRID: ON';
  } else {
    btnToggleGrid.classList.remove('btn-grid-active');
    btnToggleGrid.innerHTML = '&#9638; GRID: OFF';
  }
  renderSplitView();
});

// FILE INPUT (TRIGGERED ONLY BY PROMPT OR LOAD BUTTON, NEVER CANVAS)
dropPrompt.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});
btnBrowseNew.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    handleFiles(e.dataTransfer.files);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFiles(e.target.files);
  }
});

function handleFiles(files) {
  if (files.length === 1) {
    loadImage(files[0]);
  } else {
    batchFiles = Array.from(files);
    updateBatchList();
    loadImage(files[0]);
  }
}

function updateBatchList() {
  const list = document.getElementById('batchList');
  const count = document.getElementById('batchCount');
  count.textContent = batchFiles.length;
  list.innerHTML = '';
  batchFiles.forEach((f, idx) => {
    const li = document.createElement('li');
    li.textContent = `${idx + 1}. ${f.name} (${Math.round(f.size/1024)} KB)`;
    list.appendChild(li);
  });
  document.getElementById('btnProcessBatch').disabled = batchFiles.length === 0;
}

// LOAD IMAGE
function loadImage(file) {
  loadedFilename = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      rawImageElement = img;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      loadedFilenameEl.textContent = loadedFilename;
      origDimBadge.textContent = `${w}x${h} px`;
      
      dropPrompt.style.display = 'none';
      viewerToolbar.style.display = 'flex';
      quickLoadGroup.style.display = 'block';
      canvasWrapper.style.display = 'flex';

      const maxDim = Math.max(w, h);
      if (maxDim >= 1024) selectDivisor(16);
      else if (maxDim >= 512) selectDivisor(8);
      else if (maxDim >= 256) selectDivisor(4);
      else selectDivisor(1);

      if (maxDim <= 128) setZoom(400);
      else if (maxDim <= 256) setZoom(200);
      else setZoom(100);

      updateDimensionsUI();
      triggerPreviewDebounced();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function selectDivisor(d) {
  currentDivisor = d;
  scaleGroup.querySelectorAll('.scale-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.divisor) === d);
  });
}

function updateDimensionsUI() {
  if (!rawImageElement) return;
  const w = rawImageElement.naturalWidth || rawImageElement.width;
  const h = rawImageElement.naturalHeight || rawImageElement.height;
  const targetW = Math.max(1, Math.round(w / currentDivisor));
  const targetH = Math.max(1, Math.round(h / currentDivisor));

  origRes.textContent = `${w}x${h}`;
  targetDimText.textContent = `${targetW} × ${targetH} px (/${currentDivisor})`;
  snappedRes.textContent = `${targetW}x${targetH}`;

  const baseName = loadedFilename.replace(/\.[^/.]+$/, "");
  const downloadName = `${baseName}_sn${targetW}.png`;
  downloadNameLabel.textContent = `(${downloadName})`;
  btnDownload.disabled = false;
}

// CLOSE / EJECT IMAGE
btnCloseImage.addEventListener('click', () => {
  rawImageElement = null;
  currentSnappedCanvas = null;

  viewerToolbar.style.display = 'none';
  quickLoadGroup.style.display = 'none';
  canvasWrapper.style.display = 'none';
  dropPrompt.style.display = 'block';

  origRes.textContent = '-';
  snappedRes.textContent = '-';
  activeColors.textContent = '-';
  targetDimText.textContent = 'Waiting for image...';
  downloadNameLabel.textContent = '';
  btnDownload.disabled = true;

  fileInput.value = '';
});

// DEBOUNCED PREVIEW TO KEEP UI ULTRA RESPONSIVE
let previewTimeout = null;
function triggerPreviewDebounced() {
  if (previewTimeout) clearTimeout(previewTimeout);
  previewTimeout = setTimeout(() => {
    updatePreviewAsync();
  }, 40);
}

// NON-DESTRUCTIVE PREVIEW PIPELINE (TEZUMIE + OUTLINE PRESERVATION + QUANTIZATION)
async function updatePreviewAsync() {
  if (!rawImageElement || isUpdatingPreview) return;
  isUpdatingPreview = true;

  try {
    const w = rawImageElement.naturalWidth || rawImageElement.width;
    const h = rawImageElement.naturalHeight || rawImageElement.height;
    const targetW = Math.max(1, Math.round(w / currentDivisor));
    const targetH = Math.max(1, Math.round(h / currentDivisor));
    
    const kColors = parseInt(colorCount.value) || 16;
    const iterations = parseInt(kmeansIter.value) || 15;
    const oWeight = parseFloat(outlineWeight.value) || 1.5;
    const selectedPalette = PALETTES[paletteSelect.value];
    const snapAlpha = document.getElementById('snapAlpha').checked;

    // Base offscreen downsample
    let offCanvas = document.createElement('canvas');
    offCanvas.width = targetW;
    offCanvas.height = targetH;
    let offCtx = offCanvas.getContext('2d');
    offCtx.imageSmoothingEnabled = false;
    offCtx.drawImage(rawImageElement, 0, 0, targetW, targetH);

    // STEP 1: TEZUMIE DITHER ENGINE (OPTIONAL PRE-PASS)
    const useTezumie = tezumieToggle.checked && window.ImageToPixel && window.ImageToPixel.pixelate;
    if (useTezumie) {
      pipelineTag.textContent = "Tezumie+PixelSnapper";
      const method = tezumieMethod.value;
      const strength = parseFloat(tezumieStrength.value) || 0.75;

      try {
        const result = await window.ImageToPixel.pixelate(offCanvas, {
          size: { width: targetW, height: targetH },
          dither: { method: method, strength: strength }
        });
        if (result && typeof result.toCanvas === 'function') {
          offCanvas = result.toCanvas(1);
          offCtx = offCanvas.getContext('2d');
        }
      } catch (err) {
        console.warn("Tezumie pass fallback to native:", err);
      }
    } else {
      pipelineTag.textContent = "PixelSnapper";
    }

    // STEP 2: PIXEL DATA & OUTLINE PRESERVATION WEIGHTING
    const imgData = offCtx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;

    // Collect pixels for K-Means with outline weighting
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 64) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        pixels.push([r, g, b]);

        // If dark/outline pixel, duplicate entry based on outlineWeight
        if (luminance < 75 && oWeight > 1.0) {
          const extraCopies = Math.round(oWeight - 1.0);
          for (let c = 0; c < extraCopies; c++) {
            pixels.push([r, g, b]);
          }
        }
      }
    }

    // STEP 3: K-MEANS COLOR QUANTIZATION
    let palette = selectedPalette;
    if (!palette && pixels.length > 0) {
      palette = runKMeans(pixels, kColors, iterations);
    }

    // STEP 4: REMAP TO PALETTE
    if (palette && palette.length > 0) {
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] <= 64) {
          if (snapAlpha) data[i + 3] = 0;
          continue;
        }
        if (snapAlpha) data[i + 3] = 255;
        const nearest = findNearestColor([data[i], data[i + 1], data[i + 2]], palette);
        data[i] = nearest[0];
        data[i + 1] = nearest[1];
        data[i + 2] = nearest[2];
      }
    }

    // STEP 5: OPTIONAL AUTO 1-PX ARCADE OUTLINE
    if (autoOutlineToggle.checked) {
      applyArcadeOutline(data, targetW, targetH, autoOutlineColor.value);
    }

    offCtx.putImageData(imgData, 0, 0);
    currentSnappedCanvas = offCanvas;

    activeColors.textContent = palette ? palette.length : 'All';
    renderSplitView();
  } finally {
    isUpdatingPreview = false;
  }
}

// 1-PIXEL ARCADE OUTLINE GENERATOR
function applyArcadeOutline(data, w, h, hexColor) {
  const outlineRGB = hexToRgb(hexColor);
  const isSolid = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const idx = (y * w + x) * 4;
    return data[idx + 3] > 64;
  };

  const toOutline = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] <= 64) {
        // Transparent pixel adjacent to solid pixel -> become outline!
        if (isSolid(x + 1, y) || isSolid(x - 1, y) || isSolid(x, y + 1) || isSolid(x, y - 1)) {
          toOutline.push(idx);
        }
      }
    }
  }

  toOutline.forEach(idx => {
    data[idx] = outlineRGB[0];
    data[idx + 1] = outlineRGB[1];
    data[idx + 2] = outlineRGB[2];
    data[idx + 3] = 255;
  });
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16) || 0,
    parseInt(clean.substring(2, 4), 16) || 0,
    parseInt(clean.substring(4, 6), 16) || 0
  ];
}

function runKMeans(pixels, k, iterations) {
  const actualK = Math.min(k, pixels.length);
  const centroids = [];
  for (let i = 0; i < actualK; i++) {
    centroids.push(pixels[Math.floor(Math.random() * pixels.length)].slice());
  }

  for (let it = 0; it < iterations; it++) {
    const clusters = Array.from({ length: actualK }, () => []);
    for (let i = 0; i < pixels.length; i++) {
      let bestDist = Infinity;
      let bestIdx = 0;
      for (let c = 0; c < actualK; c++) {
        const d = colorDistSq(pixels[i], centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c;
        }
      }
      clusters[bestIdx].push(pixels[i]);
    }

    for (let c = 0; c < actualK; c++) {
      if (clusters[c].length > 0) {
        let r = 0, g = 0, b = 0;
        for (let p = 0; p < clusters[c].length; p++) {
          r += clusters[c][p][0];
          g += clusters[c][p][1];
          b += clusters[c][p][2];
        }
        centroids[c] = [
          Math.round(r / clusters[c].length),
          Math.round(g / clusters[c].length),
          Math.round(b / clusters[c].length)
        ];
      }
    }
  }
  return centroids;
}

function findNearestColor(c, palette) {
  let bestDist = Infinity;
  let best = palette[0];
  for (let i = 0; i < palette.length; i++) {
    const d = colorDistSq(c, palette[i]);
    if (d < bestDist) {
      bestDist = d;
      best = palette[i];
    }
  }
  return best;
}

function colorDistSq(c1, c2) {
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return dr * dr + dg * dg + db * db;
}

// RENDER SPLIT COMPARISON VIEW
function renderSplitView() {
  if (!rawImageElement || !currentSnappedCanvas) return;

  const w = rawImageElement.naturalWidth || rawImageElement.width;
  const h = rawImageElement.naturalHeight || rawImageElement.height;

  mainCanvas.width = w;
  mainCanvas.height = h;

  applyZoomToCanvas();

  const splitX = Math.round(w * splitPosition);
  splitPercent.textContent = `${Math.round(splitPosition * 100)}%`;

  ctx.clearRect(0, 0, w, h);

  // Left Side: Original Image
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, splitX, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(rawImageElement, 0, 0, w, h);
  ctx.restore();

  // Right Side: Snapped scaled up with nearest neighbor
  ctx.save();
  ctx.beginPath();
  ctx.rect(splitX, 0, w - splitX, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(currentSnappedCanvas, 0, 0, w, h);

  // Pixel Grid Lines (on snapped side)
  if (showGrid) {
    const targetW = currentSnappedCanvas.width;
    const targetH = currentSnappedCanvas.height;
    const stepX = w / targetW;
    const stepY = h / targetH;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = Math.max(1, w / 512);
    for (let x = splitX; x < w; x += stepX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += stepY) {
      ctx.beginPath();
      ctx.moveTo(splitX, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// SPLIT BAR DRAGGING (INTERACTIVE & ZOOM AWARE)
let isDraggingSplit = false;
canvasScaler.addEventListener('mousedown', (e) => {
  isDraggingSplit = true;
  updateSplitFromMouse(e);
});

window.addEventListener('mousemove', (e) => {
  if (isDraggingSplit) {
    updateSplitFromMouse(e);
  }
});

window.addEventListener('mouseup', () => {
  isDraggingSplit = false;
});

function updateSplitFromMouse(e) {
  const rect = mainCanvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  splitPosition = x / rect.width;
  renderSplitView();
}

// DOWNLOAD FINAL ASSET: [filename]_sn[sizeX].png
btnDownload.addEventListener('click', () => {
  if (!currentSnappedCanvas || !rawImageElement) return;

  const targetW = currentSnappedCanvas.width;
  const baseName = loadedFilename.replace(/\.[^/.]+$/, "");
  const finalFilename = `${baseName}_sn${targetW}.png`;

  const link = document.createElement('a');
  link.download = finalFilename;
  link.href = currentSnappedCanvas.toDataURL('image/png');
  link.click();
});

// COPY PROMPT HELPER
function copyCardPrompt(btn) {
  const text = btn.parentElement.querySelector('.prompt-text').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'COPIED TO CLIPBOARD!';
    btn.style.backgroundColor = 'var(--accent-green)';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.backgroundColor = 'var(--accent-cyan)';
    }, 1500);
  });
}
