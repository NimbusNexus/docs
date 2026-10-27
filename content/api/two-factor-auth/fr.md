---
title: "Authentification à deux facteurs"
description: "Seconds facteurs TOTP et WebAuthn sur votre compte."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: two-factor-auth
---

# Authentification à deux facteurs

L’authentification à deux facteurs ajoute un second facteur (un code TOTP issu d’une application d’authentification, ou une passkey WebAuthn) en plus de la connexion par mot de passe. Les endpoints de cette page couvrent l’enrôlement, la liste des appareils, la suppression d’appareils et le téléchargement des codes de récupération.

Pour les utilisateurs de la console, la 2FA se gère dans le navigateur depuis la page des paramètres du compte ; les endpoints décrits ici servent à l’automatisation (provisionner un nouvel utilisateur admin, faire tourner les codes de récupération de façon programmatique, imposer la 2FA à l’échelle de l’organisation avant un audit de conformité). Les appelants qui utilisent une clé API n’ont pas besoin de la 2FA — les clés sont elles-mêmes un facteur « ce que vous possédez » ; la 2FA protège le chemin de connexion humain à la console.

Recommandation forte : activez la 2FA sur chaque compte humain qui détient des rôles sur des projets de production. La plupart des compromissions de compte s’expliquent par un mot de passe réutilisé + l’absence de second facteur.

## Étapes suivantes {#next-steps}

- [Utilisateurs](/docs/api/users) — la ressource à laquelle se rattache la 2FA.
- [Authentification](/docs/authentication) — comment fonctionnent les clés API (le chemin sans 2FA).
- [Modèle de sécurité](/docs/security) — le contexte plus large.
