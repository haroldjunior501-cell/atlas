"""
Blender: project atlas-target.png onto FLAME from a front camera, bake to AlbedoMM UVs,
mix with base albedo (sides/back), export atlas-flame-albedo.png + atlas-flame.glb.

Usage:
  blender --background --python tools/avatar/scripts/project_portrait_flame.py -- \
    --portrait apps/web/public/avatars/atlas-target.png \
    --base-albedo apps/web/public/avatars/atlas-flame-albedo.base.png
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []
    root = Path(__file__).resolve().parents[3]
    p = argparse.ArgumentParser()
    p.add_argument(
        "--blend",
        type=Path,
        default=root
        / "data/avatar/vendor/FLAME_Blender_AddOn/flame_tools/flame_tools/data/flame2020_generic.blend",
    )
    p.add_argument("--uv", type=Path, default=root / "data/avatar/flame_uv.npz")
    p.add_argument(
        "--portrait",
        type=Path,
        default=root / "apps/web/public/avatars/atlas-target.png",
    )
    p.add_argument(
        "--base-albedo",
        type=Path,
        default=root / "apps/web/public/avatars/atlas-flame-albedo.base.png",
    )
    p.add_argument(
        "--out-albedo",
        type=Path,
        default=root / "apps/web/public/avatars/atlas-flame-albedo.png",
    )
    p.add_argument(
        "--out-glb",
        type=Path,
        default=root / "apps/web/public/avatars/atlas-flame.glb",
    )
    p.add_argument("--resolution", type=int, default=1024)
    p.add_argument("--mix-front", type=float, default=0.78, help="Portrait weight on front-facing faces")
    p.add_argument("--cam-axis", choices=("y-", "y+", "z-", "z+"), default="y-")
    return p.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras):
        for b in list(block):
            block.remove(b)


def apply_uv(mesh_obj, vt, ft, flip_v=True, reverse_winding=True):
    me = mesh_obj.data
    if len(me.polygons) != len(ft):
        raise SystemExit(f"Face count mismatch: mesh={len(me.polygons)} ft={len(ft)}")
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    uv = me.uv_layers.new(name="AlbedoMM")
    for poly_i, poly in enumerate(me.polygons):
        corners = list(range(3))
        if reverse_winding:
            corners = list(reversed(corners))
        for corner, loop_index in zip(corners, poly.loop_indices):
            u, v = vt[int(ft[poly_i, corner])]
            if flip_v:
                v = 1.0 - float(v)
            uv.data[loop_index].uv = (float(u), float(v))
    # Second UV layer for camera projection
    if "Portrait" not in me.uv_layers:
        me.uv_layers.new(name="Portrait")


def load_flame(blend: Path):
    with bpy.data.libraries.load(str(blend), link=False) as (data_from, data_to):
        data_to.objects = list(data_from.objects)
    mesh_obj = None
    for obj in data_to.objects:
        if obj is None:
            continue
        bpy.context.collection.objects.link(obj)
        if obj.type == "MESH" and ("FLAME" in obj.name.upper() or mesh_obj is None):
            if "FLAME" in obj.name.upper() or mesh_obj is None:
                mesh_obj = obj
    for obj in list(bpy.context.scene.objects):
        if obj != mesh_obj and obj.type == "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    if mesh_obj is None:
        raise SystemExit("FLAME mesh introuvable")
    bpy.context.view_layer.objects.active = mesh_obj
    mesh_obj.select_set(True)
    mesh_obj.rotation_euler[0] = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return mesh_obj


def mesh_center_size(mesh_obj):
    coords = np.array([mesh_obj.matrix_world @ v.co for v in mesh_obj.data.vertices], dtype=np.float64)
    mn, mx = coords.min(0), coords.max(0)
    center = (mn + mx) * 0.5
    size = mx - mn
    return Vector(center), Vector(size), coords


def place_camera(center: Vector, size: Vector, axis: str):
    cam_data = bpy.data.cameras.new("PortraitCam")
    cam_data.type = "ORTHO"
    # Tight crop on the face (not whole head + neck)
    cam_data.ortho_scale = float(max(size.x, size.z) * 0.78)
    cam = bpy.data.objects.new("PortraitCam", cam_data)
    bpy.context.collection.objects.link(cam)

    dist = float(max(size) * 1.4)
    if axis == "y-":
        cam.location = (center.x, center.y - dist, center.z + size.z * 0.02)
    elif axis == "y+":
        cam.location = (center.x, center.y + dist, center.z + size.z * 0.02)
    elif axis == "z-":
        cam.location = (center.x, center.y, center.z - dist)
    else:
        cam.location = (center.x, center.y, center.z + dist)

    target = bpy.data.objects.new("FaceAim", None)
    target.location = (center.x, center.y, center.z + size.z * 0.02)
    bpy.context.collection.objects.link(target)
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    bpy.context.view_layer.update()
    return cam


def apply_uv_project(mesh_obj, cam):
    me = mesh_obj.data
    # Drop leftover modifiers from the .blend so UV Project is first
    for mod in list(mesh_obj.modifiers):
        mesh_obj.modifiers.remove(mod)
    me.uv_layers["Portrait"].active = True
    mod = mesh_obj.modifiers.new(name="UVProject", type="UV_PROJECT")
    mod.projector_count = 1
    mod.projectors[0].object = cam
    mod.uv_layer = "Portrait"
    bpy.context.view_layer.objects.active = mesh_obj
    mesh_obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    me.uv_layers["AlbedoMM"].active_render = True
    me.uv_layers["AlbedoMM"].active = True


def make_portrait_plane(portrait: Path, cam, center: Vector, size: Vector):
    """Emission plane between camera and face, normal pointing toward the mesh."""
    plane_size = float(cam.data.ortho_scale * 1.02)
    bpy.ops.mesh.primitive_plane_add(size=plane_size)
    plane = bpy.context.active_object
    plane.name = "PortraitPlane"

    to_face = (center - cam.location).normalized()
    # Halfway camera → face so the nose never pierces the plane
    plane.location = cam.location + to_face * ((center - cam.location).length * 0.55)

    # Orient plane: +Z toward the face (away from camera)
    quat = to_face.to_track_quat("Z", "Y")
    plane.rotation_euler = quat.to_euler()

    mat = bpy.data.materials.new("PortraitEmit")
    mat.use_nodes = True
    mat.use_backface_culling = False
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emit = nodes.new("ShaderNodeEmission")
    tex = nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(str(portrait.resolve()))
    img.colorspace_settings.name = "sRGB"
    tex.image = img
    tex.interpolation = "Linear"
    links.new(tex.outputs["Color"], emit.inputs["Color"])
    emit.inputs["Strength"].default_value = 1.0
    links.new(emit.outputs["Emission"], out.inputs["Surface"])
    plane.data.materials.append(mat)
    return plane


def prepare_target_material(mesh_obj, resolution: int):
    mat = bpy.data.materials.new("FLAME_BakeTarget")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    nodes.clear()
    # Minimal tree + selected image for bake target
    out = nodes.new("ShaderNodeOutputMaterial")
    emit = nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    bake_tex = nodes.new("ShaderNodeTexImage")
    bake_img = bpy.data.images.new("AtlasBake", width=resolution, height=resolution, alpha=False)
    bake_tex.image = bake_img
    bake_tex.select = True
    nodes.active = bake_tex
    mesh_obj.data.materials.clear()
    mesh_obj.data.materials.append(mat)
    return bake_img, bake_tex


def _load_rgb_np(path: Path, size: int | None = None) -> np.ndarray:
    img = bpy.data.images.load(str(path.resolve()))
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, img.channels)
    rgb = px[..., :3]
    # Blender pixels are bottom-up
    rgb = np.flipud(rgb)
    if size and (w != size or h != size):
        # nearest resize
        ys = (np.linspace(0, h - 1, size)).astype(np.int32)
        xs = (np.linspace(0, w - 1, size)).astype(np.int32)
        rgb = rgb[ys][:, xs]
    bpy.data.images.remove(img)
    return np.clip(rgb, 0, 1)


def _box_blur(mask: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return mask
    out = mask.copy()
    for _ in range(3):
        padded = np.pad(out, radius, mode="edge")
        acc = np.zeros_like(out)
        norm = np.zeros_like(out)
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                acc += padded[radius + dy : radius + dy + out.shape[0], radius + dx : radius + dx + out.shape[1]]
                norm += 1.0
        out = acc / norm
    return out


def composite_with_base(baked_path: Path, base_path: Path, out_path: Path, strength: float = 0.88):
    """Blend projected bake over base albedo; feather mask; fill UV padding (no PIL)."""
    size = 1024
    b = _load_rgb_np(base_path, size)
    p = _load_rgb_np(baked_path, size)
    luma = p.sum(axis=2)
    mask = (luma > 0.12).astype(np.float32)
    mask = _box_blur(mask, radius=max(2, size // 96)) * strength
    m = mask[..., None]
    out = b * (1.0 - m) + p * m
    pad = out.sum(axis=2) < 0.08
    if pad.any():
        skin = out[~pad].mean(axis=0)
        out[pad] = skin

    # Save via Blender image (bottom-up pixels)
    flipped = np.flipud(np.clip(out, 0, 1))
    img = bpy.data.images.new("AtlasComposite", width=size, height=size, alpha=False)
    rgba = np.ones((size, size, 4), dtype=np.float32)
    rgba[..., :3] = flipped
    img.pixels = rgba.reshape(-1).tolist()
    img.filepath_raw = str(out_path.resolve())
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    print(f"Composited {out_path} (strength={strength})")


def bake_selected_to_active(plane, mesh_obj, bake_img, resolution: int, cam):
    bake_img.scale(resolution, resolution)
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.render.bake.margin = 16
    scene.render.bake.use_clear = True
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = 0.05
    scene.render.bake.max_ray_distance = float(max(mesh_obj.dimensions) * 1.5)
    scene.cycles.bake_type = "EMIT"

    mesh_obj.data.uv_layers["AlbedoMM"].active = True
    mesh_obj.data.uv_layers["AlbedoMM"].active_render = True

    bpy.ops.object.select_all(action="DESELECT")
    plane.select_set(True)
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.bake(type="EMIT")


def export_glb(mesh_obj, out: Path):
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

    # Final display material = baked albedo
    mat = bpy.data.materials.new("FLAME_Baked")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out_n = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexImage")
    # reload from disk after save
    tex.image = bpy.data.images.load(str(out.parent / "atlas-flame-albedo.png"))
    tex.image.colorspace_settings.name = "sRGB"
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], out_n.inputs["Surface"])
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = 0.42
    mesh_obj.data.materials.clear()
    mesh_obj.data.materials.append(mat)

    out.parent.mkdir(parents=True, exist_ok=True)
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


def main():
    args = parse_args()
    for path, label in (
        (args.blend, "blend"),
        (args.uv, "uv"),
        (args.portrait, "portrait"),
        (args.base_albedo, "base-albedo"),
    ):
        if not path.exists():
            # fallback: current albedo if no .base
            if label == "base-albedo":
                alt = args.out_albedo if args.out_albedo.exists() else None
                if alt and alt.exists():
                    args.base_albedo = alt
                    continue
            raise SystemExit(f"{label} introuvable: {path}")

    uv = np.load(args.uv)
    vt = np.asarray(uv["vt"], dtype=np.float64)
    ft = np.asarray(uv["ft"], dtype=np.int64)

    clear_scene()
    mesh = load_flame(args.blend)
    apply_uv(mesh, vt, ft)
    for mod in list(mesh.modifiers):
        mesh.modifiers.remove(mod)
    center, size, _ = mesh_center_size(mesh)
    print(f"Mesh center={tuple(center)} size={tuple(size)}")

    cam = place_camera(center, size, args.cam_axis)
    plane = make_portrait_plane(args.portrait, cam, center, size)
    print(f"Portrait plane at {tuple(plane.location)}")

    bake_img, _ = prepare_target_material(mesh, args.resolution)
    bake_selected_to_active(plane, mesh, bake_img, args.resolution, cam)

    args.out_albedo.parent.mkdir(parents=True, exist_ok=True)
    raw_bake = args.out_albedo.with_name("atlas-flame-albedo.projected.png")
    bake_img.filepath_raw = str(raw_bake.resolve())
    bake_img.file_format = "PNG"
    bake_img.save()
    print(f"Wrote raw projection {raw_bake}")

    composite_with_base(raw_bake, args.base_albedo, args.out_albedo, strength=args.mix_front)

    # Remove plane before export
    bpy.data.objects.remove(plane, do_unlink=True)
    export_glb(mesh, args.out_glb)
    print(f"Exported {args.out_glb}")


if __name__ == "__main__":
    main()
