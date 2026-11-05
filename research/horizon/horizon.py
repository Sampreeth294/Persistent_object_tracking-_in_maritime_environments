"""Run the horizon detector on one image:  python3 horizon.py frame.jpg"""
import sys

import cv2

from _common import detect_horizon, horizon_y_at

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: python3 horizon.py <image_path>")
    image = cv2.imread(sys.argv[1])
    if image is None:
        sys.exit(f"Could not read image: {sys.argv[1]}")

    hz = detect_horizon(image)
    if hz is None:
        sys.exit("No horizon found")

    h, w = image.shape[:2]
    print(f"Image size: {w}x{h}")
    print(f"Horizon y at centre: {hz['y_center']:.1f} px")
    print(f"Horizon tilt: {hz['angle_deg']:.2f} degrees")
    print(f"Support: {hz['support']:.2f} of strips agree")

    y_left, y_right = (int(v) for v in horizon_y_at(hz, [0, w], w))
    cv2.line(image, (0, y_left), (w, y_right), (0, 0, 255), 2)
    cv2.imwrite("horizon_result.jpg", image)
    print("Saved horizon_result.jpg")
