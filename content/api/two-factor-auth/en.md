---
title: Two-factor authentication
description: TOTP and WebAuthn second factors on your account.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: two-factor-auth
---

# Two-factor authentication

Two-factor authentication adds a second factor (TOTP code from an authenticator app, or a WebAuthn passkey) on top of password login. The endpoints here cover enrollment, listing devices, removing devices, and downloading recovery codes.

For dashboard users, 2FA is browser-driven from the account settings page; the API surface here is for automation (provisioning a new admin user, programmatically rotating recovery codes, enforcing org-wide 2FA before a compliance audit). API-key callers don't need 2FA — keys are themselves a "something you have" factor; 2FA gates the human dashboard login path.

Strong recommendation: enable 2FA on every human account with role grants on production projects. Most account compromises trace to password reuse + no second factor.

## What's next {#next-steps}

- [Users](/docs/api/users) — the resource 2FA attaches to.
- [Authentication](/docs/authentication) — how API keys work (the non-2FA path).
- [Security model](/docs/security) — the wider context.
