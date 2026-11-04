---
title: Account overview
description: Sign-in and session calls — sign up, log in and out, reset or change a password, and switch project, workspace or region.
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: account-overview
---

# Account overview

These endpoints manage your sign-in and the session it opens. Signing up creates a [workspace](/docs/api/workspaces) named after your email, with you as its first user. Billing belongs to that workspace; see [Billing](/docs/api/invoices).

Each call acts on the caller's own sign-in, session or password:

- **Sign up** — `POST /api/v1/account/registration` emails a verification token. `POST /api/v1/account/reset_password` with `type: register`, the `token` and a `new_password` (at least 8 characters, repeated in `confirm_password`) finishes the signup.
- **Log in and out** — `POST /api/v1/account/login` takes `email` and `password` and returns an `access_token` with its `expires_at`. A user created inside a workspace also sends `domain`, the workspace's name. `GET /api/v1/account/logout` ends the session.
- **Passwords** — `POST /api/v1/account/forgot_password_request` emails a one-time reset token, and `POST /api/v1/account/reset_password` with `type: reset` sets the new password. `POST /api/v1/account/change_password` takes the `current_password` and the new one.
- **Scope and region** — `GET /api/v1/account/rescope` switches the session to a `project` or a `domain` (a workspace), and can switch its `region` too. `GET /api/v1/account/get_scope_choices` lists the workspaces, projects and regions you can switch to, `GET /api/v1/account/datacenters` lists the regions with their health, and `GET /api/v1/account/un_scope` drops the scope.

## What's next {#next-steps}

- [Workspaces](/docs/api/workspaces) — what signing up creates; projects live inside it.
- [Authentication](/docs/authentication) — how API keys work.
- [Region requests](/docs/api/region-requests) — ask NimbusNexus to open a region it doesn't serve yet.
