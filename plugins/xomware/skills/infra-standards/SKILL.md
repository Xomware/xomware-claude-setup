---
name: infra-standards
description: >
  ALWAYS use when doing any infrastructure work — Terraform, AWS, CI/CD, Docker,
  deployment, IAM, ECS, Lambda, GitHub Actions. Covers IaC and cloud conventions.
  Load alongside terraform and docker-deploy skills for implementation patterns.
  Trigger phrases: "infra", "infrastructure", "aws", "iam", "ecs", "lambda",
  "ci/cd", "github actions", "deploy", "cloud", "fargate".
---

# Infra Standards

## Before Writing Any Terraform

1. Which workspace/state backend does this change belong to? Confirm before writing.
2. Does a module already exist for this pattern? Check before creating new.
3. Remote state only -- never local state in shared projects.
4. Plan before apply -- always. Review output before proceeding.
5. Significant changes: write a `PLAN.md` spec first, execute after review.

## Terraform Standards

- Every resource: `environment`, `project`, `owner` tags -- no exceptions
- Remote state backend (TF Cloud, S3+DynamoDB, etc.) -- never local for shared infra
- Auth to AWS: OIDC preferred -- avoid static IAM keys
- Reuse existing modules before creating new ones
- Variables: typed, described -- no bare `variable "x" {}`
- Sensitive values: marked `sensitive = true`, sourced from secrets manager
- Pin provider versions with `~>` (minor-compatible)

## AWS Standards

**IAM -- Least Privilege Always**
- Role per service -- no shared roles across unrelated services
- No `*` actions without explicit justification in a comment
- No IAM users -- roles + OIDC only
- OIDC for GitHub Actions -> AWS -- no long-lived keys

**ECS Fargate**
- Health checks required on all services
- Always set explicit CPU/memory -- never rely on defaults
- Secrets injected at runtime via secrets manager -- not hardcoded
- Task roles scoped to minimum required permissions

**Lambda**
- Use for: event-driven, short-lived, scheduled (EventBridge)
- EventBridge for scheduling -- not CloudWatch Events directly
- Always set explicit timeout and memory
- Python: `aws-lambda-powertools` for logging/tracing/metrics
- Async invocations: DLQ or explicit error destinations required

**Networking**
- No public IPs on tasks unless explicitly required
- Security groups: least privilege, named descriptively, tagged

**S3**
- Block public access by default
- Versioning on buckets holding critical state or assets
- Lifecycle rules on log/temp buckets

## CI/CD (GitHub Actions)

- OIDC to AWS -- no long-lived credentials in GitHub secrets for AWS auth
- Branch protection: PRs required for main, status checks must pass
- Workflow files: pin action versions to SHA -- not floating tags
- Reuse composite actions for repeated patterns

## Self-Review

Before marking infra work done:
- [ ] State backend confirmed (not local)
- [ ] Plan reviewed before apply
- [ ] All resources tagged: environment, project, owner
- [ ] IAM: no `*` without justification, no IAM users
- [ ] No static credentials in the diff
- [ ] Sensitive variables marked `sensitive = true`
- [ ] Container images pinned -- no `latest` tags

## Common Mistakes

- Hardcoding AWS region -- always `var.aws_region`
- IAM users instead of roles + OIDC
- Skipping `terraform plan` review before large applies
- Using `latest` tag on container images
- Missing resource tags -- breaks cost attribution and auditing
- Local state during prototyping that never migrates to remote backend
