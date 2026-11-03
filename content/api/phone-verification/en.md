---
title: Phone verification
description: Add a phone number to your user and verify it with a code sent by SMS.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: phone-verification
---

# Phone verification

Phone verification adds a phone number to your user and checks that it reaches you. Verification is the standard "we text a code, you enter it" flow.

`POST /api/v1/phone/` takes a `phone_code` (the country calling code, digits only) and a `phone_number`, and texts a six-digit code to that number. The code is good for 10 minutes. `POST /api/v1/phone/phone_passcode_validation` with that `passcode` marks the number verified. `GET /api/v1/phone/` shows the verified number, and `DELETE /api/v1/phone/` removes it. To change the number, start again with `POST /api/v1/phone/`.

A verified number isn't a second factor or a recovery channel. [Two-factor authentication](/docs/api/two-factor-auth) uses a TOTP code, and a lost password is reset by email (see [Account overview](/docs/api/account-overview)).

## What's next {#next-steps}

- [Two-factor authentication](/docs/api/two-factor-auth) — the TOTP second factor.
- [Users](/docs/api/users) — the resource phone numbers attach to.
