#!/usr/bin/env bash
# Build a COLMAP dataset for AMD GSplat simple_trainer from a face video (or image folder).
# Run on the AMD VM (host or inside the ROCm container if colmap is installed on host).
#
#   bash amd_prepare_dataset.sh --video ~/atlas-avatar/input/face.mp4
#   bash amd_prepare_dataset.sh --images ~/atlas-avatar/input/frames
#
# Output: ~/atlas-avatar/colmap_subject/{images,sparse/0}
set -euo pipefail

ROOT="${ATLAS_AVATAR_ROOT:-$HOME/atlas-avatar}"
OUT="$ROOT/colmap_subject"
VIDEO=""
IMAGES=""
MAX_FRAMES="${MAX_FRAMES:-120}"
FPS="${FPS:-4}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --video) VIDEO="$2"; shift ;;
    --images) IMAGES="$2"; shift ;;
    --max-frames) MAX_FRAMES="$2"; shift ;;
    --fps) FPS="$2"; shift ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
  shift
done

command -v colmap >/dev/null || {
  echo "Installing COLMAP (apt)..."
  sudo apt-get update -y
  sudo apt-get install -y colmap ffmpeg
}

rm -rf "$OUT"
mkdir -p "$OUT/images" "$OUT/sparse"

if [[ -n "$VIDEO" ]]; then
  [[ -f "$VIDEO" ]] || { echo "missing video: $VIDEO"; exit 1; }
  echo "Extracting frames from $VIDEO @ ${FPS}fps, max width 1280 (max $MAX_FRAMES)..."
  # Downscale 4K→720/1280 for faster COLMAP + GSplat (face avatar does not need UHD)
  ffmpeg -y -i "$VIDEO" -vf "fps=${FPS},scale='min(1280,iw)':-2" -q:v 3 "$OUT/images/%05d.jpg"
  # Keep only first MAX_FRAMES
  mapfile -t ALL < <(ls "$OUT/images"/*.jpg | sort)
  if (( ${#ALL[@]} > MAX_FRAMES )); then
    for f in "${ALL[@]:MAX_FRAMES}"; do rm -f "$f"; done
  fi
elif [[ -n "$IMAGES" ]]; then
  [[ -d "$IMAGES" ]] || { echo "missing images dir: $IMAGES"; exit 1; }
  cp -f "$IMAGES"/*.{jpg,jpeg,png,JPG,PNG} "$OUT/images/" 2>/dev/null || true
else
  echo "Usage: $0 --video face.mp4   OR   $0 --images ./frames"
  exit 1
fi

COUNT="$(ls "$OUT/images" | wc -l)"
echo "Images: $COUNT"
if (( COUNT < 8 )); then
  echo "ERROR: need at least ~8–20 face views for COLMAP. Film a slow orbit of the head."
  exit 1
fi

DB="$OUT/database.db"
rm -f "$DB"

echo "COLMAP feature_extractor..."
colmap feature_extractor \
  --database_path "$DB" \
  --image_path "$OUT/images" \
  --ImageReader.single_camera 1 \
  --ImageReader.camera_model OPENCV \
  --SiftExtraction.use_gpu 0

echo "COLMAP exhaustive_matcher..."
colmap exhaustive_matcher \
  --database_path "$DB" \
  --SiftMatching.use_gpu 0

echo "COLMAP mapper..."
colmap mapper \
  --database_path "$DB" \
  --image_path "$OUT/images" \
  --output_path "$OUT/sparse"

# Normalize to sparse/0
if [[ -d "$OUT/sparse/0" ]]; then
  :
elif [[ -d "$OUT/sparse" ]]; then
  FIRST="$(find "$OUT/sparse" -mindepth 1 -maxdepth 1 -type d | head -1 || true)"
  if [[ -n "${FIRST:-}" && "$FIRST" != "$OUT/sparse/0" ]]; then
    mkdir -p "$OUT/sparse/0"
    mv "$FIRST"/* "$OUT/sparse/0/" 2>/dev/null || true
  fi
fi

if [[ ! -f "$OUT/sparse/0/cameras.bin" && ! -f "$OUT/sparse/0/cameras.txt" ]]; then
  echo "ERROR: COLMAP failed to reconstruct. Use more frames / better lighting / slower motion."
  exit 1
fi

echo "Dataset ready: $OUT"
echo "Next (in ROCm container):"
echo "  bash ~/atlas-avatar/amd_gsplat_bootstrap.sh --train-colmap --data_dir $OUT"
echo "  bash ~/atlas-avatar/amd_gsplat_bootstrap.sh --export"
