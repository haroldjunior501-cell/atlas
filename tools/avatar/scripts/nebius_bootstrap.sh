#!/usr/bin/env bash
# Run on a Nebius Ubuntu GPU VM (CUDA). Builds SplattingAvatar env and trains Atlas.
# Usage:
#   bash nebius_bootstrap.sh                 # setup only
#   bash nebius_bootstrap.sh --train         # setup + train if atlas_subject exists
#   bash nebius_bootstrap.sh --pack-out      # copy latest point_cloud to ./out/atlas.splat
set -euo pipefail

ROOT="${ATLAS_ROOT:-$HOME/atlas-avatar}"
REPO="$ROOT/SplattingAvatar"
SUBJECT="$ROOT/atlas_subject"
OUT="$ROOT/out"
PORTRAIT_SRC="${1:-}"
DO_TRAIN=0
DO_PACK=0

for arg in "$@"; do
  case "$arg" in
    --train) DO_TRAIN=1 ;;
    --pack-out) DO_PACK=1 ;;
  esac
done

echo "=== Atlas Nebius bootstrap ==="
echo "ROOT=$ROOT"
command -v nvidia-smi >/dev/null || { echo "ERROR: nvidia-smi missing — pick a GPU VM"; exit 1; }
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

mkdir -p "$ROOT" "$SUBJECT" "$OUT"
cd "$ROOT"

# --- system deps ---
sudo apt-get update -y
sudo apt-get install -y git wget curl build-essential ffmpeg

# --- conda ---
if ! command -v conda >/dev/null 2>&1; then
  echo "Installing Miniconda..."
  wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh
  bash /tmp/miniconda.sh -b -p "$HOME/miniconda3"
  # shellcheck disable=SC1091
  source "$HOME/miniconda3/etc/profile.d/conda.sh"
  conda init bash >/dev/null 2>&1 || true
else
  # shellcheck disable=SC1091
  source "$(conda info --base)/etc/profile.d/conda.sh"
fi

if ! conda env list | grep -q '^splatting '; then
  conda create -y -n splatting python=3.9
fi
conda activate splatting

pip install -U pip wheel
# Torch CUDA 11.7 (tested by SplattingAvatar)
pip install torch==1.13.1 torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu117
pip install tqdm omegaconf opencv-python libigl trimesh plyfile imageio lpips packaging pybind11
pip install "numpy==1.23.1"

# pytorch3d (may take a while)
if ! python -c "import pytorch3d" 2>/dev/null; then
  if [[ ! -d "$ROOT/pytorch3d" ]]; then
    git clone --depth 1 https://github.com/facebookresearch/pytorch3d.git "$ROOT/pytorch3d"
  fi
  pip install -e "$ROOT/pytorch3d"
fi

# --- SplattingAvatar neil-dev ---
if [[ ! -f "$REPO/train_splatting_avatar.py" ]]; then
  rm -rf "$REPO"
  git clone --recursive -b neil-dev https://github.com/initialneil/SplattingAvatar.git "$REPO"
fi
cd "$REPO"
git submodule update --init --recursive

pushd submodules/diff-gaussian-rasterization >/dev/null
pip install .
popd >/dev/null
pushd submodules/simple-knn >/dev/null
pip install .
popd >/dev/null
pushd model/simple_phongsurf >/dev/null
pip install -e .
popd >/dev/null

echo ""
echo "NOTE: Place FLAME2020 generic_model.pkl in:"
echo "  $REPO/model/imavatar/FLAME2020/generic_model.pkl"
echo "Download from https://flame.is.tue.mpg.de/ (accept license)."
echo ""
echo "Dataset (IMavatar-preprocessed) must live in:"
echo "  $SUBJECT"
echo "A single still photo is NOT enough — use a short face video, then IMavatar preprocess,"
echo "or copy a preprocessed subject from the SplattingAvatar Google Drive."
echo ""

if [[ "$DO_TRAIN" -eq 1 ]]; then
  if [[ ! -d "$SUBJECT" ]] || [[ -z "$(ls -A "$SUBJECT" 2>/dev/null || true)" ]]; then
    echo "ERROR: empty dataset at $SUBJECT"
    exit 1
  fi
  export CUDA_VISIBLE_DEVICES=0
  python train_splatting_avatar.py \
    --config configs/splatting_avatar.yaml \
    --dat_dir "$SUBJECT" \
    --ip none \
    model.max_n_gauss=300000
fi

if [[ "$DO_PACK" -eq 1 ]] || [[ "$DO_TRAIN" -eq 1 ]]; then
  PC="$(find "$SUBJECT" -name 'point_cloud.ply' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || true)"
  if [[ -z "${PC:-}" ]]; then
    echo "WARNING: no point_cloud.ply yet"
  else
    cp -f "$PC" "$OUT/atlas.ply"
    cp -f "$PC" "$OUT/atlas.splat"
    echo "Exported -> $OUT/atlas.splat"
    echo "Copy to your PC: apps/web/public/avatars/atlas.splat"
  fi
fi

echo "Done."
