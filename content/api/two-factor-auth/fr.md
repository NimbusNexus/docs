---
title: "Authentification à deux facteurs"
description: "Un second facteur TOTP, issu d’une application d’authentification, en plus de votre mot de passe."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: two-factor-auth
---

# Authentification à deux facteurs

L’authentification à deux facteurs ajoute un second facteur (un code TOTP issu d’une application d’authentification) en plus de la connexion par mot de passe. Les endpoints de cette page l’activent, en indiquent l’état et la désactivent :

- `GET /api/v1/2fa/credential` — génère un secret TOTP et renvoie son QR code sous forme d’image. Le secret lui-même arrive dans le header de réponse `X-Secret-Key`.
- `POST /api/v1/2fa/totp_passcode_validation` — envoyez ce secret dans `secretKey`, avec un `passcode` actuel à six chiffres issu de l’application. Si le code correspond, la 2FA est activée.
- `GET /api/v1/2fa/status` — `two_factor_enabled` indique si la 2FA est activée.
- `POST /api/v1/2fa/off` — désactive la 2FA.

Chaque utilisateur a un seul secret TOTP ; un nouvel enrôlement le remplace.

Pour les utilisateurs de la console, la 2FA se gère dans le navigateur depuis la page des paramètres du compte. Via l’API, chaque appel ne lit ou ne modifie que la 2FA de l’appelant connecté lui-même, jamais celle d’un autre utilisateur. Les appelants qui utilisent une clé API n’ont pas besoin de la 2FA — les clés sont elles-mêmes un facteur « ce que vous possédez ».

Recommandation forte : activez la 2FA sur chaque compte humain qui détient des rôles sur des projets de production. La plupart des compromissions de compte s’expliquent par un mot de passe réutilisé + l’absence de second facteur.

## Étapes suivantes {#next-steps}

- [Utilisateurs](/docs/api/users) — la ressource à laquelle se rattache la 2FA.
- [Authentification](/docs/authentication) — comment fonctionnent les clés API (le chemin sans 2FA).
- [Modèle de sécurité](/docs/security) — le contexte plus large.
