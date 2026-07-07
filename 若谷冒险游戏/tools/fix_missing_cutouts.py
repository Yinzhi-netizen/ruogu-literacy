from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1].parent
SRC_DIR = ROOT / "Ruogu Painting"
OUT_DIR = SRC_DIR / "cutouts"
MISSING = (1, 2, 4, 5, 6, 10)
WHITE_THRESHOLD = 238
PAD = 12
MAX_SIDE = 700


def make_transparent(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    pixels = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if red >= WHITE_THRESHOLD and green >= WHITE_THRESHOLD and blue >= WHITE_THRESHOLD:
                pixels[x, y] = (red, green, blue, 0)
    return img


def crop_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - PAD)
    top = max(0, top - PAD)
    right = min(img.width, right + PAD)
    bottom = min(img.height, bottom + PAD)
    return img.crop((left, top, right, bottom))


def downscale(img: Image.Image) -> Image.Image:
    largest = max(img.size)
    if largest <= MAX_SIDE:
        return img
    scale = MAX_SIDE / largest
    size = (int(img.width * scale), int(img.height * scale))
    return img.resize(size, Image.Resampling.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    made = []
    skipped = []

    for number in MISSING:
        source = SRC_DIR / f"{number}.jpg"
        target = OUT_DIR / f"{number}_cutout.png"
        if target.exists():
            skipped.append(target.name)
            continue
        if not source.exists():
            raise FileNotFoundError(source)

        image = Image.open(source)
        image = make_transparent(image)
        image = crop_alpha(image)
        image = downscale(image)
        image.save(target)
        made.append(f"{target.name} {image.width}x{image.height}")

    print("made:", ", ".join(made) if made else "none")
    print("skipped:", ", ".join(skipped) if skipped else "none")


if __name__ == "__main__":
    main()
