#!/usr/bin/env python3
"""Strip the room's own walls and doors from a Live Map overlay, keep the furniture.

Social Tables exports draw each room's outline with its doors. On the Live Map those
lines never sit exactly on the floor plan's walls, so they show up doubled or off
(Jason 2026-11-27). The floor plan already has the walls, so overlays only need the
furniture: tables, chairs, stage, AV, bars, labels.

How it works: the walls and the doors hung on them form one big connected line drawing
that runs along the image edges (the export is cropped to the room). Any connected
piece of ink that touches two or more image edges, or spans 90% of the width or
height, is wall and gets erased. Table sets, even a big hollow square or U-shape,
sit inside the room without touching the edges, so they stay.

Usage:  python3 scripts/strip-diagram-walls.py IN.png OUT.png [--preview PREVIEW.png]
Needs:  pip install pillow numpy scipy
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def strip(a, span=0.9, edge_px=12):
    alpha = a[..., 3]
    ink = alpha > 12
    # join hairline gaps so a wall and its door swings read as one piece
    joined = ndimage.binary_dilation(ink, iterations=2)
    lab, n = ndimage.label(joined)
    H, W = alpha.shape
    wall = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        edges = (y0 <= edge_px) + (y1 >= H - edge_px) + (x0 <= edge_px) + (x1 >= W - edge_px)
        if edges >= 2 or (x1 - x0) >= span * W or (y1 - y0) >= span * H:
            wall[i] = True
    kill = wall[lab] & (alpha > 0)
    # also clear the faint anti-aliased fringe next to erased lines
    kill = ndimage.binary_dilation(kill, iterations=2) & ~ndimage.binary_dilation(~wall[lab] & ink, iterations=1)
    out = a.copy()
    out[..., 3][kill] = 0
    return out, int(wall.sum())


if __name__ == "__main__":
    args = sys.argv[1:]
    prev = None
    if "--preview" in args:
        k = args.index("--preview"); prev = args[k + 1]; del args[k:k + 2]
    src, dst = args
    a = np.array(Image.open(src).convert("RGBA"))
    out, nwall = strip(a)
    Image.fromarray(out).save(dst, optimize=True)
    if prev:
        bg = Image.new("RGBA", (a.shape[1], a.shape[0]), (255, 255, 255, 255))
        bg.alpha_composite(Image.fromarray(out))
        bg.convert("RGB").resize((a.shape[1] // 3, a.shape[0] // 3)).save(prev)
    print(f"{dst}: removed {nwall} wall piece(s)")
