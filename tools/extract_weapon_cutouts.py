from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "东方名著武器库"
OUT_DIR = ROOT / "assets" / "weapons-cutouts"
MAX_SIZE = 560
OUTPUT_MAX_SIZE = 640


# Coordinates are in source-image pixels. Strokes mark definite weapon foreground.
# Background rectangles/circles remove plaques, text paper, inset detail circles, and borders.
SPECS = {
    "01": {"fg": [("line", (330, 1160, 940, 100, 86))], "bg_rect": [(0, 0, 620, 575), (930, 80, 1240, 915), (650, 910, 1240, 1215)]},
    "02": {"fg": [("line", (320, 1110, 675, 245, 78)), ("line", (500, 270, 855, 320, 72))], "bg_rect": [(0, 0, 430, 430), (940, 65, 1240, 695), (540, 750, 1245, 1165)]},
    "03": {"fg": [("line", (1060, 965, 360, 170, 92)), ("ellipse", (130, 610, 410, 860))], "bg_rect": [(865, 40, 1245, 585), (355, 820, 1090, 1135)]},
    "04": {"fg": [("line", (315, 915, 955, 235, 88)), ("line", (735, 260, 985, 175, 70))], "bg_rect": [(0, 0, 415, 450), (900, 45, 1240, 775), (420, 880, 1135, 1135)]},
    "05": {"fg": [("line", (300, 1080, 610, 545, 82)), ("ellipse", (505, 90, 980, 755)), ("ellipse", (45, 555, 310, 810))], "bg_rect": [(980, 120, 1245, 660), (585, 860, 1230, 1145)]},
    "06": {"fg": [("line", (160, 1000, 1110, 95, 120)), ("ellipse", (145, 735, 620, 1040)), ("ellipse", (50, 80, 345, 355))], "bg_rect": [(925, 205, 1230, 730), (250, 875, 930, 1230)]},
    "07": {"fg": [("line", (220, 1070, 1260, 40, 78)), ("line", (955, 190, 1250, 55, 90))], "bg_rect": [(0, 0, 250, 455), (40, 700, 260, 930), (980, 330, 1340, 835), (340, 825, 990, 1195)]},
    "08": {"fg": [("line", (260, 1095, 700, 185, 76)), ("line", (525, 340, 915, 430, 98)), ("line", (720, 185, 905, 90, 60))], "bg_rect": [(0, 0, 420, 415), (890, 145, 1255, 785), (520, 760, 1175, 1130)]},
    "09": {"fg": [("line", (255, 985, 895, 155, 125)), ("line", (445, 860, 1015, 305, 82))], "bg_rect": [(0, 0, 385, 390), (860, 285, 1215, 845), (460, 780, 1085, 1160)]},
    "10": {"fg": [("line", (260, 965, 855, 230, 112)), ("line", (360, 820, 690, 445, 140))], "bg_rect": [(0, 755, 270, 1030), (795, 100, 1230, 715), (530, 830, 1230, 1160)]},
    "11": {"fg": [("line", (250, 1015, 820, 120, 78))], "bg_rect": [(0, 0, 425, 445), (880, 95, 1215, 725), (580, 795, 1225, 1125)]},
    "12": {"fg": [("polygon", [(330, 250), (735, 140), (935, 465), (525, 805), (210, 520)])], "bg_rect": [(0, 650, 395, 1060), (800, 105, 1215, 765), (480, 775, 1140, 1130)]},
    "13": {"fg": [("ellipse", (335, 120, 875, 910)), ("ellipse", (160, 120, 420, 380))], "bg_rect": [(900, 70, 1230, 740), (655, 880, 1230, 1165)]},
    "14": {"fg": [("line", (345, 720, 1160, 350, 78)), ("line", (395, 620, 675, 335, 100))], "bg_rect": [(180, 700, 505, 970), (795, 155, 1190, 700), (520, 840, 1230, 1135)]},
    "15": {"fg": [("ellipse", (195, 150, 785, 1040)), ("ellipse", (90, 70, 360, 325))], "bg_rect": [(870, 95, 1235, 720), (760, 790, 1215, 1120)]},
    "16": {"fg": [("line", (230, 1055, 895, 165, 85)), ("ellipse", (80, 785, 410, 1080)), ("ellipse", (60, 80, 385, 360))], "bg_rect": [(820, 145, 1205, 805), (380, 865, 1125, 1160)]},
    "17": {"fg": [("line", (220, 810, 650, 390, 112)), ("line", (515, 390, 930, 845, 112)), ("ellipse", (95, 225, 565, 690)), ("ellipse", (590, 250, 1020, 720))], "bg_rect": [(890, 100, 1245, 805), (435, 805, 1180, 1160), (50, 735, 300, 1015)]},
    "18": {"fg": [("line", (265, 985, 865, 340, 98)), ("ellipse", (105, 760, 475, 1110)), ("ellipse", (110, 80, 375, 350))], "bg_rect": [(875, 95, 1220, 760), (570, 835, 1240, 1135)]},
    "19": {"fg": [("line", (275, 315, 900, 1040, 108)), ("line", (320, 1035, 965, 250, 108)), ("ellipse", (275, 785, 560, 1055))], "bg_rect": [(870, 85, 1230, 775), (520, 875, 1220, 1150)]},
    "20": {"fg": [("line", (315, 1115, 1010, 130, 82)), ("line", (205, 205, 520, 380, 96))], "bg_rect": [(0, 0, 420, 450), (925, 120, 1220, 725), (520, 835, 1220, 1155)]},
    "21": {"fg": [("line", (235, 1080, 760, 90, 128)), ("ellipse", (70, 80, 390, 385))], "bg_rect": [(830, 115, 1225, 790), (485, 840, 1235, 1165)]},
    "22": {"fg": [("line", (130, 790, 845, 265, 150)), ("line", (120, 735, 690, 410, 170)), ("ellipse", (275, 805, 540, 1055))], "bg_rect": [(865, 115, 1230, 790), (520, 850, 1230, 1160)]},
    "23": {"fg": [("line", (250, 1120, 780, 220, 92)), ("line", (675, 1100, 965, 410, 78)), ("ellipse", (70, 85, 365, 365))], "bg_rect": [(845, 125, 1235, 760), (600, 820, 1210, 1175)]},
    "24": {"fg": [("line", (250, 900, 920, 170, 125)), ("ellipse", (130, 760, 395, 1045)), ("ellipse", (55, 115, 340, 405))], "bg_rect": [(870, 90, 1240, 780), (660, 830, 1215, 1135)]},
    "25": {"fg": [("line", (300, 1090, 955, 230, 88)), ("ellipse", (70, 80, 360, 365))], "bg_rect": [(865, 115, 1235, 820), (555, 850, 1225, 1160)]},
}


HAND_SPECS = {
    "01": {"fg": [("line", (326, 1162, 930, 96, 92))]},
    "02": {"fg": [("line", (315, 1110, 640, 315, 70)), ("line", (505, 275, 858, 305, 96)), ("line", (535, 205, 840, 205, 42)), ("line", (570, 170, 850, 175, 32))]},
    "03": {"fg": [("line", (1070, 970, 355, 178, 118)), ("ellipse", (245, 100, 495, 300))]},
    "04": {"fg": [("line", (310, 920, 910, 260, 76)), ("line", (710, 285, 1010, 145, 92)), ("line", (785, 210, 990, 430, 62))]},
    "05": {"fg": [("line", (296, 1085, 600, 535, 76)), ("ellipse", (485, 75, 1005, 780))]},
    "06": {"fg": [("line", (305, 930, 1075, 90, 92)), ("ellipse", (85, 685, 570, 1065)), ("line", (325, 640, 685, 900, 90))]},
    "07": {"fg": [("line", (222, 1070, 1250, 32, 72)), ("line", (980, 175, 1250, 52, 78))]},
    "08": {"fg": [("line", (252, 1100, 700, 175, 70)), ("line", (520, 330, 930, 420, 90)), ("line", (650, 370, 895, 105, 58))]},
    "09": {"fg": [("line", (250, 990, 900, 160, 118)), ("line", (465, 855, 1030, 300, 74))]},
    "10": {"fg": [("line", (255, 970, 855, 230, 110)), ("line", (350, 830, 705, 435, 132))]},
    "11": {"fg": [("line", (245, 1018, 825, 112, 72))]},
    "12": {"fg": [("polygon", [(335, 245), (748, 135), (940, 475), (530, 815), (210, 520)])]},
    "13": {"fg": [("ellipse", (325, 95, 895, 940))], "erase": [("ellipse", (455, 240, 760, 775))]},
    "14": {"fg": [("line", (340, 720, 1168, 350, 72)), ("line", (385, 620, 685, 330, 94))]},
    "15": {"fg": [("ellipse", (185, 135, 805, 1060))]},
    "16": {"fg": [("line", (230, 1058, 895, 165, 78)), ("ellipse", (65, 785, 420, 1085)), ("ellipse", (70, 85, 365, 350))]},
    "17": {"fg": [("line", (230, 820, 665, 365, 105)), ("line", (525, 365, 935, 850, 105)), ("ellipse", (100, 235, 590, 705)), ("ellipse", (565, 250, 1035, 735))]},
    "18": {"fg": [("line", (255, 985, 875, 335, 86)), ("ellipse", (90, 735, 480, 1115))]},
    "19": {"fg": [("line", (275, 315, 900, 1042, 95)), ("line", (315, 1042, 970, 245, 95))]},
    "20": {"fg": [("line", (315, 1115, 1010, 130, 72)), ("line", (195, 205, 530, 370, 88))]},
    "21": {"fg": [("line", (235, 1080, 765, 90, 128))]},
    "22": {"fg": [("line", (125, 790, 850, 265, 148)), ("line", (120, 735, 700, 410, 158))]},
    "23": {"fg": [("line", (245, 1120, 785, 220, 86)), ("line", (675, 1100, 965, 410, 72))]},
    "24": {"fg": [("line", (245, 900, 928, 168, 92)), ("ellipse", (128, 755, 395, 1048))]},
    "25": {"fg": [("line", (300, 1090, 955, 230, 80)), ("ellipse", (64, 92, 350, 360))]},
}


def source_files() -> list[Path]:
    return sorted(SOURCE_DIR.glob("[0-9][0-9]_*.png"))


def scale_tuple(values: tuple[float, ...], sx: float, sy: float) -> tuple[int, ...]:
    out = []
    for i, value in enumerate(values):
        out.append(int(round(value * (sx if i % 2 == 0 else sy))))
    return tuple(out)


def draw_specs(draw: ImageDraw.ImageDraw, spec: dict, sx: float, sy: float, label: int) -> None:
    for item in spec.get("fg", []):
        kind = item[0]
        if kind == "line":
            x1, y1, x2, y2, width = item[1]
            draw.line(scale_tuple((x1, y1, x2, y2), sx, sy), fill=label, width=max(2, int(width * (sx + sy) / 2)), joint="curve")
        elif kind == "ellipse":
            draw.ellipse(scale_tuple(item[1], sx, sy), fill=label)
        elif kind == "polygon":
            pts = [(int(round(x * sx)), int(round(y * sy))) for x, y in item[1]]
            draw.polygon(pts, fill=label)


def make_seed_labels(size: tuple[int, int], spec: dict, original_size: tuple[int, int]) -> np.ndarray:
    w, h = size
    ow, oh = original_size
    sx, sy = w / ow, h / oh
    labels_img = Image.new("L", size, 0)
    draw = ImageDraw.Draw(labels_img)

    border = max(4, int(min(w, h) * 0.035))
    draw.rectangle((0, 0, w - 1, border), fill=1)
    draw.rectangle((0, h - border, w - 1, h - 1), fill=1)
    draw.rectangle((0, 0, border, h - 1), fill=1)
    draw.rectangle((w - border, 0, w - 1, h - 1), fill=1)
    for rect in spec.get("bg_rect", []):
        draw.rectangle(scale_tuple(rect, sx, sy), fill=1)
    for ellipse in spec.get("bg_ellipse", []):
        draw.ellipse(scale_tuple(ellipse, sx, sy), fill=1)

    draw_specs(draw, spec, sx, sy, 2)
    return np.array(labels_img, dtype=np.uint8)


def largest_component(mask: np.ndarray) -> np.ndarray:
    labels, count = ndi.label(mask)
    if count <= 1:
        return mask
    sizes = ndi.sum(mask, labels, index=np.arange(1, count + 1))
    keep = int(np.argmax(sizes)) + 1
    return labels == keep


def draw_shape_mask(size: tuple[int, int], spec: dict, original_size: tuple[int, int]) -> Image.Image:
    ow, oh = original_size
    sx, sy = size[0] / ow, size[1] / oh
    scale = 3
    big = (size[0] * scale, size[1] * scale)
    mask = Image.new("L", big, 0)
    draw = ImageDraw.Draw(mask)

    def s(values: tuple[float, ...]) -> tuple[int, ...]:
        return tuple(v * scale for v in scale_tuple(values, sx, sy))

    for item in spec.get("fg", []):
        kind = item[0]
        if kind == "line":
            x1, y1, x2, y2, width = item[1]
            draw.line(s((x1, y1, x2, y2)), fill=255, width=max(2, int(width * (sx + sy) / 2 * scale)), joint="curve")
        elif kind == "ellipse":
            draw.ellipse(s(item[1]), fill=255)
        elif kind == "polygon":
            pts = [(int(round(x * sx * scale)), int(round(y * sy * scale))) for x, y in item[1]]
            draw.polygon(pts, fill=255)

    for item in spec.get("erase", []):
        kind = item[0]
        if kind == "ellipse":
            draw.ellipse(s(item[1]), fill=0)
        elif kind == "rect":
            draw.rectangle(s(item[1]), fill=0)
        elif kind == "polygon":
            pts = [(int(round(x * sx * scale)), int(round(y * sy * scale))) for x, y in item[1]]
            draw.polygon(pts, fill=0)

    mask = mask.filter(ImageFilter.GaussianBlur(1.4 * scale))
    return mask.resize(size, Image.Resampling.LANCZOS)


def bbox_from_alpha(alpha: np.ndarray, pad: int = 18) -> tuple[int, int, int, int]:
    ys, xs = np.where(alpha > 8)
    if not len(xs):
        return (0, 0, alpha.shape[1], alpha.shape[0])
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(alpha.shape[1], int(xs.max()) + pad + 1)
    y1 = min(alpha.shape[0], int(ys.max()) + pad + 1)
    return (x0, y0, x1, y1)


def extract_one(src: Path) -> Path:
    idx = src.name[:2]
    original = Image.open(src).convert("RGB")
    alpha = draw_shape_mask(original.size, HAND_SPECS[idx], original.size)
    alpha_arr = np.asarray(alpha)

    rgba = original.convert("RGBA")
    rgba.putalpha(Image.fromarray(alpha_arr, "L"))
    box = bbox_from_alpha(alpha_arr)
    cropped = rgba.crop(box)
    if max(cropped.size) > OUTPUT_MAX_SIZE:
        ratio = OUTPUT_MAX_SIZE / max(cropped.size)
        cropped = cropped.resize(
            (max(1, int(cropped.width * ratio)), max(1, int(cropped.height * ratio))),
            Image.Resampling.LANCZOS,
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{src.stem}_cutout.png"
    cropped.save(out, optimize=True)
    return out


def build_contact_sheet(files: list[Path]) -> Path:
    thumbs = []
    for f in files:
        im = Image.open(f).convert("RGBA")
        bg = Image.new("RGBA", im.size, (235, 232, 224, 255))
        checker = Image.new("RGBA", im.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(checker)
        step = max(8, im.width // 18)
        for y in range(0, im.height, step):
            for x in range(0, im.width, step):
                if (x // step + y // step) % 2 == 0:
                    d.rectangle((x, y, x + step - 1, y + step - 1), fill=(255, 255, 255, 255))
        preview = Image.alpha_composite(bg, checker)
        preview.alpha_composite(im)
        preview = preview.convert("RGB")
        preview.thumbnail((190, 190), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (210, 230), "white")
        canvas.paste(preview, ((210 - preview.width) // 2, 5))
        ImageDraw.Draw(canvas).text((8, 205), f.stem.replace("_cutout", "")[:20], fill=(0, 0, 0))
        thumbs.append(canvas)
    cols = 5
    rows = math.ceil(len(thumbs) / cols)
    sheet = Image.new("RGB", (cols * 210, rows * 230), (240, 240, 240))
    for i, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((i % cols) * 210, (i // cols) * 230))
    out = OUT_DIR / "_contact_sheet.jpg"
    sheet.save(out, quality=90)
    return out


def main() -> None:
    files = source_files()
    outputs = []
    for src in files:
        idx = src.name[:2]
        if idx not in SPECS:
            continue
        print(f"extracting {src.name} ...", flush=True)
        outputs.append(extract_one(src))
    sheet = build_contact_sheet(outputs)
    print(f"wrote {len(outputs)} cutouts to {OUT_DIR}")
    print(f"contact sheet: {sheet}")


if __name__ == "__main__":
    main()
