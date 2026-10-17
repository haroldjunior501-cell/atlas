"""
Peaufine l'albedo FLAME à partir du portrait de référence (sans GPU).

- Transfert de couleurs LAB (peau / ambiance)
- Soft overlay du visage (ellipse) sur la zone frontale de la carte UV AlbedoMM
- Conserve les bords UV (cheveux / cou) de l'albedo d'origine

Sortie : apps/web/public/avatars/atlas-flame-albedo.png
Ensuite : apply_flame_albedo.ps1 pour ré-exporterer le GLB.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """rgb float 0..1 → Lab (D65 approx)."""
    x = np.where(rgb > 0.04045, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)
    m = np.array(
        [
            [0.4124564, 0.3575761, 0.1804375],
            [0.2126729, 0.7151522, 0.0721750],
            [0.0193339, 0.1191920, 0.9503041],
        ],
        dtype=np.float64,
    )
    xyz = x @ m.T
    xyz = xyz / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), (7.787 * xyz) + 16 / 116)
    L = (116 * f[..., 1]) - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def lab_to_rgb(lab: np.ndarray) -> np.ndarray:
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    fy = (L + 16) / 116
    fx = a / 500 + fy
    fz = fy - b / 200
    f = np.stack([fx, fy, fz], axis=-1)
    xyz = np.where(f > 0.206893, f**3, (f - 16 / 116) / 7.787)
    xyz = xyz * np.array([0.95047, 1.0, 1.08883])
    m = np.array(
        [
            [3.2404542, -1.5371385, -0.4985314],
            [-0.9692660, 1.8760108, 0.0415560],
            [0.0556434, -0.2040259, 1.0572252],
        ],
        dtype=np.float64,
    )
    rgb = xyz @ m.T
    rgb = np.where(rgb > 0.0031308, 1.055 * np.power(np.clip(rgb, 0, None), 1 / 2.4) - 0.055, 12.92 * rgb)
    return np.clip(rgb, 0, 1)


def color_transfer(src: np.ndarray, ref: np.ndarray, strength: float = 0.72) -> np.ndarray:
    """Match mean/std of src Lab to ref Lab, then blend."""
    s = rgb_to_lab(src.astype(np.float64) / 255.0)
    r = rgb_to_lab(ref.astype(np.float64) / 255.0)
    # Ignore near-black UV padding on albedo
    s_mask = s[..., 0] > 8
    r_mask = r[..., 0] > 8
    if not s_mask.any() or not r_mask.any():
        return src
    sm, ss = s[s_mask].mean(0), s[s_mask].std(0) + 1e-5
    rm, rs = r[r_mask].mean(0), r[r_mask].std(0) + 1e-5
    out = (s - sm) * (rs / ss) + rm
    out = s * (1 - strength) + out * strength
    rgb = (lab_to_rgb(out) * 255).astype(np.uint8)
    return rgb


def face_crop(portrait: Image.Image) -> Image.Image:
    """Tight center crop — portrait is already a headshot."""
    w, h = portrait.size
    # Keep a slightly tall face window
    side = int(min(w, h) * 0.92)
    cx, cy = w // 2, int(h * 0.48)
    x0 = max(0, cx - side // 2)
    y0 = max(0, cy - side // 2)
    return portrait.crop((x0, y0, x0 + side, y0 + side))


def soft_face_mask(size: int) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    # Wide ellipse + heavy blur to avoid a hard rectangular seam on the UV
    d.ellipse((int(size * 0.04), int(size * 0.0), int(size * 0.96), int(size * 1.0)), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(radius=max(8, int(size * 0.14))))
    return m


def overlay_face_on_albedo(albedo: Image.Image, face: Image.Image, opacity: float = 0.55) -> Image.Image:
    """
    Place a soft portrait patch over the AlbedoMM frontal face island
    (approx. center of the FLAME albedoPart UV, not the top-left padding).
    """
    aw, ah = albedo.size
    # Empirical FLAME AlbedoMM face island (512×512 atlas)
    box_w = int(aw * 0.55)
    box_h = int(ah * 0.62)
    x0 = int(aw * 0.20)
    y0 = int(ah * 0.06)

    face_r = face.resize((box_w, box_h), Image.Resampling.LANCZOS)
    face_arr = np.asarray(face_r).astype(np.float32)
    face_arr[..., 0] = np.clip(face_arr[..., 0] * 1.02, 0, 255)
    face_arr[..., 2] = np.clip(face_arr[..., 2] * 0.97, 0, 255)

    base = np.asarray(albedo).astype(np.float32)
    patch = np.zeros_like(base)
    patch[y0 : y0 + box_h, x0 : x0 + box_w] = face_arr

    mask_img = soft_face_mask(max(box_w, box_h)).resize((box_w, box_h), Image.Resampling.LANCZOS)
    alpha = np.zeros((ah, aw), dtype=np.float32)
    alpha[y0 : y0 + box_h, x0 : x0 + box_w] = np.asarray(mask_img, dtype=np.float32) / 255.0
    alpha = alpha * opacity
    # Soft-light style mix so pores/UV structure remain a bit
    a = alpha[..., None]
    mixed = base * (1 - a * 0.85) + patch * a + (base * patch / 255.0) * (a * 0.15)
    return Image.fromarray(np.clip(mixed, 0, 255).astype(np.uint8), "RGB")


def inpaint_uv_padding(img: np.ndarray) -> np.ndarray:
    lum = img.astype(np.float32).sum(axis=2)
    mask = lum < 24
    if not mask.any():
        return img
    skin = img[~mask].mean(axis=0)
    out = img.copy()
    out[mask] = skin.astype(np.uint8)
    return out


def main() -> None:
    root = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--portrait",
        type=Path,
        default=root / "apps" / "web" / "public" / "avatars" / "atlas-target.png",
    )
    parser.add_argument(
        "--albedo",
        type=Path,
        default=root / "apps" / "web" / "public" / "avatars" / "atlas-flame-albedo.png",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=root / "apps" / "web" / "public" / "avatars" / "atlas-flame-albedo.png",
    )
    parser.add_argument("--opacity", type=float, default=0.58)
    parser.add_argument("--transfer", type=float, default=0.68)
    args = parser.parse_args()

    if not args.portrait.exists():
        raise SystemExit(f"Portrait introuvable: {args.portrait}")
    if not args.albedo.exists():
        raise SystemExit(f"Albedo introuvable: {args.albedo} — lance extract_flame_albedo.py d'abord")

    # Backup once
    bak = args.albedo.with_name("atlas-flame-albedo.base.png")
    if not bak.exists():
        bak.write_bytes(args.albedo.read_bytes())
        print(f"Backup albedo -> {bak}")

    albedo = Image.open(args.albedo).convert("RGB")
    portrait = Image.open(args.portrait).convert("RGB")
    face = face_crop(portrait)

    # 1) Global color mood from portrait
    alb_np = np.asarray(albedo)
    ref_np = np.asarray(face.resize(albedo.size, Image.Resampling.LANCZOS))
    transferred = color_transfer(alb_np, ref_np, strength=args.transfer)
    transferred = inpaint_uv_padding(transferred)
    base = Image.fromarray(transferred, "RGB")

    # 2) Soft face identity overlay
    refined = overlay_face_on_albedo(base, face, opacity=args.opacity)
    refined = Image.fromarray(inpaint_uv_padding(np.asarray(refined)), "RGB")

    # Slight sharpen for eyes/brows readability on the mesh
    refined = refined.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=2))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    refined.save(args.out, optimize=True)
    print(f"Wrote refined albedo {args.out} ({args.out.stat().st_size} bytes)")
    print("Next: .\\tools\\avatar\\scripts\\apply_flame_albedo.ps1")


if __name__ == "__main__":
    main()
