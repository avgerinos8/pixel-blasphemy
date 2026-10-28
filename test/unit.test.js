// PixelBlasphemy Studio - Comprehensive Unit Test Suite
// Runs in native Node.js with headless sandbox for app/app.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const appJsPath = path.join(ROOT, 'app', 'app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');

// Mock DOM & Browser Environment
function createMockElement(id = '', tag = 'div') {
  const isCanvas = tag.toLowerCase() === 'canvas' || id.toLowerCase().includes('canvas');
  const mockCtx = {
    drawImage: () => {},
    clearRect: () => {},
    getImageData: (x, y, w, h) => ({
      width: w || 10,
      height: h || 10,
      data: new Uint8ClampedArray((w || 10) * (h || 10) * 4)
    }),
    putImageData: () => {},
    fillRect: () => {},
    createImageData: (w, h) => ({
      width: w || 10,
      height: h || 10,
      data: new Uint8ClampedArray((w || 10) * (h || 10) * 4)
    }),
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    arc: () => {},
    fill: () => {}
  };

  const classes = new Set();
  return {
    id: id,
    tagName: tag.toUpperCase(),
    value: '',
    checked: false,
    disabled: false,
    width: 100,
    height: 100,
    style: {},
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c) => classes.has(c) ? (classes.delete(c), false) : (classes.add(c), true),
      contains: (c) => classes.has(c)
    },
    removeAttribute: () => {},
    setAttribute: () => {},
    hasAttribute: () => false,
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => createMockElement('', 'div'),
    querySelectorAll: () => [],
    appendChild: () => {},
    removeChild: () => {},
    remove: () => {},
    insertBefore: () => {},
    children: [],
    dataset: {},
    innerHTML: '',
    textContent: '',
    click: () => {},
    focus: () => {},
    getContext: () => mockCtx,
    toDataURL: () => 'data:image/png;base64,',
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
  };
}

const mockDoc = {
  getElementById: (id) => createMockElement(id),
  querySelector: () => createMockElement(),
  querySelectorAll: () => [],
  createElement: (tag) => {
    const el = createMockElement('', tag);
    if (tag.toLowerCase() === 'canvas') {
      el.width = 100;
      el.height = 100;
      el.getContext = () => ({
        drawImage: () => {},
        clearRect: () => {},
        getImageData: (x, y, w, h) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4)
        }),
        putImageData: () => {},
        fillRect: () => {},
        createImageData: (w, h) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4)
        })
      });
      el.toDataURL = () => 'data:image/png;base64,';
    }
    return el;
  },
  body: createMockElement('body')
};

const windowListeners = new Map();
function dispatchWindowEvent(event, data) {
  const handlers = windowListeners.get(event) || [];
  handlers.forEach(h => h(data));
}

const mockWindow = {
  addEventListener: (event, handler) => {
    if (!windowListeners.has(event)) windowListeners.set(event, []);
    windowListeners.get(event).push(handler);
  },
  removeEventListener: (event, handler) => {
    if (windowListeners.has(event)) {
      const arr = windowListeners.get(event);
      const i = arr.indexOf(handler);
      if (i !== -1) arr.splice(i, 1);
    }
  },
  ImageToPixel: null,
  UnfakeEngine: null,
  confirm: () => true,
  alert: () => {}
};

class MockImage {
  constructor() {
    this.width = 100;
    this.height = 100;
    this.naturalWidth = 100;
    this.naturalHeight = 100;
    this.onload = null;
    this._src = '';
  }
  set src(val) {
    this._src = val;
    if (this.onload) setTimeout(() => this.onload(), 0);
  }
  get src() { return this._src; }
}

class MockFileReader {
  constructor() {
    this.onload = null;
    this.result = '';
  }
  readAsDataURL() {
    this.result = 'data:image/png;base64,';
    if (this.onload) setTimeout(() => this.onload({ target: { result: this.result } }), 0);
  }
  readAsText() {
    this.result = '';
    if (this.onload) setTimeout(() => this.onload({ target: { result: this.result } }), 0);
  }
}

const mockLocalStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};

const sandbox = {
  window: mockWindow,
  document: mockDoc,
  Image: MockImage,
  FileReader: MockFileReader,
  localStorage: mockLocalStorage,
  navigator: { clipboard: { writeText: async () => {} } },
  console: console,
  Math: Math,
  Map: Map,
  Set: Set,
  Array: Array,
  Uint8Array: Uint8Array,
  Uint8ClampedArray: Uint8ClampedArray,
  Float64Array: Float64Array,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  JSON: JSON,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  fetch: async () => ({ ok: false, headers: { get: () => null } })
};

sandbox.window.window = sandbox.window;
sandbox.window.document = mockDoc;

const ctx = vm.createContext(sandbox);

try {
  vm.runInContext(appJs, ctx);
} catch (e) {
  console.error('Failed to load app.js in sandbox:', e);
  process.exit(1);
}

// Extract methods & objects from context
const {
  rgbToHex,
  hexToRgb,
  rgbToHsv,
  hsvToRgb,
  rgbToHsl,
  hslToRgb,
  findNearestColor,
  runKMeans,
  parseGPLContent,
  generateGPLContent,
  createDefaultAdjustments,
  getSplineCurveTable,
  buildAdjustmentLut,
  healBrokenOutlines,
  showConfirmModal,
  closeCustomModal,
  handleColorBudgetChange
} = ctx;

const PALETTES = vm.runInContext('PALETTES', ctx);

let testCount = 0;
let passCount = 0;
let failCount = 0;
const failures = [];

async function test(name, fn) {
  testCount++;
  try {
    await fn();
    passCount++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failCount++;
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failures.push({ name, error: err.message });
  }
}

function expectEqual(actual, expected, msg = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${msg} Expected ${expectedStr}, got ${actualStr}`);
  }
}

function expectTrue(val, msg = '') {
  if (!val) throw new Error(`${msg} Expected true, got ${val}`);
}

async function runUnitTests() {
  console.log('=== RUNNING JAVASCRIPT UNIT TESTS (app/app.js) ===\n');

  // 1. Color Conversions
  console.log('--- 1. Color Conversions ---');
  await test('rgbToHex standard colors', () => {
    expectEqual(rgbToHex(255, 0, 0), '#ff0000');
    expectEqual(rgbToHex(0, 255, 0), '#00ff00');
    expectEqual(rgbToHex(0, 0, 255), '#0000ff');
    expectEqual(rgbToHex(255, 255, 255), '#ffffff');
    expectEqual(rgbToHex(0, 0, 0), '#000000');
    expectEqual(rgbToHex(16, 32, 48), '#102030');
  });

  await test('rgbToHex clamps out of range values', () => {
    expectEqual(rgbToHex(300, -20, 128), '#ff0080');
  });

  await test('hexToRgb 6-digit & 3-digit hex', () => {
    expectEqual(hexToRgb('#ff0000'), [255, 0, 0]);
    expectEqual(hexToRgb('#00ff00'), [0, 255, 0]);
    expectEqual(hexToRgb('#0000ff'), [0, 0, 255]);
    expectEqual(hexToRgb('ff0000'), [255, 0, 0]);
    expectEqual(hexToRgb('#fff'), [255, 255, 255]);
    expectEqual(hexToRgb('#000'), [0, 0, 0]);
    expectEqual(hexToRgb('#123'), [17, 34, 51]);
  });

  await test('hexToRgb handles invalid or empty input gracefully', () => {
    const fallback = hexToRgb('invalid');
    expectTrue(Array.isArray(fallback) && fallback.length === 3, 'Should return a 3-element RGB array');
  });

  await test('RGB <-> HSV round-trip conversions', () => {
    const colors = [
      [255, 0, 0], [0, 255, 0], [0, 0, 255],
      [255, 255, 0], [0, 255, 255], [255, 0, 255],
      [128, 128, 128], [50, 100, 150]
    ];
    for (const [r, g, b] of colors) {
      const [h, s, v] = rgbToHsv(r, g, b);
      const [r2, g2, b2] = hsvToRgb(h, s, v);
      expectTrue(Math.abs(r - r2) <= 1 && Math.abs(g - g2) <= 1 && Math.abs(b - b2) <= 1,
        `HSV round-trip failed for [${r},${g},${b}] -> got [${r2},${g2},${b2}]`);
    }
  });

  await test('RGB <-> HSL round-trip conversions', () => {
    const colors = [
      [255, 0, 0], [0, 255, 0], [0, 0, 255],
      [200, 100, 50], [40, 80, 120]
    ];
    for (const [r, g, b] of colors) {
      const [h, s, l] = rgbToHsl(r, g, b);
      const [r2, g2, b2] = hslToRgb(h, s, l);
      expectTrue(Math.abs(r - r2) <= 2 && Math.abs(g - g2) <= 2 && Math.abs(b - b2) <= 2,
        `HSL round-trip failed for [${r},${g},${b}] -> got [${r2},${g2},${b2}]`);
    }
  });

  // 2. Nearest Color & Palette Matching
  console.log('\n--- 2. Nearest Color & Palette Matching ---');
  await test('findNearestColor exact match', () => {
    const palette = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]];
    expectEqual(findNearestColor(255, 0, 0, palette), [255, 0, 0]);
    expectEqual(findNearestColor(0, 255, 0, palette), [0, 255, 0]);
    expectEqual(findNearestColor(0, 0, 255, palette), [0, 0, 255]);
    expectEqual(findNearestColor([255, 0, 0], palette), [255, 0, 0]);
  });

  await test('findNearestColor closest proximity match', () => {
    const palette = [[0, 0, 0], [255, 255, 255]];
    expectEqual(findNearestColor(10, 10, 10, palette), [0, 0, 0]);
    expectEqual(findNearestColor(240, 240, 240, palette), [255, 255, 255]);
  });

  await test('findNearestColor single color palette', () => {
    const palette = [[42, 42, 42]];
    expectEqual(findNearestColor(255, 255, 255, palette), [42, 42, 42]);
  });

  // 3. K-Means Quantization
  console.log('\n--- 3. K-Means Clustering ---');
  await test('runKMeans produces exact count k or fewer', () => {
    const pixels = [];
    for (let i = 0; i < 100; i++) {
      pixels.push([Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)]);
    }
    const k = 8;
    const result = runKMeans(pixels, k, 10);
    expectTrue(result.length <= k, `Expected <= ${k} colors, got ${result.length}`);
    expectTrue(result.length > 0, 'Expected at least 1 color');
    result.forEach(c => {
      expectTrue(c.length === 3, 'Color must be [R,G,B]');
      c.forEach(ch => expectTrue(ch >= 0 && ch <= 255, `Channel value out of range: ${ch}`));
    });
  });

  await test('runKMeans handles fewer pixels than k', () => {
    const pixels = [[255, 0, 0], [0, 255, 0]];
    const result = runKMeans(pixels, 8, 5);
    expectTrue(result.length <= 2, `Expected <= 2 colors, got ${result.length}`);
  });

  await test('runKMeans empty pixels returns fallback', () => {
    const result = runKMeans([], 16, 5);
    expectTrue(Array.isArray(result), 'Should return an array');
  });

  // 4. GPL Format Parser & Generator
  console.log('\n--- 4. GPL Format Parser & Generator ---');
  await test('GPL round-trip parsing and generation', () => {
    const originalColors = [
      [0, 0, 0],
      [255, 255, 255],
      [255, 0, 85],
      [0, 240, 255]
    ];
    const gplText = generateGPLContent('Test Cyberpunk', originalColors);
    expectTrue(gplText.includes('GIMP Palette'), 'Must have GIMP Palette header');
    expectTrue(gplText.includes('Name: Test Cyberpunk'), 'Must have Name header');
    expectTrue(gplText.includes('Columns:'), 'Must have Columns header');

    const parsed = parseGPLContent(gplText);
    expectEqual(parsed.name, 'Test Cyberpunk');
    expectEqual(parsed.colors, originalColors);
  });

  await test('parseGPLContent handles standard real-world GPL text', () => {
    const realGpl = `GIMP Palette
Name: Pico-8
# Description: Official Pico-8 color palette
Columns: 8
#
  0   0   0	Black
 29  43  83	Dark Blue
126  37  83	Dark Purple
  0 135  81	Dark Green
171  82  54	Brown
 95  87  79	Dark Gray
194 195 199	Light Gray
255 241 232	White
`;
    const parsed = parseGPLContent(realGpl);
    expectEqual(parsed.name, 'Pico-8');
    expectEqual(parsed.colors.length, 8);
    expectEqual(parsed.colors[0], [0, 0, 0]);
    expectEqual(parsed.colors[7], [255, 241, 232]);
  });

  await test('parseGPLContent with Windows CRLF and irregular whitespace', () => {
    const gpl = "GIMP Palette\r\nName:   Spaced Out  \r\n# Comment\t\r\nColumns: 4\r\n  10   20   30\t#0a141e\r\n\r\n 100  150  200 \t#6496c8\r\n";
    const parsed = parseGPLContent(gpl);
    expectEqual(parsed.name, 'Spaced Out');
    expectEqual(parsed.colors.length, 2);
    expectEqual(parsed.colors[0], [10, 20, 30]);
    expectEqual(parsed.colors[1], [100, 150, 200]);
  });

  await test('parseGPLContent with empty or invalid text returns fallback', () => {
    const parsed = parseGPLContent('');
    expectTrue(parsed && Array.isArray(parsed.colors), 'Should return valid object with colors array');
  });

  // 5. Pre-Palette Adjustments Math
  console.log('\n--- 5. Pre-Palette Adjustments Math ---');
  await test('buildAdjustmentLut identity produces 1:1 map', () => {
    const adj = createDefaultAdjustments();
    const lut = buildAdjustmentLut(adj);
    expectEqual(lut.length, 256);
    for (let i = 0; i < 256; i++) {
      expectEqual(lut[i], i, `LUT[${i}] changed under identity adjustments`);
    }
  });

  await test('buildAdjustmentLut brightness increases output', () => {
    const adj = createDefaultAdjustments();
    adj.brightness = 30;
    const lut = buildAdjustmentLut(adj);
    expectTrue(lut[100] > 100, 'LUT with +30 brightness should increase 100');
  });

  await test('buildAdjustmentLut black and white point clipping', () => {
    const adj = createDefaultAdjustments();
    adj.blackPoint = 50;
    adj.whitePoint = 200;
    const lut = buildAdjustmentLut(adj);
    expectEqual(lut[0], 0, 'Values below blackPoint should clip to 0');
    expectEqual(lut[40], 0, 'Values below blackPoint should clip to 0');
    expectEqual(lut[220], 255, 'Values above whitePoint should clip to 255');
    expectEqual(lut[255], 255, 'Values above whitePoint should clip to 255');
  });

  // 6. Monotone Spline Curve LUT
  console.log('\n--- 6. Monotone Spline Curve LUT ---');
  await test('getSplineCurveTable default diagonal curve', () => {
    const points = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
    const table = getSplineCurveTable(points);
    expectEqual(table.length, 256, 'Spline LUT must have 256 entries');
    expectEqual(table[0], 0, 'Origin should map to 0');
    expectEqual(table[255], 255, 'Max should map to 255');
    for (let i = 1; i < 256; i++) {
      expectTrue(table[i] >= table[i - 1], `LUT must be monotonically non-decreasing at index ${i}`);
    }
  });

  await test('getSplineCurveTable S-curve contrast boost', () => {
    const points = [{ x: 0, y: 0 }, { x: 64, y: 32 }, { x: 192, y: 224 }, { x: 255, y: 255 }];
    const table = getSplineCurveTable(points);
    expectEqual(table.length, 256);
    expectTrue(table[64] <= 40, 'Shadows should be darkened in S-curve');
    expectTrue(table[192] >= 210, 'Highlights should be brightened in S-curve');
  });

  // 7. Smart Outline Healer Logic
  console.log('\n--- 7. Smart Outline Healer Logic ---');
  await test('healBrokenOutlines gap healing & anti-clump validation', () => {
    function createMockCanvas(w, h, fillAlpha = 255) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = fillAlpha;
      }
      return {
        width: w,
        height: h,
        getContext: () => ({
          getImageData: (x, y, gw, gh) => ({ width: gw, height: gh, data: data }),
          putImageData: (imgData) => { data.set(imgData.data); }
        }),
        _data: data
      };
    }

    const snapped = createMockCanvas(10, 10);
    const highRes = createMockCanvas(40, 40);
    const sData = snapped._data;
    function setPx(data, w, x, y, r, g, b, a = 255) {
      const idx = (y * w + x) * 4;
      data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = a;
    }
    function getPx(data, w, x, y) {
      const idx = (y * w + x) * 4;
      return [data[idx], data[idx+1], data[idx+2], data[idx+3]];
    }

    setPx(sData, 10, 2, 5, 0, 0, 0);
    // (3,5) is white (GAP)
    setPx(sData, 10, 4, 5, 0, 0, 0);

    // In high-res, draw dark ridge across x=8..18, y=20 (scale=4)
    const hData = highRes._data;
    for (let hx = 8; hx <= 18; hx++) {
      setPx(hData, 40, hx, 20, 10, 10, 10);
    }

    const palette = [[0, 0, 0], [255, 255, 255]];
    healBrokenOutlines(snapped, highRes, palette, {
      sensitivity: 70,
      mode: 'gaps',
      maxGap: 1
    });

    const healedPx = getPx(sData, 10, 3, 5);
    expectTrue(healedPx[0] < 128, `Gap pixel at (3,5) should have been healed to dark, got ${healedPx[0]}`);
  });

  await test('Standard built-in palettes exist and have valid RGB arrays', () => {
    const expectedPresets = ['cyberpunk16', 'endesga32', 'db32', 'pico8', 'gameboy'];
    expectedPresets.forEach(preset => {
      expectTrue(PALETTES[preset] && Array.isArray(PALETTES[preset]), `Preset ${preset} must exist`);
      expectTrue(PALETTES[preset].length > 0, `Preset ${preset} must have colors`);
      PALETTES[preset].forEach(c => {
        expectTrue(Array.isArray(c) && c.length === 3, `Color must be [R,G,B] in ${preset}`);
        c.forEach(ch => expectTrue(ch >= 0 && ch <= 255, `Channel out of bounds in ${preset}`));
      });
    });
  });

  // 8. Custom Confirmation Modal Flow
  console.log('\n--- 8. Custom Confirmation Modal Flow ---');
  await test('showConfirmModal and closeCustomModal promise lifecycle', async () => {
    let p = showConfirmModal({ title: 'TEST', message: 'Are you sure?' });
    expectTrue(p && typeof p.then === 'function', 'showConfirmModal must return a Promise');
    closeCustomModal(true);
    const resultTrue = await p;
    expectEqual(resultTrue, true, 'Confirm modal should resolve true');

    let p2 = showConfirmModal({ title: 'TEST 2', message: 'Cancel check' });
    closeCustomModal(false);
    const resultFalse = await p2;
    expectEqual(resultFalse, false, 'Cancel modal should resolve false');
  });

  // 9. Batch Same Palette State Synchronization
  console.log('\n--- 9. Batch Same Palette State Synchronization ---');
  await test('batchSamePalette checkboxes and masterBatchPalette logic', () => {
    const batchChk1 = vm.runInContext('batchSamePalette1', ctx);
    const batchChk2 = vm.runInContext('batchSamePalette2', ctx);
    expectTrue(batchChk1 !== undefined && batchChk2 !== undefined, 'Batch same palette checkboxes must exist in DOM');
    expectEqual(vm.runInContext('masterBatchPalette', ctx), null, 'masterBatchPalette should initially be null');
  });

  // 10. K-Means Overwrite Prevention
  console.log('\n--- 10. K-Means Overwrite Prevention ---');
  await test('Color count adjustment does not alter active custom palette if not auto-k-means', () => {
    const customColors = [[12, 34, 56], [78, 90, 123]];
    vm.runInContext('paletteSelect.value = "custom"', ctx);
    vm.runInContext(`currentActivePalette = ${JSON.stringify(customColors)}`, ctx);

    // Trigger color budget change
    handleColorBudgetChange(24, false);

    // currentActivePalette must remain intact!
    const afterActive = vm.runInContext('currentActivePalette', ctx);
    expectEqual(afterActive, customColors, 'Active custom palette must NOT be overwritten by handleColorBudgetChange');
  });

  // 11. Secret Tabs & Afroman Easter Egg
  console.log('\n--- 11. Secret Tabs & Afroman Easter Egg ---');
  await test('Secret tabs are initially hidden and locked', () => {
    const isUnlockedInitial = vm.runInContext('secretTabsUnlocked', ctx);
    expectEqual(isUnlockedInitial, false, 'secretTabsUnlocked should initially be false');
  });

  await test('Ambient keystroke listener unlocks secret tabs on "afroman" sequence', () => {
    vm.runInContext('secretTabsUnlocked = false; secretKeystrokeBuffer = "";', ctx);

    const word = 'afroman';
    for (const char of word) {
      dispatchWindowEvent('keydown', {
        key: char,
        code: `Key${char.toUpperCase()}`,
        ctrlKey: false,
        altKey: false,
        metaKey: false
      });
    }

    const isUnlocked = vm.runInContext('secretTabsUnlocked', ctx);
    expectEqual(isUnlocked, true, 'Typing "afroman" in the air must unlock secret tabs');
  });

  await test('Greek layout "αφρομαν" sequence unlocks secret tabs', () => {
    vm.runInContext('secretTabsUnlocked = false; secretKeystrokeBuffer = "";', ctx);

    const greekChars = ['α', 'φ', 'ρ', 'ο', 'μ', 'α', 'ν'];
    for (const char of greekChars) {
      dispatchWindowEvent('keydown', {
        key: char,
        code: '',
        ctrlKey: false,
        altKey: false,
        metaKey: false
      });
    }

    const isUnlocked = vm.runInContext('secretTabsUnlocked', ctx);
    expectEqual(isUnlocked, true, 'Typing Greek "αφρομαν" must also unlock secret tabs');
  });

  console.log('\n========================================');
  console.log(`TOTAL UNIT TESTS: ${testCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('========================================\n');

  if (failures.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runUnitTests();
}

module.exports = { runUnitTests };
