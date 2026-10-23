// PixelForge Studio v1.0 - Client Side Implementation

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

let currentOriginalImage = null;
let currentSnappedCanvas = null;
let splitPosition = 0.5;
let batchFiles = [];

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const dropPrompt = document.getElementById('dropPrompt');
const canvasWrapper = document.getElementById('canvasWrapper');
const mainCanvas = document.getElementById('mainCanvas');
const splitBar = document.getElementById('splitBar');
const ctx = mainCanvas.getContext('2d');

const colorCount = document.getElementById('colorCount');
const colorCountVal = document.getElementById('colorCountVal');
const targetGrid = document.getElementById('targetGrid');
const paletteSelect = document.getElementById('paletteSelect');
const palettePreview = document.getElementById('palettePreview');
const btnProcess = document.getElementById('btnProcess');
const btnDownload = document.getElementById('btnDownload');

// Stats Elements
const origRes = document.getElementById('origRes');
const snappedRes = document.getElementById('snappedRes');
const activeColors = document.getElementById('activeColors');

// TABS
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// SLIDERS & PALETTE
colorCount.addEventListener('input', () => {
  colorCountVal.textContent = colorCount.value;
});

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
paletteSelect.addEventListener('change', updatePalettePreview);
updatePalettePreview();

// FILE DRAG & DROP
dropZone.addEventListener('click', () => fileInput.click());
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

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      currentOriginalImage = img;
      dropPrompt.style.display = 'none';
      canvasWrapper.style.display = 'flex';
      origRes.textContent = `${img.width}x${img.height}`;
      processSnapping();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// PIXEL SNAPPER ALGORITHM (JS / CANVAS)
function processSnapping() {
  if (!currentOriginalImage) return;

  const targetSize = parseInt(targetGrid.value) || 64;
  const kColors = parseInt(colorCount.value) || 16;
  const selectedPalette = PALETTES[paletteSelect.value];

  // Create offscreen canvas for 64x64 reduction
  const offCanvas = document.createElement('canvas');
  offCanvas.width = targetSize;
  offCanvas.height = targetSize;
  const offCtx = offCanvas.getContext('2d');
  offCtx.imageSmoothingEnabled = false;
  offCtx.drawImage(currentOriginalImage, 0, 0, targetSize, targetSize);

  const imgData = offCtx.getImageData(0, 0, targetSize, targetSize);
  const data = imgData.data;

  // Collect pixel colors
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 64) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  // K-Means Clustering if no preset palette
  let palette = selectedPalette;
  if (!palette && pixels.length > 0) {
    palette = runKMeans(pixels, kColors, 10);
  }

  // Map every pixel to nearest palette color
  if (palette && palette.length > 0) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] <= 64) {
        if (document.getElementById('snapAlpha').checked) {
          data[i + 3] = 0;
        }
        continue;
      }
      if (document.getElementById('snapAlpha').checked) {
        data[i + 3] = 255;
      }
      const nearest = findNearestColor([data[i], data[i + 1], data[i + 2]], palette);
      data[i] = nearest[0];
      data[i + 1] = nearest[1];
      data[i + 2] = nearest[2];
    }
  }

  offCtx.putImageData(imgData, 0, 0);
  currentSnappedCanvas = offCanvas;

  snappedRes.textContent = `${targetSize}x${targetSize}`;
  activeColors.textContent = palette ? palette.length : 'All';
  btnDownload.disabled = false;

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
  if (!currentOriginalImage || !currentSnappedCanvas) return;

  const displaySize = 512;
  mainCanvas.width = displaySize;
  mainCanvas.height = displaySize;

  const splitX = Math.round(displaySize * splitPosition);
  splitBar.style.left = `${splitX}px`;

  ctx.clearRect(0, 0, displaySize, displaySize);

  // Left Side: Original
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, splitX, displaySize);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(currentOriginalImage, 0, 0, displaySize, displaySize);
  ctx.restore();

  // Right Side: Snapped 64x64 scaled up
  ctx.save();
  ctx.beginPath();
  ctx.rect(splitX, 0, displaySize - splitX, displaySize);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(currentSnappedCanvas, 0, 0, displaySize, displaySize);

  // Optional: Pixel Grid Overlay
  if (document.getElementById('renderGridLines').checked) {
    const targetSize = parseInt(targetGrid.value) || 64;
    const step = displaySize / targetSize;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let x = splitX; x < displaySize; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, displaySize);
      ctx.stroke();
    }
    for (let y = 0; y < displaySize; y += step) {
      ctx.beginPath();
      ctx.moveTo(splitX, y);
      ctx.lineTo(displaySize, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// SLIDER DRAG INTERACTION
let isDragging = false;
canvasWrapper.addEventListener('mousedown', (e) => {
  isDragging = true;
  updateSplit(e);
});
window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  updateSplit(e);
});
window.addEventListener('mouseup', () => isDragging = false);

function updateSplit(e) {
  const rect = mainCanvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  splitPosition = x / rect.width;
  renderSplitView();
}

// CONTROLS INTERACTION
btnProcess.addEventListener('click', processSnapping);
document.getElementById('renderGridLines').addEventListener('change', renderSplitView);

// DOWNLOAD
btnDownload.addEventListener('click', () => {
  if (!currentSnappedCanvas) return;
  const link = document.createElement('a');
  link.download = 'pixel_snapped_64x64.png';
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
