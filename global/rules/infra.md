---
paths:
  - "**/*.tf"
  - "**/*.tfvars"
  - "**/*.hcl"
  - "**/terraform/**"
  - "**/infra/**"
  - "**/.github/workflows/**"
  - "**/Dockerfile*"
  - "**/docker-compose*.y*ml"
---

# Infra Rules

Non-negotiables. The `infra-standards`, `terraform` and `docker-deploy` skills carry
the full conventions.

- Confirm the workspace and state backend before writing any Terraform.
- Always `terraform plan` before apply, and read the output. Never apply blind.
- Every resource tagged: `environment`, `project`, `owner`.
- IAM is least privilege. No `*` without a written justification, no IAM users, OIDC
  only.
- Secrets via SSM or Secrets Manager — never in tfvars, never in the repo.
- Pin container image tags. No `latest`.
- GitHub Actions: pin actions to a SHA, use OIDC for AWS auth.
- Never `terraform destroy` outside a sandbox workspace without explicit sign-off.
