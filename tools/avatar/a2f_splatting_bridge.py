#!/usr/bin/env python3
"""
Atlas bridge: Audio2Face (motion) → SplattingAvatar (appearance)

Two layers, not a merge:
  1. Motion  — NVIDIA Audio2Face / Maya-ACE emits ARKit blendshapes (or FLAME expr).
  2. Look    — SplattingAvatar deforms its mesh; mesh-embedded Gaussians follow.

Offline training (appearance): https://github.com/initialneil/SplattingAvatar
Realtime motion: Maya-ACE local GPU  |  Audio2Face-3D NIM (gRPC)

Usage (once A2F + trained avatar are available on this machine):
  python tools/avatar/a2f_splatting_bridge.py --clip data/maya-ace/latest.a2f.json \\
      --flame-out data/maya-ace/latest.flame.json

The web app already consumes latest.a2f.json ARKit frames for the interim WebGL head.
When a trained SplattingAvatar asset is exported to apps/web/public/avatars/,
swap the AceFace appearance layer to the splat renderer; keep the same ARKit clip.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

# Subset mapping aligned with apps/web/lib/avatar-pipeline.ts arkitToFlameExpression
ARKIT_TO_FLAME_INDEX = {
    "JawOpen": 0,
    "MouthSmileLeft": 1,
    "MouthSmileRight": 2,
    "MouthPucker": 3,
    "MouthFunnel": 4,
    "BrowInnerUp": 5,
    "BrowDownLeft": 6,
    "BrowDownRight": 7,
    "EyeBlinkLeft": 8,
    "EyeBlinkRight": 9,
    "CheekPuff": 10,
}


def arkit_frame_to_flame(names: list[str], weights: list[float], size: int = 50) -> list[float]:
    expr = [0.0] * size
    for name, value in zip(names, weights):
        idx = ARKIT_TO_FLAME_INDEX.get(name)
        if idx is not None and idx < size:
            expr[idx] = float(value)
    return expr


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert Maya-ACE ARKit clip → FLAME expression track")
    parser.add_argument("--clip", type=Path, default=Path("data/maya-ace/latest.a2f.json"))
    parser.add_argument("--flame-out", type=Path, default=Path("data/maya-ace/latest.flame.json"))
    args = parser.parse_args()

    clip = json.loads(args.clip.read_text(encoding="utf-8"))
    names = list(clip.get("blendshapes") or [])
    frames = clip.get("frames") or []
    fps = int(clip.get("fps") or 30)
    flame_frames = [arkit_frame_to_flame(names, frame) for frame in frames]
    payload = {
        "version": 1,
        "source": "atlas-a2f-bridge",
        "player": "splatting-avatar",
        "fps": fps,
        "durationMs": clip.get("durationMs"),
        "text": clip.get("text"),
        "expression_dim": 50,
        "frames": flame_frames,
        "notes": (
            "Drive SplattingAvatar FLAME mesh with these expression vectors. "
            "Appearance stays in the trained Gaussian asset; motion comes from A2F."
        ),
    }
    args.flame_out.parent.mkdir(parents=True, exist_ok=True)
    args.flame_out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(flame_frames)} FLAME frames → {args.flame_out}")


if __name__ == "__main__":
    main()
