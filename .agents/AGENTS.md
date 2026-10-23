# PixelForge - Agent Guidelines & Architecture

## 1. Project Overview
**PixelForge** is a dedicated toolchain for generating, fixing, and mastering authentic retro **pixel art game assets** (tiles, doors, props, sprites) for modern indie game development.

- **Primary Goal**: Eliminate "AI Mixels" (blurry, anti-aliased, off-grid pixels with bloated color palettes) and establish reproducible, high-speed pipelines from Concept to Grid-Snapped Native Pixel Art.
- **Upstream Engine**: `Hugo-Dz/spritefusion-pixel-snapper` (MIT License).

---

## 2. The 2 Core Workflows

### Workflow 1: Prompt -> Nano-Banana (Gemini) -> Pixel Snapper
1. **Prompting**: Using Nano-Banana (Gemini Image Pro / Flash) with strict orthogonal 2D top-down constraints.
2. **Post-Processing**: Feeding the generated image into **Pixel Snapper** (via our free local GUI or CLI).
3. **Output**: A crisp, 64x64 or 32x32 native pixel art PNG snapped to the grid with a 16/32 color palette.

### Workflow 2: Dual ComfyUI Configuration
1. **Profile A (Fast Iteration)**: SD 1.5 + ControlNet Depth v1.1 + Pixel LoRA (0.8 - 1.5s per image on RTX 5060 Ti).
2. **Profile B (Ultra Fidelity)**: SDXL + ControlNet Depth XL + Pixel Art XL LoRA (6 - 8s per image, maximum mechanical & lighting detail).
3. **In-Graph Snapping**: Direct integration with the "Sprite Fusion Pixel Snapper" node.
4. **Palette Management**: K-Means automatic quantization vs. fixed Cyberpunk/NES/Endesga32 hex palettes.

---

## 3. Directory Layout
- `.agents/`: Guidelines, architecture, and workflow rules.
- `vendor/spritefusion-pixel-snapper/`: Cloned official Rust upstream repository (MIT License).
- `tools/pixel_snapper.py`: Standalone Python CLI & batch processor (runs with ComfyUI Python).
- `app/`: **PixelForge Studio** - Free local Web/Desktop GUI with live preview, batch processing, and palette selector.
- `workflows/`: Step-by-step setup guides and prompt templates.
