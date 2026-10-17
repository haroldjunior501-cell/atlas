#!/usr/bin/env bash
# Create Atlas L40S GPU VM on Nebius (run inside Ubuntu WSL).
set -euo pipefail
export PATH="/root/.nebius/bin:${PATH}"

NAME="${1:-atlas-l40s-gsplat-1}"
PARENT_ID="${2:-project-e00q1epdpr006s3hrffnk6}"
SA_ID="${3:-serviceaccount-e00kg7q9gy2hrhp2t3}"
SUBNET_ID="${4:-vpcsubnet-e00adgebtn6rj6szkq}"
SG_ID="${5:-vpcsecuritygroup-e00hnc7g3f4xp87jnw}"
DISK_BYTES="${6:-107374182400}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUD_INIT="${SCRIPT_DIR}/cloud-init.yaml"

if [[ ! -f "${CLOUD_INIT}" ]]; then
  echo "Missing ${CLOUD_INIT}" >&2
  exit 1
fi

USER_DATA="$(cat "${CLOUD_INIT}")"
if [[ "${USER_DATA}" != \#cloud-config* ]]; then
  echo "cloud-init.yaml must start with #cloud-config" >&2
  exit 1
fi

NETWORK="$(cat <<EOF
[{"name":"eth0","subnet_id":"${SUBNET_ID}","ip_address":{},"public_ip_address":{},"security_groups":[{"id":"${SG_ID}"}]}]
EOF
)"

echo "=== Nebius create GPU VM ==="
echo "name=${NAME} platform=gpu-l40s-a preset=1gpu-8vcpu-32gb"
echo "disk=$(( DISK_BYTES / 1024 / 1024 / 1024 )) GiB image=ubuntu24.04-cuda13.0"

nebius compute v1 instance create \
  --parent-id "${PARENT_ID}" \
  --name "${NAME}" \
  --service-account-id "${SA_ID}" \
  --resources-platform gpu-l40s-a \
  --resources-preset 1gpu-8vcpu-32gb \
  --network-interfaces "${NETWORK}" \
  --boot-disk-attach-mode read_write \
  --boot-disk-managed-disk-name "${NAME}-boot" \
  --boot-disk-managed-disk-size-gibibytes "$(( DISK_BYTES / 1024 / 1024 / 1024 ))" \
  --boot-disk-managed-disk-block-size-bytes 4096 \
  --boot-disk-managed-disk-type network_ssd \
  --boot-disk-managed-disk-source-image-family-image-family ubuntu24.04-cuda13.0 \
  --boot-disk-device-id boot-disk \
  --cloud-init-user-data "${USER_DATA}" \
  --recovery-policy fail \
  --preemptible-on-preemption stop \
  --reservation-policy-policy forbid \
  --follows-spot-price=true \
  --format json

echo ""
echo "Get status/IP:"
echo "  nebius compute v1 instance get-by-name --name ${NAME} --parent-id ${PARENT_ID}"
echo "SSH: ssh -i ~/.ssh/id_ed25519 atlas@<PUBLIC_IP>"
