from collections import deque
from pathlib import Path
import sys

FORGE = Path(r"C:\Users\ewhng\.claude\skills\img2threejs\forge")
sys.path.insert(0, str(FORGE / "stage1_intake"))
from extract_pbr_evidence import build_foreground_mask, load_image


def components(mask, width, height):
    seen = bytearray(width * height)
    found = []
    for start, value in enumerate(mask):
        if not value or seen[start]:
            continue
        queue = deque([start])
        seen[start] = 1
        points = []
        while queue:
            index = queue.popleft()
            points.append(index)
            x, y = index % width, index // width
            for nxt in (index - 1 if x else -1, index + 1 if x + 1 < width else -1,
                        index - width if y else -1, index + width if y + 1 < height else -1):
                if nxt >= 0 and mask[nxt] and not seen[nxt]:
                    seen[nxt] = 1
                    queue.append(nxt)
        xs = [p % width for p in points]
        ys = [p // width for p in points]
        found.append((len(points), (min(xs), min(ys), max(xs) + 1, max(ys) + 1)))
    return sorted(found, reverse=True)


for raw in sys.argv[1:]:
    path = Path(raw)
    width, height, pixels, _ = load_image(path)
    mask, diagnostics, warnings = build_foreground_mask(width, height, pixels)
    print(path)
    print({"size": [width, height], "diagnostics": diagnostics, "warnings": warnings,
           "components": components(mask, width, height)[:12]})
