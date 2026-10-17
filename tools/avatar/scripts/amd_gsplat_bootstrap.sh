#!/usr/bin/env bash
# Atlas avatar train on AMD Instinct (ROCm) via official GSplat Docker + amd_gsplat.
# Docs: https://rocm.docs.amd.com/projects/gsplat/en/latest/
#
# On the AMD GPU VM (host):
#   bash amd_gsplat_bootstrap.sh              # pull image + start container
#   bash amd_gsplat_bootstrap.sh --enter       # shell into running container
#   bash amd_gsplat_bootstrap.sh --install     # inside container: pip + examples
#   bash amd_gsplat_bootstrap.sh --train-image # train from ~/atlas-avatar/input/ref.png
#   bash amd_gsplat_bootstrap.sh --train-colmap --data_dir ~/atlas-avatar/colmap_subject
#   bash amd_gsplat_bootstrap.sh --export      # copy best .ply -> ~/atlas-avatar/out/atlas.splat
set -euo pipefail

NAME="${ROCM_CONTAINER:-rocm_pytorch_atlas}"
# ROCm 7 + PyTorch 2.8 (Ubuntu 22.04 / py3.10) — matches AMD GSplat install guide
IMAGE="${ROCM_IMAGE:-rocm/pytorch:rocm7.0_ubuntu22.04_py3.10_pytorch_release_2.8.0}"
ROOT="${ATLAS_AVATAR_ROOT:-$HOME/atlas-avatar}"
INPUT="$ROOT/input"
OUT="$ROOT/out"
WORK="$ROOT/gsplat"
RESULT="$ROOT/results/atlas"

DO_ENTER=0
DO_INSTALL=0
DO_TRAIN_IMAGE=0
DO_TRAIN_COLMAP=0
DO_EXPORT=0
DATA_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --enter) DO_ENTER=1 ;;
    --install) DO_INSTALL=1 ;;
    --train-image) DO_TRAIN_IMAGE=1 ;;
    --train-colmap) DO_TRAIN_COLMAP=1 ;;
    --export) DO_EXPORT=1 ;;
    --data_dir) DATA_DIR="$2"; shift ;;
    --image) IMAGE="$2"; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
  shift
done

mkdir -p "$INPUT" "$OUT" "$RESULT"

host_bootstrap() {
  echo "=== Atlas AMD GSplat (host) ==="
  if command -v rocminfo >/dev/null 2>&1; then
    rocminfo | grep -E 'gfx|Marketing Name' | head -20 || true
  else
    echo "WARN: rocminfo not on PATH (ok inside Docker if devices are passed)"
  fi
  command -v docker >/dev/null || { echo "ERROR: docker required"; exit 1; }

  if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "Pulling $IMAGE ..."
    docker pull "$IMAGE"
  fi

  if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
    if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
      docker start "$NAME"
    fi
    echo "Container running: $NAME"
  else
    docker run -d \
      --name "$NAME" \
      --cap-add=SYS_PTRACE \
      --ipc=host \
      --privileged=true \
      --shm-size=128GB \
      --network=host \
      --device=/dev/kfd \
      --device=/dev/dri \
      --group-add video \
      -v "$HOME:$HOME" \
      -v "$ROOT:$ROOT" \
      "$IMAGE" \
      sleep infinity
    echo "Started $NAME"
  fi
}

inside_install() {
  echo "=== Install amd_gsplat + examples ==="
  python -c "import torch; print('torch', torch.__version__, 'hip', getattr(torch.version, 'hip', None))"
  pip install -U pip
  pip install amd_gsplat --extra-index-url=https://pypi.amd.com/rocm-7.0.0/simple/
  pip show amd_gsplat

  if [[ ! -d "$WORK/examples" ]]; then
    rm -rf "$WORK"
    git clone --no-checkout https://github.com/AMD-Ecosystem/gsplat.git "$WORK"
    cd "$WORK"
    git sparse-checkout init --cone
    git sparse-checkout add examples
    git checkout main
  fi
  cd "$WORK/examples"
  pip install -r requirements.txt
  echo "Examples ready in $WORK/examples"
}

train_single_image() {
  # AMD image_fitting.py only validates rasterization (GIF) — NOT a web .splat avatar.
  # For AceFace we need COLMAP multi-view → simple_trainer → .ply
  echo "ERROR: a single still photo cannot produce atlas.splat for the bureau viewer."
  echo ""
  echo "Do this instead:"
  echo "  1) Film 10–20s of the face (slow left/right + slight up/down)"
  echo "  2) scp face.mp4 USER@VM:$INPUT/face.mp4"
  echo "  3) bash amd_prepare_dataset.sh --video $INPUT/face.mp4"
  echo "  4) bash amd_gsplat_bootstrap.sh --train-colmap --data_dir $ROOT/colmap_subject"
  echo "  5) bash amd_gsplat_bootstrap.sh --export"
  exit 2
}

train_colmap() {
  local dir="${DATA_DIR:-$ROOT/colmap_subject}"
  if [[ ! -d "$dir" ]]; then
    echo "ERROR: COLMAP dataset missing: $dir"
    echo "Expected COLMAP layout (images/ + sparse/). See gsplat COLMAP docs."
    exit 1
  fi
  echo "Training COLMAP capture from $dir"
  cd "$WORK/examples"
  mkdir -p "$RESULT"
  CUDA_VISIBLE_DEVICES=0 python simple_trainer.py default \
    --data_dir "$dir" \
    --data_factor 2 \
    --result_dir "$RESULT"
}

do_export() {
  mkdir -p "$OUT"
  local ply
  ply="$(find "$RESULT" "$ROOT/results" -name '*.ply' 2>/dev/null | head -1 || true)"
  if [[ -z "${ply:-}" ]]; then
    echo "ERROR: no .ply under $RESULT — train first"
    exit 1
  fi
  cp -f "$ply" "$OUT/atlas.ply"
  cp -f "$ply" "$OUT/atlas.splat"
  echo "Exported:"
  echo "  $OUT/atlas.splat"
  echo "Copy to your PC:"
  echo "  scp USER@VM:$OUT/atlas.splat apps/web/public/avatars/atlas.splat"
}

# --- dispatch ---
if [[ "$DO_INSTALL" -eq 1 || "$DO_TRAIN_IMAGE" -eq 1 || "$DO_TRAIN_COLMAP" -eq 1 || "$DO_EXPORT" -eq 1 ]]; then
  # Assume we are already inside the container when these flags are used alone,
  # unless docker is available and container exists — then exec.
  if [[ -f /.dockerenv ]] || [[ "${ATLAS_IN_CONTAINER:-0}" == "1" ]]; then
    [[ "$DO_INSTALL" -eq 1 ]] && inside_install
    [[ "$DO_TRAIN_IMAGE" -eq 1 ]] && train_single_image
    [[ "$DO_TRAIN_COLMAP" -eq 1 ]] && train_colmap
    [[ "$DO_EXPORT" -eq 1 ]] && do_export
    exit 0
  fi
  host_bootstrap
  ARGS=()
  [[ "$DO_INSTALL" -eq 1 ]] && ARGS+=(--install)
  [[ "$DO_TRAIN_IMAGE" -eq 1 ]] && ARGS+=(--train-image)
  [[ "$DO_TRAIN_COLMAP" -eq 1 ]] && ARGS+=(--train-colmap)
  [[ "$DO_EXPORT" -eq 1 ]] && ARGS+=(--export)
  [[ -n "$DATA_DIR" ]] && ARGS+=(--data_dir "$DATA_DIR")
  docker exec -e ATLAS_IN_CONTAINER=1 -e HOME="$HOME" -w "$HOME" -it "$NAME" \
    bash "$ROOT/amd_gsplat_bootstrap.sh" "${ARGS[@]}"
  exit 0
fi

if [[ "$DO_ENTER" -eq 1 ]]; then
  host_bootstrap
  exec docker exec -it "$NAME" bash
fi

# default: host pull + start
host_bootstrap
# copy this script into ROOT for in-container use
SCRIPT_SRC="$(readlink -f "$0" 2>/dev/null || realpath "$0" 2>/dev/null || echo "$0")"
cp -f "$SCRIPT_SRC" "$ROOT/amd_gsplat_bootstrap.sh" 2>/dev/null || true
chmod +x "$ROOT/amd_gsplat_bootstrap.sh" 2>/dev/null || true
echo ""
echo "Next:"
echo "  1) scp apps/web/public/avatars/atlas-target.png USER@VM:$INPUT/ref.png"
echo "  2) bash amd_gsplat_bootstrap.sh --install"
echo "  3) bash amd_gsplat_bootstrap.sh --train-image   # or --train-colmap"
echo "  4) bash amd_gsplat_bootstrap.sh --export"
echo "  5) scp USER@VM:$OUT/atlas.splat apps/web/public/avatars/"
