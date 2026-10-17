# Nebius AI Cloud — GPU L40S for Atlas avatar training (CUDA / GSplat)
# Docs: https://docs.nebius.com/terraform-provider/reference/resources/compute_v1_instance
#
# Auth (one of):
#   $env:NEBIUS_IAM_TOKEN = (from `nebius iam get-access-token`)
#   OR service-account: SA_ID + AUTHKEY_ID + AUTHKEY_PRIV_PATH
#      https://docs.nebius.com/terraform-provider/authentication
#
#   cd tools/avatar/nebius
#   terraform init && terraform plan && terraform apply

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    nebius = {
      source  = "nebius/nebius"
      version = ">= 0.6.8"
    }
  }
}

# Reads NEBIUS_IAM_TOKEN from the environment when set.
# For SA auth, uncomment service_account and export SA_ID / AUTHKEY_ID / AUTHKEY_PRIV_PATH.
provider "nebius" {
  # token is optional — provider also reads NEBIUS_IAM_TOKEN
  # service_account = {
  #   account_id_env       = "SA_ID"
  #   public_key_id_env    = "AUTHKEY_ID"
  #   private_key_file_env = "AUTHKEY_PRIV_PATH"
  # }
}

variable "parent_id" {
  type    = string
  default = "project-e00q1epdpr006s3hrffnk6"
}

variable "subnet_id" {
  type    = string
  default = "vpcsubnet-e00adgebtn6rj6szkq"
}

variable "service_account_id" {
  type    = string
  default = "serviceaccount-e00kg7q9gy2hrhp2t3"
}

variable "security_group_id" {
  type    = string
  default = "vpcsecuritygroup-e00hnc7g3f4xp87jnw"
}

variable "instance_name" {
  type    = string
  default = "atlas-l40s-gsplat-1"
}

variable "boot_disk_gib" {
  type    = number
  default = 100
}

locals {
  user_data = file("${path.module}/cloud-init.yaml")
}

resource "nebius_compute_v1_instance" "vm" {
  name      = var.instance_name
  parent_id = var.parent_id
  stopped   = false

  resources = {
    platform = "gpu-l40s-a"
    preset   = "1gpu-8vcpu-32gb"
  }

  boot_disk = {
    managed_disk = {
      name = "${var.instance_name}-boot"
      spec = {
        type             = "NETWORK_SSD"
        block_size_bytes = 4096
        size_gibibytes   = var.boot_disk_gib
        source_image_family = {
          image_family = "ubuntu24.04-cuda13.0"
        }
      }
    }
    attach_mode = "READ_WRITE"
    device_id   = "boot-disk"
  }

  network_interfaces = [
    {
      name              = "eth0"
      subnet_id         = var.subnet_id
      ip_address        = {}
      public_ip_address = {}
      security_groups = [
        { id = var.security_group_id }
      ]
    }
  ]

  service_account_id = var.service_account_id

  preemptible = {
    on_preemption = "STOP"
  }

  follows_spot_price = {}
  recovery_policy    = "FAIL"

  cloud_init_user_data = local.user_data

  reservation_policy = {
    policy = "FORBID"
  }
}

output "instance_id" {
  value = nebius_compute_v1_instance.vm.id
}

output "instance_name" {
  value = nebius_compute_v1_instance.vm.name
}

output "ssh_hint" {
  value = "ssh -i $env:USERPROFILE\\.ssh\\id_ed25519 atlas@<PUBLIC_IP>"
}
