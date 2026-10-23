# PixelBlasphemy ⚡

> **The Zero-Mixels AI Pixel Art Pipeline & Studio for Indie Game Developers**  
> *100% Free, Local, and Open-Source*

---

## 🚀 What is PixelBlasphemy?
PixelBlasphemy provides a battle-tested pipeline to take high-resolution AI concept art from **Google Gemini / Nano-Banana** or **ComfyUI** and convert it into **mathematically perfect, grid-aligned, palette-quantized retro game assets** of any dimensions.

### Key Studio Features:
- 🎨 **Reference Palette Extractor**: Upload any external reference image (palette strip, game screenshot, or color sheet) to automatically sample its colors via K-Means and apply them to your sprite. Falls back seamlessly to the active image when cleared.
- 📐 **Zero-Scroll Viewport Fit**: Completely redesigned GUI engineered to fit within 100% of the viewport height and width (`% of smaller dimension`) without page or panel scrollbars.
- 🚫 **No More AI Mixels**: Eliminates sub-pixel blur, inconsistent pixel scales, and muddy color bleeds.
- 📏 **Arbitrary Dimension Support**: Retains your image's exact dimensions and aspect ratio (no power-of-two enforcement).
- 🎛️ **Downscale Selector (`/2`, `/4`, `/8`, `/16`, `1x`)**: Instant one-click integer downsampling before snapping.
- ⚡ **Tezumie Dither Engine (WebGL)**: Integrated shader pipeline with Floyd–Steinberg, Atkinson, Bayer 4×4/8×8, Blue Noise, and Sierra algorithms, fully synced with the active palette.
- 🛡️ **Outline Preservation Weighting**: Prevents thin 1-pixel dark outlines from being eaten by bright background pixels.
- 🖤 **Auto 1-px Arcade Outline**: Generate crisp retro sprite borders with a custom color picker.
- 🔍 **Interactive Zoom (25% – 800%) & Fit**: Smooth pixelated zooming with a quick `⊡ FIT` and `1:1 NATIVE` scale reset.
- 🎚️ **Bi-directional Precision Controls**: Every slider is synced with a number box for typing exact numeric values.
- 🪟 **Non-Destructive Live Preview**: Split comparison slider (Original vs Snapped) updates in real-time without modifying your base file.
- 💾 **Smart Export Naming**: Automatically downloads with `[filename]_sn[sizeX].png` (e.g., `hazard_door_sn64.png`).
- ⏏️ **One-Click Image Eject**: Easily eject the current image and drop a new one without unwanted file dialogs.
- 📦 **`npx serve` Ready**: Run with `npm run dev` or `npx serve app -l 8080`.

---

## 🛠️ Quickstart

### Option 1: Run with `npx serve`
```powershell
cd c:\dev\pixel-blasphemy
npm run dev
# Or directly:
npx -y serve app -l 8080
```
Open **`http://localhost:8080`** in any modern web browser.

---

## 🎨 Palette Workflow & Reference Extraction
1. **Default Auto**: PixelBlasphemy samples colors directly from your current image with outline preservation weighting.
2. **Reference Image Upload**: Click **`📷 UPLOAD PALETTE REFERENCE IMAGE`** in the palette section to extract colors from another sprite or palette swatch via K-Means. Adjust the **Color Budget** slider to dynamically change the number of extracted clusters in real-time.
3. **Revert**: Click **`✕ CLEAR`** to instantly revert to sampling from the active sprite.
4. **Tezumie Compatibility**: Enabling Tezumie's dither shader now uses the exact active extracted palette, ensuring clean dithering without color shifts or race conditions.
