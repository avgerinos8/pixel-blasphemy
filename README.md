# PixelForge 🎮

> **The Zero-Mixels AI Pixel Art Pipeline & Studio for Indie Game Developers**  
> *100% Free, Local, and Open-Source*

---

## 🌟 What is PixelForge?
PixelForge provides a battle-tested pipeline to take high-resolution AI concept art from **Google Gemini / Nano-Banana** or **ComfyUI** and convert it into **mathematically perfect, grid-aligned, palette-quantized retro game assets** of any dimensions.

### Key Studio Features:
- 🚫 **No More AI Mixels**: Eliminates sub-pixel blur, inconsistent pixel scales, and muddy color bleeds.
- 📐 **Arbitrary Dimension Support**: Retains your image's exact dimensions and aspect ratio (no power-of-two enforcement).
- ⚡ **Downscale Selector (`/2`, `/4`, `/8`, `/16`, `1x`)**: Instant one-click integer downsampling before snapping.
- ✂️ **Interactive Crop Tool**: Crop any sub-region of your concept art directly in the browser.
- 👁️ **Non-Destructive Live Preview**: Split comparison slider (Original vs Snapped) updates in real-time without modifying your base file.
- 💾 **Smart Export Naming**: Automatically downloads with `[filename]_sn[sizeX].png` (e.g., `hazard_door_sn64.png`).
- ✕ **One-Click Image Eject / Close**: Easily eject the current image and drop a new one without unwanted file dialogs.
- 🚀 **`npx serve` Ready**: Run with `npm run dev` or `npx serve app -l 8080`.

---

## 🚀 Quickstart

### Option 1: Run with `npx serve`
```powershell
cd c:\dev\pixel-forge
npm run dev
# Or directly:
npx -y serve app -l 8080
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser!

### Option 2: Run with Python HTTP Server
```powershell
cd c:\dev\pixel-forge
python -m http.server 8080 --directory app
```

### Option 3: Run the Standalone CLI Batch Tool
```powershell
# Single image
C:\ConfyUI\python_embeded\python.exe tools\pixel_snapper.py input.png output_64x64.png --colors 16 --grid 64

# Batch process an entire directory of doors/props
C:\ConfyUI\python_embeded\python.exe tools\pixel_snapper.py raw_doors/ snapped_doors/ --colors 16 --palette "0b0e14,18212e,263445,ffd700,00e5ff,ffffff"
```

---

## 📖 Workflows Included
1. **Workflow 1: Prompt ➔ Nano-Banana ➔ Pixel Snapper**  
   Detailed guide in [`.agents/rules/workflow_nano_banana.md`](.agents/rules/workflow_nano_banana.md).
2. **Workflow 2: Dual ComfyUI Configuration Guide**  
   Detailed guide in [`.agents/rules/workflow_comfyui_dual.md`](.agents/rules/workflow_comfyui_dual.md).
3. **Color Palettes & Quantization Guide**  
   Detailed guide in [`.agents/rules/palette_guide.md`](.agents/rules/palette_guide.md).

---

## ⚖️ Credits & Licensing
- Pixel Snapper Core Engine © 2025 Hugo Duprez (`Hugo-Dz/spritefusion-pixel-snapper`, MIT License).
- ComfyUI Node Port © 2025 `x0x0b` (MIT License).
- PixelForge Studio & Pipelines developed for *Streets of Regex*.
