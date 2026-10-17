# Atlas Avatar — FLAME / AlbedoMM / SplattingAvatar

## Look layers (hero AceFace)

Priorité automatique :
1. **Splat** `apps/web/public/avatars/atlas.splat` → `SplatAvatar` (GaussianSplats3D)
2. **FLAME** `atlas-flame.glb` → mesh AlbedoMM + morphs Exp1–Exp8 + Pose1–18 (jaw = Pose1)
3. Tête WebGL procédurale

## FLAME (prêt sur ce PC)

```powershell
.\tools\avatar\scripts\export_flame_glb.ps1
.\tools\avatar\scripts\apply_flame_albedo.ps1
```

### Peaufiner avec le portrait (sans GPU)

**Peaufiner le portrait (recommandé, sans GPU)** — color transfer + overlay UV + export GLB :

```powershell
.\tools\avatar\scripts\project_portrait_flame.ps1
# équivalent :
.\tools\avatar\scripts\refine_flame_from_portrait.ps1
```

Albedo générique sauvegardé en `atlas-flame-albedo.base.png`.  
Script Cycles expérimental : `project_portrait_flame.py` (bake selected-to-active).

Blender portable : `tools/avatar/blender-portable/blender-4.2.16-windows-x64/blender.exe`

## Nebius GPU (L40S + CUDA) — création VM

Configs prêtes dans `tools/avatar/nebius/` (cloud-init corrigé + Terraform + `create-vm.ps1`).

```powershell
.\tools\avatar\nebius\create-vm.ps1 -DryRun
.\tools\avatar\nebius\create-vm.ps1
```

Voir `tools/avatar/nebius/README.md` (CLI auth, IP, SSH `atlas@IP`).

## AMD Instinct + GSplat (ROCm) — chemin alternatif

Ce PC n’a pas de GPU. Avec tes crédits AMD (MI300X / `gfx942`) :

**Important :** une seule photo ne suffit pas pour un `.splat` 3D utilisable dans AceFace.
Il faut une **courte vidéo du visage** (10–20 s, lent orbit) → COLMAP → `simple_trainer` → `atlas.splat`.
(`image_fitting.py` AMD = test 2D / GIF, pas l’avatar web.)

### 1) Crée la VM AMD (Instinct MI300X)

- Compte : [account.amd.com](https://account.amd.com/) → cloud / GPU credits
- Ubuntu + ROCm + Docker
- Ajoute ta clé SSH publique (`~/.ssh/id_ed25519.pub`)

### 2) Depuis ce PC (remplace `IP`)

```powershell
# optionnel : -Video chemin\vers\face.mp4
.\tools\avatar\scripts\push_amd_avatar.ps1 -HostName IP -User ubuntu
```

### 3) Sur la VM

```bash
bash ~/atlas-avatar/amd_gsplat_bootstrap.sh              # docker ROCm + PyTorch
bash ~/atlas-avatar/amd_gsplat_bootstrap.sh --install     # amd_gsplat + examples
bash ~/atlas-avatar/amd_prepare_dataset.sh --video ~/atlas-avatar/input/face.mp4
bash ~/atlas-avatar/amd_gsplat_bootstrap.sh --train-colmap --data_dir ~/atlas-avatar/colmap_subject
bash ~/atlas-avatar/amd_gsplat_bootstrap.sh --export
```

### 4) Récupère le splat

```powershell
scp ubuntu@IP:~/atlas-avatar/out/atlas.splat apps\web\public\avatars\atlas.splat
```

AceFace charge automatiquement `/avatars/atlas.splat`.

Docs AMD : [GSplat on ROCm](https://rocm.docs.amd.com/projects/gsplat/en/latest/)

## SplattingAvatar (NVIDIA CUDA — alternatif)

```powershell
.\tools\avatar\scripts\setup_splatting_avatar.ps1
# dataset IMavatar → data/avatar/splatting/atlas_subject
.\tools\avatar\scripts\train_splatting_avatar.ps1
# ou : .\tools\avatar\scripts\export_atlas_splat.ps1 -Source C:\path\to\point_cloud.ply
```

Nebius bootstrap (legacy) : `tools/avatar/scripts/nebius_bootstrap.sh`  
Repo vendor : `data/avatar/vendor/SplattingAvatar` (**neil-dev**)  
Portrait : `apps/web/public/avatars/atlas-target.png`

## Licences

FLAME / AlbedoMM / SplattingAvatar : termes MPG / auteurs — ne pas republier les poids sans accord.
