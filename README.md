<div align="center"><pre>P I X E L   B L A S P H E M Y</pre>

Retro Pixel Art Snapper & Mastering Studio

# [LAUNCH STUDIO](https://avgerinos8.github.io/pixel-blasphemy/)

**Live Web Application:**  
### [https://avgerinos8.github.io/pixel-blasphemy/](https://avgerinos8.github.io/pixel-blasphemy/)

*Zero installation. Runs 100% client-side in any modern browser.*

</div>

---

## Overview

PixelBlasphemy converts AI-generated concept art (Gemini / Nano-Banana, ComfyUI, Midjourney) into grid-aligned, palette-quantized retro pixel art assets. It eliminates mixels, sub-pixel blur, and palette pollution.

The entire processing pipeline runs client-side in the browser via Canvas 2D and WebAssembly, with optional local Node.js or Python acceleration.

---

## Core Capabilities

- **Dual Engine Pipeline**:
  - **Pixel Snapper**: Sprite Fusion grid-snapping algorithm with integer downsampling (`/2`, `/4`, `/8`, `/16`, `1x`).
  - **Unfake Engine**: Multi-scale analysis combining autocorrelation, runs-based detection, and morphological cleanup.
- **Smart Outline Healer**:
  - High-res ridge / skeleton tracing restores broken contours and thin 1px silhouettes without pixel clumping.
- **Palette Architecture**:
  - K-Means color quantization with locked palette protection.
  - Interactive eyedropper color sampler with real-time magnification loupe.
  - Reference image color extractor.
  - Same Palette batch locking across all queued images.
  - Full GIMP GPL palette and JSON preset import/export.
- **Pre-Palette Curve Adjustments**:
  - Monotone cubic spline tone mapping curves, brightness, contrast, saturation, and black/white point clipping.
- **Retro Export**:
  - True 8-bit indexed-color PNG export (`PLTE` and `tRNS` chunks) with hard 1-bit or multi-level alpha.
  - Optional 1px arcade outline generation.

---

## How to Run

### 1. Online (Zero Install)
Open [https://avgerinos8.github.io/pixel-blasphemy/](https://avgerinos8.github.io/pixel-blasphemy/) directly. Works on any desktop, tablet, or mobile browser.

### 2. Windows One-Click (`Launch-PixelBlasphemy.bat`)
Double-click `Launch-PixelBlasphemy.bat` in the repository root.
- Detects Node.js and starts the full studio server.
- Falls back to Python's static server if Node is missing.
- Falls back to native Windows PowerShell HTTP server if neither Node nor Python is installed (zero dependencies).
- Automatically opens the default browser at `http://localhost:8080/`.

### 3. Local Node.js Server
```bash
npm start
# or: node server.js 8080
```
Runs the local server and enables saving palettes and options directly to `./temp/saved/`.

### 4. Static Dev Server
```bash
npx serve app -l 8080
```

### 5. Standalone Python CLI Tool
For automated or headless batch processing:
```bash
python tools/pixel_snapper.py input.png output.png --grid 64 --colors 16
```
Batch directory mode:
```bash
python tools/pixel_snapper.py ./input_dir ./output_dir --grid 64 --colors 16
```

---

## Testing

PixelBlasphemy includes a comprehensive test suite covering DOM integrity, color space math, K-Means clustering, GPL parser robustness, spline LUT curves, and server APIs:

```bash
npm test
```
Runs 46 automated unit and integration tests (zero extra npm dependencies).

---

## Project Structure

```text
pixel-blasphemy/
├── app/                  # Web application (HTML, CSS, JavaScript, WASM)
│   ├── index.html        # Main viewport interface
│   ├── app.js            # Core application logic & image processing
│   ├── style.css         # Styling & responsive design tokens
│   ├── unfake-engine.js  # WASM & pure JS grid detection engine
│   └── vendor/           # Local client-side dependencies
├── server.js             # Local Node.js server with GPL & preset disk API
├── tools/
│   └── pixel_snapper.py  # Standalone Python CLI / batch processing tool
├── test/
│   ├── unit.test.js      # Core algorithm unit tests (26 tests)
│   ├── integrity.test.js # HTML/CSS/JS structural integrity tests (7 tests)
│   ├── server.test.js    # Backend API integration tests (9 tests)
│   ├── python_tool.test.py # Python CLI test suite (4 tests)
│   └── run_all.js        # Test runner
├── Launch-PixelBlasphemy.bat # Windows one-click launcher
└── .github/workflows/
    └── deploy-pages.yml  # GitHub Pages automatic deployment workflow
```

---

## License

MIT License. See [LICENSE](LICENSE) for full details.
Upstream pixel-snapper engine based on `Hugo-Dz/spritefusion-pixel-snapper` (MIT License).
