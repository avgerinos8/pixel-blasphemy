# Color Palettes & Quantization Guide

## 1. Why Palette Quantization is Essential
Raw AI outputs generate thousands of microscopic color gradations (e.g., 14,000 unique RGB values in a 512×512 image). This creates:
1. "Muddled" muddy surfaces instead of clean pixel art clusters.
2. Clashing color tones between different tiles on the same game map.

Pixel Snapper uses **K-Means clustering** and **palette mapping** to clamp every pixel to an authentic, curated retro palette.

---

## 2. Recommended Palettes for Cyberpunk & Retro Games

### A. "Streets of Regex" Cyberpunk 16 (Recommended for this project)
Curated specifically for dark industrial alleys, neon conduits, and hazard stripes:
- Hex values:
  `0b0e14, 18212e, 263445, 3b4f63, 5a738e, 94adc7, ffffff, ffa800, ffd000, 00e5ff, 0088cc, 00ffff, ff0055, a80038, 22c55e, 14532d`
- **Breakdown**:
  - 6 Shades of Dark Steel & Machinery (`#0b0e14` to `#94adc7`)
  - 2 Warning Hazard Yellows (`#ffa800`, `#ffd000`)
  - 3 Neon Cyber Cyan Blues (`#0088cc`, `#00e5ff`, `#00ffff`)
  - 2 Warning Reds/Magentas (`#a80038`, `#ff0055`)
  - 2 Terminal Greens (`#14532d`, `#22c55e`)
  - 1 Highlight White (`#ffffff`)

### B. Endesga 32 (EDG 32)
The world standard for 32-color indie pixel art (balanced saturation, warm lights, cool shadows):
`be4a2f, d77643, ead4aa, e4a672, b86f50, 733e39, 3e2731, a22633, e43b44, f77622, feae34, fee761, 63c74d, 3e8948, 265c42, 193c3e, 124e89, 0099db, 2ce8f5, ffffff, c0cbdc, 8b9bb4, 5a6988, 3a4466, 262b44, 181425, ff0044, 68386c, b55088, f6757a, e8b796, c28569`

### C. DawnBringer 32 (DB32)
Legendary dark fantasy / arcade palette:
`000000, 222034, 45283c, 663931, 8f563b, df7126, d9a066, eec39a, fbf236, 99e550, 6abe30, 37946e, 4b692f, 524b24, 323c39, 3f3f74, 306082, 5b6ee1, 639bff, 5fcde4, cbdbfc, ffffff, 9badb7, 847e87, 696a6a, 595652, 76428a, ac3232, d95763, d77bba, 8f974a, 8a6f30`

### D. Pico-8 (16 Colors)
Iconic, punchy, compact:
`000000, 1D2B53, 7E2553, 008751, AB5236, 5F574F, C2C3C7, FFF1E8, FF004D, FFA300, FFEC27, 00E436, 29ADFF, 83769C, FF77A8, FFCCAA`

---

## 3. How to Use Palettes in Pixel Snapper CLI
Pass the `--palette` parameter with comma-separated hex codes:
```powershell
C:\ConfyUI\python_embeded\python.exe tools\pixel_snapper.py input.png output.png --palette "0b0e14,18212e,263445,ffa800,ffd000,00e5ff,ffffff"
```
