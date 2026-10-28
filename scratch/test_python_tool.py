import unittest
import numpy as np
from PIL import Image
import os
import sys

# Import pixel_snapper
sys.path.insert(0, os.path.abspath('tools'))
import pixel_snapper

class TestPixelSnapper(unittest.TestCase):
    def test_parse_palette_hex_6_and_3_digits(self):
        # 6-digit and 3-digit hex parsing
        hex_str = "#ff0000, #0f0, 0000ff, #123, fff"
        colors = pixel_snapper.parse_palette_hex(hex_str)
        self.assertIsNotNone(colors)
        self.assertEqual(len(colors), 5)
        np.testing.assert_array_equal(colors[0], [255, 0, 0])
        np.testing.assert_array_equal(colors[1], [0, 255, 0])
        np.testing.assert_array_equal(colors[2], [0, 0, 255])
        np.testing.assert_array_equal(colors[3], [17, 34, 51])
        np.testing.assert_array_equal(colors[4], [255, 255, 255])

    def test_quantize_kmeans_basic(self):
        # Create 16x16 test image with 4 clear color quadrants
        img = np.zeros((16, 16, 3), dtype=np.uint8)
        img[:8, :8] = [255, 0, 0]      # Red
        img[:8, 8:] = [0, 255, 0]      # Green
        img[8:, :8] = [0, 0, 255]      # Blue
        img[8:, 8:] = [255, 255, 0]    # Yellow

        q = pixel_snapper.quantize_kmeans(img, k_colors=4, max_iter=10)
        self.assertEqual(q.shape, (16, 16, 3))
        unique_colors = np.unique(q.reshape(-1, 3), axis=0)
        self.assertLessEqual(len(unique_colors), 4)

    def test_apply_palette_nearest(self):
        img = np.array([[[10, 10, 10], [240, 240, 240]]], dtype=np.uint8)
        palette = np.array([[0, 0, 0], [255, 255, 255]], dtype=np.float32)
        mapped = pixel_snapper.apply_palette(img, palette)
        np.testing.assert_array_equal(mapped[0, 0], [0, 0, 0])
        np.testing.assert_array_equal(mapped[0, 1], [255, 255, 255])

    def test_snap_image_pipeline(self):
        # Create 64x64 RGBA image
        img = Image.new('RGBA', (64, 64), (100, 150, 200, 255))
        snapped = pixel_snapper.snap_image(img, k_colors=8, target_grid=32)
        self.assertEqual(snapped.size, (32, 32))
        self.assertEqual(snapped.mode, 'RGBA')

if __name__ == '__main__':
    unittest.main()
