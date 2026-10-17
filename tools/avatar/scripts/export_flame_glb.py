"""
Export FLAME2020 generic .blend → GLB with shape keys for Atlas web avatar.

Usage (Blender 4.2+):
  blender --background --python tools/avatar/scripts/export_flame_glb.py

Optional args after -- :
  --blend path/to/flame2020_generic.blend
  --out apps/web/public/avatars/atlas-flame.glb
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    root = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--blend",
        type=Path,
        default=root
        / "data"
        / "avatar"
        / "vendor"
        / "FLAME_Blender_AddOn"
        / "flame_tools"
        / "flame_tools"
        / "data"
        / "flame2020_generic.blend",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=root / "apps" / "web" / "public" / "avatars" / "atlas-flame.glb",
    )
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def main():
    args = parse_args()
    blend = args.blend.resolve()
    out = args.out.resolve()
    if not blend.exists():
        raise SystemExit(f"FLAME blend introuvable : {blend}")

    clear_scene()
    with bpy.data.libraries.load(str(blend), link=False) as (data_from, data_to):
        data_to.objects = list(data_from.objects)

    mesh_obj = None
    for obj in data_to.objects:
        if obj is None:
            continue
        bpy.context.collection.objects.link(obj)
        if obj.type == "MESH" and mesh_obj is None:
            mesh_obj = obj

    if mesh_obj is None:
        raise SystemExit("Aucun mesh FLAME dans le .blend")

    bpy.context.view_layer.objects.active = mesh_obj
    mesh_obj.select_set(True)
    mesh_obj.rotation_euler[0] = 1.57079632679
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_morph=True,
        export_skins=False,
        export_animations=False,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
    )
    keys = [kb.name for kb in mesh_obj.data.shape_keys.key_blocks] if mesh_obj.data.shape_keys else []
    print(f"Exported {out}")
    print(f"Shape keys ({len(keys)}): {', '.join(keys[:40])}")


if __name__ == "__main__":
    main()
