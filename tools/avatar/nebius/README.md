# Atlas avatar — Nebius GPU VM (L40S + CUDA)

## Fichiers

| Fichier | Rôle |
|---------|------|
| `cloud-init.yaml` | User `atlas` + clé SSH (`#cloud-config`) |
| `main.tf` | Terraform (provider Nebius ≥ 0.6.8) |
| `create-vm.ps1` | Création via CLI Nebius (WSL Ubuntu) |
| `.terraform.lock.hcl` | Lock provider (après `terraform init`) |

## IDs

- Project: `project-e00q1epdpr006s3hrffnk6`
- Subnet: `vpcsubnet-e00adgebtn6rj6szkq`
- SA: `serviceaccount-e00kg7q9gy2hrhp2t3`
- SG: `vpcsecuritygroup-e00hnc7g3f4xp87jnw`
- Platform: `gpu-l40s-a` / `1gpu-8vcpu-32gb`
- Image: `ubuntu24.04-cuda13.0`
- Boot disk: **100 GiB** NETWORK_SSD (+ IP publique éphémère)

## Setup Windows (déjà fait sur ce PC)

1. Terraform 1.16+ (winget `Hashicorp.Terraform`)
2. WSL distro `Ubuntu-24.04`
3. Nebius CLI dans WSL : `/root/.nebius/bin/nebius`

## Auth (déjà fait sur ce PC)

Profil WSL `atlas` OK (`haroldjunior501@gmail.com`, tenant `gray-tern-tenant-5dq`, admin).

```powershell
# Token Terraform (~12h) si besoin
$env:NEBIUS_IAM_TOKEN = (wsl -d Ubuntu-24.04 -e bash -lc 'export PATH=/root/.nebius/bin:$PATH; nebius iam get-access-token').Trim()
```

## Billing (bloqueur actuel)

`instance create` renvoie **PermissionDenied** tant que le billing n’est pas configuré.

1. Ouvre [console.nebius.com → Billing](https://console.nebius.com/)
2. Ajoute une carte (top-up $25) ou démarre le free trial ($5)
3. Relance la création ci-dessous

Quotas eu-north1 OK (`compute.instance.gpu.l40s=32`, `instance.count=12`). CPU non-GPU est à 0 dans cette région — prendre une GPU L40S.

## Créer la VM

### A — CLI WSL (recommandé)

```powershell
wsl -d Ubuntu-24.04 -e bash -lc '/mnt/c/Users/PC/Desktop/final-hakathon/atlas/tools/avatar/nebius/create-vm.sh'
# ou :
.\tools\avatar\nebius\create-vm.ps1
```

### B — Terraform

```powershell
cd tools\avatar\nebius
terraform init
terraform plan
terraform apply
```

### C — Console web

Mêmes IDs, user `atlas`, coller `~/.ssh/id_ed25519.pub`, image CUDA Ubuntu 24.04.

## Après création

```powershell
# IP :
wsl -d Ubuntu-24.04 -e bash -lc 'export PATH=/root/.nebius/bin:$PATH; nebius compute v1 instance get --name atlas-l40s-gsplat-1 --parent-id project-e00q1epdpr006s3hrffnk6'

ssh -i $env:USERPROFILE\.ssh\id_ed25519 atlas@<PUBLIC_IP>
nvidia-smi
```

Upload + train :

```powershell
scp -i $env:USERPROFILE\.ssh\id_ed25519 `
  tools/avatar/scripts/nebius_bootstrap.sh `
  data/avatar/amd_input/face.mp4 `
  atlas@<IP>:~/
```

## Corrections vs export console

- `#cloud-config` + YAML 2 espaces
- User `atlas` (pas `ton-email`)
- Disque 100 GiB (pas ~1.25 TiB)
- `public_ip_address = {}` pour SSH
- `on_preemption = STOP` + security group
