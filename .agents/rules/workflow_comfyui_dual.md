# Workflow 2: Dual ComfyUI Configuration Guide

## 1. Overview & Hardware Sizing
This configuration is tailored for an **NVIDIA GeForce RTX 5060 Ti (16GB VRAM)**. It avoids experimental academic DiT setups and utilizes battle-tested, proven checkpoint ecosystems with rock-solid ControlNet depth guidance.

---

## 2. Profile A: Fast Iteration (The "Rapid Prototype" Engine)

Use Profile A when you want to test 20 different door ideas or prompt tweaks in under 30 seconds.

- **Base Checkpoint**: `v1-5-pruned-emaonly.safetensors` (or `RetroDiffusion-SD15` / `Pixel-Art-Diffusion-v1`).
- **ControlNet Model**: `control_v11f1p_sd15_depth.pth` (Official Stable Diffusion 1.5 Depth ControlNet, 1.45 GB).
  - Place in: `ComfyUI/models/controlnet/control_v11f1p_sd15_depth.pth`
- **LoRA**: `pixel-art-v1.safetensors` (or `arcade-retro-lora`, weight: `0.75`).
  - Place in: `ComfyUI/models/loras/`
- **Resolution**: 512×512 (scaled from/to 64×64).
- **Sampling Settings**:
  - Sampler: `Euler a` or `DPM++ 2M Karras`
  - Steps: `20`
  - CFG: `6.5 - 7.5`
- **Speed**: **0.8 - 1.2 seconds per generation** on RTX 5060 Ti!
- **ControlNet Depth Strength**: `0.85 - 1.0` (locks the Blender 60° angle and door frame shape with 0% drift).

---

## 3. Profile B: Ultra Fidelity (The "Final Master Asset" Engine)

Use Profile B when you have finalized your design and want pristine, publication-grade cyberpunk metal surfaces, intricate circuitry, and glowing hazard lights.

- **Base Checkpoint**: `juggernautXL_v9Rdphoto2.safetensors` or `realvisxlV40_v40LightningBakedvae.safetensors`.
  - Place in: `ComfyUI/models/checkpoints/`
- **ControlNet Model**: `controlnet-depth-sdxl-1.0.safetensors` (or `xinsir/controlnet-union-sdxl-1.0`).
  - Place in: `ComfyUI/models/controlnet/`
- **LoRA**: `PixelArtXL.safetensors` (weight: `0.80`).
  - Place in: `ComfyUI/models/loras/`
- **Resolution**: 1024×1024.
- **Sampling Settings**:
  - Sampler: `DPM++ 2M SDE Karras`
  - Steps: `28 - 35`
  - CFG: `5.0 - 6.0`
- **Speed**: **5.0 - 7.5 seconds per generation** on RTX 5060 Ti.
- **Visual Result**: High dynamic range, zero muddy pixels, hyper-detailed mechanical fixtures.

---

## 4. The Seed Question: Can you get the same result across profiles?

### Can a Seed be identical between SD 1.5 and SDXL?
**Mathematically, NO.**
- SD 1.5 latent space is **64×64×4**.
- SDXL latent space is **128×128×4**.
- A random seed initializes Gaussian noise. Because the matrix dimensions and transformer weights differ completely, Seed `42` in SD 1.5 and Seed `42` in SDXL will produce completely different initial noise patterns.

### How to achieve cross-profile visual consistency:
**ControlNet Depth is your bridge!**
When you connect the same 3D depth map (e.g., `depth_door_h_left.png` from Blender):
- The **3D perspective, door width, split line, frame, and camera angle are 100% identical** across SD 1.5 and SDXL.
- Use Profile A to find a prompt and color palette you like, then switch the checkpoint to Profile B for the final render!

---

## 5. Integrating Pixel Snapper in ComfyUI

### Installation:
1. Open ComfyUI Manager -> Click **Install Custom Nodes**.
2. Search for: `Sprite Fusion Pixel Snapper` (by `x0x0b`).
3. Click **Install** and restart ComfyUI.
*(Alternative manual install: `git clone https://github.com/x0x0b/ComfyUI-spritefusion-pixel-snapper C:\ConfyUI\ComfyUI\custom_nodes\`)*

### Node Wiring:
```
[VAEDecode] (IMAGE output)
     │
     ▼
[Sprite Fusion Pixel Snapper]
     ├── k_colors: 16 (or 24)
     ├── pixel_size: 0.0 (auto-detect) or 8.0 (override)
     ├── output_scale: 1 (native tile)
     │
     ▼
[SaveImage] (Crisp, grid-aligned 64x64 game-ready asset!)
```

### Color Palette Strategy:
1. **Auto K-Means (Default)**: Automatically extracts the 16 most dominant and harmonious colors from the generation.
2. **Fixed Custom Palette (Preset Hex)**: If you want all doors, walls, and props to share the exact same cyberpunk colors, specify a fixed hex list (e.g. Cyberpunk 16: `#0b0e14,#18212e,#2a3b4c,#ffd700,#ffaa00,#00e5ff,#ff0055,#ffffff`).
