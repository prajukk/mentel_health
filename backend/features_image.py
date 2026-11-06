from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError


def extract_image(path):
    try:
        with Image.open(Path(path)) as image:
            rgb = image.convert("RGB")
            width, height = rgb.size
            brightness = float(np.asarray(rgb, dtype=np.float32).mean() / 255.0)
    except (UnidentifiedImageError, OSError) as error:
        raise ValueError("That image could not be read.") from error
    return {
        "width": int(width),
        "height": int(height),
        "brightness": round(brightness, 4),
    }
