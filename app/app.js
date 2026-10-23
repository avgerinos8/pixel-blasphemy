// PixelBlasphemy Studio v1.5 - Pro AI Pixel Art & Snapper Pipeline

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

const DEFAULTS = {
  divisor: 1,
  outlineWeight: 1.5,
  edgeSensitivity: 0.5,
  autoOutline: false,
  autoOutlineColor: '#000000',
  snapAlpha: true,
  tezumieEnabled: false,
  tezumieMethod: 'floyd-steinberg',
  tezumieStrength: 0.75,
  pass2Enabled: false,
  colorCount: 16,
  kmeansIter: 15,
  palette: 'auto',
  zoom: 100,
  grid: false
};

// Global State
let loadedFilename = "image.png";
let rawImageElement = null;
let currentSnappedCanvas = null;
let currentActivePalette = null;
let rawOffCanvas = document.createElement('canvas');
let rawOffCtx = rawOffCanvas.getContext('2d', { willReadFrequently: true });
let currentDivisor = 1;
let splitPosition = 0.5;
let zoomPercent = 100;
let showGrid = false;
let batchFiles = [];

// Concurrency & Session Management
let previewSessionId = 0;
let isUpdatingPreview = false;
let needsAnotherUpdate = false;
let previewTimeout = null;

// Reference Palette State
let paletteRefPixels = null;
let paletteRefName = "";

// DOM Elements
const dropZone = document.getElementById('dropZone');
const dropPrompt = document.getElementById('dropPrompt');
const fileInput = document.getElementById('fileInput');
const paletteFileInput = document.getElementById('paletteFileInput');
const canvasWrapper = document.getElementById('canvasWrapper');
const viewportScroller = document.getElementById('viewportScroller');
const canvasScaler = document.getElementById('canvasScaler');
const mainCanvas = document.getElementById('mainCanvas');
const splitBar = document.getElementById('splitBar');
const ctx = mainCanvas.getContext('2d');

const btnOpenMainImage = document.getElementById('btnOpenMainImage');
const btnOpenPaletteImage = document.getElementById('btnOpenPaletteImage');
const btnResetAll = document.getElementById('btnResetAll');

const viewerToolbar = document.getElementById('viewerToolbar');
const loadedFilenameEl = document.getElementById('loadedFilename');
const origDimBadge = document.getElementById('origDimBadge');
const btnCloseImage = document.getElementById('btnCloseImage');

// Zoom & Grid controls
const zoomSlider = document.getElementById('zoomSlider');
const zoomNumInput = document.getElementById('zoomNumInput');
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const btnFitZoom = document.getElementById('btnFitZoom');
const btnResetZoom = document.getElementById('btnResetZoom');
const btnToggleGrid = document.getElementById('btnToggleGrid');

// Scale & Synced Controls
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
const snapAlpha = document.getElementById('snapAlpha');

// Tezumie Integration DOM
const tezumieToggle = document.getElementById('tezumieToggle');
const tezumieOptions = document.getElementById('tezumieOptions');
const tezumieMethod = document.getElementById('tezumieMethod');
const tezumieStrength = document.getElementById('tezumieStrength');
const tezumieStrengthNum = document.getElementById('tezumieStrengthNum');
const pass2Toggle = document.getElementById('pass2Toggle');

// Palette DOM
const paletteSelect = document.getElementById('paletteSelect');
const palettePreview = document.getElementById('palettePreview');
const btnStartEyedropper = document.getElementById('btnStartEyedropper');
const eyedropperHud = document.getElementById('eyedropperHud');
const eyedropperHint = document.getElementById('eyedropperHint');
const btnEyedropperClear = document.getElementById('btnEyedropperClear');
const btnEyedropperCancel = document.getElementById('btnEyedropperCancel');
const eyedropperSwatches = document.getElementById('eyedropperSwatches');
const btnFinishPalette = document.getElementById('btnFinishPalette');
const eyedropperLoupe = document.getElementById('eyedropperLoupe');
const loupeColor = document.getElementById('loupeColor');
const loupeHex = document.getElementById('loupeHex');
let isEyedropperActive = false;
let pickedEyedropperColors = [];
const paletteRefBadge = document.getElementById('paletteRefBadge');
const paletteRefThumb = document.getElementById('paletteRefThumb');
const paletteRefNameEl = document.getElementById('paletteRefName');
const btnClearPaletteRef = document.getElementById('btnClearPaletteRef');

// Download & Stats
const btnDownload = document.getElementById('btnDownload');
const downloadNameLabel = document.getElementById('downloadNameLabel');
const origRes = document.getElementById('origRes');
const snappedRes = document.getElementById('snappedRes');
const activeColors = document.getElementById('activeColors');
const pipelineTag = document.getElementById('pipelineTag');
const statsZoom = document.getElementById('statsZoom');
const splitPercent = document.getElementById('splitPercent');

// TABS NAVIGATION
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

// SETUP SYNCED CONTROLS
syncSliderAndNum(outlineWeight, outlineWeightNum, () => triggerPreviewDebounced());
syncSliderAndNum(edgeSensitivity, edgeSensitivityNum, () => triggerPreviewDebounced());
syncSliderAndNum(colorCount, colorCountNum, () => {
  updatePalettePreview();
  triggerPreviewDebounced();
});
syncSliderAndNum(kmeansIter, kmeansIterNum, () => {
  updatePalettePreview();
  triggerPreviewDebounced();
});
syncSliderAndNum(tezumieStrength, tezumieStrengthNum, () => triggerPreviewDebounced());

// TEZUMIE TOGGLE & METHOD
tezumieToggle.addEventListener('change', () => {
  tezumieOptions.style.display = tezumieToggle.checked ? 'block' : 'none';
  triggerPreviewDebounced();
});
tezumieMethod.addEventListener('change', () => triggerPreviewDebounced());

autoOutlineToggle.addEventListener('change', () => triggerPreviewDebounced());
autoOutlineColor.addEventListener('input', () => triggerPreviewDebounced());
snapAlpha.addEventListener('change', () => triggerPreviewDebounced());
pass2Toggle.addEventListener('change', () => triggerPreviewDebounced());

// SCALE BUTTONS (1x, /2, /4, /8, /16)
scaleGroup.querySelectorAll('.scale-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectDivisor(parseInt(btn.dataset.divisor) || 1);
    updateDimensionsUI();
    triggerPreviewDebounced();
  });
});

function selectDivisor(d) {
  currentDivisor = d;
  btnResetZoom.title = `Reset to Native 1:1 Scale (1/${d} = ${Math.round(100/d)}%)`;
  scaleGroup.querySelectorAll('.scale-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.divisor) === d);
  });
}

// TOP ACTION BUTTONS: OPEN MAIN & OPEN PALETTE
btnOpenMainImage.addEventListener('click', () => fileInput.click());
btnOpenPaletteImage.addEventListener('click', () => paletteFileInput.click());

// MASTER RESET ALL SETTINGS TO DEFAULTS
btnResetAll.addEventListener('click', () => {
  selectDivisor(DEFAULTS.divisor);
  outlineWeight.value = DEFAULTS.outlineWeight;
  outlineWeightNum.value = DEFAULTS.outlineWeight;
  edgeSensitivity.value = DEFAULTS.edgeSensitivity;
  edgeSensitivityNum.value = DEFAULTS.edgeSensitivity;

  autoOutlineToggle.checked = DEFAULTS.autoOutline;
  autoOutlineColor.value = DEFAULTS.autoOutlineColor;
  snapAlpha.checked = DEFAULTS.snapAlpha;

  tezumieToggle.checked = DEFAULTS.tezumieEnabled;
  tezumieOptions.style.display = 'none';
  tezumieMethod.value = DEFAULTS.tezumieMethod;
  tezumieStrength.value = DEFAULTS.tezumieStrength;
  tezumieStrengthNum.value = DEFAULTS.tezumieStrength;
  pass2Toggle.checked = DEFAULTS.pass2Enabled;

  colorCount.value = DEFAULTS.colorCount;
  colorCountNum.value = DEFAULTS.colorCount;
  kmeansIter.value = DEFAULTS.kmeansIter;
  kmeansIterNum.value = DEFAULTS.kmeansIter;

  paletteSelect.value = DEFAULTS.palette;
  showGrid = DEFAULTS.grid;
  btnToggleGrid.classList.remove('btn-grid-active');
  btnToggleGrid.innerHTML = '&#9638; GRID: OFF';
  updatePalettePreview();
  updateDimensionsUI();
  triggerPreviewDebounced();
});

// INDIVIDUAL PARAMETER RESET BUTTONS
document.querySelectorAll('.btn-reset-param').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const param = btn.dataset.param;

    if (param === 'divisor') {
      selectDivisor(DEFAULTS.divisor);
      updateDimensionsUI();
    } else if (param === 'outlineWeight') {
      outlineWeight.value = DEFAULTS.outlineWeight;
      outlineWeightNum.value = DEFAULTS.outlineWeight;
    } else if (param === 'edgeSensitivity') {
      edgeSensitivity.value = DEFAULTS.edgeSensitivity;
      edgeSensitivityNum.value = DEFAULTS.edgeSensitivity;
    } else if (param === 'autoOutline') {
      autoOutlineToggle.checked = DEFAULTS.autoOutline;
      autoOutlineColor.value = DEFAULTS.autoOutlineColor;
    } else if (param === 'pass2') {
      pass2Toggle.checked = DEFAULTS.pass2Enabled;
    } else if (param === 'snapAlpha') {
      snapAlpha.checked = DEFAULTS.snapAlpha;
    } else if (param === 'tezumie') {
      tezumieToggle.checked = DEFAULTS.tezumieEnabled;
      tezumieOptions.style.display = 'none';
      tezumieMethod.value = DEFAULTS.tezumieMethod;
      tezumieStrength.value = DEFAULTS.tezumieStrength;
      tezumieStrengthNum.value = DEFAULTS.tezumieStrength;
    } else if (param === 'colorCount') {
      colorCount.value = DEFAULTS.colorCount;
      colorCountNum.value = DEFAULTS.colorCount;
      updatePalettePreview();
    } else if (param === 'kmeansIter') {
      kmeansIter.value = DEFAULTS.kmeansIter;
      kmeansIterNum.value = DEFAULTS.kmeansIter;
      updatePalettePreview();
    } else if (param === 'palette') {
      paletteSelect.value = DEFAULTS.palette;
      updatePalettePreview();
    }

    triggerPreviewDebounced();
  });
});

﻿// REFERENCE IMAGE PALETTE UPLOADER
paletteFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    loadPaletteReferenceImage(e.target.files[0]);
  }
});

function loadPaletteReferenceImage(file) {
  paletteRefName = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = Math.max(img.width, img.height);
      const scale = Math.min(1, 192 / maxDim);
      const pw = Math.max(1, Math.round(img.width * scale));
      const ph = Math.max(1, Math.round(img.height * scale));

      const pCanvas = document.createElement('canvas');
      pCanvas.width = pw;
      pCanvas.height = ph;
      const pCtx = pCanvas.getContext('2d');
      pCtx.drawImage(img, 0, 0, pw, ph);

      const pData = pCtx.getImageData(0, 0, pw, ph).data;
      const pixels = [];
      for (let i = 0; i < pData.length; i += 4) {
        if (pData[i + 3] > 32) {
          pixels.push([pData[i], pData[i + 1], pData[i + 2]]);
        }
      }

      if (pixels.length === 0) {
        alert("The uploaded palette image appears to be completely transparent.");
        return;
      }

      paletteRefPixels = pixels;

      paletteRefThumb.src = ev.target.result;
      paletteRefNameEl.textContent = paletteRefName;
      paletteRefBadge.style.display = 'flex';

      let refOpt = paletteSelect.querySelector('option[value="reference"]');
      if (!refOpt) {
        refOpt = document.createElement('option');
        refOpt.value = 'reference';
        paletteSelect.insertBefore(refOpt, paletteSelect.firstChild);
      }
      refOpt.textContent = `★ Ref Image: ${paletteRefName} (K-Means)`;
      paletteSelect.value = 'reference';

      updatePalettePreview();
      triggerPreviewDebounced();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// CLEAR REFERENCE PALETTE
btnClearPaletteRef.addEventListener('click', (e) => {
  e.stopPropagation();
  paletteRefPixels = null;
  paletteRefName = "";
  paletteFileInput.value = '';

  paletteRefBadge.style.display = 'none';

  const refOpt = paletteSelect.querySelector('option[value="reference"]');
  if (refOpt) refOpt.remove();

  paletteSelect.value = 'auto';
  updatePalettePreview();
  triggerPreviewDebounced();
});

// PALETTE PREVIEW SWATCHES
function updatePalettePreview() {
  const pChoice = paletteSelect.value;
  palettePreview.innerHTML = '';

  if (pChoice === 'reference' && paletteRefPixels && paletteRefPixels.length > 0) {
    const kColors = parseInt(colorCount.value) || 16;
    const iters = Math.min(10, parseInt(kmeansIter.value) || 10);
    const extracted = runKMeans(paletteRefPixels, kColors, iters);
    renderSwatches(extracted);
    return;
  }

  const preset = PALETTES[pChoice];
  if (preset) {
    renderSwatches(preset);
  } else {
    palettePreview.innerHTML = '<span style="color:#64748b;font-size:0.68rem;padding:2px 4px;">Auto K-Means (Active Image)</span>';
  }
}

function renderSwatches(colorList) {
  palettePreview.innerHTML = '';
  if (!colorList || colorList.length === 0) return;
  colorList.forEach(c => {
    const d = document.createElement('div');
    d.style.backgroundColor = `rgb(${c[0]},${c[1]},${c[2]})`;
    d.title = `rgb(${c[0]},${c[1]},${c[2]})`;
    palettePreview.appendChild(d);
  });
}

paletteSelect.addEventListener('change', () => {
  updatePalettePreview();
  triggerPreviewDebounced();
});
updatePalettePreview();

// ZOOM CONTROLS (FIT, NATIVE 1:1, SLIDER & NUM BOX)
function setZoom(val) {
  zoomPercent = Math.max(5, Math.min(1000, Math.round(val)));
  zoomSlider.value = zoomPercent;
  zoomNumInput.value = zoomPercent;
  statsZoom.textContent = `${zoomPercent}%`;
  applyZoomToCanvas();
}

function fitZoomToContainer() {
  if (!rawImageElement) return;
  const containerW = viewportScroller.clientWidth - 28;
  const containerH = viewportScroller.clientHeight - 28;
  const imgW = rawImageElement.naturalWidth || rawImageElement.width;
  const imgH = rawImageElement.naturalHeight || rawImageElement.height;

  if (containerW <= 0 || containerH <= 0 || imgW <= 0 || imgH <= 0) return;

  const scale = Math.min(containerW / imgW, containerH / imgH);
  setZoom(Math.floor(scale * 100));
}

zoomSlider.addEventListener('input', () => setZoom(parseInt(zoomSlider.value) || 100));
zoomNumInput.addEventListener('input', () => setZoom(parseInt(zoomNumInput.value) || 100));
btnZoomIn.addEventListener('click', () => setZoom(zoomPercent + 25));
btnZoomOut.addEventListener('click', () => setZoom(zoomPercent - 25));
btnFitZoom.addEventListener('click', () => fitZoomToContainer());
function resetToNativeScale() {
  const nativeZoom = Math.max(5, Math.round(100 / currentDivisor));
  setZoom(nativeZoom);
}
btnResetZoom.addEventListener('click', () => resetToNativeScale());

window.addEventListener('resize', () => {
  applyZoomToCanvas();
});

function applyZoomToCanvas() {
  if (!rawImageElement) return;
  const baseW = rawImageElement.naturalWidth || rawImageElement.width;
  const baseH = rawImageElement.naturalHeight || rawImageElement.height;

  const currentW = Math.round(baseW * (zoomPercent / 100));
  const currentH = Math.round(baseH * (zoomPercent / 100));

  mainCanvas.style.width = `${currentW}px`;
  mainCanvas.style.height = `${currentH}px`;
  canvasScaler.style.width = `${currentW}px`;
  canvasScaler.style.height = `${currentH}px`;

  updateSplitBarPosition();
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

// FILE DRAG & DROP / SELECTION
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

// LOAD IMAGE INTO WORKBENCH
function loadImage(file) {
  loadedFilename = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      rawImageElement = img;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const maxDim = Math.max(w, h);

      rawOffCanvas.width = w;
      rawOffCanvas.height = h;
      rawOffCtx.clearRect(0, 0, w, h);
      rawOffCtx.drawImage(img, 0, 0);

      loadedFilenameEl.textContent = loadedFilename;
      origDimBadge.textContent = `${w}x${h} px`;
      
      dropPrompt.style.display = 'none';
      viewerToolbar.style.display = 'flex';
      canvasWrapper.style.display = 'flex';

      selectDivisor(currentDivisor || 1);

      updateDimensionsUI();

      setTimeout(() => {
        const scrollerW = viewportScroller.clientWidth - 30;
        const scrollerH = viewportScroller.clientHeight - 30;
        if (w > scrollerW || h > scrollerH) {
          fitZoomToContainer();
        } else if (maxDim <= 128) {
          setZoom(400);
        } else if (maxDim <= 256) {
          setZoom(200);
        } else {
          setZoom(100);
        }
        triggerPreviewDebounced();
      }, 20);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function updateDimensionsUI() {
  if (!rawImageElement) return;
  const w = rawImageElement.naturalWidth || rawImageElement.width;
  const h = rawImageElement.naturalHeight || rawImageElement.height;
  const targetW = Math.max(1, Math.round(w / currentDivisor));
  const targetH = Math.max(1, Math.round(h / currentDivisor));

  origRes.textContent = `${w}x${h}`;
  targetDimText.textContent = `${targetW}x${targetH} px (/${currentDivisor})`;
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
  currentActivePalette = null;
  stopEyedropper();

  viewerToolbar.style.display = 'none';
  canvasWrapper.style.display = 'none';
  dropPrompt.style.display = 'block';

  origRes.textContent = '-';
  snappedRes.textContent = '-';
  activeColors.textContent = '-';
  targetDimText.textContent = 'Waiting...';
  downloadNameLabel.textContent = '';
  btnDownload.disabled = true;

  fileInput.value = '';
});

// DEBOUNCED PREVIEW TRIGGER WITH MULTI-INPUT SETTLING DELAY
const PREVIEW_DEBOUNCE_MS = 220; // Waits 220ms for rapid slider/stepper/button inputs to settle before running

function triggerPreviewDebounced(delay = PREVIEW_DEBOUNCE_MS) {
  if (previewTimeout) clearTimeout(previewTimeout);
  if (rawImageElement) {
    pipelineTag.textContent = "Pending...";
  }
  previewTimeout = setTimeout(() => {
    updatePreviewAsync();
  }, delay);
}

// PREVIEW PIPELINE (STRICT CONCURRENCY GUARD & DETERMINISTIC RE-RUN)
async function updatePreviewAsync() {
  if (!rawImageElement) return;
  
  if (isUpdatingPreview) {
    needsAnotherUpdate = true;
    return;
  }
  isUpdatingPreview = true;
  if (rawImageElement) pipelineTag.textContent = "Generating...";
  const currentSession = ++previewSessionId;

  try {
    const w = rawImageElement.naturalWidth || rawImageElement.width;
    const h = rawImageElement.naturalHeight || rawImageElement.height;
    const targetW = Math.max(1, Math.round(w / currentDivisor));
    const targetH = Math.max(1, Math.round(h / currentDivisor));
    
    const kColors = parseInt(colorCount.value) || 16;
    const iterations = parseInt(kmeansIter.value) || 15;
    const oWeight = parseFloat(outlineWeight.value) || 1.5;
    const snapAlphaChecked = snapAlpha.checked;

    let offCanvas = document.createElement('canvas');
    offCanvas.width = targetW;
    offCanvas.height = targetH;
    let offCtx = offCanvas.getContext('2d');
    offCtx.imageSmoothingEnabled = false;
    offCtx.drawImage(rawImageElement, 0, 0, targetW, targetH);

    // STEP 1: PALETTE SELECTION
    let palette = null;
    const pChoice = paletteSelect.value;

    if (pChoice === 'reference' && paletteRefPixels && paletteRefPixels.length > 0) {
      palette = runKMeans(paletteRefPixels, kColors, iterations);
    } else if (PALETTES[pChoice]) {
      palette = PALETTES[pChoice];
    } else {
      const imgData = offCtx.getImageData(0, 0, targetW, targetH);
      const data = imgData.data;
      const pixels = [];

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 64) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          pixels.push([r, g, b]);

          if (luminance < 75 && oWeight > 1.0) {
            const extraCopies = Math.round(oWeight - 1.0);
            for (let c = 0; c < extraCopies; c++) {
              pixels.push([r, g, b]);
            }
          }
        }
      }

      if (pixels.length > 0) {
        palette = runKMeans(pixels, kColors, iterations);
      }
    }

    if (palette && (pChoice === 'auto' || pChoice === 'reference')) {
      renderSwatches(palette);
    }

    if (currentSession !== previewSessionId) return;

    // STEP 2: DITHER / QUANTIZATION PASS
    const useTezumie = tezumieToggle.checked && window.ImageToPixel && window.ImageToPixel.pixelate;

    if (useTezumie && palette && palette.length > 0) {
      pipelineTag.textContent = "Tezumie+PixelSnapper";
      const paletteHexList = palette.map(c => rgbToHex(c[0], c[1], c[2]));
      const method = tezumieMethod.value;
      const strength = parseFloat(tezumieStrength.value) || 0.75;

      try {
        const result = await window.ImageToPixel.pixelate(offCanvas, {
          size: { mode: 'width', width: targetW, height: targetH },
          palette: { source: 'custom', colors: paletteHexList },
          dither: { method: method, strength: strength }
        });

        if (currentSession !== previewSessionId) return;

        if (result && typeof result.toCanvas === 'function') {
          offCanvas = result.toCanvas(1);
          offCtx = offCanvas.getContext('2d');
        }
      } catch (err) {
        console.warn("Tezumie fallback to nearest:", err);
        remapToPalette(offCtx, targetW, targetH, palette, snapAlphaChecked);
      }
    } else if (palette && palette.length > 0) {
      pipelineTag.textContent = "PixelSnapper";
      remapToPalette(offCtx, targetW, targetH, palette, snapAlphaChecked);
    }

    if (currentSession !== previewSessionId) return;

    // STEP 2.5: OPTIONAL 2ND PASS (POST-DITHER RE-SNAP CLUSTER)
    if (pass2Toggle.checked && palette && palette.length > 0) {
      pipelineTag.textContent += "+Pass2";
      remapToPalette(offCtx, targetW, targetH, palette, snapAlphaChecked);
    }

    if (currentSession !== previewSessionId) return;

    // STEP 3: OPTIONAL AUTO 1-PX ARCADE OUTLINE
    if (autoOutlineToggle.checked) {
      applyArcadeOutline(offCtx, targetW, targetH, autoOutlineColor.value);
    }

    // STEP 4: HARD ALPHA CLAMP
    if (snapAlphaChecked) {
      clampAlpha(offCtx, targetW, targetH);
    }

    if (currentSession !== previewSessionId) return;

    currentSnappedCanvas = offCanvas;
    currentActivePalette = palette;
    activeColors.textContent = palette ? palette.length : 'All';
    renderSplitView();
  } finally {
    isUpdatingPreview = false;
    if (needsAnotherUpdate) {
      needsAnotherUpdate = false;
      triggerPreviewDebounced();
    }
  }
}

function remapToPalette(ctx, w, h, palette, snapAlphaChecked) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= 64) {
      if (snapAlphaChecked) data[i + 3] = 0;
      continue;
    }
    if (snapAlphaChecked) data[i + 3] = 255;
    const nearest = findNearestColor([data[i], data[i + 1], data[i + 2]], palette);
    data[i] = nearest[0];
    data[i + 1] = nearest[1];
    data[i + 2] = nearest[2];
  }
  ctx.putImageData(imgData, 0, 0);
}

function applyArcadeOutline(ctx, w, h, hexColor) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
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
  ctx.putImageData(imgData, 0, 0);
}

function clampAlpha(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = data[i + 3] > 64 ? 255 : 0;
  }
  ctx.putImageData(imgData, 0, 0);
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16) || 0,
    parseInt(clean.substring(2, 4), 16) || 0,
    parseInt(clean.substring(4, 6), 16) || 0
  ];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function runKMeans(pixels, k, iterations) {
  const actualK = Math.min(k, pixels.length);
  if (actualK <= 0) return [];

  const centroids = [];
  const step = Math.max(1, Math.floor(pixels.length / actualK));
  for (let i = 0; i < actualK; i++) {
    centroids.push(pixels[(i * step) % pixels.length].slice());
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

// UPDATE SPLIT BAR (FULL VIEWPORT PANEL HEIGHT & <20px HIDE GUARD)
function updateSplitBarPosition() {
  if (!rawImageElement || !mainCanvas || !canvasWrapper) return;

  const baseW = rawImageElement.naturalWidth || rawImageElement.width;
  const baseH = rawImageElement.naturalHeight || rawImageElement.height;
  const currentW = Math.round(baseW * (zoomPercent / 100));
  const currentH = Math.round(baseH * (zoomPercent / 100));

  // If the image or rendered sprite is under 20px, do not show the bar right there
  if (baseW < 20 || baseH < 20 || currentW < 20 || currentH < 20) {
    splitBar.style.display = 'none';
    return;
  }
  splitBar.style.display = 'block';

  const canvasRect = mainCanvas.getBoundingClientRect();
  const wrapperRect = canvasWrapper.getBoundingClientRect();

  // Screen X position of the split divider across the full viewport panel
  const splitScreenX = canvasRect.left + (splitPosition * canvasRect.width) - wrapperRect.left;
  splitBar.style.left = `${Math.round(splitScreenX)}px`;
  splitBar.style.top = '0px';
  splitBar.style.bottom = '0px';
  splitBar.style.height = '100%';
}

// RENDER SPLIT VIEW
function renderSplitView() {
  if (!rawImageElement || !currentSnappedCanvas) return;

  const w = rawImageElement.naturalWidth || rawImageElement.width;
  const h = rawImageElement.naturalHeight || rawImageElement.height;

  mainCanvas.width = w;
  mainCanvas.height = h;

  applyZoomToCanvas();

  const currentW = Math.round(w * (zoomPercent / 100));
  const currentH = Math.round(h * (zoomPercent / 100));
  const isUnder20 = (w < 20 || h < 20 || currentW < 20 || currentH < 20);

  if (isUnder20) {
    splitPercent.textContent = '100%';
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(currentSnappedCanvas, 0, 0, w, h);
    ctx.restore();
    updateSplitBarPosition();
    return;
  }

  const splitX = Math.round(w * splitPosition);
  splitPercent.textContent = `${Math.round(splitPosition * 100)}%`;

  ctx.clearRect(0, 0, w, h);

  // Left: Original
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, splitX, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(rawImageElement, 0, 0, w, h);
  ctx.restore();

  // Right: Snapped Nearest-Neighbor
  ctx.save();
  ctx.beginPath();
  ctx.rect(splitX, 0, w - splitX, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(currentSnappedCanvas, 0, 0, w, h);

  // Grid Lines
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
  updateSplitBarPosition();
}

// SPLIT BAR DRAG
let isDraggingSplit = false;

function startSplitDrag(e) {
  if (e.button !== 0) return; // Only left-click
  if (isEyedropperActive) return; // Do not drag split during eyedropper mode
  isDraggingSplit = true;
  updateSplitFromMouse(e);
}

splitBar.addEventListener('mousedown', startSplitDrag);
canvasScaler.addEventListener('mousedown', startSplitDrag);

window.addEventListener('mousemove', (e) => {
  if (isDraggingSplit) {
    updateSplitFromMouse(e);
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    isDraggingSplit = false;
  }
});

function updateSplitFromMouse(e) {
  if (!mainCanvas) return;
  const rect = mainCanvas.getBoundingClientRect();
  if (rect.width === 0) return;
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  splitPosition = x / rect.width;
  renderSplitView();
  updateSplitBarPosition();
}

// EYEDROPPER PALETTE BUILDER IMPLEMENTATION
function startEyedropper() {
  if (!rawImageElement) return;
  isEyedropperActive = true;
  eyedropperHud.style.display = 'flex';
  btnStartEyedropper.classList.add('btn-eyedropper-active');
  btnStartEyedropper.innerHTML = '&#128394; PICKING... (CLICK IMAGE)';
  mainCanvas.style.cursor = 'crosshair';
  canvasScaler.style.cursor = 'crosshair';
  canvasWrapper.style.cursor = 'crosshair';
  updateEyedropperUI();
}

function stopEyedropper() {
  isEyedropperActive = false;
  eyedropperHud.style.display = 'none';
  eyedropperLoupe.style.display = 'none';
  btnStartEyedropper.classList.remove('btn-eyedropper-active');
  btnStartEyedropper.innerHTML = '&#128394; + ADD PALETTE (EYEDROPPER)';
  mainCanvas.style.cursor = '';
  canvasScaler.style.cursor = '';
  canvasWrapper.style.cursor = '';
}

function showEyedropperHint(msg) {
  if (!eyedropperHint) return;
  const orig = eyedropperHint.textContent;
  eyedropperHint.textContent = msg;
  eyedropperHint.style.color = 'var(--accent-orange)';
  setTimeout(() => {
    eyedropperHint.textContent = 'Click original image to add colors (1-by-1)';
    eyedropperHint.style.color = '#94a3b8';
  }, 1800);
}

function updateEyedropperUI() {
  eyedropperSwatches.innerHTML = '';
  if (pickedEyedropperColors.length === 0) {
    eyedropperSwatches.innerHTML = '<span class="empty-swatches-hint">Click on image to sample colors...</span>';
    btnFinishPalette.innerHTML = '&#10004; FINISH PALETTE (0 COLORS)';
    btnFinishPalette.disabled = true;
    return;
  }

  btnFinishPalette.disabled = false;
  btnFinishPalette.innerHTML = `&#10004; FINISH PALETTE (${pickedEyedropperColors.length} COLORS)`;

  pickedEyedropperColors.forEach((c, idx) => {
    const sw = document.createElement('div');
    sw.className = 'eyedropper-swatch';
    const hex = rgbToHex(c[0], c[1], c[2]);
    sw.style.backgroundColor = `rgb(${c[0]},${c[1]},${c[2]})`;
    sw.title = `${hex.toUpperCase()} (${c[0]},${c[1]},${c[2]}) - Click to remove`;
    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      pickedEyedropperColors.splice(idx, 1);
      updateEyedropperUI();
    });
    eyedropperSwatches.appendChild(sw);
  });
}

btnStartEyedropper.addEventListener('click', () => {
  if (!rawImageElement) {
    fileInput.click();
    return;
  }
  if (isEyedropperActive) {
    stopEyedropper();
  } else {
    startEyedropper();
  }
});

btnEyedropperCancel.addEventListener('click', () => stopEyedropper());

btnEyedropperClear.addEventListener('click', () => {
  pickedEyedropperColors = [];
  updateEyedropperUI();
});

btnFinishPalette.addEventListener('click', () => {
  if (pickedEyedropperColors.length === 0) {
    alert("Please pick at least 1 color from the image first!");
    return;
  }

  // Register in PALETTES
  PALETTES.customEyedropper = [...pickedEyedropperColors];

  // Add or update option in paletteSelect
  let opt = paletteSelect.querySelector('option[value="customEyedropper"]');
  if (!opt) {
    opt = document.createElement('option');
    opt.value = 'customEyedropper';
    paletteSelect.insertBefore(opt, paletteSelect.firstChild);
  }
  opt.textContent = `Custom Eyedropper (${pickedEyedropperColors.length} Colors)`;
  paletteSelect.value = 'customEyedropper';

  renderSwatches(pickedEyedropperColors);
  stopEyedropper();
  triggerPreviewDebounced();
});

// EYEDROPPER CANVAS HOVER & CLICK
canvasScaler.addEventListener('click', (e) => {
  if (!isEyedropperActive || !rawImageElement || e.button !== 0) return;
  e.stopPropagation();

  const rect = mainCanvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height) return;

  const normX = mouseX / rect.width;
  const normY = mouseY / rect.height;
  const imgX = Math.floor(normX * rawOffCanvas.width);
  const imgY = Math.floor(normY * rawOffCanvas.height);

  if (imgX >= 0 && imgX < rawOffCanvas.width && imgY >= 0 && imgY < rawOffCanvas.height) {
    const p = rawOffCtx.getImageData(imgX, imgY, 1, 1).data;
    const r = p[0], g = p[1], b = p[2], a = p[3];

    if (a === 0) {
      showEyedropperHint("Transparent pixel (Alpha 0) - skipped");
      return;
    }

    const hex = rgbToHex(r, g, b);
    const exists = pickedEyedropperColors.some(c => rgbToHex(c[0], c[1], c[2]) === hex);
    if (!exists) {
      pickedEyedropperColors.push([r, g, b]);
      updateEyedropperUI();
    } else {
      showEyedropperHint(`Color ${hex.toUpperCase()} already in palette`);
    }
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isEyedropperActive || !rawImageElement) {
    eyedropperLoupe.style.display = 'none';
    return;
  }

  const rect = mainCanvas.getBoundingClientRect();
  if (e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom) {
    eyedropperLoupe.style.display = 'flex';
    eyedropperLoupe.style.left = `${e.clientX}px`;
    eyedropperLoupe.style.top = `${e.clientY}px`;

    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;
    const imgX = Math.floor(normX * rawOffCanvas.width);
    const imgY = Math.floor(normY * rawOffCanvas.height);

    if (imgX >= 0 && imgX < rawOffCanvas.width && imgY >= 0 && imgY < rawOffCanvas.height) {
      const p = rawOffCtx.getImageData(imgX, imgY, 1, 1).data;
      const r = p[0], g = p[1], b = p[2], a = p[3];
      if (a === 0) {
        loupeColor.style.backgroundColor = 'transparent';
        loupeHex.textContent = 'Alpha 0 (Transparent)';
      } else {
        const hex = rgbToHex(r, g, b);
        loupeColor.style.backgroundColor = `rgb(${r},${g},${b})`;
        loupeHex.textContent = `${hex.toUpperCase()} (${r},${g},${b})`;
      }
    }
  } else {
    eyedropperLoupe.style.display = 'none';
  }
});

// CRC32 & INDEXED PNG ENCODER (PLTE + HARD/SOFT tRNS CHUNKS)
const pngCrcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  pngCrcTable[n] = c >>> 0;
}
function calcPngCrc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = pngCrcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function buildPngChunk(typeStr, data) {
  const len = data ? data.length : 0;
  const chunk = new Uint8Array(4 + 4 + len + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, len, false);
  for (let i = 0; i < 4; i++) chunk[4 + i] = typeStr.charCodeAt(i);
  if (data) chunk.set(data, 8);
  const crcData = chunk.subarray(4, 8 + len);
  view.setUint32(8 + len, calcPngCrc32(crcData), false);
  return chunk;
}

async function encodeIndexedPng(width, height, rgbaData, isHardAlpha, customPalette) {
  const numPixels = width * height;
  
  let hasTransparent = false;
  let hasTranslucent = false;
  for (let i = 3; i < rgbaData.length; i += 4) {
    const a = rgbaData[i];
    if (a === 0) hasTransparent = true;
    else if (a < 255) hasTranslucent = true;
  }
  
  let finalPalette = [];
  let alphaList = [];
  const indices = new Uint8Array(numPixels);
  const colorMap = new Map();
  
  if (isHardAlpha) {
    if (hasTransparent) {
      finalPalette.push([0, 0, 0]);
      alphaList.push(0);
    }
    
    if (customPalette && customPalette.length > 0) {
      for (const col of customPalette) {
        const key = (col[0] << 16) | (col[1] << 8) | col[2];
        if (!colorMap.has(key) && finalPalette.length < 256) {
          colorMap.set(key, finalPalette.length);
          finalPalette.push([col[0], col[1], col[2]]);
          alphaList.push(255);
        }
      }
    }
    
    for (let p = 0; p < numPixels; p++) {
      const offset = p * 4;
      const a = rgbaData[offset + 3];
      if (a < 128 && hasTransparent) {
        indices[p] = 0;
      } else {
        const r = rgbaData[offset];
        const g = rgbaData[offset + 1];
        const b = rgbaData[offset + 2];
        const key = (r << 16) | (g << 8) | b;
        let idx = colorMap.get(key);
        if (idx === undefined) {
          if (finalPalette.length < 256) {
            idx = finalPalette.length;
            finalPalette.push([r, g, b]);
            alphaList.push(255);
            colorMap.set(key, idx);
          } else {
            let bestIdx = hasTransparent ? 1 : 0;
            let bestDist = Infinity;
            const startIdx = hasTransparent ? 1 : 0;
            for (let k = startIdx; k < finalPalette.length; k++) {
              const pr = finalPalette[k][0], pg = finalPalette[k][1], pb = finalPalette[k][2];
              const d = (r-pr)*(r-pr) + (g-pg)*(g-pg) + (b-pb)*(b-pb);
              if (d < bestDist) { bestDist = d; bestIdx = k; }
            }
            idx = bestIdx;
          }
        }
        indices[p] = idx;
      }
    }
  } else {
    for (let p = 0; p < numPixels; p++) {
      const offset = p * 4;
      const r = rgbaData[offset];
      const g = rgbaData[offset + 1];
      const b = rgbaData[offset + 2];
      const a = rgbaData[offset + 3];
      const key = `${r},${g},${b},${a}`;
      let idx = colorMap.get(key);
      if (idx === undefined) {
        if (finalPalette.length < 256) {
          idx = finalPalette.length;
          finalPalette.push([r, g, b]);
          alphaList.push(a);
          colorMap.set(key, idx);
        } else {
          let bestIdx = 0, bestDist = Infinity;
          for (let k = 0; k < finalPalette.length; k++) {
            const pr = finalPalette[k][0], pg = finalPalette[k][1], pb = finalPalette[k][2];
            const pa = alphaList[k];
            const d = (r-pr)*(r-pr) + (g-pg)*(g-pg) + (b-pb)*(b-pb) + (a-pa)*(a-pa)*2;
            if (d < bestDist) { bestDist = d; bestIdx = k; }
          }
          idx = bestIdx;
        }
      }
      indices[p] = idx;
    }
  }

  if (finalPalette.length === 0) {
    finalPalette.push([0, 0, 0]);
    alphaList.push(255);
  }

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdrData[8] = 8;
  ihdrData[9] = 3;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = buildPngChunk('IHDR', ihdrData);

  const plteData = new Uint8Array(finalPalette.length * 3);
  for (let i = 0; i < finalPalette.length; i++) {
    plteData[i * 3] = finalPalette[i][0];
    plteData[i * 3 + 1] = finalPalette[i][1];
    plteData[i * 3 + 2] = finalPalette[i][2];
  }
  const plteChunk = buildPngChunk('PLTE', plteData);

  let trnsChunk = null;
  if (isHardAlpha) {
    if (hasTransparent) {
      trnsChunk = buildPngChunk('tRNS', new Uint8Array([0]));
    }
  } else {
    let lastNonOpaque = -1;
    for (let i = alphaList.length - 1; i >= 0; i--) {
      if (alphaList[i] < 255) {
        lastNonOpaque = i;
        break;
      }
    }
    if (lastNonOpaque >= 0) {
      const trnsData = new Uint8Array(lastNonOpaque + 1);
      for (let i = 0; i <= lastNonOpaque; i++) {
        trnsData[i] = alphaList[i];
      }
      trnsChunk = buildPngChunk('tRNS', trnsData);
    }
  }

  const rawScanlines = new Uint8Array(height * (1 + width));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width);
    rawScanlines[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      rawScanlines[rowOffset + 1 + x] = indices[y * width + x];
    }
  }

  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  writer.write(rawScanlines);
  writer.close();
  const resp = new Response(cs.readable);
  const compressed = new Uint8Array(await resp.arrayBuffer());
  const idatChunk = buildPngChunk('IDAT', compressed);

  const iendChunk = buildPngChunk('IEND', null);

  const totalLen = sig.length + ihdrChunk.length + plteChunk.length + 
                   (trnsChunk ? trnsChunk.length : 0) + idatChunk.length + iendChunk.length;
  const png = new Uint8Array(totalLen);
  let pos = 0;
  png.set(sig, pos); pos += sig.length;
  png.set(ihdrChunk, pos); pos += ihdrChunk.length;
  png.set(plteChunk, pos); pos += plteChunk.length;
  if (trnsChunk) {
    png.set(trnsChunk, pos); pos += trnsChunk.length;
  }
  png.set(idatChunk, pos); pos += idatChunk.length;
  png.set(iendChunk, pos); pos += iendChunk.length;

  return png;
}

// DOWNLOAD ASSET: [filename]_sn[sizeX].png (INDEXED PNG WITH PLTE & tRNS)
btnDownload.addEventListener('click', async () => {
  if (!currentSnappedCanvas || !rawImageElement) return;

  const targetW = currentSnappedCanvas.width;
  const targetH = currentSnappedCanvas.height;
  const baseName = loadedFilename.replace(/\.[^/.]+$/, "");
  const finalFilename = `${baseName}_sn${targetW}.png`;

  try {
    const offCtx = currentSnappedCanvas.getContext('2d');
    const imgData = offCtx.getImageData(0, 0, targetW, targetH);
    const isHardAlpha = snapAlpha.checked;

    const pngBytes = await encodeIndexedPng(
      targetW,
      targetH,
      imgData.data,
      isHardAlpha,
      currentActivePalette
    );

    const blob = new Blob([pngBytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = finalFilename;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.warn("Indexed PNG encoding fallback to canvas toDataURL:", err);
    const link = document.createElement('a');
    link.download = finalFilename;
    link.href = currentSnappedCanvas.toDataURL('image/png');
    link.click();
  }
});

// TAB 2: PROMPT LAB COPY HELPERS
const globalArtstyleText = document.getElementById('globalArtstyleText');
const btnCopyArtstyleOnly = document.getElementById('btnCopyArtstyleOnly');

btnCopyArtstyleOnly.addEventListener('click', () => {
  navigator.clipboard.writeText(globalArtstyleText.value.trim()).then(() => {
    const orig = btnCopyArtstyleOnly.textContent;
    btnCopyArtstyleOnly.textContent = '✓ COPIED STYLE!';
    btnCopyArtstyleOnly.style.borderColor = 'var(--accent-green)';
    btnCopyArtstyleOnly.style.color = 'var(--accent-green)';
    setTimeout(() => {
      btnCopyArtstyleOnly.textContent = orig;
      btnCopyArtstyleOnly.style.borderColor = 'var(--border-color)';
      btnCopyArtstyleOnly.style.color = 'var(--text-main)';
    }, 1500);
  });
});

function copyCardPrompt(btn) {
  const card = btn.closest('.prompt-card');
  const subjectText = card.querySelector('.prompt-text').textContent.trim();
  const styleText = globalArtstyleText.value.trim();
  const fullPrompt = `${subjectText} ${styleText}`;

  navigator.clipboard.writeText(fullPrompt).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ COPIED (WITH ART STYLE)!';
    btn.style.backgroundColor = 'var(--accent-green)';
    btn.style.color = '#000';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.backgroundColor = 'var(--bg-card)';
      btn.style.color = 'var(--accent-cyan)';
    }, 1500);
  });
}


// STEPPER BUTTONS (- / +) HANDLER
document.querySelectorAll('.btn-step').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const targetId = btn.dataset.target;
    const step = parseFloat(btn.dataset.step) || 0;
    const input = document.getElementById(targetId);
    if (!input) return;

    let val = parseFloat(input.value) || 0;
    val += step;
    const min = parseFloat(input.min !== undefined ? input.min : -Infinity);
    const max = parseFloat(input.max !== undefined ? input.max : Infinity);
    if (val < min) val = min;
    if (val > max) val = max;

    const decimals = (btn.dataset.step.split('.')[1] || '').length;
    val = parseFloat(val.toFixed(decimals));

    input.value = val;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
});


// MOUSE WHEEL ZOOM OVER VIEWPORT (CENTERED ON CURSOR)
viewportScroller.addEventListener('wheel', (e) => {
  if (!rawImageElement) return;
  e.preventDefault();

  const delta = e.deltaY < 0 ? 15 : -15;
  const rect = viewportScroller.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const prevW = mainCanvas.clientWidth;
  const prevH = mainCanvas.clientHeight;
  const prevScrollX = viewportScroller.scrollLeft;
  const prevScrollY = viewportScroller.scrollTop;

  const oldZoom = zoomPercent;
  const newZoom = Math.max(5, Math.min(1000, oldZoom + delta));
  if (newZoom === oldZoom) return;

  setZoom(newZoom);

  const newW = mainCanvas.clientWidth;
  const newH = mainCanvas.clientHeight;
  if (prevW > 0 && prevH > 0) {
    viewportScroller.scrollLeft = (prevScrollX + mouseX) * (newW / prevW) - mouseX;
    viewportScroller.scrollTop = (prevScrollY + mouseY) * (newH / prevH) - mouseY;
  }
  updateSplitBarPosition();
}, { passive: false });

// MIDDLE CLICK HOLD + DRAG PAN (SUPPORT ON VIEWPORT & CANVAS WRAPPER)
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let scrollStartX = 0;
let scrollStartY = 0;

function startMiddlePan(e) {
  if (e.button === 1) { // Middle click button
    e.preventDefault();
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    scrollStartX = viewportScroller.scrollLeft;
    scrollStartY = viewportScroller.scrollTop;
    viewportScroller.style.cursor = 'grabbing';
    canvasWrapper.style.cursor = 'grabbing';
  }
}

viewportScroller.addEventListener('mousedown', startMiddlePan);
canvasWrapper.addEventListener('mousedown', startMiddlePan);

window.addEventListener('mousemove', (e) => {
  if (isPanning) {
    e.preventDefault();
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    viewportScroller.scrollLeft = scrollStartX - dx;
    viewportScroller.scrollTop = scrollStartY - dy;
    updateSplitBarPosition();
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 1 && isPanning) {
    isPanning = false;
    viewportScroller.style.cursor = '';
    canvasWrapper.style.cursor = '';
  }
});

viewportScroller.addEventListener('auxclick', (e) => {
  if (e.button === 1) e.preventDefault();
});
canvasWrapper.addEventListener('auxclick', (e) => {
  if (e.button === 1) e.preventDefault();
});

viewportScroller.addEventListener('scroll', updateSplitBarPosition);
window.addEventListener('resize', updateSplitBarPosition);

// CTRL+ / CTRL- / CTRL+0 KEYBOARD ZOOM OVERRIDE
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
      e.preventDefault();
      if (rawImageElement) setZoom(zoomPercent + 25);
    } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      if (rawImageElement) setZoom(zoomPercent - 25);
    } else if (e.key === '0' || e.code === 'Numpad0') {
      e.preventDefault();
      if (rawImageElement) resetToNativeScale();
    }
  }
});
