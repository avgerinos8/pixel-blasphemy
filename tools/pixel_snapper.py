#!/usr/bin/env python3
"""
PixelBlasphemy Standalone Pixel Snapper Tool (CLI & Batch Processor)
Based on Hugo Duprez's Sprite Fusion Pixel Snapper algorithm (MIT License).

Converts AI-generated "fake" pixel art into clean, grid-snapped, palette-quantized assets.
"""

import sys
import os
import argparse
import math
import numpy as np
from PIL import Image

def parse_palette_hex(hex_str):
    colors = []
    for item in hex_str.split(','):
        clean = item.strip().lstrip('#')
        if len(clean) == 6:
            r = int(clean[0:2], 16)
            g = int(clean[2:4], 16)
            b = int(clean[4:6], 16)
            colors.append(np.array([r, g, b], dtype=np.float32))
    return np.array(colors) if colors else None

def quantize_kmeans(img_rgb, k_colors=16, seed=42, max_iter=15):
    h, w, _ = img_rgb.shape
    pixels = img_rgb.reshape(-1, 3).astype(np.float32)
    n_pixels = pixels.shape[0]
    if n_pixels == 0:
        return img_rgb

    k = min(k_colors, n_pixels)
    rng = np.random.default_rng(seed)

    # KMeans++ init
    first_idx = rng.integers(0, n_pixels)
    centroids = [pixels[first_idx]]
    distances = np.full(n_pixels, np.inf, dtype=np.float32)

    for _ in range(1, k):
        last_c = centroids[-1]
        diff = pixels - last_c
        d_sq = np.sum(diff * diff, axis=1)
        distances = np.minimum(distances, d_sq)
        sum_sq = float(np.sum(distances))
        if sum_sq <= 0 or not math.isfinite(sum_sq):
            idx = rng.integers(0, n_pixels)
        else:
            probs = distances / sum_sq
            idx = rng.choice(n_pixels, p=probs)
        centroids.append(pixels[idx])

    centroids = np.stack(centroids, axis=0)

    # Iteration
    for _ in range(max_iter):
        prev = centroids.copy()
        diff = pixels[:, None, :] - centroids[None, :, :]
        dists = np.sum(diff * diff, axis=2)
        labels = np.argmin(dists, axis=1)

        sums = np.zeros_like(centroids)
        np.add.at(sums, labels, pixels)
        counts = np.bincount(labels, minlength=k).astype(np.float32)
        nonzero = counts > 0
        centroids[nonzero] = sums[nonzero] / counts[nonzero, None]

        movement = np.max(np.sum((centroids - prev) ** 2, axis=1))
        if movement < 0.01:
            break

    # Quantize
    diff = pixels[:, None, :] - centroids[None, :, :]
    dists = np.sum(diff * diff, axis=2)
    labels = np.argmin(dists, axis=1)
    quantized_pixels = centroids[labels].round().clip(0, 255).astype(np.uint8)
    return quantized_pixels.reshape((h, w, 3))

def apply_palette(img_rgb, palette_rgb):
    h, w, _ = img_rgb.shape
    pixels = img_rgb.reshape(-1, 3).astype(np.float32)
    diff = pixels[:, None, :] - palette_rgb[None, :, :]
    dists = np.sum(diff * diff, axis=2)
    labels = np.argmin(dists, axis=1)
    mapped = palette_rgb[labels].round().clip(0, 255).astype(np.uint8)
    return mapped.reshape((h, w, 3))

def compute_profiles(img_rgb):
    h, w, _ = img_rgb.shape
    diff_x = np.abs(img_rgb[:, 1:, :] - img_rgb[:, :-1, :]).sum(axis=2)
    profile_x = np.pad(diff_x.sum(axis=0), (1, 0), mode='constant')

    diff_y = np.abs(img_rgb[1:, :, :] - img_rgb[:-1, :, :]).sum(axis=2)
    profile_y = np.pad(diff_y.sum(axis=1), (1, 0), mode='constant')
    return profile_x, profile_y

def estimate_pixel_size(profile):
    diffs = np.where(profile > np.mean(profile) * 0.5)[0]
    if len(diffs) < 2:
        return 8.0
    intervals = np.diff(diffs)
    intervals = intervals[intervals >= 2]
    if len(intervals) == 0:
        return 8.0
    median_step = float(np.median(intervals))
    return max(1.0, median_step)

def snap_image(pil_img, k_colors=16, pixel_size=0.0, palette=None, target_grid=64):
    has_alpha = pil_img.mode == 'RGBA'
    if has_alpha:
        alpha = np.array(pil_img.split()[-1])
        rgb = np.array(pil_img.convert('RGB'))
    else:
        alpha = None
        rgb = np.array(pil_img.convert('RGB'))

    # Step 1: Quantize colors
    q_rgb = quantize_kmeans(rgb, k_colors=k_colors)

    # Step 2: Determine step size
    prof_x, prof_y = compute_profiles(q_rgb)
    if pixel_size > 0:
        step_x = pixel_size
        step_y = pixel_size
    elif target_grid > 0 and pil_img.width > target_grid:
        step_x = pil_img.width / float(target_grid)
        step_y = pil_img.height / float(target_grid)
    else:
        step_x = estimate_pixel_size(prof_x)
        step_y = estimate_pixel_size(prof_y)

    cols = max(1, int(round(pil_img.width / step_x)))
    rows = max(1, int(round(pil_img.height / step_y)))

    # Step 3: Resample down with Nearest Neighbor
    snapped = Image.fromarray(q_rgb).resize((cols, rows), resample=Image.Resampling.NEAREST)

    # Step 4: Apply custom palette if provided
    snapped_np = np.array(snapped)
    if palette is not None:
        snapped_np = apply_palette(snapped_np, palette)

    res_img = Image.fromarray(snapped_np)

    # Step 5: Handle Alpha
    if alpha is not None:
        alpha_img = Image.fromarray(alpha).resize((cols, rows), resample=Image.Resampling.NEAREST)
        alpha_np = np.array(alpha_img)
        alpha_np = np.where(alpha_np > 128, 255, 0).astype(np.uint8)
        res_img.putalpha(Image.fromarray(alpha_np))

    return res_img

def process_file(in_path, out_path, colors=16, pixel_size=0.0, palette_hex=None, target_grid=64):
    palette = parse_palette_hex(palette_hex) if palette_hex else None
    img = Image.open(in_path)
    snapped = snap_image(img, k_colors=colors, pixel_size=pixel_size, palette=palette, target_grid=target_grid)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    snapped.save(out_path, format='PNG')
    print(f"[OK] {os.path.basename(in_path)} ({img.size[0]}x{img.size[1]}) -> {os.path.basename(out_path)} ({snapped.size[0]}x{snapped.size[1]})")

def main():
    parser = argparse.ArgumentParser(description="PixelBlasphemy Standalone Pixel Snapper (Free Batch & CLI Tool)")
    parser.add_argument("input", help="Input image file or directory")
    parser.add_argument("output", help="Output PNG file or output directory")
    parser.add_argument("--colors", "-c", type=int, default=16, help="Color palette size (default: 16)")
    parser.add_argument("--pixel-size", "-p", type=float, default=0.0, help="Explicit pixel block size (0 = auto)")
    parser.add_argument("--grid", "-g", type=int, default=64, help="Target game grid (e.g. 64 for 64x64)")
    parser.add_argument("--palette", type=str, default=None, help="Comma-separated hex colors (e.g. '0b0e14,18212e,ffd700,00e5ff')")

    args = parser.parse_args()

    if os.path.isdir(args.input):
        os.makedirs(args.output, exist_ok=True)
        valid_exts = ('.png', '.jpg', '.jpeg', '.webp')
        files = [f for f in os.listdir(args.input) if f.lower().endswith(valid_exts)]
        print(f"Batch processing {len(files)} images from {args.input} -> {args.output}...")
        for fname in files:
            in_f = os.path.join(args.input, fname)
            out_f = os.path.join(args.output, os.path.splitext(fname)[0] + ".png")
            try:
                process_file(in_f, out_f, args.colors, args.pixel_size, args.palette, args.grid)
            except Exception as e:
                print(f"[ERROR] Failed {fname}: {e}")
        print("Batch complete!")
    else:
        process_file(args.input, args.output, args.colors, args.pixel_size, args.palette, args.grid)

if __name__ == "__main__":
    main()
