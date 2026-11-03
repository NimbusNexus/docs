---
title: Two-factor authentication
description: A TOTP second factor, from an authenticator app, on top of your password.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: two-factor-auth
---

# Two-factor authentication

Two-factor authentication adds a second factor (TOTP code from an authenticator app) on top of password login. The endpoints here turn it on, report it, and turn it off:

- `GET /api/v1/2fa/credential` — generates a TOTP secret and returns its QR code as an image. The secret itself comes in the `X-Secret-Key` response header.
- `POST /api/v1/2fa/totp_passcode_validation` — send that secret as `secretKey`, with a current six-digit `passcode` from the app. If the code matches, 2FA is on.
- `GET /api/v1/2fa/status` — `two_factor_enabled` says whether 2FA is on.
- `POST /api/v1/2fa/off` — turns 2FA off.

Each user has one TOTP secret; enrolling again replaces it.

For dashboard users, 2FA is browser-driven from the account settings page. Through the API, each call reads or changes only the signed-in caller's own 2FA, never another user's. API-key callers don't need 2FA — keys are themselves a "something you have" factor.

Strong recommendation: enable 2FA on every human account with role grants on production projects. Most account compromises trace to password reuse + no second factor.

## What's next {#next-steps}

- [Users](/docs/api/users) — the resource 2FA attaches to.
- [Authentication](/docs/authentication) — how API keys work (the non-2FA path).
- [Security model](/docs/security) — the wider context.
