# Security

ClipVault is self-hosted software: there is no public instance maintained by the
project, and no version is "supported" in the sense of a fix commitment. The
code is provided as is (see `LICENSE`).

## Reporting a vulnerability

Please use **GitHub → Security → Report a vulnerability** (private advisory)
rather than a public issue: the report stays visible to the maintainers only
until a fix ships.

Useful details: version or commit, configuration (`AUTH_MODE`, whether a proxy
terminates TLS), reproduction steps, and the impact you believe it has (reading
a private clip, bypassing rate limiting, code execution through an uploaded
file, …).

## In scope

- bypassing a clip's visibility (`public` / `members` / `link`) or its ownership
  (deleting someone else's clip);
- bypassing OIDC authentication or the `admin` role;
- path traversal, mishandled `Range`, or reading outside `MEDIA_DIR` through
  `/media/:slug/*`;
- command injection or sandbox escape around `ffprobe`/`ffmpeg` (crafted
  uploaded file);
- bypassing rate limiting through `X-Forwarded-For`;
- CSRF on routes that write.

## Out of scope

- the absence of per-form CSRF tokens: the model is `SameSite=Lax` plus an
  `Origin` check, documented in `server/README.md`;
- in-memory sessions (lost on restart) and the absence of a per-member quota:
  known limits, listed in the README;
- deployments that expose `AUTH_MODE=dev` or port `8099` to the Internet: a
  configuration mistake, not a vulnerability in the code.
