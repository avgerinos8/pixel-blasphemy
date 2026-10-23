# Workflow 1: Prompt -> Nano-Banana (Gemini) -> Pixel Snapper

## 1. Overview
Nano-Banana is Google Gemini's multimodal image generation system (powered by Imagen 3 / Gemini Image Pro & Flash architecture). It has exceptional prompt reasoning, composition understanding, and artistic quality, but does not natively understand 64x64 pixel grids.

By pairing Nano-Banana with **Pixel Snapper**, you get the best of both worlds:
- **Nano-Banana**: Hallucination-free artistic design, color harmony, intricate sci-fi detailing.
- **Pixel Snapper**: Removes sub-pixel anti-aliasing, aligns every element to an exact 64x64 grid, and clamps colors to a retro palette.

---

## 2. The Golden Prompt Formula for Game Tiles

To prevent Nano-Banana from rendering random isometric angles or 3D perspective distortion, every prompt must follow this structure:

### The Template:
```text
[Subject & Style]: 16-bit retro arcade pixel art of a [CYBERPUNK HEAVY SLIDING DOOR / INDUSTRIAL CAR / TERMINAL CONSOLE].
[Viewpoint & Perspective]: Strictly orthogonal straight front view, flat 2D game asset, 0 degree perspective tilt, parallel vertical lines, flat floor baseline.
[Materials & Lighting]: Heavy dark steel plates, warning yellow and black hazard diagonal stripes, glowing cyan neon conduits, riveted metal seams, clean dithered shading.
[Background]: Solid flat magenta background (#FF00FF) or solid pure black background for clean isolation.
[Negative Constraints]: No isometric tilt, no 3D angle, no perspective vanishing point, no smooth vector gradients, no drop shadows.
```

### Ready-to-Use Prompt Examples:

#### A. Cyberpunk Sliding Hazard Door (Streets of Regex Style):
```text
16-bit retro arcade pixel art sprite of an industrial cyberpunk sliding blast door, split down the middle with heavy interlocking steel teeth. Straight flat orthogonal front view, 2D top-down game perspective, perfectly symmetrical. Dark metallic navy panels, prominent yellow and black diagonal hazard warning stripes, glowing neon cyan wiring tubes running vertically along the frame, recessed electronic keycard terminal. Solid plain black background, crisp pixel edges, limited vibrant 80s arcade color palette.
```

#### B. Cyberpunk Road Obstacle / Barricade:
```text
16-bit pixel art sprite of a heavy concrete and steel street roadblock barrier with flashing amber emergency strobe lights. Perfectly flat straight-on view, 2D top-down game asset. Scratched weathered concrete base, yellow hazard stripes, warning stencils. Solid flat magenta background for chroma-keying.
```

#### C. Hacking Terminal / Arcade Cabinet:
```text
16-bit pixel art sprite of a standing futuristic server terminal rack with glowing green CRT monitor displaying scrolling regular expression code, exposed colored ribbon cables, blinking red status LEDs, dark brushed titanium casing. Flat 2D front view, no angled perspective.
```

---

## 3. The Post-Processing Step (Pixel Snapper)

1. Save or copy the high-res image from Gemini / Nano-Banana (typically 1024x1024).
2. Open **PixelForge Studio** (`http://localhost:8080`) or run the CLI:
   ```powershell
   C:\ConfyUI\python_embeded\python.exe tools\pixel_snapper.py input.png output_64x64.png --colors 16 --pixel-size 16
   ```
3. Pixel Snapper will:
   - Detect and snap every cluster to a uniform 64x64 grid.
   - Reduce the thousands of AI color gradients to a strict 16 or 24 color palette.
   - Output a clean game-engine-ready asset.
