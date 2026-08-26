# Code Style

Always loads. Governs the code itself. `writing-style.md` governs the prose
around it — chat, PRs, commits, comments.

Write the version a competent engineer writes when nobody is watching. The
failure mode this exists to correct: code that *looks* professional — docstrings
on every function, custom exception types, defensive fallbacks, a `utils/`
module, a comment narrating each line — and is 4x longer than it needed to be.
That extra mass is not robustness. It is surface area, and someone has to read it.

## The rules

**Say it once.** If the code says `total = sum(prices)`, do not add
`# calculate the total`. Comments explain *why*: a surprising business rule, a
workaround for an upstream bug, a decision that looks wrong but isn't. Never *what*.

Length is not the test — restatement is. Never trade a long comment for a short
one; trade a *what* for a *why*, at whatever length the why needs. Worked below.

**Let it crash.** No `try/except` without a specific recovery action. A real
traceback beats a caught error that logs and returns `None`, then explodes 40
lines later with no context. No bare `except`, no `except Exception: pass`, no
fallback path invented for a failure nobody named.

**Don't abstract until it hurts.** One implementation needs no base class,
protocol, registry, or factory. Two similar functions are fine as two functions.
Abstract on the third, and only if the shape is genuinely the same. A dataclass
holding two arguments is worse than two arguments.

**Prefer functions to classes.** Reach for a class when there's real state. A
class whose methods never touch `self` is a module with extra steps.

**No speculative code.** No parameters nobody passes, no config flags nobody
flips, no `**kwargs` passthrough "for flexibility", no backward-compat shim for
code that shipped ten minutes ago.

**Straight line beats nesting.** Guard clauses and early returns. Past three
levels of indentation, restructure.

**Names are short and true.** `rows`, not `processed_data_records`. `path`, not
`input_file_path_str`. A name should be as long as the scope it lives in.

**Stdlib first.** No dependency for what twenty lines of stdlib does. No
framework for a script.

**Delete instead of deprecating.** Version control remembers. No commented-out
code, no `# OLD:` blocks, no `_v2` beside `_v1`.

**Quiet output.** No emoji, no `print("=" * 60)` banners, no
`"🚀 Starting pipeline..."`. Print results, not narration.

**Docstrings when they earn it.** One line on a public function with a
non-obvious contract. None on `def add(a, b)`.

**Type hints on the seams.** Signatures yes, every local no. `dict` beats
`Dict[str, Any]`.

## Before you finish

Reread the change as a diff and ask, line by line: what breaks if this line is
gone? Delete every line that answers "nothing." Then check the shape:

- Comment restating the code → delete
- `try/except` with no recovery → delete
- Class with one method → function
- Function called from one place, used once → inline it
- Config object with fewer than three fields → arguments
- Docstring longer than the function → one line or none
- Log line narrating control flow → delete

Then report what you built in one or two sentences. No summary section, no
"Key Features" list. The code is the deliverable.

## What this is not

Short because nothing unnecessary is there — not because necessary things were
removed. Keep real edge cases, error handling with a genuine recovery path
(retry a flaky call, skip a bad row and report the count), tests, the comment
explaining the weird thing, and correctness. Terse and wrong is still wrong.

Don't golf either. A clever one-liner that takes a minute to decode fails the
same standard as the 60-line version — both make the reader work. Plain and
boring beats both.

## The four shapes, worked

Code go from top to bottom. Code do thing. Code stop.

**The wrapper tax.** A docstring, a `try/except` per failure mode, a log line
per step — around one expression.

```python
# 20 lines: def load_config_from_file(path) -> Optional[Dict[str, Any]]
#   docstring, try/open/json.load, log success, except FileNotFoundError -> None,
#   except JSONDecodeError -> None
config = json.loads(Path(path).read_text())
```

The function was never needed. A missing file's traceback says more than the log
line did, and returning `None` forces a check on every caller that the crash made
unnecessary.

**The class that wanted to be a function.** `DataProcessor(config)` with
`self.logger`, `_clean`, `_transform`, and `process` narrating its own start and
finish, is two lines:

```python
def process(df, min_amount):
    df = df.dropna(subset=["vendor", "amount"])
    return df[df.amount >= min_amount]
```

**Defensive noise.** Six nested `is not None` / `hasattr` / `len(...) > 0` checks
collapse to `results = response.data`. If `data` can genuinely be missing, handle
that one case. Don't defend against hypotheticals nobody named.

**Comments: length is the wrong axis.** The instinct on "fewer comments" is to
shorten, which deletes the wrong ones. `# increment the counter` is one line and
earns nothing. This is five and every one stays:

```python
# Memoized on (step, capabilities-so-far) rather than per-path. Enumerating
# simple paths was exponential in the diamond count — 13.9s at 61 steps, hours
# at ~90, on the event loop (#1459). Reaching a step with an accumulator already
# explored from cannot reach a new trifecta, since capabilities only grow.
# The memo is also what stops a cycle now, in place of the old per-path `seen`.
by_id = {s.get("id"): s for s in steps}
```

A measurement, an issue ref, and the argument for why the memo is safe — none of
it reconstructible from the code. Shortening it to `# memoize by (step, caps)`
throws away the content and keeps the part the code already said.

The question is never "is this comment long?" It's "what does a reader lose if I
delete it?" Nothing → delete it at any length. An hour of re-derivation → keep it
at any length. `guard-comments.js` enforces the mechanical half (a one-line
comment whose words all appear in the line below); the rest is judgment.

## When the why repeats: extract it

A why-comment earns its keep on one function. It stops being a comment and
becomes design documentation once the same invariant has to be re-argued at
every call site, or a module-level docstring runs to a full paragraph of
rationale. Signs you've crossed that line: two functions in the same file
justify the same constraint in their own words, or a docstring is longer than
the function it documents and none of it is usage.

Move the rationale to `docs/architecture/<topic>.md` once. Leave a one-line
comment or docstring sentence pointing at it — not a summary of it, a pointer.

```python
# Before: the module docstring re-argues the whole design on every read.
"""refresh_spotify_token — exchange a stored refresh token for a new access token.

Spotify rotates refresh tokens on some grants but not all, so we persist the
returned refresh_token only when present, otherwise the stored one stays
valid. Tokens are cached in DynamoDB keyed by user_id with a TTL set 60s
short of expires_in, because the cron Lambda and the API both read this and
a token that expires mid-request costs a retry ... [11 more lines]
"""

# After: the fact, not the argument. The argument lives in one doc, once.
"""Exchanges a stored refresh token for a fresh access token, writing both
back to DynamoDB with a TTL 60s short of expiry.
See docs/architecture/spotify-auth.md.
"""
```

Nothing was lost — the reasoning still exists, in one place, linkable from
every function that depends on it instead of restated by each. A reader who
needs the why clicks through; a reader who doesn't isn't taxed by it on every
pass through the file.
