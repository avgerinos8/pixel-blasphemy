// PixelForge Studio v1.1 - Non-Destructive Live Preview Engine

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
let rawImageElement = null;       // Fresh loaded file image
let activeWorkingCanvas = null;    // Can be cropped version of raw image
let currentSnappedCanvas = null;   // Downscaled & snapped preview canvas
let currentDivisor = 8;
let splitPosition = 0.5;
let isCropping = false;
let cropRect = { x: 0, y: 0, w: 100, h: 100 };
let batchFiles = [];

// DOM Elements
const dropZone = document.getElementById('dropZone');
const dropPrompt = document.getElementById('dropPrompt');
const fileInput = document.getElementById('fileInput');
const canvasWrapper = document.getElementById('canvasWrapper');
const mainCanvas = document.getElementById('mainCanvas');
const splitBar = document.getElementById('splitBar');
const cropOverlay = document.getElementById('cropOverlay');
const ctx = mainCanvas.getContext('2d');

const viewerToolbar = document.getElementById('viewerToolbar');
const loadedFilenameEl = document.getElementById('loadedFilename');
const origDimBadge = document.getElementById('origDimBadge');
const btnCloseImage = document.getElementById('btnCloseImage');
const btnBrowseNew = document.getElementById('btnBrowseNew');
const quickLoadGroup = document.getElementById('quickLoadGroup');

const btnToggleCrop = document.getElementById('btnToggleCrop');
const cropControls = document.getElementById('cropControls');
const btnApplyCrop = document.getElementById('btnApplyCrop');
const btnCancelCrop = document.getElementById('btnCancelCrop');

const scaleGroup = document.getElementById('scaleGroup');
const targetDimText = document.getElementById('targetDimText');
const colorCount = document.getElementById('colorCount');
const colorCountVal = document.getElementById('colorCountVal');
const paletteSelect = document.getElementById('paletteSelect');
const palettePreview = document.getElementById('palettePreview');

const btnDownload = document.getElementById('btnDownload');
const downloadNameLabel = document.getElementById('downloadNameLabel');

const origRes = document.getElementById('origRes');
const snappedRes = document.getElementById('snappedRes');
const activeColors = document.getElementById('activeColors');
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

// SCALE BUTTONS (/2, /4, /8, /16, 1x)
scaleGroup.querySelectorAll('.scale-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    scaleGroup.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDivisor = parseInt(btn.dataset.divisor) || 1;
    updateDimensionsUI();
    updatePreview();
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
  updatePreview();
});
updatePalettePreview();

colorCount.addEventListener('input', () => {
  colorCountVal.textContent = colorCount.value;
  updatePreview();
});

document.getElementById('renderGridLines').addEventListener('change', renderSplitView);
document.getElementById('snapAlpha').addEventListener('change', updatePreview);

// FILE INPUT (TRIGGERED ONLY BY PROMPT OR LOAD BUTTON, NOT BY CANVAS CLICK!)
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
      
      // Initialize active working canvas with exact original dimensions
      activeWorkingCanvas = document.createElement('canvas');
      activeWorkingCanvas.width = img.naturalWidth || img.width;
      activeWorkingCanvas.height = img.naturalHeight || img.height;
      const wCtx = activeWorkingCanvas.getContext('2d');
      wCtx.drawImage(img, 0, 0);

      // UI updates
      loadedFilenameEl.textContent = loadedFilename;
      origDimBadge.textContent = `${activeWorkingCanvas.width}x${activeWorkingCanvas.height} px`;
      
      dropPrompt.style.display = 'none';
      viewerToolbar.style.display = 'flex';
      quickLoadGroup.style.display = 'block';
      canvasWrapper.style.display = 'flex';

      // Auto-choose sensible divisor if image is large
      const maxDim = Math.max(activeWorkingCanvas.width, activeWorkingCanvas.height);
      if (maxDim >= 1024) selectDivisor(16);
      else if (maxDim >= 512) selectDivisor(8);
      else if (maxDim >= 256) selectDivisor(4);
      else selectDivisor(1);

      updateDimensionsUI();
      updatePreview();
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
  if (!activeWorkingCanvas) return;
  const w = activeWorkingCanvas.width;
  const h = activeWorkingCanvas.height;
  const targetW = Math.max(1, Math.round(w / currentDivisor));
  const targetH = Math.max(1, Math.round(h / currentDivisor));

  origRes.textContent = `${w}x${h}`;
  targetDimText.textContent = `${targetW} × ${targetH} px (/${currentDivisor})`;
  snappedRes.textContent = `${targetW}x${targetH}`;

  // Update download button label with target filename: [name]_sn[sizeX].png
  const baseName = loadedFilename.replace(/\.[^/.]+$/, "");
  const downloadName = `${baseName}_sn${targetW}.png`;
  downloadNameLabel.textContent = `(${downloadName})`;
  btnDownload.disabled = false;
}

// CLOSE / EJECT IMAGE
btnCloseImage.addEventListener('click', () => {
  rawImageElement = null;
  activeWorkingCanvas = null;
  currentSnappedCanvas = null;
  isCropping = false;

  cropOverlay.style.display = 'none';
  cropControls.style.display = 'none';
  btnToggleCrop.style.display = 'inline-block';

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

// CROP TOOL
btnToggleCrop.addEventListener('click', () => {
  if (!activeWorkingCanvas) return;
  isCropping = true;
  btnToggleCrop.style.display = 'none';
  cropControls.style.display = 'flex';
  splitBar.style.display = 'none';

  // Initialize crop rect to center square (e.g. 70% of smaller dimension)
  const w = activeWorkingCanvas.width;
  const h = activeWorkingCanvas.height;
  const size = Math.round(Math.min(w, h) * 0.75);
  cropRect = {
    x: Math.round((w - size) / 2),
    y: Math.round((h - size) / 2),
    w: size,
    h: size
  };

  renderCropOverlay();
});

btnCancelCrop.addEventListener('click', () => {
  isCropping = false;
  cropOverlay.style.display = 'none';
  cropControls.style.display = 'none';
  btnToggleCrop.style.display = 'inline-block';
  splitBar.style.display = 'block';
  renderSplitView();
});

btnApplyCrop.addEventListener('click', () => {
  if (!activeWorkingCanvas) return;
  
  // Extract cropped sub-image
  const cropped = document.createElement('canvas');
  cropped.width = cropRect.w;
  cropped.height = cropRect.h;
  const cCtx = cropped.getContext('2d');
  cCtx.drawImage(
    activeWorkingCanvas,
    cropRect.x, cropRect.y, cropRect.w, cropRect.h,
    0, 0, cropRect.w, cropRect.h
  );

  activeWorkingCanvas = cropped;
  origDimBadge.textContent = `${cropped.width}x${cropped.height} px`;

  isCropping = false;
  cropOverlay.style.display = 'none';
  cropControls.style.display = 'none';
  btnToggleCrop.style.display = 'inline-block';
  splitBar.style.display = 'block';

  updateDimensionsUI();
  updatePreview();
});

function renderCropOverlay() {
  if (!isCropping) return;
  cropOverlay.style.display = 'block';

  // Map image coordinates to canvas on screen
  const rect = mainCanvas.getBoundingClientRect();
  const scaleX = rect.width / activeWorkingCanvas.width;
  const scaleY = rect.height / activeWorkingCanvas.height;

  cropOverlay.style.left = `${mainCanvas.offsetLeft + cropRect.x * scaleX}px`;
  cropOverlay.style.top = `${mainCanvas.offsetTop + cropRect.y * scaleY}px`;
  cropOverlay.style.width = `${cropRect.w * scaleX}px`;
  cropOverlay.style.height = `${cropRect.h * scaleY}px`;
}

// NON-DESTRUCTIVE LIVE PREVIEW COMPUTATION
function updatePreview() {
  if (!activeWorkingCanvas) return;

  const w = activeWorkingCanvas.width;
  const h = activeWorkingCanvas.height;
  const targetW = Math.max(1, Math.round(w / currentDivisor));
  const targetH = Math.max(1, Math.round(h / currentDivisor));
  const kColors = parseInt(colorCount.value) || 16;
  const selectedPalette = PALETTES[paletteSelect.value];

  // Create offscreen canvas for downsampled target
  const offCanvas = document.createElement('canvas');
  offCanvas.width = targetW;
  offCanvas.height = targetH;
  const offCtx = offCanvas.getContext('2d');
  offCtx.imageSmoothingEnabled = false;
  offCtx.drawImage(activeWorkingCanvas, 0, 0, targetW, targetH);

  const imgData = offCtx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;

  // Collect pixels for K-Means
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 64) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  let palette = selectedPalette;
  if (!palette && pixels.length > 0) {
    palette = runKMeans(pixels, kColors, 10);
  }

  // Remap
  if (palette && palette.length > 0) {
    const snapAlpha = document.getElementById('snapAlpha').checked;
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

  offCtx.putImageData(imgData, 0, 0);
  currentSnappedCanvas = offCanvas;

  activeColors.textContent = palette ? palette.length : 'All';
  renderSplitView();
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
  if (!activeWorkingCanvas || !currentSnappedCanvas) return;

  const displayW = 512;
  const aspect = activeWorkingCanvas.height / activeWorkingCanvas.width;
  const displayH = Math.round(displayW * aspect);

  mainCanvas.width = displayW;
  mainCanvas.height = displayH;

  const splitX = Math.round(displayW * splitPosition);
  splitBar.style.left = `${mainCanvas.offsetLeft + splitX}px`;
  splitBar.style.top = `${mainCanvas.offsetTop}px`;
  splitBar.style.height = `${displayH}px`;
  splitPercent.textContent = `${Math.round(splitPosition * 100)}%`;

  ctx.clearRect(0, 0, displayW, displayH);

  // Left Side: Original
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, splitX, displayH);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(activeWorkingCanvas, 0, 0, displayW, displayH);
  ctx.restore();

  // Right Side: Snapped scaled up with nearest neighbor
  ctx.save();
  ctx.beginPath();
  ctx.rect(splitX, 0, displayW - splitX, displayH);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(currentSnappedCanvas, 0, 0, displayW, displayH);

  // Pixel Grid Lines (on snapped side)
  if (document.getElementById('renderGridLines').checked) {
    const targetW = currentSnappedCanvas.width;
    const targetH = currentSnappedCanvas.height;
    const stepX = displayW / targetW;
    const stepY = displayH / targetH;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    for (let x = splitX; x < displayW; x += stepX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, displayH);
      ctx.stroke();
    }
    for (let y = 0; y < displayH; y += stepY) {
      ctx.beginPath();
      ctx.moveTo(splitX, y);
      ctx.lineTo(displayW, y);
      ctx.stroke();
    }
  }
  ctx.restore();

  if (isCropping) renderCropOverlay();
}

// SPLIT BAR DRAGGING (INTERACTIVE)
let isDraggingSplit = false;
canvasWrapper.addEventListener('mousedown', (e) => {
  if (isCropping) return;
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
  if (!currentSnappedCanvas || !activeWorkingCanvas) return;

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
