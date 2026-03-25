---
name: terraform
description: >
  ALWAYS use when writing, reviewing, or debugging Terraform or Terragrunt. Also
  triggers for: AWS resources, IAM roles, OIDC setup, Terraform Cloud workspaces,
  module design, state management, provider config. Never write IaC without this skill.
  Trigger phrases: "terraform", "terragrunt", "tf", "hcl", "workspace",
  "state file", "provider", "module", "apply", "plan", "destroy", "tfvars".
---

# Terraform Patterns — Xomware

## File Structure
```
infra/
├── main.tf           # provider config, terraform block
├── variables.tf      # all input variables
├── outputs.tf        # all outputs
├── locals.tf         # computed locals
└── modules/
    └── [module]/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

## Provider / State Config
```hcl
terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "xomware-terraform-state"
    key            = "project/env/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}
```

## Variables
```hcl
# variables.tf — always typed, always described
variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod"
  }
}

variable "instance_count" {
  description = "Number of instances to run"
  type        = number
  default     = 1
}
```

## Locals
```hcl
# locals.tf — derive values, never repeat yourself
locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
```

## Resources — Safe Patterns
```hcl
# Always tag resources
resource "aws_instance" "app" {
  ami           = data.aws_ami.app.id
  instance_type = var.instance_type

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app"
  })

  lifecycle {
    # Prevent accidental destruction of stateful resources
    prevent_destroy = var.environment == "prod"
  }
}

# Use data sources over hardcoded IDs
data "aws_vpc" "main" {
  tags = { Name = "${local.name_prefix}-vpc" }
}
```

## Modules
```hcl
module "database" {
  source = "./modules/database"

  environment    = var.environment
  instance_class = var.db_instance_class
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
}
```

## Rules
- **Never commit `.tfstate` or `.tfstate.backup`** — always remote state
- **Never hardcode secrets** — use `var` + AWS SSM/Secrets Manager
- Run `terraform plan` before every `apply` — review the diff
- `prevent_destroy = true` on prod databases and state buckets
- All variables typed and described — no untyped `any` without comment
- Use `terraform fmt` and `terraform validate` in CI
- Pin provider versions with `~>` (minor-compatible), not `>=`
- Separate workspaces or state files per environment
