"""Extract AlbedoMM mean diffuse MU → PNG for Atlas web avatar.

The NPZ stores channels as BGR; we swap to RGB for Three.js / sRGB display.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


def main() -> None:
    root = Path(__file__).resolve().parents[3]
    src = Path(r"C:\Users\PC\Downloads\albedoModel2020_FLAME_albedoPart.npz")
    if not src.exists():
        # fallback next to project
        alt = root / "data" / "avatar" / "vendor" / "albedoModel2020_FLAME_albedoPart.npz"
        src = alt if alt.exists() else src
    out = root / "apps" / "web" / "public" / "avatars" / "atlas-flame-albedo.png"
    uv_out = root / "data" / "avatar" / "flame_uv.npz"

    z = np.load(src, mmap_mode="r")
    mu = np.array(z["MU"])
    rgb = np.clip(mu[..., ::-1], 0, 1)  # BGR → RGB
    img = (rgb * 255).astype(np.uint8)
    # Fill UV padding (near-black) so seams don't show as holes on the mesh.
    lum = img.astype(np.float32).sum(axis=2)
    mask = lum < 24
    if mask.any():
        skin = img[~mask].mean(axis=0)
        img = img.copy()
        img[mask] = skin.astype(np.uint8)
    Image.fromarray(img, "RGB").save(out)
    np.savez_compressed(uv_out, vt=np.array(z["vt"]), ft=np.array(z["ft"]))
    print(f"Wrote {out} ({out.stat().st_size} bytes)")
    print(f"Wrote {uv_out}")


if __name__ == "__main__":
    main()
