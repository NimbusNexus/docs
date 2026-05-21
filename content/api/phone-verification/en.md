---
title: Phone verification
description: Verify a phone number for SMS-based 2FA and account recovery.
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: phone-verification
---

# Phone verification

A verified phone number can act as a fallback second factor and as a recovery channel for the rare case where a user has lost both their password and their TOTP/WebAuthn device. Verification is the standard "we text a code, you enter it" flow.

SMS as a primary 2FA factor is weaker than TOTP or WebAuthn (SIM-swap attacks, SS7 issues). NimbusNexus supports SMS 2FA but defaults to TOTP for new enrollment; SMS is offered as the recovery-only path for production-tier accounts. Enterprise accounts can disable SMS entirely if their threat model excludes it.

## What's next {#next-steps}

- [Two-factor authentication](/docs/api/two-factor-auth) — the primary 2FA setup.
- [Users](/docs/api/users) — the resource phone numbers attach to.
