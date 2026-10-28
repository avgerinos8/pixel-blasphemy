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
  engine: 'snapper',
  divisor: 1,
  customScaleMode: 'factor',
  customFactor: 5.0,
  customTargetW: 64,
  customTargetH: 64,
  customKeepAspect: true,
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
  grid: false,
  smartLineHealer: false,
  lineHealerSensitivity: 50,
  lineHealerMode: 'gaps',
  lineHealerMaxGap: 1,

  // Unfake.js Defaults
  unfakeDetectMethod: 'auto',
  unfakeManualScale: 8.0,
  unfakeSnapGrid: true,
  unfakeElasticGrid: true,
  unfakeDownscaleMethod: 'dominant',
  unfakeDomThreshold: 0.15,
  unfakeMorph: false,
  unfakeJaggy: false,
  unfakeAlphaBinarize: true,
  unfakeAlphaThreshold: 128,
  unfakeAutoColors: false,
  unfakeMaxColors: 32,
  unfakePalette: 'auto',
  unfakeSmartLineHealer: false,
  unfakeLineHealerSensitivity: 50,
  unfakeLineHealerMode: 'gaps',
  unfakeLineHealerMaxGap: 1
};

// Global State
let currentEngine = 'snapper'; // 'snapper' | 'unfake'
let loadedFilename = "image.png";
let rawImageElement = null;
let currentSnappedCanvas = null;
let currentActivePalette = null;
let rawOffCanvas = document.createElement('canvas');
let rawOffCtx = rawOffCanvas.getContext('2d', { willReadFrequently: true });
let adjustedOffCanvas = document.createElement('canvas');
let adjustedOffCtx = adjustedOffCanvas.getContext('2d', { willReadFrequently: true });

// Pre-Palette Adjustments State & Batch Memory
const batchImageAdjustments = new Map();
let clipboardAdjustments = null;
let currentAdjustments = createDefaultAdjustments();
let isAdjustmentsPanelOpen = false;
let cachedHistogram = new Float32Array(256);
let draggedCurvePointIdx = -1;

function createDefaultAdjustments() {
  return {
    hue: 0,
    saturation: 0,
    lightness: 0,
    brightness: 0,
    contrast: 0,
    blackPoint: 0,
    gamma: 1.0,
    whitePoint: 255,
    curvePoints: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
  };
}

let currentDivisor = 1; // 1 | 'auto' | 'custom' | 2 | 4 | 8 | 16
let customScaleMode = 'factor'; // 'factor' | 'size'
let customFactorVal = 5.0;
let customTargetWVal = 64;
let customTargetHVal = 64;
let customKeepAspectVal = true;
let detectedScale = 1;
let detectedGrid = null;
let splitPosition = 0.5;
let zoomPercent = 100;
let panOffsetX = 0;
let panOffsetY = 0;
let showGrid = false;
let batchFiles = [];
let currentBatchIndex = 0;

// Concurrency & Session Management
const PREVIEW_DEBOUNCE_MS = 220; // Multi-input debounce delay (ms)
let previewSessionId = 0;
let isUpdatingPreview = false;
let needsAnotherUpdate = false;
let previewTimeout = null;

// Reference Palette State
let paletteRefPixels = null;
let paletteRefName = "";

// DOM Elements - Shell & Viewport
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

// Engine Switcher & Containers
const engineSwitch = document.getElementById('engineSwitch');
const btnEngineSnapper = document.getElementById('btnEngineSnapper');
const btnEngineUnfake = document.getElementById('btnEngineUnfake');
const panelSnapperControls = document.getElementById('panelSnapperControls');
const panelUnfakeControls = document.getElementById('panelUnfakeControls');

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
let gridCanvas = document.getElementById('gridCanvas');
let gridAbortTimer = null;

// Pixel Snapper Controls
const scaleGroup = document.getElementById('scaleGroup');
const targetDimText = document.getElementById('targetDimText');
const snapperCustomPanel = document.getElementById('snapperCustomPanel');
const snapperCustomModeFactor = document.getElementById('snapperCustomModeFactor');
const snapperCustomModeSize = document.getElementById('snapperCustomModeSize');
const snapperCustomFactorSection = document.getElementById('snapperCustomFactorSection');
const snapperCustomFactorNum = document.getElementById('snapperCustomFactorNum');
const snapperCustomSizeSection = document.getElementById('snapperCustomSizeSection');
const snapperCustomTargetW = document.getElementById('snapperCustomTargetW');
const snapperCustomTargetH = document.getElementById('snapperCustomTargetH');
const snapperCustomKeepAspect = document.getElementById('snapperCustomKeepAspect');
const snapperCustomDivCalc = document.getElementById('snapperCustomDivCalc');

const snapperDetectBox = document.getElementById('snapperDetectBox');
const snapperDetectMethod = document.getElementById('snapperDetectMethod');
const snapperWasmBadge = document.getElementById('snapperWasmBadge');
const snapperScaleStatBadge = document.getElementById('snapperScaleStatBadge');
const snapperScaleStatText = document.getElementById('snapperScaleStatText');
const snapperManualScaleRow = document.getElementById('snapperManualScaleRow');
const snapperManualScale = document.getElementById('snapperManualScale');

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

// Palette DOM (Pixel Snapper)
const paletteSelect = document.getElementById('paletteSelect');
const palettePreview = document.getElementById('palettePreview');
const btnStartEyedropper = document.getElementById('btnStartEyedropper');
const paletteRefBadge = document.getElementById('paletteRefBadge');
const paletteRefThumb = document.getElementById('paletteRefThumb');
const paletteRefNameEl = document.getElementById('paletteRefName');
const btnClearPaletteRef = document.getElementById('btnClearPaletteRef');

// Smart Outline Healer DOM (Pixel Snapper)
const smartLineHealerToggle = document.getElementById('smartLineHealerToggle');
const lineHealerOptions = document.getElementById('lineHealerOptions');
const lineHealerSensitivity = document.getElementById('lineHealerSensitivity');
const lineHealerSensitivityNum = document.getElementById('lineHealerSensitivityNum');
const lineHealerMode = document.getElementById('lineHealerMode');
const lineHealerMaxGap = document.getElementById('lineHealerMaxGap');

// Eyedropper HUD & Live Preview
const eyedropperHud = document.getElementById('eyedropperHud');
const eyedropperHint = document.getElementById('eyedropperHint');
const toggleLivePalette = document.getElementById('toggleLivePalette');
const savePaletteName = document.getElementById('savePaletteName');
const btnSaveCustomPalette = document.getElementById('btnSaveCustomPalette');
const btnEyedropperReload = document.getElementById('btnEyedropperReload');
const btnEyedropperClear = document.getElementById('btnEyedropperClear');
const btnEyedropperCancel = document.getElementById('btnEyedropperCancel');
const eyedropperSwatches = document.getElementById('eyedropperSwatches');
const btnFinishPalette = document.getElementById('btnFinishPalette');
const eyedropperLoupe = document.getElementById('eyedropperLoupe');
const loupeColor = document.getElementById('loupeColor');
const loupeHex = document.getElementById('loupeHex');
let isEyedropperActive = false;
let pickedEyedropperColors = [];
let previousPaletteChoice = 'auto';

// Advanced Color Picker DOM
const advColorPickerModal = document.getElementById('advColorPickerModal');
const btnAdvPickerClose = document.getElementById('btnAdvPickerClose');
const btnAdvPickerCancel = document.getElementById('btnAdvPickerCancel');
const btnAdvPickerApply = document.getElementById('btnAdvPickerApply');
const advSwatchCompare = document.getElementById('advSwatchCompare');
const advSwatchNew = document.getElementById('advSwatchNew');
const advSwatchOrig = document.getElementById('advSwatchOrig');
const advHexInput = document.getElementById('advHexInput');
const advReadoutHsl = document.getElementById('advReadoutHsl');
const advReadoutRgb = document.getElementById('advReadoutRgb');
const advPickerWheelCanvas = document.getElementById('advPickerWheelCanvas');
const advSliderH = document.getElementById('advSliderH');
const advNumH = document.getElementById('advNumH');
const advSliderS = document.getElementById('advSliderS');
const advNumS = document.getElementById('advNumS');
const advSliderB = document.getElementById('advSliderB');
const advNumB = document.getElementById('advNumB');
const advSliderR = document.getElementById('advSliderR');
const advNumR = document.getElementById('advNumR');
const advSliderG = document.getElementById('advSliderG');
const advNumG = document.getElementById('advNumG');
const advSliderBlue = document.getElementById('advSliderBlue');
const advNumBlue = document.getElementById('advNumBlue');
const advHarmoniesStrip = document.getElementById('advHarmoniesStrip');
const advHarmoniesSub = document.getElementById('advHarmoniesSub');
const advColorHistoryGrid = document.getElementById('advColorHistoryGrid');
const btnAdvHistoryClear = document.getElementById('btnAdvHistoryClear');

// Options Profile Save / Load DOM
const btnSaveOptions = document.getElementById('btnSaveOptions');
const btnLoadOptions = document.getElementById('btnLoadOptions');
const optionsFileInput = document.getElementById('optionsFileInput');
const optionsLoadModal = document.getElementById('optionsLoadModal');
const btnOptionsModalClose = document.getElementById('btnOptionsModalClose');
const btnOptionsModalCancel = document.getElementById('btnOptionsModalCancel');
const savedOptionsList = document.getElementById('savedOptionsList');
const btnBrowseOptionsFile = document.getElementById('btnBrowseOptionsFile');

// Unfake.js Controls DOM
const unfakeScaleGroup = document.getElementById('unfakeScaleGroup');
const unfakeTargetDimText = document.getElementById('unfakeTargetDimText');
const unfakeCustomPanel = document.getElementById('unfakeCustomPanel');
const unfakeCustomModeFactor = document.getElementById('unfakeCustomModeFactor');
const unfakeCustomModeSize = document.getElementById('unfakeCustomModeSize');
const unfakeCustomFactorSection = document.getElementById('unfakeCustomFactorSection');
const unfakeCustomFactorNum = document.getElementById('unfakeCustomFactorNum');
const unfakeCustomSizeSection = document.getElementById('unfakeCustomSizeSection');
const unfakeCustomTargetW = document.getElementById('unfakeCustomTargetW');
const unfakeCustomTargetH = document.getElementById('unfakeCustomTargetH');
const unfakeCustomKeepAspect = document.getElementById('unfakeCustomKeepAspect');
const unfakeCustomDivCalc = document.getElementById('unfakeCustomDivCalc');

const unfakeDetectBox = document.getElementById('unfakeDetectBox');
const unfakeDetectMethod = document.getElementById('unfakeDetectMethod');
const unfakeWasmBadge = document.getElementById('unfakeWasmBadge');
const unfakeScaleStatBadge = document.getElementById('unfakeScaleStatBadge');
const unfakeScaleStatText = document.getElementById('unfakeScaleStatText');
const unfakeManualScaleRow = document.getElementById('unfakeManualScaleRow');
const unfakeManualScale = document.getElementById('unfakeManualScale');
const unfakeSnapGrid = document.getElementById('unfakeSnapGrid');
const unfakeElasticGrid = document.getElementById('unfakeElasticGrid');
const unfakeDownscaleMethod = document.getElementById('unfakeDownscaleMethod');
const unfakeDomThreshold = document.getElementById('unfakeDomThreshold');
const unfakeDomThresholdNum = document.getElementById('unfakeDomThresholdNum');
const btnUnfakeDownload = document.getElementById('btnUnfakeDownload');
const unfakeDownloadNameLabel = document.getElementById('unfakeDownloadNameLabel');

const unfakeMorph = document.getElementById('unfakeMorph');
const unfakeJaggy = document.getElementById('unfakeJaggy');
const unfakeAlphaBinarize = document.getElementById('unfakeAlphaBinarize');
const unfakeAlphaThresholdRow = document.getElementById('unfakeAlphaThresholdRow');
const unfakeAlphaThreshold = document.getElementById('unfakeAlphaThreshold');
const unfakeAlphaThresholdNum = document.getElementById('unfakeAlphaThresholdNum');
const unfakeAutoColors = document.getElementById('unfakeAutoColors');
const unfakeMaxColorsRow = document.getElementById('unfakeMaxColorsRow');
const unfakeMaxColors = document.getElementById('unfakeMaxColors');
const unfakeMaxColorsNum = document.getElementById('unfakeMaxColorsNum');
const unfakePaletteSelect = document.getElementById('unfakePaletteSelect');
const btnUnfakeStartEyedropper = document.getElementById('btnUnfakeStartEyedropper');
const unfakePaletteRefBadge = document.getElementById('unfakePaletteRefBadge');
const unfakePaletteRefThumb = document.getElementById('unfakePaletteRefThumb');
const unfakePaletteRefName = document.getElementById('unfakePaletteRefName');
const btnUnfakeClearPaletteRef = document.getElementById('btnUnfakeClearPaletteRef');
const unfakePalettePreview = document.getElementById('unfakePalettePreview');

// Smart Outline Healer DOM (Unfake.js)
const unfakeSmartLineHealerToggle = document.getElementById('unfakeSmartLineHealerToggle');
const unfakeLineHealerOptions = document.getElementById('unfakeLineHealerOptions');
const unfakeLineHealerSensitivity = document.getElementById('unfakeLineHealerSensitivity');
const unfakeLineHealerSensitivityNum = document.getElementById('unfakeLineHealerSensitivityNum');
const unfakeLineHealerMode = document.getElementById('unfakeLineHealerMode');
const unfakeLineHealerMaxGap = document.getElementById('unfakeLineHealerMaxGap');

const unfakeBatchDrawer = document.getElementById('unfakeBatchDrawer');
const unfakeBatchCount = document.getElementById('unfakeBatchCount');
const unfakeBatchList = document.getElementById('unfakeBatchList');
const btnUnfakeProcessBatch = document.getElementById('btnUnfakeProcessBatch');

// Batch Actions & Navigation
const batchAddFileInput = document.getElementById('batchAddFileInput');
const btnAddBatchFiles1 = document.getElementById('btnAddBatchFiles1');
const btnClearBatch1 = document.getElementById('btnClearBatch1');
const btnAddBatchFiles2 = document.getElementById('btnAddBatchFiles2');
const btnClearBatch2 = document.getElementById('btnClearBatch2');
const batchNavToolbar = document.getElementById('batchNavToolbar');
const btnBatchPrev = document.getElementById('btnBatchPrev');
const btnBatchNext = document.getElementById('btnBatchNext');
const batchNavBadge = document.getElementById('batchNavBadge');
const batchSelectDropdown = document.getElementById('batchSelectDropdown');
const batchSamePalette1 = document.getElementById('batchSamePalette1');
const batchSamePalette2 = document.getElementById('batchSamePalette2');
let isBatchSamePalette = false;
let masterBatchPalette = null;

// Download & Stats
const btnDownload = document.getElementById('btnDownload');
const downloadNameLabel = document.getElementById('downloadNameLabel');
const origRes = document.getElementById('origRes');
const snappedRes = document.getElementById('snappedRes');
const activeColors = document.getElementById('activeColors');
const pipelineTag = document.getElementById('pipelineTag');
const statsZoom = document.getElementById('statsZoom');
const splitPercent = document.getElementById('splitPercent');

// Pre-Palette Adjustments DOM Elements
const adjustmentsPanel = document.getElementById('adjustmentsPanel');
const btnToggleAdjustments = document.getElementById('btnToggleAdjustments');
const btnResetAllAdjustments = document.getElementById('btnResetAllAdjustments');
const btnCloseAdjustments = document.getElementById('btnCloseAdjustments');

const adjHue = document.getElementById('adjHue');
const adjSat = document.getElementById('adjSat');
const adjLight = document.getElementById('adjLight');
const adjBright = document.getElementById('adjBright');
const adjContrast = document.getElementById('adjContrast');

const adjHueVal = document.getElementById('adjHueVal');
const adjSatVal = document.getElementById('adjSatVal');
const adjLightVal = document.getElementById('adjLightVal');
const adjBrightVal = document.getElementById('adjBrightVal');
const adjContrastVal = document.getElementById('adjContrastVal');

const curvesCanvas = document.getElementById('curvesCanvas');
const btnResetCurve = document.getElementById('btnResetCurve');

const adjBlack = document.getElementById('adjBlack');
const adjGamma = document.getElementById('adjGamma');
const adjWhite = document.getElementById('adjWhite');

const adjBlackVal = document.getElementById('adjBlackVal');
const adjGammaVal = document.getElementById('adjGammaVal');
const adjWhiteVal = document.getElementById('adjWhiteVal');

const btnCopyAdjustments = document.getElementById('btnCopyAdjustments');
const btnPasteAdjustments = document.getElementById('btnPasteAdjustments');
const btnApplyAdjustmentsAll = document.getElementById('btnApplyAdjustmentsAll');

// =============================================================================
// IN-PAGE CUSTOM CYBERPUNK CONFIRMATION & ALERT MODAL SYSTEM
// =============================================================================
const customConfirmModal = document.getElementById('customConfirmModal');
const customModalTitle = document.getElementById('customModalTitle');
const customModalMessage = document.getElementById('customModalMessage');
const customModalDetails = document.getElementById('customModalDetails');
const customModalIcon = document.getElementById('customModalIcon');
const btnCustomModalConfirm = document.getElementById('btnCustomModalConfirm');
const btnCustomModalCancel = document.getElementById('btnCustomModalCancel');
const btnCustomModalClose = document.getElementById('btnCustomModalClose');

let activeModalResolve = null;

function showConfirmModal({
  title = 'CONFIRM ACTION',
  message = '',
  details = '',
  confirmText = 'CONFIRM',
  cancelText = 'CANCEL',
  icon = '&#9888;',
  danger = false
} = {}) {
  return new Promise((resolve) => {
    if (!customConfirmModal) {
      resolve(window.confirm(message));
      return;
    }

    activeModalResolve = resolve;
    const dialog = customConfirmModal.querySelector('.custom-modal-dialog');
    if (dialog) dialog.classList.toggle('danger-mode', !!danger);

    customModalTitle.textContent = title;
    customModalMessage.textContent = message;
    customModalIcon.innerHTML = icon;

    if (details) {
      customModalDetails.textContent = details;
      customModalDetails.style.display = 'block';
    } else {
      customModalDetails.style.display = 'none';
    }

    btnCustomModalConfirm.textContent = confirmText;
    btnCustomModalCancel.textContent = cancelText;
    btnCustomModalCancel.style.display = 'inline-block';

    customConfirmModal.style.display = 'flex';
    btnCustomModalConfirm.focus();
  });
}

function showAlertModal({
  title = 'NOTICE',
  message = '',
  details = '',
  okText = 'OK',
  icon = '&#9432;',
  danger = false
} = {}) {
  return new Promise((resolve) => {
    if (!customConfirmModal) {
      window.alert(message);
      resolve();
      return;
    }

    activeModalResolve = () => resolve();
    const dialog = customConfirmModal.querySelector('.custom-modal-dialog');
    if (dialog) dialog.classList.toggle('danger-mode', !!danger);

    customModalTitle.textContent = title;
    customModalMessage.textContent = message;
    customModalIcon.innerHTML = icon;

    if (details) {
      customModalDetails.textContent = details;
      customModalDetails.style.display = 'block';
    } else {
      customModalDetails.style.display = 'none';
    }

    btnCustomModalConfirm.textContent = okText;
    btnCustomModalCancel.style.display = 'none';

    customConfirmModal.style.display = 'flex';
    btnCustomModalConfirm.focus();
  });
}

function closeCustomModal(result) {
  if (customConfirmModal) {
    customConfirmModal.style.display = 'none';
  }
  if (activeModalResolve) {
    const fn = activeModalResolve;
    activeModalResolve = null;
    fn(result);
  }
}

if (btnCustomModalConfirm) {
  btnCustomModalConfirm.addEventListener('click', () => closeCustomModal(true));
}
if (btnCustomModalCancel) {
  btnCustomModalCancel.addEventListener('click', () => closeCustomModal(false));
}
if (btnCustomModalClose) {
  btnCustomModalClose.addEventListener('click', () => closeCustomModal(false));
}

window.addEventListener('keydown', (e) => {
  if (customConfirmModal && customConfirmModal.style.display !== 'none') {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCustomModal(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      closeCustomModal(true);
    }
  }
});

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

// SETUP SYNCED CONTROLS (PIXEL SNAPPER)
syncSliderAndNum(outlineWeight, outlineWeightNum, () => triggerPreviewDebounced());
syncSliderAndNum(edgeSensitivity, edgeSensitivityNum, () => triggerPreviewDebounced());

let previousColorCount = parseInt(colorCount.value) || 16;
let previousUnfakeMaxColors = parseInt(unfakeMaxColors.value) || 32;

function handleColorBudgetChange(newVal, isUnfake = false) {
  if (isUnfake) {
    previousUnfakeMaxColors = newVal;
  } else {
    previousColorCount = newVal;
  }

  const pChoice = currentEngine === 'unfake' ? unfakePaletteSelect.value : paletteSelect.value;
  // User directive: NEVER reset, delete or wipe custom palettes when changing the color budget.
  // ONLY recalculate and run K-Means if the palette source is currently explicitly 'auto'!
  if (pChoice === 'auto') {
    currentActivePalette = null;
    updatePalettePreview();
    triggerPreviewDebounced();
  }
}

function handleKMeansIterChange() {
  const pChoice = currentEngine === 'unfake' ? unfakePaletteSelect.value : paletteSelect.value;
  if (pChoice === 'auto') {
    currentActivePalette = null;
    triggerPreviewDebounced();
  }
}

syncSliderAndNum(colorCount, colorCountNum, (val) => handleColorBudgetChange(parseInt(val) || 16, false));
syncSliderAndNum(kmeansIter, kmeansIterNum, () => handleKMeansIterChange());
syncSliderAndNum(tezumieStrength, tezumieStrengthNum, () => triggerPreviewDebounced());

// SETUP SYNCED CONTROLS (UNFAKE.JS)
syncSliderAndNum(unfakeDomThreshold, unfakeDomThresholdNum, () => triggerPreviewDebounced());
syncSliderAndNum(unfakeAlphaThreshold, unfakeAlphaThresholdNum, () => triggerPreviewDebounced());
syncSliderAndNum(unfakeMaxColors, unfakeMaxColorsNum, (val) => handleColorBudgetChange(parseInt(val) || 32, true));

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

// SMART OUTLINE HEALER TOGGLES & SYNC (OFF BY DEFAULT)
if (smartLineHealerToggle) smartLineHealerToggle.checked = false;
if (unfakeSmartLineHealerToggle) unfakeSmartLineHealerToggle.checked = false;
if (lineHealerOptions) lineHealerOptions.style.display = 'none';
if (unfakeLineHealerOptions) unfakeLineHealerOptions.style.display = 'none';

if (smartLineHealerToggle) {
  smartLineHealerToggle.addEventListener('change', () => {
    const isChecked = smartLineHealerToggle.checked;
    if (lineHealerOptions) lineHealerOptions.style.display = isChecked ? 'block' : 'none';
    if (unfakeSmartLineHealerToggle) {
      unfakeSmartLineHealerToggle.checked = isChecked;
      if (unfakeLineHealerOptions) unfakeLineHealerOptions.style.display = isChecked ? 'block' : 'none';
    }
    triggerPreviewDebounced();
  });
}
if (unfakeSmartLineHealerToggle) {
  unfakeSmartLineHealerToggle.addEventListener('change', () => {
    const isChecked = unfakeSmartLineHealerToggle.checked;
    if (unfakeLineHealerOptions) unfakeLineHealerOptions.style.display = isChecked ? 'block' : 'none';
    if (smartLineHealerToggle) {
      smartLineHealerToggle.checked = isChecked;
      if (lineHealerOptions) lineHealerOptions.style.display = isChecked ? 'block' : 'none';
    }
    triggerPreviewDebounced();
  });
}
syncSliderAndNum(lineHealerSensitivity, lineHealerSensitivityNum, (val) => {
  if (unfakeLineHealerSensitivity) unfakeLineHealerSensitivity.value = val;
  if (unfakeLineHealerSensitivityNum) unfakeLineHealerSensitivityNum.value = val;
  triggerPreviewDebounced();
});
syncSliderAndNum(unfakeLineHealerSensitivity, unfakeLineHealerSensitivityNum, (val) => {
  if (lineHealerSensitivity) lineHealerSensitivity.value = val;
  if (lineHealerSensitivityNum) lineHealerSensitivityNum.value = val;
  triggerPreviewDebounced();
});
if (lineHealerMode) {
  lineHealerMode.addEventListener('change', () => {
    if (unfakeLineHealerMode) unfakeLineHealerMode.value = lineHealerMode.value;
    triggerPreviewDebounced();
  });
}
if (unfakeLineHealerMode) {
  unfakeLineHealerMode.addEventListener('change', () => {
    if (lineHealerMode) lineHealerMode.value = unfakeLineHealerMode.value;
    triggerPreviewDebounced();
  });
}
if (lineHealerMaxGap) {
  lineHealerMaxGap.addEventListener('input', () => {
    if (unfakeLineHealerMaxGap) unfakeLineHealerMaxGap.value = lineHealerMaxGap.value;
    triggerPreviewDebounced();
  });
}
if (unfakeLineHealerMaxGap) {
  unfakeLineHealerMaxGap.addEventListener('input', () => {
    if (lineHealerMaxGap) lineHealerMaxGap.value = unfakeLineHealerMaxGap.value;
    triggerPreviewDebounced();
  });
}

// ENGINE SWITCHER HANDLER
function setEngine(engine) {
  currentEngine = engine;
  btnEngineSnapper.classList.toggle('active', engine === 'snapper');
  btnEngineUnfake.classList.toggle('active', engine === 'unfake');
  panelSnapperControls.style.display = engine === 'snapper' ? 'grid' : 'none';
  panelUnfakeControls.style.display = engine === 'unfake' ? 'grid' : 'none';

  // Sync palette selection across engines
  if (engine === 'unfake') {
    unfakePaletteSelect.value = paletteSelect.value;
  } else {
    paletteSelect.value = unfakePaletteSelect.value;
  }
  updatePalettePreview();
  updateDimensionsUI();
  triggerPreviewDebounced();
}

btnEngineSnapper.addEventListener('click', () => setEngine('snapper'));
btnEngineUnfake.addEventListener('click', () => setEngine('unfake'));

// SCALE SELECTION, SYNC & CUSTOM DOWNSCALE LOGIC (AUTO / 1x / /2 / /4 / /8 / /16 / /CUSTOM)
function getEffectiveDivisor() {
  if (currentDivisor === 'auto') {
    return detectedScale > 0 ? detectedScale : 1;
  }
  if (currentDivisor === 'custom') {
    if (customScaleMode === 'factor') {
      const f = parseFloat(customFactorVal) || 1;
      return f > 0 ? f : 1;
    } else {
      if (!rawImageElement) return 1;
      const w = rawImageElement.naturalWidth || rawImageElement.width;
      const tw = Math.max(1, parseInt(customTargetWVal) || 64);
      const div = w / tw;
      return div > 0 ? div : 1;
    }
  }
  return parseFloat(currentDivisor) || 1;
}

function updateCustomCalculatedDiv() {
  const eff = getEffectiveDivisor();
  const effStr = Number.isInteger(eff) ? `${eff}x` : `${eff.toFixed(2)}x`;
  const text = `Effective: /${effStr}`;
  if (snapperCustomDivCalc) snapperCustomDivCalc.textContent = text;
  if (unfakeCustomDivCalc) unfakeCustomDivCalc.textContent = text;
}

function setCustomScaleMode(mode) {
  customScaleMode = mode;
  [snapperCustomModeFactor, unfakeCustomModeFactor].forEach(btn => {
    if (btn) btn.classList.toggle('active', mode === 'factor');
  });
  [snapperCustomModeSize, unfakeCustomModeSize].forEach(btn => {
    if (btn) btn.classList.toggle('active', mode === 'size');
  });

  [snapperCustomFactorSection, unfakeCustomFactorSection].forEach(sec => {
    if (sec) sec.style.display = mode === 'factor' ? 'block' : 'none';
  });
  [snapperCustomSizeSection, unfakeCustomSizeSection].forEach(sec => {
    if (sec) sec.style.display = mode === 'size' ? 'block' : 'none';
  });

  updateCustomCalculatedDiv();
  updateDimensionsUI();
  triggerPreviewDebounced();
}

function updateScaleDetectorState() {
  const isAuto = currentDivisor === 'auto';

  // Toggle inactive class and disabled on boxes & selects
  [snapperDetectBox, unfakeDetectBox].forEach(box => {
    if (!box) return;
    box.classList.toggle('is-inactive', !isAuto);
  });

  [snapperDetectMethod, unfakeDetectMethod].forEach(sel => {
    if (!sel) return;
    sel.disabled = !isAuto;
    sel.title = isAuto ? "Select scale detection algorithm" : "Select AUTO in Downscale to enable Scale Detector";
  });

  [snapperManualScale, unfakeManualScale].forEach(inp => {
    if (!inp) return;
    inp.disabled = !isAuto;
  });

  if (!isAuto) {
    if (snapperScaleStatText) snapperScaleStatText.textContent = "Inactive (Select AUTO to enable)";
    if (unfakeScaleStatText) unfakeScaleStatText.textContent = "Inactive (Select AUTO to enable)";
  } else {
    if (detectedScale > 1) {
      const scaleDesc = Number.isInteger(detectedScale) ? `${detectedScale}x` : `${detectedScale.toFixed(2)}x`;
      const text = `Auto: /${scaleDesc}`;
      if (snapperScaleStatText) snapperScaleStatText.textContent = text;
      if (unfakeScaleStatText) unfakeScaleStatText.textContent = text;
    } else if (rawImageElement) {
      if (snapperScaleStatText) snapperScaleStatText.textContent = "Analyzing scale...";
      if (unfakeScaleStatText) unfakeScaleStatText.textContent = "Analyzing scale...";
    } else {
      if (snapperScaleStatText) snapperScaleStatText.textContent = "Waiting for image...";
      if (unfakeScaleStatText) unfakeScaleStatText.textContent = "Waiting for image...";
    }
  }

  // Update WASM badges
  if (window.UnfakeEngine) {
    const isWasm = window.UnfakeEngine.isWasmActive();
    [snapperWasmBadge, unfakeWasmBadge].forEach(badge => {
      if (!badge) return;
      badge.textContent = isWasm ? 'RUST WASM' : 'PURE JS';
      badge.style.color = isWasm ? 'var(--accent-green)' : 'var(--accent-yellow)';
    });
  }
}

function selectDivisor(d) {
  currentDivisor = d;

  [scaleGroup, unfakeScaleGroup].forEach(group => {
    if (!group) return;
    group.querySelectorAll('.scale-btn').forEach(btn => {
      const btnDiv = btn.dataset.divisor;
      if (d === 'auto') {
        btn.classList.toggle('active', btnDiv === 'auto');
      } else if (d === 'custom') {
        btn.classList.toggle('active', btnDiv === 'custom');
      } else {
        btn.classList.toggle('active', btnDiv == d);
      }
    });
  });

  // Toggle Custom Panels
  const isCustom = d === 'custom';
  if (snapperCustomPanel) snapperCustomPanel.style.display = isCustom ? 'block' : 'none';
  if (unfakeCustomPanel) unfakeCustomPanel.style.display = isCustom ? 'block' : 'none';

  updateScaleDetectorState();
  updateCustomCalculatedDiv();

  const eff = getEffectiveDivisor();
  const effStr = Number.isInteger(eff) ? `${eff}` : eff.toFixed(2);
  btnResetZoom.title = `Reset to Native 1:1 Scale (1/${effStr} = ${Math.round(100/eff)}%)`;
  updateDimensionsUI();
}

[scaleGroup, unfakeScaleGroup].forEach(group => {
  if (!group) return;
  group.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const val = btn.dataset.divisor;
      const targetDiv = val === 'auto' ? 'auto' : (val === 'custom' ? 'custom' : (parseInt(val) || 1));
      selectDivisor(targetDiv);
      if (targetDiv === 'auto' && rawImageElement) {
        await runScaleDetection();
      }
      triggerPreviewDebounced();
    });
  });
});

// SCALE DETECTOR METHOD & MANUAL SCALE SYNC
function onDetectMethodChange(val) {
  if (snapperDetectMethod) snapperDetectMethod.value = val;
  if (unfakeDetectMethod) unfakeDetectMethod.value = val;

  const isManual = val === 'manual';
  if (snapperManualScaleRow) snapperManualScaleRow.style.display = isManual ? 'block' : 'none';
  if (unfakeManualScaleRow) unfakeManualScaleRow.style.display = isManual ? 'block' : 'none';

  if (currentDivisor === 'auto') {
    runScaleDetection().then(() => triggerPreviewDebounced());
  }
}

if (snapperDetectMethod) {
  snapperDetectMethod.addEventListener('change', () => onDetectMethodChange(snapperDetectMethod.value));
}
if (unfakeDetectMethod) {
  unfakeDetectMethod.addEventListener('change', () => onDetectMethodChange(unfakeDetectMethod.value));
}

function onManualScaleChange(val) {
  const num = Math.max(0.1, parseFloat(val) || 1);
  detectedScale = num;
  if (snapperManualScale) snapperManualScale.value = num;
  if (unfakeManualScale) unfakeManualScale.value = num;

  const desc = `Manual: ${num}x`;
  if (snapperScaleStatText) snapperScaleStatText.textContent = desc;
  if (unfakeScaleStatText) unfakeScaleStatText.textContent = desc;

  if (currentDivisor === 'auto') {
    updateDimensionsUI();
    triggerPreviewDebounced();
  }
}

if (snapperManualScale) {
  snapperManualScale.addEventListener('input', () => onManualScaleChange(snapperManualScale.value));
}
if (unfakeManualScale) {
  unfakeManualScale.addEventListener('input', () => onManualScaleChange(unfakeManualScale.value));
}

// CUSTOM DOWNSCALE CONTROLS LISTENERS
[snapperCustomModeFactor, unfakeCustomModeFactor].forEach(btn => {
  if (btn) btn.addEventListener('click', () => setCustomScaleMode('factor'));
});
[snapperCustomModeSize, unfakeCustomModeSize].forEach(btn => {
  if (btn) btn.addEventListener('click', () => setCustomScaleMode('size'));
});

function onCustomFactorChange(val) {
  customFactorVal = Math.max(0.01, parseFloat(val) || 1);
  if (snapperCustomFactorNum) snapperCustomFactorNum.value = customFactorVal;
  if (unfakeCustomFactorNum) unfakeCustomFactorNum.value = customFactorVal;
  updateCustomCalculatedDiv();
  updateDimensionsUI();
  triggerPreviewDebounced();
}

if (snapperCustomFactorNum) {
  snapperCustomFactorNum.addEventListener('input', () => onCustomFactorChange(snapperCustomFactorNum.value));
}
if (unfakeCustomFactorNum) {
  unfakeCustomFactorNum.addEventListener('input', () => onCustomFactorChange(unfakeCustomFactorNum.value));
}

document.querySelectorAll('.btn-factor-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const factor = parseFloat(chip.dataset.val) || 5;
    onCustomFactorChange(factor);
  });
});

function onCustomTargetWChange(val) {
  customTargetWVal = Math.max(1, parseInt(val) || 64);
  if (customKeepAspectVal && rawImageElement) {
    const origW = rawImageElement.naturalWidth || rawImageElement.width;
    const origH = rawImageElement.naturalHeight || rawImageElement.height;
    customTargetHVal = Math.max(1, Math.round(customTargetWVal * (origH / origW)));
  }
  syncTargetSizeInputs();
  updateCustomCalculatedDiv();
  updateDimensionsUI();
  triggerPreviewDebounced();
}

function onCustomTargetHChange(val) {
  customTargetHVal = Math.max(1, parseInt(val) || 64);
  if (customKeepAspectVal && rawImageElement) {
    const origW = rawImageElement.naturalWidth || rawImageElement.width;
    const origH = rawImageElement.naturalHeight || rawImageElement.height;
    customTargetWVal = Math.max(1, Math.round(customTargetHVal * (origW / origH)));
  }
  syncTargetSizeInputs();
  updateCustomCalculatedDiv();
  updateDimensionsUI();
  triggerPreviewDebounced();
}

function syncTargetSizeInputs() {
  if (snapperCustomTargetW) snapperCustomTargetW.value = customTargetWVal;
  if (unfakeCustomTargetW) unfakeCustomTargetW.value = customTargetWVal;
  if (snapperCustomTargetH) snapperCustomTargetH.value = customTargetHVal;
  if (unfakeCustomTargetH) unfakeCustomTargetH.value = customTargetHVal;
}

if (snapperCustomTargetW) snapperCustomTargetW.addEventListener('input', () => onCustomTargetWChange(snapperCustomTargetW.value));
if (unfakeCustomTargetW) unfakeCustomTargetW.addEventListener('input', () => onCustomTargetWChange(unfakeCustomTargetW.value));

if (snapperCustomTargetH) snapperCustomTargetH.addEventListener('input', () => onCustomTargetHChange(snapperCustomTargetH.value));
if (unfakeCustomTargetH) unfakeCustomTargetH.addEventListener('input', () => onCustomTargetHChange(unfakeCustomTargetH.value));

[snapperCustomKeepAspect, unfakeCustomKeepAspect].forEach(chk => {
  if (!chk) return;
  chk.addEventListener('change', () => {
    customKeepAspectVal = chk.checked;
    if (snapperCustomKeepAspect) snapperCustomKeepAspect.checked = customKeepAspectVal;
    if (unfakeCustomKeepAspect) unfakeCustomKeepAspect.checked = customKeepAspectVal;
    if (customKeepAspectVal && rawImageElement) {
      onCustomTargetWChange(customTargetWVal);
    }
  });
});

document.querySelectorAll('.btn-size-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const w = parseInt(chip.dataset.w) || 64;
    const h = parseInt(chip.dataset.h) || 64;
    customTargetWVal = w;
    customTargetHVal = h;
    syncTargetSizeInputs();
    updateCustomCalculatedDiv();
    updateDimensionsUI();
    triggerPreviewDebounced();
  });
});

// Initial Downscale & Custom Scale Setup
selectDivisor(DEFAULTS.divisor);
setCustomScaleMode(DEFAULTS.customScaleMode);

unfakeSnapGrid.addEventListener('change', () => triggerPreviewDebounced());
unfakeElasticGrid.addEventListener('change', () => triggerPreviewDebounced());
unfakeDownscaleMethod.addEventListener('change', () => triggerPreviewDebounced());
unfakeMorph.addEventListener('change', () => triggerPreviewDebounced());
unfakeJaggy.addEventListener('change', () => triggerPreviewDebounced());
unfakeAlphaBinarize.addEventListener('change', () => {
  unfakeAlphaThresholdRow.style.display = unfakeAlphaBinarize.checked ? 'block' : 'none';
  triggerPreviewDebounced();
});
unfakeAutoColors.addEventListener('change', () => {
  unfakeMaxColorsRow.style.opacity = unfakeAutoColors.checked ? '0.5' : '1';
  triggerPreviewDebounced();
});

// TOP ACTION BUTTONS: OPEN MAIN & OPEN PALETTE
btnOpenMainImage.addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});

btnOpenPaletteImage.addEventListener('click', () => {
  paletteFileInput.value = '';
  paletteFileInput.click();
});

// MASTER RESET ALL SETTINGS TO DEFAULTS
btnResetAll.addEventListener('click', () => {
  setEngine(DEFAULTS.engine);
  selectDivisor(DEFAULTS.divisor);
  setCustomScaleMode(DEFAULTS.customScaleMode);
  customFactorVal = DEFAULTS.customFactor;
  customTargetWVal = DEFAULTS.customTargetW;
  customTargetHVal = DEFAULTS.customTargetH;
  customKeepAspectVal = DEFAULTS.customKeepAspect;
  syncTargetSizeInputs();
  if (snapperCustomFactorNum) snapperCustomFactorNum.value = customFactorVal;
  if (unfakeCustomFactorNum) unfakeCustomFactorNum.value = customFactorVal;

  // Pixel Snapper defaults
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

  // Unfake.js defaults
  if (snapperDetectMethod) snapperDetectMethod.value = DEFAULTS.unfakeDetectMethod;
  if (unfakeDetectMethod) unfakeDetectMethod.value = DEFAULTS.unfakeDetectMethod;
  if (snapperManualScaleRow) snapperManualScaleRow.style.display = 'none';
  if (unfakeManualScaleRow) unfakeManualScaleRow.style.display = 'none';
  if (snapperManualScale) snapperManualScale.value = DEFAULTS.unfakeManualScale;
  if (unfakeManualScale) unfakeManualScale.value = DEFAULTS.unfakeManualScale;
  unfakeSnapGrid.checked = DEFAULTS.unfakeSnapGrid;
  unfakeElasticGrid.checked = DEFAULTS.unfakeElasticGrid;
  unfakeDownscaleMethod.value = DEFAULTS.unfakeDownscaleMethod;
  unfakeDomThreshold.value = DEFAULTS.unfakeDomThreshold;
  unfakeDomThresholdNum.value = DEFAULTS.unfakeDomThreshold;
  unfakeMorph.checked = DEFAULTS.unfakeMorph;
  unfakeJaggy.checked = DEFAULTS.unfakeJaggy;
  unfakeAlphaBinarize.checked = DEFAULTS.unfakeAlphaBinarize;
  unfakeAlphaThresholdRow.style.display = 'block';
  unfakeAlphaThreshold.value = DEFAULTS.unfakeAlphaThreshold;
  unfakeAlphaThresholdNum.value = DEFAULTS.unfakeAlphaThreshold;
  unfakeAutoColors.checked = DEFAULTS.unfakeAutoColors;
  unfakeMaxColorsRow.style.opacity = '1';
  unfakeMaxColors.value = DEFAULTS.unfakeMaxColors;
  unfakeMaxColorsNum.value = DEFAULTS.unfakeMaxColors;
  unfakePaletteSelect.value = DEFAULTS.unfakePalette;

  if (smartLineHealerToggle) smartLineHealerToggle.checked = DEFAULTS.smartLineHealer;
  if (lineHealerOptions) lineHealerOptions.style.display = 'none';
  if (lineHealerSensitivity) lineHealerSensitivity.value = DEFAULTS.lineHealerSensitivity;
  if (lineHealerSensitivityNum) lineHealerSensitivityNum.value = DEFAULTS.lineHealerSensitivity;
  if (lineHealerMode) lineHealerMode.value = DEFAULTS.lineHealerMode;
  if (lineHealerMaxGap) lineHealerMaxGap.value = DEFAULTS.lineHealerMaxGap;
  if (unfakeSmartLineHealerToggle) unfakeSmartLineHealerToggle.checked = DEFAULTS.unfakeSmartLineHealer;
  if (unfakeLineHealerOptions) unfakeLineHealerOptions.style.display = 'none';
  if (unfakeLineHealerSensitivity) unfakeLineHealerSensitivity.value = DEFAULTS.unfakeLineHealerSensitivity;
  if (unfakeLineHealerSensitivityNum) unfakeLineHealerSensitivityNum.value = DEFAULTS.unfakeLineHealerSensitivity;
  if (unfakeLineHealerMode) unfakeLineHealerMode.value = DEFAULTS.unfakeLineHealerMode;
  if (unfakeLineHealerMaxGap) unfakeLineHealerMaxGap.value = DEFAULTS.unfakeLineHealerMaxGap;

  showGrid = DEFAULTS.grid;
  if (gridAbortTimer) {
    clearTimeout(gridAbortTimer);
    gridAbortTimer = null;
  }
  btnToggleGrid.classList.remove('btn-grid-active', 'btn-grid-aborted');
  btnToggleGrid.innerHTML = '&#9638; GRID: OFF';
  renderGridOverlay();

  updatePalettePreview();
  updateDimensionsUI();
  triggerPreviewDebounced();
});

// INDIVIDUAL PARAMETER RESET BUTTONS
document.querySelectorAll('.btn-reset-param').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const param = btn.dataset.param;

    if (param === 'divisor' || param === 'unfakeDivisor') {
      selectDivisor(DEFAULTS.divisor);
      if (DEFAULTS.divisor === 'auto' && rawImageElement) await runScaleDetection();
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
      await handleColorBudgetChange(DEFAULTS.colorCount, false);
    } else if (param === 'kmeansIter') {
      kmeansIter.value = DEFAULTS.kmeansIter;
      kmeansIterNum.value = DEFAULTS.kmeansIter;
      handleKMeansIterChange();
    } else if (param === 'palette') {
      paletteSelect.value = DEFAULTS.palette;
      unfakePaletteSelect.value = DEFAULTS.palette;
      updatePalettePreview();
      triggerPreviewDebounced();
    } else if (param === 'unfakeSnapGrid') {
      unfakeSnapGrid.checked = DEFAULTS.unfakeSnapGrid;
    } else if (param === 'unfakeElasticGrid') {
      unfakeElasticGrid.checked = DEFAULTS.unfakeElasticGrid;
    } else if (param === 'unfakeDownscaleMethod') {
      unfakeDownscaleMethod.value = DEFAULTS.unfakeDownscaleMethod;
    } else if (param === 'unfakeMorph') {
      unfakeMorph.checked = DEFAULTS.unfakeMorph;
    } else if (param === 'unfakeJaggy') {
      unfakeJaggy.checked = DEFAULTS.unfakeJaggy;
    } else if (param === 'unfakeAlpha') {
      unfakeAlphaBinarize.checked = DEFAULTS.unfakeAlphaBinarize;
      unfakeAlphaThreshold.value = DEFAULTS.unfakeAlphaThreshold;
      unfakeAlphaThresholdNum.value = DEFAULTS.unfakeAlphaThreshold;
    } else if (param === 'unfakeAutoColors') {
      unfakeAutoColors.checked = DEFAULTS.unfakeAutoColors;
      unfakeMaxColorsRow.style.opacity = '1';
    } else if (param === 'unfakeMaxColors') {
      await handleColorBudgetChange(DEFAULTS.unfakeMaxColors, true);
    } else if (param === 'unfakePalette') {
      unfakePaletteSelect.value = DEFAULTS.unfakePalette;
      paletteSelect.value = DEFAULTS.unfakePalette;
      updatePalettePreview();
      triggerPreviewDebounced();
    } else if (param === 'smartLineHealer' || param === 'unfakeSmartLineHealer') {
      if (smartLineHealerToggle) smartLineHealerToggle.checked = DEFAULTS.smartLineHealer;
      if (lineHealerOptions) lineHealerOptions.style.display = 'none';
      if (lineHealerSensitivity) lineHealerSensitivity.value = DEFAULTS.lineHealerSensitivity;
      if (lineHealerSensitivityNum) lineHealerSensitivityNum.value = DEFAULTS.lineHealerSensitivity;
      if (lineHealerMode) lineHealerMode.value = DEFAULTS.lineHealerMode;
      if (lineHealerMaxGap) lineHealerMaxGap.value = DEFAULTS.lineHealerMaxGap;
      if (unfakeSmartLineHealerToggle) unfakeSmartLineHealerToggle.checked = DEFAULTS.unfakeSmartLineHealer;
      if (unfakeLineHealerOptions) unfakeLineHealerOptions.style.display = 'none';
      if (unfakeLineHealerSensitivity) unfakeLineHealerSensitivity.value = DEFAULTS.unfakeLineHealerSensitivity;
      if (unfakeLineHealerSensitivityNum) unfakeLineHealerSensitivityNum.value = DEFAULTS.unfakeLineHealerSensitivity;
      if (unfakeLineHealerMode) unfakeLineHealerMode.value = DEFAULTS.unfakeLineHealerMode;
      if (unfakeLineHealerMaxGap) unfakeLineHealerMaxGap.value = DEFAULTS.unfakeLineHealerMaxGap;
      triggerPreviewDebounced();
    }

    updateDimensionsUI();
    triggerPreviewDebounced();
  });
});

// =============================================================================
// REFERENCE PALETTE UPLOADER (IMAGE OR .GPL PALETTE FILES)
// =============================================================================
function parseGPLContent(text) {
  const lines = text.split(/\r?\n/);
  let name = "";
  const colors = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.toLowerCase().startsWith('name:')) {
      name = line.substring(5).trim();
      continue;
    }
    if (line.startsWith('#') || line.toLowerCase().startsWith('gimp palette') || line.toLowerCase().startsWith('columns:')) {
      continue;
    }
    const match = line.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
    if (match) {
      const r = Math.min(255, Math.max(0, parseInt(match[1], 10)));
      const g = Math.min(255, Math.max(0, parseInt(match[2], 10)));
      const b = Math.min(255, Math.max(0, parseInt(match[3], 10)));
      colors.push([r, g, b]);
    }
  }

  return { name, colors };
}

paletteFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    loadPaletteReference(e.target.files[0]);
  }
});

function loadPaletteReference(file) {
  const isGpl = file.name.toLowerCase().endsWith('.gpl');

  if (isGpl) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const parsed = parseGPLContent(text);
      if (!parsed.colors || parsed.colors.length === 0) {
        showAlertModal({
          title: 'GPL IMPORT ERROR',
          message: 'No valid RGB colors found in the selected .gpl file.',
          danger: true
        });
        return;
      }

      const colors = parsed.colors;
      const palName = parsed.name || file.name.replace(/\.[^/.]+$/, "");
      paletteRefName = palName;
      paletteRefPixels = colors;
      PALETTES['reference'] = colors.map(c => [...c]);

      // Create a 32x32 color tile grid thumbnail for the badge
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 32;
      thumbCanvas.height = 32;
      const tCtx = thumbCanvas.getContext('2d');
      const cols = Math.ceil(Math.sqrt(colors.length));
      const cellW = 32 / cols;
      colors.forEach((c, i) => {
        const cx = (i % cols) * cellW;
        const cy = Math.floor(i / cols) * cellW;
        tCtx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        tCtx.fillRect(cx, cy, cellW, cellW);
      });
      const thumbUrl = thumbCanvas.toDataURL('image/png');

      paletteRefThumb.src = thumbUrl;
      paletteRefNameEl.textContent = `${palName} (${colors.length}c)`;
      paletteRefBadge.style.display = 'flex';

      if (unfakePaletteRefThumb) unfakePaletteRefThumb.src = thumbUrl;
      if (unfakePaletteRefName) unfakePaletteRefName.textContent = `${palName} (${colors.length}c)`;
      if (unfakePaletteRefBadge) unfakePaletteRefBadge.style.display = 'flex';

      [paletteSelect, unfakePaletteSelect].forEach(sel => {
        if (!sel) return;
        let refOpt = sel.querySelector('option[value="reference"]');
        if (!refOpt) {
          refOpt = document.createElement('option');
          refOpt.value = 'reference';
          sel.insertBefore(refOpt, sel.firstChild);
        }
        refOpt.textContent = `★ GPL: ${palName} (${colors.length} Colors)`;
        sel.value = 'reference';
      });

      updatePalettePreview();
      triggerPreviewDebounced();

      // If palette editor is currently open, load these colors immediately:
      if (isEyedropperActive) {
        pickedEyedropperColors = colors.map(c => [...c]);
        updateEyedropperUI();
        if (toggleLivePalette && toggleLivePalette.checked) {
          applyLiveCustomPalette();
        }
      }
    };
    reader.readAsText(file);
    return;
  }

  // Load as image
  paletteRefName = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      // 1. First sample unscaled image without smoothing to find authentic unique colors
      const fullCanvas = document.createElement('canvas');
      const fw = img.naturalWidth || img.width;
      const fh = img.naturalHeight || img.height;
      fullCanvas.width = fw;
      fullCanvas.height = fh;
      const fCtx = fullCanvas.getContext('2d');
      fCtx.imageSmoothingEnabled = false;
      fCtx.drawImage(img, 0, 0);

      const fData = fCtx.getImageData(0, 0, fw, fh).data;
      const uniqueColorsMap = new Map();
      const allOpaquePixels = [];

      for (let i = 0; i < fData.length; i += 4) {
        if (fData[i + 3] > 32) {
          const r = fData[i], g = fData[i + 1], b = fData[i + 2];
          const rgb = [r, g, b];
          allOpaquePixels.push(rgb);
          const key = (r << 16) | (g << 8) | b;
          if (!uniqueColorsMap.has(key)) {
            uniqueColorsMap.set(key, rgb);
          }
        }
      }

      if (uniqueColorsMap.size === 0) {
        showAlertModal({
          title: 'TRANSPARENT PALETTE',
          message: 'The uploaded palette image appears to be completely transparent.',
          danger: true
        });
        return;
      }

      let extractedColors = [];
      if (uniqueColorsMap.size <= 256) {
        // Image is already an authentic custom palette or swatch strip (<= 256 unique colors)!
        // Preserve exact colors 100% faithfully without running K-Means!
        extractedColors = Array.from(uniqueColorsMap.values());
      } else {
        // Photograph or complex artwork with thousands of shades: extract dominant colors via K-Means
        const k = parseInt(currentEngine === 'unfake' ? unfakeMaxColors.value : colorCount.value) || 16;
        extractedColors = runKMeans(allOpaquePixels, k, 15);
      }

      paletteRefPixels = extractedColors.map(c => [...c]);
      PALETTES['reference'] = extractedColors.map(c => [...c]);

      paletteRefThumb.src = ev.target.result;
      paletteRefNameEl.textContent = `${paletteRefName} (${extractedColors.length}c)`;
      paletteRefBadge.style.display = 'flex';

      if (unfakePaletteRefThumb) unfakePaletteRefThumb.src = ev.target.result;
      if (unfakePaletteRefName) unfakePaletteRefName.textContent = `${paletteRefName} (${extractedColors.length}c)`;
      if (unfakePaletteRefBadge) unfakePaletteRefBadge.style.display = 'flex';

      [paletteSelect, unfakePaletteSelect].forEach(sel => {
        if (!sel) return;
        let refOpt = sel.querySelector('option[value="reference"]');
        if (!refOpt) {
          refOpt = document.createElement('option');
          refOpt.value = 'reference';
          sel.insertBefore(refOpt, sel.firstChild);
        }
        refOpt.textContent = `★ Ref: ${paletteRefName} (${extractedColors.length} Colors)`;
        sel.value = 'reference';
      });

      updatePalettePreview();
      triggerPreviewDebounced();

      // If palette editor is currently open, load these colors immediately:
      if (isEyedropperActive) {
        pickedEyedropperColors = extractedColors.map(c => [...c]);
        updateEyedropperUI();
        if (toggleLivePalette && toggleLivePalette.checked) {
          applyLiveCustomPalette();
        }
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// CLEAR REFERENCE PALETTE
function clearPaletteReference() {
  paletteRefPixels = null;
  paletteRefName = "";
  delete PALETTES['reference'];
  paletteFileInput.value = '';

  if (paletteRefBadge) paletteRefBadge.style.display = 'none';
  if (unfakePaletteRefBadge) unfakePaletteRefBadge.style.display = 'none';

  [paletteSelect, unfakePaletteSelect].forEach(sel => {
    if (!sel) return;
    const refOpt = sel.querySelector('option[value="reference"]');
    if (refOpt) refOpt.remove();
    sel.value = 'auto';
  });

  updatePalettePreview();
  triggerPreviewDebounced();
}

btnClearPaletteRef.addEventListener('click', (e) => {
  e.stopPropagation();
  clearPaletteReference();
});
if (btnUnfakeClearPaletteRef) {
  btnUnfakeClearPaletteRef.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPaletteReference();
  });
}

// PALETTE PREVIEW SWATCHES
function updatePalettePreview() {
  const pChoice = currentEngine === 'unfake' ? unfakePaletteSelect.value : paletteSelect.value;
  [palettePreview, unfakePalettePreview].forEach(p => { if (p) p.innerHTML = ''; });

  if (pChoice === 'reference') {
    if (PALETTES['reference'] && PALETTES['reference'].length > 0) {
      renderSwatches(PALETTES['reference']);
      return;
    }
    if (paletteRefPixels && paletteRefPixels.length > 0) {
      const kColors = currentEngine === 'unfake' ? (parseInt(unfakeMaxColors.value) || 32) : (parseInt(colorCount.value) || 16);
      const iters = Math.min(10, parseInt(kmeansIter.value) || 10);
      const extracted = runKMeans(paletteRefPixels, kColors, iters);
      renderSwatches(extracted);
      return;
    }
  }

  const preset = PALETTES[pChoice];
  if (preset) {
    renderSwatches(preset);
  } else {
    const hint = currentEngine === 'unfake' ? 'Auto Quantize (Original Colors)' : 'Auto K-Means (Active Image)';
    [palettePreview, unfakePalettePreview].forEach(p => {
      if (p) p.innerHTML = `<span style="color:#64748b;font-size:0.68rem;padding:2px 4px;">${hint}</span>`;
    });
  }
}

function renderSwatches(colorList) {
  [palettePreview, unfakePalettePreview].forEach(p => { if (p) p.innerHTML = ''; });
  if (!colorList || colorList.length === 0) return;
  [palettePreview, unfakePalettePreview].forEach(p => {
    if (!p) return;
    colorList.forEach(c => {
      const d = document.createElement('div');
      d.style.backgroundColor = `rgb(${c[0]},${c[1]},${c[2]})`;
      d.title = `rgb(${c[0]},${c[1]},${c[2]})`;
      p.appendChild(d);
    });
  });
}

paletteSelect.addEventListener('change', () => {
  if (unfakePaletteSelect) unfakePaletteSelect.value = paletteSelect.value;
  if (paletteSelect.value === 'auto') {
    currentActivePalette = null; // Fresh Auto K-Means only when explicitly selecting auto
  }
  updatePalettePreview();
  triggerPreviewDebounced();
});
if (unfakePaletteSelect) {
  unfakePaletteSelect.addEventListener('change', () => {
    paletteSelect.value = unfakePaletteSelect.value;
    if (unfakePaletteSelect.value === 'auto') {
      currentActivePalette = null;
    }
    updatePalettePreview();
    triggerPreviewDebounced();
  });
}
updatePalettePreview();

// ZOOM CONTROLS (FIT, NATIVE 1:1, SLIDER & NUM BOX)
function setZoom(val) {
  zoomPercent = Math.max(5, Math.min(1000, Math.round(val)));
  zoomSlider.value = zoomPercent;
  zoomNumInput.value = zoomPercent;
  statsZoom.textContent = `${zoomPercent}%`;
  applyZoomToCanvas();
}

function applyCanvasTransform() {
  if (canvasScaler) {
    canvasScaler.style.transform = `translate(${Math.round(panOffsetX)}px, ${Math.round(panOffsetY)}px)`;
  }
  updateSplitBarPosition();
}

function resetPan() {
  panOffsetX = 0;
  panOffsetY = 0;
  applyCanvasTransform();
}

function fitZoomToContainer() {
  if (!rawImageElement) return;
  resetPan();
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
  resetPan();
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

  applyCanvasTransform();
  renderGridOverlay();
}

// GRID TOGGLE & ZOOMED-OUT ABORT PROTECTION
btnToggleGrid.addEventListener('click', () => {
  if (gridAbortTimer) {
    clearTimeout(gridAbortTimer);
    gridAbortTimer = null;
    btnToggleGrid.classList.remove('btn-grid-aborted');
  }

  // If currently OFF and trying to turn ON: check if zoomed out too much (or no image loaded)
  if (!showGrid) {
    const targetW = currentSnappedCanvas ? currentSnappedCanvas.width : (rawImageElement ? Math.max(1, Math.round((rawImageElement.naturalWidth || rawImageElement.width) / getEffectiveDivisor())) : 1);
    const baseW = rawImageElement ? (rawImageElement.naturalWidth || rawImageElement.width) : 0;
    const currentW = Math.round(baseW * (zoomPercent / 100));
    const cellScreenSize = targetW > 0 ? (currentW / targetW) : 0;

    // If no image loaded or cells on screen are smaller than 6 physical pixels: ABORT
    if (!rawImageElement || !currentSnappedCanvas || cellScreenSize < 6) {
      showGrid = false;
      btnToggleGrid.classList.remove('btn-grid-active');
      btnToggleGrid.classList.add('btn-grid-aborted');
      btnToggleGrid.textContent = 'ABORTED';

      gridAbortTimer = setTimeout(() => {
        btnToggleGrid.classList.remove('btn-grid-aborted');
        btnToggleGrid.innerHTML = '&#9638; GRID: OFF';
        gridAbortTimer = null;
      }, 1000);

      renderGridOverlay();
      return;
    }

    showGrid = true;
    btnToggleGrid.classList.remove('btn-grid-aborted');
    btnToggleGrid.classList.add('btn-grid-active');
    btnToggleGrid.innerHTML = '&#9638; GRID: ON';
  } else {
    showGrid = false;
    btnToggleGrid.classList.remove('btn-grid-aborted');
    btnToggleGrid.classList.remove('btn-grid-active');
    btnToggleGrid.innerHTML = '&#9638; GRID: OFF';
  }

  renderGridOverlay();
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
    const firstFile = e.dataTransfer.files[0];
    if (firstFile.name.toLowerCase().endsWith('.gpl')) {
      loadPaletteReference(firstFile);
    } else {
      handleFiles(e.dataTransfer.files);
    }
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFiles(e.target.files);
  }
});

if (batchAddFileInput) {
  batchAddFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      newFiles.forEach(nf => {
        if (!batchFiles.some(bf => bf.name === nf.name && bf.size === nf.size)) {
          batchFiles.push(nf);
        }
      });
      updateBatchList();
      if (!rawImageElement && batchFiles.length > 0) {
        loadBatchImage(0, false);
      } else {
        updateBatchNavUI();
      }
    }
  });
}

[btnAddBatchFiles1, btnAddBatchFiles2].forEach(btn => {
  if (btn) btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (batchAddFileInput) {
      batchAddFileInput.value = '';
      batchAddFileInput.click();
    }
  });
});

[btnClearBatch1, btnClearBatch2].forEach(btn => {
  if (btn) btn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearBatchQueue();
  });
});

function clearBatchQueue() {
  if (rawImageElement && batchFiles[currentBatchIndex]) {
    batchFiles = [batchFiles[currentBatchIndex]];
    currentBatchIndex = 0;
  } else {
    batchFiles = [];
    currentBatchIndex = 0;
    masterBatchPalette = null;
  }
  updateBatchList();
  updateBatchNavUI();
}

[batchSamePalette1, batchSamePalette2].forEach(chk => {
  if (chk) {
    chk.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      isBatchSamePalette = isChecked;
      if (batchSamePalette1) batchSamePalette1.checked = isChecked;
      if (batchSamePalette2) batchSamePalette2.checked = isChecked;

      if (isChecked) {
        const activeColors = getActivePaletteColors();
        if (activeColors && activeColors.length > 0) {
          masterBatchPalette = activeColors.map(c => [...c]);
        }
      } else {
        masterBatchPalette = null;
        if (paletteSelect.value === 'auto') {
          currentActivePalette = null;
        }
      }
      triggerPreviewDebounced();
    });
  }
});

function handleFiles(files) {
  const fileArr = Array.from(files);
  if (fileArr.length === 1 && batchFiles.length === 0) {
    batchFiles = [fileArr[0]];
    currentBatchIndex = 0;
    updateBatchList();
    loadBatchImage(0, false);
  } else if (fileArr.length === 1 && batchFiles.length > 0) {
    const existingIdx = batchFiles.findIndex(f => f.name === fileArr[0].name);
    if (existingIdx >= 0) {
      switchBatchImage(existingIdx);
    } else {
      batchFiles.push(fileArr[0]);
      currentBatchIndex = batchFiles.length - 1;
      updateBatchList();
      loadBatchImage(currentBatchIndex, true);
    }
  } else {
    batchFiles = fileArr;
    currentBatchIndex = 0;
    updateBatchList();
    loadBatchImage(0, false);
  }
}

async function loadBatchImage(idx, preserveZoom = true) {
  if (idx < 0 || idx >= batchFiles.length) return;
  currentBatchIndex = idx;
  const file = batchFiles[idx];
  await loadImage(file, preserveZoom);
  updateBatchNavUI();
}

function switchBatchImage(idx) {
  if (idx < 0 || idx >= batchFiles.length) return;
  loadBatchImage(idx, true);
}

function stepBatch(delta) {
  if (batchFiles.length <= 1) return;
  let nextIdx = (currentBatchIndex + delta) % batchFiles.length;
  if (nextIdx < 0) nextIdx += batchFiles.length;
  switchBatchImage(nextIdx);
}

if (btnBatchPrev) btnBatchPrev.addEventListener('click', () => stepBatch(-1));
if (btnBatchNext) btnBatchNext.addEventListener('click', () => stepBatch(1));
if (batchSelectDropdown) {
  batchSelectDropdown.addEventListener('change', () => {
    const idx = parseInt(batchSelectDropdown.value) || 0;
    switchBatchImage(idx);
  });
}

window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  if (e.ctrlKey || e.metaKey) return; // Prevent hijacking browser shortcuts like Ctrl+S, Ctrl+W
  if (!batchFiles || batchFiles.length <= 1) return;

  // W / PREV: Works on physical key (e.code === 'KeyW'), English ('w','W'), Greek ('ς'), or bracket '[' / Alt+Left / Up
  const isPrev = (
    e.code === 'KeyW' ||
    (!e.code && (e.key === 'w' || e.key === 'W' || e.key === 'ς')) ||
    e.key === '[' ||
    (e.altKey && e.key === 'ArrowLeft') ||
    e.key === 'ArrowUp'
  );

  // S / NEXT: Works on physical key (e.code === 'KeyS'), English ('s','S'), Greek ('σ'), or bracket ']' / Alt+Right / Down
  const isNext = (
    e.code === 'KeyS' ||
    (!e.code && (e.key === 's' || e.key === 'S' || e.key === 'σ')) ||
    e.key === ']' ||
    (e.altKey && e.key === 'ArrowRight') ||
    e.key === 'ArrowDown'
  );

  if (isPrev) {
    e.preventDefault();
    stepBatch(-1);
  } else if (isNext) {
    e.preventDefault();
    stepBatch(1);
  }
});

function updateBatchList() {
  const lists = [document.getElementById('batchList'), unfakeBatchList];
  const counts = [document.getElementById('batchCount'), unfakeBatchCount];
  const buttons = [document.getElementById('btnProcessBatch'), btnUnfakeProcessBatch];
  const drawers = [document.getElementById('batchDrawer'), unfakeBatchDrawer];

  counts.forEach(c => { if (c) c.textContent = batchFiles.length; });
  buttons.forEach(b => { if (b) b.disabled = batchFiles.length === 0; });

  if (batchFiles.length > 1) {
    drawers.forEach(d => { if (d) d.open = true; });
  }

  lists.forEach(list => {
    if (!list) return;
    list.innerHTML = '';
    if (batchFiles.length === 0) {
      list.innerHTML = '<li class="empty-hint">Drop multiple images here to batch process.</li>';
      return;
    }
    batchFiles.forEach((f, idx) => {
      const li = document.createElement('li');
      li.className = `batch-item ${idx === currentBatchIndex ? 'active' : ''}`;
      li.dataset.index = idx;
      li.title = `Click to preview ${f.name} in workbench with current palette`;
      
      const infoSpan = document.createElement('span');
      infoSpan.className = 'batch-item-info';
      infoSpan.innerHTML = `<span class="batch-item-num">${idx + 1}.</span> <span class="batch-item-name">${f.name}</span> <span class="batch-item-size">(${Math.round(f.size/1024)} KB)</span>`;
      
      const actSpan = document.createElement('span');
      actSpan.className = 'batch-item-tag';
      actSpan.textContent = idx === currentBatchIndex ? '● PREVIEWING' : 'VIEW';

      li.appendChild(infoSpan);
      li.appendChild(actSpan);

      li.addEventListener('click', (e) => {
        e.stopPropagation();
        switchBatchImage(idx);
      });

      list.appendChild(li);
    });
  });

  updateBatchNavUI();
}

function updateBatchNavUI() {
  if (!batchNavToolbar) return;
  if (batchFiles.length > 1) {
    batchNavToolbar.style.display = 'flex';
    if (batchNavBadge) batchNavBadge.textContent = `${currentBatchIndex + 1} / ${batchFiles.length}`;

    if (batchSelectDropdown) {
      batchSelectDropdown.innerHTML = '';
      batchFiles.forEach((f, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${idx + 1}. ${f.name}`;
        if (idx === currentBatchIndex) opt.selected = true;
        batchSelectDropdown.appendChild(opt);
      });
    }

    const lists = [document.getElementById('batchList'), unfakeBatchList];
    lists.forEach(list => {
      if (!list) return;
      Array.from(list.children).forEach((li, idx) => {
        if (li.classList.contains('batch-item')) {
          if (idx === currentBatchIndex) {
            li.classList.add('active');
            const tag = li.querySelector('.batch-item-tag');
            if (tag) tag.textContent = '● PREVIEWING';
            li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          } else {
            li.classList.remove('active');
            const tag = li.querySelector('.batch-item-tag');
            if (tag) tag.textContent = 'VIEW';
          }
        }
      });
    });
  } else {
    batchNavToolbar.style.display = 'none';
  }
}

// INTELLIGENT SCALE DETECTION (UNFAKE.JS ENGINE INTEGRATION)
async function runScaleDetection() {
  if (!rawImageElement) return;
  const w = rawImageElement.naturalWidth || rawImageElement.width;
  const h = rawImageElement.naturalHeight || rawImageElement.height;
  const imgData = rawOffCtx.getImageData(0, 0, w, h);

  const analyzingText = "Analyzing scale...";
  if (snapperScaleStatText) snapperScaleStatText.textContent = analyzingText;
  if (unfakeScaleStatText) unfakeScaleStatText.textContent = analyzingText;

  try {
    let det = null;
    const method = (currentEngine === 'unfake' ? unfakeDetectMethod.value : snapperDetectMethod.value) || 'auto';
    const manualVal = parseFloat(currentEngine === 'unfake' ? unfakeManualScale.value : snapperManualScale.value) || 8.0;

    if (window.UnfakeEngine && typeof window.UnfakeEngine.detectScale === 'function') {
      det = await window.UnfakeEngine.detectScale(imgData, {
        method: method,
        manualScale: method === 'manual' ? manualVal : null
      });
    }

    if (det && det.scale) {
      detectedScale = det.scale;
      detectedGrid = det.grid;
      const scaleDesc = Number.isInteger(detectedScale) ? `${detectedScale}x` : `${detectedScale.toFixed(2)}x`;
      const methodDesc = (det.method || 'auto').replace('auto_', '').toUpperCase();
      const statusDesc = `${scaleDesc} [${methodDesc}]`;
      if (snapperScaleStatText) snapperScaleStatText.textContent = statusDesc;
      if (unfakeScaleStatText) unfakeScaleStatText.textContent = statusDesc;
    } else {
      detectedScale = 1;
      detectedGrid = null;
      if (snapperScaleStatText) snapperScaleStatText.textContent = "1x (No grid found)";
      if (unfakeScaleStatText) unfakeScaleStatText.textContent = "1x (No grid found)";
    }
  } catch (err) {
    console.warn("Scale detection failed:", err);
    detectedScale = 1;
    if (snapperScaleStatText) snapperScaleStatText.textContent = "1x (Fallback)";
    if (unfakeScaleStatText) unfakeScaleStatText.textContent = "1x (Fallback)";
  }

  // Update WASM Badge status
  if (window.UnfakeEngine) {
    const isWasm = window.UnfakeEngine.isWasmActive();
    [snapperWasmBadge, unfakeWasmBadge].forEach(badge => {
      if (!badge) return;
      badge.textContent = isWasm ? 'RUST WASM' : 'PURE JS';
      badge.style.color = isWasm ? 'var(--accent-green)' : 'var(--accent-yellow)';
    });
  }

  updateDimensionsUI();
}

// LOAD IMAGE INTO WORKBENCH
function loadImage(file, preserveZoom = false) {
  return new Promise((resolve) => {
    loadedFilename = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
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

        // Load or initialize image's individual adjustments from batch memory
        currentAdjustments = getImageAdjustments(loadedFilename);
        computeLuminanceHistogram(img);
        syncAdjustmentsUI();
        
        dropPrompt.style.display = 'none';
        viewerToolbar.style.display = 'flex';
        canvasWrapper.style.display = 'flex';

        // Always perform intelligent scale detection if in AUTO downscale mode
        if (currentDivisor === 'auto') {
          await runScaleDetection();
        }
        selectDivisor(currentDivisor !== undefined ? currentDivisor : 1);
        updateDimensionsUI();
        updateBatchNavUI();

        setTimeout(() => {
          if (!preserveZoom) {
            resetPan();
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
          } else {
            setZoom(zoomPercent);
          }
          triggerPreviewDebounced();
          resolve();
        }, 20);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function updateDimensionsUI() {
  if (!rawImageElement) return;
  const w = rawImageElement.naturalWidth || rawImageElement.width;
  const h = rawImageElement.naturalHeight || rawImageElement.height;
  const effDiv = getEffectiveDivisor();
  const targetW = Math.max(1, Math.round(w / effDiv));
  const targetH = Math.max(1, Math.round(h / effDiv));

  const scaleStr = Number.isInteger(effDiv) ? `${effDiv}x` : `${effDiv.toFixed(2)}x`;
  let divLabel;
  if (currentDivisor === 'auto') {
    divLabel = `Auto (/${scaleStr})`;
  } else if (currentDivisor === 'custom') {
    divLabel = customScaleMode === 'factor' ? `Custom (/${customFactorVal})` : `Target (${targetW}x${targetH})`;
  } else {
    divLabel = effDiv === 1 ? `1x` : `/${effDiv}`;
  }

  origRes.textContent = `${w}x${h}`;
  if (targetDimText) targetDimText.textContent = `${targetW}x${targetH} px (${divLabel})`;
  if (unfakeTargetDimText) unfakeTargetDimText.textContent = `${targetW}x${targetH} px (${divLabel})`;
  snappedRes.textContent = `${targetW}x${targetH}`;

  const baseName = loadedFilename.replace(/\.[^/.]+$/, "");
  const downloadName = loadedFilename.toLowerCase().endsWith('.png') ? loadedFilename : `${baseName}.png`;
  downloadNameLabel.textContent = `(${downloadName})`;
  if (unfakeDownloadNameLabel) unfakeDownloadNameLabel.textContent = `(${downloadName})`;
  btnDownload.disabled = false;
  if (btnUnfakeDownload) btnUnfakeDownload.disabled = false;
}

// CLOSE / EJECT IMAGE
btnCloseImage.addEventListener('click', () => {
  rawImageElement = null;
  currentSnappedCanvas = null;
  currentActivePalette = null;
  resetPan();
  stopEyedropper();
  closeAdjustmentsPanel();
  if (gridAbortTimer) {
    clearTimeout(gridAbortTimer);
    gridAbortTimer = null;
  }
  showGrid = false;
  btnToggleGrid.classList.remove('btn-grid-active', 'btn-grid-aborted');
  btnToggleGrid.innerHTML = '&#9638; GRID: OFF';
  renderGridOverlay();

  viewerToolbar.style.display = 'none';
  if (batchNavToolbar) batchNavToolbar.style.display = 'none';
  batchFiles = [];
  currentBatchIndex = 0;
  updateBatchList();
  canvasWrapper.style.display = 'none';
  dropPrompt.style.display = 'block';

  origRes.textContent = '-';
  snappedRes.textContent = '-';
  activeColors.textContent = '-';
  targetDimText.textContent = 'Waiting...';
  if (unfakeTargetDimText) unfakeTargetDimText.textContent = 'Waiting...';
  downloadNameLabel.textContent = '';
  if (unfakeDownloadNameLabel) unfakeDownloadNameLabel.textContent = '';
  btnDownload.disabled = true;
  if (btnUnfakeDownload) btnUnfakeDownload.disabled = true;

  fileInput.value = '';
});

// DEBOUNCED PREVIEW TRIGGER WITH MULTI-INPUT SETTLING DELAY
function triggerPreviewDebounced(delay = PREVIEW_DEBOUNCE_MS) {
  if (!rawImageElement) return;
  if (previewTimeout) clearTimeout(previewTimeout);
  pipelineTag.textContent = "Pending...";
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
    const effDiv = getEffectiveDivisor();
    const targetW = Math.max(1, Math.round(w / effDiv));
    const targetH = Math.max(1, Math.round(h / effDiv));

    // PRE-PALETTE ADJUSTMENTS (APPLIED TO SOURCE BEFORE QUANTIZATION & DOWNSCALING)
    applyImageAdjustments(adjustedOffCanvas, adjustedOffCtx, rawOffCanvas, currentAdjustments);

    // ============================================
    // BRANCH A: UNFAKE.JS ENGINE
    // ============================================
    if (currentEngine === 'unfake') {
      const isWasm = window.UnfakeEngine ? window.UnfakeEngine.isWasmActive() : false;
      pipelineTag.textContent = isWasm ? "Unfake.js (WASM)" : "Unfake.js (JS)";

      const pChoice = unfakePaletteSelect.value;
      let activePalette = null;
      if (pChoice === 'reference') {
        if (PALETTES['reference'] && PALETTES['reference'].length > 0) {
          activePalette = PALETTES['reference'];
        } else if (paletteRefPixels && paletteRefPixels.length > 0) {
          const kColors = parseInt(unfakeMaxColors.value) || 32;
          activePalette = runKMeans(paletteRefPixels, kColors, 15);
        }
      } else if (PALETTES[pChoice]) {
        activePalette = PALETTES[pChoice];
      } else if (isBatchSamePalette && masterBatchPalette && masterBatchPalette.length > 0) {
        activePalette = masterBatchPalette;
      }

      if (window.UnfakeEngine && typeof window.UnfakeEngine.process === 'function') {
        const res = await window.UnfakeEngine.process(adjustedOffCanvas, {
          scale: effDiv,
          manualScale: unfakeDetectMethod.value === 'manual' ? parseFloat(unfakeManualScale.value) : null,
          detectMethod: unfakeDetectMethod.value,
          edgeDetectMethod: 'tiled',
          snapGrid: unfakeSnapGrid.checked,
          elasticGrid: unfakeElasticGrid.checked,
          downscaleMethod: unfakeDownscaleMethod.value,
          domMeanThreshold: parseFloat(unfakeDomThreshold.value) || 0.15,
          cleanup: {
            morph: unfakeMorph.checked,
            jaggy: unfakeJaggy.checked
          },
          alphaThreshold: unfakeAlphaBinarize.checked ? (parseInt(unfakeAlphaThreshold.value) || 128) : null,
          maxColors: unfakeAutoColors.checked ? 32 : (parseInt(unfakeMaxColors.value) || 32),
          autoColorCount: unfakeAutoColors.checked,
          fixedPalette: activePalette
        });

        if (currentSession !== previewSessionId) return;

        currentSnappedCanvas = res.canvas;
        currentActivePalette = activePalette || (res.palette ? res.palette.map(p => typeof p === 'string' ? hexToRgb(p) : p) : null);
        if (isBatchSamePalette && currentActivePalette && (!masterBatchPalette || masterBatchPalette.length === 0)) {
          masterBatchPalette = currentActivePalette.map(c => [...c]);
        }
        activeColors.textContent = res.colorsUsed || (currentActivePalette ? currentActivePalette.length : 'All');
        if (currentActivePalette && isEyedropperActive && unfakePaletteSelect.value === 'auto') {
          pickedEyedropperColors = currentActivePalette.map(c => [...c]);
          updateEyedropperUI();
        }

        // SMART OUTLINE HEALER (UNFAKE BRANCH)
        if (unfakeSmartLineHealerToggle && unfakeSmartLineHealerToggle.checked) {
          pipelineTag.textContent += "+Healer";
          const maxGap = parseInt(unfakeLineHealerMaxGap.value) || 1;
          const sensitivity = parseInt(unfakeLineHealerSensitivity.value) || 50;
          const mode = unfakeLineHealerMode ? unfakeLineHealerMode.value : 'gaps';
          healBrokenOutlines(currentSnappedCanvas, adjustedOffCanvas, currentActivePalette, {
            sensitivity, mode, maxGap
          });
        }

        renderSplitView();
        return;
      }
    }

    // ============================================
    // BRANCH B: PIXEL SNAPPER ENGINE (DEFAULT)
    // ============================================
    const kColors = parseInt(colorCount.value) || 16;
    const iterations = parseInt(kmeansIter.value) || 15;
    const oWeight = parseFloat(outlineWeight.value) || 1.5;
    const snapAlphaChecked = snapAlpha.checked;

    let offCanvas = document.createElement('canvas');
    offCanvas.width = targetW;
    offCanvas.height = targetH;
    let offCtx = offCanvas.getContext('2d');
    offCtx.imageSmoothingEnabled = false;
    offCtx.drawImage(adjustedOffCanvas, 0, 0, targetW, targetH);

    // STEP 1: PALETTE SELECTION
    let palette = null;
    const pChoice = paletteSelect.value;

    if (pChoice === 'reference') {
      if (PALETTES['reference'] && PALETTES['reference'].length > 0) {
        palette = PALETTES['reference'];
      } else if (paletteRefPixels && paletteRefPixels.length > 0) {
        palette = paletteRefPixels;
      }
    } else if (pChoice === 'customEyedropper' && PALETTES.customEyedropper && PALETTES.customEyedropper.length > 0) {
      palette = PALETTES.customEyedropper;
    } else if (PALETTES[pChoice]) {
      palette = PALETTES[pChoice];
    } else {
      // ONLY RUN AUTO K-MEANS IF pChoice === 'auto'!
      if (isBatchSamePalette && masterBatchPalette && masterBatchPalette.length > 0) {
        palette = masterBatchPalette;
        currentActivePalette = palette;
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
          currentActivePalette = palette;
          if (isBatchSamePalette) {
            masterBatchPalette = palette.map(c => [...c]);
          }
        }
      }
    }

    if (palette && isBatchSamePalette && (!masterBatchPalette || masterBatchPalette.length === 0)) {
      masterBatchPalette = palette.map(c => [...c]);
    }

    if (palette && pChoice === 'auto') {
      renderSwatches(palette);
      if (isEyedropperActive) {
        pickedEyedropperColors = palette.map(c => [...c]);
        updateEyedropperUI();
      }
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

    // STEP 5: OPTIONAL SMART OUTLINE HEALER (HIGH-RES RIDGE / SKELETON TRACING)
    if (smartLineHealerToggle && smartLineHealerToggle.checked) {
      pipelineTag.textContent += "+Healer";
      const maxGap = parseInt(lineHealerMaxGap.value) || 1;
      const sensitivity = parseInt(lineHealerSensitivity.value) || 50;
      const mode = lineHealerMode ? lineHealerMode.value : 'gaps';
      healBrokenOutlines(offCanvas, adjustedOffCanvas, palette, {
        sensitivity, mode, maxGap
      });
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
  if (!hex || typeof hex !== 'string') return [0, 0, 0];
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
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

function runKMeans(pixels, k, iterations, initialCentroids = null) {
  if (!pixels || pixels.length === 0) return [];
  const centroids = [];

  if (initialCentroids && initialCentroids.length > 0) {
    for (let i = 0; i < initialCentroids.length; i++) {
      centroids.push(initialCentroids[i].slice());
    }
  } else {
    const actualK = Math.min(k, pixels.length);
    if (actualK <= 0) return [];
    const step = Math.max(1, Math.floor(pixels.length / actualK));
    for (let i = 0; i < actualK; i++) {
      centroids.push(pixels[(i * step) % pixels.length].slice());
    }
  }

  const actualK = centroids.length;
  if (actualK <= 0) return [];

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

function findNearestColor(c, palette, maybeB, maybePal) {
  let col = c;
  let pal = palette;
  if (typeof c === 'number' && typeof palette === 'number' && typeof maybeB === 'number') {
    col = [c, palette, maybeB];
    pal = maybePal;
  }
  if (!pal || pal.length === 0) return col || [0, 0, 0];
  let bestDist = Infinity;
  let best = pal[0];
  for (let i = 0; i < pal.length; i++) {
    const d = colorDistSq(col, pal[i]);
    if (d < bestDist) {
      bestDist = d;
      best = pal[i];
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

// =============================================================================
// HIGH-RES RIDGE / SKELETON TRACING HEALER (MULTI-COLOR, ANTI-CLUMP & FORGIVING)
// =============================================================================
function healBrokenOutlines(lowCanvas, highCanvas, palette, options = {}) {
  if (!lowCanvas) return;
  const ctx = lowCanvas.getContext('2d');
  const w = lowCanvas.width;
  const h = lowCanvas.height;
  if (w <= 2 || h <= 2) return;

  // High-res canvas is required for true ridge/skeleton verification
  if (!highCanvas || highCanvas.width <= 0 || highCanvas.height <= 0) return;

  const sensitivity = options.sensitivity !== undefined ? options.sensitivity : 50;
  const mode = options.mode || 'gaps'; // 'gaps' | 'all'
  const maxGap = options.maxGap || 1; // 1 | 2

  let highData = null;
  const hw = highCanvas.width;
  const hh = highCanvas.height;
  try {
    const hCtx = highCanvas.getContext('2d', { willReadFrequently: true });
    highData = hCtx.getImageData(0, 0, hw, hh).data;
  } catch (e) {
    return;
  }
  if (!highData) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const scaleX = hw / w;
  const scaleY = hh / h;

  const getHighRGB = (u, v) => {
    u = Math.max(0, Math.min(hw - 1, u));
    v = Math.max(0, Math.min(hh - 1, v));
    const idx = (v * hw + u) * 4;
    return [highData[idx], highData[idx + 1], highData[idx + 2], highData[idx + 3]];
  };

  const getLum = (rgb) => 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];

  // Probe radii for multi-thickness line detection in high-res
  const probeRadii = [1, 2];
  const maxProbe = Math.max(2, Math.min(4, Math.round(scaleX / 2)));
  if (!probeRadii.includes(maxProbe)) probeRadii.push(maxProbe);

  // Step 1: Scan High-Res Ridges per Low-Res Grid Cell
  const cellMaxRidge = new Float32Array(w * h);
  const cellRidgeColor = Array.from({ length: w * h }, () => [0, 0, 0]);

  for (let ly = 0; ly < h; ly++) {
    for (let lx = 0; lx < w; lx++) {
      const u0 = Math.floor(lx * scaleX);
      const u1 = Math.min(hw, Math.floor((lx + 1) * scaleX));
      const v0 = Math.floor(ly * scaleY);
      const v1 = Math.min(hh, Math.floor((ly + 1) * scaleY));

      let maxR = 0;
      let bestColor = [0, 0, 0];

      for (let v = v0; v < v1; v++) {
        for (let u = u0; u < u1; u++) {
          const c = getHighRGB(u, v);
          if (c[3] <= 64) continue;
          const lum = getLum(c);

          // Check if pixel is a silhouette boundary (adjacent to high-res transparency)
          let isSilhouette = false;
          const neighbors = [[u - 1, v], [u + 1, v], [u, v - 1], [u, v + 1]];
          for (let i = 0; i < 4; i++) {
            const nu = neighbors[i][0];
            const nv = neighbors[i][1];
            if (nu >= 0 && nu < hw && nv >= 0 && nv < hh && highData[(nv * hw + nu) * 4 + 3] <= 64) {
              isSilhouette = true;
              break;
            }
          }

          let rStrength = 0;
          if (isSilhouette) {
            rStrength = 220;
          } else {
            // Measure dark ridge valleys across multiple radii
            const sampleL = (su, sv) => getLum(getHighRGB(su, sv));
            for (let rIdx = 0; rIdx < probeRadii.length; rIdx++) {
              const r = probeRadii[rIdx];
              const vH = Math.min(sampleL(u - r, v), sampleL(u + r, v)) - lum;
              const vV = Math.min(sampleL(u, v - r), sampleL(u, v + r)) - lum;
              const vD1 = Math.min(sampleL(u - r, v - r), sampleL(u + r, v + r)) - lum;
              const vD2 = Math.min(sampleL(u - r, v + r), sampleL(u + r, v - r)) - lum;
              const curMax = Math.max(0, vH, vV, vD1, vD2);
              if (curMax > rStrength) rStrength = curMax;
            }
          }

          if (rStrength > maxR) {
            maxR = rStrength;
            bestColor = [c[0], c[1], c[2]];
          }
        }
      }

      const cellIdx = ly * w + lx;
      cellMaxRidge[cellIdx] = maxR;
      cellRidgeColor[cellIdx] = bestColor;
    }
  }

  // Step 2: Map Sensitivity (10% - 90%) to Ridge Threshold
  // 10% -> T = 73 (Strict: only bold, dark lines)
  // 50% -> T = 45 (Balanced)
  // 90% -> T = 17 (Forgiving: catches thin, faint, light or colored lines)
  const threshold = Math.max(10, 80 - (sensitivity * 0.7));

  const getIdx = (x, y) => (y * w + x) * 4;
  const isLowOpaque = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    return data[getIdx(x, y) + 3] > 64;
  };
  const getLowRGB = (x, y) => {
    const idx = getIdx(x, y);
    return [data[idx], data[idx + 1], data[idx + 2]];
  };

  // Step 3: Determine which low-res pixels ALREADY contain a line
  const isLowLine = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    if (!isLowOpaque(x, y)) return false;
    const cIdx = y * w + x;
    if (cellMaxRidge[cIdx] < threshold * 0.75) return false;

    const c = getLowRGB(x, y);
    const lum = getLum(c);
    const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (let i = 0; i < 4; i++) {
      const nx = neighbors[i][0];
      const ny = neighbors[i][1];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !isLowOpaque(nx, ny)) return true;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && isLowOpaque(nx, ny)) {
        if (getLum(getLowRGB(nx, ny)) - lum >= 20) return true;
      }
    }
    if (colorDistSq(c, cellRidgeColor[cIdx]) < 30 * 30) return true;
    return false;
  };

  const lineMap = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isLowLine(x, y)) lineMap[y * w + x] = 1;
    }
  }

  const isLine = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    return lineMap[y * w + x] === 1;
  };

  // Anti-Clumping Guard 1: No 2x2 Clumps
  const violates2x2 = (x, y) => {
    if (isLine(x - 1, y - 1) && isLine(x, y - 1) && isLine(x - 1, y)) return true;
    if (isLine(x, y - 1) && isLine(x + 1, y - 1) && isLine(x + 1, y)) return true;
    if (isLine(x - 1, y) && isLine(x - 1, y + 1) && isLine(x, y + 1)) return true;
    if (isLine(x + 1, y) && isLine(x, y + 1) && isLine(x + 1, y + 1)) return true;
    return false;
  };

  // Anti-Clumping Guard 2: No Parallel Line Fusion
  const violatesParallel = (x, y, dir) => {
    if (dir === 'horizontal') {
      if (isLine(x, y - 1) || isLine(x, y + 1)) return true;
    } else if (dir === 'vertical') {
      if (isLine(x - 1, y) || isLine(x + 1, y)) return true;
    }
    return false;
  };

  // Anti-Clumping Guard 3: No overcrowded orthogonal neighbors (>= 3 lines)
  const violatesOrthogonalCount = (x, y) => {
    let count = 0;
    if (isLine(x + 1, y)) count++;
    if (isLine(x - 1, y)) count++;
    if (isLine(x, y + 1)) count++;
    if (isLine(x, y - 1)) count++;
    return count >= 3;
  };

  // Step 4: Gap / Skeleton Healing Execution
  const passes = maxGap >= 2 ? [1, 2] : [1];

  for (const currentPassGap of passes) {
    const repairs = [];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (isLine(x, y)) continue;

        const cellIdx = y * w + x;
        // MUST have verified high-res ridge
        if (cellMaxRidge[cellIdx] < threshold) continue;

        let shouldHeal = false;

        if (currentPassGap === 1) {
          // Horizontal gap: Left (x-1, y) and Right (x+1, y)
          if (isLine(x - 1, y) && isLine(x + 1, y)) {
            if (!violates2x2(x, y) && !violatesParallel(x, y, 'horizontal') && !violatesOrthogonalCount(x, y)) {
              shouldHeal = true;
            }
          }

          // Vertical gap: Top (x, y-1) and Bottom (x, y+1)
          if (!shouldHeal && isLine(x, y - 1) && isLine(x, y + 1)) {
            if (!violates2x2(x, y) && !violatesParallel(x, y, 'vertical') && !violatesOrthogonalCount(x, y)) {
              shouldHeal = true;
            }
          }

          // Diagonal gap (2-step diagonal chain: (x-1, y-1) to (x+1, y+1))
          if (!shouldHeal && isLine(x - 1, y - 1) && isLine(x + 1, y + 1)) {
            if (!violates2x2(x, y) && !violatesOrthogonalCount(x, y)) {
              shouldHeal = true;
            }
          }
          if (!shouldHeal && isLine(x - 1, y + 1) && isLine(x + 1, y - 1)) {
            if (!violates2x2(x, y) && !violatesOrthogonalCount(x, y)) {
              shouldHeal = true;
            }
          }

          // Full Skeleton Mode: also heals endpoints that touch an existing line
          if (!shouldHeal && mode === 'all') {
            const hasNeighbor = isLine(x - 1, y) || isLine(x + 1, y) || isLine(x, y - 1) || isLine(x, y + 1);
            if (hasNeighbor && !violates2x2(x, y) && !violatesOrthogonalCount(x, y)) {
              shouldHeal = true;
            }
          }
        } else if (currentPassGap === 2) {
          // 2px Horizontal gap
          if (isLine(x - 1, y) && !isLine(x, y) && !isLine(x + 1, y) && isLine(x + 2, y)) {
            if (cellMaxRidge[y * w + x + 1] >= threshold &&
                !violates2x2(x, y) && !violatesParallel(x, y, 'horizontal') &&
                !violates2x2(x + 1, y) && !violatesParallel(x + 1, y, 'horizontal')) {
              repairs.push({ x, y, color: cellRidgeColor[cellIdx] });
              repairs.push({ x: x + 1, y, color: cellRidgeColor[y * w + x + 1] });
              continue;
            }
          }
          // 2px Vertical gap
          if (isLine(x, y - 1) && !isLine(x, y) && !isLine(x, y + 1) && isLine(x, y + 2)) {
            if (cellMaxRidge[(y + 1) * w + x] >= threshold &&
                !violates2x2(x, y) && !violatesParallel(x, y, 'vertical') &&
                !violates2x2(x, y + 1) && !violatesParallel(x, y + 1, 'vertical')) {
              repairs.push({ x, y, color: cellRidgeColor[cellIdx] });
              repairs.push({ x, y: y + 1, color: cellRidgeColor[(y + 1) * w + x] });
              continue;
            }
          }
        }

        if (shouldHeal) {
          repairs.push({ x, y, color: cellRidgeColor[cellIdx] });
        }
      }
    }

    // Apply repairs
    for (let i = 0; i < repairs.length; i++) {
      const r = repairs[i];
      let col = r.color;
      if (palette && palette.length > 0 && typeof findNearestColor === 'function') {
        col = findNearestColor(col, palette);
      }
      const idx = getIdx(r.x, r.y);
      data[idx] = col[0];
      data[idx + 1] = col[1];
      data[idx + 2] = col[2];
      data[idx + 3] = 255;
      lineMap[r.y * w + r.x] = 1;
    }
  }

  ctx.putImageData(imgData, 0, 0);
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
  const canvasRect = mainCanvas.getBoundingClientRect();
  const wrapperRect = canvasWrapper.getBoundingClientRect();

  if (canvasRect.width === 0 || canvasRect.right <= wrapperRect.left || canvasRect.left >= wrapperRect.right) {
    splitBar.style.display = 'none';
    return;
  }
  splitBar.style.display = 'block';

  // Screen X position of the split divider across the full viewport panel
  const splitScreenX = canvasRect.left + (splitPosition * canvasRect.width) - wrapperRect.left;
  splitBar.style.left = `${Math.round(splitScreenX)}px`;
  splitBar.style.top = '0px';
  splitBar.style.bottom = '0px';
  splitBar.style.height = '100%';
}

// =============================================================================
// PRE-PALETTE IMAGE ADJUSTMENTS ENGINE (CURVES, LEVELS, HSL, BRIGHTNESS, CONTRAST)
// =============================================================================

function getImageAdjustments(filename) {
  if (!filename) return currentAdjustments;
  if (!batchImageAdjustments.has(filename)) {
    batchImageAdjustments.set(filename, createDefaultAdjustments());
  }
  return batchImageAdjustments.get(filename);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}

// Fritsch-Carlson Monotone Cubic Spline Interpolation for Photoshop-style Curves
function getSplineCurveTable(points) {
  const lut = new Uint8Array(256);
  if (!points || points.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const pts = [...points].sort((a, b) => a.x - b.x);
  if (pts.length === 1) {
    const val = Math.max(0, Math.min(255, Math.round(pts[0].y)));
    lut.fill(val);
    return lut;
  }

  const n = pts.length;
  const x = pts.map(p => p.x);
  const y = pts.map(p => p.y);

  const d = new Float64Array(n - 1);
  for (let k = 0; k < n - 1; k++) {
    const dx = x[k + 1] - x[k];
    d[k] = dx === 0 ? 0 : (y[k + 1] - y[k]) / dx;
  }

  const m = new Float64Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) {
      m[k] = 0;
    } else {
      m[k] = (d[k - 1] + d[k]) / 2;
    }
  }

  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
    } else {
      const alpha = m[k] / d[k];
      const beta = m[k + 1] / d[k];
      const sumSq = alpha * alpha + beta * beta;
      if (sumSq > 9) {
        const tau = 3 / Math.sqrt(sumSq);
        m[k] = tau * alpha * d[k];
        m[k + 1] = tau * beta * d[k];
      }
    }
  }

  let seg = 0;
  for (let i = 0; i < 256; i++) {
    if (i <= x[0]) {
      lut[i] = Math.max(0, Math.min(255, Math.round(y[0])));
      continue;
    }
    if (i >= x[n - 1]) {
      lut[i] = Math.max(0, Math.min(255, Math.round(y[n - 1])));
      continue;
    }
    while (seg < n - 2 && i > x[seg + 1]) {
      seg++;
    }
    const h = x[seg + 1] - x[seg];
    if (h === 0) {
      lut[i] = Math.max(0, Math.min(255, Math.round(y[seg])));
      continue;
    }
    const t = (i - x[seg]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const val = h00 * y[seg] + h10 * h * m[seg] + h01 * y[seg + 1] + h11 * h * m[seg + 1];
    lut[i] = Math.max(0, Math.min(255, Math.round(val)));
  }

  return lut;
}

// Master 256-byte Tone Mapping Look-Up Table
function buildAdjustmentLut(adj) {
  const lut = new Uint8Array(256);
  const black = Math.min(adj.blackPoint, adj.whitePoint - 1);
  const white = Math.max(adj.whitePoint, black + 1);
  const gamma = adj.gamma || 1.0;
  const bright = adj.brightness || 0;
  const contrast = adj.contrast || 0;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const curveLut = getSplineCurveTable(adj.curvePoints);

  for (let i = 0; i < 256; i++) {
    // 1. Levels: Black point, White point, Midtone Gamma
    let v = i;
    if (white > black) {
      let norm = (v - black) / (white - black);
      norm = Math.max(0, Math.min(1, norm));
      if (gamma !== 1.0 && norm > 0) {
        norm = Math.pow(norm, 1.0 / gamma);
      }
      v = norm * 255;
    }

    // 2. Spline Tone Curve
    const cIdx = Math.max(0, Math.min(255, Math.round(v)));
    v = curveLut[cIdx];

    // 3. Contrast & Brightness
    v = contrastFactor * (v - 128) + 128 + bright;
    lut[i] = Math.max(0, Math.min(255, Math.round(v)));
  }
  return lut;
}

// Apply pre-palette adjustments to target canvas
function applyImageAdjustments(targetCanvas, targetCtx, srcCanvasOrImg, adj) {
  if (!srcCanvasOrImg) return;
  const w = srcCanvasOrImg.naturalWidth || srcCanvasOrImg.width;
  const h = srcCanvasOrImg.naturalHeight || srcCanvasOrImg.height;
  if (!w || !h) return;

  if (targetCanvas.width !== w || targetCanvas.height !== h) {
    targetCanvas.width = w;
    targetCanvas.height = h;
  }

  targetCtx.clearRect(0, 0, w, h);
  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(srcCanvasOrImg, 0, 0, w, h);

  const isDefault = (
    adj.hue === 0 &&
    adj.saturation === 0 &&
    adj.lightness === 0 &&
    adj.brightness === 0 &&
    adj.contrast === 0 &&
    adj.blackPoint === 0 &&
    adj.gamma === 1.0 &&
    adj.whitePoint === 255 &&
    (!adj.curvePoints || (adj.curvePoints.length === 2 &&
      adj.curvePoints[0].x === 0 && adj.curvePoints[0].y === 0 &&
      adj.curvePoints[1].x === 255 && adj.curvePoints[1].y === 255))
  );

  if (isDefault) return;

  const imgData = targetCtx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const lut = buildAdjustmentLut(adj);
  const hasHsl = (adj.hue !== 0 || adj.saturation !== 0 || adj.lightness !== 0);

  if (!hasHsl) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      data[i] = lut[data[i]];
      data[i + 1] = lut[data[i + 1]];
      data[i + 2] = lut[data[i + 2]];
    }
  } else {
    const hueDelta = adj.hue;
    const satMul = 1 + adj.saturation / 100;
    const lightDelta = adj.lightness / 200;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const r1 = lut[data[i]];
      const g1 = lut[data[i + 1]];
      const b1 = lut[data[i + 2]];

      const hsl = rgbToHsl(r1, g1, b1);
      let hVal = (hsl[0] + hueDelta) % 360;
      if (hVal < 0) hVal += 360;
      let sVal = Math.max(0, Math.min(1, hsl[1] * satMul));
      let lVal = Math.max(0, Math.min(1, hsl[2] + lightDelta));

      const [r2, g2, b2] = hslToRgb(hVal, sVal, lVal);
      data[i] = r2;
      data[i + 1] = g2;
      data[i + 2] = b2;
    }
  }

  targetCtx.putImageData(imgData, 0, 0);
}

// Compute 256-bucket luminance histogram of raw source
function computeLuminanceHistogram(srcElement) {
  cachedHistogram.fill(0);
  if (!srcElement) return;
  const w = srcElement.naturalWidth || srcElement.width;
  const h = srcElement.naturalHeight || srcElement.height;
  if (!w || !h) return;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = Math.min(w, 256);
  tempCanvas.height = Math.min(h, 256);
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  tempCtx.drawImage(srcElement, 0, 0, tempCanvas.width, tempCanvas.height);

  const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
  let maxCount = 0;
  for (let i = 0; i < imgData.length; i += 4) {
    if (imgData[i + 3] < 32) continue;
    const lum = Math.round(0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2]);
    cachedHistogram[lum]++;
    if (cachedHistogram[lum] > maxCount) maxCount = cachedHistogram[lum];
  }

  if (maxCount > 0) {
    for (let i = 0; i < 256; i++) {
      cachedHistogram[i] /= maxCount;
    }
  }
}

// Draw curves canvas with histogram, grid, diagonal and interactive spline curve
function drawCurvesCanvas() {
  if (!curvesCanvas) return;
  const cCtx = curvesCanvas.getContext('2d');
  const w = curvesCanvas.width;
  const h = curvesCanvas.height;

  cCtx.clearRect(0, 0, w, h);

  // 1. Background
  cCtx.fillStyle = '#080b11';
  cCtx.fillRect(0, 0, w, h);

  // 2. Luminance Histogram (Semi-transparent bars)
  if (cachedHistogram) {
    cCtx.fillStyle = 'rgba(0, 240, 255, 0.14)';
    for (let i = 0; i < 256; i++) {
      const val = cachedHistogram[i];
      if (val > 0) {
        const barH = Math.round(val * (h - 8));
        cCtx.fillRect(i, h - barH, 1, barH);
      }
    }
  }

  // 3. 4x4 Grid
  cCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  cCtx.lineWidth = 1;
  cCtx.beginPath();
  for (let i = 1; i < 4; i++) {
    const gx = Math.round((w / 4) * i);
    const gy = Math.round((h / 4) * i);
    cCtx.moveTo(gx, 0);
    cCtx.lineTo(gx, h);
    cCtx.moveTo(0, gy);
    cCtx.lineTo(w, gy);
  }
  cCtx.stroke();

  // 4. Diagonal guide
  cCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  cCtx.setLineDash([3, 3]);
  cCtx.beginPath();
  cCtx.moveTo(0, h);
  cCtx.lineTo(w, 0);
  cCtx.stroke();
  cCtx.setLineDash([]);

  // 5. Monotone Spline Curve
  const curveLut = getSplineCurveTable(currentAdjustments.curvePoints);
  cCtx.strokeStyle = '#00f0ff';
  cCtx.lineWidth = 2;
  cCtx.shadowColor = 'rgba(0, 240, 255, 0.5)';
  cCtx.shadowBlur = 4;
  cCtx.beginPath();
  for (let x = 0; x < 256; x++) {
    const yVal = curveLut[x];
    const cy = h - (yVal / 255) * h;
    if (x === 0) cCtx.moveTo(x, cy);
    else cCtx.lineTo(x, cy);
  }
  cCtx.stroke();
  cCtx.shadowBlur = 0;

  // 6. Interactive Control Points
  currentAdjustments.curvePoints.forEach((pt, idx) => {
    const cx = pt.x;
    const cy = h - (pt.y / 255) * h;
    const isSelected = (idx === draggedCurvePointIdx);

    cCtx.beginPath();
    cCtx.arc(cx, cy, isSelected ? 5.5 : 4, 0, Math.PI * 2);
    cCtx.fillStyle = isSelected ? '#ffffff' : '#00f0ff';
    cCtx.fill();
    cCtx.strokeStyle = '#080b11';
    cCtx.lineWidth = 1.5;
    cCtx.stroke();
  });
}

function syncAdjustmentsUI() {
  if (adjHue) {
    adjHue.value = currentAdjustments.hue;
    adjHueVal.textContent = `${currentAdjustments.hue}°`;
  }
  if (adjSat) {
    adjSat.value = currentAdjustments.saturation;
    adjSatVal.textContent = `${currentAdjustments.saturation}%`;
  }
  if (adjLight) {
    adjLight.value = currentAdjustments.lightness;
    adjLightVal.textContent = `${currentAdjustments.lightness}%`;
  }
  if (adjBright) {
    adjBright.value = currentAdjustments.brightness;
    adjBrightVal.textContent = `${currentAdjustments.brightness}`;
  }
  if (adjContrast) {
    adjContrast.value = currentAdjustments.contrast;
    adjContrastVal.textContent = `${currentAdjustments.contrast}`;
  }
  if (adjBlack) {
    adjBlack.value = currentAdjustments.blackPoint;
    adjBlackVal.textContent = `${currentAdjustments.blackPoint}`;
  }
  if (adjGamma) {
    adjGamma.value = currentAdjustments.gamma;
    adjGammaVal.textContent = currentAdjustments.gamma.toFixed(2);
  }
  if (adjWhite) {
    adjWhite.value = currentAdjustments.whitePoint;
    adjWhiteVal.textContent = `${currentAdjustments.whitePoint}`;
  }
  drawCurvesCanvas();
}

function openAdjustmentsPanel() {
  if (!adjustmentsPanel) return;
  adjustmentsPanel.style.display = 'flex';
  isAdjustmentsPanelOpen = true;
  if (btnToggleAdjustments) btnToggleAdjustments.classList.add('btn-tool-active');
  syncAdjustmentsUI();
}

function closeAdjustmentsPanel() {
  if (!adjustmentsPanel) return;
  adjustmentsPanel.style.display = 'none';
  isAdjustmentsPanelOpen = false;
  if (btnToggleAdjustments) btnToggleAdjustments.classList.remove('btn-tool-active');
}

function toggleAdjustmentsPanel() {
  if (isAdjustmentsPanelOpen) {
    closeAdjustmentsPanel();
  } else {
    openAdjustmentsPanel();
  }
}

let isDraggingCurve = false;

function initAdjustmentsEvents() {
  if (btnToggleAdjustments) {
    btnToggleAdjustments.addEventListener('click', toggleAdjustmentsPanel);
  }
  if (btnCloseAdjustments) {
    btnCloseAdjustments.addEventListener('click', closeAdjustmentsPanel);
  }
  if (btnResetAllAdjustments) {
    btnResetAllAdjustments.addEventListener('click', () => {
      Object.assign(currentAdjustments, createDefaultAdjustments());
      syncAdjustmentsUI();
      triggerPreviewDebounced();
    });
  }
  if (btnResetCurve) {
    btnResetCurve.addEventListener('click', () => {
      currentAdjustments.curvePoints = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
      drawCurvesCanvas();
      triggerPreviewDebounced();
    });
  }

  // Hue
  if (adjHue) {
    adjHue.addEventListener('input', () => {
      currentAdjustments.hue = parseInt(adjHue.value) || 0;
      adjHueVal.textContent = `${currentAdjustments.hue}°`;
      triggerPreviewDebounced();
    });
  }
  // Saturation
  if (adjSat) {
    adjSat.addEventListener('input', () => {
      currentAdjustments.saturation = parseInt(adjSat.value) || 0;
      adjSatVal.textContent = `${currentAdjustments.saturation}%`;
      triggerPreviewDebounced();
    });
  }
  // Lightness
  if (adjLight) {
    adjLight.addEventListener('input', () => {
      currentAdjustments.lightness = parseInt(adjLight.value) || 0;
      adjLightVal.textContent = `${currentAdjustments.lightness}%`;
      triggerPreviewDebounced();
    });
  }
  // Brightness
  if (adjBright) {
    adjBright.addEventListener('input', () => {
      currentAdjustments.brightness = parseInt(adjBright.value) || 0;
      adjBrightVal.textContent = `${currentAdjustments.brightness}`;
      triggerPreviewDebounced();
    });
  }
  // Contrast
  if (adjContrast) {
    adjContrast.addEventListener('input', () => {
      currentAdjustments.contrast = parseInt(adjContrast.value) || 0;
      adjContrastVal.textContent = `${currentAdjustments.contrast}`;
      triggerPreviewDebounced();
    });
  }

  // Black Point
  if (adjBlack) {
    adjBlack.addEventListener('input', () => {
      let val = parseInt(adjBlack.value) || 0;
      if (val >= currentAdjustments.whitePoint) val = currentAdjustments.whitePoint - 1;
      currentAdjustments.blackPoint = val;
      adjBlack.value = val;
      adjBlackVal.textContent = `${val}`;
      triggerPreviewDebounced();
    });
  }
  // Midtone Gamma
  if (adjGamma) {
    adjGamma.addEventListener('input', () => {
      currentAdjustments.gamma = parseFloat(adjGamma.value) || 1.0;
      adjGammaVal.textContent = currentAdjustments.gamma.toFixed(2);
      triggerPreviewDebounced();
    });
  }
  // White Point
  if (adjWhite) {
    adjWhite.addEventListener('input', () => {
      let val = parseInt(adjWhite.value) || 255;
      if (val <= currentAdjustments.blackPoint) val = currentAdjustments.blackPoint + 1;
      currentAdjustments.whitePoint = val;
      adjWhite.value = val;
      adjWhiteVal.textContent = `${val}`;
      triggerPreviewDebounced();
    });
  }

  // Interactive Curves Canvas Mouse Events
  if (curvesCanvas) {
    curvesCanvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    curvesCanvas.addEventListener('mousedown', (e) => {
      const rect = curvesCanvas.getBoundingClientRect();
      const mouseX = Math.round((e.clientX - rect.left) * (curvesCanvas.width / rect.width));
      const mouseY = Math.round((e.clientY - rect.top) * (curvesCanvas.height / rect.height));
      const h = curvesCanvas.height;
      const curveY = Math.max(0, Math.min(255, Math.round(255 - (mouseY / h) * 255)));
      const curveX = Math.max(0, Math.min(255, mouseX));

      // Check if clicked on existing point
      let foundIdx = -1;
      currentAdjustments.curvePoints.forEach((pt, idx) => {
        const ptCanvasX = pt.x;
        const ptCanvasY = h - (pt.y / 255) * h;
        const dist = Math.hypot(mouseX - ptCanvasX, mouseY - ptCanvasY);
        if (dist <= 8) foundIdx = idx;
      });

      // Right-click: Delete point (if not endpoints)
      if (e.button === 2) {
        if (foundIdx > 0 && foundIdx < currentAdjustments.curvePoints.length - 1) {
          currentAdjustments.curvePoints.splice(foundIdx, 1);
          drawCurvesCanvas();
          triggerPreviewDebounced();
        }
        return;
      }

      if (e.button !== 0) return; // Only left-click for drag / add

      if (foundIdx !== -1) {
        draggedCurvePointIdx = foundIdx;
      } else {
        // Add new point
        const newPt = { x: curveX, y: curveY };
        currentAdjustments.curvePoints.push(newPt);
        currentAdjustments.curvePoints.sort((a, b) => a.x - b.x);
        draggedCurvePointIdx = currentAdjustments.curvePoints.indexOf(newPt);
      }

      isDraggingCurve = true;
      drawCurvesCanvas();
      triggerPreviewDebounced();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingCurve || draggedCurvePointIdx === -1) return;
      const rect = curvesCanvas.getBoundingClientRect();
      const mouseX = Math.round((e.clientX - rect.left) * (curvesCanvas.width / rect.width));
      const mouseY = Math.round((e.clientY - rect.top) * (curvesCanvas.height / rect.height));
      const h = curvesCanvas.height;
      const curveY = Math.max(0, Math.min(255, Math.round(255 - (mouseY / h) * 255)));
      const curveX = Math.max(0, Math.min(255, mouseX));

      const pts = currentAdjustments.curvePoints;
      const pt = pts[draggedCurvePointIdx];
      if (!pt) return;

      if (draggedCurvePointIdx === 0) {
        pt.x = 0;
        pt.y = curveY;
      } else if (draggedCurvePointIdx === pts.length - 1) {
        pt.x = 255;
        pt.y = curveY;
      } else {
        const minX = pts[draggedCurvePointIdx - 1].x + 1;
        const maxX = pts[draggedCurvePointIdx + 1].x - 1;
        pt.x = Math.max(minX, Math.min(maxX, curveX));
        pt.y = curveY;
      }

      drawCurvesCanvas();
      triggerPreviewDebounced();
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && isDraggingCurve) {
        isDraggingCurve = false;
        draggedCurvePointIdx = -1;
        drawCurvesCanvas();
      }
    });
  }

  // 1. COPY ADJUSTMENTS
  if (btnCopyAdjustments) {
    btnCopyAdjustments.addEventListener('click', () => {
      clipboardAdjustments = JSON.parse(JSON.stringify(currentAdjustments));
      const origText = btnCopyAdjustments.textContent;
      btnCopyAdjustments.textContent = 'COPIED!';
      btnCopyAdjustments.classList.add('btn-tool-active');
      setTimeout(() => {
        btnCopyAdjustments.textContent = origText;
        btnCopyAdjustments.classList.remove('btn-tool-active');
      }, 1000);
    });
  }

  // 2. PASTE ADJUSTMENTS
  if (btnPasteAdjustments) {
    btnPasteAdjustments.addEventListener('click', () => {
      if (!clipboardAdjustments) {
        const origText = btnPasteAdjustments.textContent;
        btnPasteAdjustments.textContent = 'NOTHING TO PASTE!';
        btnPasteAdjustments.style.color = 'var(--accent-orange)';
        setTimeout(() => {
          btnPasteAdjustments.textContent = origText;
          btnPasteAdjustments.style.color = '';
        }, 1000);
        return;
      }
      Object.assign(currentAdjustments, JSON.parse(JSON.stringify(clipboardAdjustments)));
      syncAdjustmentsUI();
      triggerPreviewDebounced();

      const origText = btnPasteAdjustments.textContent;
      btnPasteAdjustments.textContent = 'PASTED!';
      btnPasteAdjustments.classList.add('btn-tool-active');
      setTimeout(() => {
        btnPasteAdjustments.textContent = origText;
        btnPasteAdjustments.classList.remove('btn-tool-active');
      }, 1000);
    });
  }

  // 3. APPLY ADJUSTMENTS TO ALL
  if (btnApplyAdjustmentsAll) {
    btnApplyAdjustmentsAll.addEventListener('click', async () => {
      const confirmed = await showConfirmModal({
        title: 'APPLY ADJUSTMENTS TO ALL',
        message: 'Apply current Tone & Curves adjustments to all images in the batch queue?',
        details: `${batchFiles ? batchFiles.length : 1} image(s) will receive this adjustment profile.`,
        confirmText: 'APPLY TO ALL',
        cancelText: 'CANCEL'
      });
      if (!confirmed) return;

      const serialized = JSON.stringify(currentAdjustments);
      if (batchFiles && batchFiles.length > 0) {
        batchFiles.forEach(f => {
          batchImageAdjustments.set(f.name, JSON.parse(serialized));
        });
      } else if (loadedFilename) {
        batchImageAdjustments.set(loadedFilename, JSON.parse(serialized));
      }

      const origText = btnApplyAdjustmentsAll.textContent;
      btnApplyAdjustmentsAll.textContent = 'APPLIED TO ALL!';
      setTimeout(() => {
        btnApplyAdjustmentsAll.textContent = origText;
      }, 1200);
    });
  }
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
    renderGridOverlay();
    return;
  }

  const splitX = Math.round(w * splitPosition);
  splitPercent.textContent = `${Math.round(splitPosition * 100)}%`;

  ctx.clearRect(0, 0, w, h);

  // Left: Adjusted Original (Pre-Palette)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, splitX, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage((adjustedOffCanvas && adjustedOffCanvas.width > 0) ? adjustedOffCanvas : rawImageElement, 0, 0, w, h);
  ctx.restore();

  // Right: Snapped Nearest-Neighbor
  ctx.save();
  ctx.beginPath();
  ctx.rect(splitX, 0, w - splitX, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(currentSnappedCanvas, 0, 0, w, h);
  ctx.restore();

  updateSplitBarPosition();
  renderGridOverlay();
}

function getGridCanvas() {
  if (!gridCanvas) {
    gridCanvas = document.getElementById('gridCanvas');
    if (!gridCanvas && canvasScaler) {
      gridCanvas = document.createElement('canvas');
      gridCanvas.id = 'gridCanvas';
      gridCanvas.className = 'grid-canvas';
      gridCanvas.style.display = 'none';
      canvasScaler.appendChild(gridCanvas);
    }
  }
  return gridCanvas;
}

// 1 PIXEL GRID OVERLAY (50% WHITE, EXACT PIXEL SQUARES, ZOOM-GUARDED)
function renderGridOverlay() {
  const gCanvas = getGridCanvas();
  if (!gCanvas) return;

  if (!showGrid || !rawImageElement || !currentSnappedCanvas) {
    gCanvas.style.display = 'none';
    const gCtx = gCanvas.getContext('2d');
    if (gCtx) gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height);
    return;
  }

  const targetW = currentSnappedCanvas.width;
  const targetH = currentSnappedCanvas.height;
  const baseW = rawImageElement.naturalWidth || rawImageElement.width;
  const baseH = rawImageElement.naturalHeight || rawImageElement.height;
  const currentW = Math.round(baseW * (zoomPercent / 100));
  const currentH = Math.round(baseH * (zoomPercent / 100));

  if (targetW <= 0 || targetH <= 0 || currentW <= 0 || currentH <= 0) {
    gCanvas.style.display = 'none';
    return;
  }

  const cellScreenW = currentW / targetW;
  const cellScreenH = currentH / targetH;

  // Zoomed-out safety threshold: if cells are smaller than 6px on screen, do not draw
  if (cellScreenW < 6 || cellScreenH < 6) {
    gCanvas.style.display = 'none';
    const gCtx = gCanvas.getContext('2d');
    if (gCtx) gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height);
    return;
  }

  if (gCanvas.width !== currentW || gCanvas.height !== currentH) {
    gCanvas.width = currentW;
    gCanvas.height = currentH;
  }
  gCanvas.style.width = `${currentW}px`;
  gCanvas.style.height = `${currentH}px`;
  gCanvas.style.display = 'block';

  const gCtx = gCanvas.getContext('2d');
  gCtx.clearRect(0, 0, currentW, currentH);

  gCtx.save();
  // Clip strictly to the right side of the split slider (the snapped pixel art side)
  const splitScreenX = Math.round(currentW * splitPosition);
  gCtx.beginPath();
  gCtx.rect(splitScreenX, 0, currentW - splitScreenX, currentH);
  gCtx.clip();

  gCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  gCtx.lineWidth = 1;

  gCtx.beginPath();
  // Vertical column borders (from col 0 to targetW)
  for (let i = 0; i <= targetW; i++) {
    const x = i === targetW ? currentW - 1 : Math.round(i * cellScreenW);
    if (x >= splitScreenX - 1 && x <= currentW) {
      gCtx.moveTo(x + 0.5, 0);
      gCtx.lineTo(x + 0.5, currentH);
    }
  }

  // Horizontal row borders (from row 0 to targetH)
  for (let j = 0; j <= targetH; j++) {
    const y = j === targetH ? currentH - 1 : Math.round(j * cellScreenH);
    if (y <= currentH) {
      gCtx.moveTo(splitScreenX, y + 0.5);
      gCtx.lineTo(currentW, y + 0.5);
    }
  }
  gCtx.stroke();
  gCtx.restore();
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

// EYEDROPPER PALETTE BUILDER & LIVE PREVIEW IMPLEMENTATION
// =============================================================================
// ACTIVE PALETTE COLOR EXTRACTOR & EDITOR (EDIT ACTIVE PALETTE INSTEAD OF BLANK)
// =============================================================================
function getActivePaletteColors() {
  const pChoice = (currentEngine === 'unfake' ? unfakePaletteSelect.value : paletteSelect.value) || 'auto';

  // If already in custom eyedropper with colors
  if (pChoice === 'customEyedropper' && pickedEyedropperColors && pickedEyedropperColors.length > 0) {
    return pickedEyedropperColors.map(c => [...c]);
  }

  // If batch same palette is active and master palette is established
  if (isBatchSamePalette && masterBatchPalette && masterBatchPalette.length > 0) {
    return masterBatchPalette.map(c => [...c]);
  }

  // If reference / GPL palette
  if (pChoice === 'reference') {
    if (PALETTES['reference'] && PALETTES['reference'].length > 0) {
      return PALETTES['reference'].map(c => [...c]);
    }
    if (paletteRefPixels && paletteRefPixels.length > 0) {
      return paletteRefPixels.map(c => [...c]);
    }
  }

  // If preset dropdown selection
  if (PALETTES[pChoice] && PALETTES[pChoice].length > 0) {
    return PALETTES[pChoice].map(c => [...c]);
  }

  // If auto k-means palette was already generated on active image
  if (currentActivePalette && currentActivePalette.length > 0) {
    return currentActivePalette.map(c => [...c]);
  }

  // Fallback: extract from raw image
  if (rawOffCtx && rawImageElement) {
    const w = rawImageElement.naturalWidth || rawImageElement.width;
    const h = rawImageElement.naturalHeight || rawImageElement.height;
    const imgData = rawOffCtx.getImageData(0, 0, w, h).data;
    const px = [];
    const step = Math.max(1, Math.floor((w * h) / 4000));
    for (let i = 0; i < imgData.length; i += 4 * step) {
      if (imgData[i + 3] > 64) px.push([imgData[i], imgData[i + 1], imgData[i + 2]]);
    }
    if (px.length > 0) {
      const k = parseInt(colorCount.value) || 16;
      return runKMeans(px, k, 15);
    }
  }

  return PALETTES.cyberpunk16.map(c => [...c]);
}

// PALETTE EDITOR & LIVE PREVIEW IMPLEMENTATION
function startPaletteEditor() {
  if (!rawImageElement) {
    fileInput.click();
    return;
  }
  isEyedropperActive = true;
  if (splitBar) splitBar.classList.add('plain-mode');
  eyedropperHud.style.display = 'flex';
  openAdjustmentsPanel();

  [btnStartEyedropper, btnUnfakeStartEyedropper].forEach(b => {
    if (b) {
      b.classList.add('btn-eyedropper-active');
      b.textContent = 'EDITING PALETTE...';
    }
  });

  mainCanvas.style.cursor = 'crosshair';
  canvasScaler.style.cursor = 'crosshair';
  canvasWrapper.style.cursor = 'crosshair';

  // Always load the colors from the currently active palette
  const currentChoice = (currentEngine === 'unfake' ? unfakePaletteSelect.value : paletteSelect.value) || 'auto';
  if (currentChoice !== 'customEyedropper' || pickedEyedropperColors.length === 0) {
    const activeColors = getActivePaletteColors();
    pickedEyedropperColors = activeColors.map(c => [...c]);

    if (savePaletteName) {
      if (currentChoice === 'reference' && paletteRefName) {
        savePaletteName.value = `${paletteRefName.replace(/\.[^/.]+$/, "")} (Edited)`;
      } else if (currentChoice !== 'auto' && currentChoice !== 'customEyedropper') {
        savePaletteName.value = `${currentChoice.toUpperCase()} (Edited)`;
      } else {
        savePaletteName.value = "Custom Palette";
      }
    }
  }

  if (toggleLivePalette) {
    toggleLivePalette.checked = true;
  }
  applyLiveCustomPalette();
  updateEyedropperUI();
}

function stopEyedropper() {
  isEyedropperActive = false;
  if (splitBar) splitBar.classList.remove('plain-mode');
  eyedropperHud.style.display = 'none';
  eyedropperLoupe.style.display = 'none';

  [btnStartEyedropper, btnUnfakeStartEyedropper].forEach(b => {
    if (b) {
      b.classList.remove('btn-eyedropper-active');
      b.textContent = 'EDIT ACTIVE PALETTE';
    }
  });

  mainCanvas.style.cursor = '';
  canvasScaler.style.cursor = '';
  canvasWrapper.style.cursor = '';
}

function showEyedropperHint(msg) {
  if (!eyedropperHint) return;
  eyedropperHint.textContent = msg;
  eyedropperHint.style.color = 'var(--accent-orange)';
  setTimeout(() => {
    eyedropperHint.textContent = 'Click image to sample • Left-Click: Edit • Right-Click: Delete';
    eyedropperHint.style.color = '#94a3b8';
  }, 1800);
}

function applyLiveCustomPalette() {
  if (pickedEyedropperColors.length === 0) return;
  PALETTES.customEyedropper = pickedEyedropperColors.map(c => [...c]);
  if (isBatchSamePalette) {
    masterBatchPalette = pickedEyedropperColors.map(c => [...c]);
  }

  [paletteSelect, unfakePaletteSelect].forEach(sel => {
    if (!sel) return;
    let opt = sel.querySelector('option[value="customEyedropper"]');
    if (!opt) {
      opt = document.createElement('option');
      opt.value = 'customEyedropper';
      sel.insertBefore(opt, sel.firstChild);
    }
    opt.textContent = `Custom Eyedropper (${pickedEyedropperColors.length} Colors)`;
    sel.value = 'customEyedropper';
  });

  renderSwatches(pickedEyedropperColors);
  triggerPreviewDebounced();
}

function updateEyedropperUI() {
  eyedropperSwatches.innerHTML = '';
  const count = pickedEyedropperColors.length;

  if (btnSaveCustomPalette) {
    btnSaveCustomPalette.disabled = count === 0;
  }

  if (count === 0) {
    eyedropperSwatches.innerHTML = '<span class="empty-swatches-hint">Click on image to sample colors...</span>';
    btnFinishPalette.innerHTML = '&#10004; FINISH PALETTE (0 COLORS)';
    btnFinishPalette.disabled = true;
    return;
  }

  btnFinishPalette.disabled = false;
  btnFinishPalette.innerHTML = `&#10004; FINISH PALETTE (${count} COLORS)`;

  pickedEyedropperColors.forEach((c, idx) => {
    const sw = document.createElement('div');
    sw.className = 'eyedropper-swatch';
    const hex = rgbToHex(c[0], c[1], c[2]);
    sw.style.backgroundColor = `rgb(${c[0]},${c[1]},${c[2]})`;
    sw.title = `${hex.toUpperCase()} (${c[0]},${c[1]},${c[2]})\n• Left-Click: Edit in Advanced Picker\n• Right-Click: Delete`;

    // LEFT-CLICK: Open Advanced Color Picker to edit this color
    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      openAdvancedColorPicker(idx);
    });

    // RIGHT-CLICK: Delete color
    sw.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      pickedEyedropperColors.splice(idx, 1);
      updateEyedropperUI();
      if (toggleLivePalette && toggleLivePalette.checked) {
        if (pickedEyedropperColors.length > 0) {
          applyLiveCustomPalette();
        } else {
          toggleLivePalette.checked = false;
          paletteSelect.value = (previousPaletteChoice && previousPaletteChoice !== 'customEyedropper') ? previousPaletteChoice : 'auto';
          if (unfakePaletteSelect) unfakePaletteSelect.value = paletteSelect.value;
          updatePalettePreview();
          triggerPreviewDebounced();
        }
      }
    });

    eyedropperSwatches.appendChild(sw);
  });
}

// TOGGLE LIVE PREVIEW SLIDER (ON: Activates custom palette, OFF: Reverts to previous selection or auto k-means)
if (toggleLivePalette) {
  toggleLivePalette.addEventListener('change', () => {
    if (toggleLivePalette.checked) {
      if (paletteSelect.value !== 'customEyedropper') {
        previousPaletteChoice = paletteSelect.value || 'auto';
      }
      if (pickedEyedropperColors.length > 0) {
        applyLiveCustomPalette();
      } else {
        showEyedropperHint("Pick colors from the image first to preview!");
      }
    } else {
      const fallback = (previousPaletteChoice && previousPaletteChoice !== 'customEyedropper') ? previousPaletteChoice : 'auto';
      paletteSelect.value = fallback;
      if (paletteSelect.value !== fallback) paletteSelect.value = 'auto';
      if (unfakePaletteSelect) unfakePaletteSelect.value = paletteSelect.value;
      updatePalettePreview();
      triggerPreviewDebounced();
    }
  });
}

[btnStartEyedropper, btnUnfakeStartEyedropper].forEach(btn => {
  if (btn) {
    btn.addEventListener('click', () => {
      if (!rawImageElement) {
        fileInput.click();
        return;
      }
      if (isEyedropperActive) {
        stopEyedropper();
      } else {
        startPaletteEditor();
      }
    });
  }
});

if (btnEyedropperReload) {
  btnEyedropperReload.addEventListener('click', (e) => {
    e.stopPropagation();
    const activeColors = getActivePaletteColors();
    pickedEyedropperColors = activeColors.map(c => [...c]);
    updateEyedropperUI();
    if (toggleLivePalette && toggleLivePalette.checked) {
      applyLiveCustomPalette();
    }
    showEyedropperHint("↺ Reloaded original palette colors!");
  });
}

btnEyedropperCancel.addEventListener('click', () => stopEyedropper());

btnEyedropperClear.addEventListener('click', () => {
  pickedEyedropperColors = [];
  updateEyedropperUI();
  if (toggleLivePalette && toggleLivePalette.checked) {
    toggleLivePalette.checked = false;
    paletteSelect.value = (previousPaletteChoice && previousPaletteChoice !== 'customEyedropper') ? previousPaletteChoice : 'auto';
    if (unfakePaletteSelect) unfakePaletteSelect.value = paletteSelect.value;
    updatePalettePreview();
    triggerPreviewDebounced();
  }
});

btnFinishPalette.addEventListener('click', () => {
  if (pickedEyedropperColors.length === 0) {
    showAlertModal({
      title: 'EMPTY PALETTE',
      message: 'Please pick at least 1 color from the image first!'
    });
    return;
  }
  applyLiveCustomPalette();
  stopEyedropper();
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
  const sampleCanvas = (adjustedOffCanvas && adjustedOffCanvas.width > 0) ? adjustedOffCanvas : rawOffCanvas;
  const sampleCtx = (adjustedOffCanvas && adjustedOffCanvas.width > 0) ? adjustedOffCtx : rawOffCtx;
  const imgX = Math.floor(normX * sampleCanvas.width);
  const imgY = Math.floor(normY * sampleCanvas.height);

  if (imgX >= 0 && imgX < sampleCanvas.width && imgY >= 0 && imgY < sampleCanvas.height) {
    const p = sampleCtx.getImageData(imgX, imgY, 1, 1).data;
    const r = p[0], g = p[1], b = p[2], a = p[3];

    if (a === 0) {
      showEyedropperHint("Transparent pixel (Alpha 0) - skipped");
      return;
    }

    const hex = rgbToHex(r, g, b);
    const exists = pickedEyedropperColors.some(c => rgbToHex(c[0], c[1], c[2]) === hex);
    if (!exists) {
      pickedEyedropperColors.push([r, g, b]);
      addColorToGlobalHistory([r, g, b]);
      updateEyedropperUI();
      if (toggleLivePalette && toggleLivePalette.checked) {
        applyLiveCustomPalette();
      }
    } else {
      showEyedropperHint(`Color ${hex.toUpperCase()} already in palette`);
    }
  }
});

// =============================================================================
// OPEN-SOURCE GPL PALETTE GENERATOR & MULTI-TIER STORAGE (STORAGE + API + GPL)
// =============================================================================
function generateGPLContent(name, colors) {
  let gpl = `GIMP Palette\nName: ${name}\nColumns: 8\n#\n`;
  for (let c of colors) {
    const r = Math.min(255, Math.max(0, Math.round(c[0])));
    const g = Math.min(255, Math.max(0, Math.round(c[1])));
    const b = Math.min(255, Math.max(0, Math.round(c[2])));
    const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    gpl += `${r.toString().padStart(3, ' ')} ${g.toString().padStart(3, ' ')} ${b.toString().padStart(3, ' ')}\t${hex}\n`;
  }
  return gpl;
}

function downloadFile(filename, textContent, mimeType = 'text/plain') {
  try {
    const blob = new Blob([textContent], { type: mimeType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  } catch (err) {
    console.warn("Could not trigger file download:", err);
  }
}

function getLocalSavedPalettes() {
  try {
    const raw = localStorage.getItem('pb_saved_custom_palettes');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalPalette(paletteObj) {
  try {
    const list = getLocalSavedPalettes();
    const existingIdx = list.findIndex(p => p.id === paletteObj.id);
    if (existingIdx >= 0) {
      list[existingIdx] = paletteObj;
    } else {
      list.push(paletteObj);
    }
    localStorage.setItem('pb_saved_custom_palettes', JSON.stringify(list));
  } catch (e) {
    console.warn("Could not save to localStorage:", e);
  }
}

function addSavedPaletteToSelects(id, name, count) {
  [paletteSelect, unfakePaletteSelect].forEach(sel => {
    if (!sel) return;
    let group = sel.querySelector('optgroup.optgroup-saved-palettes');
    if (!group) {
      group = document.createElement('optgroup');
      group.label = "💾 Saved Custom Palettes";
      group.className = "optgroup-saved-palettes";
      const presetGroup = sel.querySelector('optgroup[label="PRESET PALETTES"]');
      if (presetGroup) {
        sel.insertBefore(group, presetGroup);
      } else {
        sel.appendChild(group);
      }
    }

    let opt = group.querySelector(`option[value="${id}"]`);
    if (!opt) {
      opt = document.createElement('option');
      opt.value = id;
      group.appendChild(opt);
    }
    opt.textContent = `${name} (${count} colors)`;
  });
}

async function loadSavedPalettes() {
  // 1. Always load from LocalStorage first (works 100% offline and on static servers like serve)
  const localList = getLocalSavedPalettes();
  localList.forEach(p => {
    if (p && p.id && Array.isArray(p.colors)) {
      PALETTES[p.id] = p.colors;
      addSavedPaletteToSelects(p.id, p.name || p.id, p.colors.length);
    }
  });

  // 2. Try loading from Backend Server (/api/palettes) safely if available
  try {
    const res = await fetch('/api/palettes');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.palettes)) {
        data.palettes.forEach(p => {
          if (p && p.id && Array.isArray(p.colors)) {
            PALETTES[p.id] = p.colors;
            addSavedPaletteToSelects(p.id, p.name || p.id, p.colors.length);
          }
        });
      }
    }
  } catch (err) {
    // Pure static environment - ignore silently
  }
}

if (btnSaveCustomPalette) {
  btnSaveCustomPalette.addEventListener('click', async () => {
    if (pickedEyedropperColors.length === 0) {
      showAlertModal({
        title: 'EMPTY PALETTE',
        message: 'Custom palette is empty! Sample colors from the image first.'
      });
      return;
    }

    const rawName = (savePaletteName.value || 'Custom Palette').trim();
    if (!rawName) return;

    btnSaveCustomPalette.disabled = true;
    btnSaveCustomPalette.textContent = "SAVING...";

    const safeId = 'saved_' + (rawName.replace(/[^a-zA-Z0-9_\-\u0370-\u03FF]/g, '_').toLowerCase() || 'palette');
    const gplContent = generateGPLContent(rawName, pickedEyedropperColors);
    const palObj = {
      id: safeId,
      name: rawName,
      filename: `${safeId.replace('saved_', '')}.gpl`,
      colors: pickedEyedropperColors.map(c => [...c]),
      savedAt: new Date().toISOString()
    };

    // 1. Immediately register in memory & LocalStorage
    PALETTES[safeId] = palObj.colors;
    saveLocalPalette(palObj);
    addSavedPaletteToSelects(safeId, rawName, pickedEyedropperColors.length);
    paletteSelect.value = safeId;
    if (unfakePaletteSelect) unfakePaletteSelect.value = safeId;
    updatePalettePreview();
    triggerPreviewDebounced();

    // 2. Safely attempt to persist to Backend API (if server is active)
    let savedToBackend = false;
    try {
      const res = await fetch('/api/palettes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rawName,
          colors: pickedEyedropperColors
        })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          savedToBackend = true;
        }
      }
    } catch (e) {
      // Backend not running on this port (e.g. running under static serve), fallback to browser storage & download
    }

    if (savedToBackend) {
      showEyedropperHint(`✓ Saved "${rawName}" to ./temp/saved/palettes/!`);
    } else {
      // Running under static web server: trigger download of the .gpl file
      downloadFile(`${safeId.replace('saved_', '')}.gpl`, gplContent, 'text/plain');
      showEyedropperHint(`✓ Saved "${rawName}" to storage & exported .gpl!`);
    }

    btnSaveCustomPalette.disabled = false;
    btnSaveCustomPalette.textContent = "💾 SAVE PALETTE";
  });
}

// =============================================================================
// ADVANCED COLOR PICKER (HUE WHEEL + EQUILATERAL SAT/VAL TRIANGLE + CHANNELS)
// =============================================================================
let editingSwatchIndex = -1;
let advH = 15;        // Hue: 0 - 360
let advS = 1.0;       // Saturation: 0.0 - 1.0
let advV = 1.0;       // Value / Brightness: 0.0 - 1.0
let advOrigRgb = [255, 85, 0];
let isDraggingWheel = false;
let isDraggingTriangle = false;
const pickerCanvas = advPickerWheelCanvas;
const pickerCtx = pickerCanvas ? pickerCanvas.getContext('2d') : null;

// Barycentric Equilateral Triangle Geometry (Canvas 250x250, Center 125, 125)
const TRI_APEX_X = 205; // Pure Hue Apex
const TRI_APEX_Y = 125;
const TRI_LEFT_X = 85;  // Vertical edge between White and Black
const TRI_WHITE_Y = 55.72;
const TRI_BLACK_Y = 194.28;
const TRI_WIDTH = TRI_APEX_X - TRI_LEFT_X; // 120
const TRI_SLOPE = (TRI_APEX_Y - TRI_WHITE_Y) / TRI_WIDTH; // 0.57735 (tan 30 deg)

function hsvToRgb(h, s, v) {
  h = (h % 360 + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  v = Math.max(0, Math.min(1, v));
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

function rgbToHsv(r, g, b) {
  r = r / 255;
  g = g / 255;
  b = b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else if (max === b) h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round((h % 360 + 360) % 360), s, v];
}

function drawAdvColorWheelAndTriangle() {
  if (!pickerCtx) return;
  pickerCtx.clearRect(0, 0, 250, 250);

  const cx = 125;
  const cy = 125;
  const rOut = 121;
  const rIn = 99;
  const ringMid = 110;

  // 1. Draw Chromatic Equilateral Triangle FIRST (Smooth Barycentric Gradient)
  const imgData = pickerCtx.createImageData(250, 250);
  const data = imgData.data;
  const pureHueRgb = hsvToRgb(advH, 1, 1);

  for (let x = TRI_LEFT_X; x <= TRI_APEX_X; x++) {
    const wHue = (x - TRI_LEFT_X) / TRI_WIDTH;
    const yTop = TRI_WHITE_Y + (x - TRI_LEFT_X) * TRI_SLOPE;
    const yBot = TRI_BLACK_Y - (x - TRI_LEFT_X) * TRI_SLOPE;
    const yTopI = Math.ceil(yTop);
    const yBotI = Math.floor(yBot);
    const hySpan = yBot - yTop;

    for (let y = yTopI; y <= yBotI; y++) {
      const t = hySpan > 0 ? (y - yTop) / hySpan : 0;
      const wBlack = t * (1 - wHue);
      const wWhite = (1 - t) * (1 - wHue);

      const r = Math.round(wHue * pureHueRgb[0] + wWhite * 255);
      const g = Math.round(wHue * pureHueRgb[1] + wWhite * 255);
      const b = Math.round(wHue * pureHueRgb[2] + wWhite * 255);

      const pIdx = (y * 250 + x) * 4;
      data[pIdx] = r;
      data[pIdx + 1] = g;
      data[pIdx + 2] = b;
      data[pIdx + 3] = 255;
    }
  }
  pickerCtx.putImageData(imgData, 0, 0);

  // 2a. Draw Outer Continuous Hue Ring
  for (let angle = 0; angle < 360; angle += 1) {
    const startRad = (angle - 1) * Math.PI / 180;
    const endRad = (angle + 1) * Math.PI / 180;
    pickerCtx.beginPath();
    pickerCtx.arc(cx, cy, ringMid, startRad, endRad);
    pickerCtx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
    pickerCtx.lineWidth = (rOut - rIn);
    pickerCtx.stroke();
  }

  // 2b. Draw 12 Discrete Harmonic Color Blocks on Inner Ring (around triangle, as in screenshot)
  for (let i = 0; i < 12; i++) {
    const tileH = i * 30;
    const startRad = (i * 30 - 13.5) * Math.PI / 180;
    const endRad = (i * 30 + 13.5) * Math.PI / 180;
    const [tr, tg, tb] = hsvToRgb(tileH, Math.max(0.4, advS * 0.85), Math.max(0.3, advV * 0.7));
    pickerCtx.beginPath();
    pickerCtx.arc(cx, cy, 90.5, startRad, endRad);
    pickerCtx.strokeStyle = `rgb(${tr},${tg},${tb})`;
    pickerCtx.lineWidth = 14;
    pickerCtx.stroke();
  }

  // 3. Draw Hue Selector Handle on Ring
  const hueRad = advH * Math.PI / 180;
  const hx = cx + ringMid * Math.cos(hueRad);
  const hy = cy + ringMid * Math.sin(hueRad);

  pickerCtx.save();
  pickerCtx.translate(hx, hy);
  pickerCtx.rotate(hueRad + Math.PI / 2);
  pickerCtx.beginPath();
  pickerCtx.roundRect(-10, -7, 20, 14, 5);
  pickerCtx.fillStyle = `hsl(${advH}, 100%, 50%)`;
  pickerCtx.fill();
  pickerCtx.lineWidth = 2.5;
  pickerCtx.strokeStyle = '#ffffff';
  pickerCtx.stroke();
  pickerCtx.lineWidth = 1;
  pickerCtx.strokeStyle = '#000000';
  pickerCtx.stroke();
  pickerCtx.restore();

  // 4. Draw Triangle Outline
  pickerCtx.beginPath();
  pickerCtx.moveTo(TRI_APEX_X, TRI_APEX_Y);
  pickerCtx.lineTo(TRI_LEFT_X, TRI_WHITE_Y);
  pickerCtx.lineTo(TRI_LEFT_X, TRI_BLACK_Y);
  pickerCtx.closePath();
  pickerCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  pickerCtx.lineWidth = 1.5;
  pickerCtx.stroke();

  // 5. Draw Sat/Val Marker Handle inside Triangle
  const wHue = advS * advV;
  const wWhite = (1 - advS) * advV;
  const wBlack = 1 - advV;

  const mx = TRI_LEFT_X + wHue * TRI_WIDTH;
  const my = wHue * TRI_APEX_Y + wWhite * TRI_WHITE_Y + wBlack * TRI_BLACK_Y;

  pickerCtx.beginPath();
  pickerCtx.arc(mx, my, 6, 0, Math.PI * 2);
  pickerCtx.strokeStyle = '#ffffff';
  pickerCtx.lineWidth = 2.5;
  pickerCtx.stroke();

  pickerCtx.beginPath();
  pickerCtx.arc(mx, my, 5, 0, Math.PI * 2);
  pickerCtx.strokeStyle = '#000000';
  pickerCtx.lineWidth = 1.2;
  pickerCtx.stroke();
}

// DYNAMIC HARMONIES & SHADES STRIP (SIMILAR, COMPLEMENTARY, RANDOM CONTEXTUAL)
function renderHarmoniesStrip(h, s, v) {
  if (!advHarmoniesStrip) return;
  advHarmoniesStrip.innerHTML = '';

  const list = [
    // 1. Similar / Analogous Hues (4 variations)
    { desc: 'Similar (-30°)', hsv: [(h - 30 + 360) % 360, s, v] },
    { desc: 'Similar (-15°)', hsv: [(h - 15 + 360) % 360, s, v] },
    { desc: 'Similar (+15°)', hsv: [(h + 15) % 360, s, v] },
    { desc: 'Similar (+30°)', hsv: [(h + 30) % 360, s, v] },

    // 2. Tonal Shades (Lighter Tint, Darker Shade, Muted Desaturated)
    { desc: 'Lighter Tint', hsv: [h, Math.max(0, s * 0.55), Math.min(1, v * 1.3)] },
    { desc: 'Darker Shade', hsv: [h, Math.min(1, s * 1.15), Math.max(0.12, v * 0.6)] },
    { desc: 'Muted Tone', hsv: [h, Math.max(0.08, s * 0.35), v] },

    // 3. Complementary & Split-Complementary (3 variations)
    { desc: 'Complementary (180°)', hsv: [(h + 180) % 360, s, v] },
    { desc: 'Split-Comp 1 (150°)', hsv: [(h + 150) % 360, s, v] },
    { desc: 'Split-Comp 2 (210°)', hsv: [(h + 210) % 360, s, v] },

    // 4. Triadic Accents
    { desc: 'Triad 1 (120°)', hsv: [(h + 120) % 360, s, v] },
    { desc: 'Triad 2 (240°)', hsv: [(h + 240) % 360, s, v] },

    // 5. Contextual Harmonious Variations in relation to current color
    { desc: 'Warm Shift (+45°)', hsv: [(h + 45) % 360, Math.max(0.1, s * 0.85), Math.max(0.2, v * 0.9)] },
    { desc: 'Cool Shift (-45°)', hsv: [(h - 45 + 360) % 360, Math.max(0.1, s * 0.9), Math.max(0.2, v * 0.85)] },
    { desc: 'Contrast (+75°)', hsv: [(h + 75) % 360, Math.max(0.15, s * 0.95), Math.max(0.25, v * 0.9)] },
    { desc: 'Contrast (-75°)', hsv: [(h - 75 + 360) % 360, Math.max(0.15, s * 0.95), Math.max(0.25, v * 0.9)] }
  ];

  list.forEach(item => {
    const [rh, rs, rv] = item.hsv;
    const [r, g, b] = hsvToRgb(rh, rs, rv);
    const hex = rgbToHex(r, g, b);

    const sw = document.createElement('div');
    sw.className = 'harmony-swatch';
    sw.style.backgroundColor = `rgb(${r},${g},${b})`;
    sw.title = `${item.desc}: ${hex.toUpperCase()} (${r},${g},${b})\nClick to select`;

    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      advH = Math.round(rh);
      advS = Math.max(0, Math.min(1, rs));
      advV = Math.max(0, Math.min(1, rv));
      syncAdvPickerUI('harmony');
    });

    advHarmoniesStrip.appendChild(sw);
  });
}

// GLOBAL COLOR HISTORY (24 FIXED SLOTS, 3x8 GRID)
const GLOBAL_COLOR_HISTORY_KEY = 'pb_global_color_history_24';

function getGlobalColorHistory() {
  try {
    const raw = localStorage.getItem(GLOBAL_COLOR_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 24);
    }
  } catch (e) {}

  // Retro starter palette for initial 24 slots (Cyberpunk & Classic 8-bit)
  return [
    [255, 85, 0], [0, 240, 255], [255, 0, 85], [0, 255, 136],
    [255, 208, 0], [148, 173, 199], [38, 52, 69], [11, 14, 20],
    [228, 59, 68], [254, 174, 52], [254, 231, 97], [99, 199, 77],
    [0, 153, 219], [44, 232, 245], [181, 80, 136], [246, 117, 122],
    [255, 255, 255], [192, 203, 220], [90, 105, 136], [24, 20, 37],
    [255, 0, 68], [104, 56, 108], [232, 183, 150], [62, 39, 49]
  ];
}

function addColorToGlobalHistory(rgb) {
  if (!rgb || rgb.length < 3) return;
  const history = getGlobalColorHistory();
  const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);

  // Remove existing duplicate
  const existingIdx = history.findIndex(c => rgbToHex(c[0], c[1], c[2]) === hex);
  if (existingIdx >= 0) {
    history.splice(existingIdx, 1);
  }

  // Prepend to front
  history.unshift([Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2])]);

  // Clamp to max 24 slots (3x8)
  const trimmed = history.slice(0, 24);
  try {
    localStorage.setItem(GLOBAL_COLOR_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {}

  renderGlobalColorHistory();
}

function renderGlobalColorHistory() {
  if (!advColorHistoryGrid) return;
  advColorHistoryGrid.innerHTML = '';
  const history = getGlobalColorHistory();

  // Exactly 24 slots (3 rows x 8 columns) are strictly rendered
  for (let i = 0; i < 24; i++) {
    const sw = document.createElement('div');
    if (i < history.length) {
      const c = history[i];
      const hex = rgbToHex(c[0], c[1], c[2]);
      sw.className = 'history-swatch';
      sw.style.backgroundColor = `rgb(${c[0]},${c[1]},${c[2]})`;
      sw.title = `Slot #${i + 1}: ${hex.toUpperCase()} (${c[0]},${c[1]},${c[2]})\nClick to select`;

      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        const [h, s, v] = rgbToHsv(c[0], c[1], c[2]);
        advH = h;
        advS = s;
        advV = v;
        syncAdvPickerUI('history');
      });
    } else {
      sw.className = 'history-swatch empty-slot';
      sw.title = `Slot #${i + 1} (Empty)`;
    }
    advColorHistoryGrid.appendChild(sw);
  }
}

if (btnAdvHistoryClear) {
  btnAdvHistoryClear.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      localStorage.setItem(GLOBAL_COLOR_HISTORY_KEY, JSON.stringify([]));
    } catch (err) {}
    renderGlobalColorHistory();
  });
}

function syncAdvPickerUI(source = 'all') {
  const [r, g, b] = hsvToRgb(advH, advS, advV);
  const hex = rgbToHex(r, g, b);

  // Update Canvas
  drawAdvColorWheelAndTriangle();

  // Update Harmonies & Shades Strip
  renderHarmoniesStrip(advH, advS, advV);

  // Update Top Compare Swatches & Readouts
  if (advSwatchNew) advSwatchNew.style.backgroundColor = `rgb(${r},${g},${b})`;
  if (advSwatchOrig) advSwatchOrig.style.backgroundColor = `rgb(${advOrigRgb[0]},${advOrigRgb[1]},${advOrigRgb[2]})`;
  if (source !== 'hex' && advHexInput) advHexInput.value = hex.toUpperCase();
  if (advReadoutHsl) advReadoutHsl.textContent = `H: ${advH}° S: ${Math.round(advS * 100)}% B: ${Math.round(advV * 100)}%`;
  if (advReadoutRgb) advReadoutRgb.textContent = `R: ${r} G: ${g} B: ${b}`;

  // Update Sliders and Number Steppers
  if (source !== 'sliders_h') {
    if (advSliderH) advSliderH.value = advH;
    if (advNumH) advNumH.value = advH;
  }
  if (source !== 'sliders_s') {
    const sPct = Math.round(advS * 100);
    if (advSliderS) advSliderS.value = sPct;
    if (advNumS) advNumS.value = sPct;
  }
  if (source !== 'sliders_b') {
    const vPct = Math.round(advV * 100);
    if (advSliderB) advSliderB.value = vPct;
    if (advNumB) advNumB.value = vPct;
  }
  if (source !== 'sliders_r') {
    if (advSliderR) advSliderR.value = r;
    if (advNumR) advNumR.value = r;
  }
  if (source !== 'sliders_g') {
    if (advSliderG) advSliderG.value = g;
    if (advNumG) advNumG.value = g;
  }
  if (source !== 'sliders_blue') {
    if (advSliderBlue) advSliderBlue.value = b;
    if (advNumBlue) advNumBlue.value = b;
  }

  // Live real-time preview update during edit if toggle is ON
  if (editingSwatchIndex >= 0 && pickedEyedropperColors[editingSwatchIndex]) {
    pickedEyedropperColors[editingSwatchIndex] = [r, g, b];
    const swatchEl = eyedropperSwatches.children[editingSwatchIndex];
    if (swatchEl) {
      swatchEl.style.backgroundColor = `rgb(${r},${g},${b})`;
      swatchEl.title = `${hex.toUpperCase()} (${r},${g},${b})\n• Left-Click: Edit in Advanced Picker\n• Right-Click: Delete`;
    }
    if (toggleLivePalette && toggleLivePalette.checked) {
      PALETTES.customEyedropper = pickedEyedropperColors.map(c => [...c]);
      if (isBatchSamePalette) {
        masterBatchPalette = pickedEyedropperColors.map(c => [...c]);
      }
      triggerPreviewDebounced();
    }
  }
}

function openAdvancedColorPicker(idx) {
  if (idx < 0 || idx >= pickedEyedropperColors.length) return;
  editingSwatchIndex = idx;
  const c = pickedEyedropperColors[idx];
  advOrigRgb = [...c];
  const [h, s, v] = rgbToHsv(c[0], c[1], c[2]);
  advH = h;
  advS = s;
  advV = v;

  if (advColorPickerModal) advColorPickerModal.style.display = 'flex';
  syncAdvPickerUI();
  renderGlobalColorHistory();
}

function closeAdvancedColorPicker(apply = false) {
  if (!apply && editingSwatchIndex >= 0) {
    // Revert swatch to original color
    pickedEyedropperColors[editingSwatchIndex] = [...advOrigRgb];
    updateEyedropperUI();
    if (toggleLivePalette && toggleLivePalette.checked) {
      applyLiveCustomPalette();
    }
  }
  editingSwatchIndex = -1;
  if (advColorPickerModal) advColorPickerModal.style.display = 'none';
}

if (btnAdvPickerClose) btnAdvPickerClose.addEventListener('click', () => closeAdvancedColorPicker(false));
if (btnAdvPickerCancel) btnAdvPickerCancel.addEventListener('click', () => closeAdvancedColorPicker(false));
if (btnAdvPickerApply) btnAdvPickerApply.addEventListener('click', () => {
  const [r, g, b] = hsvToRgb(advH, advS, advV);
  if (editingSwatchIndex >= 0) {
    pickedEyedropperColors[editingSwatchIndex] = [r, g, b];
    addColorToGlobalHistory([r, g, b]);
    updateEyedropperUI();
    if (toggleLivePalette && toggleLivePalette.checked) {
      applyLiveCustomPalette();
    }
  }
  closeAdvancedColorPicker(true);
});

// Click Original Swatch to Revert Color
if (advSwatchCompare) {
  advSwatchCompare.addEventListener('click', () => {
    const [h, s, v] = rgbToHsv(advOrigRgb[0], advOrigRgb[1], advOrigRgb[2]);
    advH = h;
    advS = s;
    advV = v;
    syncAdvPickerUI();
  });
}

// CANVAS INTERACTION FOR HUE WHEEL & TRIANGLE
if (pickerCanvas) {
  function handlePickerPointer(e) {
    const rect = pickerCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = 125, cy = 125;
    const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));

    // Outer continuous Hue Ring (98 - 126px)
    if (isDraggingWheel || (!isDraggingTriangle && dist >= 98 && dist <= 126)) {
      isDraggingWheel = true;
      let angle = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
      angle = (angle % 360 + 360) % 360;
      advH = Math.round(angle);
      syncAdvPickerUI('canvas');
      return;
    }

    // Inner 12 Discrete Harmonic Blocks (83 - 97px)
    if (!isDraggingWheel && !isDraggingTriangle && dist >= 83 && dist <= 97) {
      let angle = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
      angle = (angle % 360 + 360) % 360;
      const stepped = (Math.round(angle / 30) * 30) % 360;
      advH = stepped;
      syncAdvPickerUI('canvas');
      return;
    }

    // Inner Chromatic Equilateral Triangle
    if (isDraggingTriangle || (!isDraggingWheel && x >= TRI_LEFT_X - 10 && x <= TRI_APEX_X + 10)) {
      isDraggingTriangle = true;
      const clX = Math.max(TRI_LEFT_X, Math.min(TRI_APEX_X, x));
      const wHue = (clX - TRI_LEFT_X) / TRI_WIDTH;

      const yTop = TRI_WHITE_Y + (clX - TRI_LEFT_X) * TRI_SLOPE;
      const yBot = TRI_BLACK_Y - (clX - TRI_LEFT_X) * TRI_SLOPE;
      const clY = Math.max(yTop, Math.min(yBot, y));
      const hySpan = yBot - yTop;

      const t = hySpan > 0 ? (clY - yTop) / hySpan : 0;
      const wBlack = t * (1 - wHue);
      const wWhite = (1 - t) * (1 - wHue);

      advV = Math.max(0, Math.min(1, 1 - wBlack));
      advS = advV > 0 ? Math.max(0, Math.min(1, wHue / advV)) : 0;
      syncAdvPickerUI('canvas');
    }
  }

  pickerCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    handlePickerPointer(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isDraggingWheel || isDraggingTriangle) {
      handlePickerPointer(e);
    }
  });

  window.addEventListener('mouseup', () => {
    isDraggingWheel = false;
    isDraggingTriangle = false;
  });
}

// SLIDERS & NUMBER STEPPERS LISTENERS
if (advSliderH) advSliderH.addEventListener('input', () => {
  advH = parseInt(advSliderH.value) || 0;
  syncAdvPickerUI('sliders_h');
});
if (advNumH) advNumH.addEventListener('input', () => {
  advH = Math.max(0, Math.min(360, parseInt(advNumH.value) || 0));
  syncAdvPickerUI('sliders_h');
});

if (advSliderS) advSliderS.addEventListener('input', () => {
  advS = (parseInt(advSliderS.value) || 0) / 100;
  syncAdvPickerUI('sliders_s');
});
if (advNumS) advNumS.addEventListener('input', () => {
  advS = Math.max(0, Math.min(100, parseInt(advNumS.value) || 0)) / 100;
  syncAdvPickerUI('sliders_s');
});

if (advSliderB) advSliderB.addEventListener('input', () => {
  advV = (parseInt(advSliderB.value) || 0) / 100;
  syncAdvPickerUI('sliders_b');
});
if (advNumB) advNumB.addEventListener('input', () => {
  advV = Math.max(0, Math.min(100, parseInt(advNumB.value) || 0)) / 100;
  syncAdvPickerUI('sliders_b');
});

function onRgbSliderChange() {
  const r = Math.max(0, Math.min(255, parseInt(advSliderR.value) || 0));
  const g = Math.max(0, Math.min(255, parseInt(advSliderG.value) || 0));
  const b = Math.max(0, Math.min(255, parseInt(advSliderBlue.value) || 0));
  const [h, s, v] = rgbToHsv(r, g, b);
  advH = h;
  advS = s;
  advV = v;
  syncAdvPickerUI('sliders_rgb');
}

if (advSliderR) advSliderR.addEventListener('input', () => {
  if (advNumR) advNumR.value = advSliderR.value;
  onRgbSliderChange();
});
if (advNumR) advNumR.addEventListener('input', () => {
  if (advSliderR) advSliderR.value = advNumR.value;
  onRgbSliderChange();
});

if (advSliderG) advSliderG.addEventListener('input', () => {
  if (advNumG) advNumG.value = advSliderG.value;
  onRgbSliderChange();
});
if (advNumG) advNumG.addEventListener('input', () => {
  if (advSliderG) advSliderG.value = advNumG.value;
  onRgbSliderChange();
});

if (advSliderBlue) advSliderBlue.addEventListener('input', () => {
  if (advNumBlue) advNumBlue.value = advSliderBlue.value;
  onRgbSliderChange();
});
if (advNumBlue) advNumBlue.addEventListener('input', () => {
  if (advSliderBlue) advSliderBlue.value = advNumBlue.value;
  onRgbSliderChange();
});

if (advHexInput) {
  advHexInput.addEventListener('change', () => {
    let hex = advHexInput.value.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      const rgb = hexToRgb(hex);
      const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
      advH = h;
      advS = s;
      advV = v;
      syncAdvPickerUI('hex');
    }
  });
}

// =============================================================================
// SAVE & RESTORE ACTIVE OPTIONS PROFILES (LOCAL JSON IN ./temp/saved/options/)
// =============================================================================
function collectActiveOptions() {
  return {
    version: "1.5",
    timestamp: new Date().toISOString(),
    engine: currentEngine,
    divisor: currentDivisor,
    customScaleMode: customScaleMode,
    customFactor: customFactorVal,
    customTargetW: customTargetWVal,
    customTargetH: customTargetHVal,
    customKeepAspect: customKeepAspectVal,
    outlineWeight: parseFloat(outlineWeight.value) || 1.5,
    edgeSensitivity: parseFloat(edgeSensitivity.value) || 0.5,
    autoOutline: autoOutlineToggle.checked,
    autoOutlineColor: autoOutlineColor.value,
    snapAlpha: snapAlpha.checked,
    tezumieEnabled: tezumieToggle.checked,
    tezumieMethod: tezumieMethod.value,
    tezumieStrength: parseFloat(tezumieStrength.value) || 0.75,
    pass2Enabled: pass2Toggle.checked,
    colorCount: parseInt(colorCount.value) || 16,
    kmeansIter: parseInt(kmeansIter.value) || 15,
    palette: paletteSelect.value,
    zoom: zoomPercent,
    grid: showGrid,
    smartLineHealer: smartLineHealerToggle ? smartLineHealerToggle.checked : false,
    lineHealerSensitivity: lineHealerSensitivity ? (parseInt(lineHealerSensitivity.value) || 50) : 50,
    lineHealerMode: lineHealerMode ? lineHealerMode.value : 'gaps',
    lineHealerMaxGap: lineHealerMaxGap ? (parseInt(lineHealerMaxGap.value) || 1) : 1,
    // Unfake.js Parameters
    unfakeDetectMethod: unfakeDetectMethod ? unfakeDetectMethod.value : 'auto',
    unfakeManualScale: unfakeManualScale ? parseFloat(unfakeManualScale.value) : 8.0,
    unfakeSnapGrid: unfakeSnapGrid.checked,
    unfakeElasticGrid: unfakeElasticGrid.checked,
    unfakeDownscaleMethod: unfakeDownscaleMethod.value,
    unfakeDomThreshold: parseFloat(unfakeDomThreshold.value) || 0.15,
    unfakeMorph: unfakeMorph.checked,
    unfakeJaggy: unfakeJaggy.checked,
    unfakeAlphaBinarize: unfakeAlphaBinarize.checked,
    unfakeAlphaThreshold: parseInt(unfakeAlphaThreshold.value) || 128,
    unfakeAutoColors: unfakeAutoColors.checked,
    unfakeMaxColors: parseInt(unfakeMaxColors.value) || 32,
    unfakePalette: unfakePaletteSelect ? unfakePaletteSelect.value : 'auto'
  };
}

function applyOptionsProfile(opts) {
  if (!opts) return;

  if (opts.engine) setEngine(opts.engine);
  if (opts.divisor !== undefined) selectDivisor(opts.divisor);
  if (opts.customScaleMode) setCustomScaleMode(opts.customScaleMode);
  if (opts.customFactor !== undefined) {
    customFactorVal = opts.customFactor;
    if (snapperCustomFactorNum) snapperCustomFactorNum.value = customFactorVal;
    if (unfakeCustomFactorNum) unfakeCustomFactorNum.value = customFactorVal;
  }
  if (opts.customTargetW !== undefined) customTargetWVal = opts.customTargetW;
  if (opts.customTargetH !== undefined) customTargetHVal = opts.customTargetH;
  if (opts.customKeepAspect !== undefined) {
    customKeepAspectVal = opts.customKeepAspect;
    if (snapperCustomKeepAspect) snapperCustomKeepAspect.checked = customKeepAspectVal;
    if (unfakeCustomKeepAspect) unfakeCustomKeepAspect.checked = customKeepAspectVal;
  }
  syncTargetSizeInputs();
  updateCustomCalculatedDiv();

  // Pixel Snapper Options
  if (opts.outlineWeight !== undefined) {
    outlineWeight.value = opts.outlineWeight;
    outlineWeightNum.value = opts.outlineWeight;
  }
  if (opts.edgeSensitivity !== undefined) {
    edgeSensitivity.value = opts.edgeSensitivity;
    edgeSensitivityNum.value = opts.edgeSensitivity;
  }
  if (opts.autoOutline !== undefined) autoOutlineToggle.checked = opts.autoOutline;
  if (opts.autoOutlineColor) autoOutlineColor.value = opts.autoOutlineColor;
  if (opts.snapAlpha !== undefined) snapAlpha.checked = opts.snapAlpha;
  if (opts.tezumieEnabled !== undefined) {
    tezumieToggle.checked = opts.tezumieEnabled;
    tezumieOptions.style.display = opts.tezumieEnabled ? 'block' : 'none';
  }
  if (opts.tezumieMethod) tezumieMethod.value = opts.tezumieMethod;
  if (opts.tezumieStrength !== undefined) {
    tezumieStrength.value = opts.tezumieStrength;
    tezumieStrengthNum.value = opts.tezumieStrength;
  }
  if (opts.pass2Enabled !== undefined) pass2Toggle.checked = opts.pass2Enabled;
  if (opts.colorCount !== undefined) {
    colorCount.value = opts.colorCount;
    colorCountNum.value = opts.colorCount;
  }
  if (opts.kmeansIter !== undefined) {
    kmeansIter.value = opts.kmeansIter;
    kmeansIterNum.value = opts.kmeansIter;
  }
  if (opts.palette) {
    paletteSelect.value = opts.palette;
    if (unfakePaletteSelect) unfakePaletteSelect.value = opts.palette;
  }
  if (opts.smartLineHealer !== undefined) {
    if (smartLineHealerToggle) {
      smartLineHealerToggle.checked = opts.smartLineHealer;
      if (lineHealerOptions) lineHealerOptions.style.display = opts.smartLineHealer ? 'block' : 'none';
    }
    if (unfakeSmartLineHealerToggle) {
      unfakeSmartLineHealerToggle.checked = opts.smartLineHealer;
      if (unfakeLineHealerOptions) unfakeLineHealerOptions.style.display = opts.smartLineHealer ? 'block' : 'none';
    }
  }
  if (opts.lineHealerSensitivity !== undefined) {
    if (lineHealerSensitivity) lineHealerSensitivity.value = opts.lineHealerSensitivity;
    if (lineHealerSensitivityNum) lineHealerSensitivityNum.value = opts.lineHealerSensitivity;
    if (unfakeLineHealerSensitivity) unfakeLineHealerSensitivity.value = opts.lineHealerSensitivity;
    if (unfakeLineHealerSensitivityNum) unfakeLineHealerSensitivityNum.value = opts.lineHealerSensitivity;
  }
  if (opts.lineHealerMode !== undefined) {
    if (lineHealerMode) lineHealerMode.value = opts.lineHealerMode;
    if (unfakeLineHealerMode) unfakeLineHealerMode.value = opts.lineHealerMode;
  }
  if (opts.lineHealerMaxGap !== undefined) {
    if (lineHealerMaxGap) lineHealerMaxGap.value = opts.lineHealerMaxGap;
    if (unfakeLineHealerMaxGap) unfakeLineHealerMaxGap.value = opts.lineHealerMaxGap;
  }

  // Unfake.js Options
  if (opts.unfakeDetectMethod && unfakeDetectMethod) {
    unfakeDetectMethod.value = opts.unfakeDetectMethod;
    if (snapperDetectMethod) snapperDetectMethod.value = opts.unfakeDetectMethod;
  }
  if (opts.unfakeManualScale !== undefined && unfakeManualScale) {
    unfakeManualScale.value = opts.unfakeManualScale;
    if (snapperManualScale) snapperManualScale.value = opts.unfakeManualScale;
  }
  if (opts.unfakeSnapGrid !== undefined) unfakeSnapGrid.checked = opts.unfakeSnapGrid;
  if (opts.unfakeElasticGrid !== undefined) unfakeElasticGrid.checked = opts.unfakeElasticGrid;
  if (opts.unfakeDownscaleMethod) unfakeDownscaleMethod.value = opts.unfakeDownscaleMethod;
  if (opts.unfakeDomThreshold !== undefined) {
    unfakeDomThreshold.value = opts.unfakeDomThreshold;
    unfakeDomThresholdNum.value = opts.unfakeDomThreshold;
  }
  if (opts.unfakeMorph !== undefined) unfakeMorph.checked = opts.unfakeMorph;
  if (opts.unfakeJaggy !== undefined) unfakeJaggy.checked = opts.unfakeJaggy;
  if (opts.unfakeAlphaBinarize !== undefined) {
    unfakeAlphaBinarize.checked = opts.unfakeAlphaBinarize;
    unfakeAlphaThresholdRow.style.display = opts.unfakeAlphaBinarize ? 'block' : 'none';
  }
  if (opts.unfakeAlphaThreshold !== undefined) {
    unfakeAlphaThreshold.value = opts.unfakeAlphaThreshold;
    unfakeAlphaThresholdNum.value = opts.unfakeAlphaThreshold;
  }
  if (opts.unfakeAutoColors !== undefined) {
    unfakeAutoColors.checked = opts.unfakeAutoColors;
    unfakeMaxColorsRow.style.opacity = opts.unfakeAutoColors ? '0.5' : '1';
  }
  if (opts.unfakeMaxColors !== undefined) {
    unfakeMaxColors.value = opts.unfakeMaxColors;
    unfakeMaxColorsNum.value = opts.unfakeMaxColors;
  }

  // Zoom & Grid
  if (opts.zoom !== undefined) setZoom(opts.zoom);
  if (opts.grid !== undefined) {
    showGrid = opts.grid;
    btnToggleGrid.classList.remove('btn-grid-aborted');
    btnToggleGrid.classList.toggle('btn-grid-active', showGrid);
    btnToggleGrid.innerHTML = showGrid ? '&#9638; GRID: ON' : '&#9638; GRID: OFF';
    renderGridOverlay();
  }

  updatePalettePreview();
  updateDimensionsUI();
  triggerPreviewDebounced();
}

function getLocalSavedOptions() {
  try {
    const raw = localStorage.getItem('pb_saved_options_profiles');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalOptionsProfile(profileObj) {
  try {
    const list = getLocalSavedOptions();
    const existingIdx = list.findIndex(p => p.id === profileObj.id);
    if (existingIdx >= 0) {
      list[existingIdx] = profileObj;
    } else {
      list.push(profileObj);
    }
    localStorage.setItem('pb_saved_options_profiles', JSON.stringify(list));
  } catch (e) {
    console.warn("Could not save options to localStorage:", e);
  }
}

if (btnSaveOptions) {
  btnSaveOptions.addEventListener('click', async () => {
    const defaultName = `profile_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
    const name = prompt("Enter a name for this options profile:", defaultName);
    if (!name) return;

    const options = collectActiveOptions();
    const safeId = name.replace(/[^a-zA-Z0-9_\-\u0370-\u03FF]/g, '_').toLowerCase() || 'profile';
    const profileObj = {
      id: safeId,
      name: name,
      filename: `${safeId}.json`,
      savedAt: new Date().toISOString(),
      options: options
    };

    // 1. Always save to LocalStorage immediately
    saveLocalOptionsProfile(profileObj);

    // 2. Safely attempt to save to backend API if available
    let savedToBackend = false;
    try {
      const res = await fetch('/api/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, options })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) savedToBackend = true;
      }
    } catch (e) {}

    if (savedToBackend) {
      showAlertModal({
        title: 'SETTINGS SAVED',
        message: `Settings saved successfully to ./temp/saved/options/${profileObj.filename}`
      });
    } else {
      downloadFile(`${safeId}.json`, JSON.stringify(profileObj, null, 2), 'application/json');
      showAlertModal({
        title: 'SETTINGS EXPORTED',
        message: `Settings saved to browser storage and exported as "${safeId}.json"!`
      });
    }
  });
}

async function renderSavedOptionsModal() {
  if (!optionsLoadModal || !savedOptionsList) return;
  savedOptionsList.innerHTML = '<li class="text-dim text-xs">Loading profiles...</li>';
  optionsLoadModal.style.display = 'flex';

  const profilesMap = new Map();

  // 1. Load from LocalStorage
  const localList = getLocalSavedOptions();
  localList.forEach(p => {
    if (p && p.id) profilesMap.set(p.id, p);
  });

  // 2. Try loading from server if available
  try {
    const res = await fetch('/api/options');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success && Array.isArray(data.profiles)) {
        data.profiles.forEach(p => {
          if (p && p.id) profilesMap.set(p.id, p);
        });
      }
    }
  } catch (err) {}

  const allProfiles = Array.from(profilesMap.values());

  if (allProfiles.length > 0) {
    savedOptionsList.innerHTML = '';
    allProfiles.forEach(p => {
      const li = document.createElement('li');
      li.className = 'saved-option-item';

      const info = document.createElement('div');
      info.className = 'saved-option-info';
      const dateStr = p.savedAt ? new Date(p.savedAt).toLocaleString() : '';
      info.innerHTML = `<span class="saved-option-name">${p.name}</span><span class="saved-option-date">${dateStr} (${p.filename})</span>`;

      const btnLoad = document.createElement('button');
      btnLoad.type = 'button';
      btnLoad.className = 'btn-tool-sm btn-tool-active';
      btnLoad.textContent = 'RESTORE';
      btnLoad.addEventListener('click', () => {
        applyOptionsProfile(p.options);
        optionsLoadModal.style.display = 'none';
        showAlertModal({
          title: 'SETTINGS RESTORED',
          message: `Restored settings from "${p.name}"!`
        });
      });

      li.appendChild(info);
      li.appendChild(btnLoad);
      savedOptionsList.appendChild(li);
    });
  } else {
    savedOptionsList.innerHTML = '<li class="empty-swatches-hint">No saved profiles found.</li>';
  }
}

if (btnLoadOptions) {
  btnLoadOptions.addEventListener('click', () => renderSavedOptionsModal());
}
if (btnOptionsModalClose) btnOptionsModalClose.addEventListener('click', () => optionsLoadModal.style.display = 'none');
if (btnOptionsModalCancel) btnOptionsModalCancel.addEventListener('click', () => optionsLoadModal.style.display = 'none');

if (btnBrowseOptionsFile && optionsFileInput) {
  btnBrowseOptionsFile.addEventListener('click', () => {
    optionsFileInput.value = '';
    optionsFileInput.click();
  });
}

if (optionsFileInput) {
  optionsFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          const opts = parsed.options || parsed;
          applyOptionsProfile(opts);
          if (optionsLoadModal) optionsLoadModal.style.display = 'none';
          showAlertModal({
            title: 'SETTINGS RESTORED',
            message: `Restored settings from local file "${file.name}"!`
          });
        } catch (err) {
          showAlertModal({
            title: 'JSON ERROR',
            message: 'Error parsing JSON options file: ' + err.message,
            danger: true
          });
        }
      };
      reader.readAsText(file);
    }
  });
}

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
    const sampleCanvas = (adjustedOffCanvas && adjustedOffCanvas.width > 0) ? adjustedOffCanvas : rawOffCanvas;
    const sampleCtx = (adjustedOffCanvas && adjustedOffCanvas.width > 0) ? adjustedOffCtx : rawOffCtx;
    const imgX = Math.floor(normX * sampleCanvas.width);
    const imgY = Math.floor(normY * sampleCanvas.height);

    if (imgX >= 0 && imgX < sampleCanvas.width && imgY >= 0 && imgY < sampleCanvas.height) {
      const p = sampleCtx.getImageData(imgX, imgY, 1, 1).data;
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

// DOWNLOAD ASSET: [filename]_sn[sizeX].png or [filename]_unfake[sizeX].png (INDEXED PNG WITH PLTE & tRNS)
async function downloadAsset() {
  if (!currentSnappedCanvas || !rawImageElement) return;

  const targetW = currentSnappedCanvas.width;
  const targetH = currentSnappedCanvas.height;
  const baseName = loadedFilename.replace(/\.[^/.]+$/, "");
  const finalFilename = loadedFilename.toLowerCase().endsWith('.png') ? loadedFilename : `${baseName}.png`;

  try {
    const offCtx = currentSnappedCanvas.getContext('2d');
    const imgData = offCtx.getImageData(0, 0, targetW, targetH);
    const isHardAlpha = currentEngine === 'unfake' ? unfakeAlphaBinarize.checked : snapAlpha.checked;

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
}

btnDownload.addEventListener('click', downloadAsset);
if (btnUnfakeDownload) {
  btnUnfakeDownload.addEventListener('click', downloadAsset);
}

// BATCH PROCESSING
async function processBatch() {
  if (batchFiles.length === 0) return;

  // If SAME PALETTE is enabled, establish masterBatchPalette before batch export starts
  if (isBatchSamePalette && (!masterBatchPalette || masterBatchPalette.length === 0)) {
    const activeColors = getActivePaletteColors();
    if (activeColors && activeColors.length > 0) {
      masterBatchPalette = activeColors.map(c => [...c]);
    }
  }

  const buttons = [document.getElementById('btnProcessBatch'), btnUnfakeProcessBatch];
  buttons.forEach(b => { if (b) { b.disabled = true; b.textContent = "Processing Batch..."; } });

  const origSelectedIdx = currentBatchIndex;

  for (let i = 0; i < batchFiles.length; i++) {
    const file = batchFiles[i];
    buttons.forEach(b => { if (b) b.textContent = `Processing ${i + 1}/${batchFiles.length}...`; });

    await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
          rawImageElement = img;
          loadedFilename = file.name;
          currentAdjustments = getImageAdjustments(loadedFilename);
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          rawOffCanvas.width = w;
          rawOffCanvas.height = h;
          rawOffCtx.clearRect(0, 0, w, h);
          rawOffCtx.drawImage(img, 0, 0);

          if (currentDivisor === 'auto') {
            await runScaleDetection();
          }
          await updatePreviewAsync();
          await downloadAsset();
          await new Promise(r => setTimeout(r, 220));
          resolve();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Restore active viewed frame
  if (batchFiles[origSelectedIdx]) {
    await loadBatchImage(origSelectedIdx, true);
  }

  buttons.forEach(b => {
    if (b) {
      b.disabled = false;
      b.textContent = `✓ DONE (${batchFiles.length} FILES)`;
      setTimeout(() => { b.textContent = "BATCH PROCESS ALL"; }, 3000);
    }
  });
}

const batchBtn = document.getElementById('btnProcessBatch');
if (batchBtn) batchBtn.addEventListener('click', processBatch);
if (btnUnfakeProcessBatch) btnUnfakeProcessBatch.addEventListener('click', processBatch);

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
  const oldZoom = zoomPercent;
  const newZoom = Math.max(5, Math.min(1000, oldZoom + delta));
  if (newZoom === oldZoom) return;

  const rect = viewportScroller.getBoundingClientRect();
  const mx = e.clientX - (rect.left + rect.width / 2);
  const my = e.clientY - (rect.top + rect.height / 2);

  const factor = newZoom / oldZoom;
  panOffsetX = mx - (mx - panOffsetX) * factor;
  panOffsetY = my - (my - panOffsetY) * factor;

  setZoom(newZoom);
}, { passive: false });

// MIDDLE CLICK HOLD + DRAG PAN (NATURAL / PHOTOSHOP HAND TOOL STYLE)
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let initialPanX = 0;
let initialPanY = 0;

function startMiddlePan(e) {
  if (e.button === 1) { // Middle click button
    e.preventDefault();
    e.stopPropagation();
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    initialPanX = panOffsetX;
    initialPanY = panOffsetY;
    document.body.style.cursor = 'grabbing';
    canvasWrapper.style.cursor = 'grabbing';
    viewportScroller.style.cursor = 'grabbing';
    if (canvasScaler) canvasScaler.style.cursor = 'grabbing';
    if (mainCanvas) mainCanvas.style.cursor = 'grabbing';
  }
}

function stopMiddlePan() {
  if (isPanning) {
    isPanning = false;
    document.body.style.cursor = '';
    canvasWrapper.style.cursor = '';
    viewportScroller.style.cursor = '';
    if (canvasScaler) canvasScaler.style.cursor = '';
    if (mainCanvas) mainCanvas.style.cursor = '';
  }
}

// Capture mousedown on canvasWrapper & viewportScroller to prevent Windows autoscroll circle
canvasWrapper.addEventListener('mousedown', startMiddlePan, true);
viewportScroller.addEventListener('mousedown', startMiddlePan, true);

window.addEventListener('mousemove', (e) => {
  if (isPanning) {
    e.preventDefault();
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    // NATURAL / DIRECT PAN: dragging mouse right (dx > 0) moves image right
    // dragging mouse down (dy > 0) moves image down
    panOffsetX = initialPanX + dx;
    panOffsetY = initialPanY + dy;
    applyCanvasTransform();
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 1 && isPanning) {
    e.preventDefault();
    stopMiddlePan();
  }
});

window.addEventListener('blur', stopMiddlePan);

// Prevent Windows autoscroll navigation on middle click
canvasWrapper.addEventListener('auxclick', (e) => {
  if (e.button === 1) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);
viewportScroller.addEventListener('auxclick', (e) => {
  if (e.button === 1) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);
window.addEventListener('auxclick', (e) => {
  if (e.button === 1) e.preventDefault();
});

// Double middle-click: reset pan to center
canvasWrapper.addEventListener('dblclick', (e) => {
  if (e.button === 1) {
    e.preventDefault();
    resetPan();
  }
}, true);

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

// INITIAL STARTUP: LOAD SAVED GPL PALETTES FROM ./temp/saved/palettes/
loadSavedPalettes();

// INITIALIZE PRE-PALETTE ADJUSTMENTS ENGINE & EVENTS
initAdjustmentsEvents();


