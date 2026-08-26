# Ops recon recipes

Where deploy, secret, and rollback facts actually live. Source-code recon is covered by
the `walkthrough` skill's `references/recon.md` — this file is the ops half only.

**Every command here is a lookup, not a guess.** If a section returns nothing, the answer
is `unknown`. Do not infer a deploy process from the stack — "it's a Lambda so it
probably deploys with SAM" is exactly how a runbook becomes dangerous.

---

## Start here — what kind of deploy is this?

```bash
fd -H -d 2 '^(Dockerfile|docker-compose.*\.ya?ml|fly\.toml|Procfile|vercel\.json|netlify\.toml|wrangler\.toml|serverless\.ya?ml|Makefile)$'
fd -e tf -d 2 . | head
ls -d .github/workflows 2>/dev/null && ls .github/workflows/
```

The answer is usually a combination. A repo with `.tf` **and** `.github/workflows` almost
certainly splits ownership: Terraform creates infrastructure, CI deploys code onto it.
Say which owns what — that split is the single most useful line in a runbook.

## CI/CD — GitHub Actions

```bash
# what triggers each workflow, and on which branches
rg -n "^on:|^\s+(push|pull_request|workflow_dispatch|schedule):|branches:|cron:" .github/workflows/

# what they actually do — the steps that change the world
rg -n "uses:|run:.*(deploy|apply|migrate|release|push|ecs|fly|wrangler)" .github/workflows/

# reusable workflows from the org — read the callee too, the deploy logic
# usually lives there, not in this repo
rg -n "uses:\s*Xomware/" .github/workflows/

# environment protection / manual approval gates
rg -n "environment:|needs:" .github/workflows/
```

A workflow named `deploy.yml` that only runs on `workflow_dispatch` is a **manual** deploy.
Read the triggers before writing "pushes to main deploy automatically."

## Secrets — SSM Parameter Store and Secrets Manager are the source of truth

```bash
rg -n "ssm|secretsmanager" -i --glob '!*.lock' -l          # SDK or CLI usage
rg -n "get_parameter|get_secret_value|SSM_|SECRET_ARN" -i
rg -n 'aws_ssm_parameter|aws_secretsmanager_secret' --glob '*.tf'
rg -n "secrets\.|vars\." .github/workflows/               # what CI injects
cat .env.example 2>/dev/null                               # the shape of what's needed
rg -n "secretsmanager|valueFrom|secrets:" --glob '*.tf' --glob '*.ya?ml'
rg -n "System.get_env|os.environ|process\.env" -o --no-filename | sort -u | head -40
```

Report the **whole chain**, not just the store — e.g. `SSM /xomify/prod/* → Terraform reads
at plan time → Lambda environment → os.environ at runtime`. Where the secret lives is less
useful than how it gets into the process, which is what someone debugging a missing env var
needs.

Note the SSM or Secrets Manager path (`/[app-slug]/[env]/`) explicitly, and how local dev
gets secrets — those are the two facts people ask for most.

## Terraform / Terragrunt

```bash
rg -n 'backend "|cloud \{|organization|workspaces' --glob '*.tf'   # where state lives
rg -n 'prevent_destroy|ignore_changes|lifecycle' --glob '*.tf'     # what TF deliberately doesn't own
fd -e tf -d 1 . -x dirname | sort -u                               # workspace-per-folder layout
rg -n 'assume_role|oidc|OIDCProvider|TerraformExecutionRole' --glob '*.tf'
```

`ignore_changes = [task_definition]` means **CI owns deploys, Terraform owns the
infrastructure**. Say that out loud in the runbook — it's the thing that confuses everyone
who tries to fix a deploy by running `terraform apply`.

Note whether apply is auto or manual-confirm in TFC. Getting this backwards in a runbook is
how someone applies to prod expecting a plan.

## Containers

```bash
rg -n "^FROM|^EXPOSE|^CMD|^ENTRYPOINT|^HEALTHCHECK" Dockerfile*
rg -n "image:|ports:|depends_on:|healthcheck:|labels:|restart:" docker-compose*.ya?ml
rg -n "cloudfront|api_gateway|alb|route53" -i --glob '*.tf'   # routing + TLS
```

For the AWS repos the routing table is in Terraform, not Compose: a CloudFront distribution
plus its origins, or an API Gateway stage. Record the hostname and the distribution ID —
that is how someone finds the actual URL and how they invalidate the cache.

## Migrations and rollback

```bash
# Python / alembic
ls alembic/versions 2>/dev/null | tail -5 && rg -n "def downgrade" alembic/versions/ -l | tail -5
# Node / Prisma
ls prisma/migrations 2>/dev/null | tail -3
# DynamoDB — no migrations, so the risk is a shape change with no backfill
rg -n "aws_dynamodb_table" --glob '*.tf' -A5 | rg -n "name|hash_key|range_key"
rg -n "GSI|global_secondary_index" -i --glob '*.tf'
```

Two things to determine, and both matter more than the migration list itself:

1. **Does the deploy run migrations automatically**, or is it a separate step?
2. **Which migrations are irreversible?** An empty `down`/`downgrade`, a dropped column, a
   data backfill. These are what turn a rollback into an incident.

If a migration has no `down`, the rollback section must say so. "Revert the commit" is not a
rollback when the schema changed.

## Scheduled work

```bash
rg -n "cron|schedule" .github/workflows/
rg -n "celery|beat_schedule|APScheduler" -i         # Python
rg -n "crontab|node-cron" -i                        # Node
rg -n "aws_cloudwatch_event_rule|schedule_expression" --glob '*.tf'
```

For each: what it does, and **what breaks if it silently stops**. The second is the reason
it's in a runbook.

## Health and verification

```bash
rg -n "/health|/healthz|/_health|ping" --glob '!*test*'
rg -n "health_check|healthCheck|HEALTHCHECK|target_group" --glob '*.tf' --glob '*.ya?ml'
```

The runbook needs a concrete "how do I know the deploy worked" — a URL, a log line, a
dashboard. Not "check that it's up."

## Local run

```bash
rg -n '"scripts"' -A15 package.json 2>/dev/null
rg -n "^\[project.scripts\]" -A8 pyproject.toml 2>/dev/null
rg -n "defp aliases|def aliases" -A15 mix.exs 2>/dev/null
cat .tool-versions mise.toml .mise.toml 2>/dev/null   # runtime pinning
cat Makefile 2>/dev/null | head -30
rg -n "^#+ (Setup|Getting Started|Development|Running)" -A12 README.md 2>/dev/null
```

Prefer the README's stated sequence **only if** the commands it names still exist in the
manifest. A stale README setup section is common; check before copying it forward.

---

## Writing it up

- Facts get a source. `unknown` is a legitimate and preferred output.
- Prefer exact commands over descriptions. `fly deploy --config fly.prod.toml` beats
  "deploy with the Fly CLI."
- When repo and README disagree, the repo wins — and note the README is stale.
- If the deploy is genuinely undocumented anywhere in-repo, write that plainly. That absence
  is itself the finding, and it's worth an issue.
