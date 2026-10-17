"""
Apply AlbedoMM mean diffuse (MU) + UV (vt/ft) onto FLAME mesh, re-export GLB.

Usage:
  blender --background --python tools/avatar/scripts/apply_flame_albedo.py -- \
    --albedo apps/web/public/avatars/atlas-flame-albedo.png \
    --uv data/avatar/flame_uv.npz \
    --out apps/web/public/avatars/atlas-flame.glb
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy
import numpy as np


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
        "--albedo",
        type=Path,
        default=root / "apps" / "web" / "public" / "avatars" / "atlas-flame-albedo.png",
    )
    parser.add_argument(
        "--uv",
        type=Path,
        default=root / "data" / "avatar" / "flame_uv.npz",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=root / "apps" / "web" / "public" / "avatars" / "atlas-flame.glb",
    )
    parser.add_argument(
        "--flip-v",
        action="store_true",
        default=True,
        help="Flip V so AlbedoMM top-left maps to Blender bottom-left UV (default on).",
    )
    parser.add_argument("--no-flip-v", action="store_true")
    parser.add_argument(
        "--reverse-winding",
        action="store_true",
        default=True,
        help="Reverse UV triangle winding to match Blender loop order (default on).",
    )
    parser.add_argument("--no-reverse-winding", action="store_true")
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def apply_uv(mesh_obj, vt: np.ndarray, ft: np.ndarray, flip_v: bool, reverse_winding: bool = False):
    me = mesh_obj.data
    if len(me.polygons) != len(ft):
        raise SystemExit(f"Face count mismatch: mesh={len(me.polygons)} albedo_ft={len(ft)}")
    if me.uv_layers:
        while me.uv_layers:
            me.uv_layers.remove(me.uv_layers[0])
    uv_layer = me.uv_layers.new(name="AlbedoMM")
    for poly_i, poly in enumerate(me.polygons):
        if poly.loop_total != 3:
            raise SystemExit(f"Non-tri face at {poly_i}: {poly.loop_total}")
        corners = list(range(3))
        if reverse_winding:
            corners = list(reversed(corners))
        for corner, loop_index in zip(corners, poly.loop_indices):
            u, v = vt[int(ft[poly_i, corner])]
            if flip_v:
                v = 1.0 - float(v)
            uv_layer.data[loop_index].uv = (float(u), float(v))


def make_material(albedo_path: Path):
    mat = bpy.data.materials.new(name="FLAME_AlbedoMM")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(str(albedo_path.resolve()))
    img.colorspace_settings.name = "sRGB"
    tex.image = img
    tex.interpolation = "Closest"
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.55
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.35
    elif "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = 0.35
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = 0.12
        if "Subsurface Radius" in bsdf.inputs:
            bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.2)
    return mat


def main():
    args = parse_args()
    blend = args.blend.resolve()
    albedo = args.albedo.resolve()
    uv_path = args.uv.resolve()
    out = args.out.resolve()
    flip_v = not args.no_flip_v
    reverse_winding = not args.no_reverse_winding

    for path, label in ((blend, "blend"), (albedo, "albedo"), (uv_path, "uv")):
        if not path.exists():
            raise SystemExit(f"{label} introuvable : {path}")

    uv_data = np.load(uv_path)
    vt = np.asarray(uv_data["vt"], dtype=np.float64)
    ft = np.asarray(uv_data["ft"], dtype=np.int64)

    clear_scene()
    with bpy.data.libraries.load(str(blend), link=False) as (data_from, data_to):
        data_to.objects = list(data_from.objects)

    mesh_obj = None
    for obj in data_to.objects:
        if obj is None:
            continue
        bpy.context.collection.objects.link(obj)
        if obj.type == "MESH" and "FLAME" in obj.name.upper() and mesh_obj is None:
            mesh_obj = obj
        elif obj.type == "MESH" and mesh_obj is None:
            mesh_obj = obj

    if mesh_obj is None:
        raise SystemExit("Aucun mesh FLAME dans le .blend")

    # Drop non-FLAME helpers (e.g. icosphere) so GLB is clean
    for obj in list(bpy.context.scene.objects):
        if obj != mesh_obj and obj.type == "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)

    bpy.context.view_layer.objects.active = mesh_obj
    mesh_obj.select_set(True)
    mesh_obj.rotation_euler[0] = 1.57079632679
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    apply_uv(mesh_obj, vt, ft, flip_v=flip_v, reverse_winding=reverse_winding)
    mat = make_material(albedo)
    mesh_obj.data.materials.clear()
    mesh_obj.data.materials.append(mat)

    # Keep expression + jaw/pose morphs. Pose1 is FLAME jaw open (Exp* alone won't open the mouth).
    keep = {
        "Basis",
        "Base",
        *(f"Exp{i}" for i in range(1, 9)),
        *(f"Pose{i}" for i in range(1, 19)),
    }
    sk = mesh_obj.data.shape_keys
    if sk:
        for kb in list(sk.key_blocks):
            if kb.name not in keep:
                mesh_obj.shape_key_remove(kb)

    out.parent.mkdir(parents=True, exist_ok=True)
    # Morphs only — armature/skins collapse the mesh in Three.js without a full rig.
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj
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
        export_materials="EXPORT",
        export_image_format="AUTO",
    )
    keys = [kb.name for kb in mesh_obj.data.shape_keys.key_blocks] if mesh_obj.data.shape_keys else []
    print(f"Exported textured {out}")
    print(f"UV verts={len(vt)} faces={len(ft)} flip_v={flip_v} reverse_winding={reverse_winding}")
    print(f"Shape keys ({len(keys)}): {', '.join(keys)}")


if __name__ == "__main__":
    main()
