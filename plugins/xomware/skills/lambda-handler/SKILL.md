---
name: lambda-handler
description: >
  ALWAYS use when writing or modifying an AWS Lambda handler in a Xomware Python
  backend (xomify-backend, xomper-back-end, xomcloud-backend, xomfit-backend). Covers
  the house handler shape: lambdas/<name>/handler.py, the @handle_errors decorator,
  lambdas/common helpers, typed errors, and DynamoDB access modules. Never write a new
  Lambda endpoint without this skill.
  Trigger phrases: "lambda", "handler", "endpoint", "api gateway", "event", "dynamo",
  "dynamodb", "boto3", "authorizer", "requestContext", "parse_body", "success_response",
  "cron lambda", "serverless".
---

# Lambda Handler — Xomware Python Backends

Xomware Python backends are AWS Lambda behind API Gateway. There is no FastAPI, Flask,
or ASGI app — the unit of work is a handler function taking `(event, context)`.

## Layout

```
lambdas/
  common/                       ← shared, imported by every handler
    errors.py                   ← typed error hierarchy
    logger.py                   ← get_logger(__file__)
    utility_helpers.py          ← parse_body, success_response, require_fields, ...
    <entity>_dynamo.py          ← all DynamoDB access for one entity
  <route_name>/
    handler.py                  ← one handler per route
tests/
  test_<route_name>.py
```

One directory per route, named after the route, snake_case:
`POST /shares/comments` → `lambdas/shares_comments_create/handler.py`.

## Handler Template

```python
"""
POST /shares/comments - Create a comment on a share.

Body schema:
    {
        "shareId": "<uuid>",
        "body":    "comment text (<= 500 chars)"
    }

Caller identity comes from `requestContext.authorizer.email`.
"""

from __future__ import annotations

from lambdas.common.logger import get_logger
from lambdas.common.errors import NotFoundError, ValidationError
from lambdas.common.utility_helpers import (
    parse_body,
    require_fields,
    success_response,
    get_caller_email,
)
from lambdas.common.shares_dynamo import get_share

log = get_logger(__file__)

HANDLER = "shares_comments_create"
BODY_MAX_LEN = 500


@handle_errors(HANDLER)
def handler(event, context):
    body = parse_body(event)
    require_fields(body, "shareId", "body")

    email: str = get_caller_email(event)
    share_id: str = body["shareId"]
    text: str = body["body"]

    if not isinstance(text, str):
        raise ValidationError(
            message="body must be a string",
            handler=HANDLER,
            function="handler",
            field="body",
        )

    text = text.strip()
    if not text or len(text) > BODY_MAX_LEN:
        raise ValidationError(
            message=f"body must be 1-{BODY_MAX_LEN} characters",
            handler=HANDLER,
            function="handler",
            field="body",
        )

    share = get_share(share_id)
    if not share:
        raise NotFoundError(
            message="share not found",
            handler=HANDLER,
            function="handler",
            resource=share_id,
        )

    # --- business logic ---

    return success_response({"ok": True})
```

## Rules

- **Module docstring is mandatory.** First line is `METHOD /path - summary`. Document the
  body schema and where caller identity comes from. This is the endpoint's contract.
- **`@handle_errors(HANDLER)` on every handler.** Never write a bare `try/except` around
  the whole body — the decorator owns error-to-response translation and logging.
- **`HANDLER` constant** at module level, matching the directory name. Every raised error
  carries `handler=HANDLER` and `function=` so logs are traceable.
- **Raise typed errors, never return error dicts.** `ValidationError`, `NotFoundError`,
  `ForbiddenError`, `AuthorizationError`, `DynamoDBError` from `lambdas.common.errors`.
  Each backend has its own base class (`XomifyError` and friends) — use the local one.
- **Caller identity comes from the authorizer**, via `get_caller_email(event)` /
  `get_caller_user_id(event)`. Never trust an email or user id sent in the request body.
- **Validate before you touch DynamoDB.** Required fields, then types, then bounds, then
  the read.
- **All DynamoDB access goes through `lambdas/common/<entity>_dynamo.py`.** Never call
  `boto3.resource("dynamodb")` from a handler.
- **Return `success_response(body, status_code=200)`** — never a hand-built
  `{"statusCode": ..., "body": json.dumps(...)}`.
- **`log = get_logger(__file__)`** at module level. Never `print`. Never log a token,
  a full auth header, or anything in the backend's `SENSITIVE_FIELDS`.
- **Secrets from SSM Parameter Store** via the project's `ssm_helpers`, resolved at cold
  start and cached. Never hardcoded, never in an env var in plaintext.
- `from __future__ import annotations` at the top of every module.
- Type-hint the locals you pull out of `event` — they are the untrusted boundary.

## Cron Handlers

Cron Lambdas receive an EventBridge event, not an API Gateway event. Branch on
`is_api_request(event)` / `is_cron_event(event)` when a handler serves both, and pass
`is_api=False` to `success_response` so the response isn't wrapped for API Gateway.

## Testing

pytest, one test module per handler at `tests/test_<route_name>.py`. Build the event
dict explicitly — including `requestContext.authorizer` — and assert on the returned
status code and parsed body.

```python
def test_rejects_body_over_max_length():
    event = api_event(
        body={"shareId": "abc", "body": "x" * 501},
        email="dom@example.com",
    )
    resp = handler(event, None)
    assert resp["statusCode"] == 400
```

Cover, at minimum: the happy path, each validation failure, missing caller identity,
and the not-found path. Mock the `_dynamo` module, not `boto3`.
